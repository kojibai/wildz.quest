import { verifyWildsConstructionComponent, projectWildsConstructionProgress, type WildsConstructionComponentV1, type WildsConstructionMaterialContributionV1, type WildsConstructionWorkContributionV1 } from "./wilds-construction-component";

/** A framed stage selects authored catalog solids; openings never become gross boxes. */
export function projectWildsConstructionStageGeometry(component: WildsConstructionComponentV1, materials: WildsConstructionMaterialContributionV1[], work: WildsConstructionWorkContributionV1[]) {
  if (!verifyWildsConstructionComponent(component)) throw new Error("wilds_construction_geometry_lineage_invalid");
  const progress = projectWildsConstructionProgress(component, materials, work);
  const exact = component.placement.collisionSolids;
  const framed = component.kind === "room"
    ? exact.filter((solid) => solid.id.endsWith(":floor"))
    : exact.filter((solid) => !/:solid:(lintel|door-lintel|window-lintel|back|front-left|front-right)$/.test(solid.id));
  return {
    componentId: component.componentId,
    componentHead: component.head,
    stageGeometryDigest: component.stageGeometryDigest,
    stage: progress.stage,
    solids: progress.stage === "planned" ? [] : progress.stage === "framed" ? framed : exact,
    anchors: component.anchors
  };
}
