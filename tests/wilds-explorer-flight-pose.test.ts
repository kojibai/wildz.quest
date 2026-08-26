import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import * as flightPoseModule from "../src/features/play/wilds-explorer-flight-pose";
import { writeWildsExplorerWingFlightPose } from "../src/features/play/wilds-explorer-flight-pose";

function wing() {
  return { rotation: { x: 0, y: 0, z: 0 } };
}

describe("Wilds explorer powered-flight wing pose", () => {
  it("crosses the signed-pi seam by the shortest turn instead of spinning south", () => {
    const nextFacing = (flightPoseModule as unknown as {
      nextWildsExplorerFacing?: (current: number, target: number, blend: number) => number;
    }).nextWildsExplorerFacing;
    assert.equal(typeof nextFacing, "function");

    const current = Math.PI - .02;
    const target = -Math.PI + .02;
    const next = nextFacing!(current, target, .5);
    assert.ok(Math.abs(next - current) < .03);
    assert.ok(Math.abs(next) > 3);
  });

  it("composes yaw before flight pitch so every compass direction stays upright", () => {
    const writeOrientation = (flightPoseModule as unknown as {
      writeWildsExplorerOrientation?: (
        rotation: THREE.Euler,
        heading: number,
        pitch: number,
        blend: number
      ) => void;
    }).writeWildsExplorerOrientation;
    assert.equal(typeof writeOrientation, "function");

    for (const heading of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
      const rotation = new THREE.Euler(0, heading, 0);
      writeOrientation!(rotation, heading, -1.12, 1);
      const forward = new THREE.Vector3(0, 0, 1).applyEuler(rotation);
      assert.equal(rotation.order, "YXZ");
      assert.ok(forward.y > .85, `heading ${heading} tipped the explorer backward`);
    }
  });

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
