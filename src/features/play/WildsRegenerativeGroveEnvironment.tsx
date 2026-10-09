"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsRegenerativeGroveV1 } from "./wilds-regenerative-grove";
import { projectWildsTerrainActorPosition } from "./wilds-terrain-rendering";
import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";

function createGroveGeometry() {
  return {
    trunk: new THREE.CylinderGeometry(.18, .28, 1, 8),
    canopy: new THREE.IcosahedronGeometry(.72, 1),
    flower: new THREE.OctahedronGeometry(.1, 0),
    hive: new THREE.CylinderGeometry(.42, .55, .8, 10),
    nursery: new THREE.TorusGeometry(.72, .08, 8, 24),
    pollinator: new THREE.SphereGeometry(.065, 8, 6),
    earth: new THREE.CircleGeometry(1, 32)
  };
}

function createGroveMaterials() {
  return {
    trunk: new THREE.MeshStandardMaterial({ color: "#5f4333", roughness: .9 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#2f8c5c", roughness: .72 }),
    youngLeaf: new THREE.MeshStandardMaterial({ color: "#78d872", emissive: "#1d6336", emissiveIntensity: .18, roughness: .68 }),
    flower: new THREE.MeshStandardMaterial({ color: "#d7a5ff", emissive: "#633c8f", emissiveIntensity: .24, roughness: .48 }),
    honey: new THREE.MeshPhysicalMaterial({ color: "#f4b846", emissive: "#8b5210", emissiveIntensity: .25, roughness: .32 }),
    earth: new THREE.MeshStandardMaterial({ color: "#314b3d", roughness: 1 }),
    water: new THREE.MeshPhysicalMaterial({ color: "#65cbd0", transparent: true, opacity: .34, roughness: .2 }),
    pollinator: new THREE.MeshStandardMaterial({ color: "#f7d56d", emissive: "#7a5b14", emissiveIntensity: .35 })
  };
}

type GroveGeometry = ReturnType<typeof createGroveGeometry>;
type GroveMaterials = ReturnType<typeof createGroveMaterials>;

export function WildsRegenerativeGroveEnvironment({ livingWorld, player, terrainElevation, siteRuntime }: {
  livingWorld?: WildsWorldProjection | null;
  player: Readonly<{ x: number; z: number }>;
  terrainElevation: number;
  siteRuntime?: WildsSiteRuntimeProjection;
}) {
  const groves = useMemo(() => Object.values(livingWorld?.groves ?? {})
    .map((grove) => ({ grove, distance: Math.hypot(grove.position.x - player.x, grove.position.z - player.z) }))
    .filter(({ distance }) => distance <= 72)
    .sort((left, right) => left.distance - right.distance || left.grove.groveId.localeCompare(right.grove.groveId))
    .slice(0, 4), [livingWorld?.groves, player.x, player.z]);
  const geometry = useMemo(createGroveGeometry, []);
  const materials = useMemo(createGroveMaterials, []);

  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
    Object.values(materials).forEach((item) => item.dispose());
  }, [geometry, materials]);

  return <group name="wilds-regenerative-groves">
    {groves.map(({ grove }) => {
      const mountainY=siteRuntime?wildsSiteRuntimeGroundY(siteRuntime,"wildz.space.outer.v1",grove.position.x,grove.position.z,Number.NaN):Number.NaN;
      const position=projectWildsTerrainActorPosition(grove.position,player,0,{actorElevation:Number.isFinite(mountainY)?mountainY:undefined,anchorElevation:terrainElevation});
      return <GroveManifestation
      geometry={geometry}
      grove={grove}
      key={grove.groveId}
      materials={materials}
      siteRuntime={siteRuntime}
      groundY={position[1]+terrainElevation}
      position={position}
    />;})}
  </group>;
}

function Shared({ geometry, material, ...props }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
} & ComponentProps<"mesh">) {
  return <mesh {...props}><primitive attach="geometry" object={geometry} /><primitive attach="material" object={material} /></mesh>;
}

function GroveManifestation({ grove, geometry, materials, position, siteRuntime, groundY }: {
  grove: WildsRegenerativeGroveV1;
  geometry: GroveGeometry;
  materials: GroveMaterials;
  position: [number, number, number];
  siteRuntime?: WildsSiteRuntimeProjection;
  groundY: number;
}) {
  const maturity = Math.min(1.35, .7 + grove.ecology.maturity / 100);
  const trees = Math.max(3, Math.min(7, 3 + Math.floor(grove.ecology.maturity / 20)));
  const flowers = Math.max(3, Math.min(18, grove.ecology.flowers));
  // Static foliage only samples when its grove or prepared mountain data changes.
  const floors=useMemo(()=>{
    const height=(x:number,z:number)=>{
      const y=siteRuntime?wildsSiteRuntimeGroundY(siteRuntime,"wildz.space.outer.v1",grove.position.x+x,grove.position.z+z,Number.NaN):Number.NaN;
      return Number.isFinite(y)?y-groundY:0;
    };
    return {
      trees:Array.from({length:trees},(_,i)=>{const a=i/trees*Math.PI*2,r=i===0?0:2.1+(i%2)*.65;return height(Math.cos(a)*r,Math.sin(a)*r);}),
      flowers:Array.from({length:flowers},(_,i)=>{const a=i*2.399963,r=1.15+(i%5)*.55;return height(Math.cos(a)*r,Math.sin(a)*r);}),
      hive:height(1.35,.75),nursery:height(-1.25,.5)
    };
  },[siteRuntime,grove.position.x,grove.position.z,groundY,trees,flowers]);
  return <group name={`regenerative-grove-${grove.groveId}`} position={position}>
    <Shared geometry={geometry.earth} material={materials.earth} rotation={[-Math.PI / 2, 0, 0]} scale={[4.8, 4.8, 1]} position={[0, .025, 0]} />
    {grove.ecology.moisture > 45 ? <Shared geometry={geometry.earth} material={materials.water} rotation={[-Math.PI / 2, 0, 0]} scale={[2.4, 1.15, 1]} position={[.6, .045, -.7]} /> : null}
    {Array.from({ length: trees }, (_, index) => {
      const angle = index / trees * Math.PI * 2;
      const radius = index === 0 ? 0 : 2.1 + (index % 2) * .65;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = (1.8 + (index % 3) * .22) * maturity;
      return <group key={`tree:${index}`} position={[x, floors.trees[index]!, z]} rotation={[0, angle * .35, 0]}>
        <Shared castShadow geometry={geometry.trunk} material={materials.trunk} position={[0, height / 2, 0]} scale={[1, height, 1]} />
        <Shared castShadow geometry={geometry.canopy} material={index % 2 ? materials.leaf : materials.youngLeaf} position={[0, height + .55, 0]} scale={[1.2 + maturity * .2, .95 + maturity * .18, 1.2 + maturity * .2]} />
      </group>;
    })}
    {Array.from({ length: flowers }, (_, index) => {
      const angle = index * 2.399963;
      const radius = 1.15 + (index % 5) * .55;
      return <Shared key={`flower:${index}`} geometry={geometry.flower} material={materials.flower} position={[Math.cos(angle) * radius, .16+floors.flowers[index]!, Math.sin(angle) * radius]} rotation={[0, angle, .2]} scale={.8 + (index % 3) * .18} />;
    })}
    {grove.structures.hive > 0 ? <Shared castShadow geometry={geometry.hive} material={materials.honey} position={[1.35, .52+floors.hive, .75]} /> : null}
    {grove.structures.nursery > 0 ? <Shared geometry={geometry.nursery} material={materials.youngLeaf} rotation={[-Math.PI / 2, 0, 0]} position={[-1.25, .14+floors.nursery, .5]} /> : null}
    <GrovePollinators count={Math.max(1, Math.min(8, grove.ecology.pollinators))} geometry={geometry.pollinator} material={materials.pollinator} siteRuntime={siteRuntime} groundY={groundY} position={grove.position} />
  </group>;
}

function GrovePollinators({ count, geometry, material, siteRuntime, groundY, position }: { count: number; geometry: THREE.BufferGeometry; material: THREE.Material; siteRuntime?: WildsSiteRuntimeProjection; groundY: number; position: {x:number;z:number} }) {
  const root = useRef<THREE.Group>(null);
  const groundAdjusted=useRef(false);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const time = clock.elapsedTime;
    root.current.rotation.y = time * .18;
    root.current.position.y = 1.15 + Math.sin(time * 1.7) * .12;
    if(siteRuntime?.physical.mountainFields.length) {
      groundAdjusted.current=true;
      const cos=Math.cos(root.current.rotation.y),sin=Math.sin(root.current.rotation.y);
      for(let i=0;i<root.current.children.length;i++) {
        const child=root.current.children[i]!,x=child.position.x,z=child.position.z;
        const y=wildsSiteRuntimeGroundY(siteRuntime,"wildz.space.outer.v1",position.x+x*cos+z*sin,position.z+z*cos-x*sin,Number.NaN);
        child.position.y=(i%2)*.18+(Number.isFinite(y)?y-groundY:0);
      }
    } else if(groundAdjusted.current) {
      for(let i=0;i<root.current.children.length;i++)root.current.children[i]!.position.y=(i%2)*.18;
      groundAdjusted.current=false;
    }
  });
  return <group name="grove-pollinators" ref={root}>
    {Array.from({ length: count }, (_, index) => {
      const angle = index / count * Math.PI * 2;
      const radius = 1.2 + (index % 3) * .45;
      return <Shared key={index} geometry={geometry} material={material} position={[Math.cos(angle) * radius, (index % 2) * .18, Math.sin(angle) * radius]} scale={[1.35, .75, .8]} />;
    })}
  </group>;
}
