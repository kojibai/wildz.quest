import * as THREE from "three";
import type { WildsConstructionKind } from "./wilds-world-construction";

type Surface = "timber" | "stone" | "roof";
/** Small shared repeat textures; generated once, never in the frame loop. */
function surfaceTexture(surface: Surface) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = ((Math.imul(x + 13, 374761393) ^ Math.imul(y + 17, 668265263)) >>> 0) % 101 / 100;
    let base: number[], shade: number;
    if (surface === "timber") {
      const plank = Math.floor(x / 32), seam = x % 32 < 2;
      const grain = Math.sin(x * .9 + Math.sin(y * .055) * 1.8) * .055 + Math.sin(x * 2.2 + y * .014) * .025;
      shade = seam ? .46 : .86 + plank * .035 + grain + noise * .06;
      base = [167, 126, 80];
    } else {
      const row = Math.floor(y / 32), localX = (x + row % 2 * 32) % 64;
      const seam = y % 32 < 2 || localX < 2;
      shade = seam ? .48 : .84 + noise * .12 + Math.sin(Math.floor(localX / 64) + row * 5) * .05;
      base = surface === "roof" ? [97, 110, 102] : [153, 155, 140];
    }
    const offset = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) data[offset + channel] = Math.round(base[channel]! * shade);
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 2; texture.needsUpdate = true;
  return texture;
}
export function createWildsConstructionMaterials() {
  const textures = { timber: surfaceTexture("timber"), stone: surfaceTexture("stone"), roof: surfaceTexture("roof") };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const geometries = new Map<string, THREE.BoxGeometry>();
  return {
    material(kind: WildsConstructionKind, stage: string) {
      const surface: Surface = ["foundation", "path", "hearth", "water"].includes(kind) ? "stone" : kind === "roof" ? "roof" : "timber";
      const key = `${surface}:${stage}`;
      let material = materials.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({ map: textures[surface], bumpMap: textures[surface], bumpScale: surface === "stone" ? .035 : .018,
          color: stage === "framed" ? "#c6bbae" : stage === "finished" ? "#ffffff" : "#e0d9cd", roughness: stage === "finished" && surface === "timber" ? .7 : .91, metalness: 0 });
        material.name = `construction:${key}`; materials.set(key, material);
      }
      return material;
    },
    geometry(half: { x: number; y: number; z: number }) {
      const key = `${half.x}:${half.y}:${half.z}`;
      let geometry = geometries.get(key);
      if (!geometry) {
        geometry = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2);
        const uv = geometry.getAttribute("uv");
        const faces = [[half.z, half.y], [half.z, half.y], [half.x, half.z], [half.x, half.z], [half.x, half.y], [half.x, half.y]];
        for (let i = 0; i < uv.count; i++) { const scale = faces[Math.floor(i / 4)]!; uv.setXY(i, uv.getX(i) * scale[0]!, uv.getY(i) * scale[1]!); }
        uv.needsUpdate = true; geometries.set(key, geometry);
      }
      return geometry;
    },
    dispose() { for (const material of materials.values()) material.dispose(); for (const geometry of geometries.values()) geometry.dispose(); for (const texture of Object.values(textures)) texture.dispose(); }
  };
}
