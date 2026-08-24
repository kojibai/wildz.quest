import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import {
  RECEIZ_SDK_VERSION,
  ReceizExecutionZeroWriteErrorV124,
  deriveReceizRegisteredOperationCasV124,
  normalizeReceizPublicRecipientAliasV124,
  planAtomicOperationV124,
  planReceizLocatorBoundValueIntentV124,
  prepareReceizSubjectSourceProofObjectCandidateV124,
  receizKaiNow,
  receizOidcScopesForRails,
  transportReceizSealedArtifactV124,
  type ReceizDurableExecutionHandleV124,
  type ReceizExecutionOutcomeV124,
  type ReceizProofAuthorityChallengeV123,
  type ReceizSubjectStateV122,
  type ReceizValueRailV122
} from "@receiz/sdk";
import type { ReceizCommerceAdapter } from "./adapter";
import { createReceizCommerceAdapter } from "./adapter";
import { receizOAuthSecret } from "./oauth-state";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";
import { WILDZ_V124_VALUE_OPERATIONS, qualifyWildzV124Operations } from "./v124-runtime-policy";
import { wildsWalletTransferConsentStatementDigest } from "./wilds-wallet-transfer-consent";
import type {
  WildsWalletStagedTransferProjection,
  WildsWalletTransferPreviewCommand,
  WildsWalletTransferRouteRuntime
} from "./wilds-wallet-route-handlers";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";

type Rail = Pick<ReceizCommerceAdapter,
  | "client"
  | "grantedScopesV124"
  | "qualifyRuntimeV124"
  | "openAuthoritySessionV124"
  | "closeAuthoritySessionV124"
  | "stageExecutionV124"
  | "executeV124"
  | "resolveExecutionByIdempotencyV124"
  | "resolvePublicRecipientV124"
  | "publishSealedSourceV124"
  | "subjectStateV122"
  | "walletSummary"
  | "quotePhiDisplayUsdV122"
>;

type Attempt = Readonly<{
  schema: "wildz.wallet.v124-attempt.v1";
  ownerReceizId: string;
  actorId: string;
  profileHandle: string;
  recipientUsername: string;
  sourceSubjectId: string;
  sourceProofObjectId: string;
  sourceSubjectHead: string;
  sourceValueHead: string;
  registryDigest: string;
  reducerDigest: string;
  rail: ReceizValueRailV122;
  amountPhiMicro: string;
  usdPerPhiMicrocents: string;
  quotedUsdCents: string;
  operationNonce: string;
  recipientOperationNonce: string;
  semanticIdempotencyKey: string;
  issuedAtKai: number;
  reviewExpiresAtKai: number;
  handleExpiresAtKai: number;
}>;

const VERSION = "v2";
const PURPOSE = "receiz.wildz.wallet-v124-attempt.v1";
const RECEIVE_PURPOSE = "receiz.wildz.wallet-v124-receive.v1";
const REVIEW_PULSES = 120;
const RECOVERY_PULSES = 86_400;
const SHA256 = /^[a-f0-9]{64}$/;
const POSITIVE = /^[1-9][0-9]{0,29}$/;
const HANDLE = /^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{2,8192}\.[A-Za-z0-9_-]{16,}$/;
const OPERATION_KIND = "receiz.atomic-operation.v124";

function key(secret: string, purpose = PURPOSE) {
  return createHash("sha256").update(purpose).update("\0").update(secret).digest();
}

function text(value: unknown, code: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 512) throw new Error(code);
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_wallet_v124_source_invalid");
  return value as Record<string, unknown>;
}

function digest(value: unknown, code = "wilds_wallet_v124_source_invalid") {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(code);
  return value;
}

function positive(value: unknown, code = "wilds_wallet_v124_source_invalid") {
  if (typeof value !== "string" || !POSITIVE.test(value)) throw new Error(code);
  return value;
}

function seal(value: unknown, secret: string, purpose = PURPOSE) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, purpose), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `${VERSION}.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

function unseal(value: string, secret: string, purpose = PURPOSE) {
  try {
    const [version, ivValue, encryptedValue, tagValue, ...extra] = value.split(".");
    if (version !== VERSION || !ivValue || !encryptedValue || !tagValue || extra.length) throw new Error("shape");
    const iv = Buffer.from(ivValue, "base64url");
    const encrypted = Buffer.from(encryptedValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || !encrypted.length) throw new Error("shape");
    const decipher = createDecipheriv("aes-256-gcm", key(secret, purpose), iv);
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as unknown;
  } catch {
    throw new Error("wilds_wallet_transfer_attempt_invalid");
  }
}

function admitAttempt(value: unknown): Attempt {
  const item = record(value) as Partial<Attempt>;
  if (item.schema !== "wildz.wallet.v124-attempt.v1"
    || !text(item.ownerReceizId, "wilds_wallet_transfer_attempt_invalid")
    || !text(item.actorId, "wilds_wallet_transfer_attempt_invalid")
    || !text(item.profileHandle, "wilds_wallet_transfer_attempt_invalid")
    || !text(item.recipientUsername, "wilds_wallet_transfer_attempt_invalid")
    || !text(item.sourceSubjectId, "wilds_wallet_transfer_attempt_invalid")
    || !text(item.sourceProofObjectId, "wilds_wallet_transfer_attempt_invalid")
    || !digest(item.sourceSubjectHead, "wilds_wallet_transfer_attempt_invalid")
    || !digest(item.sourceValueHead, "wilds_wallet_transfer_attempt_invalid")
    || !digest(item.registryDigest, "wilds_wallet_transfer_attempt_invalid")
    || !digest(item.reducerDigest, "wilds_wallet_transfer_attempt_invalid")
    || (item.rail !== "settlement" && item.rail !== "reserve")
    || !positive(item.amountPhiMicro, "wilds_wallet_transfer_attempt_invalid")
    || !positive(item.usdPerPhiMicrocents, "wilds_wallet_transfer_attempt_invalid")
    || typeof item.quotedUsdCents !== "string" || !/^\d{1,30}$/.test(item.quotedUsdCents)
    || !text(item.operationNonce, "wilds_wallet_transfer_attempt_invalid")
    || !text(item.recipientOperationNonce, "wilds_wallet_transfer_attempt_invalid")
    || !text(item.semanticIdempotencyKey, "wilds_wallet_transfer_attempt_invalid")
    || !Number.isSafeInteger(item.issuedAtKai) || !Number.isSafeInteger(item.reviewExpiresAtKai)
    || !Number.isSafeInteger(item.handleExpiresAtKai)
    || item.reviewExpiresAtKai! <= item.issuedAtKai! || item.handleExpiresAtKai! <= item.reviewExpiresAtKai!) {
    throw new Error("wilds_wallet_transfer_attempt_invalid");
  }
  return Object.freeze(item as Attempt);
}

function bindActor(attempt: Attempt, authority: WildsWalletReadAuthority) {
  if (attempt.ownerReceizId !== authority.ownerReceizId || attempt.actorId !== authority.actorId
    || attempt.profileHandle !== authority.profileHandle) throw new Error("wilds_wallet_transfer_attempt_identity_mismatch");
}

function exactSubjectState(value: unknown, authority: WildsWalletReadAuthority): ReceizSubjectStateV122 {
  const state = record(value) as unknown as ReceizSubjectStateV122;
  if (state.schema !== "receiz.subject.state.v122" || !digest(state.head) || !digest(state.stateDigest)
    || !digest(state.registryDigest) || !digest(state.reducerDigest) || !text(state.subjectId, "wilds_wallet_v124_source_invalid")
    || !text(state.proofObjectId, "wilds_wallet_v124_source_invalid")
    || (state.ownerReceizId !== authority.ownerReceizId
      && !sameWildzPlayerCoordinate(state.ownerReceizId, authority.profileHandle))) {
    throw new Error("wilds_wallet_v124_source_invalid");
  }
  return state;
}

function settlementFromSummary(value: unknown) {
  const summary = record(value);
  if (summary.ok !== true) throw new Error("wilds_wallet_v124_source_invalid");
  const settlement = record(summary.settlement);
  return Object.freeze({
    balancePhiMicro: typeof summary.balancePhiMicro === "string" && /^\d{1,30}$/.test(summary.balancePhiMicro)
      ? BigInt(summary.balancePhiMicro).toString() : (() => { throw new Error("wilds_wallet_v124_source_invalid"); })(),
    sourceValueHead: digest(settlement.sourceValueHead),
    usdPerPhiMicrocents: positive(settlement.usdPerPhiMicrocents),
    priceBasis: settlement.priceBasis ?? { schema: "receiz.wallet-price-basis.v124", sourceValueHead: settlement.sourceValueHead }
  });
}

function semanticKey(authority: WildsWalletReadAuthority, operationNonce: string, secret: string) {
  return `wildz-wallet-v124:${createHmac("sha256", key(secret)).update(authority.ownerReceizId).update("\0")
    .update(authority.actorId).update("\0").update(operationNonce).digest("hex")}`;
}

function transferProjection(outcome: ReceizExecutionOutcomeV124, attempt: Attempt) {
  if (outcome.status === "committed") return Object.freeze({ status: "committed" as const, rail: attempt.rail, amountPhiMicro: attempt.amountPhiMicro });
  if (outcome.status === "unknown") return Object.freeze({ status: "unknown" as const, rail: attempt.rail, amountPhiMicro: attempt.amountPhiMicro });
  return Object.freeze({ status: "zero-write" as const, rail: attempt.rail, code: outcome.reasonCode });
}

function resolutionCoordinates(attempt: Attempt) {
  return {
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    domainId: attempt.sourceSubjectId,
    operationKind: OPERATION_KIND,
    semanticIdempotencyKey: attempt.semanticIdempotencyKey
  } as const;
}

async function resolveOutcome(rail: Rail, attempt: Attempt) {
  return transferProjection(await rail.resolveExecutionByIdempotencyV124(resolutionCoordinates(attempt)), attempt);
}

async function sealSubjectSource(rail: Rail, state: ReceizSubjectStateV122, attempt: Attempt) {
  const candidate = await prepareReceizSubjectSourceProofObjectCandidateV124({
    subjectState: state,
    portable: {
      ownership: { ownerReceizId: state.ownerReceizId, custody: "current", proofRef: state.admittedProofDigest },
      provenance: { root: state.genesisHead, appends: [{ schema: "receiz.subject-source.v124", subjectId: state.subjectId, head: state.head }] },
      settlement: {
        state: "active",
        rail: attempt.rail,
        sourceProofObjectId: state.proofObjectId,
        sourceValueHead: attempt.sourceValueHead,
        amountPhiMicro: attempt.amountPhiMicro
      }
    }
  });
  const sealed = await rail.client.assets.createProofObject(candidate.proofObject, {
    idempotencyKey: `wildz:v124-subject-source:${state.stateDigest}`,
    filename: `wildz-wallet-${state.subjectId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80)}.receiz`
  });
  const portable = await transportReceizSealedArtifactV124(sealed);
  await rail.publishSealedSourceV124({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    authoritySessionHandle: null,
    sourceArtifact: portable
  });
  return portable;
}

export function createWildsWalletV124TransferRuntime(input: Readonly<{
  createAdapter(accessToken: string): Rail;
  secret?: string;
  now?: () => number;
  subjectSource?: (rail: Rail, state: ReceizSubjectStateV122, attempt: Attempt) => Promise<Awaited<ReturnType<typeof transportReceizSealedArtifactV124>>>;
}> = { createAdapter: (accessToken) => createReceizCommerceAdapter({ accessToken }) }): WildsWalletTransferRouteRuntime {
  const secret = input.secret ?? receizOAuthSecret();
  const currentKai = input.now ?? (() => receizKaiNow().pulse);
  const prepareSubjectSource = input.subjectSource ?? sealSubjectSource;
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("receiz_wallet_transfer_dependencies_unavailable");

  const openAttempt = (authority: WildsWalletReadAuthority, value: string) => {
    if (!HANDLE.test(value)) throw new Error("wilds_wallet_transfer_attempt_invalid");
    const attempt = admitAttempt(unseal(value, secret));
    bindActor(attempt, authority);
    const now = currentKai();
    if (now < attempt.issuedAtKai) throw new Error("wilds_wallet_transfer_clock_unavailable");
    if (now >= attempt.handleExpiresAtKai) throw new Error("wilds_wallet_transfer_attempt_expired");
    return { attempt, now };
  };

  const runtime: WildsWalletTransferRouteRuntime = {
    durable: true as const,
    recipientLookupAdmission: "distributed-v124" as const,
    async capabilityAdmission(authority) {
      const rail = input.createAdapter(authority.accessToken);
      const [qualification, grantedScopes] = await Promise.all([
        qualifyWildzV124Operations(rail, WILDZ_V124_VALUE_OPERATIONS),
        rail.grantedScopesV124()
      ]);
      return Object.freeze({
        sdkVersion: RECEIZ_SDK_VERSION,
        rails: {
          proofAuthorityExchange: qualification.available,
          settlementExecution: qualification.available,
          reserveExecution: qualification.available,
          valueExecutionRecovery: qualification.available,
          worldPlanning: qualification.available,
          worldExecution: qualification.available,
          subjectNamespaces: qualification.available
        },
        grantedScopes
      });
    },
    async preview(authority, command: WildsWalletTransferPreviewCommand) {
      let recipientUsername = command.recipientUsername;
      if (!recipientUsername && command.recipientLocator?.startsWith("wildz:receive:")) {
        const item = record(unseal(command.recipientLocator.slice("wildz:receive:".length), secret, RECEIVE_PURPOSE));
        const now = currentKai();
        if (item.schema !== "wildz.wallet.v124-receive.v1" || typeof item.recipientUsername !== "string"
          || !Number.isSafeInteger(item.issuedAtKai) || !Number.isSafeInteger(item.expiresAtKai)
          || now < Number(item.issuedAtKai) || now >= Number(item.expiresAtKai)) {
          throw new Error("wilds_wallet_receive_locator_expired");
        }
        recipientUsername = item.recipientUsername;
      }
      if (!recipientUsername) throw new Error("wilds_wallet_transfer_request_invalid");
      const rail = input.createAdapter(authority.accessToken);
      const [stateValue, summaryValue, grantedScopes] = await Promise.all([
        rail.subjectStateV122(authority.actorId), rail.walletSummary(), rail.grantedScopesV124()
      ]);
      if (!receizOidcScopesForRails(command.rail).every((scope) => grantedScopes.includes(scope))) {
        throw new Error("receiz_wallet_phi_scope_required");
      }
      const state = exactSubjectState(stateValue, authority);
      const settlement = settlementFromSummary(summaryValue);
      if (BigInt(command.amountPhiMicro) > BigInt(settlement.balancePhiMicro)) throw new Error("wilds_wallet_transfer_insufficient_value");
      const quotedUsdCents = rail.quotePhiDisplayUsdV122(command.amountPhiMicro, settlement.usdPerPhiMicrocents);
      const issuedAtKai = currentKai();
      const semanticIdempotencyKey = semanticKey(authority, command.operationNonce, secret);
      const recipientOperationNonce = createHash("sha256")
        .update("receiz.wildz.public-recipient.v124\0")
        .update(command.operationNonce)
        .digest("base64url");
      const recipientCoordinate = parseWildzPlayerCoordinate(recipientUsername);
      const attempt: Attempt = Object.freeze({
        schema: "wildz.wallet.v124-attempt.v1",
        ownerReceizId: authority.ownerReceizId,
        actorId: authority.actorId,
        profileHandle: authority.profileHandle,
        recipientUsername: normalizeReceizPublicRecipientAliasV124(recipientCoordinate?.actorId ?? recipientUsername),
        sourceSubjectId: state.subjectId,
        sourceProofObjectId: state.proofObjectId,
        sourceSubjectHead: state.head,
        sourceValueHead: settlement.sourceValueHead,
        registryDigest: state.registryDigest,
        reducerDigest: state.reducerDigest,
        rail: command.rail,
        amountPhiMicro: command.amountPhiMicro,
        usdPerPhiMicrocents: settlement.usdPerPhiMicrocents,
        quotedUsdCents,
        operationNonce: command.operationNonce,
        recipientOperationNonce,
        semanticIdempotencyKey,
        issuedAtKai,
        reviewExpiresAtKai: issuedAtKai + REVIEW_PULSES,
        handleExpiresAtKai: issuedAtKai + RECOVERY_PULSES
      });
      return Object.freeze({
        status: "staged" as const,
        rail: command.rail,
        amountPhiMicro: command.amountPhiMicro,
        quotedUsdCents,
        attempt: seal(attempt, secret),
        expiresAtKai: attempt.reviewExpiresAtKai
      } satisfies WildsWalletStagedTransferProjection);
    },
    async execute(authority, request) {
      const { attempt, now } = openAttempt(authority, request.attempt);
      if (now >= attempt.reviewExpiresAtKai) throw new Error("wilds_wallet_transfer_review_expired");
      const consent = request.consent as { artifact?: unknown; challenge?: ReceizProofAuthorityChallengeV123 };
      const expectedStatementDigest = await wildsWalletTransferConsentStatementDigest({
        attempt: request.attempt,
        amountPhiMicro: attempt.amountPhiMicro,
        rail: attempt.rail
      });
      if (!consent.challenge || consent.challenge.consent?.statementDigest !== expectedStatementDigest) {
        throw new Error("wilds_wallet_transfer_consent_binding_invalid");
      }
      const rail = input.createAdapter(authority.accessToken);
      const [stateValue, summaryValue] = await Promise.all([
        rail.subjectStateV122(attempt.sourceSubjectId), rail.walletSummary()
      ]);
      const state = exactSubjectState(stateValue, authority);
      const settlement = settlementFromSummary(summaryValue);
      if (state.subjectId !== attempt.sourceSubjectId || state.proofObjectId !== attempt.sourceProofObjectId
        || state.head !== attempt.sourceSubjectHead || state.registryDigest !== attempt.registryDigest
        || state.reducerDigest !== attempt.reducerDigest || settlement.sourceValueHead !== attempt.sourceValueHead
        || settlement.usdPerPhiMicrocents !== attempt.usdPerPhiMicrocents) {
        return Object.freeze({ status: "zero-write" as const, rail: attempt.rail, code: "STALE_HEAD" });
      }
      if (BigInt(attempt.amountPhiMicro) > BigInt(settlement.balancePhiMicro)) {
        return Object.freeze({ status: "zero-write" as const, rail: attempt.rail, code: "INSUFFICIENT_VALUE" });
      }
      const subjectSourceArtifact = await prepareSubjectSource(rail, state, attempt);
      const session = await rail.openAuthoritySessionV124({
        applicationId: WILDZ_RECEIZ_APPLICATION_ID,
        actorSubjectId: state.subjectId,
        subjectSourceArtifact,
        proofArtifact: consent.artifact as string,
        signedChallenge: consent.challenge,
        requestedRails: [attempt.rail],
        requiredNamespaces: [],
        audience: WILDZ_RECEIZ_APPLICATION_ID
      });
      let handle: ReceizDurableExecutionHandleV124 | null = null;
      try {
        const recipient = await rail.resolvePublicRecipientV124({
          applicationId: WILDZ_RECEIZ_APPLICATION_ID,
          authoritySessionHandle: session.authoritySessionHandle,
          expectedRequesterSubjectId: state.subjectId,
          normalizedAlias: attempt.recipientUsername,
          purpose: `wildz.phi.${attempt.rail}`,
          operationNonce: attempt.recipientOperationNonce
        });
        if (recipient.status !== "resolved") throw new Error("receiz_wallet_recipient_unavailable");
        const intent = await planReceizLocatorBoundValueIntentV124({
          rail: attempt.rail,
          amountPhiMicro: attempt.amountPhiMicro,
          sourceProofObjectId: state.proofObjectId,
          sourceValueHead: attempt.sourceValueHead,
          recipientLocator: {
            schema: "receiz.public-recipient-locator-reference.v124",
            encryptedLocatorB64u: recipient.encryptedLocatorB64u,
            locatorDigest: recipient.locatorDigest,
            purpose: `wildz.phi.${attempt.rail}`,
            operationNonce: attempt.recipientOperationNonce
          },
          usdPerPhiMicrocents: attempt.usdPerPhiMicrocents,
          priceBasis: settlement.priceBasis,
          idempotencyKey: attempt.semanticIdempotencyKey
        });
        const operationBasis = {
          operationId: `wildz:${intent.valueIntentDigest}`,
          category: attempt.rail,
          domainId: state.subjectId,
          registryDigest: state.registryDigest,
          reducerDigest: state.reducerDigest,
          payload: intent
        } as const;
        const cas = await deriveReceizRegisteredOperationCasV124(operationBasis);
        const plan = await planAtomicOperationV124({
          applicationId: WILDZ_RECEIZ_APPLICATION_ID,
          operations: [{ ...operationBasis, participants: cas.participants }],
          participants: cas.participants,
          expectedParticipantHeads: cas.expectedParticipantHeads,
          semanticIdempotencyKey: attempt.semanticIdempotencyKey,
          attemptId: `wildz:${attempt.operationNonce}`
        });
        handle = await rail.stageExecutionV124(plan);
        return transferProjection(await rail.executeV124(handle, session), attempt);
      } catch (cause) {
        if (cause instanceof ReceizExecutionZeroWriteErrorV124) {
          return Object.freeze({ status: "zero-write" as const, rail: attempt.rail, code: cause.failure.reasonCode });
        }
        if (handle) {
          try { return await resolveOutcome(rail, attempt); } catch { /* preserve the original ambiguous failure */ }
        }
        throw cause;
      } finally {
        await rail.closeAuthoritySessionV124({
          applicationId: WILDZ_RECEIZ_APPLICATION_ID,
          authoritySessionHandle: session.authoritySessionHandle,
          persistedSession: session
        }).catch(() => undefined);
      }
    },
    async status(authority, attemptValue) {
      const { attempt } = openAttempt(authority, attemptValue);
      return resolveOutcome(input.createAdapter(authority.accessToken), attempt);
    },
    async receive(authority, amountPhiMicro) {
      const issuedAtKai = currentKai();
      const coordinate = seal({
        schema: "wildz.wallet.v124-receive.v1",
        recipientUsername: normalizeReceizPublicRecipientAliasV124(authority.profileHandle),
        issuedAtKai,
        expiresAtKai: issuedAtKai + RECOVERY_PULSES
      }, secret, RECEIVE_PURPOSE);
      return Object.freeze({
        locator: `wildz:receive:${coordinate}`,
        request: amountPhiMicro === null ? null : { kind: "phi" as const, amountPhiMicro, authority: "non-authoritative" as const }
      });
    }
  };
  return Object.freeze(runtime);
}
