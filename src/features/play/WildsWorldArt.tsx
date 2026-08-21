"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlayState } from "./game-state";
import type { WildsBiomeTile } from "./wilds-biome";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { wildsTerrainElevation } from "./wilds-terrain-authority";
import {
  projectWildsRouteGuides,
  type WildsRouteGuide
} from "./wilds-world-art";

export function WildsWorldArt({
  player,
  qualityProfile,
  trail
}: {
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  trail: WildsBiomeTile["trail"];
}) {
  return <group name="world-authored-art-layers">
    <RouteWaystones player={player} qualityProfile={qualityProfile} trail={trail} />
  </group>;
}

function RouteWaystones({
  player,
  qualityProfile,
  trail
}: {
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  trail: WildsBiomeTile["trail"];
}) {
  const radius = qualityProfile.tier === "low" ? 24 : qualityProfile.tier === "medium" ? 28 : 32;
  const routeCellX = Math.floor(player.x / 6);
  const routeCellZ = Math.floor(player.z / 6);
  const guides = useMemo(
    () => projectWildsRouteGuides({ x: routeCellX * 6 + 3, z: routeCellZ * 6 + 3 }, radius),
    [radius, routeCellX, routeCellZ]
  );
  const bases = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const signals = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => positionRouteWaystones(guides, bases.current, crowns.current, signals.current), [guides]);
  return <group
    name="world-route-waystones"
    position={[-player.x, -wildsTerrainElevation(player.x, player.z), -player.z]}
  >
    <instancedMesh args={[undefined, undefined, guides.length]} name="route-waystone-bases" ref={bases}>
      <dodecahedronGeometry args={[.22, 0]} />
      <meshStandardMaterial color={trail.edge} roughness={.96} />
    </instancedMesh>
    <instancedMesh args={[undefined, undefined, guides.length]} name="route-waystone-crowns" ref={crowns}>
      <octahedronGeometry args={[.13, 0]} />
      <meshStandardMaterial color={trail.base} emissive={trail.edge} emissiveIntensity={.24} roughness={.74} />
    </instancedMesh>
    <instancedMesh args={[undefined, undefined, guides.length]} name="route-waystone-signals" ref={signals}>
      <boxGeometry args={[.035, .035, .32]} />
      <meshStandardMaterial color="#f3e9ae" emissive={trail.base} emissiveIntensity={.48} roughness={.44} />
    </instancedMesh>
  </group>;
}

function positionRouteWaystones(
  guides: readonly WildsRouteGuide[],
  bases: THREE.InstancedMesh | null,
  crowns: THREE.InstancedMesh | null,
  signals: THREE.InstancedMesh | null
) {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  guides.forEach((guide, index) => {
    const ground = guide.elevation;
    rotation.setFromEuler(new THREE.Euler(0, guide.heading, guide.variant ? .06 : -.06));
    matrix.compose(new THREE.Vector3(guide.world.x, ground + .18, guide.world.z), rotation, scale);
    bases?.setMatrixAt(index, matrix);
    matrix.compose(new THREE.Vector3(guide.world.x, ground + .48, guide.world.z), rotation, scale);
    crowns?.setMatrixAt(index, matrix);
    matrix.compose(new THREE.Vector3(guide.world.x, ground + .5, guide.world.z), rotation, scale);
    signals?.setMatrixAt(index, matrix);
  });
  for (const mesh of [bases, crowns, signals]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
}
