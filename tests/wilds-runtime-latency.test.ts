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
import {
  readWildzRuntimeCheckpoint,
  writeWildzPendingInventoryCheckpoint,
  writeWildzRuntimeCheckpoint
} from "../src/features/play/wildz-runtime-checkpoint";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  entries() { return [...this.values.entries()]; }
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

test("refresh during a pending capture restores the caught card and exact world progress", () => {
  const owner = "runtime_capture_keeper";
  const baseline = createOwnerBoundInitialPlayState(owner);
  const caught = sealCollectedCard({
    formId: "amberbeak-1",
    ownerReceizId: owner,
    encounterId: "runtime-pending-capture",
    capturedAt: "2026-08-21T20:00:00.000Z"
  });
  let current = applyWildsInput(baseline, { type: "import-card", asset: caught });
  current = {
    ...current,
    player: { x: -145.5, z: 288.25 },
    missionProgress: 73,
    worldMastery: 81
  };
  const storage = new MemoryStorage();

  writeWildzPendingInventoryCheckpoint(storage, {
    keyId: "runtime-capture-key",
    actorId: owner,
    playState: current
  });
  writeWildzRuntimeCheckpoint(storage, {
    keyId: "runtime-capture-key",
    actorId: owner,
    playState: current
  });

  const restored = readWildzRuntimeCheckpoint(storage, {
    keyId: "runtime-capture-key",
    actorId: owner,
    playState: baseline
  });
  assert.equal(restored.inventory.length, 2);
  assert.ok(restored.inventory.some((asset) => asset.id === caught.id));
  assert.deepEqual(restored.player, { x: -145.5, z: 288.25 });
  assert.equal(restored.missionProgress, 73);
  assert.equal(restored.worldMastery, 81);
  for (const row of current.explorationAtlas.rows) {
    const restoredRow = restored.explorationAtlas.rows.find((candidate) => candidate.z === row.z);
    assert.ok(restoredRow);
    assert.deepEqual(restoredRow.ranges, row.ranges);
  }
});

test("a pending capture journals only the changed card instead of serializing the established Vault", () => {
  const owner = "runtime_compact_capture_keeper";
  let baseline = createOwnerBoundInitialPlayState(owner);
  for (let index = 0; index < 64; index += 1) {
    baseline = applyWildsInput(baseline, {
      type: "import-card",
      asset: sealCollectedCard({
        formId: "amberbeak-1",
        ownerReceizId: owner,
        encounterId: `runtime-established-${index}`,
        capturedAt: new Date(Date.UTC(2026, 7, 21, 20, index)).toISOString()
      })
    });
  }
  const caught = sealCollectedCard({
    formId: "amberbeak-1",
    ownerReceizId: owner,
    encounterId: "runtime-one-new-card",
    capturedAt: "2026-08-21T22:00:00.000Z"
  });
  const current = applyWildsInput(baseline, { type: "import-card", asset: caught });
  const storage = new MemoryStorage();
  const staged = { keyId: "runtime-compact-key", actorId: owner, playState: current, previousInventory: baseline.inventory };

  writeWildzPendingInventoryCheckpoint(storage, staged);
  writeWildzRuntimeCheckpoint(storage, { keyId: staged.keyId, actorId: owner, playState: current });

  const pending = storage.entries().find(([key]) => key.includes("pending-inventory"))?.[1] ?? "";
  assert.ok(pending.length > 0);
  assert.ok(pending.length < JSON.stringify(current.inventory).length / 4);
  assert.equal(pending.includes(baseline.inventory[12]!.id), false);
  assert.equal(pending.includes(caught.id), true);
  const restored = readWildzRuntimeCheckpoint(storage, {
    keyId: staged.keyId,
    actorId: owner,
    playState: baseline
  });
  assert.equal(restored.inventory.length, current.inventory.length);
  assert.equal(restored.inventory.at(-1)?.proof.digest, caught.proof.digest);
});

test("a missing pending card backup never discards unrelated world progress", () => {
  const owner = "runtime_world_keeper";
  const baseline = createOwnerBoundInitialPlayState(owner);
  const caught = sealCollectedCard({
    formId: "amberbeak-1",
    ownerReceizId: owner,
    encounterId: "runtime-missing-card-backup",
    capturedAt: "2026-08-21T20:05:00.000Z"
  });
  const current = {
    ...applyWildsInput(baseline, { type: "import-card", asset: caught }),
    player: { x: 312.5, z: -411.75 },
    missionProgress: 64,
    worldMastery: 77
  };
  const storage = new MemoryStorage();
  writeWildzRuntimeCheckpoint(storage, { keyId: "runtime-world-key", actorId: owner, playState: current });

  const restored = readWildzRuntimeCheckpoint(storage, {
    keyId: "runtime-world-key",
    actorId: owner,
    playState: baseline
  });
  assert.equal(restored.inventory.length, baseline.inventory.length);
  assert.deepEqual(restored.player, { x: 312.5, z: -411.75 });
  assert.equal(restored.missionProgress, 64);
  assert.equal(restored.worldMastery, 77);
});
