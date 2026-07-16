import type {
  WildzContinuityDatabase,
  WildzContinuityTransaction,
  WildzStoreName
} from "../../src/lib/storage/wildz-indexed-db";

type StoreMap = Map<IDBValidKey, unknown>;

export type MemoryWildzContinuityDatabase = WildzContinuityDatabase & {
  activePointer(): { keyId: string } | null;
  dump(): Record<WildzStoreName, Array<[IDBValidKey, unknown]>>;
  failNextTransaction(cause?: Error): void;
  failNextTransactionAfterPuts(putCount: number, cause?: Error): void;
  legacyMigrationMarker(): { keyId: string } | null;
  wrappingKey(): CryptoKey;
};

const STORE_NAMES: readonly WildzStoreName[] = ["wrappingKeys", "identities", "ownerStates", "meta", "pendingRestores"];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyStores(): Record<WildzStoreName, StoreMap> {
  return {
    wrappingKeys: new Map(),
    identities: new Map(),
    ownerStates: new Map(),
    meta: new Map(),
    pendingRestores: new Map()
  };
}

function clonedStores(stores: Record<WildzStoreName, StoreMap>) {
  const result = emptyStores();
  for (const store of STORE_NAMES) {
    for (const [key, value] of stores[store]) result[store].set(clone(key), clone(value));
  }
  return result;
}

function metaBySchema<T>(stores: Record<WildzStoreName, StoreMap>, schema: string): T | null {
  for (const value of stores.meta.values()) {
    if (value && typeof value === "object" && "schema" in value && value.schema === schema) return clone(value as T);
  }
  return null;
}

export function createMemoryWildzContinuityDatabase(): MemoryWildzContinuityDatabase {
  let stores = emptyStores();
  let nextFailure: Error | null = null;
  let nextPartialFailure: { cause: Error; putCount: number } | null = null;
  let transactionTail: Promise<void> = Promise.resolve();

  const database: MemoryWildzContinuityDatabase = {
    async read<T>(store: WildzStoreName, key: IDBValidKey) {
      const value = stores[store].get(key);
      return value === undefined ? null : clone(value as T);
    },
    async transaction<T>(
      selectedStores: readonly WildzStoreName[],
      mode: IDBTransactionMode,
      operation: (tx: WildzContinuityTransaction) => Promise<T>
    ) {
      const run = transactionTail.then(async () => {
        if (nextFailure) {
          const cause = nextFailure;
          nextFailure = null;
          throw cause;
        }

        const selected = new Set(selectedStores);
        const working = mode === "readwrite" ? clonedStores(stores) : stores;
        let writes = 0;
        const tx: WildzContinuityTransaction = {
          async get<TValue>(store: WildzStoreName, key: IDBValidKey) {
            if (!selected.has(store)) throw new Error("wildz_memory_store_not_in_transaction");
            const value = working[store].get(key);
            return value === undefined ? null : clone(value as TValue);
          },
          async getAll<TValue>(store: WildzStoreName) {
            if (!selected.has(store)) throw new Error("wildz_memory_store_not_in_transaction");
            return [...working[store].values()].map((value) => clone(value as TValue));
          },
          async put<TValue>(store: WildzStoreName, value: TValue, key?: IDBValidKey) {
            if (mode !== "readwrite") throw new Error("wildz_memory_transaction_readonly");
            if (!selected.has(store)) throw new Error("wildz_memory_store_not_in_transaction");
            if (key === undefined) throw new Error("wildz_memory_key_required");
            working[store].set(clone(key), clone(value));
            writes += 1;
            if (nextPartialFailure && writes >= nextPartialFailure.putCount) {
              const cause = nextPartialFailure.cause;
              nextPartialFailure = null;
              throw cause;
            }
          },
          async delete(store: WildzStoreName, key: IDBValidKey) {
            if (mode !== "readwrite") throw new Error("wildz_memory_transaction_readonly");
            if (!selected.has(store)) throw new Error("wildz_memory_store_not_in_transaction");
            working[store].delete(key);
          }
        };

        const result = await operation(tx);
        if (mode === "readwrite") stores = working;
        return result;
      });
      transactionTail = run.then(() => undefined, () => undefined);
      return run;
    },
    activePointer() {
      return metaBySchema<{ keyId: string }>(stores, "receiz.wildz.active_identity.v1");
    },
    dump() {
      return {
        wrappingKeys: [...stores.wrappingKeys].map(([key, value]) => [clone(key), clone(value)]),
        identities: [...stores.identities].map(([key, value]) => [clone(key), clone(value)]),
        ownerStates: [...stores.ownerStates].map(([key, value]) => [clone(key), clone(value)]),
        meta: [...stores.meta].map(([key, value]) => [clone(key), clone(value)]),
        pendingRestores: [...stores.pendingRestores].map(([key, value]) => [clone(key), clone(value)])
      };
    },
    failNextTransaction(cause = new Error("wildz_memory_transaction_failed")) {
      nextFailure = cause;
    },
    failNextTransactionAfterPuts(putCount, cause = new Error("wildz_memory_transaction_failed_after_put")) {
      if (!Number.isInteger(putCount) || putCount < 1) throw new Error("wildz_memory_put_count_invalid");
      nextPartialFailure = { cause, putCount };
    },
    legacyMigrationMarker() {
      return metaBySchema<{ keyId: string }>(stores, "receiz.wildz.legacy_identity_migration.v1");
    },
    wrappingKey() {
      const key = stores.wrappingKeys.values().next().value;
      if (!key) throw new Error("wildz_memory_wrapping_key_missing");
      return key as CryptoKey;
    }
  };

  return database;
}
