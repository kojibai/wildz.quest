import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { ReceizProofAuthorityChallengeV123, ReceizProofAuthorityV123 } from "@receiz/sdk";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import {
  hasExactWildsWalletReadAuthorityScopes,
  WILDS_WALLET_AUTHORITY_WINDOW_PULSES,
  WILDS_WALLET_READ_AUTHORITY_SCOPES
} from "./wilds-wallet-authority-scopes";

const APPLICATION_ID = "wildz.quest";
const WALLET_READ_SCOPE = "receiz:wallet.read";
const TICKET_PURPOSE = "receiz.wildz.wallet_read_authority.v1";
const TICKET_VERSION = "v1";

export type WildsWalletIdentitySession = Readonly<{
  keyId: string;
  actorId?: string;
  profileHandle?: string;
}>;

type WalletAuthorityTicket = Readonly<{
  applicationId: typeof APPLICATION_ID;
  keyId: string;
  actorId?: string;
  profileHandle?: string;
  nonce: string;
  issuedAtKai: number;
  expiresAtKai: number;
  statementDigest: string;
}>;

function encryptionKey(secret: string) {
  return createHash("sha256").update(`${TICKET_PURPOSE}\0`).update(secret).digest();
}

function packTicket(payload: WalletAuthorityTicket, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(TICKET_PURPOSE));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [TICKET_VERSION, iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

function unpackTicket(token: string, secret: string): WalletAuthorityTicket {
  try {
    const [version, encodedIv, encodedCiphertext, encodedTag, ...extra] = token.split(".");
    if (version !== TICKET_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra.length) throw new Error("shape");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(encodedIv, "base64url"));
    decipher.setAAD(Buffer.from(TICKET_PURPOSE));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final()
    ]).toString("utf8")) as WalletAuthorityTicket;
  } catch {
    throw new Error("receiz_wallet_identity_authority_ticket_invalid");
  }
}

function exactRecord(value: unknown, allowed: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("receiz_wallet_identity_authority_invalid");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw new Error("receiz_wallet_identity_authority_invalid");
  return record;
}

function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function issueWildsWalletIdentityAuthorityChallenge(input: Readonly<{
  session: WildsWalletIdentitySession;
  nowKai: number;
  nonce: string;
}>, secret: string) {
  const hasCompleteSessionBinding = Boolean(input.session.actorId && input.session.profileHandle);
  if (!/^[a-f0-9]{64}$/.test(input.session.keyId)
    || Boolean(input.session.actorId) !== Boolean(input.session.profileHandle)
    || !Number.isSafeInteger(input.nowKai) || !input.nonce || input.nonce.length > 256) {
    throw new Error("receiz_wallet_identity_authority_challenge_invalid");
  }
  const statementDigest = sha256Text("Wildz may identify this Receiz ID and refresh its wallet projection for 60 Kai pulses. Moving value requires a fresh exact edge signature from this Receiz ID.");
  const unsigned = Object.freeze({
    schema: "receiz.identity.proof-authority-challenge.v123" as const,
    audience: APPLICATION_ID,
    nonce: input.nonce,
    issuedAtKai: input.nowKai,
    expiresAtKai: input.nowKai + WILDS_WALLET_AUTHORITY_WINDOW_PULSES,
    consent: Object.freeze({ approved: true, statementDigest })
  });
  const ticket = packTicket({
    applicationId: APPLICATION_ID,
    keyId: input.session.keyId,
    ...(hasCompleteSessionBinding ? { actorId: input.session.actorId, profileHandle: input.session.profileHandle } : {}),
    nonce: input.nonce,
    issuedAtKai: unsigned.issuedAtKai,
    expiresAtKai: unsigned.expiresAtKai,
    statementDigest
  }, secret);
  return Object.freeze({
    challenge: Object.freeze({ applicationId: APPLICATION_ID, scopes: WILDS_WALLET_READ_AUTHORITY_SCOPES, keyId: input.session.keyId, unsigned }),
    ticket
  });
}

type CompletionDependencies = Readonly<{
  secret: string;
  exchange(input: Readonly<{ artifact: string; challenge: ReceizProofAuthorityChallengeV123; applicationId: string; scopes: readonly string[] }>): Promise<unknown>;
  validate(value: unknown): Promise<ReceizProofAuthorityV123>;
  loadProfile(accessToken: string): Promise<{ id: string; handle: string } | null>;
  introspect(accessToken: string): Promise<unknown>;
  artifactDigest(artifact: string): Promise<string>;
}>;

export async function completeWildsWalletIdentityAuthority(input: Readonly<{
  session?: WildsWalletIdentitySession;
  ticket: string;
  body: unknown;
}>, dependencies: CompletionDependencies) {
  const ticket = unpackTicket(input.ticket, dependencies.secret);
  if (ticket.applicationId !== APPLICATION_ID
    || (input.session && (ticket.keyId !== input.session.keyId
      || ticket.actorId !== input.session.actorId
      || !ticket.profileHandle || !input.session.profileHandle
      || !sameWildzPlayerCoordinate(ticket.profileHandle, input.session.profileHandle)))) {
    throw new Error("receiz_wallet_identity_authority_binding_invalid");
  }
  const body = exactRecord(input.body, ["artifact", "challenge"]);
  if (typeof body.artifact !== "string" || !body.artifact) throw new Error("receiz_wallet_identity_authority_invalid");
  const challenge = exactRecord(body.challenge, ["schema", "audience", "nonce", "issuedAtKai", "expiresAtKai", "consent", "proof"]);
  const consent = exactRecord(challenge.consent, ["approved", "statementDigest"]);
  if (challenge.schema !== "receiz.identity.proof-authority-challenge.v123" || challenge.audience !== APPLICATION_ID
    || challenge.nonce !== ticket.nonce || challenge.issuedAtKai !== ticket.issuedAtKai || challenge.expiresAtKai !== ticket.expiresAtKai
    || consent.approved !== true || consent.statementDigest !== ticket.statementDigest || !challenge.proof) {
    throw new Error("receiz_wallet_identity_authority_challenge_invalid");
  }
  const artifactDigest = await dependencies.artifactDigest(body.artifact);
  const authority = await dependencies.validate(await dependencies.exchange({
    artifact: body.artifact,
    challenge: body.challenge as ReceizProofAuthorityChallengeV123,
    applicationId: APPLICATION_ID,
    scopes: WILDS_WALLET_READ_AUTHORITY_SCOPES
  }));
  if (authority.applicationId !== APPLICATION_ID || authority.keyId !== ticket.keyId
    || authority.artifactDigest !== artifactDigest || authority.nonce !== ticket.nonce
    || authority.issuedAtKai !== ticket.issuedAtKai || authority.expiresAtKai !== ticket.expiresAtKai
    || authority.expiresIn !== 300 || !hasExactWildsWalletReadAuthorityScopes(authority.grantedScopes)) {
    throw new Error("receiz_wallet_identity_authority_response_invalid");
  }
  const profile = await dependencies.loadProfile(authority.accessToken);
  const coordinate = profile?.handle ? parseWildzPlayerCoordinate(profile.handle) : null;
  if (!profile?.id || !coordinate || (ticket.profileHandle && !sameWildzPlayerCoordinate(coordinate.profileHandle, ticket.profileHandle))) {
    throw new Error("receiz_wallet_identity_authority_profile_invalid");
  }
  const introspectionValue = await dependencies.introspect(authority.accessToken);
  if (!introspectionValue || typeof introspectionValue !== "object" || Array.isArray(introspectionValue)) {
    throw new Error("receiz_wallet_identity_authority_token_invalid");
  }
  const introspection = introspectionValue as Record<string, unknown>;
  const scopes = typeof introspection.scope === "string" ? introspection.scope.split(/\s+/) : [];
  if (introspection.active !== true || introspection.sub !== profile.id || !scopes.includes(WALLET_READ_SCOPE)) {
    throw new Error("receiz_wallet_identity_authority_token_invalid");
  }
  return Object.freeze({
    accessToken: authority.accessToken,
    expiresIn: authority.expiresIn,
    grantedScopes: WILDS_WALLET_READ_AUTHORITY_SCOPES,
    keyId: authority.keyId,
    actorId: coordinate.actorId,
    profileHandle: coordinate.profileHandle
  });
}
