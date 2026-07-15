import {
  createReceizInMemoryProofMemoryStorage,
  createReceizProofMemory,
  type JsonObject,
  type ReceizProofMemory,
  type ReceizProofMemoryAdditionsQuery,
  type ReceizProofMemoryStorage,
  type ReceizProofRegisterEntry,
  type ReceizProofRegisterSnapshot
} from "@receiz/sdk";
import type { CommerceState } from "../../types/domain";
import {
  STORE_STATE_SCHEMA,
  admitCommerceEvent as admitCommerceEventProjection,
  isCommerceEventRecord,
  isStoreStateRecord,
  projectCommerceEventsFromRecords,
  projectStoreStateFromRecords,
  type CommerceEventRecord,
  type StoreStateRecord
} from "./proof-state";

export type ProofStateStore = {
  admitStoreRecord(record: StoreStateRecord): Promise<StoreStateRecord>;
  admitCommerceEvent(
    state: CommerceState,
    event: CommerceEventRecord
  ): Promise<{ admitted: boolean; state: CommerceState }>;
  projectHost(baseState: CommerceState, tenantHost: string): CommerceState;
  records(): Array<StoreStateRecord | CommerceEventRecord>;
  snapshot(): ReceizProofRegisterSnapshot;
  knownHead(limit?: number): ReceizProofMemoryAdditionsQuery;
  flush(): Promise<void>;
};

function entryFromStoreRecord(record: StoreStateRecord): ReceizProofRegisterEntry {
  return {
    id: record.id,
    kind: STORE_STATE_SCHEMA,
    createdAt: record.recordedAt,
    payload: record as unknown as JsonObject,
    projection: {
      schema: "receiz.app.store_state_projection.v1",
      tenantHost: record.tenantHost,
      tenantSlug: record.tenantSlug,
      merchantReceizId: record.merchantReceizId,
      brandName: record.state.brand.name,
      productCount: record.state.products.length,
      published: record.state.hosting.published
    }
  };
}

function entryFromCommerceEvent(event: CommerceEventRecord): ReceizProofRegisterEntry {
  return {
    id: event.id,
    kind: event.schema,
    createdAt: event.createdAt,
    payload: event as unknown as JsonObject,
    projection: {
      schema: "receiz.app.commerce_event_projection.v1",
      tenantHost: event.tenantHost,
      merchantReceizId: event.merchantReceizId,
      type: event.type,
      orderId: event.data.orderId ?? null,
      checkoutSessionId: event.data.checkoutSessionId ?? null,
      settlementStatus: event.data.settlementStatus ?? null
    }
  };
}

function entries(memory: ReceizProofMemory) {
  return memory
    .entries()
    .map((entry) => entry.payload)
    .filter((payload): payload is StoreStateRecord | CommerceEventRecord => isStoreStateRecord(payload) || isCommerceEventRecord(payload));
}

export async function createProofStateStore(options: {
  ownerId?: string;
  storage?: ReceizProofMemoryStorage;
} = {}): Promise<ProofStateStore> {
  const memory = await createReceizProofMemory({
    ownerId: options.ownerId,
    storage: options.storage,
    autoPersist: true
  });

  return {
    async admitStoreRecord(record) {
      if (!memory.has(record.id)) {
        memory.append(entryFromStoreRecord(record));
        await memory.flush();
      }

      return record;
    },
    async admitCommerceEvent(state, event) {
      if (memory.has(event.id)) {
        return { admitted: false, state };
      }

      const result = admitCommerceEventProjection(state, event);
      if (result.admitted) {
        memory.append(entryFromCommerceEvent(event));
        await memory.flush();
      }

      return result;
    },
    projectHost(baseState, tenantHost) {
      const admittedRecords = entries(memory);
      const publishedState = projectStoreStateFromRecords(baseState, admittedRecords, tenantHost);
      return projectCommerceEventsFromRecords(publishedState, admittedRecords, tenantHost);
    },
    records() {
      return entries(memory);
    },
    snapshot() {
      return memory.snapshot();
    },
    knownHead(limit) {
      return memory.knownHead(limit);
    },
    flush() {
      return memory.flush();
    }
  };
}

export function createInMemoryProofStateStore(ownerId?: string, initialValue?: ReceizProofRegisterSnapshot) {
  return createProofStateStore({
    ownerId,
    storage: createReceizInMemoryProofMemoryStorage(initialValue)
  });
}

let serverProofStateStore: Promise<ProofStateStore> | null = null;

export const DEFAULT_SERVER_PROOF_OWNER = "receiz-app-commerce";

export type ServerProofStateStoreRegistry = {
  storeForOwner(ownerId?: string): Promise<ProofStateStore>;
};

function normalizeOwnerId(ownerId?: string, fallback = DEFAULT_SERVER_PROOF_OWNER) {
  return ownerId?.trim() || fallback;
}

async function createMirroredProofStateStore(ownerId: string, publicStorePromise: Promise<ProofStateStore>) {
  const ownerStore = await createInMemoryProofStateStore(ownerId);
  const publicStore = await publicStorePromise;

  return {
    async admitStoreRecord(record: StoreStateRecord) {
      await ownerStore.admitStoreRecord(record);
      await publicStore.admitStoreRecord(record);
      return record;
    },
    async admitCommerceEvent(state: CommerceState, event: CommerceEventRecord) {
      const result = await ownerStore.admitCommerceEvent(state, event);

      if (result.admitted) {
        await publicStore.admitCommerceEvent(state, event);
      }

      return result;
    },
    projectHost(baseState: CommerceState, tenantHost: string) {
      return ownerStore.projectHost(baseState, tenantHost);
    },
    records() {
      return ownerStore.records();
    },
    snapshot() {
      return ownerStore.snapshot();
    },
    knownHead(limit?: number) {
      return ownerStore.knownHead(limit);
    },
    flush() {
      return ownerStore.flush();
    }
  } satisfies ProofStateStore;
}

export function createServerProofStateStoreRegistry(
  defaultOwnerId = DEFAULT_SERVER_PROOF_OWNER
): ServerProofStateStoreRegistry {
  const publicOwnerId = normalizeOwnerId(defaultOwnerId);
  const stores = new Map<string, Promise<ProofStateStore>>();
  const publicStore = createInMemoryProofStateStore(publicOwnerId);
  stores.set(publicOwnerId, publicStore);

  return {
    storeForOwner(ownerId = publicOwnerId) {
      const normalizedOwnerId = normalizeOwnerId(ownerId, publicOwnerId);

      if (normalizedOwnerId === publicOwnerId) {
        return publicStore;
      }

      const existing = stores.get(normalizedOwnerId);
      if (existing) return existing;

      const mirroredStore = createMirroredProofStateStore(normalizedOwnerId, publicStore);
      stores.set(normalizedOwnerId, mirroredStore);
      return mirroredStore;
    }
  };
}

const serverProofStateRegistry = createServerProofStateStoreRegistry();

export function getServerProofStateStore(ownerId = DEFAULT_SERVER_PROOF_OWNER) {
  if (normalizeOwnerId(ownerId) === DEFAULT_SERVER_PROOF_OWNER) {
    serverProofStateStore ??= serverProofStateRegistry.storeForOwner(DEFAULT_SERVER_PROOF_OWNER);
    return serverProofStateStore;
  }

  return serverProofStateRegistry.storeForOwner(ownerId);
}
