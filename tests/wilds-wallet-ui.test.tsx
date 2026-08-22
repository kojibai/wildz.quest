import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsWalletInstrument } from "../src/features/play/wallet/WildsWalletInstrument";
import { WildsWalletTerminal } from "../src/features/play/wallet/WildsWalletTerminal";
import { createWildsWalletControllerState, reduceWildsWalletController } from "../src/features/play/wallet/wilds-wallet-controller";

function state(overrides: Record<string, unknown> = {}) {
  return {
    ...createWildsWalletControllerState("explorer-with-an-intentionally-long-coordinate"),
    open: true,
    status: "verified" as const,
    summary: {
      status: "verified" as const,
      admittedPhiMicro: "123456789012345678901234567890",
      displayUsdCents: "98765432109876543210",
      assetCountsStatus: "available" as const,
      transferableResourceCount: 734,
      transferableCardCount: 18,
      reservedCardCount: 3,
      pendingCount: 1
    },
    capabilities: {
      read: "available" as const,
      receive: "available" as const,
      send: { available: false as const, reason: "receiz_v123_execution_unavailable" as const },
      resourceTransfer: { available: false as const, reason: "receiz_v123_execution_unavailable" as const },
      cardTransfer: { available: false as const, reason: "receiz_v123_execution_unavailable" as const },
      phiSettlement: { available: false as const, reason: "receiz_v123_execution_unavailable" as const },
      phiReserve: { available: false as const, reason: "receiz_v123_execution_unavailable" as const }
    },
    ledger: { cursor: null, nextCursor: null, entries: [] },
    ...overrides
  };
}

const actions = {
  onClose() {}, onNavigate() {}, onLookupRecipient() {}, onSelectRecipient() {}, onReviewAmount() {},
  onStage() {}, onAuthorizationPointerStart() {}, onAuthorizationPointerCancel() {}, onAuthorize() {},
  onRecover() {}, onResetTransfer() {}, onRequestReceive() {}
};

test("wallet instrument announces exact admitted value while abbreviating the visual HUD value", () => {
  const markup = renderToStaticMarkup(createElement(WildsWalletInstrument, {
    disabled: false,
    state: state(),
    onOpen() {}
  }));
  assert.match(markup, /PHI RESERVE/);
  assert.match(markup, /aria-label="Open sovereign wallet\. Exact admitted Phi reserve: 123456789012345678901234\.56789 Phi\. Status: verified\."/);
  assert.match(markup, /data-wallet-status="verified"/);
  assert.doesNotMatch(markup, /98765432109876543210/);
});

test("verified display quote preserves every admitted cent beyond Number precision", () => {
  const markup = renderToStaticMarkup(createElement(WildsWalletTerminal, { state: state(), ...actions }));
  assert.match(markup, /\$987,654,321,098,765,432\.10/);
});

test("terminal is one modal dialog with five named surfaces and fail-closed send", () => {
  const markup = renderToStaticMarkup(createElement(WildsWalletTerminal, { state: state({ page: "send" }), ...actions }));
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /WILDZ SOVEREIGN TERMINAL/);
  for (const label of ["Overview", "Send", "Receive", "Assets", "Ledger"]) assert.match(markup, new RegExp(`>${label}<`));
  assert.match(markup, /Send authority is unavailable/);
  assert.doesNotMatch(markup, /Transfer complete/);
  assert.doesNotMatch(markup, /proofDigest|subjectId|ownerReceizId|accessToken/);
});

test("transfer outcomes remain distinct and never promote ambiguous execution to success", () => {
  let unknown = state({ page: "send" as const });
  unknown = {
    ...unknown,
    transfer: {
      ...unknown.transfer,
      phase: "unknown" as const,
      recipientUsername: "friend",
      amountPhiMicro: "2500000",
      rail: "settlement" as const,
      attempt: "opaque-attempt",
      result: { status: "unknown" as const, rail: "settlement" as const, amountPhiMicro: "2500000" }
    }
  };
  const unknownMarkup = renderToStaticMarkup(createElement(WildsWalletTerminal, { state: unknown, ...actions }));
  assert.match(unknownMarkup, /Recovery pending/);
  assert.match(unknownMarkup, /Check exact outcome/);
  assert.doesNotMatch(unknownMarkup, /Transfer committed/);

  const rejected = reduceWildsWalletController(unknown, { type: "transfer-reset" });
  const rejectedMarkup = renderToStaticMarkup(createElement(WildsWalletTerminal, {
    state: { ...rejected, page: "send", transfer: { ...rejected.transfer, phase: "zero-write", result: { status: "zero-write", rail: "reserve", code: "SOURCE_HEAD_STALE" } } },
    ...actions
  }));
  assert.match(rejectedMarkup, /Nothing moved/);
});
