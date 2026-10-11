import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzPreparedCardCache } from "../src/lib/receiz/wildz-prepared-card-cache";

test("opening Vault again and clicking Save reuse exact prepared bytes without signing again", async () => {
  const cache = createWildzPreparedCardCache<Uint8Array>();
  const bytes = new Uint8Array([1, 2, 3]);
  let seals = 0;
  const prepare = async () => { seals++; return bytes; };
  const opening = cache.get("identity:owner:card-proof", prepare);
  const saving = cache.get("identity:owner:card-proof", prepare);
  assert.equal(await opening, bytes);
  assert.equal(await saving, bytes);
  assert.equal(await cache.get("identity:owner:card-proof", prepare), bytes);
  assert.equal(seals, 1);
});

test("ownership transfer, signer change, and a changed card cannot reuse an old export", async () => {
  const cache = createWildzPreparedCardCache<number>();
  let preparations = 0;
  for (const key of ["key1:alice:proof1", "key1:bob:proof1", "key2:bob:proof1", "key2:bob:proof2"]) {
    assert.equal(await cache.get(key, async () => ++preparations), preparations);
  }
  assert.equal(preparations, 4);
});

test("a failed background preparation does not poison an explicit Save retry", async () => {
  const cache = createWildzPreparedCardCache<number>();
  await assert.rejects(cache.get("current", async () => { throw new Error("offline"); }), /offline/);
  assert.equal(await cache.get("current", async () => 42), 42);
});


test("more than eight unresolved exact preparations still single-flight the first key", async () => {
  const cache = createWildzPreparedCardCache<number>();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let starts = 0;
  const jobs = Array.from({ length: 12 }, (_, index) => cache.get(String(index), async () => { starts++; await gate; return index; }));
  const revisit = cache.get("0", async () => { starts++; await gate; return 999; });
  await Promise.resolve();
  release();
  assert.deepEqual(await Promise.all([...jobs, revisit]), [...Array.from({ length: 12 }, (_, i) => i), 0]);
  assert.equal(starts, 12);
});

test("speculative selection churn runs one active and latest waiting card, preserving an explicit Save", async () => {
  const cache = createWildzPreparedCardCache<string>();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const built: string[] = [];
  const make = (key: string) => async () => { built.push(key); if (key === "active") await gate; return key; };
  const active = cache.get("active", make("active"), { speculative: true });
  await new Promise(resolve => setImmediate(resolve));
  const pending = Array.from({ length: 12 }, (_, i) => cache.get(`card-${i}`, make(`card-${i}`), { speculative: true }).catch(error => error));
  const saved = cache.get("card-11", make("card-11"));
  const latest = cache.get("latest", make("latest"), { speculative: true });
  assert.deepEqual(built, ["active"]);
  release();
  assert.equal(await active, "active");
  assert.equal(await saved, "card-11");
  assert.equal(await latest, "latest");
  const results = await Promise.all(pending);
  assert.ok(results.slice(0, 11).every(value => value instanceof Error && /superseded/.test(value.message)));
  assert.equal(results[11], "card-11");
  assert.deepEqual(built, ["active", "card-11", "latest"]);
});

test("immediate reselection of a superseded pending card gets its fresh exact request", async () => {
  const cache = createWildzPreparedCardCache<string>();
  let release!: () => void;
  const active = cache.get("active", () => new Promise<string>(resolve => { release = () => resolve("active"); }), { speculative: true });
  await Promise.resolve();
  const old = cache.get("B", async () => "old B", { speculative: true }).catch(error => error);
  const middle = cache.get("C", async () => "C", { speculative: true }).catch(error => error);
  const latest = cache.get("B", async () => "new B", { speculative: true }).catch(error => error);
  release(); await active;
  assert.match((await old).message, /superseded/);
  assert.match((await middle).message, /superseded/);
  assert.equal(await latest, "new B");
});

test("queued protected preparation keeps its passphrase callback when another explicit caller joins", async () => {
  const cache = createWildzPreparedCardCache<string>();
  let release!: () => void;
  const active = cache.get("active", () => new Promise<string>(resolve => { release = () => resolve("active"); }));
  await Promise.resolve();
  const requested = cache.get("save", async () => "original exact bytes");
  const nonprompt = { speculative: false, allowPrompt: false };
  const joined = cache.get("save", async () => { throw new Error("wildz_identity_passphrase_required"); }, nonprompt);
  assert.equal(joined, requested);
  assert.equal(cache.get("save", async () => "later equal-permission bytes"), requested);
  release(); await active;
  assert.equal(await requested, "original exact bytes");
});

test("queued explicit nonprompt preparation can promote to a prompt-enabled Save", async () => {
  const cache = createWildzPreparedCardCache<string>();
  let release!: () => void;
  const active = cache.get("active", () => new Promise<string>(resolve => { release = () => resolve("active"); }));
  await Promise.resolve();
  const nonprompt = { speculative: false, allowPrompt: false };
  const requested = cache.get("save", async () => { throw new Error("wildz_identity_passphrase_required"); }, nonprompt);
  const prompted = cache.get("save", async () => "prompted exact bytes");
  assert.equal(prompted, requested);
  release(); await active;
  assert.equal(await requested, "prompted exact bytes");
});

test("reselecting any settled artifact retires obsolete speculation even beyond the coordinator's latest artifact", async () => {
  const cache = createWildzPreparedCardCache<string>();
  const built: string[] = [];
  const make = (key: string) => async () => { built.push(key); return key; };
  await cache.get("cached A", make("cached A"));
  await cache.get("cached B", make("cached B"));
  let release!: () => void;
  const active = cache.get("active", () => new Promise<string>(resolve => { release = () => resolve("active"); }), { speculative: true });
  await Promise.resolve();
  const explicit = cache.get("explicit", make("explicit"));
  const obsolete = cache.get("obsolete", make("obsolete"), { speculative: true }).catch(error => error);
  const selection = cache.get("cached A", make("duplicate A"), { speculative: true });
  assert.equal(await selection, "cached A");
  release(); await active; await explicit;
  assert.match((await obsolete).message, /superseded/);
  assert.deepEqual(built, ["cached A", "cached B", "explicit"]);
});
