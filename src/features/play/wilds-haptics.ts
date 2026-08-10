export type WildsHapticEvent =
  | "wheel-open"
  | "wheel-detent"
  | "confirm"
  | "cancel"
  | "cycle"
  | "drawer-open";

const WILDS_HAPTIC_PATTERNS: Record<WildsHapticEvent, readonly number[]> = {
  "wheel-open": [8],
  "wheel-detent": [5],
  confirm: [14, 18, 24],
  cancel: [7, 22, 7],
  cycle: [6],
  "drawer-open": [9, 14, 9]
};

export function wildsHapticPattern(event: WildsHapticEvent): readonly number[] {
  return WILDS_HAPTIC_PATTERNS[event];
}

export function playWildsHaptic(
  event: WildsHapticEvent,
  vibrate: ((pattern: number | readonly number[]) => boolean) | undefined = typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
    ? (pattern) => navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern])
    : undefined
): boolean {
  if (!vibrate) return false;
  try {
    return vibrate(wildsHapticPattern(event)) === true;
  } catch {
    return false;
  }
}
