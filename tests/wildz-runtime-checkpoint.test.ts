import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state.js";
import { wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment.js";
import { KAI_N_DAY_MICRO } from "../src/features/play/kai-klok-moment.js";
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

test("the runtime checkpoint preserves finite food and ground sleep against the prior owner Vault", () => {
  const actorId = "runtime_keeper", keyId = "runtime-key", kaiUPulse = Number(KAI_N_DAY_MICRO) * 100;
  const base = createOwnerBoundInitialPlayState(actorId);
  const plant = Array.from({ length: 9 }, (_, x) => Array.from({ length: 9 }, (_, z) => wildsNourishmentPlantsForTile(x - 4, z - 4)).flat()).flat()[0]!;
  assert.ok(plant);
  const positioned = { ...base, player: { x: plant.position.x, z: plant.position.z }, siteSpace: { ...base.siteSpace, position: plant.position } };
  const gathered = applyWildsInput(positioned, { type: "gather-food", ownerReceizId: actorId, sourceId: plant.sourceId,
    expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, kaiUPulse).head, kaiUPulse });
  assert.equal(Object.keys(gathered.playerNourishment!.items).length, 1);
  const sleeping = applyWildsInput(gathered, { type: "sleep", kaiUPulse: kaiUPulse + 1_000_000, energyActivity: "active" });
  const storage = new MemoryStorage();
  writeWildzRuntimeCheckpoint(storage, { keyId, actorId, playState: sleeping });
  const restored = readWildzRuntimeCheckpoint(storage, { keyId, actorId, playState: base });
  assert.deepEqual(restored.playerNourishment, sleeping.playerNourishment);
  assert.deepEqual(restored.playerBreaths, sleeping.playerBreaths);
  assert.equal(restored.playerBreaths!.mode, "sleep");
});

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
  assert.equal(restored.energy,moved.energy);
  assert.ok(restored.energy>63.9&&restored.energy<64);
  assert.deepEqual(restored.playerBreaths,moved.playerBreaths);
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

test("refresh cannot replace a newer durable player ledger with an older runtime checkpoint", () => {
  const storage = new MemoryStorage();
  const base = createOwnerBoundInitialPlayState("runtime_keeper");
  const history = (uPulse: number) => [{ id: "local:travel", kind: "activity" as const, title: "Travel", detail: "Moved", uPulse, authority: "local" as const }];
  const newer = { ...base, player: { x: 90, z: 20 }, actionHistory: history(200) };
  writeWildzRuntimeCheckpoint(storage, { keyId: "runtime-key", actorId: "runtime_keeper", playState: { ...base, player: { x: 1, z: 1 }, actionHistory: history(100) } });
  assert.equal(readWildzRuntimeCheckpoint(storage, { keyId: "runtime-key", actorId: "runtime_keeper", playState: newer }), newer);
});
