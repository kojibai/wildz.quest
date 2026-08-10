import assert from "node:assert/strict";
import { test } from "node:test";
import { playHapticPattern, playWildsHaptic, wildsHapticPattern } from "../src/features/play/wilds-haptics";

test("companion gestures have a restrained progressive haptic language", () => {
  assert.deepEqual(wildsHapticPattern("wheel-open"), [8]);
  assert.deepEqual(wildsHapticPattern("wheel-detent"), [5]);
  assert.deepEqual(wildsHapticPattern("confirm"), [14, 18, 24]);
  assert.deepEqual(wildsHapticPattern("cancel"), [7, 22, 7]);
});

test("haptics are capability-safe and report whether feedback was accepted", () => {
  assert.equal(playWildsHaptic("confirm", undefined), false);
  let received: readonly number[] = [];
  assert.equal(playWildsHaptic("confirm", (pattern) => {
    received = typeof pattern === "number" ? [pattern] : pattern;
    return true;
  }), true);
  assert.deepEqual(received, [14, 18, 24]);
  assert.equal(playWildsHaptic("cancel", () => { throw new Error("blocked"); }), false);
});

test("arbitrary combat haptics safely no-op when vibration is missing or blocked", () => {
  assert.equal(playHapticPattern([20, 18, 28], undefined), false);
  assert.equal(playHapticPattern(24, () => { throw new Error("blocked"); }), false);
  assert.equal(playHapticPattern(18, (pattern) => pattern === 18), true);
});
