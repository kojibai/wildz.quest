import type { ArenaAffinity } from "./types";

export function mortalArenaCameraDistance(input: {
  separationX: number;
  separationZ: number;
  aspect: number;
  verticalFovDegrees: number;
}) {
  const aspect = Number.isFinite(input.aspect) && input.aspect > 0 ? Math.max(.35, input.aspect) : 1;
  const verticalFov = Math.max(20, Math.min(80, input.verticalFovDegrees)) * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const halfCombatWidth = Math.abs(input.separationX) / 2 + 2.2;
  const horizontalFit = halfCombatWidth / Math.max(.12, Math.tan(horizontalFov / 2));
  const depthFit = 10.4 + Math.abs(input.separationZ) * .48;
  return Math.max(10.4, Math.min(32, Math.max(horizontalFit, depthFit)));
}

export function mortalArenaRivalCreature(affinity: ArenaAffinity) {
  if (affinity === "Grove") return { familyId: "mintcub", formId: "mintcub-3" } as const;
  if (affinity === "Spark" || affinity === "Ember") return { familyId: "voltray", formId: "voltray-3" } as const;
  if (affinity === "Tide") return { familyId: "ledgerfox", formId: "ledgerfox-3" } as const;
  return { familyId: "titanseal", formId: "titanseal-3" } as const;
}
