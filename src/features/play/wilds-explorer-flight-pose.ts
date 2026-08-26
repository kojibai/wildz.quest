export type WildsWingRotationTarget = {
  rotation: { x: number; y: number; z: number };
};

export type WildsExplorerRotationTarget = {
  x: number;
  y: number;
  z: number;
  order: string;
};

export function nextWildsExplorerFacing(current: number, target: number, blend: number) {
  const shortestDelta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + shortestDelta * Math.max(0, Math.min(1, blend));
}

export function writeWildsExplorerOrientation(
  rotation: WildsExplorerRotationTarget,
  heading: number,
  pitch: number,
  blend: number
) {
  rotation.order = "YXZ";
  rotation.y = nextWildsExplorerFacing(rotation.y, heading, blend);
  rotation.x = pitch;
  rotation.z = 0;
}

export function writeWildsExplorerWingFlightPose(
  left: WildsWingRotationTarget,
  right: WildsWingRotationTarget,
  airborne: boolean,
  gliding: boolean,
  elapsedSeconds: number,
  motionScale: number,
  verticalVelocity: number
) {
  if (!airborne) {
    left.rotation.x = .12;
    left.rotation.y = .18;
    left.rotation.z = -1.42;
    right.rotation.x = -.12;
    right.rotation.y = -.18;
    right.rotation.z = 1.42;
    return;
  }

  const animated = motionScale > 0 && !gliding;
  const flap = animated ? Math.sin(elapsedSeconds * 4.4) * .26 * motionScale : 0;
  const sweep = animated ? Math.cos(elapsedSeconds * 4.4) * .055 * motionScale : 0;
  const flare = verticalVelocity < -.2 ? -.08 : verticalVelocity > .2 ? .08 : 0;
  const lateralAngle = .58 + flare;
  left.rotation.x = .06;
  left.rotation.y = .08 + sweep;
  left.rotation.z = lateralAngle + flap;
  right.rotation.x = -.06;
  right.rotation.y = -.08 - sweep;
  right.rotation.z = -lateralAngle - flap;
}
