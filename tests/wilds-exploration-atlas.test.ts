import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInitialWildsExplorationAtlas,
  discoverWildsExplorationSite,
  mergeWildsExplorationAtlases,
  normalizeWildsExplorationAtlas,
  revealWildsExplorationAt,
  wildsExplorationBounds,
  wildsExplorationContainsRegion,
  wildsExplorationContainsSite,
  wildsExplorationContainsWorld,
  wildsExplorationRegions
} from "../src/features/play/wilds-exploration-atlas.js";
import { wildsDiscoverySitesForRegion } from "../src/features/play/wilds-discovery-sites.js";

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

test("normalization discards malformed rows, clamps released coordinates, and sorts iteration", () => {
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
  assert.equal(wildsExplorationBounds(restored).count, 83);
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
