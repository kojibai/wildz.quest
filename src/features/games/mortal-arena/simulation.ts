import { arenaHitFor, resolveArenaHit } from "./combat";
import { stepArenaMovement } from "./movement";
import type { MortalArenaFrame, MortalArenaInput, MortalArenaSide, MortalArenaState } from "./types";

const FLEE_TICKS = 90;

function inputFor(frames: readonly MortalArenaFrame[], actorId: string): MortalArenaInput {
  return frames.find((frame) => frame.actorId === actorId)?.input ?? {};
}

export function stepMortalArena(state: Readonly<MortalArenaState>, frames: readonly MortalArenaFrame[]): MortalArenaState {
  const tick = state.tick + 1;
  if (state.phase === "complete") return { ...state, tick };
  const phase = state.phase === "intro" ? "fight" : state.phase;
  let sides = state.sides.map((side): MortalArenaSide => {
    const input = inputFor(frames, side.actorId);
    const fighters = side.fighters.map((fighter, index) => index === side.activeIndex
      ? { ...stepArenaMovement(fighter, input, state.arena), guarding: Boolean(input.guard), guardStartedTick: input.guard && !fighter.guarding ? tick : fighter.guardStartedTick }
      : fighter);
    return {
      ...side,
      fighters,
      fleeStartedTick: input.flee ? (side.fleeStartedTick ?? tick) : side.fleeStartedTick,
      fled: side.fleeStartedTick !== null && tick - side.fleeStartedTick >= FLEE_TICKS && fighters[side.activeIndex].vitality > 0
    };
  }) as unknown as [MortalArenaSide, MortalArenaSide];

  for (const attackerIndex of [0, 1] as const) {
    const defenderIndex = attackerIndex === 0 ? 1 : 0;
    const attackerSide = sides[attackerIndex];
    const defenderSide = sides[defenderIndex];
    const attacker = attackerSide.fighters[attackerSide.activeIndex];
    const defender = defenderSide.fighters[defenderSide.activeIndex];
    const input = inputFor(frames, attackerSide.actorId);
    const kind = input.heavy ? "heavy" : input.light ? "light" : null;
    if (!kind || attacker.recoveryTicks > 0 || Math.hypot(attacker.position.x - defender.position.x, attacker.position.z - defender.position.z) > 2_700) continue;
    const resolved = resolveArenaHit(defender, arenaHitFor(attacker, kind), tick);
    sides[defenderIndex] = { ...defenderSide, fighters: defenderSide.fighters.map((fighter, index) => index === defenderSide.activeIndex ? resolved.fighter : fighter) };
    sides[attackerIndex] = { ...attackerSide, fighters: attackerSide.fighters.map((fighter, index) => index === attackerSide.activeIndex ? { ...fighter, recoveryTicks: kind === "heavy" ? 22 : 11 } : fighter) };
  }

  const active = sides.map((side) => side.fighters[side.activeIndex]);
  const defeated = active.findIndex((fighter) => fighter.vitality <= 0);
  const fled = sides.findIndex((side) => side.fled);
  const finishedSide = defeated >= 0 ? defeated : fled;
  return {
    ...state,
    tick,
    phase: finishedSide >= 0 ? "complete" : phase,
    sides,
    winnerSide: finishedSide < 0 ? null : (finishedSide === 0 ? 1 : 0),
    rng: Math.imul(state.rng ^ tick, 1664525) + 1013904223 >>> 0
  };
}
