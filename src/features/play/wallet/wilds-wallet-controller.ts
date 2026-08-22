import type {
  WalletCapabilityProjection,
  WalletLedgerPageProjection,
  WalletRecipientProjection,
  WalletSummaryProjection
} from "@/lib/receiz/wilds-wallet-projections";

export type WildsWalletControllerStatus =
  | "idle"
  | "loading"
  | "verified"
  | "offline-verified"
  | "authority-required"
  | "failed"
  | "revoked";

export type WildsWalletPage = "overview" | "send" | "receive" | "assets" | "ledger";

export type WildsWalletRecipientState = Readonly<{
  status: "idle" | "loading" | "verified" | "unavailable" | "failed";
  requestId: number | null;
  username: string | null;
  projection: WalletRecipientProjection | null;
}>;

export type WildsWalletControllerState = Readonly<{
  identityKey: string;
  open: boolean;
  page: WildsWalletPage;
  status: WildsWalletControllerStatus;
  requestId: number | null;
  summary: WalletSummaryProjection | null;
  capabilities: WalletCapabilityProjection | null;
  ledger: WalletLedgerPageProjection | null;
  recipient: WildsWalletRecipientState;
  receiveLocator: string | null;
  stagedTransactionId: string | null;
}>;

export type WildsWalletControllerEvent =
  | { type: "open" }
  | { type: "close" }
  | { type: "navigate"; page: WildsWalletPage }
  | { type: "refresh-start"; requestId: number }
  | { type: "refresh-resolved"; requestId: number; identityKey: string; summary: WalletSummaryProjection; capabilities: WalletCapabilityProjection; ledger?: WalletLedgerPageProjection | null }
  | { type: "refresh-failed"; requestId: number; reason: "network" | "failed" | "authority-required" | "revoked" }
  | { type: "identity-invalidated"; identityKey: string }
  | { type: "recipient-start"; requestId: number; username: string }
  | { type: "recipient-resolved"; requestId: number; projection: WalletRecipientProjection }
  | { type: "recipient-failed"; requestId: number }
  | { type: "recipient-lookup-unavailable"; username: string }
  | { type: "receive-request-resolved"; locator: string }
  | { type: "receive-request-cleared" };

const emptyRecipient: WildsWalletRecipientState = Object.freeze({
  status: "idle", requestId: null, username: null, projection: null
});

export function createWildsWalletControllerState(identityKey: string): WildsWalletControllerState {
  return Object.freeze({
    identityKey,
    open: false,
    page: "overview",
    status: "idle",
    requestId: null,
    summary: null,
    capabilities: null,
    ledger: null,
    recipient: emptyRecipient,
    receiveLocator: null,
    stagedTransactionId: null
  });
}

export function isWildsWalletRecipientLookupAllowed(hasDurableLimiter: boolean) {
  return hasDurableLimiter;
}

function hasRetainedVerifiedProjection(state: WildsWalletControllerState) {
  return state.summary !== null && state.capabilities !== null;
}

function acceptsRefreshCompletion(state: WildsWalletControllerState, requestId: number) {
  return state.status === "loading" && state.requestId === requestId;
}

export function reduceWildsWalletController(
  state: WildsWalletControllerState,
  event: WildsWalletControllerEvent
): WildsWalletControllerState {
  switch (event.type) {
    case "open":
      return state.open ? state : { ...state, open: true };
    case "close":
      return !state.open && state.recipient.status === "idle"
        ? state
        : { ...state, open: false, recipient: emptyRecipient };
    case "navigate":
      return state.page === event.page ? state : { ...state, page: event.page };
    case "refresh-start":
      return state.status === "loading"
        ? state
        : { ...state, status: "loading", requestId: event.requestId };
    case "refresh-resolved":
      if (event.identityKey !== state.identityKey || !acceptsRefreshCompletion(state, event.requestId)) return state;
      return {
        ...state,
        status: "verified",
        requestId: null,
        summary: event.summary,
        capabilities: event.capabilities,
        ledger: event.ledger ?? state.ledger
      };
    case "refresh-failed":
      if (!acceptsRefreshCompletion(state, event.requestId)) return state;
      if (hasRetainedVerifiedProjection(state) && (event.reason === "network" || event.reason === "failed")) {
        return { ...state, status: "offline-verified", requestId: null };
      }
      return {
        ...state,
        requestId: null,
        status: event.reason === "authority-required"
          ? "authority-required"
          : event.reason === "revoked"
            ? "revoked"
            : "failed",
        ...(event.reason === "revoked" ? { summary: null, capabilities: null, ledger: null, recipient: emptyRecipient } : {})
      };
    case "identity-invalidated":
      if (event.identityKey === state.identityKey) return state;
      return createWildsWalletControllerState(event.identityKey);
    case "recipient-start":
      return {
        ...state,
        recipient: { status: "loading", requestId: event.requestId, username: event.username, projection: null }
      };
    case "recipient-resolved":
      if (state.recipient.status !== "loading" || state.recipient.requestId !== event.requestId) return state;
      return { ...state, recipient: { status: "verified", requestId: null, username: event.projection.username, projection: event.projection } };
    case "recipient-failed":
      if (state.recipient.status !== "loading" || state.recipient.requestId !== event.requestId) return state;
      return { ...state, recipient: { ...state.recipient, status: "failed", requestId: null, projection: null } };
    case "recipient-lookup-unavailable":
      return { ...state, recipient: { status: "unavailable", requestId: null, username: event.username, projection: null } };
    case "receive-request-resolved":
      return { ...state, receiveLocator: event.locator };
    case "receive-request-cleared":
      return state.receiveLocator === null ? state : { ...state, receiveLocator: null };
  }
}

export function classifyWildsWalletRefreshFailure(status: number | null): Extract<WildsWalletControllerEvent, { type: "refresh-failed" }> ["reason"] {
  if (status === 401) return "authority-required";
  if (status === 403) return "revoked";
  return status === null ? "network" : "failed";
}
