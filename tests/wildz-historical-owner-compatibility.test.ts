import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendReceizIdentityArtifactTrailerToPng,
  createReceizIdentityKeyFile,
  type DocumentVerifyResponse,
  type ReceizOpenedArtifact,
  type ReceizProofObjectCreateInput,
  type ReceizSealedArtifact
} from "@receiz/sdk";
import {
  embedPortableVaultInPng,
  readPortableVaultFromPng
} from "../src/features/play/card-export";
import { initialPlayState, type PlayState } from "../src/features/play/game-state";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import {
  canonicalPortableCardJson,
  evolvePortableCard,
  sealCollectedCard,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "../src/features/play/portable-card";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import { createWildzArtifactCodec } from "../src/lib/receiz/wildz-artifact-codec";
import { extractVerifiedWildzCards } from "../src/lib/receiz/wildz-cross-platform-cards";
import {
  appendWildzIdentityBindingTrailer,
  createWildzIdentityBinding,
  requireWildzIdentityBindingFromEnvelope
} from "../src/lib/receiz/wildz-identity-binding";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createWildzExportProofObject } from "../src/lib/receiz/wildz-proof-object-export";
import { verifyProofSealedWildzVault } from "../src/lib/receiz/wildz-proof-sealed-vault";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));
const ACTOR_ID = "current_keeper";
const ACTOR_PROFILE = "current_keeper.receiz.id";
const SIGNATURE_V4 = {
  version: 1,
  alg: "Ed25519",
  cert: {
    version: 1,
    certType: "receiz.device.v1",
    certId: "historical-owner-device-cert",
    issuerKid: "historical-owner-issuer",
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

function historicalCards(): PortableCardAsset[] {
  return ["origin_alpha.receiz.id", "origin_beta.receiz.id"].map((ownerReceizId, index) =>
    sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId,
      encounterId: `historical-owner-${index}`,
      capturedAt: new Date(Date.UTC(2026, 6, 15, 18, index)).toISOString()
    })
  );
}

function playerVault(assets: readonly PortableCardAsset[], playerId = ACTOR_PROFILE) {
  const playState: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: assets.map((asset) => structuredClone(asset)),
    discoveredCardIds: [],
    pendingSyncAssetIds: [],
    companionProgress: {},
    livingProgress: {},
    selectedAssetId: assets[0]?.id ?? "",
    selectedCardId: ""
  };
  return createWildsPlayerVault({
    playerId,
    exportedAt: "2026-07-15T19:00:00.000Z",
    playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
}

function historicalVaultPng(playerId = ACTOR_PROFILE) {
  const player = playerVault(historicalCards(), playerId);
  return {
    player,
    bytes: embedPortableVaultInPng(BASE_PNG, player.playState.inventory, player)
  };
}

function codec() {
  const database = createMemoryWildzContinuityDatabase();
  return createWildzArtifactCodec({
    identityRepository: createWildzIdentityRepository({ database }),
    commerceVaultReader: { inspect: inspectReceizCommerceVault }
  });
}

function v103Verification(): DocumentVerifyResponse {
  return {
    ok: true,
    kind: "png",
    errors: [],
    warnings: [],
    bundle: {
      artifactSha256Basis: "c".repeat(64),
      signatureV4: SIGNATURE_V4
    },
    assetContinuity: {
      state: "verified",
      carrier: "ownership_provenance",
      artifactId: "historical-owner-vault-artifact",
      headReference: "historical-owner-vault-head",
      issuerKid: "historical-owner-issuer",
      namespace: "receiz.wildz.vault:current_keeper",
      ownerReceizId: ACTOR_PROFILE,
      priorHeadReference: "genesis"
    }
  };
}

async function fakeCreateResult(input: ReceizProofObjectCreateInput): Promise<ReceizSealedArtifact> {
  const claimId = "historical-owner-export-claim";
  const verifyPath = `/v/${claimId}`;
  const artifact = new Blob([input.payload.bytes.slice().buffer], { type: "application/vnd.receiz.artifact" });
  const artifactSha256 = Buffer.from(await crypto.subtle.digest("SHA-256", input.payload.bytes.slice().buffer)).toString("hex");
  return {
    kind: "receiz.native-record-seal",
    artifact,
    filename: "historical-owner-vault.receiz",
    mimeType: artifact.type,
    artifactSha256,
    payloadSha256: artifactSha256,
    verification: {
      ok: true,
      kind: "png",
      integrity: { ok: true, errors: [] },
      errors: [],
      warnings: [],
      bundle: { receizClaimId: claimId, verifyPath }
    },
    continuity: {
      ownerReceizId: ACTOR_PROFILE,
      recordId: "record:historical-owner:v108",
      claimId,
      verifyPath,
      carrier: "native-record-seal",
      signatureVersion: 4
    }
  } as unknown as ReceizSealedArtifact;
}

function fakeArtifactPort(artifact: ReceizSealedArtifact, payload: Uint8Array) {
  return {
    async download() {
      return { ok: true as const, filename: artifact.filename, mimeType: artifact.mimeType, size: artifact.artifact.size, artifactSha256: artifact.artifactSha256 };
    },
    async verifyAndOpen() {
      return {
        sealedArtifact: artifact,
        verifiedPayload: { bytes: payload.slice(), filename: "historical-owner-vault.png", mimeType: "image/png", sha256: artifact.payloadSha256 },
        verification: artifact.verification,
        legacyCompatibility: "current-native"
      } as unknown as ReceizOpenedArtifact;
    }
  };
}

test("a valid living admission supersedes its exact legacy ancestor while unrelated same-ID proofs remain conflicts", () => {
  const legacy = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "lineage_keeper.receiz.id",
    encounterId: "shared-stable-id",
    capturedAt: "2026-07-15T18:00:00.000Z"
  });
  const living = admitLegacyCard(legacy, "2026-07-15T18:05:00.000Z");
  assert.equal(living.id, legacy.id);
  assert.equal(living.manifest.birth.legacyDigest, legacy.proof.digest);

  const restored = extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: [legacy, { nested: { admission: living } }],
    restoredVaultFiles: []
  });
  assert.equal(restored.assets.length, 1);
  assert.equal(isLivingCardAsset(restored.assets[0]!), true);
  assert.equal(restored.assets[0]?.proof.digest, living.proof.digest);

  const unrelated = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: legacy.manifest.ownerReceizId,
    encounterId: legacy.manifest.encounterId,
    capturedAt: "2026-07-15T18:10:00.000Z"
  });
  assert.equal(unrelated.id, legacy.id);
  assert.equal(verifyAnyWildsCard(unrelated).ok, true);
  assert.throws(() => extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: [legacy, { nested: unrelated }],
    restoredVaultFiles: []
  }), /wildz_restore_duplicate_card_conflict/);
});

test("an exact duplicate card is dropped without failing the Vault import", () => {
  const card = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "duplicate_keeper.receiz.id",
    encounterId: "exact-duplicate-card",
    capturedAt: "2026-07-15T18:20:00.000Z"
  });

  const restored = extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: [card, structuredClone(card), { nested: structuredClone(card) }],
    restoredVaultFiles: []
  });

  assert.equal(restored.assets.length, 1);
  assert.equal(restored.assets[0]?.id, card.id);
  assert.equal(restored.assets[0]?.proof.digest, card.proof.digest);
});

test("the newest verified living revision wins in either order while a divergent revision fork fails", () => {
  const legacy = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "revision_keeper.receiz.id",
    encounterId: "living-revision-chain",
    capturedAt: "2026-07-15T18:30:00.000Z"
  });
  const stageTwo = evolvePortableCard({
    previous: legacy,
    nextFormId: "mintcub-2",
    evolvedAt: "2026-07-15T18:35:00.000Z"
  });
  const stageThree = evolvePortableCard({
    previous: stageTwo,
    nextFormId: "mintcub-3",
    evolvedAt: "2026-07-15T18:40:00.000Z"
  });

  for (const cards of [[stageTwo, stageThree], [stageThree, stageTwo]]) {
    const restored = extractVerifiedWildzCards({
      pngBasis: null,
      verifiedPortableSnapshot: cards,
      restoredVaultFiles: []
    });
    assert.equal(restored.assets.length, 1);
    assert.equal(restored.assets[0]?.proof.digest, stageThree.proof.digest);
  }

  const divergentStageTwo = evolvePortableCard({
    previous: legacy,
    nextFormId: "mintcub-2",
    evolvedAt: "2026-07-15T18:36:00.000Z"
  });
  assert.throws(() => extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: [stageTwo, divergentStageTwo],
    restoredVaultFiles: []
  }), /wildz_restore_duplicate_card_conflict/);

  const rewrittenOrigin = structuredClone(stageThree);
  rewrittenOrigin.manifest.ownerReceizId = "rewritten_origin.receiz.id";
  rewrittenOrigin.proof.digest = sha256PortableBasis(canonicalPortableCardJson(rewrittenOrigin.manifest));
  assert.equal(verifyAnyWildsCard(rewrittenOrigin).ok, true, "control must remain individually well-formed");
  assert.throws(() => extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: [stageTwo, rewrittenOrigin],
    restoredVaultFiles: []
  }), /wildz_restore_duplicate_card_conflict/);
});

test("verified v103 whole-Vault continuity authenticates its player without rewriting historical card provenance", async () => {
  const value = historicalVaultPng();
  const historicalOwners = new Set(value.player.playState.inventory.map((asset) => asset.manifest.ownerReceizId));
  assert.deepEqual(historicalOwners, new Set(["origin_alpha.receiz.id", "origin_beta.receiz.id"]));
  assert.equal(value.player.playState.inventory.every((asset) => verifyAnyWildsCard(asset).ok), true);

  const restored = await verifyProofSealedWildzVault({
    bytes: value.bytes,
    mimeType: "image/png",
    name: "historical-owner-vault.receized.png",
    codec: codec(),
    verifier: { verifyArtifact: async () => v103Verification() }
  });

  assert.equal(restored.player.actorId, ACTOR_ID);
  assert.equal(restored.player.profileHandle, ACTOR_PROFILE);
  assert.deepEqual(
    new Set(restored.assets.map((asset) => asset.manifest.ownerReceizId)),
    historicalOwners
  );
});

test("an exact identity binding admits a player-owned Vault whose cards retain historical owners", async () => {
  const value = historicalVaultPng();
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "current_keeper_uid", username: ACTOR_ID, displayName: "Current Keeper" },
    portableState: null
  });
  const proof = readPortableVaultFromPng(value.bytes);
  const withIdentity = appendReceizIdentityArtifactTrailerToPng(value.bytes, identity.keyFile);
  const binding = await createWildzIdentityBinding({
    keyFile: identity.keyFile,
    playerId: value.player.playerId,
    vaultDigest: proof.vaultDigest,
    playerPayloadDigest: value.player.payloadDigest,
    signedAt: "2026-07-15T19:05:00.000Z"
  });

  const verified = await requireWildzIdentityBindingFromEnvelope(
    appendWildzIdentityBindingTrailer(withIdentity, binding)
  );
  assert.equal(verified.playerId, value.player.playerId);
  assert.equal(verified.vaultDigest, proof.vaultDigest);
  assert.equal(verified.playerPayloadDigest, value.player.payloadDigest);
});

test("identity binding still rejects signed vault- and player-digest splices", async () => {
  const actorOwned = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: ACTOR_PROFILE,
    encounterId: "exact-binding-owner-card",
    capturedAt: "2026-07-15T19:10:00.000Z"
  });
  const player = playerVault([actorOwned]);
  const bytes = embedPortableVaultInPng(BASE_PNG, player.playState.inventory, player);
  const proof = readPortableVaultFromPng(bytes);
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "current_keeper_uid", username: ACTOR_ID, displayName: "Current Keeper" },
    portableState: null
  });
  const withIdentity = appendReceizIdentityArtifactTrailerToPng(bytes, identity.keyFile);

  for (const digests of [
    { vaultDigest: `sha256:${"d".repeat(64)}`, playerPayloadDigest: player.payloadDigest },
    { vaultDigest: proof.vaultDigest, playerPayloadDigest: `sha256:${"e".repeat(64)}` }
  ]) {
    const binding = await createWildzIdentityBinding({
      keyFile: identity.keyFile,
      playerId: player.playerId,
      ...digests,
      signedAt: "2026-07-15T19:15:00.000Z"
    });
    await assert.rejects(
      requireWildzIdentityBindingFromEnvelope(appendWildzIdentityBindingTrailer(withIdentity, binding)),
      /wildz_restore_binding_invalid/
    );
  }
});

test("v103 native Vault export accepts historical card provenance when the embedded player is the authenticated actor", async () => {
  const value = historicalVaultPng();
  let creatorCalls = 0;
  let issued: ReceizSealedArtifact | null = null;
  const created = await createWildzExportProofObject({
    actor: {
      actorId: ACTOR_ID,
      profileHandle: ACTOR_PROFILE,
      receizUserId: "receiz-user-current-keeper"
    },
    bytes: value.bytes,
    filename: "historical-owner-vault.png",
    kind: "vault",
    async createProofObject(input) {
      creatorCalls += 1;
      issued = await fakeCreateResult(input);
      return issued;
    },
    artifacts: {
      async download(artifact) { return fakeArtifactPort(artifact, value.bytes).download(); },
      async verifyAndOpen() {
        if (!issued) throw new Error("artifact_missing");
        return fakeArtifactPort(issued, value.bytes).verifyAndOpen();
      }
    }
  });

  assert.equal(creatorCalls, 1);
  assert.equal(created.admitted.ownerReceizId, ACTOR_PROFILE);
  assert.equal(created.admitted.compatibility, "current-native");
  assert.deepEqual(created.admitted.artifactBytes, value.bytes);
});

test("v103 native Vault export still rejects an embedded player that differs from the authenticated actor", async () => {
  const value = historicalVaultPng("other_keeper.receiz.id");
  let creatorCalls = 0;
  await assert.rejects(createWildzExportProofObject({
    actor: {
      actorId: ACTOR_ID,
      profileHandle: ACTOR_PROFILE,
      receizUserId: "receiz-user-current-keeper"
    },
    bytes: value.bytes,
    filename: "mismatched-player-vault.png",
    kind: "vault",
    async createProofObject(input) {
      creatorCalls += 1;
      return fakeCreateResult(input);
    },
    artifacts: { download: async () => { throw new Error("not_called"); }, verifyAndOpen: async () => { throw new Error("not_called"); } }
  }), /wildz_proof_object_owner_mismatch/);
  assert.equal(creatorCalls, 0);
});
