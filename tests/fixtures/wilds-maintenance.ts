import { constructionProofDigest, createWildsConstructionProject } from "../../src/features/play/wilds-construction-project";
import { createWildsConstructionComponent, createWildsMaterialContribution, createWildsWorkContribution, projectWildsConstructionProgress } from "../../src/features/play/wilds-construction-component";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from "../../src/features/play/wilds-world-construction";
import type { WildsMaterialLotV1 } from "../../src/features/play/wilds-steward-construction";
import { initialWildsWorldProjection } from "../../src/features/play/wilds-world-state";
export function lot(index: number, kind: WildsMaterialLotV1["kind"]): WildsMaterialLotV1 {
  const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:${kind}:${index.toString(16).padStart(64,"0")}`, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: "owner", source: { sourceId: "source:test", sourceHead: `sha256:${"a".repeat(64)}`, admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: 1 }, contributors: { explorerReceizId: "owner" }, authority: "source-proof-object" as const };
  return { ...basis, head: constructionProofDigest(basis) };
}
export function fixture(kind: "workshop" | "storage" | "bed" | "roof", amount: number, offset = 0) {
  const project = createWildsConstructionProject({ ownerReceizId: "owner", name: "Functions", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const base = createWildsBlueprintPreview("blueprint:test", "wildz.excavation.region.v1:0:0");
  const foundation = previewWildsBlueprintPlacement({ blueprint: base, kind: "foundation", pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } });
  const support = kind === "roof" ? previewWildsBlueprintPlacement({ blueprint: { ...base, pieces: [foundation] }, kind: "room", pointer: { x: 2, y: .6, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: foundation.anchors, solids: foundation.collisionSolids } }) : foundation;
  const evidence = { sourceBlueprint: { ...base, pieces: support === foundation ? [foundation] : [foundation, support] }, pointer: { x: 2, y: .6, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, physical: { terrainY: 0, waterline: null, anchors: support.anchors, solids: support.collisionSolids } };
  const component = createWildsConstructionComponent({ project, evidence, placement: previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind, ...evidence }), ownerReceizId: "owner", kaiUPulse: 2 });
  let index = offset;
  const lots = component.recipe.stages.flatMap(stage => (["hay", "timber", "stone"] as const).flatMap(k => Array.from({length: stage.materials[k]}, () => lot(++index, k))));
  const materials = lots.map(lot => createWildsMaterialContribution({ component, lot, custodianReceizId: "owner", contributorReceizId: "owner", commandId: `deposit:${lot.lotId}`, kaiUPulse: 3 }));
  const work = [createWildsWorkContribution({ component, materials, worker: { kind: "player", receizId: "owner" }, amount, commandId: "work:1", kaiUPulse: 4 })];
  const progress = projectWildsConstructionProgress(component, materials, work);
  const world = { ...initialWildsWorldProjection(), constructionComponents: { [component.componentId]: component }, materialLots: Object.fromEntries(lots.map(l => [l.lotId,l])), constructionMaterialContributions: Object.fromEntries(materials.map(p => [p.contributionId,p])), constructionWorkContributions: Object.fromEntries(work.map(p => [p.contributionId,p])), consumedMaterialLots: Object.fromEntries(progress.embeddedLotIds.map(id => [id,component.componentId])) };
  return { world, component };
}
