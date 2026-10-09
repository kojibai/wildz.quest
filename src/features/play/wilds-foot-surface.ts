import { sampleWildsTerrain } from './wilds-terrain-authority';
import type { CreationPhysicalSnapshot } from './creation/physical-store';
import type { CreationNavigation } from './creation/navigation';
import type { CreationSurface } from './creation/geometry';
import type { WildsAudioPoint, WildsFootSurface } from './wilds-embodied-audio';
const materials=new WeakMap<CreationSurface,WildsFootSurface>();
/** Read the existing spatial floor index only when an audible step is due. */
export function wildsFootSurfaceAt(point:WildsAudioPoint,spaceId:string,input:{flooded:boolean;canopy:boolean;navigation:CreationNavigation|null;creations:Pick<CreationPhysicalSnapshot,'instances'|'definitions'>}):WildsFootSurface {
  let selected:{instanceId:string;value:CreationSurface}|null=null;
  const candidates=input.navigation?.spaces.get(spaceId)?.surfaces.get(`${Math.floor(point.x/16)}:${Math.floor(point.z/16)}`)??[];
  for(let i=0;i<Math.min(candidates.length,64);i++) {
    const entry=candidates[i],s=entry.value;
    if(Math.abs(s.center.y-point.y)>.26||selected&&selected.value.center.y>s.center.y)continue;
    const dx=point.x-s.center.x,dz=point.z-s.center.z,c=Math.cos(s.yaw),sn=Math.sin(s.yaw);
    if(Math.abs(dx*c-dz*sn)<=s.halfExtents.x&&Math.abs(dx*sn+dz*c)<=s.halfExtents.z)selected=entry;
  }
  if(selected){
    const cached=materials.get(selected.value);if(cached)return cached;
    const instance=input.creations.instances[selected.instanceId], definition=instance?input.creations.definitions[instance.definitionDigest]:undefined;
    const material=definition?.nodes.find(node=>selected!.value.id.startsWith(`${node.id}:`))?.material;
    const surface=material==='timber'?'wood':material==='hay'?'grass':'rock';materials.set(selected.value,surface);return surface;
  }
  if(input.flooded)return 'shallow-water';
  if(input.canopy)return 'wood';
  if(spaceId!=='wildz.space.outer.v1')return 'rock';
  const terrain=sampleWildsTerrain(point.x,point.z);
  return terrain.surface==='rock'&&terrain.traversal.some(requirement=>requirement.kind==='climb')?'mountain-rock':terrain.surface;
}
