import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWildsWalletControllerState,
  isWildsWalletRecipientLookupAllowed,
  reduceWildsWalletController,
  type WildsWalletControllerState
} from "../src/features/play/wallet/wilds-wallet-controller";

function verifiedState(identityKey = "explorer") {
  let state = createWildsWalletControllerState(identityKey);
  state = reduceWildsWalletController(state, { type: "open" });
  state = reduceWildsWalletController(state, { type: "refresh-start", requestId: 1 });
  return reduceWildsWalletController(state, {
    type: "refresh-resolved",
    identityKey,
    requestId: 1,
    summary: {
      status: "verified",
      admittedPhiMicro: "42",
      displayUsdCents: null,
      assetCountsStatus: "unknown",
      transferableResourceCount: null,
      transferableCardCount: null,
      reservedCardCount: null,
      pendingCount: null
    },
    capabilities: {
      read: "available",
      receive: "available",
      send: { available: false, reason: "receiz_v123_execution_unavailable" },
      resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" }
    }
  });
}

test("deduplicates a wallet refresh already in flight", () => {
  const loading = reduceWildsWalletController(createWildsWalletControllerState("explorer"), {
    type: "refresh-start", requestId: 7
  });
  const deduplicated = reduceWildsWalletController(loading, { type: "refresh-start", requestId: 8 });

  assert.equal(loading.status, "loading");
  assert.equal(deduplicated, loading);
  assert.equal(deduplicated.requestId, 7);
});

test("cancels recipient work when the terminal closes without clearing a staged exact transaction", () => {
  const state = reduceWildsWalletController(verifiedState(), {
    type: "recipient-start", requestId: 3, username: "other-explorer"
  });
  const staged: WildsWalletControllerState = {
    ...state,
    stagedTransactionId: "staged-exact-attempt"
  };
  const closed = reduceWildsWalletController(staged, { type: "close" });

  assert.equal(closed.open, false);
  assert.equal(closed.recipient.status, "idle");
  assert.equal(closed.recipient.requestId, null);
  assert.equal(closed.stagedTransactionId, "staged-exact-attempt");
});

test("invalidates every private projection when identity changes", () => {
  const invalidated = reduceWildsWalletController(verifiedState("explorer"), {
    type: "identity-invalidated", identityKey: "new-explorer"
  });

  assert.equal(invalidated.identityKey, "new-explorer");
  assert.equal(invalidated.status, "idle");
  assert.equal(invalidated.summary, null);
  assert.equal(invalidated.capabilities, null);
  assert.equal(invalidated.open, false);
});

test("retains verified value as explicit offline truth after a refresh failure", () => {
  const refreshing = reduceWildsWalletController(verifiedState(), { type: "refresh-start", requestId: 2 });
  const offline = reduceWildsWalletController(refreshing, {
    type: "refresh-failed", requestId: 2, reason: "network"
  });

  assert.equal(offline.status, "offline-verified");
  assert.equal(offline.summary?.admittedPhiMicro, "42");
  assert.equal(offline.capabilities?.send.available, false);
});

test("ignores a stale completion after identity invalidation", () => {
  const invalidated = reduceWildsWalletController(
    reduceWildsWalletController(createWildsWalletControllerState("explorer"), { type: "refresh-start", requestId: 5 }),
    { type: "identity-invalidated", identityKey: "new-explorer" }
  );
  const stale = reduceWildsWalletController(invalidated, {
    type: "refresh-failed", requestId: 5, reason: "network"
  });

  assert.equal(stale, invalidated);
});

test("surfaces unavailable recipient lookup without attempting a lookup state", () => {
  const state = reduceWildsWalletController(verifiedState(), {
    type: "recipient-lookup-unavailable", username: "other-explorer"
  });

  assert.deepEqual(state.recipient, {
    status: "unavailable",
    requestId: null,
    username: "other-explorer",
    projection: null
  });
});

test("does not enable recipient lookup before a durable limiter is injected", () => {
  assert.equal(isWildsWalletRecipientLookupAllowed(false), false);
  assert.equal(isWildsWalletRecipientLookupAllowed(true), true);
});
