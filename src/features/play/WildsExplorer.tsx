"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PlayState } from "@/features/play/game-state";
import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import { projectWildzExplorerRender } from "@/features/play/wildz-explorer-proof";
import { useWildsReadability } from "@/features/play/WildsReadabilityContext";
import type { WildsAerialTraversalState } from "@/features/play/wilds-aerial-traversal";
import { writeWildsExplorerWingFlightPose } from "@/features/play/wilds-explorer-flight-pose";

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

function transformedGeometry(
  geometry: THREE.BufferGeometry,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0]
) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function mergedBackpackGeometry() {
  const parts = [
    transformedGeometry(new THREE.CapsuleGeometry(0.27, 0.31, 6, 12), [0, 0.02, 0], [1, 1, 0.48]),
    transformedGeometry(new THREE.BoxGeometry(0.5, 0.16, 0.12), [0, 0.2, 0.08], [1, 1, 1], [-0.18, 0, 0]),
    transformedGeometry(new THREE.BoxGeometry(0.16, 0.27, 0.16), [-0.29, -0.07, 0.01], [1, 1, 1], [0, 0, -0.08]),
    transformedGeometry(new THREE.BoxGeometry(0.16, 0.27, 0.16), [0.29, -0.07, 0.01], [1, 1, 1], [0, 0, 0.08]),
    transformedGeometry(new THREE.CylinderGeometry(0.085, 0.085, 0.48, 10), [0, -0.31, 0.04], [1, 1, 1], [0, 0, Math.PI / 2])
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("wildz_backpack_geometry_merge_failed");
  merged.computeVertexNormals();
  return merged;
}

function mergedBackpackHardwareGeometry() {
  const parts = [
    transformedGeometry(new THREE.BoxGeometry(0.055, 0.075, 0.035), [-0.12, -0.08, 0.151], [1, 1, 1]),
    transformedGeometry(new THREE.BoxGeometry(0.055, 0.075, 0.035), [0.12, -0.08, 0.151], [1, 1, 1]),
    transformedGeometry(new THREE.TorusGeometry(0.12, 0.018, 5, 18, Math.PI), [0, 0.34, -0.02], [1, 1, 0.7], [Math.PI / 2, 0, 0])
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("wildz_backpack_hardware_merge_failed");
  merged.computeVertexNormals();
  return merged;
}

function ExplorerBackpack({
  accent,
  aerialPalette,
  backpackRef,
  harnessRef,
  leftWingRef,
  rightWingRef
}: {
  accent: string;
  aerialPalette: Readonly<{ primary: string; accent: string; glow: string }>;
  backpackRef: React.RefObject<THREE.Group | null>;
  harnessRef: React.RefObject<THREE.Group | null>;
  leftWingRef: React.RefObject<THREE.Mesh | null>;
  rightWingRef: React.RefObject<THREE.Mesh | null>;
}) {
  const badge = useTexture("/brand/explorer-pack-badge.svg");
  const shellGeometry = useMemo(mergedBackpackGeometry, []);
  const hardwareGeometry = useMemo(mergedBackpackHardwareGeometry, []);
  const wingShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.18, 0.28, 0.48, 0.67, 0.98, 0.78);
    shape.bezierCurveTo(0.82, 0.48, 0.72, 0.22, 0.74, -0.06);
    shape.bezierCurveTo(0.57, 0.09, 0.45, 0.12, 0.4, -0.17);
    shape.bezierCurveTo(0.25, -0.02, 0.13, 0.02, 0, 0);
    return shape;
  }, []);
  useEffect(() => () => {
    shellGeometry.dispose();
    hardwareGeometry.dispose();
  }, [hardwareGeometry, shellGeometry]);
  badge.colorSpace = THREE.SRGBColorSpace;
  badge.anisotropy = 4;
  return (
    <group name="trail-pack" position={[0, 0.24, 0.2]} ref={backpackRef} rotation={[0.03, 0, 0]}>
      <mesh castShadow geometry={shellGeometry}>
        <meshStandardMaterial color="#8a603d" emissive="#3c2518" emissiveIntensity={0.055} metalness={0.03} roughness={0.76} />
      </mesh>
      <mesh castShadow geometry={hardwareGeometry}>
        <meshStandardMaterial color="#c7a85a" metalness={0.66} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.035, 0.151]}>
        <boxGeometry args={[0.34, 0.34, 0.022]} />
        <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={0.025} map={badge} metalness={0.04} roughness={0.58} />
      </mesh>
      <mesh position={[0, -0.245, 0.147]}>
        <boxGeometry args={[0.31, 0.025, 0.018]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.34} roughness={0.42} />
      </mesh>
      <group name="wilds-aerial-harness" ref={harnessRef} visible={false}>
        <mesh castShadow position={[-0.28, 0.08, 0.04]} ref={leftWingRef} rotation={[0.12, 0.18, -1.42]} scale={[-0.92, 0.92, 1]}>
          <shapeGeometry args={[wingShape, 4]} />
          <meshStandardMaterial color={aerialPalette.primary} emissive={aerialPalette.glow} emissiveIntensity={0.62} metalness={0.08} roughness={0.34} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
        <mesh castShadow position={[0.28, 0.08, 0.04]} ref={rightWingRef} rotation={[-0.12, -0.18, 1.42]} scale={[0.92, 0.92, 1]}>
          <shapeGeometry args={[wingShape, 4]} />
          <meshStandardMaterial color={aerialPalette.accent} emissive={aerialPalette.glow} emissiveIntensity={0.62} metalness={0.08} roughness={0.34} side={THREE.DoubleSide} transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function mergedScubaKitGeometry() {
  const parts = [
    transformedGeometry(new THREE.TorusGeometry(0.19, 0.026, 6, 18), [0, 1.58, -0.205], [1, 0.72, 1], [Math.PI / 2, 0, 0]),
    transformedGeometry(new THREE.CylinderGeometry(0.12, 0.12, 0.62, 10), [0, 1.04, 0.27], [1, 1, 0.72]),
    transformedGeometry(new THREE.ConeGeometry(0.17, 0.48, 4), [-0.12, 0.14, -0.16], [0.7, 1, 0.22], [-Math.PI / 2, 0, 0]),
    transformedGeometry(new THREE.ConeGeometry(0.17, 0.48, 4), [0.12, 0.14, -0.16], [0.7, 1, 0.22], [-Math.PI / 2, 0, 0])
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("wildz_scuba_geometry_merge_failed");
  merged.computeVertexNormals();
  return merged;
}

function ExplorerScubaKit({ accent, visible }: { accent: string; visible: boolean }) {
  const geometry = useMemo(mergedScubaKitGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group name="wilds-scuba-kit" visible={visible}>
    <mesh castShadow geometry={geometry}>
      <meshStandardMaterial color="#8debd7" emissive={accent} emissiveIntensity={0.24} metalness={0.16} roughness={0.38} />
    </mesh>
  </group>;
}

export function WildsExplorer({
  character,
  style,
  worldPosition,
  remote = false,
  locomotion = "ground",
  scubaVisible = false,
  aerialStateRef,
  aerialPalette = { primary: "#c9fff0", accent: "#f5d46c", glow: "#76f3cf" }
}: {
  character?: WildzCharacterGenesis;
  style: ExplorerStyle;
  worldPosition: PlayState["player"];
  remote?: boolean;
  locomotion?: "ground" | "swim";
  scubaVisible?: boolean;
  aerialStateRef?: MutableRefObject<WildsAerialTraversalState>;
  aerialPalette?: Readonly<{ primary: string; accent: string; glow: string }>;
}) {
  const readability = useWildsReadability();
  const proofRender = character ? projectWildzExplorerRender(character) : null;
  const renderStyle = proofRender?.style ?? style;
  const appearance = proofRender?.appearance ?? {
    skin: palette.skin,
    hair: palette.hair,
    hairProfile: renderStyle === "female" ? "river-braid" : "canopy-crop",
    outfitProfile: "trailweaver",
    outfitPrimary: renderStyle === "female" ? "#9F5272" : "#376B8D",
    outfitSecondary: renderStyle === "female" ? "#593348" : "#21465E",
    materialRoughness: 0.68,
    accessory: "trail-satchel",
    trail: "mint-ripple",
    signatureMark: "sprout",
    signatureSeed: 0.5
  };
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
  const satchel = useRef<THREE.Group>(null);
  const scarf = useRef<THREE.Mesh>(null);
  const aerialHarness = useRef<THREE.Group>(null);
  const leftWing = useRef<THREE.Mesh>(null);
  const rightWing = useRef<THREE.Mesh>(null);
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

  useFrame((_, delta) => {
    if (!root.current) return;
    const elapsed = performance.now() / 1_000;
    const moving = performance.now() < movingUntil.current;
    const aerialMode = aerialStateRef?.current.mode ?? "ground";
    const grounded = locomotion === "ground" && aerialMode === "ground";
    const stride = grounded && moving ? Math.sin(elapsed * 11.5) * readability.motionScale : 0;
    const footPlant = grounded && moving ? Math.max(0, Math.cos(elapsed * 23)) : grounded ? 1 : 0;
    const swimStroke = locomotion === "swim" ? Math.sin(elapsed * 3.8) * readability.motionScale : 0;
    const airborne = aerialMode !== "ground";
    const verticalVelocity = aerialStateRef?.current.verticalVelocity ?? 0;
    const breath = Math.sin(elapsed * 1.8) * 0.018 * readability.motionScale;
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, facing.current, remote ? 0.11 : 0.18);
    const bodyPitch = locomotion === "swim"
      ? moving ? -1.42 : -0.78
      : airborne
        ? aerialMode === "glide" || moving ? -1.12 : verticalVelocity < -0.2 ? -0.32 : 0
        : 0;
    root.current.rotation.x = readability.motionScale === 0 ? bodyPitch : THREE.MathUtils.damp(root.current.rotation.x, bodyPitch, 7, delta);
    root.current.position.y = grounded && moving ? Math.abs(Math.sin(elapsed * 11.5)) * 0.026 * readability.motionScale : 0;
    if (hips.current) {
      hips.current.rotation.y = grounded ? stride * 0.08 : 0;
      hips.current.position.y = 0.72 + footPlant * 0.012;
    }
    if (spine.current) {
      spine.current.rotation.y = grounded ? -stride * 0.06 : 0;
      spine.current.scale.y = 1 + breath;
    }
    if (head.current) head.current.rotation.y = Math.sin(elapsed * 0.72) * (moving ? 0.035 : 0.09) * readability.motionScale;
    if (leftShoulder.current) leftShoulder.current.rotation.x = locomotion === "swim" ? -0.55 + swimStroke * 0.72 : grounded ? stride * 0.52 : airborne ? -0.42 : 0;
    if (rightShoulder.current) rightShoulder.current.rotation.x = locomotion === "swim" ? -0.55 - swimStroke * 0.72 : grounded ? -stride * 0.52 : airborne ? -0.42 : 0;
    if (leftElbow.current) leftElbow.current.rotation.x = locomotion === "swim" ? -0.22 - swimStroke * 0.34 : grounded ? Math.max(0, -stride) * 0.22 - 0.08 : -0.08;
    if (rightElbow.current) rightElbow.current.rotation.x = locomotion === "swim" ? -0.22 + swimStroke * 0.34 : grounded ? Math.max(0, stride) * 0.22 - 0.08 : -0.08;
    if (leftKnee.current) leftKnee.current.rotation.x = locomotion === "swim" ? 0.18 + swimStroke * 0.28 : grounded ? -stride * 0.7 : airborne && moving ? 0.46 : 0.08;
    if (rightKnee.current) rightKnee.current.rotation.x = locomotion === "swim" ? 0.18 - swimStroke * 0.28 : grounded ? stride * 0.7 : airborne && moving ? 0.46 : 0.08;
    if (satchel.current) satchel.current.rotation.z = grounded ? stride * -0.09 : 0;
    if (scarf.current) scarf.current.rotation.x = 0.18 + Math.sin(elapsed * 5.5) * (moving ? 0.12 : 0.035) * readability.motionScale;
    if (aerialHarness.current) aerialHarness.current.visible = airborne && !remote;
    if (leftWing.current && rightWing.current) writeWildsExplorerWingFlightPose(
      leftWing.current,
      rightWing.current,
      airborne,
      aerialMode === "glide",
      elapsed,
      readability.motionScale,
      verticalVelocity
    );
  });

  const hairLength = appearance.hairProfile === "river-braid" || appearance.hairProfile === "fern-locks" ? 1.2 : 0.82;
  const outfitWidth = appearance.outfitProfile === "canopy-guard" ? 1.08 : appearance.outfitProfile === "rift-scout" ? 0.92 : 1;

  return (
    <group name={`wilds-explorer-${renderStyle}`} ref={root} scale={remote ? 0.62 : 0.78}>
      <group name="hips" position={[0, 0.72, 0]} ref={hips}>
        <mesh castShadow scale={[0.86, 0.52, 0.66]}>
          <capsuleGeometry args={[0.18, 0.2, 6, 12]} />
          <meshStandardMaterial color={appearance.outfitSecondary} emissive={appearance.outfitSecondary} emissiveIntensity={readability.actorEmissive * 0.6} roughness={appearance.materialRoughness} />
        </mesh>
        <Leg boots={appearance.outfitSecondary} side={-1} knee={leftKnee} trousers={appearance.outfitSecondary} />
        <Leg boots={appearance.outfitSecondary} side={1} knee={rightKnee} trousers={appearance.outfitSecondary} />
      </group>

      <group name="spine" position={[0, 0.92, 0]} ref={spine}>
        <mesh castShadow position={[0, 0.2, 0]} scale={[outfitWidth * (renderStyle === "female" ? 0.86 : 1), 1, renderStyle === "female" ? 0.72 : 0.76]}>
          <capsuleGeometry args={[0.24, 0.34, 8, 14]} />
          <meshStandardMaterial color={appearance.outfitPrimary} emissive={appearance.outfitPrimary} emissiveIntensity={readability.actorEmissive} roughness={appearance.materialRoughness} />
        </mesh>
        {remote ? <mesh castShadow position={[0, 0.24, 0.2]} scale={[0.78, 0.88, 0.52]}>
          <boxGeometry args={[0.42, 0.45, 0.22]} />
          <meshStandardMaterial color="#9a7845" roughness={0.82} />
        </mesh> : <ExplorerBackpack accent={appearance.outfitPrimary} aerialPalette={aerialPalette} backpackRef={satchel} harnessRef={aerialHarness} leftWingRef={leftWing} rightWingRef={rightWing} />}
        {!remote ? (
          <>
            <mesh castShadow name={appearance.accessory} position={[-0.13, 0.48, 0.08]} ref={scarf} rotation={[0.18, 0, 0.08]}>
              <capsuleGeometry args={[0.045, 0.32, 5, 8]} />
              <meshStandardMaterial color={appearance.outfitPrimary} emissive={appearance.outfitPrimary} emissiveIntensity={0.08} roughness={0.82} />
            </mesh>
            <mesh name={`signature-${appearance.signatureMark}`} position={[0, 0.24, -0.225]} rotation={[0, 0, appearance.signatureSeed * Math.PI]}>
              <torusGeometry args={[0.055, 0.012, 6, 10]} />
              <meshStandardMaterial color={appearance.outfitSecondary} emissive={appearance.outfitPrimary} emissiveIntensity={0.28} />
            </mesh>
          </>
        ) : null}
        <Arm elbow={leftElbow} shoulder={leftShoulder} side={-1} skin={appearance.skin} sleeve={appearance.outfitSecondary} />
        <Arm elbow={rightElbow} shoulder={rightShoulder} side={1} skin={appearance.skin} sleeve={appearance.outfitSecondary} />
      </group>

      <group name="head" position={[0, 1.57, -0.01]} ref={head}>
        <mesh castShadow scale={[0.9, 1.06, 0.92]}>
          <sphereGeometry args={[0.225, 18, 14]} />
          <meshStandardMaterial color={appearance.skin} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 0.075, 0.025]} scale={renderStyle === "female" ? [1.1, 0.9, 1.08] : [1.09, 0.76, 1.07]}>
          <sphereGeometry args={[0.225, 16, 12]} />
          <meshStandardMaterial color={appearance.hair} roughness={0.88} />
        </mesh>
        <mesh
          castShadow
          name="rearHair"
          position={[0, renderStyle === "female" ? -0.045 : -0.005, 0.135]}
          scale={[renderStyle === "female" ? 1.12 : 1.08, hairLength, renderStyle === "female" ? 0.8 : 0.72]}
        >
          <sphereGeometry args={[0.205, 16, 12]} />
          <meshStandardMaterial color={appearance.hair} roughness={0.9} />
        </mesh>
        {renderStyle === "female" ? (
          <mesh castShadow position={[0, -0.13, 0.19]} rotation={[-0.22, 0, 0]}>
            <capsuleGeometry args={[0.075, 0.3, 5, 9]} />
            <meshStandardMaterial color={appearance.hair} roughness={0.9} />
          </mesh>
        ) : null}
        {!remote ? (
          <>
            <mesh name="leftEar" position={[-0.23, -0.02, 0]} rotation={[0, 0, 0.2]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color={appearance.skin} roughness={0.72} />
            </mesh>
            <mesh name="rightEar" position={[0.23, -0.02, 0]} rotation={[0, 0, -0.2]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color={appearance.skin} roughness={0.72} />
            </mesh>
          </>
        ) : null}
      </group>
      {!remote ? <ExplorerScubaKit accent={appearance.outfitPrimary} visible={scubaVisible} /> : null}
    </group>
  );
}

function Arm({
  elbow,
  shoulder,
  side,
  skin,
  sleeve
}: {
  elbow: React.RefObject<THREE.Group | null>;
  shoulder: React.RefObject<THREE.Group | null>;
  side: -1 | 1;
  skin: string;
  sleeve: string;
}) {
  return (
    <group name={side < 0 ? "leftShoulder" : "rightShoulder"} position={[side * 0.31, 0.37, 0]} ref={shoulder}>
      <LimbSegment color={sleeve} length={0.3} radius={0.075} />
      <group name={side < 0 ? "leftElbow" : "rightElbow"} position={[0, -0.29, 0]} ref={elbow}>
        <LimbSegment color={skin} length={0.28} radius={0.06} />
        <mesh castShadow position={[0, -0.3, 0]} scale={[0.8, 1, 0.72]}>
          <sphereGeometry args={[0.075, 9, 7]} />
          <meshStandardMaterial color={skin} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Leg({ boots, side, knee, trousers }: { boots: string; side: -1 | 1; knee: React.RefObject<THREE.Group | null>; trousers: string }) {
  return (
    <group name={side < 0 ? "leftKnee" : "rightKnee"} position={[side * 0.12, -0.06, 0]} ref={knee}>
      <LimbSegment color={trousers} length={0.34} radius={0.08} />
      <group position={[0, -0.32, 0]}>
        <LimbSegment color={trousers} length={0.31} radius={0.072} />
        <mesh castShadow position={[0, -0.34, -0.055]}>
          <boxGeometry args={[0.17, 0.13, 0.31]} />
          <meshStandardMaterial color={boots} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
