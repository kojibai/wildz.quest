import { validateAdventureCondition, type AdventureCardCondition, type AdventureInjury } from "../adventure/card-condition";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { ArenaMatchDefinition, ArenaEvent, ArenaFighterRuntime } from "./runtime";
import type { ArenaReplayResult, ArenaTranscript } from "./transcript";

export type ArenaMemorial = Readonly<{
  id: string;
  assetId: string;
  matchId: string;
  finalEventId: string;
  epitaph: string;
  honoredByTeamVictory: boolean;
}>;
export type ArenaCardConsequence = Readonly<{
  assetId: string;
  lifeBefore: "alive" | "dead";
  lifeAfter: "alive" | "dead";
  xp: number;
  mastery: Readonly<Record<string, number>>;
  fatigueDelta: number;
  injuriesAdded: readonly AdventureInjury[];
  scarIds: readonly string[];
  relationshipIds: readonly string[];
  achievementIds: readonly string[];
  evolutionIds: readonly string[];
  sourceEventIds: readonly string[];
  epitaph: string | null;
}>;
export type ArenaConsequenceSet = Readonly<{
  schema: "receiz.wilds.arena_consequences.v1";
  matchId: string;
  definitionDigest: string;
  transcriptDigest: string;
  stateDigest: string;
  mode: "practice" | "mortal";
  winnerTeamId: string;
  encounterId: string;
  checkpointIds: readonly string[];
  cards: Readonly<Record<string, ArenaCardConsequence>>;
  resourceAwards: Readonly<Record<string, number>>;
  memorials: readonly ArenaMemorial[];
  digest: string;
}>;
export type ArenaConsequenceInput = Readonly<{
  definition: ArenaMatchDefinition;
  replay: ArenaReplayResult;
  transcript: ArenaTranscript;
  priorConditions: Readonly<Record<string, AdventureCardCondition>>;
  encounterId: string;
  checkpointId: string;
}>;

const xpByEvent: Readonly<Record<string, number>> = {
  "fighter.action": 2,
  "fighter.hit": 12,
  "fighter.guarded": 8,
  "fighter.parried": 14,
  "fighter.dodged": 10,
  "fighter.tagged": 4,
  "fighter.tag-cancelled": 6,
  "fighter.rescued": 15,
  "pickup.consumed": 5,
  "mechanism.activated": 10,
};

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function uniqueEvents(events: readonly ArenaEvent[]) {
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

function runtimeFor(input: ArenaConsequenceInput, assetId: string): { runtime: ArenaFighterRuntime; teamId: string } {
  for (const team of input.replay.state.teams) {
    const runtime = team.fighters[assetId];
    if (runtime) return { runtime, teamId: team.id };
  }
  throw new Error("arena_consequences_runtime_invalid");
}

function injuries(assetId: string, related: readonly ArenaEvent[], maxVitality: number) {
  return related.filter((event) => (event.targetId === assetId && event.kind === "fighter.hit") || (event.actorId === assetId && ["hazard.hit", "fighter.fell"].includes(event.kind))).map((event, index) => {
    const ratio = event.amount / Math.max(1, maxVitality);
    const severity = (ratio >= 0.5 ? 3 : ratio >= 0.2 ? 2 : 1) as 1 | 2 | 3;
    const kinds = ["guard", "limb", "focus", "wing"] as const;
    return {
      id: `arena:injury:${digest({ assetId, eventId: event.id }).slice(7, 31)}`,
      kind: kinds[index % kinds.length]!,
      severity,
      sourceEventId: event.id,
    } satisfies AdventureInjury;
  }).slice(0, 3);
}

function relationshipIds(assetId: string, events: readonly ArenaEvent[]) {
  return events.filter((event) => event.kind === "fighter.rescued" && (event.actorId === assetId || event.targetId === assetId)).map((event) => {
    const other = event.actorId === assetId ? event.targetId : event.actorId;
    return `arena:bond:${assetId}:${other}:${event.id}`;
  });
}

export function projectArenaConsequences(input: ArenaConsequenceInput): ArenaConsequenceSet {
  if (digest(input.replay.state) !== input.replay.stateDigest
    || input.replay.state.definitionDigest !== input.transcript.definitionDigest
    || input.replay.transcriptDigest !== input.transcript.digest
    || input.replay.state.phase !== "terminal"
    || !input.replay.state.terminal) throw new Error("arena_consequences_replay_invalid");
  const expectedDefinitionDigest = digest(input.definition);
  if (expectedDefinitionDigest !== input.transcript.definitionDigest) throw new Error("arena_consequences_definition_invalid");
  const events = uniqueEvents(input.replay.state.events);
  const practice = input.definition.mode === "practice";
  const winnerTeamId = input.replay.state.terminal.winnerTeamId;
  const cards = Object.fromEntries(input.definition.teams.flatMap((team) => team.fighters).map((fighter) => {
    const prior = input.priorConditions[fighter.assetId];
    if (!prior || prior.assetId !== fighter.assetId) throw new Error("arena_consequences_condition_invalid");
    validateAdventureCondition(prior);
    const { runtime, teamId } = runtimeFor(input, fighter.assetId);
    const related = events.filter((event) => event.actorId === fighter.assetId || event.targetId === fighter.assetId);
    const contributions = related.filter((event) => event.actorId === fighter.assetId && xpByEvent[event.kind]);
    const sourceEventIds = related.map((event) => event.id);
    const retired = !practice && runtime.status === "retired";
    const won = teamId === winnerTeamId;
    const baseXp = contributions.reduce((total, event) => total + (xpByEvent[event.kind] ?? 0), 0) + (won && contributions.length ? 20 : 0);
    const xp = practice ? 0 : Math.min(retired ? 25 : 250, baseXp);
    const injuriesAdded = practice ? [] : injuries(fighter.assetId, related, fighter.maxVitality);
    const scars = injuriesAdded.map((injury) => `arena:scar:${digest({ assetId: fighter.assetId, injuryId: injury.id }).slice(7, 27)}`);
    const retiredEvent = related.find((event) => event.kind === "fighter.retired");
    const epitaph = retired && retiredEvent ? (won ? `${fighter.name} carried the team beyond the final fall.` : `${fighter.name} fell with the path unfinished.`) : null;
    const achievements = practice ? [] : [
      ...(won && contributions.length ? ["arena:victory-contributor"] : []),
      ...(retired && won ? ["arena:honored-sacrifice"] : []),
      ...(contributions.some((event) => event.kind === "fighter.rescued") ? ["arena:guardian-bond"] : []),
    ];
    const mastery = practice || !xp ? {} : Object.fromEntries([...new Set(contributions.map((event) => `arena:${event.detail}`))].slice(0, 8).map((key) => [key, Math.min(100, Math.max(1, Math.ceil(xp / 8)))]));
    const evolutionIds = !practice && !retired && xp >= 40 ? [`arena:evolution:${digest({ assetId: fighter.assetId, sourceEventIds }).slice(7, 23)}`] : [];
    const consequence: ArenaCardConsequence = {
      assetId: fighter.assetId,
      lifeBefore: prior.life,
      lifeAfter: prior.life === "dead" || retired ? "dead" : "alive",
      xp,
      mastery,
      fatigueDelta: practice ? 0 : Math.min(25, related.length + injuriesAdded.reduce((sum, injury) => sum + injury.severity * 2, 0)),
      injuriesAdded,
      scarIds: scars,
      relationshipIds: practice ? [] : relationshipIds(fighter.assetId, related),
      achievementIds: achievements,
      evolutionIds,
      sourceEventIds,
      epitaph,
    };
    return [fighter.assetId, consequence];
  }));
  const memorials = Object.values(cards).flatMap((card) => {
    if (!card.epitaph) return [];
    const finalEventId = card.sourceEventIds.find((id) => events.find((event) => event.id === id)?.kind === "fighter.retired")!;
    const teamId = runtimeFor(input, card.assetId).teamId;
    return [{
      id: `arena:memorial:${digest({ assetId: card.assetId, finalEventId }).slice(7, 31)}`,
      assetId: card.assetId,
      matchId: input.replay.state.id,
      finalEventId,
      epitaph: card.epitaph,
      honoredByTeamVictory: teamId === winnerTeamId,
    } satisfies ArenaMemorial];
  });
  const contributingWinner = Object.values(cards).some((card) => card.xp > 0 && runtimeFor(input, card.assetId).teamId === winnerTeamId);
  const resourceAwards: Record<string, number> = !practice && contributingWinner ? { "arena-fragment": Math.min(3, 1 + Math.floor(events.length / 8)) } : {};
  const unsigned = {
    schema: "receiz.wilds.arena_consequences.v1" as const,
    matchId: input.replay.state.id,
    definitionDigest: input.transcript.definitionDigest,
    transcriptDigest: input.transcript.digest,
    stateDigest: input.replay.stateDigest,
    mode: input.definition.mode,
    winnerTeamId,
    encounterId: input.encounterId,
    checkpointIds: practice ? [] : [input.checkpointId],
    cards,
    resourceAwards,
    memorials,
  };
  return { ...unsigned, digest: digest(unsigned) };
}
