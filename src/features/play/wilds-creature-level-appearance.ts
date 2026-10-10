import { currentCreatureHistoryProjection } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

export type WildsCreatureLevelAppearance = Readonly<{ level: number; head: number; torso: number; limb: number }>;
const birthAppearance: WildsCreatureLevelAppearance = Object.freeze({ level: 1, head: 1, torso: 1, limb: 1 });
const appearances = new WeakMap<PortableCardAsset, WildsCreatureLevelAppearance>();

/** A view of this exact card's earned history. Growth never rewrites its birth,
 * genome, face, abilities or stage, and never reads shared family XP. */
export function projectCardCreatureLevelAppearance(asset: PortableCardAsset): WildsCreatureLevelAppearance {
  const cached = appearances.get(asset);
  if (cached) return cached;
  const value = isLivingCardAsset(asset) ? currentCreatureHistoryProjection(asset).level : 1;
  const level = Number.isSafeInteger(value) && value >= 1 ? Math.min(10, value) : 1;
  const growth = Math.log2(level);
  const appearance = level === 1 ? birthAppearance : Object.freeze({ level, head: 1 + growth * .02, torso: 1 + growth * .10, limb: 1 + growth * .06 });
  appearances.set(asset, appearance);
  return appearance;
}
