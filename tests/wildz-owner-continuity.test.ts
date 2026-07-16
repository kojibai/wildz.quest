import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createOwnerBoundInitialPlayState,
  initialPlayState,
  restorePlayState,
  serializePlayState
} from "../src/features/play/game-state";
import { generateWildzCharacter } from "../src/features/identity/wildz-genesis";
import { createWildsPlayerVault, verifyWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import {
  loadWildzRestoredOwnerState,
  prepareWildzPlayerPlayState,
  saveWildzRestoredPlayState
} from "../src/features/identity/wildz-restore";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const SESSION: WildzIdentitySession = {
  schema: "receiz.wildz.identity_session.v1",
  keyId: "key-owner-continuity",
  actorId: "vault_keeper",
  username: "vault_keeper",
  displayName: "Vault Keeper",
  portableStateStatus: "verified",
  localAuthority: "verified",
  remoteStatus: "unknown"
};

const OTHER_SESSION: WildzIdentitySession = {
  ...SESSION,
  keyId: "key-owner-other",
  actorId: "trail_scout",
  username: "trail_scout",
  displayName: "Trail Scout"
};

test("owner persistence retains complete V3 settings, history, receipts, and cursor across later gameplay saves", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const player = createWildsPlayerVault({
    playerId: SESSION.actorId,
    exportedAt: "2026-07-15T20:30:00.000Z",
    playState: createOwnerBoundInitialPlayState(SESSION.actorId),
    character: generateWildzCharacter({ identityRef: SESSION.keyId, kaiPulse: "123456789", gender: "female", version: 1 }),
    settings: {
      avatarStyle: "female",
      movementMode: "run",
      audio: { master: 0.45, muted: true },
      cardOrder: "newest"
    },
    personalEvents: [{ eventId: "event:one", kind: "boss-win", occurredAt: "2026-07-15T20:00:00.000Z", receiptDigest: "sha256:" + "a".repeat(64) }],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 97, eventId: "event:one" },
    receipts: [{ eventId: "event:one", digest: "sha256:" + "b".repeat(64) }]
  });

  await saveWildzRestoredPlayState({ database, session: SESSION, playState: player.playState, player, character: player.character });
  await saveWildzRestoredPlayState({
    database,
    session: SESSION,
    playState: { ...player.playState, worldMastery: 101 }
  });

  const restored = await loadWildzRestoredOwnerState({ database, session: SESSION });
  assert.ok(restored);
  assert.equal(restored.schema, "receiz.wildz.owner_state.v1");
  assert.equal(restored.playState.worldMastery, 101);
  assert.deepEqual(restored.settings, player.settings);
  assert.deepEqual(restored.character, player.character);
  assert.deepEqual(restored.personalEvents, player.personalEvents);
  assert.deepEqual(restored.canonicalCursor, player.canonicalCursor);
  assert.deepEqual(restored.receipts, player.receipts);
});

test("character, support tuple, and card order remain isolated by exact owner scope", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const keeperCharacter = generateWildzCharacter({ identityRef: SESSION.keyId, kaiPulse: "101", gender: "female", version: 1 });
  const scoutCharacter = generateWildzCharacter({ identityRef: OTHER_SESSION.keyId, kaiPulse: "202", gender: "male", version: 1 });
  const keeper = createOwnerBoundInitialPlayState(SESSION.actorId);
  const scout = createOwnerBoundInitialPlayState(OTHER_SESSION.actorId);

  await saveWildzRestoredPlayState({
    database,
    session: SESSION,
    playState: { ...keeper, supportAssetIds: [null, null] },
    character: keeperCharacter,
    player: {
      settings: { avatarStyle: "female", movementMode: "run", audio: { master: 0.4 }, cardOrder: "newest" },
      personalEvents: [],
      canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
      receipts: []
    }
  });
  await saveWildzRestoredPlayState({
    database,
    session: OTHER_SESSION,
    playState: { ...scout, worldMastery: 77, supportAssetIds: [null, null] },
    character: scoutCharacter,
    player: {
      settings: { avatarStyle: "male", movementMode: "walk", audio: { muted: true }, cardOrder: "oldest" },
      personalEvents: [],
      canonicalCursor: { worldId: "wilds:global:v3", revision: 2, eventId: null },
      receipts: []
    }
  });

  const reopenedKeeper = await loadWildzRestoredOwnerState({ database, session: SESSION });
  const reopenedScout = await loadWildzRestoredOwnerState({ database, session: OTHER_SESSION });
  assert.ok(reopenedKeeper && reopenedScout);
  assert.equal(reopenedKeeper.character?.digest, keeperCharacter.digest);
  assert.equal(reopenedKeeper.settings.cardOrder, "newest");
  assert.equal(reopenedKeeper.playState.inventory[0]?.manifest.ownerReceizId, SESSION.actorId);
  assert.equal(reopenedScout.character?.digest, scoutCharacter.digest);
  assert.equal(reopenedScout.settings.cardOrder, "oldest");
  assert.equal(reopenedScout.playState.inventory[0]?.manifest.ownerReceizId, OTHER_SESSION.actorId);
  assert.equal(reopenedScout.playState.worldMastery, 77);
});

test("the default identity starter survives player Vault export and reimport under its exact owner", () => {
  const ownerState = createOwnerBoundInitialPlayState(SESSION.actorId);
  const player = createWildsPlayerVault({
    playerId: SESSION.actorId,
    exportedAt: "2026-07-15T21:00:00.000Z",
    playState: ownerState,
    character: null,
    settings: { avatarStyle: null, movementMode: "walk", audio: {}, cardOrder: "rarity" },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  assert.equal(verifyWildsPlayerVault(player).ok, true);

  const restored = prepareWildzPlayerPlayState(player, player.playState.inventory);
  assert.deepEqual(restored.inventory.map((asset) => asset.id), player.playState.inventory.map((asset) => asset.id));
  assert.equal(restored.inventory.every((asset) => asset.manifest.ownerReceizId === SESSION.actorId), true);
  assert.deepEqual(restorePlayState(serializePlayState(restored), SESSION.actorId).supportAssetIds, [null, null]);
});
