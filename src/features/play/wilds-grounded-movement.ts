import {
  WILDS_TERRAIN_TILE_SIZE,
  sampleWildsTerrain,
  wildsTerrainElevation,
  type WildsTraversalRequirement
} from "./wilds-terrain-authority";
import {
  buildWildsObstacleIndex,
  queryWildsObstacles,
  wildsObstacleBlocksVerticalBand,
  wildsObstacleVerticalBounds,
  WILDS_RENDERED_PHYSICAL_OBSTACLES,
  wildsTerrainObstaclesForTile,
  type WildsTerrainObstacle
} from "./wilds-terrain-obstacles";
import { wildsStructureSupportAt, type WildsStructureSupport } from "./wilds-structure-support";

type Point = Readonly<{ x: number; z: number }>;
const livingObstacleIndexes = new WeakMap<readonly WildsTerrainObstacle[], ReturnType<typeof buildWildsObstacleIndex>>();

/** Arrays are immutable world projections; a new world snapshot gets a new index. */
export function nearbyWildsMovementObstacles(obstacles: readonly WildsTerrainObstacle[], start: Point, target: Point, radius: number) {
  if (obstacles.length < 64) return obstacles;
  const travel = Math.hypot(target.x - start.x, target.z - start.z);
  if (!Number.isFinite(travel) || travel > 128) return obstacles;
  let index = livingObstacleIndexes.get(obstacles);
  if (!index) {
    index = buildWildsObstacleIndex(obstacles);
    livingObstacleIndexes.set(obstacles, index);
  }
  // Sliding cannot increase remaining travel. Include a generous contact margin.
  const reach = travel * 2 + radius + .1;
  const nearby = queryWildsObstacles(index, { minX: start.x - reach, maxX: start.x + reach, minZ: start.z - reach, maxZ: start.z + reach });
  // Starting inside geometry can cause chained push-outs beyond the swept area.
  if (nearby.some(obstacle => Math.hypot(start.x - obstacle.position.x, start.z - obstacle.position.z) <= obstacle.radius + radius)) return obstacles;
  return nearby;
}
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

export type WildsAerialCollisionSample = {
  obstacleTopY: number;
  ceilingY: number;
  protectedAirspace: boolean;
  blockerId: string | null;
};

export type WildsAerialObstacleNeighborhood = Readonly<{
  tileX: number;
  tileZ: number;
  obstacles: readonly WildsTerrainObstacle[];
}>;

export type WildsAerialNeighborhoodDiagnostics = {
  neighborhoodProjectionBuilds: number;
  terrainTileProjectionCalls: number;
  frameWriterCalls: number;
  terrainObstacleIterations: number;
};

export function createWildsAerialNeighborhoodDiagnostics(): WildsAerialNeighborhoodDiagnostics {
  return { neighborhoodProjectionBuilds: 0, terrainTileProjectionCalls: 0, frameWriterCalls: 0, terrainObstacleIterations: 0 };
}

function projectAerialTerrainTile(tileX: number, tileZ: number, diagnostics?: WildsAerialNeighborhoodDiagnostics) {
  if (diagnostics) diagnostics.terrainTileProjectionCalls += 1;
  return wildsTerrainObstaclesForTile(tileX, tileZ);
}

export function projectWildsAerialObstacleNeighborhood(
  point: Point,
  diagnostics?: WildsAerialNeighborhoodDiagnostics
): WildsAerialObstacleNeighborhood {
  if (!finitePoint(point)) throw new Error("wilds_aerial_neighborhood_invalid");
  const tileX = Math.floor(point.x / WILDS_TERRAIN_TILE_SIZE);
  const tileZ = Math.floor(point.z / WILDS_TERRAIN_TILE_SIZE);
  const obstacles: WildsTerrainObstacle[] = [];
  if (diagnostics) diagnostics.neighborhoodProjectionBuilds += 1;
  for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      obstacles.push(...projectAerialTerrainTile(tileX + offsetX, tileZ + offsetZ, diagnostics));
    }
  }
  return Object.freeze({ tileX, tileZ, obstacles: Object.freeze(obstacles) });
}

export function createWildsAerialCollisionSample(): WildsAerialCollisionSample {
  return { obstacleTopY: Number.NaN, ceilingY: Number.NaN, protectedAirspace: false, blockerId: null };
}

export function mergeWildsAerialCollisionSample(
  output: WildsAerialCollisionSample,
  input: Readonly<WildsAerialCollisionSample>
) {
  if (Number.isFinite(input.obstacleTopY) && (!Number.isFinite(output.obstacleTopY) || input.obstacleTopY > output.obstacleTopY)) { output.obstacleTopY = input.obstacleTopY; output.blockerId = input.blockerId; }
  if (Number.isFinite(input.ceilingY) && (!Number.isFinite(output.ceilingY) || input.ceilingY < output.ceilingY)) { output.ceilingY = input.ceilingY; output.blockerId = input.blockerId; }
  if (input.protectedAirspace) { output.protectedAirspace = true; output.blockerId = input.blockerId; }
  return output;
}

function writeObstacleConstraint(
  point: Point,
  footY: number,
  actorHeight: number,
  capsuleRadius: number,
  obstacle: WildsTerrainObstacle,
  output: WildsAerialCollisionSample
) {
  if (!blockingObstacle(obstacle)) return;
  if (Math.hypot(point.x - obstacle.position.x, point.z - obstacle.position.z) > obstacle.radius + capsuleRadius) return;
  const minimum = obstacle.shape.kind === "box"
    ? obstacle.position.y - obstacle.shape.halfY
    : obstacle.position.y;
  const maximum = obstacle.shape.kind === "box"
    ? obstacle.position.y + obstacle.shape.halfY
    : obstacle.position.y + obstacle.shape.height;
  const headY = footY + actorHeight;
  const intersects = footY <= maximum + CONTACT_EPSILON && headY >= minimum - CONTACT_EPSILON;
  if (obstacle.kind === "aerial-hazard" && intersects) { output.protectedAirspace = true; output.blockerId = obstacle.id; }
  if (obstacle.kind === "ceiling" || (obstacle.kind === "structure" && headY <= minimum + CONTACT_EPSILON)) {
    if (!Number.isFinite(output.ceilingY) || minimum < output.ceilingY) { output.ceilingY = minimum; output.blockerId = obstacle.id; }
    return;
  }
  if (obstacle.kind === "structure" && footY < maximum - CONTACT_EPSILON) {
    if (!Number.isFinite(output.ceilingY) || minimum < output.ceilingY) { output.ceilingY = minimum; output.blockerId = obstacle.id; }
    return;
  }
  if (obstacle.kind === "aerial-hazard") return;
  if (!Number.isFinite(output.obstacleTopY) || maximum > output.obstacleTopY) { output.obstacleTopY = maximum; output.blockerId = obstacle.id; }
}

export function writeWildsAerialCollisionSample(
  point: Point,
  footY: number,
  obstacles: readonly WildsTerrainObstacle[] | undefined,
  output: WildsAerialCollisionSample,
  actorHeight = 1.55,
  capsuleRadius = DEFAULT_CAPSULE_RADIUS,
  terrainObstacles: readonly WildsTerrainObstacle[] = EMPTY_AERIAL_OBSTACLES,
  diagnostics?: WildsAerialNeighborhoodDiagnostics
) {
  if (!finitePoint(point) || !Number.isFinite(footY) || !Number.isFinite(actorHeight) || actorHeight <= 0) {
    throw new Error("wilds_aerial_collision_sample_invalid");
  }
  output.obstacleTopY = Number.NaN;
  output.ceilingY = Number.NaN;
  output.protectedAirspace = false;
  output.blockerId = null;
  if (diagnostics) diagnostics.frameWriterCalls += 1;
  for (let index = 0; index < WILDS_RENDERED_PHYSICAL_OBSTACLES.length; index += 1) {
    writeObstacleConstraint(point, footY, actorHeight, capsuleRadius, WILDS_RENDERED_PHYSICAL_OBSTACLES[index]!, output);
  }
  if (obstacles) {
    for (let index = 0; index < obstacles.length; index += 1) {
      writeObstacleConstraint(point, footY, actorHeight, capsuleRadius, obstacles[index]!, output);
    }
  }
  for (let index = 0; index < terrainObstacles.length; index += 1) {
    if (diagnostics) diagnostics.terrainObstacleIterations += 1;
    writeObstacleConstraint(point, footY, actorHeight, capsuleRadius, terrainObstacles[index]!, output);
  }
  return output;
}

/** Per-actor single-entry cache. Obstacle arrays are immutable world projections.
 * Copy into the caller's output because later site collision merges mutate it.
 */
export function createWildsAerialCollisionSampler() {
  let previous: { x: number; z: number; footY: number; height: number; radius: number;
    obstacles: readonly WildsTerrainObstacle[] | undefined; terrain: readonly WildsTerrainObstacle[] } | undefined;
  const cached = createWildsAerialCollisionSample();
  return (point: Point, footY: number, obstacles: readonly WildsTerrainObstacle[] | undefined,
    output: WildsAerialCollisionSample, height = 1.55, radius = DEFAULT_CAPSULE_RADIUS,
    terrain: readonly WildsTerrainObstacle[] = EMPTY_AERIAL_OBSTACLES, diagnostics?: WildsAerialNeighborhoodDiagnostics) => {
    if (!previous || previous.x !== point.x || previous.z !== point.z || previous.footY !== footY
      || previous.height !== height || previous.radius !== radius || previous.obstacles !== obstacles || previous.terrain !== terrain) {
      writeWildsAerialCollisionSample(point, footY, obstacles, cached, height, radius, terrain, diagnostics);
      previous = { x: point.x, z: point.z, footY, height, radius, obstacles, terrain };
    }
    output.obstacleTopY = cached.obstacleTopY;
    output.ceilingY = cached.ceilingY;
    output.protectedAirspace = cached.protectedAirspace;
    output.blockerId = cached.blockerId;
    return output;
  };
}

export function wildsObstacleTopAtPosition(point: Point, capsuleRadius = DEFAULT_CAPSULE_RADIUS) {
  if (!finitePoint(point)) return null;
  const tileX = Math.floor(point.x / WILDS_TERRAIN_TILE_SIZE);
  const tileZ = Math.floor(point.z / WILDS_TERRAIN_TILE_SIZE);
  let top: number | null = null;
  for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const obstacles = cachedTileObstacles(tileX + offsetX, tileZ + offsetZ);
      for (let index = 0; index < obstacles.length; index += 1) {
        const obstacle = obstacles[index]!;
        if (!blockingObstacle(obstacle)) continue;
        const distance = Math.hypot(point.x - obstacle.position.x, point.z - obstacle.position.z);
        if (distance > obstacle.radius + capsuleRadius) continue;
        const maximum = wildsObstacleVerticalBounds(obstacle).maximum;
        if (top === null || maximum > top) top = maximum;
      }
    }
  }
  return top;
}

const DEFAULT_CAPSULE_RADIUS = 0.38;
const SHALLOW_WATER_SPEED = 0.65;
const SWIM_SPEED = 0.48;
const CLIMB_SPEED = 0.42;
const CONTACT_EPSILON = 0.000001;
const MAX_COLLISION_PASSES = 4;
const MAX_CACHED_TILES = 64;
const EMPTY_AERIAL_OBSTACLES: readonly WildsTerrainObstacle[] = Object.freeze([]);
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
  for (let index = 0; index < WILDS_RENDERED_PHYSICAL_OBSTACLES.length; index += 1) {
    const obstacle = WILDS_RENDERED_PHYSICAL_OBSTACLES[index]!;
    if (obstacle.kind === "aerial-hazard" || obstacle.kind === "ceiling") continue;
    const reach = obstacle.radius + margin;
    const centerX = (start.x + target.x) * .5;
    const centerZ = (start.z + target.z) * .5;
    const segmentReach = Math.hypot(target.x - start.x, target.z - start.z) * .5;
    if (Math.hypot(obstacle.position.x - centerX, obstacle.position.z - centerZ) <= reach + segmentReach) obstacles.push(obstacle);
  }
  for (let tileZ = firstTileZ; tileZ <= lastTileZ; tileZ += 1) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      obstacles.push(...cachedTileObstacles(tileX, tileZ));
    }
  }
  return obstacles.sort((left, right) => left.id.localeCompare(right.id));
}

function pushOutsideObstacle(point: Point, obstacle: WildsTerrainObstacle, capsuleRadius: number, fallback: Point) {
  if (obstacle.id.startsWith("wildz.component:") && obstacle.shape.kind === "box") {
    const dx = point.x - obstacle.position.x, dz = point.z - obstacle.position.z;
    const halfX = obstacle.shape.halfX + capsuleRadius, halfZ = obstacle.shape.halfZ + capsuleRadius;
    if (Math.abs(dx) >= halfX || Math.abs(dz) >= halfZ) return { ...point };
    return halfX - Math.abs(dx) < halfZ - Math.abs(dz)
      ? { x: obstacle.position.x + (dx >= 0 ? 1 : -1) * (halfX + CONTACT_EPSILON), z: point.z }
      : { x: point.x, z: obstacle.position.z + (dz >= 0 ? 1 : -1) * (halfZ + CONTACT_EPSILON) };
  }
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
  let earliest: { obstacle: WildsTerrainObstacle; amount: number; normal?: Point } | null = null;
  for (const obstacle of obstacles) {
    if (!blockingObstacle(obstacle)) continue;
    if (obstacle.id.startsWith("wildz.component:") && obstacle.shape.kind === "box") {
      let enter = Number.NEGATIVE_INFINITY, leave = Number.POSITIVE_INFINITY;
      let normal: Point = { x: 0, z: 0 };
      for (const axis of ["x", "z"] as const) {
        const delta = axis === "x" ? motionX : motionZ;
        const half = (axis === "x" ? obstacle.shape.halfX : obstacle.shape.halfZ) + capsuleRadius;
        const low = obstacle.position[axis] - half, high = obstacle.position[axis] + half;
        if (Math.abs(delta) < CONTACT_EPSILON) {
          if (start[axis] < low || start[axis] > high) { leave = Number.NEGATIVE_INFINITY; break; }
          continue;
        }
        const first = (low - start[axis]) / delta, second = (high - start[axis]) / delta;
        const near = Math.min(first, second), far = Math.max(first, second);
        if (near > enter) { enter = near; normal = axis === "x" ? { x: delta > 0 ? -1 : 1, z: 0 } : { x: 0, z: delta > 0 ? -1 : 1 }; }
        leave = Math.min(leave, far);
      }
      if (enter <= leave && enter >= 0 && enter <= 1 && (!earliest || enter < earliest.amount || (enter === earliest.amount && obstacle.id < earliest.obstacle.id))) earliest = { obstacle, amount: enter, normal };
      continue;
    }
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
    const normalX = hit.normal?.x ?? (contact.x - hit.obstacle.position.x) / normalLength;
    const normalZ = hit.normal?.z ?? (contact.z - hit.obstacle.position.z) / normalLength;
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
    verticalClearance?: number;
    verticalWorldY?: number;
    obstacles?: readonly WildsTerrainObstacle[];
    additionalObstacles?: readonly WildsTerrainObstacle[];
    structureSupports?: readonly WildsStructureSupport[];
  } = {}
): WildsGroundMovementResult {
  if (!finitePoint(start) || !finitePoint(intended)) throw new Error("wilds_ground_movement_invalid");
  const capsuleRadius = options.capsuleRadius ?? DEFAULT_CAPSULE_RADIUS;
  const startTerrain = sampleWildsTerrain(start.x, start.z);
  const intendedTerrain = sampleWildsTerrain(intended.x, intended.z);
  const capabilities = new Set(options.capabilities ?? []);
  const footY = Number.isFinite(options.verticalWorldY) ? options.verticalWorldY! : startTerrain.elevation;
  const intendedSupport = wildsStructureSupportAt(intended, options.structureSupports, capsuleRadius, footY);
  const intendedMode = options.aerialMode ?? (intendedSupport ? "walk" : traversalModeFor(intendedTerrain, capabilities));
  const speedMultiplier = speedForTraversalMode(intendedMode);
  const target = {
    x: quantize(start.x + (intended.x - start.x) * speedMultiplier),
    z: quantize(start.z + (intended.z - start.z) * speedMultiplier)
  };
  const targetTerrain = sampleWildsTerrain(target.x, target.z);
  const targetSupport = wildsStructureSupportAt(target, options.structureSupports, capsuleRadius, footY);
  const airborneClearance = options.aerialMode
    ? Math.max(0, Number.isFinite(options.verticalWorldY)
      ? options.verticalWorldY! - startTerrain.elevation
      : Number.isFinite(options.verticalClearance)
        ? options.verticalClearance!
        : .35)
    : null;
  if (airborneClearance !== null) {
    const worldFootY = startTerrain.elevation + airborneClearance;
    const distance = Math.hypot(target.x - start.x, target.z - start.z);
    const steps = Math.max(1, Math.ceil(distance / .2));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      const elevation = wildsTerrainElevation(
        start.x + (target.x - start.x) * amount,
        start.z + (target.z - start.z) * amount
      );
      if (elevation + .35 <= worldFootY + CONTACT_EPSILON) continue;
      return {
        position: { ...start },
        elevation: startTerrain.elevation,
        surface: startTerrain.surface,
        speedMultiplier,
        traversalMode: intendedMode,
        blockedBy: [],
        traversalBlockedBy: "climb"
      };
    }
    if (airborneClearance < 2.5 && targetTerrain.traversal.some((requirement) => requirement.kind === "climb")) {
      return {
        position: { ...start },
        elevation: startTerrain.elevation,
        surface: startTerrain.surface,
        speedMultiplier,
        traversalMode: intendedMode,
        blockedBy: [],
        traversalBlockedBy: "climb"
      };
    }
  }
  const missingTraversal = airborneClearance !== null
    ? null
    : (intendedSupport ? null : intendedTerrain.traversal.find((requirement) => !capabilities.has(requirement.kind))?.kind)
      ?? (targetSupport ? null : targetTerrain.traversal.find((requirement) => !capabilities.has(requirement.kind))?.kind)
      ?? null;
  if (missingTraversal) {
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
  const terrainObstacles = options.obstacles ? [] : movementObstacles(start, target, capsuleRadius);
  const terrainOverlap = terrainObstacles.some(obstacle => Math.hypot(start.x - obstacle.position.x, start.z - obstacle.position.z) <= obstacle.radius + capsuleRadius);
  const additional = options.additionalObstacles ?? [];
  const allObstacles = options.obstacles
    ? nearbyWildsMovementObstacles(options.obstacles, start, target, capsuleRadius)
    : [...terrainObstacles, ...(terrainOverlap ? additional : nearbyWildsMovementObstacles(additional, start, target, capsuleRadius))];
  // A capsule meets the slab edge before its centre enters the support area.
  // Read the leading foot contact so a reachable floor does not act like a wall.
  const travel = Math.hypot(target.x - start.x, target.z - start.z);
  const leadingSupport = travel > 0 ? wildsStructureSupportAt({
    x: target.x + (target.x - start.x) / travel * (capsuleRadius + .02),
    z: target.z + (target.z - start.z) / travel * (capsuleRadius + .02)
  }, options.structureSupports, 0, footY) : null;
  const collisionSupport = targetSupport ?? leadingSupport;
  const obstacles = airborneClearance === null
    ? allObstacles.filter(obstacle => !obstacle.id.startsWith("wildz.component:") || (
      wildsObstacleVerticalBounds(obstacle).maximum > (collisionSupport?.deckY ?? footY) + .001
      && wildsObstacleBlocksVerticalBand(obstacle, collisionSupport?.deckY ?? footY)
    ))
    : allObstacles.filter((obstacle) => wildsObstacleBlocksVerticalBand(
      obstacle,
      startTerrain.elevation + airborneClearance
    ));
  const collision = resolveWildsObstacleMotion(start, target, obstacles, capsuleRadius);
  const resolvedTerrain = sampleWildsTerrain(collision.position.x, collision.position.z);
  const resolvedSupport = wildsStructureSupportAt(collision.position, options.structureSupports, 0, footY);
  const pushedIntoMissingTraversal = airborneClearance !== null
    ? null
    : resolvedSupport ? null : resolvedTerrain.traversal.find((requirement) => !capabilities.has(requirement.kind))?.kind ?? null;
  if (pushedIntoMissingTraversal) {
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
    elevation: resolvedSupport?.deckY ?? resolvedTerrain.elevation,
    surface: resolvedSupport ? "trail" : resolvedTerrain.surface,
    speedMultiplier,
    traversalMode: resolvedSupport ? "walk" : intendedMode,
    blockedBy: collision.blockedBy,
    traversalBlockedBy: null
  };
}

export function resolveWildsSafeLandingPosition(
  requested: Point,
  options: {
    capsuleRadius?: number;
    capabilities?: readonly TraversalCapability[];
    obstacles?: readonly WildsTerrainObstacle[];
    searchRadius?: number;
  } = {}
) {
  if (!finitePoint(requested)) throw new Error("wilds_landing_position_invalid");
  const capsuleRadius = options.capsuleRadius ?? DEFAULT_CAPSULE_RADIUS;
  const searchRadius = Math.max(0, Math.min(6, options.searchRadius ?? 3.2));
  const capabilities = new Set(options.capabilities ?? []);
  const rings = Math.ceil(searchRadius / .8);
  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = Math.min(searchRadius, ring * .8);
    const slots = ring === 0 ? 1 : 12;
    for (let slot = 0; slot < slots; slot += 1) {
      const angle = slot * Math.PI * 2 / slots;
      const candidate = {
        x: quantize(requested.x + Math.cos(angle) * radius),
        z: quantize(requested.z + Math.sin(angle) * radius)
      };
      const terrain = sampleWildsTerrain(candidate.x, candidate.z);
      if (terrain.traversal.some((requirement) => !capabilities.has(requirement.kind))) continue;
      const terrainObstacles = movementObstacles(candidate, candidate, capsuleRadius);
      const obstacles = options.obstacles?.length
        ? [...terrainObstacles, ...options.obstacles]
        : terrainObstacles;
      if (obstacles.some((obstacle) => blockingObstacle(obstacle)
        && Math.hypot(candidate.x - obstacle.position.x, candidate.z - obstacle.position.z) < obstacle.radius + capsuleRadius)) continue;
      const collision = resolveWildsObstacleMotion(candidate, candidate, obstacles, capsuleRadius);
      if (collision.position.x !== candidate.x || collision.position.z !== candidate.z) continue;
      return candidate;
    }
  }
  return null;
}

export function resolveWildsRequiredLandingPosition(
  current: Point,
  safeAnchor: Point,
  options: {
    capsuleRadius?: number;
    capabilities?: readonly TraversalCapability[];
    obstacles?: readonly WildsTerrainObstacle[];
    searchRadius?: number;
  } = {}
) {
  const currentLanding = finitePoint(current) ? resolveWildsSafeLandingPosition(current, options) : null;
  if (currentLanding) return currentLanding;
  if (!finitePoint(safeAnchor)) return null;
  return resolveWildsSafeLandingPosition(safeAnchor, options);
}
