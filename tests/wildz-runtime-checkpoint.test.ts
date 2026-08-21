import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state.js";
import {
  readWildzRuntimeCheckpoint,
  writeWildzRuntimeCheckpoint
} from "../src/features/play/wildz-runtime-checkpoint.js";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("runtime checkpoints persist gameplay without serializing verified Vault cards", () => {
  const storage = new MemoryStorage();
  const base = createOwnerBoundInitialPlayState("runtime_keeper");
  const moved = applyWildsInput({ ...base, player: { x: 239.9, z: -1433 }, energy: 64 }, {
    type: "move-vector",
    x: 1,
    z: 0
  });

  writeWildzRuntimeCheckpoint(storage, {
    keyId: "runtime-key",
    actorId: "runtime_keeper",
    playState: moved
  });

  const serialized = storage.getItem("receiz:wildz:runtime:v1:runtime-key:runtime_keeper");
  assert.ok(serialized);
  assert.equal(serialized.includes('"inventory"'), false);
  assert.equal(serialized.includes(base.inventory[0]!.proof.digest), false);

  const restored = readWildzRuntimeCheckpoint(storage, {
    keyId: "runtime-key",
    actorId: "runtime_keeper",
    playState: base
  });
  assert.deepEqual(restored.player, moved.player);
  assert.equal(restored.energy, 63);
  assert.equal(restored.inventory, base.inventory);
  assert.deepEqual(restored.explorationAtlas, moved.explorationAtlas);
});

test("a runtime checkpoint cannot attach to a changed Vault", () => {
  const storage = new MemoryStorage();
  const base = createOwnerBoundInitialPlayState("runtime_keeper");
  writeWildzRuntimeCheckpoint(storage, {
    keyId: "runtime-key",
    actorId: "runtime_keeper",
    playState: { ...base, player: { x: 9, z: 4 } }
  });

  const changedVault = { ...base, inventory: [] };
  assert.equal(readWildzRuntimeCheckpoint(storage, {
    keyId: "runtime-key",
    actorId: "runtime_keeper",
    playState: changedVault
  }), changedVault);
});
