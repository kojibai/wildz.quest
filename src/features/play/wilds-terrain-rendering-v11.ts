import { sampleWildsTerrainV11 } from "./wilds-terrain-authority";
import { offsetWildsWorldAddress, type WildsWorldAddress } from "./wilds-world-address";

export type WildsTerrainPatchV11 = Readonly<{
  originX: number;
  originZ: number;
  vertexCount: number;
  positions: readonly number[];
  normals: readonly number[];
  uvs: readonly number[];
  indices: readonly number[];
  vertices: readonly Readonly<{ address: WildsWorldAddress; y: number; surface: string }>[];
}>;

/** Build only the visible local mesh; no distant region is converted to Number. */
export function buildWildsTerrainPatchV11(
  playerAddress: WildsWorldAddress,
  centerTileX: number,
  centerTileZ: number,
  tileSize: number,
  radius: number,
  segmentsPerTile: number
): WildsTerrainPatchV11 {
  if (![centerTileX, centerTileZ, tileSize, radius, segmentsPerTile].every(Number.isSafeInteger)
    || tileSize <= 0 || radius < 0 || radius > 4 || segmentsPerTile < 1 || segmentsPerTile > 8) {
    throw new RangeError("wilds_v11_render_patch_invalid");
  }
  const originX = (centerTileX - radius) * tileSize;
  const originZ = (centerTileZ - radius) * tileSize;
  const cells = (radius * 2 + 1) * segmentsPerTile;
  const step = tileSize / segmentsPerTile;
  const playerX = playerAddress.localX / 1_000_000;
  const playerZ = playerAddress.localZ / 1_000_000;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertices: { address: WildsWorldAddress; y: number; surface: string }[] = [];
  for (let z = 0; z <= cells; z += 1) {
    for (let x = 0; x <= cells; x += 1) {
      const localX = originX + x * step;
      const localZ = originZ + z * step;
      const address = offsetWildsWorldAddress(playerAddress,
        BigInt(Math.round((localX - playerX) * 1_000_000)),
        BigInt(Math.round((localZ - playerZ) * 1_000_000)));
      const terrain = sampleWildsTerrainV11(address);
      positions.push(localX - originX, terrain.elevation, localZ - originZ);
      normals.push(terrain.normal.x, terrain.normal.y, terrain.normal.z);
      uvs.push(localX / 3, localZ / 3);
      vertices.push({ address, y: terrain.elevation, surface: terrain.surface });
    }
  }
  for (let z = 0; z < cells; z += 1) {
    for (let x = 0; x < cells; x += 1) {
      const corner = z * (cells + 1) + x;
      indices.push(corner, corner + cells + 1, corner + 1);
      indices.push(corner + 1, corner + cells + 1, corner + cells + 2);
    }
  }
  return { originX, originZ, vertexCount: vertices.length, positions, normals, uvs, indices, vertices };
}
