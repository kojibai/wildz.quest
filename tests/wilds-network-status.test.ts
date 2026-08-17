import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WILDS_MULTIPLAYER_OFFLINE_MESSAGE,
  WILDS_NETWORK_RETRY_BACKOFF_MS,
  WILDS_WORLD_OFFLINE_MESSAGE,
  isOpaqueWildsNetworkFailure,
  shouldAttemptWildsNetwork,
  wildsNetworkFailureMessage
} from "../src/features/play/wilds-network-status";

test("offline Wildz surfaces skip network work and explain local continuity", () => {
  assert.equal(shouldAttemptWildsNetwork({ onLine: false }), false);
  assert.equal(shouldAttemptWildsNetwork({ onLine: true }), true);
  assert.equal(wildsNetworkFailureMessage(new TypeError("Failed to fetch"), "world", false), WILDS_WORLD_OFFLINE_MESSAGE);
  assert.equal(wildsNetworkFailureMessage(new TypeError("Failed to fetch"), "multiplayer", false), WILDS_MULTIPLAYER_OFFLINE_MESSAGE);
});

test("opaque browser fetch failures are normalized while server authority errors stay exact", () => {
  assert.equal(isOpaqueWildsNetworkFailure(new TypeError("Failed to fetch")), true);
  assert.equal(WILDS_NETWORK_RETRY_BACKOFF_MS, 15_000);
  assert.equal(wildsNetworkFailureMessage(new TypeError("Failed to fetch"), "world", true), WILDS_WORLD_OFFLINE_MESSAGE);
  assert.equal(wildsNetworkFailureMessage(new Error("wilds_world_canonical_publish_required"), "world", true), "wilds_world_canonical_publish_required");
  assert.equal(
    wildsNetworkFailureMessage(new Error("wilds_multiplayer_card_owner_invalid"), "multiplayer", true),
    "That companion is not admitted to this verified Vault session yet."
  );
  assert.equal(
    wildsNetworkFailureMessage(new Error("wilds_multiplayer_session_required"), "multiplayer", true),
    "Shared world presence is reconnecting automatically."
  );
});
