import { WILDS_REGION_SIZE } from "./multiplayer-core";
import type { WildsAtlasNode } from "./wilds-world-atlas";

const DEFAULT_MAX_TILES = 96;
const DEFAULT_SEGMENTS_PER_REGION = 4;
const DEFAULT_MAX_SEGMENTS_PER_AXIS = 48;
const MAX_ROUTE_CELL_CROSSINGS = 4_096;
const EPSILON = 1e-10;

type AtlasRegion = Pick<WildsAtlasNode, "regionX" | "regionZ">;

export type WildsAtlasRenderTile = Readonly<{
  minRegionX: number;
  maxRegionX: number;
  minRegionZ: number;
  maxRegionZ: number;
  segmentsX: number;
  segmentsZ: number;
  vertexBudget: number;
  cells?: readonly AtlasRegion[];
  renderMode?: "sparse-cells" | "instanced-cells";
  fallback?: "sparse-batch" | "instanced-cells" | "vertex-cap";
}>;

type MutableTile = {
  minRegionX: number;
  maxRegionX: number;
  minRegionZ: number;
  maxRegionZ: number;
};

export function atlasWorldCoordinate(local: number, centerRegion: number, regionUnit: number) {
  return (centerRegion + local / regionUnit) * WILDS_REGION_SIZE;
}

export function atlasLocalCoordinate(world: number, centerRegion: number, regionUnit: number) {
  return (world / WILDS_REGION_SIZE - centerRegion) * regionUnit;
}

export function wildsAtlasProjectedSpan(nodes: readonly AtlasRegion[], regionUnit: number) {
  const bounds = wildsAtlasProjectedBounds(nodes);
  if (bounds.count === 0) return Math.max(0, regionUnit);
  return Math.max(bounds.maxX - bounds.minX + 1, bounds.maxZ - bounds.minZ + 1) * Math.max(0, regionUnit);
}

export function wildsAtlasProjectedBounds(nodes: readonly AtlasRegion[]) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (const node of nodes) {
    if (!Number.isSafeInteger(node.regionX) || !Number.isSafeInteger(node.regionZ)) continue;
    minX = Math.min(minX, node.regionX);
    maxX = Math.max(maxX, node.regionX);
    minZ = Math.min(minZ, node.regionZ);
    maxZ = Math.max(maxZ, node.regionZ);
    count += 1;
  }
  return count === 0
    ? { minX: 0, maxX: 0, minZ: 0, maxZ: 0, count: 0 }
    : { minX, maxX, minZ, maxZ, count };
}

function regionKey(regionX: number, regionZ: number) {
  return `${regionX}:${regionZ}`;
}

function normalizedRegions(nodes: readonly AtlasRegion[]) {
  const unique = new Map<string, AtlasRegion>();
  for (const node of nodes) {
    if (!Number.isSafeInteger(node.regionX) || !Number.isSafeInteger(node.regionZ)) continue;
    unique.set(regionKey(node.regionX, node.regionZ), { regionX: node.regionX, regionZ: node.regionZ });
  }
  return [...unique.values()].sort((left, right) => left.regionZ - right.regionZ || left.regionX - right.regionX);
}

function sparseMaximalStrips(nodes: readonly AtlasRegion[]) {
  const rows = new Map<number, number[]>();
  for (const node of normalizedRegions(nodes)) {
    const row = rows.get(node.regionZ);
    if (row) row.push(node.regionX);
    else rows.set(node.regionZ, [node.regionX]);
  }

  const tiles: MutableTile[] = [];
  let active = new Map<string, MutableTile>();
  for (const [z, values] of rows) {
    const ranges: Array<{ minX: number; maxX: number }> = [];
    for (const x of values) {
      const previous = ranges.at(-1);
      if (previous && x === previous.maxX + 1) previous.maxX = x;
      else ranges.push({ minX: x, maxX: x });
    }

    const nextActive = new Map<string, MutableTile>();
    for (const range of ranges) {
      const key = `${range.minX}:${range.maxX}`;
      const previous = active.get(key);
      if (previous && previous.maxRegionZ === z - 1) {
        previous.maxRegionZ = z;
        nextActive.set(key, previous);
      } else {
        const tile = {
          minRegionX: range.minX,
          maxRegionX: range.maxX,
          minRegionZ: z,
          maxRegionZ: z
        };
        tiles.push(tile);
        nextActive.set(key, tile);
      }
    }
    active = nextActive;
  }
  return tiles;
}

export function buildWildsAtlasRenderTiles(
  nodes: readonly AtlasRegion[],
  options: {
    maxVertices: number;
    maxTiles?: number;
    maxSegmentsPerAxis?: number;
    segmentsPerRegion?: number;
  }
): WildsAtlasRenderTile[] {
  const maxVertices = Math.max(0, Math.floor(Number.isFinite(options.maxVertices) ? options.maxVertices : 0));
  const requestedMaxTiles = Math.max(0, Math.floor(options.maxTiles ?? DEFAULT_MAX_TILES));
  const maxTiles = Math.min(requestedMaxTiles, Math.floor(maxVertices / 4));
  if (maxTiles === 0) return [];

  const regions = normalizedRegions(nodes);
  const strips = sparseMaximalStrips(regions);
  if (strips.length > maxTiles) {
    const batchCount = Math.min(maxTiles, regions.length);
    const batchSize = Math.ceil(regions.length / batchCount);
    const batches = Array.from({ length: batchCount }, (_, index) => regions.slice(index * batchSize, (index + 1) * batchSize)).filter((batch) => batch.length > 0);
    const sparseVertices = regions.length * 4;
    const instanced = sparseVertices > maxVertices;
    return batches.map((cells) => {
      const bounds = cells.reduce((result, cell) => ({
        minX: Math.min(result.minX, cell.regionX),
        maxX: Math.max(result.maxX, cell.regionX),
        minZ: Math.min(result.minZ, cell.regionZ),
        maxZ: Math.max(result.maxZ, cell.regionZ)
      }), { minX: cells[0]!.regionX, maxX: cells[0]!.regionX, minZ: cells[0]!.regionZ, maxZ: cells[0]!.regionZ });
      return {
        minRegionX: bounds.minX,
        maxRegionX: bounds.maxX,
        minRegionZ: bounds.minZ,
        maxRegionZ: bounds.maxZ,
        segmentsX: 1,
        segmentsZ: 1,
        vertexBudget: instanced ? 4 : cells.length * 4,
        cells,
        renderMode: instanced ? "instanced-cells" as const : "sparse-cells" as const,
        fallback: instanced ? "instanced-cells" as const : "sparse-batch" as const
      };
    });
  }

  const selected = strips;
  const segmentsPerRegion = Math.max(1, Math.floor(options.segmentsPerRegion ?? DEFAULT_SEGMENTS_PER_REGION));
  const maxSegmentsPerAxis = Math.max(1, Math.floor(options.maxSegmentsPerAxis ?? DEFAULT_MAX_SEGMENTS_PER_AXIS));
  const segments = selected.map((tile) => ({
    ...tile,
    segmentsX: Math.min(maxSegmentsPerAxis, (tile.maxRegionX - tile.minRegionX + 1) * segmentsPerRegion),
    segmentsZ: Math.min(maxSegmentsPerAxis, (tile.maxRegionZ - tile.minRegionZ + 1) * segmentsPerRegion)
  }));

  const totalVertices = () => segments.reduce((sum, tile) => sum + (tile.segmentsX + 1) * (tile.segmentsZ + 1), 0);
  let vertexCapped = false;
  while (totalVertices() > maxVertices) {
    let candidateIndex = -1;
    let candidateSavings = 0;
    for (let index = 0; index < segments.length; index += 1) {
      const tile = segments[index]!;
      const savingsX = tile.segmentsX > 1 ? tile.segmentsZ + 1 : 0;
      const savingsZ = tile.segmentsZ > 1 ? tile.segmentsX + 1 : 0;
      const savings = Math.max(savingsX, savingsZ);
      if (savings > candidateSavings) {
        candidateIndex = index;
        candidateSavings = savings;
      }
    }
    if (candidateIndex < 0) break;
    const tile = segments[candidateIndex]!;
    if (tile.segmentsX > 1 && (tile.segmentsZ === 1 || tile.segmentsZ + 1 >= tile.segmentsX + 1)) tile.segmentsX -= 1;
    else tile.segmentsZ -= 1;
    vertexCapped = true;
  }

  const fallback = vertexCapped ? "vertex-cap" as const : undefined;
  return segments.map((tile) => ({
    ...tile,
    vertexBudget: (tile.segmentsX + 1) * (tile.segmentsZ + 1),
    ...(fallback ? { fallback } : {})
  }));
}

export function wildsAtlasTileContainsRegion(tile: WildsAtlasRenderTile, regionX: number, regionZ: number) {
  if (tile.cells) return tile.cells.some((cell) => cell.regionX === regionX && cell.regionZ === regionZ);
  return regionX >= tile.minRegionX && regionX <= tile.maxRegionX
    && regionZ >= tile.minRegionZ && regionZ <= tile.maxRegionZ;
}

export function wildsAtlasContainsWorld(nodes: readonly AtlasRegion[], position: { x: number; z: number }) {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const regionX = Math.floor(position.x / WILDS_REGION_SIZE);
  const regionZ = Math.floor(position.z / WILDS_REGION_SIZE);
  return nodes.some((node) => node.regionX === regionX && node.regionZ === regionZ);
}

function samePoint(left: { x: number; z: number }, right: { x: number; z: number }) {
  return Math.abs(left.x - right.x) <= 1e-8 && Math.abs(left.z - right.z) <= 1e-8;
}

function interpolate(
  start: { x: number; z: number },
  end: { x: number; z: number },
  t: number
) {
  return {
    x: start.x + (end.x - start.x) * t,
    z: start.z + (end.z - start.z) * t
  };
}

export function clipWildsAtlasRouteSegments(
  points: readonly { x: number; z: number }[],
  nodes: readonly AtlasRegion[]
): Array<readonly { x: number; z: number }[]> {
  const known = new Set(normalizedRegions(nodes).map((node) => regionKey(node.regionX, node.regionZ)));
  const output: Array<readonly { x: number; z: number }[]> = [];
  let current: Array<{ x: number; z: number }> = [];
  let crossings = 0;

  const flush = () => {
    if (current.length >= 2) output.push(current);
    current = [];
  };
  const admit = (start: { x: number; z: number }, end: { x: number; z: number }) => {
    if (current.length === 0) current.push(start, end);
    else if (samePoint(current.at(-1)!, start)) {
      if (!samePoint(current.at(-1)!, end)) current.push(end);
    } else {
      flush();
      current.push(start, end);
    }
  };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    if (![start.x, start.z, end.x, end.z].every(Number.isFinite)) {
      flush();
      continue;
    }
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    if (Math.abs(dx) <= EPSILON && Math.abs(dz) <= EPSILON) continue;

    const startRegionX = Math.floor(start.x / WILDS_REGION_SIZE);
    const startRegionZ = Math.floor(start.z / WILDS_REGION_SIZE);
    const stepX = Math.sign(dx);
    const stepZ = Math.sign(dz);
    const nextBoundaryX = stepX > 0 ? (startRegionX + 1) * WILDS_REGION_SIZE : startRegionX * WILDS_REGION_SIZE;
    const nextBoundaryZ = stepZ > 0 ? (startRegionZ + 1) * WILDS_REGION_SIZE : startRegionZ * WILDS_REGION_SIZE;
    const deltaTX = stepX === 0 ? Number.POSITIVE_INFINITY : WILDS_REGION_SIZE / Math.abs(dx);
    const deltaTZ = stepZ === 0 ? Number.POSITIVE_INFINITY : WILDS_REGION_SIZE / Math.abs(dz);
    let maxTX = stepX === 0 ? Number.POSITIVE_INFINITY : (nextBoundaryX - start.x) / dx;
    let maxTZ = stepZ === 0 ? Number.POSITIVE_INFINITY : (nextBoundaryZ - start.z) / dz;
    if (maxTX < EPSILON) maxTX += deltaTX;
    if (maxTZ < EPSILON) maxTZ += deltaTZ;
    let t = 0;

    while (t < 1 - EPSILON) {
      if (crossings >= MAX_ROUTE_CELL_CROSSINGS) {
        flush();
        return output;
      }
      const nextT = Math.min(1, maxTX, maxTZ);
      if (nextT <= t + EPSILON) {
        if (Math.abs(maxTX - nextT) <= EPSILON) maxTX += deltaTX;
        if (Math.abs(maxTZ - nextT) <= EPSILON) maxTZ += deltaTZ;
        continue;
      }
      crossings += 1;
      const midpoint = interpolate(start, end, (t + nextT) / 2);
      const cellX = Math.floor(midpoint.x / WILDS_REGION_SIZE);
      const cellZ = Math.floor(midpoint.z / WILDS_REGION_SIZE);
      const intervalStart = interpolate(start, end, t);
      const intervalEnd = interpolate(start, end, nextT);
      if (known.has(regionKey(cellX, cellZ))) admit(intervalStart, intervalEnd);
      else flush();
      t = nextT;
      if (Math.abs(maxTX - nextT) <= EPSILON) maxTX += deltaTX;
      if (Math.abs(maxTZ - nextT) <= EPSILON) maxTZ += deltaTZ;
    }
  }
  flush();
  return output;
}
