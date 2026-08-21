import { selectWildsHabitatForm } from "./wilds-creature-habitat";
import { sampleWildsTerrain, type WildsTerrainSurface } from "./wilds-terrain-authority";

export const ENCOUNTER_REGION_SIZE = 24;
const HOTSPOTS_PER_REGION = 6;
const MAX_NEARBY_HOTSPOTS = 24;
const CANDIDATE_GRID_SIZE = 6;
const CANDIDATES_PER_REGION = CANDIDATE_GRID_SIZE * CANDIDATE_GRID_SIZE;
const MAX_REGION_CACHE_SIZE = 128;
const HOTSPOT_HIT_RADIUS = 1.15;

export type HotspotCover = "grass" | "flowers" | "tree" | "rock" | "cave" | "water" | "ruin" | "energy";

export type HiddenHotspot = {
  id: string;
  familyId: string;
  formId: string;
  regionX: number;
  regionZ: number;
  position: { x: number; z: number };
  cover: HotspotCover;
  shoreReachable: boolean;
  hitRadius: 1.15;
  hintRadius: 4.5;
};

export type HotspotSearchResult =
  | { kind: "hit"; hotspot: HiddenHotspot; distance: number }
  | { kind: "near_miss"; hotspot: HiddenHotspot; distance: number; direction: { x: number; z: number } }
  | { kind: "empty" }
  | { kind: "captured"; hotspot: HiddenHotspot; distance: number };

function seededUnit(x: number, z: number, salt: number) {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ Math.imul(salt | 0, 0x6c8e9cf5);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

export function coverForHabitat(habitat: string, familyIndex: number): HotspotCover {
  const value = habitat.toLowerCase();
  if (/water|tide|reef|river|marsh|lagoon|lake|rain/.test(value)) return "water";
  if (/cave|den|hollow|burrow|tunnel|underground/.test(value)) return "cave";
  if (/ruin|temple|archive|vault|station|market/.test(value)) return "ruin";
  if (/spark|storm|energy|ember|frost|crystal|solar/.test(value)) return "energy";
  if (/rock|ridge|mountain|cliff|canyon/.test(value)) return "rock";
  if (/forest|grove|wood|canopy|jungle/.test(value)) return "tree";
  if (/flower|meadow|garden|bloom/.test(value)) return "flowers";
  return (["grass", "flowers", "tree", "rock"] as const)[familyIndex % 4]!;
}

function distance(left: { x: number; z: number }, right: { x: number; z: number }) {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

type HotspotCandidate = Readonly<{
  index: number;
  position: Readonly<{ x: number; z: number }>;
  surface: WildsTerrainSurface;
  shoreReachable: boolean;
}>;

const regionCache = new Map<string, readonly HiddenHotspot[]>();
let regionsBuilt = 0;
let terrainSamples = 0;

function isWater(surface: WildsTerrainSurface) {
  return surface === "shallow-water" || surface === "deep-water";
}

function fallbackLandCover(surface: WildsTerrainSurface): HotspotCover {
  return surface === "rock" ? "rock" : surface === "grass" ? "flowers" : "grass";
}

function candidatePriority(candidate: HotspotCandidate) {
  if (isWater(candidate.surface) && candidate.shoreReachable) return 0;
  if (candidate.surface === "deep-water") return 1;
  return 2;
}

function buildRegionProjection(regionX: number, regionZ: number): readonly HiddenHotspot[] {
  const cellSize = ENCOUNTER_REGION_SIZE / CANDIDATE_GRID_SIZE;
  const sampled = Array.from({ length: CANDIDATES_PER_REGION }, (_, index) => {
    const column = index % CANDIDATE_GRID_SIZE;
    const row = Math.floor(index / CANDIDATE_GRID_SIZE);
    const position = Object.freeze({
      x: regionX * ENCOUNTER_REGION_SIZE + column * cellSize + cellSize * (0.32 + seededUnit(regionX, regionZ, index * 2 + 1) * 0.36),
      z: regionZ * ENCOUNTER_REGION_SIZE + row * cellSize + cellSize * (0.32 + seededUnit(regionZ, regionX, index * 2 + 2) * 0.36)
    });
    terrainSamples += 1;
    return { index, position, surface: sampleWildsTerrain(position.x, position.z).surface };
  });
  const candidates: HotspotCandidate[] = sampled.map((candidate) => Object.freeze({
    ...candidate,
    shoreReachable: candidate.surface === "shallow-water" || sampled.some((other) =>
      other.surface !== "deep-water"
      && Math.hypot(other.position.x - candidate.position.x, other.position.z - candidate.position.z) <= HOTSPOT_HIT_RADIUS
    )
  }));
  const selected = [...candidates]
    .sort((left, right) => candidatePriority(left) - candidatePriority(right)
      || seededUnit(regionX, regionZ, left.index + 4_001) - seededUnit(regionX, regionZ, right.index + 4_001)
      || left.index - right.index)
    .slice(0, HOTSPOTS_PER_REGION);
  const hotspots = selected.map((candidate, slot) => {
    const form = selectWildsHabitatForm(candidate.surface, seededUnit(regionX, regionZ, candidate.index + 8_003));
    const habitatCover = coverForHabitat(form.habitat, form.positionSeed);
    const cover = isWater(candidate.surface)
      ? "water" as const
      : habitatCover === "water"
        ? fallbackLandCover(candidate.surface)
        : habitatCover;
    return Object.freeze({
      id: `hotspot:${regionX}:${regionZ}:${slot}:${form.familyId}`,
      familyId: form.familyId,
      formId: form.id,
      regionX,
      regionZ,
      position: candidate.position,
      cover,
      shoreReachable: isWater(candidate.surface) && candidate.shoreReachable,
      hitRadius: HOTSPOT_HIT_RADIUS,
      hintRadius: 4.5 as const
    });
  });
  regionsBuilt += 1;
  return Object.freeze(hotspots);
}

export function hotspotsForRegion(regionX: number, regionZ: number): readonly HiddenHotspot[] {
  const key = `${regionX}:${regionZ}`;
  const cached = regionCache.get(key);
  if (cached) return cached;
  const projection = buildRegionProjection(regionX, regionZ);
  regionCache.set(key, projection);
  while (regionCache.size > MAX_REGION_CACHE_SIZE) {
    const oldest = regionCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    regionCache.delete(oldest);
  }
  return projection;
}

export function wildsHotspotRegionCacheSize() {
  return regionCache.size;
}

export function wildsHotspotProjectionDiagnostics() {
  return Object.freeze({ regionsBuilt, terrainSamples });
}

export function nearbyHiddenHotspots(player: { x: number; z: number }): HiddenHotspot[] {
  const regionX = Math.floor(player.x / ENCOUNTER_REGION_SIZE);
  const regionZ = Math.floor(player.z / ENCOUNTER_REGION_SIZE);
  const hotspots: HiddenHotspot[] = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) hotspots.push(...hotspotsForRegion(regionX + dx, regionZ + dz));
  }
  return hotspots
    .sort((left, right) => distance(left.position, player) - distance(right.position, player))
    .slice(0, MAX_NEARBY_HOTSPOTS);
}

function hotspotCaptureKey(id: string) {
  return id.match(/^hotspot:(-?\d+):(-?\d+):(\d+)(?::|$)/)?.slice(1).join(":") ?? null;
}

function wasHotspotCaptured(hotspotId: string, capturedHotspotIds: readonly string[]) {
  const key = hotspotCaptureKey(hotspotId);
  return capturedHotspotIds.some((capturedId) => capturedId === hotspotId || (key !== null && hotspotCaptureKey(capturedId) === key));
}

export function searchHiddenHotspots(
  hotspots: readonly HiddenHotspot[],
  point: { x: number; z: number },
  capturedHotspotIds: readonly string[]
): HotspotSearchResult {
  const closest = hotspots
    .map((hotspot) => ({ hotspot, distance: distance(hotspot.position, point) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (!closest || closest.distance > closest.hotspot.hintRadius) return { kind: "empty" };
  if (closest.distance <= closest.hotspot.hitRadius) {
    return wasHotspotCaptured(closest.hotspot.id, capturedHotspotIds)
      ? { kind: "captured", ...closest }
      : { kind: "hit", ...closest };
  }
  const magnitude = Math.max(closest.distance, Number.EPSILON);
  return {
    kind: "near_miss",
    ...closest,
    direction: {
      x: (closest.hotspot.position.x - point.x) / magnitude,
      z: (closest.hotspot.position.z - point.z) / magnitude
    }
  };
}
