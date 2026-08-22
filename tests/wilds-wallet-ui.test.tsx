import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsWalletInstrument } from "../src/features/play/wallet/WildsWalletInstrument";
import { nextWildsWalletPageForKey, WildsWalletTerminal } from "../src/features/play/wallet/WildsWalletTerminal";
import { createWildsWalletAuthorizationHoldRuntime, isWildsWalletAuthorizationHoldKey } from "../src/features/play/wallet/WildsWalletSend";
import { formatWildsPhiCompact } from "../src/features/play/wallet/wilds-wallet-format";
import { createWildsWalletControllerState, gateWildsWalletClientCapabilities, reduceWildsWalletController } from "../src/features/play/wallet/wilds-wallet-controller";

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
      recipientLookup: { available: false as const, reason: "receiz_v123_execution_unavailable" as const },
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
  assert.match(markup, /class="wilds-wallet-glyph"/);
  assert.doesNotMatch(markup, /PHI RESERVE|SECURE|VERIFYING/);
  assert.match(markup, /aria-label="Open sovereign wallet\. Exact admitted Phi reserve: 123456789012345678901234\.56789 Phi\. Status: verified\."/);
  assert.match(markup, /data-wallet-status="verified"/);
  assert.doesNotMatch(markup, /98765432109876543210/);
});

test("verified display quote preserves every admitted cent beyond Number precision", () => {
  const markup = renderToStaticMarkup(createElement(WildsWalletTerminal, { publicUsername: "explorer", state: state(), ...actions }));
  assert.match(markup, /\$987,654,321,098,765,432\.10/);
});

test("terminal is one modal dialog with five named surfaces and fail-closed send", () => {
  const markup = renderToStaticMarkup(createElement(WildsWalletTerminal, { publicUsername: null, state: state({ page: "send" }), ...actions }));
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /WILDZ SOVEREIGN TERMINAL/);
  for (const label of ["Overview", "Send", "Receive", "Assets", "Ledger"]) assert.match(markup, new RegExp(`>${label}<`));
  assert.match(markup, /Send authority is unavailable/);
  assert.doesNotMatch(markup, /Transfer complete/);
  assert.doesNotMatch(markup, /proofDigest|subjectId|ownerReceizId|accessToken/);
  assert.doesNotMatch(markup, /explorer-with-an-intentionally-long-coordinate/);
  assert.match(markup, /PUBLIC HANDLE NOT AVAILABLE/);
});

test("client capability projection refuses to advertise send without both lookup and proof authorization ports", () => {
  const live = state().capabilities!;
  const serverLive = { ...live, recipientLookup: { available: true as const }, send: { available: true as const }, phiSettlement: { available: true as const } };
  assert.equal(gateWildsWalletClientCapabilities(serverLive, { proofAuthorization: false }).send.available, false);
  assert.equal(gateWildsWalletClientCapabilities({ ...serverLive, recipientLookup: { available: false as const, reason: "receiz_v123_execution_unavailable" as const } }, { proofAuthorization: true }).send.available, false);
  assert.equal(gateWildsWalletClientCapabilities(serverLive, { proofAuthorization: true }).send.available, true);
});

test("compact Phi formatting uses exact K M B T tiers without Number precision", () => {
  assert.equal(formatWildsPhiCompact("999999000000"), "999.9K");
  assert.equal(formatWildsPhiCompact("1000000000000"), "1M");
  assert.equal(formatWildsPhiCompact("1234567000000000"), "1.2B");
  assert.equal(formatWildsPhiCompact("1234567000000000000"), "1.2T");
  assert.equal(formatWildsPhiCompact("999999999999999999999999"), "999.9Q");
});

test("wallet tabs rove with arrows and boundaries while keyboard authorization requires a hold key", () => {
  assert.equal(nextWildsWalletPageForKey("overview", "ArrowLeft"), "ledger");
  assert.equal(nextWildsWalletPageForKey("send", "ArrowRight"), "receive");
  assert.equal(nextWildsWalletPageForKey("assets", "Home"), "overview");
  assert.equal(nextWildsWalletPageForKey("overview", "End"), "ledger");
  assert.equal(nextWildsWalletPageForKey("overview", "Enter"), null);
  assert.equal(isWildsWalletAuthorizationHoldKey("Enter"), true);
  assert.equal(isWildsWalletAuthorizationHoldKey(" "), true);
  assert.equal(isWildsWalletAuthorizationHoldKey("a"), false);
  const markup = renderToStaticMarkup(createElement(WildsWalletTerminal, { publicUsername: "explorer", state: state(), ...actions }));
  assert.equal((markup.match(/tabindex="-1"/g) ?? []).length >= 4, true);
});

test("authorization runtime completes only an uninterrupted deliberate hold", () => {
  let scheduled: (() => void) | null = null;
  const events: string[] = [];
  const runtime = createWildsWalletAuthorizationHoldRuntime({
    onArm: (id) => events.push(`arm:${id}`), onCancel: (id) => events.push(`cancel:${id}`), onComplete: (id) => events.push(`complete:${id}`),
    schedule: (operation) => { scheduled = operation; return 1; }, cancelSchedule: () => { scheduled = null; }
  });
  runtime.start(-1);
  runtime.cancel(-1);
  assert.deepEqual(events, ["arm:-1", "cancel:-1"]);
  assert.equal(scheduled, null);
  runtime.start(-1);
  (scheduled as (() => void) | null)?.();
  assert.deepEqual(events, ["arm:-1", "cancel:-1", "arm:-1", "complete:-1"]);
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
  const unknownMarkup = renderToStaticMarkup(createElement(WildsWalletTerminal, { publicUsername: "explorer", state: unknown, ...actions }));
  assert.match(unknownMarkup, /Recovery pending/);
  assert.match(unknownMarkup, /Check exact outcome/);
  assert.doesNotMatch(unknownMarkup, /Transfer committed/);

  const rejected = reduceWildsWalletController(unknown, { type: "transfer-reset" });
  const rejectedMarkup = renderToStaticMarkup(createElement(WildsWalletTerminal, {
    publicUsername: "explorer", state: { ...rejected, page: "send", transfer: { ...rejected.transfer, phase: "zero-write", result: { status: "zero-write", rail: "reserve", code: "SOURCE_HEAD_STALE" } } },
    ...actions
  }));
  assert.match(rejectedMarkup, /Nothing moved/);
});
