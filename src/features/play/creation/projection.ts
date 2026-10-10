import {mergeCreationMaterialBuffers} from './material-buffers';
import {parseCreationDefinition} from './definition';
import {verifyCreationInstance,type CreationInstance} from './instance';
import {deriveCreationGeometry,type CreationSolid,type CreationSurface,type CreationConnection,type CreationBounds} from './geometry';
import {verifyCreationPlan,type CreationPlan,type CreationChunk} from './compiler';
import type {CreationDefinition,CreationPose} from './types';
export type CreationPhysicalProjection=Readonly<{instanceId:string;head:string;definitionDigest:string;worldId:string;spaceId:string;solids:readonly CreationSolid[];walkable:readonly CreationSurface[];interiors:readonly CreationBounds[];connections:readonly CreationConnection[];chunks:readonly CreationChunk[];nodePoses:ReadonlyMap<string,CreationPose>}>;
export function creationNodePoses(definition:CreationDefinition,pose:CreationPose):ReadonlyMap<string,CreationPose>{
 const byId=new Map(definition.nodes.map(n=>[n.id,n])),poses=new Map<string,CreationPose>();
 function resolve(id:string):CreationPose{const previous=poses.get(id);if(previous)return previous;const node=byId.get(id);if(!node)throw Error('creation_node_missing');const parent=node.parentId?resolve(node.parentId):pose,c=Math.cos(parent.yaw),s=Math.sin(parent.yaw),v=node.pose.position;const next={position:{x:parent.position.x+v.x*c+v.z*s,y:parent.position.y+v.y,z:parent.position.z-v.x*s+v.z*c},yaw:parent.yaw+node.pose.yaw};poses.set(id,next);return next;}
 definition.nodes.forEach(n=>resolve(n.id));return poses;
}
/** Derived data only: call on a worker after authenticating source admission.
 * A digest seal and functional stage alone do not grant world authority. */
export function projectCreationPhysical(instance:CreationInstance,input:CreationDefinition,plan:CreationPlan):CreationPhysicalProjection{
 const definition=parseCreationDefinition(input);if(!verifyCreationPlan(plan))throw Error('creation_plan_seal_invalid');
 if(!verifyCreationInstance(instance)||!['functional','finished','destroyed'].includes(instance.stage))throw Error('creation_functional_source_required');
 if(instance.definitionDigest!==definition.digest||plan.definitionDigest!==definition.digest||plan.spaceId!==instance.spaceId||plan.worldId!==instance.worldId||JSON.stringify(plan.pose)!==JSON.stringify(instance.pose))throw Error('creation_projection_binding_mismatch');
 const poses=creationNodePoses(definition,instance.pose),live=new Set<string>(),nodes=new Map(definition.nodes.map(n=>[n.id,n]));
 for(const stage of plan.stages)for(const id of stage){const node=nodes.get(id),state=instance.nodeStates[id];if(!node||!state||state.nodeId!==id)throw Error('creation_projection_node_missing');if(state.condition>0&&!(state.kind==='equipment'&&state.equippedBy)&&node.supports.every(s=>live.has(s))&&(!node.parentId||live.has(node.parentId)))live.add(id);}
 const chunks=plan.chunks.map(chunk=>{
  const solids:CreationSolid[]=[],walkable:CreationSurface[]=[],interiors:CreationBounds[]=[],connections:CreationConnection[]=[],positions:number[]=[],normals:number[]=[],materials:CreationChunk['materials'][number][]=[];
  for(const id of chunk.nodeIds){if(!live.has(id))continue;const node=nodes.get(id)!;const geometry=deriveCreationGeometry(node,poses.get(id)!);solids.push(...geometry.solids);walkable.push(...geometry.walkable);interiors.push(...geometry.interiors);connections.push(...geometry.connections);materials.push({start:positions.length/3,count:geometry.positions.length/3,material:node.material});positions.push(...geometry.positions);normals.push(...geometry.normals);}
  return {...chunk,id:`${instance.instanceId}:${instance.head}:${chunk.id}`,nodeIds:chunk.nodeIds.filter(id=>live.has(id)),solids,walkable,interiors,connections,...mergeCreationMaterialBuffers(positions,normals,materials)};
 }).filter(c=>c.nodeIds.length);
 return {instanceId:instance.instanceId,head:instance.head,definitionDigest:definition.digest,worldId:instance.worldId,spaceId:instance.spaceId,chunks,nodePoses:poses,solids:chunks.flatMap(c=>c.solids),walkable:chunks.flatMap(c=>c.walkable),interiors:chunks.flatMap(c=>c.interiors),connections:chunks.flatMap(c=>c.connections)};
}
