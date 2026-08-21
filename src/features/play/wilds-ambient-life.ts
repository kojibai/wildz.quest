import type { WildsQualityTier } from "./wilds-quality-profile";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { WILDS_WATERLINE_ELEVATION } from "./wilds-terrain-rendering";

export const WILDS_AMBIENT_REGION_SIZE = 24;

export type WildsAmbientMedium = "aquatic" | "aerial";
export type WildsAmbientPathPoint = Readonly<{ x: number; y: number; z: number }>;
export type WildsAmbientLifeProjection = Readonly<{
  version: "wildz.ambient-life.v1";
  id: string;
  medium: WildsAmbientMedium;
  variant: number;
  members: number;
  speed: number;
  phase: number;
  path: readonly WildsAmbientPathPoint[];
}>;

export type WildsAmbientLifeLod = Readonly<{
  id: string;
  visible: true;
  detail: "silhouette" | "simple" | "full";
}>;

const REGION_CACHE_LIMIT = 256;
const NEIGHBORHOOD_CACHE_LIMIT = 96;
const PATH_POINT_COUNT = 8;
const QUALITY_CAPS: Readonly<Record<WildsQualityTier, number>> = Object.freeze({ low: 12, medium: 20, high: 28 });
const EMPTY_LIFE = Object.freeze([]) as readonly WildsAmbientLifeProjection[];
const regionCache = new Map<string, readonly WildsAmbientLifeProjection[]>();
const neighborhoodCache = new Map<string, readonly WildsAmbientLifeProjection[]>();
let regionBuilds = 0;
let neighborhoodBuilds = 0;
let terrainSamples = 0;

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertedRegion(value: number, field: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`wilds_ambient_${field}_invalid`);
  return BigInt(value);
}

function hash64(regionX: number, regionZ: number, slot: number, salt: number) {
  let value = BigInt.asUintN(64,
    assertedRegion(regionX, "region_x") * 0x9e3779b185ebca87n
    ^ assertedRegion(regionZ, "region_z") * 0xc2b2ae3d27d4eb4fn
    ^ BigInt(slot) * 0x165667b19e3779f9n
    ^ BigInt(salt) * 0x85ebca77c2b2ae63n
  );
  value ^= value >> 30n;
  value = BigInt.asUintN(64, value * 0xbf58476d1ce4e5b9n);
  value ^= value >> 27n;
  value = BigInt.asUintN(64, value * 0x94d049bb133111ebn);
  value ^= value >> 31n;
  return BigInt.asUintN(64, value);
}

function hashUnit(regionX: number, regionZ: number, slot: number, salt: number) {
  return Number(hash64(regionX, regionZ, slot, salt) >> 11n) / 9_007_199_254_740_992;
}

function boundedCacheSet<T>(cache: Map<string, T>, key: string, value: T, limit: number) {
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function terrainAt(x: number, z: number) {
  terrainSamples += 1;
  return sampleWildsTerrain(x, z);
}

function frozenPoint(x: number, y: number, z: number): WildsAmbientPathPoint {
  return Object.freeze({ x: quantize(x), y: quantize(y), z: quantize(z) });
}

function aquaticPath(regionX: number, regionZ: number, slot: number) {
  const inset = 2.4;
  const span = WILDS_AMBIENT_REGION_SIZE - inset * 2;
  const centerX = regionX * WILDS_AMBIENT_REGION_SIZE + inset + hashUnit(regionX, regionZ, slot, 11) * span;
  const centerZ = regionZ * WILDS_AMBIENT_REGION_SIZE + inset + hashUnit(regionX, regionZ, slot, 13) * span;
  const radius = .28 + hashUnit(regionX, regionZ, slot, 17) * .34;
  const phase = hashUnit(regionX, regionZ, slot, 19) * Math.PI * 2;
  const path: WildsAmbientPathPoint[] = [];
  for (let index = 0; index < PATH_POINT_COUNT; index += 1) {
    const angle = phase + index / PATH_POINT_COUNT * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    const terrain = terrainAt(x, z);
    if (terrain.surface !== "shallow-water" && terrain.surface !== "deep-water") return null;
    const clearance = WILDS_WATERLINE_ELEVATION - terrain.elevation;
    if (clearance <= .025) return null;
    const depthFraction = .35 + hashUnit(regionX, regionZ, slot, 31 + index) * .3;
    path.push(frozenPoint(x, terrain.elevation + clearance * depthFraction, z));
  }
  return Object.freeze(path);
}

function aerialPath(regionX: number, regionZ: number, slot: number) {
  const inset = 3;
  const span = WILDS_AMBIENT_REGION_SIZE - inset * 2;
  const centerX = regionX * WILDS_AMBIENT_REGION_SIZE + inset + hashUnit(regionX, regionZ, slot, 41) * span;
  const centerZ = regionZ * WILDS_AMBIENT_REGION_SIZE + inset + hashUnit(regionX, regionZ, slot, 43) * span;
  const radiusX = 1.4 + hashUnit(regionX, regionZ, slot, 47) * 1.8;
  const radiusZ = .8 + hashUnit(regionX, regionZ, slot, 53) * 1.3;
  const altitude = 2.6 + hashUnit(regionX, regionZ, slot, 59) * 3.6;
  const phase = hashUnit(regionX, regionZ, slot, 61) * Math.PI * 2;
  const path: WildsAmbientPathPoint[] = [];
  for (let index = 0; index < PATH_POINT_COUNT; index += 1) {
    const angle = phase + index / PATH_POINT_COUNT * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radiusX;
    const z = centerZ + Math.sin(angle) * radiusZ;
    const terrain = terrainAt(x, z);
    path.push(frozenPoint(x, terrain.elevation + altitude, z));
  }
  return Object.freeze(path);
}

function makeProjection(regionX: number, regionZ: number, slot: number, medium: WildsAmbientMedium, path: readonly WildsAmbientPathPoint[]) {
  return Object.freeze({
    version: "wildz.ambient-life.v1" as const,
    id: `wildz.ambient.v1:${medium}:${regionX}:${regionZ}:${slot}:${hash64(regionX, regionZ, slot, medium === "aquatic" ? 71 : 73).toString(16).padStart(16, "0")}`,
    medium,
    variant: Math.floor(hashUnit(regionX, regionZ, slot, 79) * 3),
    members: 2 + Math.floor(hashUnit(regionX, regionZ, slot, 83) * 3),
    speed: quantize(.08 + hashUnit(regionX, regionZ, slot, 89) * .1),
    phase: quantize(hashUnit(regionX, regionZ, slot, 97)),
    path
  });
}

export function projectWildsAmbientLifeRegion(regionX: number, regionZ: number) {
  assertedRegion(regionX, "region_x");
  assertedRegion(regionZ, "region_z");
  const key = `${regionX}:${regionZ}`;
  const existing = regionCache.get(key);
  if (existing) return existing;

  const projected: WildsAmbientLifeProjection[] = [];
  for (let slot = 0; slot < 7 && projected.filter((life) => life.medium === "aquatic").length < 2; slot += 1) {
    const path = aquaticPath(regionX, regionZ, slot);
    if (path) projected.push(makeProjection(regionX, regionZ, slot, "aquatic", path));
  }
  for (let slot = 0; slot < 2; slot += 1) {
    projected.push(makeProjection(regionX, regionZ, slot, "aerial", aerialPath(regionX, regionZ, slot)));
  }
  projected.sort((left, right) => left.id.localeCompare(right.id));
  const frozen = projected.length === 0 ? EMPTY_LIFE : Object.freeze(projected);
  regionBuilds += 1;
  boundedCacheSet(regionCache, key, frozen, REGION_CACHE_LIMIT);
  return frozen;
}

export function projectWildsAmbientLifeNeighborhood(position: Readonly<{ x: number; z: number }>, tier: WildsQualityTier) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return EMPTY_LIFE;
  const regionX = Math.floor(position.x / WILDS_AMBIENT_REGION_SIZE);
  const regionZ = Math.floor(position.z / WILDS_AMBIENT_REGION_SIZE);
  const key = `${regionX}:${regionZ}:${tier}`;
  const existing = neighborhoodCache.get(key);
  if (existing) return existing;

  const projected: WildsAmbientLifeProjection[] = [];
  for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) {
    projected.push(...projectWildsAmbientLifeRegion(regionX + dx, regionZ + dz));
  }
  projected.sort((left, right) => left.id.localeCompare(right.id));
  const frozen = Object.freeze(projected.slice(0, QUALITY_CAPS[tier]));
  neighborhoodBuilds += 1;
  boundedCacheSet(neighborhoodCache, key, frozen, NEIGHBORHOOD_CACHE_LIMIT);
  return frozen;
}

export function projectWildsAmbientLifeLod(life: Pick<WildsAmbientLifeProjection, "id">, distance: number): WildsAmbientLifeLod {
  const detail = distance <= 8 ? "full" : distance <= 24 ? "simple" : "silhouette";
  return Object.freeze({ id: life.id, visible: true, detail });
}

export function wildsAmbientLifeDiagnostics() {
  return Object.freeze({ regionBuilds, neighborhoodBuilds, terrainSamples, regionCacheSize: regionCache.size, neighborhoodCacheSize: neighborhoodCache.size });
}
