"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayState } from "./game-state";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import {
  projectWildsAmbientLifeNeighborhood,
  WILDS_AMBIENT_REGION_SIZE,
  type WildsAmbientLifeProjection
} from "./wilds-ambient-life";
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import { createWildsAmbientBirdGeometry, createWildsAmbientBirdMaterial, writeWildsAmbientBirdPath, type WildsAmbientBirdFlightFrame } from './wilds-ambient-birds';

type AmbientMember = Readonly<{ life: WildsAmbientLifeProjection; member: number }>;
type AmbientRuntime = {
  matrix: THREE.Matrix4;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  flight: WildsAmbientBirdFlightFrame;
};

const EMPTY_MEMBERS = Object.freeze([]) as readonly AmbientMember[];

function membersFor(projections: readonly WildsAmbientLifeProjection[], medium: WildsAmbientLifeProjection["medium"]) {
  const members: AmbientMember[] = [];
  for (const life of projections) {
    if (life.medium !== medium) continue;
    for (let member = 0; member < life.members; member += 1) members.push(Object.freeze({ life, member }));
  }
  return members.length === 0 ? EMPTY_MEMBERS : Object.freeze(members);
}

function writeAmbientInstances(
  mesh: THREE.InstancedMesh | null,
  members: readonly AmbientMember[],
  timeSeconds: number,
  playerX: number,
  playerZ: number,
  terrainElevation: number,
  siteRuntime: WildsSiteRuntimeProjection,
  runtime: AmbientRuntime
) {
  if (!mesh) return;
  for (let index = 0; index < members.length; index += 1) {
    const entry = members[index]!;
    const path = entry.life.path;
    const progress = (entry.life.phase + entry.member * .137 + timeSeconds * entry.life.speed) % 1;
    const scaled = progress * path.length;
    const pointIndex = Math.floor(scaled) % path.length;
    const nextIndex = (pointIndex + 1) % path.length;
    const amount = scaled - Math.floor(scaled);
    const point = path[pointIndex]!;
    const next = path[nextIndex]!;
    const separation = (entry.member - (entry.life.members - 1) / 2) * .13;
    const flight=entry.life.medium==='aerial'?writeWildsAmbientBirdPath(runtime.flight,path,progress):null;
    const directionX = flight?.directionX ?? next.x - point.x;
    const directionZ = flight?.directionZ ?? next.z - point.z;
    const worldX = (flight?.x ?? point.x + directionX * amount) - directionZ * separation;
    const worldZ = (flight?.z ?? point.z + directionZ * amount) + directionX * separation;
    const rawWorldY = (flight?.y ?? point.y + (next.y - point.y) * amount) + (entry.life.medium === "aerial" ? separation * .24 : separation * .08);
    const worldY = entry.life.medium === "aerial"
      ? Math.max(rawWorldY, wildsSiteRuntimeGroundY(siteRuntime, "wildz.space.outer.v1", worldX, worldZ, rawWorldY) + .65)
      : rawWorldY;
    runtime.position.set(
      worldX - playerX,
      worldY - terrainElevation,
      worldZ - playerZ
    );
    runtime.rotation.set(
      entry.life.medium === "aquatic" ? Math.sin(progress * Math.PI * 2) * .08 : flight!.pitch,
      Math.atan2(directionX, directionZ),
      entry.life.medium === "aerial" ? flight!.bank : 0
    );
    runtime.quaternion.setFromEuler(runtime.rotation);
    const size = entry.life.medium === "aquatic" ? .16 + entry.life.variant * .025 : .19 + entry.life.variant * .025;
    runtime.scale.set(size, size, size);
    runtime.matrix.compose(runtime.position, runtime.quaternion, runtime.scale);
    mesh.setMatrixAt(index, runtime.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function WildsAmbientLife({
  enabled,
  player,
  qualityProfile,
  siteRuntime,
  terrainElevation
}: {
  enabled: boolean;
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  siteRuntime: WildsSiteRuntimeProjection;
  terrainElevation: number;
}) {
  const regionX = Math.floor(player.x / WILDS_AMBIENT_REGION_SIZE);
  const regionZ = Math.floor(player.z / WILDS_AMBIENT_REGION_SIZE);
  const projections = useMemo(() => enabled
    ? projectWildsAmbientLifeNeighborhood({ x: regionX * WILDS_AMBIENT_REGION_SIZE, z: regionZ * WILDS_AMBIENT_REGION_SIZE }, qualityProfile.tier)
    : Object.freeze([]) as readonly WildsAmbientLifeProjection[], [enabled, qualityProfile.tier, regionX, regionZ]);
  const aquatic = useMemo(() => membersFor(projections, "aquatic"), [projections]);
  const aerial = useMemo(() => membersFor(projections, "aerial"), [projections]);
  const birdTime=useMemo(()=>({value:0}),[]);
  const birdMaterial=useMemo(()=>createWildsAmbientBirdMaterial(birdTime),[birdTime]);
  const birdGeometry=useMemo(createWildsAmbientBirdGeometry,[]);
  useLayoutEffect(()=>{
    const flight=new Float32Array(aerial.length*2);
    aerial.forEach(({life,member},index)=>{
      flight[index*2]=life.phase*Math.PI*2+member*2.399;
      flight[index*2+1]=(2.6+life.variant*.2+member*.035)*Math.PI*2;
    });
    birdGeometry.setAttribute('birdFlight',new THREE.InstancedBufferAttribute(flight,2));
  },[aerial,birdGeometry]);
  useEffect(()=>()=>birdGeometry.dispose(),[birdGeometry]);
  useEffect(()=>()=>birdMaterial.dispose(),[birdMaterial]);
  const aquaticMesh = useRef<THREE.InstancedMesh>(null);
  const aerialMesh = useRef<THREE.InstancedMesh>(null);
  const playerRef = useRef(player);
  const terrainElevationRef = useRef(terrainElevation);
  const runtimeRef = useRef<AmbientRuntime | null>(null);
  playerRef.current = player;
  terrainElevationRef.current = terrainElevation;
  if (!runtimeRef.current) runtimeRef.current = {
    matrix: new THREE.Matrix4(),
    quaternion: new THREE.Quaternion(),
    rotation: new THREE.Euler(),
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    flight: {x:0,y:0,z:0,directionX:0,directionZ:0,pitch:0,bank:0}
  };

  useLayoutEffect(() => {
    aquaticMesh.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    aerialMesh.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [aquatic.length, aerial.length]);

  useFrame(({ clock }) => {
    const currentPlayer = playerRef.current;
    const timeSeconds = qualityProfile.reducedMotion ? 0 : clock.elapsedTime;
    birdTime.value=timeSeconds;
    const runtime = runtimeRef.current!;
    writeAmbientInstances(aquaticMesh.current, aquatic, timeSeconds, currentPlayer.x, currentPlayer.z, terrainElevationRef.current, siteRuntime, runtime);
    writeAmbientInstances(aerialMesh.current, aerial, timeSeconds, currentPlayer.x, currentPlayer.z, terrainElevationRef.current, siteRuntime, runtime);
  });

  if (!enabled) return null;
  return <group name="wilds-ambient-life">
    <instancedMesh args={[undefined, undefined, aquatic.length]} frustumCulled={false} name="ambient-aquatic-school" ref={aquaticMesh}>
      <coneGeometry args={[1, 2.4, 5]} />
      <meshStandardMaterial color="#55bfc4" roughness={.68} />
    </instancedMesh>
    <instancedMesh args={[birdGeometry, birdMaterial, aerial.length]} frustumCulled={false} name="ambient-aerial-flock" ref={aerialMesh} />
  </group>;
}
