"use client";
import {useEffect, useState} from "react";
import * as THREE from "three";
export type WildsCharacterSurface = "cloth" | "leather" | "fur" | "scales";
const textures = new Map<WildsCharacterSurface, THREE.Texture>();
const requests = new Map<WildsCharacterSurface, Promise<THREE.Texture | null>>();
/** Four bounded, shared, mipmapped assets. Loading never suspends the world. */
export function useWildsCharacterTexture(role: WildsCharacterSurface) {
  const [loaded, setLoaded] = useState<{role: WildsCharacterSurface; map: THREE.Texture | null}>({role, map: textures.get(role) ?? null});
  useEffect(() => {
    let active = true;
    if (!requests.has(role)) requests.set(role, new THREE.TextureLoader().loadAsync(`/textures/wilds-${role}.webp`).then(map => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 2;
      map.repeat.set(2, 2);
      textures.set(role, map);
      return map;
    }).catch(() => null));
    void requests.get(role)!.then(map => {if (active) setLoaded({role, map});});
    return () => {active = false;};
  }, [role]);
  return loaded.role === role ? loaded.map : textures.get(role) ?? null;
}
