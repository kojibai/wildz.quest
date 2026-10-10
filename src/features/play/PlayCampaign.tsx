"use client";
import type { WildzPreparedIdentityPlayerVault } from "../../lib/receiz/wildz-prepared-player-vault";
import { receizBase64UrlEncode, receizBase64UrlDecode } from "@receiz/sdk";
import { useWildsRoamingBattle } from "./use-wilds-roaming-battle";
import { WildsRoamingBattle } from "./WildsRoamingBattle";
import { WildsRoamingNearby } from "./WildsRoamingNearby";
import { prepareWildsRoamingOwnerFile } from "../../lib/receiz/wilds-roaming-source-browser";
import { createKaiTemporalRoot } from "./kai-temporal-root";

import { canOperateWildzCrewCard, mergeWildzCrewCustody, type WildzCrewCustody } from "../../lib/receiz/wildz-artifact-codec";
import { isWildsCrewPhysicallyActive, settleWildsCrewPendingGrowth, type WildsCrewActiveTrips } from "./wilds-crew-passive-settlement";
import { nextWildsPartyTravelRevision } from "./wilds-party-transport";
import { composeWildsInteriorConstruction } from "./wilds-construction-physics";
import { createWildsWorldGeometrySelector } from "./wilds-world-geometry-selector";
import { nearestWildsVisible } from "./wilds-nearest-visible";
import { composeWildsBurrowPhysical } from "./wilds-burrow";
import { useWildsBurrowBuilder } from "./use-wilds-burrow-builder";
import { WildsBurrowBuilderPanel } from "./WildsBurrowBuilderPanel";
import { requestWildsDive, requestWildsJump } from "./wilds-vertical-traversal";
import {beginWildsHandAction, createWildsHandActionState, selectWildsHandTarget,readWildsEquipmentHand,rememberWildsEquipmentHand} from './wilds-player-actions';
import type {WildsPlayerHand, WildsPlayerHandIntent} from './WildsPlayerActionPad';
import {prepareCreationHandAction} from './creation/hand-action';
import {creationAimFromView} from './creation/equipment-aim';
import {creationWorldActorHead} from './creation/world-action';
import {creationWorldSourceHead} from './creation/world-source';
import {currentCreationEquipment,creationEquipmentProfile} from './creation/equipment';
import {createWildsEquipmentControlState,clearWildsEquipmentControlState,type WildsEquipmentControls} from './wilds-equipment-controls';
import {createWildsConstructionTerrainSelector,composeWildsConstructionTerrain,sampleWildsConstructionTerrainAt} from './wilds-construction-terrain';
import {wildsBuildGroundPoint,sampleWildsBuildGround} from './wilds-build-ground';
import {creationNodePoses} from './creation/projection';
import {withWildsWorldCommandKai} from './wilds-world-authority';
import { canSleepInWildsBed, selectWildsBedAtPlayer, resolveWildsConstructionFunction } from "./wilds-construction-function";

import dynamic from "next/dynamic";
import {creationFloorSupportAt,type CreationNavigation} from './creation/navigation';
import {reconcileWildsBedRest} from './wilds-bed-rest-runtime';
import { startWildsVisibleDisplayClock } from "./wilds-visible-display-clock";
import type {CreationController} from "./creation/controller";
import {createWorldCreationController,type WorldCreationControllerInput} from "./creation/world-controller";
import {createCreationPhysicalWorkerClient} from "./creation/physical-worker-client";
import type {CreationObjectLibraryInput} from "./creation/library-session";
import type {CreationPhysicalSnapshot} from "./creation/physical-store";
import type { CreationPreview } from "./creation/preview";
import { projectActiveCreationContext, type CreationContextSeed } from "./creation/live-context";
import { describeWildsPoint } from "./wilds-world-geography";
import {projectPlayerBreathState, playerBreathReadout} from "./player-breath-energy";
import type { CreationCompileContext } from "./creation/compiler";
import creationPanelClasses from "./creation/creation.module.css";
import { useWildsResourceExchange } from './use-wilds-resource-exchange';
import { foodUnavailableForExchange } from './wilds-resource-exchange-inventory';
import type { WildsWalletAssetSendRequest, WildsWalletAssetSendSelection } from './wallet/wilds-wallet-asset-send';
import { reconcileWildsNourishmentCustody, recoverWildsUnpackedPackageFood, creditWildsImportedPackageFood } from './wilds-nourishment';
import {recoverWildsWalletSourceFoodV128,selectWildsWalletSourceLotsV128} from './wallet/wilds-wallet-resource-use-projection-v128';
import { hasRecoverableWildsNativeFood, recoverWildsNativeFoodFuel } from './wilds-food-fuel-recovery';
const WildsResourceExchange=dynamic(()=>import('./WildsResourceExchange').then(module=>module.WildsResourceExchange),{ssr:false});
const CreationSession=dynamic(()=>import("./creation/CreationSession"),{ssr:false});
import { WildsVisitedSurface } from "./WildsVisitedSurface";
import { buildWildsRoamingPresenceUploads, projectWildsRemoteRoamingMarkers, type WildsRoamingPresenceUpload } from "./wilds-roaming-presence";
import { createWildsPlayStateSourceAdmission, retainWildsLocalPosition, admitWildsForwardPosition } from "./wilds-play-state-source";
import type { WildsCrewMapSource } from "./wilds-crew-map";
import { useWildsCrewExpeditions } from "./use-wilds-crew-expeditions";
import { recordWildsCrewModeObservation } from "./wilds-crew-observations";
import { sanitizeWildsCrewPreferences, setWildsCrewPreference } from "./wilds-crew-preferences";
import { projectWildsEarnedPhi } from "./wilds-earned-phi";
import { useWildsJourney } from "./useWildsJourney";
import { useWildsPlaytest } from "./useWildsPlaytest";
import { WildsHomeLife } from "./WildsHomeLife";
import { projectWildsHomeLife, type WildsHomeAction } from "./wilds-home-life";
import { WildsDiscoveryStory } from "./WildsDiscoveryStory";
import { projectWildsCompanionChapter } from "./wilds-companion-chapter";
import { WildsCompanionChapter } from "./WildsCompanionChapter";
import { projectWildsDiscoveryStory } from "./wilds-discovery-story";
import { projectWildsNextStep, type WildsNextStepAction } from "./wilds-next-step";
import { nextReachableWildsSite, wildsDiscoveryImpression, wildsTrailDirection } from "./wilds-journey-discovery";
import { Icons } from "@/components/icons";
import { Button, StatusPill } from "@/components/ui";
import {
  applyWildsInput,
  applyCommittedArenaSettlement,
  initialPlayState,
  playableInventory,
  isPlayableAsset,
  selectedAsset,
  projectWildsRestedCompanionCondition,
  selectedCard,
  exactCompanionProgress,
  type PlayState,
  type WildsInput
} from "@/features/play/game-state";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { wildzGameplayBackground } from "@/lib/performance/wildz-gameplay-background";
import { sha256PortableBasis, type PortableCardAsset } from "@/features/play/portable-card";
import { WildsCaptureReward } from "@/features/play/WildsCaptureReward";
import { WildsBattle } from "@/features/play/WildsBattle";
import { WildsTransformation } from "@/features/play/WildsTransformation";
import { WildsChildCeremony } from "@/features/play/WildsChildCeremony";
import { useWildsMultiplayer } from "@/features/play/use-wilds-multiplayer";
import { useWildsMessenger } from "@/features/play/use-wilds-messenger";
import { useWildsWorld } from "@/features/play/use-wilds-world";
import { projectWildsOwnedWorldAdditions, sameWildsOwnedWorldAdditions } from "@/features/play/wilds-player-world-additions";
import { wildsMaterialCustodian, type WildsWorldProjection } from "@/features/play/wilds-world-state";
import { WildsBalancedStatusHud } from "@/features/play/WildsBalancedStatusHud";
import { useWildsPresentation } from "@/features/play/use-wilds-presentation";
import type { WildsEmbodiedAudioRegistry, WildsEmbodiedSnapshot } from "./wilds-embodied-audio";
import { wildsFootSurfaceAt } from "./wilds-foot-surface";
import { playWildsHaptic } from "./wilds-haptics";
import { useWildsQualityProfile } from "@/features/play/use-wilds-quality-profile";
import { useWorldOverlayDirector } from "@/features/play/use-world-overlay-director";
import { usePlayModalLifecycle } from "@/features/play/use-play-modal-lifecycle";
import { canAcceptPlayShellInput, isCaptureRewardModalOwner, isWildBattleModalOwner, projectPlayCombatSurface, projectPlayShellOwner } from "@/features/play/play-shell-owner";
import {
  beginModalAdmission,
  canCommitModalAdmission,
  claimModalAdmissionOwner,
  createModalAdmissionState,
  isPlayHomeAvailable,
  releaseModalAdmissionOwner,
  type ModalAdmissionToken
} from "@/features/play/modal-admission";
import { worldInputForKeyboardEvent } from "@/features/play/world-keyboard-routing";
import { projectWildsAudioScene } from "@/features/play/wilds-audio-scene";
import { projectWildsBiome } from "@/features/play/wilds-biome";
import type { WildsSettlementDistrictId } from "@/features/play/wilds-settlements";
import { projectWorldProgression } from "@/features/play/world-progression";
import type { WildsCommandItem, WildsCommandKey } from "@/features/play/WildsCommandDock";
import { projectWildsCommandCenter, type WildsCommandAction } from "@/features/play/command-center/director";
import { kaiUPulseToISOString, millisecondsUntilNextKaiPulse,deriveKaiKlokMomentFromUPulse } from "@/features/play/kai-klok-moment";
import { createWildsKaiRuntimeClock, observeWildsKaiUPulse, resolveWildsRuntimeKaiMoment } from "@/features/play/wilds-kai-runtime";
import { rootWildsInputInKai } from "@/features/play/wilds-input-temporal-root";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { createWildzGameplayPublisher, type WildzGameplayPublisher } from "@/lib/performance/wildz-gameplay-publisher";
import { friendlyWildsGameplayError, isWildsTemporalContinuityError } from "@/features/play/wilds-temporal-errors";
import { kaiTransition, projectKaiWorldExpression, type KaiWorldExpression } from "@/features/play/kai-moment-expression";
import { WildzCommandInsight } from "@/features/play/WildzCommandInsight";
import type { WildsMovementMode } from "@/features/play/wilds-movement";
import { resolveWildsContextAction } from "@/features/play/wilds-context-action";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "@/features/play/wilds-creature-mandate";
import { admitWildsGroveAction, previewWildsGroveAction, type WildsGroveActionKind } from "@/features/play/wilds-regenerative-grove";
import { admitWildsEmissionOutcome } from "@/features/play/wilds-world-emission";
import { wildsWorldSourceEmission } from "@/features/play/wilds-world-genesis";
import { createWildsGroveResourceLot } from "@/features/play/wilds-resource-lot";
import type { WildsGroveExperienceAction } from "@/features/play/WildsRegenerativeGroveExperience";
import { landmarkAtPosition, WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "@/features/play/wilds-landmarks";
import { evaluateLandmarkAccess, type WildsLandmarkProgress } from "@/features/play/wilds-landmark-access";
import { authorizeRiftTravel, type RiftTravelGrant } from "@/features/play/wilds-rift-travel";
import { projectWildzHud } from "@/features/play/wildz-gameplay-hud";
import { adoptWildsExplorerSagaProgress } from "@/features/play/wilds-explorer-progression";
import { shouldRunWildzOffHotPathWork } from "@/features/play/wilds-network-status";
import { nextCreatureContinuityDueAt } from "@/features/play/creature-continuity";
import { WildzReferenceHud } from "@/features/play/WildzReferenceHud";
import { WildzWorldControls } from "@/features/play/WildzWorldControls";
import { WildsCreatureThumbnail } from "@/features/play/WildsCreatureThumbnail";
import { creatureFamilies, creatureForm } from "@/features/play/creature-catalog";
import { createWildsPlayerVault, type WildsPlayerVaultPayload, type WildzCardOrder } from "@/features/play/wilds-player-vault";
import type { WildzPreparedIdentityOwnedCard } from "@/lib/receiz/wildz-identity-adapter";
import { normalizeWildsVisualSettings, type WildsVisualSettings } from "@/features/play/wilds-night-visibility";
import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import type {
  WildzCardOnlyConfirmation,
  WildzCommittedArtifactRestore,
  WildzPlayerContinuity
} from "@/features/identity/wildz-restore";
import { bossAudioCue, ecologyAudioCue, normalizeWildsAudioSettings, settlementAudioCue } from "@/features/play/wilds-audio";
import { wildsSagaFramework } from "@/features/play/wilds-saga-content";
import { projectWildsSaga } from "@/features/play/wilds-saga-director";
import { projectMissionGraph, type WildsMissionContribution } from "@/features/play/wilds-saga-missions";
import {
  projectCampaignOpponentFromTrainer,
  projectSagaTrainers,
  type WildsTrainerBattleMemory,
  type WildsTrainerProjection
} from "@/features/play/wilds-saga-trainers";
import type { WildsTournamentProjection } from "@/features/play/wilds-saga-tournament";
import { createWildsCivicEvent, normalizeWildsCivicActorId, projectWildsCivicHistory } from "@/features/play/wilds-civic-history";
import { createWildsEcologyReceipt } from "@/features/play/wilds-ecology-history";
import { projectWildsRaidRoles } from "@/features/play/wilds-raid-roles";
import { createWildsRaidReceipt } from "@/features/play/wilds-raid-history";
import type { WildsRaidEncounterState, WildsRaidIntent } from "@/features/play/wilds-raid-encounter";
import type { WildsBossFamilyId } from "@/features/play/wilds-boss-ecology";
import { deriveLoadoutSynergy, projectWildsCardMastery } from "@/features/play/wilds-card-mastery";
import {
  createWildzVaultCardMembershipProof,
  deriveWildzVaultCardAdmission,
  type WildzVaultCardAdmission,
  type WildzVaultCardMembershipProof
} from "@/lib/receiz/wildz-vault-card-admission";
import {
  ARENA_SETTLEMENT_JOURNAL_PREFIX,
  recoverArenaSettlementJournalEntry,
  type ArenaSettlement
} from "@/features/games/mortal-arena/settlement";
import {
  advanceTrainerEncounter,
  createTrainerEncounter,
  shouldDismissTrainerEncounterForExternalCombat,
  type TrainerEncounterEvent,
  type TrainerEncounterState
} from "@/features/play/trainer-encounter";
import { creatureCareNotificationSchedule, WILDZ_CARE_PERIODIC_TAG } from "@/features/pwa/creature-care-schedule";
import { WILDZ_CARE_NOTIFICATIONS_READY, WILDZ_CARE_SCHEDULE_MESSAGE } from "@/features/pwa/pwa-events";
import { WildsWorldCanvas } from "@/features/play/WildsWorldCanvas";
import { createWildsDreamTrial, type WildsDreamTrial } from "./wilds-dream-trial";
import { useWildsWalletStagedTrade } from "./wallet/useWildsWalletStagedTrade";
import type { WildzMarketServiceV128 } from "../market/wildz-market-service-v128";
import { createLazyWildzMarketServiceV128 } from "../market/wildz-lazy-market-service-v128";
import { projectWildzMarketHeldSelectionsV128 } from "../market/wildz-market-held-selections-v128";
import { createWildsWalletAssetPortV128 } from "./wallet/wilds-wallet-asset-port-v128";
import { createWildsWalletResourceProjectionStoreV128 } from "./wallet/wilds-wallet-resource-projection-store-v128";
import { projectWildsWalletResourceProjectionsV128, type WildsWalletResourceProjectionRowV128 } from "./wallet/wilds-wallet-resource-projection-v128";
import { createWildsWalletResourceUsePortV128 } from "./wallet/wilds-wallet-resource-use-v128";
import { captureWildsResourceGameplayInput } from "./wilds-resource-gameplay-capture";
import { createWildsWalletGiftAgreement } from "./wallet/wilds-wallet-trade";
import { projectWildsWalletStagedTradeInbox } from "./wallet/wilds-wallet-staged-trade-inbox";
import { useWildsResourceGameplayCapture } from "./useWildsResourceGameplayCapture";
import { advanceWildsJumpTravel, captureWildsJumpTravel, type WildsJumpTravel, type WildsJumpMovement } from "./wilds-jump-travel";
import { useWildsWalletController, type WildsWalletClientAuthorizationPort } from "@/features/play/wallet/useWildsWalletController";
import { authorizeWildsWalletReadWithIdentity, projectWildsWalletSourceAuthority } from "@/features/play/wallet/wilds-wallet-read-authorization";
import { authorizeWildsWalletTransferWithIdentity } from "@/features/play/wallet/wilds-wallet-transfer-authorization";
import { authorizeWildsLivingWorldOperationWithIdentity } from "@/features/play/wilds-living-world-authorization";
import { projectWildsWalletPlayStateSeed, seedWildsWalletFromPlayState } from "@/features/play/wallet/wilds-wallet-play-state";
import { canCloseWildsWalletTerminal, WildsWalletTerminal } from "@/features/play/wallet/WildsWalletTerminal";
import { formatWildsPhiExact } from "@/features/play/wallet/wilds-wallet-format";
import { projectWildsWalletTradeInbox } from "@/features/play/wallet/wilds-wallet-trade-messaging";
import type { WildsWalletProposeTrade } from "@/features/play/wallet/wilds-wallet-trade";
import { emptyAdventureCondition } from "@/features/play/adventure/card-condition";
import { projectWildsTraversalCapabilities } from "@/features/play/wilds-traversal-capabilities";
import {
  beginWildsAerialTraversal,
  completeWildsAerialLanding,
  createGroundedWildsAerialState,
  planWildsAerialToggle,
  projectWildsFlightEndurancePotential,
  requestWildsAerialLanding,
  type WildsAerialLandingReason,
  type WildsAerialMode,
  type WildsAerialTraversalState
} from "@/features/play/wilds-aerial-traversal";
import { projectWildsAquaticPresentationAtPosition } from "@/features/play/wilds-aquatic-presentation";
import { wildsOverlookAt } from "@/features/play/wilds-overlooks";
import {projectWildsMonuments,appendWildsDiscoveryVisualSolids,WILDS_MONUMENT_INTERACTION_RADIUS} from './wilds-discovery-monuments';
import {WildsMonumentPanel} from './WildsMonumentPanel';
import {
  createWildsVerticalTraversalState,
  resetWildsVerticalTraversalState,
  writeWildsVerticalTraversalStep,
  type WildsVerticalTraversalIntent,
  type WildsVerticalTraversalState
} from "@/features/play/wilds-vertical-traversal";
import { resolveWildsRequiredLandingPosition } from "@/features/play/wilds-grounded-movement";
import { projectCreatureCapabilityIdentity, projectCreatureRuntimeCapabilities } from "@/features/play/creature-capability-identity";
import { wildsTerrainElevation, WILDS_TERRAIN_TILE_SIZE } from "@/features/play/wilds-terrain-authority";
import { projectWildsRenderedLivingObstacles, wildsTerrainObstaclesForTile } from "@/features/play/wilds-terrain-obstacles";
import { projectWildsStructureSupports, wildsStructureSupportAt } from "@/features/play/wilds-structure-support";
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition } from "@/features/play/wilds-discovery-sites";
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY, writeWildsSiteRuntimeDiscovery, writeWildsSiteRuntimeEncounter, writeWildsSiteRuntimeLanding, writeWildsSiteRuntimeMovement } from "@/features/play/wilds-site-runtime";
import { mergeWildsMapDiscovery } from "@/features/play/wilds-map-image";
import { discoverWildsExplorationSite } from "@/features/play/wilds-exploration-atlas";
import { initialWildsHarvestedSourceState, projectWildsCreatureWorkFamilies, selectWildsTrailBridgeRotation } from "@/features/play/wilds-steward-construction";
import { projectWildsResourcePresentationAvailability as projectWildsResourceAvailability, projectWildsResourceRegion, wildsResourceRegionForPosition, type WildsResourceSource } from "@/features/play/wilds-resource-authority";
import { projectWildsInteractionSurfacePoint } from "@/features/play/wilds-surface-interaction";
import type { WildsActiveWorkSource } from "@/features/play/wilds-work-presentation";
import { selectCreationBedAtPlayer, restoredCreationBedFloor, creationBedWakeFloor } from './creation/bed';
import { saveWorldCreationProofImage } from './creation/world-image';
import { WildsBodyReadout } from './command-center/WildsBodyReadout';
import { WildsNourishmentPanel, type WildsNourishmentPlantProjection, type WildsWildAnimalProjection, type WildsOwnedLivestockProjection } from './WildsNourishmentPanel';
import { projectWildsNourishmentPlants, wildsNourishmentSourceAt, availableWildsFood, WILDS_NOURISHMENT_GATHER_REACH, WILDS_NOURISHMENT_VERTICAL_REACH, WILDS_NOURISHMENT_PACK_CAPACITY, type WildsFoodItem } from './wilds-nourishment';
import { WildsNourishmentActions } from './WildsNourishmentActions';
import { confirmWildsAnimalHunt, WILDS_HUNT_PRESENTATION_MS, type WildsAnimalHuntRequest, type WildsAnimalHuntPresentation } from './wilds-animal-interaction';
import { projectWildsWildAnimals, projectWildsOwnedLivestock, createWildsLivestockShelterSelector, selectWildsHuntingSupport, WILDS_ANIMAL_INTERACTION_REACH } from './wilds-livestock';
import { projectWildsWildAnimalPosition } from './wilds-animal-ecology';
import { projectWildsWorkCapabilityMeters, selectNearestWildsWorkSource, selectWildsResourceWorkPartner, type WildsVisibleWorkFamily } from "@/features/play/wilds-work-capability";
import { projectWildsCapabilityControls, projectWildsQuickCapabilityControls } from "@/features/play/wilds-world-capability-controls";
import { projectWildsCapabilityContext } from "@/features/play/wilds-world-capability-context";
import { WILDS_WORLD_CAPABILITY_REGISTRY, type WildsWorldCapabilityFamily } from "@/features/play/wilds-world-capability-registry";
import { applyWildsCapabilityCost } from "@/features/play/wilds-capability-runtime";
import { beginWildsCurrentRide } from "@/features/play/wilds-environment-capabilities";
import { constructionSourcesNear, projectWildsStewardCraft, projectWildsStewardPlacement, type WildsStewardBlueprintId, type WildsStewardPlacement } from "@/features/play/wilds-steward-craft";
import { WildsStewardPlacementHud } from "@/features/play/WildsStewardPlacementHud";
import { useWildsContinuousBuilder } from "./use-wilds-continuous-builder";
import { WildsContinuousBuilderPanel } from "./WildsContinuousBuilderPanel";
import type { WildsConstructionSiteV1 } from "@/features/play/wilds-construction-site";

const WildsInventory = dynamic(() => import("@/features/play/WildsInventory").then((mod) => mod.WildsInventory), { ssr: false });
const WildsDreamWorld = dynamic(() => import("./WildsDreamWorld"), { ssr: false });
const WildsCrewPanel = dynamic(() => import("./WildsCrewPanel").then((mod) => mod.WildsCrewPanel), { ssr: false });
const WildsCommandCenter = dynamic(() => import("@/features/play/command-center/WildsCommandCenter").then((mod) => mod.WildsCommandCenter), { ssr: false });
const WildsSagaPanel = dynamic(() => import("@/features/play/WildsSagaPanel").then((mod) => mod.WildsSagaPanel), { ssr: false });
const WildsStewardCraftPanel = dynamic(() => import("@/features/play/WildsStewardCraftPanel").then((mod) => mod.WildsStewardCraftPanel), { ssr: false });
const WildsJourneyPanel = dynamic(() => import("./WildsJourneyPanel").then((mod) => mod.WildsJourneyPanel), { ssr: false });
const WildsPlaytestPanel = dynamic(() => import("./WildsPlaytestPanel").then((mod) => mod.WildsPlaytestPanel), { ssr: false });
// Retain the prepared atlas while closed without rebuilding it on every walking
// update. Opening always receives the latest position, discovery and callbacks.
const WildsWorldMap = memo(dynamic(() => import("@/features/play/WildsWorldMap").then((mod) => mod.WildsWorldMap), { ssr: false }),
  (previous, next) => !previous.open && !next.open);
const WildsLandmarkExperience = dynamic(() => import("@/features/play/WildsLandmarkExperience").then((mod) => mod.WildsLandmarkExperience), { ssr: false });
const WildsSettlementExperience = dynamic(() => import("@/features/play/WildsSettlementExperience").then((mod) => mod.WildsSettlementExperience), { ssr: false });
const WildsEcologyExperience = dynamic(() => import("@/features/play/WildsEcologyExperience").then((mod) => mod.WildsEcologyExperience), { ssr: false });
const WildsRegenerativeGroveExperience = dynamic(() => import("@/features/play/WildsRegenerativeGroveExperience").then((mod) => mod.WildsRegenerativeGroveExperience), { ssr: false });
const WildsRaidExperience = dynamic(() => import("@/features/play/WildsRaidExperience").then((mod) => mod.WildsRaidExperience), { ssr: false });
const WildsTrainerEncounter = dynamic(() => import("@/features/play/WildsTrainerEncounter").then((mod) => mod.WildsTrainerEncounter), { ssr: false });
const GROVE_CREATURE_PROFESSIONS = ["build-hive", "build-nursery", "gather", "harvest-honey", "pollinate", "sow", "transform-nectar"] as const;

function groveConsequence(action: WildsGroveActionKind) {
  return ({
    observe: "You learn what this place needs without disturbing it.",
    gather: "Fallen fiber, pollen, and seeds enter your shared stores.",
    pollinate: "New flowers spread beyond this grove.",
    sow: "Young roots take hold and strengthen the soil.",
    water: "Moisture rises and young roots recover.",
    compost: "The soil deepens for everything growing here.",
    cultivate: "The grove matures under patient care.",
    "transform-nectar": "Nectar becomes nourishment that can be shared.",
    "harvest-honey": "Collect 1 Living Honey into Wallet Resources.",
    "build-hive": "A hive shelters future pollinators.",
    "build-nursery": "A nursery protects the next generation.",
    repair: "The grove's worn structures become sound again."
  } satisfies Record<WildsGroveActionKind, string>)[action];
}

function groveReason(reason: string | undefined) {
  return ({
    "grove-unobserved": "Listen to this place before changing it.",
    "creature-mandate-required": "A willing creature partner is needed here.",
    "creature-mandate-invalid": "Your companion needs rest or different work.",
    "pollen-required": "Gather pollen before carrying the bloom.",
    "seed-required": "Gather seeds before sowing.",
    "nectar-required": "More nectar is needed.",
    "fallen-fiber-required": "More fallen fiber would steady the frame.",
    "living-honey-unavailable": "The hive is not ready to share honey yet."
  } as Record<string, string>)[reason ?? ""] ?? "The grove is not ready for this yet.";
}
const MortalArenaExperience = dynamic(() => import("@/features/games/mortal-arena/MortalArenaExperience").then((mod) => mod.MortalArenaExperience), { ssr: false });
const EMPTY_WALLET_SOURCE_ROWS: readonly WildsWalletResourceProjectionRowV128[] = Object.freeze([]);
const EMPTY_CREATION_WORLD:Omit<CreationPhysicalSnapshot,'navigation'>&{navigation:null}=Object.freeze({revision:0,projections:[],navigation:null,instances:{},definitions:{}});
const subscribeEmptyCreation=()=>()=>{};
export function PlayCampaign({
  campaignName = "Reward Challenge",
  creationController: suppliedCreationController,
  creationLibrary,
  enabled,
  interactionEnabled = true,
  networkEnabled,
  walletAuthorityGeneration,
  walletAuthorization,
  walletIdentityKey,
  walletReadIdentityKey,
  walletPublicUsername,
  onComplete,
  ownerReceizId,
  character,
  playerDisplayName = "Wildz Explorer",
  onListAsset,
  onMarketServiceChange,
  shellOverlayOwner = "none",
  onOpenProfile = () => {},
  onOpenMarket = () => {},
  initialState = initialPlayState,
  initialPlayerContinuity = null,
  crewCustody: suppliedCrewCustody = null,
  initialWorld = null,
  onPlayStateChange,
  onWorldReady,
  onWorldInitialized,
  worldVisible = true,
  onPrepareCard,
  onExportCard,
  onExportVault,
  onPrepareVault,
  vaultAdmission,
  onRestoreArtifact,
  onRestoreRoamingCapture
}: {
  campaignName?: string;
  creationController?:CreationController;
  creationLibrary?:CreationObjectLibraryInput;
  enabled: boolean;
  interactionEnabled?: boolean;
  networkEnabled: boolean;
  walletAuthorityGeneration: string;
  walletAuthorization?: WildsWalletClientAuthorizationPort;
  walletIdentityKey: string;
  walletReadIdentityKey?: string;
  walletPublicUsername: string | null;
  onComplete?: (beans: number) => void;
  ownerReceizId: string;
  character: WildzCharacterGenesis;
  playerDisplayName?: string;
  onListAsset?: (asset: PortableCardAsset, priceCents: number) => Promise<PortableCardAsset | null>;
  onMarketServiceChange?: (service: WildzMarketServiceV128 | null) => void;
  shellOverlayOwner?: "none" | "profile" | "market";
  onOpenProfile?: (restoreOrigin: HTMLElement | null) => void;
  onOpenMarket?: (restoreOrigin: HTMLElement | null) => void;
  initialState?: PlayState;
  initialPlayerContinuity?: WildzPlayerContinuity | null;
  crewCustody?: WildzCrewCustody | null;
  initialWorld?: { projection: WildsWorldProjection; mode: "receiz_live" | "kai_live" } | null;
  onPlayStateChange: (state: PlayState, playerContinuity: WildzPlayerContinuity) => void;
  onWorldReady?: () => void;
  onWorldInitialized?: () => void;
  worldVisible?: boolean;
  onPrepareCard: (asset: PortableCardAsset, player: WildsPlayerVaultPayload) => Promise<WildzPreparedIdentityOwnedCard>;
  onExportCard: (asset: PortableCardAsset, player: (asset?: PortableCardAsset) => WildsPlayerVaultPayload, prepared?: WildzPreparedIdentityOwnedCard) => Promise<unknown>;
  onExportVault: () => Promise<unknown>;
  onPrepareVault?: () => Promise<unknown>;
  vaultAdmission: WildzVaultCardAdmission | null;
  onRestoreRoamingCapture: (file: File, currentCard: PortableCardAsset, currentPlayState: PlayState) => Promise<WildzCommittedArtifactRestore>;
  onRestoreArtifact: (
    file: File,
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState: PlayState
  ) => Promise<WildzCommittedArtifactRestore>;
}) {
  const creationRuntime=useRef<Omit<WorldCreationControllerInput,'project'>|null>(null);
  const creationCommitContext=useRef<CreationCompileContext|null>(null);
  const localCreation=useMemo(()=>{
    const worker=createCreationPhysicalWorkerClient();
    const controller=createWorldCreationController({
      environment:()=>creationRuntime.current?.environment()||{ownerId:ownerReceizId,worldId:'wilds:global:v3',spaceId:initialState.siteSpace.spaceId},
      world:()=>creationRuntime.current?.world()||null,
      crew:()=>creationRuntime.current?.crew()||{cards:[],conditions:{}},
      position:()=>creationRuntime.current?.position()||{x:0,y:0,z:0},
      compileContext:plan=>creationRuntime.current?.compileContext(plan)||null,
      admit:(command,fence)=>creationRuntime.current?creationRuntime.current.admit(command,fence):Promise.reject(Error('creation_world_not_ready')),
      project:worker.project
    });
    return {controller,worker,mounted:false};
    // The callbacks read the latest admitted source through creationRuntime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ownerReceizId]);
  const creationController=suppliedCreationController||localCreation.controller;
  useEffect(()=>{localCreation.mounted=true;return()=>{localCreation.mounted=false;queueMicrotask(()=>{if(!localCreation.mounted){localCreation.controller.close();localCreation.worker.close();}});};},[localCreation]);
  const creationPhysical=useSyncExternalStore(creationController?.subscribe||subscribeEmptyCreation,()=>creationController?.scope().ownerId===ownerReceizId?creationController.snapshot():EMPTY_CREATION_WORLD,()=>EMPTY_CREATION_WORLD);
  const [creationScene,setCreationScene]=useState<{source:typeof creationPhysical;navigation:CreationNavigation|null}|null>(null);
  const creationNavigation=creationScene?.source===creationPhysical?creationScene.navigation:null;
  const handleCreationNavigation=useCallback((navigation:CreationNavigation|null)=>setCreationScene({source:creationPhysical,navigation}),[creationPhysical]);
  const [creationOpen,setCreationOpen]=useState(false);
  const [creationPlacing,setCreationPlacing]=useState(false);
  const [creationPreview,setCreationPreview]=useState<CreationPreview|null>(null);
  const creationPoint=useRef<((pose:CreationCompileContext["pose"])=>void)|null>(null);
  const [creationContext,setCreationContext]=useState<CreationContextSeed|null>(null);
  const [state, setState] = useState(() => initialState);
  const [receivedCrewCustody, setReceivedCrewCustody] = useState<{keyId: string; owner: string; token: WildzCrewCustody} | null>(null);
  const crewCustody = useMemo(() => mergeWildzCrewCustody(ownerReceizId,
    [suppliedCrewCustody, receivedCrewCustody && receivedCrewCustody.keyId === walletReadIdentityKey && receivedCrewCustody.owner === ownerReceizId ? receivedCrewCustody.token : null], state.inventory),
  [ownerReceizId, suppliedCrewCustody, receivedCrewCustody, walletReadIdentityKey, state.inventory]);
  const crewPreferences = useMemo(() => sanitizeWildsCrewPreferences(state.crewPreferences, state.inventory, ownerReceizId, crewCustody), [state.crewPreferences, state.inventory, ownerReceizId, crewCustody]);
  const admittedSourceStateRef = useRef(initialState);
  const [sourceAdmission] = useState(createWildsPlayStateSourceAdmission);
  const [saveRestored, setSaveRestored] = useState(false);
  const onPlayStateChangeRef = useRef(onPlayStateChange);
  const playStatePublisherRef = useRef<WildzGameplayPublisher<{
    state: PlayState;
    continuity: WildzPlayerContinuity;
    onChange: typeof onPlayStateChange;
  }> | null>(null);
  const scheduledSourceStateRef = useRef(initialState);
  onPlayStateChangeRef.current = onPlayStateChange;
  if (!playStatePublisherRef.current) {
    playStatePublisherRef.current = createWildzGameplayPublisher({
      cadenceMs: 140,
      publish: ({ state: nextState, continuity, onChange }) => {
        sourceAdmission.published(nextState);
        onChange(nextState, continuity);
      }
    });
  }

  useEffect(() => {
    if (admittedSourceStateRef.current === initialState) return;
    admittedSourceStateRef.current = initialState;
    // A delayed acknowledgment of our publication must not rewind newer input.
    if (!sourceAdmission.shouldAdopt(initialState)) return;
    // The shell has already reconciled this state against the active Receiz ID.
    // Adopt that source directly so another authenticated browser can advance
    // live gameplay without remounting Canvas or replaying local input.
    setState(current => admitWildsForwardPosition(initialState, current));
  }, [initialState, sourceAdmission]);
  const [memorialAssetId, setMemorialAssetId] = useState<string | null>(null);
  const gameplaySurfaceRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const surface = gameplaySurfaceRef.current;
    if (!surface) return;
    const isEditable = (target: EventTarget | null) => target instanceof Element
      && Boolean(target.closest("input, textarea, [contenteditable='true'], [data-native-selection='true']"));
    const blockNativeCallout = (event: Event) => {
      if (!isEditable(event.target)) event.preventDefault();
    };
    const clearAccidentalSelection = (event: PointerEvent) => {
      if (isEditable(event.target)) return;
      const selection = window.getSelection();
      if (selection?.rangeCount) selection.removeAllRanges();
    };
    surface.addEventListener("selectstart", blockNativeCallout);
    surface.addEventListener("contextmenu", blockNativeCallout);
    surface.addEventListener("dragstart", blockNativeCallout);
    surface.addEventListener("pointerdown", clearAccidentalSelection, { passive: true });
    return () => {
      surface.removeEventListener("selectstart", blockNativeCallout);
      surface.removeEventListener("contextmenu", blockNativeCallout);
      surface.removeEventListener("dragstart", blockNativeCallout);
      surface.removeEventListener("pointerdown", clearAccidentalSelection);
    };
  }, []);
  useEffect(() => {
    const serialized = Object.keys(window.localStorage)
      .filter((key) => key.startsWith(ARENA_SETTLEMENT_JOURNAL_PREFIX))
      .sort()
      .slice(-128)
      .map((key) => window.localStorage.getItem(key))
      .filter((value): value is string => value !== null);
    if (!serialized.length) return;
    setState((current) => serialized.reduce((next, entry) => {
      const settlement = recoverArenaSettlementJournalEntry(entry);
      if (!settlement) return next;
      try {
        return applyCommittedArenaSettlement(next, settlement);
      } catch {
        return next;
      }
    }, current));
  }, []);
  const physicalCrewTrips = useRef<WildsCrewActiveTrips>(new Map());
  const settleLivingCreatures = useCallback(() => setState((current) => {
      const at = new Date().toISOString();
      const hidden = document.visibilityState === "hidden";
      const travelSettled = settleWildsCrewPendingGrowth(current, ownerReceizId, physicalCrewTrips.current, hidden ? Infinity : 1);
      const passiveCards = travelSettled.inventory.filter(asset => !isWildsCrewPhysicallyActive(asset, ownerReceizId, physicalCrewTrips.current));
      // A timer for one due companion must not replay the entire restored crew
      // on a movement frame. The next inventory commit schedules the next due
      // companion; hidden-page settlement can still drain the whole collection.
      const dueCards = hidden ? passiveCards : passiveCards.filter(asset => {
        const dueAt = nextCreatureContinuityDueAt(asset);
        return dueAt !== null && dueAt <= Date.parse(at);
      }).slice(0, 1);
      return dueCards.reduce((next, asset) => applyWildsInput(next, {
        type: "settle-creature-continuity",
        assetId: asset.id,
        ownerReceizId,
        at
      }), dueCards.reduce((next, asset) => applyWildsInput(next, {
        type: "settle-creature-care",
        assetId: asset.id,
        ownerReceizId,
        at
      }), travelSettled));
    }), [ownerReceizId]);
  useEffect(() => {
    const settleWhenHidden = () => {
      if (shouldRunWildzOffHotPathWork({ visibility: document.visibilityState, surface: "gameplay" })) {
        settleLivingCreatures();
      }
    };
    document.addEventListener("visibilitychange", settleWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", settleWhenHidden);
    };
  }, [settleLivingCreatures]);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    let cancelled = false;
    const publishCareSchedule = async () => {
      if (Notification.permission !== "granted") return;
      const at = new Date().toISOString();
      const entries = creatureCareNotificationSchedule(state.inventory, at);
      try {
        const registration = await navigator.serviceWorker.ready;
        if (cancelled) return;
        (registration.active ?? navigator.serviceWorker.controller)?.postMessage({
          type: WILDZ_CARE_SCHEDULE_MESSAGE,
          entries
        });
        const periodicSync = (registration as ServiceWorkerRegistration & {
          periodicSync?: { register(tag: string, options: { minInterval: number }): Promise<void> };
        }).periodicSync;
        if (periodicSync) await periodicSync.register(WILDZ_CARE_PERIODIC_TAG, { minInterval: 15 * 60_000 });
      } catch {
        // Notification scheduling is advisory and never blocks proof state or gameplay.
      }
    };
    const refreshWhenHidden = () => {
      if (shouldRunWildzOffHotPathWork({ visibility: document.visibilityState, surface: "gameplay" })) {
        void publishCareSchedule();
      }
    };
    refreshWhenHidden();
    document.addEventListener("visibilitychange", refreshWhenHidden);
    window.addEventListener(WILDZ_CARE_NOTIFICATIONS_READY, refreshWhenHidden);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", refreshWhenHidden);
      window.removeEventListener(WILDZ_CARE_NOTIFICATIONS_READY, refreshWhenHidden);
    };
  }, [state.inventory]);
  const explorerStyle = character.gender;
  const { profile: qualityProfile, reportFrameSample, reducedMotion } = useWildsQualityProfile();
  const [mapOpen, setMapOpen] = useState(false);
  const [trackedDestination, setTrackedDestination] = useState<{ label: string; x: number; z: number; resourceKind?: "hay" } | null>(null);
  const [mapVisited, setMapVisited] = useState(false);
  const [roamingDialogOpen, setRoamingDialogOpen] = useState(false);
  const [roamingAuthorizationPending, setRoamingAuthorizationPending] = useState(false);
  const [multiplayerRosterOpen, setMultiplayerRosterOpen] = useState(false);
  const walletPlayStateSeed = useMemo(() => projectWildsWalletPlayStateSeed({
    ascensionCatalysts: state.ascensionCatalysts,
    beans: state.beans,
    fusionSparks: state.fusionSparks,
    inventory: state.inventory,
    playerNourishment: state.playerNourishment
  }), [
    state.ascensionCatalysts,
    state.beans,
    state.fusionSparks,
    state.inventory,
    state.playerNourishment
  ]);
  const walletPlayStateSeedRef = useRef(walletPlayStateSeed);
  walletPlayStateSeedRef.current = walletPlayStateSeed;
  const walletReadAuthorization = useMemo(() => walletReadIdentityKey
    ? {
      authorize: () => authorizeWildsWalletReadWithIdentity(walletReadIdentityKey),
      projectSource: async () => {
        const source = await projectWildsWalletSourceAuthority(walletReadIdentityKey);
        return source ? seedWildsWalletFromPlayState(source, walletPlayStateSeedRef.current) : null;
      }
    }
    : undefined, [walletReadIdentityKey]);
  const walletTransferAuthorization = useMemo(() => walletAuthorization ?? (walletReadIdentityKey
    ? { authorize: (input: Parameters<WildsWalletClientAuthorizationPort["authorize"]>[0]) => authorizeWildsWalletTransferWithIdentity(walletReadIdentityKey, input) }
    : undefined), [walletAuthorization, walletReadIdentityKey]);
  const livingWorldAuthorization = useMemo(() => walletReadIdentityKey
    ? (authorization: Parameters<typeof authorizeWildsLivingWorldOperationWithIdentity>[1]) =>
        authorizeWildsLivingWorldOperationWithIdentity(walletReadIdentityKey, authorization)
    : undefined, [walletReadIdentityKey]);
  const walletController = useWildsWalletController(walletIdentityKey, walletAuthorityGeneration, {
    backgroundReady: worldVisible,
    sourceKey: walletReadIdentityKey ?? undefined,
    authorization: walletTransferAuthorization,
    readAuthorization: walletReadAuthorization
  });
  const { cancelForExclusiveOwner: cancelWalletForExclusiveOwner } = walletController;
  const cameraHeadingRef = useRef(0);
  const playerFacingRef = useRef(0);
  const updateCameraHeading = useCallback((heading: number) => {
    cameraHeadingRef.current = heading;
  }, []);
  const [playerHeading, setPlayerHeading] = useState(0);
  const [dreamTrial, setDreamTrial] = useState<WildsDreamTrial | null>(null);
  useEffect(() => { setDreamTrial(null); }, [ownerReceizId, state.siteSpace.spaceId]);
  useEffect(() => {
    if (!["bed", "sleep"].includes(state.playerBreaths?.mode ?? "")) setDreamTrial(null);
  }, [state.playerBreaths?.mode]);
  const previousPlayerPosition = useRef(state.player);
  const [movementMode, setMovementMode] = useState<WildsMovementMode>(() => initialPlayerContinuity?.settings.movementMode ?? "walk");
  const [cardOrder, setCardOrder] = useState<WildzCardOrder>(() => initialPlayerContinuity?.settings.cardOrder ?? "rarity");
  const { memories: journeyMemories, remember: rememberJourney, journal: journeyJournal, ready: journeyReady } = useWildsJourney(ownerReceizId, state.journeyJournal);
  useEffect(() => {
    if (!journeyReady) return;
    setState(current => JSON.stringify(current.journeyJournal) === JSON.stringify(journeyJournal) ? current : { ...current, journeyJournal });
  }, [journeyJournal, journeyReady]);
  const playtest = useWildsPlaytest();
  const markPlaytest = playtest.mark;
  const [visualSettings, setVisualSettings] = useState<WildsVisualSettings>(() => normalizeWildsVisualSettings(initialPlayerContinuity?.settings.visual));
  const [activeLandmarkId, setActiveLandmarkId] = useState<WildsLandmarkId | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<WildsSettlementDistrictId>("trail-gate");
  const [activeEcologySiteId, setActiveEcologySiteId] = useState<string | null>(null);
  const [activeGroveId, setActiveGroveId] = useState<string | null>(null);
  const [groveBusyAction, setGroveBusyAction] = useState<WildsGroveActionKind | null>(null);
  const [groveCollectedHoney, setGroveCollectedHoney] = useState(false);
  const [activeRaid, setActiveRaid] = useState<{ bossId: string; roundId: string; placement: "fighter" | "support"; connected: boolean } | null>(null);
  const [raidReturnPosition, setRaidReturnPosition] = useState<{ x: number; z: number } | null>(null);
  const [raidError, setRaidError] = useState<string | null>(null);
  const [raidBusyIntent, setRaidBusyIntent] = useState<WildsRaidIntent["type"] | null>(null);
  const [riftError, setRiftError] = useState("");
  const [worldFeedbackRevision, setWorldFeedbackRevision] = useState(0);
  const worldFeedbackTimerRef = useRef<number | null>(null);
  const beginWorldActionFeedback = useCallback(() => {
    if (worldFeedbackTimerRef.current !== null) window.clearTimeout(worldFeedbackTimerRef.current);
    worldFeedbackTimerRef.current = null;
    setRiftError("");
    setWorldFeedbackRevision((revision) => revision + 1);
  }, []);
  const showWorldFeedback = useCallback((message: string, persistent = false) => {
    if (worldFeedbackTimerRef.current !== null) window.clearTimeout(worldFeedbackTimerRef.current);
    setRiftError(message);
    setWorldFeedbackRevision((revision) => revision + 1);
    worldFeedbackTimerRef.current = null;
    if (persistent) return;
    worldFeedbackTimerRef.current = window.setTimeout(() => {
      setRiftError("");
      worldFeedbackTimerRef.current = null;
    }, 4_800);
  }, []);
  useEffect(() => () => {
    if (worldFeedbackTimerRef.current !== null) window.clearTimeout(worldFeedbackTimerRef.current);
  }, []);
  const [constructionFocus, setConstructionFocus] = useState<"tools" | "storage" | null>(null);
  const [stewardPlacementMode, setStewardPlacementMode] = useState<WildsStewardBlueprintId | null>(null);
  const [stewardPlacementPreview, setStewardPlacementPreview] = useState<WildsStewardPlacement | null>(null);
  const [requestedCommand, setRequestedCommand] = useState<WildsCommandKey | null>(null);
  useEffect(() => { if (requestedCommand) markPlaytest("panel", "success"); }, [requestedCommand, markPlaytest]);
  const [vaultFocusedAssetId, setVaultFocusedAssetId] = useState<string | null>(null);
  const [commandDismissSignal, setCommandDismissSignal] = useState(0);
  const [activeTrainer, setActiveTrainer] = useState<WildsTrainerProjection | null>(null);
  const [trainerEncounter, setTrainerEncounter] = useState<TrainerEncounterState | null>(null);
  const [kaiUPulse, setKaiUPulse] = useState(0);
  const [inspectedNourishmentId, setInspectedNourishmentId] = useState<string | null>(null);
  const [nourishmentActionId, setNourishmentActionId] = useState<string | null>(null);
  const pendingHunt = useRef<WildsAnimalHuntRequest | null>(null);
  const [huntPresentation, setHuntPresentation] = useState<WildsAnimalHuntPresentation | null>(null);
  const [storedFoodFocusSignal, setStoredFoodFocusSignal] = useState(0);
  const kaiRuntimeClockRef = useRef<ReturnType<typeof createWildsKaiRuntimeClock> | null>(null);
  const readActionKaiUPulse=useCallback(()=>kaiRuntimeClockRef.current?.read(performance.now(),observeWildsKaiUPulse())??observeWildsKaiUPulse(),[]);
  const worldProgression = projectWorldProgression(state.worldMastery);
  const activeCard = selectedCard(state);
  const activeAsset = selectedAsset(state);
  const homeCompanions = useMemo(() => playableInventory({inventory:state.inventory,adventureConditions:state.adventureConditions}), [state.inventory, state.adventureConditions]);
  const crewCards = useMemo(() => homeCompanions.filter(card => canOperateWildzCrewCard(card, ownerReceizId, crewCustody)), [homeCompanions, ownerReceizId, crewCustody]);
  const journeyStructures = useMemo(() => Object.values(state.ownedWorldAdditions.structures).filter(item => sameWildzPlayerCoordinate(item.ownerReceizId, ownerReceizId)), [state.ownedWorldAdditions.structures, ownerReceizId]);
  const journeyShelters = useMemo(() => journeyStructures.filter(item => item.blueprint === "trail-shelter"), [journeyStructures]);
  const journeyHome = useMemo(() => [...journeyShelters].sort((a, b) => Math.hypot(a.position.x-state.player.x,a.position.z-state.player.z)-Math.hypot(b.position.x-state.player.x,b.position.z-state.player.z))[0], [journeyShelters, state.player.x, state.player.z]);
  const homeResidents = useMemo(() => journeyHome ? { shelterPosition: journeyHome.position, cards: homeCompanions } : undefined, [journeyHome, homeCompanions]);
  const homeCompanionResidents = useMemo(() => homeCompanions.map(asset => ({ id: asset.id, name: asset.manifest.name })), [homeCompanions]);
  const homeLife = useMemo(() => projectWildsHomeLife({ structures: journeyStructures, preferredHomeId: journeyHome?.structureId, companions: homeCompanionResidents, activeCompanionId: activeAsset?.id, now: Date.parse(kaiUPulseToISOString(kaiUPulse)) }), [journeyStructures, journeyHome?.structureId, homeCompanionResidents, activeAsset?.id, kaiUPulse]);
  const unfinishedJourneyShelter = useMemo(() => Object.values(state.ownedWorldAdditions.constructionSites).find(site => site.blueprint === "trail-shelter" && site.stage !== "complete" && sameWildzPlayerCoordinate(site.placedByReceizId, ownerReceizId)), [state.ownedWorldAdditions.constructionSites, ownerReceizId]);
  const civic = useMemo(() => projectWildsCivicHistory(state.civicEvents), [state.civicEvents]);

  const [activeWorldCapability, setActiveWorldCapability] = useState<WildsWorldCapabilityFamily | null>(null);
  useEffect(() => setActiveWorldCapability(null), [activeAsset?.id]);
  const activeCapabilityControls = useMemo(() => activeAsset
    ? projectWildsCapabilityControls(activeAsset, state.adventureConditions[activeAsset.id] ?? emptyAdventureCondition(activeAsset.id))
    : [], [activeAsset, state.adventureConditions]);
  const activeCapabilityContexts = useMemo(() => projectWildsCapabilityContext(Object.freeze({
    controls: activeCapabilityControls,
    candidates: Object.freeze([]),
    activeFamilies: Object.freeze(activeWorldCapability ? [activeWorldCapability] : [])
  })), [activeCapabilityControls, activeWorldCapability]);
  const activeTraversalCapabilities = useMemo(() => activeAsset
    ? projectWildsTraversalCapabilities(
      activeAsset,
      state.adventureConditions[activeAsset.id] ?? emptyAdventureCondition(activeAsset.id)
    ).capabilities
    : [], [activeAsset, state.adventureConditions]);
  const quickCapabilityControls = useMemo(() => projectWildsQuickCapabilityControls(activeCapabilityControls), [activeCapabilityControls]);
  const traversalPotentials = useMemo(() => {
    if (!activeAsset) return { flightEndurance: 0, lift: 0, pressure: 0 };
    const identity = projectCreatureCapabilityIdentity(activeAsset);
    const specialties = identity.specialties;
    const runtime = projectCreatureRuntimeCapabilities(
      identity,
      state.adventureConditions[activeAsset.id] ?? emptyAdventureCondition(activeAsset.id)
    );
    const potential = (families: readonly string[]) => {
      const specialty = specialties.find((candidate) => families.includes(candidate.family));
      if (!specialty) return .45;
      return Math.max(.2, Math.min(1, (specialty.potential + specialty.control + specialty.endurance) / 300));
    };
    return {
      flightEndurance: activeTraversalCapabilities.includes("flight") ? projectWildsFlightEndurancePotential(runtime.level) : 0,
      lift: activeTraversalCapabilities.includes("flight") ? potential(["flight", "glide", "balance"]) : activeTraversalCapabilities.includes("glide") ? potential(["glide", "balance"]) * .6 : 0,
      pressure: activeTraversalCapabilities.includes("swim") ? potential(["dive", "current", "swim", "anchor"]) : 0
    };
  }, [activeAsset, activeTraversalCapabilities, state.adventureConditions]);
  const canSwim = activeTraversalCapabilities.includes("swim");
  const [activeVistaId, setActiveVistaId] = useState<string | null>(null);
  const [monumentLightState,setMonumentLightState]=useState<Readonly<{id:string;lights:readonly number[];aligned:boolean}>|null>(null);
  const deckCards = state.inventory;
  const priorVaultIdsRef = useRef<Set<string> | null>(null);
  if (!priorVaultIdsRef.current) priorVaultIdsRef.current = new Set(state.inventory.map((asset) => asset.id));
  const [newRosterAssetId, setNewRosterAssetId] = useState<string | null>(null);
  const [initialVaultAdmission] = useState<WildzVaultCardAdmission>(() => vaultAdmission ?? deriveWildzVaultCardAdmission({
    cards: initialState.inventory,
    playerHandle: ownerReceizId
  }));
  const currentVaultAdmission = vaultAdmission ?? initialVaultAdmission;
  useEffect(() => {
    const prior = priorVaultIdsRef.current!;
    const added = state.inventory.filter((asset) => !prior.has(asset.id));
    priorVaultIdsRef.current = new Set(state.inventory.map((asset) => asset.id));
    if (!added.length) return;
    const newest = [...added].sort((left, right) =>
      Date.parse(right.manifest.capturedAt) - Date.parse(left.manifest.capturedAt)
    )[0];
    setNewRosterAssetId(newest?.id ?? null);
  }, [state.inventory]);
  useEffect(() => {
    if (!newRosterAssetId) return;
    const timeout = window.setTimeout(() => {
      setNewRosterAssetId((current) => current === newRosterAssetId ? null : current);
    }, 6_000);
    return () => window.clearTimeout(timeout);
  }, [newRosterAssetId]);
  const landmarkUnlocks = state.achievements;
  const activeProgress = activeAsset ? exactCompanionProgress(state, activeAsset) : { level: 1, xp: 0, bond: 0 };
  const { discoveredByFamily, discoveredKaiLineages, guideFamilies } = useMemo(() => {
    const byFamily = new Map(deckCards.map((card) => [card.manifest.familyId, card]));
    const lineages = new Set(deckCards.map((card) => card.manifest.variant.generatorVersion === 2
      ? card.manifest.variant.traits.birthProfile.species.lineageKey
      : `legacy:${card.manifest.familyId}`));
    return {
      discoveredByFamily: byFamily,
      discoveredKaiLineages: lineages,
      guideFamilies: [...creatureFamilies].sort((left, right) =>
        Number(byFamily.has(right.id)) - Number(byFamily.has(left.id)) || left.name.localeCompare(right.name))
    };
  }, [deckCards]);
  const nextHabitat = guideFamilies.find((family) => !discoveredByFamily.has(family.id))?.habitat ?? "the living frontier";
  const visibleGuideFamilies = guideFamilies.slice(0, 24);
  const hudModel = projectWildzHud(state, { username: ownerReceizId, displayName: playerDisplayName },kaiUPulse);
  const cardAdmission = useMemo<WildzVaultCardMembershipProof | null>(() => {
    if (!activeAsset) return null;
    try {
      return createWildzVaultCardMembershipProof(currentVaultAdmission, activeAsset);
    } catch {
      return null;
    }
  }, [activeAsset, currentVaultAdmission]);
  const creationCardAdmissions=useMemo(()=>creationOpen?Object.fromEntries(crewCards.map(card=>{try{return [card.id,createWildzVaultCardMembershipProof(currentVaultAdmission,card)];}catch{return [card.id,null];}})):{},[creationOpen,crewCards,currentVaultAdmission]);
  const roamingPresenceReader = useRef<() => readonly WildsRoamingPresenceUpload[]>(() => []);
  const multiplayer = useWildsMultiplayer({
    // Global presence is available to every internet-connected explorer.
    // networkEnabled still protects canonical world writes, but must not turn
    // unauthenticated live players into an isolated local session.
    enabled: enabled && Boolean(activeAsset),
    surfaceOpen: multiplayerRosterOpen,
    style: explorerStyle,
    position: state.player,
    activeCard: activeAsset,
    cardAdmission,
    readRoamingCreatures: () => roamingPresenceReader.current()
  });
  const messengerSelfHandle = multiplayer.snapshot?.players.find((entry) => entry.playerId === multiplayer.selfId)?.handle
    ?? multiplayer.selfId.replace(/^guest:/, "Explorer ").slice(0, 80)
    ?? "Explorer";
  const messenger = useWildsMessenger({
    guestId: multiplayer.guestId,
    selfId: multiplayer.selfId,
    selfHandle: messengerSelfHandle,
    livePeers: multiplayer.remotePlayers.filter((entry) => !entry.practice).map((entry) => ({ id: entry.playerId, handle: entry.handle }))
  });
  const walletTradeInbox = useMemo(() => walletPublicUsername
    ? projectWildsWalletTradeInbox(messenger.conversations, walletPublicUsername) : [], [messenger.conversations, walletPublicUsername]);
  const proposeWalletTrade = useCallback<WildsWalletProposeTrade>(async (draft, inReplyTo) => {
    try {
      const tradeId = await messenger.sendTradePackage({kind: "trade-package", stage: inReplyTo ? "counteroffer" : "offer", draft,
        ...(inReplyTo ? {inReplyTo} : {})});
      return {status: "offered", tradeId, message: "Offer delivered. Your assets remain yours until both people approve the final exchange."};
    } catch {return {status: "pending", message: "Checking this same offer. Reopen Trade to recover its delivery."};}
  }, [messenger]);
  const [walletMessagePeer, setWalletMessagePeer] = useState<{ id: string; handle: string } | null>(null);
  const recordedPhiTransfersRef = useRef(new Set<string>());
  useEffect(() => {
    const transfer = walletController.transfer;
    if (!walletMessagePeer || transfer.phase !== "committed" || !transfer.attempt || !transfer.amountPhiMicro) return;
    const transferReference = `phi-transfer:${sha256PortableBasis(transfer.attempt).replace(/^sha256:/, "")}`;
    if (recordedPhiTransfersRef.current.has(transferReference)) return;
    recordedPhiTransfersRef.current.add(transferReference);
    void messenger.recordPhiTransfer(walletMessagePeer, transfer.amountPhiMicro, transferReference)
      .catch(() => { recordedPhiTransfersRef.current.delete(transferReference); });
  }, [messenger, walletController.transfer, walletMessagePeer]);
  useEffect(() => {
    const transfers = messenger.conversations.flatMap((conversation) => conversation.messages)
      .map((message) => message.context)
      .filter((context) => context?.kind === "card-transfer");
    if (!transfers.length) return;
    setState((current) => {
      for (const transfer of transfers) {
        if (transfer?.kind !== "card-transfer") continue;
        if (sameWildzPlayerCoordinate(transfer.targetHandle, ownerReceizId)
          && !current.inventory.some((asset) => asset.id === transfer.card.id)) {
          return applyWildsInput(current, { type: "import-card", asset: transfer.card });
        }
        if (sameWildzPlayerCoordinate(transfer.sourceHandle, ownerReceizId)
          && current.inventory.some((asset) => asset.id === transfer.card.id)) {
          return applyWildsInput(current, { type: "transfer-card-out", assetId: transfer.card.id });
        }
      }
      return current;
    });
  }, [messenger.conversations, ownerReceizId]);
  const captureRewardAssetId = state.encounter.phase === "revealed" ? state.encounter.assetId : null;
  const captureRewardAsset = captureRewardAssetId
    ? state.inventory.find((candidate) => candidate.id === captureRewardAssetId) ?? null
    : null;
  useEffect(() => {
    if (!captureRewardAsset || state.encounter.phase !== "revealed" || !sameWildzPlayerCoordinate(state.encounter.ownerReceizId, ownerReceizId)) return;
    rememberJourney({ kind: "met", subjectId: captureRewardAsset.id, companionId: captureRewardAsset.id, companionName: captureRewardAsset.manifest.name, label: "Joined your trail", position: state.encounter.placement ? { x: state.encounter.placement.x, z: state.encounter.placement.z } : state.encounter.searchPoint });
  }, [captureRewardAsset, state.encounter, rememberJourney, ownerReceizId]);
  const combatSurface = projectPlayCombatSurface({
    trainer: Boolean(activeTrainer && activeAsset && trainerEncounter?.phase === "combat"),
    wild: isWildBattleModalOwner(state.encounter.phase, Boolean(state.battle)),
    pvp: Boolean(multiplayer.activeBattle)
  });
  const modalOwner = projectPlayShellOwner({
    dream: dreamTrial !== null,
    combat: combatSurface !== null || roamingDialogOpen,
    trainer: Boolean(activeTrainer && activeAsset && trainerEncounter && ["challenge", "transition", "result"].includes(trainerEncounter.phase)),
    memorial: memorialAssetId !== null,
    reward: isCaptureRewardModalOwner(state.encounter.phase, Boolean(captureRewardAsset)),
    ceremony: Boolean(state.transformation || state.lineageReveal),
    raid: Boolean(activeRaid),
    ecology: Boolean(activeEcologySiteId || activeGroveId),
    settlement: activeLandmarkId === "wayfinder-hollow",
    landmark: activeLandmarkId !== null && activeLandmarkId !== "wayfinder-hollow",
    map: mapOpen,
    profile: shellOverlayOwner === "profile",
    market: shellOverlayOwner === "market",
    wallet: walletController.open,
    multiplayer: Boolean(multiplayer.incomingChallenge),
    command: false
  });
  useEffect(() => {
    cancelWalletForExclusiveOwner(modalOwner);
  }, [cancelWalletForExclusiveOwner, modalOwner]);
  const {
    state: worldOverlayState,
    dispatch: dispatchWorldOverlay,
    gestureCancelSignal,
    panelOwnershipRef,
    exclusiveOriginRef,
    claimExclusiveOwner
  } = useWorldOverlayDirector({ dismissSignal: commandDismissSignal, exclusiveOwner: modalOwner });
  const closeCreation=useCallback(()=>{setCreationOpen(false);setCreationPlacing(false);setCreationPreview(null);},[]);
  const manualCreationAction=useRef(()=>{});
  const openManualFromCreation=useCallback(()=>{setCreationOpen(false);setCreationPlacing(false);setCreationPreview(null);manualCreationAction.current();},[]);
  useEffect(()=>{setCreationOpen(false);setCreationPlacing(false);setCreationPreview(null);},[ownerReceizId,state.siteSpace.spaceId]);
  useEffect(()=>{if(modalOwner!=="none"){setCreationOpen(false);setCreationPlacing(false);setCreationPreview(null);}},[modalOwner]);
  const commandPanelOpen = modalOwner === "none" && worldOverlayState.panelKey !== null;
  useEffect(() => {
    if (worldOverlayState.panelKey !== 'satchel') setStoredFoodFocusSignal(0);
  }, [worldOverlayState.panelKey]);
  const exclusiveOwner = commandPanelOpen ? "command" : modalOwner;
  useEffect(() => {
    if (exclusiveOwner === "none") return;
    setStewardPlacementMode(null);
    setStewardPlacementPreview(null);
  }, [exclusiveOwner]);
  useEffect(() => {
    setStewardPlacementMode(null);
    setStewardPlacementPreview(null);
  }, [activeAsset?.id]);
  const modalAdmissionRef = useRef(createModalAdmissionState(exclusiveOwner));
  if (modalAdmissionRef.current.owner !== exclusiveOwner) {
    modalAdmissionRef.current = claimModalAdmissionOwner(modalAdmissionRef.current, exclusiveOwner);
  }
  const clearIncompatibleModalState = useCallback((owner: typeof exclusiveOwner) => {
    if (owner !== "dream") setDreamTrial(null);
    if (owner !== "map") setMapOpen(false);
    if (owner !== "landmark" && owner !== "settlement") setActiveLandmarkId(null);
    if (owner !== "ecology") {
      setActiveEcologySiteId(null);
      setActiveGroveId(null);
      setGroveBusyAction(null);
    }
    if (owner !== "raid") {
      setActiveRaid(null);
      setRaidBusyIntent(null);
    }
    if (owner !== "trainer" && owner !== "combat") {
      setActiveTrainer(null);
      setTrainerEncounter(null);
    }
    if (owner !== "memorial") setMemorialAssetId(null);
    setMultiplayerRosterOpen(false);
  }, []);
  const claimPlayModalOwner = useCallback((
    owner: Exclude<typeof exclusiveOwner, "none" | "command">,
    restoreOrigin?: HTMLElement | null
  ) => {
    modalAdmissionRef.current = claimModalAdmissionOwner(modalAdmissionRef.current, owner);
    clearIncompatibleModalState(owner);
    claimExclusiveOwner(owner, restoreOrigin);
  }, [claimExclusiveOwner, clearIncompatibleModalState]);
  const beginPlayModalAdmission = useCallback(() => beginModalAdmission(modalAdmissionRef.current), []);
  const commitPlayModalAdmission = useCallback((token: ModalAdmissionToken | null, owner: Exclude<typeof exclusiveOwner, "none" | "command">) => {
    if (!canCommitModalAdmission(modalAdmissionRef.current, token)) return false;
    claimPlayModalOwner(owner);
    return true;
  }, [claimPlayModalOwner]);
  const releasePlayModalOwner = useCallback((owner: typeof exclusiveOwner) => {
    modalAdmissionRef.current = releaseModalAdmissionOwner(modalAdmissionRef.current, owner);
  }, []);
  useEffect(() => {
    if (exclusiveOwner === "none" || exclusiveOwner === "command") return;
    clearIncompatibleModalState(exclusiveOwner);
  }, [clearIncompatibleModalState, exclusiveOwner]);
  const worldInteractionEnabled = canAcceptPlayShellInput(interactionEnabled, modalOwner, commandPanelOpen);
  const backgroundHomesBlocked = !isPlayHomeAvailable(exclusiveOwner, "status");
  const referenceHomeBlocked = !isPlayHomeAvailable(exclusiveOwner, "reference");
  const canUseWorldStage = useCallback(
    () => worldInteractionEnabled && !panelOwnershipRef.current,
    [panelOwnershipRef, worldInteractionEnabled]
  );
  const dispatchStageOverlay = useCallback((event: Parameters<typeof dispatchWorldOverlay>[0]) => {
    if (event.type === "panel" && event.key !== null) {
      setMultiplayerRosterOpen(false);
    }
    dispatchWorldOverlay(event);
  }, [dispatchWorldOverlay]);
  const handleMultiplayerRosterOpenChange = useCallback((open: boolean) => {
    setMultiplayerRosterOpen(open);
  }, []);
  const priorExclusiveOwner = useRef(exclusiveOwner);
  useEffect(() => {
    const priorOwner = priorExclusiveOwner.current;
    priorExclusiveOwner.current = exclusiveOwner;
    if (exclusiveOwner === "combat" && priorOwner !== "combat") {
      setCommandDismissSignal((signal) => signal + 1);
    }
    if ((exclusiveOwner === "combat" || exclusiveOwner === "trainer") && mapOpen) {
      setMapOpen(false);
    }
  }, [exclusiveOwner, mapOpen]);
  const incomingChallengeId = multiplayer.incomingChallenge?.id ?? null;
  const answerMultiplayerChallenge = multiplayer.answerChallenge;
  const closeOwnedModal = useCallback((owner: typeof modalOwner) => {
    if (owner === "wallet" && !canCloseWildsWalletTerminal(walletController)) return;
    releasePlayModalOwner(owner);
    if (owner === "trainer") {
      setActiveTrainer(null);
      setTrainerEncounter(null);
    } else if (owner === "map") {
      setMapOpen(false);
    } else if (owner === "landmark" || owner === "settlement") {
      setActiveLandmarkId(null);
    } else if (owner === "ecology") {
      setActiveEcologySiteId(null);
      setActiveGroveId(null);
      setGroveBusyAction(null);
    } else if (owner === "raid") {
      setActiveRaid(null);
    } else if (owner === "reward") {
      setState((current) => applyWildsInput(current, { type: "dismiss-reveal" }));
    } else if (owner === "ceremony") {
      setState((current) => current.transformation
        ? applyWildsInput(current, { type: "finish-transformation" })
        : applyWildsInput(current, { type: "finish-lineage-reveal" }));
    } else if (owner === "memorial") {
      setMemorialAssetId(null);
    } else if (owner === "wallet") {
      walletController.closeTerminal();
    } else if (owner === "multiplayer" && incomingChallengeId) {
      void answerMultiplayerChallenge(incomingChallengeId, "decline");
    }
  }, [answerMultiplayerChallenge, incomingChallengeId, releasePlayModalOwner, walletController]);
  usePlayModalLifecycle({ onEscape: closeOwnedModal, originRef: exclusiveOriginRef, owner: modalOwner });
  useEffect(() => {
    if (!shouldDismissTrainerEncounterForExternalCombat(trainerEncounter?.phase ?? null, {
      wildBattleActive: Boolean(state.battle),
      pvpBattleActive: Boolean(multiplayer.activeBattle)
    })) return;
    setActiveTrainer(null);
    setTrainerEncounter(null);
  }, [multiplayer.activeBattle, state.battle, trainerEncounter?.phase]);
  const resourceGameplayCapture=useWildsResourceGameplayCapture({enabled:networkEnabled,ownerHandle:walletPublicUsername?`${walletPublicUsername.replace(/\.receiz\.id$/, '').toLowerCase()}.receiz.id`:null,gameplayOwnerId:ownerReceizId,state});
  const admitResourceSourceCommandRef = useRef<NonNullable<Parameters<typeof useWildsWorld>[0]["admitResourceSourceCommand"]>>(async () => null);
  const livingWorld = useWildsWorld({
    admitResourceSourceCommand: (entry, beforeAdmit) => admitResourceSourceCommandRef.current(entry, beforeAdmit),
    readKaiUPulse: readActionKaiUPulse,
    onAdmittedCommand:resourceGameplayCapture.captureWorld,
    onActivity: (activity) => setState(current => applyWildsInput(current, { type: "record-world-activity", activity })),
    enabled,
    networkEnabled,
    actorId: ownerReceizId,
    guestId: multiplayer.guestId,
    kaiUPulse,
    activeCard: activeAsset ?? null,
    cardAdmission,
    initialSnapshot: initialWorld,
    ownedWorldAdditions: state.ownedWorldAdditions,
    authorizeLivingWorld: livingWorldAuthorization
  });
  const resourceExchange = useWildsResourceExchange({
    owner: ownerReceizId, nourishment: state.playerNourishment, world: livingWorld, messenger,
    authorize: walletController.secureTransferAuthority, readKai: readActionKaiUPulse, feedback: showWorldFeedback,
    credit: update => setState(current => ({ ...current, playerNourishment: update(current.playerNourishment) }))
  });
  const [foodSavePending,setFoodSavePending]=useState(false);
  const foodSaveInFlight=useRef(false);
  useEffect(() => {
    const world = livingWorld.snapshot;
    if (!world?.resourcePackages || !state.playerNourishment) return;
    setState(current => {
      if (!current.playerNourishment) return current;
      const nourishment = recoverWildsUnpackedPackageFood(current.playerNourishment, world, readActionKaiUPulse());
      return nourishment === current.playerNourishment ? current : { ...current, playerNourishment: nourishment };
    });
  }, [livingWorld.snapshot, state.playerNourishment, readActionKaiUPulse]);
  const walletTradeOwnerHandle = walletPublicUsername ? `${walletPublicUsername.replace(/\.receiz\.id$/, "").toLowerCase()}.receiz.id` : null;
  const walletTradeIdentityRef = useRef({keyId: walletReadIdentityKey, ownerHandle: walletTradeOwnerHandle});
  walletTradeIdentityRef.current = {keyId: walletReadIdentityKey, ownerHandle: walletTradeOwnerHandle};
  const {readTradeConversations, sendBearerGift, sendResourceSource, sendStagedTrade} = messenger;
  const [walletSourceRows, setWalletSourceRows] = useState<{keyId: string; owner: string; rows: readonly WildsWalletResourceProjectionRowV128[]} | null>(null);
  const currentWalletSourceRows = walletSourceRows && walletSourceRows.keyId === walletReadIdentityKey && walletSourceRows.owner === walletTradeOwnerHandle ? walletSourceRows.rows : EMPTY_WALLET_SOURCE_ROWS;
  const walletSourceProjection = useMemo(() => projectWildsWalletResourceProjectionsV128(currentWalletSourceRows), [currentWalletSourceRows]);
  const walletVisibleNourishment = useMemo(() => resourceExchange.nourishment ? {...resourceExchange.nourishment, unavailableItemIds: [...new Set([...(resourceExchange.nourishment.unavailableItemIds ?? []), ...walletSourceProjection.lockedMemberIds])]} : undefined, [resourceExchange.nourishment, walletSourceProjection.lockedMemberIds]);
  const walletSourceStoreRef = useRef<ReturnType<typeof createWildsWalletResourceProjectionStoreV128> | null>(null);
  const walletSourceLocksRef = useRef(walletSourceProjection.lockedMemberIds);
  walletSourceLocksRef.current = walletSourceProjection.lockedMemberIds;
  const walletSourceLive = useRef({ state, ownerReceizId, onPrepareCard, readActionKaiUPulse,
    prepareVault: null as null | ((asset?: PortableCardAsset) => WildsPlayerVaultPayload),
    flushGameplay: resourceGameplayCapture.flush, crewCustody });
  walletSourceLive.current = { ...walletSourceLive.current, state, ownerReceizId, onPrepareCard, readActionKaiUPulse,
    flushGameplay: resourceGameplayCapture.flush, crewCustody };
  const walletAssetPortRuntimeRef = useRef<ReturnType<typeof createWildsWalletAssetPortV128>["openRuntime"] | null>(null);
  const livingWorldSourceAdoptionRef = useRef(livingWorld.adoptApplicationResourceWorld);
  livingWorldSourceAdoptionRef.current = livingWorld.adoptApplicationResourceWorld;
  const walletAssetPort = useMemo(() => {
    const keyId = walletReadIdentityKey, ownerHandle = walletTradeOwnerHandle;
    if (!keyId || !ownerHandle) return null;
    const capturedActor = ownerReceizId;
    const currentIdentity = () => {
      if (walletSourceLive.current.ownerReceizId !== capturedActor) throw Error("The Explorer changed. Reopen the wallet action.");
      const identity = walletTradeIdentityRef.current;
      if (identity.keyId !== keyId || identity.ownerHandle !== ownerHandle) throw Error("Unlock the same Explorer to continue this exact offer.");
      return {keyId: identity.keyId, ownerHandle: identity.ownerHandle};
    };
    return createWildsWalletAssetPortV128({ keyId, ownerHandle, gameplayOwnerId: capturedActor, currentIdentity,
      card: id => {
        const card = walletSourceLive.current.state.inventory.find(card => card.id === id);
        if (!card || !canOperateWildzCrewCard(card, capturedActor, walletSourceLive.current.crewCustody)
          || ["suspended", "revoked"].includes(card.status)) throw Error("This exact creature is unavailable to send.");
        return card;
      },
      prepareCard: card => {
        const live = walletSourceLive.current;
        if (!live.prepareVault) throw Error("The exact player Vault is unavailable.");
        return live.onPrepareCard(card, live.prepareVault(card));
      },
      readMessages: async () => (await readTradeConversations()).flatMap(conversation => conversation.messages)
        .filter(message => !message.deletedAt && !message.editedAt)
        .map(message => ({senderHandle: message.senderHandle, recipientHandle: message.recipientHandle, context: message.context})),
      publishCreature: sendBearerGift,
      publishResource: sendResourceSource,
      flushGameplay: () => walletSourceLive.current.flushGameplay(),
      readKai: () => walletSourceLive.current.readActionKaiUPulse(),
      onProjection: async value => {
        currentIdentity();
        const store = walletSourceStoreRef.current;
        if (!store) throw Error("Reopen the matching resource wallet.");
        const retained = await store.retain(value, value.continuation); currentIdentity();
        const rows = await store.listCached(); currentIdentity();
        const projected = projectWildsWalletResourceProjectionsV128(rows);
        walletSourceLocksRef.current = projected.lockedMemberIds;
        setWalletSourceRows({keyId, owner: ownerHandle, rows});
        const sourceMemberIds = new Set(rows.flatMap(row => row.memberRefs.map(member => member.id)));
        setState(current => current.playerNourishment?.ownerReceizId !== capturedActor || walletTradeIdentityRef.current.keyId !== keyId || walletTradeIdentityRef.current.ownerHandle !== ownerHandle ? current
          : {...current, playerNourishment: {...current.playerNourishment, unavailableItemIds: [...new Set([
            ...(current.playerNourishment.unavailableItemIds ?? []).filter(id => !sourceMemberIds.has(id)),
            ...[...projected.lockedMemberIds].filter(id => Boolean(current.playerNourishment?.items[id]))])].sort()}});
        if (retained.row.kind === "unpacked") {
          const runtime = await walletAssetPortRuntimeRef.current?.(); currentIdentity();
          if (!runtime) throw Error("Reopen the same source wallet to restore these contents.");
          const opened = await runtime.exchange.previewGameplay(); currentIdentity();
          livingWorldSourceAdoptionRef.current(opened.replay.world);
          const imported = retained.accepted.state.imports[value.package.packageId];
          if (!imported || imported.ownerReceizId !== ownerHandle) throw Error("The exact recipient's unpack is unavailable.");
          const available = value.package.members.filter(member => retained.row.availableMemberIds.includes(member.id));
          const nourishment = walletSourceLive.current.state.playerNourishment;
          if (nourishment) creditWildsImportedPackageFood(nourishment, available,
            {packageId: value.package.packageId, receiptId: imported.unpackAppendId}, Math.max(nourishment.lastKaiUPulse, walletSourceLive.current.readActionKaiUPulse()));
          setState(current => !current.playerNourishment || current.playerNourishment.ownerReceizId !== capturedActor
            || walletTradeIdentityRef.current.keyId !== keyId || walletTradeIdentityRef.current.ownerHandle !== ownerHandle ? current : { ...current,
            playerNourishment: creditWildsImportedPackageFood(current.playerNourishment, available,
              {packageId: value.package.packageId, receiptId: imported.unpackAppendId},
              Math.max(current.playerNourishment.lastKaiUPulse, walletSourceLive.current.readActionKaiUPulse())) });
          // A canonical meal can finish before this device's next local save.
          // Recover its admitted fuel only for an existing, still-unconsumed
          // local portion; never restore a spent source member into inventory.
          setState(current => {
            if (current.playerNourishment?.ownerReceizId !== capturedActor || walletTradeIdentityRef.current.keyId !== keyId || walletTradeIdentityRef.current.ownerHandle !== ownerHandle) return current;
            return recoverWildsWalletSourceFoodV128(current, opened.replay.nourishment, capturedActor,
              walletSourceLive.current.readActionKaiUPulse(), value.package.members.filter(member => member.kind === "food").map(member => member.id)).state;
          });
          const recovery = recoverWildsWalletSourceFoodV128(walletSourceLive.current.state, opened.replay.nourishment, capturedActor,
            walletSourceLive.current.readActionKaiUPulse(), value.package.members.filter(member => member.kind === "food").map(member => member.id));
          if (recovery.pendingItemIds.length) throw Error("Your meal is saved. Give your body room, then refresh these contents to recover its full fuel.");
        }
      },
      restoreAccepted: async (_leg, source, runtime) => {
        const {admitWildzNativeBearerCrewCustody, retainWildzCrewCustodyMemory} = await import("../../lib/receiz/wildz-artifact-codec");
        const admitted = await admitWildzNativeBearerCrewCustody({database: runtime.database, sdk: runtime.sdk,
          applicationId: runtime.applicationId, keyId, ...source});
        currentIdentity();
        if (!sameWildzPlayerCoordinate(admitted.ownerHandle, capturedActor)) throw Error("The received creature belongs to another Explorer.");
        const next = applyWildsInput(walletSourceLive.current.state, {type: "import-card", asset: admitted.card});
        const custody = mergeWildzCrewCustody(capturedActor, [walletSourceLive.current.crewCustody, admitted.crewCustody], next.inventory);
        await retainWildzCrewCustodyMemory(runtime.database, {keyId, actorId: capturedActor}, custody, next.inventory);
        currentIdentity();
        setReceivedCrewCustody({keyId, owner: capturedActor, token: custody!});
        setState(current => applyWildsInput(current, {type: "import-card", asset: admitted.card}));
      },
      onAcceptedOutgoing: async leg => {
        currentIdentity();
        if (leg.request.asset.kind !== "creature") throw Error("The exact creature stage is required.");
        const assetId = leg.request.asset.assetId;
        setState(current => applyWildsInput(current, {type: "transfer-card-out", assetId}));
      }
    });
  }, [walletReadIdentityKey, walletTradeOwnerHandle, ownerReceizId, readTradeConversations, sendBearerGift, sendResourceSource]);
  walletAssetPortRuntimeRef.current = walletAssetPort?.openRuntime ?? null;
  const walletSourceStore = useMemo(() => {
    if (!walletAssetPort || !walletReadIdentityKey || !walletTradeOwnerHandle) return null;
    return createWildsWalletResourceProjectionStoreV128({keyId: walletReadIdentityKey, ownerHandle: walletTradeOwnerHandle,
      currentIdentity: () => {
        const current = walletTradeIdentityRef.current;
        if (!current.keyId || !current.ownerHandle) throw Error("Unlock the same Explorer to reopen this source.");
        return {keyId: current.keyId, ownerHandle: current.ownerHandle};
      }, openRuntime: walletAssetPort.openRuntime});
  }, [walletAssetPort, walletReadIdentityKey, walletTradeOwnerHandle]);
  walletSourceStoreRef.current = walletSourceStore;
  const walletSourceUse = useMemo(() => {
    if (!walletAssetPort || !walletReadIdentityKey || !walletTradeOwnerHandle) return null;
    return createWildsWalletResourceUsePortV128({keyId: walletReadIdentityKey, ownerHandle: walletTradeOwnerHandle,
      currentIdentity: () => {
        const current = walletTradeIdentityRef.current;
        if (!current.keyId || !current.ownerHandle) throw Error("Unlock the same Explorer to use this source.");
        return {keyId: current.keyId, ownerHandle: current.ownerHandle};
      }, openRuntime: walletAssetPort.openRuntime});
  }, [walletAssetPort, walletReadIdentityKey, walletTradeOwnerHandle]);
  useEffect(() => {
    if (!walletSourceStore || !walletReadIdentityKey || !walletTradeOwnerHandle) return;
    let cancelled = false;
    void walletSourceStore.listCached().then(rows => {
      if (!cancelled) setWalletSourceRows({keyId: walletReadIdentityKey, owner: walletTradeOwnerHandle, rows});
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [walletSourceStore, walletReadIdentityKey, walletTradeOwnerHandle]);
  const unpackWalletSourcePackage = useCallback(async (packageId: string) => {
    if (!walletAssetPort || !walletSourceStore) throw Error("Unlock the same Explorer to use this package.");
    const expectedIdentity = {...walletTradeIdentityRef.current};
    const result = await walletAssetPort.unpackHeldPackage(packageId);
    if (result.status !== "accepted") throw Error(result.message ?? "Check the same package to finish unpacking its contents.");
    const rows = await walletSourceStore.listCached();
    const current = walletTradeIdentityRef.current;
    if (current.keyId !== expectedIdentity.keyId || current.ownerHandle !== expectedIdentity.ownerHandle) throw Error("The Explorer changed. Reopen the same package.");
    if (current.keyId && current.ownerHandle) setWalletSourceRows({keyId: current.keyId, owner: current.ownerHandle, rows});
  }, [walletAssetPort, walletSourceStore]);
  admitResourceSourceCommandRef.current = async (entry, beforeAdmit) => {
    const command = entry.command;
    const memberIds = "lotIds" in command ? command.lotIds : "resources" in command ? command.resources.map(lot => lot.id)
      : "lotId" in command ? [command.lotId] : [];
    const knownSourceMembers = new Set(currentWalletSourceRows.flatMap(row => row.memberRefs.map(member => member.id)));
    const selectedSourceIds = memberIds.filter((id): id is string => typeof id === "string" && knownSourceMembers.has(id));
    const sourceWorld = livingWorld.currentApplicationResourceSource();
    const sourceCreation = (command.type === "creation.construct" || command.type === "creation.evolve") && sourceWorld
      && command.context.sourceHead === creationWorldSourceHead(sourceWorld);
    const sourceOwnerAction = command.type === "creation.action" && Boolean(sourceWorld?.creations?.[command.actionRequest.instanceId]);
    if (!selectedSourceIds.length && !sourceCreation && !sourceOwnerAction) return null;
    if (!walletAssetPort || !walletSourceUse || !walletSourceStore) throw Error("Unlock the same Explorer before using received materials.");
    const available = new Set(walletSourceProjection.availableMembers.map(member => member.id));
    const unavailable = selectedSourceIds.some(id => !available.has(id) || walletSourceProjection.lockedMemberIds.has(id));
    const expectedIdentity = {...walletTradeIdentityRef.current};
    await resourceGameplayCapture.flush();
    const sourceCommand = {kind: "world" as const, command, kaiUPulse: command.kai!.uPulse,
      ...(entry.card ? {card: entry.card} : {}), ...("mandate" in command && command.mandate ? {groveMandate: command.mandate} : {})};
    const request = {attemptId: `material-use:${command.commandId}`, memberIds: selectedSourceIds, command: sourceCommand};
    const observed = await walletSourceUse.observe(request);
    const finalFence = beforeAdmit ? () => beforeAdmit(entry) : undefined;
    const recovered = observed ?? await walletSourceUse.recover(request, finalFence);
    if (!recovered && unavailable) throw Error("These exact source materials are reserved, spent or held by another Explorer.");
    const admitted = recovered ?? await walletSourceUse.use(request, finalFence);
    if (!admitted || walletTradeIdentityRef.current.keyId !== expectedIdentity.keyId || walletTradeIdentityRef.current.ownerHandle !== expectedIdentity.ownerHandle) throw Error("The Explorer changed. Reopen the same material action.");
    const row = currentWalletSourceRows.find(row => row.memberRefs.some(member => selectedSourceIds.includes(member.id)));
    if (row) await walletSourceStore.reopen(row.packageId);
    const rows = await walletSourceStore.listCached();
    if (walletTradeIdentityRef.current.keyId !== expectedIdentity.keyId || walletTradeIdentityRef.current.ownerHandle !== expectedIdentity.ownerHandle) throw Error("The Explorer changed. Reopen the same material action.");
    if (expectedIdentity.keyId && expectedIdentity.ownerHandle) setWalletSourceRows({keyId: expectedIdentity.keyId, owner: expectedIdentity.ownerHandle, rows});
    return {projection: admitted.projection, events: admitted.events};
  };
  const ensureWalletTradeReady = useCallback(async () => {
    const expected = {...walletTradeIdentityRef.current};
    const {defaultIdentityRepository, connectWildzProofSession} = await import("@/lib/receiz/wildz-identity-adapter");
    const active = await defaultIdentityRepository.active();
    if (!active || active.localAuthority !== "verified" || active.keyId !== expected.keyId || active.actorId !== ownerReceizId) return false;
    const connected = await connectWildzProofSession(active, {forceRemote: true});
    const current = await defaultIdentityRepository.active();
    return current?.keyId === expected.keyId && connected.status === "connected" && connected.sessionKeyId === expected.keyId
      && walletTradeIdentityRef.current.keyId === expected.keyId && walletTradeIdentityRef.current.ownerHandle === expected.ownerHandle;
  }, [ownerReceizId]);
  const [marketListedCards, setMarketListedCards] = useState<{keyId:string;ownerHandle:string;ids:readonly string[]} | null>(null);
  const marketListedCardsRef = useRef(marketListedCards);
  marketListedCardsRef.current = marketListedCards;
  const currentMarketListedCardIds = marketListedCards && marketListedCards.keyId === walletReadIdentityKey && marketListedCards.ownerHandle === walletTradeOwnerHandle ? marketListedCards.ids : [];
  const genericWalletAssetPort = useMemo(() => walletAssetPort ? {
    ...walletAssetPort,
    prepareSource: async (leg: Parameters<typeof walletAssetPort.prepareSource>[0]) => {
      const asset = leg.request.asset;
      const listed = marketListedCardsRef.current;
      if (asset.kind === "creature" && (walletSourceLive.current.state.inventory.find(card => card.id === asset.assetId)?.status === "listed"
        || listed && listed.keyId === walletTradeIdentityRef.current.keyId && listed.ownerHandle === walletTradeIdentityRef.current.ownerHandle && listed.ids.includes(asset.assetId)))
        throw Error("Cancel this creature's market listing before offering it in Wallet.");
      return walletAssetPort.prepareSource(leg);
    }
  } : null, [walletAssetPort]);
  const marketReadSelectionsRef = useRef<() => readonly WildsWalletAssetSendSelection[]>(() => []);
  const marketActiveRef = useRef(true);
  const lazyMarket = useMemo(() => {
    const keyId = walletReadIdentityKey, ownerHandle = walletTradeOwnerHandle;
    if (!keyId || !ownerHandle || !walletAssetPort) return null;
    const currentIdentity = () => {
      const identity = walletTradeIdentityRef.current;
      if (!marketActiveRef.current || identity.keyId !== keyId || identity.ownerHandle !== ownerHandle) throw Error("The Explorer changed. Reopen Market.");
      return {keyId, ownerHandle};
    };
    return createLazyWildzMarketServiceV128({binding: {keyId, ownerHandle}, currentBinding: currentIdentity, open: async () => {
      const [{createWildzMarketServiceV128}, {openWildzMarketSourceBrowserV128}] = await Promise.all([
        import("../market/wildz-market-service-v128"), import("../../lib/receiz/wildz-market-source-browser-v128")
      ]);
      currentIdentity();
      const qualifySelection = (asset: WildsWalletAssetSendRequest["asset"]) => walletAssetPort.qualifyListing(asset,
        marketReadSelectionsRef.current().find(selection => JSON.stringify(selection.asset) === JSON.stringify(asset))?.label);
      return createWildzMarketServiceV128({keyId, ownerHandle, currentIdentity,
        readSelections: () => marketReadSelectionsRef.current(), qualifySelection,
        openSource: async ({verifyTransition}) => openWildzMarketSourceBrowserV128({resourceRuntime: await walletAssetPort.openRuntime(),
          qualifySelection: async selection => walletAssetPort.qualifyListing(selection.asset, selection.summary), verifyTransition}),
        staged: {assetPort: walletAssetPort, readConversations: readTradeConversations, publish: sendStagedTrade,
          sendWalletAsset: async () => ({status: "failed", message: "Review the exact native asset in Market."}), ensureReady: ensureWalletTradeReady}
      });
    }});
  }, [walletReadIdentityKey, walletTradeOwnerHandle, walletAssetPort, readTradeConversations, sendStagedTrade, ensureWalletTradeReady]);
  useEffect(() => {
    marketActiveRef.current = true;
    onMarketServiceChange?.(lazyMarket?.service ?? null);
    if (!lazyMarket) return;
    const unsubscribe = lazyMarket.service.subscribe(snapshot => {
      const binding = lazyMarket.service.binding;
      const ids = snapshot.listings.flatMap(listing => listing.asset.kind === "creature" && listing.sellerHandle === binding.ownerHandle
        && (listing.status === "active" || listing.status === "reserved") ? [listing.asset.assetId] : []).sort();
      const next = {...binding, ids};
      marketListedCardsRef.current = next;
      setMarketListedCards(previous => previous?.keyId === next.keyId && previous.ownerHandle === next.ownerHandle
        && previous.ids.join("\n") === ids.join("\n") ? previous : next);
    });
    return () => { marketActiveRef.current = false; unsubscribe(); onMarketServiceChange?.(null); };
  }, [lazyMarket, onMarketServiceChange]);
  const cardListAttemptsRef = useRef(new Map<string, string>());
  const listMarketCreature = useCallback(async (card: PortableCardAsset, priceCents: number) => {
    if (!lazyMarket || !Number.isSafeInteger(priceCents) || priceCents < 1) throw Error("Unlock your Explorer and enter an exact USD price.");
    const snapshot = await lazyMarket.service.read();
    const pending = snapshot.pendingListings?.find(attempt => attempt.asset.kind === "creature" && attempt.asset.assetId === card.id);
    if (pending && pending.priceUsdCents !== String(priceCents)) throw Error("This creature has a saved listing at another price. Check that same listing in Market first.");
    const active = snapshot.listings.find(listing => listing.sellerHandle === lazyMarket.service.binding.ownerHandle
      && listing.asset.kind === "creature" && listing.asset.assetId === card.id && (listing.status === "active" || listing.status === "reserved"));
    if (active) {
      if (active.priceUsdCents !== String(priceCents)) throw Error("This creature is already listed at another price. Cancel that listing in Market first.");
      return {...card, synchronizedAt: new Date().toISOString()};
    }
    const key = JSON.stringify([lazyMarket.service.binding, card.id, priceCents]);
    const attemptId = pending?.attemptId ?? cardListAttemptsRef.current.get(key) ?? `card-list:${crypto.randomUUID()}`;
    cardListAttemptsRef.current.set(key, attemptId);
    const result = await lazyMarket.service.list({asset: {kind: "creature", assetId: card.id}, priceUsdCents: String(priceCents),
      attemptId});
    if (result.status !== "listed") throw Error(result.message);
    cardListAttemptsRef.current.delete(key);
    return {...card, synchronizedAt: new Date().toISOString()};
  }, [lazyMarket]);
  const stagedWalletTrade = useWildsWalletStagedTrade({
    ...walletTradeIdentityRef.current,
    currentIdentity: () => walletTradeIdentityRef.current,
    sendWalletAsset: async () => ({status: "failed", message: "Review the exact asset source in Wallet."}),
    assetPort: genericWalletAssetPort ?? {
      prepareSource: async () => { throw Error("Unlock your verified Explorer before sending an asset."); },
      sendSource: async () => ({status: "pending", message: "Unlock your Explorer to continue the saved offer."}),
      observeSource: async () => ({status: "pending", message: "Unlock your Explorer to check the saved offer."}),
      verifyAccepted: async () => { throw Error("Unlock your Explorer to verify this receipt."); }
    },
    readConversations: readTradeConversations,
    publish: sendStagedTrade,
    ensureReady: ensureWalletTradeReady
  });
  const {approve: approveWalletAgreement, receive: receiveWalletNotice} = stagedWalletTrade;
  const sendWalletAsset = useCallback(async (request: WildsWalletAssetSendRequest) => {
    const owner = walletTradeIdentityRef.current.ownerHandle;
    if (!owner) return {status: "failed" as const, message: "Unlock your Explorer before sending an asset."};
    try {
      const result = await approveWalletAgreement(createWildsWalletGiftAgreement(owner, request));
      return {status: result.status === "completed" || result.status === "awaiting-peer" || result.status === "awaiting-acceptance" ? "sent" as const : result.status === "failed" ? "failed" as const : "pending" as const,
        message: result.status === "awaiting-peer" ? "Gift request sent. The recipient can review and accept it in Wallet." : result.message};
    } catch (cause) { return {status: "pending" as const, message: cause instanceof Error ? cause.message : "Check the same saved gift before trying again."}; }
  }, [approveWalletAgreement]);
  const stagedWalletInbox = useMemo(() => walletTradeOwnerHandle
    ? projectWildsWalletStagedTradeInbox(messenger.conversations, walletTradeOwnerHandle) : [],
  [messenger.conversations, walletTradeOwnerHandle]);
  const receivedWalletNotices = useRef<{owner: string | null; keyId: string | undefined; ids: Set<string>}>({owner: null, keyId: undefined, ids: new Set()});
  useEffect(() => {
    const identity = walletTradeIdentityRef.current;
    if (receivedWalletNotices.current.owner !== identity.ownerHandle || receivedWalletNotices.current.keyId !== identity.keyId)
      receivedWalletNotices.current = {owner: identity.ownerHandle, keyId: identity.keyId, ids: new Set()};
    if (!identity.ownerHandle || !identity.keyId) return;
    for (const message of messenger.conversations.flatMap(conversation => conversation.messages)) {
      if (message.deletedAt || message.editedAt || !message.context?.kind.startsWith("trade-")
        || message.context.kind === "trade-package" || !sameWildzPlayerCoordinate(message.recipientHandle, identity.ownerHandle)
        || sameWildzPlayerCoordinate(message.senderHandle, identity.ownerHandle) || receivedWalletNotices.current.ids.has(message.id)) continue;
      receivedWalletNotices.current.ids.add(message.id);
      if (receivedWalletNotices.current.ids.size > 256) receivedWalletNotices.current.ids.delete(receivedWalletNotices.current.ids.values().next().value!);
      void receiveWalletNotice(message.context, message.senderHandle).catch(() => undefined);
      if (lazyMarket?.opened()) void lazyMarket.service.receive(message.context, message.senderHandle).catch(() => undefined);
    }
  }, [messenger.conversations, receiveWalletNotice, lazyMarket]);
  const pendingNativeFoodFuel = useMemo(() => livingWorld.snapshot
    ? hasRecoverableWildsNativeFood({ playerNourishment: state.playerNourishment }, livingWorld.snapshot, ownerReceizId) : false,
  [state.playerNourishment, livingWorld.snapshot, ownerReceizId]);
  useEffect(() => {
    const world = livingWorld.snapshot;
    if (!pendingNativeFoodFuel || !world || !['receiz_live', 'kai_live'].includes(livingWorld.mode)) return;
    setState(current => recoverWildsNativeFoodFuel(current, world, ownerReceizId, readActionKaiUPulse()));
  }, [pendingNativeFoodFuel, livingWorld.snapshot, livingWorld.mode, state.playerBreaths, ownerReceizId, readActionKaiUPulse]);
  useEffect(() => {
    if (!livingWorld.snapshot) return;
    const ownedWorldAdditions = projectWildsOwnedWorldAdditions(livingWorld.snapshot, ownerReceizId);
    setState((current) => sameWildsOwnedWorldAdditions(current.ownedWorldAdditions, ownedWorldAdditions)
      ? current
      : { ...current, ownedWorldAdditions });
  }, [livingWorld.snapshot, ownerReceizId]);
  const [activeWorkSource, setActiveWorkSource] = useState<WildsActiveWorkSource | null>(null);
  const harvestPendingRef = useRef(false);
  useEffect(() => {
    if (!activeWorkSource) return;
    const startedAt = activeWorkSource.startedAtMs;
    // The deadline starts with the gesture, even if durable admission is still waiting.
    const deadline = window.setTimeout(() => {
      setActiveWorkSource(current => current?.startedAtMs === startedAt ? null : current);
      if (activeWorkSource.settledAtMs === null) showWorldFeedback("Your companion has finished working. Checking the saved harvest before updating your Satchel…");
    }, Math.max(0, startedAt + 8000 - performance.now()));
    return () => window.clearTimeout(deadline);
  }, [activeWorkSource, showWorldFeedback]);
  useEffect(() => {
    setActiveWorkSource(current => current?.assetId && current.assetId !== state.selectedAssetId ? null : current);
  }, [state.selectedAssetId]);
  const stewardPhiAwards = useMemo(() => Object.values(livingWorld.snapshot?.stewardPhiAwards ?? {})
    .filter((award) => sameWildzPlayerCoordinate(award.ownerReceizId, ownerReceizId))
    .sort((left, right) => right.awardId.localeCompare(left.awardId)), [livingWorld.snapshot?.stewardPhiAwards, ownerReceizId]);
  const stewardAwardIdsRef = useRef<Set<string> | null>(null);
  const refreshWalletAfterStewardSettlement = walletController.refresh;
  useEffect(() => {
    const nextIds = new Set(stewardPhiAwards.map((award) => award.awardId));
    const priorIds = stewardAwardIdsRef.current;
    stewardAwardIdsRef.current = nextIds;
    if (!priorIds || !stewardPhiAwards.some((award) => !priorIds.has(award.awardId))) return;
    void refreshWalletAfterStewardSettlement({ replace: true });
  }, [refreshWalletAfterStewardSettlement, stewardPhiAwards]);
  const selectWorldGeometry = useMemo(createWildsWorldGeometrySelector, []);
  const worldGeometry = useMemo(() => selectWorldGeometry(livingWorld.snapshot), [selectWorldGeometry, livingWorld.snapshot]);
  const sites = worldGeometry?.sites;
  const bosses = worldGeometry?.bosses;
  const structures = worldGeometry?.structures;
  const constructionComponents = worldGeometry?.constructionComponents;
  const constructionMaterialContributions = worldGeometry?.constructionMaterialContributions;
  const constructionWorkContributions = worldGeometry?.constructionWorkContributions;
  const livingPhysicalObstacles = useMemo(
    () => sites && bosses && structures && constructionComponents && constructionMaterialContributions && constructionWorkContributions
      ? projectWildsRenderedLivingObstacles({ sites, bosses, structures, constructionComponents, constructionMaterialContributions, constructionWorkContributions }) : [],
    [sites, bosses, structures, constructionComponents, constructionMaterialContributions, constructionWorkContributions]
  );
  const livingStructureSupports = useMemo(
    () => structures ? projectWildsStructureSupports({ structures, constructionComponents, constructionMaterialContributions, constructionWorkContributions }) : [],
    [structures, constructionComponents, constructionMaterialContributions, constructionWorkContributions]
  );
  const selectConstructionTerrain=useMemo(createWildsConstructionTerrainSelector,[]);
  const constructionTerrainPads=useMemo(()=>selectConstructionTerrain(livingWorld.snapshot),[selectConstructionTerrain,livingWorld.snapshot]);
  const siteRegion = wildsDiscoverySiteRegionForPosition(state.player);
  const sitePhysical = useMemo(
    () => composeWildsConstructionTerrain(composeWildsInteriorConstruction(composeWildsBurrowPhysical(appendWildsDiscoveryVisualSolids(admitWildsDiscoveryPhysicalNeighborhood(siteRegion.x, siteRegion.z)),worldGeometry?.burrows),worldGeometry),constructionTerrainPads),
    [siteRegion.x, siteRegion.z, worldGeometry,constructionTerrainPads]
  );
  const siteRuntime = useMemo(() => prepareWildsSiteRuntime(sitePhysical), [sitePhysical]);
  const playerStructureSupport = useMemo(() => {
    const manual=wildsStructureSupportAt(state.player,livingStructureSupports,0,state.siteSpace.position.y);
    const created=creationNavigation?creationFloorSupportAt(creationNavigation,state.siteSpace.spaceId,state.siteSpace.position):null;
    return created&&(!manual||created.deckY>manual.deckY)?created:manual;
  },[creationNavigation,livingStructureSupports,state.player,state.siteSpace]);
  const [aerialMode, setAerialMode] = useState<WildsAerialMode>("ground");
  const aquaticPresentation = useMemo(() => projectWildsAquaticPresentationAtPosition({
    x: state.player.x,
    z: state.player.z,
    canSwim,
    airborne: aerialMode !== "ground",
    groundElevation: state.siteSpace.spaceId === "wildz.space.outer.v1"
      ? wildsSiteRuntimeGroundY(siteRuntime, state.siteSpace.spaceId, state.player.x, state.player.z, Number.NaN) : null,
    supportElevation: playerStructureSupport?.deckY ?? null
  }), [aerialMode, canSwim, playerStructureSupport?.deckY, siteRuntime, state.player.x, state.player.z, state.siteSpace.spaceId]);
  const [initialAerialState] = useState(() => createGroundedWildsAerialState(
    state.player,
    aquaticPresentation.terrainElevation
  ));
  const aerialStateRef = useRef<WildsAerialTraversalState>(initialAerialState);
  const verticalTraversalRef = useRef<WildsVerticalTraversalState>(createWildsVerticalTraversalState());
  const handActionsRef = useRef(createWildsHandActionState());
  const equipmentControlsRef=useRef(createWildsEquipmentControlState());
  const equipmentGestureGeneration=useRef(0);
  const currentGatherActions=useRef<{food:(plant:WildsNourishmentPlantProjection)=>void;material:(source:WildsResourceSource)=>Promise<void>;livestock:(animal:WildsOwnedLivestockProjection)=>void}|null>(null);
  const lastGroundMovement = useRef<{input: WildsJumpMovement; at: number} | null>(null);
  const jumpTravelRef = useRef<WildsJumpTravel | null>(null);
  const jumpTravelDispatching = useRef(false);
  const [equipmentHand,setEquipmentHand]=useState<WildsPlayerHand>('right');
  useEffect(()=>setEquipmentHand(readWildsEquipmentHand(ownerReceizId)),[ownerReceizId]);
  const pendingCreationHand=useRef<{operationId:string;ownerId:string}|null>(null);
  const heldCreationEquipment=useMemo(()=>{
    const instance=Object.values(creationPhysical.instances).find(instance=>currentCreationEquipment(instance,ownerReceizId));
    const node=instance&&currentCreationEquipment(instance,ownerReceizId);
    const definition=instance&&creationPhysical.definitions[instance.definitionDigest];
    return instance&&node&&definition?{instance,definition,nodeId:node.nodeId,hand:equipmentHand}:undefined;
  },[creationPhysical,equipmentHand,ownerReceizId]);
  const equipmentControls=useMemo<WildsEquipmentControls|undefined>(()=>{
    const node=heldCreationEquipment?.instance.nodeStates[heldCreationEquipment.nodeId];
    if(node?.kind!=='equipment')return undefined;const profile=creationEquipmentProfile(node.actionProfileId);
    return profile?{id:heldCreationEquipment!.instance.instanceId,toolMode:profile.mode==='axe'||profile.mode==='pickaxe'||profile.mode==='hoe'?profile.mode:undefined,mode:profile.mode==='bow'?'bow':profile.mode==='rifle'?'rifle':profile.kind==='tool'?'tool':'melee',hand:equipmentHand,label:profile.label??(profile.kind==='tool'?'Tool':'Weapon'),durability:node.durability,capacity:node.capacity}:undefined;
  },[heldCreationEquipment,equipmentHand]);
  useEffect(() => {
    handActionsRef.current.left=null;handActionsRef.current.right=null;clearWildsEquipmentControlState(equipmentControlsRef.current);
    jumpTravelRef.current = null;
    lastGroundMovement.current = null;
    const vertical=verticalTraversalRef.current;
    if(vertical.jumpVelocity!==undefined){const floor=vertical.worldY-vertical.offset;resetWildsVerticalTraversalState(vertical);vertical.worldY=floor;}
  },[gestureCancelSignal, ownerReceizId]);
  const verticalIntentRef = useRef<WildsVerticalTraversalIntent>(0);
  const horizontalAllowedRef = useRef(true);
  const worldInputDispatcherRef = useRef<((input: WildsInput) => void) | null>(null);
  const [aerialEnergy, setAerialEnergy] = useState(100);
  const [verticalReadout, setTraversalReadout] = useState({ layer: "ground" as WildsVerticalTraversalState["layer"], value: 0, safeMin: 0, safeMax: 0, blockerId: null as string | null });
  const publishVerticalReadout = useCallback((layer: WildsVerticalTraversalState["layer"], value: number, safeMin: number, safeMax: number, blockerId: string | null) => {
    setTraversalReadout({ layer, value, safeMin, safeMax, blockerId });
  }, []);
  const resetTransientTraversal = useCallback((position = state.player, elevation = aquaticPresentation.terrainElevation) => {
    aerialStateRef.current = createGroundedWildsAerialState(position, elevation);
    resetWildsVerticalTraversalState(verticalTraversalRef.current);
    verticalIntentRef.current = 0;
    horizontalAllowedRef.current = true;
    setAerialMode("ground");
    setAerialEnergy(100);
    setTraversalReadout({ layer: "ground", value: 0, safeMin: 0, safeMax: 0, blockerId: null });
  }, [aquaticPresentation.terrainElevation, state.player]);
  const monuments=useMemo(()=>projectWildsMonuments(siteRuntime.sites),[siteRuntime]);
  const nearbyMonument=useMemo(()=>state.siteSpace.spaceId==='wildz.space.outer.v1'?monuments.find(monument=>
    Math.hypot(monument.position.x-state.player.x,monument.position.z-state.player.z)<=WILDS_MONUMENT_INTERACTION_RADIUS
    &&Math.abs(monument.position.y-state.siteSpace.position.y)<2):null,[monuments,state.player,state.siteSpace]);
  const sourceCreationPlanning = useMemo(() => currentWalletSourceRows.some(row => row.currentOwnerHandle === row.ownerHandle && row.kind === "unpacked" && row.memberRefs.some(member => member.kind === "material")), [currentWalletSourceRows]);
  const [creationSourcePending, setCreationSourcePending] = useState(false);
  useEffect(() => {
    if (!creationOpen || !sourceCreationPlanning || !walletAssetPort) { setCreationSourcePending(false); return; }
    let cancelled = false; setCreationSourcePending(true);
    void (async () => {
      await walletSourceLive.current.flushGameplay();
      const runtime = await walletAssetPort.openRuntime(), preview = await runtime.exchange.previewGameplay();
      if (!cancelled) livingWorldSourceAdoptionRef.current(preview.replay.world);
    })().catch(error => { if (!cancelled) showWorldFeedback(error instanceof Error ? error.message : "Reopen Build to check received materials."); })
      .finally(() => { if (!cancelled) setCreationSourcePending(false); });
    return () => { cancelled = true; };
  }, [creationOpen, sourceCreationPlanning, walletAssetPort, showWorldFeedback]);
  const readApplicationCreationWorld = livingWorld.currentApplicationResourceSource, readBaselineCreationWorld = livingWorld.currentSource;
  const currentCreationWorldSource = useCallback(() => creationOpen && sourceCreationPlanning
    ? readApplicationCreationWorld() ?? readBaselineCreationWorld() : readBaselineCreationWorld(),
  [creationOpen, sourceCreationPlanning, readApplicationCreationWorld, readBaselineCreationWorld]);
  const creationWorldSnapshot=livingWorld.snapshot;
  const liveCreationContext = useMemo(() => {
    // World refreshes must not hash a full checkpoint or rebuild compiler
    // solids while the player is exploring with the builder closed.
    void creationWorldSnapshot;
    return projectActiveCreationContext({ active: creationOpen && !creationSourcePending && (!sourceCreationPlanning || Boolean(readApplicationCreationWorld())),
      context: creationContext ? { ...creationContext, spaceId: state.siteSpace.spaceId } : null,
      world: currentCreationWorldSource,
      physical: { projections: creationPhysical.projections, obstacles: livingPhysicalObstacles, sites: sitePhysical }
    });
  }, [creationOpen, creationSourcePending, sourceCreationPlanning, readApplicationCreationWorld, creationContext, state.siteSpace.spaceId, creationWorldSnapshot, currentCreationWorldSource, creationPhysical.projections, livingPhysicalObstacles, sitePhysical]);
  creationRuntime.current={
    environment:()=>({ownerId:ownerReceizId,worldId:'wilds:global:v3',spaceId:state.siteSpace.spaceId}),
    world:currentCreationWorldSource,
    crew:()=>({cards:crewCards,conditions:state.adventureConditions}),
    position:()=>({x:state.player.x,y:verticalTraversalRef.current.layer==='ground'?state.siteSpace.position.y:verticalTraversalRef.current.worldY,z:state.player.z}),
    compileContext:plan=>liveCreationContext&&creationCommitContext.current?{...liveCreationContext,...(creationCommitContext.current.evolution?{evolution:creationCommitContext.current.evolution}:{}),pose:plan.pose,budget:creationCommitContext.current.budget,techniques:creationCommitContext.current.techniques}:null,
    admit:livingWorld.admitCreation
  };
  const [restoredCreationSource,setRestoredCreationSource]=useState<{controller:CreationController;sources:WildsWorldProjection['creations'];spaceId:string}|null>(null);
  const creationRestorationReady=Boolean(suppliedCreationController||restoredCreationSource?.controller===localCreation.controller
    &&restoredCreationSource.sources===livingWorld.snapshot?.creations&&restoredCreationSource.spaceId===state.siteSpace.spaceId);
  useEffect(()=>{
    if(suppliedCreationController)return;
    let current=true;
    const sources=livingWorld.snapshot?.creations,spaceId=state.siteSpace.spaceId;
    const settled=()=>{if(current)setRestoredCreationSource({controller:localCreation.controller,sources,spaceId});};
    void localCreation.controller.restore().then(settled,settled);
    return()=>{current=false;};
  },[localCreation,suppliedCreationController,livingWorld.snapshot?.creations,state.siteSpace.spaceId]);
  const accompanyingCrew = useMemo(() => state.inventory.filter(card => card.id === state.selectedAssetId || state.supportAssetIds.includes(card.id)).slice(0, 3), [state.inventory, state.selectedAssetId, state.supportAssetIds]);
  const crewControlScope = useRef({ owner: ownerReceizId, inventory: state.inventory, custody: crewCustody });
  crewControlScope.current = { owner: ownerReceizId, inventory: state.inventory, custody: crewCustody };
  const crewExpeditions = useWildsCrewExpeditions({ owner: ownerReceizId, state, cards: crewCards, custody: crewCustody,
    accompanyingAssetIds: accompanyingCrew.map(card=>card.id), siteRuntime, obstacles: livingPhysicalObstacles,
    feedback: showWorldFeedback,
    onResumed: assetId => setState(current => current.crewPreferences?.ownerReceizId === ownerReceizId && current.crewPreferences.byAssetId[assetId] === "roam" ? current
      : ({ ...current, crewPreferences: setWildsCrewPreference(current.crewPreferences, current.inventory, ownerReceizId, assetId, "roam", crewCustody) })),
    onFinished: assetId => setState(current => current.crewPreferences?.ownerReceizId === ownerReceizId && current.crewPreferences.byAssetId[assetId] === "follow" ? current
      : ({ ...current, crewPreferences: setWildsCrewPreference(current.crewPreferences, current.inventory, ownerReceizId, assetId, "follow", crewCustody) })) });
  const crewMapSource = useMemo<WildsCrewMapSource>(() => ({
    owner: ownerReceizId, cards: crewCards, custody: crewCustody, expeditions: crewExpeditions.expeditions, runtime: crewExpeditions.runtime.current
  }), [ownerReceizId, crewCards, crewCustody, crewExpeditions.expeditions, crewExpeditions.runtime]);
  roamingPresenceReader.current = () => networkEnabled ? buildWildsRoamingPresenceUploads(crewMapSource, card => createWildzVaultCardMembershipProof(currentVaultAdmission, card)) : [];
  const remoteCrewMarkers = useMemo(() => projectWildsRemoteRoamingMarkers(multiplayer.remotePlayers, multiplayer.selfId), [multiplayer.remotePlayers, multiplayer.selfId]);
  physicalCrewTrips.current = crewExpeditions.activeTrips.current;
  useEffect(() => {
    const nextDueAt = state.inventory.reduce<number | null>((earliest, asset) => {
      if (isWildsCrewPhysicallyActive(asset, ownerReceizId, physicalCrewTrips.current)) return earliest;
      const dueAt = nextCreatureContinuityDueAt(asset);
      return dueAt === null || (earliest !== null && earliest <= dueAt) ? earliest : dueAt;
    }, null);
    if (nextDueAt === null) return;
    const delay = Math.max(0, Math.min(2_147_000_000, nextDueAt - Date.now()));
    const timer = window.setTimeout(settleLivingCreatures, delay);
    return () => window.clearTimeout(timer);
  }, [settleLivingCreatures, state.inventory, ownerReceizId, crewExpeditions.activeTripRevision]);
  useEffect(() => {
    if (shellOverlayOwner === "none" || !state.pendingTravelGrowthEvents.length) return;
    let cancelled = false;
    void wildzGameplayBackground.run(() => {
      if (!cancelled) setState((current) => settleWildsCrewPendingGrowth(current, ownerReceizId, physicalCrewTrips.current, 1));
    });
    return () => { cancelled = true; };
  }, [shellOverlayOwner, state.pendingTravelGrowthEvents, ownerReceizId, crewExpeditions.activeTripRevision]);
  const earnedWorldPhi = useMemo(() => projectWildsEarnedPhi({ awards: Object.values(livingWorld.snapshot?.stewardPhiAwards ?? {}), ownerReceizId }), [livingWorld.snapshot?.stewardPhiAwards, ownerReceizId]);
  const witnessedSites = useRef<{ owner: string; keys: readonly string[] }>({ owner: ownerReceizId, keys: state.explorationAtlas.siteKeys });
  useEffect(() => {
    const previous = witnessedSites.current;
    witnessedSites.current = { owner: ownerReceizId, keys: state.explorationAtlas.siteKeys };
    if (previous.owner !== ownerReceizId) return;
    const known = new Set(previous.keys);
    for (const key of state.explorationAtlas.siteKeys) {
      if (known.has(key)) continue;
      const site = siteRuntime.sites.find(candidate => candidate.key === key);
      if (!site) continue;
      const label = site.family.replaceAll("-", " ");
      rememberJourney({ kind: "discovered", subjectId: key, companionId: activeAsset?.id, companionName: activeAsset?.manifest.name, label: `Discovered a ${label}`, position: site.entrance });
      markPlaytest("discovery", "success");
      showWorldFeedback(`${activeAsset ? `${activeAsset.manifest.name} is here with you. ` : ""}${wildsDiscoveryImpression(site)}`);
    }
  }, [state.explorationAtlas.siteKeys, siteRuntime, ownerReceizId, activeAsset, rememberJourney, markPlaytest, showWorldFeedback]);
  const siteMovementOutputRef = useRef({ x: 0, z: 0, floorY: 0, ceilingY: Number.POSITIVE_INFINITY, surfaceId: null as string | null, flooded: false, blocked: false, blockedByClimb: false });
  const siteDiscoveryOutputRef = useRef({ siteKey: null as string | null });
  const siteLandingOutputRef = useRef({ x: 0, z: 0, floorY: 0, found: false });
  const refreshLivingWorld = livingWorld.refresh;
  const handleStoryCommandError = useCallback((error: unknown, fallback: string) => {
    if (isWildsTemporalContinuityError(error)) void refreshLivingWorld();
    showWorldFeedback(friendlyWildsGameplayError(error, fallback), true);
  }, [refreshLivingWorld, showWorldFeedback]);
  const kaiMoment = useMemo(() => resolveWildsRuntimeKaiMoment({
    uPulse: kaiUPulse,
    mode: livingWorld.mode,
    cursor: livingWorld.snapshot?.cursor ?? null
  }), [kaiUPulse, livingWorld.mode, livingWorld.snapshot?.cursor]);
  const livePlayerEnergy=useMemo(()=>projectPlayerBreathState({energy:state.energy,playerBreaths:state.playerBreaths},kaiMoment.uPulse),[state.energy,state.playerBreaths,kaiMoment.uPulse]);
  const livePlayerBody=useMemo(()=>playerBreathReadout(livePlayerEnergy.playerBreaths),[livePlayerEnergy.playerBreaths]);
  const presentationState=useMemo(()=>({...state,...livePlayerEnergy}),[state,livePlayerEnergy]);
  // An action settles at the live clock between display ticks. Its source must
  // not appear invalid/depleted while the displayed pulse catches up.
  const nourishmentKaiUPulse = Math.max(kaiUPulse, state.playerNourishment?.lastKaiUPulse ?? 0, state.playerLivestock?.lastKaiUPulse ?? 0);
  const nourishmentPlayer = useMemo(() => ({ ...state.player, y: verticalReadout.layer === 'ground' ? state.siteSpace.position.y : verticalTraversalRef.current.worldY }), [state.player, state.siteSpace.position.y, verticalReadout]);
  const nourishmentPlants = useMemo(() => projectWildsNourishmentPlants({ player: nourishmentPlayer, radius: 28, kaiUPulse:nourishmentKaiUPulse, sourceStates: state.playerNourishment?.sources, spaceId: state.siteSpace.spaceId }), [nourishmentPlayer, nourishmentKaiUPulse, state.playerNourishment?.sources, state.siteSpace.spaceId]);
  const wildAnimals = useMemo(() => projectWildsWildAnimals({ player: nourishmentPlayer, radius: 28, kaiUPulse:nourishmentKaiUPulse, sourceStates: state.playerLivestock?.animals, spaceId: state.siteSpace.spaceId }), [nourishmentPlayer, nourishmentKaiUPulse, state.playerLivestock?.animals, state.siteSpace.spaceId]);
  const ownedLivestock = useMemo(() => livingWorld.snapshot ? projectWildsOwnedLivestock(state.playerLivestock, livingWorld.snapshot, nourishmentKaiUPulse) : [], [state.playerLivestock, livingWorld.snapshot, nourishmentKaiUPulse]);
  const nourishmentActionSource = nourishmentActionId ? nourishmentPlants.find(plant => plant.sourceId === nourishmentActionId)
    ?? wildAnimals.find(animal => animal.animalId === nourishmentActionId && animal.status === 'wild')
    ?? ownedLivestock.find(animal => animal.animalId === nourishmentActionId) ?? null : null;
  const wildAnimalActionsOpen = Boolean(nourishmentActionSource && 'status' in nourishmentActionSource);
  const farmCaptureOpen = Boolean(nourishmentActionSource && 'status' in nourishmentActionSource && nourishmentActionSource.capturable);
  const selectLivestockShelter = useMemo(createWildsLivestockShelterSelector, []);
  const livestockShelter = useMemo(() => (worldOverlayState.panelKey === 'satchel' || farmCaptureOpen) && livingWorld.snapshot ? selectLivestockShelter(livingWorld.snapshot, state.player, ownerReceizId, state.siteSpace.spaceId) : null, [worldOverlayState.panelKey, farmCaptureOpen, livingWorld.snapshot, state.player, ownerReceizId, state.siteSpace.spaceId, selectLivestockShelter]);
  const captureBlocker = !livestockShelter ? 'Finish a nearby room, habitat or garden to shelter livestock.'
    : Object.values(state.playerLivestock?.animals ?? {}).filter(animal => animal.status === 'captured' && animal.shelterId === livestockShelter.shelterId).length >= livestockShelter.capacity
      ? 'This farm is full. Finish another nearby shelter for livestock.' : null;
  const foodPackFull = useMemo(() => availableWildsFood(walletVisibleNourishment).length >= WILDS_NOURISHMENT_PACK_CAPACITY, [walletVisibleNourishment]);
  const huntingCondition = activeAsset ? projectWildsRestedCompanionCondition(state, nourishmentKaiUPulse, activeAsset.id) : undefined;
  const huntingSupport = useMemo(() => worldOverlayState.panelKey === 'satchel' || wildAnimalActionsOpen ? selectWildsHuntingSupport({
    state: state.playerLivestock, ownerReceizId, kaiUPulse: nourishmentKaiUPulse,
    companion: activeAsset ?? undefined, condition: huntingCondition,
    toolWorld: livingWorld.snapshot ?? undefined
  }) : { hunter: null, blocker: null }, [worldOverlayState.panelKey, wildAnimalActionsOpen, state.playerLivestock, ownerReceizId, nourishmentKaiUPulse, activeAsset, huntingCondition, livingWorld.snapshot]);
  useEffect(() => {
    setNourishmentActionId(null); pendingHunt.current = null; setHuntPresentation(null);
  }, [ownerReceizId, state.siteSpace.spaceId]);
  useEffect(() => {
    if (modalOwner !== 'none' || worldOverlayState.panelKey !== null || creationOpen) setNourishmentActionId(null);
  }, [modalOwner, worldOverlayState.panelKey, creationOpen]);
  useEffect(() => {
    if (!huntPresentation) return;
    const timer = window.setTimeout(() => setHuntPresentation(null), Math.max(0, huntPresentation.startedAtMs + WILDS_HUNT_PRESENTATION_MS - performance.now()));
    return () => window.clearTimeout(timer);
  }, [huntPresentation]);

  const energyActivity=aerialMode!=='ground'?aerialMode:verticalReadout.layer==='water'?'swim':'active';
  // Persist elapsed energy on lifecycle/activity changes. The display clock is read-only.
  useEffect(()=>{
    if(!enabled)return;
    // A suspended scene performs no swimming/flight work. Breathing and wake fatigue
    // continue analytically; an existing camp or bed remains in its recovery mode.
    const settle=(quiet=false)=>setState(current=>applyWildsInput(current,{type:'energy-tick',kaiUPulse:readActionKaiUPulse(),energyActivity:quiet?'active':energyActivity}));
    const onVisibility=()=>settle(document.hidden);
    const onPageHide=()=>settle(true);
    onVisibility();
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('pagehide',onPageHide);
    return ()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);};
  },[enabled,energyActivity,readActionKaiUPulse]);
  const roamingBattle = useWildsRoamingBattle({
    enabled: enabled && networkEnabled,
    selfId: multiplayer.selfId,
    notices: multiplayer.snapshot?.roamingEncounters ?? [],
    reportOwner: ownerReceizId,
    getKai: () => createKaiTemporalRoot(kaiMoment),
    readChallengerCard: () => activeAsset && canOperateWildzCrewCard(activeAsset, ownerReceizId, crewCustody)
      ? { card: activeAsset, cardAdmission: createWildzVaultCardMembershipProof(currentVaultAdmission, activeAsset) } : null,
    readOwnedRoamer: (assetId, proofDigest) => {
      const card = crewCards.find(candidate => candidate.id === assetId && candidate.proof.digest === proofDigest);
      const expedition = crewExpeditions.expeditions.get(assetId);
      if (!card || !expedition || expedition.proofDigest !== proofDigest || expedition.recallRequested
        || !["outbound", "observing"].includes(expedition.phase)) return null;
      return { card, expeditionId: expedition.expeditionId, cardAdmission: createWildzVaultCardMembershipProof(currentVaultAdmission, card) };
    },
    onBattleLock: crewExpeditions.setBattleHold,
    onWinningBattle: async encounter => {
      // Transfer authority belongs to capture settlement, not ordinary travel.
      // A wallet or artifact service outage must not stop a companion roaming.
      await walletController.secureTransferAuthority();
      const currentCard = crewControlScope.current.inventory.find(card => card.id === encounter.defenderAssetId
        && canOperateWildzCrewCard(card, crewControlScope.current.owner, crewControlScope.current.custody));
      if (!currentCard || crewControlScope.current.owner !== ownerReceizId) throw new Error("This creature is no longer in your custody.");
      const source = await prepareWildsRoamingOwnerFile(currentCard, ownerReceizId);
      const response = await fetch("/api/wilds/roaming/capture?action=offer", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ battleId: encounter.id, currentCard, source: { exactBytesB64u: receizBase64UrlEncode(source.artifactBytes), filename: source.filename, mimeType: source.mimeType } }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Capture preparation could not complete.");
    },
    isCaptureRestored: encounter => state.inventory.some(card => card.id === encounter.defenderAssetId && canOperateWildzCrewCard(card, ownerReceizId, crewCustody)),
    onClaim: async encounter => {
      const response = await fetch("/api/wilds/roaming/capture?action=claim", { method: "POST", headers: { "content-type": "application/json" }, cache: "no-store", body: JSON.stringify({ battleId: encounter.id }) });
      const result = await response.json() as { error?: string; card?: PortableCardAsset; artifact?: { exactBytesB64u: string; filename: string; mimeType: string } };
      if (!response.ok || !result.card || !result.artifact) throw new Error(result.error ?? "Capture could not complete.");
      const file = new File([receizBase64UrlDecode(result.artifact.exactBytesB64u).slice().buffer], result.artifact.filename, { type: result.artifact.mimeType });
      const committed = await onRestoreRoamingCapture(file, result.card, state);
      setState(current => retainWildsLocalPosition(committed.playState, current));
      showWorldFeedback(`${result.card.manifest.name} joined your collection.`);
    }
  });
  useEffect(() => { setRoamingDialogOpen(roamingBattle.dialogProps.open); }, [roamingBattle.dialogProps.open]);
  const saga = useMemo(() => projectWildsSaga({
    moment: kaiMoment,
    framework: wildsSagaFramework(),
    memories: livingWorld.snapshot?.story.memories ?? []
  }), [kaiMoment, livingWorld.snapshot?.story.memories]);
  const sagaPlayer = livingWorld.snapshot?.players[ownerReceizId] ?? null;
  const explorerWorldRevision = livingWorld.snapshot?.revision;
  useEffect(() => {
    if (explorerWorldRevision === undefined || !sagaPlayer) return;
    setState(current => adoptWildsExplorerSagaProgress(current, {
      ownerReceizId, worldRevision: explorerWorldRevision, player: sagaPlayer
    }));
  }, [explorerWorldRevision, sagaPlayer, ownerReceizId]);
  const wildBattleActive = isWildBattleModalOwner(state.encounter.phase, Boolean(state.battle));
  const { sagaMissions, sagaProgressPercent } = useMemo(() => {
    const sagaContributions: WildsMissionContribution[] = saga.chapter.missions.flatMap((mission) => mission.nodes.flatMap((node) => {
      const amount = sagaPlayer?.contributions[node.id] ?? 0;
      return amount > 0 ? [{
        eventId: `projection:${saga.dayId}:${ownerReceizId}:${node.id}`,
        dayId: saga.dayId,
        objectiveId: node.id,
        playerId: ownerReceizId,
        verb: node.acceptedVerbs[0]!,
        amount
      }] : [];
    }));
    const sagaMissions = projectMissionGraph({ saga, playerId: ownerReceizId, contributions: sagaContributions, currentDayId: saga.dayId });
    const sagaPrimaryNodes = sagaMissions.nodes.filter((node) => node.primary);
    const sagaPrimaryTarget = sagaPrimaryNodes.reduce((total, node) => total + node.target, 0);
    const sagaPrimaryProgress = sagaPrimaryNodes.reduce((total, node) => total + node.progress, 0);
    return { sagaMissions, sagaProgressPercent: sagaPrimaryTarget ? Math.round(sagaPrimaryProgress / sagaPrimaryTarget * 100) : 0 };
  }, [saga, sagaPlayer?.contributions, ownerReceizId]);
  const sagaTrainers = useMemo(() => {
    const sagaTrainerIds = new Set(saga.chapter.trainers.map((trainer) => trainer.id));
    const worldTrainerValues = Object.values(livingWorld.snapshot?.trainers ?? {});
    const worldTrainerMemories = worldTrainerValues.flatMap((trainer) =>
      Array.isArray(trainer.battleMemories) ? trainer.battleMemories as WildsTrainerBattleMemory[] : []
    );
    const projectedTrainers = projectSagaTrainers({
      saga,
      playerLevel: sagaPlayer?.trainerLevel ?? state.level,
      battleMemories: worldTrainerMemories
    });
    const liveSagaTrainers = worldTrainerValues.filter((trainer) => sagaTrainerIds.has(trainer.id)) as unknown as WildsTrainerProjection[];
    const liveSagaTrainerById = new Map(liveSagaTrainers.map((trainer) => [trainer.id, trainer]));
    return projectedTrainers.map((projected) => {
      const live = liveSagaTrainerById.get(projected.id);
      return live ? { ...live, position: projected.position } : projected;
    });
  }, [saga, sagaPlayer?.trainerLevel, state.level, livingWorld.snapshot?.trainers]);
  const openTrainerEncounter = (trainer: WildsTrainerProjection, origin: "world" | "mission") => {
    const trainerActionAllowed = origin === "mission"
      ? modalOwner === "none" && worldOverlayState.panelKey === "mission"
      : canUseWorldStage();
    if (!trainerActionAllowed) return;
    claimPlayModalOwner("trainer");
    if (origin === "mission") dispatchStageOverlay({ type: "panel", key: null });
    void import("@/features/play/WildsTrainerEncounter");
    void import("@/features/games/mortal-arena/MortalArenaExperience");
    presentation.playCue("trainer-challenge");
    const recognized = advanceTrainerEncounter(
      createTrainerEncounter(
        trainer.id,
        { x: state.player.x, z: state.player.z, heading: playerHeading },
        { repeat: trainer.rematchIndex > 0 }
      ),
      { type: "recognize" }
    );
    setCommandDismissSignal((signal) => signal + 1);
    setActiveTrainer(trainer);
    setTrainerEncounter(advanceTrainerEncounter(recognized, { type: "open-challenge" }));
  };
  const sendTrainerEncounter = (event: TrainerEncounterEvent) => {
    setTrainerEncounter((current) => current ? advanceTrainerEncounter(current, event) : current);
  };
  const sagaTournament = useMemo(() => (Object.values(livingWorld.snapshot?.tournaments ?? {}).find((tournament) => tournament.dayId === saga.dayId) ?? null) as WildsTournamentProjection | null, [livingWorld.snapshot?.tournaments, saga.dayId]);
  const kaiExpression = useMemo(() => projectKaiWorldExpression(kaiMoment), [kaiMoment]);
  const commitArenaSettlement = useCallback((settlement: ArenaSettlement) => setState((current) => {
    return applyCommittedArenaSettlement(current, settlement);
  }), []);
  const audioScene = useMemo(() => {
    const biome = projectWildsBiome(
      Math.floor(state.player.x / 12),
      Math.floor(state.player.z / 12),
      state.missionProgress,
      state.worldMastery
    );
    const battleActive = Boolean(state.battle && !["captured", "fled", "defeated"].includes(state.battle.phase));
    const hpRatio = state.battle?.player.hpRatio ?? 1;
    const encounterProximity = "proximity" in state.encounter ? state.encounter.proximity : "cold";
    return projectWildsAudioScene({
      position: state.player,
      biome: biome.chapterId,
      districtId: activeLandmarkId === "wayfinder-hollow" ? activeDistrictId : null,
      landmark: activeLandmarkId === "arena-of-echoes" ? "mortal-arena" : undefined,
      weather: biome.weather,
      time: kaiExpression.dayPhase === "night" ? "night" : "day",
      activity: battleActive ? "combat" : state.encounter.phase === "idle" ? "travel" : "discovery",
      threat: battleActive ? Math.max(.35, 1 - (state.battle?.wild.hpRatio ?? 1)) : encounterProximity === "hot" ? .55 : 0,
      combatPhase: !battleActive ? "none" : hpRatio <= .25 || (state.battle?.wild.hpRatio ?? 1) <= .25 ? "final" : state.battle!.turn <= 2 ? "opening" : "pressure",
      vitalityBand: hpRatio <= .25 ? "critical" : hpRatio <= .55 ? "strained" : "healthy",
      memorial: false,
      reducedMotion
    });
  }, [activeDistrictId, activeLandmarkId, kaiExpression.dayPhase, reducedMotion, state.battle, state.encounter, state.missionProgress, state.player, state.worldMastery]);
  const [embodiedAudioSources] = useState<WildsEmbodiedAudioRegistry>(() => new Map());
  const embodiedCanopy = useMemo(() => siteRuntime.sites.some(site => site.key === state.siteSpace.siteKey && site.family === "canopy-route"), [siteRuntime.sites, state.siteSpace.siteKey]);
  const embodiedSnapshot: WildsEmbodiedSnapshot = {
    listener: aquaticPresentation.mode === "swim" ? { ...state.siteSpace.position, y: aquaticPresentation.actorWorldY } : state.siteSpace.position,
    heading: cameraHeadingRef.current,
    spaceId: state.siteSpace.spaceId,
    grounded: aerialStateRef.current.mode === "ground" && verticalTraversalRef.current.layer === "ground" && state.playerBreaths?.mode !== "bed",
    running: movementMode === "run",
    swimming: aquaticPresentation.mode === "swim",
    underwater: aquaticPresentation.mode === "swim",
    sources: { *[Symbol.iterator]() { let inspected = 0; for (const read of embodiedAudioSources.values()) { if (++inspected > 64) break; const source = read(); if (source) yield source; } } },
    surfaceAt: (point, spaceId) => wildsFootSurfaceAt(point, spaceId, {
      flooded: state.siteSpace.flooded,
      canopy: embodiedCanopy,
      navigation: creationNavigation,
      creations: creationPhysical,
      siteRuntime
    })
  };
  const embodiedSnapshotRef = useRef(embodiedSnapshot);
  embodiedSnapshotRef.current = embodiedSnapshot;
  const readEmbodiedSnapshot = () => ({
    ...embodiedSnapshotRef.current,
    heading: cameraHeadingRef.current,
    aerialMode: aerialStateRef.current.mode,
    grounded: aerialStateRef.current.mode === "ground" && verticalTraversalRef.current.layer === "ground" && embodiedSnapshotRef.current.grounded,
    swimming: aerialStateRef.current.mode === "ground" && (verticalTraversalRef.current.layer === "water" || embodiedSnapshotRef.current.swimming),
    underwater: aerialStateRef.current.mode === "ground" && (verticalTraversalRef.current.layer === "water" || embodiedSnapshotRef.current.underwater),
    listener: verticalTraversalRef.current.layer !== "ground"
      ? { ...embodiedSnapshotRef.current.listener, y: verticalTraversalRef.current.worldY }
      : embodiedSnapshotRef.current.listener
  });
  const presentation = useWildsPresentation({
    audioScene,
    encounter: {
      phase: state.encounter.phase,
      proximity: state.encounter.phase === "idle" ? "cold" : state.encounter.proximity
    },
    enabled,
    embodiedEnabled: enabled && worldVisible && worldInteractionEnabled,
    readEmbodiedSnapshot,
    initialAudioSettings: initialPlayerContinuity?.settings.audio
  });
  const playHuntCue = presentation.playCue;
  useEffect(() => {
    const request = pendingHunt.current;
    if (!request) return;
    const confirmed = confirmWildsAnimalHunt(request, state.playerLivestock, performance.now());
    if (confirmed) { pendingHunt.current = null; setHuntPresentation(confirmed); playHuntCue('battle-hit'); }
  }, [state.playerLivestock, playHuntCue]);
  const vaultWorldId = livingWorld.snapshot ? "wilds:global:v3" : initialPlayerContinuity?.canonicalCursor.worldId ?? "wilds:global:v3";
  const vaultWorldRevision = livingWorld.snapshot?.revision ?? initialPlayerContinuity?.canonicalCursor.revision ?? 0;
  const vaultWorldEventId = livingWorld.snapshot ? livingWorld.snapshot.cursor?.eventId ?? null : initialPlayerContinuity?.canonicalCursor.eventId ?? null;
  // Presentation clock renders must not retire an in-flight Vault preparation.
  const createCurrentPlayerVault = useCallback((asset?: PortableCardAsset) => createWildsPlayerVault({
    playerId: ownerReceizId,
    exportedAt: new Date().toISOString(),
    playState: asset ? { ...state, inventory: [asset] } : state,
    character,
    settings: { avatarStyle: explorerStyle, movementMode, audio: presentation.audioSettings, cardOrder, visual: visualSettings },
    personalEvents: initialPlayerContinuity?.personalEvents ?? [],
    canonicalCursor: { worldId: vaultWorldId, revision: vaultWorldRevision, eventId: vaultWorldEventId },
    receipts: initialPlayerContinuity?.receipts ?? []
  }), [ownerReceizId, state, character, explorerStyle, movementMode, presentation.audioSettings, cardOrder, visualSettings,
    initialPlayerContinuity?.personalEvents, initialPlayerContinuity?.receipts, vaultWorldId, vaultWorldRevision, vaultWorldEventId]);

  walletSourceLive.current.prepareVault = createCurrentPlayerVault;

  const previousKaiTransitionKey = useRef<KaiWorldExpression["transitionKey"] | null>(null);
  const kaiDayKey = kaiExpression.transitionKey.day;
  const kaiBeatKey = kaiExpression.transitionKey.beat;
  const kaiArkKey = kaiExpression.transitionKey.ark;
  const playPresentationCue = presentation.playCue;
  useEffect(() => {
    const next = { day: kaiDayKey, beat: kaiBeatKey, ark: kaiArkKey };
    const kind = kaiTransition(previousKaiTransitionKey.current, next);
    previousKaiTransitionKey.current = next;
    if (kind) playPresentationCue(kind === "ark" ? "kai-ark" : "kai-beat");
  }, [kaiArkKey, kaiBeatKey, kaiDayKey, playPresentationCue]);
  const trailSupportCards = useMemo(() => {
    const byId = new Map(deckCards.map((card) => [card.id, card]));
    return state.supportAssetIds
      .map((id) => id ? byId.get(id) : undefined)
      .filter((card): card is PortableCardAsset => Boolean(card && card.id !== activeAsset?.id));
  }, [activeAsset?.id, deckCards, state.supportAssetIds]);
  const trailPack = useMemo(() => [activeAsset, ...trailSupportCards].filter((card): card is PortableCardAsset => Boolean(card)), [activeAsset, trailSupportCards]);
  const trailSynergy = useMemo(() => deriveLoadoutSynergy(trailPack, worldProgression.chapter.name), [trailPack, worldProgression.chapter.name]);

  useEffect(() => {
    const elapsedNow = () => performance.now();
    const updateKaiMoment = () => {
      const observedUPulse = observeWildsKaiUPulse();
      const elapsedMs = elapsedNow();
      kaiRuntimeClockRef.current ??= createWildsKaiRuntimeClock({
        baselineUPulse: observedUPulse,
        baselineElapsedMs: elapsedMs
      });
      setKaiUPulse(kaiRuntimeClockRef.current.read(elapsedMs, observedUPulse));
    };
    const displayClock = startWildsVisibleDisplayClock({ hidden: () => document.hidden, read: updateKaiMoment,
      schedule: tick => window.setTimeout(tick, millisecondsUntilNextKaiPulse()), cancel: timer => window.clearTimeout(timer) });
    document.addEventListener("visibilitychange", displayClock.visibilityChanged);
    return () => {
      displayClock.dispose();
      document.removeEventListener("visibilitychange", displayClock.visibilityChanged);
    };
  }, []);

  useEffect(() => {
    const previous = previousPlayerPosition.current;
    const deltaX = state.player.x - previous.x;
    const deltaZ = state.player.z - previous.z;
    previousPlayerPosition.current = state.player;
    if (Math.hypot(deltaX, deltaZ) > 3) resetTransientTraversal(state.player, aquaticPresentation.terrainElevation);
    if (Math.hypot(deltaX, deltaZ) > 0.0001) setPlayerHeading(Math.atan2(deltaX, -deltaZ));
  }, [aquaticPresentation.terrainElevation, resetTransientTraversal, state.player]);

  const joinedInvite = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinRoom = params.get("wildsJoin");
    const joinX = Number(params.get("wildsX"));
    const joinZ = Number(params.get("wildsZ"));
    if (!joinedInvite.current && /^invite:[a-f0-9]{16}$/.test(joinRoom ?? "") && Number.isFinite(joinX) && Number.isFinite(joinZ)) {
      joinedInvite.current = true;
      setState((current) => ({
        ...current,
        player: { x: joinX + 1.4, z: joinZ + 1.4 },
        partyTravelRevision: nextWildsPartyTravelRevision(current.partyTravelRevision),
        lastEvent: "Invite signal found. You joined the shared trail beside its sender."
      }));
    }
    setMovementMode(initialPlayerContinuity?.settings.movementMode ?? "walk");
    setCardOrder(initialPlayerContinuity?.settings.cardOrder ?? "rarity");
    setVisualSettings(normalizeWildsVisualSettings(initialPlayerContinuity?.settings.visual));
    setSaveRestored(true);
  }, [initialPlayerContinuity]);

  useEffect(() => {
    if (!saveRestored) return;
    const continuity: WildzPlayerContinuity = {
      settings: {
        avatarStyle: explorerStyle,
        movementMode,
        audio: presentation.audioSettings,
        cardOrder,
        visual: visualSettings
      },
      personalEvents: initialPlayerContinuity?.personalEvents ?? [],
      canonicalCursor: livingWorld.snapshot
        ? {
            worldId: "wilds:global:v3",
            revision: livingWorld.snapshot.revision,
            eventId: livingWorld.snapshot.cursor?.eventId ?? null
          }
        : initialPlayerContinuity?.canonicalCursor ?? { worldId: "wilds:global:v3", revision: 0, eventId: null },
      receipts: initialPlayerContinuity?.receipts ?? []
    };
    const previous = scheduledSourceStateRef.current;
    scheduledSourceStateRef.current = state;
    const sourceTruthChanged = previous.inventory !== state.inventory
      || previous.ownedWorldAdditions !== state.ownedWorldAdditions;
    playStatePublisherRef.current?.schedule({ state, continuity, onChange: onPlayStateChangeRef.current }, sourceTruthChanged);
  }, [
    cardOrder,
    explorerStyle,
    initialPlayerContinuity,
    livingWorld.snapshot,
    movementMode,
    presentation.audioSettings,
    saveRestored,
    state,
    visualSettings
  ]);

  useEffect(() => {
    const publisher = playStatePublisherRef.current;
    if (!publisher) return;
    const flush = () => { void publisher.flush().catch(() => undefined); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    if (state.encounter.phase === "battle_intro") {
      const timer = window.setTimeout(() => {
        const uPulse = kaiRuntimeClockRef.current?.read(performance.now(), observeWildsKaiUPulse()) ?? observeWildsKaiUPulse();
        setState((current) => applyWildsInput(current, rootWildsInputInKai({ type: "start-battle", at: kaiUPulseToISOString(uPulse) }, uPulse)));
      }, 0);
      return () => window.clearTimeout(timer);
    }
    // Presentation time lets the capsule play before revealing the reward.
    // It runs locally and never waits for publication or network sync.
    const delay = state.encounter.phase === "emerging" ? 1_050 : state.encounter.phase === "capsule" ? 1_250 : state.encounter.phase === "sealed" ? 700 : null;
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      const uPulse = kaiRuntimeClockRef.current?.read(performance.now(), observeWildsKaiUPulse()) ?? observeWildsKaiUPulse();
      setState((current) => applyWildsInput(current, rootWildsInputInKai({ type: "advance-encounter", at: kaiUPulseToISOString(uPulse) }, uPulse)));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.encounter.phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!worldInteractionEnabled) return;
      const input = worldInputForKeyboardEvent(event);
      if (!input) return;
      event.preventDefault();
      worldInputDispatcherRef.current?.(input);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onComplete, worldInteractionEnabled]);

  const activeGrove = activeGroveId ? livingWorld.snapshot?.groves[activeGroveId] ?? null : null;
  const activeCondition = activeAsset
    ? state.adventureConditions[activeAsset.id] ?? emptyAdventureCondition(activeAsset.id)
    : null;
  const activeGroveMandate = useMemo(() => {
    if (!activeGrove || !activeAsset || !activeCondition) return null;
    const creatureHead = sha256PortableBasis(activeAsset.proof.digest);
    const creatureSubjectId = `creature:${sha256PortableBasis(activeAsset.id).slice(0, 32)}`;
    const consent = evaluateWildsCreatureConsent({
      creatureSubjectId,
      creatureHead,
      condition: {
        energy: Math.max(0, 100 - activeCondition.fatigue),
        fatigue: activeCondition.fatigue,
        injury: Math.min(100, activeCondition.injuries.length * 24),
        stress: Math.min(100, Math.round(activeCondition.fatigue * .6))
      },
      bond: 70,
      preferences: { professions: GROVE_CREATURE_PROFESSIONS, avoidHazards: [] },
      capabilities: { professions: GROVE_CREATURE_PROFESSIONS },
      safety: { risk: activeGrove.weather.hazardCues.length * 18, hazards: activeGrove.weather.hazardCues, supportAvailable: multiplayer.remotePlayers.length > 0 },
      requested: { professions: GROVE_CREATURE_PROFESSIONS, maxActions: 8 },
      kaiUPulse: kaiMoment.uPulse
    });
    if (consent.decision !== "accept") return null;
    return createWildsCreatureMandate({
      consent,
      creatureSubjectId,
      creatureHead,
      region: { x: Math.floor(activeGrove.position.x / 64), z: Math.floor(activeGrove.position.z / 64) },
      professions: GROVE_CREATURE_PROFESSIONS,
      allowedResourceIds: [activeGrove.groveId],
      maxActions: 8,
      issuedAtKaiUPulse: kaiMoment.uPulse,
      expiresAtKaiUPulse: kaiMoment.uPulse + 10_000_000
    });
  }, [activeAsset, activeCondition, activeGrove, kaiMoment.uPulse, multiplayer.remotePlayers.length]);
  const activeGrovePreviews = useMemo(() => {
    if (!activeGrove) return [];
    const emission = wildsWorldSourceEmission(livingWorld.snapshot);
    return activeGrove.availableActions.map((action) => previewWildsGroveAction({
      grove: activeGrove,
      action,
      actor: { id: ownerReceizId, head: sha256PortableBasis(ownerReceizId) },
      ...(activeGroveMandate ? { mandate: activeGroveMandate } : {}),
      weather: activeGrove.weather,
      moment: kaiMoment,
      emission
    }));
  }, [activeGrove, activeGroveMandate, kaiMoment, livingWorld.snapshot, ownerReceizId]);
  const activeGroveActions = useMemo<WildsGroveExperienceAction[]>(() => activeGrovePreviews.map((preview) => ({
    action: preview.action,
    valid: preview.valid,
    reason: preview.valid ? null : groveReason(preview.reasons[0]),
    consequence: groveConsequence(preview.action),
    amountPhiMicro: preview.emission.amountPhiMicro
  })), [activeGrovePreviews]);
  const walletSourceLots = useMemo(() => selectWildsWalletSourceLotsV128({world: livingWorld.snapshot, ownerReceizId,
    availableMembers: walletSourceProjection.availableMembers, lockedMemberIds: walletSourceProjection.lockedMemberIds}), [livingWorld.snapshot, ownerReceizId, walletSourceProjection]);
  const availableMaterialLots = walletSourceLots.materialLots;
  const availableWalletResourceLots = walletSourceLots.resourceLots;
  const walletPackagedResourceUnits = useMemo(() => Object.values(livingWorld.snapshot?.resourcePackages ?? {})
    .filter(record => record.status !== "unpacked" && sameWildzPlayerCoordinate(record.ownerReceizId, ownerReceizId))
    .reduce((total, record) => total + record.package.members.reduce((units, member) => units + (member.kind === "resource" ? member.resourceLot.quantity : 1), 0), 0), [livingWorld.snapshot?.resourcePackages, ownerReceizId]);
  const walletResourceCards = useMemo(() => [...resourceExchange.cards, ...walletSourceProjection.cards.filter(card => card.ownerHandle === walletTradeOwnerHandle && card.kind !== "sent" && (card.kind !== "unpacked" || card.unpackable))], [resourceExchange.cards, walletSourceProjection.cards, walletTradeOwnerHandle]);
  marketReadSelectionsRef.current = () => projectWildzMarketHeldSelectionsV128({cards: walletSourceLive.current.state.inventory,
    canOperate: card => canOperateWildzCrewCard(card, walletSourceLive.current.ownerReceizId, walletSourceLive.current.crewCustody),
    nourishment: walletVisibleNourishment, materialLots: availableMaterialLots, resourceLots: availableWalletResourceLots, resourceCards: walletResourceCards});
  const walletSourcePackedUnits = useMemo(() => currentWalletSourceRows.filter(row => row.currentOwnerHandle === row.ownerHandle && row.kind !== "unpacked" && row.kind !== "sent").reduce((total, row) => total + row.memberRefs.reduce((units, member) => units + member.quantity, 0), 0), [currentWalletSourceRows]);
  const stewardMaterials = useMemo(() => ({
    hay: availableMaterialLots.filter((lot) => lot.kind === "hay").length,
    timber: availableMaterialLots.filter((lot) => lot.kind === "timber").length,
    stone: availableMaterialLots.filter((lot) => lot.kind === "stone").length
  }), [availableMaterialLots]);
  const stewardWorkMeters = useMemo(() => projectWildsWorkCapabilityMeters(activeAsset ?? null, activeCondition), [activeAsset, activeCondition]);
  const ownedFunctionalPieces = useMemo(() => Object.values(livingWorld.snapshot?.constructionComponents ?? {})
    .filter(component => sameWildzPlayerCoordinate(component.ownerReceizId, ownerReceizId)), [livingWorld.snapshot?.constructionComponents, ownerReceizId]);
  const ownedStructures = useMemo(() => Object.values(livingWorld.snapshot?.structures ?? {})
    .filter(structure => sameWildzPlayerCoordinate(structure.ownerReceizId, ownerReceizId)), [livingWorld.snapshot?.structures, ownerReceizId]);
  const unfinishedConstructionSites = useMemo(() => Object.values(livingWorld.snapshot?.constructionSites ?? {})
    .filter(site => site.stage !== "complete"), [livingWorld.snapshot?.constructionSites]);
  const nearbyFunctionalPieces = useMemo(() => ownedFunctionalPieces.filter(component => Math.hypot(component.transform.position.x - state.player.x, component.transform.position.z - state.player.z) <= 6), [ownedFunctionalPieces, state.player.x, state.player.z]);
  const availableBed = useMemo(() => livingWorld.snapshot && !state.battle && aerialMode === "ground" && aquaticPresentation.mode !== "swim"
    ? selectWildsBedAtPlayer(livingWorld.snapshot, state.player, state.siteSpace) : null,
  [livingWorld.snapshot, state.battle, state.player, state.siteSpace, aerialMode, aquaticPresentation.mode]);
  const bedObservationKaiUPulse=Math.max(kaiUPulse,state.playerBreaths?.lastKaiUPulse??0);
  const availableCreationBed = useMemo(() => creationController.snapshot().revision === creationPhysical.revision && !state.battle && aerialMode === 'ground' && aquaticPresentation.mode !== 'swim'
    ? selectCreationBedAtPlayer(creationController.snapshot, state.player, state.siteSpace, ownerReceizId, bedObservationKaiUPulse) : null,
  [creationController, creationPhysical, state.battle, state.player, state.siteSpace, ownerReceizId, bedObservationKaiUPulse, aerialMode, aquaticPresentation.mode]);
  const sleepingInBed = state.playerBreaths?.mode === 'bed' && Boolean(
    availableBed && state.playerBedRest?.componentId === availableBed.component.componentId && state.playerBedRest.componentHead === availableBed.head
    || availableCreationBed && state.playerBedRest?.instanceId === availableCreationBed.instanceId && state.playerBedRest.nodeId === availableCreationBed.nodeId && state.playerBedRest.componentHead === availableCreationBed.head);
  // An unresolved future checkpoint gets one retry when the display clock
  // catches up, rather than publishing bed reconciliation on every tick.
  const unresolvedBedClockReady=state.playerBreaths?.mode==='bed'&&!sleepingInBed&&kaiUPulse>=state.playerBreaths.lastKaiUPulse;
  const sleepHere = () => {
    if (availableCreationBed) dispatch({ type: 'rest', creationBed: availableCreationBed });
    else if (availableBed) dispatch({ type: 'rest', bed: availableBed });
    else dispatch({ type: 'sleep' });
  };
  useEffect(() => {
    // A physical source change is meaningful; display-clock ticks never publish this state.
    if (!livingWorld.snapshot || state.playerBreaths?.mode !== "bed" || sleepingInBed) return;
    setState(current => {
      const observationKai=Math.max(readActionKaiUPulse(),current.playerBreaths?.lastKaiUPulse??0);
      const created=selectCreationBedAtPlayer(creationController.snapshot,current.player,current.siteSpace,ownerReceizId,observationKai);
      const manual=livingWorld.snapshot?selectWildsBedAtPlayer(livingWorld.snapshot,current.player,current.siteSpace):null;
      const marker=current.playerBedRest;
      const bedAvailable=Boolean(marker&&(created&&marker.instanceId===created.instanceId&&marker.nodeId===created.nodeId&&marker.componentHead===created.head
        ||manual&&marker.componentId===manual.component.componentId&&marker.componentHead===manual.head));
      return reconcileWildsBedRest(current,{worldReady:Boolean(livingWorld.snapshot),creationReady:creationRestorationReady,bedAvailable,
        restoredFloorY:creationRestorationReady&&marker?restoredCreationBedFloor(creationController.snapshot,marker,current.player,current.siteSpace.spaceId,ownerReceizId,observationKai):null,
        readKai:readActionKaiUPulse});
    });
  }, [livingWorld.snapshot, sleepingInBed, unresolvedBedClockReady, state.playerBreaths?.mode, creationRestorationReady, creationController, ownerReceizId, readActionKaiUPulse]);

  const nearbyStewardWorkbench = useMemo(() => ownedStructures.find(structure => structure.blueprint === "steward-workbench" && Math.hypot(structure.position.x - state.player.x, structure.position.z - state.player.z) <= 6)
    ?? nearbyFunctionalPieces.filter(component => component.kind === "workshop").map(component => resolveWildsConstructionFunction(livingWorld.snapshot!, component.componentId, "workshop")).find(Boolean) ?? null, [livingWorld.snapshot, ownedStructures, nearbyFunctionalPieces, state.player.x, state.player.z]);
  const nearbyTrailCache = useMemo(() => ownedStructures.find(structure => structure.blueprint === "trail-cache" && Math.hypot(structure.position.x - state.player.x, structure.position.z - state.player.z) <= 6)
    ?? nearbyFunctionalPieces.filter(component => component.kind === "storage").map(component => resolveWildsConstructionFunction(livingWorld.snapshot!, component.componentId, "storage")).find(Boolean) ?? null, [livingWorld.snapshot, ownedStructures, nearbyFunctionalPieces, state.player.x, state.player.z]);
  const nearbyConstructionSite = useMemo(() => unfinishedConstructionSites
    .filter((site) => Math.hypot(site.position.x - state.player.x, site.position.z - state.player.z) <= 7)
    .sort((left, right) => Math.hypot(left.position.x - state.player.x, left.position.z - state.player.z)
      - Math.hypot(right.position.x - state.player.x, right.position.z - state.player.z) || left.siteId.localeCompare(right.siteId))[0] ?? null,
  [unfinishedConstructionSites, state.player.x, state.player.z]);
  const nearbyLivingSiteCandidates = useMemo(() => Object.values(livingWorld.snapshot?.sites ?? {})
    .filter(site => Boolean(site.bossId) && site.phase !== "memorialized" && site.phase !== "expired"), [livingWorld.snapshot?.sites]);
  const nearbyEcologyCandidates = useMemo(() => Object.values(livingWorld.snapshot?.ecologySites ?? {})
    .filter(site => site.phase === "foreshadowed" || site.phase === "discovered" || site.phase === "active"), [livingWorld.snapshot?.ecologySites]);
  const nearbyGroveCandidates = useMemo(() => Object.values(livingWorld.snapshot?.groves ?? {}), [livingWorld.snapshot?.groves]);
  const stewardTools = useMemo(() => Object.values(livingWorld.snapshot?.stewardTools ?? {}).filter((tool) => sameWildzPlayerCoordinate(tool.ownerReceizId, ownerReceizId)), [livingWorld.snapshot?.stewardTools, ownerReceizId]);
  const storedStewardLots = useMemo(() => Object.entries(livingWorld.snapshot?.storedMaterialLots ?? {})
    .filter(([, cacheId]) => cacheId === nearbyTrailCache?.structureId)
    .map(([lotId]) => livingWorld.snapshot?.materialLots[lotId]).filter(Boolean), [livingWorld.snapshot?.materialLots, livingWorld.snapshot?.storedMaterialLots, nearbyTrailCache?.structureId]);
  const stewardCraft = useMemo(() => projectWildsStewardCraft({
    activeCreatureName: activeAsset?.manifest.name ?? activeCard.name,
    materialLots: availableMaterialLots,
    pending: Boolean(livingWorld.pendingCommand),
    selectedBlueprintId: stewardPlacementMode,
    workMeters: stewardWorkMeters
  }), [activeAsset?.manifest.name, activeCard.name, availableMaterialLots, livingWorld.pendingCommand, stewardPlacementMode, stewardWorkMeters]);
  const continuousBuilder = useWildsContinuousBuilder({ spaceId:state.siteSpace.spaceId, world: livingWorld, owner: ownerReceizId, player: state.player, lots: availableMaterialLots, feedback: showWorldFeedback });

  const burrowBuilder = useWildsBurrowBuilder({world:livingWorld,physical:sitePhysical,space:state.siteSpace,player:state.player,owner:ownerReceizId,card:activeAsset,feedback:showWorldFeedback,onDig:()=>{spendWorldCapability("burrow");},onEnter:(siteKey)=>dispatch({type:"site-portal",direction:"enter",siteKey,siteRuntime})});
  const selectLivingBuildPiece = (kind: Parameters<typeof continuousBuilder.selectKind>[0]) => {
    beginWorldActionFeedback(); burrowBuilder.close(); setConstructionFocus(null);
    setStewardPlacementMode(null); setStewardPlacementPreview(null);
    continuousBuilder.begin(); continuousBuilder.selectKind(kind);
    dispatchStageOverlay({ type: "panel", key: null });
  };
  manualCreationAction.current=()=>selectLivingBuildPiece(continuousBuilder.kind);
  const openLivingConstruction = (focus: "tools" | "storage" | null = null) => {
    continuousBuilder.close(); setConstructionFocus(focus);
    dispatchStageOverlay({ type: "panel", key: "construction" });
  };

  const createStewardMandate = (
    professions: readonly string[],
    allowedResourceIds: readonly string[],
    region: { x: number; z: number },
    partner = activeAsset,
    partnerCondition = activeCondition
  ) => {
    if (!partner || !partnerCondition) throw new Error("Choose a rested companion to work beside you.");
    const creatureHead = sha256PortableBasis(partner.proof.digest);
    const creatureSubjectId = `creature:${sha256PortableBasis(partner.id).slice(0, 32)}`;
    const normalizedProfessions = [...new Set(professions)].sort((left, right) => left.localeCompare(right));
    const consent = evaluateWildsCreatureConsent({
      creatureSubjectId,
      creatureHead,
      condition: {
        energy: Math.max(0, 100 - partnerCondition.fatigue),
        fatigue: partnerCondition.fatigue,
        injury: Math.min(100, partnerCondition.injuries.length * 24),
        stress: Math.min(100, Math.round(partnerCondition.fatigue * .6))
      },
      bond: state.companionProgress[partner.manifest.familyId]?.bond ?? 70,
      preferences: { professions: normalizedProfessions, avoidHazards: [] },
      capabilities: { professions: normalizedProfessions },
      safety: { risk: 6, hazards: [], supportAvailable: multiplayer.remotePlayers.length > 0 },
      requested: { professions: normalizedProfessions, maxActions: 8 },
      kaiUPulse
    });
    if (consent.decision !== "accept") throw new Error(consent.reasons[0] ?? "Your companion needs a pause.");
    return createWildsCreatureMandate({
      consent,
      creatureSubjectId,
      creatureHead,
      region,
      professions: normalizedProfessions,
      allowedResourceIds: [...allowedResourceIds].sort((left, right) => left.localeCompare(right)),
      maxActions: 8,
      issuedAtKaiUPulse: kaiUPulse,
      expiresAtKaiUPulse: kaiUPulse + 10_000_000
    });
  };

  const gatherStewardResource = async (source: WildsResourceSource, admittedHudAction = false) => {
    if ((!admittedHudAction && !canUseWorldStage()) || livingWorld.pendingCommand || harvestPendingRef.current) {
      if (admittedHudAction) showWorldFeedback("Your current work is settling. The satchel count will update here before the next source can be gathered.");
      return;
    }
    beginWorldActionFeedback();
    if (Math.hypot(source.position.x - state.player.x, source.position.z - state.player.z) > 5.5) {
      showWorldFeedback(`Move beside the ${source.kind === "timber" ? "tree" : source.kind === "hay" ? "hay patch" : "stone"}, then touch its glowing ring to gather it.`);
      return;
    }
    try {
      const partner = selectWildsResourceWorkPartner(state.inventory, state.adventureConditions, source.requirements.creature, activeAsset?.id);
      const partnerCondition = partner ? state.adventureConditions[partner.id] ?? emptyAdventureCondition(partner.id) : null;
      if (source.kind !== "hay" && !partner) {
        showWorldFeedback(source.kind === "stone"
          ? "Stone needs a rested companion with Quarry work. A Woodland companion can gather timber, but cannot mine rock."
          : "Timber needs a rested companion with Woodland work. Choose a capable companion or let them recover first.");
        return;
      }
      if (partner && partner.id !== activeAsset?.id) {
        setState((current) => applyWildsInput(current, { type: "select-asset", assetId: partner.id, kaiUPulse }));
      }
      const current = livingWorld.snapshot?.harvestedSources[source.sourceId] ?? initialWildsHarvestedSourceState(source);
      const availability = projectWildsResourceAvailability(source, {
        admittedHarvestedCapacity: current.harvestedCapacity,
        lastHarvestKaiPulse: current.lastHarvestKaiPulse,
        currentKaiPulse: String(kaiUPulse)
      });
      if (availability.clockPending) {
        showWorldFeedback("This resource has a newer update. Wait a moment, then gather again.");
        return;
      }
      if (availability.availableCapacity === 0) {
        const remainingMicroPulses = availability.nextChangeKaiPulse
          ? BigInt(availability.nextChangeKaiPulse) - BigInt(kaiUPulse)
          : 0n;
        const remainingSeconds = Math.max(1, Number(remainingMicroPulses > 0n ? remainingMicroPulses / 1_000_000n : 0n));
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        const wait = minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
        const sourceLabel = source.kind === "timber" ? "tree" : source.kind === "hay" ? "hay patch" : "stone";
        showWorldFeedback(`This ${sourceLabel} is regrowing. Its dim ring brightens in ${wait}; use any bright ${sourceLabel} ring now.`);
        return;
      }
      const mandate = partner && partnerCondition
        ? createStewardMandate([source.requirements.creature], [source.sourceId], { x: source.regionX, z: source.regionZ }, partner, partnerCondition)
        : undefined;
      let partnerAdmission: WildzVaultCardMembershipProof | null = null;
      try {
        if (!partner) throw new Error("solo_harvest");
        partnerAdmission = createWildzVaultCardMembershipProof(currentVaultAdmission, partner);
      } catch {
        partnerAdmission = null;
      }
      const workStartedAtMs = performance.now();
      // Hay retains its existing hand-gathered proof. A rested companion can
      // present the trip without inventing another contributor or harvest.
      const presentationPartner = partner ?? (source.kind === "hay" && activeAsset && activeCondition
        && activeCondition.life !== "dead" && !activeCondition.retiredAt && activeCondition.fatigue < 85
        && activeCondition.injuries.length < 4 ? activeAsset : null);
      const arrival = { atMs: null } as { atMs: number | null };
      setActiveWorkSource(presentationPartner ? { arrival, assetId: presentationPartner.id, sourceId: source.sourceId,
        kind: source.kind === "hay" ? "hay" : source.kind === "timber" ? "timber" : "stone", position: source.position,
        startedAtMs: workStartedAtMs, settledAtMs: null,
        onComplete: () => setActiveWorkSource(active => active?.startedAtMs === workStartedAtMs ? null : active) } : null);
      const priorAwards = new Set(Object.keys(livingWorld.snapshot?.stewardPhiAwards ?? {}));
      markPlaytest("harvest", "start");
      harvestPendingRef.current = true;
      const projection = await livingWorld.harvestMaterial(source, current.head, state.player, mandate, partner ? { card: partner, cardAdmission: partnerAdmission } : null);
      markPlaytest("harvest", "success");
      rememberJourney({ kind: "harvest", subjectId: source.sourceId, companionId: partner?.id, companionName: partner?.manifest.name, label: partner ? `Gathered ${source.kind} together` : `Gathered ${source.kind}`, position: source.position });
      if (partner) dispatch({ type: "record-steward-work", assetId: partner.id });
      // Save/credit remains immediate. The existing frame loop separately finishes
      // the physical approach, work gesture and return without holding admission.
      const settledAtMs = performance.now();
      setActiveWorkSource((active) => active?.startedAtMs === workStartedAtMs ? { ...active, settledAtMs } : active);
      const award = Object.values(projection.stewardPhiAwards).find((candidate) => !priorAwards.has(candidate.awardId));
      const awardMessage = award ? `+Φ${formatWildsPhiExact(award.amountPhiMicro)} earned · ` : "";
      const satchelCount = Object.values(projection.materialLots).filter((lot) => lot.kind === source.kind
        && sameWildzPlayerCoordinate(wildsMaterialCustodian(projection, lot), ownerReceizId)
        && !projection.consumedMaterialLots[lot.lotId] && !projection.storedMaterialLots[lot.lotId]
        && !projection.reservedMaterialLots[lot.lotId]).length;
      showWorldFeedback(`${awardMessage}+1 ${source.kind} · Satchel ${satchelCount}. ${partner ? `${partner.manifest.name} helped and spent 3% capacity.` : ""}`);
    } catch (error) {
      markPlaytest("harvest", "failure");
      setActiveWorkSource((active) => active?.sourceId === source.sourceId ? null : active);
      handleStoryCommandError(error, `That ${source.kind === "timber" ? "tree" : source.kind === "hay" ? "hay patch" : "stone"} cannot be gathered from this position. Move inside its bright ring and tap again.`);
    } finally {
      harvestPendingRef.current = false;
    }
  };

  const gatherNearestStewardResource = (family: WildsVisibleWorkFamily | "gather") => {
    if (livingWorld.pendingCommand) {
      showWorldFeedback("Your current work is settling. The satchel count will update here before the next source can be gathered.");
      return;
    }
    if (state.siteSpace.spaceId !== "wildz.space.outer.v1") {
      showWorldFeedback("Return to the open world to gather living materials.");
      return;
    }
    if (family === "gather" && aerialStateRef.current.mode !== "ground") {
      showWorldFeedback("Land beside a hay patch to gather it.");
      return;
    }
    const candidates = [] as Array<{ source: WildsResourceSource; availableCapacity: number }>;
    // Hay is sparse. Discover it on this explicit action using the nine already
    // cached resource regions, rather than scanning farther on walking frames.
    const sources = family === "gather" ? (() => {
      const region = wildsResourceRegionForPosition(state.player);
      const hay: WildsResourceSource[] = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        try { hay.push(...projectWildsResourceRegion(region.x + dx, region.z + dz).filter(source => source.kind === "hay")); }
        catch { /* Neighbouring regions outside world bounds have no sources. */ }
      }
      return hay;
    })() : constructionSourcesNear(state.player, projectWildsResourceRegion);
    for (const source of sources) {
      const harvested = livingWorld.snapshot?.harvestedSources[source.sourceId];
      const availability = projectWildsResourceAvailability(source, {
        admittedHarvestedCapacity: harvested?.harvestedCapacity ?? 0,
        lastHarvestKaiPulse: harvested?.lastHarvestKaiPulse ?? "0",
        currentKaiPulse: String(kaiUPulse)
      });
      candidates.push({ source, availableCapacity: availability.availableCapacity });
    }
    const source = selectNearestWildsWorkSource(candidates, family, state.player, 5.5);
    if (!source) {
      const destination = selectNearestWildsWorkSource(candidates, family, state.player, 1000);
      const material = family === "lumber" ? "timber" : family === "gather" ? "hay" : "stone";
      if (destination) setTrackedDestination({ label: `Gather ${material}`, x: destination.position.x, z: destination.position.z, ...(family === "gather" ? { resourceKind: "hay" as const } : {}) });
      showWorldFeedback(destination ? "Follow the marked resource, then gather inside its ring." : `No available ${material} nearby. Explore farther to find some.`);
      return;
    }
    void gatherStewardResource(source, true);
  };

  const placeTrailShelter = async (position: { x: number; z: number }) => {
    if (stewardPlacementMode !== "trail-shelter" || livingWorld.pendingCommand) return;
    beginWorldActionFeedback();
    if (Math.hypot(position.x - state.player.x, position.z - state.player.z) > 7) {
      showWorldFeedback("Place the shelter within 7 metres of you.");
      return;
    }
    try {
      const timber = availableMaterialLots.filter((lot) => lot.kind === "timber").slice(0, 2);
      const stone = availableMaterialLots.filter((lot) => lot.kind === "stone").slice(0, 1);
      if (timber.length !== 2 || stone.length !== 1) throw new Error("Gather 2 timber and 1 stone first.");
      await livingWorld.placeConstructionSite("trail-shelter", position, state.player, 0, [...timber, ...stone].map((lot) => lot.lotId));
      setStewardPlacementMode(null);
      setStewardPlacementPreview(null);
      dispatchStageOverlay({ type: "panel", key: "construction" });
      showWorldFeedback("Shelter materials placed. Tap Finish shelter to build it yourself. No workbench or companion is required.");
    } catch (error) {
      handleStoryCommandError(error, "That place cannot hold a shelter yet.");
    }
  };

  const placeTrailBridge = async (position: { x: number; z: number }) => {
    if (stewardPlacementMode !== "trail-bridge" || livingWorld.pendingCommand) return;
    beginWorldActionFeedback();
    if (Math.hypot(position.x - state.player.x, position.z - state.player.z) > 7) {
      showWorldFeedback("Choose a crossing within 7 metres of you.");
      return;
    }
    try {
      const rotationQuarterTurns = selectWildsTrailBridgeRotation(position);
      if (rotationQuarterTurns === null) throw new Error("Choose water between two nearby, level banks.");
      const timber = availableMaterialLots.filter((lot) => lot.kind === "timber").slice(0, 4);
      const stone = availableMaterialLots.filter((lot) => lot.kind === "stone").slice(0, 2);
      if (timber.length !== 4 || stone.length !== 2) throw new Error("Gather 4 timber and 2 stone first.");
      await livingWorld.placeConstructionSite("trail-bridge", position, state.player, rotationQuarterTurns, [...timber, ...stone].map((lot) => lot.lotId));
      setStewardPlacementMode(null);
      setStewardPlacementPreview(null);
      dispatchStageOverlay({ type: "panel", key: "construction" });
      showWorldFeedback("Bridge materials placed. Tap Finish bridge to build it yourself. No workbench or companion is required.");
    } catch (error) {
      handleStoryCommandError(error, "That crossing cannot hold a bridge yet.");
    }
  };

  const contributeNearbyConstructionSite = async (site: WildsConstructionSiteV1) => {
    beginWorldActionFeedback();
    const haveTimber = site.contributedLots.filter((entry) => entry.kind === "timber").length;
    const haveStone = site.contributedLots.filter((entry) => entry.kind === "stone").length;
    const timber = availableMaterialLots.filter((lot) => lot.kind === "timber").slice(0, site.materialsRequired.timber - haveTimber);
    const stone = availableMaterialLots.filter((lot) => lot.kind === "stone").slice(0, site.materialsRequired.stone - haveStone);
    const lots = [...timber, ...stone];
    if (!lots.length) return showWorldFeedback(`This site still needs ${site.materialsRequired.timber - haveTimber} timber and ${site.materialsRequired.stone - haveStone} stone. Gather either living source and return.`);
    try {
      const projection = await livingWorld.contributeConstructionSite(site.siteId, site.head, state.player, lots.map((lot) => lot.lotId));
      const next = projection.constructionSites[site.siteId];
      showWorldFeedback(next?.stage === "materials-ready" ? "All materials are at the site. Tap Finish to build it yourself; no workbench or companion is required." : "Your exact lots are now visible in this site. Other stewards can add what remains.");
    } catch (error) { handleStoryCommandError(error, "Those exact lots could not enter this site yet."); }
  };

  const workNearbyConstructionSite = async (site: WildsConstructionSiteV1) => {
    beginWorldActionFeedback();
    try {
      const priorAwards = new Set(Object.keys(livingWorld.snapshot?.stewardPhiAwards ?? {}));
      markPlaytest("placement", "start");
      const projection = await livingWorld.workConstructionSite(site.siteId, site.head, state.player);
      markPlaytest("placement", "success");
      rememberJourney({ kind: "built", subjectId: site.siteId, companionId: activeAsset?.id, companionName: activeAsset?.manifest.name, label: `Finished a ${site.blueprint === "trail-shelter" ? "trail shelter" : "bridge"}`, position: site.position });
      const award = Object.values(projection.stewardPhiAwards).find((candidate) => !priorAwards.has(candidate.awardId));
      showWorldFeedback(`${site.blueprint === "trail-shelter" ? "The Trail Shelter now stands. Choose a building piece below to add walls, stairs or a roof. A workbench is only needed to craft an axe or pick" : "The Trail Bridge now joins both banks"}.${award ? ` Φ${formatWildsPhiExact(award.amountPhiMicro)} settled from the useful work.` : ""}`);
    } catch (error) { markPlaytest("placement", "failure"); handleStoryCommandError(error, "This build could not finish yet. Your placed materials are preserved. Try Finish again."); }
  };

  const placeStewardGroundStructure = async (blueprint: "steward-workbench" | "trail-cache", position: { x: number; z: number }) => {
    if (stewardPlacementMode !== blueprint || livingWorld.pendingCommand) return;
    beginWorldActionFeedback();
    const definition = blueprint === "steward-workbench"
      ? { label: "Steward Workbench", timber: 3, stone: 2, build: livingWorld.buildStewardWorkbench }
      : { label: "Trail Cache", timber: 2, stone: 2, build: livingWorld.buildTrailCache };
    try {
      const timber = availableMaterialLots.filter((lot) => lot.kind === "timber").slice(0, definition.timber);
      const stone = availableMaterialLots.filter((lot) => lot.kind === "stone").slice(0, definition.stone);
      if (timber.length !== definition.timber || stone.length !== definition.stone) throw new Error(`Gather ${definition.timber} timber and ${definition.stone} stone first.`);
      const priorAwards = new Set(Object.keys(livingWorld.snapshot?.stewardPhiAwards ?? {}));
      markPlaytest("placement", "start");
      const projection = await definition.build(position, state.player, 0, [...timber, ...stone].map((lot) => lot.lotId));
      markPlaytest("placement", "success");
      const built = Object.values(projection.structures).find(item => item.blueprint === blueprint && item.position.x === position.x && item.position.z === position.z && sameWildzPlayerCoordinate(item.ownerReceizId, ownerReceizId));
      if (built) rememberJourney({ kind: "built", subjectId: built.structureId, companionId: activeAsset?.id, companionName: activeAsset?.manifest.name, label: `Built a ${definition.label}`, position: built.position });
      const award = Object.values(projection.stewardPhiAwards).find((candidate) => !priorAwards.has(candidate.awardId));
      setStewardPlacementMode(null);
      setStewardPlacementPreview(null);
      showWorldFeedback(`Your ${definition.label} now persists in the shared Wilds.${award ? ` Φ${formatWildsPhiExact(award.amountPhiMicro)} settled from the work.` : ""}`);
    } catch (error) {
      markPlaytest("placement", "failure");
      handleStoryCommandError(error, `That place cannot hold a ${definition.label.toLowerCase()} yet.`);
    }
  };

  const craftStewardTool = async (kind: "steward-axe" | "quarry-pick") => {
    beginWorldActionFeedback();
    if (!nearbyStewardWorkbench) return showWorldFeedback("Approach your Steward Workbench before shaping a tool.");
    try {
      const timber = availableMaterialLots.filter((lot) => lot.kind === "timber").slice(0, 1);
      const stoneNeeded = kind === "steward-axe" ? 1 : 2;
      const stone = availableMaterialLots.filter((lot) => lot.kind === "stone").slice(0, stoneNeeded);
      if (timber.length !== 1 || stone.length !== stoneNeeded) throw new Error(`Crafting needs 1 timber and ${stoneNeeded} stone.`);
      await livingWorld.craftStewardTool(kind, nearbyStewardWorkbench.structureId, state.player, [...timber, ...stone].map((lot) => lot.lotId));
      showWorldFeedback(`${kind === "steward-axe" ? "Steward Axe" : "Quarry Pick"} sealed from exact material proofs. Equip it here when you are ready.`);
    } catch (error) { handleStoryCommandError(error, "That tool could not be shaped yet."); }
  };

  const moveStewardMaterial = async (kind: "timber" | "stone", direction: "deposit" | "withdraw") => {
    beginWorldActionFeedback();
    if (!nearbyTrailCache) return showWorldFeedback("Approach your Trail Cache first.");
    const lot = direction === "deposit" ? availableMaterialLots.find((candidate) => candidate.kind === kind) : storedStewardLots.find((candidate) => candidate?.kind === kind);
    if (!lot) return showWorldFeedback(direction === "deposit" ? `No loose ${kind} lot is available.` : `No ${kind} lot is stored here.`);
    try {
      await livingWorld.moveStoredMaterial(lot.lotId, nearbyTrailCache.structureId, direction, state.player);
      showWorldFeedback(direction === "deposit" ? `One exact ${kind} lot is now held by this Trail Cache.` : `One exact ${kind} lot returned to your Satchel.`);
    } catch (error) { handleStoryCommandError(error, "That exact lot could not move."); }
  };

  const confirmStewardPlacement = () => {
    if (!stewardPlacementPreview?.valid || livingWorld.pendingCommand) return;
    if (stewardPlacementPreview.blueprintId === "trail-shelter") void placeTrailShelter(stewardPlacementPreview.point);
    else if (stewardPlacementPreview.blueprintId === "trail-bridge") void placeTrailBridge(stewardPlacementPreview.point);
    else void placeStewardGroundStructure(stewardPlacementPreview.blueprintId, stewardPlacementPreview.point);
  };

  if (!enabled) {
    return (
      <section className="panel play-disabled">
        <div>
          <h2>Game module is off</h2>
          <p>This store still works as proof-sealed commerce without the game layer.</p>
        </div>
        <StatusPill tone="neutral">Optional</StatusPill>
      </section>
    );
  }

  const nearbyOverlook = wildsOverlookAt(state.player);

  const dispatch = (input: WildsInput) => {
    if (!interactionEnabled) return;
    if (input.type === "select-asset") setNewRosterAssetId(null);
    const energyActivity=aerialStateRef.current.mode!=='ground'?aerialStateRef.current.mode:verticalTraversalRef.current.layer==='water'?'swim':'active';
    setState((current) => {
      // Read after queued energy updates, so a user wake/move cannot carry
      // an older gesture-time coordinate into the current body checkpoint.
      const actionUPulse=readActionKaiUPulse();
      if(current.playerBreaths?.clockRooted&&actionUPulse<current.playerBreaths.lastKaiUPulse)return current;
      const rootedInput=rootWildsInputInKai({...input,energyActivity},actionUPulse);
      let next = applyWildsInput(current, rootedInput);
      resourceGameplayCapture.captureInput(current,next,rootedInput);
      if(input.type==='wake'&&current.playerBreaths?.mode==='bed'){
        const bed=selectCreationBedAtPlayer(creationController.snapshot,current.player,current.siteSpace,ownerReceizId,actionUPulse);
        if(bed&&current.playerBedRest?.instanceId===bed.instanceId&&current.playerBedRest.nodeId===bed.nodeId&&current.playerBedRest.componentHead===bed.head){
          const y=creationBedWakeFloor(bed,current.player,current.siteSpace.position.y,ownerReceizId,actionUPulse,creationNavigation??creationController.snapshot().navigation);
          if(y!==null)next={...next,siteSpace:{...next.siteSpace,position:{...next.siteSpace.position,y}}};
        }
      }
      if (!current.completed && next.completed) {
        onComplete?.(next.beans);
      }
      return next;
    });
  };
  const dispatchWorldInput = (input: WildsInput) => {
    if (!canUseWorldStage()) return;
    if (input.type === "move" || input.type === "move-vector") {
      if (!jumpTravelDispatching.current) {
        if (verticalTraversalRef.current.jumpVelocity !== undefined) return;
        lastGroundMovement.current = {input, at: performance.now()};
      }
      if (activeWorldCapability === "anchor" || activeWorldCapability === "camouflage" || activeWorldCapability === "track" || activeWorldCapability === "current" || activeWorldCapability === "dive") {
        setActiveWorldCapability(null);
      }
      if (!horizontalAllowedRef.current) return;
      if (activeVistaId) setActiveVistaId(null);
      const liveAerialMode = aerialStateRef.current.mode;
      const airborne = liveAerialMode !== "ground";
      dispatch({
        ...input,
        siteRuntime,
        siteMovementOutput: siteMovementOutputRef.current,
        siteDiscoveryOutput: siteDiscoveryOutputRef.current,
        structureSupports: livingStructureSupports,
        additionalObstacles: livingPhysicalObstacles,
        creationNavigation:creationNavigation||undefined,
        aerialMode: airborne ? liveAerialMode : undefined,
        verticalClearance: verticalTraversalRef.current.offset,
        verticalWorldY: verticalTraversalRef.current.worldY
      });
      return;
    }
    dispatch(input);
  };
  worldInputDispatcherRef.current = dispatchWorldInput;
  const canForage = () => interactionEnabled && !state.battle && modalOwner === 'none' && (canUseWorldStage() || worldOverlayState.panelKey === 'satchel');
  const eatFood = (item: WildsFoodItem) => {
    if (!canForage()||foodSaveInFlight.current||foodUnavailableForExchange(livingWorld.currentSource(),ownerReceizId,item.itemId)||walletSourceLocksRef.current.has(item.itemId)) return;
    const pulse=readActionKaiUPulse();
    const attempt=rootWildsInputInKai({type:'eat-food',ownerReceizId,itemId:item.itemId,kaiUPulse:pulse},pulse);
    if(applyWildsInput(state,attempt)===state)return;
    beginWorldActionFeedback();
    const importedSource = state.playerNourishment?.importedItems?.[item.itemId]?.receiptId.startsWith("wildz:resource:");
    if (importedSource) {
      if (!walletSourceUse || !walletSourceStore) { showWorldFeedback("Unlock the same Explorer to use this received portion."); return; }
      const candidate = applyWildsInput(state, attempt), command = captureWildsResourceGameplayInput(state, candidate, attempt);
      if (!command || command.kind !== "food.consume") return;
      foodSaveInFlight.current = true; setFoodSavePending(true);
      const identityAtUse = {...walletTradeIdentityRef.current};
      const request = {attemptId: `food-use:${sha256PortableBasis(`${ownerReceizId}:${item.itemId}`).slice(7)}`, memberIds: [item.itemId], command};
      void walletSourceUse.recover(request).then(recovered => recovered ?? walletSourceUse.use(request)).then(async admitted => {
        if (!admitted) throw Error("The exact source action is still pending.");
        if (walletTradeIdentityRef.current.keyId !== identityAtUse.keyId || walletTradeIdentityRef.current.ownerHandle !== identityAtUse.ownerHandle) throw Error("The Explorer changed. Reopen the same portion.");
        const actual = admitted.nourishment.items[item.itemId];
        if (!actual || actual.consumedKaiUPulse === undefined || actual.consumedFuelMicroBreaths === undefined) throw Error("The exact source portion's fuel is still pending.");
        const recoveryPreview = recoverWildsWalletSourceFoodV128(walletSourceLive.current.state, admitted.nourishment, ownerReceizId, readActionKaiUPulse(), [item.itemId]);
        setState(current => walletTradeIdentityRef.current.keyId !== identityAtUse.keyId || walletTradeIdentityRef.current.ownerHandle !== identityAtUse.ownerHandle ? current
          : recoverWildsWalletSourceFoodV128(current, admitted.nourishment, ownerReceizId, readActionKaiUPulse(), [item.itemId]).state);
        if (recoveryPreview.pendingItemIds.length) showWorldFeedback("Your meal is saved. Give your body room, then refresh its package contents in Wallet.");
        const row = currentWalletSourceRows.find(row => row.memberRefs.some(member => member.id === item.itemId));
        if (row) await walletSourceStore.reopen(row.packageId);
        const rows = await walletSourceStore.listCached();
        const identity = walletTradeIdentityRef.current;
        if (identity.keyId === identityAtUse.keyId && identity.ownerHandle === identityAtUse.ownerHandle && identity.keyId && identity.ownerHandle) setWalletSourceRows({keyId: identity.keyId, owner: identity.ownerHandle, rows});
      }).catch(error => showWorldFeedback(error instanceof Error ? error.message : "Check the same received portion to finish its saved use."))
        .finally(() => {foodSaveInFlight.current = false; setFoodSavePending(false);});
      return;
    }
    if(!livingWorld.currentSource()?.foodItems?.[item.itemId]){dispatch(attempt);return;}
    foodSaveInFlight.current=true;setFoodSavePending(true);
    void resourceExchange.consume(item.itemId).then(world=>{
      setState(current=>recoverWildsNativeFoodFuel(current,world,ownerReceizId,readActionKaiUPulse()));
    }).catch(error=>{
      showWorldFeedback(error instanceof Error?error.message.replaceAll('_',' '):'This food use is still syncing.');
      void livingWorld.refresh();
    }).finally(()=>{foodSaveInFlight.current=false;setFoodSavePending(false);});
  };
  const openNourishmentSatchel = () => {
    if (!canForage()) return;
    setInspectedNourishmentId(null);
    setStoredFoodFocusSignal(signal => signal + 1);
    setRequestedCommand('satchel');
  };
  const inspectNourishment = (source: WildsNourishmentPlantProjection | WildsWildAnimalProjection | WildsOwnedLivestockProjection) => {
    if (!canForage()) return;
    setStoredFoodFocusSignal(0);
    setInspectedNourishmentId('sourceId' in source ? source.sourceId : source.animalId);
    setNourishmentActionId('sourceId' in source ? source.sourceId : source.animalId);
  };
  const gatherFood = (plant: WildsNourishmentPlantProjection) => {
    if (!canForage()) return;
    const actionKai = readActionKaiUPulse(), crop = wildsNourishmentSourceAt(plant, state.playerNourishment?.sources[plant.sourceId], actionKai);
    if (foodPackFull) { inspectNourishment(plant); showWorldFeedback('Your food pack is full. Eat a portion before gathering more.'); return; }
    if (!crop.remaining || Math.hypot(state.player.x - plant.position.x, state.player.z - plant.position.z) > WILDS_NOURISHMENT_GATHER_REACH
      || Math.abs(verticalTraversalRef.current.worldY - plant.position.y) > WILDS_NOURISHMENT_VERTICAL_REACH) {
      inspectNourishment(plant); showWorldFeedback(crop.remaining ? 'Move closer on the ground to gather food.' : 'This crop is depleted. It grows back with Kai days.'); return;
    }
    beginWorldActionFeedback();
    setNourishmentActionId(null);
    setState(current => {
      const nourishment = reconcileWildsNourishmentCustody(current.playerNourishment, livingWorld.currentSource(), ownerReceizId);
      return nourishment === current.playerNourishment ? current : { ...current, playerNourishment: nourishment };
    });
    dispatch({ type: 'gather-food', ownerReceizId, sourceId: plant.sourceId, expectedSourceHead: crop.head, kaiUPulse: actionKai, verticalWorldY: verticalTraversalRef.current.worldY });
  };
  const huntAnimal = (animal: WildsWildAnimalProjection,toolOnly=false) => {
    if (!canForage()) return;
    if (foodPackFull) { showWorldFeedback('Your food pack is full. Eat a portion before hunting.'); return; }
    const actionKai = readActionKaiUPulse();
    const support = selectWildsHuntingSupport({ state: state.playerLivestock, ownerReceizId, kaiUPulse: actionKai,
      companion: toolOnly?undefined:activeAsset ?? undefined, condition: !toolOnly&&activeAsset ? projectWildsRestedCompanionCondition(state, actionKai, activeAsset.id) : undefined,
      toolWorld: livingWorld.snapshot ?? undefined });
    if (!support.hunter) { showWorldFeedback(support.blocker ?? 'Choose a ready companion or equip an axe.'); return; }
    const motion = projectWildsWildAnimalPosition(animal, actionKai), position = motion.position;
    if (Math.hypot(state.player.x - position.x, state.player.z - position.z) > WILDS_ANIMAL_INTERACTION_REACH
      || Math.abs(verticalTraversalRef.current.worldY - position.y) > 1.8) { showWorldFeedback('Move within reach on the same ground to hunt.'); return; }
    beginWorldActionFeedback();
    pendingHunt.current = { animal, ownerReceizId, spaceId: state.siteSpace.spaceId, requestedKaiUPulse: actionKai,
      before: state.playerLivestock, hunterAssetId: support.hunter.kind === 'creature' ? support.hunter.assetId : null, reducedMotion: qualityProfile.reducedMotion,
      from: { x: state.player.x + (support.hunter.kind === 'creature' ? -1.08 : 0), y: verticalTraversalRef.current.worldY + .7, z: state.player.z + (support.hunter.kind === 'creature' ? .42 : 0) },
      position, heading: motion.heading, gait: motion.gait, pose: motion.pose };
    setNourishmentActionId(null);
    dispatch({ type: 'hunt-animal', ownerReceizId, animalId: animal.animalId, expectedAnimalHead: animal.head, kaiUPulse: actionKai, verticalWorldY: verticalTraversalRef.current.worldY,
      hunter: support.hunter, toolWorld: livingWorld.snapshot ?? undefined });
  };
  const captureLivestock = (animal: WildsWildAnimalProjection) => {
    if (!canForage() || !livingWorld.snapshot || !livestockShelter) return;
    if (captureBlocker) { showWorldFeedback(captureBlocker); return; }
    const actionKai = readActionKaiUPulse(), position = projectWildsWildAnimalPosition(animal, actionKai).position;
    if (Math.hypot(state.player.x - position.x, state.player.z - position.z) > WILDS_ANIMAL_INTERACTION_REACH
      || Math.abs(verticalTraversalRef.current.worldY - position.y) > 1.8) { showWorldFeedback('Move within reach on the same ground to capture livestock.'); return; }
    beginWorldActionFeedback();
    setNourishmentActionId(null);
    dispatch({ type: 'capture-livestock', ownerReceizId, animalId: animal.animalId, expectedAnimalHead: animal.head, kaiUPulse: actionKai, verticalWorldY: verticalTraversalRef.current.worldY, shelterId: livestockShelter.shelterId, husbandryWorld: livingWorld.snapshot });
  };
  const collectLivestockFood = (animal: WildsOwnedLivestockProjection) => {
    if (!canForage() || !livingWorld.snapshot) return;
    if (foodPackFull) { showWorldFeedback('Your food pack is full. Eat a portion before collecting produce.'); return; }
    if (Math.hypot(state.player.x - animal.position.x, state.player.z - animal.position.z) > 4
      || Math.abs(verticalTraversalRef.current.worldY - animal.position.y) > 1.8) { showWorldFeedback('Approach your farm to collect its produce.'); return; }
    beginWorldActionFeedback();
    setNourishmentActionId(null);
    dispatch({ type: 'collect-livestock', ownerReceizId, animalId: animal.animalId, kaiUPulse: readActionKaiUPulse(), husbandryWorld: livingWorld.snapshot });
  };

  currentGatherActions.current={food:gatherFood,material:gatherStewardResource,livestock:collectLivestockFood};
  const jumpPlayer = () => {
    if(!canUseWorldStage()||state.battle||state.playerBreaths?.mode==='bed'||state.playerBreaths?.mode==='sleep')return;
    if(aerialStateRef.current.mode!=='ground'||aquaticPresentation.mode==='swim'){showWorldFeedback('Land on a dry surface to jump.');return;}
    const vertical=verticalTraversalRef.current;
    if(vertical.layer==='ground')vertical.worldY=state.siteSpace.position.y;
    const result=requestWildsJump(vertical,projectPlayerBreathState(state,readActionKaiUPulse()).energy);
    if (result.ok) jumpTravelRef.current = captureWildsJumpTravel(lastGroundMovement.current, performance.now());
    if(!result.ok)showWorldFeedback(result.reason);
  };
  const usePlayerHand = (hand:WildsPlayerHand,intent:WildsPlayerHandIntent) => {
    const controls=equipmentControlsRef.current;
    if(intent==='cancel'){equipmentGestureGeneration.current++;clearWildsEquipmentControlState(controls);return;}
    if(intent==='release-aim'){controls.aiming=false;return;}
    if(!canUseWorldStage()||state.battle||state.playerBreaths?.mode==='bed'||state.playerBreaths?.mode==='sleep')return;
    const now=performance.now(),gestureGeneration=equipmentGestureGeneration.current;
    if(intent==='aim'){controls.aiming=true;return;}
    if(intent==='draw'){controls.drawingAt=now;return;}
    if(intent==='shoot'){controls.drawingAt=null;}
    if((intent==='shoot'||intent==='use')&&pendingCreationHand.current)return;
    if(!beginWildsHandAction(handActionsRef.current,hand,intent,now))return;
    const actionKai=readActionKaiUPulse(), position={x:state.player.x,y:verticalTraversalRef.current.worldY,z:state.player.z};
    const actor={...position,spaceId:state.siteSpace.spaceId,heading:playerFacingRef.current};
    const candidates:Array<{id:string;x:number;y:number;z:number;spaceId:string;qualified:boolean;run:()=>void}>=[];
    let runEquipmentAction:(()=>void)|undefined,afterEquipmentAction:(()=>void)|undefined;
    const applicationSource = livingWorld.currentApplicationResourceSource();
    const baselineActionWorld = livingWorld.currentSource();
    const aim=intent==='shoot'?creationAimFromView([...Object.values(applicationSource?.creations??{}),...Object.values(baselineActionWorld?.creations??{}).filter(source=>!applicationSource?.creations?.[source.instance.instanceId])].map(source=>({definition:source.command.definition,instance:source.instance})),position,actor.spaceId,{...controls.viewOrigin},{direction:{...controls.aimDirection}},equipmentControls?.mode==='bow'?32:56):undefined;
    const handIntentAllowed = intent === "grab" || intent === "shoot" || !heldCreationEquipment || heldCreationEquipment.hand === hand;
    const operationId = `creation:hand:${crypto.randomUUID()}`;
    const sourceCandidate = applicationSource && handIntentAllowed ? prepareCreationHandAction({world: applicationSource, actorId: ownerReceizId, position, spaceId: actor.spaceId, heading: actor.heading, kaiUPulse: actionKai, operationId, intent,aim}) : null;
    const actionWorld = sourceCandidate ? applicationSource : baselineActionWorld;
    const creationCommand = sourceCandidate ?? (baselineActionWorld && handIntentAllowed ? prepareCreationHandAction({world: baselineActionWorld, actorId: ownerReceizId, position, spaceId: actor.spaceId, heading: actor.heading, kaiUPulse: actionKai, operationId, intent,aim,
      excludedInstanceIds: new Set(Object.keys(applicationSource?.creations ?? {}))}) : null);
    if(creationCommand&&actionWorld){
      const source=actionWorld.creations![creationCommand.actionRequest.instanceId],nodePosition=creationNodePoses(source.command.definition,source.instance.pose).get(creationCommand.actionRequest.nodeId)!.position;
      const runAction=()=>{
        const pending=pendingCreationHand.current;
        if(pending&&pending.ownerId===ownerReceizId&&!livingWorld.currentSource()?.constructionCommandReceipts[pending.operationId]){showWorldFeedback('Your last hand action is still being saved. Wait for confirmation before trying again.');return;}
        let exact=withWildsWorldCommandKai(creationCommand,createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:actionKai,authority:livingWorld.mode==='receiz_live'||livingWorld.mode==='kai_live'?'world':'local'})));
        const pendingAttempt = {operationId: exact.commandId, ownerId: ownerReceizId};
        pendingCreationHand.current = pendingAttempt;
        const sameHandAttempt = () => pendingCreationHand.current === pendingAttempt && creationRuntime.current?.environment().ownerId === ownerReceizId;
        let prepared=false;
        void (async () => {
          if (sourceCandidate) {
            if (!walletAssetPort) throw Error("Unlock the same Explorer to use this weapon.");
            await walletSourceLive.current.flushGameplay();
            const runtime = await walletAssetPort.openRuntime(), preview = await runtime.exchange.previewGameplay();
            if (!sameHandAttempt()) throw Error("The Explorer changed. Reopen the same hand action.");
            livingWorld.adoptApplicationResourceWorld(preview.replay.world);
            const pulse = readActionKaiUPulse();
            const refreshed = prepareCreationHandAction({world: preview.replay.world, actorId: ownerReceizId, position, spaceId: actor.spaceId, heading: actor.heading, kaiUPulse: pulse, operationId, intent,aim});
            if (!refreshed) throw Error("The weapon or target changed. Face it and try again.");
            exact = withWildsWorldCommandKai(refreshed, createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse: pulse, authority: "world"})));
          }
          return livingWorld.admitCreationAction(exact,async()=>{
          const current = sourceCandidate ? livingWorld.currentApplicationResourceSource() : livingWorld.currentSource(),scope=creationRuntime.current?.environment(),currentPosition=creationRuntime.current?.position();
          if(!current||scope?.ownerId!==ownerReceizId||scope.spaceId!==exact.spaceId||!currentPosition||intent==='grab'&&Math.hypot(currentPosition.x-position.x,currentPosition.y-position.y,currentPosition.z-position.z)>.2||creationWorldActorHead(current,ownerReceizId)!==exact.actionRequest.expectedHeads[`actor:${ownerReceizId}`])throw Error('Your position or the target changed. Face it and try again.');
          prepared=true;
          });
        })().then(async()=>{
          if (!sameHandAttempt()) return;
          await localCreation.controller.restore();
          if (!sameHandAttempt()) return;
          if(intent==='grab'){setEquipmentHand(hand);rememberWildsEquipmentHand(ownerReceizId,hand);}
          pendingCreationHand.current=null;
          if(intent==='use'&&afterEquipmentAction&&equipmentGestureGeneration.current===gestureGeneration&&creationRuntime.current?.environment().spaceId===actor.spaceId)afterEquipmentAction();
          else showWorldFeedback(intent==='grab'?'Equipped. Your hand controls now match this gear.':intent==='shoot'?exact.actionRequest.action==='damage'?'Shot landed.':'Shot saved.':intent==='use'?'Tool used. Face a matching resource within reach.':'Weapon strike landed.');
        }).catch(error=>{
          if (!sameHandAttempt()) return;
          const admitted=Boolean(livingWorld.currentSource()?.constructionCommandReceipts[exact.commandId]);
          if(!prepared||admitted)pendingCreationHand.current=null;
          showWorldFeedback(admitted?'Your hand action was saved. The view is catching up.':prepared?'Your hand action could not be confirmed yet. It is held to prevent a duplicate.':error instanceof Error?error.message.replaceAll('_',' '):'The target changed. Try again.');
        });
      };
      if(intent==='shoot'){
        controls.shotAt=now;controls.shotKind=equipmentControls?.mode==='bow'?'bow':'rifle';controls.shotRange=creationCommand.actionRequest.action==='damage'&&'equipment'in creationCommand.actionRequest&&creationCommand.actionRequest.equipment?.hitPosition?Math.hypot(creationCommand.actionRequest.equipment.hitPosition.x-position.x,creationCommand.actionRequest.equipment.hitPosition.y-position.y-1.25,creationCommand.actionRequest.equipment.hitPosition.z-position.z):(equipmentControls?.mode==='rifle'?56:32);
        controls.shotOrigin={x:position.x,y:position.y+1.25,z:position.z};controls.shotDirection={...aim!.direction};runAction();return;
      }
      if(intent==='use')runEquipmentAction=runAction;
      else candidates.push({...nodePosition,id:creationCommand.commandId,spaceId:actor.spaceId,qualified:true,run:runAction});
    }
    if(intent==='grab'||intent==='use'){
      for(const plant of intent==='use'&&equipmentControls?.toolMode&&equipmentControls.toolMode!=='hoe'?[]:nourishmentPlants){const crop=wildsNourishmentSourceAt(plant,state.playerNourishment?.sources?.[plant.sourceId],actionKai);candidates.push({...plant.position,id:plant.sourceId,spaceId:'wildz.space.outer.v1',qualified:crop.valid&&crop.remaining>0&&!foodPackFull,run:()=>currentGatherActions.current?.food(plant)});}
      for(const animal of intent==='use'&&equipmentControls?.toolMode&&equipmentControls.toolMode!=='hoe'?[]:ownedLivestock)candidates.push({...animal.position,id:animal.animalId,spaceId:animal.spaceId,qualified:animal.canProduce&&!foodPackFull,run:()=>currentGatherActions.current?.livestock(animal)});
      if(state.siteSpace.spaceId==='wildz.space.outer.v1'){
        const region=wildsResourceRegionForPosition(state.player);
        for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const source of projectWildsResourceRegion(region.x+dx,region.z+dz)){
          if(intent==='use'&&equipmentControls?.toolMode==='axe'&&source.kind!=='timber'||intent==='use'&&equipmentControls?.toolMode==='pickaxe'&&source.kind!=='stone')continue;
          const harvested=livingWorld.snapshot?.harvestedSources[source.sourceId],available=projectWildsResourceAvailability(source,{admittedHarvestedCapacity:harvested?.harvestedCapacity??0,lastHarvestKaiPulse:harvested?.lastHarvestKaiPulse??'0',currentKaiPulse:String(actionKai)});
          const partner=source.kind==='hay'||Boolean(selectWildsResourceWorkPartner(state.inventory,state.adventureConditions,source.requirements.creature,activeAsset?.id));
          candidates.push({x:source.position.x,y:wildsSiteRuntimeGroundY(siteRuntime,actor.spaceId,source.position.x,source.position.z,wildsTerrainElevation(source.position.x,source.position.z)),z:source.position.z,id:source.sourceId,spaceId:'wildz.space.outer.v1',qualified:available.availableCapacity>0&&!available.clockPending&&partner&&!livingWorld.pendingCommand,run:()=>{void currentGatherActions.current?.material(source);}});
        }
      }
    }else{
      const support=selectWildsHuntingSupport({state:state.playerLivestock,ownerReceizId,kaiUPulse:actionKai,toolWorld:livingWorld.snapshot??undefined});
      for(const animal of wildAnimals){const motion=projectWildsWildAnimalPosition(animal,actionKai);candidates.push({...motion.position,id:animal.animalId,spaceId:'wildz.space.outer.v1',qualified:animal.status==='wild'&&support.hunter?.kind==='tool'&&!foodPackFull,run:()=>huntAnimal(animal,true)});}
    }
    const target=selectWildsHandTarget(actor,candidates,3);
    if(intent==='use'&&runEquipmentAction){afterEquipmentAction=target?()=>{const current=creationRuntime.current?.position();if(current&&Math.hypot(current.x-target.x,current.y-target.y,current.z-target.z)<=3)target.run();else showWorldFeedback('Tool used. Move closer to that resource.');}:undefined;runEquipmentAction();return;}
    if(target){target.run();return;}
    showWorldFeedback(intent==='grab'?'Reach toward your weapon, ripe food, ready farm produce, or a resource your crew can gather.':'Strike ready. Hold a hand near your weapon to equip it, then face an allowed target within reach.');
  };

  const dispatchLayeredSearch = (point: { x: number; z: number; surfaceWorldY?: number }, fromJourney = false) => {
    if (fromJourney ? (!interactionEnabled || modalOwner !== "none" || worldOverlayState.panelKey !== "mission") : !canUseWorldStage()) return;
    beginWorldActionFeedback();
    const searchPoint = Number.isFinite(point.surfaceWorldY)
      ? { x: point.x, z: point.z, surfaceWorldY: point.surfaceWorldY! }
      : projectWildsInteractionSurfacePoint(
        siteRuntime,
        state.siteSpace.spaceId,
        point,
        state.siteSpace.spaceId === "wildz.space.outer.v1" ? wildsTerrainElevation(point.x, point.z) : state.siteSpace.position.y
      );
    const vertical = verticalTraversalRef.current;
    let layer = vertical.layer;
    const groundY = Number.isFinite(state.siteSpace.position.y) ? state.siteSpace.position.y : aquaticPresentation.terrainElevation;
    const worldY = layer === "ground" ? groundY : vertical.worldY;
    const safeMinWorldY = layer === "ground" ? worldY - .65 : groundY + vertical.safeMin;
    const safeMaxWorldY = layer === "ground" ? worldY + .65 : groundY + vertical.safeMax;
    let minWorldY = Math.max(safeMinWorldY, worldY - .65);
    let maxWorldY = Math.min(safeMaxWorldY, worldY + .65);
    const siteQueryY = state.siteSpace.spaceId === "wildz.space.outer.v1"
      ? layer === "ground" ? searchPoint.surfaceWorldY : worldY
      : state.siteSpace.position.y + .8;
    const siteEncounter = writeWildsSiteRuntimeEncounter(
      { siteKey: null, spaceId: state.siteSpace.spaceId, layer: "ground", minY: 0, maxY: 0 },
      siteRuntime,
      state.siteSpace.spaceId,
      searchPoint.x,
      siteQueryY,
      searchPoint.z
    );
    if (siteEncounter.siteKey) {
      layer = siteEncounter.layer === "air" ? "air" : siteEncounter.layer === "water-column" || siteEncounter.layer === "seabed" ? "water" : "ground";
      minWorldY = siteEncounter.minY;
      maxWorldY = siteEncounter.maxY;
    }
    dispatch({
      type: "search-point",
      ...searchPoint,
      searchedAt: new Date().toISOString(),
      ownerReceizId,
      verticalLayer: layer,
      verticalWorldY: worldY,
      verticalMinWorldY: minWorldY,
      verticalMaxWorldY: maxWorldY,
      traversalCapabilities: activeTraversalCapabilities,
      siteKey: siteEncounter.siteKey,
      siteSpaceId: siteEncounter.spaceId
    });
  };
  const withLocalActivity = (current: PlayState, next: PlayState, title: string, detail: string) => applyWildsInput(next, {
    type: "record-world-activity", activity: { id: `local:${kaiUPulse}:${current.actionHistory?.length ?? 0}:${title}`, kind: "activity", title, detail, uPulse: kaiUPulse, authority: "local" }
  });
  const consumePendingAerialLanding = (reason: WildsAerialLandingReason) => {
    const runtime = aerialStateRef.current;
    if (!runtime.landingRequired) return;
    const anchor = runtime.safeAnchor;
    const outer = state.siteSpace.spaceId === "wildz.space.outer.v1";
    const landing = outer
      ? resolveWildsRequiredLandingPosition(state.player, anchor, { capabilities: activeTraversalCapabilities, obstacles: livingPhysicalObstacles })
      : { x: anchor.x, z: anchor.z };
    if (!landing) return;
    const landingY = outer ? wildsTerrainElevation(landing.x, landing.z) : state.siteSpace.position.y;
    const siteLanding = writeWildsSiteRuntimeLanding(siteLandingOutputRef.current, siteRuntime, state.siteSpace.spaceId, landing.x, landingY, landing.z);
    if (!siteLanding.found) return;
    const siteSurface = writeWildsSiteRuntimeMovement(siteMovementOutputRef.current, siteRuntime, state.siteSpace.spaceId, state.player.x, landingY, state.player.z, siteLanding.x, siteLanding.z, .38, siteLanding.floorY);
    completeWildsAerialLanding(runtime, siteLanding.x, siteLanding.z, siteLanding.floorY);
    if (!reducedMotion) playWildsHaptic("land");
    resetWildsVerticalTraversalState(verticalTraversalRef.current);
    verticalIntentRef.current = 0;
    horizontalAllowedRef.current = true;
    setAerialMode("ground");
    const landedInDeepWater = outer && projectWildsAquaticPresentationAtPosition({
      x: siteLanding.x, z: siteLanding.z, groundElevation: siteSurface.floorY, canSwim: activeTraversalCapabilities.includes("swim"), airborne: false
    }).mode === "blocked";
    setState((current) => {
      const siteKey = writeWildsSiteRuntimeDiscovery(siteDiscoveryOutputRef.current, siteRuntime, current.siteSpace.spaceId, siteLanding.x, siteSurface.floorY, siteLanding.z).siteKey;
      return {
        ...current,
        player: { x: siteLanding.x, z: siteLanding.z },
        partyTravelRevision: nextWildsPartyTravelRevision(current.partyTravelRevision),
        siteSpace: {
          ...current.siteSpace,
          surfaceId: siteSurface.surfaceId,
          position: { x: siteLanding.x, y: siteSurface.floorY, z: siteLanding.z },
          flooded: siteSurface.flooded
        },
        explorationAtlas: siteKey ? discoverWildsExplorationSite(current.explorationAtlas, siteKey) : current.explorationAtlas,
        lastEvent: landedInDeepWater
          ? "Dropped into deep water. You are sinking. Take flight again or lead with a swimming creature to move."
          : reason === "protected-airspace" ? "Returned to the nearest safe landing outside protected airspace." : "Landed on the nearest clear surface."
      };
    });
  };
  const toggleAerialTraversal = (requestedKind: "flight" | "glide" = activeTraversalCapabilities.includes("flight") ? "flight" : "glide") => {
    if (!canUseWorldStage()) return;
    const groundElevation = Number.isFinite(state.siteSpace?.position.y)
      ? state.siteSpace.position.y
      : aquaticPresentation.terrainElevation;
    const plan = planWildsAerialToggle(aerialStateRef.current.mode, requestedKind, activeTraversalCapabilities);
    if (plan.kind === "land") {
      requestWildsAerialLanding(aerialStateRef.current, "landed");
      consumePendingAerialLanding("landed");
      return;
    }
    if (plan.kind === "needs-capability") {
      showWorldFeedback("Lead with a creature that can fly or glide to use this control.");
      return;
    }
    const kind = plan.mode;
    const body = projectPlayerBreathState(state, readActionKaiUPulse());
    if (body.energy < (kind === "flight" ? 20 : plan.kind === "takeoff" ? 30 : 0)) {
      showWorldFeedback("Your body needs rest before takeoff. Walking and directing creatures are still available.");
      return;
    }
    const begun = beginWildsAerialTraversal(aerialStateRef.current, {
      kind,
      capabilities: activeTraversalCapabilities
    });
    if (begun.reason) {
      showWorldFeedback(begun.reason === "flight-recharging"
        ? "Flight energy is recharging on the ground. Take off when it reaches 20%."
        : begun.reason === "glide-recharging"
          ? "Glide energy is recharging on the ground. Take off when it reaches 30%."
          : "This companion cannot take off right now.");
      return;
    }
    aerialStateRef.current = begun.state;
    writeWildsVerticalTraversalStep(verticalTraversalRef.current, {
      deltaSeconds: 0,
      initialOffset: Math.max(kind === "glide" ? .4 : .35, begun.state.altitude - groundElevation),
      intent: 0,
      layer: begun.state.mode === "ground" ? "ground" : "air",
      liftPotential: traversalPotentials.lift,
      powered: kind === "flight",
      assistedGlide: kind === "glide",
      stamina: begun.state.stamina,
      terrainElevation: groundElevation
    });
    setAerialMode(begun.state.mode);
    setState(current => withLocalActivity(current, current, plan.kind === "switch" ? "Aerial mode" : "Takeoff", `${kind} started`));
    if (activeVistaId) setActiveVistaId(null);
  };
  const spendWorldCapability = (family: WildsWorldCapabilityFamily) => {
    if (!activeAsset) return;
    const amount = WILDS_WORLD_CAPABILITY_REGISTRY[family].baseCost;
    setState((current) => {
      const prior = current.adventureConditions[activeAsset.id] ?? emptyAdventureCondition(activeAsset.id);
      try {
        const next = applyWildsCapabilityCost(prior, family, amount);
        return withLocalActivity(current, { ...current, adventureConditions: { ...current.adventureConditions, [activeAsset.id]: next } }, "Companion capability", `${activeAsset.manifest.name} used ${family}`);
      } catch {
        return current;
      }
    });
  };
  const toggleSustainedWorldCapability = (family: WildsWorldCapabilityFamily, activeMessage: string, releasedMessage: string) => {
    if (activeWorldCapability === family) {
      setActiveWorldCapability(null);
      setState(current => withLocalActivity(current, current, "Companion capability ended", releasedMessage));
      showWorldFeedback(releasedMessage);
      return;
    }
    setActiveWorldCapability(family);
    spendWorldCapability(family);
    showWorldFeedback(activeMessage);
  };
  const requestWildsCapability = (family: WildsWorldCapabilityFamily) => {
    if (!activeAsset) return;
    const control = quickCapabilityControls.find(candidate => candidate.family === family);
    if (!control) return;
    const ending = (family === "light" && activeWorldCapability === "light") || ((family === "flight" || family === "glide") && aerialStateRef.current.mode === family);
    if (!ending && (!control.runtimeAvailable || control.capacity <= 0)) { showWorldFeedback(`${control.label} needs recovery before it can be used.`, true); return; }
    beginWorldActionFeedback();
    switch (family) {
      case "flight":
      case "glide":
        toggleAerialTraversal(family);
        return;
      case "lumber":
      case "quarry":
        gatherNearestStewardResource(family);
        return;
      case "swim":
        if (aquaticPresentation.mode === "swim") showWorldFeedback(`${activeAsset.manifest.name} is swimming fully submerged beside you.`);
        else showWorldFeedback("Move into the nearest deep-water edge; this swimmer will enter with you immediately.");
        return;
      case "dive": {
        if (aquaticPresentation.mode !== "swim") {
          showWorldFeedback("Enter deep water first; the nearest deep-water edge is the dive route.");
          return;
        }
        if (livePlayerEnergy.energy <= 0) { showWorldFeedback("You need energy to dive. Return to shore and make camp, then enter the water again.", true); return; }
        const dive = requestWildsDive(verticalTraversalRef.current);
        if (!dive.ok) { showWorldFeedback(dive.reason, true); return; }
        setActiveWorldCapability("dive");
        spendWorldCapability("dive");
        showWorldFeedback(`${activeAsset.manifest.name} leads you up to 2 metres deeper. Tap Dive again to descend further, or hold Rise to swim upward.`);
        return;
      }
      case "current": {
        if (aquaticPresentation.mode !== "swim") {
          showWorldFeedback("Enter deep water to read and ride its living current.");
          return;
        }
        const heading = cameraHeadingRef.current;
        const ride = beginWildsCurrentRide({ flow: { x: Math.sin(heading), z: Math.cos(heading) }, flowStrength: .72, creaturePower: control.currentPower });
        dispatchWorldInput({ type: "move-vector", x: ride.velocity.x, z: ride.velocity.z, mode: "run" });
        setActiveWorldCapability("current");
        spendWorldCapability("current");
        showWorldFeedback(`${activeAsset.manifest.name} reveals the current and pulls you into its flow.`);
        return;
      }
      case "climb":
        setActiveWorldCapability("climb");
        spendWorldCapability("climb");
        showWorldFeedback("Grip is active. Move into the mountain face and climb from this exact surface.");
        return;
      case "burrow":
        continuousBuilder.close();
        burrowBuilder.begin(cameraHeadingRef.current);
        showWorldFeedback("Choose an entrance, tunnel, or room. Your creature can dig through ground and mountains.");
        return;
      case "balance":
        toggleSustainedWorldCapability("balance", `${activeAsset.manifest.name} centers beside you for narrow crossings.`, "Balance stance released.");
        return;
      case "light":
        toggleSustainedWorldCapability("light", `${activeAsset.manifest.name} awakens a living light around the expedition.`, "Living light rests.");
        return;
      case "camouflage":
        toggleSustainedWorldCapability("camouflage", `${activeAsset.manifest.name} blends the expedition with the surrounding terrain.`, "Camouflage released.");
        return;
      case "track":
        dispatchLayeredSearch({ x: state.player.x, z: state.player.z, surfaceWorldY: state.siteSpace.position.y });
        setActiveWorldCapability("track");
        spendWorldCapability("track");
        showWorldFeedback(`${activeAsset.manifest.name} reads the nearest proof-sealed traces.`);
        return;
      case "break":
        showWorldFeedback("Move beside a visibly cracked obstacle. Healthy living sources and protected structures will not break.");
        return;
      case "resist":
        toggleSustainedWorldCapability("resist", `${activeAsset.manifest.name} forms a bounded protection envelope.`, "Protection stance released.");
        return;
      case "anchor":
        toggleSustainedWorldCapability("anchor", `${activeAsset.manifest.name} anchors the expedition against force.`, "Anchor released.");
        return;
      case "rescue":
        showWorldFeedback("The nearby party is safe. Rescue will awaken at the first admitted traversal emergency.");
        return;
    }
  };
  const openProfile = () => {
    if (!canUseWorldStage()) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    claimPlayModalOwner("profile", origin);
    onOpenProfile(origin);
  };
  const openMarketFromVault = () => {
    if (modalOwner !== "none" || worldOverlayState.panelKey !== "vault") return;
    const origin = document.querySelector<HTMLElement>(".wilds-world-tools-trigger");
    claimPlayModalOwner("market", origin);
    dispatchStageOverlay({ type: "panel", key: null });
    onOpenMarket(origin);
  };
  const openWorldMap = () => {
    if (!canUseWorldStage()) return;
    claimPlayModalOwner("map");
    setCommandDismissSignal((signal) => signal + 1);
    setMapVisited(true);
    setMapOpen(true);
  };
  const openWorldMapFromCommandPanel = () => {
    if (modalOwner !== "none" || worldOverlayState.panelKey !== "commandCenter") return;
    dispatchStageOverlay({ type: "panel", key: null });
    claimPlayModalOwner("map");
    setCommandDismissSignal((signal) => signal + 1);
    setMapVisited(true);
    setMapOpen(true);
  };
  const discoveryActive = state.encounter.phase === "idle" || state.encounter.phase === "searching" || state.encounter.phase === "hint";
  const activeProximity = state.encounter.phase === "idle" ? "cold" : state.encounter.proximity ?? "cold";
  const proximityLabel = state.encounter.phase === "idle"
    ? "Tap terrain to scan"
    : `${activeProximity}${state.encounter.trend ? ` · ${state.encounter.trend}` : ""}`;
  const captureToastActive = ["emerging", "capsule", "sealed", "revealed"].includes(state.encounter.phase);
  const currentLandmark = landmarkAtPosition(state.player);
  const civicActorId = normalizeWildsCivicActorId(ownerReceizId);
  const settlementWorldMode = livingWorld.mode === "receiz_live" || livingWorld.mode === "kai_live" ? livingWorld.mode : livingWorld.mode === "local_practice" ? "local_practice" : "connecting";
  const discoveredLandmarkIds: WildsLandmarkId[] = civic.completedSourceIds.includes("settlement:wayfinder-hollow")
    ? ["hearttree-sanctum", "wayfinder-hollow"]
    : ["hearttree-sanctum"];
  const landmarkProgress: WildsLandmarkProgress = {
    verifiedCardCount: state.inventory.length,
    activeCardLevel: activeProgress.level,
    achievementIds: landmarkUnlocks,
    partySize: multiplayer.remotePlayers.length + 1
  };
  const currentLandmarkAccess = currentLandmark ? evaluateLandmarkAccess(currentLandmark, landmarkProgress) : null;
  const livingSiteSelection = nearestWildsVisible(nearbyLivingSiteCandidates, state.player, site => site.radius + 8);
  const nearbyLivingSite = livingSiteSelection ? { site: livingSiteSelection.candidate, distance: livingSiteSelection.distance } : null;
  const nearbyLivingBoss = nearbyLivingSite?.site.bossId ? livingWorld.snapshot?.bosses[nearbyLivingSite.site.bossId] : null;
  const ecologySelection = nearestWildsVisible(nearbyEcologyCandidates, state.player, site => site.radius);
  const nearbyEcology = ecologySelection ? { site: ecologySelection.candidate, distance: ecologySelection.distance } : null;
  const groveSelection = nearestWildsVisible(nearbyGroveCandidates, state.player, 16, (left, right) => left.groveId.localeCompare(right.groveId));
  const nearbyGrove = groveSelection ? { grove: groveSelection.candidate, distance: groveSelection.distance } : null;
  const activeEcologySite = activeEcologySiteId ? livingWorld.snapshot?.ecologySites[activeEcologySiteId] ?? null : null;
  const activeRaidBoss = activeRaid ? livingWorld.snapshot?.bosses[activeRaid.bossId] ?? null : null;
  const activeRaidRound = activeRaid ? livingWorld.snapshot?.raids[activeRaid.roundId] ?? null : null;
  const activeRaidEncounter = activeRaidRound && typeof activeRaidRound.encounter === "object" ? activeRaidRound.encounter as WildsRaidEncounterState : null;
  const activeRaidRoles = activeAsset ? projectWildsRaidRoles(activeAsset) : null;
  const basePulse = resolveWildsContextAction({
    pendingReward: Boolean(captureRewardAsset),
    landmark: currentLandmark,
    secretId: state.encounter.phase === "hint" ? state.encounter.hotspotId ?? null : null,
    selectedPlayer: multiplayer.selectedPlayer
      ? { playerId: multiplayer.selectedPlayer.playerId, handle: multiplayer.selectedPlayer.handle }
      : null,
    joinableActivity: nearbyLivingBoss && nearbyLivingBoss.phase !== "defeated" ? { id: nearbyLivingBoss.id, name: "shared boss raid" } : null,
    nearbyGrove: nearbyGrove ? {
      id: nearbyGrove.grove.groveId,
      needsCare: nearbyGrove.grove.ecology.moisture < 35 || nearbyGrove.grove.restorationDebt > 0
    } : null
  });
  const pulse = nearbyEcology && (basePulse.kind === "scan" || basePulse.kind === "greet")
    ? { kind: "join" as const, label: `${nearbyEcology.site.phase === "foreshadowed" ? "Discover" : "Enter"} ${nearbyEcology.site.name}`, activityId: nearbyEcology.site.id }
    : basePulse;
  const heartbeatMood = livePlayerEnergy.energy < 30 ? "Protective" : state.encounter.phase === "idle" ? "Curious" : "Alert";
  const heartbeatMemory = state.lastEvent || "Your pack remembers the first trail into the Wilds.";
  const heartbeatWhispers = [
    nearbyLivingBoss ? `${nearbyLivingBoss.name} is stirring nearby.` : null,
    nearbyEcology ? `${nearbyEcology.site.name} is changing this region.` : null,
    livingWorld.snapshot?.defeatedBossIds.length ? `${livingWorld.snapshot.defeatedBossIds.length} shared victory ${livingWorld.snapshot.defeatedBossIds.length === 1 ? "monument stands" : "monuments stand"} in the world.` : null
  ].filter((message): message is string => Boolean(message));
  const commandModel = projectWildsCommandCenter({
    moment: kaiMoment,
    connected: livingWorld.mode === "receiz_live",
    worldRevision: livingWorld.snapshot?.revision ?? 0,
    energy: livePlayerEnergy.energy,
    body: livePlayerBody,
    creature: activeAsset ? {
      assetId: activeAsset.id,
      name: activeAsset.manifest.name,
      life: activeCondition?.life === "dead" ? "dead" : activeCondition?.retiredAt ? "retired" : (activeCondition?.fatigue ?? 0) >= 90 ? "critical" : "alive",
      health: state.battle?.player.hp ?? Math.max(1, 100 - (activeCondition?.fatigue ?? 0)),
      maxHealth: state.battle?.player.maxHp ?? 100,
      fatigue: activeCondition?.fatigue ?? 0
    } : null,
    battle: state.battle && !["captured", "fled", "defeated"].includes(state.battle.phase) ? {
      id: state.battle.encounterSeed,
      opponent: state.battle.wild.name,
      health: state.battle.player.hp,
      maxHealth: state.battle.player.maxHp
    } : null,
    mission: {
      title: saga.chapter.title,
      progress: sagaProgressPercent,
      reward: saga.chapter.missions.find((mission) => mission.primary)?.reward.label ?? "Living story progress"
    },
    nearby: {
      landmark: currentLandmark ? { id: currentLandmark.id, name: currentLandmark.name } : null,
      ecology: nearbyEcology ? { id: nearbyEcology.site.id, name: nearbyEcology.site.name } : null,
      boss: nearbyLivingBoss ? {
        id: nearbyLivingBoss.id,
        name: typeof nearbyLivingBoss.name === "string" ? nearbyLivingBoss.name : nearbyLivingSite?.site.name ?? "World boss"
      } : null,
      livePlayer: multiplayer.selectedPlayer ? { id: multiplayer.selectedPlayer.playerId, name: multiplayer.selectedPlayer.handle } : null
    },
    pendingReward: Boolean(captureRewardAsset),
    pendingOperation: livingWorld.pendingCommand ?? raidBusyIntent,
    acknowledgedCausalIds: []
  });
  const enterLivingRaid = (bossId: string) => {
    if (!worldInteractionEnabled) return;
    beginWorldActionFeedback();
    const admission = beginPlayModalAdmission();
    if (!admission) return;
    const round = Object.values(livingWorld.snapshot?.raids ?? {}).find((candidate) => candidate.bossId === bossId && candidate.phase !== "settled" && candidate.phase !== "expired");
    const boss = livingWorld.snapshot?.bosses[bossId];
    if (!round) { showWorldFeedback("wilds_world_raid_missing"); return; }
    setRaidReturnPosition({ ...state.player });
    void livingWorld.enterRaid(bossId, round.id, state.player).then((projection) => {
      const admitted = projection.raids[round.id];
      if (!admitted) throw new Error("wilds_raid_admission_missing");
      const squads = Array.isArray(admitted.squads) ? admitted.squads as string[][] : [];
      const placement = squads.some((squad) => squad.includes(multiplayer.guestId)) ? "fighter" : "support";
      if (!commitPlayModalAdmission(admission, "raid")) return;
      setActiveRaid({ bossId, roundId: round.id, placement, connected: true });
      if (boss?.familyId) presentation.playCue(bossAudioCue("telegraph", boss.familyId as WildsBossFamilyId));
    }).catch((error) => {
      if (canCommitModalAdmission(modalAdmissionRef.current, admission)) {
        showWorldFeedback(error instanceof Error ? error.message : "wilds_raid_join_failed");
      }
    });
  };
  const activatePulse = () => {
    beginWorldActionFeedback();
    if (pulse.kind === "tend") {
      if (!nearbyGrove || nearbyGrove.grove.groveId !== pulse.groveId) return;
      claimPlayModalOwner("ecology");
      setGroveCollectedHoney(false);
      setActiveGroveId(pulse.groveId);
      return;
    }
    if (pulse.kind === "enter") {
      if (pulse.landmarkId === "wayfinder-hollow") {
        if (!civic.completedSourceIds.includes("settlement:wayfinder-hollow")) {
          dispatch({
            type: "record-civic-event",
            event: createWildsCivicEvent({
              settlementId: "wayfinder-hollow",
              actorId: civicActorId,
              kind: "settlement.discovered",
              sourceId: "settlement:wayfinder-hollow",
              occurredAt: new Date().toISOString(),
              cardProofDigest: null,
              reputation: 3
            })
          });
        }
        presentation.playCue(settlementAudioCue("arrival"));
      }
      claimPlayModalOwner(pulse.landmarkId === "wayfinder-hollow" ? "settlement" : "landmark");
      setActiveLandmarkId(pulse.landmarkId);
      return;
    }
    if (pulse.kind === "join") {
      if (pulse.activityId.startsWith("ecology:")) {
        const ecology = livingWorld.snapshot?.ecologySites[pulse.activityId];
        if (!ecology || !nearbyEcology || nearbyEcology.site.id !== ecology.id) return;
        if (ecology.phase !== "foreshadowed") {
          presentation.playCue(ecologyAudioCue("discovered", ecology.familyId));
          claimPlayModalOwner("ecology");
          setActiveEcologySiteId(ecology.id);
          return;
        }
        const admission = beginPlayModalAdmission();
        if (!admission) return;
        void livingWorld.discoverEcology(ecology.id, state.player).then((projection) => {
          const admitted = projection.ecologySites[ecology.id];
          const cursor = projection.cursor;
          if (!admitted || !cursor) throw new Error("wilds_ecology_discovery_receipt_missing");
          if (!commitPlayModalAdmission(admission, "ecology")) return;
          dispatch({
            type: "record-ecology-event",
            event: createWildsEcologyReceipt({
              actorId: civicActorId,
              siteId: admitted.id,
              familyId: admitted.familyId,
              kind: "site.discovered",
              sourceEventId: cursor.eventId,
              occurredAt: cursor.pulse,
              canonicalRevision: projection.revision,
              mastery: 1,
              cardProofDigest: null
            })
          });
          presentation.playCue(ecologyAudioCue("discovered", admitted.familyId));
          setActiveEcologySiteId(admitted.id);
        }).catch((error) => {
          if (canCommitModalAdmission(modalAdmissionRef.current, admission)) {
            showWorldFeedback(error instanceof Error ? error.message : "wilds_ecology_discovery_failed");
          }
        });
        return;
      }
      enterLivingRaid(pulse.activityId);
      return;
    }
    if (pulse.kind === "collect" || pulse.kind === "greet") return;
    dispatchLayeredSearch(state.player);
  };
  const homeDistance = journeyHome ? Math.hypot(journeyHome.position.x-state.player.x,journeyHome.position.z-state.player.z) : Infinity;
  const discoveryLead = nextReachableWildsSite(siteRuntime.sites, state.explorationAtlas.siteKeys, state.player, activeTraversalCapabilities);
  const discoveryStory = discoveryLead ? projectWildsDiscoveryStory(discoveryLead, activeTraversalCapabilities, state.explorationAtlas.siteKeys.includes(discoveryLead.key)) : null;
  const companionChapter = worldOverlayState.panelKey === "mission" ? projectWildsCompanionChapter({
    companion: activeAsset ? { id: activeAsset.id, name: activeAsset.manifest.name } : undefined,
    memories: journeyMemories, position: state.player,
    inOuterWorld: state.siteSpace.spaceId === "wildz.space.outer.v1",
    capabilities: activeTraversalCapabilities, discovery: discoveryLead ?? undefined
  }) : null;
  const nextJourneyStep = unfinishedJourneyShelter ? { title: "Finish your trail shelter", reason: `Your materials are waiting at the site, ${wildsTrailDirection(state.player, unfinishedJourneyShelter.position)}. Return to contribute what remains or finish construction.`, actionLabel: "Continue your shelter", action: "shelter" as const } : projectWildsNextStep({ hasCompanion: Boolean(activeAsset), timber: stewardMaterials.timber, stone: stewardMaterials.stone, hasShelter: Boolean(journeyHome), hasWorkbench: Boolean(homeLife?.activities.some(item => item.action === "craft")), hasCache: Boolean(homeLife?.activities.some(item => item.action === "storage")) });
  const closeJourney = () => { dispatchStageOverlay({ type: "panel", key: null }); setRequestedCommand(null); setCommandDismissSignal(signal=>signal+1); };
  const followJourneyStep = (action: WildsNextStepAction) => {
    if (!interactionEnabled || modalOwner !== "none" || worldOverlayState.panelKey !== "mission") return;
    if (action === "shelter" && unfinishedJourneyShelter) { setTrackedDestination({ label: "Finish your shelter", ...unfinishedJourneyShelter.position }); setRequestedCommand("construction"); showWorldFeedback(`Your shelter site is ${wildsTrailDirection(state.player, unfinishedJourneyShelter.position)}. Approach it to add materials or finish.`, true); return; }
    closeJourney();
    if (action === "scan") { dispatchLayeredSearch(state.player, true); return; }
    if (action === "gather-timber" || action === "gather-stone") { gatherNearestStewardResource(action === "gather-timber" ? "lumber" : "quarry"); return; }
    if (action === "explore") {
      const site = nextReachableWildsSite(siteRuntime.sites, state.explorationAtlas.siteKeys, state.player, activeTraversalCapabilities);
      if (site) setTrackedDestination({ label: site.family.replaceAll("-", " "), x: site.entrance.x, z: site.entrance.z });
      const guidance = site ? projectWildsDiscoveryStory(site, activeTraversalCapabilities, false) : null;
      showWorldFeedback(site ? `Your next trail: ${site.family.replaceAll("-", " ")}, ${wildsTrailDirection(state.player, site.entrance)}. ${wildsDiscoveryImpression(site)} ${guidance?.approachHint ?? ""} ${guidance?.routeHint ?? ""}` : "You have explored the nearby sites. Travel beyond this region to find a new trail.", true);
      return;
    }
    if (state.siteSpace.spaceId !== "wildz.space.outer.v1") { showWorldFeedback("Return to the open world before placing this structure."); return; }
    if ((action === "workbench" || action === "cache") && journeyHome && homeDistance > 6) {
      setTrackedDestination({ label: "Your shelter", ...journeyHome.position });
      showWorldFeedback(`Return to your shelter first: ${wildsTrailDirection(state.player, journeyHome.position)}. Place this building within 24 m of your shelter so it becomes part of your home.`, true);
      return;
    }
    continuousBuilder.close();
    const blueprintId = action === "shelter" ? "trail-shelter" : action === "workbench" ? "steward-workbench" : "trail-cache";
    setStewardPlacementMode(blueprintId);
    setStewardPlacementPreview(projectWildsStewardPlacement({ actorPosition: state.player, blueprintId, point: { x: state.player.x + 2, z: state.player.z + 2 } }));
    showWorldFeedback("Tap nearby ground to preview your build, then confirm its position.");
  };
  const restAtJourneyHome = () => {
    if (modalOwner !== "none" || !journeyHome || homeDistance > 6 || state.siteSpace.spaceId !== "wildz.space.outer.v1" || state.battle) return;
    closeJourney();
    dispatch({ type: "rest", at: new Date().toISOString() });
    rememberJourney({ kind: "home", subjectId: journeyHome.structureId, companionId: activeAsset?.id, companionName: activeAsset?.manifest.name, label: "Rested at your trail shelter", position: journeyHome.position });
    markPlaytest("home", "success");
    showWorldFeedback(`${activeAsset ? `${activeAsset.manifest.name} rests beside you. ` : ""}Camp restores energy and eases fatigue. Your expedition combo resets.`);
  };

  const doHomeActivity = (action: WildsHomeAction, structureId: string, companionId?: string) => {
    if (!interactionEnabled || modalOwner !== "none" || worldOverlayState.panelKey !== "mission") return;
    const structure = journeyStructures.find(item => item.structureId === structureId);
    if (!structure) return;
    if (state.siteSpace.spaceId !== "wildz.space.outer.v1" || Math.hypot(structure.position.x-state.player.x,structure.position.z-state.player.z) > 6) {
      closeJourney(); showWorldFeedback(`Come home first: ${wildsTrailDirection(state.player, structure.position)}.`, true); return;
    }
    if (action === "rest") { restAtJourneyHome(); return; }
    if (action === "invite") {
      const companion = state.inventory.find(asset => asset.id === companionId);
      if (!companion || !isPlayableAsset(state, companion.id)) return;
      dispatch({type:"select-asset",assetId:companion.id,kaiUPulse});
      closeJourney(); showWorldFeedback(`${companion.manifest.name} is beside you. Rest together or take a new trail.`); return;
    }
    setConstructionFocus(action === "craft" ? "tools" : "storage");
    setRequestedCommand("construction");
  };

  const activatePulseFromCommandPanel = () => {
    if (modalOwner !== "none" || worldOverlayState.panelKey !== "commandCenter") return;
    dispatchStageOverlay({ type: "panel", key: null });
    activatePulse();
  };
  const executeCommandAction = (action: WildsCommandAction) => {
    if (action.type === "open-mission") setRequestedCommand("mission");
    else if (action.type === "open-field-guide") setRequestedCommand("fieldGuide");
    else if (action.type === "open-satchel") setRequestedCommand("satchel");
    else if (action.type === "sleep") { sleepHere(); dispatchStageOverlay({ type: 'panel', key: null }); }
    else if (action.type === "wake") dispatch({ type: 'wake' });
    else if (action.type === "open-trail-pack") setRequestedCommand("deck");
    else if (action.type === "open-vault") setRequestedCommand("vault");
    else if (action.type === "open-map") openWorldMapFromCommandPanel();
    else activatePulseFromCommandPanel();
  };
  const riftTo = async (destination: { x: number; z: number }) => {
    beginWorldActionFeedback();
    const localRequest = {
      source: state.player,
      destination,
      idempotencyKey: `rift:${crypto.randomUUID()}`
    };
    try {
      if (!networkEnabled) {
        const local = authorizeRiftTravel(localRequest, {
          playerId: multiplayer.selfId,
          coordinationPulse: String(kaiMoment.uPulse),
          locked: modalOwner !== "map"
        });
        if (!local.ok) throw new Error(local.error);
        dispatch({ type: "apply-rift-grant", grant: local.grant, playerId: local.grant.playerId });
        resetTransientTraversal(local.grant.destination, projectWildsAquaticPresentationAtPosition({
          ...local.grant.destination,
          airborne: false,
          canSwim
        }).terrainElevation);
        multiplayer.selectPlayer(null);
        setActiveLandmarkId(null);
        releasePlayModalOwner("map");
        setMapOpen(false);
        showWorldFeedback("Rift admitted here. Its shared position will synchronize when connection returns.");
        return;
      }
      const response = await fetch("/api/wilds/rift", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomKey: multiplayer.roomKey,
          guestId: multiplayer.guestId,
          ...localRequest
        })
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; grant?: RiftTravelGrant; error?: string } | null;
      if (!response.ok || !result?.ok || !result.grant) throw new Error(result?.error ?? "wilds_rift_failed");
      dispatch({
        type: "apply-rift-grant",
        grant: result.grant,
        playerId: result.grant.playerId
      });
      resetTransientTraversal(result.grant.destination, projectWildsAquaticPresentationAtPosition({
        ...result.grant.destination,
        airborne: false,
        canSwim
      }).terrainElevation);
      multiplayer.selectPlayer(null);
      setActiveLandmarkId(null);
      releasePlayModalOwner("map");
      setMapOpen(false);
    } catch (error) {
      showWorldFeedback(error instanceof Error ? error.message : "wilds_rift_failed");
    }
  };
  const handleCrewModeChange = async (assetId: string, mode: "follow" | "roam") => {
    const card = state.inventory.find(asset => asset.id === assetId && canOperateWildzCrewCard(asset, ownerReceizId, crewCustody));
    if (!card) return;
    try {
      if (mode === "roam" && !await crewExpeditions.roam(card)) return;
      if (mode === "follow" && await crewExpeditions.recall(assetId)) return;
    } catch (error) { showWorldFeedback(error instanceof Error ? error.message : "This creature cannot start exploring here."); return; }
    const latestCrew = crewControlScope.current;
    if (latestCrew.owner !== ownerReceizId || !latestCrew.inventory.some(asset => asset.id === assetId
      && asset.proof.digest === card.proof.digest && canOperateWildzCrewCard(asset, latestCrew.owner, latestCrew.custody))) return;
    setState(current => ({ ...current, crewPreferences: setWildsCrewPreference(current.crewPreferences, current.inventory, ownerReceizId, assetId, mode, crewCustody) }));
    void recordWildsCrewModeObservation({ ownerReceizId, assetId, mode, genomeProofDigest: card.proof.digest })
      .catch(() => showWorldFeedback("Movement preference saved; activity history could not be saved."));
  };

  const commandItems: readonly WildsCommandItem[] = [
    {
      key: "crew",
      label: "Creature crew",
      icon: <Icons.roam size={21} />,
      dockVisible: false,
      content: <WildsCrewPanel
        accompanyingAssetIds={[state.selectedAssetId, ...state.supportAssetIds.filter((id): id is string => Boolean(id))]}
        cards={crewCards}
        reports={crewExpeditions.reports}
        readHistory={crewExpeditions.history}
        modes={crewPreferences?.byAssetId ?? {}}
        onModeChange={handleCrewModeChange}
      />
    },
    {
      key: "commandCenter",
      label: "Living Command Center",
      icon: <Icons.pulse size={21} />,
      status: `${kaiMoment.latticeCoordinate} · ${kaiMoment.chakra} · ${commandModel.connection}`,
      dockVisible: false,
      content: <WildsCommandCenter model={commandModel} onAction={executeCommandAction} />
    },
    {
      key: "mission",
      label: "Living Story",
      icon: <Icons.trophy size={21} />,
      badge: `${sagaProgressPercent}%`,
      status: `${saga.act.ark} · ${saga.chapter.title}`,
      content: (
        <div className="wilds-command-content wilds-mission-content">
          <section className="wilds-saga-grid" aria-label="Explorer progression">
            <article className="wilds-saga-objective">
              <small>Earned explorer progress</small>
              <strong>Level {hudModel.player.level}</strong>
              <p>{hudModel.xp.current} earned XP · {hudModel.xp.achievementCount} achievements</p>
              <div className="wilds-progress" role="progressbar" aria-label="Explorer level progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hudModel.xp.progress} aria-valuetext={hudModel.xp.remaining ? `${hudModel.xp.levelXp} of 100 XP toward the next level` : "Maximum explorer level reached"}><span style={{ width: `${hudModel.xp.progress}%` }} /></div>
              <p>{hudModel.xp.remaining ? `${hudModel.xp.remaining} XP to level ${hudModel.player.level + 1}.` : "Maximum explorer level reached."} Complete captures, battles, companion milestones, and story objectives to grow.</p>
            </article>
          </section>
          <WildsJourneyPanel step={nextJourneyStep} companionName={activeAsset?.manifest.name} memories={journeyMemories} home={journeyHome ? { label: "Your trail shelter", distance: homeDistance } : undefined} onAction={followJourneyStep} onReturnHome={() => { if (!journeyHome) return; setTrackedDestination({ label: "Your shelter", ...journeyHome.position }); closeJourney(); showWorldFeedback(`Your trail shelter is ${wildsTrailDirection(state.player, journeyHome.position)}. Rest beside it to recover for your next journey.`, true); }} onRest={restAtJourneyHome} canRest={homeDistance <= 6 && state.siteSpace.spaceId === "wildz.space.outer.v1" && !state.battle} />
          {companionChapter ? <WildsCompanionChapter chapter={companionChapter} onFindPlace={(position, kind) => {
            if (!interactionEnabled || modalOwner !== "none" || worldOverlayState.panelKey !== "mission") return;
            closeJourney();
            if (state.siteSpace.spaceId !== "wildz.space.outer.v1") {
              showWorldFeedback("Return to the open world to follow this shared trail.", true);
              return;
            }
            setTrackedDestination({ label: kind === "meeting" ? "Where you first met" : "Your shared trail", ...position });
            showWorldFeedback(`${kind === "meeting" ? "Where you first met" : "Your next shared trail"}: ${wildsTrailDirection(state.player, position)}.`, true);
          }} /> : null}
          {homeLife ? <WildsHomeLife home={homeLife} onAction={doHomeActivity} /> : null}
          {discoveryStory ? <WildsDiscoveryStory discovery={discoveryStory} onExplore={() => followJourneyStep("explore")} /> : null}
          <WildsSagaPanel
            actionHistory={state.actionHistory}
            journeyMemories={journeyMemories}
            location={{ name: state.siteSpace.spaceId === "wildz.space.outer.v1" ? describeWildsPoint(state.player) : "Within an inner world", position: state.player }}
            onOpenLedger={() => {
              if (!interactionEnabled || modalOwner !== "none" || worldOverlayState.panelKey !== "mission") return;
              closeJourney();
              walletController.navigate("ledger");
              claimPlayModalOwner("wallet");
              walletController.openTerminal();
            }}
            missions={sagaMissions}
            mode={livingWorld.mode}
            onBattleTrainer={(trainer) => openTrainerEncounter(trainer, "mission")}
            onContribute={(node) => void livingWorld.contributeStory(saga.dayId, node.definition.id, node.definition.acceptedVerbs[0]!, 1, state.player).catch((error) => handleStoryCommandError(error, "Story progress could not save. Try again."))}
            onEnterTournament={(tournamentId, qualificationGrantId) => {
              try {
                void livingWorld.enterSagaTournament(tournamentId, qualificationGrantId).catch((error) => handleStoryCommandError(error, "Tournament entry could not complete. Try again."));
              } catch (error) {
                handleStoryCommandError(error, "Tournament entry could not complete. Try again.");
              }
            }}
            pending={Boolean(livingWorld.pendingCommand)}
            player={sagaPlayer}
            playerId={ownerReceizId}
            playerName={playerDisplayName}
            saga={saga}
            tournament={sagaTournament}
            trainers={sagaTrainers}
          />
          <div className="wilds-story-utilities">
            <section className="wilds-story-rewards" aria-label="Φ earned through world work"><Icons.gift size={23} aria-hidden="true" /><div>
              <small>Φ earned through world work</small><strong>Φ{formatWildsPhiExact(earnedWorldPhi.totalPhiMicro)}</strong>
              <p>Stone Φ0.01 · timber Φ0.02 · funded building Φ0.01. Companions can help you earn more. Rewards depend on the world’s available supply; your wallet balance is shown separately.</p>
            </div></section>
            <div className="wilds-story-collection wilds-saga-deck-count"><Icons.assets size={22} aria-hidden="true" /><div><small>Your living collection</small><strong>{deckCards.length}/∞ living cards in your deck</strong></div></div>
          </div>
          <details className="wilds-story-tools"><summary><span><Icons.analytics size={15} aria-hidden="true" />Playtest tools</span><Icons.chevronDown size={14} aria-hidden="true" /></summary><WildsPlaytestPanel playtest={playtest} /></details>
        </div>
      )
    },
    {
      key: "fieldGuide",
      label: "Field Guide",
      icon: <Icons.book size={21} />,
      badge: `${discoveredKaiLineages.size}/∞`,
      status: `${state.inventory.length} unique companions · ${nextHabitat}`,
      content: (
        <div className="wilds-command-content wilds-field-guide">
          <WildzCommandInsight label="Live discovery lead" value={nextHabitat} detail="Scan from your current trail position. The result changes the Guide, Vault, and explorer record together.">
            <button onClick={() => dispatchLayeredSearch(state.player)} type="button">Pulse this trail</button>
          </WildzCommandInsight>
          <div className="wilds-command-content-lead">
            <span><small>Living species lineages</small><strong>{discoveredKaiLineages.size} deterministic lineages encountered</strong></span>
            <b>∞ possible</b>
          </div>
          <div className="wilds-field-guide-tip">
            <Icons.search aria-hidden="true" size={18} />
            <span><strong>Scan habitat trails</strong><small>Pulse terrain in {nextHabitat} to reveal the next species signal.</small></span>
          </div>
          <div className="wilds-field-guide-grid" aria-label="Discovered and undiscovered species">
            {visibleGuideFamilies.map((family) => {
              const card = discoveredByFamily.get(family.id);
              return (
                <article className={`wilds-field-guide-entry ${card ? "is-discovered" : "is-undiscovered"}`} key={family.id}>
                  {card ? <WildsCreatureThumbnail asset={card} /> : <span className="wilds-field-guide-mystery" aria-hidden="true"><Icons.help size={19} /></span>}
                  <div>
                    <strong>{card?.manifest.name ?? "Undiscovered"}</strong>
                    <small>{family.habitat} · {family.element}</small>
                    <em>{card ? "Verified discovery" : "Scan this habitat"}</em>
                  </div>
                </article>
              );
            })}
          </div>
          <small className="wilds-field-guide-limit">No species ceiling · every Kai lineage and evolution form is constructed live from deterministic birth geometry. Showing 24 nearby habitat signals.</small>
        </div>
      )
    },
    {
      key: "satchel",
      label: "Foraging Satchel",
      icon: <Icons.products size={21} />,
      badge: state.beans,
      status: `${state.beans} beans · ${state.fusionSparks} sparks`,
      content: (
        <div className="wilds-command-content wilds-satchel">
          <WildsBodyReadout body={livePlayerBody} onSleep={sleepHere} onWake={() => dispatch({ type: 'wake' })} />
          <WildsNourishmentPanel nourishment={walletVisibleNourishment} pending={foodSavePending} kaiUPulse={nourishmentKaiUPulse} fuelPercent={livePlayerBody.fuelPercent}
            plants={nourishmentPlants} animals={wildAnimals} livestock={ownedLivestock} player={nourishmentPlayer} inspectedId={inspectedNourishmentId} focusStoredFoodSignal={storedFoodFocusSignal}
            huntBlocker={foodPackFull ? 'Your food pack is full. Eat a portion before hunting.' : huntingSupport.blocker}
            captureBlocker={captureBlocker}
            onGather={gatherFood} onHunt={huntAnimal} onCapture={captureLivestock} onProduce={collectLivestockFood}
            onEat={eatFood} />
          <WildsResourceExchange items={resourceExchange.items} cards={resourceExchange.cards} actions={resourceExchange.actions} availability={resourceExchange.availability} checkAvailability={resourceExchange.checkAvailability} />

          <WildzCommandInsight label="Trail preparation" value={`${Math.round(livePlayerEnergy.energy)}% energy`} detail="Use what you gathered now; every action updates the same live explorer state used in the world.">
            <button onClick={() => dispatch({ type: "rest", at: new Date().toISOString() })} type="button">Make camp</button>
            <button onClick={() => dispatch({ type: "train", at: new Date().toISOString() })} type="button">Train leader</button>
            <button aria-pressed={visualSettings.lanternEnabled} onClick={() => setVisualSettings(current => ({ ...current, lanternEnabled: !current.lanternEnabled }))} type="button">{visualSettings.lanternEnabled ? "Stow lantern" : "Equip lantern"}</button>
            <button onClick={() => dispatch({ type: "mission" })} type="button">How to earn mission progress</button>
          </WildzCommandInsight>
          <div className="wilds-command-content-lead">
            <span><small>Trail stores</small><strong>Gathered across the living Wilds</strong></span>
            <b>{state.worldRank}</b>
          </div>
          <div className="wilds-satchel-grid" aria-label="Foraged resources and progression">
            <article><Icons.sparkle aria-hidden="true" size={18} /><span><small>Trail beans</small><strong>{state.beans}</strong></span><em>Companion care</em></article>
            <article><Icons.pulse aria-hidden="true" size={18} /><span><small>Fusion sparks</small><strong>{state.fusionSparks}</strong></span><em>Breeding supplies</em></article>
            <article><Icons.receiz aria-hidden="true" size={18} /><span><small>Bond traces</small><strong>{activeProgress.bond}</strong></span><em>{activeAsset?.manifest.name ?? activeCard.name}</em></article>
            <article><Icons.star aria-hidden="true" size={18} /><span><small>World mastery</small><strong>{state.worldMastery}</strong></span><em>Permanent</em></article>
            <article><Icons.trophy aria-hidden="true" size={18} /><span><small>Trail streak</small><strong>{state.streak}×</strong></span><em>Active</em></article>
            <article><Icons.package aria-hidden="true" size={18} /><span><small>Ascension catalysts</small><strong>{state.ascensionCatalysts.length}</strong></span><em>Vaulted</em></article>
            <article><Icons.sparkle aria-hidden="true" size={18} /><span><small>Living hay</small><strong>{stewardMaterials.hay}</strong></span><em>Exact lots</em></article>
            <article><Icons.products aria-hidden="true" size={18} /><span><small>Living timber</small><strong>{stewardMaterials.timber}</strong></span><em>Exact lots</em></article>
            <article><Icons.package aria-hidden="true" size={18} /><span><small>Foundation stone</small><strong>{stewardMaterials.stone}</strong></span><em>Exact lots</em></article>
          </div>
          <WildzCommandInsight label="Trail beans" value={`${state.beans} available`} detail="Successful captures earn 6 beans; accepted bond training earns 4. Feed a creature for 3 beans or provide restorative care for 8 in its active care cycle.">
            <button onClick={() => { setVaultFocusedAssetId(activeAsset?.id ?? null); dispatchStageOverlay({ type: "panel", key: "vault" }); }} type="button">Open creature care</button>
          </WildzCommandInsight>
          <WildzCommandInsight label="Earn your next breeding" value={`${state.missionProgress}/100 expedition progress`} detail="Your first Spark starts your lineage. Each completed expedition earns one more; each child costs one Spark. Both parents stay in your vault and rest for 24 hours.">
            <progress aria-label="Progress toward next Fusion Spark" max={100} value={state.missionProgress} />
            <button onClick={() => dispatchStageOverlay({ type: "panel", key: "mission" })} type="button">Continue expedition</button>
            <button onClick={() => dispatchStageOverlay({ type: "panel", key: "vault" })} type="button">Open breeding in Card Vault</button>
          </WildzCommandInsight>
          <WildsStewardCraftPanel onSelectPiece={selectLivingBuildPiece} focusSection={constructionFocus} projection={stewardCraft} nearbySite={nearbyConstructionSite} siteDistance={nearbyConstructionSite ? Math.hypot(nearbyConstructionSite.position.x - state.player.x, nearbyConstructionSite.position.z - state.player.z) : 0} tools={stewardTools} equippedToolId={livingWorld.snapshot?.equippedStewardTools?.[ownerReceizId] ?? null} nearbyWorkbench={Boolean(nearbyStewardWorkbench)} nearbyCache={Boolean(nearbyTrailCache)} stored={{ timber: storedStewardLots.filter((lot) => lot?.kind === "timber").length, stone: storedStewardLots.filter((lot) => lot?.kind === "stone").length }} onContributeSite={(site) => void contributeNearbyConstructionSite(site)} onWorkSite={(site) => void workNearbyConstructionSite(site)} onCraftTool={(kind) => void craftStewardTool(kind)} onEquipTool={(toolId) => { beginWorldActionFeedback(); void livingWorld.equipStewardTool(toolId).then(() => showWorldFeedback("Field tool equipped. Matching work now preserves one higher grade of material while durability remains.")).catch((error) => handleStoryCommandError(error, "That tool could not be equipped.")); }} onStoreMaterial={(kind) => void moveStewardMaterial(kind, "deposit")} onWithdrawMaterial={(kind) => void moveStewardMaterial(kind, "withdraw")} onSelectBlueprint={(blueprintId) => {
            beginWorldActionFeedback();
            continuousBuilder.close();
            setStewardPlacementMode(blueprintId);
            setStewardPlacementPreview(null);
            showWorldFeedback(blueprintId === "trail-bridge"
              ? "Tap a nearby crossing to preview it. Both banks are read before any exact lot can move."
              : "Tap nearby living ground to preview it. No exact lot moves until you confirm.");
            dispatchStageOverlay({ type: "panel", key: null });
          }} />
        </div>
      )
    },
    {
      key: "construction",
      label: "Living Construction",
      icon: <Icons.construction size={21} />,
      badge: `${stewardMaterials.hay}·${stewardMaterials.timber}·${stewardMaterials.stone}`,
      status: `${stewardMaterials.hay} hay · ${stewardMaterials.timber} timber · ${stewardMaterials.stone} stone`,
      dockVisible: false,
      content: (
        <div className="wilds-command-content wilds-construction-center">
          <div className="wilds-construction-center-lead">
            <span><small>Sovereign making</small><strong>Living Construction</strong><em>Shape useful places from exact materials gathered in this world.</em></span>
            <div aria-label={`${stewardMaterials.hay} hay, ${stewardMaterials.timber} timber, and ${stewardMaterials.stone} stone in Satchel`}>
              <b><Icons.sparkle size={16} />{stewardMaterials.hay}</b>
              <b><Icons.timber size={16} />{stewardMaterials.timber}</b>
              <b><Icons.quarry size={16} />{stewardMaterials.stone}</b>
            </div>
          </div>
          <WildsStewardCraftPanel onSelectPiece={selectLivingBuildPiece} focusSection={constructionFocus} projection={stewardCraft} nearbySite={nearbyConstructionSite} siteDistance={nearbyConstructionSite ? Math.hypot(nearbyConstructionSite.position.x - state.player.x, nearbyConstructionSite.position.z - state.player.z) : 0} tools={stewardTools} equippedToolId={livingWorld.snapshot?.equippedStewardTools?.[ownerReceizId] ?? null} nearbyWorkbench={Boolean(nearbyStewardWorkbench)} nearbyCache={Boolean(nearbyTrailCache)} stored={{ timber: storedStewardLots.filter((lot) => lot?.kind === "timber").length, stone: storedStewardLots.filter((lot) => lot?.kind === "stone").length }} onContributeSite={(site) => void contributeNearbyConstructionSite(site)} onWorkSite={(site) => void workNearbyConstructionSite(site)} onCraftTool={(kind) => void craftStewardTool(kind)} onEquipTool={(toolId) => { beginWorldActionFeedback(); void livingWorld.equipStewardTool(toolId).then(() => showWorldFeedback("Field tool equipped. Matching work now preserves one higher grade of material while durability remains.")).catch((error) => handleStoryCommandError(error, "That tool could not be equipped.")); }} onStoreMaterial={(kind) => void moveStewardMaterial(kind, "deposit")} onWithdrawMaterial={(kind) => void moveStewardMaterial(kind, "withdraw")} onSelectBlueprint={(blueprintId) => {
            beginWorldActionFeedback();
            continuousBuilder.close();
            setStewardPlacementMode(blueprintId);
            setStewardPlacementPreview(null);
            showWorldFeedback(blueprintId === "trail-bridge"
              ? "Tap a nearby crossing to preview it. Both banks are read before any exact lot can move."
              : "Tap nearby living ground to preview it. No exact lot moves until you confirm.");
            dispatchStageOverlay({ type: "panel", key: null });
          }} />
        </div>
      )
    },
    {
      key: "deck",
      label: "Trail Pack",
      icon: <Icons.assets size={21} />,
      badge: `${trailPack.length}/3`,
      status: `${trailSynergy.score}% synergy`,
      content: (
        <div className="wilds-command-content wilds-heartbeat-content">
          <WildzCommandInsight label="Pack consequence" value={`${trailSynergy.score}% synergy`} detail={trailSynergy.score >= 70 ? "Scout, capture, and recovery support are resonating." : trailSynergy.score >= 45 ? "Scout and support roles are active; another complementary role deepens the loop." : "Bond and diversify the pack to unlock stronger shared effects."} />
          <div className="wilds-command-content-lead">
            <span><small>Wilds Heartbeat</small><strong>One leader · two bonded supports</strong></span>
            <b>{trailSynergy.score}%</b>
          </div>
          <div className="wilds-heartbeat-pack" aria-label="Trail Pack leader and support companions">
            {trailPack.map((card, index) => {
              const progress = exactCompanionProgress(state, card);
              const mastery = projectWildsCardMastery(card);
              const element = creatureForm(card.manifest.formId)?.element ?? card.manifest.species;
              const mood = index === 0 ? heartbeatMood : progress.bond >= 60 ? "Devoted" : progress.bond >= 25 ? "Steady" : "Listening";
              return <article className={index === 0 ? "is-leader" : "is-support"} key={card.id}>
                <WildsCreatureThumbnail asset={card} />
                <div>
                  <small>{index === 0 ? "Leader" : `Support ${index}`} · {mastery.primary}</small>
                  <strong>{card.manifest.name}</strong>
                  <span>Lv. {progress.level} · {element} · {card.manifest.stats.power} PWR</span>
                  <em>{mood} mood · Bond {progress.bond}</em>
                </div>
              </article>;
            })}
            {Array.from({ length: Math.max(0, 3 - trailPack.length) }, (_, index) => <div className="wilds-heartbeat-empty" key={`empty:${index}`}><Icons.pulse aria-hidden="true" size={18} /><span><strong>Support trail open</strong><small>Seal another companion to complete the pack.</small></span></div>)}
          </div>
          <div className="wilds-heartbeat-synergy" aria-label="Pack synergy effects">
            <span><small>Pack synergy</small><strong>{trailSynergy.score}%</strong></span>
            <span><small>Role coverage</small><strong>{trailSynergy.coverage}/8</strong></span>
            <span><small>Active effects</small><strong>{trailSynergy.score >= 70 ? "Scout · capture · recovery" : trailSynergy.score >= 45 ? "Scout · support" : "Bonding"}</strong></span>
          </div>
          {deckCards.length > 1 ? <div className="wilds-heartbeat-reserve" aria-label="Choose Trail Pack supports">
            <small>Shape support composition</small>
            <div>{deckCards.filter((card) => card.id !== activeAsset?.id).slice(0, 12).map((card) => {
              const selected = trailSupportCards.some((support) => support.id === card.id);
              return <button
                aria-label={`${selected ? "Replace" : "Choose"} ${card.manifest.name} as support`}
                aria-pressed={selected}
                key={card.id}
                onClick={() => {
                  const existingSlot = state.supportAssetIds.findIndex((id) => id === card.id);
                  const slot = existingSlot >= 0 ? existingSlot as 0 | 1 : state.supportAssetIds[0] === null ? 0 : state.supportAssetIds[1] === null ? 1 : 0;
                  dispatch({ type: "assign-support", slot, assetId: existingSlot >= 0 ? null : card.id });
                }}
                type="button"
              ><WildsCreatureThumbnail asset={card} /><span>{card.manifest.name}</span></button>;
            })}</div>
          </div> : null}
          <div className="wilds-heartbeat-echoes">
            <div><small>Pack memory</small><p>{heartbeatMemory}</p></div>
            <div><small>World whispers</small>{heartbeatWhispers.length ? heartbeatWhispers.map((message) => <p key={message}>{message}</p>) : <p>The trail is quiet. Your companions are listening for change.</p>}</div>
          </div>
        </div>
      )
    },
    {
      key: "vault",
      label: "Card Vault",
      icon: <Icons.box size={21} />,
      badge: state.inventory.length,
      status: `${state.inventory.length} sealed · ${activeAsset?.manifest.name ?? "No leader"}`,
      content: (
        <div className="wilds-command-content wilds-vault-command-content">
          <WildzCommandInsight label="Collection consequence" value={activeAsset?.manifest.name ?? "Choose a leader"} detail="Vault selection becomes the active explorer companion in the drawer, Trail Pack, and battle." />
          <div className="wilds-vault-sheet-heading"><span><small>Portable card vault</small><strong>{state.inventory.length} sealed {state.inventory.length === 1 ? "card" : "cards"}</strong></span><button className="wilds-open-market" onClick={openMarketFromVault} type="button"><Icons.store size={18} /> Open Market</button></div>
          <WildsInventory
            readCrewHistory={crewExpeditions.history}
            state={state}
            ownerReceizId={ownerReceizId}
            kaiMoment={kaiMoment}
            focusedAssetId={vaultFocusedAssetId ?? state.selectedAssetId}
            cardOrder={cardOrder}
            onCardOrderChange={setCardOrder}
            playerVault={createCurrentPlayerVault}
            vaultAdmission={currentVaultAdmission}
            onPrepareCard={onPrepareCard}
            onExportCard={onExportCard}
            onExportVault={onExportVault}
            onPrepareVault={onPrepareVault}
            onInput={dispatch}
            onListAsset={lazyMarket ? listMarketCreature : onListAsset}
            marketListedAssetIds={currentMarketListedCardIds}
            onRestoreArtifact={async (file, confirmCardOnly, currentPlayState) => {
              const outcome = await onRestoreArtifact(file, confirmCardOnly, currentPlayState);
              const verifiedAssetIds = new Set(outcome.verifiedAssetIds);
              const restoredPlayState = {
                ...outcome.playState,
                pendingSyncAssetIds: outcome.playState.pendingSyncAssetIds.filter((assetId) => !verifiedAssetIds.has(assetId))
              };
              setState(restoredPlayState);
              resetTransientTraversal(restoredPlayState.player, projectWildsAquaticPresentationAtPosition({
                ...restoredPlayState.player,
                airborne: false,
                canSwim: false
              }).terrainElevation);
              setMovementMode(outcome.playerContinuity.settings.movementMode);
              setCardOrder(outcome.playerContinuity.settings.cardOrder);
              setVisualSettings(normalizeWildsVisualSettings(outcome.playerContinuity.settings.visual));
              presentation.setAudioSettings(normalizeWildsAudioSettings(outcome.playerContinuity.settings.audio));
              return { ...outcome, playState: restoredPlayState };
            }}
          />
        </div>
      )
    }
  ];

  return (
    <section className="panel play-panel wilds-play-panel" id="play" style={{ visibility: worldVisible ? "visible" : "hidden" }} inert={!worldVisible || undefined}>
      <div className="play-header wilds-header">
        <div>
          <h2>
            <span>Play:</span> Receiz Wilds
          </h2>
          <p>{campaignName} is a living creature-card world: roam freely, meet trainers, complete the shared Kai story, and leave real achievements in its history.</p>
        </div>
        <div className="play-stats wilds-stat-strip" aria-label="Current game stats">
          <StatusPill tone="pink">{state.streak}x streak</StatusPill>
          <StatusPill tone="neutral">{state.beans} beans</StatusPill>
          <StatusPill tone="gold">Level {state.level}</StatusPill>
        </div>
      </div>

      <div className="wilds-shell wilds-playable-shell">
        <div className="wilds-world" data-wilds-wallet-state={walletController.status}>
          <div
            className={`wilds-stage${creationPlacing ? " is-creation-placement" : ""}${state.encounter.phase === "hint" ? ` signal-${state.encounter.proximity}` : ""}${combatSurface === "pvp" ? " pvp-active" : ""}${multiplayerRosterOpen ? " multiplayer-roster-open" : ""}${combatSurface === "wild" ? " wild-battle-active" : ""}${commandPanelOpen ? " is-command-panel-open" : ""}${worldOverlayState.toolsOpen ? " is-world-tools-open" : ""}`}
            aria-label="Receiz Wilds playable 3D world"
            ref={gameplaySurfaceRef}
          >
            <WildsWorldCanvas
              monumentLightState={monumentLightState}
              onWorldReady={onWorldReady}
              onWorldInitialized={onWorldInitialized}
              embodiedAudioSources={embodiedAudioSources}
              crewModes={crewPreferences?.byAssetId}
            crewTravelMembershipRevision={crewExpeditions.runtimeMembershipRevision}
            crewTravelRuntime={crewExpeditions.runtime}
              homeResidents={homeResidents}
              activeCapabilityFamily={burrowBuilder.busy ? "burrow" : activeWorldCapability}
              activeWorkSource={activeWorkSource}
              sleepingCreationBed={sleepingInBed ? availableCreationBed : null}
              nourishment={{plants:nourishmentPlants, animals:wildAnimals, livestock:ownedLivestock, hunt:huntPresentation, selectedAnimalId:nourishmentActionId, reducedMotion:qualityProfile.reducedMotion, onInspect:inspectNourishment, onGather:gatherFood, onHunt:huntAnimal, onCapture:captureLivestock, onProduce:collectLivestockFood}}
              stewardPlacementPreview={stewardPlacementPreview}
              burrowPreview={burrowBuilder.preview ? {...burrowBuilder.preview,blocker:burrowBuilder.blocker} : null}
              creationPreview={creationPreview}
              creationProjections={creationPhysical.projections}
              creationNavigation={creationNavigation||undefined}
              creationSource={creationPhysical}
              creationWorldId={creationController?.scope().worldId||'wilds:global:v3'}
              onCreationNavigation={handleCreationNavigation}
              constructionPreview={continuousBuilder.preview}
              constructionSelectionEnabled={continuousBuilder.selectionEnabled && worldInteractionEnabled}
              onSelectConstruction={continuousBuilder.selectComponent}
              onDragConstruction={continuousBuilder.adjusting ? continuousBuilder.dragPiece : undefined}
              activeConstructionId={continuousBuilder.open?continuousBuilder.selected?.componentId:undefined}
              explorerIdentityKey={ownerReceizId}
              aerialCapabilities={activeTraversalCapabilities}
              aerialStateRef={aerialStateRef}
              verticalTraversalRef={verticalTraversalRef}
              handActionsRef={handActionsRef}
              playerFacingRef={playerFacingRef}
              onJumpTravel={delta => {
                if (verticalTraversalRef.current.jumpVelocity === undefined) {jumpTravelRef.current = null; return;}
                const travel = jumpTravelRef.current;
                if (!travel || !canUseWorldStage()) return;
                const steps = advanceWildsJumpTravel(travel, delta);
                jumpTravelDispatching.current = true;
                try {for (let step = 0; step < steps; step++) dispatchWorldInput(travel.input);}
                finally {jumpTravelDispatching.current = false;}
              }}
              heldCreationEquipment={heldCreationEquipment}
              equipmentControlsRef={equipmentControlsRef}
              verticalIntentRef={verticalIntentRef}
              horizontalAllowedRef={horizontalAllowedRef}
              flightEndurancePotential={traversalPotentials.flightEndurance}
              liftPotential={traversalPotentials.lift}
              pressurePotential={traversalPotentials.pressure}
              aquaticPresentation={aquaticPresentation}
              state={presentationState}
              character={character}
              remotePlayers={multiplayer.remotePlayers}
              qualityProfile={qualityProfile}
              onFrameSample={reportFrameSample}
              onAerialModeChange={setAerialMode}
              onLandingRequired={consumePendingAerialLanding}
              onAerialEnergyChange={setAerialEnergy}
              onVerticalReadoutChange={publishVerticalReadout}
              onCameraHeadingChange={updateCameraHeading}
              playerTapEnabled={worldInteractionEnabled && !creationPlacing}
              onSleepingPlayerTap={() => {
                if (!canUseWorldStage() || !["bed", "sleep"].includes(state.playerBreaths?.mode ?? "")) return;
                if (!activeAsset) {showWorldFeedback("Choose a companion before entering the dream competition."); return;}
                claimPlayModalOwner("dream");
                setDreamTrial(createWildsDreamTrial(activeAsset.id, readActionKaiUPulse()));
              }}
              searchEnabled={worldInteractionEnabled && (creationOpen || discoveryActive || Boolean(stewardPlacementMode) || continuousBuilder.open || burrowBuilder.open)}
              resourcePending={Boolean(livingWorld.pendingCommand)}
              resourceCompanionReady={Boolean(activeCondition && activeCondition.fatigue < 85 && activeCondition.injuries.length < 4)}
              livingWorld={livingWorld.snapshot}
              livingPhysicalObstacles={livingPhysicalObstacles}
              siteRuntime={siteRuntime}
              siteSpace={state.siteSpace}
              worldMode={settlementWorldMode}
              kaiMoment={kaiMoment}
              visualSettings={visualSettings}
              supportCards={trailSupportCards}
              vistaHeading={activeVistaId && nearbyOverlook?.id === activeVistaId ? nearbyOverlook.viewHeading : activeVistaId&&nearbyMonument?.id===activeVistaId?nearbyMonument.viewHeading:null}
              suspended={(exclusiveOwner === "map" && mapOpen) || exclusiveOwner === "dream"}
              onSelectPlayer={(player) => {
                if (canUseWorldStage()) multiplayer.selectPlayer(player);
              }}
              trainers={sagaTrainers}
              onSelectTrainer={(trainer) => openTrainerEncounter(trainer, "world")}
              onSearchPoint={(point) => {
                if(creationOpen){creationPoint.current?.({position:{x:point.x,y:point.surfaceWorldY,z:point.z},yaw:creationPreview?.plan.pose.yaw||0});return;}
                if (burrowBuilder.open) { burrowBuilder.point(point); return; }
                if (continuousBuilder.open) { continuousBuilder.point(point); return; }
                if (stewardPlacementMode) {
                  setStewardPlacementPreview(projectWildsStewardPlacement({ actorPosition: state.player, blueprintId: stewardPlacementMode, point }));
                  return;
                }
                dispatchLayeredSearch(point);
              }}
              onInteractResource={(source) => { void gatherStewardResource(source); }}
              onSitePortal={(siteKey, direction) => {
                if (!canUseWorldStage()) return;
                const discovery = writeWildsSiteRuntimeDiscovery({ siteKey: null }, siteRuntime, state.siteSpace.spaceId, state.player.x, state.siteSpace.position.y, state.player.z, 14);
                if (direction === "enter" && discovery.siteKey !== siteKey) return;
                if (direction === "enter") {
                  const portal = siteRuntime.physical.portals.find((candidate) => candidate.siteKey === siteKey);
                  const firstSurface = portal ? siteRuntime.physical.surfaces.find((surface) => surface.spaceId === portal.toSpaceId) : null;
                  if (firstSurface?.flooded && !activeTraversalCapabilities.includes("swim")) {
                    showWorldFeedback("This entrance opens underwater. Lead with a creature that can swim.");
                    return;
                  }
                }
                dispatch({ type: "site-portal", direction, siteKey, siteRuntime });
              }}
              onSelectOverlook={(overlookId) => {
                if (!canUseWorldStage() || aerialMode !== "ground" || nearbyOverlook?.id !== overlookId) return;
                setActiveVistaId((current) => current === overlookId ? null : overlookId);
              }}
            />

            {nearbyMonument&&worldInteractionEnabled&&!creationOpen&&!continuousBuilder.open&&!burrowBuilder.open&&aerialMode==='ground'&&state.playerBreaths?.mode!=='bed'?<WildsMonumentPanel key={nearbyMonument.id} monument={nearbyMonument} lights={monumentLightState?.id===nearbyMonument.id?monumentLightState.lights:[0,0,0]} panorama={activeVistaId===nearbyMonument.id}
              onLightChange={setMonumentLightState}
              onPanorama={()=>{if(canUseWorldStage())setActiveVistaId(current=>current===nearbyMonument.id?null:nearbyMonument.id);}}
              onScan={()=>{if(canUseWorldStage())dispatchLayeredSearch({x:nearbyMonument.position.x,z:nearbyMonument.position.z,surfaceWorldY:nearbyMonument.position.y});}}/>:null}
            {burrowBuilder.open && worldInteractionEnabled ? <WildsBurrowBuilderPanel builder={burrowBuilder} /> : null}
            {continuousBuilder.open && worldInteractionEnabled ? <WildsContinuousBuilderPanel builder={continuousBuilder} materials={stewardMaterials} onOpenCatalogue={() => openLivingConstruction()} onUse={kind => {
              if (kind !== "bed") { openLivingConstruction(kind === "workshop" ? "tools" : "storage"); return; }
              const selected = continuousBuilder.selected;
              const bed = selected && livingWorld.snapshot ? resolveWildsConstructionFunction(livingWorld.snapshot, selected.componentId, "bed") : null;
              if (!bed || !canSleepInWildsBed(bed, state.player, state.siteSpace)) {
                showWorldFeedback("Move to the finished bed in this room to sleep."); return;
              }
              dispatch({ type: "rest", bed, at: kaiUPulseToISOString(kaiUPulse), kaiUPulse });
              continuousBuilder.close();
              showWorldFeedback("Sleeping in bed. Breaths and companion fatigue recover as Kai time advances.");
            }} /> : null}
            {stewardPlacementPreview ? <WildsStewardPlacementHud
              blueprintLabel={stewardCraft.blueprints.find(blueprint => blueprint.id === stewardPlacementPreview.blueprintId)?.label ?? "Build"}
              onCancel={() => {
                setStewardPlacementMode(null);
                setStewardPlacementPreview(null);
                showWorldFeedback("Placement released. The terrain is open to discovery again.");
              }}
              onConfirm={confirmStewardPlacement}
              partnerName={activeAsset?.manifest.name ?? activeCard.name}
              pending={Boolean(livingWorld.pendingCommand)}
              preview={stewardPlacementPreview}
            /> : null}

            <div aria-hidden={referenceHomeBlocked} className="wildz-reference-home" inert={referenceHomeBlocked ? true : undefined}>
              <WildzReferenceHud
              remoteCrewMarkers={remoteCrewMarkers}
              crewMapSource={crewMapSource}
                character={character}
                interactionEnabled={worldInteractionEnabled}
                modalOwned={exclusiveOwner !== "none"}
                heading={playerHeading}
                model={hudModel}
                onOpenMap={openWorldMap}
                onOpenProfile={openProfile}
                onOpenMission={() => {
                  if (canUseWorldStage()) setRequestedCommand("mission");
                }}
              />
            </div>

            <WildsRoamingBattle {...roamingBattle.dialogProps} />
            {exclusiveOwner === "none" ? <WildsRoamingNearby players={multiplayer.remotePlayers} selfId={multiplayer.selfId}
              position={state.player} pending={roamingAuthorizationPending || roamingBattle.dialogProps.pending}
              resumeLabel={roamingBattle.resumableEncounter ? roamingBattle.resumableEncounter.capturePhase === "captured" ? "Restore captured creature" : "Resume roaming encounter" : undefined}
              onResume={roamingBattle.resume}
              onChallenge={target => {
                if (!canUseWorldStage() || roamingAuthorizationPending) return;
                setRoamingAuthorizationPending(true);
                void walletController.secureTransferAuthority().then(() => roamingBattle.challenge(target))
                  .catch(cause => showWorldFeedback(cause instanceof Error ? cause.message : "The challenge could not start."))
                  .finally(() => setRoamingAuthorizationPending(false));
              }} /> : null}

            <WildsBalancedStatusHud
              audio={{
                onChange: (settings) => { if (canUseWorldStage()) presentation.setAudioSettings(settings); },
                onUnlock: () => { if (canUseWorldStage()) void presentation.unlockAudio(); },
                ready: presentation.audioReady,
                settings: presentation.audioSettings
              }}
              battleModalOwned={exclusiveOwner === "combat" && combatSurface === "pvp"}
              blocked={backgroundHomesBlocked}
              connected={multiplayer.mode === "receiz_live"}
              dismissSignal={commandDismissSignal}
              interactionEnabled={worldInteractionEnabled}
              kaiMoment={kaiMoment}
              modalOwned={exclusiveOwner === "multiplayer"}
              messenger={messenger}
              multiplayer={multiplayer}
              onEnterRaid={enterLivingRaid}
              onOpenCommandCenter={() => {
                if (!canUseWorldStage()) return;
                setRequestedCommand("commandCenter");
              }}
              onOpenWallet={(origin) => {
                if (!canUseWorldStage()) return;
                claimPlayModalOwner("wallet", origin);
                walletController.openTerminal();
              }}
              onSendPhi={(peer) => {
                if (!canUseWorldStage()) return;
                messenger.closeMessenger();
                setWalletMessagePeer(peer);
                walletController.resetTransfer();
                walletController.selectTransferRecipient(peer.handle);
                walletController.navigate("send");
                claimPlayModalOwner("wallet");
                walletController.openTerminal();
              }}
              resourceExchange={<WildsResourceExchange items={resourceExchange.items} cards={resourceExchange.cards} actions={resourceExchange.actions} availability={resourceExchange.availability} checkAvailability={resourceExchange.checkAvailability} peer={messenger.selectedPeer} />}
              onClaimResource={resourceExchange.actions.claim}
              onClaimCard={async (offer) => {
                const admission = await messenger.claimCardOffer(offer);
                dispatchWorldInput({ type: "import-card", asset: admission.card });
              }}
              onRosterOpenChange={handleMultiplayerRosterOpenChange}
              player={state.player}
              wallet={walletController}
              walletEnabled
              world={livingWorld}
            />

            {exclusiveOwner === "wallet" ? <WildsWalletTerminal
              inventoryCounts={{ resourceUnits: projectWildsWalletPlayStateSeed({ ...state, playerNourishment: walletVisibleNourishment }).resourceUnits + availableMaterialLots.length + availableWalletResourceLots.reduce((total, lot) => total + lot.quantity, 0) + walletPackagedResourceUnits + walletSourcePackedUnits, creatureCards: state.inventory.length }}
              actionHistory={state.actionHistory}
              livingOperations={livingWorld.snapshot?.livingOperations}
              cards={state.inventory}
              cardConditions={state.adventureConditions}
              materialLots={availableMaterialLots}
              nourishment={walletVisibleNourishment}
              ledgerMaterialLots={Object.values(livingWorld.snapshot?.materialLots ?? {}).filter((lot) => sameWildzPlayerCoordinate(livingWorld.snapshot ? wildsMaterialCustodian(livingWorld.snapshot, lot) : lot.ownerReceizId, ownerReceizId))}
              stewardPhiAwards={stewardPhiAwards}
              resourceLots={availableWalletResourceLots}
              resourceCards={walletResourceCards}
              onUnpackResourceCard={unpackWalletSourcePackage}
              onSendAsset={sendWalletAsset}
              onProposeTrade={proposeWalletTrade}
              onApproveTrade={stagedWalletTrade.onApproveTrade}
              onRecoverTrade={stagedWalletTrade.onRecoverTrade}
              incomingTrades={walletTradeInbox}
              incomingAgreements={stagedWalletInbox}
              incomingAssets={stagedWalletTrade.incomingAssets}
              onAcceptIncomingAsset={stagedWalletTrade.onAcceptIncomingAsset}
              publicUsername={walletPublicUsername}
              state={walletController}
              onPrepareCard={(asset) => onPrepareCard(asset, createWildsPlayerVault({
                playerId: ownerReceizId,
                exportedAt: new Date().toISOString(),
                playState: state,
                character,
                settings: { avatarStyle: explorerStyle, movementMode, audio: presentation.audioSettings, cardOrder, visual: visualSettings },
                personalEvents: initialPlayerContinuity?.personalEvents ?? [],
                canonicalCursor: livingWorld.snapshot
                  ? { worldId: "wilds:global:v3", revision: livingWorld.snapshot.revision, eventId: livingWorld.snapshot.cursor?.eventId ?? null }
                  : initialPlayerContinuity?.canonicalCursor ?? { worldId: "wilds:global:v3", revision: 0, eventId: null },
                receipts: initialPlayerContinuity?.receipts ?? []
              }))}
              onSendCard={async (asset, targetHandle) => { await walletController.secureTransferAuthority(); return messenger.sendCardOffer(asset, targetHandle); }}
              onListCard={lazyMarket ? listMarketCreature : onListAsset}
              marketListedAssetIds={currentMarketListedCardIds}
              onSendResource={async (resourceLot, targetHandle) => {
                await walletController.secureTransferAuthority();
                const response = await fetch("/api/wilds/resources/transfers", {
                  method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ resourceLot, targetHandle })
                });
                const payload = await response.json().catch(() => null) as { claimUrl?: string; error?: string } | null;
                if (!response.ok || !payload?.claimUrl) throw new Error(payload?.error ?? "wilds_resource_transfer_failed");
                return { claimUrl: payload.claimUrl };
              }}
              onSendMaterial={async (materialLot, targetHandle) => {
                await walletController.secureTransferAuthority();
                const response = await fetch("/api/wilds/resources/transfers", {
                  method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
                  body: JSON.stringify({ materialLot, targetHandle })
                });
                const payload = await response.json().catch(() => null) as { claimUrl?: string; error?: string } | null;
                if (!response.ok || !payload?.claimUrl) throw new Error(payload?.error ?? "wilds_material_transfer_failed");
                return { claimUrl: payload.claimUrl };
              }}
              onClose={() => closeOwnedModal("wallet")}
              onNavigate={walletController.navigate}
              onOpenVaultCard={(assetId) => {
                setVaultFocusedAssetId(assetId);
                closeOwnedModal("wallet");
                window.requestAnimationFrame(() => {
                  setRequestedCommand("vault");
                  window.requestAnimationFrame(() => setVaultFocusedAssetId(null));
                });
              }}
              onRefresh={() => { void walletController.refresh(); }}
              onLookupRecipient={walletController.lookupRecipient}
              onSelectRecipient={walletController.selectTransferRecipient}
              onSelectReceiveCoordinate={walletController.selectReceiveCoordinate}
              onReviewAmount={walletController.reviewTransferAmount}
              onStage={() => { void walletController.stageTransfer(); }}
              onAuthorizationPointerStart={walletController.authorizationPointerStart}
              onAuthorizationPointerCancel={walletController.authorizationPointerCancel}
              onAuthorize={walletController.authorizeTransfer ?? undefined}
              onRecover={() => { void walletController.recoverTransfer(); }}
              onEditTransfer={walletController.editTransfer}
              onResetTransfer={walletController.resetTransfer}
              onReturnToMessages={walletMessagePeer ? () => {
                closeOwnedModal("wallet");
                messenger.openMessenger(walletMessagePeer);
                setWalletMessagePeer(null);
              } : undefined}
              onRequestReceive={(amountPhiMicro) => { void walletController.requestReceive(amountPhiMicro); }}
            /> : null}

            {creationOpen && liveCreationContext ? <CreationSession
              key={`${ownerReceizId}:${state.siteSpace.spaceId}`}
              displayName={playerDisplayName} ownerId={ownerReceizId} spaceId={state.siteSpace.spaceId} cards={crewCards} conditions={state.adventureConditions}
              newPlacementPose={() => {
                const runtime = creationRuntime.current;
                if (!runtime || runtime.environment().spaceId !== liveCreationContext.spaceId) throw Error('Your location changed. Reopen the builder here.');
                const position = runtime.position();
                const p={...position,x:position.x+3};
                return {position:wildsBuildGroundPoint(p,liveCreationContext.spaceId,sampleWildsConstructionTerrainAt(constructionTerrainPads,p.x,p.z,sampleWildsBuildGround(p.x,p.z).elevation)),yaw:liveCreationContext.pose.yaw};
              }}
              recover={suppliedCreationController ? undefined : localCreation.controller.recover}
              validatePlacement={suppliedCreationController ? undefined : (plan,definition)=>localCreation.controller.validatePlacement(plan,liveCreationContext,definition)}
              onSaveObject={async instanceId => {
                const saved = await saveWorldCreationProofImage({ instanceId, resolve: localCreation.controller.resolve, world: livingWorld.currentSource, library: () => creationLibrary || null });
                const url = URL.createObjectURL(new Blob([saved.bytes.slice().buffer as ArrayBuffer], {type: saved.mimeType}));
                const link = document.createElement('a'); link.href = url; link.download = saved.filename; link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
              }} objectLibrary={creationLibrary} classes={creationPanelClasses} lots={availableMaterialLots} context={liveCreationContext} commit={async(definition,plan,workerIds,selected,context)=>{creationCommitContext.current=context||null;return creationController.commit(definition,plan,workerIds,selected);}} objects={Object.values(creationPhysical.instances).flatMap(instance=>creationPhysical.definitions[instance.definitionDigest]?[{instance,definition:creationPhysical.definitions[instance.definitionDigest]}]:[])}
              cardAdmissions={creationCardAdmissions}
              onMovementInput={dispatchWorldInput} headingRef={cameraHeadingRef} onPlacementModeChange={setCreationPlacing}
              placementRef={creationPoint} onPreview={setCreationPreview} onClose={closeCreation}
              onManualBuild={openManualFromCreation}
              onGatherHay={() => gatherNearestStewardResource("gather")}
            /> : null}
            <WildzWorldControls
              equipment={equipmentControls}
              onJump={state.playerBreaths?.mode==='bed'||state.playerBreaths?.mode==='sleep'?undefined:jumpPlayer}
              onHandAction={state.playerBreaths?.mode==='bed'||state.playerBreaths?.mode==='sleep'?undefined:usePlayerHand}
              onOpenCreation={()=>{
                continuousBuilder.close();burrowBuilder.close();dispatchStageOverlay({type:'dismiss'});
                setCreationContext({worldId:'wilds:global:v3',spaceId:state.siteSpace.spaceId,pose:{position:wildsBuildGroundPoint({x:state.player.x+3,y:state.siteSpace.position.y,z:state.player.z},state.siteSpace.spaceId,sampleWildsConstructionTerrainAt(constructionTerrainPads,state.player.x+3,state.player.z,sampleWildsBuildGround(state.player.x+3,state.player.z).elevation)),yaw:0},budget:{...stewardMaterials},techniques:[],quality:qualityProfile.tier==='low'?'low':'high'});
                setCreationOpen(true);
              }}
              onOpenCrew={() => setRequestedCommand("crew")}
              onBeginConstruction={()=>selectLivingBuildPiece(continuousBuilder.kind)}
              buildingActive={continuousBuilder.open||burrowBuilder.open}
              aerialEnergy={aerialEnergy}
              aerialMode={aerialMode}
              aquaticPresentation={aquaticPresentation}
              verticalIntentRef={verticalIntentRef}
              verticalReadout={verticalReadout}
              activeCard={activeAsset}
              cameraHeadingRef={cameraHeadingRef}
              cardConditions={state.adventureConditions}
              capabilityControls={quickCapabilityControls}
              capabilityContexts={activeCapabilityContexts}
              cardOrder={cardOrder}
              commandItems={commandItems}
              materialCounts={stewardMaterials}
              nourishment={{ state: walletVisibleNourishment, kaiUPulse: nourishmentKaiUPulse, fuelPercent: livePlayerBody.fuelPercent, onEat: eatFood, onOpen: openNourishmentSatchel }}
              companionProgress={state.companionProgress}
              dismissSignal={commandDismissSignal}
              exclusiveOwner={exclusiveOwner}
              gestureCancelSignal={gestureCancelSignal}
              newRosterAssetId={newRosterAssetId}
              movementMode={movementMode}
              onAerialToggle={toggleAerialTraversal}
              nearbyCards={state.inventory}
              overlayDispatch={dispatchStageOverlay}
              overlayState={worldOverlayState}
              onAudioCue={presentation.playCue}
              onCardOrderChange={setCardOrder}
              onInput={dispatchWorldInput}
              onMovementModeChange={setMovementMode}
              onRequestedCommandHandled={() => setRequestedCommand(null)}
              bedSleep={availableBed || availableCreationBed || state.playerBreaths?.mode === 'sleep' ? { sleeping: sleepingInBed || state.playerBreaths?.mode === 'sleep', onToggle: () => {
                if (sleepingInBed || state.playerBreaths?.mode === 'sleep') dispatchWorldInput({ type: "wake" });
                else sleepHere();
              } } : undefined}
              onRest={() => dispatchWorldInput({ type: "rest", at: new Date().toISOString() })}
              onRequestCapability={requestWildsCapability}
              onSelectCard={(assetId) => dispatchWorldInput({ type: "select-asset", assetId })}
              requestedCommand={requestedCommand}
              traversalCapabilities={activeTraversalCapabilities}
            />

            {nourishmentActionSource && exclusiveOwner === 'none' && !creationOpen ? <WildsNourishmentActions source={nourishmentActionSource}
              player={nourishmentPlayer} huntBlocker={huntingSupport.blocker} captureBlocker={captureBlocker} packFull={foodPackFull}
              onClose={() => setNourishmentActionId(null)} onGather={gatherFood} onHunt={huntAnimal} onCapture={captureLivestock} onProduce={collectLivestockFood} /> : null}

            {exclusiveOwner === "combat" && combatSurface === "wild" && wildBattleActive && state.battle ? (
              <WildsBattle
                battle={state.battle}
                encounterPhase={state.encounter.phase}
                encounterPlacement={state.encounter.phase === "idle" ? undefined : state.encounter.placement}
                inventory={state.inventory}
                onAction={(action) => dispatch({ type: "battle-action", action, at: new Date().toISOString() })}
                onDismiss={() => {
                  releasePlayModalOwner("combat");
                  dispatch({ type: "dismiss-reveal" });
                }}
              />
            ) : null}

            {discoveryActive ? <div className={`wilds-search-reticle ${state.encounter.phase === "idle" ? "" : activeProximity}`} aria-live="polite">{proximityLabel}</div> : null}

            {trackedDestination && exclusiveOwner === "none" ? <div className="wilds-tracked-destination" role="status">
              <Icons.map size={17} aria-hidden="true" /><span><strong>{trackedDestination.label}</strong><small>{wildsTrailDirection(state.player, trackedDestination)}</small></span>
              {trackedDestination.resourceKind === "hay" && Math.hypot(trackedDestination.x - state.player.x, trackedDestination.z - state.player.z) <= 5.5 ? <button className="wilds-resource-gather" disabled={Boolean(livingWorld.pendingCommand) || aerialMode !== "ground"} onClick={() => gatherNearestStewardResource("gather")} type="button">Gather hay</button> : null}
              <button aria-label="Show tracked destination on map" onClick={openWorldMap} type="button"><Icons.map size={16} /></button>
              <button aria-label="Clear tracked destination" onClick={() => setTrackedDestination(null)} type="button"><Icons.close size={16} /></button>
            </div> : null}
            <div className={`wilds-event-toast${captureToastActive ? " is-capture" : ""}`} aria-live="polite">
              {captureToastActive ? <Icons.seal aria-hidden="true" size={19} /> : null}
              <span key={worldFeedbackRevision}>{riftError || (activeLandmarkId ? `${currentLandmark?.name ?? "Landmark"} entrance awakened.` : state.lastEvent)}</span>
              {captureToastActive ? <small>Portable proof sequence</small> : null}
            </div>
          </div>

        </div>
      </div>
      {mapVisited ? <WildsWorldMap
        trackedDestination={trackedDestination}
        onClearDestination={() => setTrackedDestination(null)}
        crewMapSource={crewMapSource}
        currentPosition={state.player}
        discoveredLandmarkIds={discoveredLandmarkIds}
        explorationAtlas={state.explorationAtlas}
        onImportMap={atlas => setState(current => ({
          ...current,
          explorationAtlas: mergeWildsMapDiscovery(current.explorationAtlas, atlas)
        }))}
        guestId={multiplayer.guestId}
        missionProgress={state.missionProgress}
        onClose={() => {
          releasePlayModalOwner("map");
          setMapOpen(false);
        }}
        onRift={riftTo}
        open={exclusiveOwner === "map" && mapOpen}
        qualityProfile={qualityProfile}
        reducedMotion={reducedMotion}
        remotePlayers={multiplayer.remotePlayers}
        worldMastery={state.worldMastery}
        landmarkProgress={landmarkProgress}
        livingWorld={livingWorld.snapshot}
        ecologyKnowledge={state.ecologyKnowledge}
        bossKnowledge={state.bossKnowledge}
        trainers={sagaTrainers}
      /> : null}
      <WildsVisitedSurface active={exclusiveOwner === "landmark"}>
      <WildsLandmarkExperience
        access={activeLandmarkId && activeLandmarkId !== "wayfinder-hollow" ? evaluateLandmarkAccess(WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === activeLandmarkId)!, landmarkProgress) : null}
        card={activeAsset}
        roster={state.inventory}
        hearttreeConditions={state.hearttreeConditions}
        hearttreeSquadAssetIds={state.hearttreeSquadAssetIds}
        guestId={multiplayer.guestId}
        landmarkId={exclusiveOwner === "landmark" && activeLandmarkId !== "wayfinder-hollow" ? activeLandmarkId : null}
        onExit={() => {
          releasePlayModalOwner("landmark");
          setActiveLandmarkId(null);
        }}
        onAudioCue={presentation.playCue}
        onHearttreeReceipt={(receipt) => dispatch({ type: "hearttree-admit", receipt })}
        onHearttreeSquadChange={(assetIds) => dispatch({ type: "hearttree-select-squad", assetIds })}
        onArenaCommit={commitArenaSettlement}
        onUnlock={(unlockId) => setState((current) => ({
          ...current,
          achievements: Array.from(new Set([...current.achievements, unlockId])).slice(0, 64)
        }))}
        worldMode={settlementWorldMode}
      />
      </WildsVisitedSurface>
      {exclusiveOwner === "dream" && dreamTrial ? <WildsDreamWorld
        trial={dreamTrial}
        companionName={state.inventory.find(asset => asset.id === dreamTrial.assetId)?.manifest.name ?? "Your companion"}
        resultMessage={state.lastEvent}
        readKaiUPulse={readActionKaiUPulse}
        onComplete={taps => dispatch({type: "dream-trial", trial: dreamTrial, taps})}
        onExit={() => {releasePlayModalOwner("dream"); setDreamTrial(null);}}
      /> : null}
      {exclusiveOwner === "trainer" && activeTrainer && activeAsset && trainerEncounter ? <WildsTrainerEncounter
        activeCard={activeAsset}
        encounter={trainerEncounter}
        onAccept={(rosterIds) => sendTrainerEncounter({ type: "accept", rosterIds })}
        onCancel={() => {
          releasePlayModalOwner("trainer");
          sendTrainerEncounter({ type: "cancel" });
          setActiveTrainer(null);
          setTrainerEncounter(null);
        }}
        onContinue={() => {
          sendTrainerEncounter({ type: "continue" });
          window.setTimeout(() => {
            releasePlayModalOwner("trainer");
            setActiveTrainer(null);
            setTrainerEncounter(null);
          }, 180);
        }}
        onRematch={() => sendTrainerEncounter({ type: "rematch" })}
        onSkipTransition={() => sendTrainerEncounter({ type: "skip-transition" })}
        onTransitionComplete={() => sendTrainerEncounter({ type: "transition-complete" })}
        playerLevel={sagaPlayer?.trainerLevel ?? state.level}
        roster={state.inventory}
        trainer={activeTrainer}
      /> : null}
      {exclusiveOwner === "combat" && combatSurface === "trainer" && activeTrainer && activeAsset && trainerEncounter?.phase === "combat" ? <MortalArenaExperience
        card={activeAsset}
        roster={state.inventory}
        opponent={projectCampaignOpponentFromTrainer(activeTrainer)}
        resultPresentation="director"
        onAudioCue={presentation.playCue}
        onCommit={(settlement, path) => {
          commitArenaSettlement(settlement);
          const outcome = settlement.result.outcome === "victory" ? "player_victory" : settlement.result.outcome === "fled" ? "fled" : "trainer_victory";
          sendTrainerEncounter({
            type: "settlement-committed",
            settlementId: settlement.id,
            result: {
              outcome,
              xp: outcome === "player_victory" ? 60 : outcome === "fled" ? 18 : 30,
              bond: outcome === "player_victory" ? 2 : outcome === "fled" ? 0 : 1,
              arenaPathStage: path.stage
            }
          });
          void livingWorld.settleTrainerBattle(saga.dayId, activeTrainer.id, outcome)
            .catch((error) => handleStoryCommandError(error, "Trainer battle progress could not save. Try again."));
        }}
        onExit={() => {
          releasePlayModalOwner("combat");
          setActiveTrainer(null);
          setTrainerEncounter(null);
        }}
        onUnlock={(unlockId) => setState((current) => ({ ...current, achievements: Array.from(new Set([...current.achievements, unlockId])).slice(0, 64) }))}
      /> : null}
      <WildsVisitedSurface active={exclusiveOwner === "settlement"}>
      <WildsSettlementExperience
        actorId={civicActorId}
        card={activeAsset}
        civic={civic}
        livingWorld={livingWorld.snapshot}
        onAudioCue={presentation.playCue}
        onDistrictChange={setActiveDistrictId}
        onCivicEvent={(event) => dispatch({ type: "record-civic-event", event })}
        onExit={() => {
          releasePlayModalOwner("settlement");
          setActiveLandmarkId(null);
        }}
        open={exclusiveOwner === "settlement" && activeLandmarkId === "wayfinder-hollow"}
        remotePlayers={multiplayer.remotePlayers}
        worldMode={settlementWorldMode}
      />
      </WildsVisitedSurface>
      <WildsVisitedSurface active={exclusiveOwner === "ecology"}>
      <WildsEcologyExperience
        card={activeAsset}
        onExit={() => {
          releasePlayModalOwner("ecology");
          setActiveEcologySiteId(null);
        }}
        onSubmit={async ({ siteId, amount }) => {
          const projection = await livingWorld.contributeEcology(siteId, state.player, amount);
          const admitted = projection.ecologySites[siteId];
          const cursor = projection.cursor;
          if (!admitted || !cursor || !activeAsset) throw new Error("wilds_ecology_contribution_receipt_missing");
          dispatch({
            type: "record-ecology-event",
            event: createWildsEcologyReceipt({
              actorId: civicActorId,
              siteId: admitted.id,
              familyId: admitted.familyId,
              kind: "activity.accepted",
              sourceEventId: cursor.eventId,
              occurredAt: cursor.pulse,
              canonicalRevision: projection.revision,
              mastery: amount,
              cardProofDigest: activeAsset.proof.digest
            })
          });
          presentation.playCue(ecologyAudioCue(admitted.phase === "aftermath" ? "resolved" : "step", admitted.familyId));
        }}
        open={exclusiveOwner === "ecology" && Boolean(activeEcologySite)}
        participantCount={(activeEcologySite?.participantIds.length ?? 0) + 1}
        site={activeEcologySite}
        worldMode={settlementWorldMode}
      />
      </WildsVisitedSurface>
      {activeGrove ? <WildsRegenerativeGroveExperience
        open={exclusiveOwner === "ecology" && Boolean(activeGrove)}
        grove={activeGrove}
        companion={activeAsset && activeCondition ? {
          name: activeAsset.manifest.name,
          willing: Boolean(activeGroveMandate),
          energy: Math.max(0, 100 - activeCondition.fatigue),
          fatigue: activeCondition.fatigue
        } : null}
        actions={activeGroveActions}
        busyAction={groveBusyAction}
        reconnecting={groveBusyAction !== null && livingWorld.mode === "receiz_recovery_pending"}
        error={riftError || null}
        collectedHoney={groveCollectedHoney}
        onAction={(action) => {
          const preview = activeGrovePreviews.find((candidate) => candidate.action === action);
          if (!preview?.valid || groveBusyAction) return;
          const emission = wildsWorldSourceEmission(livingWorld.snapshot);
          const nextGrove = admitWildsGroveAction({ grove: activeGrove, preview });
          const nextEmission = admitWildsEmissionOutcome({
            emission,
            operation: preview.operation,
            contributionClass: preview.operation.category === "construction" ? "construction" : "ecology",
            preview: preview.emission
          });
          const resourceLot = createWildsGroveResourceLot({
            operation: preview.operation,
            ownerReceizId,
            sourceGrove: { groveId: activeGrove.groveId, head: activeGrove.head, honey: activeGrove.materials.honey },
            admittedGrove: { groveId: nextGrove.groveId, head: nextGrove.head, parentHead: nextGrove.parentHead, honey: nextGrove.materials.honey }
          });
          setGroveBusyAction(action);
          setGroveCollectedHoney(false);
          beginWorldActionFeedback();
          void livingWorld.actInGrove(preview.operation, nextGrove, nextEmission, preview.emission.amountPhiMicro, resourceLot, activeGroveMandate)
            .then((projection) => {
              const admitted = projection.groves[activeGrove.groveId];
              if (!admitted || admitted.head !== nextGrove.head) throw new Error("wilds_grove_admission_missing");
              if (resourceLot) {
                const collected = projection.resourceLots[resourceLot.lotId];
                const custodian = projection.resourceCustody[resourceLot.lotId]?.ownerReceizId ?? collected?.ownerReceizId;
                if (collected?.head !== resourceLot.head || !sameWildzPlayerCoordinate(custodian, ownerReceizId)) {
                  throw new Error("wilds_grove_resource_admission_missing");
                }
                setGroveCollectedHoney(true);
              }
            })
            .catch((cause) => showWorldFeedback(friendlyWildsGameplayError(cause, "The grove is holding this work safely. Try again.")))
            .finally(() => setGroveBusyAction(null));
        }}
        onOpenWallet={() => {
          walletController.navigate("assets");
          claimPlayModalOwner("wallet");
          walletController.openTerminal();
        }}
        onExit={() => {
          releasePlayModalOwner("ecology");
          setActiveGroveId(null);
          setGroveBusyAction(null);
        }}
      /> : null}
      <WildsVisitedSurface active={exclusiveOwner === "raid"}>
      <WildsRaidExperience
        boss={activeRaidBoss}
        busyIntent={raidBusyIntent}
        canonical={livingWorld.mode === "receiz_live"}
        cardName={activeAsset?.manifest.name ?? activeCard.name}
        connected={activeRaid?.connected ?? false}
        encounter={activeRaidEncounter}
        error={raidError}
        onAction={(intent) => {
          if (!activeRaid || !activeAsset || !activeRaidBoss || !activeRaidRoles) return;
          beginWorldActionFeedback();
          setRaidError(null);
          setRaidBusyIntent(intent);
          void livingWorld.actRaid(activeRaid.bossId, activeRaid.roundId, intent).then((projection) => {
            const boss = projection.bosses[activeRaid.bossId];
            const round = projection.raids[activeRaid.roundId];
            const cursor = projection.cursor;
            if (!boss || !round || !cursor) throw new Error("wilds_raid_receipt_missing");
            const encounter = round.encounter as WildsRaidEncounterState | undefined;
            const impact = encounter?.actions.at(-1)?.impact ?? 0;
            dispatch({
              type: "record-raid-event",
              event: createWildsRaidReceipt({
                actorId: civicActorId,
                bossId: boss.id,
                familyId: boss.familyId as WildsBossFamilyId,
                roundId: round.id,
                actionId: `action:${cursor.eventId}`,
                sourceEventId: cursor.eventId,
                kind: "action",
                role: activeRaidRoles.primary,
                placement: activeRaid.placement,
                contributionBand: impact >= 1_400 ? "legendary" : impact >= 900 ? "strong" : impact >= 400 ? "steady" : "light",
                result: boss.phase === "defeated" ? "victory" : "accepted",
                revision: projection.revision,
                occurredAt: cursor.pulse,
                cardProofDigest: activeAsset.proof.digest
              })
            });
            presentation.playCue(bossAudioCue(boss.phase === "defeated" ? "defeat" : boss.phase === "transforming" ? "transform" : boss.phase === "vulnerable" ? "vulnerable" : "action", boss.familyId as WildsBossFamilyId));
          }).catch((error) => { const message = friendlyWildsGameplayError(error, "The boss action could not finish. Please retry."); setRaidError(message); showWorldFeedback(message); }).finally(() => setRaidBusyIntent(null));
        }}
        onClose={() => {
          if (!activeRaid) return;
          releasePlayModalOwner("raid");
          void livingWorld.retreatRaid(activeRaid.bossId, activeRaid.roundId).catch(() => undefined);
          if (raidReturnPosition) setState((current) => ({ ...current, partyTravelRevision: nextWildsPartyTravelRevision(current.partyTravelRevision), player: raidReturnPosition }));
          setActiveRaid(null);
          setRaidError(null);
          setRaidReturnPosition(null);
        }}
        onLease={(status) => {
          if (!activeRaid) return;
          beginWorldActionFeedback();
          void livingWorld.leaseRaid(activeRaid.bossId, activeRaid.roundId, status).then(() => setActiveRaid((current) => current ? { ...current, connected: status === "connected" } : current)).catch((error) => showWorldFeedback(error instanceof Error ? error.message : "wilds_raid_lease_failed"));
        }}
        onRetreat={() => {
          if (!activeRaid) return;
          void livingWorld.retreatRaid(activeRaid.bossId, activeRaid.roundId).finally(() => {
            releasePlayModalOwner("raid");
            if (raidReturnPosition) setState((current) => ({ ...current, partyTravelRevision: nextWildsPartyTravelRevision(current.partyTravelRevision), player: raidReturnPosition }));
            setActiveRaid(null);
            setRaidReturnPosition(null);
          });
        }}
        open={exclusiveOwner === "raid" && Boolean(activeRaid && activeRaidBoss && activeRaidRound)}
        placement={activeRaid?.placement ?? "support"}
        raid={activeRaidRound}
        role={activeRaidRoles?.primary ?? "steward"}
      />
      </WildsVisitedSurface>
      {exclusiveOwner === "reward" ? <WildsCaptureReward asset={captureRewardAsset} onClose={() => {
        releasePlayModalOwner("reward");
        dispatch({ type: "dismiss-reveal" });
      }} onOpenVault={() => {
        releasePlayModalOwner("reward");
        dispatch({ type: "dismiss-reveal" });
        window.requestAnimationFrame(() => setRequestedCommand("vault"));
      }} /> : null}
      {exclusiveOwner === "ceremony" ? <>
        <WildsTransformation state={state} onInput={dispatch} />
        <WildsChildCeremony state={state} onInput={dispatch} />
      </> : null}
    </section>
  );
}
