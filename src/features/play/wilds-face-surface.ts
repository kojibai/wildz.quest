import type * as THREE from 'three';

/** Creation-time +z surface lookup. Y buckets bound queries to one skull latitude band. */
export function createWildsFaceSurface(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute('position'), index = geometry.index!;
  const buckets: number[][] = Array.from({length: 32}, () => []);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < p.count; i++) { minY = Math.min(minY, p.getY(i)); maxY = Math.max(maxY, p.getY(i)); }
  const bucket = (y: number) => Math.max(0, Math.min(31, Math.floor((y - minY) / (maxY - minY) * 32)));
  // ax, ay, az, bx-ax, by-ay, bz-az, cx-ax, cy-ay, cz-az, inverse determinant
  const triangles: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
    const ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),bx=p.getX(b)-ax,by=p.getY(b)-ay,cx=p.getX(c)-ax,cy=p.getY(c)-ay;
    const det=bx*cy-by*cx;
    if(det <= 1e-10) continue; // Back faces and silhouette-degenerate triangles cannot be a +z surface.
    const offset=triangles.length;
    triangles.push(ax,ay,az,bx,by,p.getZ(b)-az,cx,cy,p.getZ(c)-az,1/det);
    for(let j=bucket(Math.min(ay,ay+by,ay+cy));j<=bucket(Math.max(ay,ay+by,ay+cy));j++) buckets[j].push(offset);
  }
  return (x: number, y: number): number => {
    if(y<minY || y>maxY) return NaN;
    let z=-Infinity;
    for(const i of buckets[bucket(y)]) {
      const dx=x-triangles[i],dy=y-triangles[i+1];
      const u=(dx*triangles[i+7]-dy*triangles[i+6])*triangles[i+9];
      const v=(triangles[i+3]*dy-triangles[i+4]*dx)*triangles[i+9];
      if(u>=-1e-6 && v>=-1e-6 && u+v<=1.000001)z=Math.max(z,triangles[i+2]+u*triangles[i+5]+v*triangles[i+8]);
    }
    return Number.isFinite(z)?z:NaN;
  };
}
