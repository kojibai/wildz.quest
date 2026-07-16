import type { CreatureStats } from "../creature-catalog";

export type AdventureLifeState = "alive" | "dead";
export type AdventureInjuryKind = "limb" | "wing" | "guard" | "focus";

export type AdventureInjury = Readonly<{
  id: string;
  kind: AdventureInjuryKind;
  severity: 1 | 2 | 3;
  sourceEventId: string;
}>;

export type AdventureRecovery = Readonly<{
  state: "stable" | "resting" | "treatment";
  trauma: number;
  lastEventId: string | null;
}>;

export type AdventureCardCondition = Readonly<{
  assetId: string;
  life: AdventureLifeState;
  fatigue: number;
  injuries: readonly AdventureInjury[];
  xp: Readonly<Record<string, number>>;
  mastery: Readonly<Record<string, number>>;
  upgradeIds: readonly string[];
  receiptDigests: readonly string[];
  retiredAt?: string;
  retirementCauseEventId?: string;
  recovery?: AdventureRecovery;
}>;

export type AdventureConditionDelta = Readonly<{
  assetId: string;
  lifeBefore: AdventureLifeState;
  lifeAfter: AdventureLifeState;
  fatigueDelta: number;
  injuriesAdded: readonly AdventureInjury[];
  xp: Readonly<Record<string, number>>;
  mastery: Readonly<Record<string, number>>;
  upgradeIdsAdded: readonly string[];
  receiptDigestsAdded: readonly string[];
}>;

function boundedInteger(value: number, minimum: number, maximum: number, error: string) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(error);
  return value;
}

function validatedProgressMap(value: Readonly<Record<string, number>>, maximum: number, error: string) {
  const entries = Object.entries(value);
  if (entries.length > 256) throw new Error(error);
  for (const [key, amount] of entries) {
    if (!/^[a-z0-9:_-]{1,96}$/i.test(key)) throw new Error(error);
    boundedInteger(amount, 0, maximum, error);
  }
}

function uniqueText(values: readonly string[], error: string) {
  if (values.length > 512) throw new Error(error);
  for (const value of values) if (!value.trim() || value.length > 160) throw new Error(error);
}

export function emptyAdventureCondition(assetId: string): AdventureCardCondition {
  const normalized = assetId.trim();
  if (!normalized) throw new Error("adventure_condition_asset_required");
  return {
    assetId: normalized,
    life: "alive",
    fatigue: 0,
    injuries: [],
    xp: {},
    mastery: {},
    upgradeIds: [],
    receiptDigests: [],
  };
}

export function validateAdventureCondition(condition: AdventureCardCondition): AdventureCardCondition {
  if (!condition.assetId.trim()) throw new Error("adventure_condition_asset_required");
  if (condition.life !== "alive" && condition.life !== "dead") throw new Error("adventure_condition_life_invalid");
  boundedInteger(condition.fatigue, 0, 100, "adventure_condition_fatigue_invalid");
  validatedProgressMap(condition.xp, 1_000_000, "adventure_condition_xp_invalid");
  validatedProgressMap(condition.mastery, 10_000, "adventure_condition_mastery_invalid");
  if (condition.injuries.length > 128) throw new Error("adventure_condition_injury_invalid");
  for (const injury of condition.injuries) {
    if (!injury.id.trim()
      || !injury.sourceEventId.trim()
      || !["limb", "wing", "guard", "focus"].includes(injury.kind)
      || ![1, 2, 3].includes(injury.severity)) {
      throw new Error("adventure_condition_injury_invalid");
    }
  }
  uniqueText(condition.upgradeIds, "adventure_condition_upgrade_invalid");
  uniqueText(condition.receiptDigests, "adventure_condition_receipt_invalid");
  if (condition.receiptDigests.some((digest) => !/^sha256:[a-f0-9]{64}$/.test(digest))) throw new Error("adventure_condition_receipt_invalid");
  const hasRetiredAt = condition.retiredAt !== undefined;
  const hasRetirementCause = condition.retirementCauseEventId !== undefined;
  if (hasRetiredAt !== hasRetirementCause
    || (hasRetiredAt && (!Number.isFinite(Date.parse(condition.retiredAt!))
      || condition.life !== "dead"
      || !condition.retirementCauseEventId!.trim()
      || condition.retirementCauseEventId!.length > 160))) {
    throw new Error("adventure_condition_retirement_invalid");
  }
  if (condition.recovery) {
    const { state, trauma, lastEventId } = condition.recovery;
    if (!["stable", "resting", "treatment"].includes(state)
      || !Number.isSafeInteger(trauma)
      || trauma < 0
      || trauma > 100
      || (lastEventId !== null && (!lastEventId.trim() || lastEventId.length > 160))) {
      throw new Error("adventure_condition_recovery_invalid");
    }
  }
  return condition;
}

function addProgress(
  prior: Readonly<Record<string, number>>,
  delta: Readonly<Record<string, number>>,
  maximum: number,
) {
  return Object.fromEntries([...new Set([...Object.keys(prior), ...Object.keys(delta)])].map((key) => [
    key,
    Math.min(maximum, (prior[key] ?? 0) + (delta[key] ?? 0)),
  ]));
}

function uniqueById<T extends { id: string }>(values: readonly T[]) {
  const unique = new Map<string, T>();
  for (const value of values) if (!unique.has(value.id)) unique.set(value.id, value);
  return [...unique.values()];
}

export function applyAdventureConditionDelta(
  prior: AdventureCardCondition,
  delta: AdventureConditionDelta,
): AdventureCardCondition {
  validateAdventureCondition(prior);
  if (prior.assetId !== delta.assetId || prior.life !== delta.lifeBefore) throw new Error("adventure_condition_prior_mismatch");
  if (prior.life === "dead" && delta.lifeAfter === "alive") throw new Error("adventure_death_irreversible");
  boundedInteger(delta.fatigueDelta, -100, 25, "adventure_condition_fatigue_delta_invalid");
  validatedProgressMap(delta.xp, 1_000_000, "adventure_condition_xp_invalid");
  validatedProgressMap(delta.mastery, 10_000, "adventure_condition_mastery_invalid");
  const next: AdventureCardCondition = {
    ...prior,
    life: delta.lifeAfter,
    fatigue: Math.max(0, Math.min(100, prior.fatigue + delta.fatigueDelta)),
    injuries: uniqueById([...prior.injuries, ...delta.injuriesAdded]),
    xp: addProgress(prior.xp, delta.xp, 1_000_000),
    mastery: addProgress(prior.mastery, delta.mastery, 10_000),
    upgradeIds: [...new Set([...prior.upgradeIds, ...delta.upgradeIdsAdded])],
    receiptDigests: [...new Set([...prior.receiptDigests, ...delta.receiptDigestsAdded])].slice(-512),
  };
  return validateAdventureCondition(next);
}

export function effectiveAdventureStats(base: CreatureStats, condition: AdventureCardCondition): CreatureStats {
  validateAdventureCondition(condition);
  const penalty = { health: Math.round(condition.fatigue * 0.15), power: 0, guard: 0, speed: 0, bond: 0 };
  for (const injury of condition.injuries) {
    if (injury.kind === "limb") penalty.speed += injury.severity * 6;
    if (injury.kind === "wing") penalty.speed += injury.severity * 8;
    if (injury.kind === "guard") penalty.guard += injury.severity * 8;
    if (injury.kind === "focus") penalty.bond += injury.severity * 7;
  }
  return {
    health: Math.max(1, base.health - penalty.health),
    power: Math.max(1, base.power - penalty.power),
    guard: Math.max(1, base.guard - penalty.guard),
    speed: Math.max(1, base.speed - penalty.speed),
    bond: Math.max(1, base.bond - penalty.bond),
  };
}
