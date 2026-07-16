import type { WildzStoreName } from "../../src/lib/storage/wildz-indexed-db";

type StoreMap = Map<IDBValidKey, unknown>;

type Deferred = {
  promise: Promise<void>;
  resolve(): void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneStores(stores: Map<string, StoreMap>) {
  const result = new Map<string, StoreMap>();
  for (const [name, values] of stores) {
    result.set(name, new Map([...values].map(([key, value]) => [clone(key), clone(value)])));
  }
  return result;
}

class FakeRequest<T> extends EventTarget {
  error: DOMException | null = null;
  readyState: IDBRequestReadyState = "pending";
  result!: T;

  succeed(result: T) {
    this.result = result;
    this.readyState = "done";
    this.dispatchEvent(new Event("success"));
  }

  fail(error: DOMException) {
    this.error = error;
    this.readyState = "done";
    return this.dispatchEvent(new Event("error", { cancelable: true }));
  }

  upgrade(result: T) {
    this.result = result;
    this.dispatchEvent(new Event("upgradeneeded"));
  }
}

class FakeIndexedDbController {
  readonly stores = new Map<string, StoreMap>();
  abortedTransactions = 0;
  completedTransactions = 0;
  private nextRequestError: DOMException | null = null;
  private nextAbortGate: { errorSeen: Deferred; release: Deferred } | null = null;
  private nextCompletionGate: { reached: Deferred; release: Deferred } | null = null;

  failNextRequest(error = new DOMException("fake_indexed_db_request_failed", "ConstraintError")) {
    this.nextRequestError = error;
  }

  takeRequestError() {
    const error = this.nextRequestError;
    this.nextRequestError = null;
    return error;
  }

  gateNextAbort() {
    const gate = { errorSeen: deferred(), release: deferred() };
    this.nextAbortGate = gate;
    return {
      transactionError: gate.errorSeen.promise,
      releaseAbort: gate.release.resolve
    };
  }

  notifyTransactionError() {
    this.nextAbortGate?.errorSeen.resolve();
  }

  takeAbortGate() {
    const gate = this.nextAbortGate;
    this.nextAbortGate = null;
    return gate?.release.promise ?? null;
  }

  gateNextCompletion() {
    const gate = { reached: deferred(), release: deferred() };
    this.nextCompletionGate = gate;
    return {
      completionReached: gate.reached.promise,
      releaseCompletion: gate.release.resolve
    };
  }

  takeCompletionGate() {
    const gate = this.nextCompletionGate;
    this.nextCompletionGate = null;
    return gate;
  }

  transactionCompleted() {
    this.completedTransactions += 1;
  }

  transactionAborted() {
    this.abortedTransactions += 1;
  }
}

class FakeTransaction extends EventTarget {
  error: DOMException | null = null;
  private completionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = 0;
  private state: "active" | "aborting" | "finished" = "active";
  private readonly working: Map<string, StoreMap>;

  constructor(
    private readonly controller: FakeIndexedDbController,
    private readonly selectedStores: ReadonlySet<string>,
    private readonly mode: IDBTransactionMode
  ) {
    super();
    this.working = mode === "readwrite" ? cloneStores(controller.stores) : controller.stores;
    this.scheduleCompletion();
  }

  objectStore(name: string) {
    if (!this.selectedStores.has(name)) throw new DOMException("fake_store_not_in_transaction", "NotFoundError");
    const values = this.working.get(name);
    if (!values) throw new DOMException("fake_store_missing", "NotFoundError");
    return new FakeObjectStore(this, values) as unknown as IDBObjectStore;
  }

  abort() {
    if (this.state !== "active") throw new DOMException("fake_transaction_not_active", "InvalidStateError");
    this.scheduleAbort(new DOMException("fake_transaction_aborted", "AbortError"));
  }

  request<T>(operation: () => T) {
    if (this.state !== "active") throw new DOMException("fake_transaction_not_active", "TransactionInactiveError");
    if (this.completionTimer) clearTimeout(this.completionTimer);
    this.completionTimer = null;
    this.pendingRequests += 1;
    const request = new FakeRequest<T>();
    queueMicrotask(() => {
      if (this.state !== "active") return;
      const injected = this.controller.takeRequestError();
      if (injected) {
        const shouldAbort = request.fail(injected);
        this.pendingRequests -= 1;
        if (shouldAbort) {
          this.error = injected;
          this.dispatchEvent(new Event("error", { cancelable: true }));
          this.controller.notifyTransactionError();
          this.scheduleAbort(injected);
        } else {
          this.scheduleCompletion();
        }
        return;
      }
      try {
        request.succeed(operation());
      } catch (cause) {
        const error = cause instanceof DOMException
          ? cause
          : new DOMException(cause instanceof Error ? cause.message : "fake_request_failed", "UnknownError");
        request.fail(error);
        this.error = error;
        this.dispatchEvent(new Event("error", { cancelable: true }));
        this.controller.notifyTransactionError();
        this.scheduleAbort(error);
      } finally {
        this.pendingRequests -= 1;
        this.scheduleCompletion();
      }
    });
    return request as unknown as IDBRequest<T>;
  }

  private scheduleAbort(error: DOMException) {
    if (this.state !== "active") return;
    this.state = "aborting";
    this.error = error;
    if (this.completionTimer) clearTimeout(this.completionTimer);
    this.completionTimer = null;
    const gate = this.controller.takeAbortGate();
    const finish = () => {
      if (this.state !== "aborting") return;
      this.state = "finished";
      this.controller.transactionAborted();
      this.dispatchEvent(new Event("abort"));
    };
    if (gate) void gate.then(finish);
    else queueMicrotask(finish);
  }

  private scheduleCompletion() {
    if (this.state !== "active" || this.pendingRequests !== 0) return;
    if (this.completionTimer) clearTimeout(this.completionTimer);
    this.completionTimer = setTimeout(() => {
      if (this.state !== "active" || this.pendingRequests !== 0) return;
      const finish = () => {
        if (this.state !== "active" || this.pendingRequests !== 0) return;
        if (this.mode === "readwrite") {
          this.controller.stores.clear();
          for (const [name, values] of this.working) this.controller.stores.set(name, values);
        }
        this.state = "finished";
        this.controller.transactionCompleted();
        this.dispatchEvent(new Event("complete"));
      };
      const gate = this.controller.takeCompletionGate();
      if (gate) {
        gate.reached.resolve();
        void gate.release.promise.then(finish);
      } else finish();
    }, 0);
  }
}

class FakeObjectStore {
  constructor(private readonly transaction: FakeTransaction, private readonly values: StoreMap) {}

  get(key: IDBValidKey) {
    return this.transaction.request(() => {
      const value = this.values.get(key);
      return value === undefined ? undefined : clone(value);
    });
  }

  getAll() {
    return this.transaction.request(() => [...this.values.values()].map((value) => clone(value)));
  }

  put(value: unknown, key?: IDBValidKey) {
    return this.transaction.request(() => {
      if (key === undefined) throw new DOMException("fake_key_required", "DataError");
      this.values.set(clone(key), clone(value));
      return clone(key);
    });
  }

  delete(key: IDBValidKey) {
    return this.transaction.request(() => {
      this.values.delete(key);
      return undefined;
    });
  }
}

class FakeDatabase extends EventTarget {
  constructor(private readonly controller: FakeIndexedDbController) { super(); }

  close() {}

  get objectStoreNames() {
    const names = [...this.controller.stores.keys()];
    return {
      contains: (value: string) => names.includes(value),
      item: (index: number) => names[index] ?? null,
      get length() { return names.length; }
    } as DOMStringList;
  }

  createObjectStore(name: string) {
    if (this.controller.stores.has(name)) throw new DOMException("fake_store_exists", "ConstraintError");
    this.controller.stores.set(name, new Map());
    return {} as IDBObjectStore;
  }

  transaction(storeNames: string | Iterable<string>, mode: IDBTransactionMode = "readonly") {
    const selected = new Set(typeof storeNames === "string" ? [storeNames] : [...storeNames]);
    return new FakeTransaction(this.controller, selected, mode) as unknown as IDBTransaction;
  }
}

export type FakeIndexedDb = {
  readonly abortedTransactions: number;
  readonly completedTransactions: number;
  dump(store: WildzStoreName): Array<[IDBValidKey, unknown]>;
  factory: IDBFactory;
  failNextRequest(error?: DOMException): void;
  gateNextAbort(): { transactionError: Promise<void>; releaseAbort(): void };
  gateNextCompletion(): { completionReached: Promise<void>; releaseCompletion(): void };
  storeNames(): string[];
};

export function createFakeIndexedDb(): FakeIndexedDb {
  const controller = new FakeIndexedDbController();
  const database = new FakeDatabase(controller);
  const factory = {
    open() {
      const request = new FakeRequest<IDBDatabase>();
      queueMicrotask(() => {
        request.upgrade(database as unknown as IDBDatabase);
        request.succeed(database as unknown as IDBDatabase);
      });
      return request as unknown as IDBOpenDBRequest;
    }
  } as unknown as IDBFactory;

  return {
    get abortedTransactions() { return controller.abortedTransactions; },
    get completedTransactions() { return controller.completedTransactions; },
    dump(store) {
      return [...(controller.stores.get(store) ?? new Map())].map(([key, value]) => [clone(key), clone(value)]);
    },
    factory,
    failNextRequest: controller.failNextRequest.bind(controller),
    gateNextAbort: controller.gateNextAbort.bind(controller),
    gateNextCompletion: controller.gateNextCompletion.bind(controller),
    storeNames: () => [...controller.stores.keys()].sort()
  };
}
