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
  parry?: boolean;
  dodge?: boolean;
  focus?: boolean;
  flee?: boolean;
  withdraw?: boolean;
  swapTo?: number;
  abilitySlot?: 0 | 1;
  contextTargetId?: string;
};

export type MortalArenaFighter = MortalArenaFighterSetup & {
  maxVitality: number;
  break: number;
  maxBreak: number;
  focus: number;
  position: ArenaVector;
  velocity: ArenaVector;
  facing: 1 | -1;
  guarding: boolean;
  guardStartedTick: number | null;
  recoveryTicks: number;
  stamina?: number;
  action?: { kind: "idle" | "light" | "heavy" | "guard" | "parry" | "dodge" | "focus" | "ability"; activeFrom: number; activeUntil: number; recoverUntil: number; abilityName: string | null };
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
  affectedOwnedCards?: readonly { cardId: string; finalVitality: number; maxVitality: number; status: "active" | "ready" | "knocked-out" | "retired" }[];
  canonical?: {
    rulesetId: string;
    definitionDigest: string;
    kai: import("../../play/kai-temporal-root").KaiTemporalRoot;
    mode: import("../../play/arena/mode").ArenaMode;
    authority: import("../../play/arena/mode").ArenaAuthorityKind;
    terminalReason: "withdrawal" | "team-defeat" | "double-defeat" | "mutual-withdrawal";
  };
};

export type MortalArenaFrame = WildzInputFrame<MortalArenaInput>;
export type MortalArenaLifeProposal = { kind: "victory" | "loss" | "retreat" | "retirement"; creatureId: string; matchId: string };
