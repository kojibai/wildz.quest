import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capturePhaseDelayMs,
  projectCaptureMoment,
  WILDS_CAPSULE_CAPTURE_MS
} from "../src/features/play/wilds-capture-sequence.js";

describe("complete capture moment before reward", () => {
  it("holds the world capture through creature draw-in, ball lock, and a visible seal", () => {
    assert.ok(capturePhaseDelayMs("emerging", false)! > 0);
    assert.equal(capturePhaseDelayMs("capsule", false), WILDS_CAPSULE_CAPTURE_MS);
    assert.ok(capturePhaseDelayMs("sealed", false)! >= 600);
    assert.ok(capturePhaseDelayMs("emerging", false)!
      + capturePhaseDelayMs("capsule", false)!
      + capturePhaseDelayMs("sealed", false)! >= 2_000);
    const start = projectCaptureMoment("capsule", 0);
    const halfway = projectCaptureMoment("capsule", WILDS_CAPSULE_CAPTURE_MS / 2);
    const complete = projectCaptureMoment("capsule", WILDS_CAPSULE_CAPTURE_MS);
    assert.equal(start.creatureScale, 1);
    assert.ok(start.ballScale < halfway.ballScale);
    assert.ok(halfway.creatureScale < start.creatureScale);
    assert.ok(complete.creatureScale < 0.02);
    assert.equal(complete.ballScale, 1);
    assert.equal(projectCaptureMoment("sealed", 0).creatureScale, 0);
    assert.ok(projectCaptureMoment("emerging", 525).creatureLift > 0);
    assert.equal(projectCaptureMoment("emerging", 1_050).creatureLift, 0);
    assert.equal(capturePhaseDelayMs("revealed", false), null);
  });

  it("respects reduced motion without skipping the visible sealed result", () => {
    assert.ok(capturePhaseDelayMs("capsule", true)! < WILDS_CAPSULE_CAPTURE_MS);
    assert.ok(capturePhaseDelayMs("sealed", true)! > 0);
    assert.equal(projectCaptureMoment("sealed", 1_000).ballScale, 1);
  });
});
