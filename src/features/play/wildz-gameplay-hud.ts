import { missionCards, selectedCard, type PlayState } from "./game-state";

const percent = (value: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));

export type WildzHudModel = {
  player: { username: string; displayName: string; level: number; rank: string };
  companion: { id: string; name: string; level: number; bond: number };
  energy: { current: number; maximum: 100 };
  xp: { current: number; progress: number };
  mission: { title: string; progress: number };
  location: { x: number; z: number };
};

export function projectWildzHud(
  state: PlayState,
  identity: { username: string; displayName: string }
): WildzHudModel {
  const companion = selectedCard(state);
  const progression = state.companionProgress[companion.id] ?? { level: 1, xp: 0, bond: 0 };
  const mission = missionCards[state.completedMissionIds.length % missionCards.length];
  return {
    player: {
      username: identity.username.trim(),
      displayName: identity.displayName.trim(),
      level: state.level,
      rank: state.worldRank
    },
    companion: {
      id: companion.id,
      name: companion.name,
      level: progression.level,
      bond: progression.bond
    },
    energy: { current: percent(state.energy), maximum: 100 },
    xp: { current: Math.max(0, Math.round(state.cardXp)), progress: percent(state.cardXp % 100) },
    mission: { title: mission.title, progress: percent(state.missionProgress) },
    location: { x: state.player.x, z: state.player.z }
  };
}
