import type { CreatureStats } from "../creature-catalog";
import type { MarketCardCapability, MarketRole, MarketVerb } from "./card-role";
import type { MarketObjectiveDefinition } from "./contract-director";

export type MarketPhysicalActionResult = Readonly<{
  success: true;
  stat: keyof CreatureStats;
  role: MarketRole;
  margin: number;
  staminaCost: number;
  cooldownTicks: number;
  explanation: string;
}>;

export type MarketPhysicalActionInput = Readonly<{
  card: MarketCardCapability;
  objective: MarketObjectiveDefinition;
  player: Readonly<{ x: number; z: number }>;
  verb: MarketVerb;
  timingOffsetMs: number;
  stamina: number;
  cooldownTicks: number;
}>;

const VERB_RULES: Readonly<Record<MarketVerb, { stat: keyof CreatureStats; role: MarketRole; stamina: number; cooldown: number }>> = {
  inspect: { stat: "bond", role: "appraiser", stamina: 6, cooldown: 2 },
  "read-tell": { stat: "bond", role: "broker", stamina: 8, cooldown: 2 },
  preserve: { stat: "bond", role: "appraiser", stamina: 12, cooldown: 3 },
  power: { stat: "power", role: "carrier", stamina: 16, cooldown: 4 },
  brace: { stat: "guard", role: "guardian", stamina: 14, cooldown: 3 },
  clear: { stat: "power", role: "carrier", stamina: 16, cooldown: 4 },
  overfly: { stat: "speed", role: "scout", stamina: 18, cooldown: 4 },
  carry: { stat: "power", role: "carrier", stamina: 10, cooldown: 3 },
  "heavy-carry": { stat: "power", role: "carrier", stamina: 20, cooldown: 5 },
  guard: { stat: "guard", role: "guardian", stamina: 12, cooldown: 3 },
  repair: { stat: "power", role: "carrier", stamina: 15, cooldown: 4 },
  appraise: { stat: "bond", role: "appraiser", stamina: 10, cooldown: 3 },
  balance: { stat: "speed", role: "scout", stamina: 10, cooldown: 3 },
};

export function resolveMarketPhysicalAction(input: MarketPhysicalActionInput): MarketPhysicalActionResult {
  const distance = Math.hypot(input.player.x - input.objective.position.x, input.player.z - input.objective.position.z);
  if (!Number.isFinite(distance) || distance > 1.25) throw new Error("market_action_out_of_range");
  if (!Number.isFinite(input.timingOffsetMs) || Math.abs(input.timingOffsetMs) > 320) throw new Error("market_action_timing_missed");
  const rule = VERB_RULES[input.verb];
  if (!Number.isFinite(input.stamina) || input.stamina < rule.stamina) throw new Error("market_action_stamina_low");
  if (!Number.isSafeInteger(input.cooldownTicks) || input.cooldownTicks > 0) throw new Error("market_action_cooldown");
  if (!input.card.playable || !input.card.verbs.has(input.verb) || input.objective.requiredVerb !== input.verb) throw new Error("market_action_verb_unavailable");
  const roleBonus = input.card.roles[0] === rule.role ? 24 : input.card.roles[1] === rule.role ? 12 : 0;
  const timingBonus = Math.round(32 * (1 - Math.abs(input.timingOffsetMs) / 320));
  const margin = input.card.stats[rule.stat] + roleBonus + timingBonus;
  return {
    success: true,
    stat: rule.stat,
    role: rule.role,
    margin,
    staminaCost: rule.stamina,
    cooldownTicks: rule.cooldown,
    explanation: `${input.verb} succeeded from ${rule.stat} ${input.card.stats[rule.stat]}, ${rule.role} role fit, and ${Math.abs(input.timingOffsetMs)}ms timing.`,
  };
}
