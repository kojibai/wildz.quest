import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeWildsExplorerWingFlightPose } from "../src/features/play/wilds-explorer-flight-pose";

function wing() {
  return { rotation: { x: 0, y: 0, z: 0 } };
}

describe("Wilds explorer powered-flight wing pose", () => {
  it("deploys laterally and flaps symmetrically instead of pointing both wings forward", () => {
    const left = wing();
    const right = wing();
    writeWildsExplorerWingFlightPose(left, right, true, false, 0, 1, 0);
    const firstLeft = left.rotation.z;
    assert.ok(firstLeft > 0);
    assert.ok(right.rotation.z < 0);
    assert.equal(left.rotation.z, -right.rotation.z);
    assert.equal(left.rotation.y, -right.rotation.y);

    writeWildsExplorerWingFlightPose(left, right, true, false, .25, 1, 0);
    assert.notEqual(left.rotation.z, firstLeft);
    assert.equal(left.rotation.z, -right.rotation.z);
    assert.equal(left.rotation.y, -right.rotation.y);
  });

  it("holds a broad stable glide and honors reduced motion", () => {
    const left = wing();
    const right = wing();
    writeWildsExplorerWingFlightPose(left, right, true, true, 1, 1, -.4);
    const glide = { left: { ...left.rotation }, right: { ...right.rotation } };
    writeWildsExplorerWingFlightPose(left, right, true, true, 4, 1, -.4);
    assert.deepEqual(left.rotation, glide.left);
    assert.deepEqual(right.rotation, glide.right);

    writeWildsExplorerWingFlightPose(left, right, true, false, 1, 0, 0);
    const reduced = { left: { ...left.rotation }, right: { ...right.rotation } };
    writeWildsExplorerWingFlightPose(left, right, true, false, 4, 0, 0);
    assert.deepEqual(left.rotation, reduced.left);
    assert.deepEqual(right.rotation, reduced.right);
  });
});
