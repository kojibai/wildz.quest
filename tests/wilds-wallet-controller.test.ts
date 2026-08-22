import assert from "node:assert/strict";
import { test } from "node:test";
import { writeWildsCreatureLocomotionFrame } from "../src/features/play/WildsCreatureActor";
import {
  admitWildsWalletReadResponse,
  classifyWildsWalletRefreshFailure,
  createWildsWalletRequestRuntime,
  createWildsWalletSessionCache,
  createWildsWalletControllerState,
  hydrateWildsWalletControllerState,
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
    authorityGeneration: "",
    requestId: 1,
    response: { summary: {
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
    }, ledger: null }
  });
}

function readResponse() {
  return {
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
    },
    ledger: { cursor: null, nextCursor: null, entries: [] }
  };
}

test("admits the active refresh identifier selected by the synchronous request runtime", () => {
  const loading = reduceWildsWalletController(createWildsWalletControllerState("explorer"), {
    type: "refresh-start", requestId: 7
  });
  const replacement = reduceWildsWalletController(loading, { type: "refresh-start", requestId: 8 });

  assert.equal(loading.status, "loading");
  assert.equal(replacement.requestId, 8);
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
    type: "identity-invalidated", identityKey: "new-explorer", authorityGeneration: ""
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
    { type: "identity-invalidated", identityKey: "new-explorer", authorityGeneration: "" }
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

test("only explicit revocation error codes revoke a wallet, regardless of HTTP status", () => {
  assert.equal(classifyWildsWalletRefreshFailure({ status: 401, code: "receiz_wallet_token_revoked" }), "revoked");
  assert.equal(classifyWildsWalletRefreshFailure({ status: 401, code: "receiz_wallet_authority_required" }), "authority-required");
  assert.equal(classifyWildsWalletRefreshFailure({ status: 401, code: null }), "failed");
});

test("revocation clears every private wallet projection and staged locator", () => {
  const active = {
    ...verifiedState(),
    receiveLocator: "wildz:receive:explorer",
    stagedTransactionId: "pending-private-attempt",
    recipient: { status: "verified" as const, requestId: null, username: "friend", projection: { username: "friend", profileMark: null, allowedTransferKinds: ["phi"] as const } }
  };
  const revoking = reduceWildsWalletController(active, { type: "refresh-start", requestId: 4 });
  const revoked = reduceWildsWalletController(revoking, { type: "refresh-failed", requestId: 4, reason: "revoked" });

  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.summary, null);
  assert.equal(revoked.capabilities, null);
  assert.equal(revoked.ledger, null);
  assert.equal(revoked.receiveLocator, null);
  assert.equal(revoked.stagedTransactionId, null);
  assert.equal(revoked.recipient.status, "idle");
});

test("synchronously deduplicates a same-turn refresh and permits explicit replacement", () => {
  const runtime = createWildsWalletRequestRuntime();
  const first = runtime.beginRefresh();
  assert.ok(first);
  assert.equal(runtime.beginRefresh(), null);
  const replacement = runtime.beginRefresh({ replace: true });
  assert.ok(replacement);
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(replacement.id, first.id + 1);
});

test("closing cancels active read and receive requests before either completion can publish", () => {
  const runtime = createWildsWalletRequestRuntime();
  const refresh = runtime.beginRefresh();
  const receive = runtime.beginReceive();
  assert.ok(refresh && receive);
  runtime.cancelAll();

  assert.equal(refresh.controller.signal.aborted, true);
  assert.equal(receive.controller.signal.aborted, true);
  assert.equal(runtime.isCurrentRefresh(refresh.id), false);
  assert.equal(runtime.isCurrentReceive(receive.id), false);
});

test("receive completion is identity and open-state bound", () => {
  const loading = reduceWildsWalletController(
    reduceWildsWalletController(verifiedState("identity-a"), { type: "receive-request-start", requestId: 8, identityKey: "identity-a" }),
    { type: "identity-invalidated", identityKey: "identity-b", authorityGeneration: "" }
  );
  const stale = reduceWildsWalletController(loading, {
    type: "receive-request-resolved", requestId: 8, identityKey: "identity-a", locator: "wildz:receive:identity-a"
  });

  assert.equal(stale.receiveLocator, null);
  assert.equal(stale.identityKey, "identity-b");
});

test("cache restores only bounded authority-keyed offline truth", () => {
  const cache = createWildsWalletSessionCache(2);
  cache.write("identity-a:session-1", readResponse());
  cache.write("identity-b:session-1", readResponse());
  cache.write("identity-c:session-1", readResponse());

  assert.equal(cache.read("identity-a:session-1"), null);
  const restored = hydrateWildsWalletControllerState("identity-c", "session-1", cache);
  assert.equal(restored.status, "offline-verified");
  assert.equal(restored.summary?.admittedPhiMicro, "42");
  assert.equal(hydrateWildsWalletControllerState("identity-c", "other-session", cache).summary, null);
});

test("rejects malformed nested wallet projections before controller admission", () => {
  const malformed = readResponse();
  malformed.capabilities.send.reason = "invented" as "receiz_v123_execution_unavailable";
  assert.throws(() => admitWildsWalletReadResponse(malformed), /wilds_wallet_projection_invalid/);
});

test("rejects malformed summary and ledger scalar fields before controller admission", () => {
  const malformedSummary = structuredClone(readResponse()) as { summary: { displayUsdCents: unknown } };
  malformedSummary.summary.displayUsdCents = "-1";
  assert.throws(() => admitWildsWalletReadResponse(malformedSummary), /wilds_wallet_projection_invalid/);

  const malformedLedger = structuredClone(readResponse()) as { ledger: { cursor: unknown } };
  malformedLedger.ledger.cursor = "forged=cursor";
  assert.throws(() => admitWildsWalletReadResponse(malformedLedger), /wilds_wallet_projection_invalid/);
});

test("rejects a confusable ledger counterparty username before controller admission", () => {
  const malformed = {
    ...readResponse(),
    ledger: {
      cursor: null,
      nextCursor: null,
      entries: [{ receiptReference: null, direction: "received", state: "committed", createdAt: "2026-08-22T12:00:00.000Z", counterpartyUsername: "kаi" }]
    }
  };
  assert.throws(() => admitWildsWalletReadResponse(malformed), /wilds_wallet_projection_invalid/);
});

test("combat or profile takeover closes wallet state and cannot reopen it on release", () => {
  for (const owner of ["combat", "profile"] as const) {
    const wallet = reduceWildsWalletController(createWildsWalletControllerState("explorer"), { type: "open" });
    const takenOver = reduceWildsWalletController(wallet, { type: "exclusive-owner-changed", owner });
    const released = reduceWildsWalletController(takenOver, { type: "exclusive-owner-changed", owner: "none" });

    assert.equal(takenOver.open, false);
    assert.equal(released.open, false);
  }
});

test("ten thousand world frame writes leave wallet runtime diagnostics at zero", () => {
  const runtime = createWildsWalletRequestRuntime();
  const frame = { rootY: 0, rootPitch: 0, rootRoll: 0, limbPitch: 0, wingAngle: 0 };
  for (let index = 0; index < 10_000; index += 1) {
    writeWildsCreatureLocomotionFrame(frame, "air", index / 60, 1, .25, "idle");
  }

  assert.deepEqual(runtime.diagnostics(), { refreshStarts: 0, receiveStarts: 0, cacheWrites: 0, publications: 0 });
});
