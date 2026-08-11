export type CompanionGesturePoint = Readonly<{ x: number; y: number }>;

export const COMPANION_HOLD_MS = 420;
export const COMPANION_TAP_SLOP_PX = 10;
export const COMPANION_AXIS_LOCK_PX = 18;
export const COMPANION_CYCLE_PX = 44;
export const COMPANION_DRAWER_PX = 54;
export type CompanionGestureMode = "pending" | "horizontal" | "vertical" | "quick-actions" | "cancelled";

export type CompanionGestureState = Readonly<{
  origin: CompanionGesturePoint;
  last: CompanionGesturePoint;
  startedAt: number;
  updatedAt: number;
  mode: CompanionGestureMode;
  activeAbilityIndex: 0 | 1 | 2 | 3 | null;
}>;

export type CompanionGestureResult =
  | { kind: "open-drawer-expanded" }
  | { kind: "open-quick-actions" }
  | { kind: "cycle-previous" }
  | { kind: "cycle-next" }
  | { kind: "cancel" };

function distanceFromOrigin(state: CompanionGestureState, point: CompanionGesturePoint) {
  return Math.hypot(point.x - state.origin.x, point.y - state.origin.y);
}

export function createCompanionGesture(origin: CompanionGesturePoint, at: number): CompanionGestureState {
  return { origin, last: origin, startedAt: at, updatedAt: at, mode: "pending", activeAbilityIndex: null };
}

export function advanceCompanionGesture(state: CompanionGestureState, at: number): CompanionGestureState {
  if (state.mode !== "pending"
    || at - state.startedAt < COMPANION_HOLD_MS
    || distanceFromOrigin(state, state.last) > COMPANION_TAP_SLOP_PX) return state;
  return { ...state, updatedAt: at, mode: "quick-actions" };
}

export function moveCompanionGesture(
  state: CompanionGestureState,
  point: CompanionGesturePoint,
  at: number
): CompanionGestureState {
  if (state.mode === "cancelled") return state;
  const advanced = advanceCompanionGesture(state, at);
  if (advanced.mode !== "pending") return { ...advanced, last: point, updatedAt: at };
  const dx = point.x - advanced.origin.x;
  const dy = point.y - advanced.origin.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < COMPANION_AXIS_LOCK_PX) {
    return { ...advanced, last: point, updatedAt: at };
  }
  return {
    ...advanced,
    last: point,
    updatedAt: at,
    mode: Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical"
  };
}

export function releaseCompanionGesture(
  state: CompanionGestureState,
  point: CompanionGesturePoint,
  at: number
): CompanionGestureResult {
  const final = moveCompanionGesture(state, point, at);
  const dx = point.x - final.origin.x;
  const dy = point.y - final.origin.y;
  if (final.mode === "horizontal") {
    if (dx >= COMPANION_CYCLE_PX) return { kind: "cycle-next" };
    if (dx <= -COMPANION_CYCLE_PX) return { kind: "cycle-previous" };
    return { kind: "cancel" };
  }
  if (final.mode === "vertical") {
    return dy <= -COMPANION_DRAWER_PX ? { kind: "open-drawer-expanded" } : { kind: "cancel" };
  }
  if (final.mode === "quick-actions") {
    return { kind: "open-quick-actions" };
  }
  if (final.mode === "pending" && distanceFromOrigin(final, point) <= COMPANION_TAP_SLOP_PX) {
    return { kind: "open-quick-actions" };
  }
  return { kind: "cancel" };
}

export function cancelCompanionGesture(_state: CompanionGestureState): CompanionGestureResult {
  return { kind: "cancel" };
}

export function companionCommandKeyResult(key: string): CompanionGestureResult["kind"] | null {
  if (key === "Enter" || key === " ") return "open-quick-actions";
  if (key === "ArrowUp") return "open-drawer-expanded";
  if (key === "ArrowLeft") return "cycle-previous";
  if (key === "ArrowRight") return "cycle-next";
  if (key === "Escape") return "cancel";
  return null;
}
