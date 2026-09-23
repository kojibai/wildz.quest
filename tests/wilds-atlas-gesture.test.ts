import assert from "node:assert/strict";
import { test } from "node:test";
import { wildsAtlasTwistDelta } from "../src/features/play/wilds-atlas-camera";

test("twisting crosses the angle seam continuously in either direction", () => {
  const degrees = Math.PI / 180;
  assert.ok(Math.abs(wildsAtlasTwistDelta(179 * degrees, -179 * degrees) - 2 * degrees) < 1e-10);
  assert.ok(Math.abs(wildsAtlasTwistDelta(-179 * degrees, 179 * degrees) + 2 * degrees) < 1e-10);
});

test("successive twists can complete a full turn without a heading limit", () => {
  let turn = 0;
  for (let step = 0; step < 360; step++) {
    const angle = (n: number) => Math.atan2(Math.sin(n * Math.PI / 180), Math.cos(n * Math.PI / 180));
    turn += wildsAtlasTwistDelta(angle(step), angle(step + 1));
  }
  assert.ok(Math.abs(turn - Math.PI * 2) < 1e-10);
  assert.equal(wildsAtlasTwistDelta(.7, .7), 0);
});
