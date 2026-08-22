import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import type { ReceizIdContinueRequest } from "@receiz/sdk";
import { receizOAuthSecret } from "./oauth-state";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { wildzVaultSessionKeyId } from "./wildz-vault-session-key";

export const WILDZ_PROOF_SESSION_COOKIE = "wildz_proof_session";
export const WILDZ_PROOF_NONCE_COOKIE = "wildz_proof_nonce";
export const WILDZ_VAULT_PENDING_COOKIE = "wildz_pending_vault_admission";

const TOKEN_VERSION = "v1";
const SESSION_PURPOSE = "receiz.wildz.proof_session.v1";
const VAULT_PENDING_PURPOSE = "receiz.wildz.pending_vault_admission.v1";
const SUBJECT_PURPOSE = "receiz.wildz.proof_subject.v1";
const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1_000;
const VAULT_PENDING_MAX_AGE_MS = 5 * 60 * 1_000;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type WildzProofSession = {
  schema: "receiz.wildz.proof_session.v1";
  keyId: string;
  actorId: string;
  profileHandle: string;
  displayName: string | null;
  authority: "identity-key" | "proof-sealed-vault";
  subjectKey: string;
  proofBasisSha256?: string;
  artifactDigestSha256?: string;
  vaultCardRootSha256?: string;
  issuedAt: number;
};

function encryptionKey(secret: string, purpose: string) {
  return createHash("sha256").update(purpose).update("\0").update(secret).digest();
}

function decodeBase64Url(value: string) {
  if (!BASE64_URL_PATTERN.test(value)) throw new Error("invalid_base64url");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw new Error("invalid_base64url");
  return decoded;
}

function packToken(payload: object, secret: string, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret, purpose), iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
    cipher.final()
  ]);
  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url")
  ].join(".");
}

function unpackToken<T extends { issuedAt: number }>(
  token: string,
  secret: string,
  purpose: string,
  maxAgeMs: number,
  now: number,
  errorCode: string
) {
  try {
    const [version, encodedIv, encodedCiphertext, encodedTag, ...extra] = token.split(".");
    if (version !== TOKEN_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra.length) {
      throw new Error("invalid_token_shape");
    }
    const iv = decodeBase64Url(encodedIv);
    const ciphertext = decodeBase64Url(encodedCiphertext);
    const tag = decodeBase64Url(encodedTag);
    if (iv.byteLength !== 12 || tag.byteLength !== 16 || ciphertext.byteLength === 0) {
      throw new Error("invalid_token_shape");
    }
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret, purpose), iv);
    decipher.setAAD(Buffer.from(purpose, "utf8"));
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString("utf8")) as T;
    if (!Number.isSafeInteger(payload.issuedAt)
      || payload.issuedAt > now + 30_000
      || now - payload.issuedAt > maxAgeMs) {
      throw new Error("invalid_token_age");
    }
    return payload;
  } catch {
    throw new Error(errorCode);
  }
}

function validKeyId(value: string) {
  return value.length >= 8 && value.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function subjectKey(keyId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(SUBJECT_PURPOSE)
    .update("\0")
    .update(keyId)
    .digest("hex");
}

function equalText(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes);
}

export function receizIdContinuationNonceMatches(
  continuation: Pick<ReceizIdContinueRequest, "challengeB64Url" | "keyId" | "localUid">,
  expectedNonce: string
) {
  try {
    if (!BASE64_URL_PATTERN.test(expectedNonce)) return false;
    const decoded = decodeBase64Url(continuation.challengeB64Url).toString("utf8");
    const lines = decoded.split("\n");
    if (lines[0] !== "RECEIZ_DEVICE_SESSION_V1") return false;
    const values = new Map<string, string>();
    for (const line of lines.slice(1)) {
      const separator = line.indexOf("=");
      if (separator > 0) values.set(line.slice(0, separator), line.slice(separator + 1));
    }
    return values.get("keyId") === continuation.keyId
      && values.get("localUid") === continuation.localUid
      && equalText(values.get("nonce") ?? "", expectedNonce);
  } catch {
    return false;
  }
}

export function createWildzReceizIdProofSession(input: {
  keyId: string;
  username: string;
  displayName: string | null;
  vaultCardRootSha256?: string;
  issuedAt?: number;
}, secret = receizOAuthSecret()): WildzProofSession {
  const coordinate = parseWildzPlayerCoordinate(input.username);
  if (!validKeyId(input.keyId)
    || !coordinate
    || (typeof input.displayName !== "string" && input.displayName !== null)
    || (input.vaultCardRootSha256 !== undefined && !/^sha256:[a-f0-9]{64}$/.test(input.vaultCardRootSha256))) {
    throw new Error("wildz_receiz_id_session_invalid");
  }
  return {
    schema: "receiz.wildz.proof_session.v1",
    keyId: input.keyId,
    actorId: coordinate.actorId,
    profileHandle: coordinate.profileHandle,
    displayName: input.displayName?.trim() || null,
    authority: "identity-key",
    subjectKey: subjectKey(input.keyId, secret),
    ...(input.vaultCardRootSha256 ? { vaultCardRootSha256: input.vaultCardRootSha256 } : {}),
    issuedAt: input.issuedAt ?? Date.now()
  };
}

export function createWildzVaultProofSession(input: {
  actorId: string;
  profileHandle: string;
  proofBasisSha256: string;
  byteDigestSha256: string;
  vaultCardRootSha256?: string;
  issuedAt?: number;
}, secret = receizOAuthSecret()): WildzProofSession {
  const coordinate = parseWildzPlayerCoordinate(input.profileHandle);
  if (coordinate?.actorId !== input.actorId
    || !SHA256_PATTERN.test(input.proofBasisSha256)
    || !SHA256_PATTERN.test(input.byteDigestSha256)
    || (input.vaultCardRootSha256 !== undefined
      && !/^sha256:[a-f0-9]{64}$/.test(input.vaultCardRootSha256))) {
    throw new Error("wildz_vault_proof_session_invalid");
  }
  const keyId = wildzVaultSessionKeyId({
    profileHandle: coordinate.profileHandle,
    proofBasisSha256: input.proofBasisSha256,
    byteDigestSha256: input.byteDigestSha256
  });
  return {
    schema: "receiz.wildz.proof_session.v1",
    keyId,
    actorId: coordinate.actorId,
    profileHandle: coordinate.profileHandle,
    displayName: null,
    authority: "proof-sealed-vault",
    subjectKey: subjectKey(keyId, secret),
    proofBasisSha256: input.proofBasisSha256,
    artifactDigestSha256: input.byteDigestSha256,
    ...(input.vaultCardRootSha256 ? { vaultCardRootSha256: input.vaultCardRootSha256 } : {}),
    issuedAt: input.issuedAt ?? Date.now()
  };
}

function assertProofSession(value: WildzProofSession) {
  const coordinate = parseWildzPlayerCoordinate(value.profileHandle);
  if (value.schema !== "receiz.wildz.proof_session.v1"
    || !validKeyId(value.keyId)
    || coordinate?.actorId !== value.actorId
    || (typeof value.displayName !== "string" && value.displayName !== null)
    || (value.authority !== "identity-key" && value.authority !== "proof-sealed-vault")
    || !SHA256_PATTERN.test(value.subjectKey)
    || (value.vaultCardRootSha256 !== undefined
      && !/^sha256:[a-f0-9]{64}$/.test(value.vaultCardRootSha256))
    || (value.authority === "identity-key" && (value.proofBasisSha256 !== undefined
      || value.artifactDigestSha256 !== undefined))
    || (value.authority === "proof-sealed-vault"
      && (!value.proofBasisSha256 || !SHA256_PATTERN.test(value.proofBasisSha256)
        || !value.artifactDigestSha256 || !SHA256_PATTERN.test(value.artifactDigestSha256)
        || (value.vaultCardRootSha256 !== undefined
          && !/^sha256:[a-f0-9]{64}$/.test(value.vaultCardRootSha256))))) {
    throw new Error("wildz_proof_session_invalid");
  }
  return value;
}

export function retainWildzVaultCardAdmission(
  identitySession: WildzProofSession,
  verifiedVaultSession: WildzProofSession
) {
  const identity = assertProofSession(identitySession);
  const vault = assertProofSession(verifiedVaultSession);
  if (identity.authority !== "identity-key"
    || vault.authority !== "proof-sealed-vault"
    || identity.actorId !== vault.actorId
    || identity.profileHandle !== vault.profileHandle) {
    throw new Error("wildz_vault_admission_identity_mismatch");
  }
  return vault.vaultCardRootSha256
    ? assertProofSession({ ...identity, vaultCardRootSha256: vault.vaultCardRootSha256 })
    : identity;
}

export function packWildzProofSession(session: WildzProofSession, secret = receizOAuthSecret()) {
  return packToken(assertProofSession(session), secret, SESSION_PURPOSE);
}

export function unpackWildzProofSession(
  token: string,
  secret = receizOAuthSecret(),
  now = Date.now()
) {
  return assertProofSession(unpackToken<WildzProofSession>(
    token,
    secret,
    SESSION_PURPOSE,
    SESSION_MAX_AGE_MS,
    now,
    "wildz_proof_session_invalid"
  ));
}

export function packWildzVaultPendingAdmission(
  session: WildzProofSession,
  secret = receizOAuthSecret()
) {
  const admitted = assertProofSession(session);
  if (admitted.authority !== "proof-sealed-vault") {
    throw new Error("wildz_vault_pending_invalid");
  }
  return packToken(admitted, secret, VAULT_PENDING_PURPOSE);
}

export function unpackWildzVaultPendingAdmission(
  token: string,
  secret = receizOAuthSecret(),
  now = Date.now()
) {
  const session = assertProofSession(unpackToken<WildzProofSession>(
    token,
    secret,
    VAULT_PENDING_PURPOSE,
    VAULT_PENDING_MAX_AGE_MS,
    now,
    "wildz_vault_pending_invalid"
  ));
  if (session.authority !== "proof-sealed-vault") {
    throw new Error("wildz_vault_pending_invalid");
  }
  return session;
}

export function wildzProofSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1_000
  };
}

export function wildzProofNonceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/auth/wildz",
    maxAge: CHALLENGE_MAX_AGE_MS / 1_000
  };
}

export function wildzVaultPendingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/auth/wildz",
    maxAge: VAULT_PENDING_MAX_AGE_MS / 1_000
  };
}

export function readWildzProofSessionCookie(
  request: { cookies: { get(name: string): { value: string } | undefined } },
  secret = receizOAuthSecret()
) {
  const token = request.cookies.get(WILDZ_PROOF_SESSION_COOKIE)?.value;
  if (!token) throw new Error("wildz_proof_session_required");
  return unpackWildzProofSession(token, secret);
}

export function readWildzVaultPendingAdmissionCookie(
  request: { cookies: { get(name: string): { value: string } | undefined } },
  secret = receizOAuthSecret()
) {
  const token = request.cookies.get(WILDZ_VAULT_PENDING_COOKIE)?.value;
  if (!token) throw new Error("wildz_vault_pending_required");
  return unpackWildzVaultPendingAdmission(token, secret);
}

export function publicWildzProofSession(session: WildzProofSession) {
  return {
    status: "connected" as const,
    subjectKey: session.subjectKey,
    sessionKeyId: session.keyId,
    actorId: session.actorId,
    profileHandle: session.profileHandle,
    displayName: session.displayName,
    authority: session.authority,
    issuedAt: session.issuedAt,
    ...(session.vaultCardRootSha256 ? { vaultCardRootSha256: session.vaultCardRootSha256 } : {})
  };
}

export function wildzProofPrincipalId(session: WildzProofSession) {
  const admitted = assertProofSession(session);
  return admitted.authority === "proof-sealed-vault"
    ? `vault:${admitted.subjectKey}`
    : admitted.profileHandle;
}
