import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { replayGame } from "../src/features/games/kernel/game-module";
import { resolveArenaHit, projectMatchupModifiers } from "../src/features/games/mortal-arena/combat";
import { stepArenaMovement } from "../src/features/games/mortal-arena/movement";
import { completeMortalResult, projectMortalityWarning } from "../src/features/games/mortal-arena/mortality";
import { MORTAL_ARENA_MODULE } from "../src/features/games/mortal-arena/module";
import type { MortalArenaSetup } from "../src/features/games/mortal-arena/types";

const setup: MortalArenaSetup = {
  matchId: "match:one", seed: 42, mortal: true,
  sides: [
    { actorId: "alpha", fighters: [{ creatureId: "a", affinity: "Ember", vitality: 1000, power: 120, guard: 90, speed: 105 }] },
    { actorId: "beta", fighters: [{ creatureId: "b", affinity: "Grove", vitality: 1000, power: 110, guard: 100, speed: 95 }] }
  ]
};

describe("Mortal Arena simulation", () => {
  it("replays the same match independent of input arrival order", () => {
    const frames = [
      { actorId: "beta", sequence: 1, atTick: 2, input: { moveX: -1000, moveZ: 0, light: true } },
      { actorId: "alpha", sequence: 1, atTick: 2, input: { moveX: 1000, moveZ: -500, light: true } }
    ];
    const left = replayGame(MORTAL_ARENA_MODULE, setup, frames, 30);
    const right = replayGame(MORTAL_ARENA_MODULE, setup, [...frames].reverse(), 30);
    assert.equal(left.snapshot.digest, right.snapshot.digest);
    assert.deepEqual(left.snapshot.state, right.snapshot.state);
  });

  it("moves freely on both ground axes and remains inside authored bounds", () => {
    const created = MORTAL_ARENA_MODULE.create(setup);
    const moved = stepArenaMovement(created.sides[0].fighters[0], { moveX: 1000, moveZ: -500, jump: true }, created.arena);
    assert.ok(moved.position.x > created.sides[0].fighters[0].position.x);
    assert.ok(moved.position.z < created.sides[0].fighters[0].position.z);
    assert.ok(Math.hypot(moved.position.x, moved.position.z) <= created.arena.radius);
  });

  it("keeps matchup counters strategic but never absolute", () => {
    assert.equal(projectMatchupModifiers("Tide", "Ember").damagePermille, 1350);
    assert.equal(projectMatchupModifiers("Ember", "Tide").damagePermille, 650);
    assert.equal(projectMatchupModifiers("Prism", "Grove").damagePermille, 1000);
  });

  it("rewards a timed guard without erasing all damage", () => {
    const created = MORTAL_ARENA_MODULE.create(setup);
    const defender = { ...created.sides[1].fighters[0], guarding: true, guardStartedTick: 10, break: 600 };
    const resolved = resolveArenaHit(defender, { damage: 120, breakDamage: 90, launch: 80, affinity: "Ember" }, 12);
    assert.ok(resolved.fighter.vitality < defender.vitality);
    assert.ok(resolved.fighter.break > defender.break);
    assert.equal(resolved.perfectGuard, true);
  });

  it("warns before death, permits flight above zero, and retires exactly once at zero", () => {
    assert.equal(projectMortalityWarning({ vitality: 351, maxVitality: 1000 }, 100), "safe");
    assert.equal(projectMortalityWarning({ vitality: 350, maxVitality: 1000 }, 100), "strained");
    assert.equal(projectMortalityWarning({ vitality: 150, maxVitality: 1000 }, 100), "grave");
    assert.equal(projectMortalityWarning({ vitality: 90, maxVitality: 1000 }, 100), "final");
    assert.equal(completeMortalResult({ matchId: "m", creatureId: "a", vitality: 1, outcome: "fled", mortal: true }).events.length, 0);
    const dead = completeMortalResult({ matchId: "m", creatureId: "a", vitality: 0, outcome: "victory", mortal: true });
    assert.equal(dead.events.filter((event) => event.kind === "retirement").length, 1);
    assert.equal(dead.events[0]?.honor, "victorious-sacrifice");
  });

  it("focuses, swaps only to a living reserve, and cancels an interrupted flee", () => {
    const withReserve: MortalArenaSetup = {
      ...setup,
      sides: [
        { ...setup.sides[0], fighters: [...setup.sides[0].fighters, { creatureId: "a2", affinity: "Spark", vitality: 900, power: 100, guard: 100, speed: 110 }] },
        setup.sides[1]
      ]
    };
    let state = MORTAL_ARENA_MODULE.create(withReserve);
    state = MORTAL_ARENA_MODULE.step(state, [{ actorId: "alpha", sequence: 1, atTick: 1, input: { focus: true } }]);
    assert.ok(state.sides[0].fighters[0].focus > 0);
    state = MORTAL_ARENA_MODULE.step(state, [{ actorId: "alpha", sequence: 2, atTick: 2, input: { swapTo: 1 } }]);
    assert.equal(state.sides[0].activeIndex, 1);
    state = MORTAL_ARENA_MODULE.step(state, [{ actorId: "alpha", sequence: 3, atTick: 3, input: { flee: true } }]);
    state = MORTAL_ARENA_MODULE.step(state, []);
    assert.equal(state.sides[0].fleeStartedTick, null);
    assert.equal(state.sides[0].fled, false);
  });

  it("reports the local side's defeat instead of calling every decisive match a victory", () => {
    const created = MORTAL_ARENA_MODULE.create(setup);
    const defeated = {
      ...created,
      phase: "complete" as const,
      winnerSide: 1 as const,
      sides: [
        { ...created.sides[0], fighters: created.sides[0].fighters.map((fighter, index) => index === created.sides[0].activeIndex ? { ...fighter, vitality: 0 } : fighter) },
        created.sides[1]
      ] as typeof created.sides
    };
    assert.equal(MORTAL_ARENA_MODULE.complete(defeated)?.outcome, "defeat");
  });
});
