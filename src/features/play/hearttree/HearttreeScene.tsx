"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { WildsCreatureActor } from "../WildsCreatureActor";
import type { PortableCardAsset } from "../portable-card";
import type { HearttreeExpeditionDefinition } from "./expedition-director";
import type { HearttreeRuntimeState } from "./runtime";

export function HearttreeScene({ cards, definition, reducedMotion, runtime }: { cards: readonly PortableCardAsset[]; definition: HearttreeExpeditionDefinition; reducedMotion: boolean; runtime: HearttreeRuntimeState }) {
  return <div className="hearttree-canvas" aria-label="Playable Hearttree expedition chamber">
    <Canvas
      camera={{ fov: 44, near: 0.1, far: 70, position: [0, 5.7, 8.2] }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
        scene.name = "HearttreeExpedition";
      }}
      shadows="soft"
    >
      <HearttreeWorld cards={cards} definition={definition} reducedMotion={reducedMotion} runtime={runtime} />
      <RendererDiagnostics />
    </Canvas>
  </div>;
}

function HearttreeWorld({ cards, definition, reducedMotion, runtime }: { cards: readonly PortableCardAsset[]; definition: HearttreeExpeditionDefinition; reducedMotion: boolean; runtime: HearttreeRuntimeState }) {
  const activeCard = cards.find((card) => card.id === runtime.activeAssetId) ?? cards[0]!;
  const actor = runtime.cards[runtime.activeAssetId]!;
  return <>
    <color attach="background" args={["#0b241c"]} />
    <fog attach="fog" args={["#0b241c", 13, 34]} />
    <hemisphereLight intensity={1.15} color="#d9ffe9" groundColor="#183426" />
    <ambientLight intensity={0.82} color="#a9ffd5" />
    <directionalLight castShadow intensity={2.8} color="#fff0bd" position={[5, 9, 6]} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0003} />
    <spotLight castShadow angle={0.55} intensity={38} distance={22} penumbra={0.8} color="#57efac" position={[-4, 8, 2]} target-position={[0, 0, -2]} />
    <pointLight intensity={24} distance={16} color="#7affc7" position={[runtime.objective.position.x, 2, runtime.objective.position.z]} />
    <CameraFollow position={actor.position} reducedMotion={reducedMotion} />
    <WorldFloor />
    <RootArchitecture phase={runtime.phase} />
    <Hazards runtime={runtime} />
    <Objective runtime={runtime} />
    {runtime.phase === "master" ? <RootMaster health={runtime.boss.health / runtime.boss.maxHealth} reducedMotion={reducedMotion} /> : null}
    <group position={[actor.position.x, 0, actor.position.z]} rotation={[0, Math.PI, 0]}>
      <WildsCreatureActor
        accent={activeCard.manifest.variant.traits.palette.accent}
        familyId={activeCard.manifest.familyId}
        formId={activeCard.manifest.formId}
        pose={actor.health <= actor.maxHealth * 0.3 ? "weakened" : runtime.threatActive ? "attack" : "curious"}
        primary={activeCard.manifest.variant.traits.palette.primary}
      />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.48, 0.62, 36]} /><meshBasicMaterial color="#f6df75" transparent opacity={0.7} /></mesh>
    </group>
    {!reducedMotion ? <Sparkles count={55} scale={[14, 5, 10]} size={1.7} speed={0.18} color="#9effce" opacity={0.5} /> : null}
    <group name={`expedition-${definition.seedDigest.slice(7, 15)}`} />
  </>;
}

function CameraFollow({ position, reducedMotion }: { position: { x: number; z: number }; reducedMotion: boolean }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame(() => {
    const portrait = size.width / size.height < 0.75;
    target.current.set(position.x, portrait ? 6.8 : 5.6, position.z + (portrait ? 11.2 : 7.8));
    camera.position.lerp(target.current, reducedMotion ? 1 : 0.075);
    camera.lookAt(position.x + (portrait ? 0.35 : 0.7), 0.4, position.z - 0.6);
  });
  return null;
}

function WorldFloor() {
  const markers = useMemo(() => Array.from({ length: 28 }, (_, index) => ({ x: (index % 7) * 2 - 6, z: Math.floor(index / 7) * 2 - 3 })), []);
  return <group name="hearttree-world-layer-play">
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[24, 18, 32, 24]} /><meshStandardMaterial color="#1c4732" roughness={0.86} metalness={0.04} /></mesh>
    <mesh receiveShadow position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[4.9, 64]} /><meshStandardMaterial color="#163b2d" roughness={0.72} /></mesh>
    <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[4.15, 4.22, 64]} /><meshBasicMaterial color="#6bb778" transparent opacity={0.34} /></mesh>
    {markers.map((marker, index) => <mesh key={index} position={[marker.x, 0.035, marker.z]} rotation={[-Math.PI / 2, 0, index * 0.31]}><ringGeometry args={[0.18, 0.24, 6]} /><meshBasicMaterial color={index % 3 ? "#4a8f66" : "#9acc75"} transparent opacity={0.68} /></mesh>)}
  </group>;
}

function RootArchitecture({ phase }: { phase: HearttreeRuntimeState["phase"] }) {
  return <group name="hearttree-world-layer-mid">
    <RootSpine points={[[-5.7, 0, 2], [-5.4, 2.2, 0], [-4.8, 5.4, -2], [-2.2, 6.1, -5], [0, 5.7, -6]]} radius={0.58} />
    <RootSpine points={[[5.7, 0, 2], [5.4, 2.4, 0], [4.7, 5.2, -2], [2.3, 6.05, -5], [0, 5.7, -6]]} radius={0.58} />
    <RootSpine points={[[-6.6, 0.1, -4], [-4.2, 0.35, -3.2], [-2.3, 0.12, -2.6], [-0.8, 0.08, -3.8]]} radius={0.22} />
    <RootSpine points={[[6.6, 0.1, -4], [4.2, 0.35, -3.2], [2.3, 0.12, -2.6], [0.8, 0.08, -3.8]]} radius={0.22} />
    {[-1, 1].flatMap((side) => [0, 1, 2].map((index) => <LeafCluster key={`${side}:${index}`} position={[side * (4.7 + index * 0.35), 1.4 + index * 1.35, -1.7 - index * 0.9]} rotation={side * (0.35 + index * 0.5)} />))}
    {[-5.2, -2.8, 0, 2.8, 5.2].map((x, index) => <group key={x} position={[x, 0.45, -7.2]}>
      <mesh castShadow scale={[1.15, 1.1 + Math.abs(x) * 0.08, 0.9]} rotation={[0.1, index * 0.42, 0.1]}><dodecahedronGeometry args={[0.8, 1]} /><meshStandardMaterial color={index % 2 ? "#294a34" : "#213d2d"} roughness={0.9} /></mesh>
      <LeafCluster position={[0, 1.2, 0]} rotation={index * 0.7} />
    </group>)}
    <mesh position={[0, 4.6, -6.3]}><circleGeometry args={[1.65, 48]} /><meshBasicMaterial color={phase === "master" ? "#f0a04a" : "#65d79d"} transparent opacity={0.15} /></mesh>
  </group>;
}

function RootSpine({ points, radius }: { points: readonly [number, number, number][]; radius: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), [points]);
  return <mesh castShadow receiveShadow><tubeGeometry args={[curve, 48, radius, 9, false]} /><meshStandardMaterial color="#466d3f" emissive="#173c27" emissiveIntensity={0.18} roughness={0.72} /></mesh>;
}

function LeafCluster({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const shape = useMemo(() => {
    const leaf = new THREE.Shape();
    leaf.moveTo(0, -0.65);
    leaf.bezierCurveTo(0.7, -0.2, 0.65, 0.55, 0, 0.82);
    leaf.bezierCurveTo(-0.65, 0.55, -0.7, -0.2, 0, -0.65);
    return leaf;
  }, []);
  return <group position={position} rotation={[0.15, rotation, 0.15]}>
    {[0, 1, 2].map((index) => <mesh castShadow key={index} position={[Math.cos(index * 2.1) * 0.32, index * 0.16, Math.sin(index * 2.1) * 0.28]} rotation={[0, index * 2.1, index % 2 ? -0.45 : 0.45]} scale={[0.75, 0.75, 0.75]}>
      <shapeGeometry args={[shape, 8]} /><meshStandardMaterial color={index === 1 ? "#7aa95a" : "#4c8a50"} emissive="#1a4c31" emissiveIntensity={0.22} roughness={0.64} side={THREE.DoubleSide} />
    </mesh>)}
  </group>;
}

function Hazards({ runtime }: { runtime: HearttreeRuntimeState }) {
  return <group name="hearttree-hazards">{runtime.hazards.map((hazard) => <group key={hazard.id} position={[hazard.position.x, 0, hazard.position.z]}>
    {[0, 1, 2, 3, 4].map((index) => <mesh castShadow key={index} position={[Math.cos(index * 1.256) * 0.28, 0.25, Math.sin(index * 1.256) * 0.28]} rotation={[0.15, index * 1.256, 0]}><coneGeometry args={[0.11, 0.62, 5]} /><meshStandardMaterial color="#a73f32" emissive="#ff4a30" emissiveIntensity={0.55} roughness={0.48} /></mesh>)}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}><ringGeometry args={[hazard.radius, hazard.radius + 0.09, 30]} /><meshBasicMaterial color="#ff795c" transparent opacity={0.75} /></mesh>
  </group>)}</group>;
}

function Objective({ runtime }: { runtime: HearttreeRuntimeState }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (root.current) root.current.rotation.y = clock.elapsedTime * 0.7; });
  return <group ref={root} position={[runtime.objective.position.x, 0.9, runtime.objective.position.z]} name="hearttree-objective">
    <mesh castShadow><icosahedronGeometry args={[0.46, 1]} /><meshPhysicalMaterial color="#edffcb" emissive="#70e7a5" emissiveIntensity={1.6} roughness={0.18} clearcoat={0.9} /></mesh>
    <mesh scale={1.45} rotation={[0.45, 0.4, 0.2]}><icosahedronGeometry args={[0.46, 0]} /><meshBasicMaterial color="#d5ff98" wireframe transparent opacity={0.68} /></mesh>
    {[0, Math.PI / 2].map((angle) => <mesh key={angle} rotation={[Math.PI / 2, angle, angle * 0.5]}><torusGeometry args={[0.75, 0.028, 8, 48]} /><meshBasicMaterial color="#fff0a2" /></mesh>)}
  </group>;
}

function RendererDiagnostics() {
  const { gl, scene } = useThree();
  const frame = useRef(0);
  useFrame(() => {
    frame.current += 1;
    if (frame.current % 30) return;
    const root = globalThis as typeof globalThis & { __HEARTTREE_DIAGNOSTICS__?: unknown };
    root.__HEARTTREE_DIAGNOSTICS__ = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      objects: scene.children.length,
      dpr: gl.getPixelRatio(),
    };
  });
  return null;
}

function RootMaster({ health, reducedMotion }: { health: number; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (root.current && !reducedMotion) root.current.rotation.y = Math.sin(clock.elapsedTime * 0.55) * 0.16; });
  return <group ref={root} position={[4.2, 1.1, -1.8]} name="hearttree-root-master">
    <mesh castShadow scale={[1.4, 2.2, 1.1]}><dodecahedronGeometry args={[0.9, 1]} /><meshStandardMaterial color="#533b2c" emissive={health < 0.35 ? "#cb3d2f" : "#2d6c3f"} emissiveIntensity={0.45} roughness={0.78} /></mesh>
    {[-1, 1].map((side) => <mesh castShadow key={side} position={[side * 0.9, 0.7, 0]} rotation={[0, 0, side * -0.55]}><coneGeometry args={[0.28, 1.8, 7]} /><meshStandardMaterial color="#82673b" roughness={0.62} /></mesh>)}
    <mesh position={[0, 0.5, 0.86]}><sphereGeometry args={[0.2, 16, 12]} /><meshStandardMaterial color="#f7df77" emissive="#f7c948" emissiveIntensity={1.6} /></mesh>
  </group>;
}
