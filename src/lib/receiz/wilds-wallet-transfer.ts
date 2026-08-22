import {
  receizOidcScopesForRails,
  validateReceizProofAuthorityV123,
  validateReceizValueExecutionOutcomeV123,
  type ReceizProofAuthorityV123,
  type ReceizValueExecutionOutcomeV123,
  type ReceizValueRailV122,
  type ReceizWorldValueIntentV122
} from "@receiz/sdk";
import type { ReceizCommerceAdapter } from "./adapter";
import {
  requireWildsWalletTransferJournal,
  type WildsWalletTransferJournalEntry,
  type WildsWalletTransferJournalPort
} from "./wilds-wallet-transfer-journal";

type WildsWalletPhiRail = Pick<
  ReceizCommerceAdapter,
  | "planPhiSettlementV123"
  | "planPhiReserveV123"
  | "validatePhiIntentV123"
  | "executePhiSettlementV123"
  | "executePhiReserveV123"
  | "phiExecutionByIdempotencyKeyV123"
>;

type WildsWalletProofAuthorityRail = Pick<ReceizCommerceAdapter, "exchangeProofAuthorityV123">;

export type WildsWalletPhiTransferInput = Readonly<{
  ownerBinding: string;
  applicationId: string;
  rail: ReceizValueRailV122;
  amountPhiMicro: string;
  sourceProofObjectId: string;
  sourceValueHead: string;
  destinationSubjectId: string;
  expectedDestinationHead: string;
  usdPerPhiMicrocents: string;
  priceBasis: unknown;
  idempotencyKey: string;
}>;

export type WildsWalletPhiTransferProjection = Readonly<
  | { status: "preview" | "staged"; rail: ReceizValueRailV122; amountPhiMicro: string; quotedUsdCents: string }
  | { status: "unknown"; rail: ReceizValueRailV122; amountPhiMicro: string }
  | { status: "zero-write"; rail: ReceizValueRailV122; code: string }
  | { status: "committed"; rail: ReceizValueRailV122; amountPhiMicro: string }
>;

type TransferDependencies = Readonly<{
  rail: WildsWalletPhiRail;
  journal?: WildsWalletTransferJournalPort;
}>;

const SAFE_ZERO_WRITE_CODES = new Set([
  "SOURCE_HEAD_STALE",
  "DESTINATION_HEAD_STALE",
  "INSUFFICIENT_AVAILABILITY",
  "SCOPE_NOT_GRANTED",
  "RAIL_MISMATCH"
]);

function validPrivateCoordinate(value: string) {
  return value.trim().length > 0 && value.length <= 256;
}

function assertTransferInput(input: WildsWalletPhiTransferInput) {
  if (!validPrivateCoordinate(input.ownerBinding)
    || !validPrivateCoordinate(input.applicationId)
    || !validPrivateCoordinate(input.sourceProofObjectId)
    || !validPrivateCoordinate(input.destinationSubjectId)
    || !validPrivateCoordinate(input.idempotencyKey)) {
    throw new Error("wilds_wallet_transfer_input_invalid");
  }
}

function planningInput(input: WildsWalletPhiTransferInput) {
  return {
    amountPhiMicro: input.amountPhiMicro,
    sourceProofObjectId: input.sourceProofObjectId,
    sourceValueHead: input.sourceValueHead,
    destinationSubjectId: input.destinationSubjectId,
    expectedDestinationHead: input.expectedDestinationHead,
    usdPerPhiMicrocents: input.usdPerPhiMicrocents,
    priceBasis: input.priceBasis,
    idempotencyKey: input.idempotencyKey
  };
}

function intentMatchesInput(intent: ReceizWorldValueIntentV122, input: WildsWalletPhiTransferInput) {
  return intent.rail === input.rail
    && intent.amountPhiMicro === input.amountPhiMicro
    && intent.sourceProofObjectId === input.sourceProofObjectId
    && intent.sourceValueHead === input.sourceValueHead
    && intent.destinationSubjectId === input.destinationSubjectId
    && intent.expectedDestinationHead === input.expectedDestinationHead
    && intent.usdPerPhiMicrocents === input.usdPerPhiMicrocents
    && intent.idempotencyKey === input.idempotencyKey;
}

function entryMatchesInput(entry: WildsWalletTransferJournalEntry, input: WildsWalletPhiTransferInput) {
  return entry.applicationId === input.applicationId && intentMatchesInput(entry.intent, input);
}

function sameExactIntent(left: ReceizWorldValueIntentV122, right: ReceizWorldValueIntentV122) {
  return left.schema === right.schema
    && left.rail === right.rail
    && left.amountPhiMicro === right.amountPhiMicro
    && left.usdPerPhiMicrocents === right.usdPerPhiMicrocents
    && left.quotedUsdCents === right.quotedUsdCents
    && left.priceBasisDigest === right.priceBasisDigest
    && left.sourceProofObjectId === right.sourceProofObjectId
    && left.sourceValueHead === right.sourceValueHead
    && left.destinationSubjectId === right.destinationSubjectId
    && left.expectedDestinationHead === right.expectedDestinationHead
    && left.idempotencyKey === right.idempotencyKey
    && left.valueIntentDigest === right.valueIntentDigest;
}

async function planExactIntent(input: WildsWalletPhiTransferInput, rail: WildsWalletPhiRail) {
  assertTransferInput(input);
  const intent = input.rail === "settlement"
    ? await rail.planPhiSettlementV123(planningInput(input))
    : await rail.planPhiReserveV123(planningInput(input));
  if (!await rail.validatePhiIntentV123(intent) || !intentMatchesInput(intent, input)) {
    throw new Error("wilds_wallet_exact_plan_invalid");
  }
  return intent;
}

function stageProjection(
  status: "preview" | "staged",
  intent: ReceizWorldValueIntentV122
): WildsWalletPhiTransferProjection {
  return Object.freeze({
    status,
    rail: intent.rail,
    amountPhiMicro: intent.amountPhiMicro,
    quotedUsdCents: intent.quotedUsdCents
  });
}

function unknownProjection(entry: WildsWalletTransferJournalEntry): WildsWalletPhiTransferProjection {
  return Object.freeze({
    status: "unknown" as const,
    rail: entry.rail,
    amountPhiMicro: entry.intent.amountPhiMicro
  });
}

export async function previewWildsWalletPhiTransfer(
  input: WildsWalletPhiTransferInput,
  rail: WildsWalletPhiRail
): Promise<WildsWalletPhiTransferProjection> {
  return stageProjection("preview", await planExactIntent(input, rail));
}

export async function stageWildsWalletPhiTransfer(
  input: WildsWalletPhiTransferInput,
  dependencies: TransferDependencies
): Promise<WildsWalletPhiTransferProjection> {
  const journal = requireWildsWalletTransferJournal(dependencies.journal);
  assertTransferInput(input);
  const existing = await journal.load(input.ownerBinding, input.idempotencyKey);
  if (existing) {
    if (!entryMatchesInput(existing, input)) {
      throw new Error("wilds_wallet_idempotency_conflict");
    }
    return stageProjection("staged", existing.intent);
  }

  const intent = await planExactIntent(input, dependencies.rail);
  const entry: WildsWalletTransferJournalEntry = Object.freeze({
    schema: "wildz.wallet.phi-transfer-journal.v1" as const,
    ownerBinding: input.ownerBinding,
    applicationId: input.applicationId,
    idempotencyKey: input.idempotencyKey,
    rail: input.rail,
    intent,
    authorityDigest: null
  });
  const staged = await journal.stage(entry);
  if (!entryMatchesInput(staged, input)) {
    throw new Error("wilds_wallet_idempotency_conflict");
  }
  return stageProjection("staged", staged.intent);
}

function exactProofReferences(
  outcome: ReceizValueExecutionOutcomeV123 & { status: "committed" },
  intent: ReceizWorldValueIntentV122
) {
  if (outcome.proofReferences.length !== 2) return false;
  const source = outcome.proofReferences.find((reference) => reference.objectId === intent.sourceProofObjectId);
  const destination = outcome.proofReferences.find((reference) => reference.objectId === intent.destinationSubjectId);
  return Boolean(source && destination
    && source.head === outcome.sourceHead
    && destination.head === outcome.destinationHead
    && source.proofDigest.length === 64
    && destination.proofDigest.length === 64);
}

async function finalizeOutcome(
  entry: WildsWalletTransferJournalEntry,
  outcome: ReceizValueExecutionOutcomeV123,
  journal: WildsWalletTransferJournalPort
): Promise<WildsWalletPhiTransferProjection> {
  let validated: ReceizValueExecutionOutcomeV123;
  try {
    validated = await validateReceizValueExecutionOutcomeV123(outcome);
  } catch {
    return unknownProjection(entry);
  }
  if (validated.status === "unknown") return unknownProjection(entry);
  if (validated.rail !== entry.rail) return unknownProjection(entry);
  if (validated.status === "zero-write") {
    if (!entry.authorityDigest) return unknownProjection(entry);
    await journal.remove(entry);
    return Object.freeze({
      status: "zero-write" as const,
      rail: entry.rail,
      code: SAFE_ZERO_WRITE_CODES.has(validated.failure.code)
        ? validated.failure.code
        : "TRANSFER_REJECTED"
    });
  }
  if (!entry.authorityDigest
    || validated.receipt.authorityDigest !== entry.authorityDigest
    || validated.receipt.idempotencyKey !== entry.idempotencyKey
    || !sameExactIntent(validated.intent, entry.intent)
    || !exactProofReferences(validated, entry.intent)) {
    return unknownProjection(entry);
  }
  await journal.remove(entry);
  return Object.freeze({
    status: "committed" as const,
    rail: entry.rail,
    amountPhiMicro: entry.intent.amountPhiMicro
  });
}

export async function recoverWildsWalletPhiTransfer(
  input: Readonly<{ ownerBinding: string; idempotencyKey: string; authority?: ReceizProofAuthorityV123 }>,
  dependencies: TransferDependencies
): Promise<WildsWalletPhiTransferProjection> {
  const journal = requireWildsWalletTransferJournal(dependencies.journal);
  const entry = await journal.load(input.ownerBinding, input.idempotencyKey);
  if (!entry) throw new Error("wilds_wallet_transfer_not_staged");
  try {
    const outcome = await dependencies.rail.phiExecutionByIdempotencyKeyV123(
      entry.idempotencyKey,
      input.authority
    );
    return await finalizeOutcome(entry, outcome, journal);
  } catch {
    return unknownProjection(entry);
  }
}

export async function executeWildsWalletPhiTransfer(
  input: Readonly<{
    ownerBinding: string;
    idempotencyKey: string;
    authority: ReceizProofAuthorityV123;
  }>,
  dependencies: TransferDependencies
): Promise<WildsWalletPhiTransferProjection> {
  const journal = requireWildsWalletTransferJournal(dependencies.journal);
  let entry = await journal.load(input.ownerBinding, input.idempotencyKey);
  if (!entry) throw new Error("wilds_wallet_transfer_not_staged");

  let authority: ReceizProofAuthorityV123;
  try {
    authority = await validateReceizProofAuthorityV123(input.authority);
  } catch {
    throw new Error("wilds_wallet_proof_authority_invalid");
  }
  const requiredScopes = receizOidcScopesForRails(entry.rail);
  if (!requiredScopes.every((scope) => authority.grantedScopes.includes(scope))) {
    throw new Error("wilds_wallet_proof_authority_scope_mismatch");
  }
  if (authority.applicationId !== entry.applicationId) {
    throw new Error("wilds_wallet_proof_authority_application_mismatch");
  }

  const recovered = await recoverWildsWalletPhiTransfer(input, dependencies);
  if (recovered.status !== "unknown") return recovered;
  if (entry.authorityDigest && entry.authorityDigest !== authority.authorityDigest) {
    return recovered;
  }
  if (!entry.authorityDigest) {
    const bound = await journal.bindAuthority(
      entry.ownerBinding,
      entry.idempotencyKey,
      authority.authorityDigest
    );
    if (!bound
      || !sameExactIntent(bound.intent, entry.intent)
      || bound.applicationId !== entry.applicationId
      || bound.authorityDigest !== authority.authorityDigest) {
      return recovered;
    }
    entry = bound;
  }

  try {
    const outcome = entry.rail === "settlement"
      ? await dependencies.rail.executePhiSettlementV123(entry.intent, authority)
      : await dependencies.rail.executePhiReserveV123(entry.intent, authority);
    return await finalizeOutcome(entry, outcome, journal);
  } catch {
    return unknownProjection(entry);
  }
}

type ProofAuthorityInput = Omit<
  Parameters<WildsWalletProofAuthorityRail["exchangeProofAuthorityV123"]>[0],
  "scopes"
> & Readonly<{ rail: ReceizValueRailV122 }>;

export async function exchangeWildsWalletProofAuthority(
  input: ProofAuthorityInput,
  rail: WildsWalletProofAuthorityRail
): Promise<ReceizProofAuthorityV123> {
  const scopes = receizOidcScopesForRails(input.rail);
  const exchanged = await rail.exchangeProofAuthorityV123({
    artifact: input.artifact,
    challenge: input.challenge,
    applicationId: input.applicationId,
    scopes
  });
  let authority: ReceizProofAuthorityV123;
  try {
    authority = await validateReceizProofAuthorityV123(exchanged);
  } catch {
    throw new Error("wilds_wallet_proof_authority_invalid");
  }
  if (authority.applicationId !== input.applicationId
    || authority.grantedScopes.length !== scopes.length
    || !scopes.every((scope) => authority.grantedScopes.includes(scope))) {
    throw new Error("wilds_wallet_proof_authority_scope_mismatch");
  }
  return authority;
}
