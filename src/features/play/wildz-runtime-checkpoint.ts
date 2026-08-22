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
const PENDING_INVENTORY_KEY_PREFIX = "receiz:wildz:pending-inventory:v1";
const vaultRoots = new WeakMap<readonly unknown[], string>();

type RuntimeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type RuntimeCheckpoint = {
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
  const { inventory, ...playState } = input.playState;
  const checkpoint: RuntimeCheckpoint = {
    schema: RUNTIME_SCHEMA,
    keyId: input.keyId,
    actorId: input.actorId,
    vaultRoot: vaultRoot(inventory),
    playState
  };
  storage.setItem(runtimeKey(input.keyId, input.actorId), JSON.stringify(checkpoint));
}

export function clearWildzRuntimeCheckpoint(storage: RuntimeStorage, input: { keyId: string; actorId: string }) {
  storage.removeItem(runtimeKey(input.keyId, input.actorId));
}

export function writeWildzPendingInventoryCheckpoint(storage: RuntimeStorage, input: {
  keyId: string;
  actorId: string;
  playState: PlayState;
}) {
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
    const pending = JSON.parse(storage.getItem(key) ?? "null") as Partial<PendingInventoryCheckpoint> | null;
    if (pending?.vaultRoot !== vaultRoot(input.expectedInventory)) return;
    storage.removeItem(key);
  } catch {
    storage.removeItem(key);
  }
}

function pendingInventoryFor(storage: RuntimeStorage, input: {
  keyId: string;
  actorId: string;
  vaultRoot: string;
}): PlayState["inventory"] | null {
  const key = pendingInventoryKey(input.keyId, input.actorId);
  const serialized = storage.getItem(key);
  if (!serialized) return null;
  try {
    const pending = JSON.parse(serialized) as Partial<PendingInventoryCheckpoint>;
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
    const checkpoint = JSON.parse(serialized) as Partial<RuntimeCheckpoint>;
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
          vaultRoot: checkpoint.vaultRoot
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
