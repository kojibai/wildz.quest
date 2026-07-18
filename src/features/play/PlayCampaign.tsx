"use client";

import dynamic from "next/dynamic";
import { Icons } from "@/components/icons";
import { Button, StatusPill } from "@/components/ui";
import {
  applyWildsInput,
  initialPlayState,
  selectedAsset,
  selectedCard,
  type PlayState,
  type WildsInput
} from "@/features/play/game-state";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { WildsCaptureReward } from "@/features/play/WildsCaptureReward";
import { WildsInventory } from "@/features/play/WildsInventory";
import { WildsBattle } from "@/features/play/WildsBattle";
import { WildsTransformation } from "@/features/play/WildsTransformation";
import { WildsChildCeremony } from "@/features/play/WildsChildCeremony";
import { WildsMultiplayer } from "@/features/play/WildsMultiplayer";
import { useWildsMultiplayer } from "@/features/play/use-wilds-multiplayer";
import { useWildsWorld } from "@/features/play/use-wilds-world";
import { WildsAudioSettings } from "@/features/play/WildsAudioSettings";
import { useWildsPresentation } from "@/features/play/use-wilds-presentation";
import { selectWildsQualityProfile } from "@/features/play/wilds-quality-profile";
import { projectWildsAudioScene } from "@/features/play/wilds-audio-scene";
import { projectWildsBiome } from "@/features/play/wilds-biome";
import type { WildsSettlementDistrictId } from "@/features/play/wilds-settlements";
import { projectWorldProgression } from "@/features/play/world-progression";
import { WildsCommandDock, type WildsCommandItem, type WildsCommandKey } from "@/features/play/WildsCommandDock";
import { WildsCommandCenter } from "@/features/play/command-center/WildsCommandCenter";
import { projectWildsCommandCenter, type WildsCommandAction } from "@/features/play/command-center/director";
import { deriveKaiKlokMoment, KAI_GENESIS_TS, millisecondsUntilNextKaiPulse } from "@/features/play/kai-klok-moment";
import { kaiTransition, projectKaiWorldExpression, type KaiWorldExpression } from "@/features/play/kai-moment-expression";
import { WildzCommandInsight } from "@/features/play/WildzCommandInsight";
import { WildsWorldMap } from "@/features/play/WildsWorldMap";
import { WildsLandmarkExperience } from "@/features/play/WildsLandmarkExperience";
import type { WildsMovementMode } from "@/features/play/wilds-movement";
import { resolveWildsContextAction } from "@/features/play/wilds-context-action";
import { landmarkAtPosition, WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "@/features/play/wilds-landmarks";
import { evaluateLandmarkAccess, type WildsLandmarkProgress } from "@/features/play/wilds-landmark-access";
import type { RiftTravelGrant } from "@/features/play/wilds-rift-travel";
import { projectWildzHud } from "@/features/play/wildz-gameplay-hud";
import { WildzReferenceHud } from "@/features/play/WildzReferenceHud";
import { WildzSocialDeck } from "@/features/play/WildzSocialDeck";
import { WildsCreatureThumbnail } from "@/features/play/WildsCreatureThumbnail";
import { creatureFamilies, creatureForm } from "@/features/play/creature-catalog";
import { createWildsPlayerVault, type WildsPlayerVaultPayload, type WildzCardOrder } from "@/features/play/wilds-player-vault";
import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import type {
  WildzCardOnlyConfirmation,
  WildzCommittedArtifactRestore,
  WildzPlayerContinuity
} from "@/features/identity/wildz-restore";
import { bossAudioCue, ecologyAudioCue, normalizeWildsAudioSettings, settlementAudioCue } from "@/features/play/wilds-audio";
import { WildsLivingWorldHud } from "@/features/play/WildsLivingWorldHud";
import { WildsSagaPanel } from "@/features/play/WildsSagaPanel";
import { wildsSagaFramework } from "@/features/play/wilds-saga-content";
import { projectWildsSaga } from "@/features/play/wilds-saga-director";
import { projectMissionGraph, type WildsMissionContribution } from "@/features/play/wilds-saga-missions";
import type { WildsTrainerProjection } from "@/features/play/wilds-saga-trainers";
import type { WildsTournamentProjection } from "@/features/play/wilds-saga-tournament";
import { WildsSettlementExperience } from "@/features/play/WildsSettlementExperience";
import { createWildsCivicEvent, normalizeWildsCivicActorId, projectWildsCivicHistory } from "@/features/play/wilds-civic-history";
import { WildsEcologyExperience } from "@/features/play/WildsEcologyExperience";
import { createWildsEcologyReceipt } from "@/features/play/wilds-ecology-history";
import { WildsRaidExperience } from "@/features/play/WildsRaidExperience";
import { projectWildsRaidRoles } from "@/features/play/wilds-raid-roles";
import { createWildsRaidReceipt } from "@/features/play/wilds-raid-history";
import type { WildsRaidEncounterState, WildsRaidIntent } from "@/features/play/wilds-raid-encounter";
import type { WildsBossFamilyId } from "@/features/play/wilds-boss-ecology";
import { deriveLoadoutSynergy, projectWildsCardMastery } from "@/features/play/wilds-card-mastery";
import {
  createWildzVaultCardMembershipProof,
  deriveWildzVaultCardAdmission,
  type WildzVaultCardMembershipProof
} from "@/lib/receiz/wildz-vault-card-admission";
import { usePublicCardPublisher } from "@/features/play/use-public-card-publisher";

function currentWildsQualityProfile() {
  if (typeof window === "undefined") {
    return selectWildsQualityProfile({ width: 390, reducedMotion: false });
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return selectWildsQualityProfile({
    width: window.innerWidth,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory,
    reducedMotion
  });
}

const WildsWorldCanvas = dynamic(
  () => import("@/features/play/WildsWorldCanvas").then((mod) => mod.WildsWorldCanvas),
  {
    ssr: false,
    loading: () => <div className="wilds-canvas-fallback" aria-label="Loading 3D world" />
  }
);

export function PlayCampaign({
  campaignName = "Reward Challenge",
  enabled,
  networkEnabled,
  onComplete,
  ownerReceizId = "wilds.player.receiz.id",
  character,
  playerDisplayName = "Wildz Explorer",
  onListAsset,
  onOpenProfile = () => {},
  onOpenMarket = () => {},
  initialState = initialPlayState,
  initialPlayerContinuity = null,
  onPlayStateChange,
  onExportVault,
  onRestoreArtifact
}: {
  campaignName?: string;
  enabled: boolean;
  networkEnabled: boolean;
  onComplete?: (beans: number) => void;
  ownerReceizId?: string;
  character: WildzCharacterGenesis;
  playerDisplayName?: string;
  onListAsset?: (asset: PortableCardAsset, priceCents: number) => Promise<PortableCardAsset | null>;
  onOpenProfile?: () => void;
  onOpenMarket?: () => void;
  initialState?: PlayState;
  initialPlayerContinuity?: WildzPlayerContinuity | null;
  onPlayStateChange: (state: PlayState, playerContinuity: WildzPlayerContinuity) => void;
  onExportVault: (assets: PortableCardAsset[], player: WildsPlayerVaultPayload) => Promise<unknown>;
  onRestoreArtifact: (
    file: File,
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState: PlayState
  ) => Promise<WildzCommittedArtifactRestore>;
}) {
  const [state, setState] = useState(() => initialState);
  const [saveRestored, setSaveRestored] = useState(false);
  const [rewardAsset, setRewardAsset] = useState<PortableCardAsset | null>(null);
  const [avatarStyle, setAvatarStyle] = useState<"female" | "male" | null>(() => initialPlayerContinuity?.settings.avatarStyle ?? character.gender);
  const [qualityProfile, setQualityProfile] = useState(currentWildsQualityProfile);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const cameraHeadingRef = useRef(0);
  const updateCameraHeading = useCallback((heading: number) => {
    cameraHeadingRef.current = heading;
  }, []);
  const [playerHeading, setPlayerHeading] = useState(0);
  const previousPlayerPosition = useRef(state.player);
  const [movementMode, setMovementMode] = useState<WildsMovementMode>(() => initialPlayerContinuity?.settings.movementMode ?? "walk");
  const [cardOrder, setCardOrder] = useState<WildzCardOrder>(() => initialPlayerContinuity?.settings.cardOrder ?? "rarity");
  const [activeLandmarkId, setActiveLandmarkId] = useState<WildsLandmarkId | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<WildsSettlementDistrictId>("trail-gate");
  const [activeEcologySiteId, setActiveEcologySiteId] = useState<string | null>(null);
  const [activeRaid, setActiveRaid] = useState<{ bossId: string; roundId: string; placement: "fighter" | "support"; connected: boolean } | null>(null);
  const [raidReturnPosition, setRaidReturnPosition] = useState<{ x: number; z: number } | null>(null);
  const [raidBusyIntent, setRaidBusyIntent] = useState<WildsRaidIntent["type"] | null>(null);
  const [riftError, setRiftError] = useState("");
  const [requestedCommand, setRequestedCommand] = useState<WildsCommandKey | null>(null);
  const [kaiOccurredAt, setKaiOccurredAt] = useState(() => new Date(KAI_GENESIS_TS).toISOString());
  const worldProgression = projectWorldProgression(state.worldMastery);
  const activeCard = selectedCard(state);
  const activeAsset = selectedAsset(state);
  const deckCards = state.inventory;
  usePublicCardPublisher(deckCards, enabled && networkEnabled);
  const landmarkUnlocks = state.achievements;
  const activeProgress = state.companionProgress[activeCard.id] ?? { level: 1, xp: 0, bond: 0 };
  const discoveredByFamily = new Map(deckCards.map((card) => [card.manifest.familyId, card]));
  const discoveredKaiLineages = new Set(deckCards.map((card) => card.manifest.variant.generatorVersion === 2
    ? card.manifest.variant.traits.birthProfile.species.lineageKey
    : `legacy:${card.manifest.familyId}`));
  const guideFamilies = [...creatureFamilies].sort((left, right) =>
    Number(discoveredByFamily.has(right.id)) - Number(discoveredByFamily.has(left.id)) || left.name.localeCompare(right.name)
  );
  const nextHabitat = guideFamilies.find((family) => !discoveredByFamily.has(family.id))?.habitat ?? "the living frontier";
  const visibleGuideFamilies = guideFamilies.slice(0, 24);
  const hudModel = projectWildzHud(state, { username: ownerReceizId, displayName: playerDisplayName });
  const cardAdmission = useMemo<WildzVaultCardMembershipProof | null>(() => {
    if (!activeAsset) return null;
    try {
      const admission = deriveWildzVaultCardAdmission({
        cards: deckCards,
        playerHandle: ownerReceizId
      });
      return createWildzVaultCardMembershipProof(admission, activeAsset);
    } catch {
      return null;
    }
  }, [activeAsset, deckCards, ownerReceizId]);
  const multiplayer = useWildsMultiplayer({
    enabled: enabled && networkEnabled && Boolean(avatarStyle) && Boolean(activeAsset),
    style: avatarStyle ?? "female",
    position: state.player,
    activeCard: activeAsset,
    cardAdmission
  });
  const livingWorld = useWildsWorld({
    enabled: enabled && networkEnabled && Boolean(avatarStyle),
    guestId: multiplayer.guestId,
    activeCard: activeAsset ?? null,
    cardAdmission
  });
  const kaiMoment = deriveKaiKlokMoment({
    occurredAt: kaiOccurredAt,
    authority: livingWorld.mode === "receiz_live" ? "world" : "local"
  });
  const saga = projectWildsSaga({
    moment: kaiMoment,
    framework: wildsSagaFramework(),
    memories: livingWorld.snapshot?.story.memories ?? []
  });
  const sagaPlayer = livingWorld.snapshot?.players[ownerReceizId] ?? null;
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
  const sagaTrainers = Object.values(livingWorld.snapshot?.trainers ?? {}).filter((trainer) => sagaTrainerIds.has(trainer.id)) as unknown as WildsTrainerProjection[];
  const sagaTournament = (Object.values(livingWorld.snapshot?.tournaments ?? {}).find((tournament) => tournament.dayId === saga.dayId) ?? null) as WildsTournamentProjection | null;
  const kaiExpression = projectKaiWorldExpression(kaiMoment);
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
    enabled: enabled && Boolean(avatarStyle),
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
    const updateKaiMoment = () => setKaiOccurredAt(new Date().toISOString());
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
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setQualityProfile(currentWildsQualityProfile());
      setReducedMotion(preference.matches);
    };
    update();
    window.addEventListener("resize", update);
    preference.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      preference.removeEventListener("change", update);
    };
  }, []);

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
    setAvatarStyle(initialPlayerContinuity?.settings.avatarStyle ?? character.gender);
    setMovementMode(initialPlayerContinuity?.settings.movementMode ?? "walk");
    setCardOrder(initialPlayerContinuity?.settings.cardOrder ?? "rarity");
    setSaveRestored(true);
  }, [character.gender, initialPlayerContinuity]);

  useEffect(() => {
    if (!saveRestored) return;
    onPlayStateChange(state, {
      settings: {
        avatarStyle,
        movementMode,
        audio: presentation.audioSettings,
        cardOrder
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
    avatarStyle,
    cardOrder,
    initialPlayerContinuity,
    livingWorld.snapshot,
    movementMode,
    onPlayStateChange,
    presentation.audioSettings,
    saveRestored,
    state
  ]);

  useEffect(() => {
    if (state.encounter.phase === "battle_intro") {
      const timer = window.setTimeout(() => setState((current) => applyWildsInput(current, { type: "start-battle", at: new Date().toISOString() })), 650);
      return () => window.clearTimeout(timer);
    }
    const delay = state.encounter.phase === "emerging" ? 1_050 : state.encounter.phase === "capsule" ? 1_250 : state.encounter.phase === "sealed" ? 700 : null;
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      setState((current) => applyWildsInput(current, { type: "advance-encounter", at: new Date().toISOString() }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.encounter.phase]);

  useEffect(() => {
    if (state.encounter.phase !== "revealed" || !state.encounter.assetId) return;
    const assetId = state.encounter.assetId;
    const asset = state.inventory.find((candidate) => candidate.id === assetId) ?? null;
    setRewardAsset(asset);
  }, [state.encounter, state.inventory]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!avatarStyle) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      const input: WildsInput | null =
        key === "arrowup" || key === "w" ? { type: "move", direction: "north" }
          : key === "arrowdown" || key === "s" ? { type: "move", direction: "south" }
            : key === "arrowleft" || key === "a" ? { type: "move", direction: "west" }
              : key === "arrowright" || key === "d" ? { type: "move", direction: "east" }
                : key === "t" ? { type: "train", at: new Date().toISOString() }
                    : key === "m" ? { type: "mission" }
                      : key === "r" ? { type: "rest" }
                        : null;
      if (!input) return;
      event.preventDefault();
      setState((current) => {
        const next = applyWildsInput(current, input);
        if (!current.completed && next.completed) onComplete?.(next.beans);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [avatarStyle, onComplete, ownerReceizId]);

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
    if (!avatarStyle) return;
    setState((current) => {
      const next = applyWildsInput(current, input);
      if (!current.completed && next.completed) {
        onComplete?.(next.beans);
      }
      return next;
    });
  };
  const discoveryActive = state.encounter.phase === "idle" || state.encounter.phase === "searching" || state.encounter.phase === "hint";
  const activeProximity = state.encounter.phase === "idle" ? "cold" : state.encounter.proximity ?? "cold";
  const proximityLabel = state.encounter.phase === "idle"
    ? "Tap terrain to scan"
    : `${activeProximity}${state.encounter.trend ? ` · ${state.encounter.trend}` : ""}`;
  const currentLandmark = landmarkAtPosition(state.player);
  const civic = projectWildsCivicHistory(state.civicEvents);
  const civicActorId = normalizeWildsCivicActorId(ownerReceizId);
  const settlementWorldMode = livingWorld.mode === "receiz_live" ? "receiz_live" : livingWorld.mode === "local_practice" ? "local_practice" : "connecting";
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
    pendingReward: Boolean(rewardAsset),
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
  const visiblePulse = pulse.kind === "enter" && currentLandmarkAccess && !currentLandmarkAccess.allowed
    ? { ...pulse, label: `Inspect sealed ${currentLandmark?.name ?? "landmark"}` }
    : pulse;
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
    pendingReward: Boolean(rewardAsset),
    pendingOperation: livingWorld.pendingCommand ?? raidBusyIntent,
    acknowledgedCausalIds: []
  });
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
      setActiveLandmarkId(pulse.landmarkId);
      return;
    }
    if (pulse.kind === "join") {
      if (pulse.activityId.startsWith("ecology:")) {
        const ecology = livingWorld.snapshot?.ecologySites[pulse.activityId];
        if (!ecology || !nearbyEcology || nearbyEcology.site.id !== ecology.id) return;
        if (ecology.phase !== "foreshadowed") {
          presentation.playCue(ecologyAudioCue("discovered", ecology.familyId));
          setActiveEcologySiteId(ecology.id);
          return;
        }
        void livingWorld.discoverEcology(ecology.id, state.player).then((projection) => {
          const admitted = projection.ecologySites[ecology.id];
          const cursor = projection.cursor;
          if (!admitted || !cursor) throw new Error("wilds_ecology_discovery_receipt_missing");
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
        }).catch((error) => setRiftError(error instanceof Error ? error.message : "wilds_ecology_discovery_failed"));
        return;
      }
      const round = Object.values(livingWorld.snapshot?.raids ?? {}).find((candidate) => candidate.bossId === pulse.activityId && candidate.phase !== "settled" && candidate.phase !== "expired");
      if (!round) { setRiftError("wilds_world_raid_missing"); return; }
      setRaidReturnPosition({ ...state.player });
      void livingWorld.enterRaid(pulse.activityId, round.id, state.player).then((projection) => {
        const admitted = projection.raids[round.id];
        if (!admitted) throw new Error("wilds_raid_admission_missing");
        const squads = Array.isArray(admitted.squads) ? admitted.squads as string[][] : [];
        const placement = squads.some((squad) => squad.includes(multiplayer.guestId)) ? "fighter" : "support";
        setActiveRaid({ bossId: pulse.activityId, roundId: round.id, placement, connected: true });
        if (nearbyLivingBoss?.familyId) presentation.playCue(bossAudioCue("telegraph", nearbyLivingBoss.familyId as WildsBossFamilyId));
      }).catch((error) => setRiftError(error instanceof Error ? error.message : "wilds_raid_join_failed"));
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
  const executeCommandAction = (action: WildsCommandAction) => {
    if (action.type === "open-mission") setRequestedCommand("mission");
    else if (action.type === "open-field-guide") setRequestedCommand("fieldGuide");
    else if (action.type === "open-satchel") setRequestedCommand("satchel");
    else if (action.type === "open-trail-pack") setRequestedCommand("deck");
    else if (action.type === "open-vault") setRequestedCommand("vault");
    else if (action.type === "open-map") setMapOpen(true);
    else activatePulse();
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
          <WildsSagaPanel
            missions={sagaMissions}
            mode={livingWorld.mode}
            onBattleTrainer={(trainer) => {
              try {
                void livingWorld.settleTrainerBattle(saga.dayId, trainer.id, "player_victory").catch((error) => setRiftError(error instanceof Error ? error.message : "wilds_story_trainer_battle_failed"));
              } catch (error) {
                setRiftError(error instanceof Error ? error.message : "wilds_story_trainer_battle_failed");
              }
            }}
            onContribute={(node) => void livingWorld.contributeStory(saga.dayId, node.definition.id, node.definition.acceptedVerbs[0]!, 1, state.player).catch((error) => setRiftError(error instanceof Error ? error.message : "wilds_story_contribution_failed"))}
            onEnterTournament={(tournamentId, qualificationGrantId) => {
              try {
                void livingWorld.enterSagaTournament(tournamentId, qualificationGrantId).catch((error) => setRiftError(error instanceof Error ? error.message : "wilds_story_tournament_entry_failed"));
              } catch (error) {
                setRiftError(error instanceof Error ? error.message : "wilds_story_tournament_entry_failed");
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
            <button onClick={() => dispatch({ type: "rest" })} type="button">Make camp</button>
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
          <div className="wilds-vault-sheet-heading"><small>Portable card vault</small><strong>{state.inventory.length} sealed {state.inventory.length === 1 ? "card" : "cards"}</strong></div>
          <WildsInventory
            state={state}
            cardOrder={cardOrder}
            onCardOrderChange={setCardOrder}
            playerVault={() => createWildsPlayerVault({
              playerId: ownerReceizId,
              exportedAt: new Date().toISOString(),
              playState: state,
              character,
              settings: {
                avatarStyle,
                movementMode,
                audio: presentation.audioSettings,
                cardOrder
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
            onExportVault={onExportVault}
            onInput={dispatch}
            onListAsset={onListAsset}
            onRestoreArtifact={async (file, confirmCardOnly, currentPlayState) => {
              const outcome = await onRestoreArtifact(file, confirmCardOnly, currentPlayState);
              setState(outcome.playState);
              setAvatarStyle(outcome.playerContinuity.settings.avatarStyle);
              setMovementMode(outcome.playerContinuity.settings.movementMode);
              setCardOrder(outcome.playerContinuity.settings.cardOrder);
              presentation.setAudioSettings(normalizeWildsAudioSettings(outcome.playerContinuity.settings.audio));
              return outcome;
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
            className={`wilds-stage${state.encounter.phase === "hint" ? ` signal-${state.encounter.proximity}` : ""}${multiplayer.activeBattle ? " pvp-active" : ""}`}
            aria-label="Receiz Wilds playable 3D world"
          >
            <WildsWorldCanvas
              state={state}
              avatarStyle={avatarStyle ?? "female"}
              remotePlayers={multiplayer.remotePlayers}
              qualityProfile={qualityProfile}
              searchEnabled={discoveryActive && Boolean(avatarStyle)}
              onCameraHeadingChange={updateCameraHeading}
              livingWorld={livingWorld.snapshot}
              worldMode={settlementWorldMode}
              kaiMoment={kaiMoment}
              supportCards={trailSupportCards}
              onSelectPlayer={multiplayer.selectPlayer}
              onSearchPoint={(point) => {
                dispatch({ type: "search-point", ...point, searchedAt: new Date().toISOString(), ownerReceizId });
              }}
            />

            {avatarStyle ? <WildzReferenceHud
              heading={playerHeading}
              model={hudModel}
              onOpenMap={() => setMapOpen(true)}
              onOpenMission={() => setRequestedCommand("mission")}
            /> : null}

            {avatarStyle ? <WildsMultiplayer multiplayer={multiplayer} position={state.player} /> : null}
            {avatarStyle ? <WildsLivingWorldHud connected={networkEnabled} player={state.player} world={livingWorld} /> : null}
            <div className="wilds-utility-cluster">
              <WildsAudioSettings
                onChange={presentation.setAudioSettings}
                onUnlock={() => { void presentation.unlockAudio(); }}
                ready={presentation.audioReady}
                settings={presentation.audioSettings}
              />
              <button
                aria-label={`Open living Command Center. Beat step pulse ${kaiMoment.latticeCoordinate}`}
                className="wilds-kai-command-pill"
                onClick={() => setRequestedCommand("commandCenter")}
                style={{ "--kai-accent": kaiMoment.accent } as CSSProperties}
                title="Open living Command Center"
                type="button"
              >
                <small>BEAT:STEP:PULSE</small>
                <span>{kaiMoment.latticeCoordinate}</span>
              </button>
            </div>

            {state.battle && ["player_turn", "capture_ready", "fled", "defeated"].includes(state.encounter.phase) ? (
              <WildsBattle
                battle={state.battle}
                inventory={state.inventory}
                onAction={(action) => dispatch({ type: "battle-action", action })}
                onDismiss={() => dispatch({ type: "dismiss-reveal" })}
              />
            ) : null}

            {!avatarStyle ? (
              <div className="wilds-avatar-select" role="dialog" aria-labelledby="wilds-avatar-title" aria-modal="true">
                <div className="wilds-avatar-select-card">
                  <span className="eyebrow">Your journey begins</span>
                  <h3 id="wilds-avatar-title">Choose your explorer</h3>
                  <p>You’ll see your explorer from behind as you walk, search, battle, and capture.</p>
                  <div className="wilds-avatar-options">
                    {(["female", "male"] as const).map((choice) => (
                      <button
                        key={choice}
                        className={`wilds-avatar-option ${choice}`}
                        onClick={() => setAvatarStyle(choice)}
                        type="button"
                      >
                        <span className="wilds-avatar-preview" aria-hidden="true"><i /><b /><em /></span>
                        <strong>{choice === "female" ? "Female explorer" : "Male explorer"}</strong>
                        <small>Select and enter the Wilds</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="wilds-hud-top">
              <div className="wilds-player-chip">
                <span className="wilds-avatar">RZ</span>
                <div>
                  <strong>Wilds scout</strong>
                  <small>{state.worldRank} · {activeAsset?.manifest.name ?? activeCard.name} L{activeProgress.level}</small>
                  <span className="wilds-coordinate-badges" aria-label={`World coordinates X ${Math.round(state.player.x)}, Z ${Math.round(state.player.z)}`}>
                    <b>X {Math.round(state.player.x)}</b><b>Z {Math.round(state.player.z)}</b>
                  </span>
                </div>
              </div>
              <div className="wilds-resource-strip">
                <span>{state.cardXp} card XP</span>
                <span>{state.energy}% energy</span>
                <span>{state.challenge}% challenge</span>
                <span>{state.combo}x combo</span>
              </div>
            </div>

            <div className="wilds-mission-meter" aria-label={`${state.missionProgress}% mission progress`}>
              <strong>{state.missionProgress}%</strong>
              <span>mission</span>
            </div>

            <div className="runner-card runner-primary">
              <span className="runner-core" />
              <div>
                <strong>{state.encounter.phase === "hint" ? `Signal ${proximityLabel}` : "Discovery on"}</strong>
                <small>{state.encounter.phase === "hint" ? "Keep tapping around the clue." : "Tap terrain repeatedly to scan."}</small>
              </div>
            </div>

            {discoveryActive ? <div className={`wilds-search-reticle ${state.encounter.phase === "idle" ? "" : activeProximity}`} aria-live="polite">{proximityLabel}</div> : null}

            <div className="wilds-event-toast" aria-live="polite">
              {riftError || (activeLandmarkId ? `${currentLandmark?.name ?? "Landmark"} entrance awakened.` : state.lastEvent)}
            </div>
          </div>

          <div className="wildz-social-stack">
            <WildzSocialDeck
              activeCard={activeAsset}
              action={visiblePulse}
              cameraHeadingRef={cameraHeadingRef}
              companionProgress={state.companionProgress}
              movementMode={movementMode}
              cardOrder={cardOrder}
              nearbyCards={state.inventory}
              onAction={activatePulse}
              onCardOrderChange={setCardOrder}
              onMission={() => dispatch({ type: "mission" })}
              onOpenFieldGuide={() => setRequestedCommand("fieldGuide")}
              onOpenMarket={onOpenMarket}
              onOpenSatchel={() => setRequestedCommand("satchel")}
              onOpenDeck={() => setRequestedCommand("deck")}
              onOpenVault={() => setRequestedCommand("vault")}
              onOpenProfile={onOpenProfile}
              onInput={(input) => dispatch(input)}
              onMovementModeChange={setMovementMode}
              onRest={() => dispatch({ type: "rest" })}
              onSelectCard={(assetId) => dispatch({ type: "select-asset", assetId })}
              onTrain={() => dispatch({ type: "train", at: new Date().toISOString() })}
            />
            <WildsCommandDock items={commandItems} requestedKey={requestedCommand} onRequestHandled={() => setRequestedCommand(null)} />
          </div>
        </div>
      </div>
      <WildsWorldMap
        currentPosition={state.player}
        discoveredLandmarkIds={discoveredLandmarkIds}
        guestId={multiplayer.guestId}
        missionProgress={state.missionProgress}
        onClose={() => setMapOpen(false)}
        onRift={riftTo}
        open={mapOpen}
        qualityProfile={qualityProfile}
        reducedMotion={reducedMotion}
        remotePlayers={multiplayer.remotePlayers}
        worldMastery={state.worldMastery}
        landmarkProgress={landmarkProgress}
        livingWorld={livingWorld.snapshot}
        ecologyKnowledge={state.ecologyKnowledge}
        bossKnowledge={state.bossKnowledge}
      />
      <WildsLandmarkExperience
        access={activeLandmarkId && activeLandmarkId !== "wayfinder-hollow" ? evaluateLandmarkAccess(WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === activeLandmarkId)!, landmarkProgress) : null}
        card={activeAsset}
        roster={state.inventory}
        hearttreeConditions={state.hearttreeConditions}
        hearttreeSquadAssetIds={state.hearttreeSquadAssetIds}
        guestId={multiplayer.guestId}
        landmarkId={activeLandmarkId === "wayfinder-hollow" ? null : activeLandmarkId}
        onExit={() => setActiveLandmarkId(null)}
        onAudioCue={presentation.playCue}
        onHearttreeReceipt={(receipt) => dispatch({ type: "hearttree-admit", receipt })}
        onHearttreeSquadChange={(assetIds) => dispatch({ type: "hearttree-select-squad", assetIds })}
        onArenaCommit={(settlement) => setState((current) => {
          const retired = settlement.result.retiredCreatureIds.includes(settlement.card.id);
          const inventory = current.inventory.map((asset) => asset.id === settlement.card.id ? settlement.card : asset);
          const fallback = retired ? inventory.find((asset) => asset.id !== settlement.card.id) ?? null : null;
          const progressKey = settlement.card.manifest.familyId;
          const prior = current.companionProgress[progressKey] ?? { level: 1, xp: 0, bond: 0 };
          const gainedXp = settlement.result.winnerSide === 0 ? 60 : settlement.result.outcome === "fled" ? 18 : 30;
          const xp = prior.xp + gainedXp;
          return {
            ...current,
            inventory,
            selectedAssetId: fallback?.id ?? current.selectedAssetId,
            selectedCardId: fallback?.manifest.familyId ?? current.selectedCardId,
            companionProgress: { ...current.companionProgress, [progressKey]: { ...prior, xp, level: Math.max(prior.level, 1 + Math.floor(xp / 100)) } },
            pendingSyncAssetIds: Array.from(new Set([...current.pendingSyncAssetIds, settlement.card.id])),
            lastEvent: retired
              ? `${settlement.card.manifest.name} was sealed into the memorial Vault after the Mortal Arena.`
              : settlement.result.winnerSide === 0
                ? `${settlement.card.manifest.name} carried a Mortal Arena victory into living history.`
                : `${settlement.card.manifest.name} survived the Mortal Arena and carries its marks.`
          };
        })}
        onUnlock={(unlockId) => setState((current) => ({
          ...current,
          achievements: Array.from(new Set([...current.achievements, unlockId])).slice(0, 64)
        }))}
        worldMode={settlementWorldMode}
      />
      <WildsSettlementExperience
        actorId={civicActorId}
        card={activeAsset}
        civic={civic}
        livingWorld={livingWorld.snapshot}
        onAudioCue={presentation.playCue}
        onDistrictChange={setActiveDistrictId}
        onCivicEvent={(event) => dispatch({ type: "record-civic-event", event })}
        onExit={() => setActiveLandmarkId(null)}
        open={activeLandmarkId === "wayfinder-hollow"}
        remotePlayers={multiplayer.remotePlayers}
        worldMode={settlementWorldMode}
      />
      <WildsEcologyExperience
        card={activeAsset}
        onExit={() => setActiveEcologySiteId(null)}
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
        open={Boolean(activeEcologySite)}
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
            if (raidReturnPosition) setState((current) => ({ ...current, player: raidReturnPosition }));
            setActiveRaid(null);
            setRaidReturnPosition(null);
          });
        }}
        open={Boolean(activeRaid && activeRaidBoss && activeRaidRound)}
        placement={activeRaid?.placement ?? "support"}
        raid={activeRaidRound}
        role={activeRaidRoles?.primary ?? "steward"}
      />
      <WildsCaptureReward asset={rewardAsset} onClose={() => {
        setRewardAsset(null);
        dispatch({ type: "dismiss-reveal" });
      }} />
      <WildsTransformation state={state} onInput={dispatch} />
      <WildsChildCeremony state={state} onInput={dispatch} />
    </section>
  );
}
