import type { WildsInput } from "./game-state";

export type WildsJumpMovement = Extract<WildsInput, {type: "move" | "move-vector"}>;
export type WildsJumpTravel = {input: WildsJumpMovement; elapsedMs: number};
export const WILDS_MOVEMENT_REPEAT_MS = 45;

export function captureWildsJumpTravel(last: {input: WildsJumpMovement; at: number} | null, now: number): WildsJumpTravel | null {
  if (!last || now - last.at > 150 || now < last.at) return null;
  if (last.input.type === "move-vector" && Math.hypot(last.input.x, last.input.z) < .08) return null;
  return {input: {...last.input}, elapsedMs: 0};
}

/** The same input and cadence as ground travel. Release keeps takeoff momentum until landing. */
export function advanceWildsJumpTravel(travel: WildsJumpTravel, deltaSeconds: number) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  travel.elapsedMs += Math.min(.1, deltaSeconds) * 1000;
  const steps = Math.floor((travel.elapsedMs + 1e-7) / WILDS_MOVEMENT_REPEAT_MS);
  travel.elapsedMs -= steps * WILDS_MOVEMENT_REPEAT_MS;
  return steps;
}
