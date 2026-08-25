import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { sampleWildsTerrain } from "./wilds-terrain-authority";

// Pure v121-independent inspection authority. Harvest candidates are never
// proof objects and cannot mutate a source or inventory.

export const WILDS_RESOURCE_REGION_SIZE = 128;
const WORLD_LIMIT = 500_000_000;
const MIN_REGION = Math.floor(-WORLD_LIMIT / WILDS_RESOURCE_REGION_SIZE);
const MAX_REGION = Math.ceil(WORLD_LIMIT / WILDS_RESOURCE_REGION_SIZE) - 1;
const SOURCES_PER_REGION = 6;
const REGION_CACHE_LIMIT = 96;

export type WildsResourceKind = "timber" | "stone" | "ore" | "fiber" | "aquatic" | "buried";
export type WildsResourceWorkFamily = "lumber" | "quarry" | "mine" | "gather" | "recover" | "excavate";
export type WildsResourceToolFamily = "axe" | "hammer" | "pick" | "shears" | "dive-rig" | "shovel";

type Point3 = Readonly<{ x: number; y: number; z: number }>;

export type WildsResourceSource = Readonly<{
  schema: "wildz.resource-source.v1";
  sourceId: string;
  regionX: number;
  regionZ: number;
  slot: number;
  kind: WildsResourceKind;
  position: Point3;
  capacity: number;
  quality: 1 | 2 | 3 | 4 | 5;
  requirements: Readonly<{ creature: WildsResourceWorkFamily; tool: WildsResourceToolFamily }>;
  replenishment: Readonly<{ intervalPulses: number; capacityPerInterval: number }>;
}>;

export type WildsHarvestPreview = Readonly<{
  schema: "wildz.harvest-preview.v1";
  valid: boolean;
  reason: string | null;
  physical: false;
  publish: "blocked-receiz-v122";
  writes: 0;
  candidate: Readonly<{
    schema: "wildz.resource-candidate.v1";
    candidateDigest: string;
    kind: WildsResourceKind;
    capacity: number;
    quality: number;
    origin: Readonly<{ sourceId: string; position: Point3; sourceHead: string; kaiPulse: string }>;
    contributors: Readonly<{ explorerSubjectId: string; creatureSubjectId: string; toolSubjectId: string }>;
    heads: Readonly<{ creature: string; tool: string }>;
  }> | null;
}>;

const regionCache = new Map<string, readonly WildsResourceSource[]>();
let regionsBuilt = 0;

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) freeze(entry);
    return Object.freeze(value);
  }
  return value;
}

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertRegion(value: number, axis: "x" | "z") {
  if (!Number.isSafeInteger(value) || value < MIN_REGION || value > MAX_REGION) throw new Error(`wilds_resource_region_${axis}_invalid`);
}

function hash64(regionX: number, regionZ: number, slot: number, salt: number) {
  let value = BigInt.asUintN(64,
    BigInt(regionX) * 0x9e3779b185ebca87n
    ^ BigInt(regionZ) * 0xc2b2ae3d27d4eb4fn
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

function unit(regionX: number, regionZ: number, slot: number, salt: number) {
  return Number(hash64(regionX, regionZ, slot, salt) >> 11n) / 9_007_199_254_740_992;
}

const REQUIREMENTS = Object.freeze({
  timber: Object.freeze({ creature: "lumber", tool: "axe" }),
  stone: Object.freeze({ creature: "quarry", tool: "hammer" }),
  ore: Object.freeze({ creature: "mine", tool: "pick" }),
  fiber: Object.freeze({ creature: "gather", tool: "shears" }),
  aquatic: Object.freeze({ creature: "recover", tool: "dive-rig" }),
  buried: Object.freeze({ creature: "excavate", tool: "shovel" })
} satisfies Record<WildsResourceKind, Readonly<{ creature: WildsResourceWorkFamily; tool: WildsResourceToolFamily }>>);

// Loose stone is a lawful surface resource on dry land; ore remains bound to
// exposed rock. Restricting both to the rare rock surface made ordinary
// regions incapable of ever supporting construction.
const LAND_KINDS = Object.freeze(["timber", "fiber", "buried", "stone"] as const);
const ROCK_KINDS = Object.freeze(["stone", "ore"] as const);

export function wildsResourceRegionForPosition(position: Readonly<{ x: number; z: number }>) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) throw new Error("wilds_resource_position_invalid");
  const maximum = WORLD_LIMIT - .000001;
  const x = Math.max(-WORLD_LIMIT, Math.min(maximum, position.x));
  const z = Math.max(-WORLD_LIMIT, Math.min(maximum, position.z));
  return freeze({ x: Math.floor(x / WILDS_RESOURCE_REGION_SIZE), z: Math.floor(z / WILDS_RESOURCE_REGION_SIZE) });
}

export function projectWildsResourceRegion(regionX: number, regionZ: number): readonly WildsResourceSource[] {
  assertRegion(regionX, "x");
  assertRegion(regionZ, "z");
  const key = `${regionX}:${regionZ}`;
  const cached = regionCache.get(key);
  if (cached) return cached;
  regionsBuilt += 1;
  const sources = Array.from({ length: SOURCES_PER_REGION }, (_, slot): WildsResourceSource => {
    const x = quantize(regionX * WILDS_RESOURCE_REGION_SIZE + 8 + unit(regionX, regionZ, slot, 2) * 112);
    const z = quantize(regionZ * WILDS_RESOURCE_REGION_SIZE + 8 + unit(regionX, regionZ, slot, 3) * 112);
    const terrain = sampleWildsTerrain(x, z);
    const candidates = terrain.surface === "shallow-water" || terrain.surface === "deep-water"
      ? ["aquatic"] as const
      : terrain.surface === "rock"
        ? ROCK_KINDS
        : LAND_KINDS;
    const kind = candidates[Number(hash64(regionX, regionZ, slot, 1) % BigInt(candidates.length))]!;
    const capacity = 12 + Number(hash64(regionX, regionZ, slot, 4) % 37n);
    const capacityPerInterval = Math.max(1, Math.floor(capacity / (3 + Number(hash64(regionX, regionZ, slot, 5) % 3n))));
    return freeze({
      schema: "wildz.resource-source.v1",
      sourceId: `wildz.resource.v1:${regionX}:${regionZ}:${slot}:${hash64(regionX, regionZ, slot, 19).toString(16).padStart(16, "0")}`,
      regionX,
      regionZ,
      slot,
      kind,
      position: { x, y: terrain.elevation, z },
      capacity,
      quality: (1 + Number(hash64(regionX, regionZ, slot, 6) % 5n)) as 1 | 2 | 3 | 4 | 5,
      requirements: REQUIREMENTS[kind],
      replenishment: { intervalPulses: 360 + Number(hash64(regionX, regionZ, slot, 7) % 1081n), capacityPerInterval }
    });
  });
  const projection = freeze(sources);
  regionCache.set(key, projection);
  while (regionCache.size > REGION_CACHE_LIMIT) {
    const oldest = regionCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    regionCache.delete(oldest);
  }
  return projection;
}

function kai(value: string, name: string) {
  if (!/^(?:0|[1-9]\d{0,77})$/.test(value)) throw new Error(`wilds_resource_${name}_invalid`);
  return BigInt(value);
}

export function projectWildsResourceAvailability(
  source: WildsResourceSource,
  input: Readonly<{ admittedHarvestedCapacity: number; lastHarvestKaiPulse: string; currentKaiPulse: string }>
) {
  if (!Number.isSafeInteger(input.admittedHarvestedCapacity) || input.admittedHarvestedCapacity < 0) throw new Error("wilds_resource_harvested_capacity_invalid");
  const last = kai(input.lastHarvestKaiPulse, "last_harvest_kai");
  const current = kai(input.currentKaiPulse, "current_kai");
  if (current < last) throw new Error("wilds_resource_kai_order_invalid");
  const interval = BigInt(source.replenishment.intervalPulses);
  const intervals = (current - last) / interval;
  const intervalsToFull = BigInt(Math.ceil(source.capacity / source.replenishment.capacityPerInterval));
  const boundedIntervals = intervals > intervalsToFull ? intervalsToFull : intervals;
  const restored = Number(boundedIntervals) * source.replenishment.capacityPerInterval;
  const availableCapacity = Math.min(source.capacity, Math.max(0, source.capacity - input.admittedHarvestedCapacity + restored));
  const nextChangeKaiPulse = availableCapacity >= source.capacity ? null : String(last + (intervals + 1n) * interval);
  return freeze({ availableCapacity, nextChangeKaiPulse });
}

function invalid(reason: string): WildsHarvestPreview {
  return freeze({ schema: "wildz.harvest-preview.v1", valid: false, reason, physical: false, publish: "blocked-receiz-v122", writes: 0, candidate: null });
}

export function previewWildsHarvest(input: Readonly<{
  source: WildsResourceSource;
  sourceHead: string;
  explorerSubjectId: string;
  creature: Readonly<{ subjectId: string; head: string; workFamilies: readonly string[] }>;
  tool: Readonly<{ subjectId: string; head: string; family: string }>;
  kaiPulse: string;
  admittedHarvestedCapacity: number;
  physicalEvidence: Readonly<{ sourceId: string; sourceHead: string; protected: boolean; reachable: boolean }>;
}>): WildsHarvestPreview {
  kai(input.kaiPulse, "kai");
  if (!Number.isSafeInteger(input.source.regionX) || !Number.isSafeInteger(input.source.regionZ)
    || !Number.isSafeInteger(input.source.slot) || input.source.slot < 0 || input.source.slot >= SOURCES_PER_REGION
    || input.source.regionX < MIN_REGION || input.source.regionX > MAX_REGION
    || input.source.regionZ < MIN_REGION || input.source.regionZ > MAX_REGION) return invalid("source-noncanonical");
  const canonicalSource = projectWildsResourceRegion(input.source.regionX, input.source.regionZ)[input.source.slot];
  if (!canonicalSource || canonicalPortableCardJson(canonicalSource) !== canonicalPortableCardJson(input.source)) return invalid("source-noncanonical");
  if (!input.sourceHead || !input.explorerSubjectId || !input.creature.subjectId || !input.creature.head || !input.tool.subjectId || !input.tool.head) return invalid("authority-incomplete");
  if (input.physicalEvidence.sourceId !== input.source.sourceId || input.physicalEvidence.sourceHead !== input.sourceHead) return invalid("source-head-stale");
  if (input.physicalEvidence.protected) return invalid("source-protected");
  if (!input.physicalEvidence.reachable) return invalid("source-unreachable");
  if (!Number.isSafeInteger(input.admittedHarvestedCapacity) || input.admittedHarvestedCapacity < 0 || input.admittedHarvestedCapacity >= input.source.capacity) return invalid("source-exhausted");
  if (!input.creature.workFamilies.includes(input.source.requirements.creature)) return invalid("creature-unqualified");
  if (input.tool.family !== input.source.requirements.tool) return invalid("tool-incompatible");
  const capacity = Math.min(input.source.capacity - input.admittedHarvestedCapacity, Math.max(1, Math.ceil(input.source.capacity / 4)));
  const basis = {
    schema: "wildz.resource-candidate.v1",
    kind: input.source.kind,
    capacity,
    quality: input.source.quality,
    origin: { sourceId: input.source.sourceId, position: input.source.position, sourceHead: input.sourceHead, kaiPulse: input.kaiPulse },
    contributors: { explorerSubjectId: input.explorerSubjectId, creatureSubjectId: input.creature.subjectId, toolSubjectId: input.tool.subjectId },
    heads: { creature: input.creature.head, tool: input.tool.head }
  };
  const candidate = freeze({
    schema: "wildz.resource-candidate.v1" as const,
    candidateDigest: sha256PortableBasis(canonicalPortableCardJson(basis)),
    kind: basis.kind,
    capacity: basis.capacity,
    quality: basis.quality,
    origin: basis.origin,
    contributors: basis.contributors,
    heads: basis.heads
  });
  return freeze({ schema: "wildz.harvest-preview.v1", valid: true, reason: null, physical: false, publish: "blocked-receiz-v122", writes: 0, candidate });
}

export function wildsResourceAuthorityDiagnostics() {
  return freeze({ regionsBuilt, regionCacheSize: regionCache.size });
}

export function clearWildsResourceAuthorityCachesForTests() {
  regionCache.clear();
  regionsBuilt = 0;
}
