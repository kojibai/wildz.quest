import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createReceizIdentityKeyFile,
  serializeReceizIdentityArtifact
} from "@receiz/sdk";
import JSZip from "jszip";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import {
  sealCollectedCard,
  type PortableCardAsset
} from "../src/features/play/portable-card";
import { admitLegacyCard, currentRevision } from "../src/features/play/living-card-proof";
import { sealRetirement } from "../src/features/games/lifecycle/creature-retirement";
import {
  saveWildzRestoredPlayState,
  loadWildzRestoredPlayState,
  restoreWildzArtifactForSurface
} from "../src/features/identity/wildz-restore";
import {
  applyWildsInput,
  initialPlayState,
  restorePlayState,
  serializePlayState,
  type PlayState
} from "../src/features/play/game-state";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import {
  createWildzArtifactCodec,
  type WildzArtifactInspection
} from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import {
  createReceizCommercePlayerVaultFixture,
  createReceizCrossPlatformArtifactFixtures
} from "./support/receiz-cross-platform-fixtures";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

function concatBytes(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function uint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0);
}

function uint32Bytes(value: number) {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  return concatBytes([uint32Bytes(data.byteLength), typeBytes, data, uint32Bytes(crc32(concatBytes([typeBytes, data])))]);
}

function rewritePngChunk(source: Uint8Array, target: string, transform: (data: Uint8Array) => Uint8Array) {
  const output: Uint8Array[] = [source.slice(0, 8)];
  let offset = 8;
  let changed = false;
  while (offset + 12 <= source.byteLength) {
    const length = uint32(source, offset);
    const type = new TextDecoder().decode(source.slice(offset + 4, offset + 8));
    const data = source.slice(offset + 8, offset + 8 + length);
    const next: Uint8Array = type === target && !changed ? transform(data) : data;
    changed ||= next !== data;
    output.push(pngChunk(type, next));
    offset += 12 + length;
    if (type === "IEND") break;
  }
  assert.equal(changed, true, `missing PNG chunk ${target}`);
  return concatBytes(output);
}

function mutateSignalArchiveChunk(data: Uint8Array) {
  const separator = data.indexOf(0);
  if (separator < 0) return data;
  const keyword = new TextDecoder().decode(data.slice(0, separator));
  if (keyword !== "receiz.signal_vault_card_archive.0") return data;
  const next = data.slice();
  const index = separator + 1;
  next[index] = next[index] === 65 ? 66 : 65;
  return next;
}

function mutateCardProof(data: Uint8Array) {
  const value = JSON.parse(new TextDecoder().decode(data)) as { asset?: { proof?: { digest?: string } } };
  if (!value.asset?.proof?.digest) return data;
  value.asset.proof.digest = `${value.asset.proof.digest.slice(0, -1)}${value.asset.proof.digest.endsWith("0") ? "1" : "0"}`;
  return new TextEncoder().encode(JSON.stringify(value));
}

function verifiedAssets(count = 6) {
  return Array.from({ length: count }, (_, index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "cross_platform_owner",
    encounterId: `cross-platform-${index}`,
    capturedAt: new Date(Date.UTC(2026, 6, 15, 13, index)).toISOString()
  }));
}

function createCodec(database = createMemoryWildzContinuityDatabase()) {
  const repository = createWildzIdentityRepository({ database });
  return {
    database,
    repository,
    codec: createWildzArtifactCodec({
      identityRepository: repository,
      commerceVaultReader: { inspect: inspectReceizCommerceVault }
    })
  };
}

function inspectionIds(value: WildzArtifactInspection) {
  return value.kind === "identity-seal" ? value.portableAssets.map((asset) => asset.id)
    : value.kind === "card-vault" || value.kind === "commerce-vault" ? value.assets.map((asset) => asset.id)
      : [];
}

test("all six Receiz writers recover the exact sorted unique Wildz card set", async () => {
  const artifacts = await createReceizCrossPlatformArtifactFixtures(verifiedAssets());
  for (const artifact of artifacts) {
    const { codec } = createCodec();
    const inspected = await codec.inspect({ bytes: artifact.bytes, mimeType: artifact.mimeType, name: artifact.filename });
    assert.notEqual(inspected.kind, "invalid", artifact.source);
    assert.notEqual(inspected.kind, "unsupported", artifact.source);
    assert.deepEqual(inspectionIds(inspected), artifact.expectedWildzAssetIds, artifact.source);
    if (artifact.embeddedUsername) {
      assert.ok(inspected.kind === "identity-seal" || inspected.kind === "commerce-vault", artifact.source);
      if (inspected.kind === "identity-seal" || inspected.kind === "commerce-vault") {
        assert.equal(inspected.identity?.session.username, artifact.embeddedUsername, artifact.source);
      }
    } else {
      if (inspected.kind === "commerce-vault") assert.equal(inspected.identity, null, artifact.source);
      else assert.equal("identity" in inspected, false, artifact.source);
    }
    assert.equal(inspectionIds(inspected).some((id) => id === "wallet-note-cross-platform-fixture"), false);
  }
});

test("an identity-bearing Vault replaces a different active username and persists its complete assets", async () => {
  const artifacts = await createReceizCrossPlatformArtifactFixtures(verifiedAssets());
  const fixture = artifacts.find((artifact) => artifact.source === "sdk-compatible")!;
  const { database, repository, codec } = createCodec();
  const previous = await repository.bootstrap();
  assert.notEqual(previous.username, fixture.embeddedUsername);
  const outcome = await restoreWildzArtifactForSurface({
    surface: "genesis",
    bytes: fixture.bytes,
    mimeType: fixture.mimeType,
    name: fixture.filename,
    codec,
    repository,
    database,
    confirmCardOnly: true
  });
  assert.equal(outcome.session.username, fixture.embeddedUsername);
  assert.deepEqual(outcome.verifiedAssetIds, fixture.expectedWildzAssetIds);
  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id).sort(), fixture.expectedWildzAssetIds);

  const reopenedRepository = createWildzIdentityRepository({ database });
  const reopenedSession = await reopenedRepository.active();
  assert.equal(reopenedSession?.username, fixture.embeddedUsername);
  assert.ok(reopenedSession);
  const reopenedState = await loadWildzRestoredPlayState({ database, session: reopenedSession });
  assert.deepEqual(reopenedState?.inventory.map((asset) => asset.id).sort(), fixture.expectedWildzAssetIds);
});

test("a card-only Vault imports all assets without changing identity", async () => {
  const fixture = (await createReceizCrossPlatformArtifactFixtures(verifiedAssets()))
    .find((artifact) => artifact.source === "wildz-original")!;
  const { database, repository, codec } = createCodec();
  const previous = await repository.bootstrap();
  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.bytes,
    mimeType: fixture.mimeType,
    name: fixture.filename,
    codec,
    repository,
    database,
    confirmCardOnly: true
  });
  assert.equal(outcome.session.keyId, previous.keyId);
  assert.equal(outcome.session.actorId, previous.actorId);
  assert.equal(outcome.session.username, previous.username);
  assert.deepEqual(outcome.verifiedAssetIds, fixture.expectedWildzAssetIds);
  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id).sort(), fixture.expectedWildzAssetIds);
  assert.deepEqual(await repository.active(), previous);
});

test("same-owner card-only restore atomically unions the freshest prior PlayState", async () => {
  const fixture = (await createReceizCrossPlatformArtifactFixtures(verifiedAssets()))
    .find((artifact) => artifact.source === "wildz-original")!;
  const { database, repository, codec } = createCodec();
  const session = await repository.bootstrap();
  const priorOnly = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: session.actorId,
    encounterId: "prior-only-card",
    capturedAt: "2026-07-15T13:59:00.000Z"
  });
  const freshest = applyWildsInput(structuredClone(initialPlayState), { type: "import-card", asset: priorOnly });
  freshest.worldMastery = 73;
  await saveWildzRestoredPlayState({ database, session, playState: initialPlayState });

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.bytes,
    mimeType: fixture.mimeType,
    codec,
    repository,
    database,
    confirmCardOnly: true,
    currentPlayState: freshest
  });
  const ownerScopedFreshest = restorePlayState(serializePlayState(freshest), session.actorId);
  const expectedUnion = [...new Set([
    ...ownerScopedFreshest.inventory.map((asset) => asset.id),
    ...fixture.expectedWildzAssetIds
  ])].sort();
  assert.deepEqual(outcome.playState.inventory.map((asset) => asset.id).sort(), expectedUnion);
  assert.equal(outcome.playState.worldMastery, 73);
  assert.deepEqual(outcome.verifiedAssetIds, fixture.expectedWildzAssetIds);

  const cold = await loadWildzRestoredPlayState({ database, session });
  assert.deepEqual(cold?.inventory.map((asset) => asset.id).sort(), expectedUnion);
  assert.equal(cold?.worldMastery, 73);
});

test("identity-bearing vault uploaded inside an active vault merges into the current Receiz ID", async () => {
  const { database, repository, codec } = createCodec();
  const session = await repository.bootstrap();
  const incomingCards = verifiedAssets();
  const foreignBase: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: [],
    discoveredCardIds: [],
    pendingSyncAssetIds: [],
    companionProgress: {},
    livingProgress: {},
    selectedAssetId: "",
    selectedCardId: ""
  };
  const foreignPlayer = createWildsPlayerVault({
    playerId: "foreign_commerce_keeper",
    exportedAt: "2026-07-15T14:10:00.000Z",
    playState: incomingCards.reduce((state, asset) => applyWildsInput(state, { type: "import-card", asset }), foreignBase),
    settings: { avatarStyle: "male", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  const fixture = {
    bytes: await createReceizCommercePlayerVaultFixture(incomingCards, foreignPlayer),
    mimeType: "application/vnd.receiz.vault+zip",
    filename: "foreign-commerce-player-vault.receizvault",
    expectedWildzAssetIds: incomingCards.map((asset) => asset.id).sort()
  };
  const priorOnly = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: session.actorId,
    encounterId: "active-vault-prior-only-card",
    capturedAt: "2026-07-15T14:09:00.000Z"
  });
  const currentPlayState = applyWildsInput(structuredClone(initialPlayState), { type: "import-card", asset: priorOnly });
  currentPlayState.worldMastery = 91;
  await saveWildzRestoredPlayState({ database, session, playState: currentPlayState });
  const inspected = await codec.inspect({ bytes: fixture.bytes, mimeType: fixture.mimeType, name: fixture.filename });
  assert.equal(inspected.kind, "commerce-vault");
  const ownerScopedCurrent = restorePlayState(serializePlayState(currentPlayState), session.actorId);
  const expectedAssetIds = [...new Set([
    ...fixture.expectedWildzAssetIds,
    ...ownerScopedCurrent.inventory.map((asset) => asset.id)
  ])].sort();

  const outcome = await restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: fixture.bytes,
    mimeType: fixture.mimeType,
    name: fixture.filename,
    codec,
    repository,
    database,
    confirmCardOnly: true,
    preserveActiveIdentity: true,
    currentPlayState
  });

  assert.equal(outcome.session.keyId, session.keyId);
  assert.equal(outcome.session.actorId, session.actorId);
  assert.equal(outcome.session.username, session.username);
  assert.deepEqual(outcome.verifiedAssetIds, fixture.expectedWildzAssetIds);
  assert.deepEqual(
    outcome.playState.inventory.map((asset) => asset.id).sort(),
    expectedAssetIds
  );
  assert.equal(outcome.playState.worldMastery, 91);
  assert.deepEqual(await repository.active(), session);
  const cold = await loadWildzRestoredPlayState({ database, session });
  assert.deepEqual(
    cold?.inventory.map((asset) => asset.id).sort(),
    expectedAssetIds
  );
});

test("card-only restore rejects a divergent same-ID proof fork without persisting earlier cards", async () => {
  const { database, repository, codec } = createCodec();
  const session = await repository.bootstrap();
  const existing = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "portable_fork_owner.receiz.id",
    encounterId: "card-only-divergent-fork",
    capturedAt: "2026-07-15T14:00:00.000Z"
  });
  const divergent = sealCollectedCard({
    formId: existing.manifest.formId,
    ownerReceizId: existing.manifest.ownerReceizId,
    encounterId: existing.manifest.encounterId,
    capturedAt: "2026-07-15T14:01:00.000Z"
  });
  const earlierIncoming = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: "portable_fork_owner.receiz.id",
    encounterId: "card-only-before-divergent-fork",
    capturedAt: "2026-07-15T13:59:00.000Z"
  });
  assert.equal(divergent.id, existing.id, "control cards must share their stable id");
  assert.notEqual(divergent.proof.digest, existing.proof.digest, "control cards must carry divergent proofs");

  const baseline = applyWildsInput(structuredClone(initialPlayState), { type: "import-card", asset: existing });
  await saveWildzRestoredPlayState({ database, session, playState: baseline });
  const persistedBefore = await loadWildzRestoredPlayState({ database, session });
  assert.ok(persistedBefore);

  const bytes = embedPortableVaultInPng(BASE_PNG, [earlierIncoming, divergent]);
  await assert.rejects(restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes,
    mimeType: "image/png",
    codec,
    repository,
    database,
    confirmCardOnly: true
  }), /wildz_restore_duplicate_card_conflict/);

  const persistedAfter = await loadWildzRestoredPlayState({ database, session });
  assert.deepEqual(persistedAfter, persistedBefore);
  assert.equal(persistedAfter?.inventory.some((asset) => asset.id === earlierIncoming.id), false);
});

test("local self-hashed retirement cannot override a codec-admitted living card", async () => {
  const { database, repository, codec } = createCodec();
  const session = await repository.bootstrap();
  const living = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "retirement_poison_owner.receiz.id",
    encounterId: "retirement-poison",
    capturedAt: "2026-07-15T14:00:00.000Z"
  });
  const admitted = admitLegacyCard(living, living.manifest.capturedAt);
  const forgedRetired = sealRetirement(admitted, {
    creatureId: admitted.id,
    previousRevisionDigest: currentRevision(admitted).digest,
    matchReceiptDigest: `sha256:${"d".repeat(64)}`,
    finalVitality: 0,
    teamOutcome: "defeat",
    retiredAt: "2026-07-15T14:01:00.000Z",
    kaiUPulse: admitted.manifest.history!.events.at(-1)!.kai.uPulse + 1
  }, { verified: true, mortalOptIn: true }).card;
  const poisoned: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: [forgedRetired],
    selectedAssetId: forgedRetired.id,
    selectedCardId: forgedRetired.manifest.familyId
  };

  await assert.rejects(restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: embedPortableVaultInPng(BASE_PNG, [living]),
    mimeType: "image/png",
    codec,
    repository,
    database,
    confirmCardOnly: true,
    currentPlayState: poisoned
  }), /wildz_restore_retirement_authority_untrusted/);
  assert.equal((await loadWildzRestoredPlayState({ database, session }))?.inventory.some((card) => card.id === forgedRetired.id) ?? false, false);
});

test("signed segmented state outranks weaker snapshot mutation and conflicting duplicate IDs stage zero cards", async () => {
  const cards = verifiedAssets();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "tamper_fixture", username: "tamper_fixture", displayName: "Tamper Fixture" },
    portableState: { snapshot: { cards } }
  });
  const tampered = structuredClone(identity.keyFile);
  assert.ok(tampered.portableState);
  const injected = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "cross_platform_owner",
    encounterId: "tampered-extra",
    capturedAt: "2026-07-15T14:00:00.000Z"
  });
  tampered.portableState.snapshot = { cards: [...cards, injected] };
  const sourceFirstPortable = await createCodec().codec.inspect({
    bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(tampered)),
    mimeType: "application/json"
  });
  assert.equal(sourceFirstPortable.kind, "identity-seal");
  if (sourceFirstPortable.kind === "identity-seal") {
    assert.deepEqual(sourceFirstPortable.portableAssets.map((asset) => asset.id), cards.map((asset) => asset.id).sort());
    assert.equal(sourceFirstPortable.portableAssets.some((asset) => asset.id === injected.id), false);
  }

  const conflicting = structuredClone(cards[0]!) as PortableCardAsset;
  conflicting.status = "listed";
  const duplicateIdentity = await createReceizIdentityKeyFile({
    owner: { uid: "duplicate_fixture", username: "duplicate_fixture", displayName: "Duplicate Fixture" },
    portableState: { snapshot: { cards: [cards[0], conflicting] } }
  });
  const duplicate = await createCodec().codec.inspect({
    bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(duplicateIdentity.keyFile)),
    mimeType: "application/json"
  });
  assert.equal(duplicate.kind, "invalid");
  if (duplicate.kind === "invalid") assert.equal(duplicate.code, "wildz_restore_duplicate_card_conflict");
  assert.deepEqual(inspectionIds(duplicate), []);
});

test("archive-chunk and embedded card-proof mutation fail closed with zero staged cards", async () => {
  const fixtures = await createReceizCrossPlatformArtifactFixtures(verifiedAssets());
  const signal = fixtures.find((fixture) => fixture.source === "receiz-signal")!;
  const archiveTamper = await createCodec().codec.inspect({
    bytes: rewritePngChunk(signal.bytes, "tEXt", mutateSignalArchiveChunk),
    mimeType: signal.mimeType,
    name: signal.filename
  });
  assert.equal(archiveTamper.kind, "invalid");
  assert.deepEqual(inspectionIds(archiveTamper), []);

  const dual = fixtures.find((fixture) => fixture.source === "receiz-sealed-card")!;
  const cardTamper = await createCodec().codec.inspect({
    bytes: rewritePngChunk(dual.bytes, "rzCd", mutateCardProof),
    mimeType: dual.mimeType,
    name: dual.filename
  });
  assert.equal(cardTamper.kind, "invalid");
  if (cardTamper.kind === "invalid") assert.equal(cardTamper.code, "wildz_restore_card_proof_invalid");
  assert.deepEqual(inspectionIds(cardTamper), []);
});

test("V3 player continuity rejects body conflicts and legacy-schema player smuggling", async () => {
  const cards = verifiedAssets();
  const target = createCodec();
  const session = await target.repository.bootstrap();
  const empty: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: [],
    discoveredCardIds: [],
    pendingSyncAssetIds: [],
    livingProgress: {},
    selectedAssetId: "",
    selectedCardId: ""
  };
  const playerState = cards.reduce((state, asset) => applyWildsInput(state, { type: "import-card", asset }), empty);
  const conflictingState = structuredClone(playerState);
  const source = cards[0]!;
  const unrelatedSameId = sealCollectedCard({
    formId: source.manifest.formId,
    ownerReceizId: source.manifest.ownerReceizId,
    encounterId: source.manifest.encounterId,
    capturedAt: "2026-07-15T18:00:00.000Z"
  });
  assert.equal(unrelatedSameId.id, source.id);
  conflictingState.inventory[0] = unrelatedSameId;
  const player = createWildsPlayerVault({
    playerId: session.actorId,
    exportedAt: "2026-07-15T17:00:00.000Z",
    playState: conflictingState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  const v3 = embedPortableVaultInPng(BASE_PNG, cards, player);
  const conflictingInspection = await target.codec.inspect({ bytes: v3, mimeType: "image/png" });
  assert.equal(conflictingInspection.kind, "invalid");
  if (conflictingInspection.kind === "invalid") {
    assert.equal(conflictingInspection.code, "wildz_restore_duplicate_card_conflict");
  }
  await assert.rejects(restoreWildzArtifactForSurface({
    surface: "card-vault",
    bytes: v3,
    mimeType: "image/png",
    codec: target.codec,
    repository: target.repository,
    database: target.database,
    confirmCardOnly: true
  }), /wildz_restore_duplicate_card_conflict/);

  const legacySmuggle = rewritePngChunk(v3, "rzVt", (data) => {
    const proof = JSON.parse(new TextDecoder().decode(data)) as { schema: string };
    proof.schema = "receiz.wilds_vault_png_proof.v2";
    return new TextEncoder().encode(JSON.stringify(proof));
  });
  const smuggled = await target.codec.inspect({ bytes: legacySmuggle, mimeType: "image/png" });
  assert.equal(smuggled.kind, "invalid");
  assert.deepEqual(inspectionIds(smuggled), []);
});

test("Commerce packages require canonical root and Fibonacci backlink fields", async () => {
  const fixture = (await createReceizCrossPlatformArtifactFixtures(verifiedAssets(30)))
    .find((artifact) => artifact.source === "receiz-commerce")!;
  const missingRootConstant = await JSZip.loadAsync(fixture.bytes.slice().buffer);
  const rootEntry = missingRootConstant.file("root.receizvault.json")!;
  const root = JSON.parse(await rootEntry.async("string")) as {
    fibonacci: { leafOrder?: string };
    files: Array<{ shards: Array<{ leafIndex: number; path: string }> }>;
  };
  delete root.fibonacci.leafOrder;
  missingRootConstant.file("root.receizvault.json", JSON.stringify(root));
  const invalidRoot = await createCodec().codec.inspect({
    bytes: await missingRootConstant.generateAsync({ type: "uint8array" }),
    mimeType: fixture.mimeType
  });
  assert.equal(invalidRoot.kind, "invalid");

  const missingBacklinkTarget = await JSZip.loadAsync(fixture.bytes.slice().buffer);
  const canonicalRoot = JSON.parse(await missingBacklinkTarget.file("root.receizvault.json")!.async("string")) as typeof root;
  const linkedRef = canonicalRoot.files.flatMap((file) => file.shards).find((ref) => ref.leafIndex > 0)!;
  const shard = JSON.parse(await missingBacklinkTarget.file(linkedRef.path)!.async("string")) as {
    fibonacci: { links: Array<{ path?: string }> };
  };
  assert.ok(shard.fibonacci.links.length > 0);
  delete shard.fibonacci.links[0]!.path;
  missingBacklinkTarget.file(linkedRef.path, JSON.stringify(shard));
  const invalidBacklink = await createCodec().codec.inspect({
    bytes: await missingBacklinkTarget.generateAsync({ type: "uint8array" }),
    mimeType: fixture.mimeType
  });
  assert.equal(invalidBacklink.kind, "invalid");
});
