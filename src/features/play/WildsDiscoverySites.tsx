"use client";

import { Html } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useWildsRockTexture, applyWildsRockUV } from "./wilds-rock-material";
import { createWildsCaveBatch, naturalWildsCaveWalls } from "./wilds-cave-geometry";
import type { PlayState } from "./game-state";
import { projectWildsDiscoverySiteVisuals } from "./wilds-discovery-site-visuals";
import { projectWildsDiscoverySiteApproach, type WildsDiscoverySiteProjection, type WildsSiteSpaceState } from "./wilds-discovery-sites";
import { projectWildsSitePortalCue, WILDS_SITE_PORTAL_INTERACTION_RADIUS, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";

export function WildsDiscoverySites({ runtime, player, space, onPortal }: {
  runtime: WildsSiteRuntimeProjection;
  player: PlayState["player"];
  space: WildsSiteSpaceState;
  onPortal: (siteKey: string, direction: "enter" | "exit") => void;
}) {
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
      <CaveSurfaces boxes={interiorGeometry.walls.length?interiorGeometry.walls:naturalWalls} role="wall" player={player} elevation={space.position.y} />
      <CaveSurfaces boxes={interiorGeometry.floors} role="floor" player={player} elevation={space.position.y} />
      <CaveSurfaces boxes={interiorGeometry.ceilings} role="ceiling" player={player} elevation={space.position.y} />
      {interiorGeometry.waters.map((water) => <mesh key={water.id} name={water.id} position={[water.center.x - player.x, water.center.y + water.halfExtents.y - space.position.y, water.center.z - player.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[water.halfExtents.x * 2, water.halfExtents.z * 2]} />
        <meshPhysicalMaterial color="#197c9d" emissive="#0f4d67" emissiveIntensity={.22} opacity={.56} roughness={.16} side={2} transparent />
      </mesh>)}
      {interiorGeometry.portal && Math.hypot(interiorGeometry.portal.position.x - space.position.x, interiorGeometry.portal.position.z - space.position.z) <= WILDS_SITE_PORTAL_INTERACTION_RADIUS ? <group position={[interiorGeometry.portal.position.x - player.x, interiorGeometry.portal.position.y - space.position.y + 1, interiorGeometry.portal.position.z - player.z]}>
        <mesh><torusGeometry args={[1.1, .14, 10, 32]} /><meshStandardMaterial color="#8edfc8" emissive="#2b806b" emissiveIntensity={.5} /></mesh>
        <Html center zIndexRange={[20,0]}><span className="wilds-site-portal-control"><button onClick={(event) => { event.stopPropagation(); onPortal(interiorGeometry.portal!.siteKey, "exit"); }} type="button">Return outside</button></span></Html>
      </group> : null}
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
      const visuals = visualsBySite.get(site.key)!;
      return <group key={site.key} name={`discovery-site:${site.key}`} position={[x, site.entrance.y - space.position.y, z]} userData={{ lod: approach.lod, physical: approach.physical, siteKey: approach.siteKey }}>
        {site.mountain ? visuals.mountainSurfaces.map((surface) => <MountainSurface color={mountainScaleClass === "massif" ? "#5b6570" : "#687263"} distant={approach.lod === "distant"} key={surface.id} site={site} surface={surface} />) : approach.lod === "distant" ? <mesh name={`discovery-site-beacon:${site.key}`} position={[0, 2.4, 0]}>
          <ringGeometry args={[.32, .48, 20]} /><meshBasicMaterial color="#7fe8c4" opacity={.58} side={2} transparent /></mesh> : null}
        {approach.lod !== "distant" ? visuals.waterSurfaces.map((water) => <mesh key={water.id} name={water.id} position={[water.x - site.entrance.x, water.y - site.entrance.y, water.z - site.entrance.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[water.width, water.depth]} />
          <meshPhysicalMaterial color="#2395ad" emissive="#155c73" emissiveIntensity={.18} opacity={.58} roughness={.14} side={2} transparent />
        </mesh>) : null}
        {site.waterfall && approach.lod !== "distant" ? <group name={`waterfall:${site.key}`}>
          <WaterfallFlow site={site} />
        </group> : null}
        {site.key.startsWith("wildz.burrow.site.v1:") && approach.lod!=="distant" ? <group name="dug-entrance" position={[0,.06,0]} rotation={[-Math.PI/2,0,0]}>
          <mesh><circleGeometry args={[1.4,32]}/><meshStandardMaterial color="#10130f" roughness={1}/></mesh>
          <mesh><ringGeometry args={[1.4,1.7,32]}/><meshStandardMaterial color="#735d42" roughness={1}/></mesh>
        </group> : null}
        {portal && portalCue ? <group position={[portal.position.x - site.entrance.x, portal.position.y - site.entrance.y + 1, portal.position.z - site.entrance.z]}>
          <mesh><torusGeometry args={[1.05, .13, 10, 30]} /><meshStandardMaterial color="#b8f4dc" emissive="#3c9d7c" emissiveIntensity={.45} /></mesh>
          <Html center zIndexRange={[20,0]}><span className="wilds-site-portal-control">{portalCue.action === "enter" ? <button onClick={(event) => { event.stopPropagation(); onPortal(site.key, "enter"); }} type="button">Enter {site.family.replaceAll("-", " ")}</button> : <span className="wilds-cave-entrance-cue">Cave entrance</span>}</span></Html>
        </group> : null}
      </group>;
    })}
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

function WaterfallFlow({ site }: { site: WildsDiscoverySiteProjection }) {
  const waterfall = site.waterfall!;
  const segments = useMemo(() => waterfall.flowPath.slice(1).map((end, index) => {
    const start = waterfall.flowPath[index]!;
    const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
    const length = direction.length();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return Object.freeze({ id: `${site.key}:waterfall-segment:${index}`, length, position: [(start.x + end.x) / 2 - site.entrance.x, (start.y + end.y) / 2 - site.entrance.y, (start.z + end.z) / 2 - site.entrance.z] as [number, number, number], quaternion: quaternion.toArray() as [number, number, number, number] });
  }), [site, waterfall]);
  return <>{segments.map((segment) => <mesh key={segment.id} name={segment.id} position={segment.position} quaternion={segment.quaternion}>
    <cylinderGeometry args={[.34, .48, segment.length, 10]} />
    <meshPhysicalMaterial color="#64d9f0" emissive="#2b8ca5" emissiveIntensity={.34} transparent opacity={.8} roughness={.18} />
  </mesh>)}</>;
}


function CaveSurfaces({boxes,role,player,elevation}:{boxes:Parameters<typeof createWildsCaveBatch>[0];role:"wall"|"floor"|"ceiling";player:{x:number;z:number};elevation:number}) {
  const texture=useWildsRockTexture();
  const batch=useMemo(()=>createWildsCaveBatch(role==="floor"?boxes.map(box=>({...box,center:{...box.center,y:box.center.y-.08},halfExtents:{...box.halfExtents,y:.08}})):boxes,role),[boxes,role]);
  useEffect(()=>()=>batch.geometry.dispose(),[batch]);
  return boxes.length?<mesh name={`cave-${role}-batch`} geometry={batch.geometry} position={[batch.origin.x-player.x,batch.origin.y-elevation,batch.origin.z-player.z]} receiveShadow>
    <meshStandardMaterial map={texture} color={texture?"#c9c3b6":"#675d4e"} vertexColors roughness={role==="floor"?.92:.97} />
  </mesh>:null;
}
