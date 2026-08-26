import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzPlayStatePersistenceCoordinator } from "../src/lib/receiz/wildz-play-state-persistence";

test("one capture plus one hundred switches and moves performs one Vault write", async () => {
  const runtimeWrites: number[] = [];
  const vaultWrites: number[] = [];
  const pendingStages: number[] = [];
  const coordinator = createWildzPlayStatePersistenceCoordinator<number>({
    delayMs: 400,
    stagePendingVault: (value) => { pendingStages.push(value); },
    writeRuntime: (value) => { runtimeWrites.push(value); },
    writeVault: async (value) => { vaultWrites.push(value); }
  });

  coordinator.schedule(1, true);
  for (let update = 2; update <= 101; update += 1) coordinator.schedule(update, false);
  await coordinator.flush();

  assert.deepEqual(pendingStages, [1]);
  assert.deepEqual(vaultWrites, [1]);
  assert.deepEqual(runtimeWrites, [101]);
});

test("a second card change supersedes only the pending Vault snapshot", async () => {
  const runtimeWrites: number[] = [];
  const vaultWrites: number[] = [];
  const pendingStages: number[] = [];
  const coordinator = createWildzPlayStatePersistenceCoordinator<number>({
    stagePendingVault: (value) => { pendingStages.push(value); },
    writeRuntime: (value) => { runtimeWrites.push(value); },
    writeVault: async (value) => { vaultWrites.push(value); }
  });

  coordinator.schedule(1, true);
  coordinator.schedule(2, true);
  await coordinator.flush();

  assert.deepEqual(pendingStages, [1, 2]);
  assert.deepEqual(vaultWrites, [2]);
  assert.deepEqual(runtimeWrites, [2]);
});

test("a failed durable write never creates a gameplay-time retry loop", async () => {
  let attempts = 0;
  const coordinator = createWildzPlayStatePersistenceCoordinator<number>({
    stagePendingVault() {},
    writeRuntime() {},
    async writeVault() {
      attempts += 1;
      throw new Error("storage_unavailable");
    }
  });

  coordinator.schedule(1, true);
  await coordinator.flush();
  await coordinator.flush();

  assert.equal(attempts, 1);
});

test("world truth persists durably without staging the full card inventory", async () => {
  const runtimeWrites: number[] = [];
  const vaultWrites: number[] = [];
  const pendingInventoryStages: number[] = [];
  const coordinator = createWildzPlayStatePersistenceCoordinator<number>({
    stagePendingVault: (value) => { pendingInventoryStages.push(value); },
    writeRuntime: (value) => { runtimeWrites.push(value); },
    writeVault: async (value) => { vaultWrites.push(value); }
  });

  coordinator.schedule(7, {
    durableChanged: true,
    inventoryChanged: false
  });
  await coordinator.flush();

  assert.deepEqual(pendingInventoryStages, []);
  assert.deepEqual(runtimeWrites, [7]);
  assert.deepEqual(vaultWrites, [7]);
});
