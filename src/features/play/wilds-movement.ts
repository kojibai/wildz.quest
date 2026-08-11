export const WILDS_MOVEMENT_MODE_KEY = "receiz:wilds:movement-mode:v1";

export type WildsMovementMode = "walk" | "run";

export function advanceMovementEmissionDeadline(nextAt: number, now: number, intervalMs = 45) {
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 45;
  const deadline = Number.isFinite(nextAt) ? nextAt : now + interval;
  if (now < deadline) return { emit: false, nextAt: deadline };
  return {
    emit: true,
    nextAt: now - deadline >= interval ? now + interval : deadline + interval
  };
}

export function normalizeWildsMovementMode(value: unknown): WildsMovementMode {
  return value === "run" ? "run" : "walk";
}

export function movementScale(mode: WildsMovementMode) {
  return mode === "run" ? 1.25 : 1;
}

export function cameraRelativeMovement(vector: { x: number; z: number }, cameraHeading: number) {
  const heading = Number.isFinite(cameraHeading) ? cameraHeading : 0;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  return {
    x: vector.x * cosine + vector.z * sine,
    z: -vector.x * sine + vector.z * cosine
  };
}
