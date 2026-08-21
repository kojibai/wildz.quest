import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveWildsGroundMovement,
  resolveWildsObstacleMotion
} from "../src/features/play/wilds-grounded-movement";
import type { WildsTerrainObstacle } from "../src/features/play/wilds-terrain-obstacles";

function obstacle(id: string, x: number, z: number, radius: number, material: WildsTerrainObstacle["material"] = "solid"): WildsTerrainObstacle {
  return {
    id,
    kind: "tree",
    material,
    position: { x, y: 0, z },
    radius,
    shape: { kind: "cylinder", radius, height: 3 },
    visualScale: 1
  };
}

test("unobstructed grounded travel preserves the intended two-dimensional coordinate", () => {
  const result = resolveWildsGroundMovement({ x: 0, z: 0 }, { x: 0.42, z: 0 }, { obstacles: [] });

  assert.deepEqual(result.position, { x: 0.42, z: 0 });
  assert.equal(result.blockedBy.length, 0);
  assert.equal(result.traversalBlockedBy, null);
});

test("grounded movement replay is byte-deterministic", () => {
  const input = [{ x: 18, z: -24 }, { x: 18.38, z: -24.2 }] as const;
  const first = resolveWildsGroundMovement(input[0], input[1]);
  const replay = resolveWildsGroundMovement(input[0], input[1]);

  assert.deepEqual(first, replay);
});

test("a capsule cannot cross a solid trunk", () => {
  const trunk = obstacle("tree:one", 1, 0, 0.34);
  const result = resolveWildsObstacleMotion({ x: 0, z: 0 }, { x: 1, z: 0 }, [trunk], 0.38);

  assert.ok(result.position.x < 1 - trunk.radius - 0.38 + 0.001);
  assert.deepEqual(result.blockedBy, [trunk.id]);
});

test("diagonal capsule motion slides along a solid obstacle", () => {
  const trunk = obstacle("tree:slide", 0.7, 0, 0.3);
  const intended = { x: 0.8, z: 0.55 };
  const result = resolveWildsObstacleMotion({ x: 0, z: 0 }, intended, [trunk], 0.38);

  assert.notDeepEqual(result.position, intended);
  assert.ok(result.position.z > 0.2);
  assert.ok(Math.hypot(result.position.x - trunk.position.x, result.position.z - trunk.position.z) >= trunk.radius + 0.38 - 0.001);
});

test("small stepable rocks and soft foliage remain pass-through", () => {
  const stepable = obstacle("rock:step", 0.4, 0, 0.22, "stepable");
  const soft = obstacle("bush:soft", 0.7, 0, 0.3, "soft");
  const result = resolveWildsObstacleMotion({ x: 0, z: 0 }, { x: 1, z: 0 }, [stepable, soft], 0.38);

  assert.deepEqual(result.position, { x: 1, z: 0 });
  assert.deepEqual(result.blockedBy, []);
});

test("deep water and climb-grade rock require their named capabilities", () => {
  const deepWater = resolveWildsGroundMovement({ x: -94.42, z: -240 }, { x: -94, z: -240 }, { obstacles: [] });
  const swimming = resolveWildsGroundMovement({ x: -94.42, z: -240 }, { x: -94, z: -240 }, { obstacles: [], capabilities: ["swim"] });
  const steep = resolveWildsGroundMovement({ x: 79.58, z: 28 }, { x: 80, z: 28 }, { obstacles: [] });

  assert.deepEqual(deepWater.position, { x: -94.42, z: -240 });
  assert.equal(deepWater.traversalBlockedBy, "swim");
  assert.deepEqual(swimming.position, { x: -94, z: -240 });
  assert.deepEqual(steep.position, { x: 79.58, z: 28 });
  assert.equal(steep.traversalBlockedBy, "climb");
});

test("shallow water slows ordinary grounded movement", () => {
  const result = resolveWildsGroundMovement({ x: -102, z: -240 }, { x: -101.58, z: -240 }, { obstacles: [] });

  assert.equal(result.speedMultiplier, 0.65);
  assert.deepEqual(result.position, { x: -101.727, z: -240 });
});
