import {deriveCreationGeometry,type CreationSolid} from './geometry';
import type {CreationDefinition,CreationPoint,CreationPose} from './types';
import {creationNodePoses} from './projection';
import type {CreationInstance} from './instance';
import {heldCreationGearAssembly} from './equipment-profiles';

export function validCreationPoint(point:CreationPoint|undefined):point is CreationPoint{return !!point&&Object.keys(point).sort().join(',')==='x,y,z'&&Object.values(point).every(Number.isFinite);}
export type CreationAim=Readonly<{direction:CreationPoint}>;
export const creationEquipmentAimOrigin=(position:CreationPoint):CreationPoint=>({x:position.x,y:position.y+1.25,z:position.z});
export function validCreationAim(aim:CreationAim|undefined):aim is CreationAim {
 return !!aim&&Object.keys(aim).join(',')==='direction'&&Object.keys(aim.direction??{}).sort().join(',')==='x,y,z'&&Object.values(aim.direction).every(Number.isFinite)&&Math.abs(Math.hypot(aim.direction.x,aim.direction.y,aim.direction.z)-1)<.00001;
}
/** Slab intersection tests the complete segment, so fast shots cannot tunnel. */
export function creationRayBoxDistance(origin:CreationPoint,direction:CreationPoint,bounds:{min:CreationPoint;max:CreationPoint},range:number):number|null {
 let near=0,far=range;
 for(const axis of ['x','y','z'] as const){
  if(Math.abs(direction[axis])<1e-9){if(origin[axis]<bounds.min[axis]||origin[axis]>bounds.max[axis])return null;continue;}
  const a=(bounds.min[axis]-origin[axis])/direction[axis],b=(bounds.max[axis]-origin[axis])/direction[axis];
  near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return null;
 }
 return near<=range&&far>=0?near:null;
}
export function creationRaySolidDistance(origin:CreationPoint,direction:CreationPoint,solid:CreationSolid,range:number){
 const c=Math.cos(solid.yaw),s=Math.sin(solid.yaw),x=origin.x-solid.center.x,z=origin.z-solid.center.z;
 const local={x:x*c-z*s,y:origin.y-solid.center.y,z:x*s+z*c},ray={x:direction.x*c-direction.z*s,y:direction.y,z:direction.x*s+direction.z*c},h=solid.halfExtents;
 return creationRayBoxDistance(local,ray,{min:{x:-h.x,y:-h.y,z:-h.z},max:h},range);
}
export function creationAimNodeDistance(definition:CreationDefinition,pose:CreationPose,nodeId:string,origin:CreationPoint,aim:CreationAim,range:number):number|null {
 if(!validCreationAim(aim))return null;
 const node=definition.nodes.find(n=>n.id===nodeId),worldPose=creationNodePoses(definition,pose).get(nodeId);
 if(!node||!worldPose)return null;
 const derived=deriveCreationGeometry(node,worldPose);
 let nearest=Infinity;
 for(const solid of derived.solids){const distance=creationRaySolidDistance(origin,aim.direction,solid,range);if(distance!==null)nearest=Math.min(nearest,distance);}
 return Number.isFinite(nearest)?nearest:null;
}

/** UI targeting only. Convert the camera sight into the existing fixed muzzle
 * ray at action time; admission still checks range, access and every blocker. */
export function creationAimFromView(sources:readonly Readonly<{definition:CreationDefinition;instance:CreationInstance}>[],position:CreationPoint,spaceId:string,viewOrigin:CreationPoint,view:CreationAim,range:number):CreationAim{
 const muzzle=creationEquipmentAimOrigin(position);
 if(!validCreationPoint(viewOrigin)||!validCreationAim(view))return {direction:{x:0,y:0,z:-1}};
 const viewRange=range+Math.hypot(viewOrigin.x-muzzle.x,viewOrigin.y-muzzle.y,viewOrigin.z-muzzle.z);
 let distance=viewRange;
 for(const {definition,instance}of sources){
  if(instance.spaceId!==spaceId||instance.stage==='destroyed'||heldCreationGearAssembly(instance))continue;
  for(const node of Object.values(instance.nodeStates)){
   if(node.condition<=0||node.kind==='equipment'&&node.equippedBy)continue;
   const hit=creationAimNodeDistance(definition,instance.pose,node.nodeId,viewOrigin,view,viewRange);
   if(hit!==null&&hit<distance)distance=hit;
  }
 }
 const x=viewOrigin.x+view.direction.x*distance-muzzle.x,y=viewOrigin.y+view.direction.y*distance-muzzle.y,z=viewOrigin.z+view.direction.z*distance-muzzle.z,length=Math.hypot(x,y,z);
 return length>.00001?{direction:{x:x/length,y:y/length,z:z/length}}:view;
}
