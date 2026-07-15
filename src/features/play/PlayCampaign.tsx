"use client";

import dynamic from "next/dynamic";
import { Icons } from "@/components/icons";
import { Button, StatusPill } from "@/components/ui";
import {
  applyWildsInput,
  initialPlayState,
  missionCards,
  restorePlayState,
  serializePlayState,
  selectedAsset,
  selectedCard,
  type PlayState,
  type WildsInput
} from "@/features/play/game-state";
import { useEffect, useRef, useState } from "react";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { WildsCaptureReward } from "@/features/play/WildsCaptureReward";
import { WildsInventory } from "@/features/play/WildsInventory";
import { WildsBattle } from "@/features/play/WildsBattle";
import { WildsTransformation } from "@/features/play/WildsTransformation";
import { WildsChildCeremony } from "@/features/play/WildsChildCeremony";
import { WildsMultiplayer } from "@/features/play/WildsMultiplayer";
import { useWildsMultiplayer } from "@/features/play/use-wilds-multiplayer";
import { WildsAudioSettings } from "@/features/play/WildsAudioSettings";
import { useWildsPresentation } from "@/features/play/use-wilds-presentation";
import { selectWildsQualityProfile } from "@/features/play/wilds-quality-profile";
import { projectWorldProgression } from "@/features/play/world-progression";
import { WildsCommandDock, type WildsCommandItem, type WildsCommandKey } from "@/features/play/WildsCommandDock";
import { WildsWorldMap } from "@/features/play/WildsWorldMap";
import { WildsWorldControls } from "@/features/play/WildsWorldControls";
import { WildsLandmarkExperience } from "@/features/play/WildsLandmarkExperience";
import { normalizeWildsMovementMode, WILDS_MOVEMENT_MODE_KEY, type WildsMovementMode } from "@/features/play/wilds-movement";
import { resolveWildsContextAction } from "@/features/play/wilds-context-action";
import { landmarkAtPosition, WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "@/features/play/wilds-landmarks";
import { evaluateLandmarkAccess, type WildsLandmarkProgress } from "@/features/play/wilds-landmark-access";
import type { RiftTravelGrant } from "@/features/play/wilds-rift-travel";
import { projectWildzHud } from "@/features/play/wildz-gameplay-hud";
import { WildzReferenceHud } from "@/features/play/WildzReferenceHud";
import { WildzSocialDeck } from "@/features/play/WildzSocialDeck";
import { WildsCreatureThumbnail } from "@/features/play/WildsCreatureThumbnail";
import { creatureFamilies } from "@/features/play/creature-catalog";

const WILDS_SAVE_KEY = "receiz:wilds:save:v2";
const WILDS_AVATAR_KEY = "receiz:wilds:explorer:v1";
const WILDS_ACHIEVEMENTS_KEY = "receiz:wilds:landmark-unlocks:v1";

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
  onComplete,
  ownerReceizId = "wilds.player.receiz.id",
  playerDisplayName = "Wildz Explorer",
  onListAsset,
  onOpenProfile = () => {},
  onOpenMarket = () => {},
  restoredAssets = []
}: {
  campaignName?: string;
  enabled: boolean;
  onComplete?: (beans: number) => void;
  ownerReceizId?: string;
  playerDisplayName?: string;
  onListAsset?: (asset: PortableCardAsset, priceCents: number) => Promise<PortableCardAsset | null>;
  onOpenProfile?: () => void;
  onOpenMarket?: () => void;
  restoredAssets?: PortableCardAsset[];
}) {
  const [state, setState] = useState(initialPlayState);
  const [saveRestored, setSaveRestored] = useState(false);
  const [rewardAsset, setRewardAsset] = useState<PortableCardAsset | null>(null);
  const [avatarStyle, setAvatarStyle] = useState<"female" | "male" | null>(null);
  const [qualityProfile, setQualityProfile] = useState(currentWildsQualityProfile);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [cameraHeading, setCameraHeading] = useState(0);
  const [playerHeading, setPlayerHeading] = useState(0);
  const previousPlayerPosition = useRef(state.player);
  const [movementMode, setMovementMode] = useState<WildsMovementMode>("walk");
  const [activeLandmarkId, setActiveLandmarkId] = useState<WildsLandmarkId | null>(null);
  const [landmarkUnlocks, setLandmarkUnlocks] = useState<string[]>([]);
  const [riftError, setRiftError] = useState("");
  const [requestedCommand, setRequestedCommand] = useState<WildsCommandKey | null>(null);
  const activeMission = missionCards[state.completedMissionIds.length % missionCards.length];
  const worldProgression = projectWorldProgression(state.worldMastery);
  const activeCard = selectedCard(state);
  const activeAsset = selectedAsset(state);
  const deckCards = state.inventory;
  const activeProgress = state.companionProgress[activeCard.id] ?? { level: 1, xp: 0, bond: 0 };
  const discoveredByFamily = new Map(deckCards.map((card) => [card.manifest.familyId, card]));
  const guideFamilies = [...creatureFamilies].sort((left, right) =>
    Number(discoveredByFamily.has(right.id)) - Number(discoveredByFamily.has(left.id)) || left.name.localeCompare(right.name)
  );
  const nextHabitat = guideFamilies.find((family) => !discoveredByFamily.has(family.id))?.habitat ?? "the living frontier";
  const visibleGuideFamilies = guideFamilies.slice(0, 24);
  const hudModel = projectWildzHud(state, { username: ownerReceizId, displayName: playerDisplayName });
  const multiplayer = useWildsMultiplayer({
    enabled: enabled && Boolean(avatarStyle) && Boolean(activeAsset),
    style: avatarStyle ?? "female",
    position: state.player,
    activeCard: activeAsset
  });
  const presentation = useWildsPresentation({
    encounter: {
      phase: state.encounter.phase,
      proximity: state.encounter.phase === "idle" ? "cold" : state.encounter.proximity
    },
    enabled: enabled && Boolean(avatarStyle)
  });

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
    const restored = restorePlayState(window.localStorage.getItem(WILDS_SAVE_KEY));
    const params = new URLSearchParams(window.location.search);
    const joinRoom = params.get("wildsJoin");
    const joinX = Number(params.get("wildsX"));
    const joinZ = Number(params.get("wildsZ"));
    const withVault = restoredAssets.reduce((current, asset) => applyWildsInput(current, { type: "import-card", asset }), restored);
    setState(/^invite:[a-f0-9]{16}$/.test(joinRoom ?? "") && Number.isFinite(joinX) && Number.isFinite(joinZ)
      ? { ...withVault, player: { x: joinX + 1.4, z: joinZ + 1.4 }, lastEvent: "Invite signal found. You joined the shared trail beside its sender." }
      : withVault);
    const savedAvatar = window.localStorage.getItem(WILDS_AVATAR_KEY);
    if (savedAvatar === "female" || savedAvatar === "male") setAvatarStyle(savedAvatar);
    try {
      const savedUnlocks = JSON.parse(window.localStorage.getItem(WILDS_ACHIEVEMENTS_KEY) ?? "[]");
      if (Array.isArray(savedUnlocks)) setLandmarkUnlocks(savedUnlocks.filter((item): item is string => typeof item === "string").slice(0, 64));
    } catch {
      // Landmark progression starts clean when local storage is malformed.
    }
    setMovementMode(normalizeWildsMovementMode(window.localStorage.getItem(WILDS_MOVEMENT_MODE_KEY)));
    setSaveRestored(true);
  }, [restoredAssets]);

  useEffect(() => {
    if (!saveRestored) return;
    try {
      window.localStorage.setItem(WILDS_MOVEMENT_MODE_KEY, movementMode);
    } catch {
      // Movement mode remains active for this session when storage is unavailable.
    }
  }, [movementMode, saveRestored]);

  useEffect(() => {
    if (!saveRestored) return;
    try {
      window.localStorage.setItem(WILDS_SAVE_KEY, serializePlayState(state));
    } catch {
      // The game remains playable when browser persistence is unavailable.
    }
  }, [saveRestored, state]);

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
  const landmarkProgress: WildsLandmarkProgress = {
    verifiedCardCount: state.inventory.length,
    activeCardLevel: activeProgress.level,
    achievementIds: landmarkUnlocks,
    partySize: multiplayer.remotePlayers.length + 1
  };
  const currentLandmarkAccess = currentLandmark ? evaluateLandmarkAccess(currentLandmark, landmarkProgress) : null;
  const pulse = resolveWildsContextAction({
    pendingReward: Boolean(rewardAsset),
    landmark: currentLandmark,
    secretId: state.encounter.phase === "hint" ? state.encounter.hotspotId ?? null : null,
    selectedPlayer: multiplayer.selectedPlayer
      ? { playerId: multiplayer.selectedPlayer.playerId, handle: multiplayer.selectedPlayer.handle }
      : null,
    joinableActivity: null
  });
  const visiblePulse = pulse.kind === "enter" && currentLandmarkAccess && !currentLandmarkAccess.allowed
    ? { ...pulse, label: `Inspect sealed ${currentLandmark?.name ?? "landmark"}` }
    : pulse;
  const activatePulse = () => {
    if (pulse.kind === "enter") {
      setActiveLandmarkId(pulse.landmarkId);
      return;
    }
    if (pulse.kind === "collect" || pulse.kind === "greet" || pulse.kind === "join") return;
    dispatch({
      type: "search-point",
      x: state.player.x,
      z: state.player.z,
      searchedAt: new Date().toISOString(),
      ownerReceizId
    });
  };
  const riftTo = async (destination: { x: number; z: number }) => {
    setRiftError("");
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
      key: "mission",
      label: "World Mission",
      icon: <Icons.trophy size={21} />,
      badge: `${state.missionProgress}%`,
      content: (
        <div className="wilds-command-content wilds-mission-content">
          <div className="wilds-command-content-lead">
            <span><small>Current mission</small><strong>{activeMission.title}</strong></span>
            <b>{state.missionProgress}%</b>
          </div>
          <div className="wilds-world-chapter">
            <span>
              <small>Chapter {worldProgression.chapterIndex + 1} · Cycle {worldProgression.cycle}</small>
              <strong>{worldProgression.chapter.name}</strong>
            </span>
            <b>{worldProgression.chapter.element}</b>
            <p>{worldProgression.chapter.objective}</p>
            <div className="wilds-progress" aria-label={`${worldProgression.chapterMastery}% chapter mastery`}>
              <span style={{ width: `${worldProgression.chapterMastery}%` }} />
            </div>
            <span className="wilds-world-event">
              <small>Live world event</small>
              <strong>{worldProgression.worldEvent.name}</strong>
              <em>{worldProgression.worldEvent.objective}</em>
            </span>
            <small>Permanent mastery {state.worldMastery} · Next realm at {worldProgression.nextChapterAt}</small>
          </div>
          <p>{activeMission.requirement}</p>
          <div className="wilds-progress" aria-label={`${state.missionProgress}% mission progress`}>
            <span style={{ width: `${state.missionProgress}%` }} />
          </div>
          <strong className="wilds-command-reward-label">{activeMission.reward}</strong>
          <div className="wilds-economy-grid">
            <div><span>Deck</span><strong>{deckCards.length}/∞</strong></div>
            <div><span>Near</span><strong>{state.encounter.phase === "idle" ? "Hidden" : state.encounter.phase}</strong></div>
            <div><span>Titan Gate</span><strong>{state.bossUnlocked ? "Open" : "Locked"}</strong></div>
          </div>
          <Button className="wilds-reset" variant="outline" onClick={() => dispatch({ type: "reset" })}>Reset world</Button>
        </div>
      )
    },
    {
      key: "fieldGuide",
      label: "Field Guide",
      icon: <Icons.book size={21} />,
      badge: `${discoveredByFamily.size}/${creatureFamilies.length}`,
      content: (
        <div className="wilds-command-content wilds-field-guide">
          <div className="wilds-command-content-lead">
            <span><small>Species index</small><strong>{discoveredByFamily.size} verified discoveries</strong></span>
            <b>{creatureFamilies.length - discoveredByFamily.size} unseen</b>
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
          <small className="wilds-field-guide-limit">Showing discovered species first within 24 nearby field signals.</small>
        </div>
      )
    },
    {
      key: "satchel",
      label: "Foraging Satchel",
      icon: <Icons.products size={21} />,
      badge: state.beans,
      content: (
        <div className="wilds-command-content wilds-satchel">
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
      label: "Active Deck",
      icon: <Icons.assets size={21} />,
      content: (
        <div className="wilds-command-content">
          <div className="wilds-command-content-lead">
            <span><small>Active leader</small><strong>{activeAsset?.manifest.name ?? activeCard.name}</strong></span>
            <b>{deckCards.length}/∞</b>
          </div>
          <div className="wilds-squad-list" aria-label="Collected companion cards">
            {deckCards.map((card) => (
              <button
                aria-pressed={state.selectedAssetId === card.id}
                className="wilds-squad-card"
                key={card.id}
                onClick={() => dispatch({ type: "select-asset", assetId: card.id })}
                type="button"
              >
                <WildsCreatureThumbnail asset={card} />
                <div><strong>{card.manifest.name}</strong><small>Stage {card.manifest.stage} · Level {state.companionProgress[card.manifest.familyId]?.level ?? 1} · Bond {state.companionProgress[card.manifest.familyId]?.bond ?? 0}</small></div>
                <b>{card.manifest.stats.power}</b>
                <div className="wilds-mini-charge" aria-label={`${card.manifest.stats.power}% power`}><i style={{ width: `${card.manifest.stats.power}%` }} /></div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      key: "vault",
      label: "Card Vault",
      icon: <Icons.box size={21} />,
      badge: state.inventory.length,
      content: (
        <div className="wilds-command-content wilds-vault-command-content">
          <div className="wilds-vault-sheet-heading"><small>Portable card vault</small><strong>{state.inventory.length} sealed {state.inventory.length === 1 ? "card" : "cards"}</strong></div>
          <WildsInventory state={state} onInput={dispatch} onListAsset={onListAsset} />
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
          <p>{campaignName} is now a playable 3D creature-card world: discover companions, build a deck, run missions, and unlock portable merchant rewards.</p>
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
              onCameraHeadingChange={setCameraHeading}
              onSelectPlayer={multiplayer.selectPlayer}
              onSearchPoint={(point) => {
                dispatch({ type: "search-point", ...point, searchedAt: new Date().toISOString(), ownerReceizId });
              }}
            />

            {avatarStyle ? <WildzReferenceHud
              heading={playerHeading}
              model={hudModel}
              onOpenMission={() => setRequestedCommand("mission")}
            /> : null}

            {avatarStyle ? <WildsMultiplayer multiplayer={multiplayer} position={state.player} /> : null}
            <div className="wilds-utility-cluster">
              <WildsAudioSettings
                onChange={presentation.setAudioSettings}
                onUnlock={() => { void presentation.unlockAudio(); }}
                ready={presentation.audioReady}
                settings={presentation.audioSettings}
              />
              <button aria-label="Open world map" className="wilds-map-trigger" onClick={() => setMapOpen(true)} title="Open world map" type="button">
                <Icons.globe aria-hidden="true" size={20} />
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
                        onClick={() => {
                          setAvatarStyle(choice);
                          try { window.localStorage.setItem(WILDS_AVATAR_KEY, choice); } catch { /* selection remains active for this session */ }
                        }}
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

          <div className="wildz-preserved-controls" aria-hidden="true">
            <WildsWorldControls
              activeAction={state.activeAction}
              activeCardName={activeCard.name}
              cameraHeading={cameraHeading}
              movementMode={movementMode}
              onInput={dispatch}
              onMission={() => dispatch({ type: "mission" })}
              onMovementModeChange={setMovementMode}
              onPulse={activatePulse}
              onRest={() => dispatch({ type: "rest" })}
              onTrain={() => dispatch({ type: "train", at: new Date().toISOString() })}
              pulse={visiblePulse}
            />
          </div>
          <div className="wildz-social-stack">
            <WildzSocialDeck
              activeCard={activeAsset}
              action={visiblePulse}
              cameraHeading={cameraHeading}
              companionProgress={state.companionProgress}
              movementMode={movementMode}
              nearbyCards={state.inventory}
              onAction={activatePulse}
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
        discoveredLandmarkIds={["hearttree-sanctum"]}
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
      />
      <WildsLandmarkExperience
        access={activeLandmarkId ? evaluateLandmarkAccess(WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === activeLandmarkId)!, landmarkProgress) : null}
        card={activeAsset}
        landmarkId={activeLandmarkId}
        onExit={() => setActiveLandmarkId(null)}
        onUnlock={(unlockId) => setLandmarkUnlocks((current) => {
          const next = Array.from(new Set([...current, unlockId])).slice(0, 64);
          try { window.localStorage.setItem(WILDS_ACHIEVEMENTS_KEY, JSON.stringify(next)); } catch { /* progression remains active for this session */ }
          return next;
        })}
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
