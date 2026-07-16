export type ArenaOfflineTransaction = Readonly<{
  id: string; playerId: string; expectedRevision: number; pendingReceipt: unknown;
  cardRevisions: Readonly<Record<string, unknown>>; vault: unknown; conflicts: readonly unknown[];
}>;
export type ArenaOfflineSnapshot = Readonly<{
  schema: "receiz.wilds.arena_offline_snapshot.v1"; playerId: string; revision: number;
  pendingReceipts: readonly unknown[]; cardRevisions: Readonly<Record<string, unknown>>;
  vault: unknown; conflicts: readonly unknown[]; appliedTransactionIds: readonly string[];
}>;
export interface ArenaOfflineStore {
  commit(transaction: ArenaOfflineTransaction): Promise<ArenaOfflineSnapshot>;
  restore(playerId: string): Promise<ArenaOfflineSnapshot | null>;
}

function validateTransaction(transaction: ArenaOfflineTransaction) {
  if (!transaction.id.trim() || !transaction.playerId.trim() || !Number.isSafeInteger(transaction.expectedRevision) || transaction.expectedRevision < 0) throw new Error("arena_offline_transaction_invalid");
}
function clone<T>(value: T): T { return structuredClone(value); }
function project(current: ArenaOfflineSnapshot | null, transaction: ArenaOfflineTransaction): ArenaOfflineSnapshot {
  if (current?.appliedTransactionIds.includes(transaction.id)) return current;
  if ((current?.revision ?? 0) !== transaction.expectedRevision) throw new Error("arena_offline_revision_conflict");
  return {
    schema: "receiz.wilds.arena_offline_snapshot.v1", playerId: transaction.playerId,
    revision: transaction.expectedRevision + 1,
    pendingReceipts: [...(current?.pendingReceipts ?? []), transaction.pendingReceipt],
    cardRevisions: { ...(current?.cardRevisions ?? {}), ...transaction.cardRevisions },
    vault: transaction.vault, conflicts: [...(current?.conflicts ?? []), ...transaction.conflicts],
    appliedTransactionIds: [...(current?.appliedTransactionIds ?? []), transaction.id],
  };
}

export class MemoryArenaOfflineStore implements ArenaOfflineStore {
  readonly #snapshots = new Map<string, ArenaOfflineSnapshot>();
  #failure: "after-receipt" | null = null;
  failNextCommit(point: "after-receipt") { this.#failure = point; }
  async restore(playerId: string) { const value = this.#snapshots.get(playerId); return value ? clone(value) : null; }
  async commit(transaction: ArenaOfflineTransaction) {
    validateTransaction(transaction);
    const current = this.#snapshots.get(transaction.playerId) ?? null;
    const next = project(current, transaction);
    if (this.#failure) { this.#failure = null; throw new Error("arena_offline_commit_injected_failure"); }
    this.#snapshots.set(transaction.playerId, clone(next));
    return clone(next);
  }
}

export class IndexedDbArenaOfflineStore implements ArenaOfflineStore {
  readonly #databaseName: string;
  constructor(databaseName = "receiz-wilds-arena") { this.#databaseName = databaseName; }
  async #database() {
    if (typeof indexedDB === "undefined") throw new Error("arena_offline_indexeddb_unavailable");
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.#databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("snapshots", { keyPath: "playerId" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("arena_offline_indexeddb_open_failed"));
    });
  }
  async restore(playerId: string) {
    const database = await this.#database();
    return new Promise<ArenaOfflineSnapshot | null>((resolve, reject) => {
      const transaction = database.transaction("snapshots", "readonly");
      const request = transaction.objectStore("snapshots").get(playerId);
      request.onsuccess = () => resolve(request.result ? clone(request.result as ArenaOfflineSnapshot) : null);
      request.onerror = () => reject(request.error ?? new Error("arena_offline_restore_failed"));
      transaction.oncomplete = () => database.close();
    });
  }
  async commit(input: ArenaOfflineTransaction) {
    validateTransaction(input);
    const database = await this.#database();
    return new Promise<ArenaOfflineSnapshot>((resolve, reject) => {
      const transaction = database.transaction("snapshots", "readwrite");
      const store = transaction.objectStore("snapshots");
      let next: ArenaOfflineSnapshot;
      const request = store.get(input.playerId);
      request.onsuccess = () => {
        try { next = project((request.result as ArenaOfflineSnapshot | undefined) ?? null, input); store.put(next); }
        catch (error) { transaction.abort(); reject(error); }
      };
      request.onerror = () => reject(request.error ?? new Error("arena_offline_commit_failed"));
      transaction.oncomplete = () => { database.close(); resolve(clone(next)); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("arena_offline_commit_failed")); };
    });
  }
}
