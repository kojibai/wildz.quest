import assert from "node:assert/strict";
import test from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { readWildzPlayerDeliveryHead } from "../src/features/identity/wildz-remote-player-admission";
import type { WildzContinuitySnapshot } from "../src/lib/receiz/wildz-identity-adapter";
import type { WildzPlayerStateRecord } from "../src/lib/receiz/wildz-player-state-sync";
import { admitWildsForwardPosition } from "../src/features/play/wilds-play-state-source";
import { normalizeWildsExplorationAtlas, revealWildsExplorationAt, wildsExplorationContainsRegion } from "../src/features/play/wilds-exploration-atlas";
import { WILDS_REGION_SIZE } from "../src/features/play/multiplayer-core";

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

test("a publication acknowledgement survives further local movement in the same owner session", () => {
  const { source, record } = fixture();
  const latest = { ...source, playState: { ...source.playState!, player: { x: 12, z: 13 } } };
  const head = readWildzPlayerDeliveryHead(source, record, latest);
  assert.deepEqual(head, { playerId: record.playerId, revision: record.revision, sourceDigest: record.sourceDigest });
});

test("a newer unsigned player projection with a valid digest cannot change the held save", () => {
  const { source, record } = fixture();
  const playState = source.playState!;
  const remote = createWildsPlayerVault({ ...record.player, playState: {
    ...playState, player: { x: 90_000, z: -90_000 }, inventory: [],
    actionHistory: [{ ...playState.actionHistory[0]!, uPulse: 300 }],
    explorationAtlas: revealWildsExplorationAt(playState.explorationAtlas, { x: 90_000, z: -90_000 })
  } });
  const next = { ...record, player: remote, revision: 2, sourceDigest: remote.payloadDigest };
  const head = readWildzPlayerDeliveryHead(source, next, source);
  assert.deepEqual(head, { playerId: record.playerId, revision: 2, sourceDigest: remote.payloadDigest });
  assert.equal(source.playState, playState);
  assert.equal(wildsExplorationContainsRegion(playState.explorationAtlas, 1875, -1875), false);
});

test("a thin delivery preserves a large held atlas and discoveries made before the campaign adopts a local snapshot", () => {
  const { source, record } = fixture();
  const local = source.playState!;
  const held = { ...local, explorationAtlas: normalizeWildsExplorationAtlas({
    version: 1, rows: [{ z: -60, ranges: [{ minX: -200_000, maxX: -1 }] }]
  }, local.player) };
  const opened = { ...source, playState: held };
  const head = readWildzPlayerDeliveryHead(opened, record, opened);
  assert.equal(head?.sourceDigest, record.sourceDigest);
  assert.equal(wildsExplorationContainsRegion(opened.playState.explorationAtlas, -200_000, -60), true);
  const position = { x: 93 * WILDS_REGION_SIZE, z: 11 * WILDS_REGION_SIZE };
  const travelling = { ...held, player: position, explorationAtlas: revealWildsExplorationAt(held.explorationAtlas, position) };
  const viewed = admitWildsForwardPosition(opened.playState, travelling);
  assert.equal(viewed.player, position);
  assert.equal(wildsExplorationContainsRegion(viewed.explorationAtlas, 93, 11), true);
  assert.equal(wildsExplorationContainsRegion(viewed.explorationAtlas, -200_000, -60), true);
  assert.equal(wildsExplorationContainsRegion(viewed.explorationAtlas, 0, -60), false);
});

for (const changed of ["owner", "key", "restore"] as const) {
  test(`pending delivery is discarded after a ${changed} change`, () => {
    const { source, record } = fixture();
    const current = changed === "restore" ? { ...source, restoreEpoch: 2 }
      : { ...source, session: { ...source.session, ...(changed === "owner" ? { actorId: "another_owner" } : { keyId: "another-key" }) } };
    assert.equal(readWildzPlayerDeliveryHead(source, record, current), null);
  });
}

test("a remote snapshot for a different actor cannot enter the local collection", () => {
  const { source, record } = fixture();
  record.playerId = "another_actor";
  assert.equal(readWildzPlayerDeliveryHead(source, record, source), null);
});

test("a transport head cannot restore a card removed by ownership reconciliation", () => {
  const { source, record } = fixture();
  const removedId = source.playState!.inventory[0]!.id;
  const current = { ...source, playState: { ...source.playState!, inventory: source.playState!.inventory.filter(card => card.id !== removedId), discoveredCardIds: [] } };
  const head = readWildzPlayerDeliveryHead(source, record, current);
  assert.deepEqual(head, { playerId: record.playerId, revision: record.revision, sourceDigest: record.sourceDigest });
  assert.equal(current.playState.inventory.some(card => card.id === removedId), false);
});

test("a response with an invalid revision or digest cannot acknowledge a publication", () => {
  const { source, record } = fixture();
  for (const broken of [{ ...record, revision: 0 }, { ...record, sourceDigest: "bad" }]) {
    assert.equal(readWildzPlayerDeliveryHead(source, broken, source), null);
  }
});
