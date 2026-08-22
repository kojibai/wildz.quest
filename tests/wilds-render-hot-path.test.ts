import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWildsMovingInstancesRuntime,
  writeWildsMovingInstances
} from "../src/features/play/wilds-moving-instances";
import { writeWildsCreatureLocomotionFrame } from "../src/features/play/WildsCreatureActor";

describe("Wilds visible-world frame hot paths", () => {
  it("reuses one mutable creature locomotion frame", () => {
    const frame = { rootY: 0, rootPitch: 0, rootRoll: 0, limbPitch: 0, wingAngle: 0 };
    for (let index = 0; index < 10_000; index += 1) {
      assert.equal(writeWildsCreatureLocomotionFrame(frame, "air", index / 60, 1, .25, "idle"), frame);
    }
    assert.ok(Number.isFinite(frame.rootY));
    assert.notEqual(frame.wingAngle, 0);
  });

  it("reuses one transform runtime while animating ecology instances", () => {
    const runtime = createWildsMovingInstancesRuntime();
    const target = {
      instanceMatrix: { needsUpdate: false },
      setMatrixAtCalls: 0,
      setMatrixAt() { this.setMatrixAtCalls += 1; }
    };
    for (let index = 0; index < 10_000; index += 1) {
      assert.equal(writeWildsMovingInstances(runtime, target, 11, index / 60, true), runtime);
    }
    assert.equal(target.setMatrixAtCalls, 110_000);
    assert.equal(target.instanceMatrix.needsUpdate, true);
  });
});
