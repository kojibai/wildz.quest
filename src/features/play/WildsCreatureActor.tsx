"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { creatureForm } from "./creature-catalog";
import { threeCreatureColor, type CardKaiAppearance } from "./card-kai-appearance";
import { useWildsReadability } from "./WildsReadabilityContext";

export type WildsCreaturePose = "idle" | "curious" | "attack" | "impact" | "weakened" | "capture";

function identityNumber(value: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0) / 0xffffffff;
}

export function WildsCreatureActor({
  formId,
  familyId,
  primary,
  secondary,
  accent,
  glow,
  identityToken,
  morphology,
  anatomy,
  cadenceMs,
  pose = "idle"
}: {
  formId: string;
  familyId: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  identityToken?: string;
  morphology?: { head: number; torso: number; limb: number; symmetry: number };
  anatomy?: CardKaiAppearance["anatomy"];
  cadenceMs?: number;
  pose?: WildsCreaturePose;
}) {
  const readability = useWildsReadability();
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const limbs = useRef<THREE.Group>(null);
  const aura = useRef<THREE.Group>(null);
  const form = creatureForm(formId) ?? creatureForm(`${familyId}-1`);
  const body = anatomy?.body ?? form?.anatomy.body ?? "round";
  const detail = anatomy?.detail ?? form?.anatomy.detail ?? "ears";
  const auraKind = form?.anatomy.aura ?? "prism";
  const hasFunctionalWings = anatomy ? anatomy.appendages.wings.presence === "functional" && anatomy.appendages.wings.function === "powered-lift" : body === "winged" || detail === "wings" || familyId === "voltray";
  const hasGlideMembranes = anatomy ? anatomy.appendages.wings.presence === "functional" && anatomy.appendages.wings.function === "glide" : false;
  const hasFins = anatomy ? anatomy.appendages.fins.presence === "functional" : false;
  const hasFrills = anatomy ? anatomy.appendages.frills.presence === "functional" : false;
  const hasEars = anatomy ? anatomy.appendages.ears.presence === "functional" : detail === "ears" || familyId === "mintcub";
  const hasHorns = anatomy ? anatomy.appendages.horns.presence === "functional" : detail === "horns" || familyId === "titanseal";
  const hasTail = anatomy ? anatomy.appendages.tail.presence === "functional" : detail === "tail" || body === "long" || familyId === "ledgerfox";
  const hasCrest = anatomy ? anatomy.appendages.crest.presence === "functional" : detail === "crest";
  const hasShell = anatomy ? anatomy.surface === "shell" : detail === "shell" || body === "armored";
  const identity = useMemo(() => {
    const token = identityToken ?? formId;
    return {
      width: morphology?.torso ?? 0.9 + identityNumber(token, 11) * 0.32,
      height: morphology?.limb ?? 0.88 + identityNumber(token, 17) * 0.3,
      head: morphology?.head ?? 0.88 + identityNumber(token, 23) * 0.24,
      marking: identityNumber(token, 31),
      asymmetry: morphology?.symmetry ?? identityNumber(token, 37) * 0.18
    };
  }, [formId, identityToken, morphology?.head, morphology?.limb, morphology?.symmetry, morphology?.torso]);

  useFrame(() => {
    if (!root.current) return;
    const time = performance.now() / 1_000;
    const cadence = cadenceMs ? Math.max(0.7, Math.min(3.4, 3_000 / cadenceMs)) : 2.1;
    const motion = readability.motionScale;
    const breath = Math.sin(time * cadence + identity.marking * 4) * 0.025 * motion;
    const weakened = pose === "weakened";
    const impact = pose === "impact";
    const attack = pose === "attack";
    root.current.position.y = 0.46 + (weakened ? -0.08 : Math.abs(Math.sin(time * 1.7)) * 0.035 * motion);
    root.current.rotation.z = impact ? Math.sin(time * 18) * 0.08 * motion : weakened ? -0.08 : 0;
    root.current.scale.setScalar(pose === "capture" ? 0.9 + Math.sin(time * 5) * 0.035 * motion : 1);
    if (head.current) {
      head.current.rotation.x = attack ? -0.22 : weakened ? 0.16 : Math.sin(time * 0.9) * 0.045 * motion;
      head.current.rotation.y = pose === "curious" ? Math.sin(time * 1.4) * 0.18 * motion : 0;
      head.current.position.y = 0.31 + breath;
    }
    if (limbs.current) limbs.current.rotation.x = attack ? Math.sin(time * 13) * 0.22 * motion : weakened ? 0.18 : Math.sin(time * 2.4) * 0.04 * motion;
    if (aura.current) aura.current.rotation.y = time * (pose === "capture" ? 2.4 : 0.7) * motion;
  });

  const bodyScale: [number, number, number] = body === "long" || body === "serpentine"
    ? [identity.width * 0.78, identity.height * 0.72, 1.32]
    : body === "winged"
      ? [identity.width * 0.88, identity.height * 0.9, 0.82]
      : body === "armored"
        ? [identity.width * 1.08, identity.height * 0.9, 1]
        : [identity.width, identity.height, 0.94];
  const eyeScaleY = pose === "weakened" ? 0.42 : pose === "attack" ? 0.7 : 1;
  const bodyColorFloor = pose === "capture" ? 0.2 : 0.11;
  const readableBodyColorFloor = Math.max(bodyColorFloor, readability.actorEmissive);
  const renderedPrimary = threeCreatureColor(primary);
  const renderedSecondary = threeCreatureColor(secondary);
  const renderedAccent = threeCreatureColor(accent);
  const renderedGlow = threeCreatureColor(glow);

  return (
    <group name={`wilds-creature-${familyId}`} ref={root}>
      <group name="wilds-creature-body" rotation={[0, 0, identity.asymmetry * 0.08]}>
        <mesh castShadow scale={bodyScale}>
          {body === "armored" ? <dodecahedronGeometry args={[0.4, 1]} /> : body === "serpentine" ? <capsuleGeometry args={[0.25, 0.62, 7, 12]} /> : <sphereGeometry args={[0.4, 22, 16]} />}
          <meshStandardMaterial color={renderedPrimary} emissive={renderedPrimary} emissiveIntensity={readableBodyColorFloor} roughness={body === "armored" ? 0.78 : 0.6} />
        </mesh>
        {body === "armored" ? [-0.22, 0, 0.22].map((x) => <mesh castShadow key={x} position={[x, 0.31, -0.06]} rotation={[0, 0, x * 0.6]}><coneGeometry args={[0.075, 0.28, 5]} /><meshStandardMaterial color={renderedAccent} roughness={0.46} /></mesh>) : null}
        {body === "serpentine" ? [0, 1, 2].map((index) => <mesh castShadow key={index} position={[0.12 + index * 0.15, -0.12 - index * 0.055, -0.3 - index * 0.18]} rotation={[0.5, 0, -0.5]} scale={1 - index * 0.14}><sphereGeometry args={[0.2, 12, 9]} /><meshStandardMaterial color={renderedPrimary} roughness={0.62} /></mesh>) : null}
      </group>

      <group name="wilds-creature-limbs" ref={limbs}>
        {hasFunctionalWings || hasGlideMembranes ? <group name={hasFunctionalWings ? "functional-wing" : "glide-membrane"}>{[-1, 1].map((side) => <mesh castShadow key={side} position={[side * 0.46, 0.08, -0.08]} rotation={[0.15, 0, side * -0.72]} scale={[0.48, 1.3, 0.18]}><tetrahedronGeometry args={[0.46, 0]} /><meshStandardMaterial color={renderedSecondary} emissive={renderedSecondary} emissiveIntensity={0.12} roughness={0.46} /></mesh>)}</group> : null}
        {body === "round" || body === "long" || body === "armored" ? [-1, 1].flatMap((side) => [-1, 1].map((front) => <mesh castShadow key={`${side}:${front}`} position={[side * 0.26, -0.3, front * 0.2]} rotation={[front * 0.14, 0, side * -0.08]}><capsuleGeometry args={[0.07, 0.22, 5, 8]} /><meshStandardMaterial color={renderedPrimary} roughness={0.7} /></mesh>)) : null}
      </group>

      <group name="wilds-creature-face" position={[0, 0.31, 0.3]} ref={head} scale={identity.head}>
        <mesh castShadow scale={[0.82, 0.72, 0.6]}><sphereGeometry args={[0.34, 20, 14]} /><meshStandardMaterial color={renderedPrimary} emissive={renderedPrimary} emissiveIntensity={0.07 + readability.actorEmissive * 0.45} roughness={0.58} /></mesh>
        {[-1, 1].map((side) => <group key={side} position={[side * 0.13, 0.045, 0.19]} scale={[1, eyeScaleY, 1]}>
          <mesh><sphereGeometry args={[0.072, 12, 9]} /><meshStandardMaterial color="#fffdf3" roughness={0.32} /></mesh>
          <mesh position={[side * 0.008, -0.006, 0.061]}><sphereGeometry args={[0.033, 10, 8]} /><meshStandardMaterial color={renderedGlow} emissive={renderedGlow} emissiveIntensity={0.12} roughness={0.3} /></mesh>
          <mesh position={[side * 0.016, 0.016, 0.09]}><sphereGeometry args={[0.011, 7, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
        </group>)}
        <mesh position={[0, -0.055, 0.255]} scale={[1, 0.72, 0.7]}><sphereGeometry args={[0.038, 9, 7]} /><meshStandardMaterial color="#5b3b35" roughness={0.48} /></mesh>
        <mesh position={[0, -0.125, 0.246]} rotation={[Math.PI / 2, 0, 0]} scale={[1, pose === "attack" ? 1.35 : 0.55, 1]}><torusGeometry args={[0.055, 0.012, 6, 18, Math.PI]} /><meshStandardMaterial color="#7d3f50" roughness={0.54} /></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.2, -0.08, 0.19]} scale={[1.1, 0.55, 0.5]}><sphereGeometry args={[0.042, 8, 6]} /><meshStandardMaterial color="#ff9baa" transparent opacity={0.62} /></mesh>)}
        <CreatureIdentityDetail accent={renderedAccent} glow={renderedGlow} hasCrest={hasCrest} hasEars={hasEars} hasFins={hasFins} hasFrills={hasFrills} hasHorns={hasHorns} hasShell={hasShell} hasTail={hasTail} secondary={renderedSecondary} />
      </group>

      <group name={`wilds-creature-aura-${auraKind}`} ref={aura} position={[0, -0.35, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.48, 0.025, 7, 30]} /><meshStandardMaterial color={renderedGlow} emissive={renderedGlow} emissiveIntensity={0.52} transparent opacity={0.78} /></mesh>
        {[0, 1, 2].map((index) => <mesh key={index} position={[Math.cos(index * 2.1) * 0.38, 0.08 + index * 0.045, Math.sin(index * 2.1) * 0.38]} rotation={[0, index, 0]}><octahedronGeometry args={[0.035 + identity.marking * 0.018, 0]} /><meshBasicMaterial color={index === 1 ? renderedAccent : renderedGlow} /></mesh>)}
      </group>
    </group>
  );
}

function CreatureIdentityDetail({ accent, glow, hasCrest, hasEars, hasFins, hasFrills, hasHorns, hasShell, hasTail, secondary }: { accent: string; glow: string; hasCrest: boolean; hasEars: boolean; hasFins: boolean; hasFrills: boolean; hasHorns: boolean; hasShell: boolean; hasTail: boolean; secondary: string }) {
  return <>
    {hasEars ? [-1, 1].map((side) => <mesh castShadow key={`ear-${side}`} position={[side * 0.22, 0.27, -0.03]} rotation={[0, 0, side * -0.36]} scale={[0.7, 1.1, 0.5]}><coneGeometry args={[0.12, 0.34, 5]} /><meshStandardMaterial color={secondary} roughness={0.66} /></mesh>) : null}
    {hasTail ? <mesh castShadow position={[0.34, -0.22, -0.36]} rotation={[0.15, 0, -0.68]}><capsuleGeometry args={[0.06, 0.42, 5, 8]} /><meshStandardMaterial color={secondary} roughness={0.72} /></mesh> : null}
    {hasHorns ? [-1, 1].map((side) => <mesh castShadow key={`horn-${side}`} position={[side * 0.2, 0.25, 0]} rotation={[0.2, 0, side * -0.22]}><coneGeometry args={[0.055, 0.26, 7]} /><meshStandardMaterial color={glow} roughness={0.44} /></mesh>) : null}
    {hasFins ? [-1, 1].map((side) => <mesh castShadow key={`fin-${side}`} name="fin" position={[side * 0.34, -0.04, -0.18]} rotation={[0, 0, side * -0.85]} scale={[0.22, 0.42, 0.12]}><coneGeometry args={[0.22, 1, 3]} /><meshStandardMaterial color={secondary} roughness={0.48} /></mesh>) : null}
    {hasFrills ? <mesh name="frill" position={[0, 0.33, -0.05]} rotation={[0, Math.PI / 4, 0]} scale={[0.22, 0.22, 0.12]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color={accent} roughness={0.42} /></mesh> : null}
    {hasCrest ? <mesh position={[0, 0.3, -0.03]}><octahedronGeometry args={[0.14, 0]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.12} /></mesh> : null}
    {hasShell ? <mesh castShadow position={[0, -0.13, -0.32]} scale={[1.05, 0.82, 0.36]}><sphereGeometry args={[0.28, 12, 9]} /><meshStandardMaterial color={secondary} roughness={0.8} /></mesh> : null}
  </>;
}
