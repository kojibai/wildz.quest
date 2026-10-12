import assert from "node:assert/strict";
import {test} from "node:test";
import {createWildzMarketArchiveStoreV128} from "../src/features/market/wildz-market-archive-v128";
import {createMemoryWildzContinuityDatabase} from "./support/memory-wildz-continuity-database";

test("archive discovery never clones unrelated source or another identity's meta records", async () => {
  const memory = createMemoryWildzContinuityDatabase();
  await memory.transaction(["meta"], "readwrite", async tx => {
    await tx.put("meta", {sourceArtifactBytes: "unrelated source bytes"}, "wildz.resource-source-attempt");
    await tx.put("meta", {schema: "wildz.market.private-archive.v128", owner: {ownerHandle: "other.receiz.id", keyId: "b".repeat(64)}, kind: "purchase"},
      JSON.stringify(["wildz.market.private-archive.v128", "other.receiz.id", "b".repeat(64), "purchase", "retained"]));
  });
  const database = {...memory, transaction: async <T>(stores: Parameters<typeof memory.transaction>[0], mode: IDBTransactionMode,
    operation: Parameters<typeof memory.transaction<T>>[2]) => memory.transaction(stores, mode, tx => operation({...tx,
      getAll: async () => { throw Error("UNBOUNDED_META_CLONE"); }
    }))};
  const archived = await createWildzMarketArchiveStoreV128(database).readPurchases!({ownerHandle: "alice.receiz.id", keyId: "a".repeat(64)});
  assert.deepEqual(archived, []);
  assert.equal(memory.dump().meta.length, 2, "discovery preserves every retained source and other identity archive");
});
