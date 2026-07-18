"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { WildsCreatureActor } from "../../play/WildsCreatureActor";
import type { PortableCardAsset } from "../../play/portable-card";
import type { WildsQualityProfile } from "../../play/wilds-quality-profile";
import type { ArenaCampaignOpponent } from "./campaign";
import type { MortalArenaState } from "./types";
import { mortalArenaCameraDistance, mortalArenaRivalCreature } from "./presentation";

declare global {
  interface Window {
    __MORTAL_ARENA_DIAGNOSTICS__?: Record<string, unknown>;
  }
}

export function MortalArenaScene({ state, roster, opponent, qualityProfile, impactTick }: {
  state: MortalArenaState;
  roster: readonly PortableCardAsset[];
  opponent: ArenaCampaignOpponent;
  qualityProfile: WildsQualityProfile;
  impactTick: number;
}) {
  return (
    <div className="mortal-arena-canvas" aria-label="Live three-dimensional Mortal Arena">
      <Canvas
        camera={{ fov: 43, near: .1, far: 70, position: [0, 8.2, 12.8] }}
        dpr={qualityProfile.dpr}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl, size }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          window.__MORTAL_ARENA_DIAGNOSTICS__ = {
            canvas: { cssWidth: size.width, cssHeight: size.height, dpr: qualityProfile.dpr },
            rules: "mortal-arena@1.0.0",
            quality: qualityProfile.tier
          };
        }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        <ArenaWorld state={state} roster={roster} opponent={opponent} impactTick={impactTick} particleScale={qualityProfile.particles} />
      </Canvas>
    </div>
  );
}

function ArenaWorld({ state, roster, opponent, impactTick, particleScale }: {
  state: MortalArenaState;
  roster: readonly PortableCardAsset[];
  opponent: ArenaCampaignOpponent;
  impactTick: number;
  particleScale: number;
}) {
  const player = state.sides[0].fighters[state.sides[0].activeIndex]!;
  const rival = state.sides[1].fighters[state.sides[1].activeIndex]!;
  const activeCard = roster[state.sides[0].activeIndex] ?? roster[0]!;
  return (
    <>
      <color attach="background" args={["#160b05"]} />
      <fog attach="fog" args={["#160b05", 14, 35]} />
      <ambientLight intensity={.72} color="#ffdca0" />
      <hemisphereLight args={["#8fc8ff", "#2a1008", 1.15]} />
      <directionalLight castShadow color="#fff0c2" intensity={2.2} position={[5, 11, 6]} shadow-mapSize={[512, 512]} />
      <pointLight color="#ff742f" intensity={18} distance={22} position={[0, 3, -8]} />
      <pointLight color="#69dfff" intensity={12} distance={11} position={[-5, 2.5, 3]} />
      <pointLight color="#ffcf62" intensity={14} distance={11} position={[5, 2.5, 3]} />
      <ArenaCamera state={state} impactTick={impactTick} />
      <ArenaArchitecture boss={opponent.kind === "boss"} particleScale={particleScale} />
      <ArenaFighter card={activeCard} fighter={player} side="player" />
      <ArenaFighter card={activeCard} fighter={rival} opponent={opponent} side="rival" />
      <ArenaImpactVfx impactTick={impactTick} state={state} />
      <Sparkles count={Math.round(38 * particleScale)} color={opponent.kind === "boss" ? "#ff7045" : "#ffd970"} scale={[18, 4, 18]} size={2.4} speed={.35} />
      <ArenaDiagnostics state={state} />
    </>
  );
}

function ArenaCamera({ state, impactTick }: { state: MortalArenaState; impactTick: number }) {
  const { camera, size } = useThree();
  const shakeRef = useRef(0);
  useEffect(() => { shakeRef.current = impactTick > 0 ? .16 : 0; }, [impactTick]);
  useFrame((_, delta) => {
    const left = state.sides[0].fighters[state.sides[0].activeIndex]!;
    const right = state.sides[1].fighters[state.sides[1].activeIndex]!;
    const centerX = (left.position.x + right.position.x) / 2_000;
    const centerZ = (left.position.z + right.position.z) / 2_000;
    const separationX = Math.abs(left.position.x - right.position.x) / 1_000;
    const separationZ = Math.abs(left.position.z - right.position.z) / 1_000;
    const distance = mortalArenaCameraDistance({
      separationX,
      separationZ,
      aspect: size.width / Math.max(1, size.height),
      verticalFovDegrees: camera instanceof THREE.PerspectiveCamera ? camera.fov : 43
    });
    const desired = new THREE.Vector3(centerX, 6.4 + distance * .13, centerZ + distance);
    if (shakeRef.current > .003) {
      desired.x += Math.sin(impactTick * 2.17) * shakeRef.current;
      desired.y += Math.cos(impactTick * 1.31) * shakeRef.current * .45;
      shakeRef.current *= Math.pow(.045, delta);
    }
    camera.position.lerp(desired, 1 - Math.pow(.0008, delta));
    camera.lookAt(centerX, .72, centerZ);
  });
  return null;
}

function ArenaFighter({ card, fighter, opponent, side }: {
  card: PortableCardAsset;
  fighter: MortalArenaState["sides"][number]["fighters"][number];
  opponent?: ArenaCampaignOpponent;
  side: "player" | "rival";
}) {
  const group = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    target.set(fighter.position.x / 1_000, fighter.position.y / 1_000 + .46, fighter.position.z / 1_000);
    group.current?.position.lerp(target, 1 - Math.pow(.00005, delta));
    if (group.current) group.current.rotation.y = fighter.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  const primary = side === "player" ? card.manifest.variant.traits.palette.primary : opponent?.kind === "boss" ? "#ad2f28" : "#e29a2f";
  const accent = side === "player" ? card.manifest.variant.traits.palette.accent : opponent?.kind === "boss" ? "#ffcc58" : "#fff0a0";
  const rivalCreature = opponent ? mortalArenaRivalCreature(opponent.affinity) : null;
  const familyId = rivalCreature?.familyId ?? card.manifest.familyId;
  const formId = rivalCreature?.formId ?? card.manifest.formId;
  const pose = fighter.vitality <= fighter.maxVitality * .15 ? "weakened" : fighter.guarding ? "curious" : fighter.recoveryTicks > 10 ? "attack" : "idle";
  return (
    <group ref={group} name={`mortal-arena-${side}`} scale={opponent?.kind === "boss" ? 1.28 : 1}>
      <WildsCreatureActor accent={accent} familyId={familyId} formId={formId} identityToken={opponent?.id ?? card.id} pose={pose} primary={primary} />
      <mesh position={[0, -.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[.5, .035, 8, 40]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={fighter.guarding ? 2.2 : .65} transparent opacity={.9} />
      </mesh>
      {fighter.focus > 0 ? <mesh position={[0, .65, 0]}><sphereGeometry args={[.72, 18, 12]} /><meshBasicMaterial color="#fff1a3" transparent opacity={Math.min(.22, fighter.focus / 4_000)} wireframe /></mesh> : null}
    </group>
  );
}

function ArenaImpactVfx({ impactTick, state }: { impactTick: number; state: MortalArenaState }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const flash = useRef<THREE.MeshBasicMaterial>(null);
  const elapsed = useRef(0);
  useEffect(() => { elapsed.current = 0; }, [impactTick]);
  useFrame((_, delta) => {
    if (!group.current || impactTick <= 0) return;
    elapsed.current += delta;
    const progress = Math.min(1, elapsed.current / .32);
    group.current.scale.setScalar(.35 + progress * 2.8);
    if (ring.current) ring.current.opacity = (1 - progress) * .75;
    if (flash.current) flash.current.opacity = (1 - progress) * .42;
  });
  if (impactTick <= 0) return null;
  const player = state.sides[0].fighters[state.sides[0].activeIndex]!;
  const rival = state.sides[1].fighters[state.sides[1].activeIndex]!;
  const position: [number, number, number] = [
    (player.position.x + rival.position.x) / 2_000,
    .9,
    (player.position.z + rival.position.z) / 2_000
  ];
  return <group ref={group} position={position}>
    <mesh rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[.48, .045, 8, 32]} /><meshBasicMaterial ref={ring} color="#fff0a3" transparent depthWrite={false} /></mesh>
    <mesh><sphereGeometry args={[.24, 10, 8]} /><meshBasicMaterial ref={flash} color="#ff7a45" transparent depthWrite={false} /></mesh>
  </group>;
}

function ArenaArchitecture({ boss, particleScale }: { boss: boolean; particleScale: number }) {
  const crowd = useMemo(() => Array.from({ length: Math.max(20, Math.round(48 * particleScale)) }, (_, index) => {
    const angle = index / Math.max(1, Math.round(48 * particleScale)) * Math.PI * 2;
    return [Math.cos(angle) * 12.5, .55 + (index % 3) * .18, Math.sin(angle) * 12.5] as const;
  }), [particleScale]);
  return (
    <group name="mortal-arena-authored-stage">
      <mesh receiveShadow>
        <cylinderGeometry args={[10.6, 11.2, .48, 72, 1, false]} />
        <meshStandardMaterial color="#392414" roughness={.72} metalness={.08} />
      </mesh>
      <mesh receiveShadow position={[0, -.36, 0]}>
        <cylinderGeometry args={[11.5, 12.8, .28, 48]} />
        <meshStandardMaterial color="#160d09" metalness={.22} roughness={.82} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return <mesh key={`spoke:${index}`} position={[Math.cos(angle) * 5.7, .255, Math.sin(angle) * 5.7]} rotation={[0, -angle, 0]}>
          <boxGeometry args={[.075, .025, 10.2]} />
          <meshStandardMaterial color={index % 3 === 0 ? "#f2be4d" : "#70421f"} emissive={index % 3 === 0 ? "#8e4316" : "#1b0904"} emissiveIntensity={.5} />
        </mesh>;
      })}
      {[0, 1, 2].map((ring) => <mesh key={ring} position={[0, .27, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.5 + ring * 2.7, .035 + ring * .01, 8, 72]} /><meshStandardMaterial color={ring === 2 && boss ? "#ff5b36" : "#e8ba45"} emissive={ring === 2 && boss ? "#ff3c21" : "#9a5a12"} emissiveIntensity={boss ? 1.8 : .75} /></mesh>)}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <group key={angle} position={[Math.cos(angle) * 10.8, 0, Math.sin(angle) * 10.8]} rotation={[0, -angle, 0]}><mesh castShadow position={[-.72, 1.7, 0]} rotation={[0, 0, -.18]}><boxGeometry args={[.65, 3.6, .8]} /><meshStandardMaterial color="#51321b" roughness={.68} /></mesh><mesh castShadow position={[.72, 1.7, 0]} rotation={[0, 0, .18]}><boxGeometry args={[.65, 3.6, .8]} /><meshStandardMaterial color="#51321b" roughness={.68} /></mesh><mesh position={[0, 3.22, 0]}><boxGeometry args={[1.9, .42, .7]} /><meshStandardMaterial color="#d99f31" emissive="#7a3c10" emissiveIntensity={.5} /></mesh></group>)}
      {crowd.map((position, index) => <mesh key={index} position={position}><sphereGeometry args={[.12, 6, 5]} /><meshBasicMaterial color={index % 5 === 0 ? "#ffd66a" : "#6c4020"} /></mesh>)}
    </group>
  );
}

function ArenaDiagnostics({ state }: { state: MortalArenaState }) {
  const { gl } = useThree();
  useFrame(() => {
    if (!window.__MORTAL_ARENA_DIAGNOSTICS__) return;
    window.__MORTAL_ARENA_DIAGNOSTICS__ = {
      ...window.__MORTAL_ARENA_DIAGNOSTICS__,
      tick: state.tick,
      phase: state.phase,
      fighters: state.sides.reduce((sum, side) => sum + side.fighters.length, 0),
      renderer: { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures }
    };
  });
  return null;
}
