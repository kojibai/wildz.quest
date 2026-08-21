import assert from "node:assert/strict";
import { test } from "node:test";
import type { WildsAquaticPresentation } from "../src/features/play/wilds-aquatic-presentation";
import { WILDS_WATERLINE_ELEVATION } from "../src/features/play/wilds-aquatic-presentation";
import {
  UNDERWATER_CAMERA_ENTER_DEPTH,
  UNDERWATER_CAMERA_EXIT_DEPTH,
  projectUnderwaterCameraTarget
} from "../src/features/play/wilds-underwater-camera";

function presentation(overrides: Partial<WildsAquaticPresentation> = {}): WildsAquaticPresentation {
  return {
    mode: "swim",
    terrainElevation: -4,
    waterSurfaceY: WILDS_WATERLINE_ELEVATION,
    waterDepth: 2.9,
    actorLocalY: 2.1,
    actorWorldY: -1.9,
    cameraSubmersionAllowed: true,
    scubaVisible: true,
    ...overrides
  };
}

test("admitted swimming translates camera and target below the exact shared waterline while preserving their orbit offset", () => {
  const orbitOffsetY = 3.4;
  const projected = projectUnderwaterCameraTarget({
    presentation: presentation(),
    wasSubmerged: false,
    surfaceTargetY: 0.9,
    orbitOffsetY
  });
  const localWaterSurfaceY = WILDS_WATERLINE_ELEVATION + 4;

  assert.equal(projected.submerged, true);
  assert.equal(projected.localWaterSurfaceY, localWaterSurfaceY);
  assert.ok(projected.targetY <= localWaterSurfaceY - UNDERWATER_CAMERA_ENTER_DEPTH);
  assert.ok(projected.cameraY < localWaterSurfaceY);
  assert.ok(Math.abs((projected.cameraY - projected.targetY) - orbitOffsetY) < 1e-9);
});

test("the surface hysteresis band retains underwater state until its exit threshold is crossed", () => {
  const withinBand = projectUnderwaterCameraTarget({
    presentation: presentation({ actorLocalY: 2.9 - UNDERWATER_CAMERA_EXIT_DEPTH / 2 }),
    wasSubmerged: true,
    surfaceTargetY: 0.9,
    orbitOffsetY: 0.2
  });
  const notYetEntered = projectUnderwaterCameraTarget({
    presentation: presentation({ actorLocalY: 2.9 - UNDERWATER_CAMERA_ENTER_DEPTH / 2 }),
    wasSubmerged: false,
    surfaceTargetY: 0.9,
    orbitOffsetY: 0.2
  });

  assert.equal(withinBand.submerged, true);
  assert.equal(notYetEntered.submerged, false);
});

test("leaving deep water restores the surface target without changing the preserved orbit offset", () => {
  const orbitOffsetY = 2.75;
  const projected = projectUnderwaterCameraTarget({
    presentation: presentation({
      mode: "land",
      actorLocalY: 0,
      actorWorldY: 1.25,
      cameraSubmersionAllowed: false,
      scubaVisible: false,
      waterDepth: 0
    }),
    wasSubmerged: true,
    surfaceTargetY: 1.6,
    orbitOffsetY
  });

  assert.equal(projected.submerged, false);
  assert.equal(projected.targetY, 1.6);
  assert.ok(Math.abs((projected.cameraY - projected.targetY) - orbitOffsetY) < 1e-9);
});
