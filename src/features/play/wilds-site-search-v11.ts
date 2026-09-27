import { generateWildsRegionV11 } from "./wilds-region-generator-v11";
import { offsetWildsWorldAddress, parseWildsWorldAddress, type WildsWorldAddress } from "./wilds-world-address";

const REGION_MICRO = 24_000_000n;
const HINT_RADIUS_MICRO = 4_500_000n;
const HIT_RADIUS_MICRO = 1_250_000n;

export type WildsSiteObservationV11 = Readonly<{
  kind: "cold" | "near" | "site";
  site?: WildsWorldAddress;
  slot?: number;
  distanceMicro?: bigint;
  direction?: Readonly<{ x: number; z: number }>;
}>;

/** Search only the neighboring exact-address regions; no v10 catalog hotspot can appear here. */
export function observeWildsSiteV11(pointValue: WildsWorldAddress): WildsSiteObservationV11 {
  const point = parseWildsWorldAddress(pointValue);
  let nearest: { site: WildsWorldAddress; slot: number; distanceSquared: bigint; dx: bigint; dz: bigint } | undefined;
  const neighborX = point.localX < HINT_RADIUS_MICRO ? -1n : point.localX > Number(REGION_MICRO - HINT_RADIUS_MICRO) ? 1n : 0n;
  const neighborZ = point.localZ < HINT_RADIUS_MICRO ? -1n : point.localZ > Number(REGION_MICRO - HINT_RADIUS_MICRO) ? 1n : 0n;
  const regionXs = neighborX === 0n ? [BigInt(point.regionX)] : [BigInt(point.regionX), BigInt(point.regionX) + neighborX];
  const regionZs = neighborZ === 0n ? [BigInt(point.regionZ)] : [BigInt(point.regionZ), BigInt(point.regionZ) + neighborZ];
  for (const regionZ of regionZs) {
    for (const regionX of regionXs) {
      const region = generateWildsRegionV11(regionX.toString(), regionZ.toString());
      for (const candidate of region.encounterSites) {
        const dx = (regionX - BigInt(point.regionX)) * REGION_MICRO + BigInt(candidate.localX - point.localX);
        const dz = (regionZ - BigInt(point.regionZ)) * REGION_MICRO + BigInt(candidate.localZ - point.localZ);
        const distanceSquared = dx * dx + dz * dz;
        if (!nearest || distanceSquared < nearest.distanceSquared) {
          nearest = {
            site: { worldVersion: 11, regionX: region.regionX, regionZ: region.regionZ, localX: candidate.localX, localZ: candidate.localZ },
            slot: candidate.slot, distanceSquared, dx, dz
          };
        }
      }
    }
  }
  if (!nearest || nearest.distanceSquared > HINT_RADIUS_MICRO * HINT_RADIUS_MICRO) return { kind: "cold" };
  const distanceMicro = BigInt(Math.round(Math.sqrt(Number(nearest.distanceSquared))));
  if (nearest.distanceSquared <= HIT_RADIUS_MICRO * HIT_RADIUS_MICRO) {
    return { kind: "site", site: nearest.site, slot: nearest.slot, distanceMicro };
  }
  const magnitude = Math.max(Number(distanceMicro), 1);
  return { kind: "near", site: nearest.site, slot: nearest.slot, distanceMicro,
    direction: { x: Number(nearest.dx) / magnitude, z: Number(nearest.dz) / magnitude } };
}

export function observationPointV11(playerAddress: WildsWorldAddress, playerLocal: { x: number; z: number }, point: { x: number; z: number }) {
  const dx = Math.round((point.x - playerLocal.x) * 1_000_000);
  const dz = Math.round((point.z - playerLocal.z) * 1_000_000);
  if (!Number.isSafeInteger(dx) || !Number.isSafeInteger(dz)) throw new RangeError("wilds_v11_search_point_invalid");
  return offsetWildsWorldAddress(playerAddress, BigInt(dx), BigInt(dz));
}
