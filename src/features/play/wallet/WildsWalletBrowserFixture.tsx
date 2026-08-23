"use client";

import { WildsWalletTerminal } from "./WildsWalletTerminal";
import { createWildsWalletControllerState, type WildsWalletControllerState } from "./wilds-wallet-controller";

function fixtureState(status: WildsWalletControllerState["status"], phase: WildsWalletControllerState["transfer"]["phase"] = "recipient"): WildsWalletControllerState {
  return {
    ...createWildsWalletControllerState("long-range-explorer-coordinate"), open: true, page: phase === "recipient" ? "overview" : "send", status,
    summary: { status: "verified", admittedPhiMicro: "999999999999999999999999999999", displayUsdCents: null, assetCountsStatus: "available", transferableResourceCount: 9999, transferableCardCount: 99, reservedCardCount: 14, pendingCount: phase === "unknown" ? 1 : 0 },
    capabilities: { read: "available", receive: "available", recipientLookup: { available: false, reason: "receiz_v123_execution_unavailable" }, send: { available: false, reason: "receiz_v123_execution_unavailable" }, resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" }, cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" }, phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" }, phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" } },
    ledger: { cursor: null, nextCursor: null, entries: [] }, transfer: { phase, recipientUsername: "recipient-with-long-coordinate", amountPhiMicro: "2500000", rail: "settlement", operationNonce: "fixture", attempt: phase === "unknown" ? "opaque-fixture" : null, expiresAtKai: null, requestId: null, authorizationPointerId: null, result: phase === "unknown" ? { status: "unknown", rail: "settlement", amountPhiMicro: "2500000" } : phase === "zero-write" ? { status: "zero-write", rail: "settlement", code: "SOURCE_HEAD_STALE" } : phase === "committed" ? { status: "committed", rail: "settlement", amountPhiMicro: "2500000" } : null }
  };
}
const actions = { onClose() {}, onNavigate() {}, onRefresh() {}, onLookupRecipient() {}, onSelectRecipient() {}, onReviewAmount() {}, onStage() {}, onAuthorizationPointerStart() {}, onAuthorizationPointerCancel() {}, onRecover() {}, onResetTransfer() {}, onRequestReceive() {} };
export function WildsWalletEdgeBrowserFixture() {
  const state = {
    ...fixtureState("source-verified"), summary: null, capabilities: null, ledger: null, sourceAuthorityVerified: true, edgeAuthorityVerified: true
  };
  return <main className="wildz-app" data-testid="wallet-edge-browser-fixture"><WildsWalletTerminal publicUsername="explorer" state={state} {...actions} /></main>;
}
export function WildsWalletBrowserFixture() {
  return <div id="wilds-wallet-browser-fixture">{[["verified", fixtureState("verified")], ["offline-verified", fixtureState("offline-verified")], ["unknown", fixtureState("verified", "unknown")], ["zero-write", fixtureState("verified", "zero-write")], ["committed", fixtureState("verified", "committed")]].map(([name, state]) => <div data-fixture-state={name as string} key={name as string}><WildsWalletTerminal publicUsername="fixture-explorer" state={state as WildsWalletControllerState} {...actions} /></div>)}</div>;
}
