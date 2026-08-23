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
  type WildsWalletControllerState,
  type WildsWalletReadResponse
} from "../src/features/play/wallet/wilds-wallet-controller";
import { wildsWalletStatusNeedsIdentityReadAuthority } from "../src/features/play/wallet/useWildsWalletController";

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
      recipientLookup: { available: false, reason: "receiz_v123_execution_unavailable" },
      send: { available: false, reason: "receiz_v123_execution_unavailable" },
      resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" }
    }, ledger: null }
  });
}

function readResponse(overrides: Partial<WildsWalletReadResponse> = {}): WildsWalletReadResponse {
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
      recipientLookup: { available: false, reason: "receiz_v123_execution_unavailable" },
      send: { available: false, reason: "receiz_v123_execution_unavailable" },
      resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" }
    },
    ledger: { cursor: null, nextCursor: null, entries: [] },
    ...overrides
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

test("a verified Receiz ID source remains authoritative when global projection transport fails", () => {
  let state = createWildsWalletControllerState("explorer", "generation-1");
  state = reduceWildsWalletController(state, {
    type: "source-authority-resolved",
    identityKey: "explorer",
    authorityGeneration: "generation-1",
    response: readResponse()
  });

  assert.equal(state.status, "source-verified");
  assert.equal(state.sourceAuthorityVerified, true);
  assert.equal(state.summary?.admittedPhiMicro, "42");

  state = reduceWildsWalletController(state, { type: "refresh-start", requestId: 9 });
  state = reduceWildsWalletController(state, { type: "refresh-failed", requestId: 9, reason: "revoked" });

  assert.equal(state.status, "source-verified");
  assert.equal(state.sourceAuthorityVerified, true);
  assert.equal(state.summary?.admittedPhiMicro, "42");
});

test("identity authority never depends on a remote representation", () => {
  const state = reduceWildsWalletController(createWildsWalletControllerState("explorer", "generation-1"), {
    type: "source-authority-resolved",
    identityKey: "explorer",
    authorityGeneration: "generation-1",
    response: null
  });

  assert.equal(state.status, "source-verified");
  assert.equal(state.sourceAuthorityVerified, true);
  assert.equal(state.summary, null);
});

test("a remote wallet representation cannot replace source-carried holdings or ledger", () => {
  let state = createWildsWalletControllerState("explorer", "generation-1");
  state = reduceWildsWalletController(state, {
    type: "source-authority-resolved", identityKey: "explorer", authorityGeneration: "generation-1", response: readResponse()
  });
  state = reduceWildsWalletController(state, { type: "refresh-start", requestId: 10 });
  const remote = readResponse({
    summary: { ...readResponse().summary, admittedPhiMicro: "999999999" },
    ledger: null
  });
  state = reduceWildsWalletController(state, {
    type: "refresh-resolved", requestId: 10, identityKey: "explorer", authorityGeneration: "generation-1", response: remote
  });

  assert.equal(state.status, "source-verified");
  assert.equal(state.summary?.admittedPhiMicro, "42");
  assert.equal(state.ledger?.entries.length, 0);
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

test("initial authority codes remain distinct while ambiguous HTTP 401 revokes a wallet", () => {
  assert.equal(classifyWildsWalletRefreshFailure({ status: 401, code: "receiz_wallet_token_revoked" }), "revoked");
  assert.equal(classifyWildsWalletRefreshFailure({ status: 401, code: "receiz_wallet_authority_required" }), "authority-required");
  assert.equal(classifyWildsWalletRefreshFailure({ status: 401, code: null }), "revoked");
});

test("Receiz ID replaces both missing and stale wallet read bearers without a second login", () => {
  assert.equal(wildsWalletStatusNeedsIdentityReadAuthority("authority-required"), true);
  assert.equal(wildsWalletStatusNeedsIdentityReadAuthority("revoked"), true);
  assert.equal(wildsWalletStatusNeedsIdentityReadAuthority("failed"), false);
  assert.equal(wildsWalletStatusNeedsIdentityReadAuthority("verified"), false);
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
  const malformed = structuredClone(readResponse()) as { capabilities: { send: { available: false; reason: string } } };
  malformed.capabilities.send.reason = "invented";
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

  assert.deepEqual(runtime.diagnostics(), { refreshStarts: 0, receiveStarts: 0, transferStarts: 0, cacheWrites: 0, publications: 0 });
});

test("binds recipient, amount, review, and staged authorization to one exact identity generation", () => {
  let state = reduceWildsWalletController(verifiedState("explorer"), {
    type: "recipient-resolved", requestId: 0,
    projection: { username: "friend", profileMark: null, allowedTransferKinds: ["phi"] }
  });
  state = reduceWildsWalletController(state, { type: "transfer-recipient-selected", username: "friend" });
  state = reduceWildsWalletController(state, { type: "transfer-amount-reviewed", rail: "settlement", amountPhiMicro: "25", operationNonce: "nonce-1" });
  state = reduceWildsWalletController(state, { type: "transfer-stage-start", requestId: 11, identityKey: "explorer", authorityGeneration: "" });
  state = reduceWildsWalletController(state, {
    type: "transfer-stage-resolved", requestId: 11, identityKey: "explorer", authorityGeneration: "",
    projection: { status: "staged", rail: "settlement", amountPhiMicro: "25", quotedUsdCents: "1", attempt: "v1.opaque", expiresAtKai: 90 }
  });

  assert.equal(state.transfer.phase, "authorize");
  assert.equal(state.transfer.attempt, "v1.opaque");
  const stale = reduceWildsWalletController(state, {
    type: "transfer-result", requestId: 12, identityKey: "other", authorityGeneration: "",
    projection: { status: "committed", rail: "settlement", amountPhiMicro: "25" }
  });
  assert.equal(stale, state);
});

test("pointer cancellation cannot authorize and overlay takeover preserves exact staged recovery", () => {
  const staged = {
    ...verifiedState(),
    transfer: {
      phase: "authorize" as const, recipientUsername: "friend", amountPhiMicro: "25", rail: "settlement" as const,
      operationNonce: "nonce-1", attempt: "v1.opaque", expiresAtKai: 90, requestId: null,
      authorizationPointerId: null, result: null
    },
    stagedTransactionId: "v1.opaque"
  };
  const pressed = reduceWildsWalletController(staged, { type: "authorization-pointer-start", pointerId: 7 });
  const cancelled = reduceWildsWalletController(pressed, { type: "authorization-pointer-cancel", pointerId: 7 });
  const accidental = reduceWildsWalletController(cancelled, { type: "transfer-authorize-start", requestId: 14, pointerId: 7 });
  assert.equal(accidental.transfer.phase, "authorize");
  assert.equal(accidental.transfer.requestId, null);

  const taken = reduceWildsWalletController(cancelled, { type: "exclusive-owner-changed", owner: "combat" });
  assert.equal(taken.open, false);
  assert.equal(taken.transfer.attempt, "v1.opaque");
  assert.equal(taken.transfer.authorizationPointerId, null);
});

test("adopts unknown, zero-write, and committed only from exact sanitized execution results", () => {
  const authorizing = {
    ...verifiedState(),
    transfer: {
      phase: "authorize-pending" as const, recipientUsername: "friend", amountPhiMicro: "25", rail: "settlement" as const,
      operationNonce: "nonce-1", attempt: "v1.opaque", expiresAtKai: 90, requestId: 21,
      authorizationPointerId: null, result: null
    },
    stagedTransactionId: "v1.opaque"
  };
  const unknown = reduceWildsWalletController(authorizing, {
    type: "transfer-result", requestId: 21, identityKey: "explorer", authorityGeneration: "",
    projection: { status: "unknown", rail: "settlement", amountPhiMicro: "25" }
  });
  assert.equal(unknown.transfer.phase, "unknown");
  assert.equal(unknown.stagedTransactionId, "v1.opaque");

  const committed = reduceWildsWalletController({ ...unknown, transfer: { ...unknown.transfer, requestId: 22 } }, {
    type: "transfer-result", requestId: 22, identityKey: "explorer", authorityGeneration: "",
    projection: { status: "committed", rail: "settlement", amountPhiMicro: "25" }
  });
  assert.equal(committed.transfer.phase, "committed");
  assert.equal(committed.stagedTransactionId, null);

  const zeroWrite = reduceWildsWalletController({ ...authorizing, transfer: { ...authorizing.transfer, requestId: 23 } }, {
    type: "transfer-result", requestId: 23, identityKey: "explorer", authorityGeneration: "",
    projection: { status: "zero-write", rail: "settlement", code: "SOURCE_HEAD_STALE" }
  });
  assert.equal(zeroWrite.transfer.phase, "zero-write");
  assert.equal(zeroWrite.stagedTransactionId, null);
});

test("never adopts a staged preview as execution success and expires review authorization exactly", () => {
  const state = {
    ...verifiedState(),
    transfer: {
      phase: "authorize-pending" as const, recipientUsername: "friend", amountPhiMicro: "25", rail: "settlement" as const,
      operationNonce: "nonce-1", attempt: "v1.opaque", expiresAtKai: 90, requestId: 30,
      authorizationPointerId: null, result: null
    },
    stagedTransactionId: "v1.opaque"
  };
  const staged = reduceWildsWalletController(state, {
    type: "transfer-result", requestId: 30, identityKey: "explorer", authorityGeneration: "",
    projection: { status: "staged", rail: "settlement", amountPhiMicro: "25", quotedUsdCents: "1" }
  });
  assert.equal(staged.transfer.phase, "unknown");
  assert.equal(staged.stagedTransactionId, "v1.opaque");

  const expired = reduceWildsWalletController({ ...state, transfer: { ...state.transfer, phase: "authorize" as const, requestId: null } }, { type: "transfer-review-expired", currentKai: 90 });
  assert.equal(expired.transfer.phase, "review");
  assert.equal(expired.transfer.attempt, null);
});
