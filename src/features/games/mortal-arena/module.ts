import type { WildzGameModule } from "../kernel/game-module";
import { stepMortalArena } from "./simulation";
import type { MortalArenaFighter, MortalArenaInput, MortalArenaLifeProposal, MortalArenaResult, MortalArenaSetup, MortalArenaState } from "./types";

function fighter(input: MortalArenaSetup["sides"][number]["fighters"][number], side: 0 | 1): MortalArenaFighter {
  return {
    ...input,
    maxVitality: input.vitality,
    break: 1_000,
    maxBreak: 1_000,
    focus: 0,
    position: { x: side === 0 ? -3_000 : 3_000, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    facing: side === 0 ? 1 : -1,
    guarding: false,
    guardStartedTick: null,
    recoveryTicks: 0
  };
}

export const MORTAL_ARENA_MODULE: WildzGameModule<MortalArenaSetup, MortalArenaState, MortalArenaInput, MortalArenaResult, MortalArenaLifeProposal> = {
  id: "mortal-arena",
  rulesVersion: "1.0.0",
  tickRate: 60,
  limits: { maxTicks: 21_600, maxInputs: 4_096, maxEntities: 6 },
  create(setup) {
    if (!setup.matchId || setup.sides.some((side) => side.fighters.length < 1 || side.fighters.length > 3)) throw new Error("Mortal Arena requires one to three fighters per side");
    return {
      matchId: setup.matchId,
      mortal: setup.mortal,
      tick: 0,
      phase: "intro",
      arena: { id: "echo-bowl", radius: 10_500, floorY: 0, fallY: -4_000 },
      sides: setup.sides.map((side, index) => ({ actorId: side.actorId, fighters: side.fighters.map((item) => fighter(item, index as 0 | 1)), activeIndex: 0, fleeStartedTick: null, fled: false })) as unknown as MortalArenaState["sides"],
      winnerSide: null,
      rng: setup.seed >>> 0
    };
  },
  step: stepMortalArena,
  complete(state) {
    if (state.phase !== "complete") return null;
    const finalVitality = state.sides.map((side) => side.fighters[side.activeIndex].vitality) as unknown as readonly [number, number];
    const retiredCreatureIds = state.mortal ? state.sides.flatMap((side) => side.fighters.filter((item) => item.vitality <= 0).map((item) => item.creatureId)) : [];
    const outcome = state.sides[0].fled
      ? "fled" as const
      : state.winnerSide === 0
        ? "victory" as const
        : state.winnerSide === 1
          ? "defeat" as const
          : "draw" as const;
    return { matchId: state.matchId, winnerSide: state.winnerSide, outcome, mortal: state.mortal, finalVitality, retiredCreatureIds };
  },
  propose(result) {
    return result.retiredCreatureIds.map((creatureId) => ({ kind: "retirement" as const, creatureId, matchId: result.matchId }));
  }
};
