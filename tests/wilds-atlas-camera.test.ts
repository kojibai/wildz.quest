import assert from "node:assert/strict";
import { test } from "node:test";
import { atlasCameraFrame, atlasCameraOpeningFrame, atlasCameraOpeningLimits, preserveWildsAtlasCameraLimits, rebaseWildsAtlasCameraPose, resolveWildsAtlasCameraPose, translateWildsAtlasCamera } from "../src/features/play/wilds-atlas-camera";

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

  const openingFrame = atlasCameraOpeningFrame({ currentPosition: { x: 245, z: -1433 }, centerRegion: { x: .5, z: .5 }, regionUnit: 1.35 }, { width: 390, height: 844 });
  const preserved = resolveWildsAtlasCameraPose({ current, frame: expandedFrame, openingFrame, lastFitRequest: 4, fitRequest: 4 });
  assert.deepEqual(preserved, { ...current, fitted: false });

  const fitted = resolveWildsAtlasCameraPose({ current, frame: expandedFrame, openingFrame, lastFitRequest: 4, fitRequest: 5 });
  assert.deepEqual(fitted, { position: expandedFrame.position, target: expandedFrame.target, fitted: true });
});

test("opening near You keeps canonical zoom regardless of distant discovery bounds", () => {
  const openingFrame = atlasCameraOpeningFrame({
    currentPosition: { x: 245, z: -1433 },
    centerRegion: { x: 5.5, z: -30.5 },
    regionUnit: 1.35
  }, { width: 390, height: 844 });
  const hugeFit = atlasCameraFrame({
    bounds: { minX: -10_000_000, maxX: 10_000_000, minZ: -10_000_000, maxZ: 10_000_000, count: 90 },
    centerRegion: { x: 5.5, z: -30.5 },
    regionUnit: 1.35
  }, { width: 390, height: 844 });
  const opened = resolveWildsAtlasCameraPose({
    current: { position: [0, 9.6, 11.5], target: [0, 0, 0] },
    frame: hugeFit,
    openingFrame,
    lastFitRequest: null,
    fitRequest: 0
  });

  assert.deepEqual(opened, { ...openingFrame, fitted: true });
  assert.ok(Math.hypot(
    opened.position[0] - opened.target[0],
    opened.position[1] - opened.target[1],
    opened.position[2] - opened.target[2]
  ) < 16);
});

test("floating-origin rebasing preserves zoom and exact extreme world coordinates", () => {
  const regionUnit = 1.35;
  const current = {
    position: [14_062_506, 8, -14_062_490] as const,
    target: [14_062_500, 0, -14_062_500] as const
  };
  const rebased = rebaseWildsAtlasCameraPose({
    centerRegion: { x: .5, z: .5 },
    current,
    regionUnit,
    threshold: 96
  });

  assert.equal(rebased.rebased, true);
  assert.ok(Math.abs(rebased.target[0]) < regionUnit);
  assert.ok(Math.abs(rebased.target[2]) < regionUnit);
  assert.equal(
    Math.hypot(...current.position.map((value, index) => value - current.target[index]!) as [number, number, number]),
    Math.hypot(...rebased.position.map((value, index) => value - rebased.target[index]!) as [number, number, number])
  );
  const worldX = 500_000_000;
  const localX = (worldX / 48 - rebased.centerRegion.x) * regionUnit;
  assert.ok(Math.abs(localX) < 96);
  assert.equal((rebased.centerRegion.x + localX / regionUnit) * 48, worldX);
  const adjacent = localX + regionUnit;
  assert.ok(Math.abs((Math.fround(adjacent) - Math.fround(localX)) - regionUnit) < 1e-5);
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

test("zoom and bounds changes cannot shrink camera limits around a preserved pose", () => {
  const world = { minDistance: .45, maxDistance: 8_000_000, far: 17_600_000 };
  const local = { minDistance: .45, maxDistance: 512, far: 1_126.4 };
  assert.deepEqual(preserveWildsAtlasCameraLimits(world, local), world);
  assert.deepEqual(preserveWildsAtlasCameraLimits(local, world), world);
});

test("opening locally does not inherit an extreme whole-world depth plane before Fit", () => {
  const limits = atlasCameraOpeningLimits(1.35);
  assert.deepEqual(limits, { minDistance: .45, maxDistance: 512, far: 1126.4 });
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
