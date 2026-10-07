import { BufferAttribute, BufferGeometry } from 'three';
import type { CreationChunk } from './compiler';
/** Metre-scaled tangent mapping, derived from admitted buffers without changing their proof. */
export function creationMetricUVs(positions: Float32Array, normals: Float32Array): Float32Array {
  if (positions.length !== normals.length || positions.length % 9) throw Error('creation_render_geometry_invalid');
  const uv = new Float32Array(positions.length / 3 * 2);
  // One projection basis per triangle keeps curved normals from collapsing their UV span.
  for (let start=0; start<positions.length; start+=9) {
    let nx=0,ny=0,nz=0;
    for(let v=0;v<3;v++){nx+=normals[start+v*3];ny+=normals[start+v*3+1];nz+=normals[start+v*3+2];}
    const len=Math.hypot(nx,ny,nz);nx/=len;ny/=len;nz/=len;
    const horizontal=Math.hypot(nx,nz);
    const tx=horizontal>.0001?nz/horizontal:1, tz=horizontal>.0001?-nx/horizontal:0;
    const bx=ny*tz,by=nz*tx-nx*tz,bz=-ny*tx;
    for(let v=0;v<3;v++){
      const i=start+v*3,x=positions[i],y=positions[i+1],z=positions[i+2];
      uv[i/3*2]=x*tx+z*tz;uv[i/3*2+1]=x*bx+y*by+z*bz;
    }
  }
  return uv;
}
export function creationRenderUploadBytes(chunk: Pick<CreationChunk,'positions'|'normals'>): number {
  const vertices=chunk.positions.length/3,indexBytes=vertices<=65535?2:4;
  return chunk.positions.byteLength+chunk.normals.byteLength+vertices*(8+indexBytes);
}
export function createCreationRenderGeometry(chunk: Pick<CreationChunk,'positions'|'normals'|'materials'>): BufferGeometry {
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(chunk.positions,3));
  geometry.setAttribute('normal',new BufferAttribute(chunk.normals,3));
  geometry.setAttribute('uv',new BufferAttribute(creationMetricUVs(chunk.positions,chunk.normals),2));
  chunk.materials.forEach((m,i)=>geometry.addGroup(m.start,m.count,i));
  geometry.computeBoundingSphere();
  return geometry;
}
