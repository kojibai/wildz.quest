import { wildsVegetationAspect } from "./wilds-place-presentation";
import type { WildsResourceBodyProjection } from "./wilds-work-presentation";

export type WildsTreePart = "trunk" | "lower" | "upper" | "crown";

/** All parts share one ground root. Crown spacing follows foliage size, so
 * depleted crowns cannot separate while the trunk becomes shorter. */
export function projectWildsTreePart(item: {
  x: number; z: number; scale: number; variant: number; resourceBody?: WildsResourceBodyProjection;
}, part: WildsTreePart): { y: number; scale: [number, number, number] } {
  const size = item.scale;
  const trunk = size * (1.55 + item.variant * .14) * (item.resourceBody?.tree.trunkScale ?? 1);
  const root = -.035;
  if (part === "trunk") return { y: root + .6 * trunk, scale: [size, trunk, size] };
  const foliage = item.resourceBody?.tree.stumpVisible ? 0 : item.resourceBody?.tree.crownScale ?? 1;
  const aspect = wildsVegetationAspect(item.x, item.z);
  const crownTop = root + 1.2 * trunk * .92;
  if (part === "crown") return {
    y: crownTop,
    scale: [size * .92 * foliage, size * .72 * foliage, size * .88 * foliage]
  };
  return {
    y: crownTop - size * foliage / aspect * (part === "lower" ? .7 : .32),
    scale: [size * (1.18 + item.variant * .08) * foliage * aspect,
      size * .92 * foliage / aspect, size * (1.08 - item.variant * .04) * foliage * aspect]
  };
}
