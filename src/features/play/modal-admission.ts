import type { WorldOverlayOwner } from "./world-overlay-state";

export type ModalAdmissionState = Readonly<{
  epoch: number;
  owner: WorldOverlayOwner;
}>;

export type ModalAdmissionToken = Readonly<{
  epoch: number;
  expectedOwner: "none";
}>;

export type PlayHome = "reference" | "multiplayer" | "status" | "movement" | "tools" | "companion";

export function createModalAdmissionState(owner: WorldOverlayOwner = "none"): ModalAdmissionState {
  return { epoch: 0, owner };
}

export function beginModalAdmission(state: ModalAdmissionState): ModalAdmissionToken | null {
  return state.owner === "none" ? { epoch: state.epoch, expectedOwner: "none" } : null;
}

export function claimModalAdmissionOwner(state: ModalAdmissionState, owner: WorldOverlayOwner): ModalAdmissionState {
  return { epoch: state.epoch + 1, owner };
}

export function releaseModalAdmissionOwner(state: ModalAdmissionState, owner: WorldOverlayOwner): ModalAdmissionState {
  return state.owner === owner ? { epoch: state.epoch + 1, owner: "none" } : state;
}

export function canCommitModalAdmission(state: ModalAdmissionState, token: ModalAdmissionToken | null): token is ModalAdmissionToken {
  return Boolean(token && state.owner === token.expectedOwner && state.epoch === token.epoch);
}

export function isProjectedModalMounted(projectedOwner: WorldOverlayOwner, candidate: WorldOverlayOwner) {
  return projectedOwner === candidate;
}

export function isPlayHomeAvailable(owner: WorldOverlayOwner, home: PlayHome) {
  if (owner === "none") return true;
  if (owner === "command") return home === "tools";
  if (owner === "multiplayer") return home === "multiplayer";
  return false;
}
