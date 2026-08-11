"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WildsChallenge } from "./multiplayer-challenge";
import type { WildsPresence } from "./multiplayer-core";
import type { PvpCard } from "./pvp-battle-engine";
import type { WildsMultiplayerController } from "./use-wilds-multiplayer";
import { DEFAULT_WILDS_AUDIO_SETTINGS } from "./wilds-audio";
import { WildsAudioSettings } from "./WildsAudioSettings";
import { WildsMultiplayer } from "./WildsMultiplayer";
import { usePlayModalLifecycle } from "./use-play-modal-lifecycle";

const fixtureCard: PvpCard = {
  assetId: "balanced-hud-fixture-card",
  proofDigest: "sha256:balanced-hud-fixture-card",
  name: "Gradoaw",
  stats: { health: 52, power: 41, guard: 38, speed: 35, bond: 22 },
  abilities: [{ name: "Stone Pulse", power: 18 }, { name: "Root Guard", power: 14 }]
};

const fixturePlayer: WildsPresence = {
  playerId: "fixture-remote",
  handle: "Aster",
  style: "female",
  x: 2,
  z: 2,
  heading: 0,
  status: "available",
  lastSeenAt: "2026-08-11T12:00:00.000Z",
  practice: false,
  activeCard: fixtureCard
};

const fixtureChallenge: WildsChallenge = {
  id: "fixture-challenge",
  roomKey: "wilds:fixture:0:0",
  challengerId: fixturePlayer.playerId,
  opponentId: "fixture-self",
  challengerCard: fixtureCard,
  opponentCard: null,
  mode: "friendly",
  state: "offered",
  revision: 1,
  offeredAt: "2026-08-11T12:00:00.000Z",
  acceptedAt: null,
  closedAt: null,
  expiresAt: "2026-08-11T12:00:45.000Z"
};

export function BalancedStatusHudBrowserFixture() {
  const [challenge, setChallenge] = useState<WildsChallenge | null>(null);
  const [declineCount, setDeclineCount] = useState(0);
  const [escapeRevision, setEscapeRevision] = useState<number | null>(null);
  const [pollRevision, setPollRevision] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<WildsPresence | null>(null);
  const [audio, setAudio] = useState(DEFAULT_WILDS_AUDIO_SETTINGS);
  const originRef = useRef<HTMLElement | null>(null);
  const modalOwned = challenge !== null;
  useEffect(() => {
    if (!modalOwned) return;
    const timer = window.setInterval(() => setPollRevision((revision) => revision + 1), 100);
    return () => window.clearInterval(timer);
  }, [modalOwned]);
  const answerChallenge = useCallback(async (_challengeId: string, action: "accept" | "decline") => {
    if (action === "decline") setDeclineCount((count) => count + 1);
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    setChallenge(null);
    return null as never;
  }, []);
  const multiplayer = useMemo(() => ({
    guestId: "fixture-guest",
    roomKey: "wilds:fixture:0:0",
    selfId: "fixture-self",
    mode: "receiz_live" as const,
    error: "",
    snapshot: challenge ? {
      schema: "receiz.wilds_multiplayer_room.v1" as const,
      roomKey: "wilds:fixture:0:0",
      revision: 1,
      updatedAt: "2026-08-11T12:00:00.000Z",
      players: [fixturePlayer],
      messages: [],
      challenges: [challenge],
      battles: [],
      capabilities: { friendlyBattle: true as const, cardStake: false as const, moneyStake: false as const, reason: "receiz_atomic_asset_exchange_required" as const }
    } : null,
    remotePlayers: [fixturePlayer],
    selectedPlayer,
    selectedPlayerId: selectedPlayer?.playerId ?? null,
    selectPlayer: setSelectedPlayer,
    activeBattle: null,
    incomingChallenge: challenge,
    createInviteLink: async () => window.location.href,
    sendMessage: async () => null as never,
    offerChallenge: async () => null as never,
    answerChallenge,
    submitIntent: async () => null as never,
    dismissBattle: () => {},
    refresh: async () => {}
  }), [answerChallenge, challenge, selectedPlayer]);
  const closeOwnedModal = () => {
    setEscapeRevision(pollRevision);
    if (challenge) void answerChallenge(challenge.id, "decline");
  };
  usePlayModalLifecycle({
    onEscape: closeOwnedModal,
    originRef,
    owner: modalOwned ? "multiplayer" : "none"
  });

  return <main className="wildz-app" data-testid="balanced-status-hud-browser-fixture" style={{ minHeight: "100dvh", padding: 16 }}>
    <h1>Balanced status HUD runtime fixture</h1>
    <div aria-hidden={modalOwned} inert={modalOwned ? true : undefined} style={{ display: "grid", gap: 12, maxWidth: 380 }}>
      <WildsMultiplayer
        battleModalOwned={false}
        dismissSignal={0}
        interactionEnabled={!modalOwned}
        modalOwned={modalOwned}
        multiplayer={multiplayer as WildsMultiplayerController}
        position={{ x: 0, z: 0 }}
      />
      <WildsAudioSettings onChange={setAudio} onUnlock={() => {}} ready settings={audio} />
      <button onClick={() => setChallenge(fixtureChallenge)} type="button">Receive fixture challenge</button>
    </div>
    <output data-poll-revision={pollRevision} id="fixture-poll-revision">Polls: {pollRevision}</output>
    <output data-escape-revision={escapeRevision ?? ""} id="fixture-escape-revision">Escape revision: {escapeRevision ?? "none"}</output>
    <output aria-live="polite" data-decline-count={declineCount} id="fixture-decline-count">Declines: {declineCount}</output>
  </main>;
}
