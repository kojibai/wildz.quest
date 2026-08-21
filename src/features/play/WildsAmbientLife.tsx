"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayState } from "./game-state";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import {
  projectWildsAmbientLifeNeighborhood,
  WILDS_AMBIENT_REGION_SIZE,
  type WildsAmbientLifeProjection
} from "./wilds-ambient-life";

type AmbientMember = Readonly<{ life: WildsAmbientLifeProjection; member: number }>;
type AmbientRuntime = {
  matrix: THREE.Matrix4;
  quaternion: THREE.Quaternion;
  rotation: THREE.Euler;
  position: THREE.Vector3;
  scale: THREE.Vector3;
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
    const directionX = next.x - point.x;
    const directionZ = next.z - point.z;
    runtime.position.set(
      point.x + directionX * amount - playerX - directionZ * separation,
      point.y + (next.y - point.y) * amount - terrainElevation + (entry.life.medium === "aerial" ? separation * .24 : separation * .08),
      point.z + directionZ * amount - playerZ + directionX * separation
    );
    runtime.rotation.set(
      entry.life.medium === "aquatic" ? Math.sin(progress * Math.PI * 2) * .08 : -.08,
      Math.atan2(directionX, directionZ),
      entry.life.medium === "aerial" ? Math.sin(progress * Math.PI * 4 + entry.member) * .18 : 0
    );
    runtime.quaternion.setFromEuler(runtime.rotation);
    const size = entry.life.medium === "aquatic" ? .16 + entry.life.variant * .025 : .13 + entry.life.variant * .018;
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
  terrainElevation
}: {
  enabled: boolean;
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  terrainElevation: number;
}) {
  const regionX = Math.floor(player.x / WILDS_AMBIENT_REGION_SIZE);
  const regionZ = Math.floor(player.z / WILDS_AMBIENT_REGION_SIZE);
  const projections = useMemo(() => enabled
    ? projectWildsAmbientLifeNeighborhood({ x: regionX * WILDS_AMBIENT_REGION_SIZE, z: regionZ * WILDS_AMBIENT_REGION_SIZE }, qualityProfile.tier)
    : Object.freeze([]) as readonly WildsAmbientLifeProjection[], [enabled, qualityProfile.tier, regionX, regionZ]);
  const aquatic = useMemo(() => membersFor(projections, "aquatic"), [projections]);
  const aerial = useMemo(() => membersFor(projections, "aerial"), [projections]);
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
    scale: new THREE.Vector3()
  };

  useLayoutEffect(() => {
    aquaticMesh.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    aerialMesh.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [aquatic.length, aerial.length]);

  useFrame(({ clock }) => {
    const currentPlayer = playerRef.current;
    const timeSeconds = qualityProfile.reducedMotion ? 0 : clock.elapsedTime;
    const runtime = runtimeRef.current!;
    writeAmbientInstances(aquaticMesh.current, aquatic, timeSeconds, currentPlayer.x, currentPlayer.z, terrainElevationRef.current, runtime);
    writeAmbientInstances(aerialMesh.current, aerial, timeSeconds, currentPlayer.x, currentPlayer.z, terrainElevationRef.current, runtime);
  });

  if (!enabled) return null;
  return <group name="wilds-ambient-life">
    <instancedMesh args={[undefined, undefined, aquatic.length]} frustumCulled={false} name="ambient-aquatic-school" ref={aquaticMesh}>
      <coneGeometry args={[1, 2.4, 5]} />
      <meshStandardMaterial color="#55bfc4" roughness={.68} />
    </instancedMesh>
    <instancedMesh args={[undefined, undefined, aerial.length]} frustumCulled={false} name="ambient-aerial-flock" ref={aerialMesh}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#b8c8b0" roughness={.88} />
    </instancedMesh>
  </group>;
}
