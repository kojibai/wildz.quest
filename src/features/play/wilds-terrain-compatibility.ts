import { sampleWildsTerrain } from "./wilds-terrain-authority";
import {
  queryWildsObstacles,
  type WildsObstacleIndex
} from "./wilds-terrain-obstacles";

export type WildsGroundedPosition = {
  x: number;
  y: number;
  z: number;
  adjusted: boolean;
};

const DEFAULT_CAPSULE_RADIUS = 0.38;
const SEARCH_RADII = [0.75, 1.5, 2.25, 3, 4] as const;
const DIAGONAL = Math.SQRT1_2;
const SEARCH_DIRECTIONS = [
  { x: 0, z: -1 },
  { x: DIAGONAL, z: -DIAGONAL },
  { x: 1, z: 0 },
  { x: DIAGONAL, z: DIAGONAL },
  { x: 0, z: 1 },
  { x: -DIAGONAL, z: DIAGONAL },
  { x: -1, z: 0 },
  { x: -DIAGONAL, z: -DIAGONAL }
] as const;

function safeCapsuleRadius(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 4) throw new Error("wilds_ground_capsule_radius_invalid");
  return value;
}

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function isWildsGroundPositionClear(
  position: { x: number; z: number },
  index: WildsObstacleIndex,
  capsuleRadius = DEFAULT_CAPSULE_RADIUS
) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const radius = safeCapsuleRadius(capsuleRadius);
  const nearby = queryWildsObstacles(index, {
    minX: position.x - radius,
    maxX: position.x + radius,
    minZ: position.z - radius,
    maxZ: position.z + radius
  });
  return nearby.every((obstacle) => {
    if (obstacle.material === "soft" || obstacle.material === "stepable") return true;
    return Math.hypot(position.x - obstacle.position.x, position.z - obstacle.position.z) >= radius + obstacle.radius;
  });
}

function groundedCandidate(
  position: { x: number; z: number },
  index: WildsObstacleIndex,
  capsuleRadius: number,
  adjusted: boolean
): WildsGroundedPosition | null {
  if (!isWildsGroundPositionClear(position, index, capsuleRadius)) return null;
  const terrain = sampleWildsTerrain(position.x, position.z);
  if (terrain.surface === "deep-water" || terrain.traversal.length > 0) return null;
  return { x: position.x, y: terrain.elevation, z: position.z, adjusted };
}

export function restoreWildsGroundedPosition(
  position: { x: number; z: number },
  index: WildsObstacleIndex,
  capsuleRadius = DEFAULT_CAPSULE_RADIUS
): WildsGroundedPosition {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) throw new Error("wilds_ground_position_invalid");
  const radius = safeCapsuleRadius(capsuleRadius);
  const exact = groundedCandidate(position, index, radius, false);
  if (exact) return exact;
  for (const searchRadius of SEARCH_RADII) {
    for (const direction of SEARCH_DIRECTIONS) {
      const candidate = groundedCandidate({
        x: quantize(position.x + direction.x * searchRadius),
        z: quantize(position.z + direction.z * searchRadius)
      }, index, radius, true);
      if (candidate) return candidate;
    }
  }
  throw new Error("wilds_ground_position_unresolved");
}
