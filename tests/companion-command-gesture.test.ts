import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceCompanionGesture,
  cancelCompanionGesture,
  createCompanionGesture,
  moveCompanionGesture,
  releaseCompanionGesture
} from "../src/features/play/companion-command-gesture";

test("a short stationary companion gesture activates the equipped power", () => {
  const state = createCompanionGesture({ x: 100, y: 600 }, 0);
  assert.deepEqual(
    releaseCompanionGesture(state, { x: 103, y: 598 }, 70),
    { kind: "tap-power" }
  );
});

test("horizontal movement locks cycling and cannot become a drawer pull", () => {
  let state = createCompanionGesture({ x: 100, y: 600 }, 0);
  state = moveCompanionGesture(state, { x: 128, y: 594 }, 30);
  state = moveCompanionGesture(state, { x: 170, y: 520 }, 70);

  assert.equal(state.mode, "horizontal");
  assert.deepEqual(releaseCompanionGesture(state, { x: 170, y: 500 }, 90), { kind: "cycle-next" });
});

test("upward movement locks the roster drawer and cannot cycle", () => {
  let state = createCompanionGesture({ x: 100, y: 600 }, 0);
  state = moveCompanionGesture(state, { x: 106, y: 570 }, 35);
  state = moveCompanionGesture(state, { x: 170, y: 500 }, 90);

  assert.equal(state.mode, "vertical");
  assert.deepEqual(releaseCompanionGesture(state, { x: 180, y: 490 }, 110), { kind: "open-drawer" });
});

test("a stationary hold opens the ability wheel before release", () => {
  const held = advanceCompanionGesture(createCompanionGesture({ x: 100, y: 600 }, 0), 100);
  assert.equal(held.mode, "ability-wheel");
  assert.equal(held.activeAbilityIndex, null);
});

test("sliding through ability-wheel sectors selects the released sector", () => {
  let state = advanceCompanionGesture(createCompanionGesture({ x: 100, y: 600 }, 0), 100);
  state = moveCompanionGesture(state, { x: 145, y: 600 }, 120);

  assert.equal(state.activeAbilityIndex, 1);
  assert.deepEqual(releaseCompanionGesture(state, { x: 145, y: 600 }, 140), { kind: "select-ability", index: 1 });
});

test("returning to wheel center and pointer cancellation both cancel safely", () => {
  let state = advanceCompanionGesture(createCompanionGesture({ x: 100, y: 600 }, 0), 100);
  state = moveCompanionGesture(state, { x: 145, y: 600 }, 120);
  state = moveCompanionGesture(state, { x: 104, y: 603 }, 140);

  assert.equal(state.activeAbilityIndex, null);
  assert.deepEqual(releaseCompanionGesture(state, { x: 104, y: 603 }, 160), { kind: "cancel" });
  assert.deepEqual(cancelCompanionGesture(state), { kind: "cancel" });
});
