import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzExportCoordinator } from "../src/lib/receiz/wildz-export-coordinator";

test("Identity Seal and Vault saves join one export without changing live state", async () => {
  const snapshot: { key: string; player: { x: number; z: number }; inventory: readonly string[] } = Object.freeze({ key: "owner", player: Object.freeze({ x: 24, z: 48 }), inventory: Object.freeze(["card"]) });
  let builds = 0;
  const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: typeof snapshot, b) => a === b,
    build: async (value) => { builds++; assert.equal(value, snapshot); return new Uint8Array([7, 8]); } });
  const seal = coordinator.prepare(snapshot, false);
  const vault = coordinator.prepare(snapshot, false);
  assert.equal(seal, vault);
  const artifact = await seal;
  assert.equal(builds, 1);
  assert.equal(await coordinator.prepare(snapshot, false), artifact);
  assert.deepEqual(snapshot.player, { x: 24, z: 48 });
  assert.deepEqual(snapshot.inventory, ["card"]);
  for (let x = 25; x < 200; x++) assert.equal(coordinator.peek({ ...snapshot, player: { x, z: 48 } }), null);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(builds, 1, "movement and UI cache reads cannot enqueue exports");
});

test("new explicit snapshots serialize, and a failed unprompted export can be retried", async () => {
  let active = 0, maximum = 0;
  const built: string[] = [];
  const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: string, b) => a === b,
    build: async (snapshot, allowPrompt) => {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 5)); active--;
      if (!allowPrompt) throw new Error("passphrase required");
      built.push(snapshot); return snapshot;
    } });
  await assert.rejects(coordinator.prepare("A", false), /passphrase/);
  assert.deepEqual(await Promise.all([coordinator.prepare("A", true), coordinator.prepare("B", true)]), ["A", "B"]);
  assert.equal(maximum, 1);
  assert.deepEqual(built, ["A", "B"]);
  assert.equal(coordinator.peek("B"), "B");
  assert.equal(coordinator.peek("A"), null);
});
