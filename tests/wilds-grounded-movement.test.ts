import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWildsAerialCollisionSample,
  createWildsAerialNeighborhoodDiagnostics,
  mergeWildsAerialCollisionSample,
  projectWildsAerialObstacleNeighborhood,
  resolveWildsRequiredLandingPosition,
  resolveWildsGroundMovement,
  resolveWildsObstacleMotion,
  resolveWildsSafeLandingPosition,
  writeWildsAerialCollisionSample
} from "../src/features/play/wilds-grounded-movement";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import {
  projectWildsRenderedLivingObstacles,
  WILDS_RENDERED_PHYSICAL_OBSTACLES,
  wildsObstacleBlocksVerticalBand,
  wildsTerrainObstaclesForTile,
  type WildsTerrainObstacle
} from "../src/features/play/wilds-terrain-obstacles";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";
import { createWildsVerticalTraversalState, writeWildsVerticalTraversalStep } from "../src/features/play/wilds-vertical-traversal";
import { beginWildsAerialTraversal, createGroundedWildsAerialState, createWildsAerialRuntimeResult, writeWildsAerialRuntimeStep } from "../src/features/play/wilds-aerial-traversal";
import { WILDS_BOSS_FAMILIES } from "../src/features/play/wilds-boss-ecology";
import { wildsBossPhysicalEnvelope } from "../src/features/play/wilds-boss-physical-envelope";
import { WILDS_SETTLEMENT_PHYSICAL_DIMENSIONS } from "../src/features/play/wilds-physical-dimensions";

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
  assert.equal(wildsObstacleBlocksVerticalBand(structure, 40, 1.55), false);
  assert.equal(wildsObstacleBlocksVerticalBand(structure, 23, 1.55), true);
});

test("aerial collision sampling writes exact canopy, ceiling, structure, and hazard constraints without replacement", () => {
  const tree = obstacle("tree:sample", 0, 0, .5);
  tree.position.y = 2;
  const ceiling = {
    ...obstacle("ceiling:sample", 0, 0, 1),
    kind: "ceiling" as const,
    position: { x: 0, y: 9, z: 0 },
    shape: { kind: "box" as const, halfX: 1, halfY: 1, halfZ: 1 },
    airbornePolicy: "persistent" as const
  };
  const hazard = {
    ...obstacle("hazard:sample", 0, 0, 1),
    kind: "aerial-hazard" as const,
    position: { x: 0, y: 5, z: 0 },
    shape: { kind: "box" as const, halfX: 1, halfY: .5, halfZ: 1 },
    airbornePolicy: "persistent" as const
  };
  const output = createWildsAerialCollisionSample();
  const returned = writeWildsAerialCollisionSample({ x: 0, z: 0 }, 4.5, [tree, ceiling, hazard], output);

  assert.equal(returned, output);
  assert.equal(output.obstacleTopY, 5);
  assert.equal(output.ceilingY, 8);
  assert.equal(output.protectedAirspace, true);
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

test("required landing never accepts an obstructed, stale, or inaccessible anchor", () => {
  const deepWater = { x: -94, z: -240 };
  const trunk = obstacle("tree:required-landing", 18, -24, 8);
  trunk.position.y = sampleWildsTerrain(18, -24).elevation;

  assert.equal(resolveWildsRequiredLandingPosition(deepWater, deepWater, {
    capabilities: [], obstacles: [], searchRadius: 0
  }), null);
  assert.equal(resolveWildsRequiredLandingPosition({ x: 18, z: -24 }, { x: Number.NaN, z: 0 }, {
    capabilities: [], obstacles: [trunk], searchRadius: 0
  }), null);
});

test("required landing refuses a live boss hazard and uses only a validated safe anchor", () => {
  const world = initialWildsWorldProjection();
  world.sites.site = {
    id: "site", familyId: "family", name: "Site", position: { x: 30, z: 31 }, radius: 4,
    phase: "engaged", spawnedAt: "2026-08-21T00:00:00.000Z", expiresAt: "2026-08-22T00:00:00.000Z",
    bossId: "boss", seedDigest: "a".repeat(64)
  };
  world.bosses.boss = {
    id: "boss", siteId: "site", familyId: "mirecrown-colossus", position: { x: 32, z: 33 },
    phase: "engaged", health: 10, maxHealth: 10, defeatedAt: null
  };
  const obstacles = projectWildsRenderedLivingObstacles(world);
  const safeAnchor = { x: 48, z: 48 };

  assert.deepEqual(resolveWildsRequiredLandingPosition({ x: 32, z: 33 }, safeAnchor, {
    capabilities: [], obstacles, searchRadius: 0
  }), safeAnchor);
  assert.equal(resolveWildsRequiredLandingPosition({ x: 32, z: 33 }, { x: 31, z: 32 }, {
    capabilities: [], obstacles, searchRadius: 0
  }), null);
});

test("production collision projection preserves the Trail Gate beam without sealing the open Arena sky", () => {
  const output = createWildsAerialCollisionSample();
  const gateTerrain = sampleWildsTerrain(72, 40).elevation;
  writeWildsAerialCollisionSample({ x: 80, z: 48 }, gateTerrain + .35, undefined, output);
  assert.ok(Number.isFinite(output.ceilingY));
  assert.ok(output.ceilingY > gateTerrain + 2);
  assert.equal(output.blockerId, "wildz.rendered.v1:wayfinder-hollow:trail-gate-beam");

  const arenaTerrain = sampleWildsTerrain(0, 0).elevation;
  writeWildsAerialCollisionSample({ x: 0, z: 0 }, arenaTerrain + 1, undefined, output);
  assert.equal(output.protectedAirspace, false);
  assert.equal(Number.isFinite(output.ceilingY), false);
  assert.equal(output.blockerId, null);

  const vertical = createWildsVerticalTraversalState();
  writeWildsVerticalTraversalStep(vertical, {
    deltaSeconds: 0,
    initialOffset: .35,
    intent: 0,
    layer: "air",
    liftPotential: .2,
    powered: true,
    stamina: 100,
    terrainElevation: arenaTerrain
  });
  for (let frame = 0; frame < 30; frame += 1) {
    writeWildsAerialCollisionSample({ x: 0, z: 0 }, vertical.worldY, undefined, output);
    writeWildsVerticalTraversalStep(vertical, {
      ceilingY: output.ceilingY,
      deltaSeconds: .1,
      intent: 0,
      layer: "air",
      liftPotential: .2,
      obstacleTopY: output.obstacleTopY,
      powered: true,
      stamina: 100,
      terrainElevation: arenaTerrain
    });
  }
  assert.equal(vertical.offset, 6);
});

test("production collision projection includes an active rendered living-world boss", () => {
  const world = initialWildsWorldProjection();
  world.sites.site = {
    id: "site", familyId: "family", name: "Site", position: { x: 30, z: 31 }, radius: 4,
    phase: "engaged", spawnedAt: "2026-08-21T00:00:00.000Z", expiresAt: "2026-08-22T00:00:00.000Z",
    bossId: "boss", seedDigest: "a".repeat(64)
  };
  world.bosses.boss = {
    id: "boss", siteId: "site", phase: "engaged", health: 10, maxHealth: 10, defeatedAt: null
  };
  const obstacles = projectWildsRenderedLivingObstacles(world);
  const terrain = sampleWildsTerrain(30, 31).elevation;
  const output = createWildsAerialCollisionSample();
  writeWildsAerialCollisionSample({ x: 30, z: 31 }, terrain + 1, obstacles, output);

  assert.equal(output.protectedAirspace, true);
  assert.ok(obstacles.some((entry) => entry.id === "wildz.rendered.v1:living-boss:boss"));
});

test("actual generated canopy projection blocks powered ascent until the actor leaves its footprint", () => {
  let tree: WildsTerrainObstacle | undefined;
  for (let z = -4; z <= 4 && !tree; z += 1) for (let x = -4; x <= 4 && !tree; x += 1) {
    tree = wildsTerrainObstaclesForTile(x, z).find((entry) => entry.kind === "tree");
  }
  assert.ok(tree);
  const neighborhood = projectWildsAerialObstacleNeighborhood(tree.position);
  const sample = createWildsAerialCollisionSample();
  writeWildsAerialCollisionSample(tree.position, tree.position.y + .35, undefined, sample, 1.55, .38, neighborhood.obstacles);
  const state = createWildsVerticalTraversalState();
  writeWildsVerticalTraversalStep(state, {
    deltaSeconds: .1, initialOffset: .35, intent: 1, layer: "air", liftPotential: 1,
    obstacleTopY: sample.obstacleTopY, powered: true, stamina: 100, terrainElevation: tree.position.y
  });
  assert.equal(state.offset, .35);
});

test("merges an interior ceiling overlap into the runtime landing block", () => {
  const outer = { obstacleTopY: Number.NaN, ceilingY: Number.NaN, protectedAirspace: false, blockerId: null as string | null };
  const site = { obstacleTopY: Number.NaN, ceilingY: 3.2, protectedAirspace: true, blockerId: "ceiling:test" };
  assert.equal(mergeWildsAerialCollisionSample(outer, site), outer);
  assert.equal(outer.ceilingY, 3.2);
  assert.equal(outer.protectedAirspace, true);

  const state = beginWildsAerialTraversal(createGroundedWildsAerialState({ x: 0, z: 0 }, 0), {
    kind: "flight",
    capabilities: ["flight"]
  }).state;
  const result = createWildsAerialRuntimeResult();
  writeWildsAerialRuntimeStep(state, {
    deltaSeconds: .1,
    groundElevation: 0,
    hasFlight: true,
    hasGlide: false,
    horizontalDistance: .2,
    positionX: 0,
    positionZ: 0,
    protectedAirspace: outer.protectedAirspace,
    verticalOffset: 2
  }, result);
  assert.equal(state.landingRequired, true);
  assert.equal(result.horizontalAllowed, false);
});

test("steady aerial frames consume one immutable neighborhood without tile projection or allocation work", () => {
  const diagnostics = createWildsAerialNeighborhoodDiagnostics();
  const neighborhood = projectWildsAerialObstacleNeighborhood({ x: 18, z: -24 }, diagnostics);
  const output = createWildsAerialCollisionSample();
  const before = { ...diagnostics };
  for (let frame = 0; frame < 300; frame += 1) {
    writeWildsAerialCollisionSample({ x: 18, z: -24 }, 4, undefined, output, 1.55, .38, neighborhood.obstacles, diagnostics);
  }
  assert.equal(diagnostics.neighborhoodProjectionBuilds, before.neighborhoodProjectionBuilds);
  assert.equal(diagnostics.terrainTileProjectionCalls, before.terrainTileProjectionCalls);
  assert.equal(diagnostics.frameWriterCalls, before.frameWriterCalls + 300);
  assert.ok(diagnostics.terrainObstacleIterations >= before.terrainObstacleIterations);

  projectWildsAerialObstacleNeighborhood({ x: 18 + 16, z: -24 }, diagnostics);
  assert.equal(diagnostics.neighborhoodProjectionBuilds, before.neighborhoodProjectionBuilds + 1);
  assert.equal(diagnostics.terrainTileProjectionCalls, before.terrainTileProjectionCalls + 9);
});

test("rendered Timber Hall roof and collision share one complete authored envelope", () => {
  const hall = WILDS_RENDERED_PHYSICAL_OBSTACLES.find((entry) => entry.id.endsWith(":timber-hall"));
  assert.ok(hall);
  const bounds = hall.shape.kind === "box"
    ? hall.position.y + hall.shape.halfY
    : hall.position.y + hall.shape.height;
  const base = sampleWildsTerrain(72, 40).elevation;
  assert.equal(bounds, base + WILDS_SETTLEMENT_PHYSICAL_DIMENSIONS.timberHall.topY);
  assert.ok(WILDS_SETTLEMENT_PHYSICAL_DIMENSIONS.timberHall.topY >= 3.72);
});

test("every rendered boss family and phase uses its shared scaled attachment envelope", () => {
  const phases = ["emerged", "contested", "engaged", "transforming", "vulnerable"] as const;
  for (const familyId of WILDS_BOSS_FAMILIES) for (const phase of phases) {
    const world = initialWildsWorldProjection();
    world.sites.site = {
      id: "site", familyId: "family", name: "Site", position: { x: 30, z: 31 }, radius: 4,
      phase: "engaged", spawnedAt: "2026-08-21T00:00:00.000Z", expiresAt: "2026-08-22T00:00:00.000Z",
      bossId: "boss", seedDigest: "a".repeat(64)
    };
    world.bosses.boss = {
      id: "boss", siteId: "site", familyId, position: { x: 32, z: 33 }, phase,
      health: 10, maxHealth: 10, defeatedAt: null
    };
    const boss = projectWildsRenderedLivingObstacles(world).find((entry) => entry.id === "wildz.rendered.v1:living-boss:boss");
    assert.ok(boss);
    const envelope = wildsBossPhysicalEnvelope(familyId, phase);
    const base = sampleWildsTerrain(32, 33).elevation;
    assert.equal(boss.position.x, 32);
    assert.equal(boss.position.z, 33);
    assert.equal(boss.radius, envelope.radius);
    assert.equal(boss.position.y + (boss.shape.kind === "cylinder" ? boss.shape.height : boss.shape.halfY), base + envelope.topY);
  }
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

test("canonical absolute world height overrides stale terrain-relative clearance during horizontal travel", () => {
  const start = { x: 79.58, z: 28 };
  const intended = { x: 80, z: 28 };
  const startElevation = sampleWildsTerrain(start.x, start.z).elevation;
  const result = resolveWildsGroundMovement(start, intended, {
    aerialMode: "flight",
    capabilities: ["flight", "climb"],
    obstacles: [],
    verticalClearance: .35,
    verticalWorldY: startElevation + 8
  });

  assert.notDeepEqual(result.position, start);
});

test("admitted flight crosses traversal surfaces without inventing swim or climb capabilities", () => {
  const start = { x: -94.42, z: -240 };
  const result = resolveWildsGroundMovement(start, { x: -94, z: -240 }, {
    aerialMode: "flight",
    capabilities: ["flight"],
    obstacles: [],
    verticalWorldY: sampleWildsTerrain(start.x, start.z).elevation + 4
  });

  assert.notDeepEqual(result.position, start);
  assert.equal(result.traversalMode, "flight");
  assert.equal(result.traversalBlockedBy, null);
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
