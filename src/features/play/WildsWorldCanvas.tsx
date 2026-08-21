"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  creatureCards,
  selectedCard,
  type CreatureCard,
  type PlayState
} from "@/features/play/game-state";
import { creatureForm } from "@/features/play/creature-catalog";
import type { BattleFighter } from "@/features/play/battle-engine";
import type { HotspotCover } from "@/features/play/hidden-hotspots";
import type { WildsPresence } from "@/features/play/multiplayer-core";
import { WildsEnvironment } from "@/features/play/WildsEnvironment";
import { WildsExplorer } from "@/features/play/WildsExplorer";
import { WildsAtmosphere } from "@/features/play/WildsAtmosphere";
import { WildsUnderwaterAtmosphere } from "@/features/play/WildsUnderwaterAtmosphere";
import { WildsCreatureActor, type WildsCreaturePose } from "@/features/play/WildsCreatureActor";
import { projectEncounterCreatureVisualIdentity } from "@/features/play/creature-visual-identity";
import { projectWorldProgression } from "@/features/play/world-progression";
import {
  rendererBudgetStatus,
  type WildsQualityProfile
} from "@/features/play/wilds-quality-profile";
import type { WildsWorldProjection } from "@/features/play/wilds-world-state";
import type { WildsSettlementWorldMode } from "@/features/play/WildsSettlementEnvironment";
import { WildsEcologyEnvironment } from "@/features/play/WildsEcologyEnvironment";
import { WildsBossEnvironment } from "@/features/play/WildsBossEnvironment";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { KaiKlokMoment } from "@/features/play/kai-klok-moment";
import { projectKaiWorldExpression } from "@/features/play/kai-moment-expression";
import { WildsKaiAtmosphereGeometry } from "@/features/play/WildsKaiAtmosphereGeometry";
import { WildsCelestialSky } from "@/features/play/WildsCelestialSky";
import { wildsStarCountForTier } from "@/features/play/wilds-celestial-model";
import {
  DEFAULT_WILDS_VISUAL_SETTINGS,
  normalizeWildsVisualSettings,
  projectWildsNightRig,
  type WildsVisualSettings
} from "@/features/play/wilds-night-visibility";
import { projectCardKaiAppearance } from "@/features/play/card-kai-appearance";
import type { WildsTrainerProjection } from "@/features/play/wilds-saga-trainers";
import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import { WildsReadabilityProvider, useWildsReadability } from "@/features/play/WildsReadabilityContext";
import {
  projectWildsAuthoredDarkness,
  projectWildsReadabilityProfile
} from "@/features/play/wilds-night-readability";
import { projectWildsTerrainActorPosition } from "@/features/play/wilds-terrain-rendering";
import type { WildsAquaticPresentation } from "@/features/play/wilds-aquatic-presentation";
import {
  createWildsAerialRuntimeResult,
  writeWildsAerialRuntimeStep,
  type WildsAerialRuntimeStep,
  type WildsAerialLandingReason,
  type WildsAerialMode,
  type WildsAerialTraversalState
} from "@/features/play/wilds-aerial-traversal";
import type { WildsTraversalCapability } from "@/features/play/wilds-traversal-capabilities";
import type { WildsOverlookId } from "@/features/play/wilds-overlooks";
import { isUnderwaterCameraSubmerged, writeUnderwaterCameraTarget, type MutableUnderwaterCameraProjection } from "@/features/play/wilds-underwater-camera";
import {
  writeWildsVerticalTraversalStep,
  type WildsVerticalTraversalIntent,
  type WildsVerticalTraversalState,
  type WildsVerticalTraversalStep
} from "@/features/play/wilds-vertical-traversal";
import {
  createWildsAerialCollisionSample,
  projectWildsAerialObstacleNeighborhood,
  writeWildsAerialCollisionSample
} from "@/features/play/wilds-grounded-movement";
import { projectWildsRenderedLivingObstacles } from "@/features/play/wilds-terrain-obstacles";
import { WILDS_TERRAIN_TILE_SIZE } from "@/features/play/wilds-terrain-authority";

const WILDS_DIAGNOSTICS_ENABLED = process.env.NODE_ENV !== "production";

export function WildsWorldCanvas({
  state,
  character,
  remotePlayers,
  qualityProfile,
  onFrameSample,
  onCameraHeadingChange,
  searchEnabled,
  onSelectPlayer,
  onSelectTrainer,
  onSelectOverlook,
  onSearchPoint,
  livingWorld,
  worldMode,
  kaiMoment,
  visualSettings = DEFAULT_WILDS_VISUAL_SETTINGS,
  supportCards = [],
  trainers = [],
  aerialCapabilities,
  aerialStateRef,
  verticalTraversalRef,
  verticalIntentRef,
  horizontalAllowedRef,
  liftPotential,
  pressurePotential,
  aquaticPresentation,
  onAerialEnergyChange,
  onAerialModeChange,
  onLandingRequired,
  onVerticalReadoutChange,
  vistaHeading = null,
  suspended = false
}: {
  state: PlayState;
  character: WildzCharacterGenesis;
  remotePlayers: WildsPresence[];
  qualityProfile: WildsQualityProfile;
  onFrameSample?: (frameMs: number) => void;
  onCameraHeadingChange: (heading: number) => void;
  searchEnabled: boolean;
  onSelectPlayer: (player: WildsPresence | null) => void;
  onSearchPoint: (point: { x: number; z: number }) => void;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
  kaiMoment: KaiKlokMoment;
  visualSettings?: Partial<WildsVisualSettings>;
  supportCards?: readonly PortableCardAsset[];
  trainers?: readonly WildsTrainerProjection[];
  aerialCapabilities: readonly WildsTraversalCapability[];
  aerialStateRef: MutableRefObject<WildsAerialTraversalState>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
  verticalIntentRef: MutableRefObject<WildsVerticalTraversalIntent>;
  horizontalAllowedRef: MutableRefObject<boolean>;
  liftPotential: number;
  pressurePotential: number;
  aquaticPresentation: WildsAquaticPresentation;
  onAerialEnergyChange: (energy: number) => void;
  onAerialModeChange: (mode: WildsAerialMode) => void;
  onLandingRequired: (reason: WildsAerialLandingReason) => void;
  onVerticalReadoutChange: (layer: WildsVerticalTraversalState["layer"], value: number, safeMin: number, safeMax: number) => void;
  vistaHeading?: number | null;
  onSelectTrainer: (trainer: WildsTrainerProjection) => void;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
  suspended?: boolean;
}) {
  return (
    <div
      className={`wilds-canvas-wrap${searchEnabled ? " search-armed" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <Canvas
        camera={{ fov: 40, near: 0.1, far: 80, position: [4.2, 3.7, 6.6] }}
        dpr={qualityProfile.dpr}
        frameloop={suspended ? "never" : "always"}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl, size }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          if (WILDS_DIAGNOSTICS_ENABLED) publishWildsDiagnostics(gl, size, state, qualityProfile);
        }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        {onFrameSample ? <WildsFrameReporter onFrameSample={onFrameSample} /> : null}
        <Suspense fallback={null}>
          <WildsScene state={state} character={character} remotePlayers={remotePlayers} qualityProfile={qualityProfile} searchEnabled={searchEnabled} onCameraHeadingChange={onCameraHeadingChange} onSelectPlayer={onSelectPlayer} onSelectTrainer={onSelectTrainer} onSelectOverlook={onSelectOverlook} onSearchPoint={onSearchPoint} livingWorld={livingWorld} worldMode={worldMode} kaiMoment={kaiMoment} visualSettings={visualSettings} supportCards={supportCards} trainers={trainers} aerialCapabilities={aerialCapabilities} aerialStateRef={aerialStateRef} verticalTraversalRef={verticalTraversalRef} verticalIntentRef={verticalIntentRef} horizontalAllowedRef={horizontalAllowedRef} liftPotential={liftPotential} pressurePotential={pressurePotential} aquaticPresentation={aquaticPresentation} onAerialEnergyChange={onAerialEnergyChange} onAerialModeChange={onAerialModeChange} onLandingRequired={onLandingRequired} onVerticalReadoutChange={onVerticalReadoutChange} vistaHeading={vistaHeading} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function WildsFrameReporter({ onFrameSample }: { onFrameSample: (frameMs: number) => void }) {
  useFrame((_, delta) => onFrameSample(delta * 1_000));
  return null;
}

function WildsScene({
  state,
  character,
  remotePlayers,
  qualityProfile,
  searchEnabled,
  onCameraHeadingChange,
  onSelectPlayer,
  onSearchPoint,
  livingWorld,
  worldMode,
  kaiMoment,
  visualSettings,
  supportCards,
  trainers,
  onSelectTrainer,
  onSelectOverlook,
  aerialCapabilities,
  aerialStateRef,
  verticalTraversalRef,
  verticalIntentRef,
  horizontalAllowedRef,
  liftPotential,
  pressurePotential,
  aquaticPresentation,
  onAerialEnergyChange,
  onAerialModeChange,
  onLandingRequired,
  onVerticalReadoutChange,
  vistaHeading
}: {
  state: PlayState;
  character: WildzCharacterGenesis;
  remotePlayers: WildsPresence[];
  qualityProfile: WildsQualityProfile;
  searchEnabled: boolean;
  onCameraHeadingChange: (heading: number) => void;
  onSelectPlayer: (player: WildsPresence | null) => void;
  onSearchPoint: (point: { x: number; z: number }) => void;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
  kaiMoment: KaiKlokMoment;
  visualSettings: Partial<WildsVisualSettings>;
  supportCards: readonly PortableCardAsset[];
  trainers: readonly WildsTrainerProjection[];
  onSelectTrainer: (trainer: WildsTrainerProjection) => void;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
  aerialCapabilities: readonly WildsTraversalCapability[];
  aerialStateRef: MutableRefObject<WildsAerialTraversalState>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
  verticalIntentRef: MutableRefObject<WildsVerticalTraversalIntent>;
  horizontalAllowedRef: MutableRefObject<boolean>;
  liftPotential: number;
  pressurePotential: number;
  aquaticPresentation: WildsAquaticPresentation;
  onAerialEnergyChange: (energy: number) => void;
  onAerialModeChange: (mode: WildsAerialMode) => void;
  onLandingRequired: (reason: WildsAerialLandingReason) => void;
  onVerticalReadoutChange: (layer: WildsVerticalTraversalState["layer"], value: number, safeMin: number, safeMax: number) => void;
  vistaHeading: number | null;
}) {
  const world = projectWorldProgression(state.worldMastery);
  const kaiExpression = projectKaiWorldExpression(kaiMoment);
  const normalizedVisualSettings = useMemo(() => normalizeWildsVisualSettings(visualSettings), [visualSettings]);
  const darkness = projectWildsAuthoredDarkness({
    encounter: state.encounter,
    player: state.player,
    ecologySites: Object.values(livingWorld?.ecologySites ?? {})
  });
  const nightRig = projectWildsNightRig(kaiExpression, normalizedVisualSettings, {
    authoredDarkness: darkness.amount,
    mode: "adventure"
  });
  const readability = projectWildsReadabilityProfile({
    authoredDarkness: darkness.amount,
    characterFill: nightRig.characterFill,
    nightAmount: kaiExpression.night.amount,
    reducedMotion: qualityProfile.reducedMotion,
    rim: nightRig.rim
  });
  const kaiFog = useMemo(() => new THREE.Color(world.chapter.palette.fog)
    .lerp(new THREE.Color(kaiExpression.sky.horizon), 0.24 + kaiExpression.night.amount * 0.7)
    .lerp(new THREE.Color(kaiExpression.accent), kaiExpression.atmosphericInfluence)
    .multiplyScalar((1 - kaiExpression.night.amount * 0.48) * (1 - darkness.amount * 0.38))
    .getStyle(), [darkness.amount, kaiExpression.accent, kaiExpression.atmosphericInfluence, kaiExpression.night.amount, kaiExpression.sky.horizon, world.chapter.palette.fog]);
  const kaiSky = useMemo(() => new THREE.Color(kaiExpression.sky.zenith)
    .lerp(new THREE.Color("#050811"), darkness.amount * 0.72)
    .getStyle(), [darkness.amount, kaiExpression.sky.zenith]);
  const worldSparkleCount = Math.round(54 * qualityProfile.particles);
  const fogNear = qualityProfile.tier === "low" ? 9 : 10;
  const fogFar = qualityProfile.tier === "low" ? 38 : qualityProfile.tier === "medium" ? 46 : 52;
  const visibleRemotePlayers = useMemo(() => remotePlayers
    .filter((player) => Math.hypot(player.x - state.player.x, player.z - state.player.z) <= 28)
    .slice(0, 12), [remotePlayers, state.player.x, state.player.z]);
  const activeAsset = useMemo(
    () => state.inventory.find((candidate) => candidate.id === state.selectedAssetId) ?? null,
    [state.inventory, state.selectedAssetId]
  );
  const activeAppearance = useMemo(() => activeAsset ? projectCardKaiAppearance(activeAsset) : null, [activeAsset]);
  const livingPhysicalObstacles = useMemo(() => projectWildsRenderedLivingObstacles(livingWorld), [livingWorld]);
  const terrainTileX = Math.floor(state.player.x / WILDS_TERRAIN_TILE_SIZE);
  const terrainTileZ = Math.floor(state.player.z / WILDS_TERRAIN_TILE_SIZE);
  const terrainObstacleNeighborhood = useMemo(
    () => projectWildsAerialObstacleNeighborhood(state.player),
    // Player coordinates deliberately do not rebuild this immutable projection inside a tile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terrainTileX, terrainTileZ]
  );
  const actualCameraSubmergedRef = useRef(false);
  return (
    <WildsReadabilityProvider value={readability}>
      <color attach="background" args={[kaiSky]} />
      <fog attach="fog" args={[kaiFog, fogNear, fogFar]} />
      <WildsCelestialSky expression={kaiExpression} qualityProfile={qualityProfile} />
      <WildsAtmosphere encounter={state.encounter} expression={kaiExpression} missionProgress={state.missionProgress} nightRig={nightRig} player={state.player} qualityProfile={qualityProfile} />
      <WildsKaiAtmosphereGeometry expression={kaiExpression} qualityProfile={qualityProfile} />
      <CameraRig actualCameraSubmergedRef={actualCameraSubmergedRef} verticalTraversalRef={verticalTraversalRef} aquaticPresentation={aquaticPresentation} onCameraHeadingChange={onCameraHeadingChange} vistaHeading={vistaHeading} />
      <WildsUnderwaterAtmosphere cameraSubmergedRef={actualCameraSubmergedRef} qualityProfile={qualityProfile} surfaceFog={kaiFog} surfaceFogFar={fogFar} surfaceFogNear={fogNear} surfaceSky={kaiSky} />
      {WILDS_DIAGNOSTICS_ENABLED ? <WildsDiagnostics environment={{
        authoredDarkness: darkness.amount,
        dayPhase: kaiExpression.dayPhase,
        darknessSource: darkness.source,
        kaiCoordinate: kaiMoment.latticeCoordinate,
        lanternEnabled: nightRig.lanternVisible,
        nightAmount: kaiExpression.night.amount,
        reducedMotion: qualityProfile.reducedMotion,
        starCount: wildsStarCountForTier(qualityProfile.tier)
      }} qualityProfile={qualityProfile} state={state} /> : null}
      <SmoothWorldFrame player={state.player} terrainElevation={aquaticPresentation.terrainElevation}>
        <SearchableTerrain
          enabled={searchEnabled}
          missionProgress={state.missionProgress}
          onSearchPoint={onSearchPoint}
          onSelectOverlook={onSelectOverlook}
          player={state.player}
          terrainElevation={aquaticPresentation.terrainElevation}
          qualityProfile={qualityProfile}
          worldMastery={state.worldMastery}
          livingWorld={livingWorld}
          worldMode={worldMode}
        />
        <WildsEcologyEnvironment livingWorld={livingWorld} player={state.player} terrainElevation={aquaticPresentation.terrainElevation} worldMode={worldMode} />
        <WildsBossEnvironment livingWorld={livingWorld} player={state.player} qualityProfile={qualityProfile} terrainElevation={aquaticPresentation.terrainElevation} />
        <EncounterSequence state={state} terrainElevation={aquaticPresentation.terrainElevation} />
        {visibleRemotePlayers.map((player) => <RemoteExplorer key={player.playerId} player={player} localPlayer={state.player} onSelect={onSelectPlayer} terrainElevation={aquaticPresentation.terrainElevation} />)}
        {trainers.map((trainer, index) => (
          index < 10 && Math.hypot(trainer.position[0] - state.player.x, trainer.position[2] - state.player.z) <= 28
            ? <TrainerExplorer key={trainer.id} trainer={trainer} localPlayer={state.player} onSelect={onSelectTrainer} terrainElevation={aquaticPresentation.terrainElevation} />
            : null
        ))}
      </SmoothWorldFrame>
      <AerialPlayerFrame aquaticPresentation={aquaticPresentation} capabilities={aerialCapabilities} horizontalAllowedRef={horizontalAllowedRef} liftPotential={liftPotential} livingPhysicalObstacles={livingPhysicalObstacles} pressurePotential={pressurePotential} swimStamina={state.energy} onEnergyChange={onAerialEnergyChange} onModeChange={onAerialModeChange} onLandingRequired={onLandingRequired} onVerticalReadoutChange={onVerticalReadoutChange} player={state.player} runtime={aerialStateRef} terrainObstacleNeighborhood={terrainObstacleNeighborhood} verticalIntentRef={verticalIntentRef} verticalTraversalRef={verticalTraversalRef}>
        <WildsExplorer
          aerialPalette={{
            primary: activeAppearance?.palette.primary ?? "#c9fff0",
            accent: activeAppearance?.palette.accent ?? "#f5d46c",
            glow: activeAppearance?.palette.glow ?? "#76f3cf"
          }}
          aerialStateRef={aerialStateRef}
          character={character}
          locomotion={aquaticPresentation.mode === "swim" ? "swim" : "ground"}
          scubaVisible={aquaticPresentation.scubaVisible}
          style={character.gender}
          worldPosition={state.player}
        />
        <ActiveCompanion locomotion={aquaticPresentation.mode === "swim" ? "swim" : "ground"} state={state} terrainElevation={aquaticPresentation.terrainElevation} />
      </AerialPlayerFrame>
      <group name="grounded-support-companions" visible={aquaticPresentation.mode !== "swim"}>
        <SupportCompanions cards={supportCards} player={state.player} terrainElevation={aquaticPresentation.terrainElevation} />
      </group>
      <Sparkles key={`wilds-world-sparkles-${worldSparkleCount}`} count={worldSparkleCount} scale={[8, 2.4, 8]} size={2.1} speed={qualityProfile.reducedMotion ? 0 : kaiExpression.particleSpeed} color={kaiExpression.accent} />
    </WildsReadabilityProvider>
  );
}

function AerialPlayerFrame({ aquaticPresentation, capabilities, children, horizontalAllowedRef, liftPotential, livingPhysicalObstacles, pressurePotential, swimStamina, onEnergyChange, onModeChange, onLandingRequired, onVerticalReadoutChange, player, runtime, terrainObstacleNeighborhood, verticalIntentRef, verticalTraversalRef }: {
  aquaticPresentation: WildsAquaticPresentation;
  capabilities: readonly WildsTraversalCapability[];
  children: ReactNode;
  horizontalAllowedRef: MutableRefObject<boolean>;
  liftPotential: number;
  livingPhysicalObstacles: readonly import("@/features/play/wilds-terrain-obstacles").WildsTerrainObstacle[];
  pressurePotential: number;
  swimStamina: number;
  onEnergyChange: (energy: number) => void;
  onModeChange: (mode: WildsAerialMode) => void;
  onLandingRequired: (reason: WildsAerialLandingReason) => void;
  onVerticalReadoutChange: (layer: WildsVerticalTraversalState["layer"], value: number, safeMin: number, safeMax: number) => void;
  player: PlayState["player"];
  runtime: MutableRefObject<WildsAerialTraversalState>;
  terrainObstacleNeighborhood: import("@/features/play/wilds-grounded-movement").WildsAerialObstacleNeighborhood;
  verticalIntentRef: MutableRefObject<WildsVerticalTraversalIntent>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
}) {
  const group = useRef<THREE.Group>(null);
  const previousPlayer = useRef(player);
  const publishedMode = useRef(runtime.current.mode);
  const publishedEnergy = useRef(100);
  const publishedVertical = useRef({ layer: "ground" as WildsVerticalTraversalState["layer"], value: Number.NaN, safeMin: Number.NaN, safeMax: Number.NaN });
  const runtimeResult = useRef(createWildsAerialRuntimeResult());
  const collisionSampleRef = useRef(createWildsAerialCollisionSample());
  const publishedLandingRequired = useRef(false);
  const runtimeStep = useRef<WildsAerialRuntimeStep>({
    deltaSeconds: 0, groundElevation: 0, hasFlight: false, hasGlide: false,
    horizontalDistance: 0, positionX: 0, positionZ: 0, verticalOffset: 0
  });
  const verticalStep = useRef<WildsVerticalTraversalStep>({
    deltaSeconds: 0, initialOffset: 0, intent: 0, layer: "ground", liftPotential: 0,
    obstacleTopY: undefined, powered: false, pressurePotential: 0, stamina: 100,
    terrainElevation: 0, waterSurfaceY: 0
  });
  const hasFlight = capabilities.includes("flight");
  const hasGlide = capabilities.includes("glide");
  const hasSwim = capabilities.includes("swim");
  useFrame((_, delta) => {
    const prior = previousPlayer.current;
    const horizontalDistance = Math.hypot(player.x - prior.x, player.z - prior.z);
    previousPlayer.current = player;
    const groundElevation = aquaticPresentation.terrainElevation;
    const currentVertical = verticalTraversalRef.current;
    const collisionSample = writeWildsAerialCollisionSample(
      player,
      currentVertical.layer === "air" ? currentVertical.worldY : groundElevation + .35,
      livingPhysicalObstacles,
      collisionSampleRef.current,
      1.55,
      .38,
      terrainObstacleNeighborhood.obstacles
    );
    const aerialInput = runtimeStep.current;
    aerialInput.deltaSeconds = delta;
    aerialInput.groundElevation = groundElevation;
    aerialInput.hasFlight = hasFlight;
    aerialInput.hasGlide = hasGlide;
    aerialInput.horizontalDistance = horizontalDistance;
    aerialInput.positionX = player.x;
    aerialInput.positionZ = player.z;
    aerialInput.protectedAirspace = collisionSample.protectedAirspace;
    aerialInput.verticalOffset = currentVertical.offset;
    const advanced = writeWildsAerialRuntimeStep(runtime.current, aerialInput, runtimeResult.current);
    const layer = runtime.current.mode !== "ground"
      ? "air" as const
      : aquaticPresentation.mode === "swim" && hasSwim
        ? "water" as const
        : "ground" as const;
    const verticalInput = verticalStep.current;
    verticalInput.deltaSeconds = delta;
    verticalInput.initialOffset = layer === "air"
        ? Math.max(.35, runtime.current.altitude - groundElevation)
        : aquaticPresentation.actorLocalY;
    verticalInput.intent = verticalIntentRef.current;
    verticalInput.layer = layer;
    verticalInput.liftPotential = liftPotential;
    verticalInput.ceilingY = collisionSample.ceilingY;
    verticalInput.obstacleTopY = collisionSample.obstacleTopY;
    verticalInput.powered = runtime.current.mode === "flight";
    verticalInput.pressurePotential = pressurePotential;
    verticalInput.stamina = layer === "water" ? swimStamina : runtime.current.stamina;
    verticalInput.terrainElevation = groundElevation;
    verticalInput.waterSurfaceY = aquaticPresentation.waterSurfaceY;
    writeWildsVerticalTraversalStep(currentVertical, verticalInput);
    runtime.current.altitude = currentVertical.worldY;
    if (runtime.current.landingRequired && !publishedLandingRequired.current) {
      publishedLandingRequired.current = true;
      onLandingRequired(runtime.current.landingReason ?? "landed");
    } else if (!runtime.current.landingRequired) {
      publishedLandingRequired.current = false;
    }
    horizontalAllowedRef.current = runtime.current.landingRequired ? false : advanced.horizontalAllowed;
    const energyBucket = Math.max(0, Math.min(100, Math.round(runtime.current.stamina / 5) * 5));
    if (publishedEnergy.current !== energyBucket) {
      publishedEnergy.current = energyBucket;
      onEnergyChange(energyBucket);
    }
    if (publishedMode.current !== runtime.current.mode) {
      publishedMode.current = runtime.current.mode;
      onModeChange(runtime.current.mode);
    }
    const readoutValue = layer === "water"
      ? Math.max(0, aquaticPresentation.waterSurfaceY - (groundElevation + currentVertical.offset))
      : currentVertical.offset;
    const readoutBucket = Math.round(readoutValue * 4);
    const minimumBucket = Math.round(currentVertical.safeMin * 4);
    const maximumBucket = Math.round(currentVertical.safeMax * 4);
    const priorReadout = publishedVertical.current;
    if (priorReadout.layer !== layer || priorReadout.value !== readoutBucket || priorReadout.safeMin !== minimumBucket || priorReadout.safeMax !== maximumBucket) {
      priorReadout.layer = layer;
      priorReadout.value = readoutBucket;
      priorReadout.safeMin = minimumBucket;
      priorReadout.safeMax = maximumBucket;
      onVerticalReadoutChange(layer, readoutValue, currentVertical.safeMin, currentVertical.safeMax);
    }
    if (group.current) {
      const actorLocalY = layer === "ground" ? 0 : currentVertical.offset;
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, actorLocalY, 8, delta);
    }
  }, -2);
  return <group ref={group}>{children}</group>;
}

function SmoothWorldFrame({ player, terrainElevation, children }: { player: PlayState["player"]; terrainElevation: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const previous = useRef(player);
  const previousTerrainElevation = useRef(terrainElevation);
  useLayoutEffect(() => {
    const prior = previous.current;
    const priorTerrainElevation = previousTerrainElevation.current;
    previous.current = player;
    previousTerrainElevation.current = terrainElevation;
    if (!group.current) return;
    group.current.position.x += player.x - prior.x;
    group.current.position.y += terrainElevation - priorTerrainElevation;
    group.current.position.z += player.z - prior.z;
  }, [player, terrainElevation]);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, 0, 18, delta);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, 0, 14, delta);
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, 0, 18, delta);
  });
  return <group ref={group}>{children}</group>;
}

function TrainerExplorer({ trainer, localPlayer, onSelect, terrainElevation }: {
  trainer: WildsTrainerProjection;
  localPlayer: PlayState["player"];
  onSelect: (trainer: WildsTrainerProjection) => void;
  terrainElevation: number;
}) {
  const group = useRef<THREE.Group>(null);
  const style = trainer.seed % 2 ? "female" as const : "male" as const;
  useFrame(({ clock }) => {
    if (!group.current) return;
    const phase = clock.elapsedTime * (0.18 + trainer.seed % 5 * 0.015) + trainer.seed % 97;
    const world = {
      x: trainer.position[0] + Math.sin(phase) * 0.7,
      z: trainer.position[2] + Math.cos(phase * 0.83) * 0.7
    };
    group.current.position.set(...projectWildsTerrainActorPosition(world, localPlayer, 0, { anchorElevation: terrainElevation }));
    group.current.rotation.y = -phase;
  });
  const rosterName = creatureForm(trainer.rosterFormIds[0])?.name ?? trainer.affinity;
  const distance = Math.hypot(trainer.position[0] - localPlayer.x, trainer.position[2] - localPlayer.z);
  return <group
    name={`trainer-${trainer.id}`}
    onClick={(event) => { event.stopPropagation(); onSelect(trainer); }}
    position={projectWildsTerrainActorPosition({ x: trainer.position[0], z: trainer.position[2] }, localPlayer, 0, { anchorElevation: terrainElevation })}
    ref={group}
  >
    <WildsExplorer remote style={style} worldPosition={{ x: trainer.position[0], z: trainer.position[2] }} />
    <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.5, .045, 8, 32]} />
      <meshStandardMaterial color="#f7d25b" emissive="#c68f25" emissiveIntensity={.78} />
    </mesh>
    {distance <= 12 ? <Html center className="wilds-trainer-challenge-anchor" distanceFactor={8} occlude={false} position={[0, 1.48, 0]} zIndexRange={[14, 1]}>
      <button aria-label={`Battle trainer ${trainer.name}`} className="wilds-trainer-challenge-prompt" onClick={(event) => { event.stopPropagation(); onSelect(trainer); }} type="button">
        <span>{trainer.name}</span><small>Lv. {trainer.challengeLevel} · {rosterName} · Tap to challenge</small>
      </button>
    </Html> : <Html center className="wilds-remote-nameplate wilds-trainer-nameplate" distanceFactor={8} occlude={false} position={[0, 1.48, 0]} zIndexRange={[14, 1]}>
      <span>{trainer.name}</span><small>Wild trainer · Lv. {trainer.challengeLevel}</small>
    </Html>}
  </group>;
}

function isBattleTelemetryPhase(phase: PlayState["encounter"]["phase"]) {
  return phase === "player_turn" || phase === "capture_ready" || phase === "fled" || phase === "defeated";
}

function ActiveCompanion({ locomotion, state, terrainElevation }: { locomotion: "ground" | "swim"; state: PlayState; terrainElevation: number }) {
  const card = selectedCard(state);
  const asset = state.inventory.find((candidate) => candidate.id === state.selectedAssetId);
  const formId = asset?.manifest.formId ?? `${card.id}-1`;
  const appearance = useMemo(() => asset ? projectCardKaiAppearance(asset) : null, [asset]);
  const position = useMemo(() => projectWildsTerrainActorPosition(
    { x: state.player.x - 1.08, z: state.player.z + .42 },
    state.player,
    .44,
    { anchorElevation: terrainElevation }
  ), [state.player, terrainElevation]);
  return (
    <group name="active-companion" position={position} scale={0.82}>
      <WildsCreatureActor accent={appearance?.palette.accent ?? card.accent} anatomy={appearance?.anatomy} cadenceMs={appearance?.cadenceMs} familyId={asset?.manifest.familyId ?? card.id} formId={formId} glow={appearance?.palette.glow ?? card.accent} identityToken={appearance?.fingerprint} locomotion={locomotion} morphology={appearance?.morphology} pose="curious" primary={appearance?.palette.primary ?? card.color} secondary={appearance?.palette.secondary ?? card.color} />
      <mesh position={[0, -0.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.035, 8, 36]} />
        <meshStandardMaterial color="#f4fff6" emissive="#7cdea5" emissiveIntensity={0.55} transparent opacity={0.92} />
      </mesh>
      {state.battle && isBattleTelemetryPhase(state.encounter.phase) ? (
        <BattleWorldTelemetry fighter={state.battle.player} position={[0, 1.9, 0]} side="player" />
      ) : (
        <Html center className="wilds-world-label" distanceFactor={8} occlude={false} position={[0, 0.96, 0]} zIndexRange={[10, 0]}>
          <span>{asset?.manifest.name ?? card.name}</span>
        </Html>
      )}
    </group>
  );
}

function SupportCompanions({ cards, player, terrainElevation }: { cards: readonly PortableCardAsset[]; player: PlayState["player"]; terrainElevation: number }) {
  const positions = useMemo(() => [
    projectWildsTerrainActorPosition({ x: player.x + 1.05, z: player.z + .72 }, player, .34, { anchorElevation: terrainElevation }),
    projectWildsTerrainActorPosition({ x: player.x + 1.62, z: player.z + 1.34 }, player, .28, { anchorElevation: terrainElevation })
  ] as const, [player, terrainElevation]);
  const appearances = useMemo(() => cards.slice(0, 2).map((card) => ({ card, appearance: projectCardKaiAppearance(card) })), [cards]);
  return <group name="trail-pack-support-companions">
    {appearances.map(({ card, appearance }, index) => <group key={card.id} name={`trail-support-${index + 1}`} position={positions[index]} scale={index === 0 ? 0.62 : 0.54}>
      <WildsCreatureActor
        accent={appearance.palette.accent}
        anatomy={appearance.anatomy}
        cadenceMs={appearance.cadenceMs}
        familyId={card.manifest.familyId}
        formId={card.manifest.formId}
        glow={appearance.palette.glow}
        identityToken={appearance.fingerprint}
        morphology={appearance.morphology}
        pose={index === 0 ? "curious" : "idle"}
        primary={appearance.palette.primary}
        secondary={appearance.palette.secondary}
      />
      <mesh position={[0, -0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.025, 8, 28]} />
        <meshStandardMaterial color="#dffcf0" emissive="#58c99d" emissiveIntensity={0.36} transparent opacity={0.72} />
      </mesh>
    </group>)}
  </group>;
}

function BattleWorldTelemetry({
  fighter,
  position,
  side,
  captureReady = false
}: {
  fighter: BattleFighter;
  position: [number, number, number];
  side: "player" | "wild";
  captureReady?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(fighter.hpRatio * 100)));
  return (
    <Html center distanceFactor={8} occlude={false} position={position} zIndexRange={[64, 56]}>
      <div
        aria-label={`${fighter.name} health ${fighter.hp} of ${fighter.maxHp}`}
        aria-valuemax={fighter.maxHp}
        aria-valuemin={0}
        aria-valuenow={fighter.hp}
        className={`wilds-battle-world-stat is-${side}${captureReady ? " capture-ready" : ""}`}
        role="meter"
      >
        <span><strong>{side === "wild" ? `Wild ${fighter.name}` : fighter.name}</strong><small>{fighter.hp}<b>HP</b></small></span>
        <i className="wilds-battle-world-stat-meter" aria-hidden="true"><b style={{ width: `${percent}%` }} /></i>
      </div>
    </Html>
  );
}

function RemoteExplorer({
  player,
  localPlayer,
  onSelect,
  terrainElevation
}: {
  player: WildsPresence;
  localPlayer: PlayState["player"];
  onSelect: (player: WildsPresence) => void;
  terrainElevation: number;
}) {
  const group = useRef<THREE.Group>(null);
  const actorPosition = useMemo(() => projectWildsTerrainActorPosition(
    { x: player.x, z: player.z },
    { x: localPlayer.x, z: localPlayer.z },
    0,
    { anchorElevation: terrainElevation }
  ), [localPlayer.x, localPlayer.z, player.x, player.z, terrainElevation]);
  const target = useRef(new THREE.Vector3(...actorPosition));
  useEffect(() => {
    target.current.set(...actorPosition);
  }, [actorPosition]);
  useFrame(() => {
    group.current?.position.lerp(target.current, 0.18);
  });
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(player);
      }}
      position={actorPosition}
      ref={group}
    >
      <WildsExplorer remote style={player.style} worldPosition={{ x: player.x, z: player.z }} />
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.48, 0.04, 8, 32]} />
        <meshStandardMaterial color={player.practice ? "#f7c948" : "#6ef0c9"} emissive={player.practice ? "#f7c948" : "#37d688"} emissiveIntensity={0.62} />
      </mesh>
      <Html center className="wilds-remote-nameplate" distanceFactor={8} occlude={false} position={[0, 1.42, 0]} zIndexRange={[12, 0]}>
        <span>{player.handle}</span><small>{player.activeCard.name}</small>
      </Html>
    </group>
  );
}

function CameraRig({ actualCameraSubmergedRef, verticalTraversalRef, aquaticPresentation, onCameraHeadingChange, vistaHeading }: {
  actualCameraSubmergedRef: MutableRefObject<boolean>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
  aquaticPresentation: WildsAquaticPresentation;
  onCameraHeadingChange: (heading: number) => void;
  vistaHeading: number | null;
}) {
  const { camera } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const priorVista = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const cameraProjection = useRef<MutableUnderwaterCameraProjection>({ underwaterTargetActive: false, localWaterSurfaceY: 0, targetY: .9, cameraY: 0 });
  const lastHeading = useRef(Number.NaN);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    if (vistaHeading !== null && !priorVista.current) {
      priorVista.current = { position: camera.position.clone(), target: orbit.target.clone() };
      const distance = 9.2;
      camera.position.set(Math.sin(vistaHeading) * distance, 5.8, Math.cos(vistaHeading) * distance);
      orbit.target.set(0, 1.65, 0);
      orbit.update();
      return;
    }
    if (vistaHeading === null && priorVista.current) {
      camera.position.copy(priorVista.current.position);
      orbit.target.copy(priorVista.current.target);
      priorVista.current = null;
      orbit.update();
    }
  }, [camera, vistaHeading]);
  useFrame((_, delta) => {
    const orbit = controls.current;
    if (orbit && vistaHeading === null) {
      const clearance = verticalTraversalRef.current.layer === "ground" ? 0 : verticalTraversalRef.current.offset;
      const surfaceTargetY = .9 + clearance;
      const projection = cameraProjection.current;
      writeUnderwaterCameraTarget(aquaticPresentation, surfaceTargetY, camera.position.y - orbit.target.y, projection, clearance);
      const priorTargetY = orbit.target.y;
      orbit.target.y = THREE.MathUtils.damp(orbit.target.y, projection.targetY, 8, delta);
      camera.position.y += orbit.target.y - priorTargetY;
      actualCameraSubmergedRef.current = isUnderwaterCameraSubmerged(
        camera.position.y,
        projection.localWaterSurfaceY,
        actualCameraSubmergedRef.current,
        aquaticPresentation.cameraSubmersionAllowed,
        false
      );
    } else if (vistaHeading !== null) {
      actualCameraSubmergedRef.current = false;
    }
    const heading = Math.atan2(camera.position.x, camera.position.z);
    if (Number.isFinite(lastHeading.current) && Math.abs(heading - lastHeading.current) < .001) return;
    lastHeading.current = heading;
    onCameraHeadingChange(heading);
  });
  return (
    <OrbitControls
      dampingFactor={.08}
      enableDamping
      enablePan={false}
      maxDistance={12.5}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={4.4}
      minPolarAngle={.38}
      rotateSpeed={.62}
      ref={controls}
      target={[0, .9, 0]}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      zoomSpeed={.82}
    />
  );
}

function frameSeconds() {
  return performance.now() / 1_000;
}

function SearchableTerrain({
  player,
  enabled,
  missionProgress,
  qualityProfile,
  terrainElevation,
  worldMastery,
  onSearchPoint,
  onSelectOverlook,
  livingWorld,
  worldMode
}: {
  player: PlayState["player"];
  enabled: boolean;
  missionProgress: number;
  qualityProfile: WildsQualityProfile;
  terrainElevation: number;
  worldMastery: number;
  onSearchPoint: (point: { x: number; z: number }) => void;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
}) {
  return (
    <group
      onClick={(event) => {
        if (!enabled) return;
        event.stopPropagation();
        onSearchPoint({ x: player.x + event.point.x, z: player.z + event.point.z });
      }}
    >
      <StreamedTerrain missionProgress={missionProgress} player={player} qualityProfile={qualityProfile} terrainElevation={terrainElevation} worldMastery={worldMastery} livingWorld={livingWorld} worldMode={worldMode} onSelectOverlook={onSelectOverlook} />
    </group>
  );
}

function StreamedTerrain({
  missionProgress,
  player,
  qualityProfile,
  terrainElevation,
  worldMastery,
  livingWorld,
  worldMode,
  onSelectOverlook
}: {
  missionProgress: number;
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  terrainElevation: number;
  worldMastery: number;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
}) {
  return <WildsEnvironment missionProgress={missionProgress} player={player} qualityProfile={qualityProfile} terrainElevation={terrainElevation} worldMastery={worldMastery} livingWorld={livingWorld} worldMode={worldMode} onSelectOverlook={onSelectOverlook} />;
}

function Creature({
  card,
  formId = `${card.id}-1`,
  pose = "idle",
  identity
}: {
  card: CreatureCard;
  formId?: string;
  pose?: WildsCreaturePose;
  identity?: Exclude<PlayState["encounter"], { phase: "idle" }>["discoveryIdentity"];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const appearance = useMemo(
    () => identity ? projectEncounterCreatureVisualIdentity({ identity, formId }) : null,
    [formId, identity]
  );

  useFrame(() => {
    if (!groupRef.current) return;
    const elapsed = frameSeconds();
    groupRef.current.position.y = 0.5 + Math.sin(elapsed * 1.8 + card.position[0]) * 0.06;
    groupRef.current.rotation.y = Math.sin(elapsed * 0.85 + card.position[2]) * 0.18;
  });

  return (
      <group ref={groupRef} position={[card.position[0], 0.42, card.position[2]]}>
        <WildsCreatureActor
          accent={appearance?.palette.accent ?? card.accent}
          anatomy={appearance ? { ...appearance.anatomy, appendages: appearance.appendages } : undefined}
          cadenceMs={appearance?.cadenceMs}
          familyId={identity?.family.id ?? card.id}
          formId={appearance?.formId ?? formId}
          glow={appearance?.palette.glow ?? card.accent}
          identityToken={appearance?.fingerprint}
          morphology={appearance?.morphology}
          pose={pose}
          primary={appearance?.palette.primary ?? card.color}
          secondary={appearance?.palette.secondary ?? card.color}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
          <torusGeometry args={[0.46, 0.035, 8, 36]} />
          <meshStandardMaterial
            color="#fff2a8"
            emissive="#f7c948"
            emissiveIntensity={0.44}
            transparent
            opacity={0.95}
          />
        </mesh>
        <Html center distanceFactor={8} occlude={false} position={[0, 0.82, 0]} className="wilds-world-label" zIndexRange={[10, 0]}>
          <span>{identity?.name.display ?? card.name}</span>
        </Html>
      </group>
  );
}

function EncounterSequence({ state, terrainElevation }: { state: PlayState; terrainElevation: number }) {
  const encounter = state.encounter;
  if (encounter.phase === "idle") return null;
  const position = projectWildsTerrainActorPosition(encounter.searchPoint, state.player, .04, { anchorElevation: terrainElevation });
  if (encounter.phase === "searching") {
    return <SearchPulse hint={false} position={position} />;
  }
  if (encounter.phase === "hint") {
    return (
      <>
        <SearchPulse hint position={position} />
        <RustlingClue encounter={encounter} player={state.player} terrainElevation={terrainElevation} />
      </>
    );
  }
  const card = creatureCards.find((candidate) => candidate.id === encounter.familyId);
  if (!card || !encounter.cover) return null;
  const localCard: CreatureCard = { ...card, position: [0, 0, 0] };
  const lastBattleAction = state.battle?.transcript.at(-1)?.action;
  const pose: WildsCreaturePose = encounter.phase === "capture_ready" ? "capture"
    : state.battle?.wild.hpRatio !== undefined && state.battle.wild.hpRatio <= 0.3 ? "weakened"
      : lastBattleAction === "ability" ? "impact"
        : lastBattleAction && lastBattleAction !== "capture" ? "attack"
        : encounter.phase === "battle_intro" ? "curious"
          : "idle";
  return (
    <group position={position}>
      <SearchPulse hint position={[0, 0, 0]} />
      <HabitatCover cover={encounter.cover} open={encounter.phase !== "emerging"} />
      <group scale={encounter.phase === "capsule" ? 0.68 : encounter.phase === "sealed" || encounter.phase === "revealed" ? 0.01 : 1}>
        <Creature card={localCard} formId={encounter.formId} identity={encounter.discoveryIdentity} pose={pose} />
      </group>
      {state.battle && isBattleTelemetryPhase(state.encounter.phase) ? (
        <BattleWorldTelemetry
          captureReady={encounter.phase === "capture_ready"}
          fighter={state.battle.wild}
          position={[0, 2.15, 0]}
          side="wild"
        />
      ) : null}
      {encounter.phase === "capsule" || encounter.phase === "sealed" || encounter.phase === "revealed" ? (
        <CaptureCapsule sealed={encounter.phase !== "capsule"} />
      ) : null}
    </group>
  );
}

function RustlingClue({
  encounter,
  player,
  terrainElevation
}: {
  encounter: Exclude<PlayState["encounter"], { phase: "idle" }>;
  player: PlayState["player"];
  terrainElevation: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const hot = encounter.proximity === "hot";
  const clueSparkleCount = hot ? 18 : 9;
  const distance = encounter.distance ?? 0;
  const direction = encounter.direction ?? { x: 0, z: 0 };
  const clueWorld = {
    x: encounter.searchPoint.x + direction.x * distance,
    z: encounter.searchPoint.z + direction.z * distance
  };
  const position = projectWildsTerrainActorPosition(clueWorld, player, .03, { anchorElevation: terrainElevation });

  useFrame(() => {
    if (!ref.current) return;
    const elapsed = frameSeconds();
    const energy = hot ? 1 : 0.55;
    ref.current.rotation.y = Math.sin(elapsed * (hot ? 15 : 9)) * 0.12 * energy;
    ref.current.position.y = 0.03 + Math.abs(Math.sin(elapsed * 7)) * 0.045 * energy;
    const pulse = 1 + Math.sin(elapsed * 6) * 0.035 * energy;
    ref.current.scale.setScalar(pulse);
  });

  if (!encounter.cover) return null;
  return (
    <group ref={ref} position={position}>
      <HabitatCover cover={encounter.cover} open={false} />
      <Sparkles
        key={`wilds-clue-sparkles-${clueSparkleCount}`}
        count={clueSparkleCount}
        scale={hot ? [1.45, 1.05, 1.45] : [1.05, 0.7, 1.05]}
        size={hot ? 4 : 2.4}
        speed={hot ? 1.1 : 0.55}
        color={hot ? "#fff0a6" : "#d8fff2"}
      />
    </group>
  );
}

function SearchPulse({ hint, position }: { hint: boolean; position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = frameSeconds();
    const wave = 0.8 + (elapsed % 1) * 0.65;
    ref.current.scale.setScalar(wave);
    ref.current.rotation.y = elapsed * 0.7;
  });
  return (
    <group ref={ref} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.56, hint ? 0.045 : 0.028, 8, 48]} />
        <meshStandardMaterial color={hint ? "#fff2a8" : "#d8fff2"} emissive={hint ? "#f7c948" : "#37d688"} emissiveIntensity={0.75} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function HabitatCover({ cover, open }: { cover: HotspotCover; open: boolean }) {
  const readability = useWildsReadability();
  const colors: Record<string, string> = {
    grass: "#2f8d51", flowers: "#ff8dad", tree: "#236b43", rock: "#7f827d",
    cave: "#3b3446", water: "#45aee7", ruin: "#b49b75", energy: "#f7c948"
  };
  return (
    <group rotation={[0, open ? 0.62 : 0, open ? -0.24 : 0]}>
      {[-1, -0.5, 0, 0.5, 1].map((offset, index) => (
        <mesh key={offset} castShadow position={[offset * 0.25, 0.2 + Math.abs(offset) * 0.08, index % 2 ? -0.1 : 0.08]} rotation={[0.12, offset * 0.4, offset * -0.32]}>
          {cover === "rock" || cover === "cave" || cover === "ruin"
            ? <dodecahedronGeometry args={[0.24, 0]} />
            : cover === "water" || cover === "energy"
              ? <icosahedronGeometry args={[.19, 1]} />
              : <capsuleGeometry args={[.055, .42, 3, 6]} />}
          <meshStandardMaterial color={colors[String(cover)] ?? colors.grass} roughness={0.78} metalness={cover === "energy" ? 0.24 : 0} emissive={cover === "energy" ? "#f7c948" : colors[String(cover)] ?? colors.grass} emissiveIntensity={cover === "energy" ? 0.28 : readability.threatEmissive * 0.55} />
        </mesh>
      ))}
    </group>
  );
}

function CaptureCapsule({ sealed }: { sealed: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = frameSeconds();
    ref.current.rotation.y = elapsed * (sealed ? 0.7 : 2.4);
    ref.current.position.y = 0.7 + Math.sin(elapsed * 3) * (sealed ? 0.04 : 0.1);
  });
  return (
    <group ref={ref} scale={sealed ? 0.9 : 1.08}>
      <mesh castShadow>
        <sphereGeometry args={[0.62, 28, 20]} />
        <meshPhysicalMaterial color="#f7fff9" roughness={0.18} metalness={0.18} transmission={sealed ? 0.05 : 0.42} transparent opacity={sealed ? 0.94 : 0.7} clearcoat={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.61, 0.075, 12, 48]} />
        <meshStandardMaterial color="#171311" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, 0.62]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
        <meshStandardMaterial color={sealed ? "#37d688" : "#f7c948"} emissive={sealed ? "#37d688" : "#f7c948"} emissiveIntensity={0.72} />
      </mesh>
    </group>
  );
}

function CreatureDetails({ cardId, color, accent }: { cardId: string; color: string; accent: string }) {
  if (cardId === "mintcub") {
    return (
      <group>
        <mesh castShadow position={[-0.28, 0.36, -0.02]} rotation={[0, 0, -0.48]} scale={[0.55, 1, 0.38]}>
          <coneGeometry args={[0.18, 0.48, 5]} />
          <meshStandardMaterial color={accent} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0.28, 0.36, -0.02]} rotation={[0, 0, 0.48]} scale={[0.55, 1, 0.38]}>
          <coneGeometry args={[0.18, 0.48, 5]} />
          <meshStandardMaterial color={accent} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 0.43, -0.02]} rotation={[0.12, 0, 0.08]} scale={[0.45, 1, 0.22]}>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color="#d9ff9f" roughness={0.6} emissive={color} emissiveIntensity={0.12} />
        </mesh>
      </group>
    );
  }

  if (cardId === "voltray") {
    return (
      <group>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.42, 0.08, -0.05]} rotation={[0.2, 0, side * -0.42]}>
            <mesh castShadow scale={[0.35, 0.85, 0.14]}>
              <tetrahedronGeometry args={[0.42, 0]} />
              <meshStandardMaterial color={accent} roughness={0.38} metalness={0.2} emissive={accent} emissiveIntensity={0.18} />
            </mesh>
            <mesh castShadow position={[side * 0.12, -0.18, 0]} scale={[0.25, 0.56, 0.12]}>
              <tetrahedronGeometry args={[0.34, 0]} />
              <meshStandardMaterial color="#fff1a8" roughness={0.4} />
            </mesh>
          </group>
        ))}
        <mesh castShadow position={[0, 0.5, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.09, 0.38, 5]} />
          <meshStandardMaterial color="#fff1a8" emissive={accent} emissiveIntensity={0.22} />
        </mesh>
      </group>
    );
  }

  if (cardId === "ledgerfox") {
    return (
      <group>
        {[-1, 1].map((side) => (
          <mesh key={side} castShadow position={[side * 0.24, 0.38, -0.03]} rotation={[0, 0, side * -0.18]} scale={[0.7, 1.35, 0.48]}>
            <coneGeometry args={[0.16, 0.42, 4]} />
            <meshStandardMaterial color={accent} roughness={0.58} />
          </mesh>
        ))}
        <group position={[0.35, -0.08, -0.24]} rotation={[0.2, 0.2, -0.68]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.09, 0.52, 6, 10]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, 0.32, 0]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshStandardMaterial color="#ecfff8" roughness={0.55} />
          </mesh>
        </group>
      </group>
    );
  }

  if (cardId === "titanseal") {
    return (
      <group>
        <mesh castShadow position={[-0.25, -0.02, 0.28]} rotation={[0.35, 0, 0.18]}>
          <coneGeometry args={[0.075, 0.38, 8]} />
          <meshStandardMaterial color="#fff2d4" roughness={0.42} />
        </mesh>
        <mesh castShadow position={[0.25, -0.02, 0.28]} rotation={[0.35, 0, -0.18]}>
          <coneGeometry args={[0.075, 0.38, 8]} />
          <meshStandardMaterial color="#fff2d4" roughness={0.42} />
        </mesh>
        {[-0.22, 0, 0.22].map((x, index) => (
          <mesh key={x} castShadow position={[x, 0.43 + Math.abs(x) * 0.25, -0.02]} rotation={[0, 0, x * 0.65]}>
            <coneGeometry args={[0.09, index === 1 ? 0.42 : 0.32, 5]} />
            <meshStandardMaterial color={accent} roughness={0.48} metalness={0.18} emissive={accent} emissiveIntensity={0.12} />
          </mesh>
        ))}
      </group>
    );
  }
  const form = creatureForm(`${cardId}-1`);
  if (!form) return null;
  const detail = form.anatomy.detail;
  return (
    <group>
      {(detail === "ears" || detail === "horns" || detail === "wings") ? [-1, 1].map((side) => (
        <mesh key={side} castShadow position={[side * 0.29, detail === "wings" ? 0.08 : 0.34, detail === "wings" ? -0.14 : -0.02]} rotation={[0, 0, side * (detail === "wings" ? -0.7 : -0.24)]} scale={detail === "wings" ? [0.45, 1.3, 0.18] : [0.65, 1.1, 0.5]}>
          <coneGeometry args={[detail === "wings" ? 0.24 : 0.14, detail === "wings" ? 0.7 : 0.4, detail === "horns" ? 7 : 4]} />
          <meshStandardMaterial color={accent} emissive={detail === "wings" ? accent : "#000000"} emissiveIntensity={0.12} roughness={0.55} />
        </mesh>
      )) : null}
      {detail === "crest" ? <mesh castShadow position={[0, 0.46, -0.03]}><octahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color={accent} emissive={color} emissiveIntensity={0.14} /></mesh> : null}
      {detail === "shell" ? <mesh castShadow position={[0, 0, -0.24]} scale={[1.1, 0.85, 0.4]}><sphereGeometry args={[0.38, 14, 10]} /><meshStandardMaterial color={accent} roughness={0.75} /></mesh> : null}
      {detail === "tail" ? <mesh castShadow position={[0.37, -0.08, -0.25]} rotation={[0.1, 0.1, -0.7]}><capsuleGeometry args={[0.075, 0.48, 5, 8]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh> : null}
    </group>
  );
}

function WildsDiagnostics({
  environment,
  qualityProfile,
  state
}: {
  environment: { authoredDarkness: number; dayPhase: string; darknessSource: string; kaiCoordinate: string; lanternEnabled: boolean; nightAmount: number; reducedMotion: boolean; starCount: number };
  qualityProfile: WildsQualityProfile;
  state: PlayState;
}) {
  const { camera, gl, scene, size } = useThree();
  const outputRef = useRef<HTMLOutputElement>(null);
  const stateRef = useRef(state);
  const environmentRef = useRef(environment);
  stateRef.current = state;
  environmentRef.current = environment;

  useEffect(() => {
    const sample = () => {
    const currentState = stateRef.current;
    const extra = {
      camera: { position: camera.position.toArray(), fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : null },
      scene: { children: scene.children.length },
      environment: environmentRef.current,
      boss: scene.getObjectByName("wilds-boss-environment")?.userData ?? { detailedBosses: 0, maxDetailedBosses: 1 }
    };
    publishWildsDiagnostics(gl, size, currentState, qualityProfile, extra);
    if (outputRef.current) {
      outputRef.current.dataset.snapshot = JSON.stringify({
        canvas: { width: size.width, height: size.height, dpr: gl.getPixelRatio() },
        render: gl.info.render,
        memory: gl.info.memory,
        state: { player: currentState.player, missionProgress: currentState.missionProgress, energy: currentState.energy, combo: currentState.combo },
        ...extra
      });
    }
    };
    sample();
    const interval = window.setInterval(sample, 500);
    return () => window.clearInterval(interval);
  }, [camera, gl, qualityProfile, scene, size]);

  return (
    <Html className="wilds-diagnostics-anchor">
      <output
        data-snapshot="pending"
        data-three-game-diagnostics
        ref={outputRef}
      />
    </Html>
  );
}

function publishWildsDiagnostics(
  gl: THREE.WebGLRenderer,
  size: { width: number; height: number },
  state: PlayState,
  qualityProfile: WildsQualityProfile,
  extra: Record<string, unknown> = {}
) {
  const budget = rendererBudgetStatus(qualityProfile, {
    calls: gl.info.render.calls,
    triangles: gl.info.render.triangles
  });
  const diagnostics = {
    renderer: gl.info,
    canvas: {
      cssWidth: size.width,
      cssHeight: size.height,
      drawingBufferWidth: gl.domElement.width,
      drawingBufferHeight: gl.domElement.height,
      dpr: gl.getPixelRatio()
    },
    state: {
      player: state.player,
      selectedCardId: state.selectedCardId,
      discovered: state.discoveredCardIds.length,
      missionProgress: state.missionProgress,
      energy: state.energy,
      combo: state.combo
    },
    quality: { tier: qualityProfile.tier, dpr: qualityProfile.dpr },
    budget,
    warningFreeCompatibility: { three: "0.182.0", shadowType: "PCFShadowMap" },
    ...extra
  };
  (window as typeof window & { __THREE_GAME_DIAGNOSTICS__?: unknown }).__THREE_GAME_DIAGNOSTICS__ = diagnostics;
  gl.domElement.dataset.threeGameDiagnostics = JSON.stringify({
    canvas: diagnostics.canvas,
    state: diagnostics.state,
    render: {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines
    },
    memory: gl.info.memory,
    quality: diagnostics.quality,
    budget: diagnostics.budget,
    warningFreeCompatibility: diagnostics.warningFreeCompatibility,
    ...extra
  });
}
