"use client";

import { useEffect } from "react";
import * as THREE from "three";

// One mipmapped asset for the entire world. Loading never suspends gameplay.
let rockTexture: THREE.Texture | null = null;
let loading: Promise<void> | null = null;

function getRockTexture() {
  if (rockTexture) return rockTexture;
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas) {
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 1, 1);
    }
  }
  const texture = new THREE.Texture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  if (canvas) texture.needsUpdate = true;
  rockTexture = texture;
  return texture;
}

async function loadRockTexture(target: THREE.Texture) {
  let loaded: THREE.Texture | undefined;
  try {
    loaded = await new THREE.TextureLoader().loadAsync("/textures/wilds-limestone.webp");
    target.dispose();
    target.image = loaded.image;
    target.needsUpdate = true;
  } catch { /* The neutral mapped fallback remains usable offline. */ }
  finally { loaded?.dispose(); }
}

export function useWildsRockTexture() {
  const texture = getRockTexture();
  useEffect(() => {
    loading ??= loadRockTexture(texture);
  }, [texture]);
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
