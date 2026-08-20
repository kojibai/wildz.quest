"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { PlayState } from "@/features/play/game-state";
import { projectWildsBiome, type WildsBiomeTile } from "@/features/play/wilds-biome";
import type { WildsQualityProfile } from "@/features/play/wilds-quality-profile";
import { WILDS_MAJOR_ROUTES } from "@/features/play/wilds-world-geography";
import { projectVisibleLandmarkEntrances, type WildsLandmarkDefinition } from "@/features/play/wilds-landmarks";
import type { WildsWorldProjection } from "@/features/play/wilds-world-state";
import { WildsSettlementEnvironment, type WildsSettlementWorldMode } from "@/features/play/WildsSettlementEnvironment";
import { WAYFINDER_HOLLOW } from "@/features/play/wilds-settlements";
import { useWildsReadability } from "@/features/play/WildsReadabilityContext";

export const WILDS_TILE_SIZE = 12;
const STREAM_RADIUS = 2;
const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = Math.PI * 2 / (PHI * PHI);

type Tile = WildsBiomeTile & { key: string; tileX: number; tileZ: number };
type Placement = { x: number; z: number; scale: number; variant: number };

function seededUnit(seed: number, salt: number) {
  const value = Math.sin(seed * 0.0000137 + salt * 91.733) * 43758.5453123;
  return value - Math.floor(value);
}

function placements(tiles: Tile[], kind: keyof Tile["ecology"], salt: number, density: number) {
  return tiles.flatMap((tile) => {
    const count = Math.max(1, Math.round(tile.ecology[kind] * density));
    const phase = seededUnit(tile.seed, salt) * Math.PI * 2;
    return Array.from({ length: count }, (_, slot): Placement => {
      const angle = phase + slot * GOLDEN_ANGLE;
      const radius = WILDS_TILE_SIZE * (.2 + .27 * Math.sqrt((slot + .5) / count));
      return {
        x: tile.tileX * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2 + Math.cos(angle) * radius,
        z: tile.tileZ * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2 + Math.sin(angle) * radius,
        scale: 0.72 + seededUnit(tile.seed, salt + slot * 3 + 2) * 0.62,
        variant: Math.floor(seededUnit(tile.seed, salt + slot * 5 + 4) * 3)
      };
    });
  });
}

function useInstances(
  mesh: React.RefObject<THREE.InstancedMesh | null>,
  items: Placement[],
  player: PlayState["player"],
  y: number,
  shape: (item: Placement) => [number, number, number],
  clearRadius = 0
) {
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    items.forEach((item, index) => {
      const shaped = shape(item);
      const relativeX = item.x - player.x;
      const relativeZ = item.z - player.z;
      const insidePlayablePocket = Math.hypot(relativeX, relativeZ) < clearRadius;
      scale.set(
        insidePlayablePocket ? 0 : shaped[0],
        insidePlayablePocket ? 0 : shaped[1],
        insidePlayablePocket ? 0 : shaped[2]
      );
      quaternion.setFromEuler(new THREE.Euler(0, seededUnit(index, item.variant + 17) * Math.PI * 2, 0));
      matrix.compose(new THREE.Vector3(relativeX, y, relativeZ), quaternion, scale);
      mesh.current?.setMatrixAt(index, matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [clearRadius, items, mesh, player.x, player.z, shape, y]);
}

export function WildsEnvironment({
  player,
  missionProgress,
  worldMastery,
  qualityProfile,
  livingWorld,
  worldMode
}: {
  player: PlayState["player"];
  missionProgress: number;
  worldMastery: number;
  qualityProfile: WildsQualityProfile;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
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
        <WorldWatercourses player={player} qualityProfile={qualityProfile} />
        <TrailNetwork player={player} palette={tiles[12]?.trail ?? { base: "#cbb778", edge: "#9b8b56" }} />
        <MajorWorldRoutes player={player} palette={tiles[12]?.trail ?? { base: "#cbb778", edge: "#9b8b56" }} />
      </group>
      <group name="world-layer-mid">
        <EcologyInstances bushes={bushes} flowers={flowers} palette={tiles[12]?.canopy} player={player} qualityProfile={qualityProfile} rocks={rocks} trees={trees} />
        <FlagshipLandmarkEntrances detail={qualityProfile.tier !== "low"} livingWorld={livingWorld} player={player} worldMode={worldMode} />
        <LivingWorldSites player={player} world={livingWorld} />
        {tiles.filter((tile) => tile.landmark.kind !== "none" && tile.landmark.kind !== "hearttree-sanctum" && tile.landmark.kind !== "mortal-arena").map((tile) => (
          <Landmark key={`landmark:${tile.key}`} player={player} tile={tile} />
        ))}
      </group>
      <group name="world-layer-far">
        <FarCanopy centerX={centerX} centerZ={centerZ} player={player} />
      </group>
    </group>
  );
}

function LivingWorldSites({ player, world }: { player: PlayState["player"]; world?: WildsWorldProjection | null }) {
  if (!world) return null;
  const sites = Object.values(world.sites).filter((site) => site.phase !== "expired" && Math.hypot(site.position.x - player.x, site.position.z - player.z) <= 54);
  return <group name="world-living-sites">
    {sites.map((site) => {
      const boss = site.bossId ? world.bosses[site.bossId] : null;
      const memorial = site.phase === "memorialized";
      return <group key={site.id} name={`world-site-${site.id}`} position={[site.position.x - player.x, 0, site.position.z - player.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <torusGeometry args={[site.radius * 0.58, 0.18, 10, 48]} />
          <meshStandardMaterial color={memorial ? "#8edcff" : "#9f6cff"} emissive={memorial ? "#2582a8" : "#5624a8"} emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, memorial ? 1.2 : 0.42, 0]}>
          {memorial ? <octahedronGeometry args={[1.15, 1]} /> : <cylinderGeometry args={[1.8, 2.7, 0.8, 20]} />}
          <meshStandardMaterial color={memorial ? "#d8f7ff" : "#291846"} emissive={memorial ? "#4cc8ef" : "#17052e"} emissiveIntensity={0.45} />
        </mesh>
        {boss && boss.phase !== "defeated" ? <group name={`world-boss-${boss.id}`} position={[0, 1.65, 0]}>
          <mesh><dodecahedronGeometry args={[1.35, 0]} /><meshStandardMaterial color="#6f4b91" emissive="#6d25ad" emissiveIntensity={0.65} /></mesh>
          <Html center distanceFactor={9} occlude={false}><span className="wilds-world-boss-label">{Math.ceil((boss.health / boss.maxHealth) * 100)}% · Shared boss</span></Html>
        </group> : null}
      </group>;
    })}
  </group>;
}

function FlagshipLandmarkEntrances({ detail, livingWorld, player, worldMode }: { detail: boolean; livingWorld?: WildsWorldProjection | null; player: PlayState["player"]; worldMode: WildsSettlementWorldMode }) {
  const entrances = projectVisibleLandmarkEntrances(player);
  return <group name="world-flagship-landmarks">
    {entrances.map(({ landmark, relative, distance }) => (
      <group key={landmark.id} name={`world-entrance-${landmark.id}`} position={[relative.x, 0, relative.z]}>
        {landmark.id === "hearttree-sanctum" ? (
          <group position={distance < landmark.radius + 2 ? [2.6, 0, -2.4] : [0, 0, 0]} scale={distance < landmark.radius + 2 ? 0.44 : 1}>
            <HearttreeSanctum />
          </group>
        ) : null}
        {landmark.id === "arena-of-echoes" ? <ArenaOfEchoes detail={detail} /> : null}
        {landmark.id === "prism-arcade" ? <PrismArcade /> : null}
        {landmark.id === "wayfinder-hollow" ? <WildsSettlementEnvironment livingWorld={livingWorld} relative={{ x: 0, z: 0 }} settlement={WAYFINDER_HOLLOW} worldMode={worldMode} /> : null}
        <LandmarkEntranceBeacon distance={distance} landmark={landmark} />
      </group>
    ))}
  </group>;
}

function LandmarkEntranceBeacon({ landmark, distance }: { landmark: WildsLandmarkDefinition; distance: number }) {
  return <group name={`entrance-beacon-${landmark.id}`}>
    <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[Math.min(2.2, landmark.radius * .32), .022, 7, 48]} />
      <meshStandardMaterial color="#59705b" emissive={landmark.accent} emissiveIntensity={.22} transparent opacity={.34} />
    </mesh>
    <mesh position={[0, 4.3, 0]}>
      <cylinderGeometry args={[.035, .16, 8.4, 10]} />
      <meshBasicMaterial color={landmark.accent} transparent opacity={.2} />
    </mesh>
    <Html center distanceFactor={9} occlude={false} position={[0, 6.15, 0]} zIndexRange={[14, 1]}>
      <div className="wilds-landmark-wayfinder" style={{ "--landmark-accent": landmark.accent } as React.CSSProperties}>
        <span>{Math.max(0, Math.round(distance - landmark.radius))}m</span>
        <strong>{landmark.name}</strong>
        <small>Entrance ahead</small>
      </div>
    </Html>
  </group>;
}

function MajorWorldRoutes({ player, palette }: { player: PlayState["player"]; palette: WildsBiomeTile["trail"] }) {
  const readability = useWildsReadability();
  const routes = useMemo(() => WILDS_MAJOR_ROUTES.map((route) => ({
    ...route,
    curve: new THREE.CatmullRomCurve3(route.points.map((point) => new THREE.Vector3(point.x, .024, point.z)))
  })), []);
  return <group name="world-major-routes" position={[-player.x, 0, -player.z]}>
    {routes.map((route, index) => <group key={route.id} name={`world-route-${route.id}`}>
      <mesh><tubeGeometry args={[route.curve, 160, index ? .42 : .54, 7, false]} /><meshStandardMaterial color={palette.edge} emissive={palette.edge} emissiveIntensity={readability.pathEmissive * .45} roughness={.98} /></mesh>
      <mesh><tubeGeometry args={[route.curve, 160, index ? .28 : .36, 7, false]} /><meshStandardMaterial color={palette.base} emissive={palette.base} emissiveIntensity={readability.pathEmissive} roughness={.91} /></mesh>
    </group>)}
  </group>;
}

function riverRibbon(points: readonly { x: number; z: number }[], width: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)]!;
    const next = points[Math.min(points.length - 1, index + 1)]!;
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const length = Math.hypot(tangentX, tangentZ) || 1;
    const normalX = -tangentZ / length;
    const normalZ = tangentX / length;
    const breadth = width * (.78 + Math.sin(index * GOLDEN_ANGLE) * .12);
    positions.push(point.x + normalX * breadth, .028, point.z + normalZ * breadth);
    positions.push(point.x - normalX * breadth, .028, point.z - normalZ * breadth);
    uvs.push(0, index / Math.max(1, points.length - 1), 1, index / Math.max(1, points.length - 1));
    if (index < points.length - 1) {
      const a = index * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function WorldWatercourses({ player, qualityProfile }: { player: PlayState["player"]; qualityProfile: WildsQualityProfile }) {
  const geometry = useMemo(() => riverRibbon([
    { x: 148, z: -118 }, { x: 116, z: -88 }, { x: 82, z: -61 }, { x: 48, z: -34 },
    { x: 18, z: -12 }, { x: 4, z: 2 }, { x: -21, z: 31 }, { x: -55, z: 66 },
    { x: -86, z: 96 }, { x: -122, z: 126 }
  ], qualityProfile.tier === "low" ? .72 : .92), [qualityProfile.tier]);
  return <group name="world-watercourses" position={[-player.x, 0, -player.z]}>
    <mesh geometry={geometry} receiveShadow>
      <meshPhysicalMaterial color="#2c8790" emissive="#143f43" emissiveIntensity={.18} roughness={.22} metalness={.02} clearcoat={qualityProfile.tier === "low" ? .2 : .72} />
    </mesh>
  </group>;
}

function GroundField({ centerX, centerZ, color, player }: { centerX: number; centerZ: number; color: string; player: PlayState["player"] }) {
  const readability = useWildsReadability();
  const geometry = useMemo(() => {
    const extent = WILDS_TILE_SIZE * 5 + .06;
    const next = new THREE.PlaneGeometry(extent, extent, 48, 48);
    const position = next.getAttribute("position") as THREE.BufferAttribute;
    const worldCenterX = centerX * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2;
    const worldCenterZ = centerZ * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2;
    for (let index = 0; index < position.count; index += 1) {
      const worldX = worldCenterX + position.getX(index);
      const worldZ = worldCenterZ + position.getY(index);
      const broad = Math.sin(worldX * .115 + worldZ * .043) * .035 + Math.cos(worldZ * .097 - worldX * .052) * .028;
      const detail = Math.sin((worldX + worldZ) * .32) * .012;
      position.setZ(index, .06 + broad + detail);
    }
    position.needsUpdate = true;
    next.computeVertexNormals();
    return next;
  }, [centerX, centerZ]);
  const terrainMap = useMemo(() => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    const tint = new THREE.Color(color);
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const grain = .7 + seededUnit(centerX * 193 + centerZ * 389 + x * 17, y * 23) * .3;
      const vein = Math.abs(Math.sin(x * .23 + y * .31)) < .075 ? .72 : 1;
      const mottling = .9 + Math.sin(x * .71 + y * .29) * .045 + Math.cos(y * .82 - x * .18) * .035;
      const index = (y * size + x) * 4;
      data[index] = Math.round(tint.r * 255 * grain * vein * mottling);
      data[index + 1] = Math.round(tint.g * 255 * grain * vein * mottling);
      data[index + 2] = Math.round(tint.b * 255 * grain * vein * mottling);
      data[index + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [centerX, centerZ, color]);
  return (
    <mesh
      geometry={geometry}
      receiveShadow
      position={[centerX * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2 - player.x, -0.1, centerZ * WILDS_TILE_SIZE + WILDS_TILE_SIZE / 2 - player.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <meshStandardMaterial color="#d5efe0" emissive="#183d28" emissiveIntensity={.06 + readability.darkness * .16} map={terrainMap} roughness={0.96} />
    </mesh>
  );
}

function TrailNetwork({ player, palette }: { player: PlayState["player"]; palette: WildsBiomeTile["trail"] }) {
  const readability = useWildsReadability();
  const offsetX = -(((player.x % WILDS_TILE_SIZE) + WILDS_TILE_SIZE) % WILDS_TILE_SIZE);
  const offsetZ = -(((player.z % WILDS_TILE_SIZE) + WILDS_TILE_SIZE) % WILDS_TILE_SIZE);
  return (
    <group position={[offsetX, 0.018, offsetZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 1.02]} />
        <meshStandardMaterial color={palette.edge} emissive={palette.edge} emissiveIntensity={readability.pathEmissive * 0.45} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 0.72]} />
        <meshStandardMaterial color={palette.base} emissive={palette.base} emissiveIntensity={readability.pathEmissive} roughness={0.88} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 0.82]} />
        <meshStandardMaterial color={palette.edge} emissive={palette.edge} emissiveIntensity={readability.pathEmissive * 0.45} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[WILDS_TILE_SIZE * 5, 0.56]} />
        <meshStandardMaterial color={palette.base} emissive={palette.base} emissiveIntensity={readability.pathEmissive} roughness={0.88} />
      </mesh>
    </group>
  );
}

function EcologyInstances({
  bushes,
  flowers,
  palette,
  player,
  qualityProfile,
  rocks,
  trees
}: {
  bushes: Placement[];
  flowers: Placement[];
  palette?: WildsBiomeTile["canopy"];
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  rocks: Placement[];
  trees: Placement[];
}) {
  const readability = useWildsReadability();
  const trunks = useRef<THREE.InstancedMesh>(null);
  const lowerCrowns = useRef<THREE.InstancedMesh>(null);
  const upperCrowns = useRef<THREE.InstancedMesh>(null);
  const middleCrowns = useRef<THREE.InstancedMesh>(null);
  const shrubMesh = useRef<THREE.InstancedMesh>(null);
  const rockMesh = useRef<THREE.InstancedMesh>(null);
  const flowerMesh = useRef<THREE.InstancedMesh>(null);
  const grassMesh = useRef<THREE.InstancedMesh>(null);
  const treeScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale, item.scale * (1.55 + item.variant * 0.14), item.scale], []);
  const crownScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * (1.18 + item.variant * 0.08), item.scale * .92, item.scale * (1.08 - item.variant * 0.04)], []);
  const middleCrownScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * .92, item.scale * .72, item.scale * .88], []);
  const shrubScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * 0.56, item.scale * 0.38, item.scale * 0.52], []);
  const rockScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * 0.32, item.scale * 0.21, item.scale * 0.38], []);
  const flowerScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * 0.09, item.scale * 0.22, item.scale * 0.09], []);
  const grassScale = useMemo(() => (item: Placement): [number, number, number] => [item.scale * .035, item.scale * (qualityProfile.tier === "low" ? .13 : .2), item.scale * .025], [qualityProfile.tier]);
  const treeClearRadius = Math.hypot(player.x, player.z) < 14 ? 13.6 : 7.2;
  useInstances(trunks, trees, player, 0.64, treeScale, treeClearRadius);
  useInstances(lowerCrowns, trees, player, 1.65, crownScale, treeClearRadius);
  useInstances(upperCrowns, trees, player, 2.16, crownScale, treeClearRadius);
  useInstances(middleCrowns, trees, player, 2.68, middleCrownScale, treeClearRadius);
  useInstances(shrubMesh, bushes, player, 0.23, shrubScale, 1.45);
  useInstances(rockMesh, rocks, player, 0.13, rockScale, 1.2);
  useInstances(flowerMesh, flowers, player, 0.15, flowerScale);
  useInstances(grassMesh, flowers, player, .11, grassScale, .8);

  return (
    <group>
      <instancedMesh args={[undefined, undefined, trees.length]} castShadow ref={trunks}>
        <cylinderGeometry args={[0.16, 0.29, 1.2, 8]} />
        <meshStandardMaterial color="#64462f" roughness={0.94} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, trees.length]} castShadow ref={lowerCrowns}>
        <dodecahedronGeometry args={[0.72, 1]} />
        <meshStandardMaterial color={palette?.deep ?? "#246b46"} emissive="#123c27" emissiveIntensity={.05 + readability.darkness * .15} roughness={0.82} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, trees.length]} castShadow ref={upperCrowns}>
        <dodecahedronGeometry args={[0.56, 1]} />
        <meshStandardMaterial color={palette?.mid ?? "#3d9250"} emissive="#174c2d" emissiveIntensity={.05 + readability.darkness * .16} roughness={0.78} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, trees.length]} castShadow={qualityProfile.tier === "high"} ref={middleCrowns}>
        <icosahedronGeometry args={[.52, 1]} />
        <meshStandardMaterial color={palette?.highlight ?? "#4f9f58"} emissive="#1b512d" emissiveIntensity={.04 + readability.darkness * .14} roughness={.8} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, bushes.length]} castShadow ref={shrubMesh}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={palette?.highlight ?? "#3b8d49"} emissive="#174329" emissiveIntensity={.04 + readability.darkness * .12} roughness={0.88} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, rocks.length]} castShadow receiveShadow ref={rockMesh}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#67776c" roughness={0.98} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, flowers.length]} ref={flowerMesh}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffd66f" emissive="#ff8da6" emissiveIntensity={0.12} roughness={0.7} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, flowers.length]} ref={grassMesh}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={palette?.highlight ?? "#5da857"} roughness={.96} />
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

function ArenaOfEchoes({ detail }: { detail: boolean }) {
  const spectators = useRef<THREE.InstancedMesh>(null);
  const proofSeams = useRef<THREE.InstancedMesh>(null);
  const floorStones = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const spectatorCount = detail ? 48 : 24;
    for (let index = 0; index < spectatorCount; index += 1) {
      const angle = index / spectatorCount * Math.PI * 2;
      const tier = index % 3;
      scale.set(.18 + (index % 2) * .04, .54 + tier * .12, .18);
      quaternion.setFromEuler(new THREE.Euler(0, -angle, (index % 5 - 2) * .025));
      matrix.compose(new THREE.Vector3(Math.cos(angle) * (9 + tier * .48), 1.12 + tier * .42, Math.sin(angle) * (9 + tier * .48)), quaternion, scale);
      spectators.current?.setMatrixAt(index, matrix);
    }
    spectators.current && (spectators.current.instanceMatrix.needsUpdate = true);
    for (let index = 0; index < 20; index += 1) {
      const angle = index / 20 * Math.PI * 2;
      scale.set(.055, .016, 2.2);
      quaternion.setFromEuler(new THREE.Euler(0, -angle, 0));
      matrix.compose(new THREE.Vector3(Math.cos(angle) * 3.9, .47, Math.sin(angle) * 3.9), quaternion, scale);
      proofSeams.current?.setMatrixAt(index, matrix);
    }
    proofSeams.current && (proofSeams.current.instanceMatrix.needsUpdate = true);
    const floorStoneCount = detail ? 36 : 20;
    for (let index = 0; index < floorStoneCount; index += 1) {
      const angle = index * GOLDEN_ANGLE;
      const radius = 1.7 + Math.sqrt((index + .5) / floorStoneCount) * 4.9;
      quaternion.setFromEuler(new THREE.Euler(0, angle + index * .17, 0));
      scale.set(.38 + index % 3 * .08, .07 + index % 2 * .02, .58 + index % 4 * .08);
      matrix.compose(new THREE.Vector3(Math.cos(angle) * radius, .55, Math.sin(angle) * radius), quaternion, scale);
      floorStones.current?.setMatrixAt(index, matrix);
    }
    floorStones.current && (floorStones.current.instanceMatrix.needsUpdate = true);
  }, [detail]);
  const arches = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  return <group name="mortal-arena-world-anchor">
    <mesh receiveShadow position={[0, .18, 0]} name="arena-foundation"><cylinderGeometry args={[11.25, 11.7, .36, 64]} /><meshStandardMaterial color="#304b3c" emissive="#163b29" emissiveIntensity={.42} metalness={.06} roughness={.96} /></mesh>
    <mesh receiveShadow position={[0, .39, 0]} name="arena-open-bowl"><cylinderGeometry args={[7.65, 8.15, .28, 64]} /><meshStandardMaterial color="#58775e" emissive="#1c4930" emissiveIntensity={.38} metalness={.03} roughness={.92} /></mesh>
    <mesh position={[0, .455, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.25, 7.1, 64]} /><meshStandardMaterial color="#5e8263" emissive="#205037" emissiveIntensity={.36} roughness={.84} /></mesh>
    <instancedMesh args={[undefined, undefined, detail ? 36 : 20]} ref={floorStones} name="arena-floor-stones">
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#65746a" emissive="#1b3528" emissiveIntensity={.24} roughness={.99} />
    </instancedMesh>
    <instancedMesh args={[undefined, undefined, 20]} ref={proofSeams} name="arena-proof-seams"><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#ffe288" emissive="#f7c948" emissiveIntensity={1.6} metalness={.4} roughness={.28} /></instancedMesh>
    {[7.5, 8.6, 10.35].map((radius, index) => <mesh key={radius} position={[0, .48 + index * .25, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, index === 2 ? .34 : .16, 8, 72]} />
      <meshStandardMaterial color={index === 2 ? "#17312d" : "#bfae67"} emissive="#f7c948" emissiveIntensity={index === 1 ? .3 : .08} metalness={.24} roughness={.66} />
    </mesh>)}
    {arches.map((rotation, index) => <group key={rotation} name={`arena-split-arch-${index + 1}`} rotation={[0, rotation, 0]}>
      {[-1, 1].map((side) => <group key={side} position={[side * 2.25, 2.25, -8.15]} rotation={[0, 0, side * -.14]}>
        <mesh castShadow><cylinderGeometry args={[.42, .72, 4.5, 7]} /><meshStandardMaterial color="#25443c" metalness={.18} roughness={.78} /></mesh>
        <mesh position={[side * -.42, 2.1, 0]} rotation={[Math.PI / 2, 0, side * .32]}><torusGeometry args={[1.48, .36, 7, 28, Math.PI * .58]} /><meshStandardMaterial color="#8f8357" emissive="#f7c948" emissiveIntensity={.2} metalness={.22} roughness={.62} /></mesh>
        <mesh position={[0, -.55, .39]} scale={[.55, 1.1, .12]}><octahedronGeometry args={[.7, 0]} /><meshStandardMaterial color={index % 2 ? "#ff724f" : "#f7c948"} emissive={index % 2 ? "#ff3d27" : "#f7c948"} emissiveIntensity={.82} roughness={.34} /></mesh>
      </group>)}
      {detail ? <mesh position={[0, 3.35, -9]}><planeGeometry args={[2.8, 1.25]} /><meshStandardMaterial color={index % 2 ? "#5f1d18" : "#332507"} emissive={index % 2 ? "#ff4f37" : "#f7c948"} emissiveIntensity={.25} side={THREE.DoubleSide} roughness={.72} /></mesh> : null}
    </group>)}
    <instancedMesh args={[undefined, undefined, detail ? 48 : 24]} ref={spectators} name="arena-spectator-silhouettes"><capsuleGeometry args={[1, 2.3, 3, 6]} /><meshStandardMaterial color="#101c1b" emissive="#1e5941" emissiveIntensity={.22} roughness={.92} /></instancedMesh>
    <mesh position={[0, .62, 0]} rotation={[-Math.PI / 2, 0, 0]} name="arena-canonical-seal"><torusGeometry args={[1.1, .095, 8, 48]} /><meshStandardMaterial color="#fff0a8" emissive="#f7c948" emissiveIntensity={1.8} metalness={.46} roughness={.22} /></mesh>
    <pointLight color="#f7c948" distance={18} intensity={detail ? 5.2 : 3.2} position={[0, 4.8, 0]} />
    <pointLight color="#ff4f37" distance={10} intensity={detail ? 2.4 : 1.2} position={[0, 2.4, -7]} />
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
        <capsuleGeometry args={[.045, .62, 3, 6]} />
        <meshStandardMaterial color="#4a9852" roughness={0.83} />
      </instancedMesh>
    </group>
  );
}

function FarCanopy({ centerX, centerZ, player }: { centerX: number; centerZ: number; player: PlayState["player"] }) {
  const farCanopyMesh = useRef<THREE.InstancedMesh>(null);
  const farCliffMesh = useRef<THREE.InstancedMesh>(null);
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
      matrix.compose(
        new THREE.Vector3(item.x, item.scale * 0.82, item.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, index * 0.67, 0)),
        new THREE.Vector3(item.scale * 0.7, item.scale * 1.18, item.scale * 0.72)
      );
      farCliffMesh.current?.setMatrixAt(index, matrix);
    });
    if (farCanopyMesh.current) farCanopyMesh.current.instanceMatrix.needsUpdate = true;
    if (farCliffMesh.current) farCliffMesh.current.instanceMatrix.needsUpdate = true;
  }, [silhouettes]);
  return (
    <group position={[-(player.x % WILDS_TILE_SIZE), 0, -(player.z % WILDS_TILE_SIZE)]}>
      <instancedMesh args={[undefined, undefined, silhouettes.length]} receiveShadow ref={farCliffMesh}>
        <dodecahedronGeometry args={[.82, 1]} />
        <meshStandardMaterial color="#354d43" fog roughness={0.99} />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, silhouettes.length]} ref={farCanopyMesh}>
        <dodecahedronGeometry args={[0.72, 0]} />
        <meshStandardMaterial color="#174f3b" emissive="#0d261e" emissiveIntensity={0.08} fog roughness={1} />
      </instancedMesh>
    </group>
  );
}
