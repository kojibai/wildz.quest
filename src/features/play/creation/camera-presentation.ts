import {BufferAttribute,DynamicDrawUsage,type BufferGeometry} from 'three';
import {wildsConstructionOccludesCamera} from '../wilds-construction-camera';
import type {CreationChunk} from './compiler';
import type {CreationSolid} from './geometry';
import type {CreationPoint} from './types';

type Box = {solid:CreationSolid;c:number;s:number;box:{center:CreationPoint;halfExtents:CreationPoint}};
type Range = {start:number;count:number;box:Box|null;visible:boolean};
type Cutaway = {write(camera:CreationPoint,target:CreationPoint):boolean};
const prepared = new WeakMap<BufferGeometry,{chunk:CreationChunk;cutaway:Cutaway}>();

/** Presentation-only topology. Match complete rendered boxes to admitted solids;
 * arbitrary triangles stay visible instead of being mistaken for a wall. */
export function prepareCreationCameraCutaway(chunk:CreationChunk,geometry:BufferGeometry):Cutaway{
  // StrictMode evaluates a memo factory twice and retains its first result.
  // Reuse that writer so a discarded preparation cannot detach its draw index.
  const existing=prepared.get(geometry);if(existing?.chunk===chunk)return existing.cutaway;
  const vertices=chunk.positions.length/3,indices=vertices<=65535?new Uint16Array(vertices):new Uint32Array(vertices);
  for(let vertex=0;vertex<vertices;vertex++)indices[vertex]=vertex;
  const index=new BufferAttribute(indices,1).setUsage(DynamicDrawUsage);geometry.setIndex(index);
  const tolerance=.00001+Math.max(...Object.values(chunk.bounds.min).map(Math.abs),...Object.values(chunk.bounds.max).map(Math.abs))*1e-7;
  const cell=tolerance*2,buckets=new Map<string,Box[]>(),zero={x:0,y:0,z:0};
  const cellX=(x:number)=>Math.floor((x-chunk.bounds.min.x)/cell),cellY=(y:number)=>Math.floor((y-chunk.bounds.min.y)/cell),cellZ=(z:number)=>Math.floor((z-chunk.bounds.min.z)/cell);
  for(const solid of chunk.solids){
    const entry={solid,c:Math.cos(solid.yaw),s:Math.sin(solid.yaw),box:{center:zero,halfExtents:solid.halfExtents}};
    const key=`${cellX(solid.center.x)}:${cellY(solid.center.y)}:${cellZ(solid.center.z)}`,bucket=buckets.get(key);
    if(bucket)bucket.push(entry);else buckets.set(key,[entry]);
  }
  function matches(start:number,entry:Box){
    const {solid,c,s}=entry,faces=new Uint8Array(6);
    for(let triangle=start;triangle<start+36;triangle+=3){
      const normal=triangle*3,nx=chunk.normals[normal]*c-chunk.normals[normal+2]*s,ny=chunk.normals[normal+1],nz=chunk.normals[normal]*s+chunk.normals[normal+2]*c;
      const axis=Math.abs(nx)>.99999?0:Math.abs(ny)>.99999?1:Math.abs(nz)>.99999?2:-1;
      if(axis<0)return false;const sign=(axis===0?nx:axis===1?ny:nz)>0?1:-1;faces[axis*2+(sign>0?1:0)]++;
      for(let v=triangle;v<triangle+3;v++){
        const i=v*3,dx=chunk.positions[i]-solid.center.x,dz=chunk.positions[i+2]-solid.center.z;
        const x=dx*c-dz*s,y=chunk.positions[i+1]-solid.center.y,z=dx*s+dz*c,h=solid.halfExtents;
        if(Math.abs(Math.abs(x)-h.x)>tolerance||Math.abs(Math.abs(y)-h.y)>tolerance||Math.abs(Math.abs(z)-h.z)>tolerance)return false;
        if(Math.abs((axis===0?x:axis===1?y:z)-sign*(axis===0?h.x:axis===1?h.y:h.z))>tolerance)return false;
      }
    }
    return faces.every(count=>count===2);
  }
  function boxAt(start:number,end:number):Box|null{
    if(start+36>end)return null;
    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
    for(let v=start;v<start+36;v++){const i=v*3,x=chunk.positions[i],y=chunk.positions[i+1],z=chunk.positions[i+2];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
    const x=(minX+maxX)/2,y=(minY+maxY)/2,z=(minZ+maxZ)/2,ix=cellX(x),iy=cellY(y),iz=cellZ(z);
    for(let bx=ix-1;bx<=ix+1;bx++)for(let by=iy-1;by<=iy+1;by++)for(let bz=iz-1;bz<=iz+1;bz++)for(const entry of buckets.get(`${bx}:${by}:${bz}`)??[]){
      const center=entry.solid.center;
      if(Math.abs(x-center.x)<=tolerance&&Math.abs(y-center.y)<=tolerance&&Math.abs(z-center.z)<=tolerance&&matches(start,entry))return entry;
    }
    return null;
  }
  const ranges:Range[][]=chunk.materials.map(group=>{
    const list:Range[]=[];for(let start=group.start;start<group.start+group.count;){
      const box=boxAt(start,group.start+group.count),count=box?36:3,previous=list.at(-1);
      if(!box&&previous&&!previous.box)previous.count+=count;else list.push({start,count,box,visible:true});start+=count;
    }return list;
  });
  const localCamera={x:0,y:0,z:0},localTarget={x:0,y:0,z:0};
  const cutaway:Cutaway = {
    /** No proof, mesh, material, or vertex rebuilding in the frame writer. */
    write(camera:CreationPoint,target:CreationPoint){
      let changed=false;
      for(const group of ranges)for(const range of group){
        if(!range.box)continue;const {solid,c,s,box}=range.box;
        let dx=camera.x-solid.center.x,dz=camera.z-solid.center.z;localCamera.x=dx*c-dz*s;localCamera.y=camera.y-solid.center.y;localCamera.z=dx*s+dz*c;
        dx=target.x-solid.center.x;dz=target.z-solid.center.z;localTarget.x=dx*c-dz*s;localTarget.y=target.y-solid.center.y;localTarget.z=dx*s+dz*c;
        const visible=!wildsConstructionOccludesCamera(box,localCamera,localTarget);
        if(visible!==range.visible){range.visible=visible;changed=true;}
      }
      if(!changed)return false;
      let cursor=0;
      ranges.forEach((group,i)=>{
        const start=cursor;for(const range of group)if(range.visible)for(let v=range.start;v<range.start+range.count;v++)indices[cursor++]=v;
        geometry.groups[i].start=start;geometry.groups[i].count=cursor-start;
      });
      geometry.setDrawRange(0,cursor);index.needsUpdate=true;return true;
    }
  };
  prepared.set(geometry,{chunk,cutaway});return cutaway;
}
