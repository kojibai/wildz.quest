import type { WildzVaultCardMembershipProof } from "../../lib/receiz/wildz-vault-card-admission";
import type { PortableCardAsset } from "./portable-card";
import { expirePresence, type WildsPresence } from "./multiplayer-core";
import { projectWildsCrewMap, type WildsCrewMapMarker, type WildsCrewMapSource } from "./wilds-crew-map";

export const WILDS_ROAMING_PRESENCE_LIMIT = 32;
export const WILDS_ROAMING_MARKER_LIMIT = 256;
export type WildsRoamingCreaturePresence = Readonly<{
  assetId: string; proofDigest: string; name: string;
  ownerId: string; ownerHandle: string;
  x: number; z: number;
  phase: "roaming" | "observing" | "returning" | "blocked" | "paused";
  returning: boolean;
}>;
export type WildsRoamingPresenceUpload = Pick<WildsRoamingCreaturePresence, "x" | "z" | "phase" | "returning"> & { card: PortableCardAsset; cardAdmission?: WildzVaultCardMembershipProof };

/** Public store rows are transport input. Rebuild the allowlisted DTO before use. */
export function sanitizeWildsRoamingPresence(player: Pick<WildsPresence, "playerId" | "handle" | "practice" | "status">, value: unknown): WildsRoamingCreaturePresence[] {
  if (player.practice || player.status === "private" || !Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, WILDS_ROAMING_PRESENCE_LIMIT).flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.assetId !== "string" || !item.assetId || item.assetId.length > 256
      || typeof item.proofDigest !== "string" || !item.proofDigest || item.proofDigest.length > 256
      || typeof item.name !== "string" || item.name.length > 120 || item.ownerId !== player.playerId
      || typeof item.x !== "number" || typeof item.z !== "number" || !Number.isFinite(item.x) || !Number.isFinite(item.z)
      || Math.abs(item.x) > 1_000_000 || Math.abs(item.z) > 1_000_000 || typeof item.returning !== "boolean"
      || !["roaming", "observing", "returning", "blocked", "paused"].includes(item.phase) || seen.has(item.assetId)) return [];
    seen.add(item.assetId);
    return [{ assetId: item.assetId, proofDigest: item.proofDigest, name: item.name, ownerId: player.playerId,
      ownerHandle: player.handle, x: item.x, z: item.z, phase: item.phase, returning: item.returning }];
  });
}

/** Read current physical anchors only when the existing presence heartbeat runs. */
export function buildWildsRoamingPresenceUploads(source?: WildsCrewMapSource, admissionForCard?: (card: PortableCardAsset) => WildzVaultCardMembershipProof | null): WildsRoamingPresenceUpload[] {
  if (!source) return [];
  const cards = new Map(source.cards.map(card => [card.id, card]));
  return projectWildsCrewMap(source).slice(0, WILDS_ROAMING_PRESENCE_LIMIT).flatMap(marker => {
    const card = cards.get(marker.assetId);
    if (!card) return [];
    const phase = marker.status.includes("blocked") || marker.status === "Blocked" ? "blocked"
      : marker.status.includes("paused") || marker.status === "Paused" ? "paused"
      : marker.returning ? "returning" : marker.status === "Observing" ? "observing" : "roaming";
    const cardAdmission = admissionForCard?.(card);
    return [{ card, ...(cardAdmission ? { cardAdmission } : {}), ...marker.position, phase, returning: marker.returning }];
  });
}

/** Public discovery only. Ownership/capture admission must reverify exact sources. */
export function projectWildsRemoteRoamingMarkers(players: readonly WildsPresence[], selfId: string, now = Date.now()): WildsCrewMapMarker[] {
  const markers: WildsCrewMapMarker[] = [];
  const seen = new Set<string>();
  for (const player of expirePresence([...players], now)) {
    if (player.playerId === selfId || player.practice || player.status === "private") continue;
    for (const creature of sanitizeWildsRoamingPresence(player, player.roamingCreatures)) {
      const key = `${player.playerId}:${creature.assetId}`;
      if (seen.has(key) || creature.ownerId !== player.playerId || !Number.isFinite(creature.x) || !Number.isFinite(creature.z)) continue;
      seen.add(key);
      markers.push({ assetId: creature.assetId, name: creature.name, ownerId: player.playerId, ownerHandle: player.handle,
        proofDigest: creature.proofDigest, remote: true, position: { x: creature.x, z: creature.z }, returning: creature.returning,
        status: creature.phase === "blocked" ? creature.returning ? "Return blocked" : "Blocked"
          : creature.phase === "paused" ? creature.returning ? "Return paused" : "Paused"
          : creature.returning ? "Returning" : creature.phase === "observing" ? "Observing" : "Roaming" });
      if (markers.length >= WILDS_ROAMING_MARKER_LIMIT) return markers;
    }
  }
  return markers;
}
