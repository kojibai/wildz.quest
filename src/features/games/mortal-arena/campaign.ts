import { canonicalPortableCardJson, sha256PortableBasis } from "../../play/portable-card";
import type { MortalArenaResult } from "./types";

export type ArenaPathHistory = {
  matchId: string;
  stage: number;
  outcome: MortalArenaResult["outcome"];
  retiredCreatureIds: readonly string[];
};

export type WildzArenaPath = {
  playerId: string;
  stage: number;
  wins: number;
  losses: number;
  retreats: number;
  bossVictories: number;
  history: readonly ArenaPathHistory[];
  checkpointDigest: string;
};

export type ArenaCampaignOpponent = {
  id: string;
  name: string;
  kind: "rival" | "boss";
  tier: "teaching" | "scout" | "veteran" | "champion" | "boss";
  affinity: "Grove" | "Spark" | "Tide" | "Ember" | "Prism" | "Stone";
  phases: readonly string[];
  vitalityPermille: number;
  powerPermille: number;
};

function sealPath(input: Omit<WildzArenaPath, "checkpointDigest">): WildzArenaPath {
  return { ...input, checkpointDigest: sha256PortableBasis(canonicalPortableCardJson(input)) };
}

export function createArenaPath(playerId: string): WildzArenaPath {
  if (!playerId.trim()) throw new Error("Arena Path player is required");
  return sealPath({ playerId, stage: 1, wins: 0, losses: 0, retreats: 0, bossVictories: 0, history: [] });
}

export function advanceArenaPath(path: Readonly<WildzArenaPath>, result: Pick<MortalArenaResult, "matchId" | "outcome" | "retiredCreatureIds">): WildzArenaPath {
  if (path.history.some((entry) => entry.matchId === result.matchId)) return path as WildzArenaPath;
  const won = result.outcome === "victory";
  const bossStage = path.stage % 3 === 0;
  return sealPath({
    playerId: path.playerId,
    stage: won ? path.stage + 1 : path.stage,
    wins: path.wins + Number(won),
    losses: path.losses + Number(result.outcome === "defeat"),
    retreats: path.retreats + Number(result.outcome === "fled"),
    bossVictories: path.bossVictories + Number(won && bossStage),
    history: [...path.history, { matchId: result.matchId, stage: path.stage, outcome: result.outcome, retiredCreatureIds: [...result.retiredCreatureIds] }].slice(-128)
  });
}

export function projectCampaignOpponent(path: Readonly<WildzArenaPath>): ArenaCampaignOpponent {
  const boss = path.stage % 3 === 0;
  const affinities = ["Grove", "Spark", "Tide", "Ember", "Prism", "Stone"] as const;
  const rivals = ["First Bell", "Vanta Keeper", "The Golden Echo", "Crownless One"];
  return {
    id: boss ? `boss:echo-sovereign:${path.stage}` : `rival:${path.stage}`,
    name: boss ? "The Echo Sovereign" : rivals[(path.stage - 1) % rivals.length]!,
    kind: boss ? "boss" : "rival",
    tier: boss ? "boss" : path.stage <= 1 ? "teaching" : path.stage <= 2 ? "scout" : path.stage <= 5 ? "veteran" : "champion",
    affinity: affinities[path.stage % affinities.length]!,
    phases: boss ? ["Crown Wake", "Proofstorm", "Last Resonance"] : ["Duel"],
    vitalityPermille: Math.min(1_850, (boss ? 1_350 : 950) + path.stage * 45),
    powerPermille: Math.min(1_600, (boss ? 1_180 : 920) + path.stage * 35)
  };
}

export function restoreArenaPath(serialized: string | null, playerId: string): WildzArenaPath {
  if (!serialized) return createArenaPath(playerId);
  try {
    const value = JSON.parse(serialized) as WildzArenaPath;
    const { checkpointDigest, ...basis } = value;
    if (value.playerId !== playerId || checkpointDigest !== sha256PortableBasis(canonicalPortableCardJson(basis))) return createArenaPath(playerId);
    return value;
  } catch {
    return createArenaPath(playerId);
  }
}
