import { applyAdventureConditionDelta, type AdventureCardCondition } from "./adventure/card-condition";
import type { WildsWorldCapabilityFamily } from "./wilds-world-capability-registry";

export type WildsSustainedCapability = Readonly<{
  family: WildsWorldCapabilityFamily;
  assetId: string;
  targetId: string | null;
  startedAt: string;
}>;

export type WildsCapabilityRuntime = Readonly<{
  active: WildsSustainedCapability | null;
  revision: number;
}>;

export function createWildsCapabilityRuntime(): WildsCapabilityRuntime {
  return Object.freeze({ active: null, revision: 0 });
}

export function toggleWildsSustainedCapability(
  runtime: WildsCapabilityRuntime,
  next: WildsSustainedCapability
): WildsCapabilityRuntime {
  if (!next.assetId.trim() || !Number.isFinite(Date.parse(next.startedAt))) throw new Error("wilds_capability_runtime_invalid");
  const same = runtime.active?.assetId === next.assetId && runtime.active.family === next.family;
  return Object.freeze({
    active: same ? null : Object.freeze({ ...next }),
    revision: runtime.revision + 1
  });
}

export function applyWildsCapabilityCost(
  condition: AdventureCardCondition,
  family: WildsWorldCapabilityFamily,
  amount: number
): AdventureCardCondition {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 25) throw new Error("wilds_capability_cost_invalid");
  if (condition.life === "dead" || condition.retiredAt) throw new Error("wilds_capability_companion_unavailable");
  return applyAdventureConditionDelta(condition, {
    assetId: condition.assetId,
    lifeBefore: condition.life,
    lifeAfter: condition.life,
    fatigueDelta: amount,
    injuriesAdded: [],
    xp: { [family]: amount > 0 ? 1 : 0 },
    mastery: { [family]: amount > 0 ? 1 : 0 },
    upgradeIdsAdded: [],
    receiptDigestsAdded: []
  });
}

