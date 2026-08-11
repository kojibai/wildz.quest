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

const WILD_BATTLE_OWNED_PHASES = new Set([
  "battle_intro",
  "player_turn",
  "capture_ready",
  "emerging",
  "capsule",
  "sealed",
  "fled",
  "defeated"
]);

export function isWildBattleModalOwner(encounterPhase: string, battlePresent: boolean) {
  return battlePresent && WILD_BATTLE_OWNED_PHASES.has(encounterPhase);
}

export function isCaptureRewardModalOwner(encounterPhase: string, rewardAssetPresent: boolean) {
  return encounterPhase === "revealed" && rewardAssetPresent;
}

export type PlayCombatSurface = "trainer" | "wild" | "pvp";

export function projectPlayCombatSurface(state: Readonly<Record<PlayCombatSurface, boolean>>): PlayCombatSurface | null {
  if (state.trainer) return "trainer";
  if (state.wild) return "wild";
  if (state.pvp) return "pvp";
  return null;
}

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

export function canAcceptPlayShellInput(
  interactionEnabled: boolean,
  owner: WorldOverlayOwner,
  commandPanelOpen: boolean
) {
  return interactionEnabled && owner === "none" && !commandPanelOpen;
}
