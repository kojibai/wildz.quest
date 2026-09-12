import { wildsVegetationAspect } from "./wilds-place-presentation";
import type { WildsResourceBodyProjection } from "./wilds-work-presentation";

export type WildsTreePart = "trunk" | "lower" | "upper" | "crown";

/** All parts share one ground root. Crown spacing follows foliage size, so
 * depleted crowns cannot separate while the trunk becomes shorter. */
export function projectWildsTreePart(item: {
  x: number; z: number; scale: number; variant: number; resourceBody?: WildsResourceBodyProjection;
}, part: WildsTreePart): { y: number; scale: [number, number, number] } {
  const size = item.scale;
  // Location-stable broad, upright and tiered growth habits share the same meshes.
  // Only instance transforms change; harvesting still ends at the same rooted stump.
  const aspect = wildsVegetationAspect(item.x, item.z);
  const spread = item.variant === 0 ? 1.24 : item.variant === 1 ? .78 : 1.02;
  const vertical = item.variant === 0 ? .86 : item.variant === 1 ? 1.24 : 1.04;
  const growth = item.resourceBody?.tree.stumpVisible ? 1 : 1 + (1 - aspect) * .65;
  const trunk = size * (1.55 + item.variant * .14) * growth * (item.resourceBody?.tree.trunkScale ?? 1);
  const root = -.035;
  if (part === "trunk") return { y: root + .6 * trunk, scale: [size, trunk, size] };
  const foliage = item.resourceBody?.tree.stumpVisible ? 0 : item.resourceBody?.tree.crownScale ?? 1;
  const crownTop = root + 1.2 * trunk * .92;
  if (part === "crown") return {
    y: crownTop,
    scale: [size * .92 * foliage * spread, size * .72 * foliage * vertical, size * .88 * foliage * spread]
  };
  return {
    y: crownTop - size * foliage * vertical / aspect * (part === "lower" ? .7 : .32),
    scale: [size * (1.18 + item.variant * .08) * foliage * aspect * spread,
      size * .92 * foliage * vertical / aspect, size * (1.08 - item.variant * .04) * foliage * aspect * spread]
  };
}
