import { sha256PortableBasis } from "./portable-card";
import type { WildsLeagueProjection, WildsWorldTeamProjection } from "./wilds-world-state";

export type WildsTeam = WildsWorldTeamProjection;

function identityValid(value: string) {
  return value.length >= 3 && value.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(value);
}

function normalizeTeamName(value: string) {
  const name = value
    .normalize("NFKC")
    .replace(/[^a-z0-9 '\-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < 3 || name.length > 32) throw new Error("wilds_team_name_invalid");
  return name;
}

export function createWildsTeam(input: {
  captainId: string;
  name: string;
  occurredAt: string;
  existingTeams?: readonly WildsTeam[];
}): WildsTeam {
  if (!identityValid(input.captainId)) throw new Error("wilds_team_captain_invalid");
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error("wilds_team_time_invalid");
  const name = normalizeTeamName(input.name);
  if (input.existingTeams?.some((team) => team.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("wilds_team_name_exists");
  const createdAt = new Date(Date.parse(input.occurredAt)).toISOString();
  const digest = sha256PortableBasis(`wilds:global:v3:team:${input.captainId}:${name.toLocaleLowerCase()}:${createdAt}`);
  return {
    id: `team:${digest.slice("sha256:".length, "sha256:".length + 24)}`,
    name,
    captainId: input.captainId,
    memberIds: [input.captainId],
    createdAt
  };
}

export function joinWildsTeam(team: WildsTeam, playerId: string): WildsTeam {
  if (!identityValid(playerId)) throw new Error("wilds_team_player_invalid");
  if (team.memberIds.includes(playerId)) throw new Error("wilds_team_member_exists");
  if (team.memberIds.length >= 24) throw new Error("wilds_team_full");
  return { ...team, memberIds: [...team.memberIds, playerId] };
}

export function initialWildsLeague(): WildsLeagueProjection {
  return { seasonId: "v3-genesis", scores: {}, standings: [], scoredEventIds: [] };
}

function standingsFor(scores: Record<string, number>) {
  const sorted = Object.entries(scores)
    .map(([teamId, score]) => ({ teamId, score, rank: 0 }))
    .sort((left, right) => right.score - left.score || left.teamId.localeCompare(right.teamId))
    .slice(0, 100);
  let previousScore: number | null = null;
  let previousRank = 0;
  return sorted.map((entry, index) => {
    const rank = previousScore === entry.score ? previousRank : index + 1;
    previousScore = entry.score;
    previousRank = rank;
    return { ...entry, rank };
  });
}

export function scoreWildsLeague(input: {
  league: WildsLeagueProjection;
  teamId: string;
  eventId: string;
  raidContribution: number;
}): WildsLeagueProjection {
  if (input.league.seasonId !== "v3-genesis") throw new Error("wilds_league_season_invalid");
  if (!identityValid(input.teamId) || !identityValid(input.eventId)) throw new Error("wilds_league_identity_invalid");
  if (!Number.isFinite(input.raidContribution) || input.raidContribution < 0) throw new Error("wilds_league_contribution_invalid");
  if (input.league.scoredEventIds.includes(input.eventId)) return input.league;
  const points = Math.min(1_000, Math.max(1, Math.floor(input.raidContribution / 100)));
  const scores = { ...input.league.scores, [input.teamId]: (input.league.scores[input.teamId] ?? 0) + points };
  return {
    ...input.league,
    scores,
    standings: standingsFor(scores),
    scoredEventIds: [...input.league.scoredEventIds, input.eventId].slice(-4_096)
  };
}
