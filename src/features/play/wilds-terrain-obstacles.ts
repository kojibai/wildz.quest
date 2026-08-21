import { projectWildsBiome } from "./wilds-biome";
import { WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";
import {
  WILDS_TERRAIN_TILE_SIZE,
  WILDS_LANDMARK_BLEND_APRON,
  distanceToWildsMajorRoute,
  sampleWildsTerrain
} from "./wilds-terrain-authority";

export type WildsObstacleMaterial = "solid" | "stepable" | "soft" | "conditional";
export type WildsObstacleKind = "tree" | "rock";
export type WildsObstacleShape =
  | { kind: "cylinder"; radius: number; height: number }
  | { kind: "box"; halfX: number; halfY: number; halfZ: number };

export type WildsTerrainObstacle = {
  id: string;
  kind: WildsObstacleKind;
  material: WildsObstacleMaterial;
  position: { x: number; y: number; z: number };
  radius: number;
  shape: WildsObstacleShape;
  visualScale: number;
};

export type WildsObstacleIndex = {
  cellSize: number;
  cells: ReadonlyMap<string, readonly WildsTerrainObstacle[]>;
};

type CandidateKind = "tree" | "rock";

function hashUnit(seed: number, salt: number) {
  let value = Math.imul(seed ^ salt, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function candidatePosition(tileX: number, tileZ: number, seed: number, slot: number, kind: CandidateKind) {
  const salt = kind === "tree" ? 0x41c64e6d : 0x27d4eb2d;
  return {
    x: quantize(tileX * WILDS_TERRAIN_TILE_SIZE + 0.8 + hashUnit(seed, salt + slot * 11) * (WILDS_TERRAIN_TILE_SIZE - 1.6)),
    z: quantize(tileZ * WILDS_TERRAIN_TILE_SIZE + 0.8 + hashUnit(seed, salt + slot * 17 + 3) * (WILDS_TERRAIN_TILE_SIZE - 1.6))
  };
}

function candidateIsClear(x: number, z: number) {
  if (Math.hypot(x, z) < 15) return false;
  if (distanceToWildsMajorRoute(x, z) < 1.4) return false;
  if (WILDS_FLAGSHIP_LANDMARKS.some((landmark) => Math.hypot(x - landmark.position.x, z - landmark.position.z) < landmark.radius + WILDS_LANDMARK_BLEND_APRON)) return false;
  const terrain = sampleWildsTerrain(x, z);
  return terrain.slope <= 0.62 && terrain.surface !== "shallow-water" && terrain.surface !== "deep-water";
}

function obstacleForCandidate(tileX: number, tileZ: number, seed: number, slot: number, kind: CandidateKind): WildsTerrainObstacle | null {
  const position = candidatePosition(tileX, tileZ, seed, slot, kind);
  if (!candidateIsClear(position.x, position.z)) return null;
  const terrain = sampleWildsTerrain(position.x, position.z);
  if (kind === "tree") {
    const radius = quantize(0.34 + hashUnit(seed, 0x165667b1 + slot * 19) * 0.21);
    const height = quantize(2.5 + hashUnit(seed, 0x9e3779b9 + slot * 23) * 2);
    return {
      id: `wildz.terrain.v1:${tileX}:${tileZ}:tree:${slot}`,
      kind: "tree",
      material: "solid",
      position: { ...position, y: terrain.elevation },
      radius,
      shape: { kind: "cylinder", radius, height },
      visualScale: quantize(height / 3.6)
    };
  }
  const radius = quantize(0.22 + hashUnit(seed, 0x6d2b79f5 + slot * 29) * 0.4);
  const height = quantize(0.18 + radius * (0.7 + hashUnit(seed, 0x1b873593 + slot * 31) * 0.8));
  return {
    id: `wildz.terrain.v1:${tileX}:${tileZ}:rock:${slot}`,
    kind: "rock",
    material: radius >= 0.34 ? "solid" : "stepable",
    position: { ...position, y: terrain.elevation },
    radius,
    shape: { kind: "cylinder", radius, height },
    visualScale: quantize(radius / 0.38)
  };
}

export function projectWildsObstaclePlacement(obstacle: WildsTerrainObstacle) {
  const slot = Number(obstacle.id.split(":").at(-1));
  return {
    id: obstacle.id,
    kind: obstacle.kind,
    x: obstacle.position.x,
    z: obstacle.position.z,
    scale: obstacle.visualScale,
    variant: Number.isInteger(slot) ? Math.abs(slot) % 3 : 0
  };
}

export function wildsTerrainObstaclesForTile(tileX: number, tileZ: number): readonly WildsTerrainObstacle[] {
  const safeTileX = Number.isFinite(tileX) ? Math.trunc(tileX) : 0;
  const safeTileZ = Number.isFinite(tileZ) ? Math.trunc(tileZ) : 0;
  const biome = projectWildsBiome(safeTileX, safeTileZ, 0, 0);
  const obstacles: WildsTerrainObstacle[] = [];
  for (let slot = 0; slot < biome.ecology.treeCount; slot += 1) {
    const obstacle = obstacleForCandidate(safeTileX, safeTileZ, biome.seed, slot, "tree");
    if (obstacle) obstacles.push(obstacle);
  }
  for (let slot = 0; slot < biome.ecology.rockCount; slot += 1) {
    const obstacle = obstacleForCandidate(safeTileX, safeTileZ, biome.seed, slot, "rock");
    if (obstacle) obstacles.push(obstacle);
  }
  return obstacles.sort((left, right) => left.id.localeCompare(right.id));
}

function cellKey(x: number, z: number) {
  return `${x}:${z}`;
}

export function buildWildsObstacleIndex(obstacles: readonly WildsTerrainObstacle[], cellSize = WILDS_TERRAIN_TILE_SIZE): WildsObstacleIndex {
  if (!Number.isFinite(cellSize) || cellSize < 1 || cellSize > 128) throw new Error("wilds_obstacle_cell_size_invalid");
  const cells = new Map<string, WildsTerrainObstacle[]>();
  for (const obstacle of obstacles) {
    const minX = Math.floor((obstacle.position.x - obstacle.radius) / cellSize);
    const maxX = Math.floor((obstacle.position.x + obstacle.radius) / cellSize);
    const minZ = Math.floor((obstacle.position.z - obstacle.radius) / cellSize);
    const maxZ = Math.floor((obstacle.position.z + obstacle.radius) / cellSize);
    for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const key = cellKey(cellX, cellZ);
        const entries = cells.get(key) ?? [];
        entries.push(obstacle);
        cells.set(key, entries);
      }
    }
  }
  for (const entries of cells.values()) entries.sort((left, right) => left.id.localeCompare(right.id));
  return { cellSize, cells };
}

export function queryWildsObstacles(
  index: WildsObstacleIndex,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): readonly WildsTerrainObstacle[] {
  if (![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ].every(Number.isFinite)) return [];
  const minX = Math.min(bounds.minX, bounds.maxX);
  const maxX = Math.max(bounds.minX, bounds.maxX);
  const minZ = Math.min(bounds.minZ, bounds.maxZ);
  const maxZ = Math.max(bounds.minZ, bounds.maxZ);
  const firstCellX = Math.floor(minX / index.cellSize);
  const lastCellX = Math.floor(maxX / index.cellSize);
  const firstCellZ = Math.floor(minZ / index.cellSize);
  const lastCellZ = Math.floor(maxZ / index.cellSize);
  const found = new Map<string, WildsTerrainObstacle>();
  for (let cellZ = firstCellZ; cellZ <= lastCellZ; cellZ += 1) {
    for (let cellX = firstCellX; cellX <= lastCellX; cellX += 1) {
      for (const obstacle of index.cells.get(cellKey(cellX, cellZ)) ?? []) {
        if (obstacle.position.x + obstacle.radius < minX || obstacle.position.x - obstacle.radius > maxX) continue;
        if (obstacle.position.z + obstacle.radius < minZ || obstacle.position.z - obstacle.radius > maxZ) continue;
        found.set(obstacle.id, obstacle);
      }
    }
  }
  return [...found.values()].sort((left, right) => left.id.localeCompare(right.id));
}
