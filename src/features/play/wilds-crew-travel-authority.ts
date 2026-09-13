import { createWildsCrewPhysicalSampler } from "./wilds-crew-physical-navigation";
import type { WildsCrewNavigationAuthority, WildsCrewNavigationPoint } from "./wilds-crew-navigation";
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import { WILDS_RENDERED_PHYSICAL_OBSTACLES, type WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import type { WildsWorldProjection } from "./wilds-world-state";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition } from "./wilds-discovery-sites";
import { composeWildsBurrowPhysical } from "./wilds-burrow";
import { composeWildsInteriorConstruction } from "./wilds-construction-physics";
import { projectWildsAerialObstacleNeighborhood } from "./wilds-grounded-movement";
import { wildsTerrainElevation } from "./wilds-terrain-authority";

/** Travel owns canonical coverage around its actual position, independently of camera
 * or player distance. Recreate on world changes; bounded cell caching is timer-only. */
export function createWildsCrewTravelAuthority(input:{runtime:WildsSiteRuntimeProjection;spaceId:string;obstacles:readonly WildsTerrainObstacle[];world?:WildsWorldProjection|null}) {
  const cache=new Map<string,WildsCrewNavigationAuthority>();
  return (position:WildsCrewNavigationPoint,canClimb=false):WildsCrewNavigationAuthority=>{
    const originX=Math.floor(position.x/16)*16,originZ=Math.floor(position.z/16)*16;
    const key=`${originX}:${originZ}:${canClimb}`;
    const cached=cache.get(key);if(cached)return cached;
    let runtime=input.runtime,obstacles=input.obstacles;
    if(input.spaceId==="wildz.space.outer.v1"){
      const region=wildsDiscoverySiteRegionForPosition(position);
      runtime=prepareWildsSiteRuntime(composeWildsInteriorConstruction(composeWildsBurrowPhysical(
        admitWildsDiscoveryPhysicalNeighborhood(region.x,region.z),input.world?.burrows),input.world));
      // Include current living/construction obstacles, plus procedural geometry around
      // this traveler. Deduplication avoids counting overlapping player tiles twice.
      obstacles=[...new Map([...WILDS_RENDERED_PHYSICAL_OBSTACLES,...input.obstacles,
        ...projectWildsAerialObstacleNeighborhood(position).obstacles].map(obstacle=>[obstacle.id,obstacle])).values()];
    }
    const authority:WildsCrewNavigationAuthority={mode:"walk",permittedModes:["walk"],sampleSegment:createWildsCrewPhysicalSampler({runtime,spaceId:input.spaceId,obstacles,originX,originZ,canClimb}),
      routeTarget:(start,target)=>{
        const distance=Math.hypot(target.x-start.x,target.z-start.z);
        if(distance<=8)return target;
        const x=start.x+(target.x-start.x)*8/distance,z=start.z+(target.z-start.z)*8/distance;
        return {x,z,y:wildsSiteRuntimeGroundY(runtime,input.spaceId,x,z,input.spaceId==="wildz.space.outer.v1"?wildsTerrainElevation(x,z):start.y)};
      }};
    if(cache.size>=12)cache.delete(cache.keys().next().value!);
    cache.set(key,authority);return authority;
  };
}
