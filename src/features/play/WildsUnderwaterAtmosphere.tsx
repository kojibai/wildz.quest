"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { WildsQualityProfile } from "./wilds-quality-profile";

const UNDERWATER_FOG_NEAR = 1.8;
const UNDERWATER_FOG_FAR = 18;

export function WildsUnderwaterAtmosphere({
  cameraSubmergedRef,
  qualityProfile,
  surfaceFog,
  surfaceFogFar,
  surfaceFogNear,
  surfaceSky
}: {
  cameraSubmergedRef: MutableRefObject<boolean>;
  qualityProfile: WildsQualityProfile;
  surfaceFog: string;
  surfaceFogFar: number;
  surfaceFogNear: number;
  surfaceSky: string;
}) {
  const { gl, scene } = useThree();
  const particles = useRef<THREE.Points>(null);
  const particleMaterial = useRef<THREE.PointsMaterial>(null);
  const fill = useRef<THREE.AmbientLight>(null);
  const mix = useRef(0);
  const surfaceFogColor = useMemo(() => new THREE.Color(surfaceFog), [surfaceFog]);
  const surfaceSkyColor = useMemo(() => new THREE.Color(surfaceSky), [surfaceSky]);
  const underwaterFogColor = useMemo(() => new THREE.Color("#0b5360"), []);
  const underwaterSkyColor = useMemo(() => new THREE.Color("#063946"), []);
  const underwaterLightColor = useMemo(() => new THREE.Color("#72d8ce"), []);
  const blendedFog = useMemo(() => new THREE.Color(), []);
  const blendedSky = useMemo(() => new THREE.Color(), []);
  const particleCount = qualityProfile.tier === "low" ? 18 : qualityProfile.tier === "medium" ? 28 : 40;
  const positions = useMemo(() => {
    const values = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const phase = index * 2.399963;
      const radius = 1.4 + (index % 7) * 0.58;
      values[index * 3] = Math.cos(phase) * radius;
      values[index * 3 + 1] = 0.25 + (index % 11) * 0.31;
      values[index * 3 + 2] = Math.sin(phase) * radius;
    }
    return values;
  }, [particleCount]);

  useEffect(() => () => {
    if (scene.background instanceof THREE.Color) scene.background.copy(surfaceSkyColor);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(surfaceFogColor);
      scene.fog.near = surfaceFogNear;
      scene.fog.far = surfaceFogFar;
    }
    gl.toneMappingExposure = 1.08;
  }, [gl, scene, surfaceFogColor, surfaceFogFar, surfaceFogNear, surfaceSkyColor]);

  useFrame(({ clock }, delta) => {
    const target = cameraSubmergedRef.current ? 1 : 0;
    mix.current = THREE.MathUtils.damp(mix.current, target, 6.5, delta);
    const amount = mix.current;
    blendedSky.copy(surfaceSkyColor).lerp(underwaterSkyColor, amount);
    blendedFog.copy(surfaceFogColor).lerp(underwaterFogColor, amount);
    if (scene.background instanceof THREE.Color) scene.background.copy(blendedSky);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(blendedFog);
      scene.fog.near = THREE.MathUtils.lerp(surfaceFogNear, UNDERWATER_FOG_NEAR, amount);
      scene.fog.far = THREE.MathUtils.lerp(surfaceFogFar, UNDERWATER_FOG_FAR, amount);
    }
    gl.toneMappingExposure = THREE.MathUtils.lerp(1.08, 0.76, amount);
    if (fill.current) {
      fill.current.color.copy(underwaterLightColor);
      fill.current.intensity = amount * 0.42;
    }
    if (particles.current) {
      particles.current.visible = amount > 0.01;
      particles.current.rotation.y = qualityProfile.reducedMotion ? 0 : clock.elapsedTime * 0.025;
      particles.current.position.y = qualityProfile.reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.22) * 0.12;
    }
    if (particleMaterial.current) particleMaterial.current.opacity = amount * 0.38;
  });

  return <group name="wilds-underwater-atmosphere">
    <ambientLight color="#72d8ce" intensity={0} ref={fill} />
    <points frustumCulled={false} ref={particles} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#b8fff3" depthWrite={false} opacity={0} ref={particleMaterial} size={0.035} transparent />
    </points>
  </group>;
}
