"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayState } from "@/features/play/game-state";
import { projectWildsBiome } from "@/features/play/wilds-biome";
import type { WildsQualityProfile } from "@/features/play/wilds-quality-profile";
import { WILDS_TILE_SIZE } from "@/features/play/WildsEnvironment";

export function WildsAtmosphere({
  encounter,
  missionProgress,
  player,
  qualityProfile
}: {
  encounter: PlayState["encounter"];
  missionProgress: number;
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
}) {
  const tileX = Math.floor(player.x / WILDS_TILE_SIZE);
  const tileZ = Math.floor(player.z / WILDS_TILE_SIZE);
  const biome = useMemo(() => projectWildsBiome(tileX, tileZ, missionProgress), [missionProgress, tileX, tileZ]);
  const hot = encounter.phase === "hint" && encounter.proximity === "hot";
  return (
    <group name={`verdant-atmosphere-${biome.weather}`}>
      <hemisphereLight color="#c9f2ff" groundColor="#2d5a39" intensity={0.92 * biome.luminosity} />
      <directionalLight
        castShadow
        color="#fff1c4"
        intensity={1.5 * biome.luminosity}
        position={[4.5, 8.5, 4.2]}
        shadow-camera-bottom={-8}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-mapSize-height={qualityProfile.shadowMapSize}
        shadow-mapSize-width={qualityProfile.shadowMapSize}
      />
      <directionalLight color="#8ff0d0" intensity={0.46} position={[-4, 3.6, -5]} />
      <SunShafts strength={biome.weather === "sun-shower" ? 1 : 0.68} />
      <CanopyShadows />
      <PollenDrift count={Math.max(10, Math.round(34 * qualityProfile.particles))} weather={biome.weather} />
      {hot ? <FoliageSurge /> : null}
    </group>
  );
}

function SunShafts({ strength }: { strength: number }) {
  return (
    <group name="sun-shafts" position={[0, 2.8, -1.2]} rotation={[0, 0, -0.22]}>
      {[-1.8, -0.5, 0.9].map((x, index) => (
        <mesh key={x} position={[x, 0, index * -0.7]} rotation={[0, index * 0.12, 0]}>
          <planeGeometry args={[0.7 + index * 0.16, 7.5]} />
          <meshBasicMaterial
            blending={THREE.AdditiveBlending}
            color="#fff4bf"
            depthWrite={false}
            opacity={(0.035 + index * 0.012) * strength}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function CanopyShadows() {
  return (
    <group name="canopy-shadows" position={[0, 0.006, 0]}>
      {([[-3.1, -1.8, 1.5], [2.4, -2.7, 1.15], [3.4, 2.2, 1.75], [-2.2, 3.1, 1.22]] as const).map(([x, z, scale], index) => (
        <mesh key={index} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, index * 0.6]} scale={[scale, scale * 0.62, 1]}>
          <circleGeometry args={[1, 10]} />
          <meshBasicMaterial color="#174a32" depthWrite={false} opacity={0.09} transparent />
        </mesh>
      ))}
    </group>
  );
}

function PollenDrift({ count, weather }: { count: number; weather: string }) {
  const group = useRef<THREE.Group>(null);
  const motes = useMemo(() => Array.from({ length: count }, (_, index) => ({
    x: Math.sin(index * 91.7) * 5.6,
    y: 0.45 + ((index * 37) % 100) / 100 * 3.4,
    z: Math.cos(index * 47.3) * 5.6,
    scale: 0.018 + (index % 5) * 0.006
  })), [count]);
  useFrame(() => {
    if (!group.current) return;
    const elapsed = performance.now() / 1_000;
    group.current.rotation.y = elapsed * (weather === "pollen-drift" ? 0.035 : 0.018);
    group.current.position.y = Math.sin(elapsed * 0.55) * 0.08;
  });
  return (
    <group name="pollen-drift" ref={group}>
      {motes.map((mote, index) => (
        <mesh key={index} position={[mote.x, mote.y, mote.z]} scale={mote.scale}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={weather === "sun-shower" ? "#d8fbff" : "#ffe88c"} transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function FoliageSurge() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = performance.now() / 1_000;
    ref.current.rotation.y = elapsed * 1.4;
    ref.current.scale.setScalar(0.9 + Math.sin(elapsed * 7) * 0.12);
  });
  return (
    <group name="foliage-surge" position={[0, 0.26, -1.8]} ref={ref}>
      {Array.from({ length: 9 }, (_, index) => {
        const angle = (index / 9) * Math.PI * 2;
        return (
          <mesh key={index} position={[Math.cos(angle) * 0.74, 0.08 + (index % 3) * 0.12, Math.sin(angle) * 0.74]} rotation={[angle * 0.3, angle, angle * 0.5]} scale={[0.08, 0.18, 0.035]}>
            <sphereGeometry args={[1, 7, 5]} />
            <meshStandardMaterial color={index % 2 ? "#74c55c" : "#3f9551"} emissive="#8eea6a" emissiveIntensity={0.08} roughness={0.78} />
          </mesh>
        );
      })}
    </group>
  );
}
