import { wildsTerrainRelativeElevation } from "./wilds-terrain-rendering";

type WorldPoint = Readonly<{ x: number; z: number }>;

export function projectWildsEcologyInstance(
  item: WorldPoint,
  player: WorldPoint,
  y: number,
  shape: readonly [number, number, number],
  arrivalClearRadius = 0
) {
  const insideArrivalClearing = Math.hypot(item.x, item.z) < arrivalClearRadius;
  return {
    position: [item.x - player.x, y + wildsTerrainRelativeElevation(item.x, item.z, player), item.z - player.z] as [number, number, number],
    scale: insideArrivalClearing
      ? [0, 0, 0] as [number, number, number]
      : [...shape] as [number, number, number]
  };
}
