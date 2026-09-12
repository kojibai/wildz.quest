import * as THREE from "three";

export type WildsOrganicShape = "trunk" | "canopy" | "crown" | "shrub" | "stone";

/** Authored form and ambient shading baked once into the existing vertex budget.
 * No extra draw batches, textures, lights or per-frame deformation. */
export function createWildsOrganicGeometry(shape: WildsOrganicShape): THREE.BufferGeometry {
  const geometry = shape === "trunk"
    ? new THREE.CylinderGeometry(.16, .29, 1.2, 8, 1)
    : shape === "crown"
      ? new THREE.IcosahedronGeometry(1, 1)
      : new THREE.DodecahedronGeometry(1, shape === "stone" ? 0 : 1);
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
    const angle = Math.atan2(z, x);
    let shade: number;
    if (shape === "trunk") {
      const height = (y + .6) / 1.2;
      const flute = 1 + Math.cos(angle * 4) * .14 * (1 - height);
      position.setXYZ(index, x * flute + height * height * .09, y, z * flute - height * .035);
      shade = .62 + height * .3 + Math.cos(angle * 4) * .06;
    } else if (shape === "stone") {
      const seam = Math.sin(y * 7 + x * 2) * .055;
      position.setXYZ(index, x * (1 + y * .13), y * .88 + seam, z * (1 - x * .12));
      shade = .67 + (y + 1) * .13 + seam;
    } else {
      // Smooth position-only deformation keeps shared vertices joined and normals continuous.
      const lobe = 1 + .12 * Math.sin(angle * 3 + y * 2) + .065 * Math.cos(angle * 5 - y * 3);
      const shoulder = 1 - Math.max(0, y) * .12;
      position.setXYZ(index, x * lobe * shoulder + y * .08,
        y * (shape === "shrub" ? .88 : 1) + .055 * Math.sin(x * 4 + z * 3), z * lobe);
      // Dark leaf undersides and warm tips remain readable without extra shadow casters.
      shade = .64 + (y + 1) * .16 + .035 * Math.sin(x * 5 + z * 4);
    }
    colors[index * 3] = shade;
    colors[index * 3 + 1] = Math.min(1, shade * 1.025);
    colors[index * 3 + 2] = shade * .94;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  if (shape === "canopy" || shape === "crown" || shape === "shrub") {
    // Polyhedron UV seams duplicate vertices. Average coincident normals so the
    // authored lobes read as foliage rather than a set of triangular panels.
    const normal = geometry.getAttribute("normal");
    const sums = new Map<string, THREE.Vector3>();
    const keys: string[] = [];
    for (let index = 0; index < position.count; index += 1) {
      const key = `${Math.round(position.getX(index) * 1e6)}:${Math.round(position.getY(index) * 1e6)}:${Math.round(position.getZ(index) * 1e6)}`;
      keys.push(key);
      const sum = sums.get(key) ?? new THREE.Vector3();
      sum.x += normal.getX(index); sum.y += normal.getY(index); sum.z += normal.getZ(index);
      sums.set(key, sum);
    }
    for (const sum of sums.values()) sum.normalize();
    keys.forEach((key, index) => { const sum = sums.get(key)!; normal.setXYZ(index, sum.x, sum.y, sum.z); });
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (shape === "canopy" || shape === "crown" || shape === "shrub") {
    geometry.boundingSphere!.radius += .04; // Includes the bounded vertex breeze.
  }
  return geometry;
}
