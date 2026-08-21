import { WILDS_TERRAIN_TILE_SIZE, wildsTerrainElevation } from "./wilds-terrain-authority";
import { buildWildsTerrainTile } from "./wilds-terrain-tiles";

type WorldPoint = Readonly<{ x: number; z: number }>;

export type WildsTerrainMeshVertex = {
  grid: { x: number; z: number };
  world: { x: number; z: number };
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
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

export function wildsTerrainRelativeElevation(x: number, z: number, anchor: WorldPoint) {
  return wildsTerrainElevation(x, z) - wildsTerrainElevation(anchor.x, anchor.z);
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
      normal: { ...vertex.normal }
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
