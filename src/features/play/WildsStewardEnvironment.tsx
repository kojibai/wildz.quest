"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import { projectWildsResourceAvailability, projectWildsResourceSourceForObstacle, type WildsResourceSource } from "./wilds-resource-authority";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsStructureV1 } from "./wilds-steward-construction";
import { projectWildsTerrainActorPosition } from "./wilds-terrain-rendering";
import { sampleWildsTerrain, WILDS_TERRAIN_TILE_SIZE } from "./wilds-terrain-authority";
import { wildsTerrainObstaclesForTile } from "./wilds-terrain-obstacles";
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import { projectWildsResourceAffordance } from "./wilds-resource-affordance";
import { projectWildsWorkPresentation, type WildsActiveWorkSource } from "./wilds-work-presentation";
import { useWildsReadability } from "./WildsReadabilityContext";
import type { WildsStewardPlacement } from "./wilds-steward-craft";
import type { WildsConstructionSiteV1 } from "./wilds-construction-site";

function createGeometry() {
  return {
    timberRing: new THREE.TorusGeometry(.62, .055, 7, 24),
    stoneRing: new THREE.TorusGeometry(.62, .055, 7, 24),
    sourceHit: new THREE.CylinderGeometry(.72, .72, 3.8, 10),
    capacityPip: new THREE.SphereGeometry(.065, 6, 5),
    workChip: new THREE.OctahedronGeometry(.09, 0),
    foundation: new THREE.BoxGeometry(5.6, .4, 4.8),
    post: new THREE.CylinderGeometry(.16, .2, 2.5, 8),
    beam: new THREE.BoxGeometry(5.4, .22, .28),
    roof: new THREE.ConeGeometry(4.2, 1.25, 4),
    bridgeDeck: new THREE.BoxGeometry(3, .24, 8),
    bridgePlank: new THREE.BoxGeometry(2.86, .1, .62),
    bridgeRail: new THREE.BoxGeometry(.14, .14, 7.8),
    bridgePost: new THREE.CylinderGeometry(.1, .13, 1.05, 8),
    bridgeFooting: new THREE.CylinderGeometry(.22, .3, 1.2, 8),
    benchTop: new THREE.BoxGeometry(3.2, .24, 1.35),
    benchLeg: new THREE.BoxGeometry(.24, 1.25, .24),
    toolRack: new THREE.BoxGeometry(2.5, .12, .12),
    cacheBody: new THREE.BoxGeometry(2.5, 1.3, 1.65),
    cacheLid: new THREE.BoxGeometry(2.7, .2, 1.85),
    cacheBand: new THREE.BoxGeometry(.16, 1.38, 1.72),
    ghostMarker: new THREE.TorusGeometry(3.5, .045, 7, 48),
    siteMarker: new THREE.TorusGeometry(2.7, .065, 7, 48)
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
    timberChip: new THREE.MeshStandardMaterial({ color: "#d59b61", emissive: "#78512d", emissiveIntensity: .32, roughness: .82 }),
    stoneChip: new THREE.MeshStandardMaterial({ color: "#b9ccc1", emissive: "#526b60", emissiveIntensity: .22, roughness: .96 }),
    foundation: new THREE.MeshStandardMaterial({ color: "#68766e", roughness: .95 }),
    wood: new THREE.MeshStandardMaterial({ color: "#73513b", roughness: .88 }),
    roof: new THREE.MeshStandardMaterial({ color: "#275947", roughness: .78, side: THREE.DoubleSide }),
    bridgeWood: new THREE.MeshStandardMaterial({ color: "#8c6746", roughness: .9 }),
    bridgeEdge: new THREE.MeshStandardMaterial({ color: "#4f392c", roughness: .94 }),
    workshopWood: new THREE.MeshStandardMaterial({ color: "#6e4934", roughness: .82 }),
    workshopMetal: new THREE.MeshStandardMaterial({ color: "#77d9c4", emissive: "#1d584d", emissiveIntensity: .22, roughness: .58 }),
    cacheWood: new THREE.MeshStandardMaterial({ color: "#496153", roughness: .9 }),
    ghostValid: new THREE.MeshStandardMaterial({ color: "#87f4ce", emissive: "#34b98d", emissiveIntensity: .5, transparent: true, opacity: .38, depthWrite: false }),
    ghostInvalid: new THREE.MeshStandardMaterial({ color: "#ff887f", emissive: "#b83b38", emissiveIntensity: .42, transparent: true, opacity: .34, depthWrite: false }),
    sitePlaced: new THREE.MeshStandardMaterial({ color: "#79e6c0", emissive: "#277a61", emissiveIntensity: .52, roughness: .72 }),
    siteReady: new THREE.MeshStandardMaterial({ color: "#e5e889", emissive: "#807d28", emissiveIntensity: .62, roughness: .68 })
  };
}

type Geometry = ReturnType<typeof createGeometry>;
type Materials = ReturnType<typeof createMaterials>;

function Shared({ geometry, material, ...props }: { geometry: THREE.BufferGeometry; material: THREE.Material } & ComponentProps<"mesh">) {
  return <mesh {...props}><primitive attach="geometry" object={geometry} /><primitive attach="material" object={material} /></mesh>;
}

function writeConstructionStage(group: THREE.Group | null, progress: number, start: number, end: number) {
  if (!group) return;
  const local = Math.max(0, Math.min(1, (progress - start) / Math.max(.001, end - start)));
  const eased = 1 - Math.pow(1 - local, 3);
  group.visible = local > 0;
  group.scale.set(1, Math.max(.035, eased), 1);
}

export function WildsStewardEnvironment({ activeWorkSource, placementPreview, livingWorld, player, terrainElevation, kaiUPulse, onInteractSource, companionWorkFamilies = [], companionReady = true, pending = false, siteRuntime, siteSpaceId }: {
  activeWorkSource?: WildsActiveWorkSource | null;
  placementPreview?: WildsStewardPlacement | null;
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
  const constructionSites = useMemo(() => Object.values(livingWorld?.constructionSites ?? {})
    .filter((site) => site.stage !== "complete" && Math.hypot(site.position.x - player.x, site.position.z - player.z) <= 110)
    .sort((left, right) => left.siteId.localeCompare(right.siteId)), [livingWorld?.constructionSites, player.x, player.z]);
  const geometry = useMemo(createGeometry, []);
  const materials = useMemo(createMaterials, []);
  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
    Object.values(materials).forEach((item) => item.dispose());
  }, [geometry, materials]);
  return <group name="wilds-steward-world">
    {placementPreview && siteSpaceId === "wildz.space.outer.v1" ? <StewardPlacementGhost geometry={geometry} materials={materials} player={player} preview={placementPreview} terrainElevation={terrainElevation} /> : null}
    {sources.map(({ source, availableCapacity }) => <ResourceManifestation activeWorkSource={activeWorkSource} availableCapacity={availableCapacity} companionQualified={companionWorkFamilies.includes(source.requirements.creature)} companionReady={companionReady} geometry={geometry} key={source.sourceId} materials={materials} onInteract={onInteractSource} pending={pending && activeWorkSource?.sourceId === source.sourceId} player={player} siteRuntime={siteRuntime} siteSpaceId={siteSpaceId} source={source} terrainElevation={terrainElevation} />)}
    {constructionSites.map((site) => <PartialConstructionSite geometry={geometry} key={site.siteId} materials={materials} player={player} site={site} terrainElevation={terrainElevation} />)}
    {structures.map((structure) => structure.blueprint === "trail-bridge"
      ? <TrailBridge geometry={geometry} key={structure.structureId} materials={materials} player={player} structure={structure} terrainElevation={terrainElevation} />
      : structure.blueprint === "steward-workbench"
        ? <StewardWorkbench geometry={geometry} key={structure.structureId} materials={materials} player={player} structure={structure} terrainElevation={terrainElevation} />
        : structure.blueprint === "trail-cache"
          ? <TrailCache geometry={geometry} key={structure.structureId} materials={materials} player={player} structure={structure} terrainElevation={terrainElevation} />
          : <TrailShelter geometry={geometry} key={structure.structureId} materials={materials} player={player} structure={structure} terrainElevation={terrainElevation} />)}
  </group>;
}

function PartialConstructionSite({ geometry, materials, player, site, terrainElevation }: {
  geometry: Geometry;
  materials: Materials;
  player: Readonly<{ x: number; z: number }>;
  site: WildsConstructionSiteV1;
  terrainElevation: number;
}) {
  const position = projectWildsTerrainActorPosition(site.position, player, .03, { actorElevation: site.position.y, anchorElevation: terrainElevation });
  const rotation = site.rotationQuarterTurns * Math.PI / 2;
  const material = site.stage === "materials-ready" ? materials.siteReady : materials.sitePlaced;
  const scaleZ = site.blueprint === "trail-bridge" ? 1.45 : .9;
  return <group name={`construction-site-${site.siteId}`} position={position} rotation={[0, rotation, 0]} userData={{ interactable: "construction-site", siteId: site.siteId, stage: site.stage }}>
    <Shared geometry={geometry.siteMarker} material={material} position={[0, .05, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, scaleZ, 1]} />
    {[[-2.15, .62, -1.7], [2.15, .62, -1.7], [-2.15, .62, 1.7], [2.15, .62, 1.7]].map((point, index) => <Shared castShadow geometry={geometry.post} key={index} material={material} position={point as [number, number, number]} scale={[.62, .48, .62]} />)}
    {site.contributedLots.map((entry, index) => <Shared geometry={entry.kind === "timber" ? geometry.workChip : geometry.capacityPip} key={entry.lotId}
      material={entry.kind === "timber" ? materials.timberChip : materials.stoneChip} position={[-.75 + index % 3 * .75, .18 + Math.floor(index / 3) * .16, 0]} scale={[1.7, 1.7, 1.7]} />)}
  </group>;
}

function StewardPlacementGhost({ geometry, materials, player, preview, terrainElevation }: {
  geometry: Geometry;
  materials: Materials;
  player: Readonly<{ x: number; z: number }>;
  preview: WildsStewardPlacement;
  terrainElevation: number;
}) {
  const terrain = sampleWildsTerrain(preview.point.x, preview.point.z);
  const position = projectWildsTerrainActorPosition(
    { x: preview.point.x, z: preview.point.z },
    player,
    .04,
    { actorElevation: terrain.elevation, anchorElevation: terrainElevation }
  );
  const material = preview.valid ? materials.ghostValid : materials.ghostInvalid;
  const rotation = preview.rotationQuarterTurns * Math.PI / 2;
  return <group name={`steward-placement-ghost-${preview.blueprintId}`} position={position} rotation={[0, rotation, 0]} userData={{ previewOnly: true, valid: preview.valid }}>
    <Shared geometry={geometry.ghostMarker} material={material} position={[0, .04, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    {preview.blueprintId === "trail-bridge" ? <>
      <Shared geometry={geometry.bridgeDeck} material={material} position={[0, .28, 0]} />
      {[-1.42, 1.42].map((x) => <Shared geometry={geometry.bridgeRail} key={x} material={material} position={[x, 1.05, 0]} />)}
    </> : preview.blueprintId === "steward-workbench" ? <>
      <Shared geometry={geometry.benchTop} material={material} position={[0, 1.35, 0]} />
      {[[-1.25, .65, -.48], [1.25, .65, -.48], [-1.25, .65, .48], [1.25, .65, .48]].map((point, index) => <Shared geometry={geometry.benchLeg} key={index} material={material} position={point as [number, number, number]} />)}
    </> : preview.blueprintId === "trail-cache" ? <>
      <Shared geometry={geometry.cacheBody} material={material} position={[0, .68, 0]} />
      <Shared geometry={geometry.cacheLid} material={material} position={[0, 1.43, 0]} />
    </> : <>
      <Shared geometry={geometry.foundation} material={material} position={[0, .24, 0]} />
      {[[-2.45, 1.55, -1.95], [2.45, 1.55, -1.95], [-2.45, 1.55, 1.95], [2.45, 1.55, 1.95]].map((point, index) => <Shared geometry={geometry.post} key={index} material={material} position={point as [number, number, number]} />)}
      <Shared geometry={geometry.roof} material={material} position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, .82]} />
    </>}
  </group>;
}

function StewardWorkbench({ geometry, materials, player, structure, terrainElevation }: {
  geometry: Geometry; materials: Materials; player: Readonly<{ x: number; z: number }>;
  structure: Extract<WildsStructureV1, { blueprint: "steward-workbench" }>; terrainElevation: number;
}) {
  const position = projectWildsTerrainActorPosition(structure.position, player, 0, { actorElevation: structure.position.y, anchorElevation: terrainElevation });
  const rotation = structure.rotationQuarterTurns * Math.PI / 2;
  return <group name={`steward-workbench-${structure.structureId}`} position={position} rotation={[0, rotation, 0]} userData={{ interactable: "workbench", structureId: structure.structureId }}>
    <Shared castShadow receiveShadow geometry={geometry.benchTop} material={materials.workshopWood} position={[0, 1.35, 0]} />
    {[[-1.25, .65, -.48], [1.25, .65, -.48], [-1.25, .65, .48], [1.25, .65, .48]].map((point, index) => <Shared castShadow geometry={geometry.benchLeg} key={index} material={materials.workshopWood} position={point as [number, number, number]} />)}
    <Shared geometry={geometry.toolRack} material={materials.workshopMetal} position={[0, 1.62, 0]} />
  </group>;
}

function TrailCache({ geometry, materials, player, structure, terrainElevation }: {
  geometry: Geometry; materials: Materials; player: Readonly<{ x: number; z: number }>;
  structure: Extract<WildsStructureV1, { blueprint: "trail-cache" }>; terrainElevation: number;
}) {
  const position = projectWildsTerrainActorPosition(structure.position, player, 0, { actorElevation: structure.position.y, anchorElevation: terrainElevation });
  const rotation = structure.rotationQuarterTurns * Math.PI / 2;
  return <group name={`trail-cache-${structure.structureId}`} position={position} rotation={[0, rotation, 0]} userData={{ interactable: "trail-cache", structureId: structure.structureId }}>
    <Shared castShadow receiveShadow geometry={geometry.cacheBody} material={materials.cacheWood} position={[0, .68, 0]} />
    <Shared castShadow geometry={geometry.cacheLid} material={materials.workshopWood} position={[0, 1.43, 0]} />
    {[-.85, .85].map((x) => <Shared geometry={geometry.cacheBand} key={x} material={materials.workshopMetal} position={[x, .7, 0]} />)}
  </group>;
}

function ResourceManifestation({ activeWorkSource, geometry, materials, onInteract, player, source, terrainElevation, availableCapacity, companionQualified, companionReady, pending, siteRuntime, siteSpaceId }: {
  activeWorkSource?: WildsActiveWorkSource | null;
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
  const readability = useWildsReadability();
  const impact = useRef<THREE.Group>(null);
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
  useFrame(() => {
    if (!impact.current) return;
    const elapsedMs = activeWorkSource?.sourceId === source.sourceId ? performance.now() - activeWorkSource.startedAtMs : 0;
    const work = projectWildsWorkPresentation({
      sourceId: source.sourceId,
      activeSourceId: activeWorkSource?.sourceId ?? null,
      commandPending: Boolean(activeWorkSource && activeWorkSource.settledAtMs === null),
      commandSettled: Boolean(activeWorkSource?.settledAtMs !== null && activeWorkSource?.settledAtMs !== undefined),
      elapsedMs,
      reducedMotion: readability.motionScale === 0
    });
    impact.current.visible = work.impact > .02;
    impact.current.rotation.y = elapsedMs * .006;
    impact.current.scale.setScalar(.35 + work.impact * .9);
  });
  return <group name={`steward-source-${source.sourceId}`} onClick={(event) => { event.stopPropagation(); if (!pending) onInteract?.(source); }} position={position} userData={{ affordance: affordance.state, availableCapacity, capacity: source.capacity }}>
    <Shared geometry={timber ? geometry.timberRing : geometry.stoneRing} material={material} position={[0, .055, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[.82 + ratio * .18, .82 + ratio * .18, 1]} />
    {Array.from({ length: pips }, (_, index) => {
      const angle = index / 4 * Math.PI * 2;
      return <Shared geometry={geometry.capacityPip} key={index} material={material} position={[Math.cos(angle) * .78, .08, Math.sin(angle) * .78]} />;
    })}
    <group name="work-impact-fragments" position={[0, timber ? .78 : .34, 0]} ref={impact} visible={false}>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = index / 6 * Math.PI * 2;
        return <Shared geometry={geometry.workChip} key={index} material={timber ? materials.timberChip : materials.stoneChip} position={[Math.cos(angle) * (.2 + index * .035), .06 + (index % 3) * .08, Math.sin(angle) * (.2 + index * .035)]} rotation={[angle, angle * .5, 0]} />;
      })}
    </group>
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
  const foundation = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const finish = useRef<THREE.Group>(null);
  const progress = useRef(0);
  useFrame((_, delta) => {
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + Math.min(delta, .05) * .9);
    writeConstructionStage(foundation.current, progress.current, 0, .28);
    writeConstructionStage(frame.current, progress.current, .2, .72);
    writeConstructionStage(finish.current, progress.current, .62, 1);
  });
  const position = projectWildsTerrainActorPosition(structure.position, player, 0, { actorElevation: structure.position.y, anchorElevation: terrainElevation });
  const rotation = structure.rotationQuarterTurns * Math.PI / 2;
  return <group name={`trail-shelter-${structure.structureId}`} position={position} rotation={[0, rotation, 0]}>
    <group name="construction-stage-foundation" ref={foundation} scale={[1, .035, 1]}>
      <Shared castShadow receiveShadow geometry={geometry.foundation} material={materials.foundation} position={[0, .2, 0]} />
    </group>
    <group name="construction-stage-frame" ref={frame} scale={[1, .035, 1]} visible={false}>
      {[[-2.45, 1.55, -1.95], [2.45, 1.55, -1.95], [-2.45, 1.55, 1.95], [2.45, 1.55, 1.95]].map((point, index) => <Shared castShadow geometry={geometry.post} key={index} material={materials.wood} position={point as [number, number, number]} />)}
      <Shared castShadow geometry={geometry.beam} material={materials.wood} position={[0, 2.65, -1.95]} />
      <Shared castShadow geometry={geometry.beam} material={materials.wood} position={[0, 2.65, 1.95]} />
    </group>
    <group name="construction-stage-finish" ref={finish} scale={[1, .035, 1]} visible={false}>
      <Shared castShadow geometry={geometry.roof} material={materials.roof} position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, .82]} />
    </group>
  </group>;
}

function TrailBridge({ geometry, materials, player, structure, terrainElevation }: {
  geometry: Geometry;
  materials: Materials;
  player: Readonly<{ x: number; z: number }>;
  structure: Extract<WildsStructureV1, { blueprint: "trail-bridge" }>;
  terrainElevation: number;
}) {
  const foundation = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const finish = useRef<THREE.Group>(null);
  const progress = useRef(0);
  useFrame((_, delta) => {
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + Math.min(delta, .05) * 1.1);
    writeConstructionStage(foundation.current, progress.current, 0, .25);
    writeConstructionStage(frame.current, progress.current, .18, .76);
    writeConstructionStage(finish.current, progress.current, .62, 1);
  });
  const position = projectWildsTerrainActorPosition(structure.position, player, 0, {
    actorElevation: structure.physical.deckY,
    anchorElevation: terrainElevation
  });
  const rotation = structure.rotationQuarterTurns * Math.PI / 2;
  const plankSlots = [-3.55, -2.85, -2.15, -1.45, -.75, -.05, .65, 1.35, 2.05, 2.75, 3.45];
  return <group name={`trail-bridge-${structure.structureId}`} position={position} rotation={[0, rotation, 0]}>
    <group name="construction-stage-foundation" ref={foundation} scale={[1, .035, 1]}>
      {[-1.12, 1.12].flatMap((x) => [-3.65, 3.65].map((z) => <Shared castShadow geometry={geometry.bridgeFooting} key={`footing-${x}-${z}`} material={materials.foundation} position={[x, -.62, z]} />))}
    </group>
    <group name="construction-stage-frame" ref={frame} scale={[1, .035, 1]} visible={false}>
      <Shared castShadow receiveShadow geometry={geometry.bridgeDeck} material={materials.bridgeEdge} position={[0, -.13, 0]} />
      {plankSlots.map((z, index) => <Shared castShadow receiveShadow geometry={geometry.bridgePlank} key={index} material={materials.bridgeWood} position={[0, .035, z]} />)}
    </group>
    <group name="construction-stage-finish" ref={finish} scale={[1, .035, 1]} visible={false}>
      {[-1.42, 1.42].map((x) => <Shared castShadow geometry={geometry.bridgeRail} key={`rail-${x}`} material={materials.bridgeEdge} position={[x, .72, 0]} />)}
      {[-1.42, 1.42].flatMap((x) => [-3.7, -1.25, 1.25, 3.7].map((z) => <Shared castShadow geometry={geometry.bridgePost} key={`post-${x}-${z}`} material={materials.bridgeEdge} position={[x, .48, z]} />))}
    </group>
  </group>;
}
