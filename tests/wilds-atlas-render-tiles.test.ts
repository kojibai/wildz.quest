import assert from "node:assert/strict";
import { test } from "node:test";
import {
  atlasLocalCoordinate,
  atlasWorldCoordinate,
  buildWildsAtlasRenderTiles,
  clipWildsAtlasRouteSegments,
  wildsAtlasProjectedBounds,
  wildsAtlasProjectedSpan,
  wildsAtlasTileContainsRegion,
  type WildsAtlasRenderTile
} from "../src/features/play/wilds-atlas-render-tiles.js";

function squareNodes(minX: number, maxX: number, minZ: number, maxZ: number) {
  const nodes: Array<{ regionX: number; regionZ: number }> = [];
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) nodes.push({ regionX: x, regionZ: z });
  }
  return nodes;
}

function tileContainsRegion(tile: WildsAtlasRenderTile, x: number, z: number) {
  return wildsAtlasTileContainsRegion(tile, x, z);
}

test("render tiles preserve an undiscovered gap between distant atlas extensions", () => {
  const nodes = [
    ...squareNodes(-4, 4, -4, 4),
    ...squareNodes(4, 6, -31, -29)
  ];
  const tiles = buildWildsAtlasRenderTiles(nodes, { maxVertices: 16_384 });
  assert.equal(tiles.some((tile) => tileContainsRegion(tile, 0, -15)), false);
  assert.ok(tiles.reduce((sum, tile) => sum + tile.vertexBudget, 0) <= 16_384);
  assert.deepEqual(tiles.map((tile) => [tile.minRegionX, tile.maxRegionX, tile.minRegionZ, tile.maxRegionZ]), [
    [4, 6, -31, -29],
    [-4, 4, -4, 4]
  ]);
});

test("tiling walks sparse rows instead of the enormous empty bounding rectangle", () => {
  const tiles = buildWildsAtlasRenderTiles([
    { regionX: -10_000_000, regionZ: -10_000_000 },
    { regionX: 10_000_000, regionZ: 10_000_000 }
  ], { maxVertices: 64 });
  assert.equal(tiles.length, 2);
  assert.deepEqual(tiles.map((tile) => [tile.minRegionX, tile.minRegionZ]), [
    [-10_000_000, -10_000_000],
    [10_000_000, 10_000_000]
  ]);
});

test("projected bounds reduce huge sparse node sets without argument spreading", () => {
  const nodes = Array.from({ length: 200_000 }, (_, index) => ({
    regionX: index - 100_000,
    regionZ: index % 2 === 0 ? -20_000_000 : 20_000_000
  }));
  assert.deepEqual(wildsAtlasProjectedBounds(nodes), {
    minX: -100_000,
    maxX: 99_999,
    minZ: -20_000_000,
    maxZ: 20_000_000,
    count: 200_000
  });
});

test("draw and vertex caps batch every discovered cell without ever filling hidden cells", () => {
  const nodes = Array.from({ length: 140 }, (_, index) => ({ regionX: index * 2, regionZ: index * 2 }));
  const tiles = buildWildsAtlasRenderTiles(nodes, { maxTiles: 3, maxVertices: 12 });
  assert.ok(tiles.length <= 3);
  assert.equal(tiles.every((tile) => tile.fallback === "instanced-cells"), true);
  assert.equal(tiles.reduce((sum, tile) => sum + tile.vertexBudget, 0), 12);
  assert.equal(nodes.every((node) => tiles.some((tile) => tileContainsRegion(tile, node.regionX, node.regionZ))), true);
  assert.equal(tiles.some((tile) => tileContainsRegion(tile, 1, 1)), false);
});

test("local and world coordinates round-trip exact region cell edges", () => {
  const centerRegion = 0.5;
  const regionUnit = 1.2;
  assert.equal(atlasLocalCoordinate(0, centerRegion, regionUnit), -0.6);
  assert.equal(atlasLocalCoordinate(48, centerRegion, regionUnit), 0.6);
  assert.equal(atlasWorldCoordinate(-0.6, centerRegion, regionUnit), 0);
  assert.equal(atlasWorldCoordinate(0.6, centerRegion, regionUnit), 48);
});

test("Region and Landmark framing depends on projected view nodes, not distant discovery bounds", () => {
  const distantRegionWindow = squareNodes(10_000, 10_004, -20_000, -19_996);
  const distantLandmarkWindow = squareNodes(10_001, 10_003, -19_999, -19_997);
  assert.equal(wildsAtlasProjectedSpan(distantRegionWindow, 27 / 20), 27 / 4);
  assert.ok(Math.abs(wildsAtlasProjectedSpan(distantLandmarkWindow, 27 / 20) - 81 / 20) < 1e-12);
});

test("DDA route clipping cannot bridge even a one-cell unknown gap", () => {
  const segments = clipWildsAtlasRouteSegments(
    [{ x: -24, z: 24 }, { x: 72, z: 24 }],
    [{ regionX: -1, regionZ: 0 }, { regionX: 1, regionZ: 0 }]
  );
  assert.deepEqual(segments, [
    [{ x: -24, z: 24 }, { x: 0, z: 24 }],
    [{ x: 48, z: 24 }, { x: 72, z: 24 }]
  ]);
  assert.equal(segments.some((segment) => segment[0]!.x < 0 && segment.at(-1)!.x > 48), false);
});

test("DDA clipping stays bounded and fails closed for extreme route spans", () => {
  const segments = clipWildsAtlasRouteSegments(
    [{ x: 24, z: 24 }, { x: 48 * 20_000 + 24, z: 24 }],
    [{ regionX: 0, regionZ: 0 }, { regionX: 20_000, regionZ: 0 }]
  );
  assert.deepEqual(segments, [[{ x: 24, z: 24 }, { x: 48, z: 24 }]]);
});
