import {
  RECEIZ_KEY_NAME,
  RECEIZ_KEY_SCHEMA,
  receizBase64UrlEncode,
  signReceizIdentityLoginProof,
  verifyReceizIdentityLoginProof,
  type ReceizIdContinueRequest,
  type ReceizKeyFile
} from "@receiz/sdk";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import type { WildzIdentitySession } from "./wildz-identity-repository";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildzVaultCardAdmission } from "./wildz-vault-card-admission";

const CLAIM_SCHEMA = "receiz.wildz.identity_vault_admission.v1" as const;
const CLAIM_MAX_AGE_MS = 5 * 60 * 1_000;
const ROOT = /^sha256:[a-f0-9]{64}$/;

export type WildzIdentityVaultAdmissionClaim = {
  schema: typeof CLAIM_SCHEMA;
  keyId: string;
  actorId: string;
  profileHandle: string;
  root: string;
  leafCount: number;
  issuedAt: string;
};

export type WildzIdentityVaultAdmissionProof = {
  claim: WildzIdentityVaultAdmissionClaim;
  challengeB64Url: string;
  signatureB64Url: string;
};

function canonicalClaim(claim: WildzIdentityVaultAdmissionClaim) {
  return canonicalPortableCardJson(claim);
}

export async function createWildzIdentityVaultAdmissionProof(input: {
  keyFile: ReceizKeyFile;
  session: WildzIdentitySession;
  admission: WildzVaultCardAdmission;
  passphrase?: string;
  issuedAt?: string;
}): Promise<WildzIdentityVaultAdmissionProof> {
  const coordinate = parseWildzPlayerCoordinate(input.admission.playerHandle);
  if (input.session.localAuthority !== "verified"
    || input.keyFile.keyId !== input.session.keyId
    || coordinate?.actorId !== input.session.actorId
    || !ROOT.test(input.admission.root)) {
    throw new Error("wildz_identity_vault_admission_invalid");
  }
  const claim: WildzIdentityVaultAdmissionClaim = {
    schema: CLAIM_SCHEMA,
    keyId: input.session.keyId,
    actorId: coordinate.actorId,
    profileHandle: coordinate.profileHandle,
    root: input.admission.root,
    leafCount: input.admission.leafCount,
    issuedAt: input.issuedAt ?? new Date().toISOString()
  };
  const signed = await signReceizIdentityLoginProof({
    keyFile: input.keyFile,
    challengeText: canonicalClaim(claim),
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
  return {
    claim,
    challengeB64Url: signed.challengeB64Url,
    signatureB64Url: signed.signatureB64Url
  };
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function publicVerificationKey(continuation: ReceizIdContinueRequest): ReceizKeyFile {
  return {
    schema: RECEIZ_KEY_SCHEMA,
    name: RECEIZ_KEY_NAME,
    version: 1,
    issuedAt: continuation.createdAt,
    keyId: continuation.keyId,
    alg: continuation.alg,
    owner: {
      uid: continuation.localUid,
      email: null,
      username: continuation.username,
      displayName: continuation.displayName
    },
    crypto: {
      publicKeyRawB64u: continuation.publicKeyRawB64u,
      privateKeyPkcs8CiphertextB64u: "AA",
      privateKeyPkcs8B64u: null,
      kdf: { name: "PBKDF2-SHA256", iterations: 1_000, saltB64u: "AA" },
      cipher: { name: "AES-GCM-256", ivB64u: "AA", aad: "receiz.wildz.public-verification-only" }
    },
    attestation: null,
    portableState: null
  };
}

export async function verifyWildzIdentityVaultAdmissionProof(input: {
  value: unknown;
  continuation: ReceizIdContinueRequest;
  canonicalUsername: string;
  now?: number;
}) {
  const proof = record(input.value);
  const rawClaim = record(proof?.claim);
  const coordinate = parseWildzPlayerCoordinate(input.canonicalUsername);
  if (!proof
    || !rawClaim
    || !coordinate
    || rawClaim.schema !== CLAIM_SCHEMA
    || rawClaim.keyId !== input.continuation.keyId
    || rawClaim.actorId !== coordinate.actorId
    || rawClaim.profileHandle !== coordinate.profileHandle
    || typeof rawClaim.root !== "string"
    || !ROOT.test(rawClaim.root)
    || !Number.isSafeInteger(rawClaim.leafCount)
    || Number(rawClaim.leafCount) < 0
    || Number(rawClaim.leafCount) > 1_000
    || typeof rawClaim.issuedAt !== "string"
    || typeof proof.challengeB64Url !== "string"
    || typeof proof.signatureB64Url !== "string") {
    throw new Error("wildz_identity_vault_admission_invalid");
  }
  const issuedAt = Date.parse(rawClaim.issuedAt);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(issuedAt) || issuedAt > now + 30_000 || now - issuedAt > CLAIM_MAX_AGE_MS) {
    throw new Error("wildz_identity_vault_admission_invalid");
  }
  const claim = rawClaim as WildzIdentityVaultAdmissionClaim;
  const expectedChallenge = receizBase64UrlEncode(new TextEncoder().encode(canonicalClaim(claim)));
  if (proof.challengeB64Url !== expectedChallenge
    || !(await verifyReceizIdentityLoginProof({
      keyFile: publicVerificationKey(input.continuation),
      challengeB64Url: expectedChallenge,
      signatureB64Url: proof.signatureB64Url
    }))) {
    throw new Error("wildz_identity_vault_admission_invalid");
  }
  return { root: claim.root, leafCount: claim.leafCount };
}
