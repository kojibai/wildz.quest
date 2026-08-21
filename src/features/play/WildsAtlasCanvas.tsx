"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, MapControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { WILDS_REGION_SIZE } from "./multiplayer-core";
import type { WildsAtlasProjection } from "./wilds-world-atlas";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { sampleWildsTerrain, type WildsTerrainSurface } from "./wilds-terrain-authority";
import { WILDS_MAJOR_ROUTES, WILDS_NAMED_REGIONS } from "./wilds-world-geography";
import {
  atlasLocalCoordinate,
  atlasWorldCoordinate,
  buildWildsAtlasRenderTiles,
  clipWildsAtlasRouteSegments,
  wildsAtlasContainsWorld,
  wildsAtlasProjectedBounds,
  wildsAtlasProjectedSpan,
  type WildsAtlasRenderTile
} from "./wilds-atlas-render-tiles";
import { atlasCameraFrame, atlasCameraOpeningFrame, atlasCameraOpeningLimits, preserveWildsAtlasCameraLimits, rebaseWildsAtlasCameraPose, resolveWildsAtlasCameraPose, translateWildsAtlasCamera } from "./wilds-atlas-camera";

const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = Math.PI * 2 / (PHI * PHI);
const ATLAS_MAX_TERRAIN_VERTICES = 16_384;
const ATLAS_MAX_TERRAIN_TILES = 96;
const ATLAS_MAX_DETAIL_INSTANCES = 384;
const ATLAS_MAX_ROUTE_SEGMENTS = 64;
const ATLAS_CLICK_DRAG_THRESHOLD = 6;
const ATLAS_REFERENCE_REGION_UNIT = 27 / 20;

function atlasTerrainHeightScale(regionUnit: number) {
  return Math.max(.018, Math.min(.072, regionUnit / ATLAS_REFERENCE_REGION_UNIT * .072));
}

function atlasTerrainHeight(worldX: number, worldZ: number, regionUnit: number) {
  return sampleWildsTerrain(worldX, worldZ).elevation * atlasTerrainHeightScale(regionUnit);
}

const SURFACE_COLORS: Record<WildsTerrainSurface, string> = {
  "deep-water": "#0879a8",
  "shallow-water": "#2abec5",
  grass: "#3f8a50",
  rock: "#65736d",
  sand: "#d8bd74",
  soil: "#766348",
  trail: "#e0cb8a"
};

export function WildsAtlasCanvas({
  projection: sourceProjection,
  currentPosition,
  qualityProfile,
  selectedId,
  selectedDrop,
  recenterRequest,
  fitRequest,
  reducedMotion,
  onSelect,
  onDrop
}: {
  projection: WildsAtlasProjection;
  currentPosition: { x: number; z: number };
  qualityProfile: WildsQualityProfile;
  selectedId: string | null;
  selectedDrop: { x: number; z: number } | null;
  recenterRequest: number;
  fitRequest: number;
  reducedMotion: boolean;
  onSelect: (landmarkId: string) => void;
  onDrop: (position: { x: number; z: number }) => void;
}) {
  const [renderCenterRegion, setRenderCenterRegion] = useState(() => ({
    x: Math.floor(currentPosition.x / WILDS_REGION_SIZE) + .5,
    z: Math.floor(currentPosition.z / WILDS_REGION_SIZE) + .5
  }));
  const projection = useMemo(() => ({ ...sourceProjection, centerRegion: renderCenterRegion }), [sourceProjection, renderCenterRegion]);
  const atlasSparkleCount = reducedMotion ? 12 : Math.round(38 * qualityProfile.particles);
  const atlasSpan = wildsAtlasProjectedSpan(projection.nodes, projection.regionUnit);
  const viewBounds = useMemo(
    () => {
      const bounds = wildsAtlasProjectedBounds(projection.nodes);
      return bounds.count === 0 ? projection.bounds : bounds;
    },
    [projection.bounds, projection.nodes]
  );
  const fogFar = Math.max(29, Math.min(72, atlasSpan * 1.8 + 18));
  return (
    <div aria-hidden="true" className="wilds-atlas-canvas">
      <Canvas
        camera={{ fov: 40, near: 0.1, far: Math.max(80, fogFar * 1.6), position: [0, 9.6, 11.5] }}
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
        <fog attach="fog" args={["#061820", Math.max(12, fogFar * .38), fogFar]} />
        <ambientLight intensity={1.12} />
        <hemisphereLight color="#bffff0" groundColor="#071719" intensity={1.08} />
        <directionalLight color="#fff2a8" intensity={2.35} position={[4, 10, 3]} />
        <pointLight color="#71e8c3" intensity={24} position={[-5, 3, 2]} distance={16} />
        <pointLight color="#ff72bf" intensity={13} position={[6, 2, -5]} distance={13} />
        <ContinuousWorldSurface onDrop={onDrop} projection={projection} />
        <AtlasTerrainDetails projection={projection} qualityProfile={qualityProfile} />
        <MapRoutes projection={projection} />
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
          scale={[Math.max(16, Math.min(40, atlasSpan)), 5, Math.max(16, Math.min(40, atlasSpan))]}
          size={1.5}
          speed={reducedMotion ? 0 : 0.2}
        />
        <AtlasCameraRig
          bounds={viewBounds}
          centerRegion={projection.centerRegion}
          currentPosition={currentPosition}
          far={fogFar}
          fitRequest={fitRequest}
          recenterRequest={recenterRequest}
          reducedMotion={reducedMotion}
          regionUnit={projection.regionUnit}
          onRenderCenterRegionChange={setRenderCenterRegion}
        />
      </Canvas>
    </div>
  );
}

function AtlasCameraRig({
  bounds,
  centerRegion,
  currentPosition,
  far,
  fitRequest,
  recenterRequest,
  reducedMotion,
  regionUnit,
  onRenderCenterRegionChange
}: {
  bounds: WildsAtlasProjection["bounds"];
  centerRegion: WildsAtlasProjection["centerRegion"];
  currentPosition: { x: number; z: number };
  far: number;
  fitRequest: number;
  recenterRequest: number;
  reducedMotion: boolean;
  regionUnit: number;
  onRenderCenterRegionChange: (center: { x: number; z: number }) => void;
}) {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const rebasing = useRef(false);
  const lastRecenterRequest = useRef(recenterRequest);
  const lastFitRequest = useRef<number | null>(null);
  const { camera, invalidate, size } = useThree();
  const frame = useMemo(
    () => atlasCameraFrame({ bounds, centerRegion, regionUnit }, size),
    [bounds, centerRegion, regionUnit, size]
  );
  const openingFrame = useMemo(
    () => atlasCameraOpeningFrame({ centerRegion, currentPosition, regionUnit }, size),
    [centerRegion, currentPosition, regionUnit, size]
  );
  const limits = useRef<{ minDistance: number; maxDistance: number; far: number }>(atlasCameraOpeningLimits(regionUnit));
  if (lastFitRequest.current !== null && lastFitRequest.current !== fitRequest) {
    limits.current = preserveWildsAtlasCameraLimits(limits.current, frame);
  }
  const activeLimits = limits.current;
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.fov = frame.fov;
    camera.far = Math.max(activeLimits.far, far * 1.6);
    camera.updateProjectionMatrix();
    invalidate();
  }, [activeLimits.far, camera, far, frame.far, frame.fov, invalidate]);
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !controls.current) return;
    const pose = resolveWildsAtlasCameraPose({
      current: {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.current.target.x, controls.current.target.y, controls.current.target.z]
      },
      frame,
      openingFrame,
      lastFitRequest: lastFitRequest.current,
      fitRequest
    });
    lastFitRequest.current = fitRequest;
    if (!pose.fitted) return;
    const floating = rebaseWildsAtlasCameraPose({ centerRegion, current: pose, regionUnit, threshold: 96 });
    camera.position.set(...floating.position);
    controls.current.target.set(...floating.target);
    if (floating.rebased) onRenderCenterRegionChange({ ...floating.centerRegion });
    controls.current.update();
    invalidate();
  }, [camera, centerRegion, fitRequest, frame, invalidate, onRenderCenterRegionChange, openingFrame, regionUnit]);
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !controls.current) return;
    if (lastRecenterRequest.current === recenterRequest) return;
    lastRecenterRequest.current = recenterRequest;
    const nextTarget = Object.freeze([
      atlasLocalCoordinate(currentPosition.x, centerRegion.x, regionUnit),
      0,
      atlasLocalCoordinate(currentPosition.z, centerRegion.z, regionUnit)
    ]) as readonly [number, number, number];
    const translated = translateWildsAtlasCamera({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.current.target.x, controls.current.target.y, controls.current.target.z],
      nextTarget
    });
    const floating = rebaseWildsAtlasCameraPose({ centerRegion, current: translated, regionUnit, threshold: 96 });
    camera.position.set(...floating.position);
    controls.current.target.set(...floating.target);
    if (floating.rebased) onRenderCenterRegionChange({ ...floating.centerRegion });
    controls.current.update();
    invalidate();
  }, [camera, centerRegion, currentPosition.x, currentPosition.z, invalidate, onRenderCenterRegionChange, recenterRequest, regionUnit]);
  useFrame(() => {
    if (rebasing.current || !(camera instanceof THREE.PerspectiveCamera) || !controls.current) return;
    if (Math.abs(controls.current.target.x) <= 96 && Math.abs(controls.current.target.z) <= 96) return;
    const floating = rebaseWildsAtlasCameraPose({
      centerRegion,
      current: {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.current.target.x, controls.current.target.y, controls.current.target.z]
      },
      regionUnit,
      threshold: 96
    });
    if (!floating.rebased) return;
    rebasing.current = true;
    camera.position.set(...floating.position);
    controls.current.target.set(...floating.target);
    onRenderCenterRegionChange({ ...floating.centerRegion });
    controls.current.update();
    rebasing.current = false;
    invalidate();
  });
  return <MapControls
    dampingFactor={0.08}
    enableDamping={!reducedMotion}
    enablePan
    enableRotate
    makeDefault
    maxDistance={activeLimits.maxDistance}
    maxPolarAngle={Math.PI / 2.25}
    minDistance={activeLimits.minDistance}
    minPolarAngle={0.35}
    mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
    panSpeed={0.72}
    ref={controls}
    rotateSpeed={0.5}
    screenSpacePanning={false}
    touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    zoomSpeed={0.82}
    zoomToCursor
  />;
}

function TrainerLights({ projection }: { projection: WildsAtlasProjection }) {
  return <group name="atlas-trainers">{projection.trainers.map((trainer) => {
    const x = atlasLocalCoordinate(trainer.position[0], projection.centerRegion.x, projection.regionUnit);
    const z = atlasLocalCoordinate(trainer.position[2], projection.centerRegion.z, projection.regionUnit);
    return <group key={trainer.id} position={[x, .44, z]}>
      <mesh><capsuleGeometry args={[.11, .28, 4, 8]} /><meshStandardMaterial color="#fff2b0" emissive="#d9982b" emissiveIntensity={1.65} /></mesh>
      <mesh position={[0, -.17, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.22, .025, 6, 20]} /><meshBasicMaterial color="#f7d25b" /></mesh>
      {projection.zoom === "world" ? null : <Html center position={[0, .55, 0]} wrapperClass="wilds-atlas-pass-through-label" zIndexRange={[2, 1]}><span className="wilds-atlas-trainer-label">{trainer.name} · Trainer</span></Html>}
    </group>;
  })}</group>;
}

function ContinuousWorldSurface({ projection, onDrop }: { projection: WildsAtlasProjection; onDrop: (position: { x: number; z: number }) => void }) {
  const tiles = useMemo(() => buildWildsAtlasRenderTiles(projection.nodes, {
    maxTiles: ATLAS_MAX_TERRAIN_TILES,
    maxVertices: ATLAS_MAX_TERRAIN_VERTICES
  }), [projection.nodes]);
  const nodesByRegion = useMemo(() => new Map(projection.nodes.map((node) => [`${node.regionX}:${node.regionZ}`, node])), [projection.nodes]);
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > ATLAS_CLICK_DRAG_THRESHOLD) return;
    const destination = {
      x: Number(atlasWorldCoordinate(event.point.x, projection.centerRegion.x, projection.regionUnit).toFixed(2)),
      z: Number(atlasWorldCoordinate(event.point.z, projection.centerRegion.z, projection.regionUnit).toFixed(2))
    };
    if (!wildsAtlasContainsWorld(projection.nodes, destination)) return;
    onDrop(destination);
  };
  return <group name="continuous-world-map">{tiles.map((tile, index) => tile.renderMode === "instanced-cells"
    ? <AtlasInstancedCellFallback handleClick={handleClick} key={`fallback:${index}`} nodesByRegion={nodesByRegion} projection={projection} tile={tile} />
    : <AtlasTerrainTile handleClick={handleClick} key={`tile:${tile.minRegionX}:${tile.minRegionZ}:${index}`} nodesByRegion={nodesByRegion} projection={projection} tile={tile} />
  )}</group>;
}

function AtlasTerrainTile({
  handleClick,
  nodesByRegion,
  projection,
  tile
}: {
  handleClick: (event: ThreeEvent<MouseEvent>) => void;
  nodesByRegion: ReadonlyMap<string, WildsAtlasProjection["nodes"][number]>;
  projection: WildsAtlasProjection;
  tile: WildsAtlasRenderTile;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const addVertex = (regionX: number, regionZ: number, biomeRegionX: number, biomeRegionZ: number) => {
      const worldX = regionX * WILDS_REGION_SIZE;
      const worldZ = regionZ * WILDS_REGION_SIZE;
      const x = atlasLocalCoordinate(worldX, projection.centerRegion.x, projection.regionUnit);
      const z = atlasLocalCoordinate(worldZ, projection.centerRegion.z, projection.regionUnit);
      const node = nodesByRegion.get(`${biomeRegionX}:${biomeRegionZ}`);
      if (!node) return false;
      const terrain = sampleWildsTerrain(worldX, worldZ);
      const height = terrain.elevation * atlasTerrainHeightScale(projection.regionUnit);
      const surfaceColor = new THREE.Color(SURFACE_COLORS[terrain.surface]);
      const biomeColor = new THREE.Color(node.biome.ground.base);
      const color = terrain.surface === "deep-water" || terrain.surface === "shallow-water"
        ? surfaceColor
        : biomeColor.lerp(surfaceColor, .72);
      color.offsetHSL(0, .025, Math.max(-.05, Math.min(.1, height * .035)));
      positions.push(x, height, z);
      colors.push(color.r, color.g, color.b);
      return true;
    };

    const addGrid = (minRegionX: number, maxRegionX: number, minRegionZ: number, maxRegionZ: number, segmentsX: number, segmentsZ: number) => {
      const vertexStart = positions.length / 3;
      const width = maxRegionX - minRegionX + 1;
      const depth = maxRegionZ - minRegionZ + 1;
      for (let row = 0; row <= segmentsZ; row += 1) {
        const regionZ = minRegionZ + row / segmentsZ * depth;
        const biomeRegionZ = Math.min(maxRegionZ, Math.floor(regionZ - (row === segmentsZ ? 1e-9 : 0)));
        for (let column = 0; column <= segmentsX; column += 1) {
          const regionX = minRegionX + column / segmentsX * width;
          const biomeRegionX = Math.min(maxRegionX, Math.floor(regionX - (column === segmentsX ? 1e-9 : 0)));
          addVertex(regionX, regionZ, biomeRegionX, biomeRegionZ);
        }
      }
      for (let row = 0; row < segmentsZ; row += 1) {
        for (let column = 0; column < segmentsX; column += 1) {
          const a = vertexStart + row * (segmentsX + 1) + column;
          const b = a + 1;
          const c = a + segmentsX + 1;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    };

    if (tile.cells) {
      for (const cell of tile.cells) addGrid(cell.regionX, cell.regionX, cell.regionZ, cell.regionZ, 1, 1);
    } else {
      addGrid(tile.minRegionX, tile.maxRegionX, tile.minRegionZ, tile.maxRegionZ, tile.segmentsX, tile.segmentsZ);
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    next.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    next.setIndex(indices);
    next.computeVertexNormals();
    return next;
  }, [nodesByRegion, projection.centerRegion.x, projection.centerRegion.z, projection.regionUnit, tile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} name="continuous-world-surface" onClick={handleClick} receiveShadow>
    <meshStandardMaterial emissive="#09261e" emissiveIntensity={0.08} metalness={0.01} roughness={0.94} vertexColors />
  </mesh>;
}

function AtlasInstancedCellFallback({
  handleClick,
  nodesByRegion,
  projection,
  tile
}: {
  handleClick: (event: ThreeEvent<MouseEvent>) => void;
  nodesByRegion: ReadonlyMap<string, WildsAtlasProjection["nodes"][number]>;
  projection: WildsAtlasProjection;
  tile: WildsAtlasRenderTile;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => tile.cells ?? [], [tile.cells]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    cells.forEach((cell, index) => {
      const worldX = (cell.regionX + .5) * WILDS_REGION_SIZE;
      const worldZ = (cell.regionZ + .5) * WILDS_REGION_SIZE;
      const terrain = sampleWildsTerrain(worldX, worldZ);
      const node = nodesByRegion.get(`${cell.regionX}:${cell.regionZ}`);
      const surfaceColor = new THREE.Color(SURFACE_COLORS[terrain.surface]);
      const color = terrain.surface === "deep-water" || terrain.surface === "shallow-water"
        ? surfaceColor
        : new THREE.Color(node?.biome.ground.base ?? SURFACE_COLORS.grass).lerp(surfaceColor, .72);
      matrix.compose(
        new THREE.Vector3(
          atlasLocalCoordinate(worldX, projection.centerRegion.x, projection.regionUnit),
          terrain.elevation * atlasTerrainHeightScale(projection.regionUnit),
          atlasLocalCoordinate(worldZ, projection.centerRegion.z, projection.regionUnit)
        ),
        rotation,
        new THREE.Vector3(projection.regionUnit, projection.regionUnit, 1)
      );
      mesh.current!.setMatrixAt(index, matrix);
      mesh.current!.setColorAt(index, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [cells, nodesByRegion, projection.centerRegion.x, projection.centerRegion.z, projection.regionUnit]);
  return <instancedMesh args={[undefined, undefined, cells.length]} name="continuous-world-surface" onClick={handleClick} ref={mesh}>
    <planeGeometry args={[1, 1]} />
    <meshStandardMaterial emissive="#09261e" emissiveIntensity={0.08} metalness={0.01} roughness={0.94} vertexColors />
  </instancedMesh>;
}

function AtlasTerrainDetails({ projection, qualityProfile }: { projection: WildsAtlasProjection; qualityProfile: WildsQualityProfile }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const understory = useRef<THREE.InstancedMesh>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const perNode = qualityProfile.tier === "low" ? 2 : qualityProfile.tier === "medium" ? 3 : 4;
  const sampledNodes = useMemo(() => {
    const maximumNodes = Math.max(1, Math.floor(ATLAS_MAX_DETAIL_INSTANCES / perNode));
    if (projection.nodes.length <= maximumNodes) return projection.nodes;
    return Array.from({ length: maximumNodes }, (_, index) => projection.nodes[Math.floor(index * projection.nodes.length / maximumNodes)]!);
  }, [perNode, projection.nodes]);
  const samples = useMemo(() => sampledNodes.flatMap((node, nodeIndex) => Array.from({ length: perNode }, (_, index) => {
    const seed = Math.sin((node.regionX * 97.1 + node.regionZ * 131.7 + index * 41.3)) * 43758.5453;
    const unit = seed - Math.floor(seed);
    const angle = (nodeIndex * perNode + index) * GOLDEN_ANGLE + unit * .34;
    const radius = (.18 + Math.sqrt((index + .5) / perNode) * .3) * projection.regionUnit;
    const worldCenterX = (node.regionX + .5) * WILDS_REGION_SIZE;
    const worldCenterZ = (node.regionZ + .5) * WILDS_REGION_SIZE;
    const x = atlasLocalCoordinate(worldCenterX, projection.centerRegion.x, projection.regionUnit) + Math.cos(angle) * radius;
    const z = atlasLocalCoordinate(worldCenterZ, projection.centerRegion.z, projection.regionUnit) + Math.sin(angle) * radius;
    const worldX = atlasWorldCoordinate(x, projection.centerRegion.x, projection.regionUnit);
    const worldZ = atlasWorldCoordinate(z, projection.centerRegion.z, projection.regionUnit);
    const terrain = sampleWildsTerrain(worldX, worldZ);
    const visualScale = Math.max(.45, Math.min(1, projection.regionUnit / ATLAS_REFERENCE_REGION_UNIT));
    return {
      x,
      z,
      height: terrain.elevation * atlasTerrainHeightScale(projection.regionUnit),
      scale: (.095 + ((unit * 5.17) % 1) * .085) * visualScale,
      rock: terrain.surface === "rock",
      visible: terrain.surface !== "deep-water" && terrain.surface !== "shallow-water"
    };
  })), [perNode, projection.centerRegion.x, projection.centerRegion.z, projection.regionUnit, sampledNodes]);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    samples.forEach((sample, index) => {
      const treeScale = sample.visible && !sample.rock ? sample.scale : 0;
      const rockScale = sample.visible && sample.rock ? sample.scale * 1.8 : 0;
      quaternion.setFromEuler(new THREE.Euler(0, index * GOLDEN_ANGLE, 0));
      matrix.compose(new THREE.Vector3(sample.x, sample.height + treeScale * 1.34, sample.z), quaternion, new THREE.Vector3(treeScale * .42, treeScale * 2.7, treeScale * .42));
      trunks.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(sample.x, sample.height + treeScale * 3.05, sample.z), quaternion, new THREE.Vector3(treeScale * 2.35, treeScale * 2.05, treeScale * 2.15));
      crowns.current?.setMatrixAt(index, matrix);
      matrix.compose(new THREE.Vector3(sample.x + treeScale * .42, sample.height + treeScale * 2.62, sample.z - treeScale * .18), quaternion, new THREE.Vector3(treeScale * 1.5, treeScale * 1.34, treeScale * 1.42));
      understory.current?.setMatrixAt(index, matrix);
      quaternion.setFromEuler(new THREE.Euler((index % 3 - 1) * .13, index * GOLDEN_ANGLE, .08));
      matrix.compose(new THREE.Vector3(sample.x, sample.height + rockScale * .35, sample.z), quaternion, new THREE.Vector3(rockScale * 1.34, rockScale * .72, rockScale));
      rocks.current?.setMatrixAt(index, matrix);
    });
    for (const mesh of [trunks.current, crowns.current, understory.current, rocks.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [samples]);
  return <group name="atlas-instanced-terrain-detail">
    <instancedMesh args={[undefined, undefined, samples.length]} ref={trunks}><cylinderGeometry args={[1, 1.34, 1, 7]} /><meshStandardMaterial color="#493527" roughness={1} /></instancedMesh>
    <instancedMesh args={[undefined, undefined, samples.length]} ref={crowns}><icosahedronGeometry args={[.88, 1]} /><meshStandardMaterial color="#326f43" emissive="#173d25" emissiveIntensity={.28} roughness={.9} /></instancedMesh>
    <instancedMesh args={[undefined, undefined, samples.length]} ref={understory}><dodecahedronGeometry args={[.86, 0]} /><meshStandardMaterial color="#4c8250" emissive="#1a4027" emissiveIntensity={.2} roughness={.92} /></instancedMesh>
    <instancedMesh args={[undefined, undefined, samples.length]} ref={rocks}><dodecahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#657169" roughness={.99} /></instancedMesh>
  </group>;
}

function MapRoutes({ projection }: { projection: WildsAtlasProjection }) {
  const routes = useMemo(() => WILDS_MAJOR_ROUTES.flatMap((route) => (
    clipWildsAtlasRouteSegments(route.points, projection.nodes).map((segment) => new THREE.CatmullRomCurve3(
      segment.map((point) => {
      const x = atlasLocalCoordinate(point.x, projection.centerRegion.x, projection.regionUnit);
      const z = atlasLocalCoordinate(point.z, projection.centerRegion.z, projection.regionUnit);
      return new THREE.Vector3(x, atlasTerrainHeight(point.x, point.z, projection.regionUnit) + .045, z);
    })
    ))
  )).slice(0, ATLAS_MAX_ROUTE_SEGMENTS), [projection.centerRegion.x, projection.centerRegion.z, projection.nodes, projection.regionUnit]);
  return <group name="atlas-routes">{routes.map((route, index) => <group key={index}>
    <mesh><tubeGeometry args={[route, 32, index ? .052 : .072, 7, false]} /><meshStandardMaterial color="#263a31" roughness={.98} /></mesh>
    <mesh><tubeGeometry args={[route, 32, index ? .026 : .036, 7, false]} /><meshStandardMaterial color={index ? "#a3c7b3" : "#e8d69a"} emissive={index ? "#285e51" : "#695f39"} emissiveIntensity={0.2} roughness={0.78} /></mesh>
  </group>)}</group>;
}

function DropPin({ position, projection }: { position: { x: number; z: number } | null; projection: WildsAtlasProjection }) {
  if (!position || !wildsAtlasContainsWorld(projection.nodes, position)) return null;
  const x = atlasLocalCoordinate(position.x, projection.centerRegion.x, projection.regionUnit);
  const z = atlasLocalCoordinate(position.z, projection.centerRegion.z, projection.regionUnit);
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
    const x = atlasLocalCoordinate(landmark.position.x, projection.centerRegion.x, projection.regionUnit);
    const z = atlasLocalCoordinate(landmark.position.z, projection.centerRegion.z, projection.regionUnit);
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
        <Html center position={[Math.cos(landmarkIndex * GOLDEN_ANGLE) * .22, 0.86 + (landmarkIndex % 2) * .11, Math.sin(landmarkIndex * GOLDEN_ANGLE) * .22]} wrapperClass="wilds-atlas-pass-through-label" zIndexRange={[2, 1]}>
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
    {[-.18, 0, .18].map((x, index) => <mesh key={x} position={[x, index === 1 ? .28 : .16, 0]} rotation={[0, 0, index === 1 ? 0 : x]}><octahedronGeometry args={[index === 1 ? .2 : .14]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.34} metalness={.22} roughness={.3} /></mesh>)}
  </group>;
}

function RegionNames({ projection }: { projection: WildsAtlasProjection }) {
  if (projection.zoom !== "world") return null;
  return <group name="atlas-region-names">{WILDS_NAMED_REGIONS.filter((region) => (
    wildsAtlasContainsWorld(projection.nodes, region.position)
  )).map((region, index) => {
    const x = atlasLocalCoordinate(region.position.x, projection.centerRegion.x, projection.regionUnit);
    const z = atlasLocalCoordinate(region.position.z, projection.centerRegion.z, projection.regionUnit);
    return <Html center key={region.id} position={[x + Math.cos(index * GOLDEN_ANGLE) * .16, atlasTerrainHeight(region.position.x, region.position.z, projection.regionUnit) + .38 + (index % 2) * .08, z + Math.sin(index * GOLDEN_ANGLE) * .16]} wrapperClass="wilds-atlas-pass-through-label" zIndexRange={[1, 0]}><span className="wilds-atlas-region-name">{region.name}</span></Html>;
  })}</group>;
}

function PresenceLights({ projection }: { projection: WildsAtlasProjection }) {
  const clusters = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useLayoutEffect(() => {
    if (!clusters.current) return;
    projection.playerClusters.forEach((cluster, index) => {
      const x = atlasLocalCoordinate((cluster.regionX + .5) * WILDS_REGION_SIZE, projection.centerRegion.x, projection.regionUnit);
      const z = atlasLocalCoordinate((cluster.regionZ + .5) * WILDS_REGION_SIZE, projection.centerRegion.z, projection.regionUnit);
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
      const x = atlasLocalCoordinate(player.x, projection.centerRegion.x, projection.regionUnit);
      const z = atlasLocalCoordinate(player.z, projection.centerRegion.z, projection.regionUnit);
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
  const x = atlasLocalCoordinate(position.x, projection.centerRegion.x, projection.regionUnit);
  const z = atlasLocalCoordinate(position.z, projection.centerRegion.z, projection.regionUnit);
  return (
    <group name="atlas-current-position" position={[x, 0, z]}>
      <Html center position={[0, 1.9, 0]} wrapperClass="wilds-atlas-pass-through-label" zIndexRange={[3, 2]}>
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
