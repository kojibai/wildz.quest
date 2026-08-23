import type { WorldOverlayOwner } from "@/features/play/world-overlay-state";
import type { WalletCapabilityProjection, WalletLedgerEntryProjection, WalletLedgerPageProjection, WalletRecipientProjection, WalletSummaryProjection } from "@/lib/receiz/wilds-wallet-projections";
import { normalizeWildsWalletPublicUsername } from "@/lib/receiz/wilds-wallet-projections";

export type WildsWalletControllerStatus = "idle" | "loading" | "source-verified" | "verified" | "offline-verified" | "authority-required" | "failed" | "revoked";
export type WildsWalletPage = "overview" | "send" | "receive" | "assets" | "ledger";
export type WildsWalletFailureReason = "network" | "failed" | "authority-required" | "revoked";
export type WildsWalletReadResponse = Readonly<{ summary: WalletSummaryProjection; capabilities: WalletCapabilityProjection; ledger: WalletLedgerPageProjection | null }>;
export type WildsWalletRecipientState = Readonly<{ status: "idle" | "loading" | "verified" | "unavailable" | "failed"; requestId: number | null; username: string | null; projection: WalletRecipientProjection | null }>;
export type WildsWalletTransferProjection = Readonly<
  | { status: "staged"; rail: "settlement" | "reserve"; amountPhiMicro: string; quotedUsdCents: string }
  | { status: "unknown"; rail: "settlement" | "reserve"; amountPhiMicro: string }
  | { status: "zero-write"; rail: "settlement" | "reserve"; code: string }
  | { status: "committed"; rail: "settlement" | "reserve"; amountPhiMicro: string }
>;
export type WildsWalletStagedTransferResponse = Readonly<{
  status: "staged";
  rail: "settlement" | "reserve";
  amountPhiMicro: string;
  quotedUsdCents: string;
  attempt: string;
  expiresAtKai: number;
}>;
export type WildsWalletTransferState = Readonly<{
  phase: "recipient" | "amount" | "review" | "stage" | "authorize" | "authorize-pending" | "unknown" | "zero-write" | "committed";
  recipientUsername: string | null;
  amountPhiMicro: string | null;
  rail: "settlement" | "reserve" | null;
  operationNonce: string | null;
  attempt: string | null;
  expiresAtKai: number | null;
  requestId: number | null;
  authorizationPointerId: number | null;
  result: WildsWalletTransferProjection | null;
}>;
export type WildsWalletControllerState = Readonly<{
  identityKey: string; authorityGeneration: string; open: boolean; page: WildsWalletPage; status: WildsWalletControllerStatus;
  sourceAuthorityVerified: boolean;
  requestId: number | null; receiveRequestId: number | null; summary: WalletSummaryProjection | null; capabilities: WalletCapabilityProjection | null;
  ledger: WalletLedgerPageProjection | null; recipient: WildsWalletRecipientState; receiveLocator: string | null; stagedTransactionId: string | null;
  transfer: WildsWalletTransferState;
}>;
export type WildsWalletPresentationState = WildsWalletControllerState & Readonly<{ edgeAuthorityVerified?: boolean }>;
export type WildsWalletControllerEvent =
  | { type: "open" }
  | { type: "close" | "cancel-pending" }
  | { type: "navigate"; page: WildsWalletPage }
  | { type: "refresh-start"; requestId: number }
  | { type: "refresh-resolved"; requestId: number; identityKey: string; authorityGeneration: string; response: WildsWalletReadResponse }
  | { type: "source-authority-resolved"; identityKey: string; authorityGeneration: string; response: WildsWalletReadResponse | null }
  | { type: "refresh-failed"; requestId: number; reason: WildsWalletFailureReason }
  | { type: "identity-invalidated"; identityKey: string; authorityGeneration: string }
  | { type: "exclusive-owner-changed"; owner: WorldOverlayOwner }
  | { type: "recipient-start"; requestId: number; username: string }
  | { type: "recipient-resolved"; requestId: number; projection: WalletRecipientProjection }
  | { type: "recipient-failed"; requestId: number }
  | { type: "recipient-lookup-unavailable"; username: string }
  | { type: "receive-request-start"; requestId: number; identityKey: string }
  | { type: "receive-request-resolved"; requestId: number; identityKey: string; locator: string }
  | { type: "receive-request-cleared" }
  | { type: "transfer-reset" }
  | { type: "transfer-recipient-selected"; username: string }
  | { type: "transfer-amount-reviewed"; rail: "settlement" | "reserve"; amountPhiMicro: string; operationNonce: string }
  | { type: "transfer-stage-start"; requestId: number; identityKey: string; authorityGeneration: string }
  | { type: "transfer-stage-resolved"; requestId: number; identityKey: string; authorityGeneration: string; projection: WildsWalletStagedTransferResponse }
  | { type: "transfer-stage-failed"; requestId: number }
  | { type: "authorization-pointer-start"; pointerId: number }
  | { type: "authorization-pointer-cancel"; pointerId: number }
  | { type: "transfer-authorize-start"; requestId: number; pointerId: number }
  | { type: "transfer-recovery-start"; requestId: number }
  | { type: "transfer-result"; requestId: number; identityKey: string; authorityGeneration: string; projection: WildsWalletTransferProjection }
  | { type: "transfer-review-expired"; currentKai: number };

const emptyRecipient: WildsWalletRecipientState = Object.freeze({ status: "idle", requestId: null, username: null, projection: null });
const emptyTransfer: WildsWalletTransferState = Object.freeze({
  phase: "recipient", recipientUsername: null, amountPhiMicro: null, rail: null,
  operationNonce: null, attempt: null, expiresAtKai: null, requestId: null,
  authorizationPointerId: null, result: null
});
const V123_UNAVAILABLE = "receiz_v123_execution_unavailable";
const REVOKED_CODES = new Set(["receiz_wallet_authority_revoked", "receiz_wallet_token_revoked", "receiz_wallet_token_expired", "receiz_wallet_profile_binding_invalid", "receiz_wallet_token_binding_invalid"]);
const AUTHORITY_REQUIRED_CODES = new Set(["receiz_wallet_authority_required", "receiz_wallet_read_scope_required"]);

export function gateWildsWalletClientCapabilities(
  capabilities: WalletCapabilityProjection,
  ports: Readonly<{ proofAuthorization: boolean }>
): WalletCapabilityProjection {
  if (capabilities.recipientLookup.available && ports.proofAuthorization) return capabilities;
  const unavailable = Object.freeze({ available: false as const, reason: V123_UNAVAILABLE });
  return Object.freeze({ ...capabilities, send: unavailable, phiSettlement: unavailable, phiReserve: unavailable });
}

export function createWildsWalletControllerState(identityKey: string, authorityGeneration = ""): WildsWalletControllerState {
  return Object.freeze({ identityKey, authorityGeneration, open: false, page: "overview", status: "idle", sourceAuthorityVerified: false, requestId: null, receiveRequestId: null, summary: null, capabilities: null, ledger: null, recipient: emptyRecipient, receiveLocator: null, stagedTransactionId: null, transfer: emptyTransfer });
}
export function isWildsWalletRecipientLookupAllowed(hasDurableLimiter: boolean) { return hasDurableLimiter; }
export function walletAuthorityCacheKey(identityKey: string, authorityGeneration: string) { return authorityGeneration ? `${identityKey}:${authorityGeneration}` : null; }
function hasRetainedProjection(state: WildsWalletControllerState) { return state.summary !== null && state.capabilities !== null; }
function afterCancellation(state: WildsWalletControllerState, open: boolean): WildsWalletControllerState {
  const transfer = state.transfer.phase === "authorize-pending"
    ? { ...state.transfer, phase: "unknown" as const, requestId: null, authorizationPointerId: null }
    : state.transfer.phase === "stage"
      ? { ...state.transfer, phase: "review" as const, requestId: null, authorizationPointerId: null }
      : { ...state.transfer, requestId: null, authorizationPointerId: null };
  return { ...state, open, status: state.status === "loading" ? (hasRetainedProjection(state) ? "offline-verified" : "idle") : state.status, requestId: null, receiveRequestId: null, recipient: emptyRecipient, receiveLocator: null, transfer };
}
function clearPrivate(state: WildsWalletControllerState, status: Extract<WildsWalletControllerStatus, "authority-required" | "failed" | "revoked">): WildsWalletControllerState {
  return { ...state, status, requestId: null, receiveRequestId: null, summary: null, capabilities: null, ledger: null, recipient: emptyRecipient, receiveLocator: null, stagedTransactionId: null, transfer: emptyTransfer };
}
export function reduceWildsWalletController(state: WildsWalletControllerState, event: WildsWalletControllerEvent): WildsWalletControllerState {
  switch (event.type) {
    case "open": return state.open ? state : { ...state, open: true };
    case "close": return afterCancellation(state, false);
    case "cancel-pending": return afterCancellation(state, state.open);
    case "navigate": return state.page === event.page ? state : { ...state, page: event.page };
    case "refresh-start": return { ...state, status: "loading", requestId: event.requestId };
    case "source-authority-resolved":
      if (state.identityKey !== event.identityKey || state.authorityGeneration !== event.authorityGeneration || state.status === "verified") return state;
      return { ...state, status: "source-verified", sourceAuthorityVerified: true, ...(event.response ? { summary: event.response.summary, capabilities: event.response.capabilities, ledger: event.response.ledger } : {}) };
    case "refresh-resolved":
      if (state.requestId !== event.requestId || state.identityKey !== event.identityKey || state.authorityGeneration !== event.authorityGeneration) return state;
      // Transport reports whether an execution rail is available. It may enable
      // operations, but its wallet representation never replaces source truth.
      if (state.sourceAuthorityVerified) return { ...state, status: "source-verified", requestId: null, capabilities: event.response.capabilities };
      return { ...state, status: "verified", requestId: null, summary: event.response.summary, capabilities: event.response.capabilities, ledger: event.response.ledger };
    case "refresh-failed":
      if (state.requestId !== event.requestId) return state;
      if (state.sourceAuthorityVerified) return { ...state, status: "source-verified", requestId: null };
      if (event.reason === "revoked") return clearPrivate(state, "revoked");
      if (event.reason === "network" && hasRetainedProjection(state)) return { ...state, status: "offline-verified", requestId: null };
      return clearPrivate(state, event.reason === "authority-required" ? "authority-required" : "failed");
    case "identity-invalidated": return event.identityKey === state.identityKey && event.authorityGeneration === state.authorityGeneration ? state : createWildsWalletControllerState(event.identityKey, event.authorityGeneration);
    case "exclusive-owner-changed": return event.owner === "none" || event.owner === "wallet" ? state : afterCancellation(state, false);
    case "recipient-start": return { ...state, recipient: { status: "loading", requestId: event.requestId, username: event.username, projection: null } };
    case "recipient-resolved": return state.open && state.recipient.status === "loading" && state.recipient.requestId === event.requestId ? { ...state, recipient: { status: "verified", requestId: null, username: event.projection.username, projection: event.projection } } : state;
    case "recipient-failed": return state.recipient.status === "loading" && state.recipient.requestId === event.requestId ? { ...state, recipient: { ...state.recipient, status: "failed", requestId: null, projection: null } } : state;
    case "recipient-lookup-unavailable": return { ...state, recipient: { status: "unavailable", requestId: null, username: event.username, projection: null } };
    case "receive-request-start": return state.open && state.identityKey === event.identityKey ? { ...state, receiveRequestId: event.requestId, receiveLocator: null } : state;
    case "receive-request-resolved": return state.open && state.identityKey === event.identityKey && state.receiveRequestId === event.requestId ? { ...state, receiveRequestId: null, receiveLocator: event.locator } : state;
    case "receive-request-cleared": return state.receiveLocator === null && state.receiveRequestId === null ? state : { ...state, receiveRequestId: null, receiveLocator: null };
    case "transfer-reset": return { ...state, stagedTransactionId: null, transfer: emptyTransfer };
    case "transfer-recipient-selected":
      return { ...state, transfer: { ...emptyTransfer, phase: "amount", recipientUsername: event.username } };
    case "transfer-amount-reviewed":
      return state.transfer.recipientUsername
        ? { ...state, transfer: { ...state.transfer, phase: "review", amountPhiMicro: event.amountPhiMicro, rail: event.rail, operationNonce: event.operationNonce, attempt: null, expiresAtKai: null, requestId: null, result: null } }
        : state;
    case "transfer-stage-start":
      return state.open && state.identityKey === event.identityKey && state.authorityGeneration === event.authorityGeneration
        && state.transfer.phase === "review"
        ? { ...state, transfer: { ...state.transfer, phase: "stage", requestId: event.requestId } }
        : state;
    case "transfer-stage-resolved":
      if (!state.open || state.identityKey !== event.identityKey || state.authorityGeneration !== event.authorityGeneration
        || state.transfer.phase !== "stage" || state.transfer.requestId !== event.requestId
        || state.transfer.rail !== event.projection.rail || state.transfer.amountPhiMicro !== event.projection.amountPhiMicro) return state;
      return {
        ...state,
        stagedTransactionId: event.projection.attempt,
        transfer: { ...state.transfer, phase: "authorize", attempt: event.projection.attempt, expiresAtKai: event.projection.expiresAtKai, requestId: null, authorizationPointerId: null, result: { status: "staged", rail: event.projection.rail, amountPhiMicro: event.projection.amountPhiMicro, quotedUsdCents: event.projection.quotedUsdCents } }
      };
    case "transfer-stage-failed":
      return state.transfer.phase === "stage" && state.transfer.requestId === event.requestId
        ? { ...state, transfer: { ...state.transfer, phase: "review", requestId: null } } : state;
    case "authorization-pointer-start":
      return state.transfer.phase === "authorize"
        ? { ...state, transfer: { ...state.transfer, authorizationPointerId: event.pointerId } } : state;
    case "authorization-pointer-cancel":
      return state.transfer.authorizationPointerId === event.pointerId
        ? { ...state, transfer: { ...state.transfer, authorizationPointerId: null } } : state;
    case "transfer-authorize-start":
      return state.transfer.phase === "authorize" && state.transfer.authorizationPointerId === event.pointerId
        ? { ...state, transfer: { ...state.transfer, phase: "authorize-pending", requestId: event.requestId, authorizationPointerId: null } }
        : state;
    case "transfer-recovery-start":
      return state.transfer.phase === "unknown" && state.transfer.attempt
        ? { ...state, transfer: { ...state.transfer, requestId: event.requestId } } : state;
    case "transfer-result": {
      if (!state.open || state.identityKey !== event.identityKey || state.authorityGeneration !== event.authorityGeneration
        || state.transfer.requestId !== event.requestId || !state.transfer.attempt) return state;
      const exact = event.projection.rail === state.transfer.rail
        && (event.projection.status === "zero-write" || event.projection.amountPhiMicro === state.transfer.amountPhiMicro);
      const projection = exact ? event.projection : { status: "unknown" as const, rail: state.transfer.rail!, amountPhiMicro: state.transfer.amountPhiMicro! };
      const phase = projection.status === "committed" ? "committed" as const
        : projection.status === "zero-write" ? "zero-write" as const
          : "unknown" as const;
      return {
        ...state,
        stagedTransactionId: phase === "unknown" ? state.stagedTransactionId : null,
        transfer: { ...state.transfer, phase, requestId: null, authorizationPointerId: null, result: projection }
      };
    }
    case "transfer-review-expired":
      return state.transfer.phase === "authorize" && state.transfer.expiresAtKai !== null && event.currentKai >= state.transfer.expiresAtKai
        ? { ...state, stagedTransactionId: null, transfer: { ...state.transfer, phase: "review", attempt: null, expiresAtKai: null, requestId: null, authorizationPointerId: null, result: null } }
        : state;
  }
}
export function classifyWildsWalletRefreshFailure({ status, code }: Readonly<{ status: number | null; code: string | null }>): WildsWalletFailureReason {
  if (code && REVOKED_CODES.has(code)) return "revoked";
  if (code && AUTHORITY_REQUIRED_CODES.has(code)) return "authority-required";
  if (status === 401) return "revoked";
  return status === null ? "network" : "failed";
}
type WalletRequest = Readonly<{ id: number; controller: AbortController }>;
export function createWildsWalletRequestRuntime() {
  let sequence = 0;
  let refresh: WalletRequest | null = null;
  let receive: WalletRequest | null = null;
  let transfer: WalletRequest | null = null;
  const diagnostics = { refreshStarts: 0, receiveStarts: 0, transferStarts: 0, cacheWrites: 0, publications: 0 };
  const begin = (kind: "refresh" | "receive" | "transfer", replace = false) => {
    const current = kind === "refresh" ? refresh : kind === "receive" ? receive : transfer;
    if (current && !replace) return null;
    current?.controller.abort();
    const next = { id: ++sequence, controller: new AbortController() };
    if (kind === "refresh") { refresh = next; diagnostics.refreshStarts += 1; }
    else if (kind === "receive") { receive = next; diagnostics.receiveStarts += 1; }
    else { transfer = next; diagnostics.transferStarts += 1; }
    return next;
  };
  return {
    beginRefresh(options: Readonly<{ replace?: boolean }> = {}) { return begin("refresh", options.replace); },
    beginReceive() { return begin("receive"); },
    beginTransfer(options: Readonly<{ replace?: boolean }> = {}) { return begin("transfer", options.replace); },
    isCurrentRefresh(id: number) { return refresh?.id === id; }, isCurrentReceive(id: number) { return receive?.id === id; }, isCurrentTransfer(id: number) { return transfer?.id === id; },
    finishRefresh(id: number) { if (refresh?.id === id) refresh = null; }, finishReceive(id: number) { if (receive?.id === id) receive = null; }, finishTransfer(id: number) { if (transfer?.id === id) transfer = null; },
    cancelAll() { refresh?.controller.abort(); receive?.controller.abort(); transfer?.controller.abort(); refresh = null; receive = null; transfer = null; },
    recordCacheWrite() { diagnostics.cacheWrites += 1; }, recordPublication() { diagnostics.publications += 1; },
    diagnostics() { return { ...diagnostics }; }
  };
}
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function exact(item: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) { const allowed = new Set([...required, ...optional]); return required.every((key) => key in item) && Object.keys(item).every((key) => allowed.has(key)); }
function count(value: unknown) { return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 10_000; }
function micro(value: unknown) { return typeof value === "string" && /^[0-9]{1,30}$/.test(value); }
function cursor(value: unknown) { return value === null || (typeof value === "string" && value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value)); }
function createdAt(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && new Date(value).toISOString() === value; }
function positiveMicro(value: unknown) { return typeof value === "string" && /^[1-9][0-9]{0,29}$/.test(value); }
function transferRail(value: unknown): value is "settlement" | "reserve" { return value === "settlement" || value === "reserve"; }
export function admitWildsWalletRecipientResponse(value: unknown): WalletRecipientProjection {
  const item = record(value);
  if (!item || !exact(item, ["username", "profileMark", "allowedTransferKinds"])) throw new Error("wilds_wallet_recipient_projection_invalid");
  const username = normalizeWildsWalletPublicUsername(item.username);
  if (item.username !== username || (item.profileMark !== null && (typeof item.profileMark !== "string" || item.profileMark.length > 12 || !/^[A-Za-z0-9 ._-]+$/.test(item.profileMark)))) throw new Error("wilds_wallet_recipient_projection_invalid");
  if (!Array.isArray(item.allowedTransferKinds) || item.allowedTransferKinds.length > 3 || new Set(item.allowedTransferKinds).size !== item.allowedTransferKinds.length
    || item.allowedTransferKinds.some((kind) => kind !== "phi" && kind !== "resource" && kind !== "card")) throw new Error("wilds_wallet_recipient_projection_invalid");
  return Object.freeze({ username, profileMark: item.profileMark as string | null, allowedTransferKinds: Object.freeze(item.allowedTransferKinds as Array<"phi" | "resource" | "card">) });
}
export function admitWildsWalletStagedTransferResponse(value: unknown): WildsWalletStagedTransferResponse {
  const item = record(value);
  if (!item || !exact(item, ["status", "rail", "amountPhiMicro", "quotedUsdCents", "attempt", "expiresAtKai"])
    || item.status !== "staged" || !transferRail(item.rail) || !positiveMicro(item.amountPhiMicro)
    || typeof item.quotedUsdCents !== "string" || !/^[0-9]{1,30}$/.test(item.quotedUsdCents)
    || typeof item.attempt !== "string" || item.attempt.length < 8 || item.attempt.length > 4_096
    || !Number.isSafeInteger(item.expiresAtKai) || (item.expiresAtKai as number) < 0) throw new Error("wilds_wallet_transfer_projection_invalid");
  return Object.freeze(item) as WildsWalletStagedTransferResponse;
}
export function admitWildsWalletTransferResponse(value: unknown): WildsWalletTransferProjection {
  const item = record(value);
  if (!item || !transferRail(item.rail)) throw new Error("wilds_wallet_transfer_projection_invalid");
  if (item.status === "staged" && exact(item, ["status", "rail", "amountPhiMicro", "quotedUsdCents"])
    && positiveMicro(item.amountPhiMicro) && typeof item.quotedUsdCents === "string" && /^[0-9]{1,30}$/.test(item.quotedUsdCents)) return Object.freeze(item) as WildsWalletTransferProjection;
  if ((item.status === "unknown" || item.status === "committed") && exact(item, ["status", "rail", "amountPhiMicro"]) && positiveMicro(item.amountPhiMicro)) return Object.freeze(item) as WildsWalletTransferProjection;
  if (item.status === "zero-write" && exact(item, ["status", "rail", "code"]) && typeof item.code === "string" && /^[A-Z_]{3,64}$/.test(item.code)) return Object.freeze(item) as WildsWalletTransferProjection;
  throw new Error("wilds_wallet_transfer_projection_invalid");
}
function isSummary(value: unknown): value is WalletSummaryProjection {
  const item = record(value);
  return Boolean(item && exact(item, ["status", "admittedPhiMicro", "displayUsdCents", "assetCountsStatus", "transferableResourceCount", "transferableCardCount", "reservedCardCount", "pendingCount"]) && item.status === "verified" && micro(item.admittedPhiMicro) && (item.displayUsdCents === null || micro(item.displayUsdCents)) && ((item.assetCountsStatus === "unknown" && item.transferableResourceCount === null && item.transferableCardCount === null && item.reservedCardCount === null && item.pendingCount === null) || (item.assetCountsStatus === "available" && count(item.transferableResourceCount) && count(item.transferableCardCount) && count(item.reservedCardCount) && count(item.pendingCount))));
}
function capability(value: unknown) { const item = record(value); return Boolean(item && ((exact(item, ["available"]) && item.available === true) || (exact(item, ["available", "reason"]) && item.available === false && (item.reason === V123_UNAVAILABLE || item.reason === "receiz_v123_scope_required")))); }
function isCapabilities(value: unknown): value is WalletCapabilityProjection {
  const item = record(value);
  return Boolean(item && exact(item, ["read", "receive", "recipientLookup", "send", "resourceTransfer", "cardTransfer", "phiSettlement", "phiReserve"]) && item.read === "available" && item.receive === "available" && capability(item.recipientLookup) && capability(item.send) && capability(item.resourceTransfer) && capability(item.cardTransfer) && capability(item.phiSettlement) && capability(item.phiReserve));
}
function isLedgerEntry(value: unknown): value is WalletLedgerEntryProjection {
  const item = record(value);
  let counterpartyValid = item?.counterpartyUsername === undefined;
  if (item && typeof item.counterpartyUsername === "string") {
    try { counterpartyValid = normalizeWildsWalletPublicUsername(item.counterpartyUsername) === item.counterpartyUsername; } catch { counterpartyValid = false; }
  }
  return Boolean(item && exact(item, ["receiptReference", "direction", "state", "createdAt"], ["counterpartyUsername", "amountPhiMicro", "kaiPulse"]) && item.receiptReference === null && ["sent", "received", "unknown"].includes(String(item.direction)) && ["unknown", "committed", "pending", "rejected", "recovered", "reversed"].includes(String(item.state)) && createdAt(item.createdAt) && counterpartyValid && (item.amountPhiMicro === undefined || micro(item.amountPhiMicro)) && (item.kaiPulse === undefined || (Number.isSafeInteger(item.kaiPulse) && typeof item.kaiPulse === "number" && item.kaiPulse >= 0)));
}
function isLedger(value: unknown): value is WalletLedgerPageProjection {
  const item = record(value);
  return Boolean(item && exact(item, ["cursor", "nextCursor", "entries"]) && cursor(item.cursor) && cursor(item.nextCursor) && Array.isArray(item.entries) && item.entries.length <= 50 && item.entries.every(isLedgerEntry));
}
export function admitWildsWalletReadResponse(value: unknown): WildsWalletReadResponse {
  const item = record(value);
  if (!item || !exact(item, ["summary", "capabilities", "ledger"]) || !isSummary(item.summary) || !isCapabilities(item.capabilities) || (item.ledger !== null && !isLedger(item.ledger))) throw new Error("wilds_wallet_projection_invalid");
  return Object.freeze({ summary: item.summary, capabilities: item.capabilities, ledger: item.ledger });
}
export function createWildsWalletSessionCache(maxEntries: number) {
  const entries = new Map<string, WildsWalletReadResponse>();
  return {
    read(key: string | null) { return key ? entries.get(key) ?? null : null; },
    write(key: string | null, value: unknown) { if (!key || !Number.isSafeInteger(maxEntries) || maxEntries < 1) return; entries.delete(key); entries.set(key, admitWildsWalletReadResponse(value)); while (entries.size > maxEntries) entries.delete(entries.keys().next().value!); },
    delete(key: string | null) { if (key) entries.delete(key); }, clear() { entries.clear(); }
  };
}
export function hydrateWildsWalletControllerState(identityKey: string, authorityGeneration: string, cache: ReturnType<typeof createWildsWalletSessionCache>) {
  const state = createWildsWalletControllerState(identityKey, authorityGeneration);
  const cached = cache.read(walletAuthorityCacheKey(identityKey, authorityGeneration));
  return cached ? { ...state, status: "offline-verified" as const, summary: cached.summary, capabilities: cached.capabilities, ledger: cached.ledger } : state;
}
