import {playerBreathReadout,projectPlayerBreathState} from "./player-breath-energy";
import { livingMissionTitle, selectedCard, selectedAsset, exactCompanionProgress, type PlayState } from "./game-state";
import {projectWildsExplorerProgress} from "./wilds-explorer-progression";

const percent = (value: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));

export type WildzHudModel = {
  player: { username: string; displayName: string; level: number; rank: string };
  companion: { id: string; name: string; level: number; bond: number };
  energy: { current: number; maximum: 100; breaths?: ReturnType<typeof playerBreathReadout> };
  xp: { current: number; progress: number; levelXp:number;nextLevelAt:number|null;remaining:number;achievementCount:number };
  mission: { title: string; progress: number };
  location: { x: number; z: number };
};

export function projectWildzHud(
  state: PlayState,
  identity: { username: string; displayName: string },
  kaiUPulse?:number
): WildzHudModel {
  const energyState=kaiUPulse===undefined?state:projectPlayerBreathState(state,kaiUPulse);
  const companion = selectedCard(state);
  const asset = selectedAsset(state);
  const progression = asset ? exactCompanionProgress(state, asset) : { level: 1, xp: 0, bond: 0 };
  const explorer=projectWildsExplorerProgress(state);
  return {
    player: {
      username: identity.username.trim(),
      displayName: identity.displayName.trim(),
      level: explorer.level,
      rank: state.worldRank
    },
    companion: {
      id: companion.id,
      name: companion.name,
      level: progression.level,
      bond: progression.bond
    },
    energy: { current: percent(energyState.energy), maximum: 100, ...(energyState.playerBreaths?{breaths:playerBreathReadout(energyState.playerBreaths)}:{}) },
    xp: {current:explorer.xp,progress:explorer.progress,levelXp:explorer.levelXp,nextLevelAt:explorer.nextLevelAt,remaining:explorer.remaining,achievementCount:explorer.achievementCount},
    mission: { title: livingMissionTitle(state), progress: Math.min(99, percent(state.missionProgress)) },
    location: { x: state.player.x, z: state.player.z }
  };
}
