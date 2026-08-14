import assert from "node:assert/strict";
import { test } from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state.js";
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
  const moved = { ...base, player: { x: 18, z: -7 }, energy: 63 };

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
  assert.deepEqual(restored.player, { x: 18, z: -7 });
  assert.equal(restored.energy, 63);
  assert.equal(restored.inventory, base.inventory);
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
