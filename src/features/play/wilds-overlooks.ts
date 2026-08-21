import { WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "./wilds-landmarks";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { WILDS_AUTHORED_OVERLOOKS } from "./wilds-world-geography";

export type WildsOverlookId = (typeof WILDS_AUTHORED_OVERLOOKS)[number]["id"];
export type WildsVistaCamera = Readonly<{ azimuth: number; polar: number; distance: number }>;
export type WildsVistaState = Readonly<{
  active: boolean;
  overlookId: WildsOverlookId;
  revealedLandmarkIds: readonly WildsLandmarkId[];
  priorCamera: WildsVistaCamera;
}>;

export function projectWildsOverlooks(player: { x: number; z: number }, radius = 34) {
  return WILDS_AUTHORED_OVERLOOKS
    .map((overlook) => ({
      ...overlook,
      elevation: sampleWildsTerrain(overlook.position.x, overlook.position.z).elevation,
      distance: Math.hypot(overlook.position.x - player.x, overlook.position.z - player.z),
      relative: { x: overlook.position.x - player.x, z: overlook.position.z - player.z }
    }))
    .filter((overlook) => overlook.distance <= radius);
}

export function wildsOverlookAt(player: { x: number; z: number }, radius = 2.2) {
  return projectWildsOverlooks(player, radius).sort((left, right) => left.distance - right.distance)[0] ?? null;
}

export function beginWildsVista(overlookId: WildsOverlookId, priorCamera: WildsVistaCamera): WildsVistaState {
  const overlook = WILDS_AUTHORED_OVERLOOKS.find((candidate) => candidate.id === overlookId);
  if (!overlook) throw new Error("wilds_overlook_unknown");
  const knownLandmarks = new Set(WILDS_FLAGSHIP_LANDMARKS.map((landmark) => landmark.id));
  return {
    active: true,
    overlookId,
    revealedLandmarkIds: overlook.revealLandmarkIds.filter((id): id is WildsLandmarkId => knownLandmarks.has(id as WildsLandmarkId)),
    priorCamera: { ...priorCamera }
  };
}

export function exitWildsVista(state: WildsVistaState) {
  return { state: { ...state, active: false }, restoredCamera: { ...state.priorCamera } };
}
