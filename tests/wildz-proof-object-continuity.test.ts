import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendReceizIdentityArtifactTrailerToPng,
  createReceizIdentityKeyFile,
  type DocumentVerifyResponse
} from "@receiz/sdk";
import { applyWildsInput, initialPlayState, type PlayState } from "../src/features/play/game-state";
import {
  embedPortableVaultInPng,
  readPortableVaultFromPng
} from "../src/features/play/card-export";
import { createWildsPlayerVault, type WildsPlayerVaultPayload } from "../src/features/play/wilds-player-vault";
import {
  canonicalPortableCardJson,
  sealCollectedCard,
  type PortableCardAsset
} from "../src/features/play/portable-card";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import { createWildzArtifactCodec } from "../src/lib/receiz/wildz-artifact-codec";
import {
  appendWildzIdentityBindingTrailer,
  createWildzIdentityBinding,
  readWildzIdentityBindingFromEnvelope,
  requireWildzIdentityBindingFromEnvelope
} from "../src/lib/receiz/wildz-identity-binding";
import { createWildzIdentityBoundPlayerVault } from "../src/lib/receiz/wildz-identity-adapter";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import {
  createLegacyReceizPortableAssetDocument,
  serializeLegacyReceizPortableAssetDocument
} from "../src/lib/receiz/legacy-receiz-portable-asset";
import { createWildzPendingVaultRepository } from "../src/lib/receiz/wildz-pending-vault";
import { verifyProofSealedWildzVault } from "../src/lib/receiz/wildz-proof-sealed-vault";
import { createWildzVaultLoginCoordinator } from "../src/lib/receiz/wildz-vault-login-coordinator";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));
const SIGNATURE_V4 = {
  version: 1,
  alg: "Ed25519",
  cert: {
    version: 1,
    certType: "receiz.device.v1",
    certId: "proof-object-device-cert",
    issuerKid: "proof-object-issuer",
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

function strictArrayBuffer(bytes: Uint8Array) {
  return bytes.slice().buffer;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", strictArrayBuffer(bytes)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cards(count: number, owner = "proof_keeper") {
  return Array.from({ length: count }, (_, index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: owner,
    encounterId: `proof-object-continuity-${String(index).padStart(3, "0")}`,
    capturedAt: new Date(Date.UTC(2026, 6, 15, 21, Math.floor(index / 60), index % 60)).toISOString()
  }));
}

function playerWith(assets: readonly PortableCardAsset[], owner = "proof_keeper.receiz.id", exportedAt = "2026-07-15T22:00:00.000Z") {
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
  const playState = assets.reduce<PlayState>(
    (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
    empty
  );
  playState.worldMastery = assets.length;
  return createWildsPlayerVault({
    playerId: owner,
    exportedAt,
    playState,
    settings: { avatarStyle: "female", movementMode: "run", audio: { music: true } },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 9, eventId: null },
    receipts: []
  });
}

type ProofObjectFixture = {
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload;
  bytes: Uint8Array;
  artifactBasisSha256: string;
  claimId: string;
};

async function proofObjectFixture(options: {
  count?: number;
  documentOwner?: string;
  payload?: unknown;
  claimId?: string;
} = {}): Promise<ProofObjectFixture> {
  const captured = cards(options.count ?? 98);
  const player = playerWith(captured);
  const expected = player.playState.inventory;
  const payload = options.payload ?? {
    schema: "receiz.app.portable_bundle.v1",
    objects: [player, structuredClone(expected[17]!), { schema: "receiz.wallet.note.v1", id: "ignored-note" }]
  };
  const payloadBytes = new TextEncoder().encode(canonicalPortableCardJson(payload));
  const document = await createLegacyReceizPortableAssetDocument({
    assetType: "proof_object",
    payload: { mimeType: "application/json", bytes: payloadBytes },
    ownership: {
      ownerReceizId: options.documentOwner ?? "proof_keeper.receiz.id",
      custody: "current",
      proofRef: "wildz-proof-object-genesis"
    },
    provenance: {
      root: "wildz-proof-object-genesis",
      appends: [{ schema: "receiz.wilds.v3_append.v1", sequence: 1, count: expected.length }]
    },
    settlement: { state: "none", primitive: "wildz-player-vault" }
  });
  const originalBytes = serializeLegacyReceizPortableAssetDocument(document);
  const artifactBasisSha256 = await sha256Hex(originalBytes);
  const claimId = options.claimId ?? "wildz-proof-object-claim";
  const bytes = new TextEncoder().encode(JSON.stringify({
    kind: "receiz.bundle.v1",
    originalBase64: Buffer.from(originalBytes).toString("base64url"),
    manifest: { basisSha256: artifactBasisSha256 },
    proofbundle: { artifactSha256Basis: artifactBasisSha256, receizClaimId: claimId }
  }));
  return { assets: expected, player, bytes, artifactBasisSha256, claimId };
}

function codec() {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  return createWildzArtifactCodec({
    identityRepository: repository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault }
  });
}

function verification(
  value: Pick<ProofObjectFixture, "artifactBasisSha256" | "claimId">,
  continuityOverrides: Partial<NonNullable<DocumentVerifyResponse["assetContinuity"]>> = {}
): DocumentVerifyResponse {
  return {
    ok: true,
    kind: "bundle",
    errors: [],
    warnings: [],
    bundle: {
      artifactSha256Basis: value.artifactBasisSha256,
      receizClaimId: value.claimId,
      signatureV4: SIGNATURE_V4
    },
    assetContinuity: {
      state: "verified",
      carrier: "portable_asset",
      artifactId: "wildz-proof-object-artifact",
      headReference: "wildz-proof-object-head",
      issuerKid: "proof-object-issuer",
      namespace: "wildz-proof-object-genesis",
      ownerReceizId: "proof_keeper.receiz.id",
      priorHeadReference: "wildz-proof-object-genesis",
      ...continuityOverrides
    }
  };
}

test("SDK v102 proof objects recover the owner-bound player and all 98 cards only after verified continuity and exact V4 verification", async () => {
  const value = await proofObjectFixture();
  const inspected = await codec().inspect({
    bytes: value.bytes,
    mimeType: "application/vnd.receiz.bundle+json",
    name: "wildz-proof-object.receizbundle"
  });

  assert.equal(inspected.kind, "card-vault");
  if (inspected.kind !== "card-vault") return;
  assert.equal(inspected.assets.length, 98);
  assert.equal(inspected.player?.payloadDigest, value.player.payloadDigest);
  assert.equal(inspected.playerBinding, "artifact-v4-required");
  assert.equal(inspected.proofObject?.ownerReceizId, "proof_keeper.receiz.id");
  assert.equal(inspected.proofObject?.artifactBasisSha256, value.artifactBasisSha256);
  assert.equal(inspected.proofObject?.provenanceRoot, "wildz-proof-object-genesis");

  let verifiedBytes = 0;
  const admitted = await verifyProofSealedWildzVault({
    bytes: value.bytes,
    mimeType: "application/vnd.receiz.bundle+json",
    name: "wildz-proof-object.receizbundle",
    codec: codec(),
    verifier: {
      async verifyArtifact(blob) {
        verifiedBytes = blob.size;
        return verification(value);
      }
    }
  });
  assert.equal(verifiedBytes, value.bytes.byteLength);
  assert.equal(admitted.assets.length, 98);
  assert.equal(admitted.player.profileHandle, "proof_keeper.receiz.id");
  assert.equal(admitted.proofBasisSha256, value.artifactBasisSha256);
});

test("v102 continuity fails owner, payload, claim, and server-basis splices closed", async () => {
  const wrongOwner = await proofObjectFixture({ documentOwner: "other_keeper.receiz.id" });
  const ownerInspection = await codec().inspect({
    bytes: wrongOwner.bytes,
    mimeType: "application/vnd.receiz.bundle+json"
  });
  assert.equal(ownerInspection.kind, "invalid");
  if (ownerInspection.kind === "invalid") assert.equal(ownerInspection.code, "wildz_restore_owner_mismatch");

  const original = await proofObjectFixture();
  const payloadTamper = JSON.parse(new TextDecoder().decode(original.bytes)) as {
    originalBase64: string;
    manifest: { basisSha256: string };
    proofbundle: { artifactSha256Basis: string; receizClaimId: string };
  };
  const document = JSON.parse(Buffer.from(payloadTamper.originalBase64, "base64url").toString("utf8")) as {
    payload: { bytesBase64Url: string };
  };
  document.payload.bytesBase64Url = `${document.payload.bytesBase64Url.slice(0, -1)}${document.payload.bytesBase64Url.endsWith("A") ? "B" : "A"}`;
  const tamperedOriginal = new TextEncoder().encode(canonicalPortableCardJson(document));
  const tamperedBasis = await sha256Hex(tamperedOriginal);
  payloadTamper.originalBase64 = Buffer.from(tamperedOriginal).toString("base64url");
  payloadTamper.manifest.basisSha256 = tamperedBasis;
  payloadTamper.proofbundle.artifactSha256Basis = tamperedBasis;
  const payloadInspection = await codec().inspect({
    bytes: new TextEncoder().encode(JSON.stringify(payloadTamper)),
    mimeType: "application/vnd.receiz.bundle+json"
  });
  assert.equal(payloadInspection.kind, "invalid");
  if (payloadInspection.kind === "invalid") assert.equal(payloadInspection.code, "wildz_restore_binding_invalid");

  const claimSplice = JSON.parse(new TextDecoder().decode(original.bytes)) as {
    proofbundle: { receizClaimId: string };
  };
  claimSplice.proofbundle.receizClaimId = "spliced-claim";
  await assert.rejects(verifyProofSealedWildzVault({
    bytes: new TextEncoder().encode(JSON.stringify(claimSplice)),
    mimeType: "application/vnd.receiz.bundle+json",
    codec: codec(),
    verifier: { verifyArtifact: async () => verification(original) }
  }), /wildz_restore_v4_binding_mismatch/);

  await assert.rejects(verifyProofSealedWildzVault({
    bytes: original.bytes,
    mimeType: "application/vnd.receiz.bundle+json",
    codec: codec(),
    verifier: {
      verifyArtifact: async () => verification({
        artifactBasisSha256: "f".repeat(64),
        claimId: original.claimId
      })
    }
  }), /wildz_restore_v4_binding_mismatch/);

  for (const continuity of [
    { state: "historical_missing" as const },
    { ownerReceizId: "other_keeper.receiz.id" },
    { namespace: "wildz-proof-object-other" },
    { priorHeadReference: "wildz-proof-object-other" }
  ]) {
    await assert.rejects(verifyProofSealedWildzVault({
      bytes: original.bytes,
      mimeType: "application/vnd.receiz.bundle+json",
      codec: codec(),
      verifier: { verifyArtifact: async () => verification(original, continuity) }
    }), /wildz_restore_v4_(?:invalid|binding_mismatch)/);
  }
});

test("proof-object traversal deduplicates exact cards but rejects conflicting card and player bodies", async () => {
  const expected = cards(6);
  const player = playerWith(expected);
  const exactDuplicate = await proofObjectFixture({
    count: 6,
    payload: {
      schema: "receiz.app.portable_bundle.v1",
      objects: [player, structuredClone(player.playState.inventory[2]!)]
    }
  });
  const exactInspection = await codec().inspect({
    bytes: exactDuplicate.bytes,
    mimeType: "application/vnd.receiz.bundle+json"
  });
  assert.equal(exactInspection.kind, "card-vault");
  if (exactInspection.kind === "card-vault") assert.equal(exactInspection.assets.length, 6);

  const conflictingCard = structuredClone(player.playState.inventory.find((asset) => asset.id === expected[2]!.id)!);
  conflictingCard.synchronizedAt = "2026-07-15T23:00:00.000Z";
  const cardConflict = await proofObjectFixture({
    count: 6,
    payload: { schema: "receiz.app.portable_bundle.v1", objects: [player, conflictingCard] }
  });
  const cardConflictInspection = await codec().inspect({
    bytes: cardConflict.bytes,
    mimeType: "application/vnd.receiz.bundle+json"
  });
  assert.equal(cardConflictInspection.kind, "invalid");
  if (cardConflictInspection.kind === "invalid") {
    assert.equal(cardConflictInspection.code, "wildz_restore_duplicate_card_conflict");
  }

  const legacyAncestor = cards(6)[2]!;
  const reverseOrderAncestorArtifact = await proofObjectFixture({
    count: 6,
    payload: { schema: "receiz.app.portable_bundle.v1", objects: [player, legacyAncestor] }
  });
  const reverseOrderAncestorInspection = await codec().inspect({
    bytes: reverseOrderAncestorArtifact.bytes,
    mimeType: "application/vnd.receiz.bundle+json"
  });
  assert.equal(reverseOrderAncestorInspection.kind, "card-vault");
  if (reverseOrderAncestorInspection.kind === "card-vault") {
    const restored = reverseOrderAncestorInspection.assets.find((asset) => asset.id === legacyAncestor.id);
    const living = player.playState.inventory.find((asset) => asset.id === legacyAncestor.id);
    assert.equal(restored?.proof.digest, living?.proof.digest);
  }

  const conflictingPlayer = playerWith(expected, "proof_keeper.receiz.id", "2026-07-15T23:30:00.000Z");
  const playerConflict = await proofObjectFixture({
    count: 6,
    payload: { schema: "receiz.app.portable_bundle.v1", objects: [player, conflictingPlayer] }
  });
  const playerConflictInspection = await codec().inspect({
    bytes: playerConflict.bytes,
    mimeType: "application/vnd.receiz.bundle+json"
  });
  assert.equal(playerConflictInspection.kind, "invalid");
  if (playerConflictInspection.kind === "invalid") {
    assert.equal(playerConflictInspection.code, "wildz_restore_player_digest_invalid");
  }
});

test("a signed identity-V3 binding admits a combined Vault locally and splice or missing bindings fail closed", async () => {
  const captured = cards(6, "bound_keeper");
  const player = playerWith(captured, "bound_keeper.receiz.id");
  const expected = player.playState.inventory;
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "bound_keeper_uid", username: "bound_keeper", displayName: "Bound Keeper" },
    portableState: null
  });
  const vaultBasis = embedPortableVaultInPng(BASE_PNG, expected, player);
  const proof = readPortableVaultFromPng(vaultBasis);
  const withIdentity = appendReceizIdentityArtifactTrailerToPng(vaultBasis, identity.keyFile);
  const binding = await createWildzIdentityBinding({
    keyFile: identity.keyFile,
    playerId: player.playerId,
    vaultDigest: proof.vaultDigest,
    playerPayloadDigest: player.payloadDigest,
    signedAt: "2026-07-15T22:30:00.000Z"
  });
  const combined = appendWildzIdentityBindingTrailer(withIdentity, binding);
  assert.deepEqual(readWildzIdentityBindingFromEnvelope(combined), binding);

  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const artifactCodec = createWildzArtifactCodec({
    identityRepository: repository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault }
  });
  const inspected = await artifactCodec.inspect({ bytes: combined, mimeType: "image/png" });
  assert.equal(inspected.kind, "identity-seal");
  if (inspected.kind !== "identity-seal") return;
  assert.equal(inspected.playerBinding, "identity-v3-binding");
  assert.equal(inspected.player?.payloadDigest, player.payloadDigest);
  assert.equal(inspected.portableAssets.length, expected.length);

  let remoteVerifierCalls = 0;
  const coordinator = createWildzVaultLoginCoordinator({
    database,
    repository,
    codec: artifactCodec,
    pending: createWildzPendingVaultRepository({ database }),
    verifier: {
      async verifyArtifact() {
        remoteVerifierCalls += 1;
        throw new Error("combined_binding_must_use_local_sdk_authority");
      }
    },
    remote: {
      current: async () => ({ status: "unknown", actorId: null, profileHandle: null, displayName: null })
    }
  });
  await repository.bootstrap();
  const restored = await coordinator.begin({
    surface: "genesis",
    bytes: combined,
    mimeType: "image/png",
    name: "bound-player.receized.png"
  });
  assert.equal(restored.status, "committed");
  if (restored.status === "committed") {
    assert.equal(restored.restore.session.username, "bound_keeper");
    assert.equal(restored.restore.playState.inventory.length, expected.length);
  }
  assert.equal(remoteVerifierCalls, 0);

  const missing = await codec().inspect({ bytes: withIdentity, mimeType: "image/png" });
  assert.equal(missing.kind, "invalid");
  if (missing.kind === "invalid") assert.equal(missing.code, "wildz_restore_binding_invalid");

  const otherIdentity = await createReceizIdentityKeyFile({
    owner: { uid: "other_bound_uid", username: "other_bound", displayName: "Other Bound" },
    portableState: null
  });
  const spliced = appendWildzIdentityBindingTrailer(
    appendReceizIdentityArtifactTrailerToPng(vaultBasis, otherIdentity.keyFile),
    binding
  );
  const splicedInspection = await codec().inspect({ bytes: spliced, mimeType: "image/png" });
  assert.equal(splicedInspection.kind, "invalid");
  if (splicedInspection.kind === "invalid") assert.equal(splicedInspection.code, "wildz_restore_owner_mismatch");

  const duplicateBinding = new Uint8Array(combined.byteLength + (combined.byteLength - withIdentity.byteLength));
  duplicateBinding.set(combined);
  duplicateBinding.set(combined.slice(withIdentity.byteLength), combined.byteLength);
  const duplicateInspection = await codec().inspect({ bytes: duplicateBinding, mimeType: "image/png" });
  assert.equal(duplicateInspection.kind, "invalid");
  if (duplicateInspection.kind === "invalid") assert.equal(duplicateInspection.code, "wildz_restore_binding_invalid");
});

test("a protected Identity Seal signs one combined Vault with an ephemeral export passphrase", async () => {
  const passphrase = "wildz-vault-passphrase-2026";
  const captured = cards(8, "protected_keeper");
  const player = playerWith(captured, "protected_keeper.receiz.id");
  const expected = player.playState.inventory;
  const identity = await createReceizIdentityKeyFile({
    owner: {
      uid: "protected_keeper_uid",
      username: "protected_keeper",
      displayName: "Protected Keeper"
    },
    passphrase,
    portableState: null
  });
  const vaultBasis = embedPortableVaultInPng(BASE_PNG, expected, player);

  await assert.rejects(createWildzIdentityBoundPlayerVault({
    keyFile: identity.keyFile,
    vaultBytes: vaultBasis
  }), /wildz_identity_passphrase_required/);
  await assert.rejects(createWildzIdentityBoundPlayerVault({
    keyFile: identity.keyFile,
    passphrase: "wrong-passphrase-2026",
    vaultBytes: vaultBasis
  }), /receiz_key_decrypt_failed|OperationError/);

  const combined = await createWildzIdentityBoundPlayerVault({
    keyFile: identity.keyFile,
    passphrase,
    vaultBytes: vaultBasis
  });
  const binding = await requireWildzIdentityBindingFromEnvelope(combined);
  assert.equal(binding.keyId, identity.keyFile.keyId);
  assert.equal(binding.playerId, player.playerId);
  assert.equal(new TextDecoder().decode(combined).includes(passphrase), false);
});
