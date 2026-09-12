import { planWildsCrewPath } from "./wilds-crew-navigation";
import { createWildsCrewPhysicalSampler } from "./wilds-crew-physical-navigation";
import { projectWildsAerialObstacleNeighborhood } from "./wilds-grounded-movement";
import { WILDS_RENDERED_PHYSICAL_OBSTACLES, type WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import { wildsTerrainElevation } from "./wilds-terrain-authority";
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";

/** Prepare a bounded set of real terrain destinations outside the frame loop. Paths
 * are proposals; the mover still rechecks every physical step as the world changes. */
export async function prepareWildsCrewExpeditionStops(input: {
  origin: {x:number;y:number;z:number}; spaceId:string; runtime:WildsSiteRuntimeProjection;
  obstacles:readonly WildsTerrainObstacle[]; seed:number; cancelled?:()=>boolean;
}) {
  const all = [...WILDS_RENDERED_PHYSICAL_OBSTACLES, ...projectWildsAerialObstacleNeighborhood(input.origin).obstacles, ...input.obstacles];
  const sampleSegment = createWildsCrewPhysicalSampler({ runtime:input.runtime, spaceId:input.spaceId, obstacles:all,
    originX:Math.floor(input.origin.x / 16) * 16, originZ:Math.floor(input.origin.z / 16) * 16 });
  const candidates = [];
  for (let index=0;index<12;index++) {
    // Yield between bounded searches so pressing Roam never owns a long frame.
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    if(input.cancelled?.()) return [];
    const angle=(index + input.seed % 8) * Math.PI/4;
    const radius=12+(index%3)*6;
    const x=input.origin.x+Math.cos(angle)*radius,z=input.origin.z+Math.sin(angle)*radius;
    const position={x,y:wildsSiteRuntimeGroundY(input.runtime,input.spaceId,x,z,
      input.spaceId==="wildz.space.outer.v1"?wildsTerrainElevation(x,z):input.origin.y),z};
    const path=planWildsCrewPath({mode:"walk",permittedModes:["walk"],sampleSegment,start:input.origin,target:position,
      cellSize:1,maxNodes:96,maxDistance:32});
    if(path.reason!=="path") continue;
    candidates.push({pointId:`trail:${input.spaceId}:${x.toFixed(3)}:${z.toFixed(3)}`,spaceId:input.spaceId,position,risk:0,reachable:true});
    if(candidates.length===6)break;
  }
  return candidates;
}
