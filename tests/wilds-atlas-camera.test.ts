import assert from "node:assert/strict";
import { test } from "node:test";
import { atlasCameraFrame, resolveWildsAtlasCameraPose, translateWildsAtlasCamera } from "../src/features/play/wilds-atlas-camera";

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

test("atlas zoom spans close terrain inspection through a far whole-world overview", () => {
  const frame = atlasCameraFrame({
    bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0, count: 1 },
    centerRegion: { x: .5, z: .5 },
    regionUnit: 1.35
  }, { width: 390, height: 844 });

  assert.ok(frame.minDistance <= .5, `expected close inspection, got ${frame.minDistance}`);
  assert.ok(frame.maxDistance >= 512, `expected atlas-wide zoom out, got ${frame.maxDistance}`);
  assert.ok(frame.maxDistance / frame.minDistance >= 1_000);
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

test("discovery and zoom changes preserve the camera until Fit is explicitly requested", () => {
  const current = { position: [3, 9, 12] as const, target: [1, 0, 2] as const };
  const expandedFrame = atlasCameraFrame({
    bounds: { minX: -4, maxX: 10_000, minZ: -20_000, maxZ: 4, count: 83 },
    centerRegion: { x: .5, z: .5 },
    regionUnit: 1.35
  }, { width: 390, height: 844 });

  const preserved = resolveWildsAtlasCameraPose({ current, frame: expandedFrame, lastFitRequest: 4, fitRequest: 4 });
  assert.deepEqual(preserved, { ...current, fitted: false });

  const fitted = resolveWildsAtlasCameraPose({ current, frame: expandedFrame, lastFitRequest: 4, fitRequest: 5 });
  assert.deepEqual(fitted, { position: expandedFrame.position, target: expandedFrame.target, fitted: true });
});

test("Fit targets the discovered midpoint even when the stable render origin is elsewhere", () => {
  const frame = atlasCameraFrame({
    bounds: { minX: -4, maxX: 6, minZ: -31, maxZ: 4, count: 90 },
    centerRegion: { x: 5.5, z: -30.5 },
    regionUnit: 1.35
  }, { width: 390, height: 844 });
  assert.deepEqual(frame.target, [-5.4, 0, 23.625]);
  assert.equal(frame.position[0], frame.target[0]);
  assert.ok(frame.position[2] > frame.target[2]);
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
