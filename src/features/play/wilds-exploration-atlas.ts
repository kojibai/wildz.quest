import { regionForPosition, WILDS_REGION_SIZE } from "./multiplayer-core";
import { isCanonicalWildsDiscoverySiteKey } from "./wilds-discovery-sites";

export const WILDS_EXPLORATION_VERSION = 1 as const;

const START_MIN = -4;
const START_MAX = 4;
const REGION_LIMIT = Math.ceil(500_000_000 / WILDS_REGION_SIZE);

export type WildsExplorationRange = Readonly<{ minX: number; maxX: number }>;
export type WildsExplorationRow = Readonly<{ z: number; ranges: readonly WildsExplorationRange[] }>;
export type WildsExplorationAtlas = Readonly<{
  version: typeof WILDS_EXPLORATION_VERSION;
  rows: readonly WildsExplorationRow[];
  siteKeys: readonly string[];
}>;

type MutableRows = Map<number, WildsExplorationRange[]>;

function boundedRegion(value: unknown) {
  if (!Number.isSafeInteger(value)) return null;
  return Math.max(-REGION_LIMIT, Math.min(REGION_LIMIT, value as number));
}

function normalizeRanges(values: unknown): WildsExplorationRange[] {
  if (!Array.isArray(values)) return [];
  const sorted = values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const range = value as { minX?: unknown; maxX?: unknown };
    const minX = boundedRegion(range.minX);
    const maxX = boundedRegion(range.maxX);
    if (minX === null || maxX === null) return [];
    return [{ minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX) }];
  }).sort((left, right) => left.minX - right.minX || left.maxX - right.maxX);

  return sorted.reduce<WildsExplorationRange[]>((ranges, range) => {
    const previous = ranges.at(-1);
    if (previous && range.minX <= previous.maxX + 1) {
      ranges[ranges.length - 1] = {
        minX: previous.minX,
        maxX: Math.max(previous.maxX, range.maxX)
      };
    }
    else {
      ranges.push({ ...range });
    }
    return ranges;
  }, []);
}

function addRanges(rows: MutableRows, z: number, ranges: readonly WildsExplorationRange[]) {
  const boundedZ = boundedRegion(z);
  if (boundedZ === null || ranges.length === 0) return;
  rows.set(boundedZ, normalizeRanges([...(rows.get(boundedZ) ?? []), ...ranges]));
}

function addSight(rows: MutableRows, position: { x: number; z: number }) {
  const safePosition = Number.isFinite(position.x) && Number.isFinite(position.z)
    ? position
    : { x: 0, z: 0 };
  const center = regionForPosition(safePosition);
  for (let zOffset = -1; zOffset <= 1; zOffset += 1) {
    const z = boundedRegion(center.z + zOffset);
    if (z === null) continue;
    const ranges: WildsExplorationRange[] = [];
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const x = boundedRegion(center.x + xOffset);
      if (x !== null) ranges.push({ minX: x, maxX: x });
    }
    addRanges(rows, z, ranges);
  }
}

function addInitial(rows: MutableRows) {
  for (let z = START_MIN; z <= START_MAX; z += 1) {
    addRanges(rows, z, [{ minX: START_MIN, maxX: START_MAX }]);
  }
}

function normalizeSiteKeys(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string =>
    isCanonicalWildsDiscoverySiteKey(value)
  ))].sort();
}

function atlasFromRows(rows: MutableRows, siteKeys: readonly string[] = []): WildsExplorationAtlas {
  return {
    version: WILDS_EXPLORATION_VERSION,
    rows: [...rows.entries()]
      .filter(([, ranges]) => ranges.length > 0)
      .sort(([leftZ], [rightZ]) => leftZ - rightZ)
      .map(([z, ranges]) => ({ z, ranges: normalizeRanges(ranges) })),
    siteKeys: normalizeSiteKeys(siteKeys)
  };
}

function rowsFromAtlas(atlas: WildsExplorationAtlas) {
  const rows: MutableRows = new Map();
  for (const row of atlas.rows) addRanges(rows, row.z, row.ranges);
  return rows;
}

export function createInitialWildsExplorationAtlas(): WildsExplorationAtlas {
  const rows: MutableRows = new Map();
  addInitial(rows);
  return atlasFromRows(rows);
}

export function normalizeWildsExplorationAtlas(
  value: unknown,
  currentPosition: { x: number; z: number }
): WildsExplorationAtlas {
  const rows: MutableRows = new Map();
  let siteKeys: string[] = [];
  addInitial(rows);

  if (value && typeof value === "object") {
    const candidate = value as { version?: unknown; rows?: unknown };
    if (candidate.version === WILDS_EXPLORATION_VERSION && Array.isArray(candidate.rows)) {
      siteKeys = normalizeSiteKeys((candidate as { siteKeys?: unknown }).siteKeys);
      for (const valueRow of candidate.rows) {
        if (!valueRow || typeof valueRow !== "object") continue;
        const row = valueRow as { z?: unknown; ranges?: unknown };
        const z = boundedRegion(row.z);
        if (z !== null) addRanges(rows, z, normalizeRanges(row.ranges));
      }
    }
  }

  addSight(rows, currentPosition);
  return atlasFromRows(rows, siteKeys);
}

export function wildsExplorationContainsRegion(
  atlas: WildsExplorationAtlas,
  regionX: number,
  regionZ: number
) {
  if (!Number.isSafeInteger(regionX) || !Number.isSafeInteger(regionZ)) return false;
  const row = atlas.rows.find((candidate) => candidate.z === regionZ);
  return row?.ranges.some((range) => regionX >= range.minX && regionX <= range.maxX) ?? false;
}

export function wildsExplorationContainsWorld(
  atlas: WildsExplorationAtlas,
  position: { x: number; z: number }
) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const region = regionForPosition(position);
  return wildsExplorationContainsRegion(atlas, region.x, region.z);
}

export function revealWildsExplorationAt(
  atlas: WildsExplorationAtlas,
  position: { x: number; z: number }
): WildsExplorationAtlas {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return atlas;
  const center = regionForPosition(position);
  let alreadyRevealed = true;
  for (let zOffset = -1; zOffset <= 1 && alreadyRevealed; zOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const x = boundedRegion(center.x + xOffset);
      const z = boundedRegion(center.z + zOffset);
      if (x !== null && z !== null && !wildsExplorationContainsRegion(atlas, x, z)) {
        alreadyRevealed = false;
        break;
      }
    }
  }
  if (alreadyRevealed) return atlas;

  const rows = rowsFromAtlas(atlas);
  addSight(rows, position);
  return atlasFromRows(rows, atlas.siteKeys);
}

export function mergeWildsExplorationAtlases(
  left: WildsExplorationAtlas,
  right: WildsExplorationAtlas
): WildsExplorationAtlas {
  const rows = rowsFromAtlas(left);
  for (const row of right.rows) addRanges(rows, row.z, row.ranges);
  return atlasFromRows(rows, [...left.siteKeys, ...right.siteKeys]);
}

export function wildsExplorationContainsSite(atlas: WildsExplorationAtlas, siteKey: string) {
  return atlas.siteKeys.includes(siteKey);
}

export function discoverWildsExplorationSite(atlas: WildsExplorationAtlas, siteKey: string): WildsExplorationAtlas {
  const normalized = normalizeSiteKeys([siteKey]);
  if (normalized.length === 0 || atlas.siteKeys.includes(normalized[0]!)) return atlas;
  return { ...atlas, siteKeys: normalizeSiteKeys([...atlas.siteKeys, normalized[0]!]) };
}

export function wildsExplorationBounds(atlas: WildsExplorationAtlas) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let count = 0;

  for (const row of atlas.rows) {
    for (const range of row.ranges) {
      minX = Math.min(minX, range.minX);
      maxX = Math.max(maxX, range.maxX);
      minZ = Math.min(minZ, row.z);
      maxZ = Math.max(maxZ, row.z);
      count += range.maxX - range.minX + 1;
    }
  }

  if (count === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, count: 0 };
  return { minX, maxX, minZ, maxZ, count };
}

export function *wildsExplorationRegions(
  atlas: WildsExplorationAtlas
): Iterable<{ x: number; z: number }> {
  for (const row of atlas.rows) {
    for (const range of row.ranges) {
      for (let x = range.minX; x <= range.maxX; x += 1) yield { x, z: row.z };
    }
  }
}
