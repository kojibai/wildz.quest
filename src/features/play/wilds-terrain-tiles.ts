import {
  WILDS_TERRAIN_TILE_SIZE,
  WILDS_TERRAIN_VERSION,
  sampleWildsTerrain,
  type WildsTerrainSample,
  type WildsTerrainSurface
} from "./wilds-terrain-authority";

export type WildsTerrainTileCoordinate = {
  tileX: number;
  tileZ: number;
};

export type WildsTerrainTileVertex = {
  gridX: number;
  gridZ: number;
  x: number;
  z: number;
  elevation: number;
  normal: WildsTerrainSample["normal"];
  surface: WildsTerrainSurface;
};

export type WildsTerrainTileData = {
  key: string;
  version: typeof WILDS_TERRAIN_VERSION;
  tileX: number;
  tileZ: number;
  segments: number;
  vertices: readonly WildsTerrainTileVertex[];
};

function finiteCoordinate(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function wildsTerrainTileCoordinate(x: number, z: number): WildsTerrainTileCoordinate {
  return {
    tileX: Math.floor(finiteCoordinate(x) / WILDS_TERRAIN_TILE_SIZE),
    tileZ: Math.floor(finiteCoordinate(z) / WILDS_TERRAIN_TILE_SIZE)
  };
}

export function wildsTerrainTileKey(tileX: number, tileZ: number) {
  const safeTileX = Number.isFinite(tileX) ? Math.trunc(tileX) : 0;
  const safeTileZ = Number.isFinite(tileZ) ? Math.trunc(tileZ) : 0;
  return `${WILDS_TERRAIN_VERSION}:${safeTileX}:${safeTileZ}`;
}

export function buildWildsTerrainTile(tileX: number, tileZ: number, segments: number): WildsTerrainTileData {
  if (!Number.isInteger(segments) || segments < 1 || segments > 64) throw new Error("wilds_terrain_tile_segments_invalid");
  const safeTileX = Number.isFinite(tileX) ? Math.trunc(tileX) : 0;
  const safeTileZ = Number.isFinite(tileZ) ? Math.trunc(tileZ) : 0;
  const originX = safeTileX * WILDS_TERRAIN_TILE_SIZE;
  const originZ = safeTileZ * WILDS_TERRAIN_TILE_SIZE;
  const vertices: WildsTerrainTileVertex[] = [];

  for (let gridZ = 0; gridZ <= segments; gridZ += 1) {
    for (let gridX = 0; gridX <= segments; gridX += 1) {
      const x = quantize(originX + (gridX / segments) * WILDS_TERRAIN_TILE_SIZE);
      const z = quantize(originZ + (gridZ / segments) * WILDS_TERRAIN_TILE_SIZE);
      const sample = sampleWildsTerrain(x, z);
      vertices.push({
        gridX,
        gridZ,
        x,
        z,
        elevation: sample.elevation,
        normal: sample.normal,
        surface: sample.surface
      });
    }
  }

  return {
    key: wildsTerrainTileKey(safeTileX, safeTileZ),
    version: WILDS_TERRAIN_VERSION,
    tileX: safeTileX,
    tileZ: safeTileZ,
    segments,
    vertices
  };
}
