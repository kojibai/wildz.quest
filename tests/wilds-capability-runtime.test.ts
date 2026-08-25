import assert from "node:assert/strict";
import test from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import {
  applyWildsCapabilityCost,
  createWildsCapabilityRuntime,
  toggleWildsSustainedCapability
} from "../src/features/play/wilds-capability-runtime";

test("capability work spends the declared small visible amount and advances matching mastery", () => {
  const prior = emptyAdventureCondition("asset:runtime");
  const next = applyWildsCapabilityCost(prior, "climb", 3);

  assert.equal(next.fatigue, 3);
  assert.equal(next.xp.climb, 1);
  assert.equal(next.mastery.climb, 1);
  assert.equal(prior.fatigue, 0);
});

test("sustained capability toggles are asset-bound and a second request stops cleanly", () => {
  const idle = createWildsCapabilityRuntime();
  const active = toggleWildsSustainedCapability(idle, { family: "light", assetId: "asset:runtime", targetId: null, startedAt: "2026-08-25T12:00:00.000Z" });
  const stopped = toggleWildsSustainedCapability(active, { family: "light", assetId: "asset:runtime", targetId: null, startedAt: "2026-08-25T12:00:01.000Z" });

  assert.equal(active.active?.family, "light");
  assert.equal(stopped.active, null);
});

test("invalid cost and a retired companion never enter the capability hot path", () => {
  assert.throws(() => applyWildsCapabilityCost(emptyAdventureCondition("asset:runtime"), "track", -1), /wilds_capability_cost_invalid/);
  const retired = { ...emptyAdventureCondition("asset:runtime"), life: "dead" as const, retiredAt: "2026-08-25T12:00:00.000Z", retirementCauseEventId: "retired:1" };
  assert.throws(() => applyWildsCapabilityCost(retired, "track", 1), /wilds_capability_companion_unavailable/);
});

