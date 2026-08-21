import { WILDS_TERRAIN_TILE_SIZE, sampleWildsTerrain, wildsTerrainElevation, type WildsTerrainSurface } from "./wilds-terrain-authority";
import { buildWildsTerrainTile } from "./wilds-terrain-tiles";

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

export function wildsTerrainRelativeElevation(x: number, z: number, anchor: WorldPoint) {
  return wildsTerrainElevation(x, z) - wildsTerrainElevation(anchor.x, anchor.z);
}

export function projectWildsTerrainActorPosition(actor: WorldPoint, anchor: WorldPoint, baseY = 0): [number, number, number] {
  return [
    actor.x - anchor.x,
    baseY + wildsTerrainRelativeElevation(actor.x, actor.z, anchor),
    actor.z - anchor.z
  ];
}

export function buildWildsTerrainMeshProjection(tileX: number, tileZ: number, segments: number): WildsTerrainMeshProjection {
  const tile = buildWildsTerrainTile(tileX, tileZ, segments);
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
      for (let gridZ = 0; gridZ < segments; gridZ += 1) {
        for (let gridX = 0; gridX < segments; gridX += 1) {
          const worldX = tileX * WILDS_TERRAIN_TILE_SIZE + gridX * cellSize;
          const worldZ = tileZ * WILDS_TERRAIN_TILE_SIZE + gridZ * cellSize;
          const surface = sampleWildsTerrain(worldX + cellSize / 2, worldZ + cellSize / 2).surface;
          if (surface !== "shallow-water" && surface !== "deep-water") continue;
          const layer = surface === "deep-water" ? deep : shallow;
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
