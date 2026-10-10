import type {WildsWorldProjection} from '../wilds-world-state';
import {constructionProofDigest} from '../wilds-construction-project';
import {admitWildsDiscoveryPhysicalNeighborhood,wildsDiscoverySiteRegionForPosition,wildsMountainFieldValue,type WildsMountainField} from '../wilds-discovery-sites';
import {composeWildsBurrowPhysical} from '../wilds-burrow';
import {composeWildsInteriorConstruction} from '../wilds-construction-physics';
import {composeWildsConstructionTerrain,projectWildsConstructionTerrain,sampleWildsConstructionTerrainAt} from '../wilds-construction-terrain';
import {WILDS_TERRAIN_TILE_SIZE,WILDS_TERRAIN_VERSION,wildsTerrainElevation} from '../wilds-terrain-authority';
import {WILDS_RENDERED_PHYSICAL_OBSTACLES,projectWildsRenderedLivingObstacles,wildsTerrainObstaclesForTile,type WildsTerrainObstacle} from '../wilds-terrain-obstacles';
import {compileWorldCreationSource} from './world-source';
import {currentCreationEquipment} from './equipment';
import {creationEquipmentProfile,heldCreationGearAssembly} from './equipment-profiles';
import {creationAimNodeDistance,creationEquipmentAimOrigin,creationRayBoxDistance,creationRaySolidDistance,validCreationAim} from './equipment-aim';
import {deriveCreationGeometry} from './geometry';
import {creationNodePoses} from './projection';
import type {CreationPoint} from './types';
import type {WildsCreationActionCommand} from './world-action';

const OUTER='wildz.space.outer.v1',EPSILON=.00001,TERRAIN_STEP=.125;
/** A new ranged rule only; historic melee and equipment rule heads stay intact. */
export const CREATION_RANGED_OCCLUSION_RULE_HEAD=constructionProofDigest({
 id:'creation.ranged.occlusion.v1',terrain:WILDS_TERRAIN_VERSION,terrainStep:TERRAIN_STEP,
 solids:'complete-segment-box-cylinder-and-mountain-triangles',
 landscape:'admitted-construction-graded-ground',ordering:'physical-intersection-before-target',
 replay:'full-admitted-prior-world',permission:'blocking-independent-of-target-access',epsilon:EPSILON
});
type Bounds=Readonly<{center:CreationPoint;halfExtents:CreationPoint}>;
function boxDistance(origin:CreationPoint,direction:CreationPoint,box:Bounds,range:number){
 const c=box.center,h=box.halfExtents;
 return creationRayBoxDistance(origin,direction,{min:{x:c.x-h.x,y:c.y-h.y,z:c.z-h.z},max:{x:c.x+h.x,y:c.y+h.y,z:c.z+h.z}},range);
}
function obstacleDistance(origin:CreationPoint,direction:CreationPoint,obstacle:WildsTerrainObstacle,range:number):number|null{
 const {position:p,shape}=obstacle;
 if(shape.kind==='box')return boxDistance(origin,direction,{center:p,halfExtents:{x:shape.halfX,y:shape.halfY,z:shape.halfZ}},range);
 // Intersect the cylinder's horizontal disk and vertical interval separately.
 // A box approximation would incorrectly block shots beside round trunks.
 let near=0,far=range;
 const x=origin.x-p.x,z=origin.z-p.z,a=direction.x**2+direction.z**2,c=x*x+z*z-shape.radius**2;
 if(a<1e-18){if(c>0)return null;}
 else{
  const b=2*(x*direction.x+z*direction.z),discriminant=b*b-4*a*c;if(discriminant<0)return null;
  const root=Math.sqrt(discriminant);near=Math.max(near,(-b-root)/(2*a));far=Math.min(far,(-b+root)/(2*a));
 }
 if(Math.abs(direction.y)<1e-9){if(origin.y<p.y||origin.y>p.y+shape.height)return null;}
 else{
  const bottom=(p.y-origin.y)/direction.y,top=(p.y+shape.height-origin.y)/direction.y;
  near=Math.max(near,Math.min(bottom,top));far=Math.min(far,Math.max(bottom,top));
 }
 return near<=far&&far>=0?near:null;
}
const subtract=(a:CreationPoint,b:CreationPoint):CreationPoint=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross=(a:CreationPoint,b:CreationPoint):CreationPoint=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const dot=(a:CreationPoint,b:CreationPoint)=>a.x*b.x+a.y*b.y+a.z*b.z;
function triangleDistance(origin:CreationPoint,direction:CreationPoint,a:CreationPoint,b:CreationPoint,c:CreationPoint,range:number){
 const edge1=subtract(b,a),edge2=subtract(c,a),p=cross(direction,edge2),determinant=dot(edge1,p);
 if(Math.abs(determinant)<1e-10)return null;
 const inverse=1/determinant,t=subtract(origin,a),u=dot(t,p)*inverse;if(u<-1e-9||u>1+1e-9)return null;
 const q=cross(t,edge1),v=dot(direction,q)*inverse;if(v<-1e-9||u+v>1+1e-9)return null;
 const distance=dot(edge2,q)*inverse;return distance>=0&&distance<=range?distance:null;
}
function mountainDistance(origin:CreationPoint,direction:CreationPoint,field:WildsMountainField,range:number){
 // Clip against the horizontal field, then visit only the grid cells crossed
 // by this ray. Mountain envelopes are broad-phase bounds, never blockers.
 let near=0,far=range;
 for(const axis of ['x','z']as const){
  const min=field.center[axis]-field.halfExtents[axis],max=field.center[axis]+field.halfExtents[axis];
  if(Math.abs(direction[axis])<1e-9){if(origin[axis]<min||origin[axis]>max)return null;}
  else{const a=(min-origin[axis])/direction[axis],b=(max-origin[axis])/direction[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}
 }
 if(near>far)return null;
 const entry={x:origin.x+direction.x*near,y:origin.y+direction.y*near,z:origin.z+direction.z*near};
 if(entry.y<wildsMountainFieldValue(field,entry.x,entry.z,'topY')-EPSILON)return near;
 const breaks=[near,far],minX=field.center.x-field.halfExtents.x,minZ=field.center.z-field.halfExtents.z;
 const stepX=field.halfExtents.x*2/(field.columns-1),stepZ=field.halfExtents.z*2/(field.rows-1);
 for(const [axis,count,min,step]of [['x',field.columns,minX,stepX],['z',field.rows,minZ,stepZ]]as const){
  if(Math.abs(direction[axis])<1e-9)continue;
  for(let index=1;index<count-1;index++){const distance=(min+index*step-origin[axis])/direction[axis];if(distance>near&&distance<far)breaks.push(distance);}
 }
 breaks.sort((a,b)=>a-b);let nearest=Infinity;
 const visited=new Set<number>();
 for(let index=1;index<breaks.length;index++){
  const middle=(breaks[index-1]+breaks[index])/2;
  const column=Math.max(0,Math.min(field.columns-2,Math.floor((origin.x+direction.x*middle-minX)/stepX))),row=Math.max(0,Math.min(field.rows-2,Math.floor((origin.z+direction.z*middle-minZ)/stepZ))),key=row*field.columns+column;
  if(visited.has(key))continue;visited.add(key);
  const point=(index:number)=>{const node=field.nodes[index];return {x:node.x,y:node.topY,z:node.z};};
  const nw=point(key),ne=point(key+1),sw=point(key+field.columns),se=point(key+field.columns+1);
  for(const triangle of [[nw,ne,sw],[se,sw,ne]]){const distance=triangleDistance(origin,direction,triangle[0],triangle[1],triangle[2],range);if(distance!==null)nearest=Math.min(nearest,distance);}
 }
 return Number.isFinite(nearest)?nearest:null;
}

/** Check only a new ranged damage request, against the entire admitted prior
 * world. Returns the actual target intersection, not its placement anchor.
 * No access permission can make physical geometry transparent. Misses remain
 * wear-only discharge actions; legacy melee retains its original semantics.
 *
 * The enclosing world reducer must call this again during global event replay.
 * An individual creation action record contains only participant predecessors;
 * compiling it proves its exact effect, not absence of unrelated world blockers.
 * It must never be used alone as evidence that a ranged world hit was admitted.
 * Raw/graded terrain uses the deterministic 1/8 metre clearance law bound above;
 * discrete solids and mountain grid triangles test the complete ray segment.
 */
export function assertCreationRangedHitUnoccluded(world:WildsWorldProjection,command:WildsCreationActionCommand):number|null{
 const request=command.actionRequest;
 if(request.action!=='damage'||!('equipmentId'in request)||!request.equipmentId)return null;
 const held=world.creations?.[request.equipmentId],equipment=held&&currentCreationEquipment(held.instance,request.actorId),profile=equipment&&creationEquipmentProfile(equipment.actionProfileId);
 if(!profile?.mode||!['bow','rifle'].includes(profile.mode))return null;
 const aim=request.equipment?.aim;
 if(!validCreationAim(aim)||!command.actorPosition||Object.keys(command.actorPosition).sort().join(',')!=='x,y,z'||!Object.values(command.actorPosition).every(Number.isFinite))throw Error('creation_action_aim_binding_invalid');
 const target=world.creations?.[request.instanceId];if(!target)throw Error('creation_action_current_source_unavailable');
 const origin=creationEquipmentAimOrigin(command.actorPosition),direction=aim.direction;
 const distance=creationAimNodeDistance(target.command.definition,target.instance.pose,request.nodeId,origin,aim,profile.range);
 if(distance===null)throw Error('creation_action_aim_binding_invalid');
 const limit=distance-EPSILON,assertClear=(hit:number|null)=>{if(hit!==null&&hit<limit)throw Error('creation_action_ray_occluded');};
 for(const source of Object.values(world.creations??{})){
  const instance=source.instance;if(instance.instanceId===request.equipmentId||instance.spaceId!==command.spaceId||instance.stage==='destroyed'||heldCreationGearAssembly(instance))continue;
  compileWorldCreationSource(source);
  const poses=creationNodePoses(source.command.definition,instance.pose);
  for(const node of source.command.definition.nodes){
   const state=instance.nodeStates[node.id],pose=poses.get(node.id);
   if(!state||state.condition<=0||state.kind==='equipment'&&state.equippedBy||!pose)continue;
   for(const solid of deriveCreationGeometry(node,pose).solids)assertClear(creationRaySolidDistance(origin,direction,solid,distance));
  }
 }
 const end={x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance};
 const first=wildsDiscoverySiteRegionForPosition({x:Math.min(origin.x,end.x),z:Math.min(origin.z,end.z)}),last=wildsDiscoverySiteRegionForPosition({x:Math.max(origin.x,end.x),z:Math.max(origin.z,end.z)}),seen=new Set<string>();
 const pads=command.spaceId===OUTER?projectWildsConstructionTerrain(world):[];
 for(let regionX=first.x;regionX<=last.x;regionX++)for(let regionZ=first.z;regionZ<=last.z;regionZ++){
  const physical=composeWildsInteriorConstruction(composeWildsBurrowPhysical(admitWildsDiscoveryPhysicalNeighborhood(regionX,regionZ),world.burrows),world);
  for(const box of [...physical.solids.filter(solid=>solid.kind!=='mountain-envelope'),...physical.ceilings,...physical.surfaces.filter(surface=>surface.kind==='interior-floor')]){
   if(box.spaceId!==command.spaceId||seen.has(box.id))continue;seen.add(box.id);assertClear(boxDistance(origin,direction,box,distance));
  }
  if(command.spaceId!==OUTER)continue;
  const fields=physical.mountainFields.filter(field=>!seen.has(field.id)&&Math.abs((origin.x+end.x)/2-field.center.x)<=Math.abs(end.x-origin.x)/2+field.halfExtents.x&&Math.abs((origin.z+end.z)/2-field.center.z)<=Math.abs(end.z-origin.z)/2+field.halfExtents.z);
  for(const field of composeWildsConstructionTerrain({...physical,mountainFields:fields},pads).mountainFields){seen.add(field.id);assertClear(mountainDistance(origin,direction,field,distance));}
 }
 if(command.spaceId===OUTER){
  for(const obstacle of [...WILDS_RENDERED_PHYSICAL_OBSTACLES,...projectWildsRenderedLivingObstacles(world)])assertClear(obstacleDistance(origin,direction,obstacle,distance));
  const minTileX=Math.floor(Math.min(origin.x,end.x)/WILDS_TERRAIN_TILE_SIZE)-1,maxTileX=Math.floor(Math.max(origin.x,end.x)/WILDS_TERRAIN_TILE_SIZE)+1,minTileZ=Math.floor(Math.min(origin.z,end.z)/WILDS_TERRAIN_TILE_SIZE)-1,maxTileZ=Math.floor(Math.max(origin.z,end.z)/WILDS_TERRAIN_TILE_SIZE)+1;
  for(let tileX=minTileX;tileX<=maxTileX;tileX++)for(let tileZ=minTileZ;tileZ<=maxTileZ;tileZ++)for(const obstacle of wildsTerrainObstaclesForTile(tileX,tileZ))assertClear(obstacleDistance(origin,direction,obstacle,distance));
  const steps=Math.max(1,Math.ceil(distance/TERRAIN_STEP));
  for(let index=0;index<=steps;index++){
   const along=distance*index/steps;if(along>=limit)break;
   const x=origin.x+direction.x*along,y=origin.y+direction.y*along,z=origin.z+direction.z*along;
   if(y<sampleWildsConstructionTerrainAt(pads,x,z,wildsTerrainElevation(x,z))-EPSILON)throw Error('creation_action_ray_occluded');
  }
 }
 return distance;
}
