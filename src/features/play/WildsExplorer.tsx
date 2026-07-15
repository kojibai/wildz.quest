"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayState } from "@/features/play/game-state";

type ExplorerStyle = "female" | "male";

const palette = {
  skin: "#b97856",
  hair: "#241a17",
  trousers: "#243747",
  boots: "#5b3d2c",
  leather: "#8d623e",
  gold: "#f0c75e"
};

function LimbSegment({
  color,
  length,
  radius
}: {
  color: string;
  length: number;
  radius: number;
}) {
  return (
    <mesh castShadow position={[0, -length / 2, 0]}>
      <capsuleGeometry args={[radius, Math.max(0.04, length - radius * 2), 5, 9]} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  );
}

export function WildsExplorer({
  style,
  worldPosition,
  remote = false
}: {
  style: ExplorerStyle;
  worldPosition: PlayState["player"];
  remote?: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftShoulder = useRef<THREE.Group>(null);
  const rightShoulder = useRef<THREE.Group>(null);
  const leftElbow = useRef<THREE.Group>(null);
  const rightElbow = useRef<THREE.Group>(null);
  const leftKnee = useRef<THREE.Group>(null);
  const rightKnee = useRef<THREE.Group>(null);
  const satchel = useRef<THREE.Mesh>(null);
  const scarf = useRef<THREE.Mesh>(null);
  const previousPosition = useRef(worldPosition);
  const movingUntil = useRef(0);
  const facing = useRef(0);

  useEffect(() => {
    const dx = worldPosition.x - previousPosition.current.x;
    const dz = worldPosition.z - previousPosition.current.z;
    if (Math.hypot(dx, dz) > 0.001) {
      movingUntil.current = performance.now() + 280;
      facing.current = Math.atan2(-dx, -dz);
    }
    previousPosition.current = worldPosition;
  }, [worldPosition]);

  useFrame(() => {
    if (!root.current) return;
    const elapsed = performance.now() / 1_000;
    const moving = performance.now() < movingUntil.current;
    const stride = moving ? Math.sin(elapsed * 11.5) : 0;
    const footPlant = moving ? Math.max(0, Math.cos(elapsed * 23)) : 1;
    const breath = Math.sin(elapsed * 1.8) * 0.018;
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, facing.current, remote ? 0.11 : 0.18);
    root.current.position.y = moving ? Math.abs(Math.sin(elapsed * 11.5)) * 0.026 : 0;
    if (hips.current) {
      hips.current.rotation.y = stride * 0.08;
      hips.current.position.y = 0.72 + footPlant * 0.012;
    }
    if (spine.current) {
      spine.current.rotation.y = -stride * 0.06;
      spine.current.scale.y = 1 + breath;
    }
    if (head.current) head.current.rotation.y = Math.sin(elapsed * 0.72) * (moving ? 0.035 : 0.09);
    if (leftShoulder.current) leftShoulder.current.rotation.x = stride * 0.52;
    if (rightShoulder.current) rightShoulder.current.rotation.x = -stride * 0.52;
    if (leftElbow.current) leftElbow.current.rotation.x = Math.max(0, -stride) * 0.22 - 0.08;
    if (rightElbow.current) rightElbow.current.rotation.x = Math.max(0, stride) * 0.22 - 0.08;
    if (leftKnee.current) leftKnee.current.rotation.x = -stride * 0.7;
    if (rightKnee.current) rightKnee.current.rotation.x = stride * 0.7;
    if (satchel.current) satchel.current.rotation.z = stride * -0.09;
    if (scarf.current) scarf.current.rotation.x = 0.18 + Math.sin(elapsed * 5.5) * (moving ? 0.12 : 0.035);
  });

  const jacket = style === "female" ? "#e95383" : "#2e73a6";
  const jacketDark = style === "female" ? "#9f315d" : "#174b73";

  return (
    <group name={`wilds-explorer-${style}`} ref={root} scale={remote ? 0.62 : 0.68}>
      <group name="hips" position={[0, 0.72, 0]} ref={hips}>
        <mesh castShadow scale={[0.86, 0.52, 0.66]}>
          <capsuleGeometry args={[0.18, 0.2, 6, 12]} />
          <meshStandardMaterial color={jacketDark} roughness={0.68} />
        </mesh>
        <Leg side={-1} knee={leftKnee} />
        <Leg side={1} knee={rightKnee} />
      </group>

      <group name="spine" position={[0, 0.92, 0]} ref={spine}>
        <mesh castShadow position={[0, 0.2, 0]} scale={style === "female" ? [0.86, 1, 0.72] : [1, 1, 0.76]}>
          <capsuleGeometry args={[0.24, 0.34, 8, 14]} />
          <meshStandardMaterial color={jacket} roughness={0.58} />
        </mesh>
        <mesh castShadow position={[0, 0.24, 0.2]} scale={[0.78, 0.88, 0.52]}>
          <boxGeometry args={[0.42, 0.45, 0.22]} />
          <meshStandardMaterial color="#d7a64a" roughness={0.76} />
        </mesh>
        {!remote ? (
          <>
            <mesh castShadow position={[0.3, 0.08, 0.17]} ref={satchel} rotation={[0.08, 0.12, -0.08]}>
              <boxGeometry args={[0.23, 0.3, 0.18]} />
              <meshStandardMaterial color={palette.leather} roughness={0.9} />
            </mesh>
            <mesh castShadow position={[-0.13, 0.48, 0.08]} ref={scarf} rotation={[0.18, 0, 0.08]}>
              <capsuleGeometry args={[0.045, 0.32, 5, 8]} />
              <meshStandardMaterial color="#f6d46d" roughness={0.82} />
            </mesh>
          </>
        ) : null}
        <Arm elbow={leftElbow} shoulder={leftShoulder} side={-1} sleeve={jacketDark} />
        <Arm elbow={rightElbow} shoulder={rightShoulder} side={1} sleeve={jacketDark} />
      </group>

      <group name="head" position={[0, 1.57, -0.01]} ref={head}>
        <mesh castShadow scale={[0.9, 1.06, 0.92]}>
          <sphereGeometry args={[0.225, 18, 14]} />
          <meshStandardMaterial color={palette.skin} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 0.075, 0.025]} scale={style === "female" ? [1.1, 0.9, 1.08] : [1.09, 0.76, 1.07]}>
          <sphereGeometry args={[0.225, 16, 12]} />
          <meshStandardMaterial color={palette.hair} roughness={0.88} />
        </mesh>
        <mesh
          castShadow
          name="rearHair"
          position={[0, style === "female" ? -0.045 : -0.005, 0.135]}
          scale={style === "female" ? [1.12, 1.2, 0.8] : [1.08, 0.92, 0.72]}
        >
          <sphereGeometry args={[0.205, 16, 12]} />
          <meshStandardMaterial color={palette.hair} roughness={0.9} />
        </mesh>
        {style === "female" ? (
          <mesh castShadow position={[0, -0.13, 0.19]} rotation={[-0.22, 0, 0]}>
            <capsuleGeometry args={[0.075, 0.3, 5, 9]} />
            <meshStandardMaterial color={palette.hair} roughness={0.9} />
          </mesh>
        ) : null}
        {!remote ? (
          <>
            <mesh name="leftEar" position={[-0.23, -0.02, 0]} rotation={[0, 0, 0.2]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color={palette.skin} roughness={0.72} />
            </mesh>
            <mesh name="rightEar" position={[0.23, -0.02, 0]} rotation={[0, 0, -0.2]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color={palette.skin} roughness={0.72} />
            </mesh>
          </>
        ) : null}
      </group>
    </group>
  );
}

function Arm({
  elbow,
  shoulder,
  side,
  sleeve
}: {
  elbow: React.RefObject<THREE.Group | null>;
  shoulder: React.RefObject<THREE.Group | null>;
  side: -1 | 1;
  sleeve: string;
}) {
  return (
    <group name={side < 0 ? "leftShoulder" : "rightShoulder"} position={[side * 0.31, 0.37, 0]} ref={shoulder}>
      <LimbSegment color={sleeve} length={0.3} radius={0.075} />
      <group name={side < 0 ? "leftElbow" : "rightElbow"} position={[0, -0.29, 0]} ref={elbow}>
        <LimbSegment color={palette.skin} length={0.28} radius={0.06} />
        <mesh castShadow position={[0, -0.3, 0]} scale={[0.8, 1, 0.72]}>
          <sphereGeometry args={[0.075, 9, 7]} />
          <meshStandardMaterial color={palette.skin} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Leg({ side, knee }: { side: -1 | 1; knee: React.RefObject<THREE.Group | null> }) {
  return (
    <group name={side < 0 ? "leftKnee" : "rightKnee"} position={[side * 0.12, -0.06, 0]} ref={knee}>
      <LimbSegment color={palette.trousers} length={0.34} radius={0.08} />
      <group position={[0, -0.32, 0]}>
        <LimbSegment color={palette.trousers} length={0.31} radius={0.072} />
        <mesh castShadow position={[0, -0.34, -0.055]}>
          <boxGeometry args={[0.17, 0.13, 0.31]} />
          <meshStandardMaterial color={palette.boots} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
