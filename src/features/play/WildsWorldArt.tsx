"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlayState } from "./game-state";
import type { WildsBiomeTile } from "./wilds-biome";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { wildsTerrainElevation } from "./wilds-terrain-authority";
import {
  projectWildsHorizonAnchors,
  projectWildsRouteGuides,
  type WildsHorizonAnchor,
  type WildsRouteGuide
} from "./wilds-world-art";

export function WildsWorldArt({
  canopy,
  player,
  qualityProfile,
  trail
}: {
  canopy: WildsBiomeTile["canopy"];
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  trail: WildsBiomeTile["trail"];
}) {
  return <group name="world-authored-art-layers">
    <WorldScaleSilhouettes canopy={canopy} player={player} qualityProfile={qualityProfile} />
    <RouteWaystones player={player} qualityProfile={qualityProfile} trail={trail} />
  </group>;
}

export function createFacetedRidgeGeometry(variant: 0 | 1 | 2) {
  const sides = 7;
  const positions: number[] = [];
  const indices: number[] = [];
  const phase = variant * .37;
  const rings = [
    { y: 0, radius: 1 },
    { y: .34 + variant * .035, radius: .7 },
    { y: .68 + variant * .05, radius: .34 }
  ];
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * Math.PI * 2 + phase + ringIndex * .12;
      const fracture = .82 + ((side * 5 + ringIndex * 3 + variant) % 7) * .035;
      positions.push(Math.cos(angle) * ring.radius * fracture, ring.y, Math.sin(angle) * ring.radius * fracture);
    }
  }
  const summit = positions.length / 3;
  positions.push((variant - 1) * .09, .98 + variant * .08, variant === 1 ? -.08 : .05);
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const lower = ringIndex * sides + side;
      const lowerNext = ringIndex * sides + next;
      const upper = (ringIndex + 1) * sides + side;
      const upperNext = (ringIndex + 1) * sides + next;
      indices.push(lower, upper, lowerNext, lowerNext, upper, upperNext);
    }
  }
  const crownStart = (rings.length - 1) * sides;
  for (let side = 0; side < sides; side += 1) indices.push(crownStart + side, summit, crownStart + (side + 1) % sides);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function WorldScaleSilhouettes({
  canopy,
  player,
  qualityProfile
}: {
  canopy: WildsBiomeTile["canopy"];
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
}) {
  const horizonCellX = Math.floor(player.x / 12);
  const horizonCellZ = Math.floor(player.z / 12);
  const anchors = useMemo(
    () => projectWildsHorizonAnchors(
      { x: horizonCellX * 12 + 6, z: horizonCellZ * 12 + 6 },
      qualityProfile.tier
    ),
    [horizonCellX, horizonCellZ, qualityProfile.tier]
  );
  const colors = [canopy.deep, canopy.mid, canopy.highlight] as const;
  return <group
    name="world-scale-silhouettes"
    position={[-player.x, -wildsTerrainElevation(player.x, player.z), -player.z]}
  >
    {([0, 1, 2] as const).map((variant) => (
      <HorizonFamily
        anchors={anchors.filter((anchor) => anchor.variant === variant)}
        color={colors[variant]}
        key={variant}
        variant={variant}
      />
    ))}
  </group>;
}

function HorizonFamily({
  anchors,
  color,
  variant
}: {
  anchors: readonly WildsHorizonAnchor[];
  color: string;
  variant: 0 | 1 | 2;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => createFacetedRidgeGeometry(variant), [variant]);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index];
      rotation.setFromEuler(new THREE.Euler(0, anchor.yaw, 0));
      scale.set(anchor.scale * .78, anchor.scale * (1.1 + variant * .08), anchor.scale * .72);
      matrix.compose(
        new THREE.Vector3(anchor.world.x, anchor.elevation - .12, anchor.world.z),
        rotation,
        scale
      );
      mesh.current?.setMatrixAt(index, matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [anchors, variant]);
  return <instancedMesh args={[undefined, undefined, anchors.length]} frustumCulled={false} geometry={geometry} name={`world-ridge-family-${variant}`} ref={mesh}>
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={variant === 2 ? .08 : .035} flatShading fog roughness={.99} />
  </instancedMesh>;
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
