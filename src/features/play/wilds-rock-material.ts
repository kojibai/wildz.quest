"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";

// One mipmapped asset for the entire world. Loading never suspends gameplay.
let rockTexture: THREE.Texture | null = null;
let loading: Promise<THREE.Texture | null> | null = null;
export function useWildsRockTexture() {
  const [texture, setTexture] = useState(rockTexture);
  useEffect(() => {
    let active = true;
    loading ??= new THREE.TextureLoader().loadAsync("/textures/wilds-limestone.webp").then(map => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 2;
      rockTexture = map;
      return map;
    }).catch(() => null);
    void loading.then(map => { if (active) setTexture(map); });
    return () => { active = false; };
  }, []);
  return texture;
}

/** Metre-scaled face projection avoids stretching rock grain on steep surfaces. */
export function applyWildsRockUV(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(n.getX(i)), y = Math.abs(n.getY(i)), z = Math.abs(n.getZ(i));
    uv[i * 2] = (x > y && x > z ? p.getZ(i) : p.getX(i)) / 2;
    uv[i * 2 + 1] = (y >= x && y >= z ? p.getZ(i) : p.getY(i)) / 2;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}
