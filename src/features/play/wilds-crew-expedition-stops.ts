import type { WildsCrewExpeditionCandidate } from "./wilds-crew-expedition";
import { createWildsCrewPathStepState, planWildsCrewPathNearTarget, wildsCrewRouteNeedsReplan, writeWildsCrewFollowingStep, type WildsCrewNavigationAuthority, type WildsCrewNavigationPoint } from "./wilds-crew-navigation";
import { createWildsCrewPhysicalSampler } from "./wilds-crew-physical-navigation";
import { projectWildsAerialObstacleNeighborhood } from "./wilds-grounded-movement";
import { WILDS_RENDERED_PHYSICAL_OBSTACLES, type WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import { wildsTerrainElevation } from "./wilds-terrain-authority";
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";

/** Exercise the actual mover budget; a broad origin-only path is insufficient to
 * admit a later ranked leg. Preflight yields every eight fixed steps, never advances
 * runtime positions, and grants no arrival or world observation. */
export async function canTraverseWildsCrewExpeditionLeg(input:WildsCrewNavigationAuthority&{
  start:Readonly<WildsCrewNavigationPoint>;target:Readonly<WildsCrewNavigationPoint>;cancelled?:()=>boolean;
}):Promise<boolean> {
  if(Math.hypot(input.target.x-input.start.x,input.target.y-input.start.y,input.target.z-input.start.z)>24)return false;
  const position={...input.start},step=createWildsCrewPathStepState(),direct=createWildsCrewPathStepState();
  const directWaypoints=[input.target];let path:readonly Readonly<WildsCrewNavigationPoint>[]=[],plans=0;
  const movement={mode:input.mode,permittedModes:input.permittedModes,sampleSegment:input.sampleSegment,speed:5.5,deltaSeconds:.1};
  for(let iteration=0;iteration<96;iteration++){
    if(iteration%8===0){await new Promise<void>(resolve=>setTimeout(resolve,0));if(input.cancelled?.())return false;}
    writeWildsCrewFollowingStep(position,input.target,path,step,direct,directWaypoints,movement);
    if(Math.hypot(position.x-input.target.x,position.y-input.target.y,position.z-input.target.z)<=.35)return true;
    if(wildsCrewRouteNeedsReplan(path,step,direct)){
      if(plans++>=2)return false;
      const planned=planWildsCrewPathNearTarget({...input,start:position,cellSize:.6,maxNodes:192,maxDistance:24});
      if(planned.reason!=="path")return false;
      path=planned.waypoints;step.waypointIndex=0;step.reason="moving";
    }
    if(direct.reason==="invalid-input"||direct.reason==="mode-not-permitted")return false;
  }
  return false;
}

/** At most three mutually traversable real destinations. Genome ranking may reorder
 * these candidates: every direction between stops and home must fit the same mover.
 * Movement still rechecks current geometry; preflight is never arrival authority. */
export async function prepareWildsCrewExpeditionStops(input: {
  origin: {x:number;y:number;z:number}; spaceId:string; runtime:WildsSiteRuntimeProjection;
  obstacles:readonly WildsTerrainObstacle[]; seed:number; cancelled?:()=>boolean;
}) {
  const all = [...WILDS_RENDERED_PHYSICAL_OBSTACLES, ...projectWildsAerialObstacleNeighborhood(input.origin).obstacles, ...input.obstacles];
  const sampleSegment = createWildsCrewPhysicalSampler({ runtime:input.runtime, spaceId:input.spaceId, obstacles:all,
    originX:Math.floor(input.origin.x / 16) * 16, originZ:Math.floor(input.origin.z / 16) * 16 });
  const candidates:WildsCrewExpeditionCandidate[] = [];
  for (let index=0;index<12;index++) {
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    if(input.cancelled?.()) return [];
    const angle=(index + input.seed % 8) * Math.PI/4;
    const radius=12+(index%3)*6;
    const x=input.origin.x+Math.cos(angle)*radius,z=input.origin.z+Math.sin(angle)*radius;
    const position={x,y:wildsSiteRuntimeGroundY(input.runtime,input.spaceId,x,z,
      input.spaceId==="wildz.space.outer.v1"?wildsTerrainElevation(x,z):input.origin.y),z};
    if(candidates.some(candidate=>Math.hypot(candidate.position.x-x,candidate.position.z-z)<4))continue;
    let compatible=true;
    for(const previous of [input.origin,...candidates.map(candidate=>candidate.position)]){
      if(!await canTraverseWildsCrewExpeditionLeg({mode:"walk",permittedModes:["walk"],sampleSegment,start:previous,target:position,cancelled:input.cancelled})
        ||!await canTraverseWildsCrewExpeditionLeg({mode:"walk",permittedModes:["walk"],sampleSegment,start:position,target:previous,cancelled:input.cancelled})) {compatible=false;break;}
    }
    if(!compatible)continue;
    candidates.push({pointId:`trail:${input.spaceId}:${x.toFixed(3)}:${z.toFixed(3)}`,spaceId:input.spaceId,position,risk:0,reachable:true});
    if(candidates.length===3)break;
  }
  return input.cancelled?.()?[]:candidates;
}
