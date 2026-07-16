import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWildsRouteIntent, createWildsRouteMemory } from "../src/features/play/wilds-route-memory";

describe("Wayfinder route memory", () => {
  it("projects one stable three-direction route from its seed", () => {
    const first = createWildsRouteMemory("wayfinder-hollow:player-1:2026-07-15");
    const replay = createWildsRouteMemory("wayfinder-hollow:player-1:2026-07-15");

    assert.deepEqual(replay, first);
    assert.match(first.id, /^route:[a-f0-9]{20}$/);
    assert.equal(first.sequence.length, 3);
    assert.equal(first.sequence.every((direction) => ["north", "east", "south", "west"].includes(direction)), true);
    assert.equal(first.phase, "briefing");
  });

  it("requires begin and completes only the exact route", () => {
    const briefing = createWildsRouteMemory("route-seed");
    assert.deepEqual(applyWildsRouteIntent(briefing, briefing.sequence[0]!), briefing);

    let state = applyWildsRouteIntent(briefing, "begin");
    for (const direction of briefing.sequence) state = applyWildsRouteIntent(state, direction);

    assert.equal(state.phase, "complete");
    assert.equal(state.step, 3);
    assert.equal(new Set(state.eventIds).size, state.eventIds.length);
    assert.deepEqual(applyWildsRouteIntent(state, "north"), state);
  });

  it("keeps mistakes bounded and resets progress without mutating input", () => {
    const briefing = createWildsRouteMemory("mistake-seed");
    const active = applyWildsRouteIntent(briefing, "begin");
    const wrong = (["north", "east", "south", "west"] as const).find((direction) => direction !== briefing.sequence[0])!;
    let state = active;
    for (let index = 0; index < 12; index += 1) state = applyWildsRouteIntent(state, wrong);

    assert.equal(active.mistakes, 0);
    assert.equal(state.mistakes, 3);
    assert.equal(state.step, 0);
    assert.equal(state.phase, "active");
  });
});
