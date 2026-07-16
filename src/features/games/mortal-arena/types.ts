import type { WildzInputFrame } from "../kernel/game-module";

export type ArenaAffinity = "Grove" | "Spark" | "Tide" | "Ember" | "Prism" | "Stone";
export type ArenaVector = { x: number; y: number; z: number };

export type MortalArenaFighterSetup = {
  creatureId: string;
  affinity: ArenaAffinity;
  vitality: number;
  power: number;
  guard: number;
  speed: number;
};

export type MortalArenaSideSetup = { actorId: string; fighters: readonly MortalArenaFighterSetup[] };
export type MortalArenaSetup = {
  matchId: string;
  seed: number;
  mortal: boolean;
  sides: readonly [MortalArenaSideSetup, MortalArenaSideSetup];
};

export type MortalArenaInput = {
  moveX?: number;
  moveZ?: number;
  jump?: boolean;
  light?: boolean;
  heavy?: boolean;
  guard?: boolean;
  dodge?: boolean;
  flee?: boolean;
  swapTo?: number;
};

export type MortalArenaFighter = MortalArenaFighterSetup & {
  maxVitality: number;
  break: number;
  maxBreak: number;
  position: ArenaVector;
  velocity: ArenaVector;
  facing: 1 | -1;
  guarding: boolean;
  guardStartedTick: number | null;
  recoveryTicks: number;
};

export type MortalArenaSide = {
  actorId: string;
  fighters: readonly MortalArenaFighter[];
  activeIndex: number;
  fleeStartedTick: number | null;
  fled: boolean;
};

export type MortalArenaState = {
  matchId: string;
  mortal: boolean;
  tick: number;
  phase: "intro" | "fight" | "resolution" | "complete";
  arena: { id: "echo-bowl"; radius: number; floorY: number; fallY: number };
  sides: readonly [MortalArenaSide, MortalArenaSide];
  winnerSide: 0 | 1 | null;
  rng: number;
};

export type MortalArenaResult = {
  matchId: string;
  winnerSide: 0 | 1 | null;
  outcome: "victory" | "defeat" | "draw" | "fled";
  mortal: boolean;
  finalVitality: readonly [number, number];
  retiredCreatureIds: readonly string[];
};

export type MortalArenaFrame = WildzInputFrame<MortalArenaInput>;
export type MortalArenaLifeProposal = { kind: "victory" | "loss" | "retreat" | "retirement"; creatureId: string; matchId: string };
