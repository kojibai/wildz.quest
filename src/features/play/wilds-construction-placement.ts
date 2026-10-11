import { composeWildsBurrowPhysical } from "./wilds-burrow";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition } from "./wilds-discovery-sites";
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY } from "./wilds-site-runtime";
import { previewWildsBlueprintPlacement, createWildsBlueprintPreview, type WildsProductionPlacementEvidence } from "./wilds-world-construction";
import { verifyWildsConstructionComponent } from "./wilds-construction-component";
import { verifyWildsConstructionProject, wildsConstructionRegionId } from "./wilds-construction-project";
import { type WildsWorldProjection } from "./wilds-world-state";
import { nearbyWildsConstruction, constructionGeometryForCollections } from "./wilds-construction-neighborhood";
import { sampleWildsTerrain, sampleWildsTerrainAtGroundElevation, WILDS_TERRAIN_WATER_SURFACE_ELEVATION } from "./wilds-terrain-authority";
import { projectWildsConstructionTerrain, composeWildsConstructionTerrain, createWildsConstructionLandscapeCache } from './wilds-construction-terrain';
import { compileWorldCreationSource, projectWildsCreationPersistence } from './creation/world-source';
import { projectCreationPhysical } from './creation/projection';
import { createWildsOrderedSpatialIndex } from './wilds-ordered-spatial-index';
import { WILDS_RENDERED_PHYSICAL_OBSTACLES, projectWildsRenderedLivingObstacles } from './wilds-terrain-obstacles';

// Cover 8 m anchor snapping, up to 8 m architectural offset, 6 m catalog
// extent, the 1.1 m flat apron and coordinate quantization beyond the pointer.
const PLACEMENT_QUERY_RADIUS = 24;
type PlacementSolid = WildsProductionPlacementEvidence['physical']['solids'][number] & {spaceId:string};
const creationsProjectionCache = createWildsConstructionLandscapeCache<ReturnType<typeof createWildsOrderedSpatialIndex<PlacementSolid>>>();
function nearbyCreatedSolids(world:WildsWorldProjection,pointer:WildsConstructionPlacementRequest['pointer'],spaceId:string) {
  const query=creationsProjectionCache(world,()=>{
    const solids:PlacementSolid[]=Object.values(projectWildsCreationPersistence(world).creations).flatMap(source=>
      projectCreationPhysical(source.instance,source.command.definition,compileWorldCreationSource(source)).solids.map(solid=>{
        const c=Math.abs(Math.cos(solid.yaw)),s=Math.abs(Math.sin(solid.yaw));
        return {...solid,spaceId:source.instance.spaceId,halfExtents:{x:c*solid.halfExtents.x+s*solid.halfExtents.z,y:solid.halfExtents.y,z:s*solid.halfExtents.x+c*solid.halfExtents.z}};
      }));
    return createWildsOrderedSpatialIndex(solids,solid=>({minX:solid.center.x-solid.halfExtents.x,maxX:solid.center.x+solid.halfExtents.x,minZ:solid.center.z-solid.halfExtents.z,maxZ:solid.center.z+solid.halfExtents.z}));
  });
  return query({minX:pointer.x-PLACEMENT_QUERY_RADIUS,maxX:pointer.x+PLACEMENT_QUERY_RADIUS,minZ:pointer.z-PLACEMENT_QUERY_RADIUS,maxZ:pointer.z+PLACEMENT_QUERY_RADIUS}).filter(solid=>solid.spaceId===spaceId).map(({spaceId:_space,...solid})=>solid);
}

const placementPhysicalCache = createWildsConstructionLandscapeCache<Map<string, ReturnType<typeof composeWildsConstructionTerrain>>>();
function physicalForWorld(world: WildsWorldProjection, region: {x: number; z: number}) {
  const regions = placementPhysicalCache(world, () => new Map());
  const key = `${region.x}:${region.z}`;
  let physical = regions.get(key);
  if (!physical) {
    physical = composeWildsConstructionTerrain(composeWildsBurrowPhysical(admitWildsDiscoveryPhysicalNeighborhood(region.x,region.z),world.burrows), projectWildsConstructionTerrain(world));
    regions.set(key, physical);
    if (regions.size > 16) regions.delete(regions.keys().next().value!);
  }
  return physical;
}

export type WildsConstructionPlacementRequest = Pick<WildsProductionPlacementEvidence, "spaceId" | "pointer" | "rotationQuarterTurns" | "heightStep" | "surfaceSnap" | "snapVersion" | 'landscapeRule'>;

/** Both preview and admission use this exact source request and admitted neighborhood. */
export function projectWildsProductionPlacementEvidence(world: WildsWorldProjection, projectId: string, request: WildsConstructionPlacementRequest): WildsProductionPlacementEvidence {
  const project = world.constructionProjects[projectId];
  if (!project || !verifyWildsConstructionProject(project)) throw new Error("wilds_construction_project_invalid");
  if (!request || !request.pointer || ![request.pointer.x, request.pointer.y, request.pointer.z].every(Number.isFinite)) throw new Error("wilds_construction_request_invalid");
  if(request.landscapeRule!==undefined&&request.landscapeRule!=='wildz.build-ground.v2')throw Error('wilds_construction_landscape_rule_invalid');
  const reclaim=request.landscapeRule==='wildz.build-ground.v2';
  // Catalog extents <= 6 and snapping distance <= 8. Include adjacent regions too.
  const nearby = nearbyWildsConstruction(world.constructionComponents, request.pointer, 32)
    .filter((component) => (component.evidence.spaceId ?? "wildz.space.outer.v1") === (request.spaceId ?? "wildz.space.outer.v1") && Math.abs(component.transform.position.x - request.pointer.x) <= 32 && Math.abs(component.transform.position.z - request.pointer.z) <= 32)
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
  if (nearby.some((component) => !verifyWildsConstructionComponent(component))) throw new Error("wilds_construction_source_invalid");
  const projectGeometry = constructionGeometryForCollections(world.constructionMaterialContributions, world.constructionWorkContributions);
  const geometry = nearby.map(projectGeometry);
  const terrain = sampleWildsTerrain(Math.round(request.pointer.x * 2) / 2, Math.round(request.pointer.z * 2) / 2);
  const region = wildsDiscoverySiteRegionForPosition(request.pointer);
  const spaceId=request.spaceId ?? "wildz.space.outer.v1";
  const physical=physicalForWorld(world,region);
  const interior=spaceId!=="wildz.space.outer.v1";
  const floor=interior?physical.surfaces.find(f=>f.spaceId===spaceId&&Math.abs(f.center.x-request.pointer.x)<=f.halfExtents.x&&Math.abs(f.center.z-request.pointer.z)<=f.halfExtents.z&&Math.abs(f.center.y-request.pointer.y)<=.75):null;
  if(interior&&!floor)throw new Error("wilds_construction_underground_floor_required");
  const actualTerrainY = floor?.center.y ?? (request.surfaceSnap ? wildsSiteRuntimeGroundY(prepareWildsSiteRuntime(physical), spaceId, request.pointer.x, request.pointer.z, terrain.elevation) : terrain.elevation);
  const groundSupport = !interior && request.surfaceSnap && request.snapVersion === 2;
  const terrainY = groundSupport ? Math.max(actualTerrainY, WILDS_TERRAIN_WATER_SURFACE_ELEVATION + .2) : actualTerrainY;
  const supportedTerrain = sampleWildsTerrainAtGroundElevation(request.pointer.x, request.pointer.z, actualTerrainY);
  return {
    ...request,
    sourceBlueprint: {
      ...createWildsBlueprintPreview(projectId, wildsConstructionRegionId(project.region)),
      revision: nearby.length,
      // Reserved planned layouts are separate from stage-dependent physical blockers.
      pieces: nearby.map((component) => component.placement)
    },
    physical: {
      ...(groundSupport ? {groundSupport: reclaim?'wildz.build-ground.v2' as const:'wildz.build-ground.v1' as const} : {}),
      terrainY,
      waterline: !interior && supportedTerrain.waterDepth > 0 ? supportedTerrain.elevation + supportedTerrain.waterDepth : null,
      anchors: geometry.flatMap((entry) => [...entry.anchors]),
      solids: [...geometry.flatMap((entry) => [...entry.solids]), ...(reclaim?nearbyCreatedSolids(world,request.pointer,spaceId):[]),
        ...(reclaim&&!interior?[...WILDS_RENDERED_PHYSICAL_OBSTACLES,...projectWildsRenderedLivingObstacles(world)].filter(obstacle=>!obstacle.id.startsWith('wildz.component:')&&Math.abs(obstacle.position.x-request.pointer.x)<=obstacle.radius+PLACEMENT_QUERY_RADIUS&&Math.abs(obstacle.position.z-request.pointer.z)<=obstacle.radius+PLACEMENT_QUERY_RADIUS).map(obstacle=>({id:obstacle.id,
          center:obstacle.shape.kind==='box'?obstacle.position:{...obstacle.position,y:obstacle.position.y+obstacle.shape.height/2},
          halfExtents:obstacle.shape.kind==='box'?{x:obstacle.shape.halfX,y:obstacle.shape.halfY,z:obstacle.shape.halfZ}:{x:obstacle.radius,y:obstacle.shape.height/2,z:obstacle.radius}})):[]),
        ...physical.solids.filter(c=>c.spaceId===spaceId && c.kind!=='mountain-envelope'&&(reclaim||c.id.startsWith('burrow-wall:'))).map(c=>({id:c.id,center:c.center,halfExtents:c.halfExtents})), ...physical.ceilings.filter(c=>c.spaceId===spaceId).map(c=>({id:c.id,center:c.center,halfExtents:c.halfExtents}))]
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
