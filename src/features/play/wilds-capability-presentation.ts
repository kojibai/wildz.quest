import type { WildsCreaturePose } from "./WildsCreatureActor";
import {
  WILDS_WORLD_CAPABILITY_REGISTRY,
  type WildsWorldCapabilityFamily
} from "./wilds-world-capability-registry";

export type WildsActiveCapabilityPresentationInput = Readonly<{
  family: WildsWorldCapabilityFamily;
  targetId: string | null;
}>;

const WORK_POSES = new Set<WildsWorldCapabilityFamily>(["burrow", "break", "lumber", "quarry"]);
const IMPACT_POSES = new Set<WildsWorldCapabilityFamily>(["resist", "anchor", "rescue"]);

export function projectWildsCapabilityPresentation(input: WildsActiveCapabilityPresentationInput) {
  const definition = WILDS_WORLD_CAPABILITY_REGISTRY[input.family];
  const actorPose: WildsCreaturePose = WORK_POSES.has(input.family)
    ? "work"
    : IMPACT_POSES.has(input.family)
      ? "impact"
      : "curious";
  const color = input.family === "light"
    ? "#fff4a8"
    : input.family === "break" || input.family === "quarry"
      ? "#f0bb7b"
      : input.family === "current" || input.family === "swim" || input.family === "dive"
        ? "#72dfff"
        : "#75f3d0";
  return Object.freeze({
    family: input.family,
    actorPose,
    actorCue: definition.actorPose,
    worldEffect: definition.worldEffect,
    targetId: input.targetId,
    color
  });
}

