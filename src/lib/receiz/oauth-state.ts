import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export type ReceizOAuthStatePayload = {
  flowNonce: string;
  verifier: string;
  returnTo: string;
  sessionScope: string;
  startOrigin: string;
  issuedAt?: number;
};

export type ReceizSessionTicketPayload = {
  accessToken: string;
  expiresIn: number;
  returnTo: string;
  sessionScope: string;
  flowNonce: string;
  startOrigin: string;
  issuedAt?: number;
};

const TOKEN_VERSION = "v1";
const STATE_PURPOSE = "receiz.wildz.oauth_state.v1";
const TICKET_PURPOSE = "receiz.wildz.session_ticket.v1";
const SUBJECT_PURPOSE = "receiz.wildz.player_subject.v1";
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function encryptionKey(secret: string) {
  return createHash("sha256").update("receiz.wildz.auth_encryption.v1\0").update(secret).digest();
}

function decodeBase64Url(value: string) {
  if (!BASE64_URL_PATTERN.test(value)) throw new Error("invalid_base64url");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw new Error("invalid_base64url");
  return decoded;
}

function pack<T extends { issuedAt?: number }>(payload: T, secret: string, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(purpose, "utf8"));
  const plaintext = Buffer.from(JSON.stringify({ ...payload, issuedAt: payload.issuedAt ?? Date.now() }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [TOKEN_VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

function unpack<T>(token: string, secret: string, purpose: string, errorMessage: string, maxAgeMs: number): T {
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
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
    decipher.setAAD(Buffer.from(purpose, "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const payload = JSON.parse(plaintext) as T & { issuedAt?: number };
    if (!payload.issuedAt || !Number.isSafeInteger(payload.issuedAt)
      || payload.issuedAt > Date.now() + 30_000
      || Date.now() - payload.issuedAt > maxAgeMs) {
      throw new Error("invalid_token_age");
    }
    return payload;
  } catch {
    throw new Error(errorMessage);
  }
}

export function receizOAuthSecret() {
  const secret = process.env.RECEIZ_OAUTH_STATE_SECRET ?? process.env.RECEIZ_CLIENT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("RECEIZ_OAUTH_STATE_SECRET must be configured with at least 32 bytes");
  }
  return secret;
}

export function oauthFlowNonceMatches(expected: string | undefined, actual: string) {
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function receizPlayerSubjectKey(subject: string, secret = receizOAuthSecret()) {
  const stableSubject = subject.trim();
  if (!stableSubject) throw new Error("Receiz player subject is required");
  return createHmac("sha256", secret)
    .update(SUBJECT_PURPOSE)
    .update("\0")
    .update(stableSubject)
    .digest("hex");
}

export function packReceizOAuthState(payload: ReceizOAuthStatePayload, secret = receizOAuthSecret()) {
  return pack(payload, secret, STATE_PURPOSE);
}

export function unpackReceizOAuthState(token: string, secret = receizOAuthSecret()) {
  return unpack<ReceizOAuthStatePayload>(token, secret, STATE_PURPOSE, "Invalid Receiz OAuth state", 10 * 60 * 1000);
}

export function packReceizSessionTicket(payload: ReceizSessionTicketPayload, secret = receizOAuthSecret()) {
  return pack({
    accessToken: payload.accessToken,
    expiresIn: payload.expiresIn,
    returnTo: payload.returnTo,
    sessionScope: payload.sessionScope,
    flowNonce: payload.flowNonce,
    startOrigin: payload.startOrigin,
    ...(payload.issuedAt === undefined ? {} : { issuedAt: payload.issuedAt })
  }, secret, TICKET_PURPOSE);
}

export function unpackReceizSessionTicket(token: string, secret = receizOAuthSecret()) {
  return unpack<ReceizSessionTicketPayload>(token, secret, TICKET_PURPOSE, "Invalid Receiz session ticket", 2 * 60 * 1000);
}
