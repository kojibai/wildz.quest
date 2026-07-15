import type { WildsLandmarkAccessRequirement, WildsLandmarkDefinition } from "./wilds-landmarks";

export type WildsLandmarkProgress = {
  verifiedCardCount: number;
  activeCardLevel: number;
  achievementIds: readonly string[];
  partySize: number;
};

export type WildsLandmarkAccess = {
  allowed: boolean;
  summary: string;
  satisfied: readonly WildsLandmarkAccessRequirement[];
  unmet: readonly WildsLandmarkAccessRequirement[];
};

function requirementMet(requirement: WildsLandmarkAccessRequirement, progress: WildsLandmarkProgress) {
  if (requirement.kind === "cards") return progress.verifiedCardCount >= requirement.minimum;
  if (requirement.kind === "level") return progress.activeCardLevel >= requirement.minimum;
  if (requirement.kind === "party") return progress.partySize >= requirement.minimum;
  return progress.achievementIds.includes(requirement.id);
}

export function evaluateLandmarkAccess(landmark: WildsLandmarkDefinition, progress: WildsLandmarkProgress): WildsLandmarkAccess {
  const satisfied = landmark.access.requirements.filter((requirement) => requirementMet(requirement, progress));
  const unmet = landmark.access.requirements.filter((requirement) => !requirementMet(requirement, progress));
  const allowed = landmark.access.mode === "public"
    || (landmark.access.mode === "any" ? satisfied.length > 0 : unmet.length === 0);
  const summary = allowed
    ? landmark.access.mode === "public" ? "Open to every explorer" : "Entrance awakened"
    : `${landmark.access.mode === "any" ? "Complete any: " : "Complete all: "}${unmet.map((requirement) => requirement.label).join(" · ")}`;
  return { allowed, summary, satisfied, unmet };
}
