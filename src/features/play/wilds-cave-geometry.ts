import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

type Box = Readonly<{center:{x:number;y:number;z:number};halfExtents:{x:number;y:number;z:number}}>;
/** Trace only exposed chamber edges; overlapping corridors remain open. */
export function naturalWildsCaveWalls(floors:readonly Box[],ceilings:readonly Box[]):Box[] {
  const walls:Box[]=[];
  for(const floor of floors) {
    const ceiling=ceilings.find(c=>Math.abs(c.center.x-floor.center.x)<.1&&Math.abs(c.center.z-floor.center.z)<.1);
    const height=ceiling?ceiling.center.y-ceiling.halfExtents.y-floor.center.y:4;
    for(const axis of ["x","z"] as const) for(const side of [-1,1]) {
      const other=axis==="x"?"z":"x",count=Math.ceil(floor.halfExtents[other]*2);
      const length=floor.halfExtents[other]*2/count;
      for(let i=0;i<count;i++) {
        const center={...floor.center,[axis]:floor.center[axis]+side*(floor.halfExtents[axis]+.06),[other]:floor.center[other]-floor.halfExtents[other]+(i+.5)*length};
        if(floors.some(f=>f!==floor && Math.abs(f.center.y-floor.center.y)<1 && Math.abs(center.x-f.center.x)<f.halfExtents.x && Math.abs(center.z-f.center.z)<f.halfExtents.z))continue;
        walls.push({center:{...center,y:center.y+height/2},halfExtents:{x:axis==="x"?.06:length/2,y:height/2,z:axis==="z"?.06:length/2}});
      }
    }
  }
  return walls;
}
/** One draw per surface role, independent of tunnel length. Built only when source geometry changes. */
export function createWildsCaveBatch(boxes:readonly Box[], role:"wall"|"floor"|"ceiling") {
  const unit = new THREE.BoxGeometry(1,1,1,1,role==="wall"?3:1,1).toNonIndexed();
  const source = unit.getAttribute("position"), normals = unit.getAttribute("normal");
  const positions = new Float32Array(boxes.length * source.count * 3);
  const normal = new Float32Array(positions.length), colors = new Float32Array(positions.length);
  const uv = new Float32Array(boxes.length * source.count * 2);
  const origin = boxes[0]?.center ?? {x:0,y:0,z:0};
  boxes.forEach((box,index)=>{
    for(let i=0;i<source.count;i++) {
      const vertex=index*source.count+i,offset=vertex*3;
      let x=box.center.x+source.getX(i)*box.halfExtents.x*2;
      const y=box.center.y+source.getY(i)*box.halfExtents.y*2;
      let z=box.center.z+source.getZ(i)*box.halfExtents.z*2;
      const nx=normals.getX(i),ny=normals.getY(i),nz=normals.getZ(i);
      if(role==="wall") {
        const relief=Math.sin(y*3.7+x*2.1+z*1.3)*.025*Math.sin((source.getY(i)+.5)*Math.PI);
        x+=nx*relief;z+=nz*relief;
      }
      positions.set([x-origin.x,y-origin.y,z-origin.z],offset);
      normal.set([nx,ny,nz],offset);
      uv[vertex*2]=(nx ? z : x)/2;
      uv[vertex*2+1]=(ny ? z : y)/2;
      // Baked foot darkening and sediment tint, without extra lights or frame work.
      const shade=role==="wall" ? .68+(source.getY(i)+.5)*.24 : role==="ceiling" ? .72 : .88;
      colors.set([shade,shade*.97,shade*.91],offset);
    }
  });
  unit.dispose();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("normal",new THREE.BufferAttribute(normal,3));
  geometry.setAttribute("uv",new THREE.BufferAttribute(uv,2));
  geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
  geometry.computeBoundingSphere();
  if(role!=="ceiling")return {geometry,origin};
  // A bounded mineral fringe remains well above standing clearance; merged into the ceiling draw.
  const details=[geometry];
  for(const box of boxes.filter(b=>Math.min(b.halfExtents.x,b.halfExtents.z)>2).slice(0,16)) {
    for(let i=0;i<4;i++) {
      const seed=Math.sin(box.center.x*12.9898+box.center.z*78.233+i*31.7)*43758.5453;
      const fraction=seed-Math.floor(seed),height=.18+fraction*.22;
      const crystal=new THREE.ConeGeometry(.09+fraction*.06,height,5).toNonIndexed();
      crystal.rotateZ(Math.PI);
      crystal.translate(box.center.x-origin.x+(i%2?1:-1)*box.halfExtents.x*.7,box.center.y-box.halfExtents.y-origin.y-height/2,box.center.z-origin.z+(i<2?-1:1)*box.halfExtents.z*.7);
      const p=crystal.getAttribute("position"),tint=new Float32Array(p.count*3);
      for(let j=0;j<p.count;j++)tint.set([.78,.75,.67],j*3);
      crystal.setAttribute("color",new THREE.BufferAttribute(tint,3));details.push(crystal);
    }
  }
  if(details.length===1)return {geometry,origin};
  const merged=mergeGeometries(details,false)!;
  for(const detail of details)detail.dispose();
  merged.computeBoundingSphere();return {geometry:merged,origin};
}
