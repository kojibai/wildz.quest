import assert from "node:assert/strict";
import test from "node:test";
import type { WildzContinuityDatabase } from "../src/lib/storage/wildz-indexed-db";

const modulePath = "../src/features/play/wallet/wilds-wallet-connect-phi-archive.js";
const binding = { ownerHandle: "alice.receiz.id", keyId: "a".repeat(64) };
const leg = { attemptId: "market:purchase:one:phi", senderHandle: "alice.receiz.id", recipientHandle: "bob.receiz.id", amountPhiMicro: "500000" };
const entry = { leg, attempt: "v3.exact.native-attempt", phase: "submitted" as const };
const receipt = { schema: "wildz.wallet.connect-transfer-receipt.v1", leg, attempt: entry.attempt };

async function archiveModule() {
  const loaded = await import(modulePath).catch(() => null);
  assert.ok(loaded, "the exact native Phi attempt archive helper must exist");
  return loaded;
}
function memory() {
  const rows = new Map<string, unknown>();
  let failWrite = false, corruptRead = false;
  const database: WildzContinuityDatabase = {
    async read(_store, key) {
      const value = structuredClone(rows.get(String(key)) ?? null);
      if (corruptRead && value && typeof value === "object") (value as { digest: string }).digest = "0".repeat(64);
      return value as never;
    },
    async transaction(_stores, _mode, run) {
      if (failWrite) throw Error("archive quota");
      const next = new Map(rows);
      const result = await run({
        get: async (_store, key) => structuredClone(next.get(String(key)) ?? null) as never,
        getAll: async () => [...next.values()].map(value => structuredClone(value)) as never,
        put: async (_store, value, key) => { next.set(String(key), structuredClone(value)); },
        delete: async (_store, key) => { next.delete(String(key)); }
      });
      rows.clear(); for (const [key, value] of next) rows.set(key, value);
      return result;
    }
  };
  return { database, rows, fail: () => { failWrite = true; }, corrupt: () => { corruptRead = true; } };
}

test("archive construction does no storage work; canonical qualification precedes immutable retention", async () => {
  const { createWildsWalletConnectPhiArchiveStore } = await archiveModule(), f = memory();
  let qualification = 0;
  const archive = createWildsWalletConnectPhiArchiveStore({ database: f.database, qualifyCommitted: async (value: unknown) => {
    assert.deepEqual(value, entry); assert.equal(f.rows.size, 0); qualification++; return { status: "committed", receipt };
  } });
  assert.equal(f.rows.size, 0); assert.equal(qualification, 0);
  assert.deepEqual(await archive.retain(binding, entry), entry);
  assert.equal(qualification, 1);
  const reopened = createWildsWalletConnectPhiArchiveStore({ database: f.database, qualifyCommitted: async () => { throw Error("read is only byte retention"); } });
  assert.deepEqual(await reopened.read(binding, leg), entry);
  assert.equal(await reopened.read({ ...binding, keyId: "b".repeat(64) }, leg), null);
});

test("unsettled and wrong-original outcomes never permit active-attempt eviction", async () => {
  const { createWildsWalletConnectPhiArchiveStore } = await archiveModule();
  for (const outcome of [{ status: "pending", receipt }, { status: "failed", receipt }, { status: "none" },
    { status: "zero-write", receipt }, { status: "committed", receipt: { ...receipt, attempt: "v3.different-native-attempt" } },
    { status: "committed", receipt: { ...receipt, leg: { ...leg, amountPhiMicro: "999999" } } }]) {
    const f = memory(), archive = createWildsWalletConnectPhiArchiveStore({ database: f.database, qualifyCommitted: async () => outcome });
    await assert.rejects(archive.retain(binding, entry)); assert.equal(f.rows.size, 0);
  }
  const f = memory(), archive = createWildsWalletConnectPhiArchiveStore({ database: f.database, qualifyCommitted: async () => ({ status: "committed", receipt }) });
  for (const phase of ["prepared", "pending", "failed", "zero-write"]) await assert.rejects(archive.retain(binding, { ...entry, phase }));
  assert.equal(f.rows.size, 0);
});

test("archived exact native attempts cannot change parties, amount, device, or nonce", async () => {
  const { createWildsWalletConnectPhiArchiveStore } = await archiveModule(), f = memory();
  const archive = createWildsWalletConnectPhiArchiveStore({ database: f.database, qualifyCommitted: async (value: typeof entry) => ({ status: "committed", receipt: { ...receipt, leg: value.leg, attempt: value.attempt } }) });
  await archive.retain(binding, entry);
  for (const changed of [{ ...leg, amountPhiMicro: "999999" }, { ...leg, recipientHandle: "carol.receiz.id" }]) await assert.rejects(archive.read(binding, changed));
  await assert.rejects(archive.retain(binding, { ...entry, attempt: "v3.replacement-nonce" }));
  await assert.rejects(archive.retain({ ...binding, ownerHandle: "mallory.receiz.id" }, entry));
  assert.deepEqual(await archive.read(binding, leg), entry);
  const stored = [...f.rows.values()][0] as { entry: typeof entry };
  stored.entry.attempt = "v3.storage-tamper";
  await assert.rejects(archive.read(binding, leg));
});

test("quota, failed readback, and Explorer switch retain the active native checkpoint", async () => {
  const { createWildsWalletConnectPhiArchiveStore } = await archiveModule();
  for (const failure of ["quota", "readback"] as const) {
    const f = memory(); if (failure === "quota") f.fail(); else f.corrupt();
    const archive = createWildsWalletConnectPhiArchiveStore({ database: f.database, qualifyCommitted: async () => ({ status: "committed", receipt }) });
    await assert.rejects(archive.retain(binding, entry));
  }
  const f = memory(); let current = binding;
  const archive = createWildsWalletConnectPhiArchiveStore({ database: f.database, currentBinding: () => current,
    qualifyCommitted: async () => { current = { ...binding, ownerHandle: "mallory.receiz.id" }; return { status: "committed", receipt }; } });
  await assert.rejects(archive.retain(binding, entry), /Explorer/); assert.equal(f.rows.size, 0);
});
