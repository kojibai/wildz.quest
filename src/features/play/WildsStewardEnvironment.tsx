"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import { projectWildsResourceAvailability, projectWildsResourceSourceForObstacle, type WildsResourceSource } from "./wilds-resource-authority";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsStructureV1 } from "./wilds-steward-construction";
import { projectWildsTerrainActorPosition } from "./wilds-terrain-rendering";
import { WILDS_TERRAIN_TILE_SIZE } from "./wilds-terrain-authority";
import { wildsTerrainObstaclesForTile } from "./wilds-terrain-obstacles";
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import { projectWildsResourceAffordance } from "./wilds-resource-affordance";

function createGeometry() {
  return {
    timberRing: new THREE.TorusGeometry(.62, .055, 7, 24),
    stoneRing: new THREE.TorusGeometry(.62, .055, 7, 24),
    sourceHit: new THREE.CylinderGeometry(.72, .72, 3.8, 10),
    capacityPip: new THREE.SphereGeometry(.065, 6, 5),
    foundation: new THREE.BoxGeometry(5.6, .4, 4.8),
    post: new THREE.CylinderGeometry(.16, .2, 2.5, 8),
    beam: new THREE.BoxGeometry(5.4, .22, .28),
    roof: new THREE.ConeGeometry(4.2, 1.25, 4),
    bridgeDeck: new THREE.BoxGeometry(3, .24, 8),
    bridgePlank: new THREE.BoxGeometry(2.86, .1, .62),
    bridgeRail: new THREE.BoxGeometry(.14, .14, 7.8),
    bridgePost: new THREE.CylinderGeometry(.1, .13, 1.05, 8),
    bridgeFooting: new THREE.CylinderGeometry(.22, .3, 1.2, 8)
  };
}

function createMaterials() {
  return {
    sourceReady: new THREE.MeshStandardMaterial({ color: "#7ff0c5", emissive: "#287b5f", emissiveIntensity: .65 }),
    sourceApproach: new THREE.MeshStandardMaterial({ color: "#f1d676", emissive: "#8b6822", emissiveIntensity: .48 }),
    sourceCompanion: new THREE.MeshStandardMaterial({ color: "#bda6ff", emissive: "#5d3a9b", emissiveIntensity: .48 }),
    sourceRest: new THREE.MeshStandardMaterial({ color: "#8fdcff", emissive: "#286d89", emissiveIntensity: .44 }),
    sourceWorking: new THREE.MeshStandardMaterial({ color: "#efffbf", emissive: "#65a450", emissiveIntensity: .75 }),
    sourceRecovering: new THREE.MeshStandardMaterial({ color: "#617a72", emissive: "#1d3932", emissiveIntensity: .18, transparent: true, opacity: .56 }),
    sourceHit: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: .001, depthWrite: false }),
    foundation: new THREE.MeshStandardMaterial({ color: "#68766e", roughness: .95 }),
    wood: new THREE.MeshStandardMaterial({ color: "#73513b", roughness: .88 }),
    roof: new THREE.MeshStandardMaterial({ color: "#275947", roughness: .78, side: THREE.DoubleSide }),
    bridgeWood: new THREE.MeshStandardMaterial({ color: "#8c6746", roughness: .9 }),
    bridgeEdge: new THREE.MeshStandardMaterial({ color: "#4f392c", roughness: .94 })
  };
}

type Geometry = ReturnType<typeof createGeometry>;
type Materials = ReturnType<typeof createMaterials>;

function Shared({ geometry, material, ...props }: { geometry: THREE.BufferGeometry; material: THREE.Material } & ComponentProps<"mesh">) {
  return <mesh {...props}><primitive attach="geometry" object={geometry} /><primitive attach="material" object={material} /></mesh>;
}

export function WildsStewardEnvironment({ livingWorld, player, terrainElevation, kaiUPulse, onInteractSource, companionWorkFamilies = [], companionReady = true, pending = false, siteRuntime, siteSpaceId }: {
  livingWorld?: WildsWorldProjection | null;
  player: Readonly<{ x: number; z: number }>;
  terrainElevation: number;
  kaiUPulse: number;
  onInteractSource?: (source: WildsResourceSource) => void;
  companionWorkFamilies?: readonly string[];
  companionReady?: boolean;
  pending?: boolean;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpaceId: string;
}) {
  const tileX = Math.floor(player.x / WILDS_TERRAIN_TILE_SIZE);
  const tileZ = Math.floor(player.z / WILDS_TERRAIN_TILE_SIZE);
  const sources = useMemo(() => {
    const projected: Array<{ source: WildsResourceSource; availableCapacity: number }> = [];
    if (siteSpaceId !== "wildz.space.outer.v1") return projected;
    for (let x = tileX - 2; x <= tileX + 2; x += 1) for (let z = tileZ - 2; z <= tileZ + 2; z += 1) {
      for (const obstacle of wildsTerrainObstaclesForTile(x, z)) {
        if (obstacle.kind !== "tree" && obstacle.kind !== "rock") continue;
        const source = projectWildsResourceSourceForObstacle(obstacle);
        const distance = Math.hypot(source.position.x - player.x, source.position.z - player.z);
        if (distance > 11) continue;
        const state = livingWorld?.harvestedSources[source.sourceId];
        const availability = projectWildsResourceAvailability(source, {
          admittedHarvestedCapacity: state?.harvestedCapacity ?? 0,
          lastHarvestKaiPulse: state?.lastHarvestKaiPulse ?? "0",
          currentKaiPulse: String(kaiUPulse)
        });
        projected.push({ source, availableCapacity: availability.availableCapacity });
      }
    }
    return projected.sort((left, right) => Math.hypot(left.source.position.x - player.x, left.source.position.z - player.z) - Math.hypot(right.source.position.x - player.x, right.source.position.z - player.z) || left.source.sourceId.localeCompare(right.source.sourceId)).slice(0, 24);
  }, [kaiUPulse, livingWorld?.harvestedSources, player.x, player.z, siteSpaceId, tileX, tileZ]);
  const structures = useMemo(() => Object.values(livingWorld?.structures ?? {})
    .filter((structure) => Math.hypot(structure.position.x - player.x, structure.position.z - player.z) <= 110)
    .sort((left, right) => left.structureId.localeCompare(right.structureId)), [livingWorld?.structures, player.x, player.z]);
  const geometry = useMemo(createGeometry, []);
  const materials = useMemo(createMaterials, []);
  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
    Object.values(materials).forEach((item) => item.dispose());
  }, [geometry, materials]);
  return <group name="wilds-steward-world">
    {sources.map(({ source, availableCapacity }) => <ResourceManifestation availableCapacity={availableCapacity} companionQualified={companionWorkFamilies.includes(source.requirements.creature)} companionReady={companionReady} geometry={geometry} key={source.sourceId} materials={materials} onInteract={onInteractSource} pending={pending} player={player} siteRuntime={siteRuntime} siteSpaceId={siteSpaceId} source={source} terrainElevation={terrainElevation} />)}
    {structures.map((structure) => structure.blueprint === "trail-bridge"
      ? <TrailBridge geometry={geometry} key={structure.structureId} materials={materials} player={player} structure={structure} terrainElevation={terrainElevation} />
      : <TrailShelter geometry={geometry} key={structure.structureId} materials={materials} player={player} structure={structure} terrainElevation={terrainElevation} />)}
  </group>;
}

function ResourceManifestation({ geometry, materials, onInteract, player, source, terrainElevation, availableCapacity, companionQualified, companionReady, pending, siteRuntime, siteSpaceId }: {
  geometry: Geometry;
  materials: Materials;
  onInteract?: (source: WildsResourceSource) => void;
  player: Readonly<{ x: number; z: number }>;
  source: WildsResourceSource;
  terrainElevation: number;
  availableCapacity: number;
  companionQualified: boolean;
  companionReady: boolean;
  pending: boolean;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpaceId: string;
}) {
  const timber = source.kind === "timber";
  const actorElevation = wildsSiteRuntimeGroundY(siteRuntime, siteSpaceId, source.position.x, source.position.z, source.position.y);
  const position = projectWildsTerrainActorPosition(source.position, player, .05, { actorElevation, anchorElevation: terrainElevation });
  const distance = Math.hypot(source.position.x - player.x, source.position.z - player.z);
  const affordance = projectWildsResourceAffordance({ kind: timber ? "timber" : "stone", distance, availableCapacity, pending, companionQualified, companionReady });
  const material = affordance.state === "ready" ? materials.sourceReady
    : affordance.state === "approach" ? materials.sourceApproach
      : affordance.state === "companion" ? materials.sourceCompanion
        : affordance.state === "rest" ? materials.sourceRest
          : affordance.state === "working" ? materials.sourceWorking
            : materials.sourceRecovering;
  const ratio = Math.max(0, Math.min(1, availableCapacity / source.capacity));
  const pips = Math.ceil(ratio * 4);
  return <group name={`steward-source-${source.sourceId}`} onClick={(event) => { event.stopPropagation(); if (!pending) onInteract?.(source); }} position={position} userData={{ affordance: affordance.state, availableCapacity, capacity: source.capacity }}>
    <Shared geometry={timber ? geometry.timberRing : geometry.stoneRing} material={material} position={[0, .055, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[.82 + ratio * .18, .82 + ratio * .18, 1]} />
    {Array.from({ length: pips }, (_, index) => {
      const angle = index / 4 * Math.PI * 2;
      return <Shared geometry={geometry.capacityPip} key={index} material={material} position={[Math.cos(angle) * .78, .08, Math.sin(angle) * .78]} />;
    })}
    <Shared geometry={geometry.sourceHit} material={materials.sourceHit} position={[0, 1.8, 0]} scale={timber ? [1, 1, 1] : [.72, .35, .72]} />
  </group>;
}

function TrailShelter({ geometry, materials, player, structure, terrainElevation }: {
  geometry: Geometry;
  materials: Materials;
  player: Readonly<{ x: number; z: number }>;
  structure: WildsStructureV1;
  terrainElevation: number;
}) {
  const root = useRef<THREE.Group>(null);
  const progress = useRef(0);
  useFrame((_, delta) => {
    if (!root.current || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + Math.min(delta, .05) * .9);
    const eased = 1 - Math.pow(1 - progress.current, 3);
    root.current.scale.set(1, Math.max(.04, eased), 1);
  });
  const position = projectWildsTerrainActorPosition(structure.position, player, 0, { actorElevation: structure.position.y, anchorElevation: terrainElevation });
  const rotation = structure.rotationQuarterTurns * Math.PI / 2;
  return <group name={`trail-shelter-${structure.structureId}`} position={position} ref={root} rotation={[0, rotation, 0]} scale={[1, .04, 1]}>
    <Shared castShadow receiveShadow geometry={geometry.foundation} material={materials.foundation} position={[0, .2, 0]} />
    {[[-2.45, 1.55, -1.95], [2.45, 1.55, -1.95], [-2.45, 1.55, 1.95], [2.45, 1.55, 1.95]].map((point, index) => <Shared castShadow geometry={geometry.post} key={index} material={materials.wood} position={point as [number, number, number]} />)}
    <Shared castShadow geometry={geometry.beam} material={materials.wood} position={[0, 2.65, -1.95]} />
    <Shared castShadow geometry={geometry.beam} material={materials.wood} position={[0, 2.65, 1.95]} />
    <Shared castShadow geometry={geometry.roof} material={materials.roof} position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, .82]} />
  </group>;
}

function TrailBridge({ geometry, materials, player, structure, terrainElevation }: {
  geometry: Geometry;
  materials: Materials;
  player: Readonly<{ x: number; z: number }>;
  structure: Extract<WildsStructureV1, { blueprint: "trail-bridge" }>;
  terrainElevation: number;
}) {
  const root = useRef<THREE.Group>(null);
  const progress = useRef(0);
  useFrame((_, delta) => {
    if (!root.current || progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + Math.min(delta, .05) * 1.1);
    const eased = 1 - Math.pow(1 - progress.current, 3);
    root.current.scale.set(1, Math.max(.04, eased), 1);
  });
  const position = projectWildsTerrainActorPosition(structure.position, player, 0, {
    actorElevation: structure.physical.deckY,
    anchorElevation: terrainElevation
  });
  const rotation = structure.rotationQuarterTurns * Math.PI / 2;
  const plankSlots = [-3.55, -2.85, -2.15, -1.45, -.75, -.05, .65, 1.35, 2.05, 2.75, 3.45];
  return <group name={`trail-bridge-${structure.structureId}`} position={position} ref={root} rotation={[0, rotation, 0]} scale={[1, .04, 1]}>
    <Shared castShadow receiveShadow geometry={geometry.bridgeDeck} material={materials.bridgeEdge} position={[0, -.13, 0]} />
    {plankSlots.map((z, index) => <Shared castShadow receiveShadow geometry={geometry.bridgePlank} key={index} material={materials.bridgeWood} position={[0, .035, z]} />)}
    {[-1.42, 1.42].map((x) => <Shared castShadow geometry={geometry.bridgeRail} key={`rail-${x}`} material={materials.bridgeEdge} position={[x, .72, 0]} />)}
    {[-1.42, 1.42].flatMap((x) => [-3.7, -1.25, 1.25, 3.7].map((z) => <Shared castShadow geometry={geometry.bridgePost} key={`post-${x}-${z}`} material={materials.bridgeEdge} position={[x, .48, z]} />))}
    {[-1.12, 1.12].flatMap((x) => [-3.65, 3.65].map((z) => <Shared castShadow geometry={geometry.bridgeFooting} key={`footing-${x}-${z}`} material={materials.foundation} position={[x, -.62, z]} />))}
  </group>;
}
