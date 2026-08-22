import {
  canonicalizeReceizV122,
  validateReceizExecutionReceiptV122,
  type ReceizExecutionOutcomeV122,
  type ReceizWorldTransactionV122
} from "@receiz/sdk";
import type { ReceizCommerceAdapter } from "./adapter";
import { executeWildsV122Transaction } from "./wilds-v122-world";

type ExactWorldRail = Pick<ReceizCommerceAdapter,
  "planWorldCommandV122" | "planWorldTransactionV122" | "validateWorldTransactionV122" | "executeWorldTransactionV122" | "worldExecutionV122" | "worldExecutionByIdempotencyKeyV122"
>;

export type WildsV123DurableTransactionJournal = Readonly<{
  durability: "cross-instance";
  read(worldId: string, transactionId: string): Promise<ReceizWorldTransactionV122 | null>;
  compareAndStage(transaction: ReceizWorldTransactionV122): Promise<"stored" | "same" | "conflict">;
  compareAndClear(worldId: string, transactionId: string, expectedTransactionDigest: string): Promise<boolean>;
}>;

export type WildsV123VerifiedCheckpointStore = Readonly<{
  durability: "cross-instance";
  verification: "receiz-v123-full-chain";
  readVerified(worldId: string): Promise<unknown | null>;
  compareAndSwapVerified(worldId: string, expectedRevision: number, next: unknown): Promise<boolean>;
}>;

export type WildsV123VerifiedAdditionsHydrator = Readonly<{
  verification: "receiz-v123-full-chain";
  hydrate(worldId: string, store: WildsV123VerifiedCheckpointStore): Promise<unknown>;
}>;

export type WildsV123AuthoredActivationPorts = Readonly<{
  rail: ExactWorldRail;
  journal: WildsV123DurableTransactionJournal;
  checkpointStore: WildsV123VerifiedCheckpointStore;
  additionsHydrator: WildsV123VerifiedAdditionsHydrator;
  receiptVerifier: Readonly<{
    authority: "deployment-receiz";
    admitCommittedOutcome(
      outcome: Extract<ReceizExecutionOutcomeV122, { status: "committed" }>,
      transaction: ReceizWorldTransactionV122
    ): Promise<Readonly<{ ok: true; transactionId: string; transactionDigest: string }> | Readonly<{ ok: false }>>;
  }>;
}>;

type CapabilityPorts = Partial<Pick<WildsV123AuthoredActivationPorts,
  "rail" | "journal" | "checkpointStore" | "additionsHydrator" | "receiptVerifier"
>>;

export function wildsV123AuthoredActivationCapability(ports?: CapabilityPorts) {
  const blockers: string[] = [];
  if (!ports?.rail
    || typeof ports.rail.planWorldCommandV122 !== "function"
    || typeof ports.rail.planWorldTransactionV122 !== "function"
    || typeof ports.rail.validateWorldTransactionV122 !== "function"
    || typeof ports.rail.executeWorldTransactionV122 !== "function"
    || typeof ports.rail.worldExecutionV122 !== "function"
    || typeof ports.rail.worldExecutionByIdempotencyKeyV122 !== "function") blockers.push("exact_v123_world_rail");
  if (!ports?.journal || ports.journal.durability !== "cross-instance"
    || typeof ports.journal.read !== "function" || typeof ports.journal.compareAndStage !== "function" || typeof ports.journal.compareAndClear !== "function") {
    blockers.push("durable_transaction_journal");
  }
  if (!ports?.checkpointStore || ports.checkpointStore.durability !== "cross-instance"
    || ports.checkpointStore.verification !== "receiz-v123-full-chain"
    || typeof ports.checkpointStore.readVerified !== "function" || typeof ports.checkpointStore.compareAndSwapVerified !== "function") {
    blockers.push("durable_verified_checkpoint_store");
  }
  if (!ports?.additionsHydrator || ports.additionsHydrator.verification !== "receiz-v123-full-chain"
    || typeof ports.additionsHydrator.hydrate !== "function") blockers.push("verified_additions_hydrator");
  if (!ports?.receiptVerifier || ports.receiptVerifier.authority !== "deployment-receiz"
    || typeof ports.receiptVerifier.admitCommittedOutcome !== "function") blockers.push("authenticated_receipt_verifier");
  return Object.freeze({
    schema: "wildz.authored-world.activation-capability.v123" as const,
    active: blockers.length === 0,
    physical: false as const,
    materialConstruction: false as const,
    privateAuthoredWorld: false as const,
    blockers: Object.freeze(blockers)
  });
}

async function exactLookup(rail: ExactWorldRail, transaction: ReceizWorldTransactionV122) {
  const direct = await rail.worldExecutionV122({ worldId: transaction.worldId, transactionId: transaction.transactionId });
  if (direct.status !== "unknown") return direct;
  return rail.worldExecutionByIdempotencyKeyV122({ worldId: transaction.worldId, idempotencyKey: transaction.idempotencyKey });
}

function journalFor(ports: WildsV123AuthoredActivationPorts, transaction: ReceizWorldTransactionV122) {
  return Object.freeze({
    async stage(value: ReceizWorldTransactionV122) {
      if (canonicalizeReceizV122(value) !== canonicalizeReceizV122(transaction)) throw new Error("wilds_v123_journal_transaction_changed");
      const result = await ports.journal.compareAndStage(value);
      if (result !== "stored" && result !== "same") throw new Error("wilds_v123_journal_conflict");
      const stored = await ports.journal.read(value.worldId, value.transactionId);
      if (!stored || canonicalizeReceizV122(stored) !== canonicalizeReceizV122(value)) {
        throw new Error("wilds_v123_journal_transaction_changed");
      }
    },
    async clear(worldId: string, transactionId: string) {
      if (worldId !== transaction.worldId || transactionId !== transaction.transactionId
        || canonicalizeReceizV122(await ports.journal.read(worldId, transactionId)) !== canonicalizeReceizV122(transaction)
        || !await ports.journal.compareAndClear(worldId, transactionId, transaction.transactionDigest)
        || await ports.journal.read(worldId, transactionId) !== null) {
        throw new Error("wilds_v123_journal_clear_conflict");
      }
    }
  });
}

async function admittedOutcome(
  ports: WildsV123AuthoredActivationPorts,
  outcome: Extract<ReceizExecutionOutcomeV122, { status: "committed" }>,
  transaction: ReceizWorldTransactionV122
) {
  if (canonicalizeReceizV122(outcome.transaction) !== canonicalizeReceizV122(transaction)) return false;
  const admission = await ports.receiptVerifier.admitCommittedOutcome(outcome, transaction);
  return admission.ok && admission.transactionId === transaction.transactionId
    && admission.transactionDigest === transaction.transactionDigest;
}

function exactZeroWrite(outcome: Extract<ReceizExecutionOutcomeV122, { status: "zero-write" }>, transaction: ReceizWorldTransactionV122) {
  if (!outcome.failure || typeof outcome.failure !== "object") return false;
  const failure = outcome.failure as Readonly<Record<string, unknown>>;
  return (failure.writes === 0 || failure.writesOnFailure === 0)
    && failure.transactionId === transaction.transactionId
    && failure.idempotencyKey === transaction.idempotencyKey;
}

export function createWildsV123AuthoredActivation(ports: WildsV123AuthoredActivationPorts) {
  const capability = wildsV123AuthoredActivationCapability(ports);
  if (!capability.active) throw new Error("wilds_v123_authored_activation_ports_required");
  return Object.freeze({
    capability,
    planCommand: ports.rail.planWorldCommandV122,
    planTransaction: ports.rail.planWorldTransactionV122,
    async execute(input: Readonly<{ transaction: ReceizWorldTransactionV122; authority: Readonly<Record<string, unknown>> }>) {
      const admit = (outcome: Extract<ReceizExecutionOutcomeV122, { status: "committed" }>) => admittedOutcome(ports, outcome, input.transaction);
      try {
        return await executeWildsV122Transaction({
          ...input,
          rail: ports.rail,
          journal: journalFor(ports, input.transaction),
          authenticateReceipt: async () => true,
          admitCommittedOutcome: admit
        });
      } catch {
        return Object.freeze({ ok: false as const, code: "wilds_v123_durable_runtime_unavailable", writes: 0 as const });
      }
    },
    async recover(input: Readonly<{ worldId: string; transactionId: string; authority: Readonly<Record<string, unknown>> }>) {
      const transaction = await ports.journal.read(input.worldId, input.transactionId);
      if (!transaction || transaction.worldId !== input.worldId || transaction.transactionId !== input.transactionId) {
        return Object.freeze({ ok: false as const, code: "wilds_v123_pending_transaction_not_found", writes: 0 as const });
      }
      const validation = await ports.rail.validateWorldTransactionV122(transaction);
      if (!validation || typeof validation !== "object" || (validation as { ok?: unknown }).ok !== true
        || !("transaction" in validation)
        || canonicalizeReceizV122((validation as { transaction: ReceizWorldTransactionV122 }).transaction) !== canonicalizeReceizV122(transaction)) {
        return Object.freeze({ ok: false as const, code: "wilds_v123_pending_transaction_invalid", writes: 0 as const });
      }
      const outcome = await exactLookup(ports.rail, transaction);
      if (outcome.status === "committed") {
        if (!await admittedOutcome(ports, outcome, transaction)) {
          return Object.freeze({ ok: false as const, code: "receiz_v123_committed_outcome_unadmitted", writes: 0 as const });
        }
        const verified = await validateReceizExecutionReceiptV122({
          outcome,
          expectedTransactionDigest: transaction.transactionDigest,
          authenticateReceipt: async () => true
        });
        if (!verified.ok) return Object.freeze({ ok: false as const, code: verified.code, writes: 0 as const });
        if (canonicalizeReceizV122(await ports.journal.read(transaction.worldId, transaction.transactionId)) !== canonicalizeReceizV122(transaction)
          || !await ports.journal.compareAndClear(transaction.worldId, transaction.transactionId, transaction.transactionDigest)
          || await ports.journal.read(transaction.worldId, transaction.transactionId) !== null) {
          return Object.freeze({ ok: false as const, code: "wilds_v123_journal_clear_conflict", writes: 0 as const });
        }
        return Object.freeze({ ok: true as const, outcome });
      }
      if (outcome.status === "zero-write") {
        if (!exactZeroWrite(outcome, transaction)) {
          return Object.freeze({ ok: false as const, code: "receiz_v122_zero_write_unverified", writes: 0 as const });
        }
        if (canonicalizeReceizV122(await ports.journal.read(transaction.worldId, transaction.transactionId)) !== canonicalizeReceizV122(transaction)
          || !await ports.journal.compareAndClear(transaction.worldId, transaction.transactionId, transaction.transactionDigest)
          || await ports.journal.read(transaction.worldId, transaction.transactionId) !== null) {
          return Object.freeze({ ok: false as const, code: "wilds_v123_journal_clear_conflict", writes: 0 as const });
        }
        return Object.freeze({ ok: false as const, code: "receiz_v122_zero_write", writes: 0 as const, outcome });
      }
      if (outcome.status !== "unknown") {
        return Object.freeze({ ok: false as const, code: "receiz_v123_execution_outcome_invalid", writes: 0 as const });
      }
      return executeWildsV122Transaction({
        transaction,
        authority: input.authority,
        rail: ports.rail,
        journal: journalFor(ports, transaction),
        authenticateReceipt: async () => true,
        admitCommittedOutcome: (committed) => admittedOutcome(ports, committed, transaction)
      });
    },
    hydrate(worldId: string) {
      return ports.additionsHydrator.hydrate(worldId, ports.checkpointStore);
    }
  });
}
