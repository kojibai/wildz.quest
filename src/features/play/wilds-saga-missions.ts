import type { WildsSagaProjection } from "./wilds-saga-director";
import type { WildsGameplayVerb, WildsMissionNodeDefinition } from "./wilds-saga-types";

export type WildsMissionContribution = Readonly<{
  eventId: string;
  dayId: string;
  objectiveId: string;
  playerId: string;
  verb: WildsGameplayVerb;
  amount: number;
}>;

export type WildsMissionNodeProjection = Readonly<{
  definition: WildsMissionNodeDefinition;
  missionId: string;
  primary: boolean;
  state: "locked" | "available" | "active" | "complete" | "expired";
  progress: number;
  target: number;
  echo: boolean;
  worldMutable: boolean;
}>;

export type WildsMissionGraph = Readonly<{
  nodes: readonly WildsMissionNodeProjection[];
  recommended: WildsMissionNodeProjection | null;
}>;

function contributionProgress(input: {
  contributions: readonly WildsMissionContribution[];
  saga: WildsSagaProjection;
  playerId: string;
  node: WildsMissionNodeDefinition;
}) {
  const seen = new Set<string>();
  let total = 0;
  for (const contribution of input.contributions) {
    if (seen.has(contribution.eventId)
      || contribution.dayId !== input.saga.dayId
      || contribution.playerId !== input.playerId
      || contribution.objectiveId !== input.node.id
      || !input.node.acceptedVerbs.includes(contribution.verb)
      || !Number.isSafeInteger(contribution.amount)
      || contribution.amount < 1) continue;
    seen.add(contribution.eventId);
    total = Math.min(input.node.target, total + contribution.amount);
  }
  return total;
}

export function evaluateMissionContribution(input: {
  node: WildsMissionNodeDefinition;
  verb: WildsGameplayVerb;
  amount: number;
  currentProgress?: number;
}) {
  if (!input.node.acceptedVerbs.includes(input.verb) || !Number.isSafeInteger(input.amount) || input.amount < 1) return 0;
  const current = Math.max(0, Math.min(input.node.target, Math.floor(input.currentProgress ?? 0)));
  return Math.min(input.amount, input.node.target - current);
}

export function projectMissionGraph(input: {
  saga: WildsSagaProjection;
  playerId: string;
  contributions: readonly WildsMissionContribution[];
  currentDayId: string;
}): WildsMissionGraph {
  const echo = input.currentDayId !== input.saga.dayId;
  const flat = input.saga.chapter.missions.flatMap((mission) => mission.nodes.map((definition) => ({ definition, missionId: mission.id, primary: mission.primary })));
  const progress = new Map(flat.map(({ definition }) => [definition.id, contributionProgress({ ...input, node: definition })]));
  const completed = new Set(flat.filter(({ definition }) => (progress.get(definition.id) ?? 0) >= definition.target).map(({ definition }) => definition.id));
  const nodes = flat.map(({ definition, missionId, primary }): WildsMissionNodeProjection => {
    const value = progress.get(definition.id) ?? 0;
    const unlocked = definition.prerequisites.every((prerequisite) => completed.has(prerequisite));
    return {
      definition,
      missionId,
      primary,
      state: value >= definition.target ? "complete" : unlocked ? "available" : "locked",
      progress: value,
      target: definition.target,
      echo,
      worldMutable: !echo
    };
  });
  const candidate = nodes.find((node) => node.primary && node.state === "available")
    ?? nodes.find((node) => node.state === "available")
    ?? null;
  const projected = candidate
    ? nodes.map((node) => node === candidate ? { ...node, state: "active" as const } : node)
    : nodes;
  return { nodes: projected, recommended: projected.find((node) => node.definition.id === candidate?.definition.id) ?? null };
}
