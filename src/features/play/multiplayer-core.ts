import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { PvpCard } from "./pvp-battle-engine";

export const WILDS_REGION_SIZE = 48;
export const WILDS_PRESENCE_TTL_MS = 15_000;
export const WILDS_INTERACTION_DISTANCE = 10;

export type WildsPresence = {
  playerId: string;
  handle: string;
  style: "female" | "male";
  x: number;
  z: number;
  heading: number;
  status: "available" | "busy" | "private" | "reconnecting";
  lastSeenAt: string;
  practice: boolean;
  activeCard: PvpCard;
};

export type WildsRoomMessage = {
  id: string;
  roomKey: string;
  senderId: string;
  senderHandle: string;
  text: string;
  sentAt: string;
};

export function regionForPosition(position: { x: number; z: number }) {
  return { x: Math.floor(position.x / WILDS_REGION_SIZE), z: Math.floor(position.z / WILDS_REGION_SIZE) };
}

export function roomKeyForPosition(tenant: string, position: { x: number; z: number }) {
  const region = regionForPosition(position);
  return `wilds:${tenant}:${region.x}:${region.z}`;
}

export function createInviteRoom(playerId: string, position: { x: number; z: number }, kaiPulse: string) {
  return `invite:${sha256PortableBasis(canonicalPortableCardJson({ playerId, position, kaiPulse })).slice(7, 23)}`;
}

export function expirePresence(players: WildsPresence[], now = Date.now()) {
  return players.filter((player) => now - Date.parse(player.lastSeenAt) <= WILDS_PRESENCE_TTL_MS);
}

export function presenceDistance(player: Pick<WildsPresence, "x" | "z">, position: { x: number; z: number }) {
  return Math.hypot(player.x - position.x, player.z - position.z);
}

export function visiblePresence(players: WildsPresence[], position: { x: number; z: number }, selfId: string, now = Date.now()) {
  const ownRegion = regionForPosition(position);
  return expirePresence(players, now)
    .filter((player) => player.playerId !== selfId)
    .filter((player) => {
      const region = regionForPosition(player);
      return Math.abs(region.x - ownRegion.x) <= 1 && Math.abs(region.z - ownRegion.z) <= 1;
    })
    .sort((left, right) => presenceDistance(left, position) - presenceDistance(right, position))
    .slice(0, 24);
}

export function canInteractWithPresence(player: WildsPresence, position: { x: number; z: number }, now = Date.now()) {
  return now - Date.parse(player.lastSeenAt) <= WILDS_PRESENCE_TTL_MS
    && player.status === "available"
    && presenceDistance(player, position) <= WILDS_INTERACTION_DISTANCE;
}

export function validatePresenceMove(
  previous: { x: number; z: number; at: string } | null,
  next: { x: number; z: number; at: string }
) {
  if (![next.x, next.z].every(Number.isFinite) || Math.abs(next.x) > 1_000_000 || Math.abs(next.z) > 1_000_000) {
    return { ok: false as const, error: "wilds_presence_position_invalid" };
  }
  if (!previous) return { ok: true as const };
  const elapsedSeconds = Math.max(0.25, (Date.parse(next.at) - Date.parse(previous.at)) / 1_000);
  const distance = Math.hypot(next.x - previous.x, next.z - previous.z);
  if (distance / elapsedSeconds > 12) return { ok: false as const, error: "wilds_presence_teleport_rejected" };
  return { ok: true as const };
}

export function sanitizeWildsMessage(input: string) {
  const text = input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) throw new Error("wilds_message_empty");
  if (text.length > 280) throw new Error("wilds_message_too_long");
  if (/https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:discord|telegram|whatsapp|snapchat)\b/i.test(text)) {
    throw new Error("wilds_message_contact_blocked");
  }
  return text;
}
