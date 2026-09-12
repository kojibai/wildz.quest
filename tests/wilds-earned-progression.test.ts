import assert from "node:assert/strict";
import test from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state";

test("a new explorer has no unearned world mastery", () => {
  assert.equal(createOwnerBoundInitialPlayState("earned.player", "2026-09-12T00:00:00Z").worldMastery, 0);
});

test("repeated mission commands cannot manufacture progress, currency, XP or completion", () => {
  const initial = { ...createOwnerBoundInitialPlayState("earned.player", "2026-09-12T00:00:00Z"), missionProgress: 99 };
  let state = initial;
  for (let i = 0; i < 100; i++) state = applyWildsInput(state, { type: "mission" });
  for (const key of ["worldMastery", "missionProgress", "beans", "cardXp", "energy", "level"] as const) {
    assert.equal(state[key], initial[key], key);
  }
  assert.deepEqual(state.completedMissionIds, initial.completedMissionIds);
});
