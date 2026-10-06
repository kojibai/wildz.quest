import {constructionProofDigest} from '../wilds-construction-project';
import type {CreationCompileContext,CreationPhysicalChunk} from './compiler';
import type {CreationPhysicalProjection} from './projection';
import type {WildsTerrainObstacle} from '../wilds-terrain-obstacles';
import type {WildsDiscoveryPhysicalNeighborhood} from '../wilds-discovery-sites';

/** Map the current world projection once per source change, never on clock or input ticks. */
export function projectCreationCompilePhysical(input:Pick<CreationCompileContext,'worldId'|'spaceId'|'sourceHead'> & {
 projections:readonly CreationPhysicalProjection[];
 obstacles:readonly WildsTerrainObstacle[];
 sites?:WildsDiscoveryPhysicalNeighborhood;
}):readonly CreationPhysicalChunk[]{
 const physical:CreationPhysicalChunk[]=input.projections.filter(p=>p.worldId===input.worldId&&p.spaceId===input.spaceId).flatMap(p=>p.chunks.map(c=>({
  chunkId:c.id,instanceId:p.instanceId,head:p.head,terrain:[],solids:c.solids,walkable:c.walkable,portals:c.connections
 })));
 const solids=input.spaceId==='wildz.space.outer.v1'?input.obstacles.map(o=>({
  id:o.id,yaw:0,
  center:o.shape.kind==='box'?o.position:{...o.position,y:o.position.y+o.shape.height/2},
  halfExtents:o.shape.kind==='box'?{x:o.shape.halfX,y:o.shape.halfY,z:o.shape.halfZ}:{x:o.shape.radius,y:o.shape.height/2,z:o.shape.radius}
 })):[];
 for(const s of input.sites?.solids||[])if(s.spaceId===input.spaceId)solids.push({id:s.id,center:s.center,halfExtents:s.halfExtents,yaw:0});
 for(const s of input.sites?.ceilings||[])if(s.spaceId===input.spaceId)solids.push({id:s.id,center:s.center,halfExtents:s.halfExtents,yaw:0});
 if(solids.length)physical.push({chunkId:'living:'+input.spaceId,head:constructionProofDigest({sourceHead:input.sourceHead,solids}),terrain:[],solids,walkable:[],portals:[]});
 return physical;
}
/** Bind previews to the exact physical source heads without hashing mesh buffers. */
export function creationCompileEnvironmentHead(context:Pick<CreationCompileContext,'worldId'|'spaceId'|'sourceHead'|'physical'>):string{
 return constructionProofDigest({worldId:context.worldId,spaceId:context.spaceId,sourceHead:context.sourceHead,physical:context.physical.map(c=>({chunkId:c.chunkId,head:c.head,instanceId:c.instanceId||null})).sort((a,b)=>a.chunkId.localeCompare(b.chunkId)||a.head.localeCompare(b.head))});
}
