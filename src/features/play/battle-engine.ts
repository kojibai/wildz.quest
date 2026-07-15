import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type BattleParticipantInput = {
  assetId?: string;
  formId?: string;
  name: string;
  element?: string;
  health: number;
  power: number;
  guard: number;
  speed: number;
};

export type BattleElement = "Grove" | "Spark" | "Tide" | "Ember" | "Prism" | "Stone";
export type BattleConditionKind = "guard_broken" | "rooted" | "charged" | "drenched" | "scorched" | "dazzled" | "fractured";
export type BattleCondition = { kind: BattleConditionKind; turns: 1 | 2 };
export type BattleIntent = {
  kind: "strike" | "break" | "recover";
  label: "Strike" | "Break" | "Recover";
  detail: string;
  power: number;
};

export type BattleFighter = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  hpRatio: number;
  energy: number;
  power: number;
  guard: number;
  speed: number;
  element: BattleElement;
  focus: number;
  combo: number;
  conditions: BattleCondition[];
};

export type BattlePhase = "player_turn" | "wild_turn" | "capture_ready" | "captured" | "fled" | "defeated";
export type BattleAction =
  | { type: "ability"; slot: 0 | 1 }
  | { type: "guard" }
  | { type: "focus" }
  | { type: "switch"; player: BattleParticipantInput }
  | { type: "capture" };

export type BattleTranscriptEntry = {
  turn: number;
  action: BattleAction["type"];
  detail: string;
  playerHp: number;
  wildHp: number;
};

export type BattleState = {
  encounterSeed: string;
  phase: BattlePhase;
  turn: number;
  player: BattleFighter;
  wild: BattleFighter;
  intent: BattleIntent;
  transcript: BattleTranscriptEntry[];
};

export type BattleGrowthAward = {
  kind: "battle_win" | "ability_mastery";
  eventId: string;
  amount: number;
  achievementId?: string;
};

const elements: readonly BattleElement[] = ["Grove", "Spark", "Tide", "Ember", "Prism", "Stone"];
const advantages: Readonly<Record<BattleElement, BattleElement>> = {
  Grove: "Tide",
  Tide: "Ember",
  Ember: "Grove",
  Spark: "Stone",
  Stone: "Prism",
  Prism: "Spark"
};
const elementConditions: Readonly<Record<BattleElement, Exclude<BattleConditionKind, "guard_broken">>> = {
  Grove: "rooted",
  Spark: "charged",
  Tide: "drenched",
  Ember: "scorched",
  Prism: "dazzled",
  Stone: "fractured"
};

function battleElement(value: string | undefined): BattleElement {
  return elements.find((element) => element.toLowerCase() === value?.toLowerCase()) ?? "Prism";
}

export function elementEffectiveness(attacker: BattleElement, defender: BattleElement) {
  if (advantages[attacker] === defender) return 1.35;
  if (advantages[defender] === attacker) return 0.75;
  return 1;
}

function fighter(input: BattleParticipantInput, fallbackId: string): BattleFighter {
  const maxHp = Math.max(1, Math.round(input.health));
  return {
    id: input.assetId ?? input.formId ?? fallbackId,
    name: input.name,
    hp: maxHp,
    maxHp,
    hpRatio: 1,
    energy: 50,
    power: Math.max(1, Math.round(input.power)),
    guard: Math.max(0, Math.round(input.guard)),
    speed: Math.max(1, Math.round(input.speed)),
    element: battleElement(input.element),
    focus: 0,
    combo: 0,
    conditions: []
  };
}

function withHp(target: BattleFighter, hp: number) {
  const nextHp = Math.max(0, Math.min(target.maxHp, Math.round(hp)));
  return { ...target, hp: nextHp, hpRatio: nextHp / target.maxHp };
}

function roll(state: BattleState, action: string) {
  const digest = sha256PortableBasis(canonicalPortableCardJson({
    encounterSeed: state.encounterSeed,
    turn: state.turn,
    actorId: state.player.id,
    action,
    transcriptDigest: battleTranscriptDigest(state)
  }));
  return Number.parseInt(digest.slice(7, 15), 16) / 0xffffffff;
}

function intentFor(encounterSeed: string, wildId: string, turn: number): BattleIntent {
  const digest = sha256PortableBasis(canonicalPortableCardJson({ encounterSeed, wildId, turn, purpose: "wild-intent-v2" }));
  const value = Number.parseInt(digest.slice(0, 8), 16) % 6;
  if (value <= 2) return { kind: "strike", label: "Strike", detail: "A quick direct attack is coming.", power: 1 };
  if (value <= 4) return { kind: "break", label: "Break", detail: "A heavy hit will punish an open stance.", power: 1.28 };
  return { kind: "recover", label: "Recover", detail: "The wild is gathering itself behind a lighter attack.", power: 0.62 };
}

function nextIntent(state: BattleState, turn: number) {
  return intentFor(state.encounterSeed, state.wild.id, turn);
}

function tickConditions(fighterState: BattleFighter): BattleFighter {
  return {
    ...fighterState,
    conditions: fighterState.conditions.flatMap((condition) => condition.turns === 2 ? [{ ...condition, turns: 1 as const }] : [])
  };
}

function withCondition(fighterState: BattleFighter, condition: BattleCondition): BattleFighter {
  return {
    ...fighterState,
    conditions: [...fighterState.conditions.filter((candidate) => candidate.kind !== condition.kind), condition].slice(-3)
  };
}

function entry(state: BattleState, action: BattleAction["type"], detail: string, player: BattleFighter, wild: BattleFighter) {
  return [...state.transcript, { turn: state.turn, action, detail, playerHp: player.hp, wildHp: wild.hp }];
}

export function startWildBattle(input: {
  encounterSeed: string;
  player: BattleParticipantInput;
  wild: BattleParticipantInput;
}): BattleState {
  const wild = fighter(input.wild, "wild");
  return {
    encounterSeed: input.encounterSeed,
    phase: "player_turn",
    turn: 1,
    player: fighter(input.player, "player"),
    wild,
    intent: intentFor(input.encounterSeed, wild.id, 1),
    transcript: []
  };
}

export function battleTranscriptDigest(state: BattleState) {
  return sha256PortableBasis(canonicalPortableCardJson(state.transcript));
}

export function battleGrowthAwards(previous: BattleState, next: BattleState, options: { boss?: boolean } = {}): BattleGrowthAward[] {
  if (previous.phase === "capture_ready" || next.phase !== "capture_ready") return [];
  const digest = battleTranscriptDigest(next).slice(7, 23);
  const abilityCount = next.transcript.filter((item) => item.action === "ability").length;
  const comeback = next.player.hpRatio <= 0.3;
  const awards: BattleGrowthAward[] = [{
    kind: "battle_win",
    eventId: `battle_win:${next.encounterSeed}:${digest}`,
    amount: comeback ? 24 : 18,
    ...(options.boss ? { achievementId: `boss_victory:${next.encounterSeed}` } : comeback ? { achievementId: `comeback_victory:${next.encounterSeed}` } : {})
  }];
  if (abilityCount >= 2) awards.push({
    kind: "ability_mastery",
    eventId: `ability_mastery:${next.encounterSeed}:${digest}`,
    amount: Math.min(10, abilityCount * 2)
  });
  return awards;
}

function wildCounter(state: BattleState, player: BattleFighter, wild: BattleFighter, guarded: boolean) {
  const variance = Math.floor(roll(state, `wild:${guarded ? "guarded" : "open"}`) * 4);
  const breakIntent = state.intent.kind === "break";
  const effectiveGuard = breakIntent && !guarded ? player.guard * 0.45 : player.guard;
  const raw = 8 + Math.floor(wild.power * 0.18) - Math.floor(effectiveGuard * 0.08) + variance;
  const damage = Math.max(2, Math.round(raw * state.intent.power * (guarded ? (breakIntent ? 0.58 : 0.42) : 1)));
  return withHp(player, player.hp - damage);
}

export function applyBattleAction(state: BattleState, action: BattleAction): BattleState {
  if (state.phase === "captured" || state.phase === "fled" || state.phase === "defeated") return state;
  if (action.type === "capture" && state.wild.hpRatio > 0.3) return state;

  if (action.type === "switch") {
    const player = fighter(action.player, "player");
    const afterCounter = wildCounter(state, player, state.wild, false);
    const phase = afterCounter.hp === 0 ? "defeated" : state.wild.hpRatio <= 0.3 ? "capture_ready" : "player_turn";
    const turn = state.turn + 1;
    return { ...state, phase, turn, player: afterCounter, wild: tickConditions(state.wild), intent: nextIntent(state, turn), transcript: entry(state, "switch", `Switched to ${player.name}.`, afterCounter, state.wild) };
  }

  if (action.type === "capture") {
    const chance = state.wild.hpRatio <= 0.15 ? 1 : 0.58 + (0.3 - state.wild.hpRatio) * 1.4;
    if (roll(state, "capture") <= chance) {
      return { ...state, phase: "captured", transcript: entry(state, "capture", "Capture locked.", state.player, state.wild) };
    }
    const player = wildCounter(state, state.player, state.wild, false);
    const turn = state.turn + 1;
    return {
      ...state,
      phase: player.hp === 0 ? "defeated" : "capture_ready",
      turn,
      player,
      wild: tickConditions(state.wild),
      intent: nextIntent(state, turn),
      transcript: entry(state, "capture", "The wild creature broke free.", player, state.wild)
    };
  }

  if (action.type === "focus") {
    const prepared = {
      ...state.player,
      energy: Math.min(50, state.player.energy + 10),
      focus: Math.min(3, state.player.focus + 1),
      combo: Math.min(9, state.player.combo + 1)
    };
    const player = wildCounter(state, prepared, state.wild, true);
    const turn = state.turn + 1;
    return {
      ...state,
      phase: player.hp === 0 ? "defeated" : state.wild.hpRatio <= 0.3 ? "capture_ready" : "player_turn",
      turn,
      player,
      wild: tickConditions(state.wild),
      intent: nextIntent(state, turn),
      transcript: entry(state, "focus", "Focused through the telegraph and built combo.", player, state.wild)
    };
  }

  if (action.type === "guard") {
    const energized = { ...state.player, energy: Math.min(50, state.player.energy + 16) };
    const player = wildCounter(state, energized, state.wild, true);
    const turn = state.turn + 1;
    return {
      ...state,
      phase: player.hp === 0 ? "defeated" : state.wild.hpRatio <= 0.3 ? "capture_ready" : "player_turn",
      turn,
      player,
      wild: tickConditions(state.wild),
      intent: nextIntent(state, turn),
      transcript: entry(state, "guard", "Guarded and recovered energy.", player, state.wild)
    };
  }

  const cost = action.slot === 0 ? 12 : 18;
  if (state.player.energy < cost) return state;
  const variance = Math.floor(roll(state, `ability:${action.slot}`) * 4);
  const critical = roll(state, `critical:${action.slot}`) > 0.88;
  const charged = action.slot === 1 && state.player.focus >= 2;
  const guardBroken = state.wild.conditions.some((condition) => condition.kind === "guard_broken");
  const defense = guardBroken ? state.wild.guard * 0.45 : state.wild.guard;
  const effectiveness = elementEffectiveness(state.player.element, state.wild.element);
  const raw = 8 + Math.floor(state.player.power * (action.slot === 0 ? 0.18 : 0.24)) - Math.floor(defense * 0.08) + variance;
  const damage = Math.max(3, Math.round(raw * effectiveness * (critical ? 1.45 : 1) * (charged ? 1.3 : 1)));
  let wild = withHp(tickConditions(state.wild), state.wild.hp - damage);
  if (effectiveness > 1 && action.slot === 0) wild = withCondition(wild, { kind: elementConditions[state.player.element], turns: 2 });
  if (charged) wild = withCondition(wild, { kind: "guard_broken", turns: 2 });
  const spent = {
    ...state.player,
    energy: state.player.energy - cost,
    focus: charged ? 0 : state.player.focus,
    combo: Math.min(9, state.player.combo + 1)
  };
  if (wild.hp === 0) {
    return { ...state, phase: "fled", turn: state.turn + 1, player: spent, wild, transcript: entry(state, "ability", "The wild creature was knocked out and fled.", spent, wild) };
  }
  const player = wildCounter(state, spent, wild, false);
  const recovered = { ...player, energy: Math.min(50, player.energy + 4) };
  const phase = player.hp === 0 ? "defeated" : wild.hpRatio <= 0.3 ? "capture_ready" : "player_turn";
  const turn = state.turn + 1;
  const effectivenessLabel = effectiveness > 1 ? "Super effective " : effectiveness < 1 ? "Resisted " : "";
  return {
    ...state,
    phase,
    turn,
    player: recovered,
    wild,
    intent: nextIntent(state, turn),
    transcript: entry(state, "ability", `${effectivenessLabel}${critical ? "critical " : ""}ability dealt ${damage}${charged ? " and broke guard" : ""}.`, recovered, wild)
  };
}
