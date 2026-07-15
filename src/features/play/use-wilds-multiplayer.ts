"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInviteRoom, roomKeyForPosition, type WildsPresence } from "./multiplayer-core";
import type { WildsMultiplayerSnapshot } from "./multiplayer-ledger";
import type { PvpIntent } from "./pvp-battle-engine";
import type { PortableCardAsset } from "./portable-card";

const GUEST_KEY = "receiz:wilds:multiplayer-guest:v1";

function guestIdentity() {
  try {
    const saved = window.localStorage.getItem(GUEST_KEY);
    if (saved && /^[a-z0-9-]{8,64}$/i.test(saved)) return saved;
    const created = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(GUEST_KEY, created);
    return created;
  } catch {
    return `guest-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }
}

function queryInviteRoom() {
  const room = new URLSearchParams(window.location.search).get("wildsJoin") ?? "";
  return /^invite:[a-f0-9]{16}$/.test(room) ? room : null;
}

async function jsonRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(result?.error ?? "wilds_multiplayer_request_failed");
  return result;
}

export type WildsMultiplayerController = ReturnType<typeof useWildsMultiplayer>;

export function useWildsMultiplayer(input: {
  enabled: boolean;
  style: "female" | "male";
  position: { x: number; z: number };
  activeCard: PortableCardAsset | null;
}) {
  const [guestId, setGuestId] = useState("");
  const [roomOverride, setRoomOverride] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WildsMultiplayerSnapshot | null>(null);
  const [selfId, setSelfId] = useState("");
  const [mode, setMode] = useState<"connecting" | "receiz_live" | "local_practice" | "reconnecting">("connecting");
  const [error, setError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [dismissedBattleIds, setDismissedBattleIds] = useState<Set<string>>(() => new Set());
  const latest = useRef(input);
  latest.current = input;

  useEffect(() => {
    setGuestId(guestIdentity());
    setRoomOverride(queryInviteRoom());
  }, []);

  const roomKey = roomOverride ?? roomKeyForPosition("platform", input.position);

  const heartbeat = useCallback(async () => {
    const current = latest.current;
    if (!current.enabled || !current.activeCard || !guestId) return;
    try {
      const result = await jsonRequest<{
        actor: { playerId: string; practice: boolean };
        snapshot: WildsMultiplayerSnapshot;
        publication: { published: boolean; mode: "receiz_live" | "local_practice" | "receiz_recovery_pending" };
      }>("/api/wilds/multiplayer/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomKey,
          guestId,
          style: current.style,
          x: current.position.x,
          z: current.position.z,
          heading: 0,
          card: current.activeCard
        })
      });
      setSelfId(result.actor.playerId);
      setSnapshot(result.snapshot);
      setMode(result.actor.practice ? "local_practice" : result.publication.published ? "receiz_live" : "reconnecting");
      setError("");
    } catch (cause) {
      setMode("reconnecting");
      setError(cause instanceof Error ? cause.message : "wilds_multiplayer_reconnecting");
    }
  }, [guestId, roomKey]);

  useEffect(() => {
    void heartbeat();
    if (!input.enabled) return;
    const timer = window.setInterval(() => void heartbeat(), 2_000);
    return () => window.clearInterval(timer);
  }, [heartbeat, input.enabled]);

  const refresh = useCallback(async () => {
    if (!input.enabled || !guestId) return;
    try {
      const result = await jsonRequest<{ snapshot: WildsMultiplayerSnapshot }>(`/api/wilds/multiplayer/snapshot?room=${encodeURIComponent(roomKey)}`);
      setSnapshot(result.snapshot);
      if (mode === "reconnecting") setMode("connecting");
      setError("");
    } catch (cause) {
      setMode("reconnecting");
      setError(cause instanceof Error ? cause.message : "wilds_multiplayer_reconnecting");
    }
  }, [guestId, input.enabled, mode, roomKey]);

  useEffect(() => {
    void refresh();
    if (!input.enabled) return;
    const timer = window.setInterval(() => void refresh(), 900);
    return () => window.clearInterval(timer);
  }, [input.enabled, refresh]);

  const post = useCallback(async (path: "message" | "challenge" | "battle", body: Record<string, unknown>) => {
    if (!guestId) throw new Error("wilds_guest_identity_required");
    const result = await jsonRequest<{ snapshot: WildsMultiplayerSnapshot }>(`/api/wilds/multiplayer/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, roomKey, guestId })
    });
    setSnapshot(result.snapshot);
    return result.snapshot;
  }, [guestId, roomKey]);

  const createInviteLink = useCallback(async () => {
    const room = roomKey.startsWith("invite:") ? roomKey : createInviteRoom(selfId || guestId, input.position, input.activeCard?.manifest.variant.kaiPulse ?? new Date().toISOString());
    setRoomOverride(room);
    const url = new URL(window.location.href);
    url.searchParams.set("wildsJoin", room);
    url.searchParams.set("wildsX", String(Math.round(input.position.x * 100) / 100));
    url.searchParams.set("wildsZ", String(Math.round(input.position.z * 100) / 100));
    url.hash = "play";
    window.history.replaceState(window.history.state, "", url);
    await navigator.clipboard.writeText(url.toString());
    return url.toString();
  }, [guestId, input.activeCard, input.position, roomKey, selfId]);

  const remotePlayers = useMemo(() => (snapshot?.players ?? [])
    .filter((player) => player.playerId !== selfId)
    .sort((left, right) => Math.hypot(left.x - input.position.x, left.z - input.position.z) - Math.hypot(right.x - input.position.x, right.z - input.position.z))
    .slice(0, 24), [input.position.x, input.position.z, selfId, snapshot?.players]);
  const selectedPlayer = remotePlayers.find((player) => player.playerId === selectedPlayerId) ?? null;
  const activeBattle = snapshot?.battles.find((battle) => battle.phase === "active" && Boolean(battle.players[selfId]))
    ?? snapshot?.battles.find((battle) => battle.phase === "settled" && Boolean(battle.players[selfId]) && !dismissedBattleIds.has(battle.id))
    ?? null;
  const incomingChallenge = snapshot?.challenges.find((challenge) => challenge.opponentId === selfId && challenge.state === "offered") ?? null;

  return {
    guestId,
    roomKey,
    selfId,
    mode,
    error,
    snapshot,
    remotePlayers,
    selectedPlayer,
    selectedPlayerId,
    selectPlayer: (player: WildsPresence | null) => setSelectedPlayerId(player?.playerId ?? null),
    activeBattle,
    incomingChallenge,
    createInviteLink,
    sendMessage: (text: string) => post("message", { text }),
    offerChallenge: (opponentId: string, mode: "friendly" | "card_stake" | "money_stake" = "friendly") => post("challenge", { action: "offer", opponentId, mode, card: input.activeCard }),
    answerChallenge: (challengeId: string, action: "accept" | "decline") => post("challenge", { action, challengeId, card: input.activeCard }),
    submitIntent: (battleId: string, intent: PvpIntent) => post("battle", { battleId, intent, intentId: `${selfId}:${battleId}:${activeBattle?.turn ?? 0}:${crypto.randomUUID()}` }),
    dismissBattle: (battleId: string) => setDismissedBattleIds((current) => new Set(current).add(battleId)),
    refresh
  };
}
