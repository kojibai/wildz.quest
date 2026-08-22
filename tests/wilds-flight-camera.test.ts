import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsFlightCameraControlState, writeWildsFlightCameraControlState } from "../src/features/play/wilds-flight-camera";

describe("Wilds flight camera control", () => {
  it("smoothly settles into a wider calmer touch profile without allocating frame state", () => {
    const controls = createWildsFlightCameraControlState();
    const identity = controls;
    const firstRotateSpeed = controls.rotateSpeed;
    for (let frame = 0; frame < 300; frame += 1) {
      assert.equal(writeWildsFlightCameraControlState(controls, true, 1 / 60), identity);
    }
    assert.ok(controls.rotateSpeed < firstRotateSpeed);
    assert.ok(controls.dampingFactor > .08);
    assert.ok(controls.maxDistance > 12.5);
    assert.ok(controls.minPolarAngle > .38);
    assert.ok(controls.maxPolarAngle < Math.PI / 2.15);

    for (let frame = 0; frame < 300; frame += 1) {
      assert.equal(writeWildsFlightCameraControlState(controls, false, 1 / 60), identity);
    }
    assert.ok(Math.abs(controls.rotateSpeed - .62) < .000001);
    assert.ok(Math.abs(controls.dampingFactor - .08) < .000001);
    assert.ok(Math.abs(controls.maxDistance - 12.5) < .000001);
  });

  it("clamps malformed frame deltas without producing nonfinite camera controls", () => {
    const controls = createWildsFlightCameraControlState();
    writeWildsFlightCameraControlState(controls, true, Number.NaN);
    for (const value of Object.values(controls)) assert.ok(Number.isFinite(value));
  });
});
