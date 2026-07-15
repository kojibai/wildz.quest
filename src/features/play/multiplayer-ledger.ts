import {
  acceptChallenge,
  cancelChallenge,
  createFriendlyChallenge,
  declineChallenge,
  type WildsChallenge
} from "./multiplayer-challenge";
import {
  expirePresence,
  presenceDistance,
  regionForPosition,
  sanitizeWildsMessage,
  validatePresenceMove,
  WILDS_INTERACTION_DISTANCE,
  WILDS_REGION_SIZE,
  type WildsPresence,
  type WildsRoomMessage
} from "./multiplayer-core";
import { createPvpBattle, submitPvpIntent, type PvpBattle, type PvpCard, type PvpIntent } from "./pvp-battle-engine";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type WildsMultiplayerRoom = {
  schema: "receiz.wilds_multiplayer_room.v1";
  roomKey: string;
  revision: number;
  updatedAt: string;
  players: WildsPresence[];
  messages: WildsRoomMessage[];
  challenges: WildsChallenge[];
  battles: PvpBattle[];
};

export type WildsMultiplayerSnapshot = WildsMultiplayerRoom & {
  capabilities: {
    friendlyBattle: true;
    cardStake: false;
    moneyStake: false;
    reason: "receiz_atomic_asset_exchange_required";
  };
};

const ledgerKey = Symbol.for("receiz.wilds.multiplayer-ledger.v1");

function rooms() {
  const root = globalThis as typeof globalThis & { [ledgerKey]?: Map<string, WildsMultiplayerRoom> };
  return (root[ledgerKey] ??= new Map());
}

function emptyRoom(roomKey: string, now: string): WildsMultiplayerRoom {
  return {
    schema: "receiz.wilds_multiplayer_room.v1",
    roomKey,
    revision: 0,
    updatedAt: now,
    players: [],
    messages: [],
    challenges: [],
    battles: []
  };
}

function cleanRoom(room: WildsMultiplayerRoom, now: string): WildsMultiplayerRoom {
  const nowMs = Date.parse(now);
  return {
    ...room,
    players: expirePresence(room.players, nowMs),
    messages: room.messages.slice(-50),
    challenges: room.challenges
      .map((challenge) => challenge.state === "offered" && Date.parse(challenge.expiresAt) < nowMs
        ? { ...challenge, state: "expired" as const, closedAt: now, revision: challenge.revision + 1 }
        : challenge)
      .slice(-20),
    battles: room.battles.slice(-12)
  };
}

function save(room: WildsMultiplayerRoom, now: string) {
  const next = cleanRoom({ ...room, revision: room.revision + 1, updatedAt: now }, now);
  rooms().set(room.roomKey, next);
  return next;
}

function snapshot(room: WildsMultiplayerRoom): WildsMultiplayerSnapshot {
  return {
    ...room,
    capabilities: {
      friendlyBattle: true,
      cardStake: false,
      moneyStake: false,
      reason: "receiz_atomic_asset_exchange_required"
    }
  };
}

export function admitWildsMultiplayerRoom(value: WildsMultiplayerRoom) {
  if (value.schema !== "receiz.wilds_multiplayer_room.v1" || !value.roomKey || !Number.isInteger(value.revision)) {
    throw new Error("wilds_multiplayer_room_invalid");
  }
  const current = rooms().get(value.roomKey);
  if (!current || value.revision > current.revision) rooms().set(value.roomKey, value);
  return rooms().get(value.roomKey)!;
}

export function getWildsMultiplayerSnapshot(roomKey: string, now = new Date().toISOString()) {
  const current = cleanRoom(rooms().get(roomKey) ?? emptyRoom(roomKey, now), now);
  rooms().set(roomKey, current);
  return snapshot(current);
}

export function getWildsAtlasPresence(input: {
  actorId: string;
  center: { x: number; z: number };
  now?: number;
  maxClusters?: number;
}) {
  const now = input.now ?? Date.now();
  const nowIso = new Date(now).toISOString();
  const newestByPlayer = new Map<string, WildsPresence>();
  for (const stored of rooms().values()) {
    for (const player of cleanRoom(stored, nowIso).players) {
      const current = newestByPlayer.get(player.playerId);
      if (!current || Date.parse(player.lastSeenAt) > Date.parse(current.lastSeenAt)) {
        newestByPlayer.set(player.playerId, player);
      }
    }
  }
  const players = [...newestByPlayer.values()]
    .filter((player) => player.playerId !== input.actorId)
    .sort((left, right) => presenceDistance(left, input.center) - presenceDistance(right, input.center));
  const visiblePlayers = players
    .filter((player) => player.status !== "private")
    .map(({ playerId, handle, style, x, z, status }) => ({ playerId, handle, style, x, z, status }));
  const visibleIds = new Set(visiblePlayers.map((player) => player.playerId));
  const clusters = new Map<string, {
    id: string;
    regionX: number;
    regionZ: number;
    count: number;
    position: { x: number; z: number };
  }>();
  for (const player of players) {
    if (visibleIds.has(player.playerId)) continue;
    const region = regionForPosition(player);
    const id = `cluster:${region.x}:${region.z}`;
    const existing = clusters.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      clusters.set(id, {
        id,
        regionX: region.x,
        regionZ: region.z,
        count: 1,
        position: {
          x: region.x * WILDS_REGION_SIZE + WILDS_REGION_SIZE / 2,
          z: region.z * WILDS_REGION_SIZE + WILDS_REGION_SIZE / 2
        }
      });
    }
  }
  const maxClusters = Math.max(1, Math.min(64, Math.floor(input.maxClusters ?? 64)));
  return {
    players: visiblePlayers,
    clusters: [...clusters.values()]
      .sort((left, right) => (
        Math.hypot(left.position.x - input.center.x, left.position.z - input.center.z)
        - Math.hypot(right.position.x - input.center.x, right.position.z - input.center.z)
      ))
      .slice(0, maxClusters)
  };
}

export function heartbeatWildsPresence(input: {
  roomKey: string;
  playerId: string;
  handle: string;
  style: "female" | "male";
  x: number;
  z: number;
  heading: number;
  practice: boolean;
  activeCard: PvpCard;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const room = getWildsMultiplayerSnapshot(input.roomKey, now);
  const previous = room.players.find((player) => player.playerId === input.playerId);
  const movement = validatePresenceMove(previous ? { x: previous.x, z: previous.z, at: previous.lastSeenAt } : null, { x: input.x, z: input.z, at: now });
  if (!movement.ok) throw new Error(movement.error);
  const presence: WildsPresence = {
    playerId: input.playerId,
    handle: input.handle,
    style: input.style,
    x: input.x,
    z: input.z,
    heading: Number.isFinite(input.heading) ? input.heading : 0,
    status: room.battles.some((battle) => battle.phase === "active" && battle.players[input.playerId]) ? "busy" : "available",
    lastSeenAt: now,
    practice: input.practice,
    activeCard: input.activeCard
  };
  const players = [...room.players.filter((player) => player.playerId !== input.playerId), presence];
  const saved = save({ ...room, players, capabilities: undefined } as unknown as WildsMultiplayerRoom, now);
  return { self: presence, snapshot: snapshot(saved) };
}

export function applyAuthorizedRiftPresence(input: {
  roomKey: string;
  playerId: string;
  destination: { x: number; z: number };
  kaiPulse: string;
  now?: string;
}) {
  if (!/^\d{1,32}$/.test(input.kaiPulse)) throw new Error("wilds_rift_grant_invalid");
  const now = input.now ?? new Date().toISOString();
  const room = getWildsMultiplayerSnapshot(input.roomKey, now);
  const current = room.players.find((player) => player.playerId === input.playerId);
  if (!current) return room;
  const players = room.players.map((player) => player.playerId === input.playerId ? {
    ...player,
    x: input.destination.x,
    z: input.destination.z,
    lastSeenAt: now
  } : player);
  return snapshot(save({ ...room, players, capabilities: undefined } as unknown as WildsMultiplayerRoom, now));
}

function roomOrThrow(roomKey: string) {
  return getWildsMultiplayerSnapshot(roomKey);
}

function assertParticipantAvailable(room: WildsMultiplayerRoom, playerId: string) {
  if (room.challenges.some((challenge) => ["accepted", "active"].includes(challenge.state) && [challenge.challengerId, challenge.opponentId].includes(playerId))) {
    throw new Error("wilds_challenge_player_busy");
  }
}

export function addWildsRoomMessage(input: { roomKey: string; actorId: string; text: string; now?: string }) {
  const now = input.now ?? new Date().toISOString();
  const room = roomOrThrow(input.roomKey);
  const sender = room.players.find((player) => player.playerId === input.actorId);
  if (!sender) throw new Error("wilds_presence_required");
  const recent = room.messages.filter((message) => message.senderId === input.actorId && Date.parse(now) - Date.parse(message.sentAt) <= 10_000);
  if (recent.length >= 6) throw new Error("wilds_message_rate_limited");
  const text = sanitizeWildsMessage(input.text);
  const id = `message:${sha256PortableBasis(canonicalPortableCardJson({ actorId: input.actorId, text, now })).slice(7, 31)}`;
  const message: WildsRoomMessage = { id, roomKey: input.roomKey, senderId: input.actorId, senderHandle: sender.handle, text, sentAt: now };
  return { message, snapshot: snapshot(save({ ...room, messages: [...room.messages, message], capabilities: undefined } as unknown as WildsMultiplayerRoom, now)) };
}

export function mutateWildsChallenge(input: {
  roomKey: string;
  actorId: string;
  action: "offer" | "accept" | "decline" | "cancel";
  opponentId?: string;
  challengeId?: string;
  card: PvpCard;
  mode?: "friendly" | "card_stake" | "money_stake";
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const room = roomOrThrow(input.roomKey);
  if (input.mode && input.mode !== "friendly") throw new Error(input.mode === "card_stake" ? "wilds_card_stakes_capability_locked" : "wilds_money_stakes_compliance_locked");
  let challenge: WildsChallenge;
  let challenges = room.challenges;
  let battles = room.battles;
  if (input.action === "offer") {
    if (!input.opponentId || !room.players.some((player) => player.playerId === input.opponentId)) throw new Error("wilds_challenge_opponent_unavailable");
    assertParticipantAvailable(room, input.actorId);
    assertParticipantAvailable(room, input.opponentId);
    challenge = createFriendlyChallenge({
      id: `challenge:${sha256PortableBasis(canonicalPortableCardJson({ roomKey: input.roomKey, actorId: input.actorId, opponentId: input.opponentId, now })).slice(7, 31)}`,
      roomKey: input.roomKey,
      challengerId: input.actorId,
      opponentId: input.opponentId,
      challengerCard: input.card,
      offeredAt: now
    });
    challenges = [...challenges, challenge];
  } else {
    const current = challenges.find((candidate) => candidate.id === input.challengeId);
    if (!current) throw new Error("wilds_challenge_not_found");
    challenge = input.action === "accept"
      ? acceptChallenge(current, input.actorId, input.card, now)
      : input.action === "decline"
        ? declineChallenge(current, input.actorId, now)
        : cancelChallenge(current, input.actorId, now);
    if (challenge.state === "accepted") {
      const battle = createPvpBattle({
        challengeId: challenge.id,
        playerA: { playerId: challenge.challengerId, card: challenge.challengerCard },
        playerB: { playerId: challenge.opponentId, card: challenge.opponentCard! },
        acceptedAt: now
      });
      challenge = { ...challenge, state: "active", revision: challenge.revision + 1 };
      battles = [...battles, battle];
    }
    challenges = challenges.map((candidate) => candidate.id === challenge.id ? challenge : candidate);
  }
  const saved = save({ ...room, challenges, battles, capabilities: undefined } as unknown as WildsMultiplayerRoom, now);
  return { challenge, snapshot: snapshot(saved) };
}

export function submitWildsBattleIntent(input: {
  roomKey: string;
  actorId: string;
  battleId: string;
  intent: PvpIntent;
  intentId: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const room = roomOrThrow(input.roomKey);
  const current = room.battles.find((battle) => battle.id === input.battleId);
  if (!current) throw new Error("wilds_pvp_not_found");
  const battle = submitPvpIntent(current, input.actorId, input.intent, input.intentId);
  const battles = room.battles.map((candidate) => candidate.id === battle.id ? battle : candidate);
  const challenges = battle.phase === "settled"
    ? room.challenges.map((challenge) => challenge.id === battle.challengeId ? { ...challenge, state: "settled" as const, closedAt: now, revision: challenge.revision + 1 } : challenge)
    : room.challenges;
  const saved = save({ ...room, battles, challenges, capabilities: undefined } as unknown as WildsMultiplayerRoom, now);
  return { battle, snapshot: snapshot(saved) };
}
