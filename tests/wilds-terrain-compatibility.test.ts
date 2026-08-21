import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import {
  buildWildsObstacleIndex,
  type WildsTerrainObstacle
} from "../src/features/play/wilds-terrain-obstacles";
import { restoreWildsGroundedPosition } from "../src/features/play/wilds-terrain-compatibility";

const obstacle: WildsTerrainObstacle = {
  id: "test:tree",
  kind: "tree",
  material: "solid",
  position: { x: 0, y: 0, z: 0 },
  radius: 0.8,
  shape: { kind: "cylinder", radius: 0.8, height: 3 },
  visualScale: 1
};

test("an unobstructed old save keeps exact horizontal coordinates", () => {
  const restored = restoreWildsGroundedPosition({ x: 0.5, z: -0.5 }, buildWildsObstacleIndex([]));

  assert.deepEqual(restored, {
    x: 0.5,
    y: sampleWildsTerrain(0.5, -0.5).elevation,
    z: -0.5,
    adjusted: false
  });
});

test("an obstructed old save moves through one deterministic bounded search", () => {
  const index = buildWildsObstacleIndex([obstacle]);
  const first = restoreWildsGroundedPosition({ x: 0, z: 0 }, index);

  assert.deepEqual(first, restoreWildsGroundedPosition({ x: 0, z: 0 }, index));
  assert.equal(first.adjusted, true);
  assert.ok(Math.hypot(first.x, first.z) <= 4);
});

test("safe projection fails closed when the bounded search has no clear point", () => {
  const index = buildWildsObstacleIndex([{
    ...obstacle,
    id: "test:block",
    radius: 10,
    shape: { kind: "cylinder", radius: 10, height: 3 }
  }]);

  assert.throws(() => restoreWildsGroundedPosition({ x: 0, z: 0 }, index), /wilds_ground_position_unresolved/);
  assert.throws(() => restoreWildsGroundedPosition({ x: Number.NaN, z: 0 }, index), /wilds_ground_position_invalid/);
});
