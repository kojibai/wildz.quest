import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveWildsGroundMovement,
  resolveWildsObstacleMotion,
  resolveWildsSafeLandingPosition
} from "../src/features/play/wilds-grounded-movement";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import {
  wildsObstacleBlocksVerticalBand,
  type WildsTerrainObstacle
} from "../src/features/play/wilds-terrain-obstacles";

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

test("actual airborne clearance passes above trees and small rocks only after clearing their tops", () => {
  const trunk = obstacle("tree:clearance", 1, 0, .34);
  trunk.position.y = sampleWildsTerrain(0, 0).elevation;
  const low = resolveWildsGroundMovement({ x: 0, z: 0 }, { x: 1.4, z: 0 }, {
    aerialMode: "flight", capabilities: ["flight"], obstacles: [trunk], verticalClearance: 2.9
  });
  const high = resolveWildsGroundMovement({ x: 0, z: 0 }, { x: 1.4, z: 0 }, {
    aerialMode: "flight", capabilities: ["flight"], obstacles: [trunk], verticalClearance: 3.5
  });

  assert.deepEqual(low.blockedBy, [trunk.id]);
  assert.deepEqual(high.position, { x: 1.75, z: 0 });
  assert.deepEqual(high.blockedBy, []);
});

test("vertical collision uses absolute world spans and keeps structures, ceilings, and aerial hazards physical", () => {
  const structure = {
    ...obstacle("structure:absolute", 1, 0, .8),
    airbornePolicy: "persistent" as const,
    kind: "structure" as const,
    position: { x: 1, y: 24, z: 0 },
    shape: { kind: "box" as const, halfX: .8, halfY: 2, halfZ: .8 }
  };
  const clearable = { ...structure, id: "tree:absolute", kind: "tree" as const, airbornePolicy: "clearable" as const };

  assert.equal(wildsObstacleBlocksVerticalBand(clearable, 20, 1.55), false);
  assert.equal(wildsObstacleBlocksVerticalBand(clearable, 23, 1.55), true);
  assert.equal(wildsObstacleBlocksVerticalBand(structure, 40, 1.55), true);
});

test("landing deterministically finds clear terrain and refuses inaccessible deep water", () => {
  const requested = { x: 18, z: -24 };
  const trunk = obstacle("tree:landing", requested.x, requested.z, .8);
  trunk.position.y = sampleWildsTerrain(requested.x, requested.z).elevation;
  const first = resolveWildsSafeLandingPosition(requested, { capabilities: [], obstacles: [trunk] });
  const replay = resolveWildsSafeLandingPosition(requested, { capabilities: [], obstacles: [trunk] });
  const deepWater = resolveWildsSafeLandingPosition({ x: -94, z: -240 }, {
    capabilities: [], obstacles: [], searchRadius: 0
  });
  const swimmer = resolveWildsSafeLandingPosition({ x: -94, z: -240 }, {
    capabilities: ["swim"], obstacles: [], searchRadius: 0
  });

  assert.ok(first);
  assert.notDeepEqual(first, requested);
  assert.deepEqual(first, replay);
  assert.equal(deepWater, null);
  assert.deepEqual(swimmer, { x: -94, z: -240 });
});

test("airborne movement cannot cross terrain higher than its actual world altitude", () => {
  const start = { x: 79.58, z: 28 };
  const intended = { x: 80, z: 28 };
  const low = resolveWildsGroundMovement(start, intended, {
    aerialMode: "flight", capabilities: ["flight", "climb"], obstacles: [], verticalClearance: .35
  });
  const high = resolveWildsGroundMovement(start, intended, {
    aerialMode: "flight", capabilities: ["flight", "climb"], obstacles: [], verticalClearance: 8
  });

  assert.deepEqual(low.position, start);
  assert.equal(low.traversalBlockedBy, "climb");
  assert.notDeepEqual(high.position, start);
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
  assert.deepEqual(swimming.position, { x: -94.2184, z: -240 });
  assert.equal(swimming.traversalMode, "swim");
  assert.equal(swimming.speedMultiplier, 0.48);
  assert.deepEqual(steep.position, { x: 79.58, z: 28 });
  assert.equal(steep.traversalBlockedBy, "climb");
});

test("shallow water slows ordinary grounded movement", () => {
  const result = resolveWildsGroundMovement({ x: -102, z: -240 }, { x: -101.58, z: -240 }, { obstacles: [] });

  assert.equal(result.speedMultiplier, 0.65);
  assert.equal(result.traversalMode, "wade");
  assert.deepEqual(result.position, { x: -101.727, z: -240 });
});

test("declared climb traversal is slower and exits safely without a retained capability", () => {
  const climbing = resolveWildsGroundMovement(
    { x: 79.58, z: 28 },
    { x: 80, z: 28 },
    { obstacles: [], capabilities: ["climb"] }
  );
  const exit = resolveWildsGroundMovement(
    { x: 80, z: 28 },
    { x: 79.58, z: 28 },
    { obstacles: [], capabilities: [] }
  );

  assert.equal(climbing.traversalMode, "climb");
  assert.equal(climbing.speedMultiplier, 0.42);
  assert.deepEqual(climbing.position, { x: 79.7564, z: 28 });
  assert.equal(exit.traversalBlockedBy, null);
  assert.ok(exit.position.x < 80);
});
