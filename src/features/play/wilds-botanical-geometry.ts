import * as THREE from "three";

/** The old canopy's 144/80 triangles become individual leaves instead of a solid ball.
 * All detail is authored at creation; instances retain their existing draw batches. */
export function createWildsLeafCluster(triangles: 144 | 80): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], uvs: number[] = [];
  // A small inner crown gives leaves a connected silhouette instead of floating shards.
  const core = triangles === 80 ? new THREE.IcosahedronGeometry(.58, 0) : new THREE.DodecahedronGeometry(.58, 0);
  const corePosition = core.getAttribute("position"), coreUv = core.getAttribute("uv");
  for (let index = 0; index < corePosition.count; index++) {
    const y = corePosition.getY(index);
    positions.push(corePosition.getX(index), y, corePosition.getZ(index));
    const shade = .77 + (y + .58) * .14;
    colors.push(shade, shade, shade * .83);
    uvs.push(coreUv.getX(index), coreUv.getY(index));
  }
  const count = (triangles - corePosition.count / 3) / 2;
  core.dispose();
  const up = new THREE.Vector3(0, 1, 0), tangent = new THREE.Vector3(), across = new THREE.Vector3();
  for (let leaf = 0; leaf < count; leaf++) {
    const angle = leaf * 2.399963229728653;
    const height = 1 - 2 * (leaf + .5) / count;
    const radius = Math.sqrt(1 - height * height) * (.63 + (leaf % 5) * .025);
    const center = new THREE.Vector3(Math.cos(angle) * radius, height * .7, Math.sin(angle) * radius);
    tangent.set(Math.cos(angle + .8), .25 + (leaf % 3) * .13, Math.sin(angle + .8)).normalize();
    across.crossVectors(tangent, up).normalize();
    const length = .17 + (leaf % 7) * .014, width = length * .72;
    const tip = center.clone().addScaledVector(tangent, length);
    const base = center.clone().addScaledVector(tangent, -length * .7);
    const left = center.clone().addScaledVector(across, width); left.y -= .025;
    const right = center.clone().addScaledVector(across, -width); right.y -= .025;
    const shade = .76 + (leaf % 9) * .025;
    for (const [point, u, v, light] of [[base, .5, 0, .82], [left, 0, .42, .96], [tip, .5, 1, 1.08], [base, .5, 0, .82], [tip, .5, 1, 1.08], [right, 1, .42, 1]] as const) {
      positions.push(point.x, point.y, point.z);
      colors.push(Math.min(1, shade * light), Math.min(1, shade * light), Math.min(1, shade * light * .83));
      uvs.push(u,v);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius += .04;
  return geometry;
}
/** Six tapered grass blades replace the twelve triangles of one rectangular stalk. */
export function createWildsGrassGeometry() {
  const positions: number[]=[];
  for(let blade=0;blade<6;blade++) {
    const angle=blade*2.399963;const x=Math.cos(angle)*.5,z=Math.sin(angle)*.5;
    const dx=Math.cos(angle+.7)*.1,dz=Math.sin(angle+.7)*.1;
    const height=.6+(blade%3)*.2;
    positions.push(x-dx,0,z-dz,x+dx,0,z+dz,x+dx*.5,height*.6,z+dz*.5,
      x-dx,0,z-dz,x+dx*.5,height*.6,z+dz*.5,x+Math.cos(angle)*.22,height,z+Math.sin(angle)*.22);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
