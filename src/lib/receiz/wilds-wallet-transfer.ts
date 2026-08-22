import "server-only";

import {
  receizOidcScopesForRails,
  sha256ReceizBytes,
  validateReceizProofAuthorityV123,
  validateReceizValueExecutionOutcomeV123,
  type ReceizProofAuthorityV123,
  type ReceizValueExecutionOutcomeV123,
  type ReceizValueRailV122,
  type ReceizWorldValueIntentV122
} from "@receiz/sdk";
import type { ReceizCommerceAdapter } from "./adapter";
import {
  admitWildsWalletTransferJournalEntry,
  admitWildsWalletTransferTerminalRecord,
  requireWildsWalletTransferJournal,
  WILDS_WALLET_TERMINAL_RETENTION_KAI,
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

export interface WildsWalletProofAuthorityAdmissionPort {
  readonly serverDerived: true;
  currentKai(): Promise<number>;
  resolveAuthorityBinding(input: Readonly<{
    applicationId: string;
    keyId: string;
    artifactDigest: string;
  }>): Promise<Readonly<{ revocationHead: string; ownerBinding: string }> | null>;
}

export type WildsWalletAdmittedProofAuthority = Readonly<{
  schema: "wildz.wallet.proof-authority-admission.v1";
  authority: ReceizProofAuthorityV123;
  ownerBinding: string;
  applicationId: string;
  keyId: string;
  artifactDigest: string;
  nonce: string;
  revocationHead: string;
  admittedAtKai: number;
}>;

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
  authorityAdmission?: WildsWalletProofAuthorityAdmissionPort;
}>;

const SAFE_ZERO_WRITE_CODES = new Set([
  "SOURCE_HEAD_STALE",
  "DESTINATION_HEAD_STALE",
  "INSUFFICIENT_AVAILABILITY",
  "SCOPE_NOT_GRANTED",
  "RAIL_MISMATCH"
]);
const SHA256 = /^[0-9a-f]{64}$/;
const AUTHORITY_CONTEXT_KEYS = [
  "admittedAtKai",
  "applicationId",
  "artifactDigest",
  "authority",
  "keyId",
  "nonce",
  "ownerBinding",
  "revocationHead",
  "schema"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function proofAuthorityAdmissionOrThrow(
  admission: WildsWalletProofAuthorityAdmissionPort | undefined
): WildsWalletProofAuthorityAdmissionPort {
  if (!admission || admission.serverDerived !== true) {
    throw new Error("wilds_wallet_proof_authority_admission_required");
  }
  return admission;
}

async function exactArtifactBytes(input: Blob | ArrayBuffer | Uint8Array | string) {
  if (typeof input === "string") return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Blob !== "undefined" && input instanceof Blob) return new Uint8Array(await input.arrayBuffer());
  throw new Error("wilds_wallet_proof_authority_artifact_invalid");
}

async function currentKai(admission: WildsWalletProofAuthorityAdmissionPort) {
  const current = await admission.currentKai();
  if (!Number.isSafeInteger(current) || current < 0) {
    throw new Error("wilds_wallet_proof_authority_freshness_unavailable");
  }
  return current;
}

function assertAuthorityTime(authority: ReceizProofAuthorityV123, current: number) {
  if (authority.expiresAtKai <= authority.issuedAtKai || authority.expiresIn <= 0) {
    throw new Error("wilds_wallet_proof_authority_time_invalid");
  }
  if (current < authority.issuedAtKai) throw new Error("wilds_wallet_proof_authority_time_invalid");
  if (current >= authority.expiresAtKai) throw new Error("wilds_wallet_proof_authority_expired");
}

async function assertCurrentRevocation(
  authority: ReceizProofAuthorityV123,
  admission: WildsWalletProofAuthorityAdmissionPort
): Promise<Readonly<{ revocationHead: string; ownerBinding: string }>> {
  const binding = await admission.resolveAuthorityBinding({
    applicationId: authority.applicationId,
    keyId: authority.keyId,
    artifactDigest: authority.artifactDigest
  });
  if (!binding || !SHA256.test(binding.revocationHead)
    || binding.revocationHead !== authority.revocationHead
    || !validPrivateCoordinate(binding.ownerBinding)) {
    throw new Error("wilds_wallet_proof_authority_revoked");
  }
  return Object.freeze(binding);
}

async function revalidateAdmittedProofAuthority(
  value: unknown,
  admissionInput: WildsWalletProofAuthorityAdmissionPort | undefined
): Promise<WildsWalletAdmittedProofAuthority> {
  const admission = proofAuthorityAdmissionOrThrow(admissionInput);
  if (!isRecord(value) || !hasExactKeys(value, AUTHORITY_CONTEXT_KEYS)
    || value.schema !== "wildz.wallet.proof-authority-admission.v1") {
    throw new Error("wilds_wallet_proof_authority_context_invalid");
  }
  let authority: ReceizProofAuthorityV123;
  try {
    authority = await validateReceizProofAuthorityV123(value.authority);
  } catch {
    throw new Error("wilds_wallet_proof_authority_invalid");
  }
  if (value.applicationId !== authority.applicationId
    || value.keyId !== authority.keyId
    || value.artifactDigest !== authority.artifactDigest
    || value.nonce !== authority.nonce
    || value.revocationHead !== authority.revocationHead
    || !validPrivateCoordinate(value.ownerBinding)
    || !Number.isSafeInteger(value.admittedAtKai)) {
    throw new Error("wilds_wallet_proof_authority_context_invalid");
  }
  const now = await currentKai(admission);
  assertAuthorityTime(authority, now);
  const admittedAtKai = value.admittedAtKai as number;
  if (admittedAtKai < authority.issuedAtKai
    || admittedAtKai >= authority.expiresAtKai
    || admittedAtKai > now) {
    throw new Error("wilds_wallet_proof_authority_context_invalid");
  }
  const binding = await assertCurrentRevocation(authority, admission);
  if (binding.ownerBinding !== value.ownerBinding) {
    throw new Error("wilds_wallet_proof_authority_owner_mismatch");
  }
  return Object.freeze({
    schema: "wildz.wallet.proof-authority-admission.v1",
    authority,
    ownerBinding: value.ownerBinding as string,
    applicationId: authority.applicationId,
    keyId: authority.keyId,
    artifactDigest: authority.artifactDigest,
    nonce: authority.nonce,
    revocationHead: authority.revocationHead,
    admittedAtKai
  });
}

function validPrivateCoordinate(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256;
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

async function exactTerminal(
  journal: WildsWalletTransferJournalPort,
  ownerBinding: string,
  idempotencyKey: string,
  applicationId?: string
) {
  const value = await journal.loadTerminal(ownerBinding, idempotencyKey);
  return value ? admitWildsWalletTransferTerminalRecord(value, { ownerBinding, idempotencyKey, applicationId }) : null;
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
  const terminal = await exactTerminal(journal, input.ownerBinding, input.idempotencyKey, input.applicationId);
  if (terminal) {
    const candidate = await planExactIntent(input, dependencies.rail);
    if (!entryMatchesInput(terminal.entry, input) || !sameExactIntent(terminal.entry.intent, candidate)) {
      throw new Error("wilds_wallet_idempotency_conflict");
    }
    return terminal.projection;
  }
  const existingValue = await journal.load(input.ownerBinding, input.idempotencyKey);
  if (existingValue) {
    const existing = await admitWildsWalletTransferJournalEntry(existingValue, {
      ownerBinding: input.ownerBinding,
      applicationId: input.applicationId,
      idempotencyKey: input.idempotencyKey
    });
    const candidate = await planExactIntent(input, dependencies.rail);
    if (!entryMatchesInput(existing, input) || !sameExactIntent(existing.intent, candidate)) {
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
  const admittedEntry = await admitWildsWalletTransferJournalEntry(entry, {
    ownerBinding: input.ownerBinding,
    applicationId: input.applicationId,
    idempotencyKey: input.idempotencyKey
  });
  const staged = await admitWildsWalletTransferJournalEntry(await journal.stage(admittedEntry), {
    ownerBinding: input.ownerBinding,
    applicationId: input.applicationId,
    idempotencyKey: input.idempotencyKey
  });
  if (!entryMatchesInput(staged, input) || !sameExactIntent(staged.intent, intent)) {
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
  dependencies: TransferDependencies
): Promise<WildsWalletPhiTransferProjection> {
  const journal = requireWildsWalletTransferJournal(dependencies.journal);
  const admittedEntry = await admitWildsWalletTransferJournalEntry(entry, {
    ownerBinding: entry.ownerBinding,
    applicationId: entry.applicationId,
    idempotencyKey: entry.idempotencyKey
  });
  let validated: ReceizValueExecutionOutcomeV123;
  try {
    validated = await validateReceizValueExecutionOutcomeV123(outcome);
  } catch {
    return unknownProjection(admittedEntry);
  }
  if (validated.status === "unknown") return unknownProjection(admittedEntry);
  if (validated.rail !== admittedEntry.rail) return unknownProjection(admittedEntry);
  if (validated.status === "zero-write") {
    if (!admittedEntry.authorityDigest) return unknownProjection(admittedEntry);
    const projection = Object.freeze({
      status: "zero-write" as const,
      rail: admittedEntry.rail,
      code: SAFE_ZERO_WRITE_CODES.has(validated.failure.code)
        ? validated.failure.code
        : "TRANSFER_REJECTED"
    });
    const admission = proofAuthorityAdmissionOrThrow(dependencies.authorityAdmission);
    const now = await currentKai(admission);
    const terminal = await journal.terminalize(admittedEntry, projection, now, now + WILDS_WALLET_TERMINAL_RETENTION_KAI);
    return terminal
      ? (await admitWildsWalletTransferTerminalRecord(terminal, {
        ownerBinding: admittedEntry.ownerBinding,
        applicationId: admittedEntry.applicationId,
        idempotencyKey: admittedEntry.idempotencyKey
      })).projection
      : unknownProjection(admittedEntry);
  }
  if (!admittedEntry.authorityDigest
    || validated.receipt.authorityDigest !== admittedEntry.authorityDigest
    || validated.receipt.idempotencyKey !== admittedEntry.idempotencyKey
    || !sameExactIntent(validated.intent, admittedEntry.intent)
    || !exactProofReferences(validated, admittedEntry.intent)) {
    return unknownProjection(admittedEntry);
  }
  const projection = Object.freeze({
    status: "committed" as const,
    rail: admittedEntry.rail,
    amountPhiMicro: admittedEntry.intent.amountPhiMicro
  });
  const admission = proofAuthorityAdmissionOrThrow(dependencies.authorityAdmission);
  const now = await currentKai(admission);
  const terminal = await journal.terminalize(admittedEntry, projection, now, now + WILDS_WALLET_TERMINAL_RETENTION_KAI);
  return terminal
    ? (await admitWildsWalletTransferTerminalRecord(terminal, {
      ownerBinding: admittedEntry.ownerBinding,
      applicationId: admittedEntry.applicationId,
      idempotencyKey: admittedEntry.idempotencyKey
    })).projection
    : unknownProjection(admittedEntry);
}

export async function recoverWildsWalletPhiTransfer(
  input: Readonly<{
    ownerBinding: string;
    idempotencyKey: string;
    authorityContext?: WildsWalletAdmittedProofAuthority;
  }>,
  dependencies: TransferDependencies
): Promise<WildsWalletPhiTransferProjection> {
  const journal = requireWildsWalletTransferJournal(dependencies.journal);
  const terminal = await exactTerminal(journal, input.ownerBinding, input.idempotencyKey);
  if (terminal) return terminal.projection;
  const loaded = await journal.load(input.ownerBinding, input.idempotencyKey);
  if (!loaded) throw new Error("wilds_wallet_transfer_not_staged");
  const entry = await admitWildsWalletTransferJournalEntry(loaded, {
    ownerBinding: input.ownerBinding,
    idempotencyKey: input.idempotencyKey
  });
  const context = input.authorityContext
    ? await revalidateAdmittedProofAuthority(input.authorityContext, dependencies.authorityAdmission)
    : null;
  if (context && context.applicationId !== entry.applicationId) {
    throw new Error("wilds_wallet_proof_authority_application_mismatch");
  }
  if (context && context.ownerBinding !== entry.ownerBinding) {
    throw new Error("wilds_wallet_proof_authority_owner_mismatch");
  }
  try {
    const outcome = await dependencies.rail.phiExecutionByIdempotencyKeyV123(
      entry.idempotencyKey,
      context?.authority
    );
    return await finalizeOutcome(entry, outcome, dependencies);
  } catch {
    return unknownProjection(entry);
  }
}

export async function executeWildsWalletPhiTransfer(
  input: Readonly<{
    ownerBinding: string;
    idempotencyKey: string;
    authorityContext: WildsWalletAdmittedProofAuthority;
  }>,
  dependencies: TransferDependencies
): Promise<WildsWalletPhiTransferProjection> {
  const journal = requireWildsWalletTransferJournal(dependencies.journal);
  const terminal = await exactTerminal(journal, input.ownerBinding, input.idempotencyKey);
  if (terminal) return terminal.projection;
  const loaded = await journal.load(input.ownerBinding, input.idempotencyKey);
  if (!loaded) throw new Error("wilds_wallet_transfer_not_staged");
  let entry = await admitWildsWalletTransferJournalEntry(loaded, {
    ownerBinding: input.ownerBinding,
    idempotencyKey: input.idempotencyKey
  });

  const context = await revalidateAdmittedProofAuthority(
    input.authorityContext,
    dependencies.authorityAdmission
  );
  const authority = context.authority;
  const requiredScopes = receizOidcScopesForRails(entry.rail);
  if (!requiredScopes.every((scope) => authority.grantedScopes.includes(scope))) {
    throw new Error("wilds_wallet_proof_authority_scope_mismatch");
  }
  if (context.applicationId !== entry.applicationId) {
    throw new Error("wilds_wallet_proof_authority_application_mismatch");
  }
  if (context.ownerBinding !== entry.ownerBinding) {
    throw new Error("wilds_wallet_proof_authority_owner_mismatch");
  }
  const recovered = await recoverWildsWalletPhiTransfer({
    ownerBinding: input.ownerBinding,
    idempotencyKey: input.idempotencyKey,
    authorityContext: context
  }, dependencies);
  if (recovered.status !== "unknown") return recovered;
  if (entry.authorityDigest && entry.authorityDigest !== authority.authorityDigest) {
    return recovered;
  }
  if (!entry.authorityDigest) {
    const boundValue = await journal.bindAuthority(
      entry.ownerBinding,
      entry.idempotencyKey,
      authority.authorityDigest
    );
    const bound = boundValue
      ? await admitWildsWalletTransferJournalEntry(boundValue, {
        ownerBinding: entry.ownerBinding,
        applicationId: entry.applicationId,
        idempotencyKey: entry.idempotencyKey
      })
      : null;
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
    return await finalizeOutcome(entry, outcome, dependencies);
  } catch {
    return unknownProjection(entry);
  }
}

type ProofAuthorityInput = Omit<
  Parameters<WildsWalletProofAuthorityRail["exchangeProofAuthorityV123"]>[0],
  "scopes"
> & Readonly<{ rail: ReceizValueRailV122; ownerBinding: string }>;

type ProofAuthorityDependencies = Readonly<{
  rail: WildsWalletProofAuthorityRail;
  authorityAdmission?: WildsWalletProofAuthorityAdmissionPort;
}>;

export async function exchangeWildsWalletProofAuthority(
  input: ProofAuthorityInput,
  dependencies: ProofAuthorityDependencies
): Promise<WildsWalletAdmittedProofAuthority> {
  const admission = proofAuthorityAdmissionOrThrow(dependencies.authorityAdmission);
  const now = await currentKai(admission);
  const scopes = receizOidcScopesForRails(input.rail);
  const challenge = input.challenge;
  if (!validPrivateCoordinate(input.ownerBinding)
    || challenge.audience !== input.applicationId
    || challenge.proof.keyId.length !== 64
    || !SHA256.test(challenge.proof.keyId)
    || !challenge.nonce.trim()
    || !Number.isSafeInteger(challenge.issuedAtKai)
    || !Number.isSafeInteger(challenge.expiresAtKai)
    || challenge.expiresAtKai <= challenge.issuedAtKai) {
    throw new Error("wilds_wallet_proof_authority_challenge_invalid");
  }
  if (now < challenge.issuedAtKai) throw new Error("wilds_wallet_proof_authority_challenge_invalid");
  if (now >= challenge.expiresAtKai) throw new Error("wilds_wallet_proof_authority_challenge_expired");
  const artifactDigest = await sha256ReceizBytes(await exactArtifactBytes(input.artifact));
  const exchanged = await dependencies.rail.exchangeProofAuthorityV123({
    artifact: input.artifact,
    challenge,
    applicationId: input.applicationId,
    scopes
  });
  let authority: ReceizProofAuthorityV123;
  try {
    authority = await validateReceizProofAuthorityV123(exchanged);
  } catch {
    throw new Error("wilds_wallet_proof_authority_invalid");
  }
  assertAuthorityTime(authority, now);
  if (authority.applicationId !== input.applicationId) {
    throw new Error("wilds_wallet_proof_authority_application_mismatch");
  }
  if (authority.artifactDigest !== artifactDigest) {
    throw new Error("wilds_wallet_proof_authority_artifact_mismatch");
  }
  if (authority.keyId !== challenge.proof.keyId) {
    throw new Error("wilds_wallet_proof_authority_key_mismatch");
  }
  if (authority.nonce !== challenge.nonce) {
    throw new Error("wilds_wallet_proof_authority_nonce_mismatch");
  }
  if (authority.issuedAtKai !== challenge.issuedAtKai
    || authority.expiresAtKai !== challenge.expiresAtKai) {
    throw new Error("wilds_wallet_proof_authority_time_invalid");
  }
  if (authority.grantedScopes.length !== scopes.length
    || !scopes.every((scope) => authority.grantedScopes.includes(scope))) {
    throw new Error("wilds_wallet_proof_authority_scope_mismatch");
  }
  const binding = await assertCurrentRevocation(authority, admission);
  if (binding.ownerBinding !== input.ownerBinding) {
    throw new Error("wilds_wallet_proof_authority_owner_mismatch");
  }
  return Object.freeze({
    schema: "wildz.wallet.proof-authority-admission.v1" as const,
    authority,
    ownerBinding: binding.ownerBinding,
    applicationId: authority.applicationId,
    keyId: authority.keyId,
    artifactDigest: authority.artifactDigest,
    nonce: authority.nonce,
    revocationHead: authority.revocationHead,
    admittedAtKai: now
  });
}
