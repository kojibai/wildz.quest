import type { WorldOverlayOwner } from "./world-overlay-state";

export type PlayShellOwnerState = Readonly<{
  combat: boolean;
  trainer: boolean;
  memorial: boolean;
  reward: boolean;
  ceremony: boolean;
  raid: boolean;
  ecology: boolean;
  settlement: boolean;
  landmark: boolean;
  map: boolean;
  profile: boolean;
  market: boolean;
  multiplayer: boolean;
  command: boolean;
}>;

export function projectPlayShellOwner(state: PlayShellOwnerState): WorldOverlayOwner {
  if (state.combat) return "combat";
  if (state.trainer) return "trainer";
  if (state.memorial) return "memorial";
  if (state.reward) return "reward";
  if (state.ceremony) return "ceremony";
  if (state.raid) return "raid";
  if (state.ecology) return "ecology";
  if (state.settlement) return "settlement";
  if (state.landmark) return "landmark";
  if (state.map) return "map";
  if (state.profile) return "profile";
  if (state.market) return "market";
  if (state.multiplayer) return "multiplayer";
  if (state.command) return "command";
  return "none";
}
