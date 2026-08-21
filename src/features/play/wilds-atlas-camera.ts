import type { WildsAtlasProjection } from "./wilds-world-atlas";
import { WILDS_REGION_SIZE } from "./multiplayer-core";

type CameraVector = readonly [number, number, number];

export type WildsAtlasCameraFrame = Readonly<{
  target: CameraVector;
  position: CameraVector;
  minDistance: number;
  maxDistance: number;
  fov: number;
  far: number;
}>;

export type WildsAtlasCameraPose = Readonly<{
  position: CameraVector;
  target: CameraVector;
}>;

export type WildsAtlasFloatingPose = WildsAtlasCameraPose & Readonly<{
  centerRegion: Readonly<{ x: number; z: number }>;
  rebased: boolean;
}>;

function finitePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function atlasCameraFrame(
  input: {
    bounds: WildsAtlasProjection["bounds"];
    centerRegion: WildsAtlasProjection["centerRegion"];
    regionUnit: number;
  },
  viewport: { width: number; height: number }
): WildsAtlasCameraFrame {
  const width = finitePositive(viewport.width, 1);
  const height = finitePositive(viewport.height, 1);
  const regionUnit = finitePositive(input.regionUnit, 1);
  const spanX = Math.max(1, input.bounds.maxX - input.bounds.minX + 1) * regionUnit;
  const spanZ = Math.max(1, input.bounds.maxZ - input.bounds.minZ + 1) * regionUnit;
  const portrait = height > width * 1.25;
  const fov = portrait ? 53 : 40;
  const verticalFov = fov * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * width / height);
  const fitWidth = spanX / 2 / Math.max(.08, Math.tan(horizontalFov / 2));
  const fitDepth = spanZ / 2 / Math.max(.08, Math.tan(verticalFov / 2));
  const distance = Math.max(7.2, Math.hypot(fitWidth, fitDepth) * 1.08);
  const elevation = distance * (portrait ? .82 : .72);
  const targetX = ((input.bounds.minX + input.bounds.maxX + 1) / 2 - input.centerRegion.x) * regionUnit;
  const targetZ = ((input.bounds.minZ + input.bounds.maxZ + 1) / 2 - input.centerRegion.z) * regionUnit;
  // Keep the atlas camera genuinely map-like: explorers can descend close enough to
  // inspect one terrain cell, or pull far beyond the current fit without changing modes.
  // Pan remains intentionally unbounded; these limits only protect camera numerics.
  const minDistance = Math.max(.45, regionUnit * .28);
  const maxDistance = Math.max(512, distance * 64);
  const far = Math.max(96, maxDistance * 2.2);
  return Object.freeze({
    target: Object.freeze([targetX, 0, targetZ]) as CameraVector,
    position: Object.freeze([targetX, elevation, targetZ + distance]) as CameraVector,
    minDistance,
    maxDistance,
    fov,
    far
  });
}

export function atlasCameraOpeningFrame(
  input: {
    currentPosition: Readonly<{ x: number; z: number }>;
    centerRegion: Readonly<{ x: number; z: number }>;
    regionUnit: number;
  },
  viewport: { width: number; height: number }
): WildsAtlasCameraPose {
  const width = finitePositive(viewport.width, 1);
  const height = finitePositive(viewport.height, 1);
  const regionUnit = finitePositive(input.regionUnit, 1);
  const portrait = height > width * 1.25;
  const distance = portrait ? 10.5 : 9.2;
  const elevation = distance * (portrait ? .82 : .72);
  const targetX = (input.currentPosition.x / WILDS_REGION_SIZE - input.centerRegion.x) * regionUnit;
  const targetZ = (input.currentPosition.z / WILDS_REGION_SIZE - input.centerRegion.z) * regionUnit;
  return Object.freeze({
    target: Object.freeze([targetX, 0, targetZ]) as CameraVector,
    position: Object.freeze([targetX, elevation, targetZ + distance]) as CameraVector
  });
}

export function atlasCameraOpeningLimits(regionUnit: number) {
  const safeRegionUnit = finitePositive(regionUnit, 1);
  const maxDistance = 512;
  return Object.freeze({
    minDistance: Math.max(.45, safeRegionUnit * .28),
    maxDistance,
    far: maxDistance * 2.2
  });
}

export function rebaseWildsAtlasCameraPose(input: {
  centerRegion: Readonly<{ x: number; z: number }>;
  current: WildsAtlasCameraPose;
  regionUnit: number;
  threshold: number;
}): WildsAtlasFloatingPose {
  const regionUnit = finitePositive(input.regionUnit, 1);
  const threshold = finitePositive(input.threshold, 96);
  if (Math.abs(input.current.target[0]) <= threshold && Math.abs(input.current.target[2]) <= threshold) {
    return Object.freeze({ ...input.current, centerRegion: input.centerRegion, rebased: false });
  }
  const shiftRegionX = Math.trunc(input.current.target[0] / regionUnit);
  const shiftRegionZ = Math.trunc(input.current.target[2] / regionUnit);
  const shiftX = shiftRegionX * regionUnit;
  const shiftZ = shiftRegionZ * regionUnit;
  return Object.freeze({
    centerRegion: Object.freeze({
      x: input.centerRegion.x + shiftRegionX,
      z: input.centerRegion.z + shiftRegionZ
    }),
    position: Object.freeze([
      input.current.position[0] - shiftX,
      input.current.position[1],
      input.current.position[2] - shiftZ
    ]) as CameraVector,
    target: Object.freeze([
      input.current.target[0] - shiftX,
      input.current.target[1],
      input.current.target[2] - shiftZ
    ]) as CameraVector,
    rebased: true
  });
}

export function preserveWildsAtlasCameraLimits(
  current: Pick<WildsAtlasCameraFrame, "minDistance" | "maxDistance" | "far">,
  next: Pick<WildsAtlasCameraFrame, "minDistance" | "maxDistance" | "far">
) {
  return Object.freeze({
    minDistance: Math.min(current.minDistance, next.minDistance),
    maxDistance: Math.max(current.maxDistance, next.maxDistance),
    far: Math.max(current.far, next.far)
  });
}

export function resolveWildsAtlasCameraPose(input: {
  current: WildsAtlasCameraPose;
  frame: WildsAtlasCameraFrame;
  openingFrame: WildsAtlasCameraPose;
  lastFitRequest: number | null;
  fitRequest: number;
}): WildsAtlasCameraPose & { fitted: boolean } {
  if (input.lastFitRequest === null) {
    return Object.freeze({ position: input.openingFrame.position, target: input.openingFrame.target, fitted: true });
  }
  if (input.lastFitRequest !== input.fitRequest) {
    return Object.freeze({ position: input.frame.position, target: input.frame.target, fitted: true });
  }
  return Object.freeze({ position: input.current.position, target: input.current.target, fitted: false });
}

export function translateWildsAtlasCamera(input: {
  position: CameraVector;
  target: CameraVector;
  nextTarget: CameraVector;
}) {
  const dx = input.nextTarget[0] - input.target[0];
  const dy = input.nextTarget[1] - input.target[1];
  const dz = input.nextTarget[2] - input.target[2];
  return Object.freeze({
    target: Object.freeze([...input.nextTarget]) as CameraVector,
    position: Object.freeze([
      input.position[0] + dx,
      input.position[1] + dy,
      input.position[2] + dz
    ]) as CameraVector
  });
}
