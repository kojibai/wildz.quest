"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import { WILDS_ECOLOGY_FAMILIES, type WildsEcologyFamilyId } from "./wilds-ecology";
import type { WildsSettlementWorldMode } from "./WildsSettlementEnvironment";
import type { WildsWorldEcologyProjection, WildsWorldProjection } from "./wilds-world-state";

export function WildsEcologyEnvironment({ livingWorld, player, worldMode }: {
  livingWorld?: WildsWorldProjection | null;
  player: { x: number; z: number };
  worldMode: WildsSettlementWorldMode;
}) {
  const sites = useMemo(() => Object.values(livingWorld?.ecologySites ?? {})
    .filter((site) => site.phase !== "expired" && site.phase !== "historical")
    .map((site) => ({ site, distance: Math.hypot(site.position.x - player.x, site.position.z - player.z) }))
    .filter((item) => item.distance <= 64)
    .sort((left, right) => left.distance - right.distance || left.site.id.localeCompare(right.site.id))
    .slice(0, 2), [livingWorld?.ecologySites, player.x, player.z]);
  const materials = useMemo(() => createMaterials(), []);
  const geometry = useMemo(() => createGeometry(), []);

  useEffect(() => () => {
    Object.values(materials).forEach((material) => material.dispose());
    Object.values(geometry).forEach((item) => item.dispose());
  }, [geometry, materials]);

  return <group name="wilds-regional-ecology">
    {sites.map(({ site }) => (
      <EcologyManifestation
        geometry={geometry}
        key={site.id}
        materials={materials}
        relative={{ x: site.position.x - player.x, z: site.position.z - player.z }}
        site={site}
        worldMode={worldMode}
      />
    ))}
  </group>;
}

function createMaterials() {
  return {
    earth: new THREE.MeshStandardMaterial({ color: "#344f43", roughness: .94 }),
    timber: new THREE.MeshStandardMaterial({ color: "#765035", roughness: .82 }),
    stone: new THREE.MeshStandardMaterial({ color: "#879289", roughness: .9 }),
    cloth: new THREE.MeshStandardMaterial({ color: "#dc756a", roughness: .74, side: THREE.DoubleSide }),
    teal: new THREE.MeshStandardMaterial({ color: "#58c9aa", emissive: "#1b7865", emissiveIntensity: .46, roughness: .42 }),
    gold: new THREE.MeshStandardMaterial({ color: "#f2c86b", emissive: "#8f5f16", emissiveIntensity: .5, metalness: .42, roughness: .32 }),
    prism: new THREE.MeshPhysicalMaterial({ color: "#9ddcff", emissive: "#415ee7", emissiveIntensity: .7, metalness: .12, roughness: .18, transmission: .12, transparent: true, opacity: .88 }),
    danger: new THREE.MeshStandardMaterial({ color: "#ff826d", emissive: "#a72e2e", emissiveIntensity: .68, roughness: .38 }),
    cloud: new THREE.MeshStandardMaterial({ color: "#4b5368", roughness: .9, transparent: true, opacity: .78 })
  };
}

function createGeometry() {
  return {
    beam: new THREE.BoxGeometry(1, 1, 1),
    post: new THREE.CylinderGeometry(.1, .14, 1, 7),
    ring: new THREE.TorusGeometry(1, .12, 8, 30),
    shard: new THREE.OctahedronGeometry(.3, 0),
    canopy: new THREE.ConeGeometry(1, .55, 6),
    creature: new THREE.DodecahedronGeometry(.28, 0),
    cloud: new THREE.DodecahedronGeometry(.65, 1)
  };
}

type Materials = ReturnType<typeof createMaterials>;
type Geometry = ReturnType<typeof createGeometry>;

function EcologyManifestation({ geometry, materials, relative, site, worldMode }: {
  geometry: Geometry;
  materials: Materials;
  relative: { x: number; z: number };
  site: WildsWorldEcologyProjection;
  worldMode: WildsSettlementWorldMode;
}) {
  return <group name={`ecology-${site.familyId}`} position={[relative.x, 0, relative.z]}>
    <mesh position={[0, .04, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[site.radius * .66, site.radius * .66, 1]}>
      <circleGeometry args={[1, 32]} />
      <primitive attach="material" object={materials.earth} />
    </mesh>
    <FamilyKit familyId={site.familyId} geometry={geometry} materials={materials} />
    <SignalInstances geometry={geometry} materials={materials} radius={Math.min(4.2, site.radius * .46)} />
    <Html center distanceFactor={11} position={[0, 3.55, 0]} zIndexRange={[8, 1]}>
      <div className="wilds-ecology-world-label"><strong>{site.name}</strong><span>{worldMode === "receiz_live" ? site.phase : `Practice · ${site.phase}`}</span></div>
    </Html>
  </group>;
}

function FamilyKit({ familyId, geometry, materials }: { familyId: WildsEcologyFamilyId; geometry: Geometry; materials: Materials }) {
  if (!WILDS_ECOLOGY_FAMILIES.includes(familyId)) return null;
  switch (familyId) {
    case "wandering-market": return <MarketKit geometry={geometry} materials={materials} />;
    case "echo-ruin": return <RuinKit geometry={geometry} materials={materials} />;
    case "unstable-portal": return <PortalKit geometry={geometry} materials={materials} />;
    case "convergence-festival": return <FestivalKit geometry={geometry} materials={materials} />;
    case "creature-migration": return <MigrationKit geometry={geometry} materials={materials} />;
    case "resource-bloom": return <BloomKit geometry={geometry} materials={materials} />;
    case "stormfront": return <StormKit geometry={geometry} materials={materials} />;
    case "settlement-distress": return <DistressKit geometry={geometry} materials={materials} />;
  }
}

function Shared({ geometry, material, ...props }: { geometry: THREE.BufferGeometry; material: THREE.Material } & ComponentProps<"mesh">) {
  return <mesh {...props}><primitive attach="geometry" object={geometry} /><primitive attach="material" object={material} /></mesh>;
}

function MarketKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="wandering-market">
    {[-2.1, 0, 2.1].map((x, index) => <group key={x} position={[x, 0, index % 2 ? -.5 : .5]}>
      <Shared geometry={geometry.post} material={materials.timber} position={[-.7, .85, 0]} scale={[1, 1.7, 1]} />
      <Shared geometry={geometry.post} material={materials.timber} position={[.7, .85, 0]} scale={[1, 1.7, 1]} />
      <Shared geometry={geometry.canopy} material={index === 1 ? materials.gold : materials.cloth} position={[0, 1.85, 0]} scale={[1.15, 1, 1.15]} />
      <Shared geometry={geometry.beam} material={materials.timber} position={[0, .62, 0]} scale={[1.65, .18, 1.05]} />
    </group>)}
  </group>;
}

function RuinKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="echo-ruin">
    {[-1.5, 1.5].map((x) => <Shared castShadow geometry={geometry.beam} key={x} material={materials.stone} position={[x, 1.4, 0]} scale={[.6, 2.8, .7]} />)}
    <Shared castShadow geometry={geometry.beam} material={materials.stone} position={[0, 2.65, 0]} rotation={[0, 0, .08]} scale={[3.5, .55, .7]} />
    <Shared geometry={geometry.shard} material={materials.prism} position={[0, .72, 0]} scale={[1.35, 2.1, 1.35]} />
  </group>;
}

function PortalKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (root.current) root.current.rotation.y = clock.elapsedTime * .22; });
  return <group name="unstable-portal" position={[0, 1.85, 0]} ref={root}>
    {[0, 1, 2].map((index) => <Shared geometry={geometry.ring} key={index} material={index === 1 ? materials.gold : materials.prism} rotation={[index * .7, index * .45, 0]} scale={1 + index * .34} />)}
    <pointLight color="#809cff" distance={8} intensity={1.5} />
  </group>;
}

function FestivalKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="convergence-festival">
    <Shared geometry={geometry.post} material={materials.gold} position={[0, 1.7, 0]} scale={[1.35, 3.4, 1.35]} />
    {[1.2, 2.1, 3].map((radius, index) => <Shared geometry={geometry.ring} key={radius} material={index % 2 ? materials.cloth : materials.teal} position={[0, 1.2 + index * .55, 0]} rotation={[-Math.PI / 2, 0, index * .4]} scale={radius} />)}
    <Shared geometry={geometry.canopy} material={materials.cloth} position={[0, 3.45, 0]} scale={[.68, 1.15, .68]} />
  </group>;
}

function MigrationKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="creature-migration"><MovingInstances count={9} geometry={geometry.creature} material={materials.teal} /></group>;
}

function BloomKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="resource-bloom"><MovingInstances count={11} geometry={geometry.shard} material={materials.gold} vertical /></group>;
}

function StormKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="stormfront">
    {[-2.2, 0, 2.2].map((x) => <group key={x} position={[x, 0, 0]}>
      <Shared geometry={geometry.post} material={materials.danger} position={[0, 1.35, 0]} scale={[1.6, 2.7, 1.6]} />
      <Shared geometry={geometry.shard} material={materials.prism} position={[0, 2.85, 0]} scale={[1.1, 1.7, 1.1]} />
    </group>)}
    {[-1.2, 0, 1.2].map((x) => <Shared geometry={geometry.cloud} key={x} material={materials.cloud} position={[x, 4.05 + Math.abs(x) * .2, 0]} scale={[1.8, .72, 1.15]} />)}
  </group>;
}

function DistressKit({ geometry, materials }: { geometry: Geometry; materials: Materials }) {
  return <group name="settlement-distress">
    {[-2.4, 0, 2.4].map((x) => <group key={x} position={[x, 0, 0]}>
      <Shared geometry={geometry.beam} material={materials.stone} position={[0, .55, 0]} scale={[1.35, 1.1, .75]} />
      <Shared geometry={geometry.shard} material={materials.danger} position={[0, 1.65, 0]} scale={[.8, 1.3, .8]} />
    </group>)}
    <Shared geometry={geometry.beam} material={materials.gold} position={[0, .22, 0]} rotation={[0, .28, 0]} scale={[4.8, .22, .38]} />
  </group>;
}

function SignalInstances({ geometry, materials, radius }: { geometry: Geometry; materials: Materials; radius: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      matrix.compose(new THREE.Vector3(Math.cos(angle) * radius, .18, Math.sin(angle) * radius), new THREE.Quaternion(), new THREE.Vector3(.42, .62, .42));
      mesh.current?.setMatrixAt(index, matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [radius]);
  return <instancedMesh args={[geometry.shard, materials.prism, 6]} ref={mesh} />;
}

function MovingInstances({ count, geometry, material, vertical = false }: { count: number; geometry: THREE.BufferGeometry; material: THREE.Material; vertical?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + clock.elapsedTime * (vertical ? .08 : .16);
      const radius = 1.2 + (index % 3) * .72;
      matrix.compose(
        new THREE.Vector3(Math.cos(angle) * radius, vertical ? .42 + Math.sin(clock.elapsedTime * 1.5 + index) * .2 : .34, Math.sin(angle) * radius),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, vertical ? .2 : 0)),
        new THREE.Vector3(vertical ? .7 : 1.2, vertical ? 1.6 : .78, vertical ? .7 : .9)
      );
      mesh.current?.setMatrixAt(index, matrix);
    }
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh args={[geometry, material, count]} ref={mesh} />;
}
