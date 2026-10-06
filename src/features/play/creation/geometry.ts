import { deriveCreationCurvedGeometry } from './curved-geometry';
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement, WILDS_CONSTRUCTION_CATALOG } from '../wilds-world-construction';
import type { CreationNode, CreationPoint, CreationPose } from './types';
export type CreationBounds=Readonly<{min:CreationPoint;max:CreationPoint}>;
export type CreationSolid=Readonly<{id:string;center:CreationPoint;halfExtents:CreationPoint;yaw:number}>;
export type CreationSurface=Readonly<{id:string;center:CreationPoint;halfExtents:CreationPoint;yaw:number}>;
export type CreationConnection=Readonly<{id:string;position:CreationPoint;destination:string|null;width:number;height:number;yaw:number}>;
export function overlapsCreationSolids(a:CreationSolid,b:CreationSolid):boolean {
 if(Math.abs(a.center.y-b.center.y)>=a.halfExtents.y+b.halfExtents.y-.00001)return false;
 // Local geometry uses x'=x*cos+z*sin, z'=-x*sin+z*cos, so its world axes rotate by -yaw.
 for(const angle of [-a.yaw,-a.yaw+Math.PI/2,-b.yaw,-b.yaw+Math.PI/2]) {const dx=Math.cos(angle),dz=Math.sin(angle),radius=(s:CreationSolid)=>Math.abs(Math.cos(s.yaw)*dx-Math.sin(s.yaw)*dz)*s.halfExtents.x+Math.abs(Math.sin(s.yaw)*dx+Math.cos(s.yaw)*dz)*s.halfExtents.z;if(Math.abs((a.center.x-b.center.x)*dx+(a.center.z-b.center.z)*dz)>=radius(a)+radius(b)-.00001)return false;}return true;
}
const corners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,4,7],[0,7,3],[1,2,6],[1,6,5],[3,7,6],[3,6,2],[0,1,5],[0,5,4]];
export function deriveCreationGeometry(n:CreationNode,pose:CreationPose) {
 if(n.shape.kind==='cylinder'||n.shape.kind==='ellipsoid')return deriveCreationCurvedGeometry(n,pose);
 const shape=n.shape,w=shape.width,h=shape.height,d=shape.depth,t=shape.thickness||.15;
 const solids:CreationSolid[]=[],walkable:CreationSurface[]=[],interiors:CreationBounds[]=[],connections:CreationConnection[]=[];
 const transform=(p:CreationPoint):CreationPoint=>({x:pose.position.x+p.x*Math.cos(pose.yaw)+p.z*Math.sin(pose.yaw),y:pose.position.y+p.y,z:pose.position.z-p.x*Math.sin(pose.yaw)+p.z*Math.cos(pose.yaw)});
 const box=(id:string,x:number,y:number,z:number,hx:number,hy:number,hz:number,yaw=0)=>{const s={id:`${n.id}:${id}`,center:transform({x,y,z}),halfExtents:{x:hx,y:hy,z:hz},yaw:pose.yaw+yaw};solids.push(s);walkable.push({...s,id:`${s.id}:top`,center:{...s.center,y:s.center.y+hy},halfExtents:{x:hx,y:0,z:hz}});};
 if(shape.kind==='catalog') {
  const entry=WILDS_CONSTRUCTION_CATALOG.find(e=>e.kind===shape.piece);if(!entry)throw new Error('Catalog geometry unavailable');
  const p=previewWildsBlueprintPlacement({blueprint:createWildsBlueprintPreview('creation:adapter','creation'),kind:entry.kind,pointer:{x:0,y:0,z:0},rotationQuarterTurns:0,heightStep:0,physical:{terrainY:0,waterline:null,anchors:[],solids:[]}});
  for(const s of p.collisionSolids)box(s.id,s.center.x*w/(entry.halfExtents.x*2),(s.center.y-p.geometry.center.y)*h/(entry.halfExtents.y*2)+h/2,s.center.z*d/(entry.halfExtents.z*2),s.halfExtents.x*w/(entry.halfExtents.x*2),s.halfExtents.y*h/(entry.halfExtents.y*2),s.halfExtents.z*d/(entry.halfExtents.z*2));
  if(p.interior){const v=p.interior;const center=transform({x:v.center.x,y:h/2,z:v.center.z});interiors.push({min:{x:center.x-v.halfExtents.x,y:center.y-v.halfExtents.y,z:center.z-v.halfExtents.z},max:{x:center.x+v.halfExtents.x,y:center.y+v.halfExtents.y,z:center.z+v.halfExtents.z}});}
 } else if(shape.kind==='shell') {
  box('floor',0,t/2,0,w/2,t/2,d/2);box('roof',0,h-t/2,0,w/2,t/2,d/2);
  box('left',-w/2+t/2,h/2,0,t/2,h/2-t,d/2);box('right',w/2-t/2,h/2,0,t/2,h/2-t,d/2);box('back',0,h/2,d/2-t/2,w/2-t,h/2-t,t/2);
  const door=shape.doorway;if(door){const side=(w-door.width)/2;box('front:left',-(door.width+side)/2,h/2,-d/2+t/2,side/2,h/2-t,t/2);box('front:right',(door.width+side)/2,h/2,-d/2+t/2,side/2,h/2-t,t/2);box('lintel',0,(h+door.height)/2,-d/2+t/2,door.width/2,(h-door.height)/2,t/2);connections.push({id:`${n.id}:door`,position:transform({x:0,y:t,z:-d/2}),destination:null,width:door.width,height:door.height,yaw:pose.yaw});}else box('front',0,h/2,-d/2+t/2,w/2-t,h/2-t,t/2);
  const a=transform({x:-w/2+t,y:t,z:-d/2+t}),b=transform({x:w/2-t,y:h-t,z:d/2-t});interiors.push({min:{x:Math.min(a.x,b.x),y:a.y,z:Math.min(a.z,b.z)},max:{x:Math.max(a.x,b.x),y:b.y,z:Math.max(a.z,b.z)}});
 } else if(shape.kind==='arch') {
  box('left',-w/2+t/2,h/2,0,t/2,h/2,d/2);box('right',w/2-t/2,h/2,0,t/2,h/2,d/2);
  const count=24,span=w-2*t;for(let i=0;i<count;i++){const x=-span/2+(i+.5)*span/count,opening=h/2+Math.sqrt(Math.max(0,1-(x/(span/2))**2))*(h/2-t);box(`arch:${i}`,x,(h+opening)/2,0,span/count/2,(h-opening)/2,d/2);}connections.push({id:`${n.id}:arch`,position:pose.position,destination:null,width:w-2*t,height:h/2,yaw:pose.yaw});
 } else if(shape.kind==='sweep') {
  const points=shape.points;if(!points||points.length<2)throw new Error('Sweep requires at least two path points');for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.z-a.z);if(a.y!==b.y||len<=0)throw new Error('This sweep requires a horizontal path');box(`segment:${i}`,(a.x+b.x)/2,a.y+h/2,(a.z+b.z)/2,w/2,h/2,len/2,-Math.atan2(b.x-a.x,b.z-a.z));}
 } else {if(shape.kind==='extrusion'&&shape.points)throw new Error('Custom polygon extrusion is not yet qualified');box('body',0,h/2,0,w/2,h/2,d/2);}
 const positions:number[]=[],normals:number[]=[];
 for(const s of solids){const vertices=corners.map(([x,y,z])=>({x:s.center.x+x*s.halfExtents.x*Math.cos(s.yaw)+z*s.halfExtents.z*Math.sin(s.yaw),y:s.center.y+y*s.halfExtents.y,z:s.center.z-x*s.halfExtents.x*Math.sin(s.yaw)+z*s.halfExtents.z*Math.cos(s.yaw)}));for(const [ia,ib,ic] of faces){const a=vertices[ia],b=vertices[ib],c=vertices[ic],u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z},normal={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x},len=Math.hypot(normal.x,normal.y,normal.z);for(const p of [a,b,c]){positions.push(p.x,p.y,p.z);normals.push(normal.x/len,normal.y/len,normal.z/len);}}}
 return {solids,walkable,interiors,connections,positions,normals,volume:solids.reduce((sum,s)=>sum+8*s.halfExtents.x*s.halfExtents.y*s.halfExtents.z,0)};
}
