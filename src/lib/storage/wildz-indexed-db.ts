export type WildzStoreName = "wrappingKeys" | "identities" | "ownerStates" | "meta";

export interface WildzContinuityTransaction {
  get<T>(store: WildzStoreName, key: IDBValidKey): Promise<T | null>;
  put<T>(store: WildzStoreName, value: T, key?: IDBValidKey): Promise<void>;
  delete(store: WildzStoreName, key: IDBValidKey): Promise<void>;
}

export interface WildzContinuityDatabase {
  read<T>(store: WildzStoreName, key: IDBValidKey): Promise<T | null>;
  transaction<T>(
    stores: readonly WildzStoreName[],
    mode: IDBTransactionMode,
    operation: (tx: WildzContinuityTransaction) => Promise<T>
  ): Promise<T>;
}

const DEFAULT_DATABASE_NAME = "receiz.wildz.continuity.v1";
const DATABASE_VERSION = 1;
const STORE_NAMES: readonly WildzStoreName[] = ["wrappingKeys", "identities", "ownerStates", "meta"];

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("wildz_indexed_db_request_failed")), { once: true });
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("wildz_indexed_db_transaction_aborted")), { once: true });
  });
}

function transactionPort(transaction: IDBTransaction): WildzContinuityTransaction {
  return {
    async get<T>(store: WildzStoreName, key: IDBValidKey) {
      const value = await requestResult(transaction.objectStore(store).get(key));
      return (value as T | undefined) ?? null;
    },
    async put<T>(store: WildzStoreName, value: T, key?: IDBValidKey) {
      const objectStore = transaction.objectStore(store);
      await requestResult(key === undefined ? objectStore.put(value) : objectStore.put(value, key));
    },
    async delete(store: WildzStoreName, key: IDBValidKey) {
      await requestResult(transaction.objectStore(store).delete(key));
    }
  };
}

export function createWildzContinuityDatabase(options: {
  factory?: IDBFactory;
  name?: string;
} = {}): WildzContinuityDatabase {
  let openPromise: Promise<IDBDatabase> | null = null;

  const open = () => {
    if (openPromise) return openPromise;
    openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const factory = options.factory ?? globalThis.indexedDB;
      if (!factory) {
        reject(new Error("wildz_indexed_db_unavailable"));
        return;
      }
      const request = factory.open(options.name ?? DEFAULT_DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        for (const store of STORE_NAMES) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
        }
      });
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error ?? new Error("wildz_indexed_db_open_failed")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("wildz_indexed_db_open_blocked")), { once: true });
    });
    return openPromise;
  };

  const continuityDatabase: WildzContinuityDatabase = {
    async read<T>(store: WildzStoreName, key: IDBValidKey) {
      return continuityDatabase.transaction([store], "readonly", (tx) => tx.get<T>(store, key));
    },
    async transaction<T>(
      stores: readonly WildzStoreName[],
      mode: IDBTransactionMode,
      operation: (tx: WildzContinuityTransaction) => Promise<T>
    ) {
      if (stores.length === 0) throw new Error("wildz_indexed_db_stores_required");
      const database = await open();
      const transaction = database.transaction([...new Set(stores)], mode);
      const completion = transactionCompletion(transaction);
      try {
        const result = await operation(transactionPort(transaction));
        await completion;
        return result;
      } catch (cause) {
        try {
          transaction.abort();
        } catch {
          // The request failure may already have aborted the transaction.
        }
        await completion.catch(() => undefined);
        throw cause;
      }
    }
  };

  return continuityDatabase;
}
