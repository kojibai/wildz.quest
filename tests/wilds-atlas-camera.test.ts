import assert from "node:assert/strict";
import { test } from "node:test";
import { atlasCameraFrame, translateWildsAtlasCamera } from "../src/features/play/wilds-atlas-camera";

test("fit-all framing includes the complete discovered extent on portrait and landscape screens", () => {
  const input = {
    bounds: { minX: -4, maxX: 6, minZ: -31, maxZ: 4, count: 90 },
    centerRegion: { x: 1.5, z: -13 },
    regionUnit: 11.5 / 36
  };
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const frame = atlasCameraFrame(input, viewport);
    assert.deepEqual(frame.target, [0, 0, 0]);
    assert.ok(frame.position.every(Number.isFinite));
    assert.ok(frame.maxDistance > frame.minDistance);
    assert.ok(frame.far > Math.hypot(...frame.position));
  }
});

test("recenter translates camera and target together without changing zoom distance", () => {
  const translated = translateWildsAtlasCamera({
    position: [3, 9, 12],
    target: [1, 0, 2],
    nextTarget: [-7, 0, 18]
  });
  assert.deepEqual(translated.target, [-7, 0, 18]);
  assert.deepEqual(translated.position, [-5, 9, 28]);
  assert.equal(
    Math.hypot(3 - 1, 9, 12 - 2),
    Math.hypot(translated.position[0] + 7, translated.position[1], translated.position[2] - 18)
  );
});

test("camera framing stays finite for degenerate and released world bounds", () => {
  for (const bounds of [
    { minX: 0, maxX: 0, minZ: 0, maxZ: 0, count: 1 },
    { minX: -10_416_667, maxX: 10_416_667, minZ: -10_416_667, maxZ: 10_416_667, count: 2 }
  ]) {
    const frame = atlasCameraFrame({ bounds, centerRegion: { x: .5, z: .5 }, regionUnit: 0.000001 }, { width: 1, height: 1 });
    assert.ok([...frame.position, ...frame.target, frame.minDistance, frame.maxDistance, frame.far, frame.fov].every(Number.isFinite));
  }
});
