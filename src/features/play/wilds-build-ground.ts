import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition } from './wilds-discovery-sites';
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from './wilds-site-runtime';
import { sampleWildsTerrain, sampleWildsTerrainAtGroundElevation, WILDS_TERRAIN_WATER_SURFACE_ELEVATION } from './wilds-terrain-authority';

const outer = 'wildz.space.outer.v1';
const runtimes = new Map<string, WildsSiteRuntimeProjection>();
type Point = Readonly<{ x: number; y: number; z: number }>;
export type WildsBuildFootprint = Readonly<{ center: Point; halfExtents: Point; yaw: number }>;
export const WILDS_BUILD_FLAT_APRON = 1.1, WILDS_BUILD_EDGE_BLEND = 3;
type GradePlane = Readonly<{ center: Point; halfExtents: Readonly<{ x: number; z: number }>; yaw: number }>;

/** Shared pure cut/fill law for preview, admitted source and streamed terrain. */
export function sampleWildsBuildGrading(planes: readonly GradePlane[], x: number, z: number, fallback: number) {
  const distance = (plane: GradePlane) => {
    const dx = x - plane.center.x, dz = z - plane.center.z, c = Math.cos(plane.yaw), s = Math.sin(plane.yaw);
    return Math.max(Math.abs(dx * c - dz * s) - plane.halfExtents.x, Math.abs(dx * s + dz * c) - plane.halfExtents.z);
  };
  let nearest: GradePlane | undefined, minimum = Infinity;
  for (const plane of planes) { const next = distance(plane); if (next <= WILDS_BUILD_FLAT_APRON && next < minimum) { nearest = plane; minimum = next; } }
  if (nearest) return nearest.center.y;
  let result = fallback, influence = 0;
  for (const plane of planes) {
    const amount = Math.max(0, 1 - (distance(plane) - WILDS_BUILD_FLAT_APRON) / WILDS_BUILD_EDGE_BLEND);
    if (amount > influence) { influence = amount; result = fallback + (plane.center.y - fallback) * amount; }
  }
  return Math.round(result * 1_000_000) / 1_000_000;
}

/** Placement uses the same authored triangular floor as grounded movement. */
export function sampleWildsBuildGround(x: number, z: number) {
  const region = wildsDiscoverySiteRegionForPosition({ x, z }), key = `${region.x}:${region.z}`;
  let runtime = runtimes.get(key);
  if (!runtime) {
    runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(region.x, region.z));
    runtimes.set(key, runtime);
    if (runtimes.size > 16) runtimes.delete(runtimes.keys().next().value!);
  }
  const raw = sampleWildsTerrain(x, z), floorY = wildsSiteRuntimeGroundY(runtime, outer, x, z, raw.elevation);
  const terrain = sampleWildsTerrainAtGroundElevation(x, z, floorY);
  return { ...terrain, elevation: floorY };
}

export function wildsBuildGroundPoint(point: Point, spaceId = outer, actualFloorY?: number): Point {
  return spaceId === outer ? { ...point, y: wildsBuildPlacementGroundY(point.x, point.z, actualFloorY) } : point;
}

/** A paid surface footing also supplies landfill above the rendered water. */
export function wildsBuildPlacementGroundY(x: number, z: number, actualFloorY = sampleWildsBuildGround(x, z).elevation) {
  return Math.round(Math.max(actualFloorY, WILDS_TERRAIN_WATER_SURFACE_ELEVATION + .2) * 1_000_000) / 1_000_000;
}

/** Sample the complete oriented footing, including its edges, instead of the
 * pointer alone. The bound also fences oversized imported support geometry. */
export function projectWildsBuildFootprint(footprint: WildsBuildFootprint) {
  const { center, halfExtents, yaw } = footprint;
  if (![center.x, center.y, center.z, halfExtents.x, halfExtents.z, yaw].every(Number.isFinite)
    || halfExtents.x < 0 || halfExtents.z < 0) throw Error('creation_world_ground_invalid');
  const columns = Math.max(1, Math.ceil(halfExtents.x * 4)), rows = Math.max(1, Math.ceil(halfExtents.z * 4));
  if ((columns + 1) * (rows + 1) > 131072) throw Error('creation_world_ground_budget');
  let minimum = Infinity, maximum = -Infinity, dry = true;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const dx = -halfExtents.x + column / columns * halfExtents.x * 2,
      dz = -halfExtents.z + row / rows * halfExtents.z * 2;
    const terrain = sampleWildsBuildGround(center.x + dx * c + dz * s, center.z - dx * s + dz * c);
    minimum = Math.min(minimum, terrain.elevation); maximum = Math.max(maximum, terrain.elevation);
    dry &&= terrain.surface !== 'deep-water' && terrain.surface !== 'shallow-water';
  }
  return { minimum, maximum, dry };
}
