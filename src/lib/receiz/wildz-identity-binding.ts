import {
  projectReceizIdentityAccount,
  readReceizIdentityArtifact,
  receizBase64UrlDecode,
  receizBase64UrlEncode,
  signReceizIdentityLoginProof,
  verifyReceizIdentityLoginProof,
  type ReceizIdentityKeyAlgorithm,
  type ReceizKeyFile
} from "@receiz/sdk";
import {
  readPortableVaultFromPng,
  readWildzPlayerVaultAppendFromPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { splitWildzPngEnvelope } from "./wildz-png-envelope";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";

export type WildzIdentityBinding = {
  schema: "receiz.wilds_identity_binding.v1";
  keyId: string;
  playerId: string;
  vaultDigest: string;
  playerPayloadDigest: string;
  signedAt: string;
  challengeB64Url: string;
  signatureB64Url: string;
  alg: ReceizIdentityKeyAlgorithm;
};

const BINDING_PREFIX = "\n--RECEIZ-WILDZ-IDENTITY-BINDING-V1--";
const BINDING_SUFFIX = "--END-RECEIZ-WILDZ-IDENTITY-BINDING-V1--\n";
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;
const MAX_BINDING_TEXT_BYTES = 16 * 1024;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strictBinding(value: unknown): WildzIdentityBinding {
  const record = asRecord(value);
  if (!record
    || record.schema !== "receiz.wilds_identity_binding.v1"
    || typeof record.keyId !== "string"
    || !record.keyId.trim()
    || typeof record.playerId !== "string"
    || !record.playerId.trim()
    || typeof record.vaultDigest !== "string"
    || !SHA256_DIGEST.test(record.vaultDigest)
    || typeof record.playerPayloadDigest !== "string"
    || !SHA256_DIGEST.test(record.playerPayloadDigest)
    || typeof record.signedAt !== "string"
    || !Number.isFinite(Date.parse(record.signedAt))
    || typeof record.challengeB64Url !== "string"
    || !BASE64_URL.test(record.challengeB64Url)
    || typeof record.signatureB64Url !== "string"
    || !BASE64_URL.test(record.signatureB64Url)
    || (record.alg !== "Ed25519" && record.alg !== "P-256")) {
    throw new Error("wildz_restore_binding_invalid");
  }
  return {
    schema: "receiz.wilds_identity_binding.v1",
    keyId: record.keyId,
    playerId: record.playerId,
    vaultDigest: record.vaultDigest,
    playerPayloadDigest: record.playerPayloadDigest,
    signedAt: new Date(Date.parse(record.signedAt)).toISOString(),
    challengeB64Url: record.challengeB64Url,
    signatureB64Url: record.signatureB64Url,
    alg: record.alg
  };
}

function occurrenceCount(value: string, needle: string) {
  let count = 0;
  let offset = 0;
  while (offset < value.length) {
    const index = value.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function bindingText(bytes: Uint8Array) {
  const trailer = splitWildzPngEnvelope(bytes).trailer;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(trailer);
  } catch {
    throw new Error("wildz_restore_binding_invalid");
  }
  const prefixes = occurrenceCount(text, BINDING_PREFIX);
  const suffixes = occurrenceCount(text, BINDING_SUFFIX);
  if (prefixes === 0 && suffixes === 0) return null;
  if (prefixes !== 1 || suffixes !== 1) throw new Error("wildz_restore_binding_invalid");
  const start = text.indexOf(BINDING_PREFIX) + BINDING_PREFIX.length;
  const end = text.indexOf(BINDING_SUFFIX, start);
  if (end < start || text.indexOf(BINDING_PREFIX, start) >= 0) {
    throw new Error("wildz_restore_binding_invalid");
  }
  const encoded = text.slice(start, end);
  if (!encoded || encoded.length > MAX_BINDING_TEXT_BYTES || !BASE64_URL.test(encoded)) {
    throw new Error("wildz_restore_binding_invalid");
  }
  return encoded;
}

export function canonicalWildzIdentityBindingChallenge(input: Pick<
  WildzIdentityBinding,
  "keyId" | "playerId" | "vaultDigest" | "playerPayloadDigest"
>) {
  return canonicalPortableCardJson({
    schema: "receiz.wilds_identity_binding_challenge.v1",
    keyId: input.keyId,
    playerId: input.playerId,
    vaultDigest: input.vaultDigest,
    playerPayloadDigest: input.playerPayloadDigest
  });
}

export async function createWildzIdentityBinding(input: {
  keyFile: ReceizKeyFile;
  playerId: string;
  vaultDigest: string;
  playerPayloadDigest: string;
  passphrase?: string;
  signedAt?: string;
}): Promise<WildzIdentityBinding> {
  if (!SHA256_DIGEST.test(input.vaultDigest) || !SHA256_DIGEST.test(input.playerPayloadDigest)) {
    throw new Error("wildz_restore_binding_invalid");
  }
  const projection = await projectReceizIdentityAccount(input.keyFile);
  if (!projection.owner.username
    || !sameWildzPlayerCoordinate(projection.owner.username, input.playerId)) {
    throw new Error("wildz_restore_owner_mismatch");
  }
  const challenge = canonicalWildzIdentityBindingChallenge({
    keyId: input.keyFile.keyId,
    playerId: input.playerId,
    vaultDigest: input.vaultDigest,
    playerPayloadDigest: input.playerPayloadDigest
  });
  const signed = await signReceizIdentityLoginProof({
    keyFile: input.keyFile,
    challengeText: challenge,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
  return strictBinding({
    schema: "receiz.wilds_identity_binding.v1",
    keyId: signed.keyId,
    playerId: input.playerId,
    vaultDigest: input.vaultDigest,
    playerPayloadDigest: input.playerPayloadDigest,
    signedAt: input.signedAt ?? new Date().toISOString(),
    challengeB64Url: signed.challengeB64Url,
    signatureB64Url: signed.signatureB64Url,
    alg: signed.alg
  });
}

export function appendWildzIdentityBindingTrailer(
  bytes: Uint8Array,
  binding: WildzIdentityBinding
) {
  if (bindingText(bytes) !== null) throw new Error("wildz_restore_binding_invalid");
  const normalized = strictBinding(binding);
  const encoded = receizBase64UrlEncode(new TextEncoder().encode(JSON.stringify(normalized)));
  const trailer = new TextEncoder().encode(`${BINDING_PREFIX}${encoded}${BINDING_SUFFIX}`);
  const result = new Uint8Array(bytes.byteLength + trailer.byteLength);
  result.set(bytes);
  result.set(trailer, bytes.byteLength);
  return result;
}

export function readWildzIdentityBindingFromEnvelope(bytes: Uint8Array) {
  const encoded = bindingText(bytes);
  if (encoded === null) throw new Error("wildz_restore_binding_missing");
  try {
    const decoded = receizBase64UrlDecode(encoded);
    if (decoded.byteLength > MAX_BINDING_TEXT_BYTES) throw new Error("wildz_restore_binding_invalid");
    return strictBinding(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decoded)) as unknown);
  } catch (error) {
    if (error instanceof Error && error.message === "wildz_restore_binding_invalid") throw error;
    throw new Error("wildz_restore_binding_invalid");
  }
}

export async function requireWildzIdentityBindingFromEnvelope(bytes: Uint8Array) {
  const { pngBasis } = splitWildzPngEnvelope(bytes);
  const verifiedVault = verifyPortableVaultPng(pngBasis);
  if (!verifiedVault.ok) throw new Error("wildz_restore_binding_invalid");
  const proof = readPortableVaultFromPng(pngBasis);
  let playerAppend: ReturnType<typeof readWildzPlayerVaultAppendFromPng>;
  try {
    playerAppend = readWildzPlayerVaultAppendFromPng(pngBasis);
  } catch {
    throw new Error("wildz_restore_binding_invalid");
  }
  if (playerAppend.base.vaultDigest !== proof.vaultDigest) throw new Error("wildz_restore_binding_invalid");
  const binding = readWildzIdentityBindingFromEnvelope(bytes);
  const keyFile = await readReceizIdentityArtifact(bytes);
  const projection = await projectReceizIdentityAccount(keyFile);
  const username = projection.owner.username;
  if (binding.keyId !== keyFile.keyId
    || binding.alg !== keyFile.alg
    || !username
    || !sameWildzPlayerCoordinate(username, playerAppend.player.playerId)
    || !sameWildzPlayerCoordinate(binding.playerId, playerAppend.player.playerId)) {
    throw new Error("wildz_restore_owner_mismatch");
  }
  if (binding.vaultDigest !== proof.vaultDigest
    || binding.playerPayloadDigest !== playerAppend.player.payloadDigest) {
    throw new Error("wildz_restore_binding_invalid");
  }
  let challenge: string;
  try {
    challenge = new TextDecoder("utf-8", { fatal: true }).decode(
      receizBase64UrlDecode(binding.challengeB64Url)
    );
  } catch {
    throw new Error("wildz_restore_binding_invalid");
  }
  if (challenge !== canonicalWildzIdentityBindingChallenge(binding)
    || !(await verifyReceizIdentityLoginProof({
      keyFile,
      challengeB64Url: binding.challengeB64Url,
      signatureB64Url: binding.signatureB64Url
    }))) {
    throw new Error("wildz_restore_binding_invalid");
  }
  return binding;
}

export async function verifyWildzIdentityBindingFromEnvelope(bytes: Uint8Array) {
  try {
    await requireWildzIdentityBindingFromEnvelope(bytes);
    return true;
  } catch {
    return false;
  }
}
