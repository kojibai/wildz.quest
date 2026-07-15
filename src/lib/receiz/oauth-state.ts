import { createHmac, timingSafeEqual } from "node:crypto";

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
  refreshToken?: string;
  expiresIn: number;
  returnTo: string;
  sessionScope: string;
  flowNonce: string;
  startOrigin: string;
  issuedAt?: number;
};

function b64url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verify(payload: string, signature: string, secret: string) {
  const expected = sign(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

function pack<T extends { issuedAt?: number }>(payload: T, secret: string) {
  const body = b64url(JSON.stringify({ ...payload, issuedAt: payload.issuedAt ?? Date.now() }));
  return `${body}.${sign(body, secret)}`;
}

function unpack<T>(token: string, secret: string, errorMessage: string, maxAgeMs: number): T {
  const [body, signature] = token.split(".");
  if (!body || !signature || !verify(body, signature, secret)) {
    throw new Error(errorMessage);
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { issuedAt?: number };
  if (!payload.issuedAt || payload.issuedAt > Date.now() + 30_000 || Date.now() - payload.issuedAt > maxAgeMs) {
    throw new Error(errorMessage);
  }

  return payload;
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

export function packReceizOAuthState(payload: ReceizOAuthStatePayload, secret = receizOAuthSecret()) {
  return pack(payload, secret);
}

export function unpackReceizOAuthState(token: string, secret = receizOAuthSecret()) {
  return unpack<ReceizOAuthStatePayload>(token, secret, "Invalid Receiz OAuth state", 10 * 60 * 1000);
}

export function packReceizSessionTicket(payload: ReceizSessionTicketPayload, secret = receizOAuthSecret()) {
  return pack(payload, secret);
}

export function unpackReceizSessionTicket(token: string, secret = receizOAuthSecret()) {
  return unpack<ReceizSessionTicketPayload>(token, secret, "Invalid Receiz session ticket", 2 * 60 * 1000);
}
