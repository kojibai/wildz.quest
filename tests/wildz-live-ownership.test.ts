import assert from "node:assert/strict";
import { test } from "node:test";
import { startWildzLiveOwnershipRefresh, WILDZ_OWNERSHIP_REFRESH_EVENT, WILDZ_OWNERSHIP_REFRESH_INTERVAL_MS } from "../src/features/identity/wildz-live-ownership";
import { removeWildzAssetsFromActiveVault } from "../src/features/identity/wildz-ownership-reconciliation";
import { initialPlayState, type PlayState } from "../src/features/play/game-state";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function environment() {
  const visibility = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const notifications = new EventTarget();
  let tick: (() => void) | null = null, cleared = false;
  const timers = {
    setInterval: ((callback: () => void, duration: number) => { assert.equal(duration, WILDZ_OWNERSHIP_REFRESH_INTERVAL_MS); tick = callback; return 1; }) as unknown as typeof globalThis.setInterval,
    clearInterval: (() => { cleared = true; tick = null; }) as typeof globalThis.clearInterval
  };
  return { visibility, notifications, ...timers, tick: () => tick?.(), cleared: () => cleared };
}

test("world ownership refresh runs without opening Market and resumes when visible", async () => {
  const env = environment(); let calls = 0;
  const stop = startWildzLiveOwnershipRefresh({ ...env, refresh: async () => { calls++; } });
  await flush(); assert.equal(calls, 1);
  env.tick(); await flush(); assert.equal(calls, 2);
  env.visibility.visibilityState = "hidden";
  env.tick(); env.notifications.dispatchEvent(new Event(WILDZ_OWNERSHIP_REFRESH_EVENT));
  await flush(); assert.equal(calls, 2);
  env.visibility.visibilityState = "visible";
  env.visibility.dispatchEvent(new Event("visibilitychange"));
  await flush(); assert.equal(calls, 3);
  stop(); assert.equal(env.cleared(), true);
  env.visibility.dispatchEvent(new Event("visibilitychange"));
  env.notifications.dispatchEvent(new Event(WILDZ_OWNERSHIP_REFRESH_EVENT));
  await flush(); assert.equal(calls, 3);
});

test("polls and notifications cannot overlap; rejected refresh permits the next bounded retry", async () => {
  const env = environment(); let calls = 0, reject!: (cause: Error) => void;
  const stop = startWildzLiveOwnershipRefresh({ ...env, refresh: async () => {
    calls++; if (calls === 1) await new Promise<void>((_resolve, fail) => { reject = fail; });
  } });
  await flush(); env.tick(); env.notifications.dispatchEvent(new Event(WILDZ_OWNERSHIP_REFRESH_EVENT));
  await flush(); assert.equal(calls, 1);
  reject(new Error("temporarily offline")); await flush();
  env.tick(); await flush(); assert.equal(calls, 2);
  stop();
});

test("lost custody removes active crew and roam preference while preserving historical proof records", () => {
  const card = initialPlayState.inventory[0]!;
  const state: PlayState = { ...structuredClone(initialPlayState), selectedAssetId: card.id,
    supportAssetIds: [card.id, null], crewPreferences: { ownerReceizId: card.manifest.ownerReceizId, byAssetId: { [card.id]: "roam" } },
    achievements: ["permanent-history"] };
  const reconciled = removeWildzAssetsFromActiveVault(state, [card.id]);
  assert.equal(reconciled.inventory.some(asset => asset.id === card.id), false);
  assert.equal(reconciled.supportAssetIds.includes(card.id), false);
  assert.notEqual(reconciled.selectedAssetId, card.id);
  assert.equal(reconciled.crewPreferences?.byAssetId[card.id], undefined);
  assert.deepEqual(reconciled.achievements, ["permanent-history"]);
});

test("account teardown before queued startup prevents the old refresh", async () => {
  const env = environment(); let calls = 0;
  const stop = startWildzLiveOwnershipRefresh({ ...env, refresh: async () => { calls++; } });
  stop(); await flush(); assert.equal(calls, 0);
});

test("browser timer methods retain their global receiver on start and teardown", async () => {
  const env = environment();
  let cleared = false;
  const stop = startWildzLiveOwnershipRefresh({
    ...env,
    refresh: async () => {},
    setInterval: function (this: unknown) {
      assert.equal(this, globalThis, "Window timers reject a dependency-object receiver");
      return 1;
    } as unknown as typeof globalThis.setInterval,
    clearInterval: function (this: unknown) {
      assert.equal(this, globalThis);
      cleared = true;
    } as typeof globalThis.clearInterval
  });
  stop();
  await flush();
  assert.equal(cleared, true);
});
