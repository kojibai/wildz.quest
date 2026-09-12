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
