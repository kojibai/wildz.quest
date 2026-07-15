import type { WildsLandmarkDefinition, WildsLandmarkId } from "./wilds-landmarks";

export type WildsContextAction =
  | { kind: "collect"; label: "Collect reward" }
  | { kind: "enter"; label: string; landmarkId: WildsLandmarkId }
  | { kind: "activate"; label: "Awaken hidden signal"; targetId: string }
  | { kind: "greet"; label: string; playerId: string }
  | { kind: "join"; label: string; activityId: string }
  | { kind: "scan"; label: "Pulse the world" };

export type WildsContextInput = {
  pendingReward: boolean;
  landmark: WildsLandmarkDefinition | null;
  secretId: string | null;
  selectedPlayer: { playerId: string; handle: string } | null;
  joinableActivity: { id: string; name: string } | null;
};

export function resolveWildsContextAction(input: WildsContextInput): WildsContextAction {
  if (input.pendingReward) return { kind: "collect", label: "Collect reward" };
  if (input.landmark) {
    return {
      kind: "enter",
      label: `Enter ${input.landmark.name}`,
      landmarkId: input.landmark.id
    };
  }
  if (input.secretId) {
    return { kind: "activate", label: "Awaken hidden signal", targetId: input.secretId };
  }
  if (input.selectedPlayer) {
    return {
      kind: "greet",
      label: `Greet ${input.selectedPlayer.handle}`,
      playerId: input.selectedPlayer.playerId
    };
  }
  if (input.joinableActivity) {
    return {
      kind: "join",
      label: `Join ${input.joinableActivity.name}`,
      activityId: input.joinableActivity.id
    };
  }
  return { kind: "scan", label: "Pulse the world" };
}
