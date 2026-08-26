import { restorePlayState, serializePlayState, type PlayState } from "./game-state";
import {
  createAdmittedWildsInventory,
  retainAdmittedWildsInventory,
  verifyAndAdmitWildsCard
} from "./admitted-inventory";
import { sha256PortableBasis } from "./portable-card";
import { reuseWildsTraversalConditionReferences } from "./wilds-traversal-capabilities";

const RUNTIME_SCHEMA = "receiz.wildz.runtime_checkpoint.v1" as const;
const RUNTIME_KEY_PREFIX = "receiz:wildz:runtime:v1";
const PENDING_INVENTORY_SCHEMA = "receiz.wildz.pending_inventory.v1" as const;
const PENDING_INVENTORY_JOURNAL_SCHEMA = "receiz.wildz.pending_inventory_journal.v2" as const;
const PENDING_INVENTORY_KEY_PREFIX = "receiz:wildz:pending-inventory:v1";
const vaultRoots = new WeakMap<readonly unknown[], string>();

type RuntimeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type WildzRuntimeCheckpoint = {
  schema: typeof RUNTIME_SCHEMA;
  keyId: string;
  actorId: string;
  vaultRoot: string;
  playState: Omit<PlayState, "inventory">;
};

type PendingInventoryCheckpoint = {
  schema: typeof PENDING_INVENTORY_SCHEMA;
  keyId: string;
  actorId: string;
  vaultRoot: string;
  inventory: PlayState["inventory"];
};

type PendingInventoryDelta = {
  fromVaultRoot: string;
  toVaultRoot: string;
  upserts: PlayState["inventory"];
  removedAssetIds: string[];
};

type PendingInventoryJournal = {
  schema: typeof PENDING_INVENTORY_JOURNAL_SCHEMA;
  keyId: string;
  actorId: string;
  baseVaultRoot: string;
  targetVaultRoot: string;
  deltas: PendingInventoryDelta[];
};

function runtimeKey(keyId: string, actorId: string) {
  return `${RUNTIME_KEY_PREFIX}:${keyId}:${actorId}`;
}

function pendingInventoryKey(keyId: string, actorId: string) {
  return `${PENDING_INVENTORY_KEY_PREFIX}:${keyId}:${actorId}`;
}

function vaultRoot(inventory: PlayState["inventory"]) {
  const cached = vaultRoots.get(inventory);
  if (cached) return cached;
  const root = sha256PortableBasis(inventory.map((card) => `${card.id}:${card.proof.digest}`).join("\n"));
  vaultRoots.set(inventory, root);
  return root;
}

export function writeWildzRuntimeCheckpoint(storage: RuntimeStorage, input: {
  keyId: string;
  actorId: string;
  playState: PlayState;
}) {
  const prepared = prepareWildzRuntimeCheckpoint(input);
  storage.setItem(prepared.key, JSON.stringify(prepared.checkpoint));
}

export function prepareWildzRuntimeCheckpoint(input: {
  keyId: string;
  actorId: string;
  playState: PlayState;
}): { key: string; checkpoint: WildzRuntimeCheckpoint } {
  const { inventory, ...playState } = input.playState;
  const checkpoint: WildzRuntimeCheckpoint = {
    schema: RUNTIME_SCHEMA,
    keyId: input.keyId,
    actorId: input.actorId,
    vaultRoot: vaultRoot(inventory),
    playState
  };
  return { key: runtimeKey(input.keyId, input.actorId), checkpoint };
}

export function writePreparedWildzRuntimeCheckpoint(
  storage: RuntimeStorage,
  prepared: { key: string; serialized: string }
) {
  storage.setItem(prepared.key, prepared.serialized);
}

export function clearWildzRuntimeCheckpoint(storage: RuntimeStorage, input: { keyId: string; actorId: string }) {
  storage.removeItem(runtimeKey(input.keyId, input.actorId));
}

export function writeWildzPendingInventoryCheckpoint(storage: RuntimeStorage, input: {
  keyId: string;
  actorId: string;
  playState: PlayState;
  previousInventory?: PlayState["inventory"];
}) {
  if (input.previousInventory) {
    const fromVaultRoot = vaultRoot(input.previousInventory);
    const toVaultRoot = vaultRoot(input.playState.inventory);
    const previousById = new Map(input.previousInventory.map((asset) => [asset.id, asset]));
    const nextIds = new Set(input.playState.inventory.map((asset) => asset.id));
    const delta: PendingInventoryDelta = {
      fromVaultRoot,
      toVaultRoot,
      upserts: input.playState.inventory.filter((asset) => previousById.get(asset.id)?.proof.digest !== asset.proof.digest),
      removedAssetIds: input.previousInventory.filter((asset) => !nextIds.has(asset.id)).map((asset) => asset.id)
    };
    const key = pendingInventoryKey(input.keyId, input.actorId);
    let existing: PendingInventoryJournal | null = null;
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? "null") as Partial<PendingInventoryJournal> | null;
      if (parsed?.schema === PENDING_INVENTORY_JOURNAL_SCHEMA
        && parsed.keyId === input.keyId
        && parsed.actorId === input.actorId
        && parsed.targetVaultRoot === fromVaultRoot
        && typeof parsed.baseVaultRoot === "string"
        && Array.isArray(parsed.deltas)) existing = parsed as PendingInventoryJournal;
    } catch {
      existing = null;
    }
    const journal: PendingInventoryJournal = {
      schema: PENDING_INVENTORY_JOURNAL_SCHEMA,
      keyId: input.keyId,
      actorId: input.actorId,
      baseVaultRoot: existing?.baseVaultRoot ?? fromVaultRoot,
      targetVaultRoot: toVaultRoot,
      deltas: [...(existing?.deltas ?? []), delta]
    };
    storage.setItem(key, JSON.stringify(journal));
    return;
  }
  const checkpoint: PendingInventoryCheckpoint = {
    schema: PENDING_INVENTORY_SCHEMA,
    keyId: input.keyId,
    actorId: input.actorId,
    vaultRoot: vaultRoot(input.playState.inventory),
    inventory: input.playState.inventory
  };
  storage.setItem(pendingInventoryKey(input.keyId, input.actorId), JSON.stringify(checkpoint));
}

export function clearWildzPendingInventoryCheckpoint(storage: RuntimeStorage, input: {
  keyId: string;
  actorId: string;
  expectedInventory?: PlayState["inventory"];
}) {
  const key = pendingInventoryKey(input.keyId, input.actorId);
  if (!input.expectedInventory) {
    storage.removeItem(key);
    return;
  }
  try {
    const pending = JSON.parse(storage.getItem(key) ?? "null") as (Partial<PendingInventoryCheckpoint> & Partial<PendingInventoryJournal>) | null;
    const pendingRoot = pending?.schema === PENDING_INVENTORY_JOURNAL_SCHEMA ? pending.targetVaultRoot : pending?.vaultRoot;
    if (pendingRoot !== vaultRoot(input.expectedInventory)) return;
    storage.removeItem(key);
  } catch {
    storage.removeItem(key);
  }
}

function pendingInventoryFor(storage: RuntimeStorage, input: {
  keyId: string;
  actorId: string;
  vaultRoot: string;
  baseInventory: PlayState["inventory"];
}): PlayState["inventory"] | null {
  const key = pendingInventoryKey(input.keyId, input.actorId);
  const serialized = storage.getItem(key);
  if (!serialized) return null;
  try {
    const pending = JSON.parse(serialized) as Partial<PendingInventoryCheckpoint> & Partial<PendingInventoryJournal>;
    if (pending.schema === PENDING_INVENTORY_JOURNAL_SCHEMA) {
      if (pending.keyId !== input.keyId
        || pending.actorId !== input.actorId
        || pending.targetVaultRoot !== input.vaultRoot
        || pending.baseVaultRoot !== vaultRoot(input.baseInventory)
        || !Array.isArray(pending.deltas)
        || pending.deltas.length > 1_000) {
        storage.removeItem(key);
        return null;
      }
      let inventory = input.baseInventory;
      for (const candidate of pending.deltas) {
        if (!candidate || typeof candidate !== "object"
          || candidate.fromVaultRoot !== vaultRoot(inventory)
          || typeof candidate.toVaultRoot !== "string"
          || !Array.isArray(candidate.upserts)
          || !Array.isArray(candidate.removedAssetIds)
          || candidate.upserts.length > 1_000
          || candidate.removedAssetIds.length > 1_000
          || candidate.removedAssetIds.some((assetId) => typeof assetId !== "string")
          || !candidate.upserts.every((asset) => verifyAndAdmitWildsCard(asset))) {
          storage.removeItem(key);
          return null;
        }
        const removed = new Set(candidate.removedAssetIds);
        const next = inventory.filter((asset) => !removed.has(asset.id));
        for (const asset of candidate.upserts) {
          const index = next.findIndex((current) => current.id === asset.id);
          if (index >= 0) next[index] = asset;
          else next.push(asset);
        }
        if (vaultRoot(next) !== candidate.toVaultRoot) {
          storage.removeItem(key);
          return null;
        }
        inventory = next;
      }
      if (vaultRoot(inventory) !== input.vaultRoot) {
        storage.removeItem(key);
        return null;
      }
      return retainAdmittedWildsInventory(inventory);
    }
    if (pending.schema !== PENDING_INVENTORY_SCHEMA
      || pending.keyId !== input.keyId
      || pending.actorId !== input.actorId
      || pending.vaultRoot !== input.vaultRoot
      || !Array.isArray(pending.inventory)
      || vaultRoot(pending.inventory) !== input.vaultRoot
      || !pending.inventory.every((asset) => verifyAndAdmitWildsCard(asset))) {
      storage.removeItem(key);
      return null;
    }
    return retainAdmittedWildsInventory(pending.inventory);
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function readWildzRuntimeCheckpoint(storage: RuntimeStorage, input: {
  keyId: string;
  actorId: string;
  playState: PlayState;
}) {
  const key = runtimeKey(input.keyId, input.actorId);
  const serialized = storage.getItem(key);
  if (!serialized) return input.playState;
  try {
    const checkpoint = JSON.parse(serialized) as Partial<WildzRuntimeCheckpoint>;
    if (checkpoint.schema !== RUNTIME_SCHEMA
      || checkpoint.keyId !== input.keyId
      || checkpoint.actorId !== input.actorId
      || typeof checkpoint.vaultRoot !== "string"
      || !checkpoint.playState
      || typeof checkpoint.playState !== "object") {
      storage.removeItem(key);
      return input.playState;
    }
    const inventory = checkpoint.vaultRoot === vaultRoot(input.playState.inventory)
      ? input.playState.inventory
      : pendingInventoryFor(storage, {
          keyId: input.keyId,
          actorId: input.actorId,
          vaultRoot: checkpoint.vaultRoot,
          baseInventory: input.playState.inventory
        }) ?? input.playState.inventory;
    const admittedInventory = createAdmittedWildsInventory(inventory, input.actorId);
    if (!admittedInventory) {
      storage.removeItem(key);
      return input.playState;
    }
    const restored = restorePlayState(serializePlayState({
      ...checkpoint.playState,
      inventory
    } as PlayState), input.actorId, admittedInventory);
    const traversalAssetIds = [restored.selectedAssetId, ...restored.supportAssetIds].filter((assetId): assetId is string => Boolean(assetId));
    return {
      ...restored,
      inventory,
      adventureConditions: reuseWildsTraversalConditionReferences(
        restored.adventureConditions,
        input.playState.adventureConditions,
        traversalAssetIds
      )
    };
  } catch {
    storage.removeItem(key);
    return input.playState;
  }
}
