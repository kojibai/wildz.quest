import { deriveKaiKlokMoment, type KaiKlokMoment } from "./kai-klok-moment";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { WildsSagaProjection } from "./wilds-saga-director";
import type { WildsTrainerProjection } from "./wilds-saga-trainers";

export type WildsTournamentEntrant = Readonly<{
  id: string;
  kind: "player" | "npc";
  label: string;
  seedScore: number;
}>;

export type WildsTournamentRound = "quarterfinal" | "semifinal" | "final";

export type WildsTournamentMatch = Readonly<{
  id: string;
  round: WildsTournamentRound;
  slot: number;
  entrantIds: readonly [string, string];
  winnerId: string | null;
  settledBy: "admitted" | "automatic" | null;
  settledEventId: string | null;
}>;

export type WildsTournamentMatchResult = Readonly<{
  matchId: string;
  winnerId: string;
  settledEventId: string;
}>;

export type WildsTournamentProjection = Readonly<{
  id: string;
  definitionId: string;
  dayId: string;
  name: string;
  phase: "scheduled" | "open" | "settled";
  openedCoordinate: string;
  entrants: readonly WildsTournamentEntrant[];
  matches: readonly WildsTournamentMatch[];
  championId: string | null;
}>;

function digestHex(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value)).slice("sha256:".length);
}

function npcEntrant(input: { saga: WildsSagaProjection; trainer?: WildsTrainerProjection; slot: number }): WildsTournamentEntrant {
  if (input.trainer) return { id: input.trainer.id, kind: "npc", label: `${input.trainer.name} · Trainer`, seedScore: input.trainer.seed };
  const digest = digestHex({ dayId: input.saga.dayId, slot: input.slot, kind: "daily-challenger" });
  return { id: `npc:daily:${digest.slice(0, 16)}:${input.slot}`, kind: "npc", label: `Daily Challenger ${input.slot + 1} · Trainer`, seedScore: Number.parseInt(digest.slice(0, 8), 16) >>> 0 };
}

function match(tournamentId: string, round: WildsTournamentRound, slot: number, entrantIds: readonly [string, string]): WildsTournamentMatch {
  const digest = digestHex({ tournamentId, round, slot, entrantIds: [...entrantIds] });
  return { id: `match:${digest.slice(0, 32)}`, round, slot, entrantIds, winnerId: null, settledBy: null, settledEventId: null };
}

export function projectSagaTournament(input: {
  saga: WildsSagaProjection;
  moment: KaiKlokMoment;
  qualifiedPlayers: readonly { id: string; seedScore: number }[];
  trainers: readonly WildsTrainerProjection[];
  results: readonly WildsTournamentMatchResult[];
}): WildsTournamentProjection {
  if (input.saga.dayId !== `saga:day:Y${input.moment.year}:M${input.moment.month}:D${input.moment.day}`) throw new Error("wilds_tournament_day_mismatch");
  const definition = input.saga.chapter.tournament;
  const id = `${definition.id}:${input.saga.dayId}`;
  const playerIds = new Set<string>();
  const players = [...input.qualifiedPlayers]
    .filter((player) => player.id.trim() && Number.isFinite(player.seedScore) && !playerIds.has(player.id) && playerIds.add(player.id))
    .sort((left, right) => right.seedScore - left.seedScore || left.id.localeCompare(right.id))
    .slice(0, definition.capacity)
    .map((player): WildsTournamentEntrant => ({ id: player.id, kind: "player", label: player.id, seedScore: Math.floor(player.seedScore) }));
  const entrants = [...players];
  const used = new Set(entrants.map((entrant) => entrant.id));
  for (const trainer of input.trainers) {
    if (entrants.length >= definition.capacity) break;
    const entrant = npcEntrant({ saga: input.saga, trainer, slot: entrants.length });
    if (!used.has(entrant.id)) {
      used.add(entrant.id);
      entrants.push(entrant);
    }
  }
  while (entrants.length < definition.capacity) {
    const entrant = npcEntrant({ saga: input.saga, slot: entrants.length });
    if (!used.has(entrant.id)) {
      used.add(entrant.id);
      entrants.push(entrant);
    }
  }
  const matches = Array.from({ length: 4 }, (_, slot) => match(id, "quarterfinal", slot, [entrants[slot * 2]!.id, entrants[slot * 2 + 1]!.id]));
  let tournament: WildsTournamentProjection = {
    id,
    definitionId: definition.id,
    dayId: input.saga.dayId,
    name: definition.name,
    phase: input.moment.arkIndex < 4 ? "scheduled" : "open",
    openedCoordinate: input.moment.coordinate,
    entrants,
    matches,
    championId: null
  };
  for (const result of input.results) tournament = recordTournamentResult({ tournament, ...result });
  return tournament;
}

export function recordTournamentResult(input: {
  tournament: WildsTournamentProjection;
  matchId: string;
  winnerId: string;
  settledEventId: string;
}): WildsTournamentProjection {
  const index = input.tournament.matches.findIndex((candidate) => candidate.id === input.matchId);
  const current = input.tournament.matches[index];
  if (!current || !current.entrantIds.includes(input.winnerId)) throw new Error("wilds_tournament_result_invalid");
  if (current.winnerId) {
    if (current.winnerId === input.winnerId && current.settledEventId === input.settledEventId) return input.tournament;
    throw new Error("wilds_tournament_result_divergent");
  }
  const matches = [...input.tournament.matches];
  matches[index] = { ...current, winnerId: input.winnerId, settledBy: "admitted", settledEventId: input.settledEventId };
  return { ...input.tournament, matches };
}

function automaticWinner(tournament: WildsTournamentProjection, current: WildsTournamentMatch) {
  const digest = digestHex({ tournamentId: tournament.id, matchId: current.id, entrantIds: current.entrantIds });
  const first = tournament.entrants.find((entrant) => entrant.id === current.entrantIds[0])?.seedScore ?? 0;
  const second = tournament.entrants.find((entrant) => entrant.id === current.entrantIds[1])?.seedScore ?? 0;
  const roll = Number.parseInt(digest.slice(0, 8), 16) % Math.max(1, first + second + 2);
  return roll <= first ? current.entrantIds[0] : current.entrantIds[1];
}

function settleMatch(tournament: WildsTournamentProjection, current: WildsTournamentMatch): WildsTournamentMatch {
  if (current.winnerId) return current;
  return { ...current, winnerId: automaticWinner(tournament, current), settledBy: "automatic", settledEventId: `automatic:${current.id}` };
}

export function settleSagaTournament(input: { tournament: WildsTournamentProjection; occurredAt: string }): WildsTournamentProjection {
  if (input.tournament.phase === "settled") return input.tournament;
  const moment = deriveKaiKlokMoment({ occurredAt: input.occurredAt, authority: "world" });
  if (moment.ark !== "Dream" && `saga:day:Y${moment.year}:M${moment.month}:D${moment.day}` === input.tournament.dayId) throw new Error("wilds_tournament_settlement_early");
  const quarters = input.tournament.matches.filter((candidate) => candidate.round === "quarterfinal").map((current) => settleMatch(input.tournament, current));
  if (quarters.length !== 4) throw new Error("wilds_tournament_bracket_invalid");
  const semifinalSeeds = [[quarters[0]!.winnerId!, quarters[1]!.winnerId!], [quarters[2]!.winnerId!, quarters[3]!.winnerId!]] as const;
  const semis = semifinalSeeds.map((entrantIds, slot) => settleMatch(input.tournament, match(input.tournament.id, "semifinal", slot, entrantIds)));
  const final = settleMatch(input.tournament, match(input.tournament.id, "final", 0, [semis[0]!.winnerId!, semis[1]!.winnerId!]));
  return { ...input.tournament, phase: "settled", matches: [...quarters, ...semis, final], championId: final.winnerId };
}
