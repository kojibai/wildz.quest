"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { KaiWorldExpression } from "./kai-moment-expression";
import { projectWildsConstellation, projectWildsStarField } from "./wilds-celestial-model";
import type { WildsQualityProfile } from "./wilds-quality-profile";

const SKY_VERTEX_SHADER = `
varying vec3 vSkyDirection;
void main() {
  vSkyDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT_SHADER = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
varying vec3 vSkyDirection;
void main() {
  float heightMix = smoothstep(0.02, 0.88, clamp(vSkyDirection.y, 0.0, 1.0));
  gl_FragColor = vec4(mix(uHorizon, uZenith, heightMix), 1.0);
}
`;

function geometryFor(positions: Float32Array) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function starGeometryFor(positions: Float32Array, brightness: Float32Array) {
  const geometry = geometryFor(positions);
  const colors = new Float32Array(brightness.length * 3);
  const base = new THREE.Color("#dce8ff");
  brightness.forEach((value, index) => {
    colors[index * 3] = base.r * value;
    colors[index * 3 + 1] = base.g * value;
    colors[index * 3 + 2] = base.b * value;
  });
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function WildsCelestialSky({
  expression,
  qualityProfile
}: {
  expression: KaiWorldExpression;
  qualityProfile: WildsQualityProfile;
}) {
  const field = useMemo(() => projectWildsStarField(qualityProfile.tier), [qualityProfile.tier]);
  const constellation = useMemo(() => projectWildsConstellation(expression.dayPhase), [expression.dayPhase]);
  const starGeometry = useMemo(() => starGeometryFor(field.positions, field.brightness), [field.brightness, field.positions]);
  const constellationGeometry = useMemo(() => geometryFor(constellation.positions), [constellation.positions]);
  const skyUniforms = useMemo(() => ({
    uZenith: { value: new THREE.Color(expression.sky.zenith) },
    uHorizon: { value: new THREE.Color(expression.sky.horizon) }
  }), [expression.sky.horizon, expression.sky.zenith]);
  useEffect(() => () => starGeometry.dispose(), [starGeometry]);
  useEffect(() => () => constellationGeometry.dispose(), [constellationGeometry]);

  const celestialRotation = expression.dayProgress * Math.PI * 2;
  return (
    <group name="wilds-celestial-sky">
      <mesh frustumCulled={false} renderOrder={-1_000}>
        <sphereGeometry args={[58, 24, 12]} />
        <shaderMaterial
          depthWrite={false}
          fragmentShader={SKY_FRAGMENT_SHADER}
          side={THREE.BackSide}
          uniforms={skyUniforms}
          vertexShader={SKY_VERTEX_SHADER}
        />
      </mesh>
      <points geometry={starGeometry} renderOrder={-900} rotation={[0, celestialRotation, 0]}>
        <pointsMaterial
          depthWrite={false}
          fog={false}
          opacity={expression.night.starOpacity}
          size={qualityProfile.tier === "low" ? 0.13 : 0.16}
          sizeAttenuation
          transparent
          vertexColors
        />
      </points>
      <lineSegments geometry={constellationGeometry} renderOrder={-899} rotation={[0, celestialRotation, 0]}>
        <lineBasicMaterial
          color={expression.accent}
          depthWrite={false}
          fog={false}
          opacity={expression.night.constellationOpacity}
          transparent
        />
      </lineSegments>
    </group>
  );
}
