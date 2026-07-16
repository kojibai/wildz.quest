import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzContinuityDatabase } from "../src/lib/storage/wildz-indexed-db";
import { createFakeIndexedDb } from "./support/fake-indexed-db";

class FailingOpenRequest extends EventTarget {
  readonly error = new DOMException("wildz_test_open_failed", "UnknownError");
  result!: IDBDatabase;
}

function failFirstOpen(delegate: IDBFactory) {
  let openCount = 0;
  const factory = {
    open(name: string, version?: number) {
      openCount += 1;
      if (openCount > 1) {
        return version === undefined ? delegate.open(name) : delegate.open(name, version);
      }
      const request = new FailingOpenRequest();
      queueMicrotask(() => request.dispatchEvent(new Event("error")));
      return request as unknown as IDBOpenDBRequest;
    }
  } as unknown as IDBFactory;
  return { factory, openCount: () => openCount };
}

function trackVersionChange(delegate: IDBFactory) {
  let database: (IDBDatabase & EventTarget) | null = null;
  let openCount = 0;
  let closed = false;
  let patched = false;
  const factory = {
    open(name: string, version?: number) {
      openCount += 1;
      const request = version === undefined ? delegate.open(name) : delegate.open(name, version);
      request.addEventListener("success", () => {
        database = request.result as IDBDatabase & EventTarget;
        closed = false;
        if (patched) return;
        patched = true;
        const mutable = database as unknown as {
          close(): void;
          transaction(...args: unknown[]): IDBTransaction;
        };
        const close = mutable.close.bind(database);
        const transaction = mutable.transaction.bind(database);
        mutable.close = () => {
          closed = true;
          close();
        };
        mutable.transaction = (...args: unknown[]) => {
          if (closed) throw new DOMException("wildz_test_database_closed", "InvalidStateError");
          return transaction(...args);
        };
      });
      return request;
    }
  } as unknown as IDBFactory;
  return {
    factory,
    openCount: () => openCount,
    triggerVersionChange() {
      if (!database) throw new Error("wildz_test_database_not_open");
      database.dispatchEvent(new Event("versionchange"));
    }
  };
}

test("production adapter waits for completion and structured-clones CryptoKey values", async () => {
  const fake = createFakeIndexedDb();
  const database = createWildzContinuityDatabase({ factory: fake.factory, name: "wildz-adapter-complete" });
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  const completion = fake.gateNextCompletion();
  let settled = false;
  const pending = database.transaction(["wrappingKeys"], "readwrite", async (tx) => {
    await tx.put("wrappingKeys", key, "identity-key");
  });
  void pending.then(() => { settled = true; }, () => { settled = true; });

  await completion.completionReached;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(fake.dump("wrappingKeys").length, 0);
  completion.releaseCompletion();
  await pending;

  assert.deepEqual(fake.storeNames(), ["identities", "meta", "ownerStates", "pendingRestores", "wrappingKeys"]);
  assert.equal(fake.completedTransactions, 1);
  const restored = await database.read<CryptoKey>("wrappingKeys", "identity-key");
  assert.ok(restored);
  assert.notEqual(restored, key);
  assert.equal(restored.extractable, false);
  assert.deepEqual([...restored.usages].sort(), ["decrypt", "encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode("wildz-structured-clone");
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, restored, plaintext);
  assert.equal(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, restored, ciphertext)), "wildz-structured-clone");
});

test("production adapter waits for terminal abort after a request failure", async () => {
  const fake = createFakeIndexedDb();
  const database = createWildzContinuityDatabase({ factory: fake.factory, name: "wildz-adapter-request-failure" });
  const failure = new DOMException("wildz_test_quota_exceeded", "QuotaExceededError");
  const abort = fake.gateNextAbort();
  let settled = false;
  const pending = database.transaction(["meta"], "readwrite", async (tx) => {
    await tx.put("meta", { step: 1 }, "first");
    fake.failNextRequest(failure);
    await tx.put("meta", { step: 2 }, "second");
  });
  void pending.then(() => { settled = true; }, () => { settled = true; });

  await abort.transactionError;
  await new Promise<void>((resolve) => setImmediate(resolve));
  const settledBeforeAbort = settled;
  abort.releaseAbort();
  await assert.rejects(pending, (cause) => cause === failure);

  assert.equal(settledBeforeAbort, false);
  assert.equal(fake.abortedTransactions, 1);
  assert.equal(fake.dump("meta").length, 0);
});

test("production adapter aborts and rolls back after an operation throws", async () => {
  const fake = createFakeIndexedDb();
  const database = createWildzContinuityDatabase({ factory: fake.factory, name: "wildz-adapter-operation-failure" });

  await assert.rejects(
    database.transaction(["identities"], "readwrite", async (tx) => {
      await tx.put("identities", { step: 1 }, "first");
      throw new Error("wildz_test_operation_failed");
    }),
    /wildz_test_operation_failed/
  );

  assert.equal(fake.abortedTransactions, 1);
  assert.equal(fake.dump("identities").length, 0);
});

test("production adapter retries opening after a failed open request", async () => {
  const fake = createFakeIndexedDb();
  const controlled = failFirstOpen(fake.factory);
  const database = createWildzContinuityDatabase({ factory: controlled.factory, name: "wildz-adapter-open-retry" });

  await assert.rejects(database.read("meta", "status"), /wildz_test_open_failed/);
  await database.transaction(["meta"], "readwrite", (tx) => tx.put("meta", "ready", "status"));

  assert.equal(await database.read("meta", "status"), "ready");
  assert.equal(controlled.openCount(), 2);
});

test("production adapter reopens after its connection receives versionchange", async () => {
  const fake = createFakeIndexedDb();
  const controlled = trackVersionChange(fake.factory);
  const database = createWildzContinuityDatabase({ factory: controlled.factory, name: "wildz-adapter-versionchange" });

  await database.transaction(["meta"], "readwrite", (tx) => tx.put("meta", "ready", "status"));
  controlled.triggerVersionChange();

  assert.equal(await database.read("meta", "status"), "ready");
  assert.equal(controlled.openCount(), 2);
});
