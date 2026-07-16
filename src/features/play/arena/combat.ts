import type { ArenaFighterDefinition } from "./card-fighter";
import type { ArenaVec3 } from "./rules";

export type ArenaCombatIntent =
  | Readonly<{ kind: "light" | "heavy"; direction: ArenaVec3 }>
  | Readonly<{ kind: "guard" | "parry" | "dodge"; direction: ArenaVec3 }>
  | Readonly<{ kind: "focus" }>
  | Readonly<{ kind: "ability"; slot: 0 | 1; targetId: string | null }>;

export type ArenaActionKind = "idle" | ArenaCombatIntent["kind"];
export type ArenaActionState = Readonly<{
  kind: ArenaActionKind;
  startedFrame: number;
  activeFrom: number;
  activeUntil: number;
  recoverUntil: number;
  comboIndex: number;
  direction: ArenaVec3;
  abilitySlot: 0 | 1 | null;
  abilityName: string | null;
  abilityPower: number;
  damageScale: number;
  breakScale: number;
  launchScale: number;
  priority: number;
}>;

export type ArenaStatus = Readonly<{
  kind: "element" | "guard-broken";
  sourceElement: string;
  expiresFrame: number;
}>;

export type ArenaCombatantState = Readonly<{
  vitality: number;
  break: number;
  stamina: number;
  focus: number;
  combo: number;
  action: ArenaActionState;
  cooldowns: readonly [number, number];
  statuses: readonly ArenaStatus[];
}>;

export type ArenaCombatContext = Readonly<{ actor: ArenaFighterDefinition; state: ArenaCombatantState; frame: number }>;
export type ArenaActionResolution = Readonly<{ state: ArenaCombatantState; action: ArenaActionState }>;
export type ArenaHitContext = Readonly<{
  frame: number;
  attacker: ArenaFighterDefinition;
  attackerState: ArenaCombatantState;
  attackerPosition: ArenaVec3;
  target: ArenaFighterDefinition;
  targetState: ArenaCombatantState;
  targetPosition: ArenaVec3;
}>;
export type ArenaHitOutcome = "hit" | "guarded" | "parried" | "dodged" | "miss" | "inactive";
export type ArenaHitResolution = Readonly<{
  outcome: ArenaHitOutcome;
  targetState: ArenaCombatantState;
  vitalityDamage: number;
  breakDamage: number;
  launch: Readonly<ArenaVec3 & { length: number }>;
  statusesAdded: readonly ArenaStatus[];
  breakBroken: boolean;
  knockedOut: boolean;
}>;

const idleAction: ArenaActionState = {
  kind: "idle", startedFrame: 0, activeFrom: 0, activeUntil: 0, recoverUntil: 0,
  comboIndex: 0, direction: { x: 0, y: 0, z: 1 }, abilitySlot: null,
  abilityName: null, abilityPower: 0, damageScale: 0, breakScale: 0, launchScale: 0, priority: 0,
};

const elementAdvantage: Readonly<Record<string, string>> = {
  Grove: "Tide", Tide: "Ember", Ember: "Grove", Spark: "Stone", Stone: "Prism", Prism: "Spark",
};

function effectiveness(attacker: string, defender: string) {
  if (elementAdvantage[attacker] === defender) return 1.2;
  if (elementAdvantage[defender] === attacker) return 0.82;
  return 1;
}

function direction(value: ArenaVec3) {
  const length = Math.hypot(value.x, value.y, value.z);
  if (![value.x, value.y, value.z].every(Number.isFinite) || length > 1.001 || length < 0.05) throw new Error("arena_combat_direction_invalid");
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

export function createArenaCombatantState(actor: ArenaFighterDefinition): ArenaCombatantState {
  return { vitality: actor.maxVitality, break: actor.maxBreak, stamina: 100, focus: 0, combo: 0, action: idleAction, cooldowns: [0, 0], statuses: [] };
}

function actionBasis(context: ArenaCombatContext, intent: ArenaCombatIntent) {
  const { frame, state, actor } = context;
  if (!Number.isSafeInteger(frame) || frame < 0) throw new Error("arena_combat_frame_invalid");
  if (state.vitality <= 0) throw new Error("arena_combat_actor_knocked_out");
  if (state.action.kind !== "idle" && frame <= state.action.recoverUntil) throw new Error("arena_combat_action_locked");
  const baseDirection = intent.kind === "focus" || intent.kind === "ability" ? state.action.direction : direction(intent.direction);
  if (intent.kind === "light") return { cost: 4, windup: 3, active: 3, recovery: 10, damage: 0.52, breaking: 0.42, launch: 0.28, priority: 1, direction: baseDirection };
  if (intent.kind === "heavy") return { cost: 14, windup: 11, active: 4, recovery: 22, damage: 0.88, breaking: 1.05, launch: 1.18, priority: 3, direction: baseDirection };
  if (intent.kind === "guard") return { cost: 0, windup: 0, active: 30, recovery: 3, damage: 0, breaking: 0, launch: 0, priority: 0, direction: baseDirection };
  if (intent.kind === "parry") return { cost: 8, windup: 1, active: 3, recovery: 18, damage: 0, breaking: 0, launch: 0, priority: 4, direction: baseDirection };
  if (intent.kind === "dodge") return { cost: 12, windup: 0, active: 8, recovery: 14, damage: 0, breaking: 0, launch: 0, priority: 4, direction: baseDirection };
  if (intent.kind === "focus") return { cost: 0, windup: 0, active: 12, recovery: 12, damage: 0, breaking: 0, launch: 0, priority: 0, direction: baseDirection };
  if (intent.kind !== "ability") throw new Error("arena_combat_intent_invalid");
  const slot = intent.slot;
  if (state.cooldowns[slot] > frame) throw new Error("arena_combat_cooldown");
  return {
    cost: slot === 0 ? 22 : 30,
    windup: slot === 0 ? 8 : 14,
    active: slot === 0 ? 6 : 8,
    recovery: slot === 0 ? 18 : 28,
    damage: slot === 0 ? 0.58 : 0.72,
    breaking: slot === 0 ? 0.62 : 0.85,
    launch: slot === 0 ? 0.65 : 0.92,
    priority: slot === 0 ? 2 : 3,
    direction: baseDirection,
    abilityName: actor.abilityNames[slot],
    abilityPower: actor.abilityPowers[slot],
  };
}

export function beginArenaAction(context: ArenaCombatContext, intent: ArenaCombatIntent): ArenaActionResolution {
  const basis = actionBasis(context, intent);
  if (context.state.stamina < basis.cost) throw new Error("arena_combat_stamina");
  const comboIndex = intent.kind === "light"
    ? (context.frame <= context.state.action.recoverUntil + 8 ? Math.min(3, Math.max(1, context.state.action.comboIndex + 1)) : 1)
    : 0;
  const action: ArenaActionState = {
    kind: intent.kind,
    startedFrame: context.frame,
    activeFrom: context.frame + basis.windup,
    activeUntil: context.frame + basis.windup + basis.active,
    recoverUntil: context.frame + basis.windup + basis.active + basis.recovery,
    comboIndex,
    direction: basis.direction,
    abilitySlot: intent.kind === "ability" ? intent.slot : null,
    abilityName: basis.abilityName ?? null,
    abilityPower: basis.abilityPower ?? 0,
    damageScale: basis.damage,
    breakScale: basis.breaking,
    launchScale: basis.launch,
    priority: basis.priority,
  };
  const cooldowns: [number, number] = [...context.state.cooldowns];
  if (intent.kind === "ability") cooldowns[intent.slot] = action.recoverUntil + (intent.slot === 0 ? 90 : 150);
  return {
    action,
    state: {
      ...context.state,
      stamina: context.state.stamina - basis.cost,
      focus: intent.kind === "focus" ? Math.min(100, context.state.focus + 18) : context.state.focus,
      combo: comboIndex,
      action,
      cooldowns,
      statuses: context.state.statuses.filter((status) => status.expiresFrame > context.frame),
    },
  };
}

function emptyHit(outcome: ArenaHitOutcome, state: ArenaCombatantState): ArenaHitResolution {
  return { outcome, targetState: state, vitalityDamage: 0, breakDamage: 0, launch: { x: 0, y: 0, z: 0, length: 0 }, statusesAdded: [], breakBroken: state.break === 0, knockedOut: state.vitality === 0 };
}

function defensiveOutcome(context: ArenaHitContext) {
  const action = context.targetState.action;
  const active = context.frame >= action.activeFrom && context.frame <= action.activeUntil;
  if (!active) return null;
  if (action.kind === "dodge") return "dodged" as const;
  if (action.kind === "parry" && action.priority >= context.attackerState.action.priority) return "parried" as const;
  if (action.kind === "guard") return "guarded" as const;
  return null;
}

export function resolveArenaHit(context: ArenaHitContext): ArenaHitResolution {
  const action = context.attackerState.action;
  if (context.frame < action.activeFrom || context.frame > action.activeUntil || !["light", "heavy", "ability"].includes(action.kind)) return emptyHit("inactive", context.targetState);
  const delta = { x: context.targetPosition.x - context.attackerPosition.x, y: context.targetPosition.y - context.attackerPosition.y, z: context.targetPosition.z - context.attackerPosition.z };
  const distance = Math.hypot(delta.x, delta.y, delta.z);
  const range = context.attacker.reach * (action.kind === "heavy" ? 1.14 : action.kind === "ability" ? 1.3 : 1);
  if (distance > range + context.target.collision.radius) return emptyHit("miss", context.targetState);
  const defense = defensiveOutcome(context);
  if (defense === "dodged" || defense === "parried") return emptyHit(defense, context.targetState);
  const element = effectiveness(context.attacker.element, context.target.element);
  const abilityDamage = action.abilityPower * (action.kind === "ability" ? 0.42 : 0);
  const rawVitality = Math.max(2, context.attacker.stats.power * action.damageScale + abilityDamage - context.target.stats.guard * 0.11);
  const rawBreak = Math.max(1, context.attacker.stats.power * action.breakScale + abilityDamage * 0.35 - context.target.stats.guard * 0.04);
  const vitalityDamage = Math.max(defense === "guarded" ? 1 : 2, Math.round(rawVitality * element * (defense === "guarded" ? 0.28 : 1)));
  const breakDamage = Math.max(1, Math.round(rawBreak * (defense === "guarded" ? 0.78 : 1)));
  const vitality = Math.max(0, context.targetState.vitality - vitalityDamage);
  const broken = Math.max(0, context.targetState.break - breakDamage);
  const directionLength = Math.hypot(action.direction.x, action.direction.z) || 1;
  const launchLength = Number((action.launchScale * (context.attacker.mass / context.target.mass) * (1 + Math.max(0, context.attacker.stats.power - context.target.stats.guard) / 180)).toFixed(3));
  const launch = {
    x: Number((action.direction.x / directionLength * launchLength).toFixed(3)),
    y: Number((launchLength * (action.kind === "heavy" ? 0.55 : 0.28)).toFixed(3)),
    z: Number((action.direction.z / directionLength * launchLength).toFixed(3)),
    length: launchLength,
  };
  const statusesAdded: ArenaStatus[] = action.kind === "ability"
    ? [{ kind: "element", sourceElement: context.attacker.element, expiresFrame: context.frame + 120 }]
    : [];
  if (broken === 0 && context.targetState.break > 0) statusesAdded.push({ kind: "guard-broken", sourceElement: context.attacker.element, expiresFrame: context.frame + 90 });
  const targetState = { ...context.targetState, vitality, break: broken, statuses: [...context.targetState.statuses, ...statusesAdded] };
  return {
    outcome: defense === "guarded" ? "guarded" : "hit",
    targetState,
    vitalityDamage,
    breakDamage,
    launch,
    statusesAdded,
    breakBroken: broken === 0,
    knockedOut: vitality === 0,
  };
}
