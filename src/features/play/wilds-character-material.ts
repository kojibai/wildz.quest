"use client";
import {useEffect} from "react";
import * as THREE from "three";
export type WildsCharacterSurface = "cloth" | "leather" | "fur" | "scales";
const textures = new Map<WildsCharacterSurface, THREE.Texture>();
const requests = new Map<WildsCharacterSurface, Promise<void>>();

function characterTexture(role: WildsCharacterSurface) {
  const cached = textures.get(role);
  if (cached) return cached;
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas) {
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = role === "fur" || role === "scales" ? "#f4f4f4" : "#ffffff";
      context.fillRect(0, 0, 1, 1);
    }
  }
  // Keep USE_MAP compiled from the first draw. The same texture receives the
  // decoded image later, so consumers do not rerender or change shader variants.
  const texture = new THREE.Texture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  texture.repeat.set(2, 2);
  if (canvas) texture.needsUpdate = true;
  textures.set(role, texture);
  return texture;
}

async function loadCharacterTexture(role: WildsCharacterSurface, target: THREE.Texture) {
  let loaded: THREE.Texture | undefined;
  try {
    loaded = await new THREE.TextureLoader().loadAsync(`/textures/wilds-${role}.webp`);
    // Recreate the GPU allocation at the decoded image's dimensions while
    // retaining the material's texture object and sampler configuration.
    target.dispose();
    target.image = loaded.image;
    target.needsUpdate = true;
  } catch { /* The neutral mapped fallback remains usable offline. */ }
  finally { loaded?.dispose(); }
}

/** Four bounded, shared, mapped assets. Loading never suspends the world. */
export function useWildsCharacterTexture(role: WildsCharacterSurface) {
  const texture = characterTexture(role);
  useEffect(() => {
    if (!requests.has(role)) requests.set(role, loadCharacterTexture(role, texture));
  }, [role, texture]);
  return texture;
}
