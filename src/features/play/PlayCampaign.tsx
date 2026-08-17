"use client";

import dynamic from "next/dynamic";
import { Icons } from "@/components/icons";
import { Button, StatusPill } from "@/components/ui";
import {
  applyWildsInput,
  applyCommittedArenaSettlement,
  initialPlayState,
  selectedAsset,
  selectedCard,
  type PlayState,
  type WildsInput
} from "@/features/play/game-state";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { WildsCaptureReward } from "@/features/play/WildsCaptureReward";
import { WildsInventory } from "@/features/play/WildsInventory";
import { WildsBattle } from "@/features/play/WildsBattle";
import { WildsTransformation } from "@/features/play/WildsTransformation";
import { WildsChildCeremony } from "@/features/play/WildsChildCeremony";
import { useWildsMultiplayer } from "@/features/play/use-wilds-multiplayer";
import { useWildsWorld } from "@/features/play/use-wilds-world";
import { WildsBalancedStatusHud } from "@/features/play/WildsBalancedStatusHud";
import { useWildsPresentation } from "@/features/play/use-wilds-presentation";
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
import { WildsCommandCenter } from "@/features/play/command-center/WildsCommandCenter";
import { projectWildsCommandCenter, type WildsCommandAction } from "@/features/play/command-center/director";
import { kaiUPulseToISOString, millisecondsUntilNextKaiPulse } from "@/features/play/kai-klok-moment";
import { createWildsKaiRuntimeClock, observeWildsKaiUPulse, resolveWildsRuntimeKaiMoment } from "@/features/play/wilds-kai-runtime";
import { rootWildsInputInKai } from "@/features/play/wilds-input-temporal-root";
import { friendlyWildsGameplayError, isWildsTemporalContinuityError } from "@/features/play/wilds-temporal-errors";
import { kaiTransition, projectKaiWorldExpression, type KaiWorldExpression } from "@/features/play/kai-moment-expression";
import { WildzCommandInsight } from "@/features/play/WildzCommandInsight";
import type { WildsMovementMode } from "@/features/play/wilds-movement";
import { resolveWildsContextAction } from "@/features/play/wilds-context-action";
import { landmarkAtPosition, WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "@/features/play/wilds-landmarks";
import { evaluateLandmarkAccess, type WildsLandmarkProgress } from "@/features/play/wilds-landmark-access";
import type { RiftTravelGrant } from "@/features/play/wilds-rift-travel";
import { projectWildzHud } from "@/features/play/wildz-gameplay-hud";
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
import { WildsSagaPanel } from "@/features/play/WildsSagaPanel";
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

const WildsWorldCanvas = dynamic(
  () => import("@/features/play/WildsWorldCanvas").then((mod) => mod.WildsWorldCanvas),
  {
    ssr: false,
    loading: () => <div className="wilds-canvas-fallback" aria-label="Loading 3D world" />
  }
);
const WildsWorldMap = dynamic(() => import("@/features/play/WildsWorldMap").then((mod) => mod.WildsWorldMap), { ssr: false });
const WildsLandmarkExperience = dynamic(() => import("@/features/play/WildsLandmarkExperience").then((mod) => mod.WildsLandmarkExperience), { ssr: false });
const WildsSettlementExperience = dynamic(() => import("@/features/play/WildsSettlementExperience").then((mod) => mod.WildsSettlementExperience), { ssr: false });
const WildsEcologyExperience = dynamic(() => import("@/features/play/WildsEcologyExperience").then((mod) => mod.WildsEcologyExperience), { ssr: false });
const WildsRaidExperience = dynamic(() => import("@/features/play/WildsRaidExperience").then((mod) => mod.WildsRaidExperience), { ssr: false });
const WildsTrainerEncounter = dynamic(() => import("@/features/play/WildsTrainerEncounter").then((mod) => mod.WildsTrainerEncounter), { ssr: false });
const MortalArenaExperience = dynamic(() => import("@/features/games/mortal-arena/MortalArenaExperience").then((mod) => mod.MortalArenaExperience), { ssr: false });
export function PlayCampaign({
  campaignName = "Reward Challenge",
  enabled,
  interactionEnabled = true,
  networkEnabled,
  onComplete,
  ownerReceizId,
  character,
  playerDisplayName = "Wildz Explorer",
  onListAsset,
  shellOverlayOwner = "none",
  onOpenProfile = () => {},
  onOpenMarket = () => {},
  initialState = initialPlayState,
  initialPlayerContinuity = null,
  onPlayStateChange,
  onPrepareCard,
  onExportCard,
  onExportVault,
  vaultAdmission,
  onRestoreArtifact
}: {
  campaignName?: string;
  enabled: boolean;
  interactionEnabled?: boolean;
  networkEnabled: boolean;
  onComplete?: (beans: number) => void;
  ownerReceizId: string;
  character: WildzCharacterGenesis;
  playerDisplayName?: string;
  onListAsset?: (asset: PortableCardAsset, priceCents: number) => Promise<PortableCardAsset | null>;
  shellOverlayOwner?: "none" | "profile" | "market";
  onOpenProfile?: (restoreOrigin: HTMLElement | null) => void;
  onOpenMarket?: (restoreOrigin: HTMLElement | null) => void;
  initialState?: PlayState;
  initialPlayerContinuity?: WildzPlayerContinuity | null;
  onPlayStateChange: (state: PlayState, playerContinuity: WildzPlayerContinuity) => void;
  onPrepareCard: (asset: PortableCardAsset, player: WildsPlayerVaultPayload) => Promise<WildzPreparedIdentityOwnedCard>;
  onExportCard: (asset: PortableCardAsset, player: WildsPlayerVaultPayload, prepared?: WildzPreparedIdentityOwnedCard) => Promise<unknown>;
  onExportVault: (assets: PortableCardAsset[], player: WildsPlayerVaultPayload) => Promise<unknown>;
  vaultAdmission: WildzVaultCardAdmission | null;
  onRestoreArtifact: (
    file: File,
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState: PlayState
  ) => Promise<WildzCommittedArtifactRestore>;
}) {
  const [state, setState] = useState(() => initialState);
  const [saveRestored, setSaveRestored] = useState(false);
  const [memorialAssetId, setMemorialAssetId] = useState<string | null>(null);
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
  useEffect(() => {
    const settleLivingCreatures = () => setState((current) => {
      const at = new Date().toISOString();
      return current.inventory.reduce((next, asset) => applyWildsInput(next, {
        type: "settle-creature-continuity",
        assetId: asset.id,
        ownerReceizId,
        at
      }), current);
    });
    settleLivingCreatures();
    const timer = window.setInterval(settleLivingCreatures, 5 * 60_000);
    const settleWhenVisible = () => {
      if (document.visibilityState !== "hidden") settleLivingCreatures();
    };
    window.addEventListener("focus", settleLivingCreatures);
    document.addEventListener("visibilitychange", settleWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", settleLivingCreatures);
      document.removeEventListener("visibilitychange", settleWhenVisible);
    };
  }, [ownerReceizId]);
  const explorerStyle = character.gender;
  const { profile: qualityProfile, reportFrameSample, reducedMotion } = useWildsQualityProfile();
  const [mapOpen, setMapOpen] = useState(false);
  const [multiplayerRosterOpen, setMultiplayerRosterOpen] = useState(false);
  const cameraHeadingRef = useRef(0);
  const updateCameraHeading = useCallback((heading: number) => {
    cameraHeadingRef.current = heading;
  }, []);
  const [playerHeading, setPlayerHeading] = useState(0);
  const previousPlayerPosition = useRef(state.player);
  const [movementMode, setMovementMode] = useState<WildsMovementMode>(() => initialPlayerContinuity?.settings.movementMode ?? "walk");
  const [cardOrder, setCardOrder] = useState<WildzCardOrder>(() => initialPlayerContinuity?.settings.cardOrder ?? "rarity");
  const [visualSettings, setVisualSettings] = useState<WildsVisualSettings>(() => normalizeWildsVisualSettings(initialPlayerContinuity?.settings.visual));
  const [activeLandmarkId, setActiveLandmarkId] = useState<WildsLandmarkId | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<WildsSettlementDistrictId>("trail-gate");
  const [activeEcologySiteId, setActiveEcologySiteId] = useState<string | null>(null);
  const [activeRaid, setActiveRaid] = useState<{ bossId: string; roundId: string; placement: "fighter" | "support"; connected: boolean } | null>(null);
  const [raidReturnPosition, setRaidReturnPosition] = useState<{ x: number; z: number } | null>(null);
  const [raidBusyIntent, setRaidBusyIntent] = useState<WildsRaidIntent["type"] | null>(null);
  const [riftError, setRiftError] = useState("");
  const [requestedCommand, setRequestedCommand] = useState<WildsCommandKey | null>(null);
  const [commandDismissSignal, setCommandDismissSignal] = useState(0);
  const [activeTrainer, setActiveTrainer] = useState<WildsTrainerProjection | null>(null);
  const [trainerEncounter, setTrainerEncounter] = useState<TrainerEncounterState | null>(null);
  const [kaiUPulse, setKaiUPulse] = useState(0);
  const kaiRuntimeClockRef = useRef<ReturnType<typeof createWildsKaiRuntimeClock> | null>(null);
  const worldProgression = projectWorldProgression(state.worldMastery);
  const activeCard = selectedCard(state);
  const activeAsset = selectedAsset(state);
  const neuralPrewarmAsset = useRef<PortableCardAsset | null>(null);
  neuralPrewarmAsset.current = activeAsset ?? null;
  useEffect(() => {
    if (!enabled || !neuralPrewarmAsset.current) return;
    let cancelled = false;
    let started = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const prime = () => {
      if (cancelled || started) return;
      const asset = neuralPrewarmAsset.current;
      if (!asset) return;
      started = true;
      void import("./creature-neural-voice").then(({ warmCreatureNeuralVoice }) => {
        if (!cancelled) void warmCreatureNeuralVoice(asset);
      });
    };
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
      scheduler?: { postTask?: (callback: () => void, options: { priority: "background"; delay: number }) => Promise<void> };
    };
    const idleHandle = idleWindow.requestIdleCallback?.(prime);
    if (idleWindow.scheduler?.postTask) {
      void idleWindow.scheduler.postTask(prime, { priority: "background", delay: 4_000 });
    } else {
      // Safari can starve idle callbacks during a continuous WebGL loop. Wait
      // beyond first paint, then yield through a frame as a quiet backstop.
      fallbackTimer = setTimeout(() => requestAnimationFrame(() => setTimeout(prime, 0)), 8_000);
    }
    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [activeAsset?.id, enabled]);
  const deckCards = state.inventory;
  const priorVaultIdsRef = useRef(new Set(state.inventory.map((asset) => asset.id)));
  const [newRosterAssetId, setNewRosterAssetId] = useState<string | null>(null);
  const [initialVaultAdmission] = useState<WildzVaultCardAdmission>(() => deriveWildzVaultCardAdmission({
    cards: initialState.inventory,
    playerHandle: ownerReceizId
  }));
  const currentVaultAdmission = vaultAdmission ?? initialVaultAdmission;
  useEffect(() => {
    const prior = priorVaultIdsRef.current;
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
  const activeProgress = state.companionProgress[activeCard.id] ?? { level: 1, xp: 0, bond: 0 };
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
  const hudModel = projectWildzHud(state, { username: ownerReceizId, displayName: playerDisplayName });
  const cardAdmission = useMemo<WildzVaultCardMembershipProof | null>(() => {
    if (!activeAsset) return null;
    try {
      return createWildzVaultCardMembershipProof(currentVaultAdmission, activeAsset);
    } catch {
      return null;
    }
  }, [activeAsset, currentVaultAdmission]);
  const multiplayer = useWildsMultiplayer({
    // Global presence is available to every internet-connected explorer.
    // networkEnabled still protects canonical world writes, but must not turn
    // unauthenticated live players into an isolated local session.
    enabled: enabled && Boolean(activeAsset),
    style: explorerStyle,
    position: state.player,
    activeCard: activeAsset,
    cardAdmission
  });
  const captureRewardAssetId = state.encounter.phase === "revealed" ? state.encounter.assetId : null;
  const captureRewardAsset = captureRewardAssetId
    ? state.inventory.find((candidate) => candidate.id === captureRewardAssetId) ?? null
    : null;
  const combatSurface = projectPlayCombatSurface({
    trainer: Boolean(activeTrainer && activeAsset && trainerEncounter?.phase === "combat"),
    wild: isWildBattleModalOwner(state.encounter.phase, Boolean(state.battle)),
    pvp: Boolean(multiplayer.activeBattle)
  });
  const modalOwner = projectPlayShellOwner({
    combat: combatSurface !== null,
    trainer: Boolean(activeTrainer && activeAsset && trainerEncounter && ["challenge", "transition", "result"].includes(trainerEncounter.phase)),
    memorial: memorialAssetId !== null,
    reward: isCaptureRewardModalOwner(state.encounter.phase, Boolean(captureRewardAsset)),
    ceremony: Boolean(state.transformation || state.lineageReveal),
    raid: Boolean(activeRaid),
    ecology: Boolean(activeEcologySiteId),
    settlement: activeLandmarkId === "wayfinder-hollow",
    landmark: activeLandmarkId !== null && activeLandmarkId !== "wayfinder-hollow",
    map: mapOpen,
    profile: shellOverlayOwner === "profile",
    market: shellOverlayOwner === "market",
    multiplayer: Boolean(multiplayer.incomingChallenge),
    command: false
  });
  const {
    state: worldOverlayState,
    dispatch: dispatchWorldOverlay,
    gestureCancelSignal,
    panelOwnershipRef,
    exclusiveOriginRef,
    claimExclusiveOwner
  } = useWorldOverlayDirector({ dismissSignal: commandDismissSignal, exclusiveOwner: modalOwner });
  const commandPanelOpen = modalOwner === "none" && worldOverlayState.panelKey !== null;
  const exclusiveOwner = commandPanelOpen ? "command" : modalOwner;
  const modalAdmissionRef = useRef(createModalAdmissionState(exclusiveOwner));
  if (modalAdmissionRef.current.owner !== exclusiveOwner) {
    modalAdmissionRef.current = claimModalAdmissionOwner(modalAdmissionRef.current, exclusiveOwner);
  }
  const clearIncompatibleModalState = useCallback((owner: typeof exclusiveOwner) => {
    if (owner !== "map") setMapOpen(false);
    if (owner !== "landmark" && owner !== "settlement") setActiveLandmarkId(null);
    if (owner !== "ecology") setActiveEcologySiteId(null);
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
    } else if (owner === "multiplayer" && incomingChallengeId) {
      void answerMultiplayerChallenge(incomingChallengeId, "decline");
    }
  }, [answerMultiplayerChallenge, incomingChallengeId, releasePlayModalOwner]);
  usePlayModalLifecycle({ onEscape: closeOwnedModal, originRef: exclusiveOriginRef, owner: modalOwner });
  useEffect(() => {
    if (!shouldDismissTrainerEncounterForExternalCombat(trainerEncounter?.phase ?? null, {
      wildBattleActive: Boolean(state.battle),
      pvpBattleActive: Boolean(multiplayer.activeBattle)
    })) return;
    setActiveTrainer(null);
    setTrainerEncounter(null);
  }, [multiplayer.activeBattle, state.battle, trainerEncounter?.phase]);
  const livingWorld = useWildsWorld({
    enabled: enabled && networkEnabled,
    actorId: ownerReceizId,
    guestId: multiplayer.guestId,
    kaiUPulse,
    activeCard: activeAsset ?? null,
    cardAdmission
  });
  const refreshLivingWorld = livingWorld.refresh;
  const handleStoryCommandError = useCallback((error: unknown, fallback: string) => {
    if (isWildsTemporalContinuityError(error)) void refreshLivingWorld();
    setRiftError(friendlyWildsGameplayError(error, fallback));
  }, [refreshLivingWorld]);
  const kaiMoment = resolveWildsRuntimeKaiMoment({
    uPulse: kaiUPulse,
    mode: livingWorld.mode,
    cursor: livingWorld.snapshot?.cursor ?? null
  });
  const saga = projectWildsSaga({
    moment: kaiMoment,
    framework: wildsSagaFramework(),
    memories: livingWorld.snapshot?.story.memories ?? []
  });
  const sagaPlayer = livingWorld.snapshot?.players[ownerReceizId] ?? null;
  const wildBattleActive = isWildBattleModalOwner(state.encounter.phase, Boolean(state.battle));
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
  const sagaProgressPercent = sagaPrimaryTarget ? Math.round(sagaPrimaryProgress / sagaPrimaryTarget * 100) : 0;
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
  const sagaTrainers = projectedTrainers.map((projected) => {
    const live = liveSagaTrainerById.get(projected.id);
    return live ? { ...live, position: projected.position } : projected;
  });
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
  const sagaTournament = (Object.values(livingWorld.snapshot?.tournaments ?? {}).find((tournament) => tournament.dayId === saga.dayId) ?? null) as WildsTournamentProjection | null;
  const kaiExpression = projectKaiWorldExpression(kaiMoment);
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
  const presentation = useWildsPresentation({
    audioScene,
    encounter: {
      phase: state.encounter.phase,
      proximity: state.encounter.phase === "idle" ? "cold" : state.encounter.proximity
    },
    enabled,
    initialAudioSettings: initialPlayerContinuity?.settings.audio
  });
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
    let timer = 0;
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
    const scheduleNextKaiMoment = () => {
      updateKaiMoment();
      timer = window.setTimeout(scheduleNextKaiMoment, millisecondsUntilNextKaiPulse());
    };
    updateKaiMoment();
    timer = window.setTimeout(scheduleNextKaiMoment, millisecondsUntilNextKaiPulse());
    document.addEventListener("visibilitychange", updateKaiMoment);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", updateKaiMoment);
    };
  }, []);

  useEffect(() => {
    const previous = previousPlayerPosition.current;
    const deltaX = state.player.x - previous.x;
    const deltaZ = state.player.z - previous.z;
    previousPlayerPosition.current = state.player;
    if (Math.hypot(deltaX, deltaZ) > 0.0001) setPlayerHeading(Math.atan2(deltaX, -deltaZ));
  }, [state.player]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinRoom = params.get("wildsJoin");
    const joinX = Number(params.get("wildsX"));
    const joinZ = Number(params.get("wildsZ"));
    if (/^invite:[a-f0-9]{16}$/.test(joinRoom ?? "") && Number.isFinite(joinX) && Number.isFinite(joinZ)) {
      setState((current) => ({
        ...current,
        player: { x: joinX + 1.4, z: joinZ + 1.4 },
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
    onPlayStateChange(state, {
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
    });
  }, [
    cardOrder,
    explorerStyle,
    initialPlayerContinuity,
    livingWorld.snapshot,
    movementMode,
    onPlayStateChange,
    presentation.audioSettings,
    saveRestored,
    state,
    visualSettings
  ]);

  useEffect(() => {
    if (state.encounter.phase === "battle_intro") {
      const timer = window.setTimeout(() => {
        const uPulse = kaiRuntimeClockRef.current?.read(performance.now(), observeWildsKaiUPulse()) ?? observeWildsKaiUPulse();
        setState((current) => applyWildsInput(current, rootWildsInputInKai({ type: "start-battle", at: kaiUPulseToISOString(uPulse) }, uPulse)));
      }, 650);
      return () => window.clearTimeout(timer);
    }
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
      const uPulse = kaiRuntimeClockRef.current?.read(performance.now(), observeWildsKaiUPulse()) ?? observeWildsKaiUPulse();
      const rootedInput = rootWildsInputInKai(input, uPulse);
      setState((current) => {
        const next = applyWildsInput(current, rootedInput);
        if (!current.completed && next.completed) onComplete?.(next.beans);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onComplete, worldInteractionEnabled]);

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

  const dispatch = (input: WildsInput) => {
    if (!interactionEnabled) return;
    if (input.type === "select-asset") setNewRosterAssetId(null);
    const rootedInput = rootWildsInputInKai(input, kaiUPulse);
    setState((current) => {
      const next = applyWildsInput(current, rootedInput);
      if (!current.completed && next.completed) {
        onComplete?.(next.beans);
      }
      return next;
    });
  };
  const dispatchWorldInput = (input: WildsInput) => {
    if (!canUseWorldStage()) return;
    dispatch(input);
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
    setMapOpen(true);
  };
  const openWorldMapFromCommandPanel = () => {
    if (modalOwner !== "none" || worldOverlayState.panelKey !== "commandCenter") return;
    dispatchStageOverlay({ type: "panel", key: null });
    claimPlayModalOwner("map");
    setCommandDismissSignal((signal) => signal + 1);
    setMapOpen(true);
  };
  const discoveryActive = state.encounter.phase === "idle" || state.encounter.phase === "searching" || state.encounter.phase === "hint";
  const activeProximity = state.encounter.phase === "idle" ? "cold" : state.encounter.proximity ?? "cold";
  const proximityLabel = state.encounter.phase === "idle"
    ? "Tap terrain to scan"
    : `${activeProximity}${state.encounter.trend ? ` · ${state.encounter.trend}` : ""}`;
  const captureToastActive = ["emerging", "capsule", "sealed", "revealed"].includes(state.encounter.phase);
  const currentLandmark = landmarkAtPosition(state.player);
  const civic = projectWildsCivicHistory(state.civicEvents);
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
  const nearbyLivingSite = Object.values(livingWorld.snapshot?.sites ?? {})
    .map((site) => ({ site, distance: Math.hypot(site.position.x - state.player.x, site.position.z - state.player.z) }))
    .filter(({ site, distance }) => Boolean(site.bossId) && site.phase !== "memorialized" && site.phase !== "expired" && distance <= site.radius + 8)
    .sort((left, right) => left.distance - right.distance)[0] ?? null;
  const nearbyLivingBoss = nearbyLivingSite?.site.bossId ? livingWorld.snapshot?.bosses[nearbyLivingSite.site.bossId] : null;
  const nearbyEcology = Object.values(livingWorld.snapshot?.ecologySites ?? {})
    .map((site) => ({ site, distance: Math.hypot(site.position.x - state.player.x, site.position.z - state.player.z) }))
    .filter(({ site, distance }) => (site.phase === "foreshadowed" || site.phase === "discovered" || site.phase === "active") && distance <= site.radius)
    .sort((left, right) => left.distance - right.distance)[0] ?? null;
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
    joinableActivity: nearbyLivingBoss && nearbyLivingBoss.phase !== "defeated" ? { id: nearbyLivingBoss.id, name: "shared boss raid" } : null
  });
  const pulse = nearbyEcology && (basePulse.kind === "scan" || basePulse.kind === "greet")
    ? { kind: "join" as const, label: `${nearbyEcology.site.phase === "foreshadowed" ? "Discover" : "Enter"} ${nearbyEcology.site.name}`, activityId: nearbyEcology.site.id }
    : basePulse;
  const heartbeatMood = state.energy < 30 ? "Protective" : state.encounter.phase === "idle" ? "Curious" : "Alert";
  const heartbeatMemory = state.lastEvent || "Your pack remembers the first trail into the Wilds.";
  const heartbeatWhispers = [
    nearbyLivingBoss ? `${nearbyLivingBoss.name} is stirring nearby.` : null,
    nearbyEcology ? `${nearbyEcology.site.name} is changing this region.` : null,
    livingWorld.snapshot?.defeatedBossIds.length ? `${livingWorld.snapshot.defeatedBossIds.length} shared victory ${livingWorld.snapshot.defeatedBossIds.length === 1 ? "monument stands" : "monuments stand"} in the world.` : null
  ].filter((message): message is string => Boolean(message));
  const activeCondition = activeAsset ? state.adventureConditions[activeAsset.id] : null;
  const commandModel = projectWildsCommandCenter({
    moment: kaiMoment,
    connected: livingWorld.mode === "receiz_live",
    worldRevision: livingWorld.snapshot?.revision ?? 0,
    energy: state.energy,
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
    const admission = beginPlayModalAdmission();
    if (!admission) return;
    const round = Object.values(livingWorld.snapshot?.raids ?? {}).find((candidate) => candidate.bossId === bossId && candidate.phase !== "settled" && candidate.phase !== "expired");
    const boss = livingWorld.snapshot?.bosses[bossId];
    if (!round) { setRiftError("wilds_world_raid_missing"); return; }
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
        setRiftError(error instanceof Error ? error.message : "wilds_raid_join_failed");
      }
    });
  };
  const activatePulse = () => {
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
            setRiftError(error instanceof Error ? error.message : "wilds_ecology_discovery_failed");
          }
        });
        return;
      }
      enterLivingRaid(pulse.activityId);
      return;
    }
    if (pulse.kind === "collect" || pulse.kind === "greet") return;
    dispatch({
      type: "search-point",
      x: state.player.x,
      z: state.player.z,
      searchedAt: new Date().toISOString(),
      ownerReceizId
    });
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
    else if (action.type === "open-trail-pack") setRequestedCommand("deck");
    else if (action.type === "open-vault") setRequestedCommand("vault");
    else if (action.type === "open-map") openWorldMapFromCommandPanel();
    else activatePulseFromCommandPanel();
  };
  const riftTo = async (destination: { x: number; z: number }) => {
    setRiftError("");
    if (!networkEnabled) {
      setRiftError("Wildz is connecting your verified Receiz session.");
      return;
    }
    try {
      const response = await fetch("/api/wilds/rift", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomKey: multiplayer.roomKey,
          guestId: multiplayer.guestId,
          source: state.player,
          destination,
          idempotencyKey: `rift:${crypto.randomUUID()}`
        })
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; grant?: RiftTravelGrant; error?: string } | null;
      if (!response.ok || !result?.ok || !result.grant) throw new Error(result?.error ?? "wilds_rift_failed");
      dispatch({
        type: "apply-rift-grant",
        grant: result.grant,
        playerId: result.grant.playerId
      });
      multiplayer.selectPlayer(null);
      setActiveLandmarkId(null);
      releasePlayModalOwner("map");
      setMapOpen(false);
    } catch (error) {
      setRiftError(error instanceof Error ? error.message : "wilds_rift_failed");
    }
  };
  const commandItems: readonly WildsCommandItem[] = [
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
          <p className="wilds-saga-deck-count"><strong>{deckCards.length}/∞</strong> living cards in your deck</p>
          <WildsSagaPanel
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
            <button onClick={() => dispatch({ type: "search-point", x: state.player.x, z: state.player.z, searchedAt: new Date().toISOString(), ownerReceizId })} type="button">Pulse this trail</button>
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
          <WildzCommandInsight label="Trail preparation" value={`${state.energy} energy`} detail="Use what you gathered now; every action updates the same live explorer state used in the world.">
            <button onClick={() => dispatch({ type: "rest", at: new Date().toISOString() })} type="button">Make camp</button>
            <button onClick={() => dispatch({ type: "train", at: new Date().toISOString() })} type="button">Train leader</button>
            <button onClick={() => dispatch({ type: "mission" })} type="button">Advance mission</button>
          </WildzCommandInsight>
          <div className="wilds-command-content-lead">
            <span><small>Trail stores</small><strong>Gathered across the living Wilds</strong></span>
            <b>{state.worldRank}</b>
          </div>
          <div className="wilds-satchel-grid" aria-label="Foraged resources and progression">
            <article><Icons.sparkle aria-hidden="true" size={18} /><span><small>Grove beans</small><strong>{state.beans}</strong></span><em>Foraged</em></article>
            <article><Icons.pulse aria-hidden="true" size={18} /><span><small>Fusion sparks</small><strong>{state.fusionSparks}</strong></span><em>Charged</em></article>
            <article><Icons.receiz aria-hidden="true" size={18} /><span><small>Bond traces</small><strong>{activeProgress.bond}</strong></span><em>{activeAsset?.manifest.name ?? activeCard.name}</em></article>
            <article><Icons.star aria-hidden="true" size={18} /><span><small>World mastery</small><strong>{state.worldMastery}</strong></span><em>Permanent</em></article>
            <article><Icons.trophy aria-hidden="true" size={18} /><span><small>Trail streak</small><strong>{state.streak}×</strong></span><em>Active</em></article>
            <article><Icons.package aria-hidden="true" size={18} /><span><small>Ascension catalysts</small><strong>{state.ascensionCatalysts.length}</strong></span><em>Vaulted</em></article>
          </div>
          <p className="wilds-satchel-note">Explore, scan, battle, and bond to fill the satchel. Every resource is earned inside the game.</p>
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
              const progress = state.companionProgress[card.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
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
            state={state}
            kaiMoment={kaiMoment}
            focusedAssetId={state.selectedAssetId}
            cardOrder={cardOrder}
            onCardOrderChange={setCardOrder}
            playerVault={() => createWildsPlayerVault({
              playerId: ownerReceizId,
              exportedAt: new Date().toISOString(),
              playState: state,
              character,
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
            })}
            vaultAdmission={currentVaultAdmission}
            onPrepareCard={onPrepareCard}
            onExportCard={onExportCard}
            onExportVault={onExportVault}
            onInput={dispatch}
            onListAsset={onListAsset}
            onRestoreArtifact={async (file, confirmCardOnly, currentPlayState) => {
              const outcome = await onRestoreArtifact(file, confirmCardOnly, currentPlayState);
              const verifiedAssetIds = new Set(outcome.verifiedAssetIds);
              const restoredPlayState = {
                ...outcome.playState,
                pendingSyncAssetIds: outcome.playState.pendingSyncAssetIds.filter((assetId) => !verifiedAssetIds.has(assetId))
              };
              setState(restoredPlayState);
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
    <section className="panel play-panel wilds-play-panel" id="play">
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
        <div className="wilds-world">
          <div
            className={`wilds-stage${state.encounter.phase === "hint" ? ` signal-${state.encounter.proximity}` : ""}${combatSurface === "pvp" ? " pvp-active" : ""}${multiplayerRosterOpen ? " multiplayer-roster-open" : ""}${combatSurface === "wild" ? " wild-battle-active" : ""}${commandPanelOpen ? " is-command-panel-open" : ""}${worldOverlayState.toolsOpen ? " is-world-tools-open" : ""}`}
            aria-label="Receiz Wilds playable 3D world"
          >
            <WildsWorldCanvas
              state={state}
              character={character}
              remotePlayers={multiplayer.remotePlayers}
              qualityProfile={qualityProfile}
              onFrameSample={reportFrameSample}
              onCameraHeadingChange={updateCameraHeading}
              searchEnabled={worldInteractionEnabled && discoveryActive}
              livingWorld={livingWorld.snapshot}
              worldMode={settlementWorldMode}
              kaiMoment={kaiMoment}
              visualSettings={visualSettings}
              supportCards={trailSupportCards}
              onSelectPlayer={(player) => {
                if (canUseWorldStage()) multiplayer.selectPlayer(player);
              }}
              trainers={sagaTrainers}
              onSelectTrainer={(trainer) => openTrainerEncounter(trainer, "world")}
              onSearchPoint={(point) => {
                if (canUseWorldStage()) {
                  dispatch({ type: "search-point", ...point, searchedAt: new Date().toISOString(), ownerReceizId });
                }
              }}
            />

            <div aria-hidden={referenceHomeBlocked} className="wildz-reference-home" inert={referenceHomeBlocked ? true : undefined}>
              <WildzReferenceHud
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

            <WildsBalancedStatusHud
              audio={{
                onChange: (settings) => { if (canUseWorldStage()) presentation.setAudioSettings(settings); },
                onUnlock: () => { if (canUseWorldStage()) void presentation.unlockAudio(); },
                ready: presentation.audioReady,
                settings: presentation.audioSettings
              }}
              battleModalOwned={exclusiveOwner === "combat" && combatSurface === "pvp"}
              blocked={backgroundHomesBlocked}
              connected={networkEnabled}
              dismissSignal={commandDismissSignal}
              interactionEnabled={worldInteractionEnabled}
              kaiMoment={kaiMoment}
              modalOwned={exclusiveOwner === "multiplayer"}
              multiplayer={multiplayer}
              onEnterRaid={enterLivingRaid}
              onOpenCommandCenter={() => {
                if (!canUseWorldStage()) return;
                setRequestedCommand("commandCenter");
              }}
              onRosterOpenChange={handleMultiplayerRosterOpenChange}
              player={state.player}
              world={livingWorld}
            />

            <WildzWorldControls
              activeCard={activeAsset}
              cameraHeadingRef={cameraHeadingRef}
              cardConditions={state.adventureConditions}
              cardOrder={cardOrder}
              commandItems={commandItems}
              companionProgress={state.companionProgress}
              dismissSignal={commandDismissSignal}
              exclusiveOwner={exclusiveOwner}
              gestureCancelSignal={gestureCancelSignal}
              newRosterAssetId={newRosterAssetId}
              movementMode={movementMode}
              nearbyCards={state.inventory}
              overlayDispatch={dispatchStageOverlay}
              overlayState={worldOverlayState}
              onAudioCue={presentation.playCue}
              onCardOrderChange={setCardOrder}
              onInput={dispatchWorldInput}
              onMovementModeChange={setMovementMode}
              onRequestedCommandHandled={() => setRequestedCommand(null)}
              onRest={() => dispatchWorldInput({ type: "rest", at: new Date().toISOString() })}
              onSelectCard={(assetId) => dispatchWorldInput({ type: "select-asset", assetId })}
              requestedCommand={requestedCommand}
            />

            {exclusiveOwner === "combat" && combatSurface === "wild" && wildBattleActive && state.battle ? (
              <WildsBattle
                battle={state.battle}
                encounterPhase={state.encounter.phase}
                inventory={state.inventory}
                onAction={(action) => dispatch({ type: "battle-action", action, at: new Date().toISOString() })}
                onDismiss={() => {
                  releasePlayModalOwner("combat");
                  dispatch({ type: "dismiss-reveal" });
                }}
              />
            ) : null}

            {discoveryActive ? <div className={`wilds-search-reticle ${state.encounter.phase === "idle" ? "" : activeProximity}`} aria-live="polite">{proximityLabel}</div> : null}

            <div className={`wilds-event-toast${captureToastActive ? " is-capture" : ""}`} aria-live="polite">
              {captureToastActive ? <Icons.seal aria-hidden="true" size={19} /> : null}
              <span>{riftError || (activeLandmarkId ? `${currentLandmark?.name ?? "Landmark"} entrance awakened.` : state.lastEvent)}</span>
              {captureToastActive ? <small>Portable proof sequence</small> : null}
            </div>
          </div>

        </div>
      </div>
      <WildsWorldMap
        currentPosition={state.player}
        discoveredLandmarkIds={discoveredLandmarkIds}
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
      />
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
          if (livingWorld.mode === "receiz_live") {
            void livingWorld.settleTrainerBattle(saga.dayId, activeTrainer.id, outcome)
              .catch((error) => handleStoryCommandError(error, "Trainer battle progress could not save. Try again."));
          }
        }}
        onExit={() => {
          releasePlayModalOwner("combat");
          setActiveTrainer(null);
          setTrainerEncounter(null);
        }}
        onUnlock={(unlockId) => setState((current) => ({ ...current, achievements: Array.from(new Set([...current.achievements, unlockId])).slice(0, 64) }))}
      /> : null}
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
      <WildsRaidExperience
        boss={activeRaidBoss}
        busyIntent={raidBusyIntent}
        canonical={livingWorld.mode === "receiz_live"}
        cardName={activeAsset?.manifest.name ?? activeCard.name}
        connected={activeRaid?.connected ?? false}
        encounter={activeRaidEncounter}
        error={livingWorld.error || riftError || null}
        onAction={(intent) => {
          if (!activeRaid || !activeAsset || !activeRaidBoss || !activeRaidRoles) return;
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
          }).catch((error) => setRiftError(error instanceof Error ? error.message : "wilds_raid_action_failed")).finally(() => setRaidBusyIntent(null));
        }}
        onClose={() => {
          if (!activeRaid) return;
          releasePlayModalOwner("raid");
          void livingWorld.retreatRaid(activeRaid.bossId, activeRaid.roundId).catch(() => undefined);
          if (raidReturnPosition) setState((current) => ({ ...current, player: raidReturnPosition }));
          setActiveRaid(null);
          setRaidReturnPosition(null);
        }}
        onLease={(status) => {
          if (!activeRaid) return;
          void livingWorld.leaseRaid(activeRaid.bossId, activeRaid.roundId, status).then(() => setActiveRaid((current) => current ? { ...current, connected: status === "connected" } : current)).catch((error) => setRiftError(error instanceof Error ? error.message : "wilds_raid_lease_failed"));
        }}
        onRetreat={() => {
          if (!activeRaid) return;
          void livingWorld.retreatRaid(activeRaid.bossId, activeRaid.roundId).finally(() => {
            releasePlayModalOwner("raid");
            if (raidReturnPosition) setState((current) => ({ ...current, player: raidReturnPosition }));
            setActiveRaid(null);
            setRaidReturnPosition(null);
          });
        }}
        open={exclusiveOwner === "raid" && Boolean(activeRaid && activeRaidBoss && activeRaidRound)}
        placement={activeRaid?.placement ?? "support"}
        raid={activeRaidRound}
        role={activeRaidRoles?.primary ?? "steward"}
      />
      {exclusiveOwner === "reward" ? <WildsCaptureReward asset={captureRewardAsset} onClose={() => {
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
