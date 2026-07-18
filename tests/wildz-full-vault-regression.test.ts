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
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { sealCollectedCard, verifyAnyWildsCard } from "../src/features/play/portable-card";
import { generateWildzCharacter } from "../src/features/identity/wildz-genesis";
import {
  loadWildzRestoredPlayState,
  restoreWildzArtifactForSurface
} from "../src/features/identity/wildz-restore";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import {
  createWildzArtifactCodec,
  type WildzArtifactInspection
} from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository, type WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";
import { createWildzIdentityPlayerCard } from "../src/lib/receiz/wildz-identity-adapter";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

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
  const playerState = {
    ...playStateWith(cards),
    selectedAssetId: cards[42]!.id,
    selectedCardId: cards[42]!.manifest.familyId,
    pendingSyncAssetIds: [cards[13]!.id],
    worldMastery: 41
  };
  const player = createWildsPlayerVault({
    playerId: projection.owner.username!,
    exportedAt: "2026-07-15T16:00:00.000Z",
    playState: playerState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
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
    playerState
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
