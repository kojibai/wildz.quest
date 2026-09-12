import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsExactProofCache } from "../src/features/play/wilds-exact-proof-cache";
import { projectWildsOwnedWorldAdditions } from "../src/features/play/wilds-player-world-additions";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { constructionProofDigest } from "../src/features/play/wilds-construction-project";

test("equal worker clones reuse verification but every nested data change revalidates", () => {
  const cache = createWildsExactProofCache();
  let calls = 0;
  const verify = (record: { head: string; nested: { owner: string } }) => { calls++; return record.nested.owner === "owner"; };
  const source = { head: "same-head", nested: { owner: "owner" } };
  assert.equal(cache.verify(source, verify), true);
  assert.equal(cache.verify(structuredClone(source), verify), true);
  assert.equal(calls, 1);
  source.nested.owner = "intruder";
  assert.equal(cache.verify(source, verify), false);
  assert.equal(calls, 2);
  const otherVerify = () => false;
  assert.equal(cache.verify({ head: "same-head", nested: { owner: "owner" } }, otherVerify), false);
});

test("getters, toJSON, non-data prototypes, symbols, hidden fields and sparse arrays never use the cache", () => {
  const cache = createWildsExactProofCache();
  let calls = 0, getterCalls = 0;
  const verify = (_record: unknown) => { calls++; return true; };
  const getter = { nested: { get owner() { getterCalls++; return "owner"; } } };
  const values: unknown[] = [getter, { nested: { toJSON() { return {}; } } }, new Date(), { [Symbol("hidden")]: 1 },
    Object.defineProperty({}, "hidden", { value: 1 }), Array(2), { value: undefined }, { value: Infinity }];
  for (const value of values) { cache.verify(value, verify); cache.verify(value, verify); }
  assert.equal(calls, values.length * 2);
  assert.equal(getterCalls, 0, "cache inspection never invokes accessors");
  assert.equal(cache.stats().entries, 0);
});

test("LRU entries and retained exact keys stay within both configured bounds", () => {
  const cache = createWildsExactProofCache({ maxEntries: 2, maxBytes: 120 });
  let calls = 0;
  const verify = (_record: unknown) => { calls++; return true; };
  cache.verify({ value: "one" }, verify);
  cache.verify({ value: "two" }, verify);
  cache.verify({ value: "three" }, verify);
  assert.ok(cache.stats().entries <= 2);
  assert.ok(cache.stats().bytes <= 120);
  const before = calls;
  cache.verify({ value: "one" }, verify);
  assert.equal(calls, before + 1, "oldest exact record was evicted");
  cache.verify({ value: "x".repeat(1000) }, verify);
  cache.verify({ value: "x".repeat(1000) }, verify);
  assert.equal(calls, before + 3, "oversized values always revalidate");
  assert.ok(cache.stats().bytes <= 120);
});

test("owned projection admits exact cloned material then rejects nested tampering under the same head", () => {
  const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:stone:${"a".repeat(64)}`, kind: "stone" as const,
    quantity: 1 as const, quality: 1 as const, ownerReceizId: "owner", source: { sourceId: "source:test", sourceHead: `sha256:${"a".repeat(64)}`,
      admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: 1 }, contributors: { explorerReceizId: "owner" }, authority: "source-proof-object" as const };
  const lot = { ...basis, head: constructionProofDigest(basis) };
  const world = { ...initialWildsWorldProjection(), materialLots: { [lot.lotId]: lot } };
  assert.equal(Object.keys(projectWildsOwnedWorldAdditions(world, "owner").materialLots).length, 1);
  const cloned = structuredClone(world);
  assert.equal(Object.keys(projectWildsOwnedWorldAdditions(cloned, "owner").materialLots).length, 1);
  cloned.materialLots[lot.lotId]!.source.kaiUPulse = 2;
  assert.deepEqual(projectWildsOwnedWorldAdditions(cloned, "owner").materialLots, {});
});
