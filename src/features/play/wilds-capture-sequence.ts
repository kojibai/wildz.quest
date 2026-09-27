export const WILDS_CAPSULE_CAPTURE_MS = 1_250;
export const WILDS_CAPTURE_SEAL_MS = 700;
export const WILDS_CAPTURE_EMERGE_MS = 1_050;

export type WildsCaptureVisualPhase = "emerging" | "capsule" | "sealed" | "revealed";

/** A stalled frame must not jump the ball straight to its final pose. */
export const WILDS_CAPTURE_MAX_FRAME_MS = 50;
export function advanceCaptureVisualTime(elapsedMs: number, frameDeltaMs: number): number {
  return elapsedMs + Math.max(0, Math.min(WILDS_CAPTURE_MAX_FRAME_MS, Number.isFinite(frameDeltaMs) ? frameDeltaMs : 0));
}

/** The reward opens only after the in-world ball has drawn in and sealed the creature. */
export function capturePhaseDelayMs(phase: string, reducedMotion: boolean): number | null {
  if (phase === "emerging") return reducedMotion ? 0 : WILDS_CAPTURE_EMERGE_MS;
  if (phase === "capsule") return reducedMotion ? 350 : WILDS_CAPSULE_CAPTURE_MS;
  if (phase === "sealed") return reducedMotion ? 400 : WILDS_CAPTURE_SEAL_MS;
  return null;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function smoothstep(from: number, to: number, value: number) {
  const amount = clamp01((value - from) / (to - from));
  return amount * amount * (3 - 2 * amount);
}

/** Cosmetic projection only: proof and inventory admission remain in the game reducer. */
export function projectCaptureMoment(phase: WildsCaptureVisualPhase, elapsedMs: number) {
  if (phase === "emerging") {
    const progress = clamp01(elapsedMs / WILDS_CAPTURE_EMERGE_MS);
    const anticipation = progress === 0 || progress === 1 ? 0 : Math.sin(Math.PI * progress);
    return { creatureScale: 1 + anticipation * 0.035, creatureLift: anticipation * 0.06, ballScale: 0, ballLift: 0, ballTravel: 0, lockPulse: 0 };
  }
  if (phase === "sealed" || phase === "revealed") return { creatureScale: 0, creatureLift: 0.7, ballScale: 1, ballLift: 0, ballTravel: 0, lockPulse: 1 };
  const progress = clamp01(elapsedMs / WILDS_CAPSULE_CAPTURE_MS);
  const drawIn = smoothstep(0.12, 0.82, progress);
  const ballArrival = smoothstep(0, 0.38, progress);
  return {
    creatureScale: 1 - drawIn * 0.995,
    creatureLift: drawIn * 0.7,
    ballScale: 0.2 + ballArrival * 0.8,
    ballLift: (1 - ballArrival) * 0.72,
    ballTravel: (1 - ballArrival) * 1.2,
    lockPulse: smoothstep(0.78, 1, progress)
  };
}
