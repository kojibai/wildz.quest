import assert from "node:assert/strict";
import test from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { prepareWildzRemotePlayerSnapshot } from "../src/features/identity/wildz-remote-player-admission";
import type { WildzContinuitySnapshot } from "../src/lib/receiz/wildz-identity-adapter";
import type { WildzPlayerStateRecord } from "../src/lib/receiz/wildz-player-state-sync";

function fixture() {
  const playState = createOwnerBoundInitialPlayState("async_sync", "2026-10-07T00:00:00.000Z");
  playState.actionHistory = [{ id: "travel", kind: "activity", title: "Travel", detail: "Moving", authority: "local", uPulse: 100 }];
  const player = createWildsPlayerVault({ playerId: "async_sync", exportedAt: "2026-10-07T00:00:00.000Z", playState,
    settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], receipts: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null } });
  const source: WildzContinuitySnapshot = { session: { schema: "receiz.wildz.identity_session.v1", keyId: "async-sync-key", actorId: "async_sync", username: "async_sync", displayName: "Explorer", portableStateStatus: "verified", localAuthority: "verified", remoteStatus: "offline" },
    playState, character: null, playerContinuity: player, restoreEpoch: 1 };
  const record: WildzPlayerStateRecord = structuredClone({ schema: "receiz.wildz_player_state.v1", playerId: "async_sync", revision: 1, updatedAt: player.exportedAt, sourceDigest: player.payloadDigest, previousSourceDigest: null, player });
  return { source, record };
}

test("incoming admission merges with movement made while verification was pending", async () => {
  const { source, record } = fixture();
  let current = source;
  const pending = prepareWildzRemotePlayerSnapshot(source, record, () => current);
  current = { ...source, playState: { ...source.playState!, player: { x: 12, z: 13 }, actionHistory: [{ ...source.playState!.actionHistory[0]!, uPulse: 101 }] } };
  const admitted = await pending;
  assert.ok(admitted?.playState);
  assert.deepEqual(admitted.playState.player, { x: 12, z: 13 });
  assert.equal(admitted.playState.actionHistory[0]!.uPulse, 101);
  assert.equal(admitted.playState.inventory[0], source.playState!.inventory[0]);
});

for (const changed of ["owner", "key", "restore"] as const) {
  test(`pending incoming admission is discarded after a ${changed} change`, async () => {
    const { source, record } = fixture();
    let current = source;
    const pending = prepareWildzRemotePlayerSnapshot(source, record, () => current);
    current = changed === "restore" ? { ...source, restoreEpoch: 2 }
      : { ...source, session: { ...source.session, ...(changed === "owner" ? { actorId: "another_owner" } : { keyId: "another-key" }) } };
    assert.equal(await pending, null);
  });
}

test("a remote snapshot for a different actor cannot enter the local collection", async () => {
  const { source, record } = fixture();
  record.playerId = "another_actor";
  assert.equal(await prepareWildzRemotePlayerSnapshot(source, record, () => source), null);
});

test("pending admission does not restore a card removed by ownership reconciliation", async () => {
  const { source, record } = fixture();
  const removedId = source.playState!.inventory[0]!.id;
  let current = source;
  const pending = prepareWildzRemotePlayerSnapshot(source, record, () => current);
  current = { ...source, playState: { ...source.playState!, inventory: [], discoveredCardIds: [] } };
  const admitted = await pending;
  assert.ok(admitted?.playState);
  assert.equal(admitted.playState.inventory.some(card => card.id === removedId), false);
});
