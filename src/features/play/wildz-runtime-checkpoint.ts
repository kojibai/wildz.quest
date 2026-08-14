import { restorePlayState, serializePlayState, type PlayState } from "./game-state";
import { sha256PortableBasis } from "./portable-card";

const RUNTIME_SCHEMA = "receiz.wildz.runtime_checkpoint.v1" as const;
const RUNTIME_KEY_PREFIX = "receiz:wildz:runtime:v1";
const vaultRoots = new WeakMap<readonly unknown[], string>();

type RuntimeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type RuntimeCheckpoint = {
  schema: typeof RUNTIME_SCHEMA;
  keyId: string;
  actorId: string;
  vaultRoot: string;
  playState: Omit<PlayState, "inventory">;
};

function runtimeKey(keyId: string, actorId: string) {
  return `${RUNTIME_KEY_PREFIX}:${keyId}:${actorId}`;
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
      || checkpoint.vaultRoot !== vaultRoot(input.playState.inventory)
      || !checkpoint.playState
      || typeof checkpoint.playState !== "object") {
      storage.removeItem(key);
      return input.playState;
    }
    const restored = restorePlayState(serializePlayState({
      ...checkpoint.playState,
      inventory: input.playState.inventory
    } as PlayState), input.actorId);
    return { ...restored, inventory: input.playState.inventory };
  } catch {
    storage.removeItem(key);
    return input.playState;
  }
}
