import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import {
  RECEIZ_SDK_VERSION, digestReceizCanonicalV122, normalizeReceizNativeValueRecipientV123,
  receizKaiNow, receizOidcScopesForRails, validateReceizValueExecutionOutcomeV123,
  validateReceizValueIntentV122, validateReceizValueTransferSourceV123,
  type ReceizProofAuthorityChallengeV123, type ReceizValueTransferSourceV123,
  type ReceizWorldValueIntentV122
} from "@receiz/sdk";
import { createReceizCommerceAdapter, type ReceizCommerceAdapter } from "./adapter";
import { receizOAuthSecret } from "./oauth-state";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";
import { wildsWalletTransferConsentStatementDigest } from "./wilds-wallet-transfer-consent";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";
import type { WildsWalletTransferRouteRuntime } from "./wilds-wallet-route-handlers";

type Rail = Pick<ReceizCommerceAdapter, "nativeValueTransferSourceV123" | "grantedScopesV124"
  | "nativeValueTransferCapabilitiesV123"
  | "planPhiSettlementV123" | "planPhiReserveV123" | "exchangeProofAuthorityV123"
  | "executePhiSettlementV123" | "executePhiReserveV123" | "phiExecutionByIdempotencyKeyV123">;
type Source = Extract<ReceizValueTransferSourceV123, { status: "available" }>;
type Attempt = Readonly<{
  schema: "wildz.wallet.native-attempt.v1"; ownerReceizId: string; actorId: string; profileHandle: string;
  source: Source; intent: ReceizWorldValueIntentV122; issuedAtKai: number;
  reviewExpiresAtKai: number; handleExpiresAtKai: number;
}>;
const PURPOSE = "receiz.wildz.wallet-native-attempt.v1";
const RECEIVE = "receiz.wildz.wallet-native-receive.v1";
const MAX_AMOUNT = 9_223_372_036_854_775_807n;
const RECOVERY_PULSES = 86_400;
const HANDLE = /^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{2,8192}\.[A-Za-z0-9_-]{22}$/;
const amount = (v: string) => /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= MAX_AMOUNT;
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("wilds_wallet_transfer_attempt_invalid");
  return v as Record<string, unknown>;
};
function cipherKey(secret: string, purpose: string) { return createHash("sha256").update(purpose).update("\0").update(secret).digest(); }
function seal(value: unknown, secret: string, purpose = PURPOSE) {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", cipherKey(secret, purpose), iv);
  c.setAAD(Buffer.from(purpose));
  const bytes = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return `v2.${iv.toString("base64url")}.${bytes.toString("base64url")}.${c.getAuthTag().toString("base64url")}`;
}
function unseal(token: string, secret: string, purpose = PURPOSE): unknown {
  try {
    if (!HANDLE.test(token)) throw Error("shape");
    const [, iv, bytes, tag] = token.split(".");
    const c = createDecipheriv("aes-256-gcm", cipherKey(secret, purpose), Buffer.from(iv!, "base64url"));
    c.setAAD(Buffer.from(purpose)); c.setAuthTag(Buffer.from(tag!, "base64url"));
    return JSON.parse(Buffer.concat([c.update(Buffer.from(bytes!, "base64url")), c.final()]).toString("utf8"));
  } catch { throw Error("wilds_wallet_transfer_attempt_invalid"); }
}
function bindSource(source: Source, authority: WildsWalletReadAuthority) {
  if (source.userId !== authority.ownerReceizId || !sameWildzPlayerCoordinate(source.source.ownerReceizId, authority.profileHandle)) {
    throw Error("wilds_wallet_transfer_attempt_identity_mismatch");
  }
}
export function createWildsWalletNativeTransferRuntime(input: Readonly<{
  createAdapter(accessToken: string): Rail; secret?: string; now?: () => number;
}> = { createAdapter: accessToken => createReceizCommerceAdapter({ accessToken }) }): WildsWalletTransferRouteRuntime {
  const secret = input.secret ?? receizOAuthSecret();
  if (Buffer.byteLength(secret, "utf8") < 32) throw Error("receiz_wallet_transfer_dependencies_unavailable");
  const now = input.now ?? (() => receizKaiNow().pulse);
  const open = async (authority: WildsWalletReadAuthority, token: string) => {
    const r = record(unseal(token, secret));
    if (r.schema !== "wildz.wallet.native-attempt.v1" || r.ownerReceizId !== authority.ownerReceizId
      || r.actorId !== authority.actorId || r.profileHandle !== authority.profileHandle) throw Error("wilds_wallet_transfer_attempt_identity_mismatch");
    const intent = r.intent as ReceizWorldValueIntentV122;
    if (!intent || !amount(intent.amountPhiMicro) || !await validateReceizValueIntentV122(intent)) throw Error("wilds_wallet_transfer_attempt_invalid");
    const source = validateReceizValueTransferSourceV123(r.source, { rail: intent.rail, recipientUsername: String(record(record(r.source).destination).username), amountPhiMicro: intent.amountPhiMicro });
    if (source.status !== "available") throw Error("wilds_wallet_transfer_attempt_invalid");
    bindSource(source, authority);
    if (intent.sourceProofObjectId !== source.source.proofObjectId || intent.sourceValueHead !== source.source.currentHead
      || intent.destinationSubjectId !== source.destination.subjectId || intent.expectedDestinationHead !== source.destination.currentHead
      || intent.priceBasisDigest !== await digestReceizCanonicalV122(source.priceBasis)) throw Error("wilds_wallet_transfer_attempt_invalid");
    if (![r.issuedAtKai, r.reviewExpiresAtKai, r.handleExpiresAtKai].every(Number.isSafeInteger)
      || Number(r.reviewExpiresAtKai) !== Number(r.issuedAtKai) + 120
      || Number(r.handleExpiresAtKai) !== Number(r.issuedAtKai) + RECOVERY_PULSES) throw Error("wilds_wallet_transfer_attempt_invalid");
    if (now() < Number(r.issuedAtKai)) throw Error("wilds_wallet_transfer_clock_unavailable");
    if (now() >= Number(r.handleExpiresAtKai)) throw Error("wilds_wallet_transfer_attempt_expired");
    return { ...r, source, intent } as Attempt;
  };
  const unknown = (a: Attempt) => ({ status: "unknown" as const, rail: a.intent.rail, amountPhiMicro: a.intent.amountPhiMicro });
  const zero = (a: Attempt, code: string) => ({ status: "zero-write" as const, rail: a.intent.rail, code });
  const project = async (value: unknown, a: Attempt) => {
    const o = await validateReceizValueExecutionOutcomeV123(value);
    if (o.status === "unknown") return unknown(a);
    if (o.rail !== a.intent.rail) throw Error("wilds_wallet_native_outcome_binding_invalid");
    if (o.status === "zero-write") return zero(a, o.failure.code);
    if (await digestReceizCanonicalV122(o.intent) !== await digestReceizCanonicalV122(a.intent)
      || o.proofReferences.length !== 2
      || !o.proofReferences.some(p => p.objectId === a.source.source.proofObjectId && p.head === o.sourceHead && p.proofDigest === a.source.source.admittedProofDigest)
      || !o.proofReferences.some(p => p.objectId === a.source.destination.proofObjectId && p.head === o.destinationHead && p.proofDigest === a.source.destination.admittedProofDigest)) {
      throw Error("wilds_wallet_native_outcome_binding_invalid");
    }
    return { status: "committed" as const, rail: a.intent.rail, amountPhiMicro: a.intent.amountPhiMicro, recipientUsername: a.source.destination.username };
  };
  const resolve = async (rail: Rail, a: Attempt) => {
    try { return await project(await rail.phiExecutionByIdempotencyKeyV123(a.intent.idempotencyKey!), a); }
    catch { return unknown(a); }
  };
  return Object.freeze({
    durable: true as const, recipientLookupAdmission: "native-value" as const,
    async capabilityAdmission(authority) {
      const rail = input.createAdapter(authority.accessToken);
      const [grantedScopes, native] = await Promise.all([rail.grantedScopesV124(), rail.nativeValueTransferCapabilitiesV123()]);
      if (native.userId !== authority.ownerReceizId) throw Error("wilds_wallet_transfer_attempt_identity_mismatch");
      const ready = typeof rail.nativeValueTransferSourceV123 === "function" && typeof rail.exchangeProofAuthorityV123 === "function"
        && typeof rail.phiExecutionByIdempotencyKeyV123 === "function";
      return { sdkVersion: RECEIZ_SDK_VERSION, grantedScopes, deviceEdge: { sourceAvailable: native.sourceAvailable, registeredScopes: native.registeredScopes }, rails: { proofAuthorityExchange: ready,
        settlementExecution: ready && typeof rail.executePhiSettlementV123 === "function",
        reserveExecution: ready && typeof rail.executePhiReserveV123 === "function", valueExecutionRecovery: ready,
        worldPlanning: false, worldExecution: false, subjectNamespaces: false } };
    },
    async preview(authority, command) {
      if (!amount(command.amountPhiMicro)) throw Error("wilds_wallet_transfer_request_invalid");
      let recipientUsername = command.recipientUsername;
      if (!recipientUsername && command.recipientLocator?.startsWith("wildz:receive:")) {
        const r = record(unseal(command.recipientLocator.slice(14), secret, RECEIVE));
        if (r.schema !== "wildz.wallet.native-receive.v1" || !Number.isSafeInteger(r.issuedAtKai) || !Number.isSafeInteger(r.expiresAtKai)
          || now() < Number(r.issuedAtKai) || now() >= Number(r.expiresAtKai)) throw Error("wilds_wallet_receive_locator_expired");
        recipientUsername = String(r.recipientUsername);
      }
      if (!recipientUsername) throw Error("wilds_wallet_transfer_request_invalid");
      const recipient = normalizeReceizNativeValueRecipientV123(recipientUsername);
      const rail = input.createAdapter(authority.accessToken);
      const [source, scopes] = await Promise.all([
        rail.nativeValueTransferSourceV123({ rail: command.rail, recipientUsername: recipient, amountPhiMicro: command.amountPhiMicro }), rail.grantedScopesV124()
      ]);
      if (!scopes.includes("receiz:wallet.read")) throw Error("receiz_wallet_read_scope_required");
      if (source.status !== "available") throw Error(`wilds_wallet_native_source_${source.code.toLowerCase()}`);
      bindSource(source, authority);
      const semanticKey = `wildz-wallet-native:${createHmac("sha256", cipherKey(secret, PURPOSE)).update(authority.ownerReceizId).update("\0").update(authority.actorId).update("\0").update(command.operationNonce).digest("hex")}`;
      const plan = command.rail === "settlement" ? rail.planPhiSettlementV123 : rail.planPhiReserveV123;
      const intent = await plan({ amountPhiMicro: command.amountPhiMicro, sourceProofObjectId: source.source.proofObjectId,
        sourceValueHead: source.source.currentHead, destinationSubjectId: source.destination.subjectId, expectedDestinationHead: source.destination.currentHead,
        usdPerPhiMicrocents: source.usdPerPhiMicrocents, priceBasis: source.priceBasis, idempotencyKey: semanticKey });
      const issuedAtKai = now();
      const a: Attempt = { schema: "wildz.wallet.native-attempt.v1", ownerReceizId: authority.ownerReceizId,
        actorId: authority.actorId, profileHandle: authority.profileHandle, source, intent, issuedAtKai,
        reviewExpiresAtKai: issuedAtKai + 120, handleExpiresAtKai: issuedAtKai + RECOVERY_PULSES };
      return { status: "staged", rail: command.rail, amountPhiMicro: command.amountPhiMicro,
        quotedUsdCents: intent.quotedUsdCents, attempt: seal(a, secret), expiresAtKai: a.reviewExpiresAtKai };
    },
    async execute(authority, request) {
      const a = await open(authority, request.attempt); const rail = input.createAdapter(authority.accessToken);
      const existing = await resolve(rail, a);
      if (existing.status !== "unknown") return existing;
      if (now() >= a.reviewExpiresAtKai) throw Error("wilds_wallet_transfer_review_expired");
      const challenge = request.consent.challenge as ReceizProofAuthorityChallengeV123;
      if (!challenge || challenge.audience !== WILDZ_RECEIZ_APPLICATION_ID || challenge.consent?.approved !== true
        || challenge.consent.statementDigest !== await wildsWalletTransferConsentStatementDigest({ attempt: request.attempt, amountPhiMicro: a.intent.amountPhiMicro, rail: a.intent.rail })) {
        throw Error("wilds_wallet_transfer_consent_binding_invalid");
      }
      const source = await rail.nativeValueTransferSourceV123({ rail: a.intent.rail, recipientUsername: a.source.destination.username, amountPhiMicro: a.intent.amountPhiMicro });
      if (source.status !== "available") return zero(a, source.code);
      bindSource(source, authority);
      const same = (left: Source, right: Source) => digestReceizCanonicalV122({ source: left.source, destination: left.destination, rate: left.usdPerPhiMicrocents, price: left.priceBasis })
        .then(async d => d === await digestReceizCanonicalV122({ source: { ...right.source, balancePhiMicro: left.source.balancePhiMicro }, destination: right.destination, rate: right.usdPerPhiMicrocents, price: right.priceBasis }));
      if (!await same(a.source, source)) return zero(a, "STALE_HEAD");
      if (BigInt(source.source.balancePhiMicro) < BigInt(a.intent.amountPhiMicro)) return zero(a, "INSUFFICIENT_PHI");
      const grant = await rail.exchangeProofAuthorityV123({ artifact: request.consent.artifact as string, challenge,
        applicationId: WILDZ_RECEIZ_APPLICATION_ID, scopes: receizOidcScopesForRails(a.intent.rail) });
      try {
        const outcome = a.intent.rail === "settlement" ? await rail.executePhiSettlementV123(a.intent, grant) : await rail.executePhiReserveV123(a.intent, grant);
        return await project(outcome, a);
      } catch { return resolve(rail, a); }
    },
    async status(authority, token) { const a = await open(authority, token); return resolve(input.createAdapter(authority.accessToken), a); },
    async receive(authority, amountPhiMicro) {
      const issuedAtKai = now();
      return { locator: `wildz:receive:${seal({ schema: "wildz.wallet.native-receive.v1", recipientUsername: normalizeReceizNativeValueRecipientV123(authority.profileHandle), issuedAtKai, expiresAtKai: issuedAtKai + RECOVERY_PULSES }, secret, RECEIVE)}`,
        request: amountPhiMicro === null ? null : { kind: "phi", amountPhiMicro, authority: "non-authoritative" } };
    }
  } satisfies WildsWalletTransferRouteRuntime);
}
