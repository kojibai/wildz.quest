import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceCompanionGesture,
  cancelCompanionGesture,
  companionCommandKeyResult,
  createCompanionGesture,
  moveCompanionGesture,
  releaseCompanionGesture
} from "../src/features/play/companion-command-gesture";

test("a short stationary companion gesture opens character quick actions", () => {
  const state = createCompanionGesture({ x: 100, y: 600 }, 0);
  assert.deepEqual(
    releaseCompanionGesture(state, { x: 103, y: 598 }, 70),
    { kind: "open-quick-actions" }
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
  assert.deepEqual(releaseCompanionGesture(state, { x: 180, y: 490 }, 110), { kind: "open-drawer-expanded" });
});

test("a stationary hold opens character quick actions and cannot open abilities", () => {
  const pending = advanceCompanionGesture(createCompanionGesture({ x: 100, y: 600 }, 0), 419);
  assert.equal(pending.mode, "pending");
  const held = advanceCompanionGesture(pending, 420);
  assert.equal(held.mode, "quick-actions");
  assert.equal(held.activeAbilityIndex, null);
  assert.deepEqual(releaseCompanionGesture(held, { x: 100, y: 600 }, 140), { kind: "open-quick-actions" });
});

test("pointer cancellation remains safe without activating or opening anything", () => {
  const state = createCompanionGesture({ x: 100, y: 600 }, 0);
  assert.deepEqual(cancelCompanionGesture(state), { kind: "cancel" });
});

test("keyboard activation mirrors tap and keeps roster expansion explicit", () => {
  assert.equal(companionCommandKeyResult("Enter"), "open-quick-actions");
  assert.equal(companionCommandKeyResult(" "), "open-quick-actions");
  assert.equal(companionCommandKeyResult("ArrowUp"), "open-drawer-expanded");
  assert.equal(companionCommandKeyResult("ArrowLeft"), "cycle-previous");
  assert.equal(companionCommandKeyResult("ArrowRight"), "cycle-next");
  assert.equal(companionCommandKeyResult("a"), null);
});
