import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import type { PortableCardAsset } from "./portable-card";
import type { WildsCrewExpedition } from "./wilds-crew-expedition";
import type { WildsCrewTravelEntry } from "./wilds-crew-travel-runtime";

export type WildsCrewMapSource = {
  owner: string;
  cards: readonly PortableCardAsset[];
  expeditions: ReadonlyMap<string, WildsCrewExpedition>;
  runtime: ReadonlyMap<string, WildsCrewTravelEntry>;
};
export type WildsCrewMapMarker = {
  assetId: string;
  name: string;
  position: { x: number; z: number };
  status: "Roaming" | "Observing" | "Returning" | "Blocked" | "Return blocked" | "Paused" | "Return paused";
  returning: boolean;
};

/** Owner/proof-bound physical positions, independent of the selected companion slots.
 * Never substitute a route destination for a creature's actual location. */
export function projectWildsCrewMap(source?: WildsCrewMapSource): WildsCrewMapMarker[] {
  if (!source?.owner) return [];
  const markers: WildsCrewMapMarker[] = [];
  const seen = new Set<string>();
  for (const card of source.cards) {
    if (seen.has(card.id) || !sameWildzPlayerCoordinate(card.manifest.ownerReceizId, source.owner)) continue;
    seen.add(card.id);
    const row = source.expeditions.get(card.id);
    if (!row || row.phase === "completed" || row.assetId !== card.id || row.proofDigest !== card.proof.digest
      || !sameWildzPlayerCoordinate(row.ownerReceizId, source.owner)) continue;
    const candidate = source.runtime.get(card.id);
    const live = candidate?.proofDigest === card.proof.digest ? candidate : undefined;
    const position = live?.position ?? row.actualPosition;
    const spaceId = live?.position ? live.spaceId : row.actualSpaceId;
    if (spaceId !== "wildz.space.outer.v1" || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) continue;
    const returning = row.phase === "returning" || row.recallRequested;
    const status = row.phase === "blocked" || live?.blocked ? (returning ? "Return blocked" : "Blocked")
      : live?.paused ? (returning ? "Return paused" : "Paused")
      : returning ? "Returning" : row.phase === "observing" ? "Observing" : "Roaming";
    markers.push({ assetId: card.id, name: card.manifest.name, position: { x: position.x, z: position.z }, status, returning });
  }
  return markers;
}

/** Keep distant travelers visible at the minimap rim without changing its scale. */
export function projectWildsCrewMinimapPoint(position: { x: number; z: number }, center: { x: number; z: number }, size = 180, radius = 22) {
  const dx = (position.x - center.x) / radius * size / 2;
  const dz = (position.z - center.z) / radius * size / 2;
  const distance = Math.hypot(dx, dz);
  const scale = distance > size / 2 - 8 ? (size / 2 - 8) / distance : 1;
  return { x: size / 2 + dx * scale, y: size / 2 + dz * scale, distant: scale < 1 };
}
