import { wildsDiscoverySiteDiagnostics, type WildsDiscoveryPhysicalNeighborhood, type WildsDiscoverySiteProjection, type WildsSiteSpaceState, type WildsSiteSurface } from "./wilds-discovery-sites";

const OUTER = "wildz.space.outer.v1";
const CELL = 16;
export const WILDS_SITE_PORTAL_INTERACTION_RADIUS = 3.2;
const EMPTY = Object.freeze([]) as readonly never[];
type Point3 = Readonly<{ x: number; y: number; z: number }>;
type Box = Readonly<{ spaceId: string; center: Point3; halfExtents: Point3 }>;
type Index<T> = Map<string, Map<number, Map<number, readonly T[]>>>;
type RuntimeIndex = Readonly<{
  surfaces: Index<WildsSiteSurface>;
  solids: Index<WildsDiscoveryPhysicalNeighborhood["solids"][number]>;
  ceilings: Index<WildsDiscoveryPhysicalNeighborhood["ceilings"][number]>;
  encounters: Index<WildsDiscoveryPhysicalNeighborhood["encounterVolumes"][number]>;
  waters: Index<WildsDiscoveryPhysicalNeighborhood["waterVolumes"][number]>;
  discoveries: Map<number, Map<number, readonly WildsDiscoverySiteProjection[]>>;
  interiorSites: ReadonlyMap<string, WildsDiscoverySiteProjection>;
}>;
export type WildsSiteRuntimeProjection = Readonly<{ version: "wildz.site-runtime.v1"; physical: WildsDiscoveryPhysicalNeighborhood; sites: readonly WildsDiscoverySiteProjection[] }>;
export type WildsSiteMovementOutput = { x: number; z: number; floorY: number; ceilingY: number; surfaceId: string | null; flooded: boolean; blocked: boolean };
export type WildsSiteDiscoveryOutput = { siteKey: string | null };

const cache = new WeakMap<WildsDiscoveryPhysicalNeighborhood, WildsSiteRuntimeProjection>();
const indexes = new WeakMap<WildsSiteRuntimeProjection, RuntimeIndex>();
let runtimeBuilds = 0, indexBuilds = 0, movementWrites = 0, aerialWrites = 0, cameraWrites = 0, encounterWrites = 0, discoveryWrites = 0, landingWrites = 0;
const q = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const point = (x: number, y: number, z: number): Point3 => Object.freeze({ x: q(x), y: q(y), z: q(z) });

function add<T extends Box>(index: Index<T>, value: T) {
  let space = index.get(value.spaceId);
  if (!space) { space = new Map(); index.set(value.spaceId, space); }
  const minX = Math.floor((value.center.x - value.halfExtents.x) / CELL), maxX = Math.floor((value.center.x + value.halfExtents.x) / CELL);
  const minZ = Math.floor((value.center.z - value.halfExtents.z) / CELL), maxZ = Math.floor((value.center.z + value.halfExtents.z) / CELL);
  for (let x = minX; x <= maxX; x += 1) {
    let column = space.get(x); if (!column) { column = new Map(); space.set(x, column); }
    for (let z = minZ; z <= maxZ; z += 1) { const bucket = column.get(z); if (bucket) (bucket as T[]).push(value); else column.set(z, [value]); }
  }
}
function at<T>(index: Index<T>, spaceId: string, x: number, z: number): readonly T[] { return index.get(spaceId)?.get(Math.floor(x / CELL))?.get(Math.floor(z / CELL)) ?? EMPTY; }
function buildIndex(physical: WildsDiscoveryPhysicalNeighborhood): RuntimeIndex {
  const surfaces: Index<WildsSiteSurface> = new Map(), solids: Index<WildsDiscoveryPhysicalNeighborhood["solids"][number]> = new Map();
  const ceilings: Index<WildsDiscoveryPhysicalNeighborhood["ceilings"][number]> = new Map(), encounters: Index<WildsDiscoveryPhysicalNeighborhood["encounterVolumes"][number]> = new Map();
  const waters: Index<WildsDiscoveryPhysicalNeighborhood["waterVolumes"][number]> = new Map();
  const discoveries = new Map<number, Map<number, readonly WildsDiscoverySiteProjection[]>>();
  const interiorSites = new Map<string, WildsDiscoverySiteProjection>();
  physical.surfaces.forEach((v) => add(surfaces, v)); physical.solids.forEach((v) => add(solids, v)); physical.ceilings.forEach((v) => add(ceilings, v)); physical.encounterVolumes.forEach((v) => add(encounters, v)); physical.waterVolumes.forEach((v) => add(waters, v));
  physical.sites.forEach((site) => {
    const minX = Math.floor((site.entrance.x - 14) / CELL), maxX = Math.floor((site.entrance.x + 14) / CELL);
    const minZ = Math.floor((site.entrance.z - 14) / CELL), maxZ = Math.floor((site.entrance.z + 14) / CELL);
    for (let x = minX; x <= maxX; x += 1) {
      let column = discoveries.get(x); if (!column) { column = new Map(); discoveries.set(x, column); }
      for (let z = minZ; z <= maxZ; z += 1) { const bucket = column.get(z); if (bucket) (bucket as WildsDiscoverySiteProjection[]).push(site); else column.set(z, [site]); }
    }
    for (const portal of physical.portals) if (portal.siteKey === site.key) interiorSites.set(portal.toSpaceId, site);
  });
  indexBuilds += 1; return { surfaces, solids, ceilings, encounters, waters, discoveries, interiorSites };
}
export function prepareWildsSiteRuntime(physical: WildsDiscoveryPhysicalNeighborhood): WildsSiteRuntimeProjection {
  const cached = cache.get(physical); if (cached) return cached;
  const runtime = Object.freeze({ version: "wildz.site-runtime.v1" as const, physical, sites: physical.sites });
  indexes.set(runtime, buildIndex(physical)); cache.set(physical, runtime); runtimeBuilds += 1; return runtime;
}
function indexFor(runtime: WildsSiteRuntimeProjection) { const index = indexes.get(runtime); if (!index) throw new Error("wilds_site_runtime_not_prepared"); return index; }
function surfaceAt(runtime: WildsSiteRuntimeProjection, spaceId: string, x: number, y: number, z: number) {
  let nearest: WildsSiteSurface | undefined, distance = Number.POSITIVE_INFINITY;
  for (const surface of at(indexFor(runtime).surfaces, spaceId, x, z)) {
    if (Math.abs(x - surface.center.x) > surface.halfExtents.x || Math.abs(z - surface.center.z) > surface.halfExtents.z || y < surface.center.y - .75 || y > surface.center.y + 2.25) continue;
    const next = Math.abs(y - surface.center.y); if (next < distance) { nearest = surface; distance = next; }
  }
  return nearest;
}
function contains(value: Readonly<{ center: Point3; halfExtents: Point3 }>, x: number, y: number, z: number, margin = 0) { return Math.abs(x - value.center.x) <= value.halfExtents.x + margin && Math.abs(y - value.center.y) <= value.halfExtents.y && Math.abs(z - value.center.z) <= value.halfExtents.z + margin; }
function isBlocked(runtime: WildsSiteRuntimeProjection, spaceId: string, x: number, y: number, z: number, radius: number) { for (const solid of at(indexFor(runtime).solids, spaceId, x, z)) if (contains(solid, x, y + .78, z, radius)) return true; return false; }
function floorAndCeiling(output: { floorY: number; ceilingY: number; flooded: boolean; surfaceId?: string | null; waterSurfaceY?: number }, runtime: WildsSiteRuntimeProjection, spaceId: string, x: number, y: number, z: number, fallback: number) {
  const surface = surfaceAt(runtime, spaceId, x, y, z); if ("surfaceId" in output) output.surfaceId = surface?.id ?? null;
  output.floorY = surface?.center.y ?? fallback; output.ceilingY = Number.POSITIVE_INFINITY; output.flooded = surface?.flooded ?? false;
  for (const ceiling of at(indexFor(runtime).ceilings, spaceId, x, z)) { if (Math.abs(x - ceiling.center.x) > ceiling.halfExtents.x || Math.abs(z - ceiling.center.z) > ceiling.halfExtents.z) continue; const underside = ceiling.center.y - ceiling.halfExtents.y; if (underside >= output.floorY && underside < output.ceilingY) output.ceilingY = underside; }
  if ("waterSurfaceY" in output) output.waterSurfaceY = Number.NaN;
  for (const water of at(indexFor(runtime).waters, spaceId, x, z)) {
    if (!contains(water, x, Math.min(Math.max(y, water.center.y - water.halfExtents.y), water.center.y + water.halfExtents.y), z)) continue;
    output.flooded = true;
    if ("waterSurfaceY" in output) { const priorWaterSurface = typeof output.waterSurfaceY === "number" && Number.isFinite(output.waterSurfaceY) ? output.waterSurfaceY : Number.NEGATIVE_INFINITY; output.waterSurfaceY = Math.max(priorWaterSurface, water.center.y + water.halfExtents.y); }
  }
  return surface;
}
export function writeWildsSiteRuntimeMovement(output: WildsSiteMovementOutput, runtime: WildsSiteRuntimeProjection, spaceId: string, sx: number, sy: number, sz: number, tx: number, tz: number, radius: number, fallback = sy) {
  movementWrites += 1; const interior = spaceId !== OUTER; let x = tx, z = tz, surface = surfaceAt(runtime, spaceId, x, sy, z); const blocked = isBlocked(runtime, spaceId, x, sy, z, radius) || (interior && !surface);
  if (blocked) { const xSurface = surfaceAt(runtime, spaceId, tx, sy, sz); if ((!interior || xSurface) && !isBlocked(runtime, spaceId, tx, sy, sz, radius)) { z = sz; surface = xSurface; } else { const zSurface = surfaceAt(runtime, spaceId, sx, sy, tz); if ((!interior || zSurface) && !isBlocked(runtime, spaceId, sx, sy, tz, radius)) { x = sx; surface = zSurface; } else { x = sx; z = sz; surface = surfaceAt(runtime, spaceId, x, sy, z); } } }
  output.x = q(x); output.z = q(z); output.blocked = blocked; floorAndCeiling(output, runtime, spaceId, output.x, surface?.center.y ?? sy, output.z, fallback); return output;
}
export function writeWildsSiteRuntimeCamera(output: { floorY: number; ceilingY: number; flooded: boolean; waterSurfaceY: number }, runtime: WildsSiteRuntimeProjection, spaceId: string, x: number, y: number, z: number) { cameraWrites += 1; floorAndCeiling(output, runtime, spaceId, x, y, z, y); return output; }
export function writeWildsSiteRuntimeAerialCollision(output: { obstacleTopY: number; ceilingY: number; protectedAirspace: boolean; floorY?: number; flooded?: boolean; waterSurfaceY?: number }, runtime: WildsSiteRuntimeProjection, spaceId: string, x: number, footY: number, z: number, height: number, radius: number) {
  aerialWrites += 1; output.obstacleTopY = Number.NaN; output.ceilingY = Number.NaN; output.protectedAirspace = false; const headY = footY + height;
  if ("floorY" in output && "flooded" in output) floorAndCeiling(output as { floorY: number; ceilingY: number; flooded: boolean; waterSurfaceY?: number }, runtime, spaceId, x, footY, z, footY);
  for (const ceiling of at(indexFor(runtime).ceilings, spaceId, x, z)) { if (Math.abs(x - ceiling.center.x) > ceiling.halfExtents.x + radius || Math.abs(z - ceiling.center.z) > ceiling.halfExtents.z + radius) continue; const underside = ceiling.center.y - ceiling.halfExtents.y; if (headY <= underside + .000001 && (!Number.isFinite(output.ceilingY) || underside < output.ceilingY)) output.ceilingY = underside; }
  for (const solid of at(indexFor(runtime).solids, spaceId, x, z)) { if (Math.abs(x - solid.center.x) > solid.halfExtents.x + radius || Math.abs(z - solid.center.z) > solid.halfExtents.z + radius) continue; const min = solid.center.y - solid.halfExtents.y, max = solid.center.y + solid.halfExtents.y; if (footY <= max && headY >= min && (!Number.isFinite(output.obstacleTopY) || max > output.obstacleTopY)) output.obstacleTopY = max; }
  return output;
}
export function writeWildsSiteRuntimeEncounter(output: { siteKey: string | null; spaceId: string; layer: WildsDiscoveryPhysicalNeighborhood["encounterVolumes"][number]["layer"]; minY: number; maxY: number }, runtime: WildsSiteRuntimeProjection, spaceId: string, x: number, y: number, z: number) {
  encounterWrites += 1; output.siteKey = null; output.spaceId = spaceId; output.layer = "ground"; output.minY = q(y - .65); output.maxY = q(y + .65);
  for (const volume of at(indexFor(runtime).encounters, spaceId, x, z)) if (contains(volume, x, y, z)) { output.siteKey = volume.siteKey; output.layer = volume.layer; output.minY = q(Math.max(volume.center.y - volume.halfExtents.y, y - .85)); output.maxY = q(Math.min(volume.center.y + volume.halfExtents.y, y + .85)); break; } return output;
}
export function writeWildsSiteRuntimeDiscovery(output: WildsSiteDiscoveryOutput, runtime: WildsSiteRuntimeProjection, spaceId: string, x: number, y: number, z: number, radius = 8) {
  discoveryWrites += 1; output.siteKey = null; const index = indexFor(runtime);
  if (spaceId !== OUTER) { output.siteKey = index.interiorSites.get(spaceId)?.key ?? null; return output; }
  let nearest = Number.POSITIVE_INFINITY;
  const bucket = index.discoveries.get(Math.floor(x / CELL))?.get(Math.floor(z / CELL)) ?? EMPTY;
  for (const site of bucket) {
    const distance = Math.hypot(site.entrance.x - x, site.entrance.z - z);
    if (distance <= radius && distance < nearest && Math.abs(site.entrance.y - y) <= Math.max(6, site.collisionEnvelope.halfExtents.y)) { output.siteKey = site.key; nearest = distance; }
  }
  return output;
}
export function writeWildsSiteRuntimeLanding(output: { x: number; z: number; floorY: number; found: boolean }, runtime: WildsSiteRuntimeProjection, spaceId: string, requestedX: number, requestedY: number, requestedZ: number, radius = .38) {
  landingWrites += 1; output.found = false;
  for (let ring = 0; ring <= 5; ring += 1) {
    const distance = ring * 1.25;
    for (let direction = 0; direction < (ring === 0 ? 1 : 8); direction += 1) {
      const angle = direction * Math.PI / 4;
      const x = q(requestedX + Math.cos(angle) * distance), z = q(requestedZ + Math.sin(angle) * distance);
      const surface = surfaceAt(runtime, spaceId, x, requestedY, z);
      if ((spaceId !== OUTER && !surface) || isBlocked(runtime, spaceId, x, surface?.center.y ?? requestedY, z, radius)) continue;
      output.x = x; output.z = z; output.floorY = surface?.center.y ?? requestedY; output.found = true; return output;
    }
  }
  return output;
}
export function enterWildsSiteRuntime(runtime: WildsSiteRuntimeProjection, siteKey: string, position: Point3): WildsSiteSpaceState | null {
  const portal = runtime.physical.portals.find((value) => value.siteKey === siteKey);
  if (!portal || Math.hypot(portal.position.x - position.x, portal.position.z - position.z) > WILDS_SITE_PORTAL_INTERACTION_RADIUS || Math.abs(portal.position.y - position.y) > 3) return null;
  const surfaces = runtime.physical.surfaces.filter((value) => value.spaceId === portal.toSpaceId);
  const surface = surfaces.find((value) => Math.abs(portal.position.x - value.center.x) <= value.halfExtents.x && Math.abs(portal.position.z - value.center.z) <= value.halfExtents.z) ?? surfaces[0];
  return surface ? Object.freeze({ version: "wildz.site-space-state.v1", spaceId: portal.toSpaceId, siteKey: portal.siteKey, surfaceId: surface.id, position: point(portal.position.x, surface.center.y, portal.position.z), flooded: surface.flooded }) : null;
}
export function exitWildsSiteRuntime(runtime: WildsSiteRuntimeProjection, state: WildsSiteSpaceState, requestedSiteKey: string): WildsSiteSpaceState | null {
  if (!state.siteKey || state.spaceId === OUTER || state.siteKey !== requestedSiteKey) return null;
  const portal = runtime.physical.portals.find((value) => value.siteKey === state.siteKey && value.toSpaceId === state.spaceId);
  if (!portal || Math.hypot(portal.position.x - state.position.x, portal.position.z - state.position.z) > WILDS_SITE_PORTAL_INTERACTION_RADIUS || Math.abs(portal.position.y - state.position.y) > 3) return null;
  return Object.freeze({ version: "wildz.site-space-state.v1", spaceId: OUTER, siteKey: null, surfaceId: null, position: point(portal.position.x, portal.position.y, portal.position.z), flooded: false });
}
export function wildsSiteRuntimeDiagnostics() { const a = wildsDiscoverySiteDiagnostics(); return Object.freeze({ runtimeBuilds, indexBuilds, movementWrites, aerialWrites, cameraWrites, encounterWrites, discoveryWrites, landingWrites, authorityBuilds: a.regionsBuilt + a.neighborhoodsBuilt + a.physicalNeighborhoodsBuilt + a.surfaceIndexesBuilt }); }
