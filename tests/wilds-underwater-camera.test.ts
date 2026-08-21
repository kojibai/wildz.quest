import assert from "node:assert/strict";
import { test } from "node:test";
import type { WildsAquaticPresentation } from "../src/features/play/wilds-aquatic-presentation";
import { WILDS_WATERLINE_ELEVATION } from "../src/features/play/wilds-aquatic-presentation";
import {
  UNDERWATER_CAMERA_ENTER_DEPTH,
  UNDERWATER_CAMERA_EXIT_DEPTH,
  projectUnderwaterCameraSubmersion,
  projectUnderwaterCameraTarget
} from "../src/features/play/wilds-underwater-camera";
import { projectWildsTraversalStatus } from "../src/features/play/wilds-traversal-status";

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
    surfaceTargetY: 0.9,
    orbitOffsetY
  });
  const localWaterSurfaceY = WILDS_WATERLINE_ELEVATION + 4;

  assert.equal(projected.underwaterTargetActive, true);
  assert.equal(projected.localWaterSurfaceY, localWaterSurfaceY);
  assert.ok(projected.targetY <= localWaterSurfaceY - UNDERWATER_CAMERA_ENTER_DEPTH);
  assert.ok(projected.cameraY < localWaterSurfaceY);
  assert.ok(Math.abs((projected.cameraY - projected.targetY) - orbitOffsetY) < 1e-9);
});

test("camera target follows the current dive offset instead of the fixed surface-swim pose", () => {
  const surface = projectUnderwaterCameraTarget({
    presentation: presentation(), surfaceTargetY: .9, orbitOffsetY: .8, actorLocalY: 2.1
  });
  const deep = projectUnderwaterCameraTarget({
    presentation: presentation(), surfaceTargetY: .9, orbitOffsetY: .8, actorLocalY: .4
  });

  assert.ok(deep.targetY < surface.targetY);
  assert.ok(Math.abs((deep.cameraY - deep.targetY) - .8) < 1e-9);
});

test("actual damped camera crossing owns enter, hold, exit, and vista submersion", () => {
  const localWaterSurfaceY = WILDS_WATERLINE_ELEVATION + 4;
  const notYetEntered = projectUnderwaterCameraSubmersion({
    cameraY: localWaterSurfaceY - UNDERWATER_CAMERA_ENTER_DEPTH / 2,
    localWaterSurfaceY,
    wasSubmerged: false,
    submersionAllowed: true,
    vistaActive: false
  });
  const entered = projectUnderwaterCameraSubmersion({
    cameraY: localWaterSurfaceY - UNDERWATER_CAMERA_ENTER_DEPTH,
    localWaterSurfaceY,
    wasSubmerged: false,
    submersionAllowed: true,
    vistaActive: false
  });
  const withinBand = projectUnderwaterCameraSubmersion({
    cameraY: localWaterSurfaceY + UNDERWATER_CAMERA_EXIT_DEPTH / 2,
    localWaterSurfaceY,
    wasSubmerged: true,
    submersionAllowed: true,
    vistaActive: false
  });
  const exited = projectUnderwaterCameraSubmersion({
    cameraY: localWaterSurfaceY + UNDERWATER_CAMERA_EXIT_DEPTH,
    localWaterSurfaceY,
    wasSubmerged: true,
    submersionAllowed: true,
    vistaActive: false
  });
  const vista = projectUnderwaterCameraSubmersion({
    cameraY: localWaterSurfaceY - 2,
    localWaterSurfaceY,
    wasSubmerged: true,
    submersionAllowed: true,
    vistaActive: true
  });

  assert.equal(entered, true);
  assert.equal(withinBand, true);
  assert.equal(notYetEntered, false);
  assert.equal(exited, false);
  assert.equal(vista, false);
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
    surfaceTargetY: 1.6,
    orbitOffsetY
  });

  assert.equal(projected.underwaterTargetActive, false);
  assert.equal(projected.targetY, 1.6);
  assert.ok(Math.abs((projected.cameraY - projected.targetY) - orbitOffsetY) < 1e-9);
});

test("aquatic status wins over grounded recharge while actual aerial traversal owns flight status", () => {
  assert.equal(projectWildsTraversalStatus({
    aerialMode: "ground",
    aquaticMode: "swim",
    aquaticStatus: "Swimming with Nami · Swim control 82",
    flightStatus: "Recharge on the ground · 10%"
  }), "Swimming with Nami · Swim control 82");
  assert.equal(projectWildsTraversalStatus({
    aerialMode: "flight",
    aquaticMode: "land",
    aquaticStatus: null,
    flightStatus: "Flight energy · 65%"
  }), "Flight energy · 65%");
});
