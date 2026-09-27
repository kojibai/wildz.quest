"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { wildsTerrainSurfaceTint } from "./wilds-place-presentation";
import { buildWildsTerrainPatchV11 } from "./wilds-terrain-rendering-v11";
import type { WildsWorldAddress } from "./wilds-world-address";

const TILE_SIZE = 12;

export function WildsV11Environment({ address, player, qualityProfile, terrainElevation }: {
  address: WildsWorldAddress;
  player: { x: number; z: number };
  qualityProfile: WildsQualityProfile;
  terrainElevation: number;
}) {
  const centerTileX = Math.floor(player.x / TILE_SIZE);
  const centerTileZ = Math.floor(player.z / TILE_SIZE);
  const radius = qualityProfile.tier === "low" ? 2 : qualityProfile.tier === "medium" ? 3 : 4;
  const segments = qualityProfile.tier === "low" ? 4 : qualityProfile.tier === "medium" ? 6 : 8;
  const patch = useMemo(() => buildWildsTerrainPatchV11(
    { worldVersion: 11, regionX: address.regionX, regionZ: address.regionZ, localX: 0, localZ: 0 },
    centerTileX, centerTileZ, TILE_SIZE, radius, segments
  ), [address.regionX, address.regionZ, centerTileX, centerTileZ, radius, segments]);
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(patch.positions, 3));
    next.setAttribute("normal", new THREE.Float32BufferAttribute(patch.normals, 3));
    next.setAttribute("uv", new THREE.Float32BufferAttribute(patch.uvs, 2));
    next.setAttribute("color", new THREE.Float32BufferAttribute(
      patch.vertices.flatMap(vertex => [...wildsTerrainSurfaceTint(vertex.surface as Parameters<typeof wildsTerrainSurfaceTint>[0])]), 3
    ));
    next.setIndex(Array.from(patch.indices));
    next.computeBoundingSphere();
    return next;
  }, [patch]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const width = TILE_SIZE * (radius * 2 + 1);
  return <group name="world-v11-exact-terrain" position={[patch.originX - player.x, -terrainElevation, patch.originZ - player.z]}>
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#d5efe0" vertexColors roughness={0.96} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, width / 2]}>
      <planeGeometry args={[width, width]} />
      <meshPhysicalMaterial color="#45aee7" depthWrite={false} opacity={0.62} roughness={0.18} transparent />
    </mesh>
  </group>;
}
