import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromFixed, replayGame, runFixedSteps, toFixed, type WildzGameModule } from "../src/features/games/kernel/game-module";

type State = { tick: number; x: number };
type Input = { dx: number };
const module: WildzGameModule<{ x: number }, State, Input, { x: number }, never> = {
  id: "kernel-test", rulesVersion: "1", tickRate: 60,
  limits: { maxTicks: 120, maxInputs: 8, maxEntities: 2 },
  create: (setup) => ({ tick: 0, x: setup.x }),
  step: (state, frames) => ({ tick: state.tick + 1, x: state.x + frames.reduce((total, frame) => total + frame.input.dx, 0) }),
  complete: (state) => state.tick >= 3 ? { x: state.x } : null,
  propose: () => []
};

describe("Wildz deterministic game kernel", () => {
  it("replays identical sorted input into an identical digest", () => {
    const frames = [
      { actorId: "b", sequence: 2, atTick: 1, input: { dx: 7 } },
      { actorId: "a", sequence: 1, atTick: 1, input: { dx: 4 } }
    ];
    const left = replayGame(module, { x: 0 }, frames, 3);
    const right = replayGame(module, { x: 0 }, [...frames].reverse(), 3);
    assert.equal(left.snapshot.digest, right.snapshot.digest);
    assert.deepEqual(left.result, { x: 11 });
  });

  it("caps inputs and ticks before simulation work", () => {
    const tooMany = Array.from({ length: 9 }, (_, sequence) => ({ actorId: "a", sequence, atTick: 1, input: { dx: 1 } }));
    assert.throws(() => replayGame(module, { x: 0 }, tooMany, 3), /input cap/i);
    assert.throws(() => replayGame(module, { x: 0 }, [], 121), /tick cap/i);
  });

  it("runs fixed cadence with a bounded catch-up and exact fixed-point values", () => {
    assert.equal(toFixed(1.2344), 1234);
    assert.equal(fromFixed(1234), 1.234);
    assert.deepEqual(runFixedSteps({ accumulatorMs: 0, tick: 2 }, 100, 60, 4), { accumulatorMs: 33.33333333333333, tick: 6, steps: 4, dropped: true });
  });
});
