import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateMarketBoard } from "../src/features/play/market/contract-director";
import {
  createMarketNegotiation,
  resolveMarketNegotiation,
} from "../src/features/play/market/negotiation-resolver";
import { marketFixtureCards, marketFixtureInput } from "./support/market-fixtures";

function fixture() {
  const { groveScout, stoneCarrier } = marketFixtureCards();
  const contract = generateMarketBoard(marketFixtureInput([groveScout, stoneCarrier])).contracts[0];
  return { contract, groveScout, stoneCarrier };
}

describe("Wayfarer skill-based negotiation", () => {
  it("requires observed evidence and correct timing to change an exact term", () => {
    const { contract, groveScout } = fixture();
    const initial = createMarketNegotiation(contract);
    const routeIntel = contract.intelligence.find((node) => node.kind === "route")!;
    const blind = resolveMarketNegotiation({
      contract,
      state: initial,
      intelligenceIds: [],
      activeCard: groveScout,
      action: { kind: "counter", term: "route", timingOffsetMs: 20 },
    });
    const informed = resolveMarketNegotiation({
      contract,
      state: initial,
      intelligenceIds: [routeIntel.id],
      activeCard: groveScout,
      action: { kind: "counter", term: "route", timingOffsetMs: 20 },
    });

    assert.equal(blind.effects.length, 0);
    assert.equal(blind.state.terms.routeId, contract.routes[0]!.id);
    assert.equal(informed.effects.some((effect) => effect.kind === "route"), true);
    assert.equal(informed.state.terms.routeId, contract.routes[1]!.id);
    assert.match(informed.explanation, /route evidence.*timing/i);

    const late = resolveMarketNegotiation({
      contract,
      state: initial,
      intelligenceIds: [routeIntel.id],
      activeCard: groveScout,
      action: { kind: "counter", term: "route", timingOffsetMs: contract.negotiation.timingWindowMs + 1 },
    });
    assert.equal(late.effects.length, 0);
  });

  it("uses the selected card's real role, stats, and ability", () => {
    const { contract, groveScout, stoneCarrier } = fixture();
    const tell = contract.intelligence.find((node) => node.kind === "merchant-tell")!;
    const grove = resolveMarketNegotiation({
      contract,
      state: createMarketNegotiation(contract),
      intelligenceIds: [tell.id],
      activeCard: groveScout,
      action: { kind: "counter", term: "reward", timingOffsetMs: 0 },
    });
    const stone = resolveMarketNegotiation({
      contract,
      state: createMarketNegotiation(contract),
      intelligenceIds: [tell.id],
      activeCard: stoneCarrier,
      action: { kind: "counter", term: "reward", timingOffsetMs: 0 },
    });

    assert.ok(grove.margin !== stone.margin);
    assert.equal(grove.effects.length > stone.effects.length, true);

    const ability = groveScout.abilities[0].name;
    const invoked = resolveMarketNegotiation({
      contract,
      state: createMarketNegotiation(contract),
      intelligenceIds: [tell.id],
      activeCard: groveScout,
      action: { kind: "ability", assetId: groveScout.assetId, abilityName: ability, timingOffsetMs: 0 },
    });
    assert.equal(invoked.effects.some((effect) => effect.kind === "trust"), true);
    assert.throws(() => resolveMarketNegotiation({
      contract,
      state: createMarketNegotiation(contract),
      intelligenceIds: [tell.id],
      activeCard: groveScout,
      action: { kind: "ability", assetId: groveScout.assetId, abilityName: "Invented Ability", timingOffsetMs: 0 },
    }), /market_negotiation_ability_invalid/);
  });

  it("supports bundle, commit, and walk-away with bounded exchanges", () => {
    const { contract, groveScout } = fixture();
    const cargo = contract.intelligence.find((node) => node.kind === "cargo")!;
    const bundled = resolveMarketNegotiation({
      contract,
      state: createMarketNegotiation(contract),
      intelligenceIds: [cargo.id],
      activeCard: groveScout,
      action: { kind: "bundle", intelligenceId: cargo.id },
    });
    assert.equal(bundled.effects.some((effect) => effect.kind === "cargo"), true);

    const committed = resolveMarketNegotiation({
      contract,
      state: bundled.state,
      intelligenceIds: [cargo.id],
      activeCard: groveScout,
      action: { kind: "commit" },
    });
    assert.equal(committed.state.phase, "accepted");

    const walked = resolveMarketNegotiation({
      contract,
      state: createMarketNegotiation(contract),
      intelligenceIds: [],
      activeCard: groveScout,
      action: { kind: "walk-away" },
    });
    assert.equal(walked.state.phase, "walked-away");
    assert.throws(() => resolveMarketNegotiation({
      contract,
      state: committed.state,
      intelligenceIds: [],
      activeCard: groveScout,
      action: { kind: "commit" },
    }), /market_negotiation_closed/);
  });

  it("returns identical state, effects, margin, and explanation for identical inputs", () => {
    const { contract, groveScout } = fixture();
    const demand = contract.intelligence.find((node) => node.kind === "demand")!;
    const input = {
      contract,
      state: createMarketNegotiation(contract),
      intelligenceIds: [demand.id],
      activeCard: groveScout,
      action: { kind: "counter" as const, term: "cargo" as const, timingOffsetMs: 35 },
    };
    assert.deepEqual(resolveMarketNegotiation(input), resolveMarketNegotiation(input));
  });
});
