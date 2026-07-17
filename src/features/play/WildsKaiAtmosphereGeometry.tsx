"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { kaiTransition, type KaiTransitionKind, type KaiWorldExpression } from "./kai-moment-expression";
import type { WildsQualityProfile } from "./wilds-quality-profile";

export function WildsKaiAtmosphereGeometry({ expression, qualityProfile }: { expression: KaiWorldExpression; qualityProfile: WildsQualityProfile }) {
  const group = useRef<THREE.Group>(null);
  const priorKey = useRef<KaiWorldExpression["transitionKey"] | null>(null);
  const transition = useRef<{ kind: KaiTransitionKind; startedAt: number } | null>(null);
  const dayKey = expression.transitionKey.day;
  const beatKey = expression.transitionKey.beat;
  const arkKey = expression.transitionKey.ark;
  const count = Math.max(4, Math.min(16, Math.round(expression.particles.geometrySides * Math.max(0.45, qualityProfile.particles))));
  const points = useMemo(() => Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    const radius = 2.2 + (index % 2) * 0.18;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle * 2) * 0.18, z: Math.sin(angle) * radius, angle };
  }), [count]);
  useEffect(() => {
    const next = { day: dayKey, beat: beatKey, ark: arkKey };
    const kind = kaiTransition(priorKey.current, next);
    priorKey.current = next;
    if (kind) transition.current = { kind, startedAt: performance.now() };
  }, [arkKey, beatKey, dayKey]);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * expression.particles.speed * 0.025;
    const active = transition.current;
    const progress = active ? Math.min(1, (performance.now() - active.startedAt) / (active.kind === "ark" ? 1_100 : 480)) : 1;
    const breath = active && progress < 1 ? Math.sin(progress * Math.PI) * (active.kind === "ark" ? 0.12 : 0.045) : 0;
    if (qualityProfile.particles > 0.35) group.current.scale.setScalar(1 + breath);
    group.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.Material)) return;
      const material = child.material as THREE.Material & { opacity: number };
      const base = typeof material.userData.baseOpacity === "number" ? material.userData.baseOpacity : material.opacity;
      material.userData.baseOpacity = base;
      material.opacity = Math.min(1, base * (1 + breath * 2));
    });
    if (progress >= 1) transition.current = null;
  });
  return (
    <group name={`kai-ark-geometry-${expression.dayPhase}`} position={[0, 4.6, -4]} ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.12, 2.14, count]} />
        <meshBasicMaterial color={expression.accent} depthWrite={false} opacity={expression.particles.opacity * 0.18} side={THREE.DoubleSide} transparent />
      </mesh>
      {points.map((point, index) => <mesh key={index} position={[point.x, point.y, point.z]} scale={0.025 + (index % 3) * 0.008}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={index % 2 ? expression.sky.tint : expression.accent} depthWrite={false} opacity={expression.particles.opacity * 0.55} transparent />
      </mesh>)}
    </group>
  );
}
