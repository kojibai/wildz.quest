import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";

export const ARENA_RULESET_ID = "wilds.arena.v1" as const;
export const ARENA_FIXED_HZ = 60 as const;
export type ArenaFrame = number;
export type ArenaVec3 = Readonly<{ x: number; y: number; z: number }>;
export type ArenaBodyFamily = "quadruped" | "biped" | "serpentine" | "winged" | "aquatic" | "heavy" | "small" | "hybrid";
export type ArenaLocomotion = "ground" | "jump" | "climb" | "fly" | "swim" | "dig";
export type ArenaCollisionBody = Readonly<{ kind: "capsule"; radius: number; height: number; centerY: number }>;

export const ARENA_RULESET_DIGEST = sha256PortableBasis(canonicalPortableCardJson({
  id: ARENA_RULESET_ID,
  fixedHz: ARENA_FIXED_HZ,
  positionQuantum: 0.001,
  velocityQuantum: 0.001,
  inputLimit: 1,
}));

export function assertArenaVec3(value: ArenaVec3) {
  if (![value.x, value.y, value.z].every(Number.isFinite)) throw new Error("arena_vector_invalid");
  return value;
}
