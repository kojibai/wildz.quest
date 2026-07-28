export type CardSaveState = "idle" | "preparing" | "saving" | "success" | "error";
export type CardHapticKind = "press" | "success" | "error";

const presentations: Record<CardSaveState, { busy: boolean; button: string; message: string }> = {
  idle: { busy: false, button: "Save verified card", message: "" },
  preparing: {
    busy: true,
    button: "Preparing proof…",
    message: "Creating your portable, verified card proof…"
  },
  saving: {
    busy: true,
    button: "Sealing verified card…",
    message: "Sealing your verified collectible…"
  },
  success: {
    busy: false,
    button: "Card secured",
    message: "Card secured. Your verified collectible is ready to keep or share."
  },
  error: { busy: false, button: "Retry save", message: "" }
};

const hapticPatterns: Record<CardHapticKind, number | number[]> = {
  press: 10,
  success: [12, 34, 22],
  error: [18, 32, 18]
};

export function cardSavePresentation(state: CardSaveState) {
  return presentations[state];
}

export function triggerCardHaptic(
  kind: CardHapticKind,
  vibrate: ((pattern: number | number[]) => boolean) | undefined =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
    ? (pattern) => navigator.vibrate(pattern)
    : undefined
) {
  if (!vibrate) return false;
  try {
    return Boolean(vibrate(hapticPatterns[kind]));
  } catch {
    return false;
  }
}
