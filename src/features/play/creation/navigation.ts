import type {CreationPhysicalProjection} from './projection';
import type {CreationPoint} from './types';
import type {CreationSolid,CreationSurface} from './geometry';
const CELL=16,STEP=.26,HEIGHT=1.55;
type Entry<T>=Readonly<{instanceId:string;value:T}>;
type SpaceIndex=Readonly<{solids:Map<string,Entry<CreationSolid>[]>;surfaces:Map<string,Entry<CreationSurface>[]>}>;
export type CreationNavigation=Readonly<{instanceCount:number;spaces:ReadonlyMap<string,SpaceIndex>}>;
const key=(x:number,z:number)=>`${Math.floor(x/CELL)}:${Math.floor(z/CELL)}`;
function insert<T extends CreationSolid|CreationSurface>(map:Map<string,Entry<T>[]>,entry:Entry<T>){const v=entry.value,c=Math.abs(Math.cos(v.yaw)),s=Math.abs(Math.sin(v.yaw)),x=c*v.halfExtents.x+s*v.halfExtents.z+.5,z=s*v.halfExtents.x+c*v.halfExtents.z+.5;const minX=Math.floor((v.center.x-x)/CELL),maxX=Math.floor((v.center.x+x)/CELL),minZ=Math.floor((v.center.z-z)/CELL),maxZ=Math.floor((v.center.z+z)/CELL);if((maxX-minX+1)*(maxZ-minZ+1)>4096)throw Error('creation_navigation_residency_required');for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++){const k=`${ix}:${iz}`,bucket=map.get(k)||[];bucket.push(entry);map.set(k,bucket);}}
export function prepareCreationNavigation(projections:readonly CreationPhysicalProjection[]):CreationNavigation{const instances=new Map<string,string>(),spaces=new Map<string,SpaceIndex>();for(const p of projections){const previous=instances.get(p.instanceId);if(previous){if(previous!==p.head)throw Error('creation_projection_head_conflict');continue;}instances.set(p.instanceId,p.head);const index=spaces.get(p.spaceId)||{solids:new Map(),surfaces:new Map()};p.solids.forEach(value=>insert(index.solids,{instanceId:p.instanceId,value}));p.walkable.forEach(value=>insert(index.surfaces,{instanceId:p.instanceId,value}));spaces.set(p.spaceId,index);}return {instanceCount:instances.size,spaces};}
function local(v:CreationSolid|CreationSurface,p:CreationPoint){const x=p.x-v.center.x,z=p.z-v.center.z,c=Math.cos(v.yaw),s=Math.sin(v.yaw);return {x:x*c-z*s,z:x*s+z*c};}
function floor(index:SpaceIndex,p:CreationPoint,baseY:number,radius:number){let y=baseY;for(const {value:s} of index.surfaces.get(key(p.x,p.z))||[]){const q=local(s,p);if(Math.abs(q.x)<=s.halfExtents.x+radius&&Math.abs(q.z)<=s.halfExtents.z+radius&&s.center.y<=p.y+STEP&&s.center.y>=baseY)y=Math.max(y,s.center.y);}return y;}
/** Prepared, space-local supports inform terrain traversal before collision.
 * A floor above the reachable step band cannot grant support from underneath. */
export function creationFloorSupportAt(runtime:CreationNavigation,spaceId:string,p:CreationPoint,inset=0){
 const index=runtime.spaces.get(spaceId);if(!index)return null;
 let deckY=-Infinity;
 for(const {value:s} of index.surfaces.get(key(p.x,p.z))||[]){
  if(s.center.y>p.y+STEP||s.center.y<p.y-STEP)continue;
  const q=local(s,p);
  if(Math.abs(q.x)<=s.halfExtents.x-Math.min(inset,s.halfExtents.x*.1)+.000001&&Math.abs(q.z)<=s.halfExtents.z-Math.min(inset,s.halfExtents.z*.1)+.000001)deckY=Math.max(deckY,s.center.y);
 }
 return Number.isFinite(deckY)?{deckY}:null;
}
/** Circle against an oriented footprint gives rounded doorway corners and a
 * wall normal for sliding. Vertically separated floors and ceilings stay clear. */
function contact(s:CreationSolid,p:CreationPoint,radius:number){
 if(p.y>=s.center.y+s.halfExtents.y-.00001||p.y+HEIGHT<=s.center.y-s.halfExtents.y+.00001)return null;
 const q=local(s,p),hx=s.halfExtents.x,hz=s.halfExtents.z;
 const dx=q.x-Math.max(-hx,Math.min(hx,q.x)),dz=q.z-Math.max(-hz,Math.min(hz,q.z)),distance=Math.hypot(dx,dz);
 let nx:number,nz:number,depth:number;
 if(distance>0){if(distance>=radius-.000001)return null;nx=dx/distance;nz=dz/distance;depth=radius-distance;}
 else {const x=hx-Math.abs(q.x),z=hz-Math.abs(q.z);if(x<z){nx=q.x<0?-1:1;nz=0;depth=x+radius;}else{nx=0;nz=q.z<0?-1:1;depth=z+radius;}}
 const c=Math.cos(s.yaw),sn=Math.sin(s.yaw);
 return {x:nx*c+nz*sn,z:nz*c-nx*sn,depth};
}
function blocked(index:SpaceIndex,p:CreationPoint,radius:number){return (index.solids.get(key(p.x,p.z))||[]).some(({value:s})=>contact(s,p,radius)!==null);}
export function creationPositionIsClear(runtime:CreationNavigation,spaceId:string,p:CreationPoint,radius=.35){
 if(![p.x,p.y,p.z,radius].every(Number.isFinite)||radius<0||radius>.5)return false;
 const index=runtime.spaces.get(spaceId);return !index||!blocked(index,p,radius);
}
export function resolveCreationMovement(runtime:CreationNavigation,spaceId:string,from:CreationPoint,to:CreationPoint,radius=.35){
 if(![from.x,from.y,from.z,to.x,to.y,to.z,radius].every(Number.isFinite)||radius<0||radius>.5)throw Error('creation_movement_invalid');
 const index=runtime.spaces.get(spaceId);if(!index)return {position:to,blocked:false};
 const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.08));
 if(steps>256)return {position:from,blocked:true};
 const dx=(to.x-from.x)/steps,dz=(to.z-from.z)/steps;let position=from,hit=false;
 for(let i=1;i<=steps;i++){
  const next={x:position.x+dx,y:position.y,z:position.z+dz},baseY=from.y+(to.y-from.y)*i/steps;
  next.y=floor(index,next,baseY,radius);
  for(let pass=0;pass<4;pass++){
   let adjusted=false;
   for(const {value:s} of index.solids.get(key(next.x,next.z))||[]){
    const overlap=contact(s,next,radius);if(!overlap)continue;
    // Recover small landing/restore overlaps without teleporting out of a large solid.
    if(overlap.depth>radius+.08)return {position,blocked:true};
    next.x+=overlap.x*(overlap.depth+.00001);next.z+=overlap.z*(overlap.depth+.00001);hit=true;adjusted=true;
   }
   if(!adjusted)break;
  }
  next.y=floor(index,next,baseY,radius);
  if(blocked(index,next,radius))return {position,blocked:true};
  position=next;
 }
 return {position,blocked:hit};
}
/** Cached regional queries only. A route that exceeds the local work budget is deferred. */
export function findCreationRoute(runtime:CreationNavigation,spaceId:string,from:CreationPoint,to:CreationPoint){
 const reject=()=>({reachable:false,points:[] as CreationPoint[]}),index=runtime.spaces.get(spaceId);
 if(!index||![...Object.values(from),...Object.values(to)].every(Number.isFinite))return reject();
 const identity=(e:Entry<CreationSurface>)=>`${e.instanceId}:${e.value.id}`;
 const nearest=(p:CreationPoint)=>(index.surfaces.get(key(p.x,p.z))||[]).find(e=>Math.hypot(e.value.center.x-p.x,e.value.center.y-p.y,e.value.center.z-p.z)<.01);
 const start=nearest(from),end=nearest(to);if(!start||!end)return reject();
 const endKey=identity(end),queue=[start],previous=new Map<string,string|null>([[identity(start),null]]),visited=new Map([[identity(start),start]]);
 let cells=0,candidates=0;
 for(let cursor=0;cursor<queue.length&&!previous.has(endKey);cursor++){
  if(queue.length>512)return reject();
  const entry=queue[cursor],a=entry.value,c=Math.abs(Math.cos(a.yaw)),s=Math.abs(Math.sin(a.yaw));
  const hx=c*a.halfExtents.x+s*a.halfExtents.z+.5,hz=s*a.halfExtents.x+c*a.halfExtents.z+.5;
  const minX=Math.floor((a.center.x-hx)/CELL),maxX=Math.floor((a.center.x+hx)/CELL),minZ=Math.floor((a.center.z-hz)/CELL),maxZ=Math.floor((a.center.z+hz)/CELL);
  const seen=new Set<string>();
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
   if(++cells>4096)return reject();
   for(const neighbor of index.surfaces.get(`${x}:${z}`)||[]){
    if(++candidates>16384)return reject();
    const id=identity(neighbor);if(previous.has(id)||seen.has(id))continue;seen.add(id);
    const b=neighbor.value,q=local(a,b.center),relative=b.yaw-a.yaw,bc=Math.abs(Math.cos(relative)),bs=Math.abs(Math.sin(relative));
    if(Math.abs(a.center.y-b.center.y)>STEP||Math.abs(q.x)>a.halfExtents.x+bc*b.halfExtents.x+bs*b.halfExtents.z||Math.abs(q.z)>a.halfExtents.z+bs*b.halfExtents.x+bc*b.halfExtents.z)continue;
    const height=Math.max(a.center.y,b.center.y),distance=Math.hypot(a.center.x-b.center.x,a.center.z-b.center.z),steps=Math.max(1,Math.ceil(distance/.08));
    if(steps>256)continue;
    let clear=true;for(let i=0;i<=steps;i++){if(blocked(index,{x:a.center.x+(b.center.x-a.center.x)*i/steps,y:height,z:a.center.z+(b.center.z-a.center.z)*i/steps},.2)){clear=false;break;}}
    if(!clear)continue;previous.set(id,identity(entry));visited.set(id,neighbor);queue.push(neighbor);
   }
  }
 }
 if(!previous.has(endKey))return reject();
 const points:CreationPoint[]=[];for(let id:string|null=endKey;id!==null;id=previous.get(id)!){points.unshift(visited.get(id)!.value.center);}
 return {reachable:true,points};
}
/** Aerial motion never adopts a surface floor; all three axes are swept against cached solids. */
export function resolveCreationFlight(runtime:CreationNavigation,spaceId:string,from:CreationPoint,to:CreationPoint,radius=.35){
 if(![from.x,from.y,from.z,to.x,to.y,to.z,radius].every(Number.isFinite)||radius<0||radius>.5)throw Error('creation_movement_invalid');
 const index=runtime.spaces.get(spaceId);if(!index)return {position:to,blocked:false};
 const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)/.08));
 if(steps>256)return {position:from,blocked:true};
 let position=from;for(let i=1;i<=steps;i++){const next={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps,z:from.z+(to.z-from.z)*i/steps};if(blocked(index,next,radius))return {position,blocked:true};position=next;}
 return {position,blocked:false};
}
export function writeCreationAerialCollision(output:{obstacleTopY:number;ceilingY:number;protectedAirspace:boolean;blockerId:string|null;floorY:number},runtime:CreationNavigation,spaceId:string,point:CreationPoint,fallbackFloor:number,radius=.35,height=HEIGHT){
 output.obstacleTopY=Number.NaN;output.ceilingY=Number.NaN;output.protectedAirspace=false;output.blockerId=null;output.floorY=fallbackFloor;
 const index=runtime.spaces.get(spaceId);if(!index)return output;
 output.floorY=floor(index,point,fallbackFloor,radius);
 for(const {value:s} of index.solids.get(key(point.x,point.z))||[]){const q=local(s,point);if(Math.abs(q.x)>s.halfExtents.x+radius||Math.abs(q.z)>s.halfExtents.z+radius)continue;const min=s.center.y-s.halfExtents.y,max=s.center.y+s.halfExtents.y;
  if(min>=point.y+height-.01){if(!Number.isFinite(output.ceilingY)||min<output.ceilingY){output.ceilingY=min;output.blockerId=s.id;}}
  else if(point.y<max-.00001&&point.y+height>min+.00001&&(!Number.isFinite(output.obstacleTopY)||max>output.obstacleTopY)){output.obstacleTopY=max;output.blockerId=s.id;}
 }
 return output;
}

/** Retract the rendered camera along its desired view, using only the prepared
 * solid buckets. Exact slab intersections preserve thin walls and doorway holes. */
export function writeCreationCameraPosition(output:{x:number;y:number;z:number},runtime:CreationNavigation,spaceId:string,origin:CreationPoint,target:CreationPoint,radius=.18){
 if(![output.x,output.y,output.z,origin.x,origin.y,origin.z,target.x,target.y,target.z,radius].every(Number.isFinite)||radius<0||radius>.5)throw Error('creation_camera_invalid');
 const index=runtime.spaces.get(spaceId);if(!index)return output;
 const ax=origin.x+target.x,ay=origin.y+target.y,az=origin.z+target.z,dx=output.x-target.x,dy=output.y-target.y,dz=output.z-target.z;
 const minX=Math.floor((Math.min(ax,ax+dx)-radius)/CELL),maxX=Math.floor((Math.max(ax,ax+dx)+radius)/CELL),minZ=Math.floor((Math.min(az,az+dz)-radius)/CELL),maxZ=Math.floor((Math.max(az,az+dz)+radius)/CELL);
 let hit=1,candidates=0;
 if((maxX-minX+1)*(maxZ-minZ+1)>64)hit=0;
 else query:for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)for(const {value:s} of index.solids.get(`${x}:${z}`)||[]){
  if(++candidates>4096){hit=0;break query;}
  const c=Math.cos(s.yaw),sn=Math.sin(s.yaw),rx=ax-s.center.x,rz=az-s.center.z;
  const lx=rx*c-rz*sn,lz=rx*sn+rz*c,vx=dx*c-dz*sn,vz=dx*sn+dz*c;
  let enter=0,leave=hit;
  for(let axis=0;axis<3;axis++){
   const p=axis===0?lx:axis===1?ay-s.center.y:lz,v=axis===0?vx:axis===1?dy:vz,h=(axis===0?s.halfExtents.x:axis===1?s.halfExtents.y:s.halfExtents.z)+radius;
   if(Math.abs(v)<1e-10){if(p < -h || p > h){enter=Infinity;break;}continue;}
   const a=(-h-p)/v,b=(h-p)/v;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
   if(enter>leave){enter=Infinity;break;}
  }
  hit=Math.min(hit,enter);
 }
 if(hit<1){const t=Math.max(0,hit-.00001);output.x=target.x+dx*t;output.y=target.y+dy*t;output.z=target.z+dz*t;}
 return output;
}
