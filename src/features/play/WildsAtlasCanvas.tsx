"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { WILDS_REGION_SIZE } from "./multiplayer-core";
import type { WildsAtlasProjection } from "./wilds-world-atlas";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { WILDS_MAJOR_ROUTES, WILDS_NAMED_REGIONS } from "./wilds-world-geography";

const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = Math.PI * 2 / (PHI * PHI);
const ATLAS_SCALE = 1.35;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = clamp01((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

function distanceToSegment(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  const progress = lengthSquared ? clamp01(((x - ax) * dx + (z - az) * dz) / lengthSquared) : 0;
  return Math.hypot(x - (ax + dx * progress), z - (az + dz * progress));
}

function geographicTopography(x: number, z: number, islandRadius: number) {
  const radial = Math.hypot(x / 1.06, z);
  const coast = smoothstep(islandRadius * .8, islandRadius, radial);
  const echoRidge = Math.exp(-Math.pow(distanceToSegment(x, z, .2, -.8, 4.6, -3.7) / .66, 2));
  const northSpur = Math.exp(-Math.pow(distanceToSegment(x, z, 1.2, -1.9, 2.1, -4.5) / .52, 2));
  const amberHills = Math.exp(-Math.pow(Math.hypot((x - 3.55) / 1.4, (z - 2.1) / 1.05), 2));
  const moonwaterBasin = Math.exp(-Math.pow(Math.hypot((x + .65) / 1.45, (z + 3.75) / 1.12), 2));
  const prismCoast = Math.exp(-Math.pow(Math.hypot((x + 3.8) / 1.3, (z - 2.65) / 1.1), 2));
  const foothills = Math.abs(Math.sin(x * 1.26 + z * .42)) * .13 + Math.sin(z * .8 - x * .31) * .09;
  const crags = echoRidge * (.82 + Math.abs(Math.sin(x * 3.7 - z * 2.1)) * .58);
  const base = .16 + terrainNoise(x, z) * .42 + crags + northSpur * .72 + amberHills * .38;
  const height = base - moonwaterBasin * .3 - prismCoast * .12 - coast * 1.15;
  return {
    amberHills,
    coast,
    echoRidge: Math.max(echoRidge, northSpur),
    height: Math.max(-.34, height),
    moonwaterBasin,
    prismCoast,
    radial,
    relief: foothills
  };
}

function terrainHeight(x: number, z: number, islandRadius: number) {
  const field = geographicTopography(x, z, islandRadius);
  return field.height + field.relief * (1 - field.coast);
}

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
  const atlasSparkleCount = reducedMotion ? 12 : Math.round(38 * qualityProfile.particles);
  return (
    <div aria-hidden="true" className="wilds-atlas-canvas">
      <Canvas
        camera={{ fov: 40, near: 0.1, far: 80, position: [0, 9.6, 11.5] }}
        dpr={qualityProfile.dpr}
        frameloop={reducedMotion ? "demand" : "always"}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = .96;
        }}
        shadows={false}
      >
        <color attach="background" args={["#061820"]} />
        <fog attach="fog" args={["#061820", 12, 29]} />
        <AtlasCameraFraming />
        <ambientLight intensity={1.12} />
        <hemisphereLight color="#bffff0" groundColor="#071719" intensity={1.08} />
        <directionalLight color="#fff2a8" intensity={2.35} position={[4, 10, 3]} />
        <pointLight color="#71e8c3" intensity={24} position={[-5, 3, 2]} distance={16} />
        <pointLight color="#ff72bf" intensity={13} position={[6, 2, -5]} distance={13} />
        <AtlasHorizon />
        <OrganicWorldSurface onDrop={onDrop} projection={projection} />
        <AtlasWaters projection={projection} />
        <AtlasTerrainDetails projection={projection} qualityProfile={qualityProfile} />
        <MapRoutes />
        <RegionNames projection={projection} />
        <LandmarkBeacons projection={projection} selectedId={selectedId} onSelect={onSelect} />
        <DropPin position={selectedDrop} projection={projection} />
        <ExactPlayerLights projection={projection} />
        <PresenceLights projection={projection} />
        <TrainerLights projection={projection} />
        <CurrentPositionBeam position={currentPosition} projection={projection} />
        <Sparkles
          key={`wilds-atlas-sparkles-${atlasSparkleCount}`}
          count={atlasSparkleCount}
          color="#b9fff0"
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

function AtlasCameraFraming() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const portrait = size.height > size.width * 1.25;
    camera.fov = portrait ? 53 : 40;
    camera.position.set(0, portrait ? 11.8 : 9.6, portrait ? 14.4 : 11.5);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);
  return null;
}

function TrainerLights({ projection }: { projection: WildsAtlasProjection }) {
  return <group name="atlas-trainers">{projection.trainers.map((trainer) => {
    const x = (trainer.position[0] / WILDS_REGION_SIZE - projection.centerRegion.x) * 1.35;
    const z = (trainer.position[2] / WILDS_REGION_SIZE - projection.centerRegion.z) * 1.35;
    return <group key={trainer.id} position={[x, .44, z]}>
      <mesh><capsuleGeometry args={[.11, .28, 4, 8]} /><meshStandardMaterial color="#fff2b0" emissive="#d9982b" emissiveIntensity={1.65} /></mesh>
      <mesh position={[0, -.17, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.22, .025, 6, 20]} /><meshBasicMaterial color="#f7d25b" /></mesh>
      {projection.zoom === "world" ? null : <Html center position={[0, .55, 0]} zIndexRange={[2, 1]}><span className="wilds-atlas-trainer-label">{trainer.name} · Trainer</span></Html>}
    </group>;
  })}</group>;
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
      {[9.4, 11.7, 14.1].map((radius, index) => <mesh key={radius} position={[0, -.375 + index * .004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius, radius + .035, 96]} />
        <meshBasicMaterial color="#61c8bd" transparent opacity={.12 - index * .02} />
      </mesh>)}
    </group>
  );
}

function terrainNoise(x: number, z: number) {
  const broad = Math.sin(x * .48 + z * .13) * .24 + Math.cos(z * .41 - x * .17) * .2;
  const ridges = Math.abs(Math.sin(x * .92 + z * .63)) * .17;
  const detail = Math.sin((x + z) * 1.31) * .07 + Math.cos((x - z) * 1.77) * .045;
  return broad + ridges + detail;
}

function OrganicWorldSurface({ projection, onDrop }: { projection: WildsAtlasProjection; onDrop: (position: { x: number; z: number }) => void }) {
  const centerRegionX = projection.centerRegion.x;
  const centerRegionZ = projection.centerRegion.z;
  const nodes = projection.nodes;
  const size = Math.max(7.2, Math.sqrt(nodes.length) * 1.35);
  const geometry = useMemo(() => {
    const segments = 88;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const nodesByRegion = new Map(nodes.map((node) => [`${node.regionX}:${node.regionZ}`, node]));
    const fallback = nodes[Math.floor(nodes.length / 2)]!;
    const islandRadius = size * .455;
    const addVertex = (x: number, z: number) => {
      const regionX = Math.round(centerRegionX + x / 1.35);
      const regionZ = Math.round(centerRegionZ + z / 1.35);
      const node = nodesByRegion.get(`${regionX}:${regionZ}`) ?? fallback;
      const field = geographicTopography(x, z, islandRadius);
      const height = terrainHeight(x, z, islandRadius);
      const heartlands = new THREE.Color("#3d7848");
      const biomeColor = new THREE.Color(node.biome.ground.base);
      const color = heartlands.lerp(biomeColor, .32);
      if (field.echoRidge > .08) color.lerp(new THREE.Color("#586c61"), clamp01(field.echoRidge * .88));
      if (field.amberHills > .08) color.lerp(new THREE.Color("#7b7040"), clamp01(field.amberHills * .52));
      if (field.moonwaterBasin > .08) color.lerp(new THREE.Color("#214f4c"), clamp01(field.moonwaterBasin * .78));
      if (field.prismCoast > .08) color.lerp(new THREE.Color("#67846f"), clamp01(field.prismCoast * .52));
      if (field.coast > .08) color.lerp(new THREE.Color("#6d806e"), clamp01(field.coast * .78));
      color.offsetHSL(0, .04, Math.max(-.08, Math.min(.12, height * .045)));
      positions.push(x, height, z);
      colors.push(color.r, color.g, color.b);
    };
    for (let row = 0; row <= segments; row += 1) {
      const z = (row / segments - .5) * islandRadius * 2.12;
      for (let column = 0; column <= segments; column += 1) {
        const x = (column / segments - .5) * islandRadius * 2.22;
        addVertex(x, z);
      }
    }
    for (let row = 0; row < segments; row += 1) {
      for (let column = 0; column < segments; column += 1) {
        const midpointX = ((column + .5) / segments - .5) * islandRadius * 2.22;
        const midpointZ = ((row + .5) / segments - .5) * islandRadius * 2.12;
        const angle = Math.atan2(midpointZ, midpointX);
        const boundary = islandRadius * (1 + Math.sin(angle * 3 + .6) * .035 + Math.cos(angle * 5 - .4) * .025);
        if (Math.hypot(midpointX / 1.06, midpointZ) > boundary) continue;
        const a = row * (segments + 1) + column;
        const b = a + 1;
        const c = a + segments + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    next.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    next.setIndex(indices);
    next.computeVertexNormals();
    return next;
  }, [centerRegionX, centerRegionZ, nodes, size]);
  return <group name="organic-world-island">
    <mesh geometry={geometry} position={[0, -.18, 0]} scale={[1.018, 1, 1.018]}>
      <meshStandardMaterial color="#071f25" roughness={1} />
    </mesh>
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
        <meshStandardMaterial emissive="#09261e" emissiveIntensity={0.08} metalness={0.01} roughness={0.94} vertexColors />
      </mesh>
  </group>;
}

function AtlasWaters({ projection }: { projection: WildsAtlasProjection }) {
  const islandRadius = Math.max(7.2, Math.sqrt(projection.nodes.length) * 1.35) * .455;
  const rivers = useMemo(() => [
    [[4.25, -3.35], [3.25, -2.45], [2.1, -1.5], [1.05, -.72], [.15, .05], [-.75, 1.08], [-1.9, 2.4], [-3.4, 3.4]],
    [[1.45, -4.25], [1.05, -3.28], [.18, -2.82], [-.55, -3.25], [-.92, -4.32]],
    [[3.85, 1.6], [2.8, 1.75], [1.72, 1.2], [.62, .62], [-.15, .05]]
  ].map((points) => new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(
    x,
    Math.max(-.02, terrainHeight(x, z, islandRadius) + .018),
    z
  )))), [islandRadius]);
  return <group name="atlas-hydrology">
    <mesh position={[0, -.255, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[islandRadius * 1.22, 96]} />
      <meshPhysicalMaterial color="#0b5260" roughness={.2} metalness={.02} clearcoat={.72} transparent opacity={.88} />
    </mesh>
    {rivers.map((river, index) => <group key={index}>
      <mesh><tubeGeometry args={[river, 72, index === 0 ? .075 : .052, 8, false]} /><meshStandardMaterial color="#174c54" roughness={.68} /></mesh>
      <mesh><tubeGeometry args={[river, 72, index === 0 ? .052 : .034, 8, false]} /><meshPhysicalMaterial color="#5ec5c5" emissive="#1d7775" emissiveIntensity={.16} roughness={.18} clearcoat={.82} /></mesh>
    </group>)}
  </group>;
}

function AtlasTerrainDetails({ projection, qualityProfile }: { projection: WildsAtlasProjection; qualityProfile: WildsQualityProfile }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const understory = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const perNode = qualityProfile.tier === "low" ? 2 : qualityProfile.tier === "medium" ? 3 : 4;
  const islandRadius = Math.max(7.2, Math.sqrt(projection.nodes.length) * 1.35) * .455;
  const samples = useMemo(() => projection.nodes.flatMap((node, nodeIndex) => Array.from({ length: perNode }, (_, index) => {
    const seed = Math.sin((node.regionX * 97.1 + node.regionZ * 131.7 + index * 41.3)) * 43758.5453;
    const unit = seed - Math.floor(seed);
    const angle = (nodeIndex * perNode + index) * GOLDEN_ANGLE + unit * .34;
    const radius = .18 + Math.sqrt((index + .5) / perNode) * .43;
    const x = (node.regionX - projection.centerRegion.x) * ATLAS_SCALE + Math.cos(angle) * radius;
    const z = (node.regionZ - projection.centerRegion.z) * ATLAS_SCALE + Math.sin(angle) * radius;
    const field = geographicTopography(x, z, islandRadius);
    return {
      x,
      z,
      scale: .095 + ((unit * 5.17) % 1) * .085,
      rock: field.echoRidge > .22 || (nodeIndex + index) % 7 === 0,
      visible: field.coast < .7 && field.moonwaterBasin < .82
    };
  })), [islandRadius, perNode, projection]);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    samples.forEach((sample, index) => {
      const height = terrainHeight(sample.x, sample.z, islandRadius);
      const visible = sample.visible && Math.hypot(sample.x, sample.z) < islandRadius * .96;
      const treeScale = visible && !sample.rock ? sample.scale : 0;
      const rockScale = visible && sample.rock ? sample.scale * 1.8 : 0;
      quaternion.setFromEuler(new THREE.Euler(0, index * GOLDEN_ANGLE, 0));
      matrix.compose(new THREE.Vector3(sample.x, height + treeScale * 1.35, sample.z), quaternion, new THREE.Vector3(treeScale * .42, treeScale * 2.7, treeScale * .42));
      trunks.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(sample.x, height + treeScale * 3.05, sample.z), quaternion, new THREE.Vector3(treeScale * 2.35, treeScale * 2.05, treeScale * 2.15));
      crowns.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(sample.x + treeScale * .42, height + treeScale * 2.62, sample.z - treeScale * .18), quaternion, new THREE.Vector3(treeScale * 1.5, treeScale * 1.35, treeScale * 1.42));
      understory.current?.setMatrixAt(index, matrix);
      quaternion.setFromEuler(new THREE.Euler((index % 3 - 1) * .13, index * GOLDEN_ANGLE, .08));
      matrix.compose(new THREE.Vector3(sample.x, height + rockScale * .35, sample.z), quaternion, new THREE.Vector3(rockScale * 1.35, rockScale * .72, rockScale));
      rocks.current?.setMatrixAt(index, matrix);
    });
    for (const mesh of [trunks.current, crowns.current, understory.current, rocks.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [islandRadius, samples]);
  return <group name="atlas-instanced-terrain-detail">
    <instancedMesh args={[undefined, undefined, samples.length]} ref={trunks}><cylinderGeometry args={[1, 1.35, 1, 7]} /><meshStandardMaterial color="#493527" roughness={1} /></instancedMesh>
    <instancedMesh args={[undefined, undefined, samples.length]} ref={crowns}><icosahedronGeometry args={[.88, 1]} /><meshStandardMaterial color="#326f43" emissive="#173d25" emissiveIntensity={.28} roughness={.9} /></instancedMesh>
    <instancedMesh args={[undefined, undefined, samples.length]} ref={understory}><dodecahedronGeometry args={[.86, 0]} /><meshStandardMaterial color="#4c8250" emissive="#1a4027" emissiveIntensity={.2} roughness={.92} /></instancedMesh>
    <instancedMesh args={[undefined, undefined, samples.length]} ref={rocks}><dodecahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#657169" roughness={.99} /></instancedMesh>
  </group>;
}

function MapRoutes() {
  const islandRadius = Math.max(7.2, Math.sqrt(81) * 1.35) * .455;
  const routes = useMemo(() => WILDS_MAJOR_ROUTES.map((route) => new THREE.CatmullRomCurve3(
    route.points.map((point) => {
      const x = point.x / WILDS_REGION_SIZE * ATLAS_SCALE;
      const z = point.z / WILDS_REGION_SIZE * ATLAS_SCALE;
      return new THREE.Vector3(x, terrainHeight(x, z, islandRadius) + .045, z);
    })
  )), [islandRadius]);
  return <group name="atlas-routes">{routes.map((route, index) => <group key={index}>
    <mesh><tubeGeometry args={[route, 64, index ? .052 : .072, 7, false]} /><meshStandardMaterial color="#263a31" roughness={.98} /></mesh>
    <mesh><tubeGeometry args={[route, 64, index ? .026 : .036, 7, false]} /><meshStandardMaterial color={index ? "#a3c7b3" : "#e8d69a"} emissive={index ? "#285e51" : "#695f39"} emissiveIntensity={0.2} roughness={0.78} /></mesh>
  </group>)}</group>;
}

function DropPin({ position, projection }: { position: { x: number; z: number } | null; projection: WildsAtlasProjection }) {
  if (!position) return null;
  const x = (position.x / WILDS_REGION_SIZE - projection.centerRegion.x) * 1.35;
  const z = (position.z / WILDS_REGION_SIZE - projection.centerRegion.z) * 1.35;
  return <group name="atlas-drop-pin" position={[x, .42, z]}>
    <mesh position={[0, .24, 0]}><sphereGeometry args={[.16, 16, 12]} /><meshStandardMaterial color="#fff3a0" emissive="#f7c948" emissiveIntensity={2.2} /></mesh>
    <mesh position={[0, .06, 0]}><cylinderGeometry args={[.035, .055, .32, 10]} /><meshStandardMaterial color="#f7d25b" roughness={.44} /></mesh>
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
  return projection.landmarks.map((landmark, landmarkIndex) => {
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
        <Html center position={[Math.cos(landmarkIndex * GOLDEN_ANGLE) * .22, 0.86 + (landmarkIndex % 2) * .11, Math.sin(landmarkIndex * GOLDEN_ANGLE) * .22]} zIndexRange={[2, 1]}>
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

function LandmarkMiniature({ icon, accent, active }: { icon: "tree" | "trophy" | "sparkles" | "compass"; accent: string; active: boolean }) {
  if (icon === "tree") return <group name="map-building-hearttree" position={[0, .2, 0]}>
    <mesh position={[0, .2, 0]}><cylinderGeometry args={[.07, .11, .52, 10]} /><meshStandardMaterial color="#8a583e" roughness={.8} /></mesh>
    <mesh position={[0, .56, 0]}><icosahedronGeometry args={[active ? .34 : .28, 1]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} roughness={.68} /></mesh>
  </group>;
  if (icon === "trophy") return <group name="map-building-arena" position={[0, .2, 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.34, .1, 9, 28]} /><meshStandardMaterial color="#c5a852" emissive={accent} emissiveIntensity={.55} roughness={.52} /></mesh>
    {[0, 1, 2, 3].map((index) => <mesh key={index} position={[Math.cos(index * Math.PI / 2) * .29, .2, Math.sin(index * Math.PI / 2) * .29]}><cylinderGeometry args={[.035, .05, .42, 8]} /><meshStandardMaterial color="#e9d48b" /></mesh>)}
  </group>;
  if (icon === "compass") return <group name="map-building-wayfinder-hollow" position={[0, .22, 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.32, .32, .08, 24]} /><meshStandardMaterial color="#183e43" emissive={accent} emissiveIntensity={active ? 1.2 : .7} metalness={.42} roughness={.3} /></mesh>
    <mesh position={[0, .18, 0]} rotation={[0, Math.PI / 4, -.18]} scale={[.12, .48, .08]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} /></mesh>
    <mesh position={[0, .05, 0]}><sphereGeometry args={[.07, 12, 8]} /><meshBasicMaterial color="#fff6c8" /></mesh>
  </group>;
  return <group name="map-building-prism" position={[0, .26, 0]}>
    {[-.18, 0, .18].map((x, index) => <mesh key={x} position={[x, index === 1 ? .28 : .16, 0]} rotation={[0, 0, index === 1 ? 0 : x]}><octahedronGeometry args={[index === 1 ? .2 : .14]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.35} metalness={.22} roughness={.3} /></mesh>)}
  </group>;
}

function RegionNames({ projection }: { projection: WildsAtlasProjection }) {
  if (projection.zoom !== "world") return null;
  const islandRadius = Math.max(7.2, Math.sqrt(projection.nodes.length) * 1.35) * .455;
  return <group name="atlas-region-names">{WILDS_NAMED_REGIONS.map((region, index) => {
    const x = region.position.x / WILDS_REGION_SIZE * ATLAS_SCALE;
    const z = region.position.z / WILDS_REGION_SIZE * ATLAS_SCALE;
    return <Html center key={region.id} position={[x + Math.cos(index * GOLDEN_ANGLE) * .16, terrainHeight(x, z, islandRadius) + .38 + (index % 2) * .08, z + Math.sin(index * GOLDEN_ANGLE) * .16]} zIndexRange={[1, 0]}><span className="wilds-atlas-region-name">{region.name}</span></Html>;
  })}</group>;
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
        <capsuleGeometry args={[0.1, 0.22, 4, 10]} />
        <meshStandardMaterial color="#ffffff" emissive="#71e8c3" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.012, 0.05, 1.5, 8]} />
        <meshBasicMaterial color="#71e8c3" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}
