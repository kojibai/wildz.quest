import type { WorldOverlayOwner } from "@/features/play/world-overlay-state";
import { walletAuthorizationFailureCode } from "./wilds-wallet-authorization-error";
import { admitWildsWalletTransferRecovery, checkpointWildsWalletTransferRecovery, wildsWalletBrowserTransferRecoveryStore, type WildsWalletTransferRecoveryStore } from "./wilds-wallet-transfer-recovery";
import { projectWildsWalletCapabilities, normalizeWildsWalletPublicUsername } from "@/lib/receiz/wilds-wallet-projections";
import {
  admitWildsWalletStagedTransferResponse,
  admitWildsWalletTransferResponse,
  admitWildsWalletReadResponse,
  admitWildsWalletRecipientResponse,
  classifyWildsWalletRefreshFailure,
  createWildsWalletRequestRuntime,
  createWildsWalletSessionCache,
  hydrateWildsWalletControllerState,
  renewWildsWalletControllerState,
  reduceWildsWalletController,
  walletAuthorityCacheKey,
  type WildsWalletControllerState,
  type WildsWalletReadResponse,
  type WildsWalletTransferState
} from "./wilds-wallet-controller";

type DriverResponse = Readonly<{ ok: boolean; status: number; json(): Promise<unknown> }>;
type DriverFetcher = (path: string, init: Readonly<{ method?: string; body?: string; signal: AbortSignal }>) => Promise<DriverResponse>;
export type WildsWalletControllerDriver = ReturnType<typeof createWildsWalletControllerDriver>;
export const wildsWalletSharedSessionCache = createWildsWalletSessionCache(4);

async function json(response: DriverResponse) {
  const body = await response.json().catch(() => null);
  if (response.ok) return body;
  const code = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { error?: unknown }).error === "string"
    ? (body as { error: string }).error : null;
  throw { status: response.status, code };
}

export function createWildsWalletControllerDriver(input: {
  identityKey: string;
  authorityGeneration: string;
  sourceKey?: string;
  fetcher: DriverFetcher;
  readTimeoutMs?: number;
  transferTimeoutMs?: number;
  authorizationTimeoutMs?: number;
  publish(state: WildsWalletControllerState): void;
  cache?: ReturnType<typeof createWildsWalletSessionCache>;
  recoveryStore?: WildsWalletTransferRecoveryStore;
}) {
  const cache = input.cache ?? wildsWalletSharedSessionCache;
  const recoveryStore = input.recoveryStore ?? wildsWalletBrowserTransferRecoveryStore;
  const runtime = createWildsWalletRequestRuntime();
  let state = hydrateWildsWalletControllerState(input.identityKey, input.authorityGeneration, cache);
  const restoreRecovery = () => {
    try {
      const recovered = admitWildsWalletTransferRecovery(recoveryStore.load(state.identityKey), state.identityKey);
      if (recovered) state = { ...state, page: "send", stagedTransactionId: recovered.attempt, transfer: recovered };
    } catch { /* A browser projection grants no payment or signing authority. */ }
  };
  restoreRecovery();
  let refreshPromise: Promise<void> | null = null;
  let receivePromise: Promise<void> | null = null;
  let transferPromise: Promise<void> | null = null;
  let signingPromise: Promise<void> | null = null;
  let signingSequence = 0;
  let recipientRequest: Readonly<{ id: number; controller: AbortController }> | null = null;
  let recipientSequence = 0;
  let sourcePromise: Promise<void> | null = null;
  let sourceRevision = 0;
  let sourceKey = input.sourceKey ?? input.authorityGeneration;
  let sourceSnapshot: { response: WildsWalletReadResponse | null } | null = null;
  const boundedJson = (path: string, init: Parameters<DriverFetcher>[1], timeoutMs: number) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let cancel!: () => void;
    const operation = new Promise<unknown>((resolve, reject) => {
      cancel = () => { controller.abort(); reject(new Error("wallet_operation_cancelled")); };
      timer = setTimeout(() => { controller.abort(); reject(new Error("wallet_operation_timeout")); }, timeoutMs);
      init.signal.addEventListener("abort", cancel, { once: true });
      if (init.signal.aborted) cancel();
      else {
        try { input.fetcher(path, { ...init, signal: controller.signal }).then(json).then(resolve, reject); }
        catch (cause) { reject(cause); }
      }
    });
    return operation.finally(() => { clearTimeout(timer); init.signal.removeEventListener("abort", cancel); });
  };
  const publish = (event: Parameters<typeof reduceWildsWalletController>[1]) => {
    state = reduceWildsWalletController(state, event);
    try {
      if (state.transfer.phase === "committed" || state.transfer.phase === "zero-write") recoveryStore.delete(state.identityKey);
    } catch { /* A failed terminal cleanup retains the durable attempt for read-only rechecking. */ }
    runtime.recordPublication();
    input.publish(state);
  };
  const refresh = (options: Readonly<{ replace?: boolean }> = {}) => {
    if (!options.replace && refreshPromise) return refreshPromise;
    const request = runtime.beginRefresh(options);
    if (!request) return refreshPromise ?? Promise.resolve();
    const identityKey = state.identityKey;
    const authorityGeneration = state.authorityGeneration;
    publish({ type: "refresh-start", requestId: request.id });
    const operation = (async () => {
      const cleanups: Array<() => void> = [];
      try {
        const read = (path: string) => {
          const controller = new AbortController();
          return new Promise<unknown>((resolve, reject) => {
            const abort = () => { controller.abort(); reject(new Error("wallet_read_cancelled")); };
            const timer = setTimeout(() => { controller.abort(); reject(new Error("wallet_read_timeout")); }, input.readTimeoutMs ?? 10_000);
            request.controller.signal.addEventListener("abort", abort, { once: true });
            if (request.controller.signal.aborted) abort();
            Promise.resolve().then(() => input.fetcher(path, { signal: controller.signal })).then(json).then(resolve, reject);
            // Release listeners even when a transport ignores cancellation.
            controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
            const cleanup = () => { clearTimeout(timer); request.controller.signal.removeEventListener("abort", abort); };
            cleanups.push(cleanup);
          });
        };
        const details = Promise.allSettled([
          read("/api/wilds/wallet/capabilities"),
          read("/api/wilds/wallet/ledger")
        ]);
        const summary = await read("/api/wilds/wallet/summary");
        if (!runtime.isCurrentRefresh(request.id) || request.controller.signal.aborted) return;
        let response = admitWildsWalletReadResponse({ summary, capabilities: projectWildsWalletCapabilities(), ledger: null });
        const publishResponse = (pendingDetails: boolean) => {
          cache.write(walletAuthorityCacheKey(identityKey, authorityGeneration), response);
          runtime.recordCacheWrite();
          publish({ type: "refresh-resolved", pendingDetails, requestId: request.id, identityKey, authorityGeneration, response });
        };
        publishResponse(true);
        const [capabilities, ledger] = await details;
        if (!runtime.isCurrentRefresh(request.id) || request.controller.signal.aborted) return;
        // Optional endpoint failures must not hide a successfully admitted balance.
        if (capabilities.status === "fulfilled") {
          try { response = admitWildsWalletReadResponse({ ...response, capabilities: capabilities.value }); } catch { /* Keep conservative capabilities. */ }
        }
        if (ledger.status === "fulfilled") {
          try { response = admitWildsWalletReadResponse({ ...response, ledger: ledger.value }); } catch { /* History can be retried independently of the balance. */ }
        }
        publishResponse(false);
      } catch (cause) {
        if (!runtime.isCurrentRefresh(request.id) || request.controller.signal.aborted) return;
        const failure = cause && typeof cause === "object" && "status" in cause ? cause as { status: number | null; code: string | null } : { status: null, code: null };
        const reason = classifyWildsWalletRefreshFailure(failure);
        if (reason === "revoked") cache.delete(walletAuthorityCacheKey(identityKey, authorityGeneration));
        const code = failure.code ? walletAuthorizationFailureCode({ code: failure.code })
          : cause instanceof Error && cause.message === "wallet_read_timeout" ? "WALLET_READ_TIMEOUT" : "WALLET_READ_UNAVAILABLE";
        publish({ type: "refresh-failed", requestId: request.id, reason, code });
      } finally {
        request.controller.abort();
        for (const cleanup of cleanups) cleanup();
        runtime.finishRefresh(request.id);
      }
    })();
    refreshPromise = operation;
    void operation.finally(() => { if (refreshPromise === operation) refreshPromise = null; });
    return operation;
  };
  const admitSourceAuthority = (response: WildsWalletReadResponse | null, expected = { identityKey: state.identityKey, authorityGeneration: state.authorityGeneration }) => {
    const { identityKey, authorityGeneration } = expected;
    if (identityKey !== state.identityKey || authorityGeneration !== state.authorityGeneration) return;
    if (response && state.balanceBasis !== "current" && state.status !== "verified") {
      cache.write(walletAuthorityCacheKey(identityKey, authorityGeneration), response, "saved");
      runtime.recordCacheWrite();
    }
    publish({ type: "source-authority-resolved", identityKey, authorityGeneration, response });
  };
  const projectSourceAuthority = (project: () => Promise<WildsWalletReadResponse | null>): Promise<void> => {
    // A completed source admission belongs to this exact active authority.
    // Transport failure cannot change the durable Seal or require replaying it.
    if (state.sourceAuthorityVerified) return Promise.resolve();
    if (sourceSnapshot) {
      admitSourceAuthority(sourceSnapshot.response);
      return Promise.resolve();
    }
    if (sourcePromise) return sourcePromise;
    const revision = sourceRevision;
    const operation = (async () => {
      const response = await project();
      if (sourceRevision === revision) {
        sourceSnapshot = { response };
        admitSourceAuthority(response);
      }
    })();
    sourcePromise = operation;
    const retire = () => { if (sourcePromise === operation) sourcePromise = null; };
    void operation.then(retire, retire);
    return operation;
  };
  const requestReceive = (amountPhiMicro?: string) => {
    if (receivePromise) return receivePromise;
    const request = runtime.beginReceive();
    if (!request) return receivePromise ?? Promise.resolve();
    const identityKey = state.identityKey;
    publish({ type: "receive-request-start", requestId: request.id, identityKey });
    const operation = (async () => {
      try {
        const response = await input.fetcher("/api/wilds/wallet/request", { method: "POST", body: JSON.stringify(amountPhiMicro ? { amountPhiMicro } : {}), signal: request.controller.signal });
        const value = await json(response);
        if (!runtime.isCurrentReceive(request.id) || request.controller.signal.aborted) return;
        if (!value || typeof value !== "object" || Array.isArray(value) || typeof (value as { locator?: unknown }).locator !== "string") {
          publish({ type: "receive-request-cleared" });
          return;
        }
        publish({ type: "receive-request-resolved", requestId: request.id, identityKey, locator: (value as { locator: string }).locator });
      } catch {
        if (runtime.isCurrentReceive(request.id) && !request.controller.signal.aborted) publish({ type: "receive-request-cleared" });
      } finally {
        runtime.finishReceive(request.id);
      }
    })();
    receivePromise = operation;
    void operation.finally(() => { if (receivePromise === operation) receivePromise = null; });
    return operation;
  };
  const lookupRecipient = (username: string) => {
    if (state.transfer.phase !== "recipient") return Promise.resolve();
    if (state.capabilities?.recipientLookup.available === false) {
      try { publish({ type: "transfer-recipient-selected", username: normalizeWildsWalletPublicUsername(username) }); }
      catch { publish({ type: "recipient-start", requestId: ++recipientSequence, username }); publish({ type: "recipient-failed", requestId: recipientSequence }); }
      return Promise.resolve();
    }
    recipientRequest?.controller.abort();
    const request = { id: ++recipientSequence, controller: new AbortController() };
    recipientRequest = request;
    publish({ type: "recipient-start", requestId: request.id, username });
    return (async () => {
      try {
        const requestedUsername = normalizeWildsWalletPublicUsername(username);
        const response = await boundedJson("/api/wilds/wallet/recipient", {
          method: "POST", body: JSON.stringify({ username: requestedUsername }), signal: request.controller.signal
        }, input.readTimeoutMs ?? 10_000);
        const projection = admitWildsWalletRecipientResponse(response);
        if (projection.username !== requestedUsername) throw new Error("wilds_wallet_recipient_projection_crossed");
        if (recipientRequest?.id === request.id && !request.controller.signal.aborted) {
          publish({ type: "recipient-resolved", requestId: request.id, projection });
          publish({ type: "transfer-recipient-selected", username: projection.username });
        }
      } catch (cause) {
        if (recipientRequest?.id !== request.id || request.controller.signal.aborted) return;
        const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code?: unknown }).code : null;
        if (code === "receiz_wallet_recipient_lookup_unavailable") {
          const normalized = normalizeWildsWalletPublicUsername(username);
          publish({ type: "recipient-lookup-unavailable", username: normalized });
          publish({ type: "transfer-recipient-selected", username: normalized });
        }
        else publish({ type: "recipient-failed", requestId: request.id });
      } finally {
        if (recipientRequest?.id === request.id) recipientRequest = null;
      }
    })();
  };
  const stageTransfer = () => {
    if (transferPromise) return transferPromise;
    const transfer = state.transfer;
    if (transfer.phase !== "review" || !transfer.recipientUsername || !transfer.amountPhiMicro || !transfer.rail || !transfer.operationNonce) return Promise.resolve();
    const request = runtime.beginTransfer();
    if (!request) return transferPromise ?? Promise.resolve();
    const identityKey = state.identityKey;
    const authorityGeneration = state.authorityGeneration;
    publish({ type: "transfer-stage-start", requestId: request.id, identityKey, authorityGeneration });
    const operation = (async () => {
      try {
        const response = await boundedJson("/api/wilds/wallet/transfer/preview", {
          method: "POST",
          body: JSON.stringify({
            ...(transfer.recipientLocator ? { recipientLocator: transfer.recipientLocator } : { recipientUsername: transfer.recipientUsername }),
            amountPhiMicro: transfer.amountPhiMicro,
            rail: transfer.rail,
            operationNonce: transfer.operationNonce
          }),
          signal: request.controller.signal
        }, input.transferTimeoutMs ?? 15_000);
        const projection = admitWildsWalletStagedTransferResponse(response);
        if (projection.rail !== transfer.rail || projection.amountPhiMicro !== transfer.amountPhiMicro) throw new Error("wilds_wallet_transfer_projection_crossed");
        if (!runtime.isCurrentTransfer(request.id) || request.controller.signal.aborted) return;
        publish({ type: "transfer-stage-resolved", requestId: request.id, identityKey, authorityGeneration, projection });
      } catch (cause) {
        const code = cause && typeof cause === "object" && "code" in cause ? cause.code : null;
        const message = code === "wilds_wallet_transfer_insufficient_value" ? "Your available PHI is lower than this amount. Edit the amount and try again."
          : code === "receiz_wallet_phi_scope_required" ? "This Receiz session cannot send PHI yet. Reconnect your Receiz ID and retry."
          : code === "wilds_wallet_receive_locator_expired" ? "This receiving QR has expired. Ask for a new QR or enter the recipient’s username."
          : undefined;
        if (runtime.isCurrentTransfer(request.id) && !request.controller.signal.aborted) publish({ type: "transfer-stage-failed", requestId: request.id, message });
      } finally {
        runtime.finishTransfer(request.id);
      }
    })();
    transferPromise = operation;
    void operation.finally(() => { if (transferPromise === operation) transferPromise = null; });
    return operation;
  };
  const transferUnknown = (requestId: number, identityKey: string, authorityGeneration: string) => {
    const current = state.transfer;
    if (!current.rail || !current.amountPhiMicro) return;
    publish({
      type: "transfer-result", requestId, identityKey, authorityGeneration,
      projection: { status: "unknown", rail: current.rail, amountPhiMicro: current.amountPhiMicro }
    });
  };
  const authorizeTransfer = (pointerId: number, consent: Readonly<{ artifact: unknown; challenge: unknown }>) => {
    if (transferPromise) return transferPromise;
    const request = runtime.beginTransfer();
    if (!request) return transferPromise ?? Promise.resolve();
    const identityKey = state.identityKey;
    const authorityGeneration = state.authorityGeneration;
    publish({ type: "transfer-authorize-start", requestId: request.id, pointerId });
    if (state.transfer.phase !== "authorize-pending" || !state.transfer.attempt) {
      runtime.finishTransfer(request.id);
      return Promise.resolve();
    }
    const attempt = state.transfer.attempt;
    try {
      checkpointWildsWalletTransferRecovery(recoveryStore, identityKey, sourceKey, state.transfer);
    } catch {
      publish({ type: "transfer-checkpoint-failed", requestId: request.id });
      runtime.finishTransfer(request.id);
      return Promise.resolve();
    }
    const operation = (async () => {
      try {
        const response = await boundedJson("/api/wilds/wallet/transfer/execute", {
          method: "POST", body: JSON.stringify({ attempt, consent }), signal: request.controller.signal
        }, input.transferTimeoutMs ?? 15_000);
        const projection = admitWildsWalletTransferResponse(response);
        if (!runtime.isCurrentTransfer(request.id) || request.controller.signal.aborted) return;
        publish({ type: "transfer-result", requestId: request.id, identityKey, authorityGeneration, projection });
        if (state.transfer.phase === "committed") await refresh({ replace: true });
      } catch {
        if (runtime.isCurrentTransfer(request.id) && !request.controller.signal.aborted) transferUnknown(request.id, identityKey, authorityGeneration);
      } finally {
        runtime.finishTransfer(request.id);
      }
    })();
    transferPromise = operation;
    void operation.finally(() => { if (transferPromise === operation) transferPromise = null; });
    return operation;
  };
  const signAndAuthorizeTransfer = (pointerId: number, authorize: (transfer: WildsWalletTransferState) => Promise<Readonly<{ artifact: unknown; challenge: unknown }>>) => {
    if (signingPromise) return signingPromise;
    const transfer = state.transfer;
    if (!state.open || transfer.phase !== "authorize" || transfer.authorizationPointerId !== pointerId || !transfer.attempt) return Promise.resolve();
    const identityKey = state.identityKey;
    const authorityGeneration = state.authorityGeneration;
    const signingId = ++signingSequence;
    // The deliberate gesture is complete. Latch it before identity I/O so a
    // subsequent pointer/key release cannot silently discard the signed send.
    publish({ type: "transfer-signing-start", pointerId });
    const isCurrent = () => signingSequence === signingId && state.open && state.identityKey === identityKey && state.authorityGeneration === authorityGeneration
      && state.transfer.phase === "signing" && state.transfer.attempt === transfer.attempt && state.transfer.authorizationPointerId === pointerId;
    const operation = (async () => {
      try {
        const signing = authorize(transfer);
        let timer!: ReturnType<typeof setTimeout>;
        const deadline = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("wallet_signing_timeout")), input.authorizationTimeoutMs ?? 30_000);
        });
        const consent = await Promise.race([signing, deadline]).finally(() => clearTimeout(timer));
        if (isCurrent()) await authorizeTransfer(pointerId, consent);
      } catch (cause) {
        if (isCurrent()) publish({ type: "transfer-signing-failed", pointerId });
        throw cause;
      }
    })();
    signingPromise = operation;
    const retire = () => { if (signingPromise === operation) signingPromise = null; };
    void operation.then(retire, retire);
    return operation;
  };
  const recoverTransfer = () => {
    if (transferPromise) return transferPromise;
    const attempt = state.transfer.attempt;
    if (state.transfer.phase !== "unknown" || !attempt) return Promise.resolve();
    const request = runtime.beginTransfer();
    if (!request) return transferPromise ?? Promise.resolve();
    const identityKey = state.identityKey;
    const authorityGeneration = state.authorityGeneration;
    publish({ type: "transfer-recovery-start", requestId: request.id });
    const operation = (async () => {
      try {
        const response = await boundedJson(`/api/wilds/wallet/transfer/status?attempt=${encodeURIComponent(attempt)}`, { signal: request.controller.signal }, input.transferTimeoutMs ?? 15_000);
        const projection = admitWildsWalletTransferResponse(response);
        if (!runtime.isCurrentTransfer(request.id) || request.controller.signal.aborted) return;
        publish({ type: "transfer-result", requestId: request.id, identityKey, authorityGeneration, projection });
        if (state.transfer.phase === "committed") await refresh({ replace: true });
      } catch {
        if (runtime.isCurrentTransfer(request.id) && !request.controller.signal.aborted) transferUnknown(request.id, identityKey, authorityGeneration);
      } finally {
        runtime.finishTransfer(request.id);
      }
    })();
    transferPromise = operation;
    void operation.finally(() => { if (transferPromise === operation) transferPromise = null; });
    return operation;
  };
  return {
    get state() { return state; },
    get sourceKey() { return sourceKey; },
    diagnostics: runtime.diagnostics,
    open() { publish({ type: "open" }); },
    close() { runtime.cancelAll(); recipientRequest?.controller.abort(); recipientRequest = null; refreshPromise = null; receivePromise = null; transferPromise = null; signingPromise = null; publish({ type: "close" }); },
    dispose() { sourceRevision++; sourcePromise = null; sourceSnapshot = null; this.close(); },
    cancelPending() { runtime.cancelAll(); recipientRequest?.controller.abort(); recipientRequest = null; refreshPromise = null; receivePromise = null; transferPromise = null; signingPromise = null; publish({ type: "cancel-pending" }); },
    cancelForExclusiveOwner(owner: WorldOverlayOwner) { if (owner !== "none" && owner !== "wallet") {
      if (!state.open && !recipientRequest && state.receiveRequestId === null && state.transfer.requestId === null && state.transfer.authorizationPointerId === null) return;
      runtime.cancelInteractive(); recipientRequest?.controller.abort(); recipientRequest = null; receivePromise = null; transferPromise = null; signingPromise = null; publish({ type: "exclusive-owner-changed", owner }); } },
    setAuthority(identityKey: string, authorityGeneration: string, localSourceKey = authorityGeneration) {
      // Renewing distribution credentials does not replace the local proof.
      // An account/source replacement retires both completed and pending work.
      if (state.identityKey !== identityKey || sourceKey !== localSourceKey) {
        sourceRevision++; sourcePromise = null; sourceSnapshot = null; sourceKey = localSourceKey;
      }
      cache.delete(walletAuthorityCacheKey(state.identityKey, state.authorityGeneration)); runtime.cancelAll(); recipientRequest?.controller.abort();
      recipientRequest = null; refreshPromise = null; receivePromise = null; transferPromise = null; signingPromise = null;
      state = renewWildsWalletControllerState(state, hydrateWildsWalletControllerState(identityKey, authorityGeneration, cache));
      restoreRecovery();
      runtime.recordPublication(); input.publish(state);
    },
    navigate(page: WildsWalletControllerState["page"]) { publish({ type: "navigate", page }); },
    recipientUnavailable(username: string) { publish({ type: "recipient-lookup-unavailable", username }); },
    lookupRecipient,
    selectTransferRecipient(username: string) { publish({ type: "transfer-recipient-selected", username }); },
    selectReceiveCoordinate(username: string, locator: string, amountPhiMicro: string | null) { publish({ type: "transfer-coordinate-selected", username, locator, amountPhiMicro }); },
    reviewTransferAmount(rail: "settlement" | "reserve", amountPhiMicro: string, operationNonce: string) { publish({ type: "transfer-amount-reviewed", rail, amountPhiMicro, operationNonce }); },
    authorizationPointerStart(pointerId: number) { publish({ type: "authorization-pointer-start", pointerId }); },
    authorizationPointerCancel(pointerId: number) { publish({ type: "authorization-pointer-cancel", pointerId }); },
    editTransfer(field: "recipient" | "amount") { publish({ type: "transfer-edit", field }); },
    resetTransfer() { publish({ type: "transfer-reset" }); },
    expireTransferReview(currentKai: number) { publish({ type: "transfer-review-expired", currentKai }); },
    stageTransfer,
    authorizeTransfer,
    signAndAuthorizeTransfer,
    recoverTransfer,
    refresh,
    admitSourceAuthority,
    projectSourceAuthority,
    requestReceive
  };
}
