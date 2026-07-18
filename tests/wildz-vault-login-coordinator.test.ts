import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createReceizIdIdentity,
  createReceizIdentityKeyFile,
  serializeReceizIdentityArtifact,
  type DocumentVerifyResponse
} from "@receiz/sdk";
import { applyWildsInput, initialPlayState, type PlayState } from "../src/features/play/game-state";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import { createWildzArtifactCodec } from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createWildzPendingVaultRepository } from "../src/lib/receiz/wildz-pending-vault";
import type { WildzRemoteSession } from "../src/lib/receiz/wildz-session-bridge";
import { createWildzVaultLoginCoordinator } from "../src/lib/receiz/wildz-vault-login-coordinator";
import type { WildzProofArtifactVerifier } from "../src/lib/receiz/wildz-proof-sealed-vault";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { createReceizCommercePlayerVaultFixture } from "./support/receiz-cross-platform-fixtures";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));
const PROOF_BASIS = "c".repeat(64);
const SIGNATURE_V4 = {
  version: 1,
  alg: "Ed25519",
  cert: {
    version: 1,
    certType: "receiz.device.v1",
    certId: "device-cert-1",
    issuerKid: "issuer-key-1",
    alg: "Ed25519",
    subjectPublicKeyRawB64u: "A".repeat(43),
    issuedAtMs: 1_752_000_000_000,
    expiresAtMs: 1_783_536_000_000,
    sig: "A".repeat(86)
  },
  sig: "B".repeat(86),
  payloadHashSha256: "a".repeat(64),
  signedAtMs: 1_752_000_000_100
} as const;

function fixture(count = 9) {
  const captured = Array.from({ length: count }, (_, index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "vault_keeper",
    encounterId: `coordinator-${index}`,
    capturedAt: new Date(Date.UTC(2026, 6, 15, 20, index)).toISOString()
  }));
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
  const playState = captured.reduce((state, asset) => applyWildsInput(state, { type: "import-card", asset }), empty);
  playState.worldMastery = 77;
  const player = createWildsPlayerVault({
    playerId: "vault_keeper.receiz.id",
    exportedAt: "2026-07-15T20:30:00.000Z",
    playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 4, eventId: null },
    receipts: []
  });
  const assets = player.playState.inventory;
  return { assets, bytes: embedPortableVaultInPng(BASE_PNG, assets, player) };
}

const validVerification: DocumentVerifyResponse = {
  ok: true,
  kind: "png",
  errors: [],
  warnings: [],
  bundle: { artifactSha256Basis: PROOF_BASIS, signatureV4: SIGNATURE_V4 },
  assetContinuity: {
    state: "verified",
    carrier: "ownership_provenance",
    artifactId: "wildz-vault-artifact",
    headReference: "wildz-vault-head",
    issuerKid: "issuer-key-1",
    namespace: "receiz.wildz.vault:vault_keeper",
    ownerReceizId: "vault_keeper.receiz.id",
    priorHeadReference: "genesis"
  }
};

function setup(remoteInitial: WildzRemoteSession = {
  status: "unknown", actorId: null, profileHandle: null, displayName: null
}) {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({
    identityRepository: repository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault }
  });
  const pending = createWildzPendingVaultRepository({ database });
  let remote = remoteInitial;
  const coordinator = createWildzVaultLoginCoordinator({
    database,
    repository,
    codec,
    pending,
    verifier: { verifyArtifact: async () => validVerification },
    remote: { current: async () => remote }
  });
  return { database, repository, pending, coordinator, setRemote(value: WildzRemoteSession) { remote = value; } };
}

async function stageLegacyResume(target: ReturnType<typeof setup>, value = fixture()) {
  return target.pending.stage({
    surface: "genesis",
    bytes: value.bytes,
    mimeType: "image/png",
    name: "vault.png",
    player: { actorId: "vault_keeper", profileHandle: "vault_keeper.receiz.id" },
    proofBasisSha256: PROOF_BASIS
  });
}

test("a v103-verified V3 Vault immediately logs into its embedded player and restores all 98 cards without Connect", async () => {
  const value = fixture(98);
  const target = setup();
  const outcome = await target.coordinator.begin({
    surface: "genesis",
    bytes: value.bytes,
    mimeType: "image/png",
    name: "vault.receized.png"
  });
  assert.equal(outcome.status, "committed");
  if (outcome.status !== "committed") return;
  assert.equal(outcome.restore.session.actorId, "vault_keeper");
  assert.equal(outcome.restore.session.username, "vault_keeper");
  assert.equal(outcome.restore.session.localAuthority, "proof-sealed-vault");
  assert.equal(outcome.restore.session.remoteStatus, "unknown");
  assert.equal(outcome.restore.playState.inventory.length, 98);
  assert.deepEqual(
    outcome.restore.playState.inventory.map((asset) => asset.id).sort(),
    value.assets.map((asset) => asset.id).sort()
  );
  assert.deepEqual(outcome.restore.verifiedAssetIds, value.assets.map((asset) => asset.id).sort());
  assert.equal(target.database.dump().pendingRestores.length, 0);
  assert.deepEqual(await target.repository.active(), outcome.restore.session);
});

test("the same proof-backed Vault always uses one non-key owner scope and never fabricates private authority", async () => {
  const value = fixture();
  const first = setup();
  const second = setup();
  const firstOutcome = await first.coordinator.begin({ surface: "genesis", bytes: value.bytes, mimeType: "image/png", name: "vault.png" });
  const secondOutcome = await second.coordinator.begin({ surface: "genesis", bytes: value.bytes, mimeType: "image/png", name: "vault.png" });
  assert.equal(firstOutcome.status, "committed");
  assert.equal(secondOutcome.status, "committed");
  if (firstOutcome.status !== "committed" || secondOutcome.status !== "committed") return;
  assert.match(firstOutcome.restore.session.keyId, /^receiz_vault_[a-f0-9]{32,64}$/);
  assert.equal(secondOutcome.restore.session.keyId, firstOutcome.restore.session.keyId);
  assert.equal(first.database.dump().identities.length, 0);
  await assert.rejects(
    first.repository.withKeyFile(firstOutcome.restore.session.keyId, async () => undefined),
    /wildz_identity_not_found/
  );
});

test("different verified Vault artifacts carrying the same handle use different owner scopes", async () => {
  const first = setup();
  const second = setup();
  const firstOutcome = await first.coordinator.begin({
    surface: "genesis",
    bytes: fixture(9).bytes,
    mimeType: "image/png",
    name: "first-vault.png"
  });
  const secondOutcome = await second.coordinator.begin({
    surface: "genesis",
    bytes: fixture(10).bytes,
    mimeType: "image/png",
    name: "second-vault.png"
  });

  assert.equal(firstOutcome.status, "committed");
  assert.equal(secondOutcome.status, "committed");
  if (firstOutcome.status !== "committed" || secondOutcome.status !== "committed") return;
  assert.equal(firstOutcome.restore.session.actorId, secondOutcome.restore.session.actorId);
  assert.notEqual(firstOutcome.restore.session.keyId, secondOutcome.restore.session.keyId);
});

test("a standalone V3 Vault still authenticates its owner even when a local Identity label matches", async () => {
  const value = fixture();
  const database = createMemoryWildzContinuityDatabase();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "vault_keeper_uid", username: "vault_keeper", displayName: "Vault Keeper" },
    portableState: { schema: "receiz.account.state.v3", snapshot: { schema: "receiz.app.portable_bundle.v1", objects: [] } }
  });
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  const pending = createWildzPendingVaultRepository({ database });
  let verificationCalls = 0;
  const coordinator = createWildzVaultLoginCoordinator({
    database,
    repository,
    codec,
    pending,
    verifier: { verifyArtifact: async () => { verificationCalls += 1; return validVerification; } },
    remote: { current: async () => ({ status: "unknown", actorId: null, profileHandle: null, displayName: null }) }
  });
  const prepared = await repository.prepare(identity.keyFile);
  await database.transaction(["identities", "meta"], "readwrite", (tx) => repository.writePrepared(tx, prepared, true));
  const outcome = await coordinator.begin({ surface: "card-vault", bytes: value.bytes, mimeType: "image/png", name: null });
  assert.equal(outcome.status, "committed");
  if (outcome.status !== "committed") return;
  assert.equal(outcome.restore.session.username, "vault_keeper");
  assert.notEqual(outcome.restore.session.keyId, identity.keyFile.keyId);
  assert.equal(outcome.restore.session.localAuthority, "proof-sealed-vault");
  assert.equal(database.dump().ownerStates.length, 1);
  assert.equal(verificationCalls, 1);
});

test("a Wildz-saved V3 Vault restores locally for the matching active player when proof verification is unavailable", async () => {
  const value = fixture();
  const database = createMemoryWildzContinuityDatabase();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "vault_keeper_uid", username: "vault_keeper", displayName: "Vault Keeper" },
    portableState: { schema: "receiz.account.state.v3", snapshot: { schema: "receiz.app.portable_bundle.v1", objects: [] } }
  });
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  const pending = createWildzPendingVaultRepository({ database });
  let verificationCalls = 0;
  const coordinator = createWildzVaultLoginCoordinator({
    database,
    repository,
    codec,
    pending,
    verifier: { verifyArtifact: async () => { verificationCalls += 1; throw new Error("offline"); } },
    remote: { current: async () => ({ status: "unknown", actorId: null, profileHandle: null, displayName: null }) }
  });
  const prepared = await repository.prepare(identity.keyFile);
  await database.transaction(["identities", "meta"], "readwrite", (tx) => repository.writePrepared(tx, prepared, true));

  const outcome = await coordinator.begin({ surface: "card-vault", bytes: value.bytes, mimeType: "image/png", name: "wildz-saved-vault.png" });

  assert.equal(outcome.status, "committed");
  if (outcome.status !== "committed") return;
  assert.equal(outcome.restore.session.keyId, prepared.session.keyId);
  assert.equal(outcome.restore.session.localAuthority, "verified");
  assert.equal(outcome.restore.playState.worldMastery, 77);
  assert.deepEqual(outcome.restore.verifiedAssetIds, value.assets.map((asset) => asset.id).sort());
  assert.equal(verificationCalls, 1);
  assert.equal(database.dump().pendingRestores.length, 0);
});

test("a self-asserted local username cannot bypass Vault owner authentication", async () => {
  const value = fixture();
  const database = createMemoryWildzContinuityDatabase();
  const identity = await createReceizIdIdentity({ username: "vault_keeper", displayName: "Unbound Local Label" });
  const repository = createWildzIdentityRepository({ database, createIdentity: async () => identity });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  const coordinator = createWildzVaultLoginCoordinator({
    database,
    repository,
    codec,
    pending: createWildzPendingVaultRepository({ database }),
    verifier: { verifyArtifact: async () => validVerification },
    remote: { current: async () => ({ status: "unknown", actorId: null, profileHandle: null, displayName: null }) }
  });
  await repository.bootstrap();

  const outcome = await coordinator.begin({ surface: "genesis", bytes: value.bytes, mimeType: "image/png", name: "vault.png" });

  assert.equal(outcome.status, "committed");
  if (outcome.status !== "committed") return;
  assert.equal(outcome.restore.session.username, "vault_keeper");
  assert.notEqual(outcome.restore.session.keyId, identity.keyFile.keyId);
  assert.equal(outcome.restore.session.localAuthority, "proof-sealed-vault");
  assert.equal(database.dump().ownerStates.length, 1);
});

test("a previously staged verified Vault resumes as its embedded identity without external login", async () => {
  const value = fixture(98);
  const target = setup();
  const staged = await stageLegacyResume(target, value);

  const resumed = await target.coordinator.resume(staged.resumeId);

  assert.equal(resumed.status, "committed");
  if (resumed.status !== "committed") return;
  assert.equal(resumed.restore.session.actorId, "vault_keeper");
  assert.equal(resumed.restore.session.localAuthority, "proof-sealed-vault");
  assert.equal(resumed.restore.playState.inventory.length, 98);
  assert.equal(target.database.dump().pendingRestores.length, 0);
});

test("a matching legacy browser session cannot replace the Vault's own proof authority", async () => {
  const value = fixture();
  const target = setup();
  await target.repository.bootstrap();
  const staged = await stageLegacyResume(target, value);
  target.setRemote({
    status: "connected",
    subjectKey: "a".repeat(64),
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    displayName: "Vault Keeper"
  });
  const resumed = await target.coordinator.resume(staged.resumeId);
  assert.equal(resumed.status, "committed");
  if (resumed.status !== "committed") return;
  assert.equal(resumed.restore.session.actorId, "vault_keeper");
  assert.match(resumed.restore.session.keyId, /^receiz_vault_[a-f0-9]{32,64}$/);
  assert.equal(resumed.restore.session.username, "vault_keeper");
  assert.equal(resumed.restore.session.localAuthority, "proof-sealed-vault");
  assert.equal(resumed.restore.session.remoteStatus, "connected");
  assert.equal(resumed.restore.playState.inventory.length, value.assets.length);
  assert.deepEqual(resumed.restore.verifiedAssetIds, value.assets.map((asset) => asset.id).sort());
  assert.equal(target.database.dump().pendingRestores.length, 0);
  assert.equal(target.database.dump().identities.length, 1, "remote login must not fabricate a second private identity");
  await assert.rejects(
    target.repository.withKeyFile(resumed.restore.session.keyId, async () => undefined),
    /wildz_identity_not_found/
  );
  await assert.rejects(target.coordinator.resume(staged.resumeId), /wildz_restore_resume_missing/);
});

test("a successful atomic commit does not depend on a second database read", async () => {
  const value = fixture();
  const target = setup();
  await target.repository.bootstrap();
  const staged = await stageLegacyResume(target, value);
  target.setRemote({
    status: "connected",
    subjectKey: "b".repeat(64),
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    displayName: "Vault Keeper"
  });
  target.database.read = async () => {
    throw new Error("post_commit_read_unavailable");
  };

  const resumed = await target.coordinator.resume(staged.resumeId);

  assert.equal(resumed.status, "committed");
  if (resumed.status === "committed") assert.equal(resumed.restore.playState.inventory.length, value.assets.length);
});

test("a foreign browser session cannot block the identity authenticated by a verified Vault", async () => {
  const value = fixture();
  const target = setup();
  await target.repository.bootstrap();
  const staged = await stageLegacyResume(target, value);
  target.setRemote({ status: "connected", subjectKey: "c".repeat(64), actorId: "other_player", profileHandle: "other_player.receiz.id", displayName: "Other" });
  const restored = await target.coordinator.resume(staged.resumeId);
  assert.equal(restored.status, "committed");
  assert.equal(restored.restore.session.actorId, "vault_keeper");
  assert.equal(restored.restore.session.localAuthority, "proof-sealed-vault");
  assert.deepEqual(await target.repository.active(), restored.restore.session);
  assert.equal(target.database.dump().pendingRestores.length, 0);
  assert.equal(target.database.dump().ownerStates.length, 1);
});

test("a failed direct Vault commit retains staged bytes without partial owner mutation", async () => {
  const value = fixture();
  const target = setup();
  const prior = await target.repository.bootstrap();
  const staged = await stageLegacyResume(target, value);
  target.database.failNextTransactionAfterPuts(2, new Error("injected_atomic_failure"));
  await assert.rejects(target.coordinator.resume(staged.resumeId), /wildz_restore_storage_failed/);
  assert.deepEqual(await target.repository.active(), prior);
  assert.equal(target.database.dump().pendingRestores.length, 1);
  assert.equal(target.database.dump().ownerStates.length, 0);
});

test("a different connected account cannot override the identity embedded in an uploaded Vault", async () => {
  const value = fixture();
  const target = setup({
    status: "connected",
    subjectKey: "f".repeat(64),
    actorId: "other_player",
    profileHandle: "other_player.receiz.id",
    displayName: "Other Player"
  });

  const outcome = await target.coordinator.begin({
    surface: "genesis",
    bytes: value.bytes,
    mimeType: "image/png",
    name: "vault.png"
  });

  assert.equal(outcome.status, "committed");
  if (outcome.status !== "committed") return;
  assert.equal(outcome.restore.session.actorId, "vault_keeper");
  assert.equal(outcome.restore.session.username, "vault_keeper");
  assert.equal(outcome.restore.session.remoteStatus, "unavailable");
  assert.match(outcome.restore.session.keyId, /^receiz_vault_[a-f0-9]{32,64}$/);
  assert.deepEqual(await target.repository.active(), outcome.restore.session);
  assert.equal(outcome.restore.playState.inventory.length, value.assets.length);
});

test("a cross-platform Receiz Commerce Vault restores its embedded player identity and all 98 cards", async () => {
  const value = fixture(98);
  const commerceBytes = await createReceizCommercePlayerVaultFixture(value.assets, createWildsPlayerVault({
    playerId: "vault_keeper.receiz.id",
    exportedAt: "2026-07-15T20:30:00.000Z",
    playState: value.assets.reduce<PlayState>(
      (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
      { ...structuredClone(initialPlayState), inventory: [], discoveredCardIds: [], pendingSyncAssetIds: [], companionProgress: {}, livingProgress: {}, selectedAssetId: "", selectedCardId: "", worldMastery: 98 }
    ),
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 8, eventId: null },
    receipts: []
  }));
  const target = setup({
    status: "connected",
    subjectKey: "e".repeat(64),
    actorId: "vault_keeper",
    profileHandle: "vault_keeper.receiz.id",
    displayName: "Vault Keeper"
  });
  await target.repository.bootstrap();

  const restored = await target.coordinator.begin({
    surface: "genesis",
    bytes: commerceBytes,
    mimeType: "application/vnd.receiz.vault+zip",
    name: "commerce-continuity.receizvault"
  });

  assert.equal(restored.status, "committed");
  if (restored.status !== "committed") return;
  assert.equal(restored.restore.session.actorId, "vault_keeper");
  assert.equal(restored.restore.playState.inventory.length, 98);
  assert.deepEqual(restored.restore.verifiedAssetIds, value.assets.map((asset) => asset.id).sort());
  assert.equal(restored.restore.artifactKind, "commerce-vault");
});

test("an existing Commerce Vault logs in through v109 verified-legacy-read compatibility", async () => {
  const value = fixture(12);
  const player = createWildsPlayerVault({
    playerId: "vault_keeper.receiz.id",
    exportedAt: "2026-07-15T20:30:00.000Z",
    playState: value.assets.reduce<PlayState>(
      (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
      { ...structuredClone(initialPlayState), inventory: [], discoveredCardIds: [], pendingSyncAssetIds: [], companionProgress: {}, livingProgress: {}, selectedAssetId: "", selectedCardId: "" }
    ),
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 2, eventId: null },
    receipts: []
  });
  const bytes = await createReceizCommercePlayerVaultFixture(value.assets, player);
  const artifactSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  let opened = 0;
  const verifier = {
    verifyArtifact: async () => { throw new Error("legacy_document_verifier_must_not_run"); },
    openArtifact: async () => {
      opened += 1;
      return {
        artifactBytes: bytes,
        artifactSha256,
        payloadBytes: bytes,
        payloadSha256: artifactSha256,
        filename: "existing.receizvault",
        mimeType: "application/vnd.receiz.vault+zip",
        ownerReceizId: player.playerId,
        claimId: "legacy-commerce-claim",
        verifyPath: "/v/legacy-commerce-claim",
        recordId: null,
        compatibility: "verified-legacy-read" as const
      };
    }
  } satisfies WildzProofArtifactVerifier;
  const coordinator = createWildzVaultLoginCoordinator({
    database,
    repository,
    codec,
    pending: createWildzPendingVaultRepository({ database }),
    verifier,
    remote: { current: async () => ({ status: "unknown", actorId: null, profileHandle: null, displayName: null }) }
  });
  await repository.bootstrap();

  const restored = await coordinator.begin({
    surface: "genesis",
    bytes,
    mimeType: "application/vnd.receiz.vault+zip",
    name: "existing.receizvault"
  });

  assert.equal(restored.status, "committed");
  if (restored.status !== "committed") return;
  assert.equal(opened, 1);
  assert.equal(restored.restore.session.actorId, "vault_keeper");
  assert.equal(restored.restore.playState.inventory.length, value.assets.length);
});

test("an SDK-verified Identity Seal logs into its embedded identity and player without requiring OIDC", async () => {
  const value = fixture();
  const playState = value.assets.reduce<PlayState>(
    (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
    { ...structuredClone(initialPlayState), inventory: [], discoveredCardIds: [], pendingSyncAssetIds: [], companionProgress: {}, livingProgress: {}, selectedAssetId: "", selectedCardId: "", worldMastery: 64 }
  );
  const player = createWildsPlayerVault({
    playerId: "vault_keeper.receiz.id",
    exportedAt: "2026-07-15T20:30:00.000Z",
    playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 3, eventId: null },
    receipts: []
  });
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "vault_keeper_uid", username: "vault_keeper", displayName: "Vault Keeper" },
    portableState: {
      schema: "receiz.account.state.v3",
      snapshot: { schema: "receiz.app.portable_bundle.v1", objects: [player] }
    }
  });
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: { inspect: inspectReceizCommerceVault } });
  let verifierCalls = 0;
  const coordinator = createWildzVaultLoginCoordinator({
    database,
    repository,
    codec,
    pending: createWildzPendingVaultRepository({ database }),
    verifier: { verifyArtifact: async () => { verifierCalls += 1; throw new Error("identity_seal_must_use_local_sdk_authority"); } },
    remote: { current: async () => ({ status: "unknown", actorId: null, profileHandle: null, displayName: null }) }
  });
  await repository.bootstrap();

  const restored = await coordinator.begin({
    surface: "genesis",
    bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(identity.keyFile)),
    mimeType: "application/json",
    name: "vault-keeper.receiz-key.json"
  });

  assert.equal(restored.status, "committed");
  if (restored.status !== "committed") return;
  assert.equal(restored.restore.session.username, "vault_keeper");
  assert.equal(restored.restore.session.localAuthority, "verified");
  assert.equal(restored.restore.playState.inventory.length, value.assets.length);
  assert.equal(restored.restore.playState.worldMastery, 64);
  assert.equal(verifierCalls, 0);
});
