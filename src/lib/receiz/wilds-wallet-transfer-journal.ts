import "server-only";

import {
  validateReceizValueIntentV122,
  type ReceizWorldValueIntentV122
} from "@receiz/sdk";

const SHA256 = /^[0-9a-f]{64}$/;
const POSITIVE_INTEGER = /^[1-9][0-9]*$/;
const UNSIGNED_INTEGER = /^[0-9]+$/;
const ENTRY_KEYS = [
  "applicationId",
  "authorityDigest",
  "idempotencyKey",
  "intent",
  "ownerBinding",
  "rail",
  "schema"
] as const;
const INTENT_KEYS = [
  "amountPhiMicro",
  "destinationSubjectId",
  "expectedDestinationHead",
  "idempotencyKey",
  "priceBasisDigest",
  "quotedUsdCents",
  "rail",
  "schema",
  "sourceProofObjectId",
  "sourceValueHead",
  "usdPerPhiMicrocents",
  "valueIntentDigest"
] as const;

export type WildsWalletTransferJournalEntry = Readonly<{
  schema: "wildz.wallet.phi-transfer-journal.v1";
  ownerBinding: string;
  applicationId: string;
  idempotencyKey: string;
  rail: "settlement" | "reserve";
  intent: ReceizWorldValueIntentV122;
  authorityDigest: string | null;
}>;

export type WildsWalletTransferTerminalProjection = Readonly<
  | { status: "zero-write"; rail: "settlement" | "reserve"; code: string }
  | { status: "committed"; rail: "settlement" | "reserve"; amountPhiMicro: string }
>;

export type WildsWalletTransferTerminalIntegrityBasis = Readonly<{
  schema: "wildz.wallet.phi-transfer-terminal.v1";
  entry: WildsWalletTransferJournalEntry;
  projection: WildsWalletTransferTerminalProjection;
  terminalizedAtKai: number;
  retainUntilKai: number;
}>;

export type WildsWalletTransferTerminalRecord = Readonly<WildsWalletTransferTerminalIntegrityBasis & {
  terminalIntegrityDigest: string;
}>;

export interface WildsWalletTransferTerminalIntegrityPort {
  readonly serverDerived: true;
  digest(basis: WildsWalletTransferTerminalIntegrityBasis): Promise<string>;
}

export const WILDS_WALLET_TERMINAL_RETENTION_KAI = 86_400;

/**
 * Server-only durable storage boundary. Implementations must be cross-instance,
 * encrypted at rest, and owner-scoped. There is intentionally no process-local
 * or browser fallback.
 */
export interface WildsWalletTransferJournalPort {
  readonly durable: true;
  load(ownerBinding: string, idempotencyKey: string): Promise<WildsWalletTransferJournalEntry | null>;
  loadTerminal(ownerBinding: string, idempotencyKey: string): Promise<WildsWalletTransferTerminalRecord | null>;
  /** Atomically inserts when absent and otherwise returns the existing exact winner. */
  stage(entry: WildsWalletTransferJournalEntry): Promise<WildsWalletTransferJournalEntry>;
  /** Atomically binds once; a different existing digest must never be overwritten. */
  bindAuthority(
    ownerBinding: string,
    idempotencyKey: string,
    authorityDigest: string
  ): Promise<WildsWalletTransferJournalEntry | null>;
  /**
   * Atomically replaces the exact pending entry with its terminal result.
   * A different row, result, or semantic basis must return null unchanged.
   */
  terminalize(
    entry: WildsWalletTransferJournalEntry,
    projection: WildsWalletTransferTerminalProjection,
    terminalizedAtKai: number,
    retainUntilKai: number,
    terminalIntegrityDigest: string
  ): Promise<WildsWalletTransferTerminalRecord | null>;
  /** Bounded cleanup; implementations must never scan or delete more than limit rows. */
  purgeTerminal(currentKai: number, limit: number): Promise<number>;
}

type JournalEntryExpectation = Readonly<{
  ownerBinding?: string;
  applicationId?: string;
  idempotencyKey?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validPrivateCoordinate(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256;
}

function invalidJournal(): never {
  throw new Error("wilds_wallet_transfer_journal_invalid");
}

export async function admitWildsWalletTransferJournalEntry(
  value: unknown,
  expected: JournalEntryExpectation = {}
): Promise<WildsWalletTransferJournalEntry> {
  if (!isRecord(value) || !hasExactKeys(value, ENTRY_KEYS) || !isRecord(value.intent)) invalidJournal();
  const snapshot: Record<string, unknown> = { ...value, intent: { ...value.intent } };
  if (snapshot.schema !== "wildz.wallet.phi-transfer-journal.v1"
    || !validPrivateCoordinate(snapshot.ownerBinding)
    || !validPrivateCoordinate(snapshot.applicationId)
    || !validPrivateCoordinate(snapshot.idempotencyKey)
    || (snapshot.rail !== "settlement" && snapshot.rail !== "reserve")
    || (snapshot.authorityDigest !== null
      && (typeof snapshot.authorityDigest !== "string" || !SHA256.test(snapshot.authorityDigest)))
    || !isRecord(snapshot.intent)
    || !hasExactKeys(snapshot.intent, INTENT_KEYS)) {
    invalidJournal();
  }
  const intent = snapshot.intent as unknown as ReceizWorldValueIntentV122;
  let sdkValid = false;
  try {
    sdkValid = await validateReceizValueIntentV122(intent);
  } catch { /* normalized below */ }
  if (!sdkValid
    || intent.schema !== "receiz.world.value-intent.v122"
    || intent.rail !== snapshot.rail
    || intent.idempotencyKey !== snapshot.idempotencyKey
    || !POSITIVE_INTEGER.test(intent.amountPhiMicro)
    || !POSITIVE_INTEGER.test(intent.usdPerPhiMicrocents)
    || !UNSIGNED_INTEGER.test(intent.quotedUsdCents)
    || !SHA256.test(intent.priceBasisDigest)
    || !validPrivateCoordinate(intent.sourceProofObjectId)
    || !SHA256.test(intent.sourceValueHead)
    || !validPrivateCoordinate(intent.destinationSubjectId)
    || !SHA256.test(intent.expectedDestinationHead)
    || !SHA256.test(intent.valueIntentDigest)
    || (expected.ownerBinding !== undefined && snapshot.ownerBinding !== expected.ownerBinding)
    || (expected.applicationId !== undefined && snapshot.applicationId !== expected.applicationId)
    || (expected.idempotencyKey !== undefined && snapshot.idempotencyKey !== expected.idempotencyKey)) {
    invalidJournal();
  }
  return Object.freeze({
    schema: "wildz.wallet.phi-transfer-journal.v1",
    ownerBinding: snapshot.ownerBinding as string,
    applicationId: snapshot.applicationId as string,
    idempotencyKey: snapshot.idempotencyKey as string,
    rail: snapshot.rail,
    intent: Object.freeze({ ...intent }),
    authorityDigest: snapshot.authorityDigest as string | null
  });
}

export async function admitWildsWalletTransferTerminalRecord(
  value: unknown,
  expected: JournalEntryExpectation = {}
): Promise<WildsWalletTransferTerminalRecord> {
  if (!isRecord(value) || !hasExactKeys(value, ["entry", "projection", "retainUntilKai", "schema", "terminalIntegrityDigest", "terminalizedAtKai"]) || !isRecord(value.projection)) {
    invalidJournal();
  }
  const entry = await admitWildsWalletTransferJournalEntry(value.entry, expected);
  const projection = value.projection;
  const keys = Object.keys(projection).sort();
  const committed = projection.status === "committed"
    && keys.join("\0") === ["amountPhiMicro", "rail", "status"].sort().join("\0")
    && projection.rail === entry.rail
    && projection.amountPhiMicro === entry.intent.amountPhiMicro;
  const zeroWrite = projection.status === "zero-write"
    && keys.join("\0") === ["code", "rail", "status"].sort().join("\0")
    && projection.rail === entry.rail
    && typeof projection.code === "string"
    && /^[A-Z_]{3,64}$/.test(projection.code);
  if (value.schema !== "wildz.wallet.phi-transfer-terminal.v1"
    || (!committed && !zeroWrite)
    || !Number.isSafeInteger(value.terminalizedAtKai)
    || !Number.isSafeInteger(value.retainUntilKai)
    || typeof value.terminalIntegrityDigest !== "string"
    || !SHA256.test(value.terminalIntegrityDigest)
    || (value.terminalizedAtKai as number) < 0
    || (value.retainUntilKai as number) <= (value.terminalizedAtKai as number)
    || (value.retainUntilKai as number) - (value.terminalizedAtKai as number) > WILDS_WALLET_TERMINAL_RETENTION_KAI) {
    invalidJournal();
  }
  return Object.freeze({
    schema: "wildz.wallet.phi-transfer-terminal.v1",
    entry,
    projection: Object.freeze({ ...projection }) as WildsWalletTransferTerminalProjection,
    terminalizedAtKai: value.terminalizedAtKai as number,
    retainUntilKai: value.retainUntilKai as number,
    terminalIntegrityDigest: value.terminalIntegrityDigest as string
  });
}

export function requireWildsWalletTransferJournal(
  journal: WildsWalletTransferJournalPort | undefined
): WildsWalletTransferJournalPort {
  if (!journal || journal.durable !== true) {
    throw new Error("wilds_wallet_durable_journal_required");
  }
  return journal;
}
