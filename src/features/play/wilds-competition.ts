import { sha256PortableBasis } from "./portable-card";

const ID = /^[a-z0-9][a-z0-9:._-]{2,179}$/i;
const MAX_EVENT_POINTS = 1_000;
const MAX_SEASON_SCORE = 100_000;

export type WildsSeason = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  scoringVersion: "v1";
};

export type WildsSeasonStatus = "scheduled" | "active" | "complete";

export type WildsCompetitionStanding = { participantId: string; score: number; rank: number; events: number };
export type WildsCompetition = {
  season: WildsSeason;
  scores: Record<string, number>;
  eventCounts: Record<string, number>;
  standings: WildsCompetitionStanding[];
  scoredEventIds: string[];
};

function validId(value: string) {
  return typeof value === "string" && ID.test(value);
}

function seasonName(value: string) {
  const result = value.normalize("NFKC").replace(/[^a-z0-9 '&-]/gi, "").replace(/\s+/g, " ").trim();
  if (result.length < 3 || result.length > 64) throw new Error("wilds_season_name_invalid");
  return result;
}

export function createWildsSeason(input: { name: string; startsAt: string; endsAt: string }): WildsSeason {
  const name = seasonName(input.name);
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("wilds_season_window_invalid");
  const startsAt = new Date(start).toISOString();
  const endsAt = new Date(end).toISOString();
  const digest = sha256PortableBasis(`wilds:competition:v1:${name.toLocaleLowerCase()}:${startsAt}:${endsAt}`);
  return { id: `season:${digest.slice("sha256:".length, "sha256:".length + 24)}`, name, startsAt, endsAt, scoringVersion: "v1" };
}

export function initialWildsCompetition(season: WildsSeason): WildsCompetition {
  return { season, scores: {}, eventCounts: {}, standings: [], scoredEventIds: [] };
}

/** Pulse/scheduler callers use this pure function so every client agrees on season state. */
export function wildsSeasonStatus(season: WildsSeason, at: string | number | Date): WildsSeasonStatus {
  const instant = typeof at === "number" ? at : Date.parse(at instanceof Date ? at.toISOString() : at);
  if (!Number.isFinite(instant)) throw new Error("wilds_season_time_invalid");
  const start = Date.parse(season.startsAt);
  const end = Date.parse(season.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("wilds_season_window_invalid");
  return instant < start ? "scheduled" : instant >= end ? "complete" : "active";
}

function standings(scores: Record<string, number>, eventCounts: Record<string, number>): WildsCompetitionStanding[] {
  const sorted = Object.keys(scores).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b)).map((participantId) => ({ participantId, score: scores[participantId], rank: 0, events: eventCounts[participantId] ?? 0 }));
  let previous: number | null = null;
  let rank = 0;
  return sorted.slice(0, 100).map((entry, index) => {
    if (entry.score !== previous) rank = index + 1;
    previous = entry.score;
    return { ...entry, rank };
  });
}

export function recordWildsCompetitionEvent(input: {
  state: WildsCompetition;
  season: WildsSeason;
  participantId: string;
  eventId: string;
  contribution: number;
  isNewcomer?: boolean;
}): WildsCompetition {
  if (input.state.season.id !== input.season.id) throw new Error("wilds_competition_season_invalid");
  if (!validId(input.participantId) || !validId(input.eventId)) throw new Error("wilds_competition_identity_invalid");
  if (!Number.isFinite(input.contribution) || input.contribution < 0) throw new Error("wilds_competition_contribution_invalid");
  if (input.state.scoredEventIds.includes(input.eventId)) return input.state;
  const base = Math.min(MAX_EVENT_POINTS, Math.max(1, Math.floor(Math.min(input.contribution, 100_000) / 100)));
  const points = Math.min(MAX_EVENT_POINTS, base * (input.isNewcomer ? 2 : 1));
  const current = input.state.scores[input.participantId] ?? 0;
  const next = Math.min(MAX_SEASON_SCORE, current + points);
  const scores = { ...input.state.scores, [input.participantId]: next };
  const eventCounts = { ...input.state.eventCounts, [input.participantId]: (input.state.eventCounts[input.participantId] ?? 0) + 1 };
  return { ...input.state, scores, eventCounts, standings: standings(scores, eventCounts), scoredEventIds: [...input.state.scoredEventIds, input.eventId].slice(-8_192) };
}

/** Public projection intentionally omits event ids and internal scoring details. */
export function publicWildsRecords(state: WildsCompetition): WildsCompetitionStanding[] {
  return state.standings.map(({ participantId, score, rank, events }) => ({ participantId, score, rank, events }));
}
