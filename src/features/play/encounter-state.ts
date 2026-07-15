import type { HotspotCover, HotspotSearchResult } from "./hidden-hotspots";

export type EncounterPhase = "idle" | "searching" | "hint" | "battle_intro" | "player_turn" | "capture_ready" | "fled" | "defeated" | "emerging" | "capsule" | "sealed" | "revealed";
export type SearchProximity = "cold" | "warm" | "hot";
export type SearchTrend = "closer" | "farther" | "steady" | null;

export type IdleEncounterState = { phase: "idle" };

export type ActiveEncounterState = {
  phase: Exclude<EncounterPhase, "idle">;
  searchedAt: string;
  searchPoint: { x: number; z: number };
  ownerReceizId: string;
  hotspotId?: string;
  familyId?: string;
  formId?: string;
  cover?: HotspotCover;
  direction?: { x: number; z: number };
  distance?: number;
  proximity: SearchProximity;
  trend: SearchTrend;
  assetId?: string;
};

export type EncounterState = IdleEncounterState | ActiveEncounterState;

export const idleEncounterState: IdleEncounterState = { phase: "idle" };

export function encounterFromSearch(
  result: HotspotSearchResult,
  searchPoint: { x: number; z: number },
  searchedAt: string,
  ownerReceizId: string,
  previous?: EncounterState
): ActiveEncounterState {
  const distance = result.kind === "empty" ? undefined : result.distance;
  const proximity: SearchProximity = distance === undefined ? "cold" : distance <= 2.25 ? "hot" : "warm";
  const hotspotId = result.kind === "empty" ? undefined : result.hotspot.id;
  const previousActive = previous?.phase === "idle" ? undefined : previous;
  let trend: SearchTrend = null;
  if (previousActive && previousActive.hotspotId === hotspotId && previousActive.distance !== undefined && distance !== undefined) {
    trend = distance < previousActive.distance - 0.15
      ? "closer"
      : distance > previousActive.distance + 0.15 ? "farther" : "steady";
  }
  const shared = { searchedAt, searchPoint: { ...searchPoint }, ownerReceizId, proximity, trend };
  if (result.kind === "empty") return { phase: "searching", ...shared };
  const hotspot = {
    hotspotId: result.hotspot.id,
    familyId: result.hotspot.familyId,
    formId: result.hotspot.formId,
    cover: result.hotspot.cover,
    distance: result.distance
  };
  if (result.kind === "hit") return { phase: "battle_intro", ...shared, ...hotspot };
  if (result.kind === "near_miss") return { phase: "hint", ...shared, ...hotspot, direction: { ...result.direction } };
  return { phase: "hint", ...shared, ...hotspot };
}

export function isCapturableEncounter(
  encounter: EncounterState
): encounter is ActiveEncounterState & Required<Pick<ActiveEncounterState, "hotspotId" | "familyId" | "formId" | "cover">> {
  return (
    encounter.phase !== "idle" &&
    (encounter.phase === "emerging" || encounter.phase === "capsule" || encounter.phase === "sealed" || encounter.phase === "revealed") &&
    Boolean(encounter.hotspotId && encounter.familyId && encounter.formId && encounter.cover)
  );
}
