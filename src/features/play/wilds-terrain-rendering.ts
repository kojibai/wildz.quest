import { WILDS_TERRAIN_TILE_SIZE, WILDS_TERRAIN_VERSION, sampleWildsTerrain, wildsTerrainElevation, type WildsTerrainSurface } from "./wilds-terrain-authority";
import { buildWildsTerrainTile, wildsTerrainTileKey, type WildsTerrainTileData } from "./wilds-terrain-tiles";

type WorldPoint = Readonly<{ x: number; z: number }>;

export const WILDS_WATERLINE_ELEVATION = -1.06;

export type WildsTerrainMeshVertex = {
  grid: { x: number; z: number };
  world: { x: number; z: number };
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  surface: WildsTerrainSurface;
};

export type WildsTerrainWaterLayer = {
  positions: readonly number[];
  normals: readonly number[];
  indices: readonly number[];
};

export type WildsTerrainWaterProjection = {
  origin: { x: number; z: number };
  waterline: number;
  shallow: WildsTerrainWaterLayer;
  deep: WildsTerrainWaterLayer;
};

export type WildsTerrainMeshProjection = {
  origin: { x: number; z: number };
  segments: number;
  positions: readonly number[];
  normals: readonly number[];
  uvs: readonly number[];
  indices: readonly number[];
  vertices: readonly WildsTerrainMeshVertex[];
};

export type WildsTerrainRibbonProjection = {
  positions: readonly number[];
  uvs: readonly number[];
  indices: readonly number[];
  vertices: readonly Pick<WildsTerrainMeshVertex, "world" | "position">[];
};

let actorTerrainSamples = 0;
let anchorTerrainSamples = 0;

// A moving patch revisits nearly all of its tiles at each tile transition.
// Bound both caches by entry count and estimated storage so high segment counts
// cannot retain an unbounded set of sampled terrain objects.
function createTerrainRenderCache<T>(maxEntries: number, maxBytes: number) {
  const entries = new Map<string, { value: T; bytes: number }>();
  let bytes = 0;
  let hits = 0;
  let misses = 0;
  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) {
        misses += 1;
        return undefined;
      }
      hits += 1;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: T, entryBytes: number) {
      if (entryBytes > maxBytes) return;
      const previous = entries.get(key);
      if (previous) {
        bytes -= previous.bytes;
        entries.delete(key);
      }
      entries.set(key, { value, bytes: entryBytes });
      bytes += entryBytes;
      while (entries.size > maxEntries || bytes > maxBytes) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        bytes -= entries.get(oldestKey)!.bytes;
        entries.delete(oldestKey);
      }
    },
    clear() {
      entries.clear();
      bytes = 0;
      hits = 0;
      misses = 0;
    },
    diagnostics() {
      return { entries: entries.size, bytes, hits, misses, maxEntries, maxBytes };
    }
  };
}

const meshTileCache = createTerrainRenderCache<WildsTerrainTileData>(384, 12 * 1024 * 1024);
const waterTileCache = createTerrainRenderCache<Uint8Array>(512, 1024 * 1024);

export function wildsTerrainRenderCacheDiagnostics() {
  return Object.freeze({ mesh: meshTileCache.diagnostics(), water: waterTileCache.diagnostics() });
}

export function clearWildsTerrainRenderCaches() {
  meshTileCache.clear();
  waterTileCache.clear();
}

function cachedTerrainTile(tileX: number, tileZ: number, segments: number): WildsTerrainTileData {
  if (!Number.isInteger(segments) || segments < 1 || segments > 64) throw new Error("wilds_terrain_tile_segments_invalid");
  const key = `${wildsTerrainTileKey(tileX, tileZ)}:${segments}`;
  const cached = meshTileCache.get(key);
  if (cached) return cached;
  const tile = buildWildsTerrainTile(tileX, tileZ, segments);
  // Account conservatively for the tile vertex and its nested normal object.
  meshTileCache.set(key, tile, tile.vertices.length * 256 + key.length * 2 + 64);
  return tile;
}

function cachedWaterSurfaces(tileX: number, tileZ: number, segments: number, cellSize: number): Uint8Array {
  // Water sampling uses the incoming coordinates without terrain-tile truncation.
  const key = `${WILDS_TERRAIN_VERSION}:${tileX}:${tileZ}:${segments}`;
  const cached = waterTileCache.get(key);
  if (cached) return cached;
  const surfaces = new Uint8Array(segments * segments);
  for (let gridZ = 0; gridZ < segments; gridZ += 1) {
    for (let gridX = 0; gridX < segments; gridX += 1) {
      const worldX = tileX * WILDS_TERRAIN_TILE_SIZE + gridX * cellSize;
      const worldZ = tileZ * WILDS_TERRAIN_TILE_SIZE + gridZ * cellSize;
      surfaces[gridZ * segments + gridX] = sampleWildsTerrain(worldX + cellSize / 2, worldZ + cellSize / 2).surface === "shallow-water" ? 1 : 0;
    }
  }
  waterTileCache.set(key, surfaces, surfaces.byteLength + key.length * 2 + 64);
  return surfaces;
}

export type WildsTerrainActorProjectionInput = Readonly<{
  actorElevation?: number;
  anchorElevation?: number;
}>;

export function wildsTerrainRelativeElevation(x: number, z: number, anchor: WorldPoint, projection: WildsTerrainActorProjectionInput = {}) {
  let actorElevation = projection.actorElevation;
  if (actorElevation === undefined) {
    actorTerrainSamples += 1;
    actorElevation = wildsTerrainElevation(x, z);
  }
  let anchorElevation = projection.anchorElevation;
  if (anchorElevation === undefined) {
    anchorTerrainSamples += 1;
    anchorElevation = wildsTerrainElevation(anchor.x, anchor.z);
  }
  return actorElevation - anchorElevation;
}

export function projectWildsTerrainActorPosition(
  actor: WorldPoint,
  anchor: WorldPoint,
  baseY = 0,
  projection: WildsTerrainActorProjectionInput = {}
): [number, number, number] {
  return [
    actor.x - anchor.x,
    baseY + wildsTerrainRelativeElevation(actor.x, actor.z, anchor, projection),
    actor.z - anchor.z
  ];
}

export function writeWildsTerrainActorPosition<T extends { set: (x: number, y: number, z: number) => unknown }>(
  target: T,
  actorX: number,
  actorZ: number,
  anchorX: number,
  anchorZ: number,
  baseY = 0,
  admittedActorElevation?: number,
  admittedAnchorElevation?: number
): T {
  let actorElevation = admittedActorElevation;
  if (actorElevation === undefined) {
    actorTerrainSamples += 1;
    actorElevation = wildsTerrainElevation(actorX, actorZ);
  }
  let anchorElevation = admittedAnchorElevation;
  if (anchorElevation === undefined) {
    anchorTerrainSamples += 1;
    anchorElevation = wildsTerrainElevation(anchorX, anchorZ);
  }
  target.set(actorX - anchorX, baseY + actorElevation - anchorElevation, actorZ - anchorZ);
  return target;
}

export function wildsTerrainProjectionDiagnostics() {
  return Object.freeze({ actorTerrainSamples, anchorTerrainSamples });
}

export function buildWildsTerrainMeshProjection(tileX: number, tileZ: number, segments: number): WildsTerrainMeshProjection {
  const tile = cachedTerrainTile(tileX, tileZ, segments);
  const origin = {
    x: tile.tileX * WILDS_TERRAIN_TILE_SIZE,
    z: tile.tileZ * WILDS_TERRAIN_TILE_SIZE
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertices = tile.vertices.map((vertex): WildsTerrainMeshVertex => {
    const projected = {
      grid: { x: vertex.gridX, z: vertex.gridZ },
      world: { x: vertex.x, z: vertex.z },
      position: {
        x: vertex.x - origin.x,
        y: vertex.elevation,
        z: vertex.z - origin.z
      },
      normal: { ...vertex.normal },
      surface: vertex.surface
    };
    positions.push(projected.position.x, projected.position.y, projected.position.z);
    normals.push(projected.normal.x, projected.normal.y, projected.normal.z);
    uvs.push(vertex.gridX / segments, vertex.gridZ / segments);
    return projected;
  });

  const rowLength = segments + 1;
  for (let gridZ = 0; gridZ < segments; gridZ += 1) {
    for (let gridX = 0; gridX < segments; gridX += 1) {
      const northwest = gridZ * rowLength + gridX;
      const northeast = northwest + 1;
      const southwest = northwest + rowLength;
      const southeast = southwest + 1;
      indices.push(northwest, southwest, northeast, northeast, southwest, southeast);
    }
  }

  return { origin, segments, positions, normals, uvs, indices, vertices };
}

export function buildWildsTerrainWaterProjection(
  centerTileX: number,
  centerTileZ: number,
  radius: number,
  segments: number
): WildsTerrainWaterProjection {
  if (!Number.isInteger(radius) || radius < 0 || radius > 4) throw new Error("wilds_terrain_water_radius_invalid");
  if (!Number.isInteger(segments) || segments < 1 || segments > 64) throw new Error("wilds_terrain_water_segments_invalid");
  const origin = {
    x: (centerTileX - radius) * WILDS_TERRAIN_TILE_SIZE,
    z: (centerTileZ - radius) * WILDS_TERRAIN_TILE_SIZE
  };
  const waterline = WILDS_WATERLINE_ELEVATION;
  const shallow = { positions: [] as number[], normals: [] as number[], indices: [] as number[] };
  const deep = { positions: [] as number[], normals: [] as number[], indices: [] as number[] };
  const cellSize = WILDS_TERRAIN_TILE_SIZE / segments;

  for (let tileZ = centerTileZ - radius; tileZ <= centerTileZ + radius; tileZ += 1) {
    for (let tileX = centerTileX - radius; tileX <= centerTileX + radius; tileX += 1) {
      const surfaces = cachedWaterSurfaces(tileX, tileZ, segments, cellSize);
      for (let gridZ = 0; gridZ < segments; gridZ += 1) {
        for (let gridX = 0; gridX < segments; gridX += 1) {
          const worldX = tileX * WILDS_TERRAIN_TILE_SIZE + gridX * cellSize;
          const worldZ = tileZ * WILDS_TERRAIN_TILE_SIZE + gridZ * cellSize;
          // Keep a continuous water body below the terrain. Opaque terrain hides this
          // plane on land, while submerged route shoulders can no longer punch square
          // holes through the ocean merely because their cell center is a trail.
          const layer = surfaces[gridZ * segments + gridX] === 1 ? shallow : deep;
          const vertexOffset = layer.positions.length / 3;
          const x0 = worldX - origin.x;
          const z0 = worldZ - origin.z;
          const x1 = x0 + cellSize;
          const z1 = z0 + cellSize;
          layer.positions.push(
            x0, waterline, z0,
            x0, waterline, z1,
            x1, waterline, z0,
            x1, waterline, z1
          );
          layer.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
          layer.indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset + 2, vertexOffset + 1, vertexOffset + 3);
        }
      }
    }
  }
  return { origin, waterline, shallow, deep };
}

export function buildWildsTerrainPatchProjection(centerTileX: number, centerTileZ: number, radius: number, segments: number): WildsTerrainMeshProjection {
  if (!Number.isInteger(radius) || radius < 0 || radius > 4) throw new Error("wilds_terrain_patch_radius_invalid");
  const origin = {
    x: (centerTileX - radius) * WILDS_TERRAIN_TILE_SIZE,
    z: (centerTileZ - radius) * WILDS_TERRAIN_TILE_SIZE
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertices: WildsTerrainMeshVertex[] = [];
  const patchExtent = (radius * 2 + 1) * WILDS_TERRAIN_TILE_SIZE;

  for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const tile = buildWildsTerrainMeshProjection(centerTileX + offsetX, centerTileZ + offsetZ, segments);
      const vertexOffset = vertices.length;
      for (const vertex of tile.vertices) {
        const projected: WildsTerrainMeshVertex = {
          ...vertex,
          position: {
            x: vertex.world.x - origin.x,
            y: vertex.position.y,
            z: vertex.world.z - origin.z
          }
        };
        vertices.push(projected);
        positions.push(projected.position.x, projected.position.y, projected.position.z);
        normals.push(projected.normal.x, projected.normal.y, projected.normal.z);
        uvs.push(projected.position.x / patchExtent, projected.position.z / patchExtent);
      }
      for (const index of tile.indices) indices.push(index + vertexOffset);
    }
  }

  return { origin, segments, positions, normals, uvs, indices, vertices };
}

export function buildWildsTerrainRibbonProjection(
  points: readonly WorldPoint[],
  halfWidth: number,
  verticalOffset = 0.03,
  maxSegmentLength = 2
): WildsTerrainRibbonProjection {
  if (points.length < 2 || !Number.isFinite(halfWidth) || halfWidth <= 0 || !Number.isFinite(maxSegmentLength) || maxSegmentLength <= 0) {
    throw new Error("wilds_terrain_ribbon_invalid");
  }
  const centers: WorldPoint[] = [{ ...points[0]! }];
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const start = points[pointIndex - 1]!;
    const end = points[pointIndex]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / maxSegmentLength));
    for (let step = 1; step <= steps; step += 1) {
      const amount = step / steps;
      centers.push({
        x: start.x + (end.x - start.x) * amount,
        z: start.z + (end.z - start.z) * amount
      });
    }
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertices: Pick<WildsTerrainMeshVertex, "world" | "position">[] = [];
  centers.forEach((center, index) => {
    const previous = centers[Math.max(0, index - 1)]!;
    const next = centers[Math.min(centers.length - 1, index + 1)]!;
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const tangentLength = Math.hypot(tangentX, tangentZ) || 1;
    const normalX = -tangentZ / tangentLength;
    const normalZ = tangentX / tangentLength;
    [-1, 1].forEach((side, sideIndex) => {
      const world = {
        x: center.x + normalX * halfWidth * side,
        z: center.z + normalZ * halfWidth * side
      };
      const position = { x: world.x, y: wildsTerrainElevation(world.x, world.z) + verticalOffset, z: world.z };
      vertices.push({ world, position });
      positions.push(position.x, position.y, position.z);
      uvs.push(sideIndex, index / Math.max(1, centers.length - 1));
    });
    if (index < centers.length - 1) {
      const start = index * 2;
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  });

  return { positions, uvs, indices, vertices };
}
