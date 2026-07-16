import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMarketNegotiation } from "../src/features/play/market/negotiation-resolver";
import {
  createMarketRuntime,
  marketRuntimeStateDigest,
  stepMarketRuntime,
  type MarketInput,
  type MarketRuntimeState,
} from "../src/features/play/market/runtime";
import { marketNegotiationFixture } from "./support/market-fixtures";

type MarketInputIntent = MarketInput extends infer Value ? Value extends MarketInput ? Omit<Value, "sequence" | "tick"> : never : never;

function apply(state: MarketRuntimeState, input: MarketInputIntent) {
  return stepMarketRuntime(state, { ...input, sequence: state.sequence + 1, tick: state.tick + 1 } as MarketInput);
}

function moveNear(state: MarketRuntimeState, target: { x: number; z: number }) {
  let next = state;
  for (let index = 0; index < 40 && Math.hypot(next.player.x - target.x, next.player.z - target.z) > 1; index += 1) {
    next = apply(next, { kind: "move", vector: { x: Math.sign(target.x - next.player.x), z: Math.sign(target.z - next.player.z) } });
  }
  return next;
}

function acceptedRuntime() {
  const { contract, groveScout, stoneCarrier } = marketNegotiationFixture();
  let state = createMarketRuntime(contract, createMarketNegotiation(contract).terms, [groveScout, stoneCarrier]);
  const cargoIntel = contract.intelligence.find((node) => node.kind === "cargo")!;
  state = moveNear(state, cargoIntel.position);
  state = apply(state, { kind: "inspect", targetId: cargoIntel.id });
  state = apply(state, { kind: "negotiate", action: { kind: "commit" } });
  return { contract, groveScout, stoneCarrier, state };
}

describe("Wayfarer fixed-step runtime", () => {
  it("moves from real speed, bounds coordinates, and rejects invalid sequencing", () => {
    const { contract, groveScout, stoneCarrier } = marketNegotiationFixture();
    const initial = createMarketRuntime(contract, createMarketNegotiation(contract).terms, [groveScout, stoneCarrier]);
    const moved = apply(initial, { kind: "move", vector: { x: 1, z: 0 } });
    assert.ok(moved.player.x > initial.player.x);
    assert.equal(moved.inputs.length, 1);
    assert.throws(() => stepMarketRuntime(moved, { sequence: moved.sequence, tick: moved.tick + 1, kind: "move", vector: { x: 1, z: 0 } }), /market_input_sequence_invalid/);
    assert.throws(() => stepMarketRuntime(moved, { sequence: moved.sequence + 1, tick: moved.tick + 1, kind: "move", vector: { x: Number.NaN, z: 0 } }), /market_input_vector_invalid/);
  });

  it("makes spatial intelligence causally available to negotiation", () => {
    const { contract, groveScout, stoneCarrier } = marketNegotiationFixture();
    let state = createMarketRuntime(contract, createMarketNegotiation(contract).terms, [groveScout, stoneCarrier]);
    const routeIntel = contract.intelligence.find((node) => node.kind === "route")!;
    assert.throws(() => apply(state, { kind: "inspect", targetId: routeIntel.id }), /market_inspect_out_of_range/);
    state = moveNear(state, routeIntel.position);
    state = apply(state, { kind: "inspect", targetId: routeIntel.id });
    state = apply(state, { kind: "negotiate", action: { kind: "counter", term: "route", timingOffsetMs: 0 } });
    assert.equal(state.intelligenceIds.includes(routeIntel.id), true);
    assert.equal(state.negotiation.terms.routeId, contract.routes[1]!.id);
    assert.ok(state.events.some((event) => event.kind === "negotiation.succeeded"));
  });

  it("completes physical objectives only with correct position, timing, stamina, and card", () => {
    const fixture = acceptedRuntime();
    let state = fixture.state;
    const objective = state.objectives.find((value) => !value.complete)!;
    assert.throws(() => apply(state, { kind: "role-action", verb: objective.requiredVerb, timingOffsetMs: 0 }), /market_action_out_of_range/);
    state = moveNear(state, objective.position);
    const cardWithVerb = state.squad.find((card) => card.verbs.has(objective.requiredVerb))!;
    if (state.activeAssetId !== cardWithVerb.assetId) state = apply(state, { kind: "switch", assetId: cardWithVerb.assetId });
    state = apply(state, { kind: "role-action", verb: objective.requiredVerb, timingOffsetMs: 10 });
    assert.equal(state.objectives.find((value) => value.id === objective.id)?.complete, true);
    assert.ok(state.events.some((event) => event.kind === "objective.completed"));
    assert.equal(state.phase, "result");
    assert.equal(state.terminalReason, "completed");
  });

  it("makes hazards damage cards and cargo while guard or dodge changes the result", () => {
    const fixture = acceptedRuntime();
    const hazard = fixture.contract.hazards[0]!;
    let exposed = moveNear(fixture.state, hazard.position);
    exposed = apply(exposed, { kind: "move", vector: { x: 0.1, z: 0 } });
    assert.ok(exposed.cards[exposed.activeAssetId]!.health < exposed.cards[exposed.activeAssetId]!.maxHealth);
    assert.ok(exposed.cargoIntegrity < 100);

    let guarded = moveNear(fixture.state, hazard.position);
    guarded = apply(guarded, { kind: "guard", timingOffsetMs: 0 });
    guarded = apply(guarded, { kind: "move", vector: { x: 0.1, z: 0 } });
    assert.ok(guarded.cards[guarded.activeAssetId]!.health > exposed.cards[exposed.activeAssetId]!.health);
    assert.ok(guarded.cargoIntegrity > exposed.cargoIntegrity);

    let dodged = moveNear(fixture.state, hazard.position);
    dodged = apply(dodged, { kind: "dodge", vector: { x: 1, z: 0 }, timingOffsetMs: 0 });
    assert.ok(dodged.events.some((event) => event.kind === "dodged"));
  });

  it("supports tactical switching, safe extraction, and deterministic state digests", () => {
    const { state, stoneCarrier } = acceptedRuntime();
    const switched = apply(state, { kind: "switch", assetId: stoneCarrier.assetId });
    assert.equal(switched.activeAssetId, stoneCarrier.assetId);
    assert.equal(switched.switchCharges, state.switchCharges - 1);
    const extracted = apply(switched, { kind: "extract" });
    assert.equal(extracted.phase, "extracted");
    assert.equal(extracted.terminalReason, "extracted");
    assert.equal(marketRuntimeStateDigest(extracted), marketRuntimeStateDigest(extracted));
    assert.deepEqual(stepMarketRuntime(state, { sequence: state.sequence + 1, tick: state.tick + 1, kind: "extract" }), apply(state, { kind: "extract" }));
  });
});
