import { composeWildsBurrowPhysical } from "./wilds-burrow";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition } from "./wilds-discovery-sites";
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY } from "./wilds-site-runtime";
import { previewWildsBlueprintPlacement, createWildsBlueprintPreview, type WildsProductionPlacementEvidence } from "./wilds-world-construction";
import { verifyWildsConstructionComponent } from "./wilds-construction-component";
import { verifyWildsConstructionProject, wildsConstructionRegionId } from "./wilds-construction-project";
import { type WildsWorldProjection } from "./wilds-world-state";
import { projectWildsConstructionStageGeometry } from "./wilds-construction-geometry";
import { sampleWildsTerrain } from "./wilds-terrain-authority";

export type WildsConstructionPlacementRequest = Pick<WildsProductionPlacementEvidence, "spaceId" | "pointer" | "rotationQuarterTurns" | "heightStep" | "surfaceSnap">;

/** Both preview and admission use this exact source request and admitted neighborhood. */
export function projectWildsProductionPlacementEvidence(world: WildsWorldProjection, projectId: string, request: WildsConstructionPlacementRequest): WildsProductionPlacementEvidence {
  const project = world.constructionProjects[projectId];
  if (!project || !verifyWildsConstructionProject(project)) throw new Error("wilds_construction_project_invalid");
  if (!request || !request.pointer || ![request.pointer.x, request.pointer.y, request.pointer.z].every(Number.isFinite)) throw new Error("wilds_construction_request_invalid");
  // Catalog extents <= 6 and snapping distance <= 8. Include adjacent regions too.
  const nearby = Object.values(world.constructionComponents)
    .filter((component) => (component.evidence.spaceId ?? "wildz.space.outer.v1") === (request.spaceId ?? "wildz.space.outer.v1") && Math.abs(component.transform.position.x - request.pointer.x) <= 32 && Math.abs(component.transform.position.z - request.pointer.z) <= 32)
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
  if (nearby.some((component) => !verifyWildsConstructionComponent(component))) throw new Error("wilds_construction_source_invalid");
  const geometry = nearby.map((component) => projectWildsConstructionStageGeometry(component, Object.values(world.constructionMaterialContributions), Object.values(world.constructionWorkContributions)));
  const terrain = sampleWildsTerrain(Math.round(request.pointer.x * 2) / 2, Math.round(request.pointer.z * 2) / 2);
  const region = wildsDiscoverySiteRegionForPosition(request.pointer);
  const spaceId=request.spaceId ?? "wildz.space.outer.v1";
  const physical=composeWildsBurrowPhysical(admitWildsDiscoveryPhysicalNeighborhood(region.x,region.z),world.burrows);
  const interior=spaceId!=="wildz.space.outer.v1";
  const floor=interior?physical.surfaces.find(f=>f.spaceId===spaceId&&Math.abs(f.center.x-request.pointer.x)<=f.halfExtents.x&&Math.abs(f.center.z-request.pointer.z)<=f.halfExtents.z&&Math.abs(f.center.y-request.pointer.y)<=.75):null;
  if(interior&&!floor)throw new Error("wilds_construction_underground_floor_required");
  const terrainY = floor?.center.y ?? (request.surfaceSnap ? wildsSiteRuntimeGroundY(prepareWildsSiteRuntime(physical), spaceId, request.pointer.x, request.pointer.z, terrain.elevation) : terrain.elevation);
  return {
    ...request,
    sourceBlueprint: {
      ...createWildsBlueprintPreview(projectId, wildsConstructionRegionId(project.region)),
      revision: nearby.length,
      // Reserved planned layouts are separate from stage-dependent physical blockers.
      pieces: nearby.map((component) => component.placement)
    },
    physical: {
      terrainY,
      waterline: !interior && terrain.waterDepth > 0 ? terrain.elevation + terrain.waterDepth : null,
      anchors: geometry.flatMap((entry) => [...entry.anchors]),
      solids: [...geometry.flatMap((entry) => [...entry.solids]), ...physical.solids.filter(c=>c.spaceId===spaceId && c.id.startsWith("burrow-wall:")).map(c=>({id:c.id,center:c.center,halfExtents:c.halfExtents})), ...physical.ceilings.filter(c=>c.spaceId===spaceId).map(c=>({id:c.id,center:c.center,halfExtents:c.halfExtents}))]
    }
  };
}

/** Reuse production collision/support admission, excluding only the piece being adjusted. */
export function previewWildsConstructionAdjustment(world: WildsWorldProjection, componentId: string, request: WildsConstructionPlacementRequest) {
  const component = world.constructionComponents[componentId];
  if (!component || !verifyWildsConstructionComponent(component)) throw new Error("wilds_construction_component_invalid");
  if((component.evidence.spaceId??"wildz.space.outer.v1")!==(request.spaceId??"wildz.space.outer.v1"))throw new Error("wilds_construction_space_changed");
  const others = {...world.constructionComponents};
  delete others[componentId];
  const evidence = projectWildsProductionPlacementEvidence({...world, constructionComponents: others}, component.projectId, request);
  const placement = previewWildsBlueprintPlacement({...evidence, blueprint: evidence.sourceBlueprint, kind: component.kind});
  // Never detach a piece which another admitted piece relies on. Move its dependents first.
  const anchors = new Set(component.anchors.map(anchor => anchor.id));
  const supportsOthers = Object.values(others).some(other => {
    const old = other.evidence;
    if (!old.physical.anchors.some(anchor => anchors.has(anchor.id))) return false;
    const without = {...old, sourceBlueprint: {...old.sourceBlueprint, pieces: old.sourceBlueprint.pieces.filter(piece => piece.placementId !== component.placement.placementId)},
      physical: {...old.physical, anchors: old.physical.anchors.filter(anchor => !anchors.has(anchor.id))}};
    const candidate = previewWildsBlueprintPlacement({...without, blueprint: without.sourceBlueprint, kind: other.kind});
    return !candidate.valid || JSON.stringify(candidate.transform) !== JSON.stringify(other.transform);
  });
  const sameRegion = wildsConstructionRegionId(wildsDiscoverySiteRegionForPosition(placement.transform.position)) === component.regionId;
  const blocker = supportsOthers ? "Move the pieces supported by this one first." : !sameRegion ? "Keep this piece in its current building region." : null;
  return {placement, evidence, blocker};
}
