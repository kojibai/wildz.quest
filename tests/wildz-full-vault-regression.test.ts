import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendReceizIdentityArtifactTrailerToPng,
  createReceizIdentityKeyFile,
  projectReceizIdentityAccount,
  serializeReceizIdentityArtifact
} from "@receiz/sdk";
import {
  applyWildsInput,
  createOwnerBoundInitialPlayState,
  initialPlayState,
  restorePlayState,
  serializePlayState,
  type PlayState
} from "../src/features/play/game-state";
import {
  embedPortableCardInPng,
  embedPortableVaultInPng,
  readWildzPlayerVaultAppendFromPng
} from "../src/features/play/card-export";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { sealCollectedCard, verifyAnyWildsCard } from "../src/features/play/portable-card";
import { generateWildzCharacter } from "../src/features/identity/wildz-genesis";
import {
  loadWildzRestoredPlayState,
  restoreWildzArtifactForSurface,
  saveWildzRestoredPlayState
} from "../src/features/identity/wildz-restore";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import {
  createWildzArtifactCodec,
  type WildzArtifactInspection
} from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository, type WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";
import { createWildzIdentityPlayerCard } from "../src/lib/receiz/wildz-identity-adapter";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import {
  revealWildsExplorationAt,
  wildsExplorationContainsWorld
} from "../src/features/play/wilds-exploration-atlas";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

function createCards(count: number) {
  return Array.from({ length: count }, (_, index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "regression_owner",
    encounterId: `full-vault-regression-${String(index).padStart(3, "0")}`,
    capturedAt: new Date(Date.UTC(2026, 6, 15, 15, Math.floor(index / 60), index % 60)).toISOString()
  }));
}

function playStateWith(cards: ReturnType<typeof createCards>) {
  const empty: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: [],
    discoveredCardIds: [],
    pendingSyncAssetIds: [],
    companionProgress: {},
    livingProgress: {},
    selectedAssetId: "",
    selectedCardId: ""
  };
  return cards.reduce((state, asset) => applyWildsInput(state, { type: "import-card", asset }), empty);
}

async function regressionArtifact() {
  const cards = createCards(97);
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "regression_identity", username: "vault__keeper_97", displayName: "Vault Keeper 97" },
    portableState: {
      schema: "receiz.account.state.v3",
      snapshot: {
        schema: "receiz.app.portable_bundle.v1",
        objects: [...cards, structuredClone(cards[17]!), { schema: "receiz.wallet.note.v1", id: "unrelated-note" }]
      }
    }
  });
  const projection = await projectReceizIdentityAccount(identity.keyFile);
  const playerStateBase = playStateWith(cards);
  const playerState = {
    ...playerStateBase,
    explorationAtlas: revealWildsExplorationAt(playerStateBase.explorationAtlas, { x: 0, z: -1_400 }),
    selectedAssetId: cards[42]!.id,
    selectedCardId: cards[42]!.manifest.familyId,
    pendingSyncAssetIds: [cards[13]!.id],
    worldMastery: 41
  };
  const character = generateWildzCharacter({
    identityRef: projection.keyId,
    kaiPulse: "13734042",
    gender: "female",
    version: 1
  });
  const player = createWildsPlayerVault({
    playerId: projection.owner.username!,
    exportedAt: "2026-07-15T16:00:00.000Z",
    playState: playerState,
    character,
    settings: { avatarStyle: "female", movementMode: "run", audio: {}, cardOrder: "newest" },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  const identityBasis = embedPortableVaultInPng(BASE_PNG, cards);
  const cardOnlyBasis = embedPortableVaultInPng(BASE_PNG, player.playState.inventory, player);
  const identityCardBytes = await createWildzIdentityPlayerCard({
    keyFile: identity.keyFile,
    session: {
      schema: "receiz.wildz.identity_session.v1",
      keyId: projection.keyId,
      actorId: projection.owner.username!,
      username: projection.owner.username,
      displayName: projection.owner.displayName,
      portableStateStatus: projection.portableStateStatus,
      localAuthority: "verified",
      remoteStatus: "unknown"
    },
    assets: cards,
    player
  });
  return {
    cards,
    expectedIds: cards.map((asset) => asset.id).sort(),
    embeddedUsername: projection.owner.username!,
    identityBytes: appendReceizIdentityArtifactTrailerToPng(identityBasis, identity.keyFile),
    identityCardBytes,
    cardOnlyBytes: cardOnlyBasis,
    playerState,
    character
  };
}

function setup() {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({
    identityRepository: repository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault }
  });
  return { database, repository, codec };
}

function inspectionIds(inspected: WildzArtifactInspection) {
  return inspected.kind === "identity-seal" ? inspected.portableAssets.map((asset) => asset.id)
    : inspected.kind === "card-vault" || inspected.kind === "commerce-vault" ? inspected.assets.map((asset) => asset.id)
      : [];
}

test("a first Identity Record login creates one real owner-bound starter creature", async () => {
  const target = setup();
  await target.repository.bootstrap();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "new_keeper_uid", username: "new_keeper", displayName: "New Keeper" },
    portableState: null
  });

  const outcome = await restoreWildzArtifactForSurface({
    surface: "genesis",
    bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(identity.keyFile)),
    mimeType: "application/json",
    name: "new-keeper.receiz-key.json",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true
  });

  assert.equal(outcome.session.actorId, "new_keeper");
  assert.equal(outcome.playState.inventory.length, 1);
  const starter = outcome.playState.inventory[0]!;
  assert.equal(starter.manifest.ownerReceizId, outcome.session.actorId);
  assert.equal(verifyAnyWildsCard(starter).ok, true);
  assert.equal(outcome.playState.selectedAssetId, starter.id);
  assert.equal(outcome.playState.selectedCardId, starter.manifest.familyId);
  assert.notEqual(starter.manifest.name, "SealCub");
});

test("one standalone card upload preserves the original Vault card and adds exactly one card", async () => {
  const target = setup();
  const session = await target.repository.bootstrap();
  const currentBase = createOwnerBoundInitialPlayState(session.actorId, session.createdAt);
  const currentPlayState = {
    ...currentBase,
    explorationAtlas: revealWildsExplorationAt(currentBase.explorationAtlas, { x: 1_400, z: 0 })
  };
  const starter = currentPlayState.inventory[0]!;
  const uploaded = sealCollectedCard({
    formId: `${starter.manifest.familyId}-1`,
    ownerReceizId: session.actorId,
    encounterId: "single-card-upload-replaces-starter",
    capturedAt: "2026-07-15T16:30:00.000Z"
  });

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: embedPortableCardInPng(BASE_PNG, uploaded),
    mimeType: "image/png",
    name: "one-card.receized.png",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true,
    currentPlayState
  });

  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id), [starter.id, uploaded.id]);
  assert.equal(outcome.playState.inventory[0]?.manifest.name, starter.manifest.name);
  assert.equal(outcome.playState.selectedAssetId, uploaded.id);
  assert.equal(outcome.playState.selectedCardId, uploaded.manifest.familyId);
  assert.deepEqual(outcome.playState.explorationAtlas, currentPlayState.explorationAtlas);
});

test("one player-bearing Vault card preserves the distinct local starter", async () => {
  const target = setup();
  const session = await target.repository.bootstrap();
  const currentPlayState = createOwnerBoundInitialPlayState(session.actorId, session.createdAt);
  const starter = currentPlayState.inventory[0]!;
  const uploaded = sealCollectedCard({
    formId: `${starter.manifest.familyId}-1`,
    ownerReceizId: session.actorId,
    encounterId: "single-player-vault-card",
    capturedAt: "2026-07-15T16:31:00.000Z"
  });
  const uploadedState = playStateWith([uploaded]);
  const player = createWildsPlayerVault({
    playerId: session.actorId,
    exportedAt: "2026-07-15T16:32:00.000Z",
    playState: uploadedState,
    settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: embedPortableVaultInPng(BASE_PNG, [uploaded], player),
    mimeType: "image/png",
    name: "one-player-card.receized.png",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true,
    currentPlayState,
    preserveActiveIdentity: true
  });

  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id), [starter.id, uploaded.id]);
  assert.equal(outcome.playState.selectedAssetId, starter.id);
});

test("one uploaded card does not import additional inventory hidden in its player continuity", async () => {
  const target = setup();
  const session = await target.repository.bootstrap();
  const currentPlayState = createOwnerBoundInitialPlayState(session.actorId, session.createdAt);
  const starter = currentPlayState.inventory[0]!;
  const uploaded = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: session.actorId,
    encounterId: "single-visible-card",
    capturedAt: "2026-07-15T16:32:30.000Z"
  });
  const hidden = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: session.actorId,
    encounterId: "hidden-player-inventory-card",
    capturedAt: "2026-07-15T16:32:31.000Z"
  });
  const player = createWildsPlayerVault({
    playerId: session.actorId,
    exportedAt: "2026-07-15T16:32:32.000Z",
    playState: playStateWith([uploaded, hidden]),
    settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: embedPortableVaultInPng(BASE_PNG, [uploaded], player),
    mimeType: "image/png",
    name: "one-visible-card.receized.png",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true,
    currentPlayState,
    preserveActiveIdentity: true
  });

  assert.deepEqual(outcome.verifiedAssetIds, [uploaded.id]);
  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id), [starter.id, uploaded.id]);
});

test("a player Vault preserves two distinct verified cards from the same family", async () => {
  const target = setup();
  const session = await target.repository.bootstrap();
  const currentPlayState = createOwnerBoundInitialPlayState(session.actorId, session.createdAt);
  const starter = currentPlayState.inventory[0]!;
  const uploaded = sealCollectedCard({
    formId: `${starter.manifest.familyId}-1`,
    ownerReceizId: session.actorId,
    encounterId: "repair-old-fallback-duplicate",
    capturedAt: "2026-07-15T16:33:00.000Z"
  });
  const duplicatedState = applyWildsInput(currentPlayState, { type: "import-card", asset: uploaded });
  const player = createWildsPlayerVault({
    playerId: session.actorId,
    exportedAt: "2026-07-15T16:34:00.000Z",
    playState: duplicatedState,
    settings: { avatarStyle: null, movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: embedPortableVaultInPng(BASE_PNG, duplicatedState.inventory, player),
    mimeType: "image/png",
    name: "old-fallback-duplicate.receized.png",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true,
    currentPlayState,
    preserveActiveIdentity: true
  });

  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id), [starter.id, uploaded.id]);
  assert.equal(outcome.playState.selectedAssetId, starter.id);
});

test("cold loading preserves two distinct verified cards from the same family", async () => {
  const target = setup();
  const session = await target.repository.bootstrap();
  const currentPlayState = createOwnerBoundInitialPlayState(session.actorId, session.createdAt);
  const starter = currentPlayState.inventory[0]!;
  const uploaded = sealCollectedCard({
    formId: `${starter.manifest.familyId}-1`,
    ownerReceizId: session.actorId,
    encounterId: "repair-persisted-fallback-duplicate",
    capturedAt: "2026-07-15T16:35:00.000Z"
  });
  const duplicatedState = applyWildsInput(currentPlayState, { type: "import-card", asset: uploaded });
  await saveWildzRestoredPlayState({
    database: target.database,
    session,
    playState: duplicatedState
  });

  const loaded = await loadWildzRestoredPlayState({ database: target.database, session });

  assert.deepEqual(loaded?.inventory.map((asset) => asset.id), [starter.id, uploaded.id]);
  assert.equal(loaded?.selectedAssetId, uploaded.id);
});

test("generated 97-card identity Vault survives inspection, both restore surfaces, PlayState, and cold reload", async () => {
  const fixture = await regressionArtifact();

  const genesis = setup();
  const previous = await genesis.repository.bootstrap();
  assert.notEqual(previous.username, fixture.embeddedUsername);
  const inspected = await genesis.codec.inspect({ bytes: fixture.identityBytes, mimeType: "image/png", name: "misleading-card.png" });
  assert.deepEqual(inspectionIds(inspected), fixture.expectedIds);
  assert.ok(inspected.kind === "identity-seal" || inspected.kind === "commerce-vault");
  if (inspected.kind === "identity-seal" || inspected.kind === "commerce-vault") {
    assert.equal(inspected.identity?.session.username, fixture.embeddedUsername);
  }

  const genesisOutcome = await restoreWildzArtifactForSurface({
    surface: "genesis",
    bytes: fixture.identityBytes,
    mimeType: "image/png",
    name: "misleading-card.png",
    codec: genesis.codec,
    repository: genesis.repository,
    database: genesis.database,
    confirmCardOnly: true
  });
  assert.equal(genesisOutcome.session.username, fixture.embeddedUsername);
  assert.deepEqual(genesisOutcome.verifiedAssetIds, fixture.expectedIds);
  assert.deepEqual(genesisOutcome.playState.inventory.map((asset) => asset.id).sort(), fixture.expectedIds);
  assert.deepEqual(
    restorePlayState(serializePlayState(genesisOutcome.playState)).inventory.map((asset) => asset.id).sort(),
    fixture.expectedIds
  );

  const coldRepository = createWildzIdentityRepository({ database: genesis.database });
  const coldSession = await coldRepository.active();
  assert.equal(coldSession?.username, fixture.embeddedUsername);
  assert.ok(coldSession);
  const coldState = await loadWildzRestoredPlayState({ database: genesis.database, session: coldSession });
  assert.deepEqual(coldState?.inventory.map((asset) => asset.id).sort(), fixture.expectedIds);

  const idCard = setup();
  await idCard.repository.bootstrap();
  const idCardOutcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.identityCardBytes,
    mimeType: "image/png",
    name: "vault__keeper_97.receiz-id-card.png",
    codec: idCard.codec,
    repository: idCard.repository,
    database: idCard.database,
    confirmCardOnly: true
  });
  assert.equal(idCardOutcome.session.username, fixture.embeddedUsername);
  assert.deepEqual(idCardOutcome.verifiedAssetIds, fixture.expectedIds);
  assert.equal(idCardOutcome.playState.selectedAssetId, fixture.playerState.selectedAssetId);
  assert.deepEqual(idCardOutcome.playState.pendingSyncAssetIds, fixture.playerState.pendingSyncAssetIds);
  assert.equal(idCardOutcome.playState.worldMastery, 41);
  assert.equal(idCardOutcome.character?.digest, fixture.character.digest);
  assert.equal(idCardOutcome.playerContinuity.settings.movementMode, "run");
  assert.equal(idCardOutcome.playerContinuity.settings.cardOrder, "newest");
  const idCardColdRepository = createWildzIdentityRepository({ database: idCard.database });
  const idCardColdSession = await idCardColdRepository.active();
  assert.ok(idCardColdSession);
  const idCardColdState = await loadWildzRestoredPlayState({ database: idCard.database, session: idCardColdSession });
  assert.deepEqual(idCardColdState?.inventory.map((asset) => asset.id).sort(), fixture.expectedIds);

  const v3Outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.cardOnlyBytes,
    mimeType: "image/png",
    codec: genesis.codec,
    repository: genesis.repository,
    database: genesis.database,
    confirmCardOnly: true,
    proofSealedPlayer: true,
    currentPlayState: genesisOutcome.playState
  });
  assert.deepEqual(v3Outcome.playState.inventory.map((asset) => asset.id).sort(), fixture.expectedIds);
  assert.deepEqual(v3Outcome.playState.pendingSyncAssetIds, fixture.playerState.pendingSyncAssetIds);
  assert.equal(v3Outcome.playState.selectedAssetId, fixture.playerState.selectedAssetId);
  assert.equal(v3Outcome.playState.worldMastery, 41);

  const inGame = setup();
  await inGame.repository.bootstrap();
  const inventoryOutcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.identityBytes,
    mimeType: "image/png",
    name: "misleading-identity.receizvault",
    codec: inGame.codec,
    repository: inGame.repository,
    database: inGame.database,
    confirmCardOnly: true
  });
  assert.equal(inventoryOutcome.session.username, fixture.embeddedUsername);
  assert.deepEqual(inventoryOutcome.verifiedAssetIds, fixture.expectedIds);
  assert.deepEqual(inventoryOutcome.playState.inventory.map((asset) => asset.id).sort(), fixture.expectedIds);
});

test("Profile activation of a Wildz continuity seal replaces the prior account with its exact saved player", async () => {
  const fixture = await regressionArtifact();
  const target = setup();
  const previous = await target.repository.bootstrap();
  const previousBase = createOwnerBoundInitialPlayState(previous.actorId, previous.createdAt);
  const previousState = {
    ...previousBase,
    explorationAtlas: revealWildsExplorationAt(previousBase.explorationAtlas, { x: 1_400, z: 0 })
  };
  const previousStarterId = previousState.inventory[0]!.id;

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.identityCardBytes,
    mimeType: "image/png",
    name: "vault__keeper_97.receiz-id-card.png",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true,
    currentPlayState: previousState,
    currentPlayerContinuity: {
      settings: { avatarStyle: null, movementMode: "walk", audio: {}, cardOrder: "rarity" },
      personalEvents: [],
      canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
      receipts: []
    },
    carryCurrentVault: true
  });

  assert.equal(outcome.session.username, fixture.embeddedUsername);
  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id).sort(), fixture.expectedIds);
  assert.equal(outcome.playState.inventory.some((asset) => asset.id === previousStarterId), false);
  assert.equal(outcome.playState.selectedAssetId, fixture.playerState.selectedAssetId);
  assert.deepEqual(outcome.playState.player, fixture.playerState.player);
  assert.deepEqual(outcome.playState.siteSpace, fixture.playerState.siteSpace);
  assert.equal(outcome.playState.worldMastery, 41);
  assert.equal(outcome.character?.digest, fixture.character.digest);
  assert.equal(outcome.playerContinuity.settings.movementMode, "run");
  assert.equal(outcome.playerContinuity.settings.cardOrder, "newest");
  assert.equal(wildsExplorationContainsWorld(outcome.playState.explorationAtlas, { x: 0, z: -1_400 }), true);
  assert.equal(wildsExplorationContainsWorld(outcome.playState.explorationAtlas, { x: 1_400, z: 0 }), false);

  const locallyAdvanced = {
    ...outcome.playState,
    explorationAtlas: revealWildsExplorationAt(outcome.playState.explorationAtlas, { x: 1_400, z: 0 })
  };
  const restoredAgain = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.identityCardBytes,
    mimeType: "image/png",
    name: "vault__keeper_97.receiz-id-card.png",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true,
    currentPlayState: locallyAdvanced,
    carryCurrentVault: true
  });
  assert.equal(wildsExplorationContainsWorld(restoredAgain.playState.explorationAtlas, { x: 0, z: -1_400 }), true);
  assert.equal(wildsExplorationContainsWorld(restoredAgain.playState.explorationAtlas, { x: 1_400, z: 0 }), false);
});

test("matching Identity Seal authenticates an already loaded proof vault without dropping current cards", async () => {
  const { database, repository, codec } = setup();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "matching_identity", username: "matching_owner", displayName: "Matching Owner" }
  });
  const projection = await projectReceizIdentityAccount(identity.keyFile);
  const proofSession: WildzIdentitySession = {
    schema: "receiz.wildz.identity_session.v1",
    keyId: `receiz_vault_${"a".repeat(32)}`,
    actorId: "matching_owner",
    username: "matching_owner",
    displayName: "Matching Owner",
    portableStateStatus: "missing",
    localAuthority: "proof-sealed-vault",
    remoteStatus: "unknown"
  };
  await database.transaction(["identities", "meta"], "readwrite", (tx) =>
    repository.writeSession(tx, proofSession, true)
  );
  const existingCard = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: proofSession.actorId,
    encounterId: "already-loaded-vault-card",
    capturedAt: "2026-07-17T01:00:00.000Z"
  });
  const currentPlayState = applyWildsInput(
    createOwnerBoundInitialPlayState(proofSession.actorId),
    { type: "import-card", asset: existingCard }
  );

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile),
    mimeType: "image/png",
    name: "matching-owner.identity-seal.png",
    codec,
    repository,
    database,
    confirmCardOnly: true,
    currentPlayState
  });

  assert.equal(outcome.session.keyId, projection.keyId);
  assert.equal(outcome.session.localAuthority, "verified");
  assert.equal(outcome.session.actorId, "matching_owner");
  assert.ok(outcome.playState.inventory.some((asset) => asset.id === existingCard.id));
  const reloaded = await loadWildzRestoredPlayState({ database, session: outcome.session });
  assert.ok(reloaded?.inventory.some((asset) => asset.id === existingCard.id));
});

test("a different Identity Seal becomes active without discarding the working Vault", async () => {
  const { database, repository, codec } = setup();
  const currentSession = await repository.bootstrap();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "replacement_identity", username: "replacement_owner", displayName: "Replacement Owner" }
  });
  const projection = await projectReceizIdentityAccount(identity.keyFile);
  const existingCard = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: currentSession.actorId,
    encounterId: "vault-before-identity-switch",
    capturedAt: "2026-07-17T01:05:00.000Z"
  });
  const currentPlayState = applyWildsInput(
    createOwnerBoundInitialPlayState(currentSession.actorId),
    { type: "import-card", asset: existingCard }
  );
  const currentCharacter = generateWildzCharacter({
    identityRef: currentSession.keyId,
    kaiPulse: "303",
    gender: "female",
    version: 1
  });

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile),
    mimeType: "image/png",
    name: "replacement-owner.identity-seal.png",
    codec,
    repository,
    database,
    confirmCardOnly: true,
    carryCurrentVault: true,
    currentPlayState,
    currentCharacter,
    currentPlayerContinuity: {
      settings: { avatarStyle: "female", movementMode: "run", audio: {}, cardOrder: "newest" },
      personalEvents: [],
      canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
      receipts: []
    }
  });

  assert.equal(outcome.session.keyId, projection.keyId);
  assert.equal(outcome.session.actorId, "replacement_owner");
  assert.ok(outcome.playState.inventory.some((asset) => asset.id === existingCard.id));
  assert.equal(outcome.character?.digest, currentCharacter.digest);
  assert.equal(outcome.playerContinuity.settings.cardOrder, "newest");
  assert.deepEqual(await repository.active(), outcome.session);
  const reloaded = await loadWildzRestoredPlayState({ database, session: outcome.session });
  assert.ok(reloaded?.inventory.some((asset) => asset.id === existingCard.id));
});

test("an explicitly uploaded foreign Vault preserves the bootstrap starter and is saved by the active Identity Seal", async () => {
  const fixture = await regressionArtifact();
  const { database, repository, codec } = setup();
  const active = await repository.bootstrap();
  const currentBase = createOwnerBoundInitialPlayState(active.actorId, active.createdAt);
  const currentPlayState = {
    ...currentBase,
    explorationAtlas: revealWildsExplorationAt(currentBase.explorationAtlas, { x: 1_400, z: 0 })
  };

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.identityCardBytes,
    mimeType: "image/png",
    name: "foreign-owner-vault.png",
    codec,
    repository,
    database,
    confirmCardOnly: true,
    currentPlayState,
    preserveActiveIdentity: true
  });

  assert.equal(outcome.session.keyId, active.keyId);
  assert.equal(outcome.session.actorId, active.actorId);
  assert.deepEqual(outcome.playState.player, currentPlayState.player);
  assert.deepEqual(outcome.playState.siteSpace, currentPlayState.siteSpace);
  assert.equal(outcome.playState.inventory.length, fixture.expectedIds.length + 1);
  assert.ok(outcome.playState.inventory.some((asset) => asset.id === currentPlayState.inventory[0]?.id));
  for (const assetId of fixture.expectedIds) {
    assert.ok(outcome.playState.inventory.some((asset) => asset.id === assetId));
  }
  assert.equal(wildsExplorationContainsWorld(outcome.playState.explorationAtlas, { x: 1_400, z: 0 }), true);
  assert.equal(wildsExplorationContainsWorld(outcome.playState.explorationAtlas, { x: 0, z: -1_400 }), false);

  const adoptedPlayer = createWildsPlayerVault({
    playerId: outcome.session.username ?? outcome.session.actorId,
    exportedAt: "2026-07-28T22:00:00.000Z",
    playState: outcome.playState,
    character: outcome.character,
    settings: outcome.playerContinuity.settings,
    personalEvents: outcome.playerContinuity.personalEvents,
    canonicalCursor: outcome.playerContinuity.canonicalCursor,
    receipts: outcome.playerContinuity.receipts
  });
  const saved = embedPortableVaultInPng(BASE_PNG, outcome.playState.inventory, adoptedPlayer);
  assert.equal(readWildzPlayerVaultAppendFromPng(saved).player.playerId, active.actorId);
});

test("the same 97-card V3 Vault is card-only without SDK authority and cannot switch identity", async () => {
  const fixture = await regressionArtifact();
  const target = setup();
  const active = await target.repository.bootstrap();
  const inspected = await target.codec.inspect({ bytes: fixture.cardOnlyBytes, mimeType: "image/png" });
  assert.equal(inspected.kind, "card-vault");
  assert.deepEqual(inspectionIds(inspected), fixture.expectedIds);

  await assert.rejects(
    restoreWildzArtifactForSurface({
      surface: "card-vault",
      bytes: fixture.cardOnlyBytes,
      mimeType: "image/png",
      codec: target.codec,
      repository: target.repository,
      database: target.database,
      confirmCardOnly: true
    }),
    /wildz_restore_owner_mismatch/
  );
  assert.deepEqual(await target.repository.active(), active);
});
