export type WildsCompanionGait = { distance: number; speed: number };
/** Distance-driven strides stop when travel stops, independent of frame rate. */
export function companionFootStep(distance: number, side: number, front: number, moving: boolean) {
  const phase = distance * Math.PI * 2 / .65 + (side * front > 0 ? 0 : Math.PI);
  return { z: moving ? Math.cos(phase) * .10 : 0, lift: moving ? Math.max(0, Math.sin(phase)) * .075 : 0 };
}

const BIPED_ROWS = Object.freeze([1]);
const QUADRUPED_ROWS = Object.freeze([-1, 1]);
const NO_LEGS = Object.freeze([] as number[]);
export function companionFootRows(locomotion: "biped" | "quadruped" | "flying" | "serpentine") {
  return locomotion === "biped" ? BIPED_ROWS : locomotion === "quadruped" ? QUADRUPED_ROWS : NO_LEGS;
}

export type WildsCompanionAnimation = { distance: number; sourceDistance: number; weight: number };
/** Compress extreme travel speeds into readable strides rather than aliasing a
 * tiny physical stride above the display's frame rate. Never changes travel. */
export function writeWildsCompanionAnimation(state: WildsCompanionAnimation, gait: WildsCompanionGait | null, delta: number) {
  const dt = Math.max(0, Math.min(.1, delta));
  const source = gait?.distance ?? 0;
  const moved = Math.max(0, source - state.sourceDistance);
  state.sourceDistance = source;
  state.distance += Math.min(moved, .65 * 4 * dt);
  const target = Math.min(1, Math.max(0, (gait?.speed ?? 0) / .8));
  state.weight += (target - state.weight) * (1 - Math.exp(-18 * dt));
}
