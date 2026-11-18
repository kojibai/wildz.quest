import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInitialWildsExplorationAtlas,
  discoverWildsExplorationSite,
  mergeWildsExplorationAtlases,
  normalizeWildsExplorationAtlas,
  revealWildsExplorationAt,
  wildsExplorationBounds,
  wildsExplorationCheckpointDelta,
  wildsExplorationContainsRegion,
  wildsExplorationContainsSite,
  wildsExplorationContainsWorld,
  wildsExplorationRegions
} from "../src/features/play/wilds-exploration-atlas.js";
import { wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites.js";
import { WILDS_REGION_SIZE } from "../src/features/play/multiplayer-core.js";

test("a new explorer begins with the exact original nine by nine atlas", () => {
  const atlas = createInitialWildsExplorationAtlas();
  assert.deepEqual(wildsExplorationBounds(atlas), { minX: -4, maxX: 4, minZ: -4, maxZ: 4, count: 81 });
  assert.equal(wildsExplorationContainsRegion(atlas, 4, -4), true);
  assert.equal(wildsExplorationContainsRegion(atlas, 5, 0), false);
});

test("crossing into distant terrain reveals only its sight fringe and is idempotent", () => {
  const initial = createInitialWildsExplorationAtlas();
  const revealed = revealWildsExplorationAt(initial, { x: 245, z: -1433 });
  assert.equal(wildsExplorationContainsRegion(revealed, 5, -30), true);
  assert.equal(wildsExplorationContainsRegion(revealed, 4, -31), true);
  assert.equal(wildsExplorationContainsRegion(revealed, 0, -15), false);
  assert.equal(wildsExplorationContainsWorld(revealed, { x: 245, z: -1433 }), true);
  assert.equal(revealWildsExplorationAt(revealed, { x: 245, z: -1433 }), revealed);
});

test("normalization merges ranges and same-owner union never removes discovery", () => {
  const restored = normalizeWildsExplorationAtlas({
    version: 1,
    rows: [{ z: 7, ranges: [{ minX: 4, maxX: 5 }, { minX: 1, maxX: 3 }] }]
  }, { x: 0, z: 0 });
  assert.deepEqual(restored.rows.find((row) => row.z === 7)?.ranges, [{ minX: 1, maxX: 5 }]);
  const merged = mergeWildsExplorationAtlases(createInitialWildsExplorationAtlas(), restored);
  assert.equal(wildsExplorationContainsRegion(merged, -4, -4), true);
  assert.equal(wildsExplorationContainsRegion(merged, 5, 7), true);
});

test("malformed legacy exploration falls back to start plus current sight", () => {
  const restored = normalizeWildsExplorationAtlas({ version: 1, rows: "invalid" }, { x: 245, z: -1433 });
  assert.equal(wildsExplorationContainsRegion(restored, -4, -4), true);
  assert.equal(wildsExplorationContainsRegion(restored, 5, -30), true);
  assert.equal(wildsExplorationContainsRegion(restored, 0, -15), false);
});

test("normalization discards malformed rows, rejects unrepresentable coordinates, and sorts iteration", () => {
  const restored = normalizeWildsExplorationAtlas({
    version: 1,
    rows: [
      { z: 8, ranges: [{ minX: 6, maxX: 6 }] },
      { z: "bad", ranges: [{ minX: 1, maxX: 2 }] },
      { z: 7, ranges: [{ minX: Number.MAX_SAFE_INTEGER, maxX: Number.MAX_SAFE_INTEGER }] }
    ]
  }, { x: 0, z: 0 });
  const regions = [...wildsExplorationRegions(restored)];
  assert.deepEqual(regions.slice(0, 2), [{ x: -4, z: -4 }, { x: -3, z: -4 }]);
  assert.deepEqual(regions.at(-1), { x: 6, z: 8 });
  assert.equal(wildsExplorationBounds(restored).count, 82);
});

test("exploration continuity stores only stable discovered site keys", () => {
  const initial = createInitialWildsExplorationAtlas();
  const siteKey = wildsDiscoverySitesForRegion(3, -2)[1]!.key;
  const discovered = discoverWildsExplorationSite(initial, siteKey);
  assert.equal(wildsExplorationContainsSite(discovered, siteKey), true);
  assert.equal(discoverWildsExplorationSite(discovered, siteKey), discovered);
  assert.deepEqual(discovered.siteKeys, [siteKey]);
  assert.equal(discoverWildsExplorationSite(discovered, "wildz.site.v1:3:-2:1:0123456789abcdef"), discovered);
  assert.equal(discoverWildsExplorationSite(discovered, "wildz.site.v1:999999999:-2:9:0123456789abcdef"), discovered);
  assert.equal(discoverWildsExplorationSite(discovered, "wildz.excavation.v1:private:0123456789abcdef"), discovered);

  const restored = normalizeWildsExplorationAtlas({
    ...discovered,
    siteKeys: ["bad", discovered.siteKeys[0], discovered.siteKeys[0]]
  }, { x: 0, z: 0 });
  assert.deepEqual(restored.siteKeys, discovered.siteKeys);
});

test("revealing a fringe preserves historical rows, unchanged ranges and discovered sites", () => {
  const origin = { x: 0, z: 0 };
  const rows = Array.from({ length: 2_000 }, (_, z) => ({
    z, ranges: [{ minX: 10, maxX: 11 }, { minX: 15, maxX: 16 }, { minX: 50, maxX: 80 }]
  }));
  const atlas = normalizeWildsExplorationAtlas({ version: 1, rows, siteKeys: [wildsDiscoverySitesForRegion(3, -2)[1]!.key] }, origin);
  const position = { x: 13 * WILDS_REGION_SIZE, z: 100 * WILDS_REGION_SIZE };
  const previousCount = wildsExplorationBounds(atlas).count;
  const next = revealWildsExplorationAt(atlas, position);
  assert.equal(next.siteKeys, atlas.siteKeys);
  for (const [index, row] of atlas.rows.entries()) {
    if (Math.abs(row.z - 100) > 1) assert.equal(next.rows[index], row);
    else {
      assert.deepEqual(next.rows[index]!.ranges, [{ minX: 10, maxX: 16 }, { minX: 50, maxX: 80 }]);
      assert.equal(next.rows[index]!.ranges[1], row.ranges[2]);
    }
  }
  assert.equal(wildsExplorationBounds(next).count, previousCount + 9);
  assert.equal(wildsExplorationContainsWorld(atlas, position), false);
  assert.equal(revealWildsExplorationAt(next, position), next);
  assert.deepEqual(normalizeWildsExplorationAtlas(JSON.parse(JSON.stringify(next)), position), next);
});

test("repeated map frames reuse bounds for the same retained territory", () => {
  const atlas = createInitialWildsExplorationAtlas();
  const bounds = wildsExplorationBounds(atlas);
  assert.equal(wildsExplorationBounds({ ...atlas, siteKeys: [] }), bounds);
  const expanded = revealWildsExplorationAt(atlas, { x: 0, z: 20 * WILDS_REGION_SIZE });
  assert.deepEqual(wildsExplorationBounds(expanded), { minX: -4, maxX: 4, minZ: -4, maxZ: 21, count: 90 });
  assert.equal(wildsExplorationBounds(atlas).count, 81);
});

test("a contained map keeps the exact larger normalized atlas and a gap still adds territory", () => {
  const position = { x: 0, z: 0 };
  const subset = createInitialWildsExplorationAtlas();
  const larger = normalizeWildsExplorationAtlas({ version: 1, rows: [
    { z: 15, ranges: [{ minX: 10, maxX: 12 }, { minX: 16, maxX: 19 }] }
  ] }, position);
  assert.equal(mergeWildsExplorationAtlases(larger, subset), larger);
  assert.equal(mergeWildsExplorationAtlases(subset, larger), larger);
  const bridge = normalizeWildsExplorationAtlas({ version: 1, rows: [{ z: 15, ranges: [{ minX: 11, maxX: 18 }] }] }, position);
  assert.deepEqual(mergeWildsExplorationAtlases(larger, bridge).rows.at(-1)?.ranges, [{ minX: 10, maxX: 19 }]);
  const discovered = discoverWildsExplorationSite(larger, wildsDiscoverySitesForRegion(3, -2)[1]!.key);
  assert.equal(mergeWildsExplorationAtlases(larger, discovered), discovered);
});

test("a checkpoint stores only the missing ranges and sites over its held map", () => {
  const position = { x: 0, z: 0 };
  const row = (ranges: [number, number][]) => ({ z: 20, ranges: ranges.map(([minX, maxX]) => ({ minX, maxX })) });
  const held = normalizeWildsExplorationAtlas({ version: 1, rows: [row([[1, 3], [5, 8], [11, 15], [30, 40]])] }, position);
  const site = wildsDiscoverySitesForRegion(3, -2)[1]!.key;
  const current = normalizeWildsExplorationAtlas({ version: 1, rows: [row([[-2, 5], [7, 18], [31, 32]])], siteKeys: [site] }, position);
  const delta = wildsExplorationCheckpointDelta(held, current);
  assert.deepEqual(delta, { version: 1, rows: [row([[-2, 0], [4, 4], [9, 10], [16, 18]])], siteKeys: [site] });
  assert.deepEqual(mergeWildsExplorationAtlases(held, delta), mergeWildsExplorationAtlases(held, current));
  assert.equal(wildsExplorationCheckpointDelta(held, current), delta);
  assert.deepEqual(wildsExplorationCheckpointDelta(held, held), { version: 1, rows: [], siteKeys: [] });
});
