import { test } from "node:test";
import assert from "node:assert/strict";
import { WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks";

test("landmark lighting ranges cannot overlap the shared two-light allocation", () => {
  for (let i = 0; i < WILDS_FLAGSHIP_LANDMARKS.length; i++) {
    for (let j = i + 1; j < WILDS_FLAGSHIP_LANDMARKS.length; j++) {
      const a = WILDS_FLAGSHIP_LANDMARKS[i]!, b = WILDS_FLAGSHIP_LANDMARKS[j]!;
      assert.ok(Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) > 52, `${a.id} overlaps ${b.id}`);
    }
  }
});
