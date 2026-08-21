import {
  WILDS_TERRAIN_TILE_SIZE,
  sampleWildsTerrain,
  wildsTerrainElevation,
  type WildsTraversalRequirement
} from "./wilds-terrain-authority";
import {
  wildsTerrainObstaclesForTile,
  type WildsTerrainObstacle
} from "./wilds-terrain-obstacles";

type Point = Readonly<{ x: number; z: number }>;
type TraversalCapability = WildsTraversalRequirement["kind"];

export type WildsGroundMovementResult = {
  position: { x: number; z: number };
  elevation: number;
  surface: ReturnType<typeof sampleWildsTerrain>["surface"];
  speedMultiplier: number;
  traversalMode: "walk" | "wade" | "swim" | "climb" | "glide" | "flight";
  blockedBy: readonly string[];
  traversalBlockedBy: TraversalCapability | null;
};

const DEFAULT_CAPSULE_RADIUS = 0.38;
const SHALLOW_WATER_SPEED = 0.65;
const SWIM_SPEED = 0.48;
const CLIMB_SPEED = 0.42;
const CONTACT_EPSILON = 0.000001;
const MAX_COLLISION_PASSES = 4;
const MAX_CACHED_TILES = 64;
const obstacleTileCache = new Map<string, readonly WildsTerrainObstacle[]>();

function traversalModeFor(
  terrain: ReturnType<typeof sampleWildsTerrain>,
  capabilities: ReadonlySet<TraversalCapability>
): WildsGroundMovementResult["traversalMode"] {
  if (terrain.surface === "deep-water" && capabilities.has("swim")) return "swim";
  if (terrain.traversal.some((requirement) => requirement.kind === "climb") && capabilities.has("climb")) return "climb";
  if (terrain.surface === "shallow-water") return "wade";
  return "walk";
}

function speedForTraversalMode(mode: WildsGroundMovementResult["traversalMode"]) {
  if (mode === "wade") return SHALLOW_WATER_SPEED;
  if (mode === "swim") return SWIM_SPEED;
  if (mode === "climb") return CLIMB_SPEED;
  if (mode === "glide") return 1.1;
  if (mode === "flight") return 1.25;
  return 1;
}

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function finitePoint(point: Point) {
  return Number.isFinite(point.x) && Number.isFinite(point.z);
}

function blockingObstacle(obstacle: WildsTerrainObstacle) {
  return obstacle.material === "solid" || obstacle.material === "conditional";
}

function cachedTileObstacles(tileX: number, tileZ: number) {
  const key = `${tileX}:${tileZ}`;
  const cached = obstacleTileCache.get(key);
  if (cached) return cached;
  const obstacles = wildsTerrainObstaclesForTile(tileX, tileZ);
  obstacleTileCache.set(key, obstacles);
  while (obstacleTileCache.size > MAX_CACHED_TILES) {
    const oldest = obstacleTileCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    obstacleTileCache.delete(oldest);
  }
  return obstacles;
}

function movementObstacles(start: Point, target: Point, capsuleRadius: number) {
  const margin = capsuleRadius + 1;
  const firstTileX = Math.floor((Math.min(start.x, target.x) - margin) / WILDS_TERRAIN_TILE_SIZE);
  const lastTileX = Math.floor((Math.max(start.x, target.x) + margin) / WILDS_TERRAIN_TILE_SIZE);
  const firstTileZ = Math.floor((Math.min(start.z, target.z) - margin) / WILDS_TERRAIN_TILE_SIZE);
  const lastTileZ = Math.floor((Math.max(start.z, target.z) + margin) / WILDS_TERRAIN_TILE_SIZE);
  const obstacles: WildsTerrainObstacle[] = [];
  for (let tileZ = firstTileZ; tileZ <= lastTileZ; tileZ += 1) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      obstacles.push(...cachedTileObstacles(tileX, tileZ));
    }
  }
  return obstacles.sort((left, right) => left.id.localeCompare(right.id));
}

function pushOutsideObstacle(point: Point, obstacle: WildsTerrainObstacle, capsuleRadius: number, fallback: Point) {
  const radius = obstacle.radius + capsuleRadius;
  const offsetX = point.x - obstacle.position.x;
  const offsetZ = point.z - obstacle.position.z;
  const distance = Math.hypot(offsetX, offsetZ);
  if (distance >= radius) return { ...point };
  const fallbackLength = Math.hypot(fallback.x, fallback.z) || 1;
  const normalX = distance > CONTACT_EPSILON ? offsetX / distance : -fallback.x / fallbackLength;
  const normalZ = distance > CONTACT_EPSILON ? offsetZ / distance : -fallback.z / fallbackLength;
  return {
    x: obstacle.position.x + normalX * (radius + CONTACT_EPSILON),
    z: obstacle.position.z + normalZ * (radius + CONTACT_EPSILON)
  };
}

function firstSweepHit(start: Point, target: Point, obstacles: readonly WildsTerrainObstacle[], capsuleRadius: number) {
  const motionX = target.x - start.x;
  const motionZ = target.z - start.z;
  const motionLengthSquared = motionX * motionX + motionZ * motionZ;
  if (motionLengthSquared <= CONTACT_EPSILON) return null;
  let earliest: { obstacle: WildsTerrainObstacle; amount: number } | null = null;
  for (const obstacle of obstacles) {
    if (!blockingObstacle(obstacle)) continue;
    const radius = obstacle.radius + capsuleRadius;
    const offsetX = start.x - obstacle.position.x;
    const offsetZ = start.z - obstacle.position.z;
    const b = 2 * (offsetX * motionX + offsetZ * motionZ);
    const c = offsetX * offsetX + offsetZ * offsetZ - radius * radius;
    const discriminant = b * b - 4 * motionLengthSquared * c;
    if (discriminant < 0) continue;
    const amount = (-b - Math.sqrt(discriminant)) / (2 * motionLengthSquared);
    if (amount < 0 || amount > 1) continue;
    if (!earliest || amount < earliest.amount || (amount === earliest.amount && obstacle.id < earliest.obstacle.id)) {
      earliest = { obstacle, amount };
    }
  }
  return earliest;
}

export function resolveWildsObstacleMotion(
  start: Point,
  intended: Point,
  obstacles: readonly WildsTerrainObstacle[],
  capsuleRadius = DEFAULT_CAPSULE_RADIUS
) {
  if (!finitePoint(start) || !finitePoint(intended) || !Number.isFinite(capsuleRadius) || capsuleRadius <= 0) {
    throw new Error("wilds_ground_movement_invalid");
  }
  const ordered = [...obstacles].sort((left, right) => left.id.localeCompare(right.id));
  const blocked = new Set<string>();
  const initialMotion = { x: intended.x - start.x, z: intended.z - start.z };
  let current = { ...start };
  for (const obstacle of ordered) {
    if (!blockingObstacle(obstacle)) continue;
    const outside = pushOutsideObstacle(current, obstacle, capsuleRadius, initialMotion);
    if (outside.x !== current.x || outside.z !== current.z) {
      blocked.add(obstacle.id);
      current = outside;
    }
  }
  let target = { ...intended };

  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass += 1) {
    const hit = firstSweepHit(current, target, ordered, capsuleRadius);
    if (!hit) {
      current = target;
      break;
    }
    blocked.add(hit.obstacle.id);
    const motionX = target.x - current.x;
    const motionZ = target.z - current.z;
    const contact = {
      x: current.x + motionX * hit.amount,
      z: current.z + motionZ * hit.amount
    };
    const normalLength = Math.hypot(contact.x - hit.obstacle.position.x, contact.z - hit.obstacle.position.z) || 1;
    const normalX = (contact.x - hit.obstacle.position.x) / normalLength;
    const normalZ = (contact.z - hit.obstacle.position.z) / normalLength;
    const remainingX = motionX * (1 - hit.amount);
    const remainingZ = motionZ * (1 - hit.amount);
    const inward = Math.min(0, remainingX * normalX + remainingZ * normalZ);
    current = {
      x: contact.x + normalX * CONTACT_EPSILON,
      z: contact.z + normalZ * CONTACT_EPSILON
    };
    target = {
      x: current.x + remainingX - normalX * inward,
      z: current.z + remainingZ - normalZ * inward
    };
  }

  return {
    position: { x: quantize(current.x), z: quantize(current.z) },
    blockedBy: [...blocked].sort()
  };
}

export function resolveWildsGroundMovement(
  start: Point,
  intended: Point,
  options: {
    capsuleRadius?: number;
    capabilities?: readonly TraversalCapability[];
    aerialMode?: "glide" | "flight";
    obstacles?: readonly WildsTerrainObstacle[];
  } = {}
): WildsGroundMovementResult {
  if (!finitePoint(start) || !finitePoint(intended)) throw new Error("wilds_ground_movement_invalid");
  const capsuleRadius = options.capsuleRadius ?? DEFAULT_CAPSULE_RADIUS;
  const intendedTerrain = sampleWildsTerrain(intended.x, intended.z);
  const capabilities = new Set(options.capabilities ?? []);
  const intendedMode = options.aerialMode ?? traversalModeFor(intendedTerrain, capabilities);
  const speedMultiplier = speedForTraversalMode(intendedMode);
  const target = {
    x: quantize(start.x + (intended.x - start.x) * speedMultiplier),
    z: quantize(start.z + (intended.z - start.z) * speedMultiplier)
  };
  const targetTerrain = sampleWildsTerrain(target.x, target.z);
  const missingTraversal = intendedTerrain.traversal.find((requirement) => !capabilities.has(requirement.kind))?.kind
    ?? targetTerrain.traversal.find((requirement) => !capabilities.has(requirement.kind))?.kind
    ?? null;
  if (missingTraversal) {
    const startTerrain = sampleWildsTerrain(start.x, start.z);
    return {
      position: { ...start },
      elevation: wildsTerrainElevation(start.x, start.z),
      surface: startTerrain.surface,
      speedMultiplier,
      traversalMode: traversalModeFor(startTerrain, capabilities),
      blockedBy: [],
      traversalBlockedBy: missingTraversal
    };
  }
  const obstacles = options.obstacles ?? movementObstacles(start, target, capsuleRadius);
  const collision = resolveWildsObstacleMotion(start, target, obstacles, capsuleRadius);
  const resolvedTerrain = sampleWildsTerrain(collision.position.x, collision.position.z);
  const pushedIntoMissingTraversal = resolvedTerrain.traversal.find((requirement) => !capabilities.has(requirement.kind))?.kind ?? null;
  if (pushedIntoMissingTraversal) {
    const startTerrain = sampleWildsTerrain(start.x, start.z);
    return {
      position: { ...start },
      elevation: wildsTerrainElevation(start.x, start.z),
      surface: startTerrain.surface,
      speedMultiplier,
      traversalMode: traversalModeFor(startTerrain, capabilities),
      blockedBy: collision.blockedBy,
      traversalBlockedBy: pushedIntoMissingTraversal
    };
  }
  return {
    position: collision.position,
    elevation: resolvedTerrain.elevation,
    surface: resolvedTerrain.surface,
    speedMultiplier,
    traversalMode: intendedMode,
    blockedBy: collision.blockedBy,
    traversalBlockedBy: null
  };
}
