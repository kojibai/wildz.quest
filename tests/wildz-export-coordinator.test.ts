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


test("slow background builds retain only the latest waiting target before dispatch", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const built: string[] = [];
  const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: string, b) => a === b,
    build: async snapshot => { built.push(snapshot); if (snapshot === "active") await gate; return snapshot; } });
  const active = coordinator.prepare("active", false);
  await new Promise(resolve => setImmediate(resolve));
  const waiting = Array.from({ length: 12 }, (_, i) => coordinator.prepare(`waiting-${i}`, false).then(value => value, error => error));
  release();
  const results = await Promise.all(waiting);
  assert.equal(await active, "active");
  assert.deepEqual(built, ["active", "waiting-11"]);
  assert.ok(results.slice(0, 11).every(value => value instanceof Error && /superseded/.test(value.message)));
  assert.equal(results[11], "waiting-11");
});

test("an explicit unprompted Save protects its exact pending snapshot from later background targets", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const built: [string, boolean][] = [];
  const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: string, b) => a === b,
    build: async (snapshot, allowPrompt) => { built.push([snapshot, allowPrompt]); if (snapshot === "active") await gate; return snapshot; } });
  const active = coordinator.prepare("active", false);
  const warm = coordinator.prepare("save", false);
  const save = coordinator.prepare("save", false, { explicit: true });
  assert.equal(warm, save);
  const stale = coordinator.prepare("stale", false).catch(error => error);
  const latest = coordinator.prepare("latest", false);
  release();
  assert.deepEqual(await Promise.all([active, save, latest]), ["active", "save", "latest"]);
  assert.match((await stale).message, /superseded/);
  assert.deepEqual(built, [["active", false], ["save", false], ["latest", false]]);
});

test("queued explicit Save promotes its own prompt permission, running background failure remains retryable", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const built: [string, boolean][] = [];
  const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: string, b) => a === b,
    build: async (snapshot, allowPrompt) => { built.push([snapshot, allowPrompt]); if (snapshot === "active") await gate;
      if (!allowPrompt) throw new Error("wildz_identity_passphrase_required"); return snapshot; } });
  const active = coordinator.prepare("active", false).catch(error => error);
  const queued = coordinator.prepare("save", false);
  assert.equal(coordinator.prepare("save", true), queued);
  release();
  assert.match((await active).message, /passphrase_required/);
  assert.equal(await queued, "save");
  assert.equal(await coordinator.prepare("active", true), "active");
  assert.deepEqual(built, [["active", false], ["save", true], ["active", true]]);
});

test("Save can retry a joined locked background immediately from its rejection handler", async () => {
  const calls: boolean[] = [];
  const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: string, b) => a === b,
    build: async (_snapshot, allowPrompt) => { calls.push(allowPrompt); if (!allowPrompt) throw new Error("wildz_identity_passphrase_required"); return "saved"; } });
  const background = coordinator.prepare("exact", false).catch(() => undefined);
  const save = coordinator.prepare("exact", false, { explicit: true }).catch(() => coordinator.prepare("exact", true));
  await background;
  assert.equal(await save, "saved");
  assert.deepEqual(calls, [false, true]);
});

test("queued explicit joins cannot downgrade prompt permission or replace the protected callback", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const built: [string, boolean][] = [];
  const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: { key: string; source: string }, b) => a.key === b.key,
    build: async (snapshot, allowPrompt) => { if (snapshot.key === "active") await gate; built.push([snapshot.source, allowPrompt]); return snapshot.source; } });
  const active = coordinator.prepare({ key: "active", source: "active" }, false);
  const saving = coordinator.prepare({ key: "save", source: "original passphrase callback" }, true);
  const joining = coordinator.prepare({ key: "save", source: "later nonprompt callback" }, false, { explicit: true });
  assert.equal(joining, saving);
  assert.equal(coordinator.prepare({ key: "save", source: "later equal-permission callback" }, true), saving);
  release(); await active;
  assert.equal(await saving, "original passphrase callback");
  assert.deepEqual(built, [["active", false], ["original passphrase callback", true]]);
});

for (const target of ["active", "cached"] as const) {
  test(`reselecting the ${target} target retires obsolete speculation but preserves explicit Save`, async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const built: string[] = [];
    const coordinator = createWildzExportCoordinator({ sameSnapshot: (a: string, b) => a === b,
      build: async snapshot => { built.push(snapshot); if (snapshot === "active") await gate; return snapshot; } });
    await coordinator.prepare("cached", false);
    const active = coordinator.prepare("active", false);
    const explicit = coordinator.prepare("explicit", false, { explicit: true });
    const obsolete = coordinator.prepare("obsolete", false).catch(error => error);
    const selection = coordinator.prepare(target, false);
    release();
    assert.equal(await selection, target);
    assert.deepEqual(await Promise.all([active, explicit]), ["active", "explicit"]);
    assert.match((await obsolete).message, /superseded/);
    assert.deepEqual(built, ["cached", "active", "explicit"]);
  });
}
