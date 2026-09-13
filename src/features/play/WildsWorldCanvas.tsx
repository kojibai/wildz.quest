"use client";
import { projectWildsTraversalCapabilities } from "./wilds-traversal-capabilities";
import { emptyAdventureCondition } from "./adventure/card-condition";
import { writeWildsCrewFollowSpeed, writeWildsCrewFollowRegroup, writeWildsCrewFollowPresentation } from "./wilds-crew-follow-motion";
import { createWildsCrewTravelAuthority } from "./wilds-crew-travel-authority";
import { createWildsCrewPhysicalScheduler, writeWildsCrewVisualPosition, WILDS_CREW_PHYSICAL_TICK_MS } from "./wilds-crew-physical-scheduler";
import { wildsCrewUsesFrameWriter, writeWildsCrewRetainedTravelPosition, wildsCrewResidentExcludedIds, type WildsCrewTravelRuntime } from "./wilds-crew-travel-runtime";

import { writeWildsInteriorCameraPosition } from "./wilds-site-runtime";

import { WildsHomeResidents, type WildsHomeResidentsInput } from "./WildsHomeResidents";
import { projectWildsHomeResidents } from "./wilds-home-residents";
import type { WildsBurrowPreview } from "./wilds-burrow";
import { WildsBurrowGhost } from "./WildsBurrowGhost";
import { WildsContinuousConstruction } from "./WildsContinuousConstruction";
import type { WildsBlueprintPlacement } from "./wilds-world-construction";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  creatureCards,
  playableInventory,
  selectedCard,
  type CreatureCard,
  type PlayState
} from "@/features/play/game-state";
import { creatureForm } from "@/features/play/creature-catalog";
import type { BattleFighter } from "@/features/play/battle-engine";
import type { HotspotCover } from "@/features/play/hidden-hotspots";
import type { WildsPresence } from "@/features/play/multiplayer-core";
import { createWildsKaiWeatherSample, writeWildsKaiWeather } from "./wilds-kai-wind";
import { writeWildsWeatherExposure } from "./wilds-weather-exposure";
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
import { WildsRegenerativeGroveEnvironment } from "@/features/play/WildsRegenerativeGroveEnvironment";
import { WildsStewardEnvironment } from "@/features/play/WildsStewardEnvironment";
import { projectWildsCreatureWorkFamilies } from "@/features/play/wilds-steward-construction";
import type { WildsResourceSource } from "@/features/play/wilds-resource-authority";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { KAI_PULSE_DURATION_MS, type KaiKlokMoment } from "@/features/play/kai-klok-moment";
import { projectKaiWorldExpression } from "@/features/play/kai-moment-expression";
import { WildsKaiAtmosphereGeometry } from "@/features/play/WildsKaiAtmosphereGeometry";
import { WildsCelestialSky } from "@/features/play/WildsCelestialSky";
import { WildsAmbientLife } from "@/features/play/WildsAmbientLife";
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
import { projectWildsTerrainActorPosition, writeWildsTerrainActorPosition } from "@/features/play/wilds-terrain-rendering";
import { wildsEncounterActorLocomotion, writeWildsEncounterActorOuterFrame, type WildsEncounterLayer } from "@/features/play/wilds-layered-encounters";
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
  mergeWildsAerialCollisionSample,
  projectWildsAerialObstacleNeighborhood,
  createWildsAerialCollisionSampler,
  type WildsAerialObstacleNeighborhood
} from "@/features/play/wilds-grounded-movement";
import type { WildsTerrainObstacle } from "@/features/play/wilds-terrain-obstacles";
import { WILDS_PLAYER_BODY_HEIGHT, WILDS_PLAYER_BODY_RADIUS } from "@/features/play/wilds-player-body";
import { WILDS_TERRAIN_TILE_SIZE, wildsTerrainElevation } from "@/features/play/wilds-terrain-authority";
import type { WildsSiteSpaceState } from "@/features/play/wilds-discovery-sites";
import { wildsSiteRuntimeCameraIsFlooded, wildsSiteRuntimeDiagnostics, wildsSiteRuntimeGroundY, writeWildsSiteRuntimeAerialCollision, writeWildsSiteRuntimeCamera, writeWildsSiteRuntimeEncounter, type WildsSiteRuntimeProjection } from "@/features/play/wilds-site-runtime";
import { createWildsFlightCameraControlState, writeWildsFlightCameraControlState } from "@/features/play/wilds-flight-camera";
import { projectWildsInteractionSurfacePoint, type WildsInteractionSurfacePoint } from "@/features/play/wilds-surface-interaction";
import { type WildsActiveWorkSource } from "@/features/play/wilds-work-presentation";
import type { WildsStewardPlacement } from "@/features/play/wilds-steward-craft";
import type { WildsWorldCapabilityFamily } from "@/features/play/wilds-world-capability-registry";
import { projectWildsCapabilityPresentation } from "@/features/play/wilds-capability-presentation";
import { projectWildsDiscoveryHint } from "@/features/play/wilds-discovery-hint";
import { creatureContinuityProjection } from "@/features/play/creature-continuity";
import { readWildsCrewCondition } from "./wilds-crew-policy";
import { canWildsCrewTravel, createWildsCrewPhysicalSampler } from "./wilds-crew-physical-navigation";
import { createWildsCrewPathStepState, planWildsCrewPathNearTarget, wildsCrewRouteNeedsReplan, writeWildsCrewAlongsideTarget, writeWildsCrewTransportPosition, writeWildsCrewFollowingStep, type WildsCrewNavigationPoint, type WildsCrewNavigationAuthority } from "./wilds-crew-navigation";
import { WILDS_RENDERED_PHYSICAL_OBSTACLES } from "./wilds-terrain-obstacles";

export type WildsCrewModes = Readonly<Record<string, "follow" | "roam">>;

const WILDS_DIAGNOSTICS_ENABLED = process.env.NODE_ENV !== "production";
const EMPTY_AERIAL_OBSTACLE_NEIGHBORHOOD = Object.freeze({ tileX: 0, tileZ: 0, obstacles: Object.freeze([]) }) as WildsAerialObstacleNeighborhood;

export function WildsWorldCanvas({
  homeResidents,
  activeWorkSource,
  activeCapabilityFamily = null,
  stewardPlacementPreview,
  burrowPreview,
  constructionPreview,
  constructionSelectionEnabled,
  onSelectConstruction,
  onDragConstruction,
  activeConstructionId,
  explorerIdentityKey,
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
  onInteractResource,
  livingWorld,
  livingPhysicalObstacles,
  siteRuntime,
  siteSpace,
  onSitePortal,
  worldMode,
  kaiMoment,
  visualSettings = DEFAULT_WILDS_VISUAL_SETTINGS,
  supportCards = [],
  crewModes,
  crewTravelRuntime,
  crewTravelMembershipRevision = 0,
  trainers = [],
  aerialCapabilities,
  aerialStateRef,
  verticalTraversalRef,
  verticalIntentRef,
  horizontalAllowedRef,
  flightEndurancePotential,
  liftPotential,
  pressurePotential,
  aquaticPresentation,
  onAerialEnergyChange,
  onAerialModeChange,
  onLandingRequired,
  onVerticalReadoutChange,
  vistaHeading = null,
  suspended = false,
  resourcePending = false,
  resourceCompanionReady = true
}: {
  homeResidents?: WildsHomeResidentsInput;
  activeWorkSource?: WildsActiveWorkSource | null;
  activeCapabilityFamily?: WildsWorldCapabilityFamily | null;
  stewardPlacementPreview?: WildsStewardPlacement | null;
  burrowPreview?: WildsBurrowPreview | null;
  constructionPreview?: WildsBlueprintPlacement | null;
  constructionSelectionEnabled?: boolean;
  onSelectConstruction?: (id: string) => void;
  activeConstructionId?:string;
  explorerIdentityKey?:string;
  onDragConstruction?: import("./WildsContinuousConstruction").WildsConstructionDragHandler;
  state: PlayState;
  character: WildzCharacterGenesis;
  remotePlayers: WildsPresence[];
  qualityProfile: WildsQualityProfile;
  onFrameSample?: (frameMs: number) => void;
  onCameraHeadingChange: (heading: number) => void;
  searchEnabled: boolean;
  onSelectPlayer: (player: WildsPresence | null) => void;
  onSearchPoint: (point: WildsInteractionSurfacePoint) => void;
  onInteractResource?: (source: WildsResourceSource) => void;
  livingWorld?: WildsWorldProjection | null;
  livingPhysicalObstacles: readonly WildsTerrainObstacle[];
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
  onSitePortal: (siteKey: string, direction: "enter" | "exit") => void;
  worldMode: WildsSettlementWorldMode;
  kaiMoment: KaiKlokMoment;
  visualSettings?: Partial<WildsVisualSettings>;
  supportCards?: readonly PortableCardAsset[];
  crewModes?: WildsCrewModes;
  crewTravelRuntime?: MutableRefObject<WildsCrewTravelRuntime>;
  crewTravelMembershipRevision?: number;
  trainers?: readonly WildsTrainerProjection[];
  aerialCapabilities: readonly WildsTraversalCapability[];
  aerialStateRef: MutableRefObject<WildsAerialTraversalState>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
  verticalIntentRef: MutableRefObject<WildsVerticalTraversalIntent>;
  horizontalAllowedRef: MutableRefObject<boolean>;
  flightEndurancePotential: number;
  liftPotential: number;
  pressurePotential: number;
  aquaticPresentation: WildsAquaticPresentation;
  onAerialEnergyChange: (energy: number) => void;
  onAerialModeChange: (mode: WildsAerialMode) => void;
  onLandingRequired: (reason: WildsAerialLandingReason) => void;
  onVerticalReadoutChange: (layer: WildsVerticalTraversalState["layer"], value: number, safeMin: number, safeMax: number, blockerId: string | null) => void;
  vistaHeading?: number | null;
  onSelectTrainer: (trainer: WildsTrainerProjection) => void;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
  suspended?: boolean;
  resourcePending?: boolean;
  resourceCompanionReady?: boolean;
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
          // Shader log reads synchronize the GPU on first use. Keep diagnostic
          // checks in development rather than stalling production exploration.
          gl.debug.checkShaderErrors = WILDS_DIAGNOSTICS_ENABLED;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          if (WILDS_DIAGNOSTICS_ENABLED) publishWildsDiagnostics(gl, size, state, qualityProfile);
        }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        {onFrameSample ? <WildsFrameReporter onFrameSample={onFrameSample} /> : null}
        <Suspense fallback={null}>
          <WildsScene suspended={suspended} homeResidents={homeResidents} burrowPreview={burrowPreview} constructionPreview={constructionPreview} constructionSelectionEnabled={constructionSelectionEnabled} onSelectConstruction={onSelectConstruction} onDragConstruction={onDragConstruction} activeConstructionId={activeConstructionId} explorerIdentityKey={explorerIdentityKey} activeWorkSource={activeWorkSource} activeCapabilityFamily={activeCapabilityFamily} stewardPlacementPreview={stewardPlacementPreview} state={state} character={character} remotePlayers={remotePlayers} qualityProfile={qualityProfile} searchEnabled={searchEnabled} onCameraHeadingChange={onCameraHeadingChange} onSelectPlayer={onSelectPlayer} onSelectTrainer={onSelectTrainer} onSelectOverlook={onSelectOverlook} onSearchPoint={onSearchPoint} onInteractResource={onInteractResource} livingWorld={livingWorld} livingPhysicalObstacles={livingPhysicalObstacles} siteRuntime={siteRuntime} siteSpace={siteSpace} onSitePortal={onSitePortal} worldMode={worldMode} kaiMoment={kaiMoment} visualSettings={visualSettings} supportCards={supportCards} crewModes={crewModes} crewTravelRuntime={crewTravelRuntime} crewTravelMembershipRevision={crewTravelMembershipRevision} trainers={trainers} aerialCapabilities={aerialCapabilities} aerialStateRef={aerialStateRef} verticalTraversalRef={verticalTraversalRef} verticalIntentRef={verticalIntentRef} horizontalAllowedRef={horizontalAllowedRef} flightEndurancePotential={flightEndurancePotential} liftPotential={liftPotential} pressurePotential={pressurePotential} aquaticPresentation={aquaticPresentation} onAerialEnergyChange={onAerialEnergyChange} onAerialModeChange={onAerialModeChange} onLandingRequired={onLandingRequired} onVerticalReadoutChange={onVerticalReadoutChange} vistaHeading={vistaHeading} resourcePending={resourcePending} resourceCompanionReady={resourceCompanionReady} />
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
  suspended = false,
  homeResidents,
  activeWorkSource,
  activeCapabilityFamily,
  stewardPlacementPreview,
  burrowPreview,
  constructionPreview,
  constructionSelectionEnabled,
  onSelectConstruction,
  onDragConstruction,
  activeConstructionId,
  explorerIdentityKey,
  state,
  character,
  remotePlayers,
  qualityProfile,
  searchEnabled,
  onCameraHeadingChange,
  onSelectPlayer,
  onSearchPoint,
  onInteractResource,
  livingWorld,
  livingPhysicalObstacles,
  siteRuntime,
  siteSpace,
  onSitePortal,
  worldMode,
  kaiMoment,
  visualSettings,
  supportCards,
  crewModes,
  crewTravelRuntime,
  crewTravelMembershipRevision = 0,
  trainers,
  onSelectTrainer,
  onSelectOverlook,
  aerialCapabilities,
  aerialStateRef,
  verticalTraversalRef,
  verticalIntentRef,
  horizontalAllowedRef,
  flightEndurancePotential,
  liftPotential,
  pressurePotential,
  aquaticPresentation,
  onAerialEnergyChange,
  onAerialModeChange,
  onLandingRequired,
  onVerticalReadoutChange,
  vistaHeading,
  resourcePending,
  resourceCompanionReady
}: {
  suspended?: boolean;
  homeResidents?: WildsHomeResidentsInput;
  activeWorkSource?: WildsActiveWorkSource | null;
  activeCapabilityFamily: WildsWorldCapabilityFamily | null;
  stewardPlacementPreview?: WildsStewardPlacement | null;
  burrowPreview?: WildsBurrowPreview | null;
  constructionPreview?: WildsBlueprintPlacement | null;
  constructionSelectionEnabled?: boolean;
  onSelectConstruction?: (id: string) => void;
  activeConstructionId?:string;
  explorerIdentityKey?:string;
  onDragConstruction?: import("./WildsContinuousConstruction").WildsConstructionDragHandler;
  state: PlayState;
  character: WildzCharacterGenesis;
  remotePlayers: WildsPresence[];
  qualityProfile: WildsQualityProfile;
  searchEnabled: boolean;
  onCameraHeadingChange: (heading: number) => void;
  onSelectPlayer: (player: WildsPresence | null) => void;
  onSearchPoint: (point: WildsInteractionSurfacePoint) => void;
  onInteractResource?: (source: WildsResourceSource) => void;
  livingWorld?: WildsWorldProjection | null;
  livingPhysicalObstacles: readonly WildsTerrainObstacle[];
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
  onSitePortal: (siteKey: string, direction: "enter" | "exit") => void;
  worldMode: WildsSettlementWorldMode;
  kaiMoment: KaiKlokMoment;
  visualSettings: Partial<WildsVisualSettings>;
  supportCards: readonly PortableCardAsset[];
  crewModes?: WildsCrewModes;
  crewTravelRuntime?: MutableRefObject<WildsCrewTravelRuntime>;
  crewTravelMembershipRevision?: number;
  trainers: readonly WildsTrainerProjection[];
  onSelectTrainer: (trainer: WildsTrainerProjection) => void;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
  aerialCapabilities: readonly WildsTraversalCapability[];
  aerialStateRef: MutableRefObject<WildsAerialTraversalState>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
  verticalIntentRef: MutableRefObject<WildsVerticalTraversalIntent>;
  horizontalAllowedRef: MutableRefObject<boolean>;
  flightEndurancePotential: number;
  liftPotential: number;
  pressurePotential: number;
  aquaticPresentation: WildsAquaticPresentation;
  onAerialEnergyChange: (energy: number) => void;
  onAerialModeChange: (mode: WildsAerialMode) => void;
  onLandingRequired: (reason: WildsAerialLandingReason) => void;
  onVerticalReadoutChange: (layer: WildsVerticalTraversalState["layer"], value: number, safeMin: number, safeMax: number, blockerId: string | null) => void;
  vistaHeading: number | null;
  resourcePending: boolean;
  resourceCompanionReady: boolean;
}) {
  const world = projectWorldProgression(state.worldMastery);
  const kaiExpression = projectKaiWorldExpression(kaiMoment);
  const normalizedVisualSettings = useMemo(() => normalizeWildsVisualSettings(visualSettings), [visualSettings]);
  const interior = siteSpace.spaceId !== "wildz.space.outer.v1";
  const darkness = projectWildsAuthoredDarkness({
    encounter: state.encounter,
    player: state.player,
    ecologySites: Object.values(livingWorld?.ecologySites ?? {})
  });
  const nightRig = projectWildsNightRig(kaiExpression, normalizedVisualSettings, {
    authoredDarkness: interior ? 1 : darkness.amount,
    mode: "adventure"
  });
  const readability = projectWildsReadabilityProfile({
    authoredDarkness: interior ? 1 : darkness.amount,
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
  const partyCanClimb = useMemo(() => Boolean(activeAsset && projectWildsTraversalCapabilities(activeAsset, state.adventureConditions[activeAsset.id] ?? emptyAdventureCondition(activeAsset.id)).capabilities.includes("climb")), [activeAsset, state.adventureConditions]);
  const activeAppearance = useMemo(() => activeAsset ? projectCardKaiAppearance(activeAsset) : null, [activeAsset]);
  const swimming = (siteSpace.spaceId === "wildz.space.outer.v1" ? aquaticPresentation.mode === "swim" : siteSpace.flooded)
    && aerialCapabilities.includes("swim");
  const activeFloorY = siteSpace.position.y;
  const homeResidentCards = useMemo(() => {
    // Runtime membership mutates in place; this token invalidates resident exclusion.
    void crewTravelMembershipRevision;
    return homeResidents ? projectWildsHomeResidents({
    candidates: homeResidents.cards, ownedIds: playableInventory({inventory: state.inventory, adventureConditions: state.adventureConditions}).map(card => card.id),
    excludedIds: wildsCrewResidentExcludedIds([activeAsset?.id ?? "", ...supportCards.map(card => card.id)], crewTravelRuntime?.current ?? new Map()),
    shelterPosition: homeResidents.shelterPosition, player: homeResidents.shelterPosition,
    spaceId: "wildz.space.outer.v1"
  }) : []; }, [homeResidents, state.inventory, state.adventureConditions, activeAsset?.id, supportCards, crewTravelRuntime, crewTravelMembershipRevision]);
  const homeResidentsNearby = homeResidents && siteSpace.spaceId === "wildz.space.outer.v1"
    && Math.hypot(homeResidents.shelterPosition.x-state.player.x,homeResidents.shelterPosition.z-state.player.z) <= 30;
  const terrainTileX = Math.floor(state.player.x / WILDS_TERRAIN_TILE_SIZE);
  const terrainTileZ = Math.floor(state.player.z / WILDS_TERRAIN_TILE_SIZE);
  const terrainObstacleNeighborhood = useMemo(
    () => siteSpace.spaceId === "wildz.space.outer.v1" ? projectWildsAerialObstacleNeighborhood(state.player) : EMPTY_AERIAL_OBSTACLE_NEIGHBORHOOD,
    // Player coordinates deliberately do not rebuild this immutable projection inside a tile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [siteSpace.spaceId, terrainTileX, terrainTileZ]
  );
  const crewObstacles = useMemo(() => [...WILDS_RENDERED_PHYSICAL_OBSTACLES, ...terrainObstacleNeighborhood.obstacles, ...livingPhysicalObstacles], [terrainObstacleNeighborhood, livingPhysicalObstacles]);
  const actualCameraSubmergedRef = useRef(false);
  return (
    <WildsReadabilityProvider value={readability}>
      <color attach="background" args={[interior ? "#020304" : kaiSky]} />
      <fog attach="fog" args={[interior ? "#020304" : kaiFog, interior ? 2 : fogNear, interior ? 22 : fogFar]} />
      {!interior && <WildsCelestialSky expression={kaiExpression} qualityProfile={qualityProfile} />}
      <WildsAtmosphere interior={interior} encounter={state.encounter} expression={kaiExpression} missionProgress={state.missionProgress} nightRig={nightRig} player={state.player} qualityProfile={qualityProfile} />
      {!interior && <WildsKaiAtmosphereGeometry expression={kaiExpression} qualityProfile={qualityProfile} />}
      <CameraRig actualCameraSubmergedRef={actualCameraSubmergedRef} verticalTraversalRef={verticalTraversalRef} aquaticPresentation={aquaticPresentation} onCameraHeadingChange={onCameraHeadingChange} vistaHeading={vistaHeading} siteRuntime={siteRuntime} siteSpace={siteSpace} player={state.player} />
      <WildsUnderwaterAtmosphere cameraSubmergedRef={actualCameraSubmergedRef} qualityProfile={qualityProfile} surfaceFog={interior ? "#020304" : kaiFog} surfaceFogFar={interior ? 22 : fogFar} surfaceFogNear={interior ? 2 : fogNear} surfaceSky={interior ? "#020304" : kaiSky} />
      {WILDS_DIAGNOSTICS_ENABLED ? <WildsDiagnostics environment={{
        authoredDarkness: interior ? 1 : darkness.amount,
        dayPhase: kaiExpression.dayPhase,
        darknessSource: darkness.source,
        kaiCoordinate: kaiMoment.latticeCoordinate,
        lanternEnabled: nightRig.lanternVisible,
        nightAmount: kaiExpression.night.amount,
        reducedMotion: qualityProfile.reducedMotion,
        starCount: wildsStarCountForTier(qualityProfile.tier)
      }} qualityProfile={qualityProfile} siteRuntime={siteRuntime} state={state} /> : null}
      <SmoothWorldFrame player={state.player} terrainElevation={activeFloorY}>
        <SearchableTerrain
          activeWorkSource={activeWorkSource}
          kaiUPulse={kaiMoment.uPulse}
          enabled={searchEnabled}
          missionProgress={state.missionProgress}
          onSearchPoint={onSearchPoint}
          onSelectOverlook={onSelectOverlook}
          player={state.player}
          terrainElevation={activeFloorY}
          qualityProfile={qualityProfile}
          worldMastery={state.worldMastery}
          livingWorld={livingWorld}
          worldMode={worldMode}
          siteRuntime={siteRuntime}
          siteSpace={siteSpace}
          onSitePortal={onSitePortal}
        />
        {burrowPreview && <WildsBurrowGhost preview={burrowPreview} player={state.player} elevation={activeFloorY} />}
        <WildsAmbientLife enabled={siteSpace.spaceId === "wildz.space.outer.v1"} player={state.player} qualityProfile={qualityProfile} siteRuntime={siteRuntime} terrainElevation={activeFloorY} />
        <WildsEcologyEnvironment livingWorld={livingWorld} player={state.player} terrainElevation={activeFloorY} worldMode={worldMode} />
        <WildsRegenerativeGroveEnvironment livingWorld={livingWorld} player={state.player} terrainElevation={activeFloorY} />
        <WildsContinuousConstruction spaceId={siteSpace.spaceId} world={livingWorld} player={state.player} terrainElevation={activeFloorY} preview={constructionPreview} selectable={constructionSelectionEnabled} onSelect={onSelectConstruction} onDrag={onDragConstruction} activeComponentId={activeConstructionId} />
        <WildsStewardEnvironment
          activeWorkSource={activeWorkSource}
          placementPreview={stewardPlacementPreview}
          companionWorkFamilies={activeAsset ? projectWildsCreatureWorkFamilies(creatureForm(activeAsset.manifest.formId)?.element ?? "") : []}
          kaiUPulse={kaiMoment.uPulse}
          livingWorld={livingWorld}
          onInteractSource={onInteractResource}
          pending={resourcePending}
          player={state.player}
          companionReady={resourceCompanionReady}
          siteRuntime={siteRuntime}
          siteSpaceId={siteSpace.spaceId}
          terrainElevation={activeFloorY}
        />
        <WildsBossEnvironment livingWorld={livingWorld} player={state.player} qualityProfile={qualityProfile} terrainElevation={activeFloorY} />
        <EncounterSequence onSearchPoint={onSearchPoint} state={state} terrainElevation={activeFloorY} siteRuntime={siteRuntime} siteSpace={siteSpace} />
        {visibleRemotePlayers.map((player) => <RemoteExplorer key={player.playerId} player={player} localPlayer={state.player} onSelect={onSelectPlayer} siteRuntime={siteRuntime} siteSpace={siteSpace} terrainElevation={activeFloorY} />)}
        {trainers.map((trainer, index) => (
          index < 10 && Math.hypot(trainer.position[0] - state.player.x, trainer.position[2] - state.player.z) <= 28
            ? <TrainerExplorer key={trainer.id} trainer={trainer} localPlayer={state.player} onSelect={onSelectTrainer} siteRuntime={siteRuntime} siteSpace={siteSpace} terrainElevation={activeFloorY} />
            : null
        ))}
      </SmoothWorldFrame>
      <AerialPlayerFrame kaiUPulse={kaiMoment.uPulse} aquaticPresentation={aquaticPresentation} capabilities={aerialCapabilities} flightEndurancePotential={flightEndurancePotential} horizontalAllowedRef={horizontalAllowedRef} liftPotential={liftPotential} livingPhysicalObstacles={livingPhysicalObstacles} pressurePotential={pressurePotential} swimStamina={state.energy} onEnergyChange={onAerialEnergyChange} onModeChange={onAerialModeChange} onLandingRequired={onLandingRequired} onVerticalReadoutChange={onVerticalReadoutChange} player={state.player} runtime={aerialStateRef} terrainObstacleNeighborhood={terrainObstacleNeighborhood} verticalIntentRef={verticalIntentRef} verticalTraversalRef={verticalTraversalRef} siteRuntime={siteRuntime} siteSpace={siteSpace}>
        <WildsExplorer
          aerialPalette={{
            primary: activeAppearance?.palette.primary ?? "#c9fff0",
            accent: activeAppearance?.palette.accent ?? "#f5d46c",
            glow: activeAppearance?.palette.glow ?? "#76f3cf"
          }}
          aerialStateRef={aerialStateRef}
          character={character}
          identityKey={explorerIdentityKey}
          locomotion={swimming ? "swim" : "ground"}
          scubaVisible={swimming}
          style={character.gender}
          worldPosition={state.player}
        />
        {!crewTravelRuntime?.current.has(state.selectedAssetId) && (<ActiveCompanion suspended={suspended} world={livingWorld} partyCanClimb={partyCanClimb} crewTravelRuntime={crewTravelRuntime} crewRelocationKey={state.partyTravelRevision ?? 0} key={`${state.selectedAssetId}:${siteSpace.spaceId}`} kaiUPulse={kaiMoment.uPulse} locomotion={swimming ? "swim" : aerialStateRef.current.mode !== "ground" ? "air" : "ground"} activeWorkSource={activeWorkSource} activeCapabilityFamily={activeCapabilityFamily} crewModes={crewModes} obstacles={crewObstacles} siteRuntime={siteRuntime} siteSpace={siteSpace} state={state} terrainElevation={activeFloorY} />)}
      </AerialPlayerFrame>
      {crewTravelRuntime?.current.get(state.selectedAssetId)?.spaceId === siteSpace.spaceId && (<ActiveCompanion suspended={suspended} world={livingWorld} partyCanClimb={partyCanClimb} crewTravelRuntime={crewTravelRuntime} crewRelocationKey={state.partyTravelRevision ?? 0} key={`${state.selectedAssetId}:${siteSpace.spaceId}`} kaiUPulse={kaiMoment.uPulse} locomotion="ground" activeWorkSource={activeWorkSource} activeCapabilityFamily={activeCapabilityFamily} crewModes={crewModes} obstacles={crewObstacles} siteRuntime={siteRuntime} siteSpace={siteSpace} state={state} terrainElevation={activeFloorY} />)}
      <group name="grounded-support-companions" visible={!swimming}>
        <SupportCompanions suspended={suspended} world={livingWorld} partyCanClimb={partyCanClimb} crewTravelRuntime={crewTravelRuntime} crewRelocationKey={state.partyTravelRevision ?? 0} kaiUPulse={kaiMoment.uPulse} cards={supportCards} conditions={state.adventureConditions} crewModes={crewModes} obstacles={crewObstacles} player={state.player} siteRuntime={siteRuntime} siteSpace={siteSpace} terrainElevation={activeFloorY} />
      </group>
      {crewTravelRuntime && <IndependentCrewTravel suspended={suspended} world={livingWorld} runtime={crewTravelRuntime} state={state} obstacles={crewObstacles} siteRuntime={siteRuntime} siteSpace={siteSpace} terrainElevation={activeFloorY} qualityProfile={qualityProfile} />}
      {homeResidentsNearby && homeResidents && <WildsHomeResidents shelterPosition={homeResidents.shelterPosition} cards={homeResidentCards} player={state.player} terrainElevation={activeFloorY} reducedMotion={qualityProfile.reducedMotion} />}
      <Sparkles key={`wilds-world-sparkles-${worldSparkleCount}`} count={worldSparkleCount} scale={[8, 2.4, 8]} size={2.1} speed={qualityProfile.reducedMotion ? 0 : kaiExpression.particleSpeed} color={kaiExpression.accent} />
    </WildsReadabilityProvider>
  );
}

function AerialPlayerFrame({ kaiUPulse, aquaticPresentation, capabilities, children, flightEndurancePotential, horizontalAllowedRef, liftPotential, livingPhysicalObstacles, pressurePotential, swimStamina, onEnergyChange, onModeChange, onLandingRequired, onVerticalReadoutChange, player, runtime, terrainObstacleNeighborhood, verticalIntentRef, verticalTraversalRef, siteRuntime, siteSpace }: {
  aquaticPresentation: WildsAquaticPresentation;
  capabilities: readonly WildsTraversalCapability[];
  children: ReactNode;
  kaiUPulse: number;
  flightEndurancePotential: number;
  horizontalAllowedRef: MutableRefObject<boolean>;
  liftPotential: number;
  livingPhysicalObstacles: readonly import("@/features/play/wilds-terrain-obstacles").WildsTerrainObstacle[];
  pressurePotential: number;
  swimStamina: number;
  onEnergyChange: (energy: number) => void;
  onModeChange: (mode: WildsAerialMode) => void;
  onLandingRequired: (reason: WildsAerialLandingReason) => void;
  onVerticalReadoutChange: (layer: WildsVerticalTraversalState["layer"], value: number, safeMin: number, safeMax: number, blockerId: string | null) => void;
  player: PlayState["player"];
  runtime: MutableRefObject<WildsAerialTraversalState>;
  terrainObstacleNeighborhood: import("@/features/play/wilds-grounded-movement").WildsAerialObstacleNeighborhood;
  verticalIntentRef: MutableRefObject<WildsVerticalTraversalIntent>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
}) {
  const group = useRef<THREE.Group>(null);
  const previousPlayer = useRef(player);
  const publishedMode = useRef(runtime.current.mode);
  const publishedEnergy = useRef(100);
  const publishedVertical = useRef({ layer: "ground" as WildsVerticalTraversalState["layer"], value: Number.NaN, safeMin: Number.NaN, safeMax: Number.NaN, blockerId: null as string | null });
  const runtimeResult = useRef(createWildsAerialRuntimeResult());
  const collisionSampleRef = useRef(createWildsAerialCollisionSample());
  const sampleAerialCollision = useMemo(createWildsAerialCollisionSampler, []);
  const siteCollisionSampleRef = useRef({ ...createWildsAerialCollisionSample(), floorY: Number.NaN, flooded: false, waterSurfaceY: Number.NaN });
  const publishedLandingRequired = useRef(false);
  const runtimeStep = useRef<WildsAerialRuntimeStep>({
    deltaSeconds: 0, flightEndurancePotential: 0, groundElevation: 0, hasFlight: false, hasGlide: false,
    horizontalDistance: 0, positionX: 0, positionZ: 0, verticalOffset: 0
  });
  const verticalStep = useRef<WildsVerticalTraversalStep>({
    deltaSeconds: 0, initialOffset: 0, intent: 0, layer: "ground", liftPotential: 0,
    obstacleTopY: undefined, powered: false, pressurePotential: 0, stamina: 100,
    terrainElevation: 0, waterSurfaceY: 0
  });
  const weatherSample = useRef(createWildsKaiWeatherSample());
  const weatherExposure = useRef({ rain: 0, wind: 1, sheltered: false });
  const weatherPoint = useRef({ x: 0, y: 0, z: 0 });
  const hasFlight = capabilities.includes("flight");
  const hasGlide = capabilities.includes("glide");
  const hasSwim = capabilities.includes("swim");
  useFrame((_, delta) => {
    const prior = previousPlayer.current;
    const horizontalDistance = Math.hypot(player.x - prior.x, player.z - prior.z);
    previousPlayer.current = player;
    const groundElevation = aquaticPresentation.terrainElevation;
    const currentVertical = verticalTraversalRef.current;
    const siteInterior = siteSpace.spaceId !== "wildz.space.outer.v1";
    const collisionSample = collisionSampleRef.current;
    if (siteInterior) {
      collisionSample.obstacleTopY = Number.NaN;
      collisionSample.ceilingY = Number.NaN;
      collisionSample.protectedAirspace = false;
      collisionSample.blockerId = null;
    } else {
      sampleAerialCollision(player, currentVertical.layer === "air" ? currentVertical.worldY : groundElevation + .35, livingPhysicalObstacles, collisionSample, WILDS_PLAYER_BODY_HEIGHT, WILDS_PLAYER_BODY_RADIUS, terrainObstacleNeighborhood.obstacles);
    }
    const siteCollision = writeWildsSiteRuntimeAerialCollision(
      siteCollisionSampleRef.current,
      siteRuntime,
      siteSpace.spaceId,
      player.x,
      currentVertical.layer === "air" ? currentVertical.worldY : groundElevation + .35,
      player.z,
      WILDS_PLAYER_BODY_HEIGHT,
      WILDS_PLAYER_BODY_RADIUS,
      groundElevation
    );
    mergeWildsAerialCollisionSample(collisionSample, siteCollision);
    const activeGroundElevation = typeof siteCollision.floorY === "number" && Number.isFinite(siteCollision.floorY) ? siteCollision.floorY : groundElevation;
    const activeWaterSurfaceY = typeof siteCollision.waterSurfaceY === "number" && Number.isFinite(siteCollision.waterSurfaceY) ? siteCollision.waterSurfaceY : aquaticPresentation.waterSurfaceY;
    const aerialInput = runtimeStep.current;
    aerialInput.weatherLoad = 0;
    if (!siteInterior && runtime.current.mode !== "ground") {
      writeWildsKaiWeather(weatherSample.current, kaiUPulse, player.x, player.z);
      weatherPoint.current.x = player.x; weatherPoint.current.z = player.z;
      weatherPoint.current.y = currentVertical.worldY;
      writeWildsWeatherExposure(weatherExposure.current, weatherSample.current, weatherPoint.current, livingPhysicalObstacles);
      aerialInput.weatherLoad = weatherSample.current.flightLoad * weatherExposure.current.wind;
    }
    aerialInput.deltaSeconds = delta;
    aerialInput.flightEndurancePotential = flightEndurancePotential;
    aerialInput.groundElevation = activeGroundElevation;
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
      : (siteCollision.flooded || aquaticPresentation.mode === "swim") && hasSwim
        ? "water" as const
        : "ground" as const;
    const verticalInput = verticalStep.current;
    verticalInput.deltaSeconds = delta;
    verticalInput.initialOffset = layer === "air"
        ? Math.max(.35, runtime.current.altitude - activeGroundElevation)
        : siteCollision.flooded
          ? Math.max(.35, activeWaterSurfaceY - activeGroundElevation - .8)
          : aquaticPresentation.actorLocalY;
    verticalInput.intent = verticalIntentRef.current;
    verticalInput.layer = layer;
    verticalInput.liftPotential = liftPotential * (1 - (aerialInput.weatherLoad ?? 0) * .2);
    verticalInput.ceilingY = collisionSample.ceilingY;
    verticalInput.obstacleTopY = collisionSample.obstacleTopY;
    verticalInput.powered = runtime.current.mode === "flight";
    verticalInput.pressurePotential = pressurePotential;
    verticalInput.stamina = layer === "water" ? swimStamina : runtime.current.stamina;
    verticalInput.terrainElevation = activeGroundElevation;
    verticalInput.waterSurfaceY = activeWaterSurfaceY;
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
      ? Math.max(0, activeWaterSurfaceY - (activeGroundElevation + currentVertical.offset))
      : currentVertical.offset;
    const readoutBucket = Math.round(readoutValue * 4);
    const minimumBucket = Math.round(currentVertical.safeMin * 4);
    const maximumBucket = Math.round(currentVertical.safeMax * 4);
    const priorReadout = publishedVertical.current;
    const physicallyRestricted = collisionSample.protectedAirspace
      || (Number.isFinite(collisionSample.ceilingY) && currentVertical.offset >= currentVertical.safeMax - .26)
      || (Number.isFinite(collisionSample.obstacleTopY) && currentVertical.worldY < collisionSample.obstacleTopY + .35 - .000001);
    const blockerId = layer === "air" && physicallyRestricted ? collisionSample.blockerId : null;
    if (priorReadout.layer !== layer || priorReadout.value !== readoutBucket || priorReadout.safeMin !== minimumBucket || priorReadout.safeMax !== maximumBucket || priorReadout.blockerId !== blockerId) {
      priorReadout.layer = layer;
      priorReadout.value = readoutBucket;
      priorReadout.safeMin = minimumBucket;
      priorReadout.safeMax = maximumBucket;
      priorReadout.blockerId = blockerId;
      onVerticalReadoutChange(layer, readoutValue, currentVertical.safeMin, currentVertical.safeMax, blockerId);
    }
    if (group.current) {
      const actorLocalY = layer === "ground" ? 0 : currentVertical.offset;
      const nextActorY = THREE.MathUtils.damp(group.current.position.y, actorLocalY, 8, delta);
      // Capture can immediately select a creature with different traversal
      // anatomy. Never ease a prior underwater offset upward through solid
      // terrain: grounded actors may settle from above, but never from below.
      group.current.position.y = layer === "ground" ? Math.max(0, nextActorY) : nextActorY;
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

function TrainerExplorer({ trainer, localPlayer, onSelect, siteRuntime, siteSpace, terrainElevation }: {
  trainer: WildsTrainerProjection;
  localPlayer: PlayState["player"];
  onSelect: (trainer: WildsTrainerProjection) => void;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
  terrainElevation: number;
}) {
  const group = useRef<THREE.Group>(null);
  const style = trainer.seed % 2 ? "female" as const : "male" as const;
  useFrame(({ clock }) => {
    if (!group.current) return;
    const phase = clock.elapsedTime * (0.18 + trainer.seed % 5 * 0.015) + trainer.seed % 97;
    const worldX = trainer.position[0] + Math.sin(phase) * 0.7;
    const worldZ = trainer.position[2] + Math.cos(phase * 0.83) * 0.7;
    const mountainElevation = wildsSiteRuntimeGroundY(siteRuntime, siteSpace.spaceId, worldX, worldZ, Number.NaN);
    writeWildsTerrainActorPosition(
      group.current.position,
      worldX,
      worldZ,
      localPlayer.x,
      localPlayer.z,
      0,
      Number.isFinite(mountainElevation) ? mountainElevation : undefined,
      terrainElevation
    );
    group.current.rotation.y = -phase;
  });
  const rosterName = creatureForm(trainer.rosterFormIds[0])?.name ?? trainer.affinity;
  const distance = Math.hypot(trainer.position[0] - localPlayer.x, trainer.position[2] - localPlayer.z);
  const initialElevation = wildsSiteRuntimeGroundY(siteRuntime, siteSpace.spaceId, trainer.position[0], trainer.position[2], Number.NaN);
  return <group
    name={`trainer-${trainer.id}`}
    onClick={(event) => { event.stopPropagation(); onSelect(trainer); }}
    position={projectWildsTerrainActorPosition({ x: trainer.position[0], z: trainer.position[2] }, localPlayer, 0, { actorElevation: Number.isFinite(initialElevation) ? initialElevation : undefined, anchorElevation: terrainElevation })}
    ref={group}
  >
    <WildsExplorer identityKey={`trainer:${trainer.id}`} remote style={style} worldPosition={{ x: trainer.position[0], z: trainer.position[2] }} />
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

/** Plans are produced by a bounded timer, never by the render-frame writer. */
function useCrewFollower(input: {
  player: PlayState["player"]; terrainElevation: number; siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState; obstacles: readonly WildsTerrainObstacle[];
  assetId: string; proofDigest: string; crewTravelRuntime?: MutableRefObject<WildsCrewTravelRuntime>; crewRelocationKey?: string | number; kaiUPulse: number; locomotion?: "ground" | "swim" | "air"; enabled: boolean; mode: "follow" | "roam"; cadenceMs: number; seed: number; offsetX: number; offsetZ: number;
  workSource?: WildsActiveWorkSource | null;
  partyCanClimb?: boolean;
  suspended?: boolean;
  travelerCanClimb?: boolean;
  world?: WildsWorldProjection | null;
}) {
  const group = useRef<THREE.Group>(null);
  const gait = useRef({ x: 0, y: 0, z: 0, distance: 0, speed: 0, travelled: 0 });
  const resetPresentation = useRef(true);
  const localPresentation = useRef({ x: 0, y: 0, z: 0 });
  const followMotion = useRef({ x: input.player.x, z: input.player.z, changedAt: performance.now() / 1000, speed: 0 });
  const retainedTravel = input.crewTravelRuntime?.current.get(input.assetId);
  const lastTravel = useRef(retainedTravel);
  if (retainedTravel) lastTravel.current = retainedTravel;
  const retainedPosition = retainedTravel?.proofDigest === input.proofDigest && retainedTravel.spaceId === input.siteSpace.spaceId ? retainedTravel.position : null;
  const position = useRef(retainedPosition ? { ...retainedPosition } : { x: input.player.x, y: input.terrainElevation, z: input.player.z });
  const stepState = useRef(createWildsCrewPathStepState());
  const directState = useRef(createWildsCrewPathStepState());
  const target = useRef({ x: input.player.x, y: input.terrainElevation, z: input.player.z });
  const targetFloor = useRef({ x: NaN, z: NaN, runtime: input.siteRuntime, space: "", interiorFloor: NaN, y: input.terrainElevation });
  const directWaypoints = useRef<Readonly<WildsCrewNavigationPoint>[]>([target.current]);
  const path = useRef<readonly Readonly<WildsCrewNavigationPoint>[]>([]);
  const latest = useRef(input); latest.current = input;
  const priorLocomotion = useRef(input.locomotion ?? "ground");
  const heading = useRef({ playerX: input.player.x, playerZ: input.player.z, heading: 0, desiredHeading: 0 });
  const fallbackTarget = useRef<{ requestedX: number; requestedZ: number; target: Readonly<WildsCrewNavigationPoint> } | null>(null);
  const relocatedKey = useRef(input.crewRelocationKey);
  const relocationPoint = useRef({ x: input.player.x, y: input.terrainElevation, z: input.player.z });
  const relocationSample = useRef({ allowed: false, y: NaN });
  const originX = Math.floor(input.player.x / 16) * 16, originZ = Math.floor(input.player.z / 16) * 16;
  const allowAccompaniedWading = input.mode === "follow" && !input.workSource && !retainedTravel;
  const canClimb = allowAccompaniedWading && input.partyCanClimb === true;
  const sampleSegment = useMemo(() => createWildsCrewPhysicalSampler({ canClimb, runtime: input.siteRuntime, spaceId: input.siteSpace.spaceId, obstacles: input.obstacles, originX, originZ, allowAccompaniedWading }), [input.siteRuntime, input.siteSpace.spaceId, input.obstacles, originX, originZ, allowAccompaniedWading, canClimb]);
  const authority = useMemo<WildsCrewNavigationAuthority>(() => ({ mode: "walk", permittedModes: ["walk"], sampleSegment }), [sampleSegment]);
  const frameInput = useMemo(() => ({ ...authority, speed: 5.5, deltaSeconds: 0, accompanyingSpeedLimit: 72 }), [authority]);
  const latestAuthority = useRef(authority);
  const travelAuthority = useMemo(() => createWildsCrewTravelAuthority({runtime:input.siteRuntime,spaceId:input.siteSpace.spaceId,obstacles:input.obstacles,world:input.world}), [input.siteRuntime,input.siteSpace.spaceId,input.obstacles,input.world]);
  const latestTravelAuthority = useRef(travelAuthority); latestTravelAuthority.current = travelAuthority;
  useEffect(() => {
    latestAuthority.current = retainedTravel ? travelAuthority(position.current,input.travelerCanClimb) : authority;
  }, [retainedTravel,travelAuthority,authority,input.travelerCanClimb]);
  function writeTarget(current: typeof input, delta: number) {
    writeWildsCrewAlongsideTarget(target.current, heading.current, current.player, current.offsetX, delta);
    let x = target.current.x, z = target.current.z;
    const excursion = current.mode === "roam" && (!current.locomotion || current.locomotion === "ground") ? current.crewTravelRuntime?.current.get(current.assetId) : undefined;
    if (excursion?.spaceId === current.siteSpace.spaceId) {
      x = excursion.target.x; z = excursion.target.z;
    } else if (current.workSource) {
      const dx = current.workSource.position.x - current.player.x, dz = current.workSource.position.z - current.player.z;
      const d = Math.max(.001, Math.hypot(dx, dz));
      x = current.workSource.position.x - dx / d * .82; z = current.workSource.position.z - dz / d * .82;
    } else if (current.mode === "roam" && (!current.locomotion || current.locomotion === "ground")) {
      const cadence = Math.max(2500, Math.min(12000, current.cadenceMs * 2));
      const visit = Math.floor(current.kaiUPulse / 1_000_000 * KAI_PULSE_DURATION_MS / cadence);
      const angle = current.seed + visit * 2.399963229728653;
      const radius = Math.max(1.1, Math.min(2.8, current.cadenceMs / 1600));
      x += Math.cos(angle) * radius; z += Math.sin(angle) * radius;
    }
    const cached = targetFloor.current;
    const interiorFloor = current.siteSpace.spaceId === "wildz.space.outer.v1" ? 0 : current.terrainElevation;
    if (cached.x !== x || cached.z !== z || cached.runtime !== current.siteRuntime || cached.space !== current.siteSpace.spaceId || cached.interiorFloor !== interiorFloor) {
      const fallback = current.siteSpace.spaceId === "wildz.space.outer.v1" ? wildsTerrainElevation(x, z) : current.terrainElevation;
      cached.y = wildsSiteRuntimeGroundY(current.siteRuntime, current.siteSpace.spaceId, x, z, fallback);
      cached.x = x; cached.z = z; cached.runtime = current.siteRuntime; cached.space = current.siteSpace.spaceId; cached.interiorFloor = interiorFloor;
    }
    target.current.x = x; target.current.z = z; target.current.y = excursion?.spaceId === current.siteSpace.spaceId ? excursion.target.y : cached.y;
    const alternate = fallbackTarget.current;
    if (alternate && Math.hypot(x - alternate.requestedX, z - alternate.requestedZ) <= .35) {
      target.current.x = alternate.target.x; target.current.y = alternate.target.y; target.current.z = alternate.target.z;
    } else if (alternate) fallbackTarget.current = null;
  }
  useEffect(() => {
    if (input.crewRelocationKey === relocatedKey.current) return;
    if (input.crewTravelRuntime?.current.has(input.assetId)) { relocatedKey.current = input.crewRelocationKey; return; }
    const p = relocationPoint.current;
    p.x = input.player.x; p.z = input.player.z; p.y = input.terrainElevation;
    if (!writeWildsCrewTransportPosition(position.current, p, relocationSample.current, authority)) return;
    path.current = []; fallbackTarget.current = null; stepState.current.waypointIndex = 0;
    stepState.current.reason = "arrived"; directState.current.reason = "arrived";
    relocatedKey.current = input.crewRelocationKey;
    resetPresentation.current = true;
    Object.assign(followMotion.current, { x: input.player.x, z: input.player.z, changedAt: performance.now() / 1000, speed: 0 });
  }, [input.crewRelocationKey, input.player.x, input.player.z, input.terrainElevation, input.crewTravelRuntime, input.assetId, authority]);
  useEffect(() => {
    path.current = []; fallbackTarget.current = null; stepState.current.waypointIndex = 0;
    stepState.current.reason = "arrived";
  }, [input.mode, input.workSource?.sourceId]);
  // Sampler refreshes do not clear routes or restart this timer. Each frame uses the
  // newest sampler, so changed collision is still enforced immediately.
  useEffect(() => {
    const update = () => {
      const current = latest.current;
      const travel = current.crewTravelRuntime?.current.get(current.assetId);
      if (travel?.spaceId === current.siteSpace.spaceId && travel.position === null) travel.position = { ...position.current };
      // Refresh real coverage before route checks, including a clear direct route.
      if (travel?.spaceId === current.siteSpace.spaceId) latestAuthority.current = latestTravelAuthority.current(position.current,current.travelerCanClimb);
      if (current.suspended || !current.enabled || travel?.halted || (current.locomotion && current.locomotion !== "ground")) return;
      if (!wildsCrewRouteNeedsReplan(path.current, stepState.current, directState.current)) return;
      const requestedX = target.current.x, requestedZ = target.current.z;
      const planned = planWildsCrewPathNearTarget({ ...latestAuthority.current, start: position.current, target: target.current, cellSize: .6, maxNodes: 192, maxDistance: 24 });
      const endpoint = planned.waypoints.at(-1);
      if (endpoint && Math.hypot(endpoint.x - requestedX, endpoint.z - requestedZ) > .01
        && Math.hypot(endpoint.x - requestedX, endpoint.z - requestedZ) <= 1.7) fallbackTarget.current = { requestedX, requestedZ, target: endpoint };
      path.current = planned.waypoints; stepState.current.waypointIndex = 0;
      stepState.current.reason = planned.reason === "path" ? "moving" : planned.reason === "arrived" ? "arrived" : "blocked";
    };
    const timer = window.setInterval(update, 300);
    return () => { window.clearInterval(timer); };
  }, []);
  useFrame((_, delta) => {
    if (!group.current || latest.current.suspended) return;
    const current = latest.current, p = position.current;
    const activeTrip = current.crewTravelRuntime?.current.get(current.assetId);
    // A suspended map delegates travel to the timer. Resume at its admitted anchor,
    // including a trip completed and removed while the visual writer was asleep.
    if (writeWildsCrewRetainedTravelPosition(p,activeTrip ?? lastTravel.current,current.proofDigest,current.siteSpace.spaceId)) {
      path.current=[];fallbackTarget.current=null;stepState.current.waypointIndex=0;
      stepState.current.reason="arrived";directState.current.reason="arrived";resetPresentation.current=true;
    }
    lastTravel.current=activeTrip;
    const oldX = p.x, oldZ = p.z;
    let regrouped = false;
    writeTarget(current, delta);
    frameInput.deltaSeconds = delta;
    frameInput.sampleSegment = activeTrip ? latestAuthority.current.sampleSegment : authority.sampleSegment;
    const followSpeed = writeWildsCrewFollowSpeed(followMotion.current, current.player, performance.now() / 1000, Math.hypot(target.current.x - p.x, target.current.z - p.z));
    frameInput.speed = current.mode === "follow" && !current.workSource ? followSpeed : 5.5;
    if (current.locomotion && current.locomotion !== "ground") {
      // Retain the selected companion's existing player-supported flight/swim frame.
      // Free roaming never creates a separate aerial or aquatic traversal ability.
      const dx = target.current.x - p.x, dz = target.current.z - p.z, distance = Math.hypot(dx, dz);
      const step = Math.min(distance, Math.max(0, Math.min(delta, .1)) * frameInput.speed);
      if (distance > .000001) { p.x += dx / distance * step; p.z += dz / distance * step; }
      p.y = current.terrainElevation;
    } else if (current.enabled && !activeTrip?.halted) {
      if (priorLocomotion.current !== "ground") {
        const floor = current.siteSpace.spaceId === "wildz.space.outer.v1" ? wildsTerrainElevation(p.x, p.z) : current.terrainElevation;
        p.y = wildsSiteRuntimeGroundY(current.siteRuntime, current.siteSpace.spaceId, p.x, p.z, floor);
      }
      if (Math.hypot(target.current.x - p.x, target.current.y - p.y, target.current.z - p.z) > .000001) {
        let remaining = frameInput.speed * Math.min(delta, .1);
        const substeps = Math.max(1, Math.min(3, Math.ceil(remaining / .45)));
        for (let step = 0; step < substeps && remaining > .000001; step++) {
          const beforeX = p.x, beforeY = p.y, beforeZ = p.z;
          frameInput.deltaSeconds = Math.min(remaining, 2.4) / frameInput.speed;
          writeWildsCrewFollowingStep(p, target.current, path.current, stepState.current, directState.current, directWaypoints.current, frameInput);
          const moved = Math.hypot(p.x - beforeX, p.y - beforeY, p.z - beforeZ);
          remaining -= moved;
          if (moved < .000001) break;
        }
      } else directState.current.reason = "arrived";
    }
    if (current.mode === "follow" && !activeTrip && current.enabled && !current.workSource && (!current.locomotion || current.locomotion === "ground")
      && performance.now() / 1000 - followMotion.current.changedAt < .18
      && (directState.current.reason === "blocked" || stepState.current.reason === "moving")) {
      const landing = relocationPoint.current;
      landing.x = current.player.x; landing.y = current.terrainElevation; landing.z = current.player.z;
      // Use the original nearby formation anchor, not a distant fallback parking goal.
      const formation = targetFloor.current;
      regrouped = writeWildsCrewFollowRegroup(p, landing, formation, relocationSample.current, authority, true);
      if (regrouped) {
        path.current = []; fallbackTarget.current = null; stepState.current.waypointIndex = 0;
        stepState.current.reason = "arrived"; directState.current.reason = "arrived";
        gait.current.distance = 0;
      }
    }
    priorLocomotion.current = current.locomotion ?? "ground";
    const travel = current.crewTravelRuntime?.current.get(current.assetId);
    if (travel?.spaceId === current.siteSpace.spaceId) {
      if (travel.position) { travel.position.x = p.x; travel.position.y = p.y; travel.position.z = p.z; }
      travel.paused = Boolean(travel.halted) || !current.enabled || current.mode !== "roam" || Boolean(current.locomotion && current.locomotion !== "ground");
      travel.blocked = (directState.current.reason === "blocked" && !(stepState.current.reason === "moving" && stepState.current.waypointIndex < path.current.length))
        || (fallbackTarget.current !== null && directState.current.reason === "arrived" && Math.hypot(p.x - travel.target.x, p.z - travel.target.z) > .35);
    }
    const dx = regrouped ? 0 : p.x - oldX, dz = regrouped ? 0 : p.z - oldZ, distance = Math.hypot(dx, dz);
    localPresentation.current.x = p.x - current.player.x;
    localPresentation.current.y = p.y - current.terrainElevation;
    localPresentation.current.z = p.z - current.player.z;
    writeWildsCrewFollowPresentation(gait.current, localPresentation.current, distance, delta, regrouped || resetPresentation.current);
    resetPresentation.current = false;
    group.current.position.set(gait.current.x, gait.current.y, gait.current.z);
    if (distance > .0001) {
      const heading = Math.atan2(dx, dz), blend = 1 - Math.exp(-Math.min(delta, .05) * 8);
      group.current.rotation.y += Math.atan2(Math.sin(heading - group.current.rotation.y), Math.cos(heading - group.current.rotation.y)) * blend;
    }
  }, -.5);
  return { group, gait };
}

function ActiveCompanion({ suspended = false, world, partyCanClimb, crewTravelRuntime, crewRelocationKey, kaiUPulse, locomotion, activeWorkSource, activeCapabilityFamily, crewModes, obstacles, siteRuntime, siteSpace, state, terrainElevation }: { suspended?: boolean; world?: WildsWorldProjection | null; partyCanClimb?: boolean; crewTravelRuntime?: MutableRefObject<WildsCrewTravelRuntime>; crewRelocationKey?: string | number; kaiUPulse: number; locomotion: "ground" | "swim" | "air"; activeWorkSource?: WildsActiveWorkSource | null; activeCapabilityFamily: WildsWorldCapabilityFamily | null; crewModes?: WildsCrewModes; obstacles: readonly WildsTerrainObstacle[]; siteRuntime: WildsSiteRuntimeProjection; siteSpace: WildsSiteSpaceState; state: PlayState; terrainElevation: number }) {
  const card = selectedCard(state);
  const asset = state.inventory.find((candidate) => candidate.id === state.selectedAssetId);
  const formId = asset?.manifest.formId ?? `${card.id}-1`;
  const appearance = useMemo(() => asset ? projectCardKaiAppearance(asset) : null, [asset]);
  const legacyRoaming = useMemo(() => {
    const mandate = asset ? creatureContinuityProjection(asset)?.mandate : null;
    return Boolean(mandate?.status === "active" && mandate.ownerReceizId === asset?.manifest.ownerReceizId);
  }, [asset]);
  const mode = (asset ? crewModes?.[asset.id] : undefined) ?? (legacyRoaming ? "roam" : "follow");
  const seed = useMemo(() => Number.parseInt(asset?.proof.digest.slice(-6) ?? "0", 16) || 0, [asset?.proof.digest]);
  const condition = useMemo(() => {
    try { return asset ? readWildsCrewCondition(asset, state.adventureConditions) : undefined; } catch { return undefined; }
  }, [asset, state.adventureConditions]);
  const enabled = useMemo(() => canWildsCrewTravel(condition), [condition]);
  const travelerCanClimb = useMemo(() => {
    try { return Boolean(asset && condition && projectWildsTraversalCapabilities(asset,condition).capabilities.includes("climb")); } catch { return false; }
  }, [asset,condition]);
  const { group, gait } = useCrewFollower({ suspended, world, travelerCanClimb, partyCanClimb, assetId: asset?.id ?? state.selectedAssetId, proofDigest: asset?.proof.digest ?? "", crewTravelRuntime, crewRelocationKey, kaiUPulse, locomotion, enabled, player: state.player, terrainElevation, siteRuntime, siteSpace, obstacles, mode, cadenceMs: appearance?.cadenceMs ?? 3200, seed, offsetX: -1.08, offsetZ: .42, workSource: activeWorkSource });
  const working = Boolean(activeWorkSource);
  const capabilityPresentation = useMemo(() => activeCapabilityFamily
    ? projectWildsCapabilityPresentation({ family: activeCapabilityFamily, targetId: activeWorkSource?.sourceId ?? null })
    : null, [activeCapabilityFamily, activeWorkSource?.sourceId]);
  return (
    <group name="active-companion" ref={group} scale={0.82}>
      <WildsCreatureActor grounded gait={gait} accent={appearance?.palette.accent ?? card.accent} anatomy={appearance?.anatomy} cadenceMs={appearance?.cadenceMs} familyId={asset?.manifest.familyId ?? card.id} formId={formId} glow={appearance?.palette.glow ?? card.accent} identityToken={appearance?.fingerprint} locomotion={locomotion} morphology={appearance?.morphology} pose={working ? "work" : capabilityPresentation?.actorPose ?? "curious"} primary={appearance?.palette.primary ?? card.color} secondary={appearance?.palette.secondary ?? card.color} />
      {capabilityPresentation ? <>
        <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[.58, .025, 8, 40]} />
          <meshStandardMaterial color={capabilityPresentation.color} emissive={capabilityPresentation.color} emissiveIntensity={.72} transparent opacity={.76} />
        </mesh>
        {activeCapabilityFamily === "light" ? <pointLight color={capabilityPresentation.color} decay={1.8} distance={6} intensity={1.35} position={[0, .75, 0]} /> : null}
      </> : null}
      <mesh position={[0, .025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.035, 8, 36]} />
        <meshStandardMaterial color="#f4fff6" emissive="#7cdea5" emissiveIntensity={0.55} transparent opacity={0.92} />
      </mesh>
      {state.battle && isBattleTelemetryPhase(state.encounter.phase) ? (
        <BattleWorldTelemetry fighter={state.battle.player} position={[0, 1.9, 0]} side="player" />
      ) : (
        <Html center className="wilds-world-label" occlude={false} position={[0, 0.96, 0]} zIndexRange={[10, 0]}>
          <span>{asset?.manifest.name ?? card.name}</span>
        </Html>
      )}
    </group>
  );
}

function SupportCompanions({ suspended = false, world, partyCanClimb, crewTravelRuntime, crewRelocationKey, kaiUPulse, cards, conditions, crewModes, obstacles, player, siteRuntime, siteSpace, terrainElevation }: { suspended?: boolean; world?: WildsWorldProjection | null; partyCanClimb?: boolean; crewTravelRuntime?: MutableRefObject<WildsCrewTravelRuntime>; crewRelocationKey?: string | number; kaiUPulse: number; cards: readonly PortableCardAsset[]; conditions: PlayState["adventureConditions"]; crewModes?: WildsCrewModes; obstacles: readonly WildsTerrainObstacle[]; player: PlayState["player"]; siteRuntime: WildsSiteRuntimeProjection; siteSpace: WildsSiteSpaceState; terrainElevation: number }) {
  return <group name="trail-pack-support-companions">
    {cards.slice(0, 2).map((card, index) => (!crewTravelRuntime?.current.has(card.id) || crewTravelRuntime.current.get(card.id)?.spaceId === siteSpace.spaceId) ? <SupportCompanion suspended={suspended} world={world} partyCanClimb={partyCanClimb} crewTravelRuntime={crewTravelRuntime} crewRelocationKey={crewRelocationKey} kaiUPulse={kaiUPulse} key={`${card.id}:${siteSpace.spaceId}`} card={card} condition={conditions[card.id]} index={index} mode={crewModes?.[card.id] ?? "follow"} obstacles={obstacles} player={player} siteRuntime={siteRuntime} siteSpace={siteSpace} terrainElevation={terrainElevation} /> : null)}
  </group>;
}
function SupportCompanion({ suspended = false, world, partyCanClimb, crewTravelRuntime, crewRelocationKey, kaiUPulse, card, condition, index, mode, obstacles, player, siteRuntime, siteSpace, terrainElevation }: { suspended?: boolean; world?: WildsWorldProjection | null; partyCanClimb?: boolean; crewTravelRuntime?: MutableRefObject<WildsCrewTravelRuntime>; crewRelocationKey?: string | number; kaiUPulse: number; card: PortableCardAsset; condition: PlayState["adventureConditions"][string] | undefined; index: number; mode: "follow" | "roam"; obstacles: readonly WildsTerrainObstacle[]; player: PlayState["player"]; siteRuntime: WildsSiteRuntimeProjection; siteSpace: WildsSiteSpaceState; terrainElevation: number }) {
  const appearance = useMemo(() => projectCardKaiAppearance(card), [card]);
  const seed = useMemo(() => Number.parseInt(card.proof.digest.slice(-6), 16) || 0, [card.proof.digest]);
  const currentCondition = useMemo(() => {
    try { return readWildsCrewCondition(card, condition ? { [card.id]: condition } : {}); } catch { return undefined; }
  }, [card, condition]);
  const enabled = useMemo(() => canWildsCrewTravel(currentCondition), [currentCondition]);
  const travelerCanClimb = useMemo(() => {
    try { return Boolean(currentCondition && projectWildsTraversalCapabilities(card, currentCondition).capabilities.includes("climb")); } catch { return false; }
  }, [card, currentCondition]);
  const { group, gait } = useCrewFollower({ suspended, world, travelerCanClimb, partyCanClimb, assetId: card.id, proofDigest: card.proof.digest, crewTravelRuntime, crewRelocationKey, kaiUPulse, enabled, player, terrainElevation, siteRuntime, siteSpace, obstacles, mode, cadenceMs: appearance.cadenceMs, seed, offsetX: index === 0 ? 1.05 : 1.62, offsetZ: index === 0 ? .72 : 1.34 });
  return <group ref={group} name={`trail-support-${index + 1}`} scale={index === 0 ? .62 : .54}>
    <WildsCreatureActor grounded gait={gait} locomotion="ground" accent={appearance.palette.accent} anatomy={appearance.anatomy} cadenceMs={appearance.cadenceMs} familyId={card.manifest.familyId} formId={card.manifest.formId} glow={appearance.palette.glow} identityToken={appearance.fingerprint} morphology={appearance.morphology} pose={index === 0 ? "curious" : "idle"} primary={appearance.palette.primary} secondary={appearance.palette.secondary} />
    <mesh position={[0, .025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.4, .025, 8, 28]} />
      <meshStandardMaterial color="#dffcf0" emissive="#58c99d" emissiveIntensity={.36} transparent opacity={.72} />
    </mesh>
  </group>;
}

/** Independent movement is serviced by a bounded timer; visibility never advances a trip. */
function IndependentCrewTravel({ suspended = false, world, runtime, state, obstacles, siteRuntime, siteSpace, terrainElevation, qualityProfile }: { suspended?: boolean;
  world?: WildsWorldProjection | null;
  runtime: MutableRefObject<WildsCrewTravelRuntime>; state: PlayState; obstacles: readonly WildsTerrainObstacle[];
  siteRuntime: WildsSiteRuntimeProjection; siteSpace: WildsSiteSpaceState; terrainElevation: number; qualityProfile: WildsQualityProfile;
}) {
  const cards = useMemo(() => new Map(state.inventory.map(card => [card.id, card])), [state.inventory]);
  const readiness = useMemo(() => new Map(state.inventory.map(card => {
    try {
      const condition=readWildsCrewCondition(card, state.adventureConditions);
      return [card.id,{ready:canWildsCrewTravel(condition),canClimb:condition?projectWildsTraversalCapabilities(card,condition).capabilities.includes("climb"):false}] as const;
    } catch { return [card.id,{ready:false,canClimb:false}] as const; }
  })), [state.inventory, state.adventureConditions]);
  const travelAuthority = useMemo(() => createWildsCrewTravelAuthority({runtime:siteRuntime,spaceId:siteSpace.spaceId,obstacles,world}), [siteRuntime,siteSpace.spaceId,obstacles,world]);
  const latest = useRef({ suspended, state, cards, readiness, travelAuthority, spaceId:siteSpace.spaceId, terrainElevation, qualityProfile });
  latest.current = { suspended, state, cards, readiness, travelAuthority, spaceId:siteSpace.spaceId, terrainElevation, qualityProfile };
  const candidates = useRef(new Map<string, PortableCardAsset>());
  const [visibleIds, setVisibleIds] = useState<readonly string[]>([]);
  useEffect(() => {
    const visibleCandidates=candidates.current;
    const scheduler = createWildsCrewPhysicalScheduler({runtime:()=>runtime.current,admit:(assetId,entry)=>{
      const current=latest.current, card=current.cards.get(assetId);
      if(!card||card.proof.digest!==entry.proofDigest){candidates.current.delete(assetId);return null;}
      const party=assetId===current.state.selectedAssetId||current.state.supportAssetIds.includes(assetId);
      if(wildsCrewUsesFrameWriter(party,current.suspended)){candidates.current.delete(assetId);return "party";}
      if(entry.spaceId!==current.spaceId||!entry.position){candidates.current.delete(assetId);return null;}
      if(party){
        candidates.current.delete(assetId);
        const readiness=current.readiness.get(assetId);
        return readiness?.ready?current.travelAuthority(entry.position,readiness.canClimb):null;
      }
      if(!candidates.current.has(assetId)&&candidates.current.size>=12){
        let farthestId:string|null=null,farthest=-1;
        for(const id of candidates.current.keys()){
          const point=runtime.current.get(id)?.position;
          const distance=point?Math.hypot(point.x-current.state.player.x,point.z-current.state.player.z):Infinity;
          if(distance>farthest){farthest=distance;farthestId=id;}
        }
        if(farthestId&&Math.hypot(entry.position.x-current.state.player.x,entry.position.z-current.state.player.z)<farthest)candidates.current.delete(farthestId);
      }
      if(candidates.current.has(assetId)||candidates.current.size<12)candidates.current.set(assetId,card);
      const readiness=current.readiness.get(assetId);
      return readiness?.ready?current.travelAuthority(entry.position,readiness.canClimb):null;
    }});
    const timer=window.setInterval(()=>scheduler.tick(),WILDS_CREW_PHYSICAL_TICK_MS);
    const visibilityTimer=window.setInterval(()=>{
      const current=latest.current;
      const selected=[...candidates.current.keys()].filter(id=>{
        const entry=runtime.current.get(id),card=current.cards.get(id);
        return entry?.position&&card?.proof.digest===entry.proofDigest&&entry.spaceId===current.spaceId&&id!==current.state.selectedAssetId&&!current.state.supportAssetIds.includes(id);
      }).sort((a,b)=>{
        const pa=runtime.current.get(a)!.position!,pb=runtime.current.get(b)!.position!;
        return Math.hypot(pa.x-current.state.player.x,pa.z-current.state.player.z)-Math.hypot(pb.x-current.state.player.x,pb.z-current.state.player.z)||a.localeCompare(b);
      }).slice(0,current.qualityProfile.tier==="low"?2:current.qualityProfile.tier==="medium"?3:4);
      setVisibleIds(previous=>previous.length===selected.length&&previous.every((id,i)=>id===selected[i])?previous:selected);
    },500);
    return()=>{window.clearInterval(timer);window.clearInterval(visibilityTimer);scheduler.clear();visibleCandidates.clear();};
  },[runtime]);
  return <SmoothWorldFrame player={state.player} terrainElevation={terrainElevation}><group name="independent-creature-travel">{visibleIds.map(id=>{
    const card=cards.get(id);
    return card&&id!==state.selectedAssetId&&!state.supportAssetIds.includes(id)?<IndependentCrewActor key={id} card={card} runtime={runtime} player={state.player} terrainElevation={terrainElevation} spaceId={siteSpace.spaceId}/>:null;
  })}</group></SmoothWorldFrame>;
}
function IndependentCrewActor({card,runtime,player,terrainElevation,spaceId}:{card:PortableCardAsset;runtime:MutableRefObject<WildsCrewTravelRuntime>;player:PlayState["player"];terrainElevation:number;spaceId:string}) {
  const appearance=useMemo(()=>projectCardKaiAppearance(card),[card]);
  const group=useRef<THREE.Group>(null),gait=useRef({distance:0,speed:0}),prior=useRef({x:NaN,z:NaN}),visualPosition=useRef({x:0,y:0,z:0});
  useFrame((_,delta)=>{
    const actor=group.current,entry=runtime.current.get(card.id);if(!actor)return;
    actor.visible=Boolean(entry?.position&&entry.spaceId===spaceId&&entry.proofDigest===card.proof.digest);
    if(!actor.visible||!entry?.position)return;
    const speed=writeWildsCrewVisualPosition(visualPosition.current,entry,performance.now());
    const p=visualPosition.current,distance=Number.isFinite(prior.current.x)?Math.hypot(p.x-prior.current.x,p.z-prior.current.z):0;
    if(distance>.000001){
      const target=Math.atan2(p.x-prior.current.x,p.z-prior.current.z);
      actor.rotation.y+=Math.atan2(Math.sin(target-actor.rotation.y),Math.cos(target-actor.rotation.y))*(1-Math.exp(-12*Math.min(.1,delta)));
    }
    gait.current.distance+=distance;gait.current.speed=speed;
    prior.current.x=p.x;prior.current.z=p.z;
    actor.position.set(p.x-player.x,p.y-terrainElevation,p.z-player.z);
  },-.5);
  return <group name={`independent-crew-${card.id}`} ref={group} scale={.62}>
    <WildsCreatureActor grounded gait={gait} locomotion="ground" accent={appearance.palette.accent} anatomy={appearance.anatomy} cadenceMs={appearance.cadenceMs} familyId={card.manifest.familyId} formId={card.manifest.formId} glow={appearance.palette.glow} identityToken={appearance.fingerprint} morphology={appearance.morphology} pose="curious" primary={appearance.palette.primary} secondary={appearance.palette.secondary}/>
    <Html center className="wilds-world-label" occlude={false} position={[0,.96,0]} zIndexRange={[10,0]}><span>{card.manifest.name}</span></Html>
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
  siteRuntime,
  siteSpace,
  terrainElevation
}: {
  player: WildsPresence;
  localPlayer: PlayState["player"];
  onSelect: (player: WildsPresence) => void;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
  terrainElevation: number;
}) {
  const group = useRef<THREE.Group>(null);
  const actorPosition = useMemo(() => {
    const actorElevation = wildsSiteRuntimeGroundY(siteRuntime, siteSpace.spaceId, player.x, player.z, Number.NaN);
    return projectWildsTerrainActorPosition(
      { x: player.x, z: player.z },
      { x: localPlayer.x, z: localPlayer.z },
      0,
      { actorElevation: Number.isFinite(actorElevation) ? actorElevation : undefined, anchorElevation: terrainElevation }
    );
  }, [localPlayer.x, localPlayer.z, player.x, player.z, siteRuntime, siteSpace.spaceId, terrainElevation]);
  const initialPosition = useRef(actorPosition);
  const displayedWorld = useRef(new THREE.Vector3(player.x, actorPosition[1] + terrainElevation, player.z));
  const target = useRef(new THREE.Vector3());
  target.current.set(player.x, actorPosition[1] + terrainElevation, player.z);
  useFrame((_, delta) => {
    if (!group.current) return;
    displayedWorld.current.lerp(target.current, 1 - Math.exp(-12 * Math.min(.1, delta)));
    // Rebase once; React must not overwrite the interpolated pose on each packet.
    group.current.position.set(displayedWorld.current.x - localPlayer.x,
      displayedWorld.current.y - terrainElevation, displayedWorld.current.z - localPlayer.z);
  });
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(player);
      }}
      position={initialPosition.current}
      ref={group}
    >
      <WildsExplorer identityKey={player.handle||player.playerId} remote style={player.style} worldPosition={{ x: player.x, z: player.z }} />
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

function CameraRig({ actualCameraSubmergedRef, verticalTraversalRef, aquaticPresentation, onCameraHeadingChange, vistaHeading, siteRuntime, siteSpace, player }: {
  actualCameraSubmergedRef: MutableRefObject<boolean>;
  verticalTraversalRef: MutableRefObject<WildsVerticalTraversalState>;
  aquaticPresentation: WildsAquaticPresentation;
  onCameraHeadingChange: (heading: number) => void;
  vistaHeading: number | null;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
  player: PlayState["player"];
}) {
  const { camera } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const unclippedCamera = useRef(new THREE.Vector3());
  const cameraWasClipped = useRef(false);
  // OrbitControls updates at -1. Restore its desired orbit before it updates,
  // then constrain only the rendered camera below; clear views regain distance.
  useFrame(() => {
    if (cameraWasClipped.current && siteSpace.spaceId !== "wildz.space.outer.v1") camera.position.copy(unclippedCamera.current);
    cameraWasClipped.current = false;
  }, -2);
  const priorVista = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const cameraProjection = useRef<MutableUnderwaterCameraProjection>({ underwaterTargetActive: false, localWaterSurfaceY: 0, targetY: .9, cameraY: 0 });
  const lastHeading = useRef(Number.NaN);
  const siteCameraRef = useRef({ floorY: 0, ceilingY: Number.POSITIVE_INFINITY, flooded: false, waterSurfaceY: Number.NaN });
  const siteAquaticRef = useRef({ mode: "swim" as const, terrainElevation: 0, waterSurfaceY: 0, waterDepth: 0, actorLocalY: 0, actorWorldY: 0, cameraSubmersionAllowed: true, scubaVisible: true });
  const siteDryRef = useRef({ mode: "land" as const, terrainElevation: 0, waterSurfaceY: 0, waterDepth: 0, actorLocalY: 0, actorWorldY: 0, cameraSubmersionAllowed: false, scubaVisible: false });
  const flightControls = useRef(createWildsFlightCameraControlState());
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
      const controlState = writeWildsFlightCameraControlState(flightControls.current, verticalTraversalRef.current.layer === "air", delta);
      orbit.dampingFactor = controlState.dampingFactor;
      orbit.maxDistance = siteSpace.spaceId === "wildz.space.outer.v1" ? controlState.maxDistance : 4;
      orbit.minDistance = siteSpace.spaceId === "wildz.space.outer.v1" ? controlState.minDistance : .45;
      orbit.minPolarAngle = controlState.minPolarAngle;
      orbit.maxPolarAngle = controlState.maxPolarAngle;
      orbit.rotateSpeed = controlState.rotateSpeed;
      orbit.zoomSpeed = controlState.zoomSpeed;
      const siteWorldY = siteSpace.position.y;
      const siteCamera = writeWildsSiteRuntimeCamera(siteCameraRef.current, siteRuntime, siteSpace.spaceId, player.x, siteWorldY, player.z);
      const clearance = verticalTraversalRef.current.layer === "ground" ? 0 : verticalTraversalRef.current.offset;
      const surfaceTargetY = .9 + clearance;
      const projection = cameraProjection.current;
      let activeAquatic = aquaticPresentation;
      if (wildsSiteRuntimeCameraIsFlooded(siteCamera)) {
          const siteAquatic = siteAquaticRef.current;
          siteAquatic.terrainElevation = siteCamera.floorY;
          siteAquatic.waterSurfaceY = siteCamera.waterSurfaceY;
          siteAquatic.waterDepth = Math.max(0, siteCamera.waterSurfaceY - siteCamera.floorY);
          siteAquatic.actorWorldY = siteWorldY + clearance;
          siteAquatic.actorLocalY = siteAquatic.actorWorldY - siteCamera.floorY;
          activeAquatic = siteAquatic;
      } else if (siteSpace.spaceId !== "wildz.space.outer.v1" || siteCamera.floorY > aquaticPresentation.waterSurfaceY + .05) {
          const siteDry = siteDryRef.current;
          siteDry.terrainElevation = siteCamera.floorY;
          siteDry.waterSurfaceY = siteCamera.floorY;
          siteDry.actorWorldY = siteWorldY + clearance;
          activeAquatic = siteDry;
      }
      writeUnderwaterCameraTarget(activeAquatic, surfaceTargetY, camera.position.y - orbit.target.y, projection, clearance);
      const priorTargetY = orbit.target.y;
      orbit.target.y = THREE.MathUtils.damp(orbit.target.y, projection.targetY, 8, delta);
      camera.position.y += orbit.target.y - priorTargetY;
      if (Number.isFinite(siteCamera.ceilingY)) {
        const localCeiling = siteCamera.ceilingY - siteWorldY - .18;
        camera.position.y = Math.min(camera.position.y, localCeiling);
        orbit.target.y = Math.min(orbit.target.y, localCeiling - .4);
      }
      actualCameraSubmergedRef.current = isUnderwaterCameraSubmerged(
        camera.position.y,
        projection.localWaterSurfaceY,
        actualCameraSubmergedRef.current,
        activeAquatic.cameraSubmersionAllowed,
        false
      );
    } else if (vistaHeading !== null) {
      actualCameraSubmergedRef.current = false;
    }
    if (orbit && siteSpace.spaceId !== "wildz.space.outer.v1") {
      unclippedCamera.current.copy(camera.position);
      writeWildsInteriorCameraPosition(camera.position, siteRuntime, siteSpace.spaceId, siteSpace.position, orbit.target.y);
      cameraWasClipped.current = camera.position.distanceToSquared(unclippedCamera.current) > .000001;
      camera.lookAt(orbit.target);
    }
    const heading = Math.atan2(camera.position.x, camera.position.z);
    if (Number.isFinite(lastHeading.current) && Math.abs(heading - lastHeading.current) < .001) return;
    lastHeading.current = heading;
    onCameraHeadingChange(heading);
  }, -.25);
  return (
    <OrbitControls
      makeDefault
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
  activeWorkSource,
  kaiUPulse,
  player,
  enabled,
  missionProgress,
  qualityProfile,
  terrainElevation,
  worldMastery,
  onSearchPoint,
  onSelectOverlook,
  livingWorld,
  worldMode,
  siteRuntime,
  siteSpace,
  onSitePortal
}: {
  activeWorkSource?: WildsActiveWorkSource | null;
  kaiUPulse: number;
  player: PlayState["player"];
  enabled: boolean;
  missionProgress: number;
  qualityProfile: WildsQualityProfile;
  terrainElevation: number;
  worldMastery: number;
  onSearchPoint: (point: WildsInteractionSurfacePoint) => void;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
  onSitePortal: (siteKey: string, direction: "enter" | "exit") => void;
}) {
  return (
    <group
      onClick={(event) => {
        if (!enabled) return;
        event.stopPropagation();
        const point = { x: player.x + event.point.x, z: player.z + event.point.z };
        onSearchPoint(projectWildsInteractionSurfacePoint(
          siteRuntime,
          siteSpace.spaceId,
          point,
          siteSpace.spaceId === "wildz.space.outer.v1" ? wildsTerrainElevation(point.x, point.z) : siteSpace.position.y
        ));
      }}
    >
      <StreamedTerrain activeWorkSource={activeWorkSource} kaiUPulse={kaiUPulse} missionProgress={missionProgress} player={player} qualityProfile={qualityProfile} terrainElevation={terrainElevation} worldMastery={worldMastery} livingWorld={livingWorld} worldMode={worldMode} onSelectOverlook={onSelectOverlook} siteRuntime={siteRuntime} siteSpace={siteSpace} onSitePortal={onSitePortal} />
    </group>
  );
}

function StreamedTerrain({
  activeWorkSource,
  kaiUPulse,
  missionProgress,
  player,
  qualityProfile,
  terrainElevation,
  worldMastery,
  livingWorld,
  worldMode,
  onSelectOverlook,
  siteRuntime,
  siteSpace,
  onSitePortal
}: {
  activeWorkSource?: WildsActiveWorkSource | null;
  kaiUPulse: number;
  missionProgress: number;
  player: PlayState["player"];
  qualityProfile: WildsQualityProfile;
  terrainElevation: number;
  worldMastery: number;
  livingWorld?: WildsWorldProjection | null;
  worldMode: WildsSettlementWorldMode;
  onSelectOverlook: (overlookId: WildsOverlookId) => void;
  siteRuntime: WildsSiteRuntimeProjection;
  siteSpace: WildsSiteSpaceState;
  onSitePortal: (siteKey: string, direction: "enter" | "exit") => void;
}) {
  return <WildsEnvironment activeWorkSource={activeWorkSource} kaiUPulse={kaiUPulse} missionProgress={missionProgress} player={player} qualityProfile={qualityProfile} terrainElevation={terrainElevation} worldMastery={worldMastery} livingWorld={livingWorld} worldMode={worldMode} onSelectOverlook={onSelectOverlook} siteRuntime={siteRuntime} siteSpace={siteSpace} onSitePortal={onSitePortal} />;
}

function Creature({
  card,
  formId = `${card.id}-1`,
  pose = "idle",
  identity,
  layer = "ground"
}: {
  card: CreatureCard;
  formId?: string;
  pose?: WildsCreaturePose;
  identity?: Exclude<PlayState["encounter"], { phase: "idle" }>["discoveryIdentity"];
  layer?: WildsEncounterLayer;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const readability = useWildsReadability();
  const appearance = useMemo(
    () => identity ? projectEncounterCreatureVisualIdentity({ identity, formId }) : null,
    [formId, identity]
  );

  useFrame(() => {
    if (!groupRef.current) return;
    const elapsed = frameSeconds();
    writeWildsEncounterActorOuterFrame(
      groupRef.current,
      layer,
      elapsed,
      card.position[0],
      card.position[2],
      readability.motionScale
    );
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
          locomotion={wildsEncounterActorLocomotion(layer)}
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

function EncounterSequence({ state, terrainElevation, siteRuntime, siteSpace, onSearchPoint }: { state: PlayState; terrainElevation: number; siteRuntime: WildsSiteRuntimeProjection; siteSpace: WildsSiteSpaceState; onSearchPoint: (point: WildsInteractionSurfacePoint) => void }) {
  const encounter = state.encounter;
  if (encounter.phase === "idle") return null;
  const searchPosition = Number.isFinite(encounter.searchPoint.surfaceWorldY)
    ? [encounter.searchPoint.x - state.player.x, encounter.searchPoint.surfaceWorldY! - terrainElevation + .04, encounter.searchPoint.z - state.player.z] as [number, number, number]
    : projectWildsTerrainActorPosition(encounter.searchPoint, state.player, .04, { anchorElevation: terrainElevation });
  if (encounter.phase === "searching") {
    return <SearchPulse hint={false} position={searchPosition} />;
  }
  if (encounter.phase === "hint") {
    const hint = projectWildsDiscoveryHint(encounter)!;
    const placement = encounter.placement;
    const hintPosition = hint.medium === "air" && placement
      ? [placement.x - state.player.x, placement.worldY - terrainElevation, placement.z - state.player.z] as [number, number, number]
      : searchPosition;
    return (
      <>
        <SearchPulse hint medium={hint.medium} onActivate={hint.activateOnSignal && placement ? () => onSearchPoint({ x: placement.x, z: placement.z, surfaceWorldY: placement.worldY }) : undefined} position={hintPosition} />
        {hint.showHabitatCover
          ? <RustlingClue encounter={encounter} player={state.player} terrainElevation={terrainElevation} />
          : <AirborneClue position={hintPosition} />}
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
  const placement = encounter.placement;
  const siteEncounter = placement ? writeWildsSiteRuntimeEncounter(
    { siteKey: null, spaceId: siteSpace.spaceId, layer: placement.layer, minY: placement.interactionBand.minY, maxY: placement.interactionBand.maxY },
    siteRuntime,
    siteSpace.spaceId,
    placement.x,
    placement.worldY,
    placement.z
  ) : null;
  const encounterWorldY = placement?.layer === "ground"
    ? wildsSiteRuntimeGroundY(siteRuntime, siteSpace.spaceId, placement.x, placement.z, placement.worldY)
    : placement?.worldY;
  const position: [number, number, number] = placement
    ? [placement.x - state.player.x, encounterWorldY! - terrainElevation, placement.z - state.player.z]
    : searchPosition;
  return (
    <group position={position} userData={{ encounterLayer: placement?.layer ?? "ground", encounterWorldY: encounterWorldY ?? null, placementIdentity: placement?.identity ?? null, siteKey: encounter.siteContext?.siteKey ?? siteEncounter?.siteKey ?? null, siteSpaceId: encounter.siteContext?.spaceId ?? siteEncounter?.spaceId ?? siteSpace.spaceId }}>
      <SearchPulse hint position={[0, 0, 0]} />
      <HabitatCover cover={encounter.cover} open={encounter.phase !== "emerging"} />
      <group scale={encounter.phase === "capsule" ? 0.68 : encounter.phase === "sealed" || encounter.phase === "revealed" ? 0.01 : 1}>
        <Creature card={localCard} formId={encounter.formId} identity={encounter.discoveryIdentity} layer={placement?.layer} pose={pose} />
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
  const clueWorld = encounter.placement ? { x: encounter.placement.x, z: encounter.placement.z } : {
    x: encounter.searchPoint.x + direction.x * distance,
    z: encounter.searchPoint.z + direction.z * distance
  };
  const position: [number, number, number] = encounter.placement
    ? [clueWorld.x - player.x, encounter.placement.worldY - terrainElevation, clueWorld.z - player.z]
    : projectWildsTerrainActorPosition(clueWorld, player, .03, { anchorElevation: terrainElevation });

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
    <group position={position}>
      <group ref={ref}>
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
    </group>
  );
}

function AirborneClue({ position }: { position: [number, number, number] }) {
  return <group position={position} name="airborne-discovery-signal">
    <mesh position={[-.28, 0, 0]} rotation={[0, 0, -.5]} scale={[.48, .16, .08]}>
      <sphereGeometry args={[1, 10, 6]} />
      <meshStandardMaterial color="#bff7ff" emissive="#61dff2" emissiveIntensity={.78} transparent opacity={.72} />
    </mesh>
    <mesh position={[.28, 0, 0]} rotation={[0, 0, .5]} scale={[.48, .16, .08]}>
      <sphereGeometry args={[1, 10, 6]} />
      <meshStandardMaterial color="#bff7ff" emissive="#61dff2" emissiveIntensity={.78} transparent opacity={.72} />
    </mesh>
    <Sparkles count={8} scale={[.9, .62, .9]} size={2.8} speed={.8} color="#e8fdff" />
  </group>;
}

function SearchPulse({ hint, medium = "ground", onActivate, position }: { hint: boolean; medium?: "ground" | "water" | "air"; onActivate?: () => void; position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = frameSeconds();
    const wave = 0.8 + (elapsed % 1) * 0.65;
    ref.current.scale.setScalar(wave);
    ref.current.rotation.y = elapsed * 0.7;
  });
  return (
    <group
      ref={ref}
      position={position}
      name={`${medium}-discovery-pulse`}
      onClick={onActivate ? (event) => { event.stopPropagation(); onActivate(); } : undefined}
    >
      <mesh rotation={medium === "air" ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.56, hint ? 0.045 : 0.028, 8, 48]} />
        <meshStandardMaterial color={medium === "air" ? "#dffcff" : hint ? "#fff2a8" : "#d8fff2"} emissive={medium === "air" ? "#61dff2" : hint ? "#f7c948" : "#37d688"} emissiveIntensity={medium === "air" ? 1.05 : 0.75} transparent opacity={0.8} />
      </mesh>
      {medium === "air" ? <mesh rotation={[Math.PI / 2, 0, 0]} scale={.72}>
        <torusGeometry args={[0.56, .025, 7, 36]} />
        <meshStandardMaterial color="#9ef5ff" emissive="#61dff2" emissiveIntensity={.9} transparent opacity={.6} />
      </mesh> : null}
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
  siteRuntime,
  state
}: {
  environment: { authoredDarkness: number; dayPhase: string; darknessSource: string; kaiCoordinate: string; lanternEnabled: boolean; nightAmount: number; reducedMotion: boolean; starCount: number };
  qualityProfile: WildsQualityProfile;
  siteRuntime: WildsSiteRuntimeProjection;
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
      siteRuntime: {
        diagnostics: wildsSiteRuntimeDiagnostics(),
        physicalVersion: siteRuntime.physical.version,
        runtimeVersion: siteRuntime.version,
        siteCount: siteRuntime.sites.length
      },
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
  }, [camera, gl, qualityProfile, scene, siteRuntime, size]);

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
