import assert from "node:assert/strict";
import { test } from "node:test";
import type { DocumentVerifyResponse } from "@receiz/sdk";
import { applyWildsInput, initialPlayState, type PlayState } from "../src/features/play/game-state";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import { createWildzArtifactCodec } from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { verifyProofSealedWildzVault } from "../src/lib/receiz/wildz-proof-sealed-vault";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));
const PROOF_BASIS = "b".repeat(64);

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

function fixture(count = 5) {
  const captured = Array.from({ length: count }, (_, index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "vault_keeper",
    encounterId: `proof-sealed-${index}`,
    capturedAt: new Date(Date.UTC(2026, 6, 15, 18, index)).toISOString()
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
  const player = createWildsPlayerVault({
    playerId: "vault_keeper.receiz.id",
    exportedAt: "2026-07-15T19:00:00.000Z",
    playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  const assets = player.playState.inventory;
  return { assets, bytes: embedPortableVaultInPng(BASE_PNG, assets, player) };
}

function codec() {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  return createWildzArtifactCodec({
    identityRepository: repository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault }
  });
}

function verification(overrides: Partial<DocumentVerifyResponse> = {}): DocumentVerifyResponse {
  return {
    ok: true,
    kind: "png",
    errors: [],
    warnings: [],
    bundle: {
      artifactSha256Basis: PROOF_BASIS,
      signatureV4: SIGNATURE_V4
    },
    assetContinuity: {
      state: "verified",
      carrier: "ownership_provenance",
      artifactId: "wildz-vault-artifact",
      headReference: "wildz-vault-head",
      issuerKid: "issuer-key-1",
      namespace: "receiz.wildz.vault:vault_keeper",
      ownerReceizId: "vault_keeper.receiz.id",
      priorHeadReference: "genesis"
    },
    ...overrides
  };
}

test("proof-sealed V3 verification requires v103-compatible continuity, full-byte Signature V4, and exact local player/card proofs", async () => {
  const value = fixture();
  let verifiedSize = 0;
  const result = await verifyProofSealedWildzVault({
    bytes: value.bytes,
    mimeType: "image/png",
    name: "vault.receized.png",
    codec: codec(),
    verifier: {
      async verifyArtifact(blob) {
        verifiedSize = blob.size;
        return verification();
      }
    }
  });

  assert.equal(verifiedSize, value.bytes.byteLength);
  assert.equal(result.proofBasisSha256, PROOF_BASIS);
  assert.equal(result.player.actorId, "vault_keeper");
  assert.equal(result.player.profileHandle, "vault_keeper.receiz.id");
  assert.deepEqual(result.assets.map((asset) => asset.id).sort(), value.assets.map((asset) => asset.id).sort());
  assert.equal(result.byteDigestSha256.length, 64);
});

test("missing Signature V4, V4 errors, and invalid V3 bytes all fail before admission", async () => {
  const value = fixture();
  await assert.rejects(verifyProofSealedWildzVault({
    bytes: value.bytes,
    mimeType: "image/png",
    codec: codec(),
    verifier: { verifyArtifact: async () => verification({ bundle: { artifactSha256Basis: PROOF_BASIS } }) }
  }), /wildz_restore_v4_invalid/);
  await assert.rejects(verifyProofSealedWildzVault({
    bytes: value.bytes,
    mimeType: "image/png",
    codec: codec(),
    verifier: { verifyArtifact: async () => verification({
      bundle: { artifactSha256Basis: PROOF_BASIS, signatureV4: { version: 4 } }
    }) }
  }), /wildz_restore_v4_invalid/);
  await assert.rejects(verifyProofSealedWildzVault({
    bytes: value.bytes,
    mimeType: "image/png",
    codec: codec(),
    verifier: { verifyArtifact: async () => verification({ ok: false, errors: ["signature_invalid"] }) }
  }), /wildz_restore_v4_invalid/);

  const tampered = value.bytes.slice();
  tampered[20] = (tampered[20]! ^ 1) & 0xff;
  await assert.rejects(verifyProofSealedWildzVault({
    bytes: tampered,
    mimeType: "image/png",
    codec: codec(),
    verifier: { verifyArtifact: async () => verification() }
  }), /wildz_restore_/);
});

test("historical-missing, incomplete, or differently owned continuity never authenticates a Vault", async () => {
  const value = fixture();
  for (const assetContinuity of [
    undefined,
    { ...verification().assetContinuity!, state: "historical_missing" as const },
    { ...verification().assetContinuity!, ownerReceizId: "other_keeper.receiz.id" },
    { ...verification().assetContinuity!, namespace: "" }
  ]) {
    await assert.rejects(verifyProofSealedWildzVault({
      bytes: value.bytes,
      mimeType: "image/png",
      codec: codec(),
      verifier: { verifyArtifact: async () => verification({ assetContinuity }) }
    }), /wildz_restore_v4_(?:invalid|binding_mismatch)/);
  }
});
