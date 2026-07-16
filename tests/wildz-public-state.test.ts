import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizePublicWildzProfile } from "../src/features/profile/public-profile";
import { createOwnerBoundInitialPlayState, initialPlayState } from "../src/features/play/game-state";
import * as wildzPublicState from "../src/lib/receiz/wildz-public-state";

const {
  advanceWildzPublicState,
  emptyWildzPublicState,
  isCurrentWildzPublicCardRegistration,
  restoreWildzPublicState
} = wildzPublicState;

test("public projection rejects stale revisions and admits only explicit server time", () => {
  const initial = emptyWildzPublicState();
  const profile = sanitizePublicWildzProfile({ username: "@fern", displayName: "Fern", vault: [] });
  assert.throws(() => advanceWildzPublicState(initial, {
    type: "publish-profile",
    actorHandle: "@fern",
    expectedRevision: 2,
    profile
  }, { occurredAt: "2026-07-15T12:00:00.000Z" }), /wildz_public_revision_conflict/);
  const next = advanceWildzPublicState(initial, {
    type: "publish-profile",
    actorHandle: "@fern",
    expectedRevision: 0,
    profile
  }, { occurredAt: "2026-07-15T12:00:00.000Z" });
  assert.equal(next.updatedAt, "2026-07-15T12:00:00.000Z");
  assert.throws(() => advanceWildzPublicState(next, {
    type: "publish-profile",
    actorHandle: "@fern",
    expectedRevision: 1,
    profile
  }, { occurredAt: "not-a-time" }), /wildz_public_time_invalid/);
});

test("public projection verifies card owner and strips private or market-only fields", () => {
  const asset = initialPlayState.inventory[0]!;
  const initial = emptyWildzPublicState();
  assert.throws(() => advanceWildzPublicState(initial, {
    type: "publish-card",
    actorId: "someone_else",
    expectedRevision: 0,
    card: asset
  }, { occurredAt: "2026-07-15T12:00:00.000Z" }), /wildz_public_card_owner_mismatch/);

  const restored = restoreWildzPublicState({
    ...initial,
    keyFile: { crypto: { privateKeyPkcs8B64u: "secret" } },
    accessToken: "secret",
    sellerReceizUserId: "usr_private",
    listings: { "listing:1": {} },
    receipts: [{ transferId: "secret" }]
  });
  assert.deepEqual(Object.keys(restored).sort(), ["cards", "profiles", "revision", "schema", "updatedAt"]);
});

test("an exact registered proof remains a no-op after market ownership transfers away from its immutable owner", () => {
  const card = createOwnerBoundInitialPlayState("seller").inventory[0]!;
  const published = advanceWildzPublicState(emptyWildzPublicState(), {
    type: "publish-card",
    actorId: "seller",
    expectedRevision: 0,
    card
  }, {
    occurredAt: "2026-07-16T12:00:00.000Z",
    admittedCardOwnerId: "seller"
  });

  // The route separately verifies the current market owner before calling this
  // exact-registration check, so immutable manifest ownership is irrelevant here.
  assert.equal(isCurrentWildzPublicCardRegistration(published, card), true);
});
