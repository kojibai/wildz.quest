import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cardSavePresentation,
  triggerCardHaptic
} from "../src/features/play/card-save-feedback.js";

describe("premium card save feedback", () => {
  it("gives every real save phase distinct concise copy", () => {
    assert.deepEqual(cardSavePresentation("idle"), {
      busy: false,
      button: "Save verified card",
      message: ""
    });
    assert.deepEqual(cardSavePresentation("preparing"), {
      busy: true,
      button: "Preparing proof…",
      message: "Creating your portable, verified card proof…"
    });
    assert.deepEqual(cardSavePresentation("saving"), {
      busy: true,
      button: "Sealing verified card…",
      message: "Sealing your verified collectible…"
    });
    assert.deepEqual(cardSavePresentation("success"), {
      busy: false,
      button: "Card secured",
      message: "Card secured. Your verified collectible is ready to keep or share."
    });
    assert.deepEqual(cardSavePresentation("error"), {
      busy: false,
      button: "Retry save",
      message: ""
    });
  });

  it("uses restrained optional haptics without throwing when vibration is unavailable", () => {
    const patterns: (number | number[])[] = [];
    assert.equal(triggerCardHaptic("press", (pattern) => { patterns.push(pattern); return true; }), true);
    assert.equal(triggerCardHaptic("success", (pattern) => { patterns.push(pattern); return true; }), true);
    assert.equal(triggerCardHaptic("error", (pattern) => { patterns.push(pattern); return true; }), true);
    assert.deepEqual(patterns, [10, [12, 34, 22], [18, 32, 18]]);
    assert.equal(triggerCardHaptic("success", undefined), false);
    assert.equal(triggerCardHaptic("success", "not-callable" as never), false);
    assert.equal(triggerCardHaptic("success", () => { throw new Error("blocked"); }), false);
  });
});
