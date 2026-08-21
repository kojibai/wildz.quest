import { WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";
import { WILDS_MAJOR_ROUTES, WILDS_NAMED_REGIONS } from "./wilds-world-geography";

export const WILDS_TERRAIN_VERSION = "wildz.terrain.v1" as const;
export const WILDS_TERRAIN_TILE_SIZE = 12;

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

function nearestPointOnSegment(point: Point, start: Point, end: Point): RouteProjection {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount = lengthSquared === 0 ? 0 : clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared, 0, 1);
  const x = start.x + dx * amount;
  const z = start.z + dz * amount;
  return { x, z, distance: Math.hypot(point.x - x, point.z - z) };
}

function nearestRouteProjection(x: number, z: number): RouteProjection {
  let nearest: RouteProjection = { x, z, distance: Number.POSITIVE_INFINITY };
  for (const route of WILDS_MAJOR_ROUTES) {
    for (let index = 1; index < route.points.length; index += 1) {
      const projected = nearestPointOnSegment({ x, z }, route.points[index - 1]!, route.points[index]!);
      if (projected.distance < nearest.distance) nearest = projected;
    }
  }
  return nearest;
}

export function distanceToWildsMajorRoute(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return Number.POSITIVE_INFINITY;
  return quantize(nearestRouteProjection(x, z).distance);
}

function routeMaskedElevation(x: number, z: number, elevation: number) {
  const projection = nearestRouteProjection(x, z);
  if (projection.distance >= 1.1) return elevation;
  const routeGrade = unmaskedElevation(projection.x, projection.z);
  const blend = 1 - smoothstep(projection.distance / 1.1);
  return elevation + (routeGrade - elevation) * blend;
}

function landmarkMaskedElevation(x: number, z: number, elevation: number) {
  let result = elevation;
  for (const landmark of WILDS_FLAGSHIP_LANDMARKS) {
    const distance = Math.hypot(x - landmark.position.x, z - landmark.position.z);
    const innerRadius = landmark.radius + 1;
    const outerRadius = landmark.radius + 3;
    if (distance >= outerRadius) continue;
    const centerElevation = Math.max(0.08, unmaskedElevation(landmark.position.x, landmark.position.z));
    if (distance <= innerRadius) result = centerElevation;
    else {
      const blend = 1 - smoothstep((distance - innerRadius) / (outerRadius - innerRadius));
      result += (centerElevation - result) * blend;
    }
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
  return quantize(clamp(landmarkMaskedElevation(safeX, safeZ, routeMaskedElevation(safeX, safeZ, base)), TERRAIN_MIN, TERRAIN_MAX));
}

function regionIdFor(x: number, z: number) {
  let nearest = WILDS_NAMED_REGIONS[0]!;
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

function classifySurface(elevation: number, slope: number, routeDistance: number): WildsTerrainSurface {
  if (routeDistance <= 0.55) return "trail";
  if (elevation < -2.4) return "deep-water";
  if (elevation < -1.1) return "shallow-water";
  if (slope >= 0.62) return "rock";
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
