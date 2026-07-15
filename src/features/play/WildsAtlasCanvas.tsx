"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { WILDS_REGION_SIZE } from "./multiplayer-core";
import type { WildsAtlasProjection } from "./wilds-world-atlas";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { WILDS_MAJOR_ROUTES, WILDS_NAMED_REGIONS } from "./wilds-world-geography";

export function WildsAtlasCanvas({
  projection,
  currentPosition,
  qualityProfile,
  selectedId,
  selectedDrop,
  reducedMotion,
  onSelect,
  onDrop
}: {
  projection: WildsAtlasProjection;
  currentPosition: { x: number; z: number };
  qualityProfile: WildsQualityProfile;
  selectedId: string | null;
  selectedDrop: { x: number; z: number } | null;
  reducedMotion: boolean;
  onSelect: (landmarkId: string) => void;
  onDrop: (position: { x: number; z: number }) => void;
}) {
  return (
    <div aria-hidden="true" className="wilds-atlas-canvas">
      <Canvas
        camera={{ fov: 40, near: 0.1, far: 80, position: [0, 9.6, 11.5] }}
        dpr={qualityProfile.dpr}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        shadows={false}
      >
        <color attach="background" args={["#061820"]} />
        <fog attach="fog" args={["#061820", 12, 29]} />
        <ambientLight intensity={2.05} />
        <hemisphereLight color="#bffff0" groundColor="#071719" intensity={1.7} />
        <directionalLight color="#fff2a8" intensity={2.8} position={[4, 10, 3]} />
        <pointLight color="#71e8c3" intensity={24} position={[-5, 3, 2]} distance={16} />
        <pointLight color="#ff72bf" intensity={13} position={[6, 2, -5]} distance={13} />
        <AtlasHorizon />
        <OrganicWorldSurface onDrop={onDrop} projection={projection} />
        <MapRoutes />
        <RegionNames projection={projection} />
        <LandmarkBeacons projection={projection} selectedId={selectedId} onSelect={onSelect} />
        <DropPin position={selectedDrop} projection={projection} />
        <ExactPlayerLights projection={projection} />
        <PresenceLights projection={projection} />
        <CurrentPositionBeam position={currentPosition} projection={projection} />
        <Sparkles
          color="#b9fff0"
          count={reducedMotion ? 12 : Math.round(38 * qualityProfile.particles)}
          opacity={0.45}
          scale={[16, 5, 16]}
          size={1.5}
          speed={reducedMotion ? 0 : 0.2}
        />
        <OrbitControls
          dampingFactor={0.08}
          enableDamping={!reducedMotion}
          enablePan
          maxDistance={19}
          maxPolarAngle={Math.PI / 2.25}
          minDistance={6.8}
          minPolarAngle={0.35}
          panSpeed={0.65}
          rotateSpeed={0.55}
          target={[0, 0, 0]}
          zoomSpeed={0.75}
        />
      </Canvas>
    </div>
  );
}

function AtlasHorizon() {
  return (
    <group name="atlas-horizon">
      <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[19, 96]} />
        <meshStandardMaterial color="#082d3c" emissive="#061c27" emissiveIntensity={0.4} roughness={0.34} metalness={0.08} />
      </mesh>
      <mesh position={[0, -0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[15.8, 96]} />
        <meshBasicMaterial color="#0d5260" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function terrainNoise(x: number, z: number) {
  return Math.sin(x * 0.72) * 0.11 + Math.cos(z * 0.57) * 0.09 + Math.sin((x + z) * 1.31) * 0.045;
}

function OrganicWorldSurface({ projection, onDrop }: { projection: WildsAtlasProjection; onDrop: (position: { x: number; z: number }) => void }) {
  const size = Math.max(7.2, Math.sqrt(projection.nodes.length) * 1.35);
  const geometry = useMemo(() => {
    const rings = 32;
    const segments = 96;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const nodes = new Map(projection.nodes.map((node) => [`${node.regionX}:${node.regionZ}`, node]));
    const fallback = projection.nodes[Math.floor(projection.nodes.length / 2)]!;
    const addVertex = (x: number, z: number, coast = 0) => {
      const regionX = Math.round(projection.centerRegion.x + x / 1.35);
      const regionZ = Math.round(projection.centerRegion.z + z / 1.35);
      const node = nodes.get(`${regionX}:${regionZ}`) ?? fallback;
      const height = (terrainNoise(x + regionX * 0.19, z + regionZ * 0.17) + node.biome.luminosity * 0.12) * (1 - coast * .62);
      const color = new THREE.Color(node.biome.ground.base).offsetHSL(0, .12, .08 + height * .2 - coast * .035);
      positions.push(x, height, z);
      colors.push(color.r, color.g, color.b);
    };
    addVertex(0, 0);
    for (let ring = 1; ring <= rings; ring += 1) {
      const progress = ring / rings;
      for (let segment = 0; segment < segments; segment += 1) {
        const angle = segment / segments * Math.PI * 2;
        const coast = Math.max(0, (progress - .82) / .18);
        const boundary = size * (.455 + Math.sin(angle * 3 + .6) * .025 + Math.cos(angle * 5 - .4) * .018);
        addVertex(Math.cos(angle) * boundary * progress * 1.06, Math.sin(angle) * boundary * progress, coast);
      }
    }
    for (let segment = 0; segment < segments; segment += 1) indices.push(0, 1 + (segment + 1) % segments, 1 + segment);
    for (let ring = 1; ring < rings; ring += 1) {
      const innerStart = 1 + (ring - 1) * segments;
      const outerStart = innerStart + segments;
      for (let segment = 0; segment < segments; segment += 1) {
        const next = (segment + 1) % segments;
        indices.push(innerStart + segment, innerStart + next, outerStart + segment, innerStart + next, outerStart + next, outerStart + segment);
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    next.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    next.setIndex(indices);
    next.computeVertexNormals();
    return next;
  }, [projection, size]);
  return (
    <mesh
      geometry={geometry}
      name="organic-world-surface"
      onClick={(event) => {
        event.stopPropagation();
        onDrop({
          x: Number(((projection.centerRegion.x + event.point.x / 1.35) * WILDS_REGION_SIZE).toFixed(2)),
          z: Number(((projection.centerRegion.z + event.point.z / 1.35) * WILDS_REGION_SIZE).toFixed(2))
        });
      }}
      receiveShadow
    >
      <meshStandardMaterial emissive="#123b32" emissiveIntensity={0.18} metalness={0.02} roughness={0.83} vertexColors />
    </mesh>
  );
}

function MapRoutes() {
  const routes = useMemo(() => WILDS_MAJOR_ROUTES.map((route) => new THREE.CatmullRomCurve3(
    route.points.map((point) => new THREE.Vector3(point.x / WILDS_REGION_SIZE * 1.35, .2, point.z / WILDS_REGION_SIZE * 1.35))
  )), []);
  return <group name="atlas-routes">{routes.map((route, index) => <mesh key={index}><tubeGeometry args={[route, 64, index ? .035 : .055, 6, false]} /><meshStandardMaterial color={index ? "#7fcbd0" : "#e8d69a"} emissive={index ? "#246d78" : "#695f39"} emissiveIntensity={0.32} roughness={0.72} /></mesh>)}</group>;
}

function DropPin({ position, projection }: { position: { x: number; z: number } | null; projection: WildsAtlasProjection }) {
  if (!position) return null;
  const x = (position.x / WILDS_REGION_SIZE - projection.centerRegion.x) * 1.35;
  const z = (position.z / WILDS_REGION_SIZE - projection.centerRegion.z) * 1.35;
  return <group name="atlas-drop-pin" position={[x, .42, z]}>
    <mesh position={[0, .22, 0]}><coneGeometry args={[.22, .5, 18]} /><meshStandardMaterial color="#fff3a0" emissive="#f7c948" emissiveIntensity={2.2} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.38, .03, 8, 32]} /><meshBasicMaterial color="#fff3a0" /></mesh>
  </group>;
}

function LandmarkBeacons({
  projection,
  selectedId,
  onSelect
}: {
  projection: WildsAtlasProjection;
  selectedId: string | null;
  onSelect: (landmarkId: string) => void;
}) {
  return projection.landmarks.map((landmark) => {
    const regionX = landmark.position.x / WILDS_REGION_SIZE;
    const regionZ = landmark.position.z / WILDS_REGION_SIZE;
    const x = (regionX - projection.centerRegion.x) * 1.35;
    const z = (regionZ - projection.centerRegion.z) * 1.35;
    const active = landmark.id === selectedId;
    return (
      <group
        key={landmark.id}
        name={`atlas-${landmark.id}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(landmark.id);
        }}
        position={[x, 0.38, z]}
        scale={active ? 1.18 : 1}
      >
        <LandmarkMiniature icon={landmark.icon} accent={landmark.accent} active={active} />
        <mesh>
          <octahedronGeometry args={[active ? 0.34 : 0.27, 0]} />
          <meshStandardMaterial
            color={landmark.discovered ? landmark.accent : "#6d8290"}
            emissive={landmark.discovered ? landmark.accent : "#263945"}
            emissiveIntensity={active ? 2.4 : 1.2}
            metalness={0.35}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.025, 0.08, 0.55, 10]} />
          <meshBasicMaterial color={landmark.accent} transparent opacity={0.7} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[active ? 0.48 : 0.4, 0.025, 8, 30]} />
          <meshBasicMaterial color={landmark.accent} transparent opacity={active ? 0.92 : 0.5} />
        </mesh>
        <Html center position={[0, 0.86, 0]} zIndexRange={[2, 1]}>
          <div
            className={`wilds-atlas-map-label${active ? " is-active" : ""}`}
            style={{
              alignItems: "center",
              backdropFilter: "blur(12px)",
              background: active ? "linear-gradient(135deg, #f7d25b, #71e8c3)" : "rgba(4, 23, 29, .84)",
              border: `1px solid ${active ? "#f9e58e" : "rgba(131, 235, 207, .24)"}`,
              borderRadius: 999,
              boxShadow: "0 8px 24px rgba(0, 0, 0, .32)",
              color: active ? "#071a1e" : "#eafff8",
              display: "flex",
              fontSize: 8,
              fontWeight: 900,
              gap: 6,
              minHeight: 28,
              padding: "0 9px",
              pointerEvents: "none",
              whiteSpace: "nowrap"
            }}
          >
            <span style={{ background: landmark.accent, borderRadius: "50%", height: 6, width: 6 }} />
            {landmark.name}
          </div>
        </Html>
      </group>
    );
  });
}

function LandmarkMiniature({ icon, accent, active }: { icon: "tree" | "trophy" | "sparkles"; accent: string; active: boolean }) {
  if (icon === "tree") return <group name="map-building-hearttree" position={[0, .2, 0]}>
    <mesh position={[0, .2, 0]}><cylinderGeometry args={[.07, .11, .52, 10]} /><meshStandardMaterial color="#8a583e" roughness={.8} /></mesh>
    <mesh position={[0, .56, 0]}><icosahedronGeometry args={[active ? .34 : .28, 1]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} roughness={.68} /></mesh>
  </group>;
  if (icon === "trophy") return <group name="map-building-arena" position={[0, .2, 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.34, .1, 9, 28]} /><meshStandardMaterial color="#c5a852" emissive={accent} emissiveIntensity={.55} roughness={.52} /></mesh>
    {[0, 1, 2, 3].map((index) => <mesh key={index} position={[Math.cos(index * Math.PI / 2) * .29, .2, Math.sin(index * Math.PI / 2) * .29]}><cylinderGeometry args={[.035, .05, .42, 8]} /><meshStandardMaterial color="#e9d48b" /></mesh>)}
  </group>;
  return <group name="map-building-prism" position={[0, .26, 0]}>
    {[-.18, 0, .18].map((x, index) => <mesh key={x} position={[x, index === 1 ? .28 : .16, 0]} rotation={[0, 0, index === 1 ? 0 : x]}><octahedronGeometry args={[index === 1 ? .2 : .14]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.35} metalness={.22} roughness={.3} /></mesh>)}
  </group>;
}

function RegionNames({ projection }: { projection: WildsAtlasProjection }) {
  if (projection.zoom !== "world") return null;
  return <group name="atlas-region-names">{WILDS_NAMED_REGIONS.map((region) => <Html center key={region.id} position={[region.position.x / WILDS_REGION_SIZE * 1.35, .28, region.position.z / WILDS_REGION_SIZE * 1.35]} zIndexRange={[1, 0]}><span className="wilds-atlas-region-name">{region.name}</span></Html>)}</group>;
}

function PresenceLights({ projection }: { projection: WildsAtlasProjection }) {
  const clusters = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useLayoutEffect(() => {
    if (!clusters.current) return;
    projection.playerClusters.forEach((cluster, index) => {
      const x = (cluster.regionX - projection.centerRegion.x) * 1.35;
      const z = (cluster.regionZ - projection.centerRegion.z) * 1.35;
      const size = 0.08 + Math.min(0.2, cluster.count * 0.012);
      matrix.compose(new THREE.Vector3(x, 0.36, z), new THREE.Quaternion(), new THREE.Vector3(size, size, size));
      clusters.current!.setMatrixAt(index, matrix);
    });
    clusters.current.instanceMatrix.needsUpdate = true;
  }, [matrix, projection]);
  return (
    <instancedMesh args={[undefined, undefined, projection.playerClusters.length]} ref={clusters}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial color="#72dfff" transparent opacity={0.88} />
    </instancedMesh>
  );
}

function ExactPlayerLights({ projection }: { projection: WildsAtlasProjection }) {
  const players = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useLayoutEffect(() => {
    projection.exactPlayers.forEach((player, index) => {
      const x = (player.x / WILDS_REGION_SIZE - projection.centerRegion.x) * 1.35;
      const z = (player.z / WILDS_REGION_SIZE - projection.centerRegion.z) * 1.35;
      matrix.compose(new THREE.Vector3(x, .48, z), new THREE.Quaternion(), new THREE.Vector3(.14, .14, .14));
      players.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(x, .32, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(.2, .2, .2));
      halos.current?.setMatrixAt(index, matrix);
    });
    if (players.current) players.current.instanceMatrix.needsUpdate = true;
    if (halos.current) halos.current.instanceMatrix.needsUpdate = true;
  }, [matrix, projection]);
  return <group name="atlas-live-players">
    <instancedMesh args={[undefined, undefined, projection.exactPlayers.length]} ref={players}>
      <capsuleGeometry args={[.42, .7, 4, 8]} />
      <meshStandardMaterial color="#f5ffff" emissive="#72dfff" emissiveIntensity={1.8} roughness={.3} />
    </instancedMesh>
    <instancedMesh args={[undefined, undefined, projection.exactPlayers.length]} ref={halos}>
      <torusGeometry args={[1, .12, 6, 20]} />
      <meshBasicMaterial color="#72dfff" transparent opacity={.78} />
    </instancedMesh>
  </group>;
}

function CurrentPositionBeam({ position, projection }: { position: { x: number; z: number }; projection: WildsAtlasProjection }) {
  const x = (position.x / WILDS_REGION_SIZE - projection.centerRegion.x) * 1.35;
  const z = (position.z / WILDS_REGION_SIZE - projection.centerRegion.z) * 1.35;
  return (
    <group name="atlas-current-position" position={[x, 0, z]}>
      <Html center position={[0, 1.9, 0]} zIndexRange={[3, 2]}>
        <span className="wilds-atlas-you-are-here">You are here</span>
      </Html>
      <mesh position={[0, 0.48, 0]}>
        <coneGeometry args={[0.16, 0.42, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#71e8c3" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.012, 0.05, 1.5, 8]} />
        <meshBasicMaterial color="#71e8c3" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}
