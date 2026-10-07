"use client";

import { WILDS_CAVE_EXTERIOR } from "./wilds-cave-exterior";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useWildsRockTexture, applyWildsRockUV } from "./wilds-rock-material";
import { createWildsCaveBatch, naturalWildsCaveWalls } from "./wilds-cave-geometry";
import type { PlayState } from "./game-state";
import { projectWildsDiscoverySiteVisuals } from "./wilds-discovery-site-visuals";
import { projectWildsDiscoverySiteApproach, type WildsDiscoverySiteProjection, type WildsSiteSpaceState } from "./wilds-discovery-sites";
import { projectWildsSitePortalCue, WILDS_SITE_PORTAL_INTERACTION_RADIUS, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import { projectWildsMonuments, projectVisibleWildsMonuments, projectWildsWaterfallChute, WILDS_MONUMENT_DETAIL_RADIUS, type WildsMonumentDescriptor } from "./wilds-discovery-monuments";
import { createWildsMonumentBatches, createWildsWaterfallBatches, createWildsFlowMaterial, createWildsMonumentStoneMaterial, type WildsDiscoveryBatch, type WildsMonumentLightState } from "./wilds-monument-geometry";
import type { WildsQualityTier } from "./wilds-quality-profile";

type DiscoveryMaterials = Readonly<{ stone: THREE.MeshStandardMaterial; bronze: THREE.MeshStandardMaterial; light: THREE.MeshStandardMaterial; alignedLight: THREE.MeshStandardMaterial; water: THREE.MeshStandardMaterial }>;

export function WildsDiscoverySites({ runtime, player, space, elevation = space.position.y, onPortal, qualityTier = "medium", reducedMotion = false, lightState = null }: {
  runtime: WildsSiteRuntimeProjection;
  player: PlayState["player"];
  space: WildsSiteSpaceState;
  elevation?: number;
  onPortal: (siteKey: string, direction: "enter" | "exit") => void;
  qualityTier?: WildsQualityTier;
  reducedMotion?: boolean;
  lightState?: WildsMonumentLightState | null;
}) {
  const texture = useWildsRockTexture();
  const flowTime = useMemo(() => ({ value: 0 }), []);
  const materials = useMemo<DiscoveryMaterials>(() => ({
    stone: createWildsMonumentStoneMaterial(texture),
    bronze: new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: .6, metalness: .68, side: THREE.DoubleSide }),
    light: createMonumentLightMaterial(flowTime, .18),
    alignedLight: createMonumentLightMaterial(flowTime, .8),
    water: createWildsFlowMaterial(flowTime)
  }), [flowTime, texture]);
  useEffect(() => () => { for (const material of Object.values(materials)) material.dispose(); }, [materials]);
  // One shared uniform drives water and prism glow. No objects or geometry are rebuilt in frame work.
  useFrame(({ clock }) => { flowTime.value = reducedMotion ? 0 : clock.elapsedTime; });
  const monuments = useMemo(() => projectWildsMonuments(runtime.sites), [runtime.sites]);
  const nearbyMonuments = useMemo(() => projectVisibleWildsMonuments(monuments, player), [monuments, player]);
  const portalsBySite = useMemo(() => new Map(runtime.physical.portals.map((portal) => [portal.siteKey, portal])), [runtime]);
  const visualsBySite = useMemo(() => new Map(runtime.sites.map((site) => [site.key, projectWildsDiscoverySiteVisuals(
    site,
    runtime.physical.mountainFields.filter((field) => field.siteKey === site.key),
    runtime.physical.waterVolumes.filter((water) => water.siteKey === site.key && water.spaceId === "wildz.space.outer.v1")
  )])), [runtime]);
  const interiorGeometry = useMemo(() => ({
    walls: Object.freeze(runtime.physical.solids.filter(s=>s.spaceId===space.spaceId && s.id.startsWith("burrow-wall:"))),
    floors: Object.freeze(runtime.physical.surfaces.filter((surface) => surface.spaceId === space.spaceId && !surface.id.startsWith("wildz.support.component:"))),
    ceilings: Object.freeze(runtime.physical.ceilings.filter((ceiling) => ceiling.spaceId === space.spaceId)),
    waters: Object.freeze(runtime.physical.waterVolumes.filter((water) => water.spaceId === space.spaceId)),
    portal: runtime.physical.portals.find((candidate) => candidate.toSpaceId === space.spaceId) ?? null
  }), [runtime, space.spaceId]);
  const naturalWalls = useMemo(()=>interiorGeometry.walls.length || space.spaceId==="wildz.space.outer.v1" ? [] : naturalWildsCaveWalls(interiorGeometry.floors,interiorGeometry.ceilings),[interiorGeometry,space.spaceId]);
  const interior = space.spaceId !== "wildz.space.outer.v1";
  if (interior) {
    return <group name="wilds-discovery-interior">
      <CaveSurfaces boxes={interiorGeometry.walls.length?interiorGeometry.walls:naturalWalls} role="wall" player={player} elevation={elevation} />
      <CaveSurfaces boxes={interiorGeometry.floors} role="floor" player={player} elevation={elevation} />
      <CaveSurfaces boxes={interiorGeometry.ceilings} role="ceiling" player={player} elevation={elevation} />
      {interiorGeometry.waters.map((water) => <mesh key={water.id} name={water.id} position={[water.center.x - player.x, water.center.y + water.halfExtents.y - elevation, water.center.z - player.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[water.halfExtents.x * 2, water.halfExtents.z * 2]} />
        <meshPhysicalMaterial color="#197c9d" emissive="#0f4d67" emissiveIntensity={0} opacity={.56} roughness={.16} side={2} transparent />
      </mesh>)}
      {interiorGeometry.portal && Math.hypot(interiorGeometry.portal.position.x - space.position.x, interiorGeometry.portal.position.z - space.position.z) <= WILDS_SITE_PORTAL_INTERACTION_RADIUS ? <group position={[interiorGeometry.portal.position.x - player.x, (interiorGeometry.floors.find(floor => Math.abs(floor.center.x - interiorGeometry.portal!.position.x) <= floor.halfExtents.x && Math.abs(floor.center.z - interiorGeometry.portal!.position.z) <= floor.halfExtents.z)?.center.y ?? space.position.y) - elevation + 1, interiorGeometry.portal.position.z - player.z]}>
        <CaveEntrance interior />
        <Html center zIndexRange={[20,0]}><span className="wilds-site-portal-control"><button onClick={(event) => { event.stopPropagation(); onPortal(interiorGeometry.portal!.siteKey, "exit"); }} type="button">Return outside</button></span></Html>
        </group> : null}
      {interiorGeometry.portal ? <Html fullscreen zIndexRange={[30, 0]}>
        <div className="wilds-cave-exit-escape"><button aria-label="Leave cave and return outside" onClick={() => onPortal(interiorGeometry.portal!.siteKey, "exit")} type="button">Leave cave</button></div>
      </Html> : null}
    </group>;
  }
  return <group name="wilds-discovery-sites">
    {runtime.sites.map((site) => {
      const x = site.entrance.x - player.x;
      const z = site.entrance.z - player.z;
      const distance = Math.hypot(x, z);
      const approach = projectWildsDiscoverySiteApproach(site, distance);
      const mountainScaleClass = site.mountain?.scaleClass;
      const portal = portalsBySite.get(site.key);
      const portalDistance = portal ? Math.hypot(portal.position.x - player.x, portal.position.z - player.z) : Number.POSITIVE_INFINITY;
      const portalCue = projectWildsSitePortalCue(portalDistance);
      const dug = site.key.startsWith("wildz.burrow.site.v1:");
      const visuals = visualsBySite.get(site.key)!;
      return <group key={site.key} name={`discovery-site:${site.key}`} position={[x, site.entrance.y - elevation, z]} userData={{ lod: approach.lod, physical: approach.physical, siteKey: approach.siteKey }}>
        {site.mountain ? visuals.mountainSurfaces.map((surface) => <MountainSurface color={mountainScaleClass === "massif" ? "#5b6570" : "#687263"} distant={approach.lod === "distant"} key={surface.id} site={site} surface={surface} />) : approach.lod === "distant" ? <mesh name={`discovery-site-beacon:${site.key}`} position={[0, 2.4, 0]}>
          <ringGeometry args={[.32, .48, 20]} /><meshBasicMaterial color="#7fe8c4" opacity={.58} side={2} transparent /></mesh> : null}
        {approach.lod !== "distant" ? visuals.waterSurfaces.map((water) => <mesh key={water.id} name={water.id} position={[water.x - site.entrance.x, water.y - site.entrance.y, water.z - site.entrance.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[water.width, water.depth]} />
          <meshPhysicalMaterial color="#2395ad" emissive="#155c73" emissiveIntensity={.18} opacity={.58} roughness={.14} side={2} transparent />
        </mesh>) : null}
        {site.waterfall && approach.lod !== "distant" ? <group name={`waterfall:${site.key}`}>
          <WaterfallFlow site={site} materials={materials} qualityTier={qualityTier} />
        </group> : null}
        {portal && approach.lod !== "distant" ? <group position={[portal.position.x - site.entrance.x, portal.position.y - site.entrance.y + 1, portal.position.z - site.entrance.z]}>
          <CaveEntrance dug={dug} />
          {portalCue ? <Html center zIndexRange={[20,0]}><span className="wilds-site-portal-control">{portalCue.action === "enter" ? <button onClick={(event) => { event.stopPropagation(); onPortal(site.key, "enter"); }} type="button">Enter {site.family.replaceAll("-", " ")}</button> : <span className="wilds-cave-entrance-cue">Cave entrance</span>}</span></Html> : null}
        </group> : null}
      </group>;
    })}
    {nearbyMonuments.map(({ monument, distance }) => <DiscoveryMonument key={monument.id} monument={monument} materials={materials} player={player} elevation={elevation} qualityTier={distance <= WILDS_MONUMENT_DETAIL_RADIUS ? qualityTier : "low"} lightState={lightState?.id === monument.id ? lightState : null} />)}
  </group>;
}

function MountainSurface({ color, distant, site, surface }: {
  color: string;
  distant: boolean;
  site: WildsDiscoverySiteProjection;
  surface: ReturnType<typeof projectWildsDiscoverySiteVisuals>["mountainSurfaces"][number];
}) {
  const texture = useWildsRockTexture();
  const geometry = useMemo(() => {
    const positions = new Float32Array(surface.positions.length);
    for (let index = 0; index < surface.positions.length; index += 3) {
      positions[index] = surface.positions[index]! - site.entrance.x;
      positions[index + 1] = surface.positions[index + 1]! - site.entrance.y;
      positions[index + 2] = surface.positions[index + 2]! - site.entrance.z;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    next.setIndex(new THREE.BufferAttribute(new Uint32Array(surface.indices), 1));
    next.computeVertexNormals();
    const flat=next.toNonIndexed();
    next.dispose();
    return applyWildsRockUV(flat);
  }, [site, surface]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh castShadow={!distant} geometry={geometry} name={surface.id} receiveShadow>
    <meshStandardMaterial map={texture} color={color} roughness={.98} side={2} />
  </mesh>;
}

function WaterfallFlow({ site, materials, qualityTier }: { site: WildsDiscoverySiteProjection; materials: DiscoveryMaterials; qualityTier: WildsQualityTier }) {
  const batches = useMemo(() => createWildsWaterfallBatches(projectWildsWaterfallChute(site)!, site.entrance, qualityTier), [site, qualityTier]);
  useEffect(() => () => disposeBatches(batches), [batches]);
  return <>{batches.map(batch => <mesh key={batch.material} name={`waterfall-${batch.material}:${site.key}`} geometry={batch.geometry} material={materials[batch.material]} receiveShadow={batch.material === "stone"} />)}</>;
}

function DiscoveryMonument({ monument, materials, player, elevation, qualityTier, lightState }: { monument: WildsMonumentDescriptor; materials: DiscoveryMaterials; player: { x: number; z: number }; elevation: number; qualityTier: WildsQualityTier; lightState: WildsMonumentLightState | null }) {
  const light0 = lightState?.lights[0] ?? 0, light1 = lightState?.lights[1] ?? 0, light2 = lightState?.lights[2] ?? 0;
  const aligned = lightState?.aligned ?? false;
  const batches = useMemo(() => createWildsMonumentBatches(monument, qualityTier, { id: monument.id, lights: [light0, light1, light2], aligned }), [monument, qualityTier, light0, light1, light2, aligned]);
  useEffect(() => () => disposeBatches(batches), [batches]);
  return <group name={`discovery-monument:${monument.type}:${monument.siteKey}`} position={[monument.position.x - player.x, monument.position.y - elevation, monument.position.z - player.z]}>
    {batches.map(batch => <mesh key={batch.material} name={`${monument.id}:${batch.material}`} geometry={batch.geometry} material={batch.material === "light" && aligned ? materials.alignedLight : materials[batch.material]} receiveShadow={batch.material === "stone"} />)}
  </group>;
}

function disposeBatches(batches: readonly WildsDiscoveryBatch[]) { for (const batch of batches) batch.geometry.dispose(); }

function createMonumentLightMaterial(time: { value: number }, intensity: number) {
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, emissive: "#ffffff", emissiveIntensity: intensity, roughness: .32, metalness: .12, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.uWildsFlowTime = time;
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uWildsFlowTime;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor * (.93 + .07 * sin(uWildsFlowTime * 1.4));");
  };
  material.customProgramCacheKey = () => "wilds-prism-glow-v1";
  return material;
}

function CaveSurfaces({boxes,role,player,elevation}:{boxes:Parameters<typeof createWildsCaveBatch>[0];role:"wall"|"floor"|"ceiling";player:{x:number;z:number};elevation:number}) {
  const texture=useWildsRockTexture();
  const batch=useMemo(()=>createWildsCaveBatch(role==="floor"?boxes.map(box=>({...box,center:{...box.center,y:box.center.y-.08},halfExtents:{...box.halfExtents,y:.08}})):boxes,role),[boxes,role]);
  useEffect(()=>()=>batch.geometry.dispose(),[batch]);
  return boxes.length?<mesh name={`cave-${role}-batch`} geometry={batch.geometry} position={[batch.origin.x-player.x,batch.origin.y-elevation,batch.origin.z-player.z]} receiveShadow>
    <meshStandardMaterial map={texture} color={texture?"#c9c3b6":"#675d4e"} vertexColors roughness={role==="floor"?.92:.97} />
  </mesh>:null;
}


function CaveEntrance({ interior = false, dug = false }: { interior?: boolean; dug?: boolean }) {
  const texture = useWildsRockTexture();
  const geometry = useMemo(() => {
    const arch = new THREE.TorusGeometry(1.05, .34, 5, 12);
    const positions = arch.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const relief = 1 + Math.sin(x * 8.1 + y * 5.3 + z * 4.7) * .085;
      positions.setXYZ(i, x * relief, y * relief, z * relief);
    }
    arch.computeVertexNormals();
    const flat = arch.toNonIndexed();
    arch.dispose();
    return applyWildsRockUV(flat);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="cave-rock-threshold">
    {!interior ? <group name="cave-solid-exterior">
      {WILDS_CAVE_EXTERIOR.map((box, index) => <mesh key={index}
        position={[box.center.x, box.center.y - 1, box.center.z]}
        scale={[box.halfExtents.x * 1.25, box.halfExtents.y * 1.25, box.halfExtents.z * 1.25]}>
        <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial map={texture} color={dug ? "#735d42" : "#70685a"} roughness={1} />
      </mesh>)}
    </group> : null}
    <mesh geometry={geometry}><meshStandardMaterial map={texture} color="#70685a" roughness={.98} /></mesh>
    <mesh position={[0, 0, -.12]}><circleGeometry args={[1.01, 16]} /><meshBasicMaterial color={interior ? "#31463b" : "#020304"} side={THREE.FrontSide} /></mesh>
  </group>;
}
