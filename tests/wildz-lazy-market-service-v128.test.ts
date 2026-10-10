import assert from "node:assert/strict";
import { test } from "node:test";
import { createLazyWildzMarketServiceV128 } from "../src/features/market/wildz-lazy-market-service-v128";
import type { WildzMarketServiceV128, WildzMarketSnapshotV128 } from "../src/features/market/wildz-market-service-v128";

const binding = { keyId: "a".repeat(64), ownerHandle: "alice.receiz.id" };
const snapshot: WildzMarketSnapshotV128 = { status: "ready", message: "", listings: [], purchases: [], sellables: [] };
function fixture(overrides: Partial<WildzMarketServiceV128> = {}): WildzMarketServiceV128 {
  const action = async () => ({ status: "pending" as const, message: "Exact attempt pending." });
  return { binding, snapshot: () => snapshot, subscribe: () => () => undefined, read: async () => snapshot,
    list: action, cancel: action, approvePurchase: action, resume: action, accept: action, receive: action,
    previewPurchase: async () => { throw Error("Not part of this runtime-boundary fixture."); }, ...overrides };
}

test("constructing, painting and subscribing to the market bridge opens no runtime", () => {
  let opens = 0;
  const lazy = createLazyWildzMarketServiceV128({ binding, currentBinding: () => binding, open: async () => { opens++; return fixture(); } });
  lazy.service.snapshot(); const stop = lazy.service.subscribe(() => undefined); stop();
  assert.equal(opens, 0); assert.equal(lazy.opened(), false); lazy.dispose();
});

test("concurrent explicit market reads share one open and preserve the service outcome", async () => {
  let opens = 0;
  const lazy = createLazyWildzMarketServiceV128({ binding, currentBinding: () => binding, open: async () => { opens++; return fixture(); } });
  assert.deepEqual(await Promise.all([lazy.service.read(), lazy.service.read()]), [snapshot, snapshot]);
  assert.equal(opens, 1); assert.equal(lazy.opened(), true);
  assert.equal((await lazy.service.resume("saved-purchase")).status, "pending"); lazy.dispose();
});

test("failed market opening can retry without poisoning subsequent explicit work", async () => {
  let opens = 0;
  const lazy = createLazyWildzMarketServiceV128({ binding, currentBinding: () => binding, open: async () => { if (++opens === 1) throw Error("Transport unavailable"); return fixture(); } });
  await assert.rejects(lazy.service.read(), /Transport/);
  assert.deepEqual(await lazy.service.read(), snapshot); assert.equal(opens, 2); lazy.dispose();
});

test("an Explorer change during asynchronous opening prevents the old sale from dispatching", async () => {
  let current = binding, writes = 0;
  let resolve!: (value: WildzMarketServiceV128) => void;
  const opening = new Promise<WildzMarketServiceV128>(finish => { resolve = finish; });
  const lazy = createLazyWildzMarketServiceV128({ binding, currentBinding: () => current, open: () => opening });
  const pending = lazy.service.cancel("exact-listing");
  current = { ...binding, ownerHandle: "bob.receiz.id" };
  resolve(fixture({ cancel: async () => { writes++; return { status: "cancelled", message: "" }; } }));
  await assert.rejects(pending, /Explorer changed/); assert.equal(writes, 0); lazy.dispose();
});

test("disposing a closed game releases market listeners and blocks late actions", async () => {
  let listeners = 0;
  const lazy = createLazyWildzMarketServiceV128({ binding, currentBinding: () => binding, open: async () => fixture({ subscribe: () => { listeners++; return () => { listeners--; }; } }) });
  lazy.service.subscribe(() => undefined);
  await lazy.service.read(); assert.equal(listeners, 1);
  lazy.dispose(); assert.equal(listeners, 0);
  await assert.rejects(lazy.service.cancel("exact-listing"), /Explorer changed/);
});

test("panel effect cleanup and resubscription release listeners without reopening the runtime", async () => {
  let opens = 0, held = 0;
  const lazy = createLazyWildzMarketServiceV128({ binding, currentBinding: () => binding,
    open: async () => { opens++; return fixture({ subscribe: () => { held++; return () => { held--; }; } }); } });
  const first = lazy.service.subscribe(() => undefined);
  await lazy.service.read(); assert.equal(held, 1);
  first(); assert.equal(held, 0);
  const second = lazy.service.subscribe(() => undefined);
  await lazy.service.read(); assert.equal(opens, 1); assert.equal(held, 1);
  second(); lazy.dispose();
});

test("a late source update after an Explorer closes neither paints nor throws into native completion", async () => {
  let current = true, paints = 0;
  let deliver!: (next: WildzMarketSnapshotV128) => void;
  const lazy = createLazyWildzMarketServiceV128({ binding,
    currentBinding: () => { if (!current) throw Error("Explorer closed"); return binding; },
    open: async () => fixture({ subscribe: listener => { deliver = listener; return () => undefined; } }) });
  lazy.service.subscribe(() => { paints++; });
  await lazy.service.read(); const before = paints;
  current = false;
  assert.doesNotThrow(() => deliver(snapshot)); assert.equal(paints, before); lazy.dispose();
});
