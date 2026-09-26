import { WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";
import { WILDS_AUTHORED_OVERLOOKS, WILDS_MAJOR_ROUTES, WILDS_NAMED_REGIONS } from "./wilds-world-geography";

export const WILDS_TERRAIN_VERSION = "wildz.terrain.v1" as const;
export const WILDS_TERRAIN_TILE_SIZE = 12;
export const WILDS_LANDMARK_LEVEL_APRON = 4.25;
export const WILDS_LANDMARK_BLEND_APRON = 6.25;

export type WildsTerrainSurface = "trail" | "soil" | "grass" | "rock" | "sand" | "shallow-water" | "deep-water";
export type WildsTraversalRequirement = { kind: "swim" | "climb" | "glide" | "flight" };

export type WildsTerrainSample = {
  version: typeof WILDS_TERRAIN_VERSION;
  elevation: number;
  normal: { x: number; y: number; z: number };
  slope: number;
  surface: WildsTerrainSurface;
  waterDepth: number;
  regionId: string;
  materialId: string;
  traversal: readonly WildsTraversalRequirement[];
};

type Point = { x: number; z: number };
type RouteProjection = Point & { distance: number };

const TERRAIN_MIN = -8;
const TERRAIN_MAX = 28;
const NORMAL_SAMPLE_DISTANCE = 0.25;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function smoothstep(value: number) {
  const safe = clamp(value, 0, 1);
  return safe * safe * (3 - 2 * safe);
}

function hashGrid(x: number, z: number, salt: number) {
  let value = Math.imul(x ^ salt, 0x85ebca6b) ^ Math.imul(z ^ (salt >>> 1), 0xc2b2ae35);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

function valueNoise(x: number, z: number, scale: number, salt: number) {
  const scaledX = x / scale;
  const scaledZ = z / scale;
  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const tx = smoothstep(scaledX - x0);
  const tz = smoothstep(scaledZ - z0);
  const a = hashGrid(x0, z0, salt) * 2 - 1;
  const b = hashGrid(x0 + 1, z0, salt) * 2 - 1;
  const c = hashGrid(x0, z0 + 1, salt) * 2 - 1;
  const d = hashGrid(x0 + 1, z0 + 1, salt) * 2 - 1;
  const north = a + (b - a) * tx;
  const south = c + (d - c) * tx;
  return north + (south - north) * tz;
}

function unmaskedElevation(x: number, z: number) {
  const continental = valueNoise(x, z, 220, 0x41c64e6d) * 6.2;
  const regional = valueNoise(x, z, 82, 0x9e3779b9) * 8.4;
  const ridgeNoise = valueNoise(x, z, 128, 0x27d4eb2d);
  const ridges = Math.pow(Math.abs(ridgeNoise), 1.65) * 9.2 - 2.4;
  const local = valueNoise(x, z, 24, 0x165667b1) * 1.35;
  return clamp(continental + regional + ridges + local, TERRAIN_MIN, TERRAIN_MAX);
}

// The authored routes are immutable. Compute segment invariants once instead of
// allocating a point and projection for every segment of every terrain sample.
const routeSegments = WILDS_MAJOR_ROUTES.flatMap(route => route.points.slice(1).map((end, index) => {
  const start = route.points[index]!;
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return { x: start.x, z: start.z, dx, dz, lengthSquared: dx * dx + dz * dz };
}));

function nearestRouteProjection(x: number, z: number): RouteProjection {
  let nearestX = x;
  let nearestZ = z;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const segment of routeSegments) {
    const amount = segment.lengthSquared === 0 ? 0
      : clamp(((x - segment.x) * segment.dx + (z - segment.z) * segment.dz) / segment.lengthSquared, 0, 1);
    const projectedX = segment.x + segment.dx * amount;
    const projectedZ = segment.z + segment.dz * amount;
    const deltaX = x - projectedX;
    const deltaZ = z - projectedZ;
    // An axis alone outside the current radius cannot be a nearer segment.
    // Keep Math.hypot for candidates to preserve the original rounding/ties.
    if (Math.abs(deltaX) > nearestDistance || Math.abs(deltaZ) > nearestDistance) continue;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance < nearestDistance) {
      nearestX = projectedX;
      nearestZ = projectedZ;
      nearestDistance = distance;
    }
  }
  return { x: nearestX, z: nearestZ, distance: nearestDistance };
}

export function distanceToWildsMajorRoute(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return Number.POSITIVE_INFINITY;
  return quantize(nearestRouteProjection(x, z).distance);
}

function routeMaskedElevation(x: number, z: number, elevation: number) {
  const projection = nearestRouteProjection(x, z);
  if (projection.distance >= 1.1) return elevation;
  const routeGrade = Math.max(-0.82, unmaskedElevation(projection.x, projection.z));
  const blend = 1 - smoothstep(projection.distance / 1.1);
  return elevation + (routeGrade - elevation) * blend;
}

// Authored masks never move. Reuse their exact center heights and radii.
const landmarkMasks = WILDS_FLAGSHIP_LANDMARKS.map(landmark => ({
  x: landmark.position.x, z: landmark.position.z,
  innerRadius: landmark.radius + WILDS_LANDMARK_LEVEL_APRON,
  outerRadius: landmark.radius + WILDS_LANDMARK_BLEND_APRON,
  centerElevation: Math.max(0.08, unmaskedElevation(landmark.position.x, landmark.position.z))
}));
const overlookMasks = WILDS_AUTHORED_OVERLOOKS.map(overlook => ({
  x: overlook.position.x, z: overlook.position.z,
  centerElevation: unmaskedElevation(overlook.position.x, overlook.position.z)
}));

function landmarkMaskedElevation(x: number, z: number, elevation: number) {
  let result = elevation;
  for (const { x: centerX, z: centerZ, innerRadius, outerRadius, centerElevation } of landmarkMasks) {
    const dx = x - centerX;
    const dz = z - centerZ;
    if (Math.abs(dx) >= outerRadius || Math.abs(dz) >= outerRadius) continue;
    const distance = Math.hypot(dx, dz);
    if (distance >= outerRadius) continue;
    if (distance <= innerRadius) result = centerElevation;
    else {
      const blend = 1 - smoothstep((distance - innerRadius) / (outerRadius - innerRadius));
      result += (centerElevation - result) * blend;
    }
  }
  return result;
}

function overlookMaskedElevation(x: number, z: number, elevation: number) {
  let result = elevation;
  for (const { x: centerX, z: centerZ, centerElevation } of overlookMasks) {
    const dx = x - centerX;
    const dz = z - centerZ;
    if (Math.abs(dx) >= 4.4 || Math.abs(dz) >= 4.4) continue;
    const distance = Math.hypot(dx, dz);
    if (distance >= 4.4) continue;
    if (distance <= 3.25) result = centerElevation;
    else result += (centerElevation - result) * (1 - smoothstep((distance - 3.25) / 1.15));
  }
  return result;
}

function finiteCoordinate(value: number) {
  return Number.isFinite(value) ? clamp(value, -500_000_000, 500_000_000) : 0;
}

export function wildsTerrainElevation(x: number, z: number) {
  const safeX = finiteCoordinate(x);
  const safeZ = finiteCoordinate(z);
  const base = unmaskedElevation(safeX, safeZ);
  return quantize(clamp(overlookMaskedElevation(safeX, safeZ, landmarkMaskedElevation(safeX, safeZ, routeMaskedElevation(safeX, safeZ, base))), TERRAIN_MIN, TERRAIN_MAX));
}

function regionIdFor(x: number, z: number) {
  let nearest: (typeof WILDS_NAMED_REGIONS)[number] = WILDS_NAMED_REGIONS[0]!;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const region of WILDS_NAMED_REGIONS) {
    const distance = Math.hypot(region.position.x - x, region.position.z - z);
    if (distance < nearestDistance) {
      nearest = region;
      nearestDistance = distance;
    }
  }
  return nearest.id;
}

/** Elevation-only water classification shared by terrain and physical wading admission. */
export function wildsTerrainWaterSurface(elevation: number): "deep-water" | "shallow-water" | null {
  return elevation < -2.4 ? "deep-water" : elevation < -1.1 ? "shallow-water" : null;
}

function classifySurface(elevation: number, slope: number, routeDistance: number): WildsTerrainSurface {
  // Water is an elevation band, but a steep face is still exposed mountain
  // rock even when its foot is beside or below a lake. Check topography first
  // so mountain slopes are not mislabeled as water merely because they are
  // near a low-water basin.
  const water = wildsTerrainWaterSurface(elevation);
  // Preserve submerged route shoulders as water; they are intentionally not
  // dry causeways even though they sit next to a major route.
  if (water && routeDistance <= 0.55) return water;
  if (slope >= 0.62) return "rock";
  if (water) return water;
  if (routeDistance <= 0.55) return "trail";
  if (elevation < 0.25) return "soil";
  return "grass";
}

export function sampleWildsTerrain(x: number, z: number): WildsTerrainSample {
  const safeX = finiteCoordinate(x);
  const safeZ = finiteCoordinate(z);
  const elevation = wildsTerrainElevation(safeX, safeZ);
  const riseX = (wildsTerrainElevation(safeX + NORMAL_SAMPLE_DISTANCE, safeZ) - wildsTerrainElevation(safeX - NORMAL_SAMPLE_DISTANCE, safeZ)) / (NORMAL_SAMPLE_DISTANCE * 2);
  const riseZ = (wildsTerrainElevation(safeX, safeZ + NORMAL_SAMPLE_DISTANCE) - wildsTerrainElevation(safeX, safeZ - NORMAL_SAMPLE_DISTANCE)) / (NORMAL_SAMPLE_DISTANCE * 2);
  const normalLength = Math.hypot(riseX, 1, riseZ) || 1;
  const slope = quantize(Math.hypot(riseX, riseZ));
  const routeDistance = distanceToWildsMajorRoute(safeX, safeZ);
  const surface = classifySurface(elevation, slope, routeDistance);
  const traversal: readonly WildsTraversalRequirement[] = surface === "deep-water"
    ? [{ kind: "swim" }]
    : surface === "rock" && slope >= 0.78
      ? [{ kind: "climb" }]
      : [];
  return {
    version: WILDS_TERRAIN_VERSION,
    elevation,
    normal: {
      x: quantize(-riseX / normalLength),
      y: quantize(1 / normalLength),
      z: quantize(-riseZ / normalLength)
    },
    slope,
    surface,
    waterDepth: quantize(Math.max(0, -1.1 - elevation)),
    regionId: regionIdFor(safeX, safeZ),
    materialId: `wildz.terrain.material.${surface}.v1`,
    traversal
  };
}
