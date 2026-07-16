import { sha256PortableBasis } from "../portable-card";
import type { ArenaCombatIntent, ArenaActionState } from "./combat";
import type { ArenaEvent, ArenaInputFrame, ArenaMatchState } from "./runtime";

export type ArenaNpcTier = "learner" | "rival" | "champion" | "boss";
export type ArenaNpcPolicy = Readonly<{ actorId: string; tier: ArenaNpcTier; seed: string; decisionIndex: number }>;
export type ArenaNpcPublicFighter = Readonly<{
  assetId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  vitality: number;
  maxVitality: number;
  break: number;
  maxBreak: number;
  stamina: number;
  focus: number;
  cooldowns: readonly [number, number];
  action: ArenaActionState;
  abilityNames: readonly [string, string];
}>;
export type ArenaNpcObservation = Readonly<{
  frame: number;
  sequence: number;
  tier: ArenaNpcTier;
  actor: ArenaNpcPublicFighter;
  opponent: ArenaNpcPublicFighter;
  opponentHabits: Readonly<{ strike: number; guard: number; dodge: number; ability: number }>;
  recentEvents: readonly ArenaEvent[];
  stage: Readonly<{ consumedPickupIds: readonly string[]; activatedMechanismIds: readonly string[]; hazardIds: readonly string[] }>;
}>;

const reactionFrames: Readonly<Record<ArenaNpcTier, number>> = { learner: 12, rival: 8, champion: 5, boss: 4 };
const neutralMovement = { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false } as const;

function publicFighter(state: ArenaMatchState, assetId: string): ArenaNpcPublicFighter {
  const fighter = state.teams.flatMap((team) => Object.values(team.fighters)).find((value) => value.definition.assetId === assetId);
  if (!fighter) throw new Error("arena_npc_actor_invalid");
  return {
    assetId,
    position: fighter.movement.position,
    vitality: fighter.combat.vitality,
    maxVitality: fighter.definition.maxVitality,
    break: fighter.combat.break,
    maxBreak: fighter.definition.maxBreak,
    stamina: fighter.combat.stamina,
    focus: fighter.combat.focus,
    cooldowns: fighter.combat.cooldowns,
    action: fighter.combat.action,
    abilityNames: fighter.definition.abilityNames,
  };
}

export function observeArenaForNpc(state: ArenaMatchState, actorId: string, tier: ArenaNpcTier): ArenaNpcObservation {
  const actorTeamIndex = state.teams.findIndex((team) => team.activeAssetId === actorId);
  if (actorTeamIndex < 0) throw new Error("arena_npc_actor_invalid");
  const opponentTeam = state.teams[actorTeamIndex === 0 ? 1 : 0];
  const recentEvents = state.events.filter((event) => event.frame <= state.frame).slice(-16);
  const opponentEvents = recentEvents.filter((event) => event.actorId === opponentTeam.activeAssetId && event.kind === "fighter.action");
  const habits = { strike: 0, guard: 0, dodge: 0, ability: 0 };
  for (const event of opponentEvents) {
    if (event.detail === "light" || event.detail === "heavy") habits.strike += 1;
    if (event.detail === "guard" || event.detail === "parry") habits.guard += 1;
    if (event.detail === "dodge") habits.dodge += 1;
    if (event.detail === "ability") habits.ability += 1;
  }
  return {
    frame: state.frame,
    sequence: state.sequence,
    tier,
    actor: publicFighter(state, actorId),
    opponent: publicFighter(state, opponentTeam.activeAssetId),
    opponentHabits: habits,
    recentEvents,
    stage: {
      consumedPickupIds: state.stage.consumedPickupIds,
      activatedMechanismIds: state.stage.activatedMechanismIds,
      hazardIds: state.stage.hazards.map((hazard) => hazard.id),
    },
  };
}

function affordable(observation: ArenaNpcObservation, intent: ArenaCombatIntent) {
  if (intent.kind === "heavy") return observation.actor.stamina >= 14;
  if (intent.kind === "parry") return observation.actor.stamina >= 8;
  if (intent.kind === "dodge") return observation.actor.stamina >= 12;
  if (intent.kind === "ability") return observation.actor.stamina >= (intent.slot === 0 ? 22 : 30) && observation.actor.cooldowns[intent.slot] <= observation.frame;
  return intent.kind !== "light" || observation.actor.stamina >= 4;
}

function selectedIntent(policy: ArenaNpcPolicy, observation: ArenaNpcObservation, direction: { x: number; y: number; z: number }): ArenaCombatIntent | null {
  if (policy.tier === "learner") return { kind: "focus" };
  if (policy.tier === "rival") return { kind: "guard", direction };
  if (policy.tier === "champion") {
    if (observation.opponentHabits.guard >= Math.max(2, observation.opponentHabits.strike)) return { kind: "heavy", direction };
    if (observation.opponentHabits.dodge >= 2) return { kind: "light", direction };
    return { kind: "light", direction };
  }
  const roll = Number.parseInt(sha256PortableBasis(`${policy.seed}:${policy.decisionIndex}:${observation.frame}`).slice(7, 15), 16) % 3;
  if (roll === 0) return { kind: "ability", slot: 0, targetId: observation.opponent.assetId };
  if (roll === 1) return { kind: "heavy", direction };
  return { kind: "parry", direction };
}

export function chooseArenaNpcInput(policy: ArenaNpcPolicy, observation: ArenaNpcObservation): ArenaInputFrame {
  if (policy.actorId !== observation.actor.assetId || policy.tier !== observation.tier) throw new Error("arena_npc_policy_invalid");
  const dx = observation.opponent.position.x - observation.actor.position.x;
  const dz = observation.opponent.position.z - observation.actor.position.z;
  const length = Math.hypot(dx, dz) || 1;
  const direction = { x: dx / length, y: 0, z: dz / length };
  const preferred = selectedIntent(policy, observation, direction);
  const combat = preferred && affordable(observation, preferred) ? preferred : observation.actor.stamina >= 4 ? { kind: "light" as const, direction } : { kind: "focus" as const };
  const distance = Math.hypot(dx, dz);
  return {
    sequence: observation.sequence + 1,
    frame: observation.frame + reactionFrames[policy.tier],
    actorId: policy.actorId,
    movement: distance > 1.4 ? { moveX: direction.x, moveZ: direction.z, jumpPressed: false, sprint: policy.tier !== "learner" } : neutralMovement,
    combat,
    tagAssetId: null,
    contextTargetId: null,
    withdraw: false,
  };
}

export function telegraphArenaNpcInput(input: ArenaInputFrame) {
  const kind = input.combat?.kind ?? "movement";
  return `Learner-readable ${kind} telegraph begins before frame ${input.frame}.`;
}
