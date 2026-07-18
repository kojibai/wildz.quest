import type { DocumentVerifyResponse } from "@receiz/sdk";
import type { PortableCardAsset } from "../../features/play/portable-card";
import type { WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import type {
  WildzArtifactCodec,
  WildzArtifactInspection
} from "./wildz-artifact-codec";
import {
  parseWildzPlayerCoordinate,
  sameWildzPlayerCoordinate,
  type WildzPlayerCoordinate
} from "./wildz-player-coordinate";

export interface WildzProofArtifactVerifier {
  verifyArtifact(file: Blob): Promise<DocumentVerifyResponse>;
}

export type VerifiedProofSealedWildzVault = {
  artifactKind: "card-vault" | "commerce-vault";
  assets: PortableCardAsset[];
  playerPayload: WildsPlayerVaultPayload;
  player: WildzPlayerCoordinate;
  proofBasisSha256: string;
  byteDigestSha256: string;
  inspection: Extract<WildzArtifactInspection, { kind: "card-vault" | "commerce-vault" }>;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function validSignatureV4(value: unknown) {
  const signature = asRecord(value);
  const cert = asRecord(signature.cert);
  return signature.version === 1
    && signature.alg === "Ed25519"
    && nonEmptyString(signature.sig)
    && BASE64_URL_PATTERN.test(String(signature.sig))
    && typeof signature.payloadHashSha256 === "string"
    && SHA256_PATTERN.test(signature.payloadHashSha256)
    && Number.isSafeInteger(signature.signedAtMs)
    && cert.version === 1
    && cert.certType === "receiz.device.v1"
    && cert.alg === "Ed25519"
    && nonEmptyString(cert.certId)
    && nonEmptyString(cert.issuerKid)
    && nonEmptyString(cert.subjectPublicKeyRawB64u)
    && BASE64_URL_PATTERN.test(String(cert.subjectPublicKeyRawB64u))
    && nonEmptyString(cert.sig)
    && BASE64_URL_PATTERN.test(String(cert.sig))
    && Number.isSafeInteger(cert.issuedAtMs)
    && Number.isSafeInteger(cert.expiresAtMs)
    && Number(cert.expiresAtMs) > Number(cert.issuedAtMs);
}

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", strictArrayBuffer(bytes)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function proofEvidence(verification: DocumentVerifyResponse, allowExistingV3Png: boolean) {
  const continuity = verification.assetContinuity;
  if (!verification.ok
    || verification.integrity?.ok === false
    || verification.errors.length > 0) {
    throw new Error("wildz_restore_v4_invalid");
  }
  const bundle = asRecord(verification.bundle);
  const signatureV4 = asRecord(bundle.signatureV4);
  const basis = typeof bundle.artifactSha256Basis === "string"
    ? bundle.artifactSha256Basis.trim().toLowerCase()
    : "";
  if (!validSignatureV4(signatureV4) || !SHA256_PATTERN.test(basis)) {
    throw new Error("wildz_restore_v4_invalid");
  }
  const claimId = typeof bundle.receizClaimId === "string" && bundle.receizClaimId.trim()
    ? bundle.receizClaimId.trim()
    : null;
  if (!continuity) {
    const anchor = asRecord(verification.anchor);
    if (!allowExistingV3Png
      || verification.kind !== "png"
      || bundle.kind !== "receiz.proof_bundle"
      || !claimId
      || typeof bundle.verifyPath !== "string"
      || !bundle.verifyPath.startsWith("/v/")
      || !nonEmptyString(bundle.signerKeyId)
      || !nonEmptyString(bundle.anchorId)
      || anchor.anchorId !== bundle.anchorId) {
      throw new Error("wildz_restore_v4_invalid");
    }
    return { basis, continuity: null, claimId };
  }
  if (continuity.state !== "verified"
    || (continuity.carrier !== "portable_asset" && continuity.carrier !== "ownership_provenance")
    || !nonEmptyString(continuity.artifactId)
    || !nonEmptyString(continuity.headReference)
    || !nonEmptyString(continuity.issuerKid)
    || !nonEmptyString(continuity.ownerReceizId)
    || !nonEmptyString(continuity.namespace)
    || !nonEmptyString(continuity.priorHeadReference)) {
    throw new Error("wildz_restore_v4_invalid");
  }
  return {
    basis,
    continuity: {
      carrier: continuity.carrier,
      namespace: continuity.namespace!.trim(),
      ownerReceizId: continuity.ownerReceizId!.trim(),
      priorHeadReference: continuity.priorHeadReference!.trim()
    },
    claimId
  };
}

export async function verifyProofSealedWildzVault(input: {
  bytes: Uint8Array;
  mimeType: string;
  name?: string | null;
  codec: WildzArtifactCodec;
  verifier: WildzProofArtifactVerifier;
}): Promise<VerifiedProofSealedWildzVault> {
  const inspection = await input.codec.inspect({
    bytes: input.bytes,
    mimeType: input.mimeType,
    ...(input.name ? { name: input.name } : {})
  });
  if (inspection.kind === "invalid" || inspection.kind === "unsupported") {
    throw new Error(inspection.code);
  }
  if ((inspection.kind !== "card-vault" && inspection.kind !== "commerce-vault") || !inspection.player) {
    throw new Error("wildz_restore_player_vault_required");
  }
  const proofObject = inspection.kind === "card-vault" ? inspection.proofObject : null;
  if (proofObject) {
    const player = parseWildzPlayerCoordinate(inspection.player.playerId);
    if (!player) throw new Error("wildz_restore_player_owner_invalid");
    if (!sameWildzPlayerCoordinate(proofObject.ownerReceizId, player.profileHandle)) {
      throw new Error("wildz_restore_v4_binding_mismatch");
    }
    return {
      artifactKind: inspection.kind,
      assets: inspection.assets,
      playerPayload: inspection.player,
      player,
      proofBasisSha256: proofObject.artifactBasisSha256,
      byteDigestSha256: await sha256Hex(input.bytes),
      inspection
    };
  }
  const verificationBytes = input.bytes;
  let verification: DocumentVerifyResponse;
  try {
    verification = await input.verifier.verifyArtifact(new Blob(
      [strictArrayBuffer(verificationBytes)],
      { type: input.mimeType }
    ));
  } catch {
    throw new Error("wildz_restore_v4_unavailable");
  }
  const proof = proofEvidence(
    verification,
    inspection.kind === "card-vault" && input.mimeType === "image/png"
  );
  const player = parseWildzPlayerCoordinate(inspection.player.playerId);
  if (!player) throw new Error("wildz_restore_player_owner_invalid");
  if (proof.continuity
    && (!sameWildzPlayerCoordinate(proof.continuity.ownerReceizId, player.profileHandle)
      || proof.continuity.carrier !== "ownership_provenance")) {
    throw new Error("wildz_restore_v4_binding_mismatch");
  }
  return {
    artifactKind: inspection.kind,
    assets: inspection.assets,
    playerPayload: inspection.player,
    player,
    proofBasisSha256: proof.basis,
    byteDigestSha256: await sha256Hex(input.bytes),
    inspection
  };
}
