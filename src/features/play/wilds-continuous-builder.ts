import { createWildsConstructionProject } from "./wilds-construction-project";
import { projectWildsProductionPlacementEvidence, type WildsConstructionPlacementRequest } from "./wilds-construction-placement";
import { previewWildsBlueprintPlacement, type WildsConstructionKind } from "./wilds-world-construction";
import { type WildsWorldProjection } from "./wilds-world-state";
import { type WildsConstructionProgress } from "./wilds-construction-component";
import { type WildsMaterialLotV1 } from "./wilds-steward-construction";
import { regionForPosition } from "./multiplayer-core";

export function previewWildsContinuousBuild(world: WildsWorldProjection, owner: string, kind: WildsConstructionKind, request: WildsConstructionPlacementRequest) {
  const region = regionForPosition(request.pointer);
  const project = Object.values(world.constructionProjects).filter(p => p.ownerReceizId === owner && p.region.x === region.x && p.region.z === region.z)
    .sort((a, b) => a.projectId.localeCompare(b.projectId))[0];
  const draft = project ?? createWildsConstructionProject({ ownerReceizId: owner, name: "My place", region, commandId: "construction:preview", kaiUPulse: 0 });
  const evidence = projectWildsProductionPlacementEvidence({ ...world, constructionProjects: { ...world.constructionProjects, [draft.projectId]: draft } }, draft.projectId, request);
  const placement = previewWildsBlueprintPlacement({ ...evidence, blueprint: evidence.sourceBlueprint, kind });
  return { project: project ?? null, region, placement, request };
}

export function selectWildsConstructionDeposit(lots: readonly WildsMaterialLotV1[], progress: WildsConstructionProgress): string[] {
  return (["hay", "timber", "stone"] as const).flatMap(kind => lots.filter(lot => lot.kind === kind)
    .sort((a, b) => a.lotId.localeCompare(b.lotId)).slice(0, progress.materials[kind].remaining).map(lot => lot.lotId));
}

export function wildsConstructionCue(cue: string): string {
  return ({ "needs-structure-anchor": "Choose Foundation first and place its plan, then position this piece on its support.", "needs-dry-ground": "Move this workbench onto dry ground.", "needs-water": "Choose water for this piece.",
    "needs-terrain-support": "Lower this piece onto the ground.", blocked: "Move or rotate this piece into a clear spot. It overlaps another structure.",
    "blueprint-collision": "Move or rotate this piece clear of the existing plan." } as Record<string, string>)[cue] ?? "Choose another spot.";
}

export function wildsConstructionLabel(kind: WildsConstructionKind): string {
  return kind === "stair" ? "Stairs" : kind === "workshop" ? "Workbench" : kind.charAt(0).toUpperCase() + kind.slice(1);
}
