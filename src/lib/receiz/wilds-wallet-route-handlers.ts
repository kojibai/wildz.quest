import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter, type ReceizCommerceAdapter } from "./adapter";
import { receizOAuthSecret } from "./oauth-state";
import {
  normalizeWildsWalletCursor,
  normalizeWildsWalletPublicUsername,
  parseWildsWalletMicroPhi,
  projectWildsWalletCapabilities,
  projectWildsWalletLedgerPage,
  projectWildsWalletRecipient,
  projectWildsWalletSummary
} from "./wilds-wallet-projections";
import type { WalletCapabilityAdmission } from "./wilds-wallet-projections";
import {
  resolveWildsWalletReadAuthority,
  type WildsWalletReadAuthority
} from "./wilds-wallet-route-authority";
import {
  exchangeWildsWalletProofAuthority,
  executeWildsWalletPhiTransfer,
  recoverWildsWalletPhiTransfer,
  stageWildsWalletPhiTransfer,
  type WildsWalletPhiTransferInput,
  type WildsWalletPhiTransferProjection,
  type WildsWalletProofAuthorityAdmissionPort
} from "./wilds-wallet-transfer";
import { wildsWalletTransferConsentStatementDigest } from "./wilds-wallet-transfer-consent";
import type {
  WildsWalletTransferJournalPort,
  WildsWalletTransferTerminalIntegrityBasis,
  WildsWalletTransferTerminalIntegrityPort
} from "./wilds-wallet-transfer-journal";
import { receizOidcScopesForRails, type ReceizValueRailV122 } from "@receiz/sdk";

const RECIPIENT_LOOKUP_LIMIT = 6;
const RECIPIENT_LOOKUP_WINDOW_SECONDS = 60;

type WalletAdapter = Pick<ReceizCommerceAdapter, "walletSummary" | "walletLedger" | "worldProfile">;
type WalletTransferAdapter = Pick<
  ReceizCommerceAdapter,
  | "planPhiSettlementV123"
  | "planPhiReserveV123"
  | "validatePhiIntentV123"
  | "executePhiSettlementV123"
  | "executePhiReserveV123"
  | "phiExecutionByIdempotencyKeyV123"
  | "exchangeProofAuthorityV123"
>;

export type WildsWalletTransferPreviewCommand = Readonly<{
  recipientUsername?: string;
  recipientLocator?: string;
  amountPhiMicro: string;
  rail: ReceizValueRailV122;
  operationNonce: string;
}>;

export type WildsWalletStagedTransferProjection = Readonly<{
  status: "staged";
  rail: ReceizValueRailV122;
  amountPhiMicro: string;
  quotedUsdCents: string;
  attempt: string;
  expiresAtKai: number;
}>;

export type WildsWalletTransferConsent = Readonly<{ artifact: unknown; challenge: unknown }>;

export interface WildsWalletTransferRouteRuntime {
  readonly durable: true;
  capabilityAdmission(authority: WildsWalletReadAuthority): Promise<WalletCapabilityAdmission>;
  preview(
    authority: WildsWalletReadAuthority,
    input: WildsWalletTransferPreviewCommand
  ): Promise<unknown>;
  execute(
    authority: WildsWalletReadAuthority,
    input: Readonly<{ attempt: string; consent: WildsWalletTransferConsent }>
  ): Promise<unknown>;
  status(authority: WildsWalletReadAuthority, attempt: string): Promise<unknown>;
  receive(authority: WildsWalletReadAuthority, amountPhiMicro: string | null): Promise<unknown>;
}

export type WildsWalletReceiveBinding = Readonly<{
  applicationId: string;
  destinationSubjectId: string;
  expectedDestinationHead: string;
}>;

export interface WildsWalletServerTransferContextPort {
  readonly serverDerived: true;
  resolve(input: Readonly<{
    authority: WildsWalletReadAuthority;
    command: WildsWalletTransferPreviewCommand;
    idempotencyKey: string;
    destinationBinding: WildsWalletReceiveBinding | null;
  }>): Promise<WildsWalletPhiTransferInput & Readonly<{
    /** Re-resolved same-request account identity; must equal authority.ownerReceizId. */
    authenticatedOwnerReceizId: string;
    grantedScopes: readonly string[];
  }>>;
  capabilityAdmission(authority: WildsWalletReadAuthority): Promise<WalletCapabilityAdmission>;
  receiveBinding(authority: WildsWalletReadAuthority): Promise<WildsWalletReceiveBinding>;
}

type AttemptPayload = Readonly<{
  schema: "wildz.wallet.transfer-attempt.v1";
  ownerReceizId: string;
  actorId: string;
  profileHandle: string;
  ownerBinding: string;
  applicationId: string;
  idempotencyKey: string;
  rail: ReceizValueRailV122;
  amountPhiMicro: string;
  issuedAtKai: number;
  reviewExpiresAtKai: number;
  handleExpiresAtKai: number;
}>;

const ATTEMPT_PURPOSE = "receiz.wildz.wallet_transfer_attempt.v1";
const RECEIVE_PURPOSE = "receiz.wildz.wallet_receive_locator.v1";
const TERMINAL_PURPOSE = "receiz.wildz.wallet_transfer_terminal.v1";
const ATTEMPT_VERSION = "v1";
// V123 proof-authority fixtures use the same 120-Kai consent interval. At the
// canonical ~5.236 second pulse this is about 10.5 minutes.
const ATTEMPT_REVIEW_KAI = 120;
// Five canonical days, bounded and enforced by durable journal cleanup.
const ATTEMPT_RECOVERY_KAI = 86_400;
const OPAQUE_ATTEMPT = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{2,4096}\.[A-Za-z0-9_-]{16,}$/;
const OPERATION_NONCE = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{24,128})$/i;

function purposeKey(secret: string, purpose: string) {
  return createHash("sha256").update(purpose).update("\0").update(secret).digest();
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  throw new Error("wilds_wallet_transfer_journal_invalid");
}

function validAttemptText(value: unknown) {
  return typeof value === "string" && OPAQUE_ATTEMPT.test(value);
}

function sealAttempt(payload: AttemptPayload, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", purposeKey(secret, ATTEMPT_PURPOSE), iv);
  cipher.setAAD(Buffer.from(ATTEMPT_PURPOSE));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [ATTEMPT_VERSION, iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

function openAttempt(value: string, secret: string): AttemptPayload {
  try {
    if (!validAttemptText(value)) throw new Error("shape");
    const [version, encodedIv, encodedPayload, encodedTag, ...extra] = value.split(".");
    if (version !== ATTEMPT_VERSION || extra.length) throw new Error("shape");
    const iv = Buffer.from(encodedIv, "base64url");
    const encrypted = Buffer.from(encodedPayload, "base64url");
    const tag = Buffer.from(encodedTag, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length < 1) throw new Error("shape");
    const decipher = createDecipheriv("aes-256-gcm", purposeKey(secret, ATTEMPT_PURPOSE), iv);
    decipher.setAAD(Buffer.from(ATTEMPT_PURPOSE));
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as AttemptPayload;
    if (payload.schema !== "wildz.wallet.transfer-attempt.v1"
      || !validPrivate(payload.ownerReceizId)
      || !validPrivate(payload.actorId)
      || !validPrivate(payload.profileHandle)
      || !validPrivate(payload.ownerBinding)
      || !validPrivate(payload.applicationId)
      || !validPrivate(payload.idempotencyKey)
      || (payload.rail !== "settlement" && payload.rail !== "reserve")
      || !isMicroPhi(payload.amountPhiMicro)
      || !Number.isSafeInteger(payload.issuedAtKai)
      || !Number.isSafeInteger(payload.reviewExpiresAtKai)
      || !Number.isSafeInteger(payload.handleExpiresAtKai)
      || payload.reviewExpiresAtKai <= payload.issuedAtKai
      || payload.handleExpiresAtKai <= payload.reviewExpiresAtKai) throw new Error("payload");
    return Object.freeze(payload);
  } catch {
    throw new Error("wilds_wallet_transfer_attempt_invalid");
  }
}

function idempotencyFor(authority: WildsWalletReadAuthority, operationNonce: string, secret: string) {
  return `wildz-wallet-v1:${createHmac("sha256", purposeKey(secret, ATTEMPT_PURPOSE))
    .update(authority.ownerReceizId).update("\0")
    .update(authority.actorId).update("\0")
    .update(authority.profileHandle).update("\0")
    .update(operationNonce).digest("hex")}`;
}

type ReceiveLocatorPayload = Readonly<{
  schema: "wildz.wallet.receive-locator.v1";
  applicationId: string;
  destinationSubjectId: string;
  expectedDestinationHead: string;
  issuedAtKai: number;
  expiresAtKai: number;
}>;

function sealReceiveLocator(payload: ReceiveLocatorPayload, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", purposeKey(secret, RECEIVE_PURPOSE), iv);
  cipher.setAAD(Buffer.from(RECEIVE_PURPOSE));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `wildz:receive:${[ATTEMPT_VERSION, iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".")}`;
}

function openReceiveLocator(locator: string, secret: string): ReceiveLocatorPayload {
  try {
    if (!locator.startsWith("wildz:receive:")) throw new Error("shape");
    const [version, encodedIv, encodedPayload, encodedTag, ...extra] = locator.slice("wildz:receive:".length).split(".");
    if (version !== ATTEMPT_VERSION || !encodedIv || !encodedPayload || !encodedTag || extra.length) throw new Error("shape");
    const iv = Buffer.from(encodedIv, "base64url");
    const encrypted = Buffer.from(encodedPayload, "base64url");
    const tag = Buffer.from(encodedTag, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length < 1) throw new Error("shape");
    const decipher = createDecipheriv("aes-256-gcm", purposeKey(secret, RECEIVE_PURPOSE), iv);
    decipher.setAAD(Buffer.from(RECEIVE_PURPOSE));
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as ReceiveLocatorPayload;
    if (payload.schema !== "wildz.wallet.receive-locator.v1" || !validPrivate(payload.applicationId)
      || !validPrivate(payload.destinationSubjectId) || !/^[a-f0-9]{64}$/.test(payload.expectedDestinationHead)
      || !Number.isSafeInteger(payload.issuedAtKai) || !Number.isSafeInteger(payload.expiresAtKai)
      || payload.expiresAtKai <= payload.issuedAtKai) throw new Error("payload");
    return Object.freeze(payload);
  } catch {
    throw new Error("wilds_wallet_receive_locator_invalid");
  }
}

function validPrivate(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256;
}

function isMicroPhi(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,29}$/.test(value);
}

function exactTransferProjection(value: unknown): WildsWalletPhiTransferProjection {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  if (!item || (item.rail !== "settlement" && item.rail !== "reserve")) throw new Error("wilds_wallet_transfer_projection_invalid");
  const exact = (keys: readonly string[]) => {
    const actual = Object.keys(item).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
  };
  if ((item.status === "preview" || item.status === "staged")
    && exact(["status", "rail", "amountPhiMicro", "quotedUsdCents"])
    && isMicroPhi(item.amountPhiMicro)
    && typeof item.quotedUsdCents === "string" && /^[0-9]{1,30}$/.test(item.quotedUsdCents)) return Object.freeze(item) as WildsWalletPhiTransferProjection;
  if (item.status === "unknown" && exact(["status", "rail", "amountPhiMicro"]) && isMicroPhi(item.amountPhiMicro)) return Object.freeze(item) as WildsWalletPhiTransferProjection;
  if (item.status === "zero-write" && exact(["status", "rail", "code"]) && typeof item.code === "string" && /^[A-Z_]{3,64}$/.test(item.code)) return Object.freeze(item) as WildsWalletPhiTransferProjection;
  if (item.status === "committed" && exact(["status", "rail", "amountPhiMicro"]) && isMicroPhi(item.amountPhiMicro)) return Object.freeze(item) as WildsWalletPhiTransferProjection;
  throw new Error("wilds_wallet_transfer_projection_invalid");
}

function exactStagedProjection(value: unknown): WildsWalletStagedTransferProjection {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const keys = item ? Object.keys(item).sort() : [];
  if (!item || keys.join("\0") !== ["amountPhiMicro", "attempt", "expiresAtKai", "quotedUsdCents", "rail", "status"].sort().join("\0")
    || item.status !== "staged"
    || (item.rail !== "settlement" && item.rail !== "reserve")
    || !isMicroPhi(item.amountPhiMicro)
    || typeof item.quotedUsdCents !== "string" || !/^[0-9]{1,30}$/.test(item.quotedUsdCents)
    || !validAttemptText(item.attempt)
    || !Number.isSafeInteger(item.expiresAtKai)) throw new Error("wilds_wallet_transfer_projection_invalid");
  return Object.freeze(item) as WildsWalletStagedTransferProjection;
}

function exactReceiveProjection(value: unknown) {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const request: Record<string, unknown> | null | undefined = item?.request === null
    ? null
    : item?.request && typeof item.request === "object" && !Array.isArray(item.request)
      ? item.request as Record<string, unknown>
      : undefined;
  const requestValid = request === null || (request !== undefined && exactObject(request, ["amountPhiMicro", "authority", "kind"])
    && request.kind === "phi" && isMicroPhi(request.amountPhiMicro) && request.authority === "non-authoritative");
  if (!item || !exactObject(item, ["locator", "request"]) || typeof item.locator !== "string"
    || !item.locator.startsWith("wildz:receive:v1.") || item.locator.length > 8_192 || !requestValid) {
    throw new Error("wilds_wallet_receive_locator_invalid");
  }
  return Object.freeze({
    locator: item.locator,
    request: request === null ? null : Object.freeze({ kind: "phi" as const, amountPhiMicro: request.amountPhiMicro as string, authority: "non-authoritative" as const })
  });
}

function exactObject(item: Record<string, unknown>, expectedKeys: readonly string[]) {
  const actual = Object.keys(item).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function assertAttemptActor(payload: AttemptPayload, authority: WildsWalletReadAuthority) {
  if (payload.ownerReceizId !== authority.ownerReceizId
    || payload.actorId !== authority.actorId
    || payload.profileHandle !== authority.profileHandle) throw new Error("wilds_wallet_transfer_attempt_identity_mismatch");
}

/**
 * Constructs the live server runtime only when every deployment-owned port is
 * explicitly supplied. The encrypted handle is an authenticated pointer; the
 * durable journal remains the sole recovery store and authority source.
 */
export function createWildsWalletTransferRouteRuntime(input: Readonly<{
  context: WildsWalletServerTransferContextPort;
  journal: WildsWalletTransferJournalPort;
  authorityAdmission: WildsWalletProofAuthorityAdmissionPort;
  createAdapter(accessToken: string): WalletTransferAdapter;
  secret?: string;
}>): WildsWalletTransferRouteRuntime {
  if (input.context.serverDerived !== true || input.journal.durable !== true || input.authorityAdmission.serverDerived !== true) {
    throw new Error("receiz_wallet_transfer_dependencies_unavailable");
  }
  const secret = input.secret ?? receizOAuthSecret();
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("receiz_wallet_transfer_dependencies_unavailable");
  const terminalIntegrity: WildsWalletTransferTerminalIntegrityPort = Object.freeze({
    serverDerived: true as const,
    async digest(basis: WildsWalletTransferTerminalIntegrityBasis) {
      return createHmac("sha256", purposeKey(secret, TERMINAL_PURPOSE)).update(canonicalJson(basis)).digest("hex");
    }
  });
  const openBoundAttempt = async (authority: WildsWalletReadAuthority, attempt: string) => {
    const payload = openAttempt(attempt, secret);
    assertAttemptActor(payload, authority);
    const now = await input.authorityAdmission.currentKai();
    if (!Number.isSafeInteger(now) || now < payload.issuedAtKai) throw new Error("wilds_wallet_transfer_clock_unavailable");
    if (now >= payload.handleExpiresAtKai) throw new Error("wilds_wallet_transfer_attempt_expired");
    return { payload, now };
  };
  const runtime: WildsWalletTransferRouteRuntime = {
    durable: true as const,
    capabilityAdmission: (authority: WildsWalletReadAuthority) => input.context.capabilityAdmission(authority),
    async preview(authority: WildsWalletReadAuthority, command: WildsWalletTransferPreviewCommand) {
      const cleanupKai = await input.authorityAdmission.currentKai();
      if (!Number.isSafeInteger(cleanupKai) || cleanupKai < 0) throw new Error("wilds_wallet_transfer_clock_unavailable");
      await input.journal.purgeTerminal(cleanupKai, 32);
      const idempotencyKey = idempotencyFor(authority, command.operationNonce, secret);
      const locator = command.recipientLocator ? openReceiveLocator(command.recipientLocator, secret) : null;
      if (locator) {
        const now = await input.authorityAdmission.currentKai();
        if (!Number.isSafeInteger(now) || now < locator.issuedAtKai) throw new Error("wilds_wallet_transfer_clock_unavailable");
        if (now >= locator.expiresAtKai) throw new Error("wilds_wallet_receive_locator_expired");
      }
      const destinationBinding = locator ? Object.freeze({
        applicationId: locator.applicationId,
        destinationSubjectId: locator.destinationSubjectId,
        expectedDestinationHead: locator.expectedDestinationHead
      }) : null;
      const resolved = await input.context.resolve({ authority, command, idempotencyKey, destinationBinding });
      if (resolved.authenticatedOwnerReceizId !== authority.ownerReceizId
        || resolved.rail !== command.rail
        || resolved.amountPhiMicro !== command.amountPhiMicro
        || resolved.idempotencyKey !== idempotencyKey
        || (destinationBinding !== null && (resolved.applicationId !== destinationBinding.applicationId
          || resolved.destinationSubjectId !== destinationBinding.destinationSubjectId
          || resolved.expectedDestinationHead !== destinationBinding.expectedDestinationHead))) throw new Error("wilds_wallet_transfer_context_invalid");
      // The resolver must expose only scopes introspected on this same request.
      const required = receizOidcScopesForRails(command.rail);
      if (!required.every((scope) => resolved.grantedScopes.includes(scope))) throw new Error("receiz_wallet_phi_scope_required");
      const staged = exactTransferProjection(await stageWildsWalletPhiTransfer(resolved, {
        rail: input.createAdapter(authority.accessToken), journal: input.journal,
        authorityAdmission: input.authorityAdmission, terminalIntegrity
      }));
      if (staged.status !== "staged") throw new Error("wilds_wallet_transfer_projection_invalid");
      const issuedAtKai = await input.authorityAdmission.currentKai();
      if (!Number.isSafeInteger(issuedAtKai) || issuedAtKai < 0) throw new Error("wilds_wallet_transfer_clock_unavailable");
      const attempt = sealAttempt({
        schema: "wildz.wallet.transfer-attempt.v1",
        ownerReceizId: authority.ownerReceizId,
        actorId: authority.actorId,
        profileHandle: authority.profileHandle,
        ownerBinding: resolved.ownerBinding,
        applicationId: resolved.applicationId,
        idempotencyKey,
        rail: command.rail,
        amountPhiMicro: command.amountPhiMicro,
        issuedAtKai,
        reviewExpiresAtKai: issuedAtKai + ATTEMPT_REVIEW_KAI,
        handleExpiresAtKai: issuedAtKai + ATTEMPT_RECOVERY_KAI
      }, secret);
      return Object.freeze({ ...staged, attempt, expiresAtKai: issuedAtKai + ATTEMPT_REVIEW_KAI });
    },
    async execute(authority: WildsWalletReadAuthority, request: Readonly<{ attempt: string; consent: WildsWalletTransferConsent }>) {
      const { payload, now } = await openBoundAttempt(authority, request.attempt);
      await input.journal.purgeTerminal(now, 32);
      if (now >= payload.reviewExpiresAtKai) throw new Error("wilds_wallet_transfer_review_expired");
      const adapter = input.createAdapter(authority.accessToken);
      const consent = request.consent as {
        artifact: Parameters<typeof exchangeWildsWalletProofAuthority>[0]["artifact"];
        challenge: Parameters<typeof exchangeWildsWalletProofAuthority>[0]["challenge"];
      };
      const expectedStatementDigest = await wildsWalletTransferConsentStatementDigest({
        attempt: request.attempt,
        amountPhiMicro: payload.amountPhiMicro,
        rail: payload.rail
      });
      if (consent.challenge?.consent?.statementDigest !== expectedStatementDigest) {
        throw new Error("wilds_wallet_transfer_consent_binding_invalid");
      }
      const authorityContext = await exchangeWildsWalletProofAuthority({
        artifact: consent.artifact,
        challenge: consent.challenge,
        applicationId: payload.applicationId,
        ownerBinding: payload.ownerBinding,
        rail: payload.rail
      }, { rail: adapter, authorityAdmission: input.authorityAdmission });
      return exactTransferProjection(await executeWildsWalletPhiTransfer({
        ownerBinding: payload.ownerBinding,
        idempotencyKey: payload.idempotencyKey,
        authorityContext
      }, {
        rail: adapter,
        journal: input.journal,
        authorityAdmission: input.authorityAdmission,
        terminalIntegrity
      }));
    },
    async status(authority: WildsWalletReadAuthority, attempt: string) {
      const { payload, now } = await openBoundAttempt(authority, attempt);
      await input.journal.purgeTerminal(now, 32);
      return exactTransferProjection(await recoverWildsWalletPhiTransfer({
        ownerBinding: payload.ownerBinding,
        idempotencyKey: payload.idempotencyKey
      }, {
        rail: input.createAdapter(authority.accessToken),
        journal: input.journal,
        authorityAdmission: input.authorityAdmission,
        terminalIntegrity
      }));
    },
    async receive(authority: WildsWalletReadAuthority, amountPhiMicro: string | null) {
      const binding = await input.context.receiveBinding(authority);
      if (!validPrivate(binding.applicationId) || !validPrivate(binding.destinationSubjectId)
        || !/^[a-f0-9]{64}$/.test(binding.expectedDestinationHead)) throw new Error("wilds_wallet_receive_locator_invalid");
      const issuedAtKai = await input.authorityAdmission.currentKai();
      if (!Number.isSafeInteger(issuedAtKai) || issuedAtKai < 0) throw new Error("wilds_wallet_transfer_clock_unavailable");
      return Object.freeze({
        locator: sealReceiveLocator({
          schema: "wildz.wallet.receive-locator.v1",
          ...binding,
          issuedAtKai,
          expiresAtKai: issuedAtKai + ATTEMPT_RECOVERY_KAI
        }, secret),
        request: amountPhiMicro === null ? null : { kind: "phi" as const, amountPhiMicro, authority: "non-authoritative" as const }
      });
    }
  };
  return Object.freeze(runtime);
}

export type WildsWalletRecipientLookupLimiter = Readonly<{
  durable: true;
  consume(input: Readonly<{
    actorId: string;
    limit: number;
    windowSeconds: number;
    scope: "wilds_wallet_recipient_lookup";
  }>): Promise<"allowed" | "limited">;
}>;

export type WildsWalletRouteHandlerDependencies = Readonly<{
  resolveAuthority(request: NextRequest): Promise<WildsWalletReadAuthority>;
  createAdapter(accessToken: string): WalletAdapter;
  recipientLookupLimiter?: WildsWalletRecipientLookupLimiter;
  transferRuntime?: WildsWalletTransferRouteRuntime;
}>;

type WalletRouteFallback =
  | "receiz_wallet_read_unavailable"
  | "receiz_wallet_recipient_unavailable"
  | "receiz_wallet_request_invalid"
  | "receiz_wallet_capabilities_unavailable"
  | "receiz_wallet_transfer_unavailable";

const SAFE_FAILURES = Object.freeze({
  receiz_wallet_read_scope_required: 401,
  receiz_wallet_authority_required: 401,
  receiz_wallet_authority_revoked: 401,
  receiz_wallet_profile_binding_invalid: 403,
  receiz_wallet_token_binding_invalid: 403,
  receiz_wallet_profile_resolution_unavailable: 503,
  receiz_wallet_introspection_unavailable: 503,
  wilds_wallet_cursor_invalid: 400,
  wilds_wallet_request_fields_invalid: 400,
  wilds_wallet_username_invalid: 400,
  wilds_wallet_micro_phi_invalid: 400,
  receiz_wallet_recipient_unavailable: 404,
  receiz_wallet_recipient_rate_limited: 429,
  receiz_wallet_recipient_lookup_unavailable: 503,
  receiz_wallet_read_unavailable: 502,
  receiz_wallet_request_invalid: 400,
  receiz_wallet_capabilities_unavailable: 502,
  receiz_wallet_transfer_unavailable: 502,
  receiz_wallet_transfer_dependencies_unavailable: 503,
  receiz_wallet_phi_scope_required: 401,
  wilds_wallet_transfer_request_invalid: 400,
  wilds_wallet_transfer_origin_invalid: 403,
  wilds_wallet_transfer_attempt_invalid: 400,
  wilds_wallet_transfer_attempt_identity_mismatch: 403,
  wilds_wallet_transfer_attempt_expired: 410,
  wilds_wallet_receive_locator_invalid: 400,
  wilds_wallet_receive_locator_expired: 410,
  wilds_wallet_transfer_review_expired: 409,
  wilds_wallet_transfer_clock_unavailable: 503,
  wilds_wallet_transfer_not_staged: 404,
  wilds_wallet_idempotency_conflict: 409,
  wilds_wallet_proof_authority_challenge_expired: 409,
  wilds_wallet_proof_authority_expired: 409,
  wilds_wallet_proof_authority_revoked: 401
} as const);

type SafeWalletRouteCode = keyof typeof SAFE_FAILURES;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function safeCode(cause: unknown, fallback: WalletRouteFallback): SafeWalletRouteCode {
  const candidate = cause instanceof Error ? cause.message : "";
  return Object.hasOwn(SAFE_FAILURES, candidate) ? candidate as SafeWalletRouteCode : fallback;
}

export function classifyWildsWalletRouteFailure(cause: unknown, fallback: WalletRouteFallback) {
  const error = safeCode(cause, fallback);
  return { status: SAFE_FAILURES[error], body: { error } };
}

function failure(cause: unknown, fallback: WalletRouteFallback) {
  const result = classifyWildsWalletRouteFailure(cause, fallback);
  return json(result.body, result.status);
}

function assertExactFields(value: unknown, fields: readonly string[], required: readonly string[] = fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_wallet_request_fields_invalid");
  const body = value as Record<string, unknown>;
  if (!required.every((field) => Object.hasOwn(body, field)) || !Object.keys(body).every((field) => fields.includes(field))) {
    throw new Error("wilds_wallet_request_fields_invalid");
  }
  return body;
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("wilds_wallet_transfer_origin_invalid");
  try {
    if (new URL(origin).origin !== request.nextUrl.origin) throw new Error("origin");
  } catch {
    throw new Error("wilds_wallet_transfer_origin_invalid");
  }
}

function transferRuntimeOrThrow(runtime: WildsWalletTransferRouteRuntime | undefined) {
  if (!runtime || runtime.durable !== true) throw new Error("receiz_wallet_transfer_dependencies_unavailable");
  return runtime;
}

function transferProjection(value: unknown): WildsWalletPhiTransferProjection {
  return exactTransferProjection(value);
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new Error("wilds_wallet_request_fields_invalid");
  }
}

async function consumeRecipientLookup(limiter: WildsWalletRecipientLookupLimiter | undefined, actorId: string) {
  if (!limiter || limiter.durable !== true) throw new Error("receiz_wallet_recipient_lookup_unavailable");
  try {
    const result = await limiter.consume({
      actorId,
      limit: RECIPIENT_LOOKUP_LIMIT,
      windowSeconds: RECIPIENT_LOOKUP_WINDOW_SECONDS,
      scope: "wilds_wallet_recipient_lookup"
    });
    if (result === "limited") throw new Error("receiz_wallet_recipient_rate_limited");
    if (result !== "allowed") throw new Error("receiz_wallet_recipient_lookup_unavailable");
  } catch (cause) {
    if (cause instanceof Error && cause.message === "receiz_wallet_recipient_rate_limited") throw cause;
    throw new Error("receiz_wallet_recipient_lookup_unavailable");
  }
}

function defaultDependencies(): WildsWalletRouteHandlerDependencies {
  return {
    resolveAuthority: resolveWildsWalletReadAuthority,
    createAdapter: (accessToken) => createReceizCommerceAdapter({ accessToken }),
    // No process-local fallback is permitted: production recipient lookup remains closed
    // until the hosting platform wires a durable limiter port into this handler factory.
    recipientLookupLimiter: undefined,
    transferRuntime: undefined
  };
}

export function createWildsWalletRouteHandlers(
  overrides: Partial<WildsWalletRouteHandlerDependencies> = {}
) {
  const dependencies: WildsWalletRouteHandlerDependencies = { ...defaultDependencies(), ...overrides };

  return Object.freeze({
    async summary(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        return json(projectWildsWalletSummary(await dependencies.createAdapter(authority.accessToken).walletSummary()));
      } catch (cause) {
        return failure(cause, "receiz_wallet_read_unavailable");
      }
    },

    async ledger(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        const cursor = normalizeWildsWalletCursor(request.nextUrl.searchParams.get("cursor"));
        const adapter = dependencies.createAdapter(authority.accessToken);
        return json(projectWildsWalletLedgerPage(await adapter.walletLedger({ limit: 50, cursor: cursor ?? undefined }), authority.actorId));
      } catch (cause) {
        return failure(cause, "receiz_wallet_read_unavailable");
      }
    },

    async recipient(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        const body = assertExactFields(await readJsonBody(request), ["username"]);
        const username = normalizeWildsWalletPublicUsername(body.username);
        await consumeRecipientLookup(dependencies.recipientLookupLimiter, authority.actorId);
        try {
          const response = await dependencies.createAdapter(authority.accessToken).worldProfile(`${username}.receiz.id`);
          const recipient = projectWildsWalletRecipient(response.ok === true ? response.world : null);
          if (recipient.username !== username) throw new Error("receiz_wallet_recipient_unavailable");
          return json(recipient);
        } catch {
          throw new Error("receiz_wallet_recipient_unavailable");
        }
      } catch (cause) {
        return failure(cause, "receiz_wallet_recipient_unavailable");
      }
    },

    async request(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        const body = assertExactFields(await readJsonBody(request), ["amountPhiMicro"], []);
        const amountPhiMicro = body.amountPhiMicro === undefined ? null : parseWildsWalletMicroPhi(body.amountPhiMicro);
        if (dependencies.transferRuntime?.durable === true) {
          return json(exactReceiveProjection(await dependencies.transferRuntime.receive(authority, amountPhiMicro)));
        }
        return json({
          // Proposal-only fallback. Transfer preview does not accept this
          // plaintext coordinate as destination authority.
          locator: `wildz:receive:${authority.actorId}`,
          request: amountPhiMicro === null ? null : { kind: "phi", amountPhiMicro, authority: "non-authoritative" }
        });
      } catch (cause) {
        return failure(cause, "receiz_wallet_request_invalid");
      }
    },

    async capabilities(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        const admission = dependencies.transferRuntime?.durable === true
          ? await dependencies.transferRuntime.capabilityAdmission(authority)
          : undefined;
        return json(projectWildsWalletCapabilities(admission, dependencies.recipientLookupLimiter?.durable === true));
      } catch (cause) {
        return failure(cause, "receiz_wallet_capabilities_unavailable");
      }
    },

    async transferPreview(request: NextRequest) {
      try {
        assertSameOrigin(request);
        const authority = await dependencies.resolveAuthority(request);
        const body = assertExactFields(await readJsonBody(request), ["recipientUsername", "recipientLocator", "amountPhiMicro", "rail", "operationNonce"], ["amountPhiMicro", "rail", "operationNonce"]);
        const hasUsername = body.recipientUsername !== undefined;
        const hasLocator = body.recipientLocator !== undefined;
        if (hasUsername === hasLocator) throw new Error("wilds_wallet_transfer_request_invalid");
        const recipientUsername = hasUsername ? normalizeWildsWalletPublicUsername(body.recipientUsername) : undefined;
        const recipientLocator = hasLocator && typeof body.recipientLocator === "string" ? body.recipientLocator : undefined;
        if (hasLocator && (!recipientLocator || !recipientLocator.startsWith("wildz:receive:v1."))) throw new Error("wilds_wallet_receive_locator_invalid");
        const amountPhiMicro = parseWildsWalletMicroPhi(body.amountPhiMicro);
        if (amountPhiMicro === "0" || (body.rail !== "settlement" && body.rail !== "reserve")
          || typeof body.operationNonce !== "string" || !OPERATION_NONCE.test(body.operationNonce)) {
          throw new Error("wilds_wallet_transfer_request_invalid");
        }
        if (recipientUsername) await consumeRecipientLookup(dependencies.recipientLookupLimiter, authority.actorId);
        const value = await transferRuntimeOrThrow(dependencies.transferRuntime).preview(authority, {
          ...(recipientUsername ? { recipientUsername } : { recipientLocator: recipientLocator! }),
          amountPhiMicro, rail: body.rail, operationNonce: body.operationNonce
        });
        return json(exactStagedProjection(value));
      } catch (cause) {
        const normalized = cause instanceof Error && ["wilds_wallet_request_fields_invalid", "wilds_wallet_username_invalid", "wilds_wallet_micro_phi_invalid"].includes(cause.message)
          ? new Error("wilds_wallet_transfer_request_invalid") : cause;
        return failure(normalized, "receiz_wallet_transfer_unavailable");
      }
    },

    async transferExecute(request: NextRequest) {
      try {
        assertSameOrigin(request);
        const authority = await dependencies.resolveAuthority(request);
        const body = assertExactFields(await readJsonBody(request), ["attempt", "consent"]);
        const consent = assertExactFields(body.consent, ["artifact", "challenge"]);
        if (!validAttemptText(body.attempt)) throw new Error("wilds_wallet_transfer_attempt_invalid");
        const projection = transferProjection(await transferRuntimeOrThrow(dependencies.transferRuntime).execute(authority, {
          attempt: body.attempt as string,
          consent: { artifact: consent.artifact, challenge: consent.challenge }
        }));
        return json(projection, projection.status === "unknown" ? 202 : 200);
      } catch (cause) {
        const normalized = cause instanceof Error && cause.message === "wilds_wallet_request_fields_invalid"
          ? new Error("wilds_wallet_transfer_request_invalid") : cause;
        return failure(normalized, "receiz_wallet_transfer_unavailable");
      }
    },

    async transferStatus(request: NextRequest) {
      try {
        const authority = await dependencies.resolveAuthority(request);
        if ([...request.nextUrl.searchParams.keys()].some((key) => key !== "attempt")) throw new Error("wilds_wallet_transfer_request_invalid");
        const attempt = request.nextUrl.searchParams.get("attempt");
        if (!validAttemptText(attempt)) throw new Error("wilds_wallet_transfer_attempt_invalid");
        const projection = transferProjection(await transferRuntimeOrThrow(dependencies.transferRuntime).status(authority, attempt as string));
        return json(projection, projection.status === "unknown" ? 202 : 200);
      } catch (cause) {
        return failure(cause, "receiz_wallet_transfer_unavailable");
      }
    }
  });
}
