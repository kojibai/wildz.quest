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
