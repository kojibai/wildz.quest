"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { WildsQualityTier } from "./wilds-quality-profile";

export function wildsLanternYaw(direction: { x: number; z: number }) {
  const yaw = Math.atan2(-direction.x, -direction.z);
  return Object.is(yaw, -0) ? 0 : yaw;
}

export function WildsLantern({ intensity, qualityTier, visible }: {
  intensity: number;
  qualityTier: WildsQualityTier;
  visible: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => {
    const value = new THREE.Object3D();
    value.position.set(0, 0.42, -5);
    return value;
  }, []);
  useFrame(({ camera }) => {
    camera.getWorldDirection(cameraDirection);
    if (group.current) group.current.rotation.y = wildsLanternYaw(cameraDirection);
  });
  // Keep the shader light counts constant as terrain/daylight changes. Removing
  // these lights forces every lit material to link a new program while walking.
  const active = visible && intensity > 0.02;
  const lightIntensity = active ? intensity : 0;
  return (
    <group name="wilds-player-lantern" position={[0.32, 1.02, 0.18]} ref={group}>
      <primitive object={target} />
      <spotLight
        angle={0.48}
        castShadow={false}
        color="#ffd58a"
        decay={2}
        distance={8}
        intensity={lightIntensity}
        penumbra={0.72}
        position={[0, 0.16, 0]}
        target={target}
      />
      <pointLight castShadow={false} color="#ffca72" decay={2} distance={3.2} intensity={qualityTier !== "low" ? lightIntensity * 0.16 : 0} />
      <mesh name="wilds-player-lantern-core" visible={active}>
        <sphereGeometry args={[0.065, 10, 8]} />
        <meshStandardMaterial color="#fff2bf" emissive="#ffc66d" emissiveIntensity={2.1} roughness={0.32} />
      </mesh>
      <mesh scale={1.9} visible={active}>
        <sphereGeometry args={[0.065, 8, 6]} />
        <meshBasicMaterial color="#ffd58a" depthWrite={false} opacity={0.16} transparent />
      </mesh>
    </group>
  );
}
