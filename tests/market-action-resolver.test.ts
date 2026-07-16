import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMarketPhysicalAction } from "../src/features/play/market/action-resolver";
import { marketNegotiationFixture } from "./support/market-fixtures";

describe("Wayfarer physical action resolution", () => {
  it("requires the active card's exact verb, position, timing, stamina, and cooldown", () => {
    const { contract, stoneCarrier } = marketNegotiationFixture();
    const objective = contract.objectives[1]!;
    assert.throws(() => resolveMarketPhysicalAction({
      card: stoneCarrier,
      objective,
      player: { x: objective.position.x + 4, z: objective.position.z },
      verb: objective.requiredVerb,
      timingOffsetMs: 0,
      stamina: 100,
      cooldownTicks: 0,
    }), /market_action_out_of_range/);
    assert.throws(() => resolveMarketPhysicalAction({
      card: stoneCarrier,
      objective,
      player: objective.position,
      verb: "overfly",
      timingOffsetMs: 0,
      stamina: 100,
      cooldownTicks: 0,
    }), /market_action_verb_unavailable/);
    assert.throws(() => resolveMarketPhysicalAction({
      card: stoneCarrier,
      objective,
      player: objective.position,
      verb: objective.requiredVerb,
      timingOffsetMs: 900,
      stamina: 100,
      cooldownTicks: 0,
    }), /market_action_timing_missed/);
    assert.throws(() => resolveMarketPhysicalAction({
      card: stoneCarrier,
      objective,
      player: objective.position,
      verb: objective.requiredVerb,
      timingOffsetMs: 0,
      stamina: 0,
      cooldownTicks: 0,
    }), /market_action_stamina_low/);
    assert.throws(() => resolveMarketPhysicalAction({
      card: stoneCarrier,
      objective,
      player: objective.position,
      verb: objective.requiredVerb,
      timingOffsetMs: 0,
      stamina: 100,
      cooldownTicks: 3,
    }), /market_action_cooldown/);
  });

  it("derives success margin and cost from the real matching stat and role", () => {
    const { contract, stoneCarrier } = marketNegotiationFixture();
    const objective = contract.objectives[1]!;
    const result = resolveMarketPhysicalAction({
      card: stoneCarrier,
      objective: { ...objective, requiredVerb: "heavy-carry" },
      player: objective.position,
      verb: "heavy-carry",
      timingOffsetMs: 20,
      stamina: 100,
      cooldownTicks: 0,
    });

    assert.equal(result.success, true);
    assert.equal(result.stat, "power");
    assert.ok(result.margin > 0);
    assert.ok(result.staminaCost >= 8);
    assert.ok(result.cooldownTicks >= 2);
    assert.match(result.explanation, /power.*carrier.*timing/i);
  });
});
