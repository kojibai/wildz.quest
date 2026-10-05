import { constructionProofDigest } from '../wilds-construction-project';
import { assertCreationData, parseCreationDefinition } from './definition';
import { CREATION_BEHAVIORS, CREATION_MATERIALS, CREATION_PAGE_SIZE } from './registry';
import { deriveCreationGeometry, overlapsCreationSolids, type CreationSolid, type CreationSurface, type CreationConnection, type CreationBounds } from './geometry';
import type { CreationDefinition, CreationPose, CreationResourceBudget, CreationPoint } from './types';
export type CreationPhysicalChunk = Readonly<{ chunkId:string; head:string; terrain:readonly CreationPoint[]; solids:readonly CreationSolid[]; walkable:readonly CreationSurface[]; portals:readonly CreationConnection[] }>;
export type CreationCompileContext = Readonly<{ worldId:string; spaceId:string; pose:CreationPose; sourceHead:string; budget:CreationResourceBudget; techniques:readonly string[]; physical:readonly CreationPhysicalChunk[]; quality:'low'|'medium'|'high' }>;
export type CreationChunk = Readonly<{ id:string; region:{x:number;z:number}; bounds:CreationBounds; nodeIds:readonly string[]; solids:readonly CreationSolid[]; walkable:readonly CreationSurface[]; interiors:readonly CreationBounds[]; connections:readonly CreationConnection[]; positions:Float32Array; normals:Float32Array; materials:readonly {start:number;count:number;material:string}[] }>;
export type CreationPlan = Readonly<{ schema:'wildz.creation-plan.v1'; definitionDigest:string; contextDigest:string; sourceHead:string; worldId:string; spaceId:string; pose:CreationPose; requiredResources:CreationResourceBudget; requiredWork:number; nodeWork:readonly Readonly<{nodeId:string;techniques:readonly string[];work:number}>[]; requiredTechniques:readonly string[]; stages:readonly (readonly string[])[]; chunks:readonly CreationChunk[]; digest:string }>;
export type CreationBlocker = Readonly<{code:string;nodeId:string|null;message:string}>;
export type CreationCompileResult = {status:'ready';plan:CreationPlan}|{status:'blocked';blockers:readonly CreationBlocker[]};
export function compileCreation(input:CreationDefinition, context:CreationCompileContext):CreationCompileResult {
 const blockers:CreationBlocker[]=[];
 const block=(code:string,message:string,nodeId:string|null=null)=>blockers.push({code,message,nodeId});
 try {
  const definition=parseCreationDefinition(input); assertCreationData(context);
  if (!context.worldId||!context.spaceId||!/^sha256:[a-f0-9]{64}$/.test(context.sourceHead)||!context.pose||![context.pose.position.x,context.pose.position.y,context.pose.position.z,context.pose.yaw].every(Number.isFinite)||!Array.isArray(context.techniques)||!Array.isArray(context.physical)||context.physical.some(c=>!/^sha256:[a-f0-9]{64}$/.test(c.head))||Object.values(context.budget).some(n=>!Number.isSafeInteger(n)||n<0)) throw new Error('creation_context_invalid');
  const costs:Record<string,number>={},techniques=new Set<string>(),chunks:CreationChunk[]=[],groups=new Map<string,typeof definition.nodes[number][]>(); let work=0;const rawWork=new Map<string,number>();
  const poses=new Map<string,CreationPose>(),byId=new Map(definition.nodes.map(n=>[n.id,n]));
  const poseFor=(id:string):CreationPose=>{const old=poses.get(id);if(old)return old;const n=byId.get(id)!;const p=n.parentId?poseFor(n.parentId):context.pose,c=Math.cos(p.yaw),s=Math.sin(p.yaw),v=n.pose.position;const result={position:{x:p.position.x+v.x*c+v.z*s,y:p.position.y+v.y,z:p.position.z-v.x*s+v.z*c},yaw:p.yaw+n.pose.yaw};poses.set(id,result);return result;};
  for (const n of definition.nodes) {
   const material=CREATION_MATERIALS[n.material];if(!material){block('material',`Material ${n.material} is not registered.`,n.id);continue;}techniques.add(material.technique);
   for (const b of n.behaviors) {const law=CREATION_BEHAVIORS[b.id];if(!law||law.version!==b.version)block('behavior',`The ${b.id} behavior has no qualified law.`,n.id);else techniques.add(law.technique);}
   const p=poseFor(n.id),key=`${Math.floor(p.position.x/32)}:${Math.floor(p.position.z/32)}`,group=groups.get(key)||[];group.push(n);groups.set(key,group);
  }
  for (const [regionKey,nodes] of groups) for(let page=0;page*CREATION_PAGE_SIZE<nodes.length;page++) {
   const solids:CreationSolid[]=[],walkable:CreationSurface[]=[],interiors:CreationBounds[]=[],connections:CreationConnection[]=[],positions:number[]=[],normals:number[]=[],materials:{start:number;count:number;material:string}[]=[];
   const pageNodes=nodes.slice(page*CREATION_PAGE_SIZE,(page+1)*CREATION_PAGE_SIZE);
   for (const n of pageNodes) {
    try {const g=deriveCreationGeometry(n,poseFor(n.id));const mat=CREATION_MATERIALS[n.material];const amount=g.volume*mat.density;costs[n.material]=(costs[n.material]||0)+amount;work+=amount*mat.work;rawWork.set(n.id,amount*mat.work);
     for (const solid of g.solids) if(context.physical.some(c=>c.solids.some((other:CreationSolid)=>overlapsCreationSolids(solid,other))))block('overlap','This placement intersects an existing physical object.',n.id);
     solids.push(...g.solids);walkable.push(...g.walkable);interiors.push(...g.interiors);connections.push(...g.connections);materials.push({start:positions.length/3,count:g.positions.length/3,material:n.material});positions.push(...g.positions);normals.push(...g.normals);
    }catch(error){block('geometry',error instanceof Error?error.message:'Unsupported geometry',n.id);}
   }
   const [x,z]=regionKey.split(':').map(Number);const bounds={min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}};
   for(let i=0;i<positions.length;i+=3)for(const [axis,offset] of [['x',0],['y',1],['z',2]] as const){bounds.min[axis]=Math.min(bounds.min[axis],positions[i+offset]);bounds.max[axis]=Math.max(bounds.max[axis],positions[i+offset]);}
   chunks.push({id:`${definition.digest}:${regionKey}:${page}`,region:{x,z},bounds,nodeIds:pageNodes.map(n=>n.id),solids,walkable,interiors,connections,positions:new Float32Array(positions),normals:new Float32Array(normals),materials});
  }
  for(const key of Object.keys(costs)){costs[key]=Math.ceil(costs[key]);if(costs[key]>(context.budget[key]||0))block('resources',`Needs ${costs[key]} ${key}; budget is ${context.budget[key]||0}.`);}
  for(const technique of techniques)if(!context.techniques.includes(technique))block('technique',`Select a ready creature with ${technique}.`);
  if(blockers.length)return {status:'blocked',blockers};
  const done=new Set<string>(),stages:string[][]=[];while(done.size<definition.nodes.length){const stage=definition.nodes.filter(n=>!done.has(n.id)&&[...(n.parentId?[n.parentId]:[]),...n.supports,...n.attachments].every(ref=>done.has(ref))).map(n=>n.id);if(!stage.length)throw new Error('creation_support_cycle');stages.push(stage);stage.forEach(id=>done.add(id));}
  const requiredWork=Math.ceil(work);
  if(!Number.isSafeInteger(requiredWork))throw Error('creation_work_invalid');
  const nodeWork=definition.nodes.map(n=>({nodeId:n.id,techniques:[...new Set([CREATION_MATERIALS[n.material].technique,...n.behaviors.map(b=>CREATION_BEHAVIORS[b.id].technique)])].sort(),work:Math.floor(rawWork.get(n.id)!),fraction:rawWork.get(n.id)!%1})).sort((a,b)=>b.fraction-a.fraction||a.nodeId.localeCompare(b.nodeId));
  const remainder=requiredWork-nodeWork.reduce((total,n)=>total+n.work,0);
  if(remainder<0||remainder>nodeWork.length)throw Error('creation_work_rounding_invalid');
  for(let i=0;i<remainder;i++)nodeWork[i].work++;
  const workByNode=nodeWork.sort((a,b)=>a.nodeId.localeCompare(b.nodeId)).map(({nodeId,techniques,work})=>({nodeId,techniques,work}));
  const basis={schema:'wildz.creation-plan.v1'  as const,definitionDigest:definition.digest,contextDigest:constructionProofDigest(context),sourceHead:context.sourceHead,worldId:context.worldId,spaceId:context.spaceId,pose:context.pose,requiredResources:costs,requiredWork,nodeWork:workByNode,requiredTechniques:[...techniques].sort(),stages};
  return {status:'ready',plan:{...basis,chunks,digest:constructionProofDigest({...basis,chunks:chunks.map(c=>({id:c.id,bounds:c.bounds,nodeIds:c.nodeIds,solids:c.solids,walkable:c.walkable,interiors:c.interiors,connections:c.connections,positions:Array.from(c.positions),normals:Array.from(c.normals),materials:c.materials,region:c.region}))})}};
 }catch(error){return {status:'blocked',blockers:[{code:'invalid',nodeId:null,message:error instanceof Error?error.message:'Invalid creation'}]};}
}
