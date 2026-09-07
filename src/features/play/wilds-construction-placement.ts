import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition } from "./wilds-discovery-sites";
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY } from "./wilds-site-runtime";
import { createWildsBlueprintPreview, type WildsProductionPlacementEvidence } from "./wilds-world-construction";
import { verifyWildsConstructionComponent } from "./wilds-construction-component";
import { verifyWildsConstructionProject, wildsConstructionRegionId } from "./wilds-construction-project";
import { type WildsWorldProjection } from "./wilds-world-state";
import { projectWildsConstructionStageGeometry } from "./wilds-construction-geometry";
import { sampleWildsTerrain } from "./wilds-terrain-authority";

export type WildsConstructionPlacementRequest = Pick<WildsProductionPlacementEvidence, "pointer" | "rotationQuarterTurns" | "heightStep" | "surfaceSnap">;

/** Both preview and admission use this exact source request and admitted neighborhood. */
export function projectWildsProductionPlacementEvidence(world: WildsWorldProjection, projectId: string, request: WildsConstructionPlacementRequest): WildsProductionPlacementEvidence {
  const project = world.constructionProjects[projectId];
  if (!project || !verifyWildsConstructionProject(project)) throw new Error("wilds_construction_project_invalid");
  if (!request || !request.pointer || ![request.pointer.x, request.pointer.y, request.pointer.z].every(Number.isFinite)) throw new Error("wilds_construction_request_invalid");
  // Catalog extents <= 6 and snapping distance <= 8. Include adjacent regions too.
  const nearby = Object.values(world.constructionComponents)
    .filter((component) => Math.abs(component.transform.position.x - request.pointer.x) <= 32 && Math.abs(component.transform.position.z - request.pointer.z) <= 32)
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
  if (nearby.some((component) => !verifyWildsConstructionComponent(component))) throw new Error("wilds_construction_source_invalid");
  const geometry = nearby.map((component) => projectWildsConstructionStageGeometry(component, Object.values(world.constructionMaterialContributions), Object.values(world.constructionWorkContributions)));
  const terrain = sampleWildsTerrain(Math.round(request.pointer.x * 2) / 2, Math.round(request.pointer.z * 2) / 2);
  const region = wildsDiscoverySiteRegionForPosition(request.pointer);
  const terrainY = request.surfaceSnap ? wildsSiteRuntimeGroundY(prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(region.x, region.z)), "wildz.space.outer.v1", request.pointer.x, request.pointer.z, terrain.elevation) : terrain.elevation;
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
      waterline: terrain.waterDepth > 0 ? terrain.elevation + terrain.waterDepth : null,
      anchors: geometry.flatMap((entry) => [...entry.anchors]),
      solids: geometry.flatMap((entry) => [...entry.solids])
    }
  };
}
