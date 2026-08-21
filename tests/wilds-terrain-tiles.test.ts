import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWildsTerrainTile,
  wildsTerrainTileCoordinate,
  wildsTerrainTileKey,
  type WildsTerrainTileVertex
} from "../src/features/play/wilds-terrain-tiles";

function authority({ x, z, elevation, normal, surface }: WildsTerrainTileVertex) {
  return { x, z, elevation, normal, surface };
}

test("negative and positive world coordinates resolve to stable absolute tiles", () => {
  assert.deepEqual(wildsTerrainTileCoordinate(0, 0), { tileX: 0, tileZ: 0 });
  assert.deepEqual(wildsTerrainTileCoordinate(-0.01, -12.01), { tileX: -1, tileZ: -2 });
  assert.equal(wildsTerrainTileKey(-1, 2), "wildz.terrain.v1:-1:2");
});

test("adjacent terrain tiles share byte-identical edge samples", () => {
  const left = buildWildsTerrainTile(3, -2, 8);
  const right = buildWildsTerrainTile(4, -2, 8);
  const leftEdge = left.vertices.filter((vertex) => vertex.gridX === 8).map(authority);
  const rightEdge = right.vertices.filter((vertex) => vertex.gridX === 0).map(authority);

  assert.deepEqual(leftEdge, rightEdge);
});

test("visual tessellation changes density without changing authority samples", () => {
  const coarse = buildWildsTerrainTile(1, 1, 4);
  const detailed = buildWildsTerrainTile(1, 1, 8);
  const detailedCorners = detailed.vertices
    .filter((vertex) => vertex.gridX % 2 === 0 && vertex.gridZ % 2 === 0)
    .map(authority);
  const coarseValues = coarse.vertices.map(authority);

  assert.deepEqual(detailedCorners, coarseValues);
});
