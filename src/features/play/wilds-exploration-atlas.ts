import { regionForPosition, WILDS_REGION_SIZE } from "./multiplayer-core";
import { isCanonicalWildsDiscoverySiteKey } from "./wilds-discovery-sites";

export const WILDS_EXPLORATION_VERSION = 1 as const;

const START_MIN = -4;
const START_MAX = 4;

export type WildsExplorationRange = Readonly<{ minX: number; maxX: number }>;
export type WildsExplorationRow = Readonly<{ z: number; ranges: readonly WildsExplorationRange[] }>;
export type WildsExplorationAtlas = Readonly<{
  version: typeof WILDS_EXPLORATION_VERSION;
  rows: readonly WildsExplorationRow[];
  siteKeys: readonly string[];
}>;

type MutableRows = Map<number, unknown[]>;
type ExplorationBounds = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number; count: number }>;
const boundsByRows = new WeakMap<WildsExplorationAtlas["rows"], ExplorationBounds>();
// Only our immutable projections can skip normalization. Uploaded or stored
// objects always pass the ordinary coordinate, range and site checks.
const includesStart = new WeakMap<WildsExplorationAtlas, boolean>();

export function isNormalizedWildsExplorationAtlas(value: unknown): value is WildsExplorationAtlas {
  return typeof value === "object" && value !== null && includesStart.has(value as WildsExplorationAtlas);
}

/** Numeric representability, not a world-size policy. Cell edges must stay exact. */
export function isWildsExplorationCoordinate(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number.isSafeInteger(((value as number) + 1) * WILDS_REGION_SIZE)
    && Number.isSafeInteger((value as number) * WILDS_REGION_SIZE);
}

function boundedRegion(value: unknown) {
  return isWildsExplorationCoordinate(value) ? value : null;
}

function normalizeRanges(values: readonly unknown[]): WildsExplorationRange[] {
  const sorted: WildsExplorationRange[] = [];
  let disjointAndSorted = true;
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const input = value as { minX?: unknown; maxX?: unknown };
    const minX = boundedRegion(input.minX);
    const maxX = boundedRegion(input.maxX);
    if (minX === null || maxX === null) continue;
    const range = { minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX) };
    const previous = sorted.at(-1);
    if (previous && range.minX <= previous.maxX + 1) disjointAndSorted = false;
    sorted.push(range);
  }
  if (disjointAndSorted) return sorted;
  sorted.sort((left, right) => left.minX - right.minX || left.maxX - right.maxX);

  return sorted.reduce<WildsExplorationRange[]>((ranges, range) => {
    const previous = ranges.at(-1);
    if (previous && range.minX <= previous.maxX + 1) {
      ranges[ranges.length - 1] = {
        minX: previous.minX,
        maxX: Math.max(previous.maxX, range.maxX)
      };
    }
    else {
      ranges.push(range);
    }
    return ranges;
  }, []);
}

function addRanges(rows: MutableRows, z: number, ranges: readonly unknown[]) {
  const boundedZ = boundedRegion(z);
  if (boundedZ === null || ranges.length === 0) return;
  const collected = rows.get(boundedZ) ?? [];
  for (const range of ranges) collected.push(range);
  rows.set(boundedZ, collected);
}

function forEachSightRow(position: { x: number; z: number }, visit: (z: number, sight: WildsExplorationRange) => void) {
  const center = regionForPosition(position);
  const xs = [center.x - 1, center.x, center.x + 1].filter(isWildsExplorationCoordinate);
  if (!xs.length) return;
  const sight = { minX: xs[0]!, maxX: xs[xs.length - 1]! };
  for (let offset = -1; offset <= 1; offset++) {
    const z = center.z + offset;
    if (isWildsExplorationCoordinate(z)) visit(z, sight);
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

function retainAtlas(rows: WildsExplorationAtlas["rows"], siteKeys: readonly string[], hasStart: boolean) {
  const atlas = Object.freeze({ version: WILDS_EXPLORATION_VERSION, rows: Object.freeze(rows), siteKeys: Object.freeze(siteKeys) });
  includesStart.set(atlas, hasStart);
  return atlas;
}

function retainedRow(z: number, ranges: WildsExplorationRange[]) {
  return Object.freeze({ z, ranges: Object.freeze(ranges) });
}

function atlasFromRows(rows: MutableRows, siteKeys: unknown, hasStart: boolean): WildsExplorationAtlas {
  const ordered: WildsExplorationRow[] = [];
  for (const [z, values] of [...rows].sort(([a], [b]) => a - b)) {
    const ranges = normalizeRanges(values);
    for (const range of ranges) Object.freeze(range);
    if (ranges.length) ordered.push(retainedRow(z, ranges));
  }
  return retainAtlas(ordered, normalizeSiteKeys(siteKeys), hasStart);
}

function rowsFromAtlas(atlas: WildsExplorationAtlas) {
  const rows: MutableRows = new Map();
  for (const row of atlas.rows) addRanges(rows, row.z, row.ranges);
  return rows;
}

export function createInitialWildsExplorationAtlas(): WildsExplorationAtlas {
  const rows: MutableRows = new Map();
  addInitial(rows);
  return atlasFromRows(rows, [], true);
}

export function normalizeWildsExplorationAtlas(
  value: unknown,
  currentPosition: { x: number; z: number }
): WildsExplorationAtlas {
  const position = Number.isFinite(currentPosition.x) && Number.isFinite(currentPosition.z) ? currentPosition : { x: 0, z: 0 };
  if (isNormalizedWildsExplorationAtlas(value) && includesStart.get(value)) return revealWildsExplorationAt(value, position);
  const rows: MutableRows = new Map();
  let siteKeys: unknown;
  addInitial(rows);

  if (value && typeof value === "object") {
    const candidate = value as { version?: unknown; rows?: unknown; siteKeys?: unknown };
    if (candidate.version === WILDS_EXPLORATION_VERSION && Array.isArray(candidate.rows)) {
      siteKeys = candidate.siteKeys;
      for (const valueRow of candidate.rows) {
        if (!valueRow || typeof valueRow !== "object") continue;
        const row = valueRow as { z?: unknown; ranges?: unknown };
        const z = boundedRegion(row.z);
        if (z !== null && Array.isArray(row.ranges)) addRanges(rows, z, row.ranges);
      }
    }
  }

  forEachSightRow(position, (z, sight) => addRanges(rows, z, [sight]));
  return atlasFromRows(rows, siteKeys, true);
}

// Rows and their disjoint ranges are sorted when admitted or merged.
function rowIndexAtOrAfter(rows: WildsExplorationAtlas["rows"], z: number) {
  let low = 0, high = rows.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (rows[middle]!.z < z) low = middle + 1;
    else high = middle;
  }
  return low;
}

function rangeIndexEndingAtOrAfter(ranges: WildsExplorationRow["ranges"], x: number) {
  let low = 0, high = ranges.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (ranges[middle]!.maxX < x) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function wildsExplorationContainsRegion(
  atlas: WildsExplorationAtlas,
  regionX: number,
  regionZ: number
) {
  if (!Number.isSafeInteger(regionX) || !Number.isSafeInteger(regionZ)) return false;
  const row = atlas.rows[rowIndexAtOrAfter(atlas.rows, regionZ)];
  if (row?.z !== regionZ) return false;
  const range = row.ranges[rangeIndexEndingAtOrAfter(row.ranges, regionX)];
  return !!range && range.minX <= regionX;
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
  let nextRows: WildsExplorationRow[] | undefined;
  forEachSightRow(position, (z, sight) => {
    const rows = nextRows ?? atlas.rows;
    const index = rowIndexAtOrAfter(rows, z);
    const current = rows[index];
    if (current?.z !== z) {
      nextRows ??= rows.slice();
      nextRows.splice(index, 0, retainedRow(z, [Object.freeze(sight)]));
      return;
    }
    const { ranges } = current;
    const start = rangeIndexEndingAtOrAfter(ranges, sight.minX - 1);
    const first = ranges[start];
    if (first && first.minX <= sight.minX && first.maxX >= sight.maxX) return;
    let end = start;
    while (end < ranges.length && ranges[end]!.minX <= sight.maxX + 1) end++;
    const merged = end === start ? sight : {
      minX: Math.min(sight.minX, first!.minX),
      maxX: Math.max(sight.maxX, ranges[end - 1]!.maxX)
    };
    const nextRanges = ranges.slice();
    nextRanges.splice(start, end - start, Object.freeze(merged));
    nextRows ??= rows.slice();
    nextRows[index] = retainedRow(z, nextRanges);
  });
  if (!nextRows) return atlas;
  const hasStart = includesStart.get(atlas);
  return hasStart === undefined ? { ...atlas, rows: nextRows } : retainAtlas(nextRows, atlas.siteKeys, hasStart);
}

function containsAtlas(held: WildsExplorationAtlas, candidate: WildsExplorationAtlas) {
  if (candidate.rows.length > held.rows.length || candidate.siteKeys.length > held.siteKeys.length) return false;
  let siteIndex = 0;
  for (const key of candidate.siteKeys) {
    while (siteIndex < held.siteKeys.length && held.siteKeys[siteIndex]! < key) siteIndex++;
    if (held.siteKeys[siteIndex++] !== key) return false;
  }
  if (held.rows === candidate.rows) return true;
  let rowIndex = 0;
  for (const row of candidate.rows) {
    while (rowIndex < held.rows.length && held.rows[rowIndex]!.z < row.z) rowIndex++;
    const existing = held.rows[rowIndex++];
    if (existing?.z !== row.z) return false;
    if (row === existing) continue;
    let rangeIndex = 0;
    for (const range of row.ranges) {
      while (rangeIndex < existing.ranges.length && existing.ranges[rangeIndex]!.maxX < range.minX) rangeIndex++;
      const cover = existing.ranges[rangeIndex];
      if (!cover || cover.minX > range.minX || cover.maxX < range.maxX) return false;
    }
  }
  return true;
}

export function mergeWildsExplorationAtlases(
  left: WildsExplorationAtlas,
  right: WildsExplorationAtlas
): WildsExplorationAtlas {
  const leftStart = includesStart.get(left), rightStart = includesStart.get(right);
  if (leftStart !== undefined && rightStart !== undefined) {
    if (left === right || containsAtlas(left, right)) return left;
    if (containsAtlas(right, left)) return right;
  }
  const rows = rowsFromAtlas(left);
  for (const row of right.rows) addRanges(rows, row.z, row.ranges);
  return atlasFromRows(rows, [...left.siteKeys, ...right.siteKeys], Boolean(leftStart || rightStart));
}

const emptyCheckpointDelta = retainAtlas([], [], false);
const checkpointDeltas = new WeakMap<WildsExplorationAtlas, WeakMap<WildsExplorationAtlas, WildsExplorationAtlas>>();

/** Cache encoding only. The owner checkpoint reader unions these additions
 * with the same owner's durable map. Neither input is mutated or truncated. */
export function wildsExplorationCheckpointDelta(held: WildsExplorationAtlas, current: WildsExplorationAtlas): WildsExplorationAtlas {
  if (!isNormalizedWildsExplorationAtlas(held) || !isNormalizedWildsExplorationAtlas(current)) return current;
  if (held === current) return emptyCheckpointDelta;
  let byCurrent = checkpointDeltas.get(held);
  const previous = byCurrent?.get(current);
  if (previous) return previous;

  const rows: WildsExplorationRow[] = [];
  let heldIndex = 0;
  for (const row of current.rows) {
    while (heldIndex < held.rows.length && held.rows[heldIndex]!.z < row.z) heldIndex++;
    const base = held.rows[heldIndex];
    if (row === base) continue;
    if (row.z !== base?.z) { rows.push(row); continue; }
    const ranges: WildsExplorationRange[] = [];
    let index = 0;
    for (const { minX, maxX } of row.ranges) {
      let start = minX;
      while (index < base.ranges.length && base.ranges[index]!.maxX < start) index++;
      for (let i = index; i < base.ranges.length && base.ranges[i]!.minX <= maxX; i++) {
        const cover = base.ranges[i]!;
        if (cover.minX > start) ranges.push(Object.freeze({ minX: start, maxX: cover.minX - 1 }));
        start = Math.max(start, cover.maxX + 1);
        if (start > maxX) break;
      }
      if (start <= maxX) ranges.push(Object.freeze({ minX: start, maxX }));
    }
    if (ranges.length) rows.push(retainedRow(row.z, ranges));
  }
  let sites: string[] = [];
  if (current.siteKeys !== held.siteKeys && current.siteKeys.length) {
    const heldSites = new Set(held.siteKeys);
    sites = current.siteKeys.filter(site => !heldSites.has(site));
  }
  const delta = rows.length || sites.length ? retainAtlas(rows, sites, false) : emptyCheckpointDelta;
  if (!byCurrent) { byCurrent = new WeakMap(); checkpointDeltas.set(held, byCurrent); }
  byCurrent.set(current, delta);
  return delta;
}

export function wildsExplorationContainsSite(atlas: WildsExplorationAtlas, siteKey: string) {
  return atlas.siteKeys.includes(siteKey);
}

export function discoverWildsExplorationSite(atlas: WildsExplorationAtlas, siteKey: string): WildsExplorationAtlas {
  const normalized = normalizeSiteKeys([siteKey]);
  if (normalized.length === 0 || atlas.siteKeys.includes(normalized[0]!)) return atlas;
  const siteKeys = normalizeSiteKeys([...atlas.siteKeys, normalized[0]!]);
  const hasStart = includesStart.get(atlas);
  return hasStart === undefined ? { ...atlas, siteKeys } : retainAtlas(atlas.rows, siteKeys, hasStart);
}

export function wildsExplorationBounds(atlas: WildsExplorationAtlas): ExplorationBounds {
  const cached = boundsByRows.get(atlas.rows);
  if (cached) return cached;
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

  const bounds = Object.freeze(count === 0 ? { minX: 0, maxX: 0, minZ: 0, maxZ: 0, count: 0 } : { minX, maxX, minZ, maxZ, count });
  if (includesStart.has(atlas)) boundsByRows.set(atlas.rows, bounds);
  return bounds;
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
