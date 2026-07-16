"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WILDS_BOSS_FAMILIES, type WildsBossFamilyId } from "./wilds-boss-ecology";
import type { WildsWorldBossProjection, WildsWorldProjection } from "./wilds-world-state";
import type { WildsQualityProfile } from "./wilds-quality-profile";

const FAMILY_ART: Record<WildsBossFamilyId, { shell: string; core: string; signal: string; scale: number }> = {
  "crystal-burrower": { shell: "#25313c", core: "#aef7ff", signal: "#76dfff", scale: 1.15 },
  "skycoil-tempest": { shell: "#344968", core: "#f8fbff", signal: "#8ec8ff", scale: 1.05 },
  "mirecrown-colossus": { shell: "#334a37", core: "#d9f29b", signal: "#82cf75", scale: 1.28 },
  "embermane-siegebeast": { shell: "#552f27", core: "#fff0a6", signal: "#ff7448", scale: 1.16 },
  "tidal-prism-leviathan": { shell: "#17445b", core: "#b8fff2", signal: "#45d6cc", scale: 1.2 },
  "echo-antler-warden": { shell: "#473d5b", core: "#f2d8ff", signal: "#cb91ff", scale: 1.06 },
  "lumen-moth-sovereign": { shell: "#493f68", core: "#fff8c7", signal: "#ffe780", scale: 1.02 },
  "voidroot-devourer": { shell: "#17131f", core: "#e1a8ff", signal: "#9d5cff", scale: 1.25 }
};

export function WildsBossEnvironment({ livingWorld, player, qualityProfile }: {
  livingWorld?: WildsWorldProjection | null;
  player: { x: number; z: number };
  qualityProfile: WildsQualityProfile;
}) {
  const visibleBosses = useMemo(() => Object.values(livingWorld?.bosses ?? {})
    .filter((boss) => boss.phase !== "withdrawn" && boss.phase !== "memorialized")
    .map((boss) => ({ boss, distance: bossDistance(boss, player) }))
    .filter((entry) => entry.distance <= 42)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 1), [livingWorld?.bosses, player]);
  return (
    <group name="wilds-boss-environment" userData={{ detailedBosses: visibleBosses.length, bossFamilies: WILDS_BOSS_FAMILIES.length, maxDetailedBosses: 1 }}>
      {visibleBosses.map(({ boss }) => <BossActor boss={boss} key={boss.id} player={player} qualityProfile={qualityProfile} />)}
    </group>
  );
}

function bossDistance(boss: WildsWorldBossProjection, player: { x: number; z: number }) {
  const position = boss.position as { x: number; z: number } | undefined;
  return position ? Math.hypot(position.x - player.x, position.z - player.z) : Number.POSITIVE_INFINITY;
}

function BossActor({ boss, player, qualityProfile }: { boss: WildsWorldBossProjection; player: { x: number; z: number }; qualityProfile: WildsQualityProfile }) {
  const root = useRef<THREE.Group>(null);
  const signals = useRef<THREE.InstancedMesh>(null);
  const familyId = boss.familyId as WildsBossFamilyId;
  const art = FAMILY_ART[familyId] ?? FAMILY_ART["crystal-burrower"];
  const position = boss.position as { x: number; z: number };
  const phaseScale = boss.phase === "transforming" ? 1.22 : boss.phase === "vulnerable" ? 0.94 : 1;
  const signalCount = qualityProfile.tier === "low" ? 8 : 12;

  useLayoutEffect(() => {
    if (!signals.current) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < signalCount; index += 1) {
      const angle = index / signalCount * Math.PI * 2;
      const radius = 2.25 + (index % 3) * .18;
      matrix.compose(new THREE.Vector3(Math.cos(angle) * radius, .12 + (index % 2) * .16, Math.sin(angle) * radius), quaternion.setFromEuler(new THREE.Euler(0, -angle, 0)), scale.setScalar(.7 + (index % 2) * .22));
      signals.current.setMatrixAt(index, matrix);
    }
    signals.current.instanceMatrix.needsUpdate = true;
  }, [signalCount]);

  useFrame(({ clock }) => {
    if (!root.current) return;
    const time = clock.elapsedTime;
    root.current.rotation.y = Math.sin(time * .24) * .1;
    root.current.position.y = Math.sin(time * (boss.phase === "transforming" ? 2.8 : .8)) * .06;
    if (signals.current) signals.current.rotation.y = time * (boss.phase === "vulnerable" ? .5 : .18);
  });

  return (
    <group position={[position.x - player.x, 0, position.z - player.z]} ref={root} scale={art.scale * phaseScale}>
      <mesh position={[0, .08, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.05, 2.32, 48]} />
        <meshStandardMaterial color={art.signal} emissive={art.signal} emissiveIntensity={boss.phase === "vulnerable" ? 1.2 : .45} transparent opacity={.72} />
      </mesh>
      <mesh castShadow position={[0, 1.28, 0]} scale={[1.35, 1.05, 1.05]}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={art.shell} metalness={.28} roughness={.52} />
      </mesh>
      <mesh name="bossCore" position={[0, 1.3, .86]} scale={[.48, .58, .22]}>
        <octahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={art.core} emissive={art.signal} emissiveIntensity={boss.phase === "vulnerable" ? 2.2 : .85} metalness={.1} roughness={.22} />
      </mesh>
      <FamilyAttachments art={art} familyId={familyId} phase={boss.phase} />
      <instancedMesh args={[undefined, undefined, signalCount]} ref={signals}>
        <boxGeometry args={[.18, .12, .62]} />
        <meshStandardMaterial color={art.signal} emissive={art.signal} emissiveIntensity={.72} metalness={.35} roughness={.3} />
      </instancedMesh>
    </group>
  );
}

function FamilyAttachments({ art, familyId, phase }: { art: (typeof FAMILY_ART)[WildsBossFamilyId]; familyId: WildsBossFamilyId; phase: WildsWorldBossProjection["phase"] }) {
  const sides = [-1, 1] as const;
  if (familyId === "skycoil-tempest") return <group>{[-1, 0, 1].map((lane) => <mesh key={lane} position={[lane * .72, 1.5 + Math.abs(lane) * .2, 0]} rotation={[Math.PI / 2, 0, lane * .3]}><torusGeometry args={[.82, .12, 8, 28]} /><meshStandardMaterial color={art.signal} emissive={art.signal} emissiveIntensity={.65} /></mesh>)}</group>;
  if (familyId === "mirecrown-colossus" || familyId === "voidroot-devourer") return <group>{[-2, -1, 0, 1, 2].map((root) => <mesh key={root} position={[root * .42, .48, -.2]} rotation={[0, 0, root * .12]}><cylinderGeometry args={[.08, .28, 1.8 + Math.abs(root) * .2, 7]} /><meshStandardMaterial color={familyId === "voidroot-devourer" ? "#08070b" : art.shell} roughness={.88} /></mesh>)}</group>;
  if (familyId === "echo-antler-warden") return <group>{sides.map((side) => <group key={side} position={[side * .7, 2.05, 0]} rotation={[0, 0, side * -.42]}><mesh><cylinderGeometry args={[.07, .14, 1.35, 7]} /><meshStandardMaterial color={art.core} /></mesh>{[0, 1, 2].map((branch) => <mesh key={branch} position={[side * .22, branch * .3 - .3, 0]} rotation={[0, 0, side * .8]}><cylinderGeometry args={[.035, .065, .62, 6]} /><meshStandardMaterial color={art.signal} emissive={art.signal} emissiveIntensity={.25} /></mesh>)}</group>)}</group>;
  if (familyId === "lumen-moth-sovereign" || familyId === "tidal-prism-leviathan") return <group>{sides.map((side) => <mesh key={side} position={[side * 1.12, 1.5, -.1]} rotation={[.1, side * .25, side * -.6]} scale={[1.25, familyId === "lumen-moth-sovereign" ? 1.55 : .9, .16]}><sphereGeometry args={[.82, 14, 8]} /><meshStandardMaterial color={art.core} emissive={art.signal} emissiveIntensity={.38} transparent opacity={.78} /></mesh>)}</group>;
  return <group>{sides.map((side) => <mesh castShadow key={side} position={[side * 1.08, 1.15, 0]} rotation={[0, 0, side * -.72]}><coneGeometry args={[phase === "transforming" ? .38 : .28, 1.55, familyId === "embermane-siegebeast" ? 8 : 5]} /><meshStandardMaterial color={art.signal} emissive={art.signal} emissiveIntensity={.34} roughness={.42} /></mesh>)}</group>;
}
