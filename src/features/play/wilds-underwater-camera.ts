import type { WildsAquaticPresentation } from "./wilds-aquatic-presentation";

export const UNDERWATER_CAMERA_ENTER_DEPTH = 0.18;
export const UNDERWATER_CAMERA_EXIT_DEPTH = 0.08;

export type UnderwaterCameraProjection = Readonly<{
  submerged: boolean;
  localWaterSurfaceY: number;
  targetY: number;
  cameraY: number;
}>;

export type MutableUnderwaterCameraProjection = {
  submerged: boolean;
  localWaterSurfaceY: number;
  targetY: number;
  cameraY: number;
};

export function writeUnderwaterCameraTarget(
  presentation: WildsAquaticPresentation,
  wasSubmerged: boolean,
  surfaceTargetY: number,
  orbitOffsetY: number,
  output: MutableUnderwaterCameraProjection
) {
  if (!Number.isFinite(surfaceTargetY) || !Number.isFinite(orbitOffsetY)) throw new Error("wilds_underwater_camera_input_invalid");
  const localWaterSurfaceY = presentation.waterSurfaceY - presentation.terrainElevation;
  const depthBelowSurface = localWaterSurfaceY - presentation.actorLocalY;
  const submerged = presentation.cameraSubmersionAllowed
    && (wasSubmerged ? depthBelowSurface >= -UNDERWATER_CAMERA_EXIT_DEPTH : depthBelowSurface >= UNDERWATER_CAMERA_ENTER_DEPTH);
  output.submerged = submerged;
  output.localWaterSurfaceY = localWaterSurfaceY;
  if (!submerged) {
    output.targetY = surfaceTargetY;
    output.cameraY = surfaceTargetY + orbitOffsetY;
    return;
  }
  output.targetY = Math.min(presentation.actorLocalY, localWaterSurfaceY - UNDERWATER_CAMERA_EXIT_DEPTH - orbitOffsetY);
  output.cameraY = output.targetY + orbitOffsetY;
}

export function projectUnderwaterCameraTarget(input: Readonly<{
  presentation: WildsAquaticPresentation;
  wasSubmerged: boolean;
  surfaceTargetY: number;
  orbitOffsetY: number;
}>): UnderwaterCameraProjection {
  const output: MutableUnderwaterCameraProjection = { submerged: false, localWaterSurfaceY: 0, targetY: 0, cameraY: 0 };
  writeUnderwaterCameraTarget(input.presentation, input.wasSubmerged, input.surfaceTargetY, input.orbitOffsetY, output);
  return Object.freeze(output);
}
