import { sampleWildsTerrain } from "./wilds-terrain-authority";
import type { WildsTraversalCapability } from "./wilds-traversal-capabilities";

export const WILDS_DISCOVERY_SITE_VERSION = "wildz.discovery-site.v1" as const;
export const WILDS_DISCOVERY_SITE_REGION_SIZE = 128;

const SITES_PER_REGION = 4;
const MAX_REGION_CACHE_SIZE = 96;
const MAX_NEIGHBORHOOD_CACHE_SIZE = 48;
const WILDS_SITE_WORLD_LIMIT = 500_000_000;
const MIN_SITE_REGION = Math.floor(-WILDS_SITE_WORLD_LIMIT / WILDS_DISCOVERY_SITE_REGION_SIZE);
const MAX_SITE_REGION = Math.ceil(WILDS_SITE_WORLD_LIMIT / WILDS_DISCOVERY_SITE_REGION_SIZE) - 1;
const SURFACE_INDEX_CELL_SIZE = 16;
const EMPTY_INDEX_VALUES = Object.freeze([]) as readonly never[];

export type WildsDiscoverySiteFamily =
  | "cave"
  | "mountain-pass"
  | "hidden-valley"
  | "canyon"
  | "submerged-grotto"
  | "reef"
  | "trench"
  | "ruin"
  | "canopy-route"
  | "spring"
  | "cavern"
  | "sky-island";

export type WildsDiscoveryRouteRequirement =
  | WildsTraversalCapability
  | "light"
  | "track"
  | "break"
  | "burrow"
  | "current"
  | "pressure"
  | "balance"
  | "cold"
  | "storm-anchor";

type Point3 = Readonly<{ x: number; y: number; z: number }>;

export type WildsDiscoverySiteProjection = Readonly<{
  version: typeof WILDS_DISCOVERY_SITE_VERSION;
  key: string;
  regionX: number;
  regionZ: number;
  slot: number;
  family: WildsDiscoverySiteFamily;
  entrance: Point3 & Readonly<{ radius: number; layer: "ground" | "water" | "air" }>;
  collisionEnvelope: Readonly<{ center: Point3; halfExtents: Point3 }>;
  routes: readonly Readonly<{
    id: string;
    safe: boolean;
    requirements: readonly WildsDiscoveryRouteRequirement[];
    rewardTier: 0 | 1 | 2 | 3;
    points: readonly Point3[];
  }>[];
  habitat: Readonly<{ layer: "ground" | "surface" | "water-column" | "seabed" | "air"; biome: string }>;
  mountain: Readonly<{
    scaleClass: "hill" | "mountain" | "massif";
    summitY: number;
    visibleFromGround: true;
    visibleDuringFlight: true;
    overflight: Readonly<{ lift: number; endurance: number; control: number; weatherTolerance: number }>;
  }> | null;
  waterfall: Readonly<{
    source: Point3;
    lip: Point3;
    flowPath: readonly Point3[];
    pool: Point3;
    mistRadius: number;
    current: number;
    hiddenEntrance: Point3 | null;
  }> | null;
  interior: Readonly<{
    kind: "none" | "cave";
    scaleClass: "none" | "shelter" | "cavern" | "underground-world";
    chambers: readonly Readonly<{ id: string; center: Point3; radius: number }>[];
    exits: readonly Point3[];
    streamRadius: number;
  }>;
}>;

export type WildsDiscoverySiteApproach = Readonly<{
  siteKey: string;
  lod: "distant" | "approach" | "interior";
  visible: true;
  physical: boolean;
  interiorAdmitted: boolean;
  entrance: WildsDiscoverySiteProjection["entrance"];
  collisionEnvelope: WildsDiscoverySiteProjection["collisionEnvelope"];
}>;

export type WildsSiteSurface = Readonly<{
  id: string;
  siteKey: string;
  spaceId: string;
  kind: "terrain-overlay" | "interior-floor";
  center: Point3;
  halfExtents: Point3;
  flooded: boolean;
}>;

export type WildsDiscoveryPhysicalNeighborhood = Readonly<{
  version: "wildz.site-physical-neighborhood.v1";
  regionX: number;
  regionZ: number;
  sites: readonly WildsDiscoverySiteProjection[];
  surfaces: readonly WildsSiteSurface[];
  solids: readonly Readonly<{ id: string; siteKey: string; spaceId: string; center: Point3; halfExtents: Point3 }>[];
  ceilings: readonly Readonly<{ id: string; siteKey: string; spaceId: string; center: Point3; halfExtents: Point3 }>[];
  portals: readonly Readonly<{ id: string; siteKey: string; position: Point3; fromSpaceId: "wildz.space.outer.v1"; toSpaceId: string }>[];
  waterVolumes: readonly Readonly<{
    id: string;
    siteKey: string;
    spaceId: string;
    kind: "waterfall" | "pool" | "flooded-interior";
    center: Point3;
    halfExtents: Point3;
    source: Point3;
    lip: Point3;
    flowPath: readonly Point3[];
    pool: Point3;
    current: number;
  }>[];
  encounterVolumes: readonly Readonly<{
    id: string;
    siteKey: string;
    spaceId: string;
    layer: "ground" | "surface" | "water-column" | "seabed" | "air";
    center: Point3;
    halfExtents: Point3;
  }>[];
}>;

export type WildsSiteSpaceState = Readonly<{
  version: "wildz.site-space-state.v1";
  spaceId: string;
  siteKey: string | null;
  surfaceId: string | null;
  position: Point3;
  flooded: boolean;
}>;

const regionCache = new Map<string, readonly WildsDiscoverySiteProjection[]>();
const neighborhoodCache = new Map<string, readonly WildsDiscoverySiteProjection[]>();
const physicalNeighborhoodCache = new Map<string, WildsDiscoveryPhysicalNeighborhood>();
type PhysicalIndex = Readonly<{
  surfaces: Map<string, Map<number, Map<number, readonly WildsSiteSurface[]>>>;
  ceilings: Map<string, Map<number, Map<number, readonly WildsDiscoveryPhysicalNeighborhood["ceilings"][number][]>>>;
}>;
const physicalIndexes = new WeakMap<WildsDiscoveryPhysicalNeighborhood, PhysicalIndex>();
let regionsBuilt = 0;
let neighborhoodsBuilt = 0;
let physicalNeighborhoodsBuilt = 0;
let surfaceIndexesBuilt = 0;
let terrainSamples = 0;

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertedInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`wilds_discovery_site_${name}_invalid`);
  return BigInt(value);
}

function assertedRegion(value: number, name: "region_x" | "region_z") {
  assertedInteger(value, name);
  if (value < MIN_SITE_REGION || value > MAX_SITE_REGION) throw new Error(`wilds_discovery_site_${name}_invalid`);
}

function hash64(regionX: number, regionZ: number, slot: number, salt: number) {
  let value = BigInt.asUintN(64,
    assertedInteger(regionX, "region_x") * 0x9e3779b185ebca87n
    ^ assertedInteger(regionZ, "region_z") * 0xc2b2ae3d27d4eb4fn
    ^ assertedInteger(slot, "slot") * 0x165667b19e3779f9n
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

export function wildsDiscoverySiteRegionForPosition(position: Readonly<{ x: number; z: number }>) {
  const maximumPlayable = WILDS_SITE_WORLD_LIMIT - .000001;
  const x = Number.isFinite(position.x) ? Math.max(-WILDS_SITE_WORLD_LIMIT, Math.min(maximumPlayable, position.x)) : 0;
  const z = Number.isFinite(position.z) ? Math.max(-WILDS_SITE_WORLD_LIMIT, Math.min(maximumPlayable, position.z)) : 0;
  return Object.freeze({
    x: Math.floor(x / WILDS_DISCOVERY_SITE_REGION_SIZE),
    z: Math.floor(z / WILDS_DISCOVERY_SITE_REGION_SIZE)
  });
}

export function isCanonicalWildsDiscoverySiteKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^wildz\.site\.v1:(-?\d+):(-?\d+):(\d+):([a-f0-9]{16})$/);
  if (!match) return false;
  const regionX = Number(match[1]);
  const regionZ = Number(match[2]);
  const slot = Number(match[3]);
  if (!Number.isSafeInteger(regionX) || !Number.isSafeInteger(regionZ)
    || regionX < MIN_SITE_REGION || regionX > MAX_SITE_REGION
    || regionZ < MIN_SITE_REGION || regionZ > MAX_SITE_REGION) return false;
  if (!Number.isSafeInteger(slot) || slot < 0 || slot >= SITES_PER_REGION) return false;
  return match[4] === hash64(regionX, regionZ, slot, 23).toString(16).padStart(16, "0");
}

function freezePoint(x: number, y: number, z: number): Point3 {
  return Object.freeze({ x: quantize(x), y: quantize(y), z: quantize(z) });
}

function siteFamily(slot: number, surface: ReturnType<typeof sampleWildsTerrain>["surface"], lane: number): WildsDiscoverySiteFamily {
  if (slot === 0) return "mountain-pass";
  if (slot === 1) return lane < .5 ? "cave" : "cavern";
  if (slot === 3) return lane < .36 ? "sky-island" : lane < .68 ? "canopy-route" : "ruin";
  if (surface === "deep-water") return lane < .34 ? "trench" : lane < .67 ? "reef" : "submerged-grotto";
  if (surface === "shallow-water") return lane < .5 ? "spring" : "reef";
  return lane < .25 ? "hidden-valley" : lane < .5 ? "canyon" : lane < .75 ? "spring" : "ruin";
}

function mountainFor(regionX: number, regionZ: number, slot: number, entrance: Point3) {
  if (slot !== 0) return null;
  const lane = hashUnit(regionX, regionZ, slot, 101);
  const scaleClass = lane < 1 / 3 ? "hill" as const : lane < 2 / 3 ? "mountain" as const : "massif" as const;
  const rise = scaleClass === "hill" ? 8 : scaleClass === "mountain" ? 26 : 74;
  const threshold = scaleClass === "hill" ? 24 : scaleClass === "mountain" ? 55 : 86;
  return Object.freeze({
    scaleClass,
    summitY: quantize(entrance.y + rise),
    visibleFromGround: true as const,
    visibleDuringFlight: true as const,
    overflight: Object.freeze({
      lift: threshold,
      endurance: threshold - 8,
      control: threshold - 12,
      weatherTolerance: scaleClass === "massif" ? 78 : scaleClass === "mountain" ? 42 : 18
    })
  });
}

function waterfallFor(regionX: number, regionZ: number, slot: number, entrance: Point3, summitY: number | null) {
  if (slot !== 0 || hashUnit(regionX, regionZ, slot, 107) >= .42 || summitY === null) return null;
  const source = freezePoint(entrance.x, summitY - 2, entrance.z + 1.6);
  const lip = freezePoint(entrance.x, (source.y + entrance.y) / 2, entrance.z + .8);
  const pool = freezePoint(entrance.x, entrance.y - .18, entrance.z);
  return Object.freeze({
    source,
    lip,
    flowPath: Object.freeze([source, lip, pool]),
    pool,
    mistRadius: 4.5,
    current: quantize(.35 + hashUnit(regionX, regionZ, slot, 109) * .55),
    hiddenEntrance: hashUnit(regionX, regionZ, slot, 113) < .5 ? freezePoint(pool.x + .8, pool.y - .35, pool.z - .55) : null
  });
}

function interiorFor(
  regionX: number,
  regionZ: number,
  slot: number,
  entrance: Point3,
  family: WildsDiscoverySiteFamily,
  hiddenWaterfallEntrance: boolean
) {
  if (slot !== 1 && family !== "submerged-grotto" && !hiddenWaterfallEntrance) return Object.freeze({
    kind: "none" as const,
    scaleClass: "none" as const,
    chambers: Object.freeze([]),
    exits: Object.freeze([entrance]),
    streamRadius: 0
  });
  const lane = hashUnit(regionX, regionZ, slot, 127);
  const scaleClass = family === "submerged-grotto" || hiddenWaterfallEntrance ? "cavern" as const
    : lane < 1 / 3 ? "shelter" as const : lane < 2 / 3 ? "cavern" as const : "underground-world" as const;
  const chamberCount = scaleClass === "shelter" ? 1 : scaleClass === "cavern" ? 4 : 10;
  const chambers = Array.from({ length: chamberCount }, (_, index) => Object.freeze({
    id: `chamber:${index}`,
    center: freezePoint(entrance.x + index * 4.2 + 3, entrance.y - Math.min(index * .45, 4), entrance.z + (index % 2 === 0 ? 2.4 : -2.4)),
    radius: quantize(2.2 + hashUnit(regionX, regionZ, slot, 211 + index) * 2.8)
  }));
  const final = chambers.at(-1)!.center;
  const exits = scaleClass === "underground-world"
    ? Object.freeze([entrance, freezePoint(final.x + 3, final.y + 1, final.z)])
    : Object.freeze([entrance]);
  return Object.freeze({
    kind: "cave" as const,
    scaleClass,
    chambers: Object.freeze(chambers),
    exits,
    streamRadius: scaleClass === "shelter" ? 18 : scaleClass === "cavern" ? 42 : 86
  });
}

function buildSite(regionX: number, regionZ: number, slot: number): WildsDiscoverySiteProjection {
  const quadrantX = slot % 2;
  const quadrantZ = Math.floor(slot / 2);
  const laneX = (quadrantX === 0 ? .25 : .75) + (hashUnit(regionX, regionZ, slot, 11) - .5) * .12;
  const laneZ = (quadrantZ === 0 ? .25 : .75) + (hashUnit(regionX, regionZ, slot, 13) - .5) * .12;
  const x = regionX * WILDS_DISCOVERY_SITE_REGION_SIZE + laneX * WILDS_DISCOVERY_SITE_REGION_SIZE;
  const z = regionZ * WILDS_DISCOVERY_SITE_REGION_SIZE + laneZ * WILDS_DISCOVERY_SITE_REGION_SIZE;
  const terrain = sampleWildsTerrain(x, z);
  terrainSamples += 1;
  const family = siteFamily(slot, terrain.surface, hashUnit(regionX, regionZ, slot, 17));
  const layer = family === "sky-island" ? "air" as const
    : family === "reef" || family === "trench" || family === "submerged-grotto" ? "water" as const
    : "ground" as const;
  const entranceY = layer === "air" ? terrain.elevation + 12 : terrain.elevation;
  const entrance = Object.freeze({ ...freezePoint(x, entranceY, z), radius: layer === "air" ? 4.5 : 2.2, layer });
  const mountain = mountainFor(regionX, regionZ, slot, entrance);
  const waterfall = waterfallFor(regionX, regionZ, slot, entrance, mountain?.summitY ?? null);
  const interiorAnchor = waterfall?.hiddenEntrance ?? entrance;
  const interior = interiorFor(regionX, regionZ, slot, interiorAnchor, family, waterfall?.hiddenEntrance !== null && waterfall !== null);
  const ordinaryStart = freezePoint(entrance.x, entrance.y, entrance.z - 6);
  const ordinaryEnd = freezePoint(entrance.x, entrance.y + (mountain ? 1.5 : 0), entrance.z + 5);
  const requirement: WildsDiscoveryRouteRequirement = layer === "water" ? "swim" : layer === "air" ? "glide" : mountain ? "climb" : "track";
  const routes = Object.freeze([
    Object.freeze({
      id: `site-route:${regionX}:${regionZ}:${slot}:ordinary`,
      safe: true,
      requirements: Object.freeze([]) as readonly WildsDiscoveryRouteRequirement[],
      rewardTier: 0 as const,
      points: Object.freeze([ordinaryStart, entrance, ordinaryEnd])
    }),
    Object.freeze({
      id: `site-route:${regionX}:${regionZ}:${slot}:ability`,
      safe: false,
      requirements: Object.freeze([requirement]),
      rewardTier: mountain?.scaleClass === "massif" ? 3 as const : 2 as const,
      points: Object.freeze([entrance, freezePoint(entrance.x + 2, mountain?.summitY ?? entrance.y + 4, entrance.z - 3)])
    })
  ]);
  const extent = mountain?.scaleClass === "massif" ? 38 : mountain?.scaleClass === "mountain" ? 22 : 8;
  return Object.freeze({
    version: WILDS_DISCOVERY_SITE_VERSION,
    key: `wildz.site.v1:${regionX}:${regionZ}:${slot}:${hash64(regionX, regionZ, slot, 23).toString(16).padStart(16, "0")}`,
    regionX,
    regionZ,
    slot,
    family,
    entrance,
    collisionEnvelope: Object.freeze({
      center: freezePoint(entrance.x, entrance.y + extent / 2, entrance.z),
      halfExtents: freezePoint(extent, Math.max(2, extent / 2), extent)
    }),
    routes,
    habitat: Object.freeze({
      layer: layer === "air" ? "air" as const : layer === "water" ? (terrain.surface === "deep-water" ? "seabed" as const : "surface" as const) : "ground" as const,
      biome: terrain.regionId
    }),
    mountain,
    waterfall,
    interior
  });
}

function trimCache<T>(cache: Map<string, T>, limit: number) {
  while (cache.size > limit) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function addBoxToIndex<T extends { spaceId: string; center: Point3; halfExtents: Point3 }>(
  index: Map<string, Map<number, Map<number, T[]>>>,
  value: T
) {
  let space = index.get(value.spaceId);
  if (!space) {
    space = new Map();
    index.set(value.spaceId, space);
  }
  const minX = Math.floor((value.center.x - value.halfExtents.x) / SURFACE_INDEX_CELL_SIZE);
  const maxX = Math.floor((value.center.x + value.halfExtents.x) / SURFACE_INDEX_CELL_SIZE);
  const minZ = Math.floor((value.center.z - value.halfExtents.z) / SURFACE_INDEX_CELL_SIZE);
  const maxZ = Math.floor((value.center.z + value.halfExtents.z) / SURFACE_INDEX_CELL_SIZE);
  for (let cellX = minX; cellX <= maxX; cellX += 1) {
    let column = space.get(cellX);
    if (!column) {
      column = new Map();
      space.set(cellX, column);
    }
    for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
      const bucket = column.get(cellZ);
      if (bucket) bucket.push(value);
      else column.set(cellZ, [value]);
    }
  }
}

function buildPhysicalIndex(physical: WildsDiscoveryPhysicalNeighborhood) {
  const surfaces = new Map<string, Map<number, Map<number, WildsSiteSurface[]>>>();
  const ceilings = new Map<string, Map<number, Map<number, Array<WildsDiscoveryPhysicalNeighborhood["ceilings"][number]>>>>();
  for (const surface of physical.surfaces) addBoxToIndex(surfaces, surface);
  for (const ceiling of physical.ceilings) addBoxToIndex(ceilings, ceiling);
  physicalIndexes.set(physical, { surfaces, ceilings });
  surfaceIndexesBuilt += 1;
}

function indexedValues<T>(
  index: Map<string, Map<number, Map<number, readonly T[]>>>,
  spaceId: string,
  x: number,
  z: number
): readonly T[] | undefined {
  return index.get(spaceId)
    ?.get(Math.floor(x / SURFACE_INDEX_CELL_SIZE))
    ?.get(Math.floor(z / SURFACE_INDEX_CELL_SIZE));
}

export function wildsDiscoverySitesForRegion(regionX: number, regionZ: number): readonly WildsDiscoverySiteProjection[] {
  assertedRegion(regionX, "region_x");
  assertedRegion(regionZ, "region_z");
  const key = `${regionX}:${regionZ}`;
  const cached = regionCache.get(key);
  if (cached) return cached;
  const retained: Array<WildsDiscoverySiteProjection | undefined> = Array.from({ length: SITES_PER_REGION });
  for (const physical of physicalNeighborhoodCache.values()) {
    for (const site of physical.sites) {
      if (site.regionX === regionX && site.regionZ === regionZ) retained[site.slot] = site;
    }
  }
  if (retained.every((site): site is WildsDiscoverySiteProjection => site !== undefined)) {
    const sites = Object.freeze(retained);
    regionCache.set(key, sites);
    trimCache(regionCache, MAX_REGION_CACHE_SIZE);
    return sites;
  }
  const sites = Object.freeze(Array.from({ length: SITES_PER_REGION }, (_, slot) => buildSite(regionX, regionZ, slot)));
  regionsBuilt += 1;
  regionCache.set(key, sites);
  trimCache(regionCache, MAX_REGION_CACHE_SIZE);
  return sites;
}

export function admitWildsDiscoveryNeighborhood(regionX: number, regionZ: number): readonly WildsDiscoverySiteProjection[] {
  assertedRegion(regionX, "region_x");
  assertedRegion(regionZ, "region_z");
  const key = `${regionX}:${regionZ}`;
  const cached = neighborhoodCache.get(key);
  if (cached) return cached;
  const sites: WildsDiscoverySiteProjection[] = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    const admittedRegionZ = regionZ + dz;
    if (admittedRegionZ < MIN_SITE_REGION || admittedRegionZ > MAX_SITE_REGION) continue;
    for (let dx = -1; dx <= 1; dx += 1) {
      const admittedRegionX = regionX + dx;
      if (admittedRegionX < MIN_SITE_REGION || admittedRegionX > MAX_SITE_REGION) continue;
      sites.push(...wildsDiscoverySitesForRegion(admittedRegionX, admittedRegionZ));
    }
  }
  const admitted = Object.freeze(sites);
  neighborhoodsBuilt += 1;
  neighborhoodCache.set(key, admitted);
  trimCache(neighborhoodCache, MAX_NEIGHBORHOOD_CACHE_SIZE);
  return admitted;
}

function outerSpaceId() {
  return "wildz.space.outer.v1" as const;
}

function interiorSpaceId(siteKey: string) {
  return `wildz.space.v1:${siteKey}:interior`;
}

function buildPhysicalNeighborhood(regionX: number, regionZ: number): WildsDiscoveryPhysicalNeighborhood {
  const sites = admitWildsDiscoveryNeighborhood(regionX, regionZ);
  const surfaces: WildsSiteSurface[] = [];
  const solids: Array<WildsDiscoveryPhysicalNeighborhood["solids"][number]> = [];
  const ceilings: Array<WildsDiscoveryPhysicalNeighborhood["ceilings"][number]> = [];
  const portals: Array<WildsDiscoveryPhysicalNeighborhood["portals"][number]> = [];
  const waterVolumes: Array<WildsDiscoveryPhysicalNeighborhood["waterVolumes"][number]> = [];
  const encounterVolumes: Array<WildsDiscoveryPhysicalNeighborhood["encounterVolumes"][number]> = [];

  for (const site of sites) {
    const outerId = outerSpaceId();
    surfaces.push(Object.freeze({
      id: `surface:${site.key}:outer`,
      siteKey: site.key,
      spaceId: outerId,
      kind: "terrain-overlay" as const,
      center: freezePoint(site.entrance.x, site.entrance.y, site.entrance.z),
      halfExtents: freezePoint(Math.max(3, site.entrance.radius * 2), .12, Math.max(3, site.entrance.radius * 2)),
      flooded: site.entrance.layer === "water"
    }));
    for (let routeIndex = 0; routeIndex < site.routes.length; routeIndex += 1) {
      const route = site.routes[routeIndex]!;
      for (let pointIndex = 0; pointIndex < route.points.length; pointIndex += 1) {
        const point = route.points[pointIndex]!;
        surfaces.push(Object.freeze({
          id: `surface:${site.key}:route:${routeIndex}:${pointIndex}`,
          siteKey: site.key,
          spaceId: outerId,
          kind: "terrain-overlay" as const,
          center: point,
          halfExtents: freezePoint(3.25, .35, 3.25),
          flooded: site.entrance.layer === "water"
        }));
      }
    }
    encounterVolumes.push(Object.freeze({
      id: `encounter-volume:${site.key}:outer`,
      siteKey: site.key,
      spaceId: outerId,
      layer: site.habitat.layer,
      center: freezePoint(site.entrance.x, site.entrance.y + 1.2, site.entrance.z),
      halfExtents: freezePoint(5, 2.5, 5)
    }));

    if (site.mountain) {
      const height = site.mountain.summitY - site.entrance.y;
      const width = site.mountain.scaleClass === "massif" ? 34 : site.mountain.scaleClass === "mountain" ? 20 : 9;
      solids.push(Object.freeze({
        id: `solid:${site.key}:ridge-west`,
        siteKey: site.key,
        spaceId: outerId,
        center: freezePoint(site.entrance.x - width * .62, site.entrance.y + height / 2, site.entrance.z),
        halfExtents: freezePoint(width * .45, height / 2, width)
      }));
      solids.push(Object.freeze({
        id: `solid:${site.key}:ridge-east`,
        siteKey: site.key,
        spaceId: outerId,
        center: freezePoint(site.entrance.x + width * .62, site.entrance.y + height / 2, site.entrance.z),
        halfExtents: freezePoint(width * .45, height / 2, width)
      }));
    }

    if (site.interior.kind === "cave") {
      const spaceId = interiorSpaceId(site.key);
      const flooded = site.entrance.layer === "water";
      for (let chamberIndex = 0; chamberIndex < site.interior.chambers.length; chamberIndex += 1) {
        const chamber = site.interior.chambers[chamberIndex]!;
        const floorCenter = freezePoint(chamber.center.x, chamber.center.y - 1, chamber.center.z);
        const halfExtent = quantize(chamber.radius + 1);
        surfaces.push(Object.freeze({
          id: `surface:${site.key}:interior-floor:${chamberIndex}`,
          siteKey: site.key,
          spaceId,
          kind: "interior-floor" as const,
          center: floorCenter,
          halfExtents: freezePoint(halfExtent, .12, halfExtent),
          flooded
        }));
        ceilings.push(Object.freeze({
          id: `ceiling:${site.key}:interior:${chamberIndex}`,
          siteKey: site.key,
          spaceId,
          center: freezePoint(floorCenter.x, floorCenter.y + 5.5, floorCenter.z),
          halfExtents: freezePoint(halfExtent, .25, halfExtent)
        }));
        const previous = site.interior.chambers[chamberIndex - 1];
        if (previous) {
          const previousFloorY = previous.center.y - 1;
          const corridorCenter = freezePoint(
            (previous.center.x + chamber.center.x) / 2,
            (previousFloorY + floorCenter.y) / 2,
            (previous.center.z + chamber.center.z) / 2
          );
          const corridorHalfX = Math.abs(chamber.center.x - previous.center.x) / 2 + 1.25;
          const corridorHalfZ = Math.abs(chamber.center.z - previous.center.z) / 2 + 1.25;
          surfaces.push(Object.freeze({
            id: `surface:${site.key}:interior-corridor:${chamberIndex - 1}`,
            siteKey: site.key,
            spaceId,
            kind: "interior-floor" as const,
            center: corridorCenter,
            halfExtents: freezePoint(corridorHalfX, .5, corridorHalfZ),
            flooded
          }));
          ceilings.push(Object.freeze({
            id: `ceiling:${site.key}:interior-corridor:${chamberIndex - 1}`,
            siteKey: site.key,
            spaceId,
            center: freezePoint(corridorCenter.x, corridorCenter.y + 4.5, corridorCenter.z),
            halfExtents: freezePoint(corridorHalfX, .5, corridorHalfZ)
          }));
        }
      }
      const portalPosition = site.waterfall?.hiddenEntrance ?? site.entrance;
      portals.push(Object.freeze({
        id: `portal:${site.key}:entrance`,
        siteKey: site.key,
        position: freezePoint(portalPosition.x, portalPosition.y, portalPosition.z),
        fromSpaceId: outerId,
        toSpaceId: spaceId
      }));
      const interiorFloors = surfaces.filter((surface) => surface.spaceId === spaceId);
      const firstFloor = interiorFloors[0]!;
      const lastFloor = interiorFloors.at(-1)!;
      encounterVolumes.push(Object.freeze({
        id: `encounter-volume:${site.key}:interior`,
        siteKey: site.key,
        spaceId,
        layer: flooded ? "water-column" as const : "ground" as const,
        center: freezePoint((firstFloor.center.x + lastFloor.center.x) / 2, (firstFloor.center.y + lastFloor.center.y) / 2 + 1.5, (firstFloor.center.z + lastFloor.center.z) / 2),
        halfExtents: freezePoint(Math.abs(lastFloor.center.x - firstFloor.center.x) / 2 + 5, 2.5, Math.abs(lastFloor.center.z - firstFloor.center.z) / 2 + 5)
      }));
      if (flooded) {
        for (let floorIndex = 0; floorIndex < interiorFloors.length; floorIndex += 1) {
          const floor = interiorFloors[floorIndex]!;
          const pool = floor.center;
          waterVolumes.push(Object.freeze({
            id: floorIndex === 0 ? `water:${site.key}:interior` : `water:${site.key}:interior:${floorIndex}`,
            siteKey: site.key,
            spaceId,
            kind: "flooded-interior" as const,
            center: freezePoint(pool.x, pool.y + 1.4, pool.z),
            halfExtents: freezePoint(floor.halfExtents.x, 1.5, floor.halfExtents.z),
            source: pool,
            lip: pool,
            flowPath: Object.freeze([pool]),
            pool,
            current: .18
          }));
        }
      }
    }

    if (site.waterfall) {
      const water = site.waterfall;
      waterVolumes.push(Object.freeze({
        id: `water:${site.key}:waterfall`,
        siteKey: site.key,
        spaceId: outerId,
        kind: "waterfall" as const,
        center: freezePoint((water.source.x + water.pool.x) / 2, (water.source.y + water.pool.y) / 2, (water.source.z + water.pool.z) / 2),
        halfExtents: freezePoint(2.4, (water.source.y - water.pool.y) / 2, 2.4),
        source: water.source,
        lip: water.lip,
        flowPath: water.flowPath,
        pool: water.pool,
        current: water.current
      }));
      waterVolumes.push(Object.freeze({
        id: `water:${site.key}:pool`,
        siteKey: site.key,
        spaceId: outerId,
        kind: "pool" as const,
        center: freezePoint(water.pool.x, water.pool.y + .45, water.pool.z),
        halfExtents: freezePoint(3.5, .55, 3.5),
        source: water.source,
        lip: water.lip,
        flowPath: water.flowPath,
        pool: water.pool,
        current: water.current
      }));
    }
  }

  physicalNeighborhoodsBuilt += 1;
  const physical = Object.freeze({
    version: "wildz.site-physical-neighborhood.v1" as const,
    regionX,
    regionZ,
    sites,
    surfaces: Object.freeze(surfaces),
    solids: Object.freeze(solids),
    ceilings: Object.freeze(ceilings),
    portals: Object.freeze(portals),
    waterVolumes: Object.freeze(waterVolumes),
    encounterVolumes: Object.freeze(encounterVolumes)
  });
  buildPhysicalIndex(physical);
  return physical;
}

export function admitWildsDiscoveryPhysicalNeighborhood(regionX: number, regionZ: number) {
  assertedRegion(regionX, "region_x");
  assertedRegion(regionZ, "region_z");
  const key = `${regionX}:${regionZ}`;
  const cached = physicalNeighborhoodCache.get(key);
  if (cached) return cached;
  const projection = buildPhysicalNeighborhood(regionX, regionZ);
  physicalNeighborhoodCache.set(key, projection);
  trimCache(physicalNeighborhoodCache, MAX_NEIGHBORHOOD_CACHE_SIZE);
  return projection;
}

export function wildsSiteSurfaceAt(
  physical: WildsDiscoveryPhysicalNeighborhood,
  spaceId: string,
  x: number,
  z: number,
  worldY: number
) {
  const index = physicalIndexes.get(physical);
  if (!index) throw new Error("wilds_site_physical_index_not_admitted");
  let nearest: WildsSiteSurface | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const surface of indexedValues(index.surfaces, spaceId, x, z) ?? EMPTY_INDEX_VALUES) {
    if (Math.abs(x - surface.center.x) > surface.halfExtents.x || Math.abs(z - surface.center.z) > surface.halfExtents.z) continue;
    const distance = Math.abs(worldY - surface.center.y);
    if (worldY < surface.center.y - .75 || worldY > surface.center.y + 2.25) continue;
    if (distance < nearestDistance) {
      nearest = surface;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function writeWildsSitePhysicalSample(
  output: { surfaceId: string | null; floorY: number; ceilingY: number; flooded: boolean },
  physical: WildsDiscoveryPhysicalNeighborhood,
  spaceId: string,
  x: number,
  worldY: number,
  z: number
) {
  const surface = wildsSiteSurfaceAt(physical, spaceId, x, z, worldY);
  output.surfaceId = surface?.id ?? null;
  output.floorY = surface?.center.y ?? worldY;
  output.flooded = surface?.flooded ?? false;
  output.ceilingY = Number.POSITIVE_INFINITY;
  if (!surface) return output;
  const index = physicalIndexes.get(physical)!;
  let nearestCeiling = Number.POSITIVE_INFINITY;
  for (const ceiling of indexedValues(index.ceilings, spaceId, x, z) ?? EMPTY_INDEX_VALUES) {
    if (Math.abs(x - ceiling.center.x) > ceiling.halfExtents.x || Math.abs(z - ceiling.center.z) > ceiling.halfExtents.z) continue;
    const underside = ceiling.center.y - ceiling.halfExtents.y;
    if (underside >= worldY && underside < nearestCeiling) nearestCeiling = underside;
  }
  output.ceilingY = nearestCeiling;
  return output;
}

function legacyOuterSpace(position: Point3): WildsSiteSpaceState {
  return Object.freeze({
    version: "wildz.site-space-state.v1" as const,
    spaceId: outerSpaceId(),
    siteKey: null,
    surfaceId: null,
    position: freezePoint(position.x, position.y, position.z),
    flooded: false
  });
}

export function normalizeWildsSiteSpaceState(value: unknown, legacyPosition: Point3): WildsSiteSpaceState {
  if (!value || typeof value !== "object") return legacyOuterSpace(legacyPosition);
  const candidate = value as Record<string, unknown>;
  const position = candidate.position as Record<string, unknown> | undefined;
  if (candidate.version !== "wildz.site-space-state.v1"
    || typeof candidate.spaceId !== "string"
    || typeof candidate.siteKey !== "string"
    || typeof candidate.surfaceId !== "string"
    || !position
    || typeof position.x !== "number" || !Number.isFinite(position.x)
    || typeof position.y !== "number" || !Number.isFinite(position.y)
    || typeof position.z !== "number" || !Number.isFinite(position.z)) return legacyOuterSpace(legacyPosition);
  const restoredX = position.x as number;
  const restoredY = position.y as number;
  const restoredZ = position.z as number;
  if (!isCanonicalWildsDiscoverySiteKey(candidate.siteKey)) return legacyOuterSpace(legacyPosition);
  const match = candidate.siteKey.match(/^wildz\.site\.v1:(-?\d+):(-?\d+):(\d+):([a-f0-9]{16})$/)!;
  const regionX = Number(match[1]);
  const regionZ = Number(match[2]);
  const slot = Number(match[3]);
  if (!Number.isSafeInteger(regionX) || !Number.isSafeInteger(regionZ) || !Number.isSafeInteger(slot)) return legacyOuterSpace(legacyPosition);
  const site = wildsDiscoverySitesForRegion(regionX, regionZ)[slot];
  if (!site || site.key !== candidate.siteKey || candidate.spaceId !== interiorSpaceId(site.key)) return legacyOuterSpace(legacyPosition);
  const physical = admitWildsDiscoveryPhysicalNeighborhood(regionX, regionZ);
  const surface = physical.surfaces.find((entry) => entry.id === candidate.surfaceId && entry.spaceId === candidate.spaceId);
  const portal = physical.portals.find((entry) => entry.siteKey === site.key && entry.toSpaceId === candidate.spaceId);
  if (!surface || !portal) return legacyOuterSpace(legacyPosition);
  const admittedSurface = wildsSiteSurfaceAt(physical, candidate.spaceId, restoredX, restoredZ, restoredY);
  if (admittedSurface?.id !== surface.id) return legacyOuterSpace(legacyPosition);
  const ceiling = physical.ceilings.find((entry) => entry.spaceId === candidate.spaceId
    && Math.abs(restoredX - entry.center.x) <= entry.halfExtents.x
    && Math.abs(restoredZ - entry.center.z) <= entry.halfExtents.z);
  if (!ceiling || restoredY > ceiling.center.y - ceiling.halfExtents.y) return legacyOuterSpace(legacyPosition);
  return Object.freeze({
    version: "wildz.site-space-state.v1" as const,
    spaceId: candidate.spaceId,
    siteKey: site.key,
    surfaceId: surface.id,
    position: freezePoint(restoredX, restoredY, restoredZ),
    flooded: surface.flooded
  });
}

export function projectWildsSiteEncounterContext(
  site: WildsDiscoverySiteProjection,
  input: Readonly<{ spaceId: string; worldY: number }>
) {
  const admittedY = Number.isFinite(input.worldY) ? quantize(input.worldY) : site.entrance.y;
  const expectedInterior = interiorSpaceId(site.key);
  const spaceId = site.interior.kind === "cave" && input.spaceId === expectedInterior ? expectedInterior : outerSpaceId();
  const layer = spaceId === expectedInterior
    ? site.entrance.layer === "water" ? "water-column" as const : "ground" as const
    : site.habitat.layer;
  return Object.freeze({
    siteKey: site.key,
    spaceId,
    layer,
    worldY: admittedY,
    interactionBand: Object.freeze({ minY: quantize(admittedY - .85), maxY: quantize(admittedY + .85) })
  });
}

export function projectWildsDiscoverySiteApproach(site: WildsDiscoverySiteProjection, distance: number): WildsDiscoverySiteApproach {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : Number.POSITIVE_INFINITY;
  const lod = safeDistance > 120 ? "distant" as const : safeDistance > site.entrance.radius ? "approach" as const : "interior" as const;
  return Object.freeze({
    siteKey: site.key,
    lod,
    visible: true as const,
    physical: lod !== "distant",
    interiorAdmitted: lod === "interior" && site.interior.kind === "cave",
    entrance: site.entrance,
    collisionEnvelope: site.collisionEnvelope
  });
}

export function projectWildsDiscoverySiteFall(
  site: WildsDiscoverySiteProjection,
  input: Readonly<{ capabilities: readonly WildsTraversalCapability[]; fallDistance: number }>
) {
  const fallDistance = Number.isFinite(input.fallDistance) ? Math.max(0, input.fallDistance) : Number.POSITIVE_INFINITY;
  if (fallDistance < 3) return Object.freeze({ outcome: "safe" as const, impact: 0 });
  if (input.capabilities.some((capability) => capability === "flight" || capability === "glide" || capability === "climb")) {
    return Object.freeze({ outcome: "recovered" as const, impact: 0 });
  }
  return Object.freeze({ outcome: "impact" as const, impact: quantize(Math.min(100, fallDistance * (site.mountain ? 2.2 : 1.4))) });
}

export function projectWildsDiscoverySiteOverflight(
  site: WildsDiscoverySiteProjection,
  input: Readonly<{ lift: number; endurance: number; control: number; weatherTolerance: number }>
) {
  const values = [input.lift, input.endurance, input.control, input.weatherTolerance];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return Object.freeze({ admitted: false, reason: "invalid-envelope" as const });
  }
  if (!site.mountain) return Object.freeze({ admitted: true, reason: "clear" as const });
  const required = site.mountain.overflight;
  const admitted = input.lift >= required.lift
    && input.endurance >= required.endurance
    && input.control >= required.control
    && input.weatherTolerance >= required.weatherTolerance;
  return Object.freeze({ admitted, reason: admitted ? "clear" as const : "insufficient-envelope" as const });
}

export function wildsDiscoverySiteCacheSize() {
  return regionCache.size;
}

export function wildsDiscoveryPhysicalCacheSize() {
  return physicalNeighborhoodCache.size;
}

export function wildsDiscoverySiteDiagnostics() {
  return Object.freeze({ regionsBuilt, neighborhoodsBuilt, physicalNeighborhoodsBuilt, surfaceIndexesBuilt, terrainSamples });
}
