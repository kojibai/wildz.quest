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

/**
 * Server-only durable storage boundary. Implementations must be cross-instance,
 * encrypted at rest, and owner-scoped. There is intentionally no process-local
 * or browser fallback.
 */
export interface WildsWalletTransferJournalPort {
  readonly durable: true;
  load(ownerBinding: string, idempotencyKey: string): Promise<WildsWalletTransferJournalEntry | null>;
  /** Atomically inserts when absent and otherwise returns the existing exact winner. */
  stage(entry: WildsWalletTransferJournalEntry): Promise<WildsWalletTransferJournalEntry>;
  /** Atomically binds once; a different existing digest must never be overwritten. */
  bindAuthority(
    ownerBinding: string,
    idempotencyKey: string,
    authorityDigest: string
  ): Promise<WildsWalletTransferJournalEntry | null>;
  /** Atomically removes only when the entire supplied entry is still current. */
  remove(entry: WildsWalletTransferJournalEntry): Promise<boolean>;
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

export function requireWildsWalletTransferJournal(
  journal: WildsWalletTransferJournalPort | undefined
): WildsWalletTransferJournalPort {
  if (!journal || journal.durable !== true) {
    throw new Error("wilds_wallet_durable_journal_required");
  }
  return journal;
}
