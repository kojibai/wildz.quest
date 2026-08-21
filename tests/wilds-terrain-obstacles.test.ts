import assert from "node:assert/strict";
import { test } from "node:test";
import { WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks";
import { distanceToWildsMajorRoute, WILDS_TERRAIN_TILE_SIZE } from "../src/features/play/wilds-terrain-authority";
import { WILDS_MAJOR_ROUTES } from "../src/features/play/wilds-world-geography";
import {
  buildWildsObstacleIndex,
  queryWildsObstacles,
  wildsTerrainObstaclesForTile,
  type WildsTerrainObstacle
} from "../src/features/play/wilds-terrain-obstacles";

function obstacle(id: string, x: number, z: number, radius: number): WildsTerrainObstacle {
  return {
    id,
    material: "solid",
    position: { x, y: 0, z },
    radius,
    shape: { kind: "cylinder", radius, height: 3 }
  };
}

test("physical obstacles are deterministic stable records", () => {
  const first = [
    ...wildsTerrainObstaclesForTile(20, 20),
    ...wildsTerrainObstaclesForTile(21, 20),
    ...wildsTerrainObstaclesForTile(20, 21)
  ];
  const replay = [
    ...wildsTerrainObstaclesForTile(20, 20),
    ...wildsTerrainObstaclesForTile(21, 20),
    ...wildsTerrainObstaclesForTile(20, 21)
  ];

  assert.ok(first.length > 0);
  assert.deepEqual(first, replay);
  assert.equal(new Set(first.map((candidate) => candidate.id)).size, first.length);
  assert.ok(first.every((candidate) => candidate.material === "solid" || candidate.material === "stepable"));
});

test("arrival, routes, and landmark aprons contain no generated solid obstacle", () => {
  const anchors = [
    { x: 0, z: 0 },
    ...WILDS_FLAGSHIP_LANDMARKS.map((landmark) => landmark.position),
    ...WILDS_MAJOR_ROUTES.flatMap((route) => route.points)
  ];
  const tileKeys = new Set<string>();
  for (const anchor of anchors) {
    const centerX = Math.floor(anchor.x / WILDS_TERRAIN_TILE_SIZE);
    const centerZ = Math.floor(anchor.z / WILDS_TERRAIN_TILE_SIZE);
    for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) tileKeys.add(`${centerX + dx}:${centerZ + dz}`);
  }
  const obstacles = [...tileKeys].flatMap((key) => {
    const [tileX, tileZ] = key.split(":").map(Number) as [number, number];
    return wildsTerrainObstaclesForTile(tileX, tileZ);
  });

  assert.equal(obstacles.some((candidate) => Math.hypot(candidate.position.x, candidate.position.z) < 15), false);
  assert.equal(obstacles.some((candidate) => distanceToWildsMajorRoute(candidate.position.x, candidate.position.z) < 1.4), false);
  assert.equal(obstacles.some((candidate) => WILDS_FLAGSHIP_LANDMARKS.some((landmark) => (
    Math.hypot(candidate.position.x - landmark.position.x, candidate.position.z - landmark.position.z) < landmark.radius + 4
  ))), false);
});

test("spatial queries return only intersecting records in stable id order", () => {
  const index = buildWildsObstacleIndex([
    obstacle("tree:b", 4, 4, 0.8),
    obstacle("tree:a", 2, 2, 0.5),
    obstacle("tree:outside", 20, 20, 1)
  ]);
  const result = queryWildsObstacles(index, { minX: 1, maxX: 5, minZ: 1, maxZ: 5 });

  assert.deepEqual(result.map((candidate) => candidate.id), ["tree:a", "tree:b"]);
});
