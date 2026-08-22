import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReceizExecutionOutcomeV122, ReceizWorldTransactionV122 } from "@receiz/sdk";
import {
  createWildsV123AuthoredActivation,
  wildsV123AuthoredActivationCapability,
  type WildsV123DurableTransactionJournal
} from "../src/lib/receiz/wilds-v123-authored-activation";
import { GET } from "../app/api/wilds/excavation/route";

const transaction = Object.freeze({
  schema: "receiz.world.transaction.v122" as const,
  transactionId: "1".repeat(64),
  worldId: "wildz.excavation.region.v1:0:0",
  expectedWorldHead: "2".repeat(64),
  participantHeads: { "subject:builder": "3".repeat(64) },
  commands: [],
  registryDigest: "4".repeat(64),
  reducerDigest: "5".repeat(64),
  idempotencyKey: "wildz:excavation:stable",
  transactionDigest: "6".repeat(64)
}) satisfies ReceizWorldTransactionV122;

function committed(): ReceizExecutionOutcomeV122 {
  return { status: "committed", transaction, receipt: { authenticated: true }, events: [] };
}

function sharedJournal() {
  const entries = new Map<string, ReceizWorldTransactionV122>();
  const journal: WildsV123DurableTransactionJournal = {
    durability: "cross-instance",
    read: async (worldId, transactionId) => entries.get(`${worldId}:${transactionId}`) ?? null,
    compareAndStage: async (value) => {
      const key = `${value.worldId}:${value.transactionId}`;
      const current = entries.get(key);
      if (current && current.transactionDigest !== value.transactionDigest) return "conflict";
      entries.set(key, value);
      return current ? "same" : "stored";
    },
    compareAndClear: async (worldId, transactionId, expectedDigest) => {
      const key = `${worldId}:${transactionId}`;
      if (entries.get(key)?.transactionDigest !== expectedDigest) return false;
      entries.delete(key);
      return true;
    }
  };
  return { entries, journal };
}

describe("Wilds V123 authored-world activation boundary", () => {
  it("is explicitly unavailable without every durable deployment port", () => {
    assert.deepEqual(wildsV123AuthoredActivationCapability(), {
      schema: "wildz.authored-world.activation-capability.v123",
      active: false,
      physical: false,
      materialConstruction: false,
      privateAuthoredWorld: false,
      blockers: ["exact_v123_world_rail", "durable_transaction_journal", "durable_verified_checkpoint_store", "verified_additions_hydrator", "authenticated_receipt_verifier"]
    });
  });

  it("publishes the production capability route as fail-closed by default", async () => {
    const response = await GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schema, "wildz.authored-world.activation-capability.v123");
    assert.equal(body.active, false);
    assert.equal(body.physical, false);
  });

  it("recovers a committed transaction across runtime instances from one durable journal without replanning", async () => {
    const { entries, journal } = sharedJournal();
    let lookups = 0;
    const common = {
      journal,
      checkpointStore: { durability: "cross-instance" as const, verification: "receiz-v123-full-chain" as const, readVerified: async () => null, compareAndSwapVerified: async () => true },
      additionsHydrator: { verification: "receiz-v123-full-chain" as const, hydrate: async () => null },
      receiptVerifier: {
        authority: "deployment-receiz" as const,
        admitCommittedOutcome: async (outcome: ReceizExecutionOutcomeV122) => outcome.status === "committed" && (outcome.receipt as { authenticated?: boolean }).authenticated === true
          ? { ok: true as const, transactionId: transaction.transactionId, transactionDigest: transaction.transactionDigest }
          : { ok: false as const }
      }
    };
    const first = createWildsV123AuthoredActivation({
      ...common,
      rail: {
        planWorldCommandV122: async () => { throw new Error("not used"); },
        planWorldTransactionV122: async () => transaction,
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => { throw new Error("response lost"); },
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    const ambiguous = await first.execute({ transaction, authority: {} });
    assert.equal(ambiguous.ok, false);
    assert.equal(entries.size, 1);

    const second = createWildsV123AuthoredActivation({
      ...common,
      rail: {
        planWorldCommandV122: async () => { throw new Error("not used"); },
        planWorldTransactionV122: async () => transaction,
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => { throw new Error("must resolve before retry"); },
        worldExecutionV122: async () => { lookups += 1; return committed(); },
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    const recovered = await second.recover({
      worldId: transaction.worldId,
      transactionId: transaction.transactionId,
      authority: {}
    });
    assert.equal(recovered.ok, true);
    assert.equal(lookups, 1);
    assert.equal(entries.size, 0);
  });

  it("never exposes material or private mutation at this public V123 boundary", () => {
    const rail = {
      planWorldCommandV122: async () => { throw new Error("not used"); },
      planWorldTransactionV122: async () => transaction,
      validateWorldTransactionV122: async () => ({ ok: true, transaction }),
      executeWorldTransactionV122: async () => committed(),
      worldExecutionV122: async () => ({ status: "unknown" as const }),
      worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" as const })
    };
    const capability = wildsV123AuthoredActivationCapability({
      rail, journal: sharedJournal().journal,
      checkpointStore: { durability: "cross-instance", verification: "receiz-v123-full-chain", readVerified: async () => null, compareAndSwapVerified: async () => true },
      additionsHydrator: { verification: "receiz-v123-full-chain", hydrate: async () => null },
      receiptVerifier: { authority: "deployment-receiz", admitCommittedOutcome: async () => ({ ok: true, transactionId: transaction.transactionId, transactionDigest: transaction.transactionDigest }) }
    });
    assert.equal(capability.active, true);
    assert.equal(capability.materialConstruction, false);
    assert.equal(capability.privateAuthoredWorld, false);
  });

  it("does not accept shape-only dummy deployment ports", () => {
    assert.equal(wildsV123AuthoredActivationCapability({
      rail: {} as never,
      journal: {} as never,
      checkpointStore: {} as never,
      additionsHydrator: {} as never,
      receiptVerifier: {} as never
    }).active, false);
  });

  it("preserves the exact journal row when a shaped commitment is not bound to the staged transaction", async () => {
    const { entries, journal } = sharedJournal();
    const altered = { ...transaction, transactionDigest: "9".repeat(64) } satisfies ReceizWorldTransactionV122;
    const activation = createWildsV123AuthoredActivation({
      journal,
      checkpointStore: { durability: "cross-instance", verification: "receiz-v123-full-chain", readVerified: async () => null, compareAndSwapVerified: async () => true },
      additionsHydrator: { verification: "receiz-v123-full-chain", hydrate: async () => null },
      receiptVerifier: { authority: "deployment-receiz", admitCommittedOutcome: async () => ({ ok: true, transactionId: transaction.transactionId, transactionDigest: transaction.transactionDigest }) },
      rail: {
        planWorldCommandV122: async () => { throw new Error("not used"); },
        planWorldTransactionV122: async () => transaction,
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => ({ status: "committed", transaction: altered, receipt: { authenticated: true }, events: [] }),
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    const result = await activation.execute({ transaction, authority: {} });
    assert.equal(result.ok, false);
    assert.equal(result.code, "receiz_v123_committed_outcome_unadmitted");
    assert.equal(entries.size, 1);
  });

  it("does not execute when the durable journal reports a same-ID transaction conflict", async () => {
    const shared = sharedJournal();
    let executes = 0;
    const activation = createWildsV123AuthoredActivation({
      journal: { ...shared.journal, compareAndStage: async () => "conflict" },
      checkpointStore: { durability: "cross-instance", verification: "receiz-v123-full-chain", readVerified: async () => null, compareAndSwapVerified: async () => true },
      additionsHydrator: { verification: "receiz-v123-full-chain", hydrate: async () => null },
      receiptVerifier: { authority: "deployment-receiz", admitCommittedOutcome: async () => ({ ok: false }) },
      rail: {
        planWorldCommandV122: async () => { throw new Error("not used"); },
        planWorldTransactionV122: async () => transaction,
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => { executes += 1; return committed(); },
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    assert.deepEqual(await activation.execute({ transaction, authority: {} }), {
      ok: false, code: "wilds_v123_durable_runtime_unavailable", writes: 0
    });
    assert.equal(executes, 0);
  });

  it("does not retry a malformed recovery outcome and retains the exact journal", async () => {
    const { entries, journal } = sharedJournal();
    await journal.compareAndStage(transaction);
    let executes = 0;
    const activation = createWildsV123AuthoredActivation({
      journal,
      checkpointStore: { durability: "cross-instance", verification: "receiz-v123-full-chain", readVerified: async () => null, compareAndSwapVerified: async () => true },
      additionsHydrator: { verification: "receiz-v123-full-chain", hydrate: async () => null },
      receiptVerifier: { authority: "deployment-receiz", admitCommittedOutcome: async () => ({ ok: false }) },
      rail: {
        planWorldCommandV122: async () => { throw new Error("not used"); },
        planWorldTransactionV122: async () => transaction,
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => { executes += 1; return committed(); },
        worldExecutionV122: async () => ({ status: "malformed" } as never),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    assert.deepEqual(await activation.recover({ worldId: transaction.worldId, transactionId: transaction.transactionId, authority: {} }), {
      ok: false, code: "receiz_v123_execution_outcome_invalid", writes: 0
    });
    assert.equal(executes, 0);
    assert.equal(entries.size, 1);
  });
});
