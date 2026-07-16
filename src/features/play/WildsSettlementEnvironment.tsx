"use client";

import { Html } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WildsSettlementDefinition } from "./wilds-settlements";
import type { WildsWorldProjection } from "./wilds-world-state";

export type WildsSettlementWorldMode = "receiz_live" | "local_practice" | "connecting";

export function WildsSettlementEnvironment({
  settlement,
  relative,
  livingWorld,
  worldMode
}: {
  settlement: WildsSettlementDefinition;
  relative: { x: number; z: number };
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
}) {
  const materials = useMemo(() => ({
    timber: new THREE.MeshStandardMaterial({ color: "#5a3825", roughness: .88 }),
    timberLight: new THREE.MeshStandardMaterial({ color: "#9a6b3f", roughness: .78 }),
    plaster: new THREE.MeshStandardMaterial({ color: "#e4d7ad", roughness: .84 }),
    roof: new THREE.MeshStandardMaterial({ color: "#244f49", roughness: .72, metalness: .08 }),
    stone: new THREE.MeshStandardMaterial({ color: "#718177", roughness: .94 }),
    gold: new THREE.MeshStandardMaterial({ color: settlement.accent, emissive: "#8a5a12", emissiveIntensity: .34, metalness: .48, roughness: .3 }),
    moss: new THREE.MeshStandardMaterial({ color: "#5d9b67", roughness: .9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#bfefff", emissive: "#2c8f9e", emissiveIntensity: .42, metalness: .06, roughness: .16, transmission: .16, transparent: true, opacity: .86 }),
    card: new THREE.MeshPhysicalMaterial({ color: "#ffe5a2", emissive: "#d8962b", emissiveIntensity: .72, clearcoat: .7, clearcoatRoughness: .2, roughness: .28 })
  }), [settlement.accent]);
  const geometry = useMemo(() => ({
    post: new THREE.CylinderGeometry(.13, .18, 2.5, 8),
    beam: new THREE.BoxGeometry(1, 1, 1),
    lamp: new THREE.OctahedronGeometry(.13, 0),
    paving: new THREE.CylinderGeometry(1, 1, .1, 32),
    glass: new THREE.OctahedronGeometry(.48, 1)
  }), []);

  useEffect(() => () => {
    Object.values(materials).forEach((material) => material.dispose());
    Object.values(geometry).forEach((item) => item.dispose());
  }, [geometry, materials]);

  return (
    <group name="wayfinder-hollow-settlement" position={[relative.x, 0, relative.z]}>
      <SettlementPaths material={materials.stone} />
      <TrailGate geometry={geometry} materials={materials} />
      <DawnCommons geometry={geometry} materials={materials} />
      <MosslightAtelier geometry={geometry} materials={materials} />
      <CartographerHouse materials={materials} />
      <MonumentWalk geometry={geometry} livingWorld={livingWorld} materials={materials} worldMode={worldMode} />
      <SettlementLamps geometry={geometry} materials={materials} />
    </group>
  );
}

type Materials = Record<"timber" | "timberLight" | "plaster" | "roof" | "stone" | "gold" | "moss" | "glass" | "card", THREE.Material>;
type Geometry = Record<"post" | "beam" | "lamp" | "paving" | "glass", THREE.BufferGeometry>;

function SharedMesh({ geometry, material, ...props }: { geometry: THREE.BufferGeometry; material: THREE.Material } & React.ComponentProps<"mesh">) {
  return <mesh {...props}><primitive attach="geometry" object={geometry} /><primitive attach="material" object={material} /></mesh>;
}

function SettlementPaths({ material }: { material: THREE.Material }) {
  return <group name="settlement-path-network">
    <mesh position={[0, .015, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[3.25, 40]} /><primitive attach="material" object={material} /></mesh>
    {[
      { position: [3.8, .02, 4.2] as const, rotation: -Math.PI / 4, length: 11 },
      { position: [-3.2, .02, -1.4] as const, rotation: Math.PI / 2.7, length: 7.4 },
      { position: [3.2, .02, -1.6] as const, rotation: -Math.PI / 2.7, length: 7.2 },
      { position: [0, .02, -4.5] as const, rotation: 0, length: 9 }
    ].map((path, index) => <mesh key={index} position={path.position} rotation={[-Math.PI / 2, 0, path.rotation]}><planeGeometry args={[1.15, path.length]} /><primitive attach="material" object={material} /></mesh>)}
  </group>;
}

function TrailGate({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="district-trail-gate" position={[8, 0, 8]} rotation={[0, Math.PI / 4, 0]}>
    {[-1, 1].map((side) => <SharedMesh castShadow geometry={geometry.post} key={side} material={materials.timber} position={[side * 1.45, 1.25, 0]} />)}
    <SharedMesh castShadow geometry={geometry.beam} material={materials.timberLight} position={[0, 2.48, 0]} scale={[3.5, .28, .42]} />
    <SharedMesh geometry={geometry.beam} material={materials.gold} position={[0, 2.5, .24]} rotation={[0, 0, Math.PI / 4]} scale={[.72, .12, .08]} />
    <SharedMesh geometry={geometry.beam} material={materials.gold} position={[0, 2.5, .25]} rotation={[0, 0, -Math.PI / 4]} scale={[.72, .12, .08]} />
    <mesh castShadow position={[-1.45, 2.65, 0]}><coneGeometry args={[.34, .8, 6]} /><primitive attach="material" object={materials.roof} /></mesh>
    <mesh castShadow position={[1.45, 2.65, 0]}><coneGeometry args={[.34, .8, 6]} /><primitive attach="material" object={materials.roof} /></mesh>
  </group>;
}

function DawnCommons({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="district-dawn-commons" position={[0, 0, 1]}>
    <SharedMesh geometry={geometry.paving} material={materials.plaster} position={[0, .05, 0]} scale={[3.1, 1, 3.1]} />
    <TimberHall materials={materials} />
    <CompassGarden materials={materials} />
  </group>;
}

function TimberHall({ materials }: { materials: Materials }) {
  return <group name="wayfinder-timber-hall" position={[0, 0, 1.25]}>
    <mesh castShadow position={[0, 1.25, 0]}><boxGeometry args={[4.4, 2.5, 2.8]} /><primitive attach="material" object={materials.plaster} /></mesh>
    {[-1.65, 1.65].map((x) => <mesh castShadow key={x} position={[x, 1.3, 1.43]}><boxGeometry args={[.2, 2.6, .18]} /><primitive attach="material" object={materials.timber} /></mesh>)}
    <mesh castShadow position={[0, 2.72, 0]} rotation={[0, Math.PI / 4, 0]} scale={[3.25, 1, 2.25]}><octahedronGeometry args={[1, 0]} /><primitive attach="material" object={materials.roof} /></mesh>
    <mesh position={[0, 1.12, 1.47]}><boxGeometry args={[.92, 1.72, .12]} /><primitive attach="material" object={materials.timber} /></mesh>
    {[-1.22, 1.22].map((x) => <mesh key={x} position={[x, 1.42, 1.47]}><boxGeometry args={[.62, .72, .1]} /><primitive attach="material" object={materials.glass} /></mesh>)}
  </group>;
}

function CompassGarden({ materials }: { materials: Materials }) {
  const needle = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (needle.current) needle.current.rotation.y = Math.sin(clock.elapsedTime * .35) * .28;
  });
  return <group name="commons-compass-garden" position={[0, .15, -2.05]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.92, .11, 8, 36]} /><primitive attach="material" object={materials.gold} /></mesh>
    <group ref={needle}>
      <mesh position={[0, .08, 0]} rotation={[0, 0, 0]}><coneGeometry args={[.18, 1.35, 4]} /><primitive attach="material" object={materials.card} /></mesh>
      <mesh position={[0, .07, 0]} rotation={[0, Math.PI, 0]}><coneGeometry args={[.12, .78, 4]} /><primitive attach="material" object={materials.roof} /></mesh>
    </group>
  </group>;
}

function MosslightAtelier({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="district-mosslight-atelier" position={[-6, 0, -3]} rotation={[0, .55, 0]}>
    <mesh castShadow position={[0, 1.05, 0]}><cylinderGeometry args={[1.65, 1.9, 2.1, 10]} /><primitive attach="material" object={materials.timberLight} /></mesh>
    <mesh castShadow position={[0, 2.42, 0]}><coneGeometry args={[2.05, 1.3, 10]} /><primitive attach="material" object={materials.moss} /></mesh>
    <mesh position={[0, 1.42, 1.78]} rotation={[0, 0, .08]} scale={[.72, .98, .12]}><primitive attach="geometry" object={geometry.beam} /><primitive attach="material" object={materials.card} /></mesh>
    <mesh position={[0, 1.42, 1.86]}><torusGeometry args={[.24, .04, 6, 24]} /><primitive attach="material" object={materials.gold} /></mesh>
    <pointLight color="#8ff0a4" distance={6} intensity={1.5} position={[0, 2.2, 1.2]} />
  </group>;
}

function CartographerHouse({ materials }: { materials: Materials }) {
  return <group name="district-cartographer-house" position={[6, 0, -4]} rotation={[0, -.42, 0]}>
    <mesh castShadow position={[0, 1.55, 0]}><cylinderGeometry args={[1.15, 1.42, 3.1, 8]} /><primitive attach="material" object={materials.plaster} /></mesh>
    <mesh castShadow position={[0, 3.28, 0]}><coneGeometry args={[1.62, 1.52, 8]} /><primitive attach="material" object={materials.roof} /></mesh>
    {[-.48, .48].map((x) => <mesh key={x} position={[x, 1.9, 1.2]}><boxGeometry args={[.42, .82, .12]} /><primitive attach="material" object={materials.glass} /></mesh>)}
    <mesh position={[0, 4.24, 0]}><sphereGeometry args={[.22, 12, 8]} /><primitive attach="material" object={materials.gold} /></mesh>
    <mesh position={[0, 4.58, 0]} rotation={[0, 0, -.28]}><coneGeometry args={[.14, .72, 4]} /><primitive attach="material" object={materials.card} /></mesh>
  </group>;
}

function MonumentWalk({ geometry, livingWorld, materials, worldMode }: { geometry: Geometry; livingWorld?: WildsWorldProjection | null; materials: Materials; worldMode: WildsSettlementWorldMode }) {
  const monumentIds = livingWorld?.defeatedBossIds.slice(-6) ?? [];
  const canonical = worldMode === "receiz_live";
  return <group name="district-monument-walk" position={[0, 0, -8]}>
    <mesh position={[0, .12, 0]}><boxGeometry args={[6.4, .24, 1.55]} /><primitive attach="material" object={materials.stone} /></mesh>
    {(monumentIds.length ? monumentIds : ["awaiting-first-victory"]).map((bossId, index, list) => {
      const x = (index - (list.length - 1) / 2) * .92;
      return <group key={bossId} name={`world-memory-${bossId}`} position={[x, .68, 0]}>
        <SharedMesh geometry={geometry.glass} material={materials.glass} scale={monumentIds.length ? 1 : .72} />
        <mesh position={[0, -.52, 0]}><cylinderGeometry args={[.32, .42, .3, 10]} /><primitive attach="material" object={materials.gold} /></mesh>
      </group>;
    })}
    <Html center distanceFactor={10} position={[0, 2, 0]} zIndexRange={[10, 1]}>
      <div className="wilds-settlement-memory-label"><strong>{canonical ? "Canonical world memory" : "Practice memory"}</strong><span>{canonical ? `${monumentIds.length} shared victories remembered` : "Not shared world truth"}</span></div>
    </Html>
  </group>;
}

function SettlementLamps({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  const posts = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => [[5.2, 5.6], [2.5, 2.7], [-2.5, 2.3], [-4.2, -1.8], [3.9, -2.3], [-1.8, -5.7], [1.8, -5.7]] as const, []);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    positions.forEach(([x, z], index) => {
      matrix.compose(new THREE.Vector3(x, .8, z), new THREE.Quaternion(), new THREE.Vector3(.42, .62, .42));
      posts.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(x, 1.62, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      lights.current?.setMatrixAt(index, matrix);
    });
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
    if (lights.current) lights.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return <group name="settlement-lamp-kit">
    <instancedMesh args={[geometry.post, materials.timber, positions.length]} castShadow ref={posts} />
    <instancedMesh args={[geometry.lamp, materials.card, positions.length]} ref={lights} />
  </group>;
}
