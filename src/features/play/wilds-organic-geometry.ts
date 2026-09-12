import * as THREE from "three";
import { createWildsLeafCluster } from "./wilds-botanical-geometry";

export type WildsOrganicShape = "trunk" | "canopy" | "crown" | "shrub" | "stone";

/** Authored form and ambient shading baked once into the existing vertex budget.
 * No extra draw batches, textures, lights or per-frame deformation. */
export function createWildsOrganicGeometry(shape: WildsOrganicShape): THREE.BufferGeometry {
  if (shape === "canopy" || shape === "crown" || shape === "shrub") return createWildsLeafCluster(shape === "crown" ? 80 : 144);
  const geometry = shape === "trunk"
    ? new THREE.CylinderGeometry(.16, .29, 1.2, 8, 1)
    : new THREE.DodecahedronGeometry(1, 0);
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
    } else {
      const seam = Math.sin(y * 7 + x * 2) * .055;
      position.setXYZ(index, x * (1 + y * .13), y * .88 + seam, z * (1 - x * .12));
      shade = .67 + (y + 1) * .13 + seam;
    }
    colors[index * 3] = shade;
    colors[index * 3 + 1] = Math.min(1, shade * 1.025);
    colors[index * 3 + 2] = shade * .94;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
