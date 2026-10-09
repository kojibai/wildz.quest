import assert from "node:assert/strict";
import { test } from "node:test";
import { projectWildsBlinkProfile, sampleWildsBlink } from "../src/features/play/wilds-face-motion";

test("blink timing retains exact genome cadence with individual closing speed and phase", () => {
  const a = projectWildsBlinkProfile("creature:a", 4100);
  const b = projectWildsBlinkProfile("creature:b", 4100);
  assert.equal(a.cadenceMs, 4100);
  assert.deepEqual(a, projectWildsBlinkProfile("creature:a", 4100));
  assert.notEqual(a.phaseMs, b.phaseMs);
  const start = a.cadenceMs - a.phaseMs;
  assert.equal(sampleWildsBlink(a, start), 0);
  assert.equal(sampleWildsBlink(a, start + a.closeMs + a.holdMs / 2), 1);
  assert.equal(sampleWildsBlink(a, start + a.closeMs + a.holdMs + a.openMs + 1), 0);
  for (const offset of [0, a.closeMs / 2, a.closeMs + 2, a.closeMs + a.holdMs + a.openMs / 2, 1000]) {
    assert.ok(Math.abs(sampleWildsBlink(a, start + offset) - sampleWildsBlink(a, start + offset + 4100)) < 1e-10);
  }
  assert.ok(sampleWildsBlink(a, start + a.closeMs / 2) > 0);
  assert.ok(sampleWildsBlink(a, start + a.closeMs / 2) < 1);
});

test("sleeping keeps eyelids closed and reduced motion disables spontaneous blinking", () => {
  const a = projectWildsBlinkProfile("explorer:a");
  const peak = a.cadenceMs - a.phaseMs + a.closeMs;
  assert.equal(sampleWildsBlink(a, peak, false, 0), 0);
  assert.equal(sampleWildsBlink(a, peak, true, 0), 1);
  assert.equal(sampleWildsBlink(a, peak + 1000, true), 1);
  for (const time of [-100000, 0, 10000000000]) {
    const value = sampleWildsBlink(a, time);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
});
