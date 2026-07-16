import assert from "node:assert/strict";
import test from "node:test";
import { MemoryArenaOfflineStore, type ArenaOfflineTransaction } from "../src/features/play/arena/offline-store.js";

const tx: ArenaOfflineTransaction = {
  id: "tx-1", playerId: "player-1", expectedRevision: 0,
  pendingReceipt: { digest: "receipt-1" },
  cardRevisions: { wolf: { digest: "card-1" } },
  vault: { digest: "vault-1", inventory: { shard: 2 } },
  conflicts: [],
};

test("one atomic commit updates receipt, card revisions, and Vault together", async () => {
  const store = new MemoryArenaOfflineStore();
  const snapshot = await store.commit(tx);
  assert.equal(snapshot.revision, 1);
  assert.deepEqual(snapshot.pendingReceipts, [tx.pendingReceipt]);
  assert.deepEqual(snapshot.cardRevisions, tx.cardRevisions);
  assert.deepEqual(snapshot.vault, tx.vault);
});

test("an injected failure changes none of the local authority", async () => {
  const store = new MemoryArenaOfflineStore();
  store.failNextCommit("after-receipt");
  await assert.rejects(store.commit(tx), /arena_offline_commit_injected_failure/);
  assert.equal(await store.restore("player-1"), null);
});

test("duplicate transactions are idempotent and stale writers fail", async () => {
  const store = new MemoryArenaOfflineStore();
  const first = await store.commit(tx);
  assert.deepEqual(await store.commit(tx), first);
  await assert.rejects(store.commit({ ...tx, id: "tx-2", expectedRevision: 0 }), /arena_offline_revision_conflict/);
});
