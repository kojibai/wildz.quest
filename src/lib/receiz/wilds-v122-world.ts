import {
  canonicalizeReceizV122,
  validateReceizExecutionReceiptV122,
  type ReceizExecutionOutcomeV122,
  type ReceizWorldTransactionV122
} from "@receiz/sdk";
import type { ReceizCommerceAdapter } from "./adapter";

type WorldPort = Pick<ReceizCommerceAdapter,
  "validateWorldTransactionV122" | "executeWorldTransactionV122" | "worldExecutionV122" | "worldExecutionByIdempotencyKeyV122"
>;

export type WildsV122TransactionJournal = Readonly<{
  stage(transaction: ReceizWorldTransactionV122): Promise<void>;
  clear(worldId: string, transactionId: string): Promise<void>;
}>;

function validationOk(value: unknown): value is Readonly<{ ok: true; transaction: ReceizWorldTransactionV122 }> {
  return value !== null
    && typeof value === "object"
    && (value as { ok?: unknown }).ok === true
    && (value as { transaction?: unknown }).transaction !== null
    && typeof (value as { transaction?: unknown }).transaction === "object";
}

function zeroWriteBoundToTransaction(outcome: Extract<ReceizExecutionOutcomeV122, { status: "zero-write" }>, transaction: ReceizWorldTransactionV122) {
  if (outcome.failure === null || typeof outcome.failure !== "object") return false;
  const failure = outcome.failure as Readonly<Record<string, unknown>>;
  return (failure.writes === 0 || failure.writesOnFailure === 0)
    && failure.transactionId === transaction.transactionId
    && failure.idempotencyKey === transaction.idempotencyKey;
}

async function lookupExactOutcome(rail: WorldPort, transaction: ReceizWorldTransactionV122) {
  const byTransaction = await rail.worldExecutionV122({ worldId: transaction.worldId, transactionId: transaction.transactionId });
  if (byTransaction.status !== "unknown") return byTransaction;
  return rail.worldExecutionByIdempotencyKeyV122({ worldId: transaction.worldId, idempotencyKey: transaction.idempotencyKey });
}

export async function executeWildsV122Transaction(input: Readonly<{
  transaction: ReceizWorldTransactionV122;
  authority: Readonly<Record<string, unknown>>;
  rail: WorldPort;
  journal: WildsV122TransactionJournal;
  authenticateReceipt(receipt: unknown): boolean | Promise<boolean>;
}>) {
  const validation = await input.rail.validateWorldTransactionV122(input.transaction);
  if (validation !== null && typeof validation === "object" && (validation as { ok?: unknown }).ok !== true) {
    return Object.freeze({ ok: false as const, code: "receiz_v122_transaction_invalid", writes: 0 as const });
  }
  if (!validationOk(validation)
    || canonicalizeReceizV122(validation.transaction) !== canonicalizeReceizV122(input.transaction)) {
    return Object.freeze({ ok: false as const, code: "receiz_v122_transaction_bytes_changed", writes: 0 as const });
  }
  await input.journal.stage(input.transaction);
  let outcome: ReceizExecutionOutcomeV122;
  try {
    outcome = await input.rail.executeWorldTransactionV122({ transaction: input.transaction, authority: input.authority });
  } catch {
    outcome = await lookupExactOutcome(input.rail, input.transaction);
  }
  if (outcome.status === "unknown") {
    return Object.freeze({ ok: false as const, code: "receiz_v122_outcome_ambiguous", writes: 0 as const });
  }
  if (outcome.status === "zero-write") {
    if (!zeroWriteBoundToTransaction(outcome, input.transaction)) {
      return Object.freeze({ ok: false as const, code: "receiz_v122_zero_write_unverified", writes: 0 as const, outcome });
    }
    await input.journal.clear(input.transaction.worldId, input.transaction.transactionId);
    return Object.freeze({ ok: false as const, code: "receiz_v122_zero_write", writes: 0 as const, outcome });
  }
  const receipt = await validateReceizExecutionReceiptV122({
    outcome,
    expectedTransactionDigest: input.transaction.transactionDigest,
    authenticateReceipt: input.authenticateReceipt
  });
  if (!receipt.ok) return Object.freeze({ ok: false as const, code: receipt.code, writes: 0 as const });
  await input.journal.clear(input.transaction.worldId, input.transaction.transactionId);
  return Object.freeze({ ok: true as const, outcome });
}
