import type { WorldOverlayOwner } from "@/features/play/world-overlay-state";
import {
  admitWildsWalletStagedTransferResponse,
  admitWildsWalletTransferResponse,
  admitWildsWalletReadResponse,
  classifyWildsWalletRefreshFailure,
  createWildsWalletRequestRuntime,
  createWildsWalletSessionCache,
  hydrateWildsWalletControllerState,
  reduceWildsWalletController,
  walletAuthorityCacheKey,
  type WildsWalletControllerState
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
  fetcher: DriverFetcher;
  publish(state: WildsWalletControllerState): void;
  cache?: ReturnType<typeof createWildsWalletSessionCache>;
}) {
  const cache = input.cache ?? wildsWalletSharedSessionCache;
  const runtime = createWildsWalletRequestRuntime();
  let state = hydrateWildsWalletControllerState(input.identityKey, input.authorityGeneration, cache);
  let refreshPromise: Promise<void> | null = null;
  let receivePromise: Promise<void> | null = null;
  let transferPromise: Promise<void> | null = null;
  const publish = (event: Parameters<typeof reduceWildsWalletController>[1]) => {
    state = reduceWildsWalletController(state, event);
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
      try {
        const [summary, capabilities, ledger] = await Promise.all([
          input.fetcher("/api/wilds/wallet/summary", { signal: request.controller.signal }).then(json),
          input.fetcher("/api/wilds/wallet/capabilities", { signal: request.controller.signal }).then(json),
          input.fetcher("/api/wilds/wallet/ledger", { signal: request.controller.signal }).then(json)
        ]);
        if (!runtime.isCurrentRefresh(request.id) || request.controller.signal.aborted) return;
        const response = admitWildsWalletReadResponse({ summary, capabilities, ledger });
        cache.write(walletAuthorityCacheKey(identityKey, authorityGeneration), response);
        runtime.recordCacheWrite();
        publish({ type: "refresh-resolved", requestId: request.id, identityKey, authorityGeneration, response });
      } catch (cause) {
        if (!runtime.isCurrentRefresh(request.id) || request.controller.signal.aborted) return;
        const failure = cause && typeof cause === "object" && "status" in cause ? cause as { status: number | null; code: string | null } : { status: null, code: null };
        const reason = classifyWildsWalletRefreshFailure(failure);
        if (reason === "revoked") cache.delete(walletAuthorityCacheKey(identityKey, authorityGeneration));
        publish({ type: "refresh-failed", requestId: request.id, reason });
      } finally {
        runtime.finishRefresh(request.id);
      }
    })();
    refreshPromise = operation;
    void operation.finally(() => { if (refreshPromise === operation) refreshPromise = null; });
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
        const response = await input.fetcher("/api/wilds/wallet/transfer/preview", {
          method: "POST",
          body: JSON.stringify({
            recipientUsername: transfer.recipientUsername,
            amountPhiMicro: transfer.amountPhiMicro,
            rail: transfer.rail,
            operationNonce: transfer.operationNonce
          }),
          signal: request.controller.signal
        });
        const projection = admitWildsWalletStagedTransferResponse(await json(response));
        if (!runtime.isCurrentTransfer(request.id) || request.controller.signal.aborted) return;
        publish({ type: "transfer-stage-resolved", requestId: request.id, identityKey, authorityGeneration, projection });
      } catch {
        if (runtime.isCurrentTransfer(request.id) && !request.controller.signal.aborted) publish({ type: "transfer-stage-failed", requestId: request.id });
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
    const operation = (async () => {
      try {
        const response = await input.fetcher("/api/wilds/wallet/transfer/execute", {
          method: "POST", body: JSON.stringify({ attempt, consent }), signal: request.controller.signal
        });
        const projection = admitWildsWalletTransferResponse(await json(response));
        if (!runtime.isCurrentTransfer(request.id) || request.controller.signal.aborted) return;
        publish({ type: "transfer-result", requestId: request.id, identityKey, authorityGeneration, projection });
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
        const response = await input.fetcher(`/api/wilds/wallet/transfer/status?attempt=${encodeURIComponent(attempt)}`, { signal: request.controller.signal });
        const projection = admitWildsWalletTransferResponse(await json(response));
        if (!runtime.isCurrentTransfer(request.id) || request.controller.signal.aborted) return;
        publish({ type: "transfer-result", requestId: request.id, identityKey, authorityGeneration, projection });
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
    diagnostics: runtime.diagnostics,
    open() { publish({ type: "open" }); },
    close() { runtime.cancelAll(); refreshPromise = null; receivePromise = null; transferPromise = null; publish({ type: "close" }); },
    cancelPending() { runtime.cancelAll(); refreshPromise = null; receivePromise = null; transferPromise = null; publish({ type: "cancel-pending" }); },
    cancelForExclusiveOwner(owner: WorldOverlayOwner) { if (owner !== "none" && owner !== "wallet") { runtime.cancelAll(); refreshPromise = null; receivePromise = null; transferPromise = null; publish({ type: "exclusive-owner-changed", owner }); } },
    setAuthority(identityKey: string, authorityGeneration: string) { cache.delete(walletAuthorityCacheKey(state.identityKey, state.authorityGeneration)); runtime.cancelAll(); refreshPromise = null; receivePromise = null; transferPromise = null; state = hydrateWildsWalletControllerState(identityKey, authorityGeneration, cache); runtime.recordPublication(); input.publish(state); },
    navigate(page: WildsWalletControllerState["page"]) { publish({ type: "navigate", page }); },
    recipientUnavailable(username: string) { publish({ type: "recipient-lookup-unavailable", username }); },
    selectTransferRecipient(username: string) { publish({ type: "transfer-recipient-selected", username }); },
    reviewTransferAmount(rail: "settlement" | "reserve", amountPhiMicro: string, operationNonce: string) { publish({ type: "transfer-amount-reviewed", rail, amountPhiMicro, operationNonce }); },
    authorizationPointerStart(pointerId: number) { publish({ type: "authorization-pointer-start", pointerId }); },
    authorizationPointerCancel(pointerId: number) { publish({ type: "authorization-pointer-cancel", pointerId }); },
    resetTransfer() { publish({ type: "transfer-reset" }); },
    expireTransferReview(currentKai: number) { publish({ type: "transfer-review-expired", currentKai }); },
    stageTransfer,
    authorizeTransfer,
    recoverTransfer,
    refresh,
    requestReceive
  };
}
