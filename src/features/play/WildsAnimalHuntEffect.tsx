'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createWildsHuntAnimationFrame, writeWildsHuntAnimationFrame, type WildsAnimalHuntPresentation } from './wilds-animal-interaction';
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from './wilds-site-runtime';

/** A brief ability/axe trail and impact; no React updates or gameplay waits per frame. */
export function WildsAnimalHuntEffect({ hunt, origin, reducedMotion, siteRuntime }: {
  hunt: WildsAnimalHuntPresentation;
  origin: RefObject<Readonly<{ x: number; y: number; z: number }>>;
  reducedMotion: boolean;
  siteRuntime?: WildsSiteRuntimeProjection;
}) {
  const root = useRef<THREE.Group>(null), shot = useRef<THREE.Mesh>(null), trail = useRef<THREE.Mesh>(null), ring = useRef<THREE.Mesh>(null);
  const frame = useMemo(createWildsHuntAnimationFrame, []);
  const direction = useMemo(() => new THREE.Vector3(), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const groundY=useMemo(()=>siteRuntime?wildsSiteRuntimeGroundY(siteRuntime,hunt.spaceId,hunt.position.x,hunt.position.z,hunt.position.y):hunt.position.y,
    [siteRuntime,hunt.spaceId,hunt.position.x,hunt.position.y,hunt.position.z]);
  useFrame(() => {
    if (!root.current || !shot.current || !trail.current || !ring.current) return;
    const elapsed = performance.now() - hunt.startedAtMs;
    writeWildsHuntAnimationFrame(frame, elapsed, reducedMotion);
    root.current.visible = frame.active;
    if (!frame.active) return;
    root.current.position.set(hunt.position.x - origin.current.x, groundY - origin.current.y + .3, hunt.position.z - origin.current.z);
    const dx = hunt.from.x - hunt.position.x, dy = hunt.from.y - groundY - .3, dz = hunt.from.z - hunt.position.z;
    shot.current.visible = !reducedMotion && frame.flight < 1;
    shot.current.position.set(dx * (1 - frame.flight), dy * (1 - frame.flight) + Math.sin(frame.flight * Math.PI) * .3, dz * (1 - frame.flight));
    trail.current.visible = shot.current.visible;
    direction.set(shot.current.position.x - dx, shot.current.position.y - dy, shot.current.position.z - dz);
    const length = direction.length();
    trail.current.position.set((shot.current.position.x + dx) / 2, (shot.current.position.y + dy) / 2, (shot.current.position.z + dz) / 2);
    trail.current.scale.set(1, Math.max(.01, length), 1);
    if (length > .001) trail.current.quaternion.setFromUnitVectors(up, direction.divideScalar(length));
    ring.current.visible = frame.flight >= 1;
    const expansion = reducedMotion ? .5 : Math.max(0, Math.min(1, (elapsed - 280) / 620));
    ring.current.scale.setScalar(.35 + expansion * .75);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = .7 * (1 - expansion);
  });
  const tone = hunt.hunterAssetId ? '#bfeac8' : '#f0d398';
  return <group name="landscape-hunt-effect" ref={root} visible={false} raycast={() => {}}>
    <mesh ref={shot} raycast={() => {}}><sphereGeometry args={[.08, 8, 6]} /><meshBasicMaterial color={tone} /></mesh>
    <mesh ref={trail} raycast={() => {}}><cylinderGeometry args={[.015, .025, 1, 6]} /><meshBasicMaterial color={tone} transparent opacity={.55} /></mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}><torusGeometry args={[.5, .025, 6, 28]} /><meshBasicMaterial color={tone} transparent opacity={.7} depthWrite={false} /></mesh>
  </group>;
}
