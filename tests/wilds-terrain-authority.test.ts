import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WILDS_TERRAIN_VERSION,
  distanceToWildsMajorRoute,
  sampleWildsTerrain,
  wildsTerrainElevation
} from "../src/features/play/wilds-terrain-authority";

test("terrain samples are deterministic finite world facts", () => {
  const first = sampleWildsTerrain(83.25, -61.75);

  assert.deepEqual(first, sampleWildsTerrain(83.25, -61.75));
  assert.equal(first.version, WILDS_TERRAIN_VERSION);
  assert.ok(Number.isFinite(first.elevation));
  assert.ok(Number.isFinite(first.slope));
  assert.ok(Object.values(first.normal).every(Number.isFinite));
  assert.ok(first.normal.y > 0);
});

test("authored arrival and landmark footprints remain level and walkable", () => {
  for (const point of [{ x: 0, z: 0 }, { x: 96, z: 144 }, { x: -144, z: 96 }, { x: 72, z: 40 }]) {
    const sample = sampleWildsTerrain(point.x, point.z);

    assert.equal(sample.slope, 0);
    assert.notEqual(sample.surface, "deep-water");
    assert.deepEqual(sample.traversal, []);
  }
});

test("major route centers are flattened by the same authority", () => {
  assert.equal(distanceToWildsMajorRoute(0, 0), 0);
  assert.ok(Math.abs(wildsTerrainElevation(0, 0) - wildsTerrainElevation(0.25, 0.1)) < 0.08);
});

test("terrain changes across distant geography without exceeding released bounds", () => {
  const values = [
    sampleWildsTerrain(220, 190).elevation,
    sampleWildsTerrain(-310, 125).elevation,
    sampleWildsTerrain(48, -286).elevation
  ];

  assert.ok(new Set(values).size > 1);
  assert.ok(values.every((value) => value >= -8 && value <= 28));
});
