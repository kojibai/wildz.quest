import { verifyWildsConstructionComponent, projectWildsConstructionProgress, type WildsConstructionComponentV1, type WildsConstructionMaterialContributionV1, type WildsConstructionWorkContributionV1 } from "./wilds-construction-component";

/** A framed stage selects authored catalog solids; openings never become gross boxes. */
export function projectWildsConstructionStageGeometry(component: WildsConstructionComponentV1, materials: WildsConstructionMaterialContributionV1[], work: WildsConstructionWorkContributionV1[]) {
  if (!verifyWildsConstructionComponent(component)) throw new Error("wilds_construction_geometry_lineage_invalid");
  const progress = projectWildsConstructionProgress(component, materials, work);
  const exact = component.kind === "stair" ? projectWildsConstructionStairs(component.placement) : component.placement.collisionSolids;
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

/** Eight walkable treads share the catalog stair envelope and rotation. */
export function projectWildsConstructionStairs(placement: import("./wilds-world-construction").WildsBlueprintPlacement) {
  const center = placement.geometry.center;
  const turn = placement.transform.rotationQuarterTurns;
  return Array.from({ length: 8 }, (_, index) => {
    const localZ = -2 + (index + .5) * .5;
    const halfY = (index + 1) * .125;
    const dx = turn === 1 ? localZ : turn === 3 ? -localZ : 0;
    const dz = turn === 0 ? localZ : turn === 2 ? -localZ : 0;
    return { id: `${placement.placementId}:tread:${index}`, center: { x: center.x + dx, y: center.y - 1 + halfY, z: center.z + dz },
      halfExtents: { x: turn % 2 ? .25 : 1.2, y: halfY, z: turn % 2 ? 1.2 : .25 } };
  });
}
