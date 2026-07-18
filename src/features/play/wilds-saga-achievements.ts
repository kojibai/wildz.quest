import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { WildsChapterMemory, WildsSagaProjection, WildsSagaInstanceIds } from "./wilds-saga-director";
import type { WildsAchievementDefinition, WildsGameplayVerb, WildsReward, WildsSagaScope } from "./wilds-saga-types";

export type WildsAchievementProgressEvent = Readonly<{
  eventId: string;
  playerId: string;
  verb: WildsGameplayVerb;
  amount: number;
}>;

export type WildsAchievementGrantCandidate = Readonly<{
  grantId: string;
  playerId: string;
  definitionId: string;
  scope: WildsSagaScope;
  scopeInstanceId: string;
  causeEventIds: readonly string[];
  reward: WildsReward;
}>;

export type WildsAchievementScopeIds = WildsSagaInstanceIds & Readonly<{ day: string; week: string; month: string; year: string; lifetime: string }>;

function scopeId(input: Record<WildsSagaScope, string>, scope: WildsSagaScope) {
  const value = input[scope];
  if (!value) throw new Error("wilds_achievement_scope_missing");
  return value;
}

export function achievementGrantCandidates(input: {
  definitions: readonly WildsAchievementDefinition[];
  playerId: string;
  scopeInstanceIds: Record<WildsSagaScope, string>;
  events: readonly WildsAchievementProgressEvent[];
  existingGrantIds: readonly string[];
}): WildsAchievementGrantCandidate[] {
  const existing = new Set(input.existingGrantIds);
  const candidates: WildsAchievementGrantCandidate[] = [];
  for (const definition of input.definitions) {
    const byId = new Map<string, WildsAchievementProgressEvent>();
    for (const event of input.events) {
      if (event.playerId === input.playerId && definition.acceptedVerbs.includes(event.verb) && Number.isSafeInteger(event.amount) && event.amount > 0) byId.set(event.eventId, event);
    }
    const ordered = [...byId.values()].sort((left, right) => left.eventId.localeCompare(right.eventId));
    if (ordered.reduce((total, event) => total + event.amount, 0) < definition.target) continue;
    const causeEventIds = ordered.map((event) => event.eventId);
    const scopeInstanceId = scopeId(input.scopeInstanceIds, definition.scope);
    const digest = sha256PortableBasis(canonicalPortableCardJson({ playerId: input.playerId, definitionId: definition.id, scopeInstanceId, causeEventIds }));
    const grantId = `grant:${digest.slice("sha256:".length)}`;
    if (!existing.has(grantId)) candidates.push({ grantId, playerId: input.playerId, definitionId: definition.id, scope: definition.scope, scopeInstanceId, causeEventIds, reward: definition.reward });
  }
  return candidates.sort((left, right) => left.grantId.localeCompare(right.grantId));
}

function trainerTitle(level: number) {
  if (level >= 50) return "Kai Champion";
  if (level >= 25) return "Titan Challenger";
  if (level >= 10) return "Wilds Ranger";
  if (level >= 3) return "Trail Keeper";
  return "Grove Scout";
}

export function projectPlayerSagaProgress(input: { trainerXp: number; achievements: readonly WildsAchievementGrantCandidate[] }) {
  const trainerXp = Math.max(0, Math.min(9_999, Math.floor(Number.isFinite(input.trainerXp) ? input.trainerXp : 0)));
  const trainerLevel = Math.min(100, 1 + Math.floor(trainerXp / 100));
  return { trainerXp, trainerLevel, nextLevelAt: trainerLevel >= 100 ? 10_000 : trainerLevel * 100, title: trainerTitle(trainerLevel) };
}

export function projectSagaReturnContinuity(input: {
  playerName: string;
  saga: WildsSagaProjection;
  memories: readonly WildsChapterMemory[];
}) {
  const name = input.playerName.trim() || "Explorer";
  const memories = input.memories
    .filter((memory) => memory.chapterId && memory.hookId && Number.isFinite(Date.parse(memory.settledAt)))
    .sort((left, right) => left.settledAt.localeCompare(right.settledAt))
    .slice(-3);
  const latest = memories.at(-1);
  return {
    greeting: memories.length ? `Welcome back, ${name}. The world remembers your path.` : `Welcome, ${name}. The living story is already moving.`,
    memories,
    causeSummary: latest
      ? `${input.saga.chapter.title} begins this way because ${latest.chapterId} ended in ${latest.outcome} and left ${latest.hookId}.`
      : `${input.saga.chapter.title} begins from the geometry of ${input.saga.momentCoordinate}.`,
    nextHook: input.saga.act.directive
  };
}
