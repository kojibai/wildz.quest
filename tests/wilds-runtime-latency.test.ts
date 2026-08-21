import assert from "node:assert/strict";
import { test } from "node:test";
import {
  admittedInventoryDiagnostics
} from "../src/features/play/admitted-inventory";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { wildsHotspotProjectionDiagnostics } from "../src/features/play/hidden-hotspots";
import { sealCollectedCard } from "../src/features/play/portable-card";
import {
  projectWildsTraversalCapabilities,
  wildsTraversalProjectionDiagnostics
} from "../src/features/play/wilds-traversal-capabilities";
import { readWildzRuntimeCheckpoint, writeWildzRuntimeCheckpoint } from "../src/features/play/wildz-runtime-checkpoint";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("admitted checkpoint restore and ten thousand movement/submersion ticks stay off every slow path", () => {
  const owner = "runtime_latency_keeper";
  const uploaded = sealCollectedCard({
    formId: "amberbeak-1",
    ownerReceizId: owner,
    encounterId: "runtime-latency-upload",
    capturedAt: "2026-08-21T15:00:00.000Z"
  });
  const beforeUpload = admittedInventoryDiagnostics();
  let state = applyWildsInput(createOwnerBoundInitialPlayState(owner), { type: "import-card", asset: uploaded });
  assert.equal(admittedInventoryDiagnostics().verifierCalls, beforeUpload.verifierCalls + 1);

  const condition = { ...emptyAdventureCondition(uploaded.id), xp: { swim: 100 } };
  state = {
    ...state,
    adventureConditions: { ...state.adventureConditions, [uploaded.id]: condition },
    supportAssetIds: [state.inventory.find((asset) => asset.id !== uploaded.id)?.id ?? null, null],
    player: { x: -94.42, z: -240 }
  };
  projectWildsTraversalCapabilities(uploaded, condition);

  const storage = new MemoryStorage();
  writeWildzRuntimeCheckpoint(storage, { keyId: "runtime-key", actorId: owner, playState: state });
  const verifierWarm = admittedInventoryDiagnostics();
  const traversalWarm = wildsTraversalProjectionDiagnostics();
  const hotspotWarm = wildsHotspotProjectionDiagnostics();
  const restored = readWildzRuntimeCheckpoint(storage, { keyId: "runtime-key", actorId: owner, playState: state });

  assert.equal(restored.inventory, state.inventory);
  assert.equal(restored.adventureConditions[uploaded.id], condition);
  assert.deepEqual(restored.supportAssetIds, state.supportAssetIds);
  const admittedWarm = admittedInventoryDiagnostics();
  assert.equal(admittedWarm.verifierCalls, verifierWarm.verifierCalls);
  assert.equal(admittedWarm.checkpointRestores, verifierWarm.checkpointRestores + 1);
  assert.deepEqual(wildsTraversalProjectionDiagnostics(), traversalWarm);

  let fetchCalls = 0;
  let timerCalls = 0;
  const priorFetch = globalThis.fetch;
  const priorSetTimeout = globalThis.setTimeout;
  const priorSetInterval = globalThis.setInterval;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("unexpected runtime fetch");
  }) as typeof fetch;
  globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
    timerCalls += 1;
    return priorSetTimeout(...args);
  }) as typeof setTimeout;
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    timerCalls += 1;
    return priorSetInterval(...args);
  }) as typeof setInterval;
  try {
    state = restored;
    for (let index = 0; index < 10_000; index += 1) {
      state = applyWildsInput(state, {
        type: "move-vector",
        x: index % 2 === 0 ? -1 : 1,
        z: 0,
        verticalWorldY: -2.2
      });
    }
  } finally {
    globalThis.fetch = priorFetch;
    globalThis.setTimeout = priorSetTimeout;
    globalThis.setInterval = priorSetInterval;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(timerCalls, 0);
  assert.match(state.lastEvent, /Swimming with/);
  assert.deepEqual(admittedInventoryDiagnostics(), admittedWarm);
  assert.deepEqual(wildsTraversalProjectionDiagnostics(), traversalWarm);
  assert.deepEqual(wildsHotspotProjectionDiagnostics(), hotspotWarm);
});
