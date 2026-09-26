import { sha256PortableBasis } from "./portable-card";
import { parseWildsWorldAddress, type WildsWorldAddress } from "./wilds-world-address";

export const WILDS_REGION_GENERATOR_V11 = "wildz.region.v11" as const;
const REGION_SIZE = 24;
const MICRO_PER_UNIT = 1_000_000;
const REGION_CACHE_LIMIT = 128;
const cache = new Map<string, WildsRegionV11>();

export type WildsRegionSeedDomain = "terrain" | "site" | "resource" | "ambient";
export type WildsEncounterSiteV11 = Readonly<{
  slot: number;
  localX: number;
  localZ: number;
  seed: string;
}>;
export type WildsRegionV11 = Readonly<{
  version: typeof WILDS_REGION_GENERATOR_V11;
  regionX: string;
  regionZ: string;
  terrainSeed: string;
  terrainCorners: readonly [number, number, number, number];
  siteSeed: string;
  resourceSeed: string;
  ambientSeed: string;
  encounterSites: readonly WildsEncounterSiteV11[];
}>;
export type WildsLocalRegionProjection = Readonly<{
  version: typeof WILDS_REGION_GENERATOR_V11;
  regionX: string;
  regionZ: string;
  terrainSeed: string;
  resourceSeed: string;
  ambientSeed: string;
  encounterSites: readonly Readonly<{ slot: number; x: number; z: number; seed: string }>[];
}>;

function regionKey(regionX: string, regionZ: string) {
  return `${regionX.length}:${regionX}:${regionZ.length}:${regionZ}`;
}

function seedFor(regionX: string, regionZ: string, domain: WildsRegionSeedDomain | `site:${number}`) {
  return sha256PortableBasis(`${WILDS_REGION_GENERATOR_V11}\0${domain}\0${regionKey(regionX, regionZ)}`);
}

/** The four domains cannot accidentally share a sequence or a v10 numeric seed. */
export function wildsRegionSeedV11(regionX: string, regionZ: string, domain: WildsRegionSeedDomain): string {
  const address = parseWildsWorldAddress({ worldVersion: 11, regionX, regionZ, localX: 0, localZ: 0 });
  return seedFor(address.regionX, address.regionZ, domain);
}

function coordinateFromSeed(seed: string, offset: number): number {
  const fraction = Number.parseInt(seed.slice(7 + offset, 7 + offset + 8), 16) / 0x1_0000_0000;
  // Six fixed grid cells keep site centers separated even if hash fragments collide.
  return 2_000_000 + Math.floor(fraction * 2_000_000);
}

export function generateWildsRegionV11(regionX: string, regionZ: string): WildsRegionV11 {
  const address = parseWildsWorldAddress({ worldVersion: 11, regionX, regionZ, localX: 0, localZ: 0 });
  const key = regionKey(address.regionX, address.regionZ);
  const existing = cache.get(key);
  if (existing) return existing;
  const terrainSeed = seedFor(regionX, regionZ, "terrain");
  const cornerHeight = (x: bigint, z: bigint) => {
    const digest = seedFor(x.toString(), z.toString(), "terrain");
    return Math.round((Number.parseInt(digest.slice(7, 15), 16) / 0x1_0000_0000 * 24 - 8) * MICRO_PER_UNIT) / MICRO_PER_UNIT;
  };
  const x = BigInt(regionX);
  const z = BigInt(regionZ);
  const terrainCorners = Object.freeze([
    cornerHeight(x, z), cornerHeight(x + 1n, z),
    cornerHeight(x, z + 1n), cornerHeight(x + 1n, z + 1n)
  ]) as readonly [number, number, number, number];
  const siteSeed = seedFor(regionX, regionZ, "site");
  const resourceSeed = seedFor(regionX, regionZ, "resource");
  const ambientSeed = seedFor(regionX, regionZ, "ambient");
  const encounterSites = Object.freeze(Array.from({ length: 6 }, (_, slot) => {
    const seed = seedFor(regionX, regionZ, `site:${slot}`);
    const column = slot % 3;
    const row = Math.floor(slot / 3);
    return Object.freeze({
      slot,
      localX: column * 8_000_000 + coordinateFromSeed(seed, 0),
      localZ: row * 12_000_000 + coordinateFromSeed(seed, 8),
      seed
    });
  }));
  const region = Object.freeze({
    version: WILDS_REGION_GENERATOR_V11,
    regionX,
    regionZ,
    terrainSeed,
    terrainCorners,
    siteSeed,
    resourceSeed,
    ambientSeed,
    encounterSites
  });
  cache.set(key, region);
  while (cache.size > REGION_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return region;
}

/** Numeric coordinates are created only after subtracting a nearby origin. */
export function projectWildsLocalRegion(region: WildsRegionV11, originValue: WildsWorldAddress): WildsLocalRegionProjection {
  const origin = parseWildsWorldAddress(originValue);
  const deltaX = BigInt(region.regionX) - BigInt(origin.regionX);
  const deltaZ = BigInt(region.regionZ) - BigInt(origin.regionZ);
  if (deltaX < -1n || deltaX > 1n || deltaZ < -1n || deltaZ > 1n) {
    throw new RangeError("Distant Wilds region cannot enter a local projection");
  }
  return {
    version: WILDS_REGION_GENERATOR_V11,
    regionX: region.regionX,
    regionZ: region.regionZ,
    terrainSeed: region.terrainSeed,
    resourceSeed: region.resourceSeed,
    ambientSeed: region.ambientSeed,
    encounterSites: region.encounterSites.map(site => ({
      slot: site.slot,
      x: Number(deltaX) * REGION_SIZE + (site.localX - origin.localX) / MICRO_PER_UNIT,
      z: Number(deltaZ) * REGION_SIZE + (site.localZ - origin.localZ) / MICRO_PER_UNIT,
      seed: site.seed
    }))
  };
}

export function wildsRegionGeneratorV11CacheSize(): number {
  return cache.size;
}
