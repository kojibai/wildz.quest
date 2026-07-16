import { hearttreeAbilityById, type HearttreeAbilityDefinition } from "./ability-registry";
import { assertHearttreeCardPlayable, type HearttreeCardCapability } from "./card-capability";

export type HearttreeActionKind = "ability" | "dodge" | "guard" | "environment" | "support";
export type HearttreeObstacle = "none" | "root-wall" | "root-channel" | "root-gap" | "root-anchor";

export type HearttreeActionContext = Readonly<{
  kind: HearttreeActionKind;
  actor: HearttreeCardCapability;
  abilityId: string | null;
  stamina: number;
  cooldownRemainingMs: number;
  distance: number;
  lineOfSight: boolean;
  timing: Readonly<{ pressedAtMs: number; windowStartMs: number; windowEndMs: number }>;
  target: Readonly<{ id: string; element: string; guard: number; exposed: boolean }>;
  environment: Readonly<{ obstacle: HearttreeObstacle; element: string }>;
}>;

export type HearttreeActionEffect = Readonly<{
  kind: "damage" | "guard" | "dodge" | "break" | "reveal" | "support" | "bind" | "cleanse" | "energize";
  amount: number;
  targetId: string;
}>;

export type HearttreeActionOutcome = Readonly<{
  success: boolean;
  margin: number;
  staminaCost: number;
  cooldownMs: number;
  effects: readonly HearttreeActionEffect[];
  explanation: readonly { factor: string; value: number; message: string }[];
  failure: "dead" | "stamina" | "cooldown" | "range" | "line_of_sight" | "timing" | "capability" | null;
}>;

const elementAdvantages: Readonly<Record<string, string>> = {
  Grove: "Stone",
  Stone: "Spark",
  Spark: "Tide",
  Tide: "Ember",
  Ember: "Grove",
  Prism: "Prism"
};

function finite(value: number, error: string) {
  if (!Number.isFinite(value)) throw new Error(error);
  return value;
}

function timingFactor(timing: HearttreeActionContext["timing"]) {
  const pressed = finite(timing.pressedAtMs, "hearttree_action_timing_invalid");
  const start = finite(timing.windowStartMs, "hearttree_action_timing_invalid");
  const end = finite(timing.windowEndMs, "hearttree_action_timing_invalid");
  if (end <= start || pressed < start || pressed > end) return 0;
  const center = (start + end) / 2;
  const half = (end - start) / 2;
  return 0.7 + 0.3 * (1 - Math.abs(pressed - center) / half);
}

function elementFactor(actor: string, target: string) {
  if (actor === target) return 1;
  if (elementAdvantages[actor] === target) return 1.2;
  if (elementAdvantages[target] === actor) return 0.85;
  return 1;
}

function failed(failure: HearttreeActionOutcome["failure"], explanation: HearttreeActionOutcome["explanation"]): HearttreeActionOutcome {
  return { success: false, margin: -1, staminaCost: 0, cooldownMs: 0, effects: [], explanation, failure };
}

function abilityEffect(ability: HearttreeAbilityDefinition, amount: number, targetId: string): HearttreeActionEffect {
  const tag = ability.tags[0];
  const kind = tag === "guard" || tag === "break" || tag === "reveal" || tag === "support" || tag === "bind" || tag === "cleanse" || tag === "energize"
    ? tag
    : "damage";
  return { kind, amount, targetId };
}

export function resolveHearttreeAction(context: HearttreeActionContext): HearttreeActionOutcome {
  try {
    assertHearttreeCardPlayable(context.actor);
  } catch {
    return failed("dead", [{ factor: "life", value: 0, message: "The admitted card is not alive." }]);
  }
  const stamina = finite(context.stamina, "hearttree_action_stamina_invalid");
  const cooldown = finite(context.cooldownRemainingMs, "hearttree_action_cooldown_invalid");
  const distance = finite(context.distance, "hearttree_action_distance_invalid");
  const timing = timingFactor(context.timing);
  const explanation = [{ factor: "timing", value: timing, message: timing ? "Input landed inside the readable action window." : "Input missed the action window." }];
  if (!timing) return failed("timing", explanation);
  if (cooldown > 0) return failed("cooldown", explanation);

  if (context.kind === "dodge") {
    if (stamina < 12) return failed("stamina", explanation);
    const margin = context.actor.stats.speed + timing * 20 - 40;
    return {
      success: margin >= 0,
      margin,
      staminaCost: 12,
      cooldownMs: 650,
      effects: margin >= 0 ? [{ kind: "dodge", amount: Math.round(margin), targetId: context.actor.assetId }] : [],
      explanation: [...explanation, { factor: "speed", value: context.actor.stats.speed, message: "Real card speed sets dodge distance and safety margin." }],
      failure: margin >= 0 ? null : "capability"
    };
  }

  if (context.kind === "guard") {
    if (stamina < 10) return failed("stamina", explanation);
    const margin = context.actor.stats.guard + context.actor.stats.bond * 0.2 + timing * 10 - context.target.guard;
    return {
      success: margin >= 0,
      margin,
      staminaCost: 10,
      cooldownMs: 500,
      effects: margin >= 0 ? [{ kind: "guard", amount: Math.round(margin), targetId: context.actor.assetId }] : [],
      explanation: [...explanation, { factor: "guard", value: context.actor.stats.guard, message: "Real guard and bond determine protection." }],
      failure: margin >= 0 ? null : "capability"
    };
  }

  if (context.kind === "environment") {
    if (stamina < 8) return failed("stamina", explanation);
    const obstacle = context.environment.obstacle;
    const required = obstacle === "root-wall" ? "break" : obstacle === "root-channel" ? "narrow" : obstacle === "root-gap" ? "flight" : obstacle === "root-anchor" ? "anchor" : "ground";
    const success = context.actor.traversal.has(required);
    const margin = success ? context.actor.stats.power - 30 : -30;
    return {
      success,
      margin,
      staminaCost: success ? 8 : 0,
      cooldownMs: success ? 400 : 0,
      effects: success ? [{ kind: obstacle === "root-wall" ? "break" : "reveal", amount: Math.max(1, Math.round(margin)), targetId: obstacle }] : [],
      explanation: [...explanation, { factor: "anatomy", value: success ? 1 : 0, message: `${required} capability ${success ? "matches" : "does not match"} ${obstacle}.` }],
      failure: success ? null : "capability"
    };
  }

  if (!context.abilityId) throw new Error("hearttree_ability_required");
  const ability = hearttreeAbilityById(context.actor, context.abilityId);
  const element = elementFactor(ability.element, context.target.element);
  explanation.push({ factor: "element", value: element, message: `Element matchup ${ability.element} against ${context.target.element}.` });
  if (stamina < ability.staminaCost) return failed("stamina", explanation);
  if (distance > ability.range) return failed("range", explanation);
  if (!context.lineOfSight) return failed("line_of_sight", explanation);
  const potential = (ability.power + context.actor.stats.power * 0.45 + context.actor.stats.bond * 0.15) * element * timing;
  const threshold = Math.max(1, context.target.guard - (context.target.exposed ? 12 : 0));
  const margin = potential - threshold;
  return {
    success: margin >= 0,
    margin,
    staminaCost: ability.staminaCost,
    cooldownMs: ability.cooldownMs,
    effects: margin >= 0 ? [abilityEffect(ability, Math.max(1, Math.round(potential)), context.target.id)] : [],
    explanation: [
      ...explanation,
      { factor: "ability", value: ability.power, message: `${ability.sourceName} uses its real catalog power.` },
      { factor: "power", value: context.actor.stats.power, message: "Real card power scales the committed action." },
      { factor: "bond", value: context.actor.stats.bond, message: "Bond improves command execution." },
      { factor: "position", value: distance, message: `Target is ${distance.toFixed(2)} units away within ${ability.range.toFixed(2)} range.` }
    ],
    failure: margin >= 0 ? null : "capability"
  };
}
