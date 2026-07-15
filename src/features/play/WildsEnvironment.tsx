"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { PlayState } from "@/features/play/game-state";
import { projectWildsBiome, type WildsBiomeTile } from "@/features/play/wilds-biome";
import type { WildsQualityProfile } from "@/features/play/wilds-quality-profile";
import { WILDS_MAJOR_ROUTES } from "@/features/play/wilds-world-geography";
import { projectVisibleLandmarkEntrances, type WildsLandmarkDefinition } from "@/features/play/wilds-landmarks";

export const WILDS_TILE_SIZE = 12;
const STREAM_RADIUS = 2;

type Tile = WildsBiomeTile & { key: string; tileX: number; tileZ: number };
type Placement = { x: number; z: number; scale: number; variant: number };

function seededUnit(seed: number, salt: number) {
  const value = Math.sin(seed * 0.0000137 + salt * 91.733) * 43758.5453123;
  return value - Math.floor(value);
}

function placements(tiles: Tile[], kind: keyof Tile["ecology"], salt: number, density: number) {
  return tiles.flatMap((tile) => {
    const count = Math.max(1, Math.round(tile.ecology[kind] * density));
    return Array.from({ length: count }, (_, slot): Placement => ({
      x: tile.tileX * WILDS_TILE_SIZE + 0.9 + seededUnit(tile.seed, salt + slot * 3) * 10.2,
      z: tile.tileZ * WILDS_TILE_SIZE + 0.9 + seededUnit(tile.seed, salt + slot * 3 + 1) * 10.2,
      scale: 0.72 + seededUnit(tile.seed, salt + slot * 3 + 2) * 0.62,
      variant: Math.floor(seededUnit(tile.seed, salt + slot * 5 + 4) * 3)
    }));
  });
}

function useInstances(
  mesh: React.RefObject<THREE.InstancedMesh | null>,
  items: Placement[],
  player: PlayState["player"],
  y: number,
  shape: (item: Placement) => [number, number, number]
) {
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    items.forEach((item, index) => {
      const shaped = shape(item);
      scale.set(shaped[0], shaped[1], shaped[2]);
      quaternion.setFromEuler(new THREE.Euler(0, seededUnit(index, item.variant + 17) * Math.PI * 2, 0));
      matrix.compose(new THREE.Vector3(item.x - player.x, y, item.z - player.z), quaternion, scale);
      mesh.current?.setMatrixAt(index, matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [items, mesh, player.x, player.z, shape, y]);
}

export function WildsEnvironment({
  player,
  missionProgress,
  worldMastery,
  qualityProfile
}: {
  player: PlayState["player"];
  missionProgress: number;
  worldMastery: number;
  qualityProfile: WildsQualityProfile;
}) {
  const centerX = Math.floor(player.x / WILDS_TILE_SIZE);
  const centerZ = Math.floor(player.z / WILDS_TILE_SIZE);
  const tiles = useMemo(() => {
    const projected: Tile[] = [];
    for (let dz = -STREAM_RADIUS; dz <= STREAM_RADIUS; dz += 1) {
      for (let dx = -STREAM_RADIUS; dx <= STREAM_RADIUS; dx += 1) {
        const tileX = centerX + dx;
        const tileZ = centerZ + dz;
        projected.push({ key: `${tileX}:${tileZ}`, tileX, tileZ, ...projectWildsBiome(tileX, tileZ, missionProgress, worldMastery) });
      }
    }
    return projected;
  }, [centerX, centerZ, missionProgress, worldMastery]);

  const trees = useMemo(() => placements(tiles, "treeCount", 101, qualityProfile.foliage), [qualityProfile.foliage, tiles]);
  const bushes = useMemo(() => placements(tiles, "bushCount", 211, qualityProfile.foliage), [qualityProfile.foliage, tiles]);
  const rocks = useMemo(() => placements(tiles, "rockCount", 307, qualityProfile.foliage), [qualityProfile.foliage, tiles]);
  const flowers = useMemo(() => placements(tiles, "flowerCount", 401, qualityProfile.foliage), [qualityProfile.foliage, tiles]);

  return (
    <group>
      <group name="world-layer-play">
        <GroundField centerX={centerX} centerZ={centerZ} color={tiles[12]?.ground.base ?? "#4f9254"} player={player} />
        <TrailNetwork player={player} palette={tiles[12]?.trail ?? { base: "#cbb778", edge: "#9b8b56" }} />
        <MajorWorldRoutes player={player} palette={tiles[12]?.trail ?? { base: "#cbb778", edge: "#9b8b56" }} />
      </group>
      <group name="world-layer-mid">
        <EcologyInstances bushes={bushes} flowers={flowers} palette={tiles[12]?.canopy} player={player} rocks={rocks} trees={trees} />
        <FlagshipLandmarkEntrances player={player} />
        {tiles.filter((tile) => tile.landmark.kind !== "none" && tile.landmark.kind !== "hearttree-sanctum").map((tile) => (
          <Landmark key={`landmark:${tile.key}`} player={player} tile={tile} />
        ))}
      </group>
      <group name="world-layer-far">
        <FarCanopy centerX={centerX} centerZ={centerZ} player={player} />
      </group>
    </group>
  );
}

function FlagshipLandmarkEntrances({ player }: { player: PlayState["player"] }) {
  const entrances = projectVisibleLandmarkEntrances(player);
  return <group name="world-flagship-landmarks">
    {entrances.map(({ landmark, relative, distance }) => (
      <group key={landmark.id} name={`world-entrance-${landmark.id}`} position={[relative.x, 0, relative.z]}>
        {landmark.id === "hearttree-sanctum" ? <HearttreeSanctum /> : null}
        {landmark.id === "arena-of-echoes" ? <ArenaOfEchoes /> : null}
        {landmark.id === "prism-arcade" ? <PrismArcade /> : null}
        <LandmarkEntranceBeacon distance={distance} landmark={landmark} />
      </group>
    ))}
  </group>;
}

function LandmarkEntranceBeacon({ landmark, distance }: { landmark: WildsLandmarkDefinition; distance: number }) {
  return <group name={`entrance-beacon-${landmark.id}`}>
    <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[landmark.radius * .7, .08, 8, 64]} />
      <meshStandardMaterial color={landmark.accent} emissive={landmark.accent} emissiveIntensity={1.3} transparent opacity={.82} />
    </mesh>
    <mesh position={[0, 4.3, 0]}>
      <cylinderGeometry args={[.035, .16, 8.4, 10]} />
      <meshBasicMaterial color={landmark.accent} transparent opacity={.34} />
    </mesh>
    <Html center distanceFactor={9} position={[0, 6.15, 0]} zIndexRange={[14, 1]}>
      <div className="wilds-landmark-wayfinder" style={{ "--landmark-accent": landmark.accent } as React.CSSProperties}>
        <span>{Math.max(0, Math.round(distance - landmark.radius))}m</span>
        <strong>{landmark.name}</strong>
        <small>Entrance ahead</small>
      </div>
    </Html>
  </group>;
}

function MajorWorldRoutes({ player, palette }: { player: PlayState["player"]; palette: WildsBiomeTile["trail"] }) {
  const routes = useMemo(() => WILDS_MAJOR_ROUTES.map((route) => ({
    ...route,
    curve: new THREE.CatmullRomCurve3(route.points.map((point) => new THREE.Vector3(point.x, .024, point.z)))
  })), []);
  return <group name="world-major-routes" position={[-player.x, 0, -player.z]}>
    {routes.map((route, index) => <group key={route.id} name={`world-route-${route.id}`}>
      <mesh><tubeGeometry args={[route.curve, 160, index ? .42 : .54, 7, false]} /><meshStandardMaterial color={palette.edge} roughness={.98} /></mesh>
      <mesh><tubeGeometry args={[route.curve, 160, index ? .28 : .36, 7, false]} /><meshStandardMaterial color={palette.base} roughness={.91} /></mesh>
    </group>)}
  </group>;
}

function GroundField({ centerX, centerZ, color, player }: { centerX: number; centerZ: number; color: string; player: PlayState["player"] }) {
  return (
    <mesh
      receiveShadow
      position={[centerX * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2 - player.x, -0.04, centerZ * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2 - player.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[WILDS_TILE_SIZE * 5 + 0.06, WILDS_TILE_SIZE * 5 + 0.06]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  );
}

function TrailNetwork({ player, palette }: { player: PlayState["player"]; palette: WildsBiomeTile["trail"] }) {
  const offsetX = -(((player.x % WILDS_TILE_SIZE) + WILDS_TILE_SIZE) % WILDS_TILE_SIZE);
  const offsetZ = -(((player.z % WILDS_TILE_SIZE) + WILDS_TILE_SIZE) % WILDS_TILE_SIZE);
  return (
    <group position={[offsetX, 0.018, offsetZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 1.02]} />
        <meshStandardMaterial color={palette.edge} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 0.72]} />
        <meshStandardMaterial color={palette.base} roughness={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 0.82]} />
        <meshStandardMaterial color={palette.edge} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 0.56]} />
        <meshStandardMaterial color={palette.base} roughness={0.88} />
      </mesh>
    </group>
  );
}

function EcologyInstances({
  bushes,
  flowers,
  palette,
  player,
  rocks,
  trees
}: {
  bushes: Placement[];
  flowers: Placement[];
  palette?: WildsBiomeTile["canopy"];
  player: PlayState["player"];
  rocks: Placement[];
  trees: Placement[];
}) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const lowerCrowns = useRef<THREE.InstancedMesh>(null);
  const upperCrowns = useRef<THREE.InstancedMesh>(null);
  const shrubMesh = useRef<THREE.InstancedMesh>(null);
  const rockMesh = useRef<THREE.InstancedMesh>(null);
  const flowerMesh = useRef<THREE.InstancedMesh>(null);
  const treeScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale, item.scale * (1.35 + item.variant * 0.12), item.scale], []);
  const crownScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * (1 + item.variant * 0.08), item.scale, item.scale * (1 - item.variant * 0.05)], []);
  const shrubScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * 0.56, item.scale * 0.38, item.scale * 0.52], []);
  const rockScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * 0.32, item.scale * 0.21, item.scale * 0.38], []);
  const flowerScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * 0.09, item.scale * 0.22, item.scale * 0.09], []);
  useInstances(trunks, trees, player, 0.64, treeScale);
  useInstances(lowerCrowns, trees, player, 1.65, crownScale);
  useInstances(upperCrowns, trees, player, 2.16, crownScale);
  useInstances(shrubMesh, bushes, player, 0.23, shrubScale);
  useInstances(rockMesh, rocks, player, 0.13, rockScale);
  useInstances(flowerMesh, flowers, player, 0.15, flowerScale);

  return (
    <group>
      <instancedMesh args={[undefined, undefined, trees.length]} castShadow ref={trunks}>
        <cylinderGeometry args={[0.16, 0.29, 1.2, 8]} />
        <meshStandardMaterial color="#64462f" roughness={0.94} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, trees.length]} castShadow ref={lowerCrowns}>
        <dodecahedronGeometry args={[0.72, 1]} />
        <meshStandardMaterial color={palette?.deep ?? "#246b46"} roughness={0.82} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, trees.length]} castShadow ref={upperCrowns}>
        <dodecahedronGeometry args={[0.56, 1]} />
        <meshStandardMaterial color={palette?.mid ?? "#3d9250"} roughness={0.78} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, bushes.length]} castShadow ref={shrubMesh}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={palette?.highlight ?? "#3b8d49"} roughness={0.88} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, rocks.length]} castShadow receiveShadow ref={rockMesh}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#67776c" roughness={0.98} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, flowers.length]} ref={flowerMesh}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffd66f" emissive="#ff8da6" emissiveIntensity={0.12} roughness={0.7} />
      </instancedMesh>
    </group>
  );
}

function Landmark({ player, tile }: { player: PlayState["player"]; tile: Tile }) {
  const position: [number, number, number] = [
    tile.tileX * WILDS_TILE_SIZE + WILDS_TILE_SIZE * 0.7 - player.x,
    0,
    tile.tileZ * WILDS_TILE_SIZE + WILDS_TILE_SIZE * 0.72 - player.z
  ];
  return (
    <group position={position} rotation={[0, tile.landmark.rotation, 0]} scale={tile.landmark.scale}>
      {tile.landmark.kind === "hearttree-sanctum" ? <HearttreeSanctum /> : null}
      {tile.landmark.kind === "root-arch" ? <RootArch /> : null}
      {tile.landmark.kind === "spring" ? <SpringLandmark /> : null}
    </group>
  );
}

function HearttreeSanctum() {
  return (
    <group name="hearttree-sanctum">
      {[-1, -0.5, 0, 0.5, 1].map((side) => (
        <mesh key={side} position={[side * 0.7, 0.18, 0]} rotation={[0.1, side * 0.22, side * -0.72]}>
          <capsuleGeometry args={[0.16, 1.15 - Math.abs(side) * 0.25, 6, 10]} />
          <meshStandardMaterial color="#573c2b" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 1.72, 0]}>
        <cylinderGeometry args={[0.46, 0.78, 3.1, 10]} />
        <meshStandardMaterial color="#5e412d" roughness={0.93} />
      </mesh>
      <mesh position={[0, 1.38, 0.43]} scale={[0.54, 0.8, 0.24]}>
        <torusGeometry args={[0.42, 0.15, 10, 28]} />
        <meshStandardMaterial color="#23452f" emissive="#75e59c" emissiveIntensity={0.2} roughness={0.66} />
      </mesh>
      {([[-0.66, 3.08, 0], [0.6, 3.12, 0.05], [0, 3.52, -0.08]] as const).map((position, index) => (
        <mesh key={index} position={position} scale={[1.45, 0.86, 1.18]}>
          <dodecahedronGeometry args={[0.82, 1]} />
          <meshStandardMaterial color={index === 2 ? "#4d9e51" : "#287149"} roughness={0.76} />
        </mesh>
      ))}
      <pointLight color="#8ef2a7" distance={4.2} intensity={0.45} position={[0, 1.4, 0.52]} />
    </group>
  );
}

function ArenaOfEchoes() {
  return <group name="arena-of-echoes-building">
    <mesh receiveShadow position={[0, .32, 0]}><cylinderGeometry args={[4.5, 4.8, .64, 48]} /><meshStandardMaterial color="#665b46" roughness={.9} /></mesh>
    {[0, 1].map((level) => <mesh key={level} position={[0, .8 + level * .72, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[3.65 - level * .32, .32, 10, 56]} />
      <meshStandardMaterial color={level ? "#e8d178" : "#9c8650"} emissive="#f7c948" emissiveIntensity={level ? .28 : .12} roughness={.66} />
    </mesh>)}
    {Array.from({ length: 12 }, (_, index) => {
      const angle = index / 12 * Math.PI * 2;
      return <mesh key={index} position={[Math.cos(angle) * 3.7, 1.25, Math.sin(angle) * 3.7]}>
        <cylinderGeometry args={[.17, .24, 2.25, 8]} />
        <meshStandardMaterial color="#d7c58a" roughness={.72} />
      </mesh>;
    })}
    <mesh position={[-2.7, 1.55, -2.7]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[1.35, 3.1, .6]} /><meshStandardMaterial color="#4d4539" emissive="#f7c948" emissiveIntensity={.18} /></mesh>
    <pointLight color="#f7c948" distance={13} intensity={4.5} position={[0, 3.2, 0]} />
  </group>;
}

function PrismArcade() {
  return <group name="prism-arcade-building">
    <mesh receiveShadow position={[0, .22, 0]}><cylinderGeometry args={[4.2, 4.6, .44, 8]} /><meshStandardMaterial color="#26384c" metalness={.28} roughness={.52} /></mesh>
    {([-1.8, 0, 1.8] as const).map((x, index) => <group key={x} position={[x, 0, index === 1 ? 0 : .45]}>
      <mesh position={[0, 2.25 + (index === 1 ? .8 : 0), 0]} rotation={[0, index * .45, 0]}>
        <octahedronGeometry args={[index === 1 ? 1.15 : .88, 1]} />
        <meshPhysicalMaterial color={index === 1 ? "#ff72bf" : "#72dfff"} emissive={index === 1 ? "#ff72bf" : "#72dfff"} emissiveIntensity={1.15} metalness={.18} roughness={.22} transmission={.08} />
      </mesh>
      <mesh position={[0, 1.05, 0]}><cylinderGeometry args={[.3, .48, 2.1, 8]} /><meshStandardMaterial color="#1d2637" emissive="#7b4fc4" emissiveIntensity={.34} /></mesh>
    </group>)}
    <mesh position={[-2.55, 1.65, -2.55]} rotation={[0, Math.PI / 4, 0]}><torusGeometry args={[1.25, .2, 10, 38]} /><meshStandardMaterial color="#ff72bf" emissive="#ff72bf" emissiveIntensity={1.4} metalness={.35} roughness={.25} /></mesh>
    <pointLight color="#ff72bf" distance={14} intensity={6} position={[0, 3.8, 0]} />
    <pointLight color="#72dfff" distance={10} intensity={4} position={[-2.5, 2, -2.5]} />
  </group>;
}

function RootArch() {
  return (
    <group name="root-arch">
      <mesh position={[0, 1.14, 0]}>
        <torusGeometry args={[1.18, 0.22, 10, 32, Math.PI]} />
        <meshStandardMaterial color="#62432d" roughness={0.94} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.17, 0.54, 0]}>
          <mesh><cylinderGeometry args={[0.18, 0.3, 1.3, 8]} /><meshStandardMaterial color="#62432d" roughness={0.94} /></mesh>
          <mesh position={[side * 0.08, 0.28, 0.18]}><dodecahedronGeometry args={[0.28, 0]} /><meshStandardMaterial color="#5f9b50" roughness={0.86} /></mesh>
        </group>
      ))}
    </group>
  );
}

function SpringLandmark() {
  const springStones = useRef<THREE.InstancedMesh>(null);
  const springReeds = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const stoneScale = new THREE.Vector3(0.34, 0.22, 0.48);
    for (let index = 0; index < 11; index += 1) {
      const angle = (index / 11) * Math.PI * 2;
      quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
      matrix.compose(new THREE.Vector3(Math.cos(angle) * 1.05, 0.14, Math.sin(angle) * 1.05), quaternion, stoneScale);
      springStones.current?.setMatrixAt(index, matrix);
    }
    [-0.72, -0.48, 0.58, 0.82].forEach((x, index) => {
      quaternion.setFromEuler(new THREE.Euler(0, 0, x * 0.15));
      matrix.compose(new THREE.Vector3(x, 0.38, 0.76), quaternion, new THREE.Vector3(1, 1, 1));
      springReeds.current?.setMatrixAt(index, matrix);
    });
    if (springStones.current) springStones.current.instanceMatrix.needsUpdate = true;
    if (springReeds.current) springReeds.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group name="spring-landmark">
      <mesh receiveShadow position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.08, 28]} />
        <meshPhysicalMaterial color="#57b8c8" roughness={0.18} metalness={0.02} clearcoat={0.8} />
      </mesh>
      <instancedMesh args={[undefined, undefined, 11]} ref={springStones}>
        <dodecahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial color="#748278" roughness={0.98} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, 4]} ref={springReeds}>
        <coneGeometry args={[0.08, 0.76, 5]} />
        <meshStandardMaterial color="#4a9852" roughness={0.83} />
      </instancedMesh>
    </group>
  );
}

function FarCanopy({ centerX, centerZ, player }: { centerX: number; centerZ: number; player: PlayState["player"] }) {
  const farCanopyMesh = useRef<THREE.InstancedMesh>(null);
  const silhouettes = useMemo(() => Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2;
    const radius = 24 + seededUnit(centerX * 31 + centerZ, index) * 8;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, scale: 3.2 + seededUnit(index, centerX - centerZ) * 2.4 };
  }), [centerX, centerZ]);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    silhouettes.forEach((item, index) => {
      matrix.compose(
        new THREE.Vector3(item.x, item.scale * 0.42, item.z),
        new THREE.Quaternion(),
        new THREE.Vector3(item.scale, item.scale, item.scale)
      );
      farCanopyMesh.current?.setMatrixAt(index, matrix);
    });
    if (farCanopyMesh.current) farCanopyMesh.current.instanceMatrix.needsUpdate = true;
  }, [silhouettes]);
  return (
    <group position={[-(player.x % WILDS_TILE_SIZE), 0, -(player.z % WILDS_TILE_SIZE)]}>
      <instancedMesh args={[undefined, undefined, silhouettes.length]} ref={farCanopyMesh}>
        <dodecahedronGeometry args={[0.72, 0]} />
        <meshStandardMaterial color="#174f3b" fog roughness={1} />
      </instancedMesh>
    </group>
  );
}
