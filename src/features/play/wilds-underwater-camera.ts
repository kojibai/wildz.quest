import type { WildsAquaticPresentation } from "./wilds-aquatic-presentation";

export const UNDERWATER_CAMERA_ENTER_DEPTH = 0.18;
export const UNDERWATER_CAMERA_EXIT_DEPTH = 0.08;
export const UNDERWATER_CAMERA_FRAME_DEPTH = 0.6;

export type UnderwaterCameraProjection = Readonly<{
  underwaterTargetActive: boolean;
  localWaterSurfaceY: number;
  targetY: number;
  cameraY: number;
}>;

export type MutableUnderwaterCameraProjection = {
  underwaterTargetActive: boolean;
  localWaterSurfaceY: number;
  targetY: number;
  cameraY: number;
};

export function writeUnderwaterCameraTarget(
  presentation: WildsAquaticPresentation,
  surfaceTargetY: number,
  orbitOffsetY: number,
  output: MutableUnderwaterCameraProjection,
  actorLocalY = presentation.actorLocalY
) {
  if (!Number.isFinite(surfaceTargetY) || !Number.isFinite(orbitOffsetY)) throw new Error("wilds_underwater_camera_input_invalid");
  const localWaterSurfaceY = presentation.waterSurfaceY - presentation.terrainElevation;
  const underwaterTargetActive = presentation.cameraSubmersionAllowed;
  output.underwaterTargetActive = underwaterTargetActive;
  output.localWaterSurfaceY = localWaterSurfaceY;
  if (!underwaterTargetActive) {
    output.targetY = surfaceTargetY;
    output.cameraY = surfaceTargetY + orbitOffsetY;
    return;
  }
  output.targetY = Math.min(actorLocalY, localWaterSurfaceY - UNDERWATER_CAMERA_FRAME_DEPTH - orbitOffsetY);
  output.cameraY = output.targetY + orbitOffsetY;
}

export function isUnderwaterCameraSubmerged(
  cameraY: number,
  localWaterSurfaceY: number,
  wasSubmerged: boolean,
  submersionAllowed: boolean,
  vistaActive: boolean
) {
  if (!Number.isFinite(cameraY) || !Number.isFinite(localWaterSurfaceY)) throw new Error("wilds_underwater_camera_position_invalid");
  if (!submersionAllowed || vistaActive) return false;
  return wasSubmerged
    ? cameraY < localWaterSurfaceY + UNDERWATER_CAMERA_EXIT_DEPTH
    : cameraY <= localWaterSurfaceY - UNDERWATER_CAMERA_ENTER_DEPTH;
}

export function projectUnderwaterCameraSubmersion(input: Readonly<{
  cameraY: number;
  localWaterSurfaceY: number;
  wasSubmerged: boolean;
  submersionAllowed: boolean;
  vistaActive: boolean;
}>) {
  return isUnderwaterCameraSubmerged(input.cameraY, input.localWaterSurfaceY, input.wasSubmerged, input.submersionAllowed, input.vistaActive);
}

export function projectUnderwaterCameraTarget(input: Readonly<{
  presentation: WildsAquaticPresentation;
  surfaceTargetY: number;
  orbitOffsetY: number;
  actorLocalY?: number;
}>): UnderwaterCameraProjection {
  const output: MutableUnderwaterCameraProjection = { underwaterTargetActive: false, localWaterSurfaceY: 0, targetY: 0, cameraY: 0 };
  writeUnderwaterCameraTarget(input.presentation, input.surfaceTargetY, input.orbitOffsetY, output, input.actorLocalY);
  return Object.freeze(output);
}
