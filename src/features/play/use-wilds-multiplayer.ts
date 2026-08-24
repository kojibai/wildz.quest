"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInviteRoom, roomKeyForPosition, type WildsPresence } from "./multiplayer-core";
import type { WildsMultiplayerSnapshot } from "./multiplayer-ledger";
import type { PvpIntent } from "./pvp-battle-engine";
import type { PortableCardAsset } from "./portable-card";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import {
  shouldAttemptWildsNetwork,
  isOpaqueWildsNetworkFailure,
  WILDS_NETWORK_RETRY_BACKOFF_MS,
  WILDS_MULTIPLAYER_OFFLINE_MESSAGE,
  wildsNetworkFailureMessage
} from "./wilds-network-status";

const GUEST_KEY = "receiz:wilds:multiplayer-guest:v1";
const WILDS_MULTIPLAYER_HEARTBEAT_MS = 2_500;
const WILDS_GLOBAL_PRESENCE_REFRESH_MS = 1_000;

function samePresence(left: WildsPresence[], right: WildsPresence[]) {
  if (left.length !== right.length) return false;
  return left.every((player, index) => {
    const candidate = right[index];
    return Boolean(candidate
      && player.playerId === candidate.playerId
      && player.x === candidate.x
      && player.z === candidate.z
      && player.status === candidate.status
      && player.activeCard.proofDigest === candidate.activeCard.proofDigest);
  });
}

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
  if (!shouldAttemptWildsNetwork()) throw new Error(WILDS_MULTIPLAYER_OFFLINE_MESSAGE);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new TypeError(wildsNetworkFailureMessage(cause, "multiplayer"));
  }
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(result?.error ?? "wilds_multiplayer_request_failed");
  return result;
}

export type WildsMultiplayerController = ReturnType<typeof useWildsMultiplayer>;

export function buildWildsMultiplayerHeartbeatBody(input: {
  roomKey: string;
  guestId: string;
  style: "female" | "male";
  x: number;
  z: number;
  heading: number;
  card: PortableCardAsset;
  cardAdmission: WildzVaultCardMembershipProof | null;
}, cardAlreadyAdmitted: boolean) {
  return {
    roomKey: input.roomKey,
    guestId: input.guestId,
    style: input.style,
    x: input.x,
    z: input.z,
    heading: input.heading,
    ...(cardAlreadyAdmitted ? {
      cardRef: { assetId: input.card.id, proofDigest: input.card.proof.digest }
    } : {
      card: input.card,
      ...(input.cardAdmission ? { cardAdmission: input.cardAdmission } : {})
    })
  };
}

export function useWildsMultiplayer(input: {
  enabled: boolean;
  surfaceOpen: boolean;
  style: "female" | "male";
  position: { x: number; z: number };
  activeCard: PortableCardAsset | null;
  cardAdmission: WildzVaultCardMembershipProof | null;
}) {
  const [guestId, setGuestId] = useState("");
  const [roomOverride, setRoomOverride] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WildsMultiplayerSnapshot | null>(null);
  const [globalPlayers, setGlobalPlayers] = useState<WildsPresence[]>([]);
  const [selfId, setSelfId] = useState("");
  const [mode, setMode] = useState<"connecting" | "receiz_live" | "local_practice" | "reconnecting">("connecting");
  const [error, setError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [dismissedBattleIds, setDismissedBattleIds] = useState<Set<string>>(() => new Set());
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const latest = useRef(input);
  const retryAfter = useRef(0);
  const admittedHeartbeatCards = useRef(new Set<string>());
  latest.current = input;

  useEffect(() => {
    setGuestId(guestIdentity());
    setRoomOverride(queryInviteRoom());
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const roomKey = roomOverride ?? roomKeyForPosition("platform", input.position);

  const heartbeat = useCallback(async () => {
    const current = latest.current;
    if (!current.enabled || document.visibilityState !== "visible" || !current.activeCard || !guestId) return;
    const activeCard = current.activeCard;
    if (!shouldAttemptWildsNetwork()) {
      setMode("reconnecting");
      setError(WILDS_MULTIPLAYER_OFFLINE_MESSAGE);
      return;
    }
    if (Date.now() < retryAfter.current) return;
    const admissionPin = `${guestId}:${activeCard.id}:${activeCard.proof.digest}`;
    try {
      const sendHeartbeat = (cardAlreadyAdmitted: boolean) => jsonRequest<{
        actor: { playerId: string; practice: boolean };
        snapshot: WildsMultiplayerSnapshot;
        publication: { published: boolean; mode: "receiz_live" | "local_practice" | "receiz_recovery_pending" };
      }>("/api/wilds/multiplayer/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildWildsMultiplayerHeartbeatBody({
          roomKey,
          guestId,
          style: current.style,
          x: current.position.x,
          z: current.position.z,
          heading: 0,
          card: activeCard,
          cardAdmission: current.cardAdmission
        }, cardAlreadyAdmitted))
      });
      const compactHeartbeat = admittedHeartbeatCards.current.has(admissionPin);
      let result: Awaited<ReturnType<typeof sendHeartbeat>>;
      try {
        result = await sendHeartbeat(compactHeartbeat);
      } catch (cause) {
        if (!compactHeartbeat
          || !(cause instanceof Error)
          || cause.message !== "wilds_multiplayer_card_required") throw cause;
        // Serverless instances do not share the compact admission cache. Heal a
        // cold-instance miss immediately with the full verified card and never
        // surface this expected protocol retry as a connection failure.
        admittedHeartbeatCards.current.delete(admissionPin);
        result = await sendHeartbeat(false);
      }
      admittedHeartbeatCards.current.add(admissionPin);
      setSelfId(result.actor.playerId);
      const requiresAttention = result.snapshot.challenges.some((challenge) => (
        challenge.opponentId === result.actor.playerId && challenge.state === "offered"
      )) || result.snapshot.battles.some((battle) => (
        Boolean(battle.players[result.actor.playerId]) && battle.phase !== "settled"
      ));
      // The global atlas owns passive world discovery. Keep room detail only
      // while its UI is open or an incoming interaction needs attention, so a
      // routine self-heartbeat cannot rerender the game every 2.5 seconds.
      if (current.surfaceOpen || requiresAttention) {
        setSnapshot((prior) => prior?.revision === result.snapshot.revision ? prior : result.snapshot);
      }
      // A server-accepted heartbeat is shared internet presence. Publication
      // controls durability; it does not decide whether other players see it.
      setMode("receiz_live");
      setError("");
      retryAfter.current = 0;
    } catch (cause) {
      if (cause instanceof Error && cause.message === "wilds_multiplayer_card_required") admittedHeartbeatCards.current.delete(admissionPin);
      const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
      if (opaqueFailure) retryAfter.current = Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS;
      const offline = !shouldAttemptWildsNetwork() || opaqueFailure;
      setMode("reconnecting");
      setError(wildsNetworkFailureMessage(cause, "multiplayer", !offline));
    }
  }, [guestId, roomKey]);

  useEffect(() => {
    if (!input.enabled || !pageVisible) return;
    let stopped = false;
    let timer: number | null = null;
    const tickHeartbeat = () => {
      if (stopped) return;
      void heartbeat().finally(() => {
        if (!stopped) timer = window.setTimeout(tickHeartbeat, WILDS_MULTIPLAYER_HEARTBEAT_MS);
      });
    };
    tickHeartbeat();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [heartbeat, input.enabled, pageVisible]);

  const refresh = useCallback(async () => {
    if (!input.enabled || !guestId) return;
    if (!shouldAttemptWildsNetwork()) {
      setMode("reconnecting");
      setError(WILDS_MULTIPLAYER_OFFLINE_MESSAGE);
      return;
    }
    if (Date.now() < retryAfter.current) return;
    try {
      const result = await jsonRequest<{ snapshot: WildsMultiplayerSnapshot }>(`/api/wilds/multiplayer/snapshot?room=${encodeURIComponent(roomKey)}`);
      setSnapshot((current) => current?.revision === result.snapshot.revision ? current : result.snapshot);
      if (mode === "reconnecting") setMode("connecting");
      setError("");
      retryAfter.current = 0;
    } catch (cause) {
      const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
      if (opaqueFailure) retryAfter.current = Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS;
      const offline = !shouldAttemptWildsNetwork() || opaqueFailure;
      setMode("reconnecting");
      setError(wildsNetworkFailureMessage(cause, "multiplayer", !offline));
    }
  }, [guestId, input.enabled, mode, roomKey]);

  useEffect(() => {
    const resume = () => {
      if (!latest.current.enabled || document.visibilityState !== "visible") return;
      retryAfter.current = 0;
      void heartbeat();
      void refresh();
    };
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [heartbeat, refresh]);

  const refreshGlobalPresence = useCallback(async () => {
    if (!latest.current.enabled || document.visibilityState !== "visible" || !guestId || !shouldAttemptWildsNetwork()) return;
    const current = latest.current;
    try {
      const params = new URLSearchParams({
        x: String(current.position.x),
        z: String(current.position.z),
        guestId
      });
      const result = await jsonRequest<{ players: WildsPresence[] }>(`/api/wilds/atlas?${params.toString()}`, { cache: "no-store" });
      const players = result.players ?? [];
      setGlobalPlayers((currentPlayers) => samePresence(currentPlayers, players) ? currentPlayers : players);
    } catch {
      // Retain the last short-lived atlas projection until the next heartbeat.
      // Server-side TTL enforcement prevents stale players from reappearing.
    }
  }, [guestId]);

  useEffect(() => {
    if (!input.enabled || !pageVisible) return;
    let stopped = false;
    let timer: number | null = null;
    const tickPresence = () => {
      if (stopped) return;
      void refreshGlobalPresence().finally(() => {
        if (!stopped) timer = window.setTimeout(tickPresence, WILDS_GLOBAL_PRESENCE_REFRESH_MS);
      });
    };
    tickPresence();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [input.enabled, pageVisible, refreshGlobalPresence]);

  useEffect(() => {
    if (!input.surfaceOpen || !pageVisible) return;
    // Opening the room surface requests its exact interaction state without
    // controlling whether the player exists in the living world.
    void refresh();
  }, [input.surfaceOpen, pageVisible, refresh]);

  const post = useCallback(async (path: "message" | "challenge" | "battle", body: Record<string, unknown>) => {
    try {
      if (!latest.current.enabled) throw new Error("wilds_multiplayer_session_required");
      if (!guestId) throw new Error("wilds_guest_identity_required");
      const result = await jsonRequest<{ snapshot: WildsMultiplayerSnapshot }>(`/api/wilds/multiplayer/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, roomKey, guestId })
      });
      setSnapshot((current) => current?.revision === result.snapshot.revision ? current : result.snapshot);
      return result.snapshot;
    } catch (cause) {
      throw new Error(wildsNetworkFailureMessage(cause, "multiplayer"));
    }
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
    return url.toString();
  }, [guestId, input.activeCard, input.position, roomKey, selfId]);

  const remotePlayers = useMemo(() => {
    const newestByPlayer = new Map<string, WildsPresence>();
    const roomPlayers = input.surfaceOpen ? snapshot?.players ?? [] : [];
    for (const player of [...roomPlayers, ...globalPlayers]) {
      const current = newestByPlayer.get(player.playerId);
      if (!current || Date.parse(player.lastSeenAt) > Date.parse(current.lastSeenAt)) newestByPlayer.set(player.playerId, player);
    }
    return [...newestByPlayer.values()]
    .filter((player) => player.playerId !== selfId && player.status !== "private")
    .sort((left, right) => Math.hypot(left.x - input.position.x, left.z - input.position.z) - Math.hypot(right.x - input.position.x, right.z - input.position.z))
  }, [globalPlayers, input.position.x, input.position.z, input.surfaceOpen, selfId, snapshot?.players]);
  const selectedPlayer = remotePlayers.find((player) => player.playerId === selectedPlayerId) ?? null;
  const selectPlayer = useCallback((player: WildsPresence | null) => setSelectedPlayerId(player?.playerId ?? null), []);
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
    selectPlayer,
    activeBattle,
    incomingChallenge,
    createInviteLink,
    sendMessage: (text: string) => post("message", { text }),
    offerChallenge: (opponentId: string, mode: "friendly" | "card_stake" | "money_stake" = "friendly") => post("challenge", { action: "offer", opponentId, mode, card: input.activeCard, cardAdmission: input.cardAdmission }),
    answerChallenge: (challengeId: string, action: "accept" | "decline") => post("challenge", { action, challengeId, card: input.activeCard, cardAdmission: input.cardAdmission }),
    submitIntent: (battleId: string, intent: PvpIntent) => post("battle", { battleId, intent, intentId: `${selfId}:${battleId}:${activeBattle?.turn ?? 0}:${crypto.randomUUID()}` }),
    dismissBattle: (battleId: string) => setDismissedBattleIds((current) => new Set(current).add(battleId)),
    refresh
  };
}
