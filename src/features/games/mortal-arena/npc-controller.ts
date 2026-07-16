import type { MortalArenaFrame, MortalArenaInput, MortalArenaState } from "./types";

export type ArenaNpcTier = "teaching" | "scout" | "veteran" | "champion" | "boss";

export type ArenaNpc = {
  actorId: string;
  tier: ArenaNpcTier;
  seed: number;
  sequence: number;
  reactionTicks: number;
};

const REACTION_TICKS: Readonly<Record<ArenaNpcTier, number>> = {
  teaching: 24,
  scout: 18,
  veteran: 13,
  champion: 9,
  boss: 11
};

export function createArenaNpc(input: { actorId: string; tier: ArenaNpcTier; seed: number }): ArenaNpc {
  if (!input.actorId.trim()) throw new Error("Arena NPC actor is required");
  return { ...input, seed: input.seed >>> 0, sequence: 0, reactionTicks: REACTION_TICKS[input.tier] };
}

function nextRandom(seed: number, tick: number) {
  return (Math.imul(seed ^ tick, 1_664_525) + 1_013_904_223) >>> 0;
}

export function stepArenaNpc(npc: Readonly<ArenaNpc>, state: Readonly<MortalArenaState>): MortalArenaFrame {
  const ownIndex = state.sides.findIndex((side) => side.actorId === npc.actorId);
  if (ownIndex < 0) throw new Error("Arena NPC is not admitted to this match");
  const enemyIndex = ownIndex === 0 ? 1 : 0;
  const own = state.sides[ownIndex]!.fighters[state.sides[ownIndex]!.activeIndex]!;
  const enemy = state.sides[enemyIndex]!.fighters[state.sides[enemyIndex]!.activeIndex]!;
  const dx = enemy.position.x - own.position.x;
  const dz = enemy.position.z - own.position.z;
  const distance = Math.hypot(dx, dz);
  const random = nextRandom(npc.seed, state.tick + npc.sequence);
  const input: MortalArenaInput = {};

  if (distance > 2_300) {
    input.moveX = Math.round(Math.max(-1_000, Math.min(1_000, dx / Math.max(1, distance) * 1_000)));
    input.moveZ = Math.round(Math.max(-1_000, Math.min(1_000, dz / Math.max(1, distance) * 1_000)));
    if (npc.tier === "boss" && random % 31 === 0) input.jump = true;
  } else if (own.recoveryTicks === 0) {
    const choice = random % 10;
    if (choice <= (npc.tier === "teaching" ? 4 : 2)) input.guard = true;
    else if (choice >= 8 && npc.tier !== "teaching") input.heavy = true;
    else input.light = true;
  }

  if (own.vitality <= Math.round(own.maxVitality * .16) && npc.tier !== "boss" && random % 5 === 0) input.flee = true;
  return {
    actorId: npc.actorId,
    sequence: npc.sequence + 1,
    atTick: state.tick + npc.reactionTicks,
    input
  };
}

export function advanceArenaNpc(npc: Readonly<ArenaNpc>): ArenaNpc {
  return { ...npc, sequence: npc.sequence + 1 };
}
