import { projectWildsStructureSupports } from "./wilds-structure-support";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import { projectWildsConstructionStageGeometry } from "./wilds-construction-geometry";

export function projectWildsConstructionObstacles(world?: WildsWorldProjection | null): WildsTerrainObstacle[] {
  if (!world) return [];
  return Object.values(world.constructionComponents ?? {}).filter(c=>(c.evidence.spaceId??"wildz.space.outer.v1")==="wildz.space.outer.v1").flatMap(component => {
    const geometry = projectWildsConstructionStageGeometry(component, Object.values(world.constructionMaterialContributions), Object.values(world.constructionWorkContributions));
    return geometry.solids.map(solid => ({ id: `wildz.component:${solid.id}`, kind: "structure" as const,
      material: "solid" as const, position: solid.center, radius: Math.hypot(solid.halfExtents.x, solid.halfExtents.z),
      shape: { kind: "box" as const, halfX: solid.halfExtents.x, halfY: solid.halfExtents.y, halfZ: solid.halfExtents.z }, visualScale: 1,
      airbornePolicy: "clearable" as const }));
  });
}

/** Interior construction participates in the same site physics as the excavated floors. */
export function composeWildsInteriorConstruction(
  physical: import("./wilds-discovery-sites").WildsDiscoveryPhysicalNeighborhood,
  world?: Pick<WildsWorldProjection, "structures" | "constructionComponents" | "constructionMaterialContributions" | "constructionWorkContributions"> | null
): import("./wilds-discovery-sites").WildsDiscoveryPhysicalNeighborhood {
  if(!world)return physical;
  const solids=Object.values(world.constructionComponents).filter(c=>c.evidence.spaceId && c.evidence.spaceId!=="wildz.space.outer.v1").flatMap(c=>{
    const site=physical.surfaces.find(s=>s.spaceId===c.evidence.spaceId);
    if(!site)return [];
    return projectWildsConstructionStageGeometry(c,Object.values(world.constructionMaterialContributions),Object.values(world.constructionWorkContributions)).solids.map(s=>({...s,siteKey:site.siteKey,spaceId:c.evidence.spaceId!}));
  });
  if(!solids.length)return physical;
  const spaces=[...new Set(solids.map(s=>s.spaceId))];
  const surfaces=spaces.flatMap(spaceId=>projectWildsStructureSupports(world,spaceId).map(s=>({
    id:s.id,siteKey:physical.surfaces.find(f=>f.spaceId===spaceId)!.siteKey,spaceId,kind:"interior-floor" as const,
    center:{...s.center,y:s.deckY},halfExtents:{x:s.halfWidth,y:.05,z:s.halfLength},flooded:false
  })));
  const supportIds=new Set(surfaces.map(s=>s.id.replace("wildz.support.component:","")));
  const ceilings=solids.filter(s=>supportIds.has(s.id)).map(s=>({...s,id:`${s.id}:underside`}));
  return Object.freeze({...physical,solids:Object.freeze([...physical.solids,...solids]),surfaces:Object.freeze([...physical.surfaces,...surfaces]),ceilings:Object.freeze([...physical.ceilings,...ceilings])});
}
