import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReceizExecutionOutcomeV122, ReceizWorldTransactionV122 } from "@receiz/sdk";
import { executeWildsV122Transaction } from "../src/lib/receiz/wilds-v122-world";

const transaction = Object.freeze({
  schema: "receiz.world.transaction.v122" as const,
  transactionId: "1".repeat(64),
  worldId: "wildz:region:0:0",
  expectedWorldHead: "2".repeat(64),
  participantHeads: { "subject:builder": "3".repeat(64) },
  commands: [],
  registryDigest: "4".repeat(64),
  reducerDigest: "5".repeat(64),
  idempotencyKey: "wildz:build:stable",
  transactionDigest: "6".repeat(64)
}) satisfies ReceizWorldTransactionV122;

function committed(): ReceizExecutionOutcomeV122 {
  return { status: "committed", transaction, receipt: { authenticated: true }, events: [] };
}

describe("Wildz v122 exact execution recovery", () => {
  it("stages exact bytes before execute and clears only an authenticated commitment", async () => {
    const order: string[] = [];
    const result = await executeWildsV122Transaction({
      transaction, authority: { actor: "owner" },
      journal: { stage: async () => { order.push("stage"); }, clear: async () => { order.push("clear"); } },
      authenticateReceipt: (receipt) => (receipt as { authenticated?: boolean }).authenticated === true,
      rail: {
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => { order.push("execute"); return committed(); },
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    assert.equal(result.ok, true);
    assert.deepEqual(order, ["stage", "execute", "clear"]);
  });

  it("looks up the exact outcome after a lost committed response and never replans", async () => {
    let byTransaction = 0;
    let byIdempotency = 0;
    const result = await executeWildsV122Transaction({
      transaction, authority: {},
      journal: { stage: async () => undefined, clear: async () => undefined },
      authenticateReceipt: () => true,
      rail: {
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => { throw new Error("response lost"); },
        worldExecutionV122: async () => { byTransaction += 1; return { status: "unknown" }; },
        worldExecutionByIdempotencyKeyV122: async () => { byIdempotency += 1; return committed(); }
      }
    });
    assert.equal(result.ok, true);
    assert.equal(byTransaction, 1);
    assert.equal(byIdempotency, 1);
  });

  it("keeps the journal when both exact lookups remain unknown", async () => {
    let clears = 0;
    const result = await executeWildsV122Transaction({
      transaction, authority: {}, authenticateReceipt: () => true,
      journal: { stage: async () => undefined, clear: async () => { clears += 1; } },
      rail: {
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => { throw new Error("timeout"); },
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    assert.deepEqual(result, { ok: false, code: "receiz_v122_outcome_ambiguous", writes: 0 });
    assert.equal(clears, 0);
  });

  it("rejects validation that does not return the exact transaction bytes", async () => {
    let stages = 0;
    const result = await executeWildsV122Transaction({
      transaction, authority: {}, authenticateReceipt: () => true,
      journal: { stage: async () => { stages += 1; }, clear: async () => undefined },
      rail: {
        validateWorldTransactionV122: async () => ({ ok: true }),
        executeWorldTransactionV122: async () => committed(),
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    assert.deepEqual(result, { ok: false, code: "receiz_v122_transaction_bytes_changed", writes: 0 });
    assert.equal(stages, 0);
  });

  it("preserves the journal for an unbound zero-write response", async () => {
    let clears = 0;
    const result = await executeWildsV122Transaction({
      transaction, authority: {}, authenticateReceipt: () => true,
      journal: { stage: async () => undefined, clear: async () => { clears += 1; } },
      rail: {
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => ({
          status: "zero-write", failure: { writes: 0 }, currentHeads: {}, worldHead: "7".repeat(64)
        }),
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "receiz_v122_zero_write_unverified");
    assert.equal(clears, 0);
  });

  it("clears the journal only for a zero-write response bound to the exact attempt", async () => {
    let clears = 0;
    const result = await executeWildsV122Transaction({
      transaction, authority: {}, authenticateReceipt: () => true,
      journal: { stage: async () => undefined, clear: async () => { clears += 1; } },
      rail: {
        validateWorldTransactionV122: async () => ({ ok: true, transaction }),
        executeWorldTransactionV122: async () => ({
          status: "zero-write",
          failure: {
            writes: 0,
            transactionId: transaction.transactionId,
            idempotencyKey: transaction.idempotencyKey
          },
          currentHeads: {},
          worldHead: "7".repeat(64)
        }),
        worldExecutionV122: async () => ({ status: "unknown" }),
        worldExecutionByIdempotencyKeyV122: async () => ({ status: "unknown" })
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "receiz_v122_zero_write");
    assert.equal(clears, 1);
  });
});
