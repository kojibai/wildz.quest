export type CompanionGesturePoint = Readonly<{ x: number; y: number }>;

export const COMPANION_HOLD_MS = 96;
export const COMPANION_TAP_SLOP_PX = 10;
export const COMPANION_AXIS_LOCK_PX = 18;
export const COMPANION_CYCLE_PX = 44;
export const COMPANION_DRAWER_PX = 54;
export const COMPANION_ABILITY_RADIUS_PX = 22;

export type CompanionGestureMode = "pending" | "horizontal" | "vertical" | "ability-wheel" | "cancelled";

export type CompanionGestureState = Readonly<{
  origin: CompanionGesturePoint;
  last: CompanionGesturePoint;
  startedAt: number;
  updatedAt: number;
  mode: CompanionGestureMode;
  activeAbilityIndex: 0 | 1 | 2 | 3 | null;
}>;

export type CompanionGestureResult =
  | { kind: "tap-power" }
  | { kind: "cycle-previous" }
  | { kind: "cycle-next" }
  | { kind: "open-drawer" }
  | { kind: "open-ability-wheel" }
  | { kind: "select-ability"; index: 0 | 1 | 2 | 3 }
  | { kind: "cancel" };

function distanceFromOrigin(state: CompanionGestureState, point: CompanionGesturePoint) {
  return Math.hypot(point.x - state.origin.x, point.y - state.origin.y);
}

function abilityIndex(state: CompanionGestureState, point: CompanionGesturePoint): 0 | 1 | 2 | 3 | null {
  const dx = point.x - state.origin.x;
  const dy = point.y - state.origin.y;
  if (Math.hypot(dx, dy) < COMPANION_ABILITY_RADIUS_PX) return null;
  const angle = Math.atan2(dy, dx);
  if (angle >= -Math.PI / 4 && angle < Math.PI / 4) return 1;
  if (angle >= Math.PI / 4 && angle < Math.PI * 3 / 4) return 2;
  if (angle >= -Math.PI * 3 / 4 && angle < -Math.PI / 4) return 0;
  return 3;
}

export function createCompanionGesture(origin: CompanionGesturePoint, at: number): CompanionGestureState {
  return { origin, last: origin, startedAt: at, updatedAt: at, mode: "pending", activeAbilityIndex: null };
}

export function advanceCompanionGesture(state: CompanionGestureState, at: number): CompanionGestureState {
  if (state.mode !== "pending"
    || at - state.startedAt < COMPANION_HOLD_MS
    || distanceFromOrigin(state, state.last) > COMPANION_TAP_SLOP_PX) return state;
  return { ...state, updatedAt: at, mode: "ability-wheel" };
}

export function moveCompanionGesture(
  state: CompanionGestureState,
  point: CompanionGesturePoint,
  at: number
): CompanionGestureState {
  if (state.mode === "cancelled") return state;
  const advanced = advanceCompanionGesture(state, at);
  if (advanced.mode === "ability-wheel") {
    return { ...advanced, last: point, updatedAt: at, activeAbilityIndex: abilityIndex(advanced, point) };
  }
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
    return dy <= -COMPANION_DRAWER_PX ? { kind: "open-drawer" } : { kind: "cancel" };
  }
  if (final.mode === "ability-wheel") {
    return final.activeAbilityIndex === null
      ? { kind: "cancel" }
      : { kind: "select-ability", index: final.activeAbilityIndex };
  }
  if (final.mode === "pending" && distanceFromOrigin(final, point) <= COMPANION_TAP_SLOP_PX) {
    return { kind: "tap-power" };
  }
  return { kind: "cancel" };
}

export function cancelCompanionGesture(_state: CompanionGestureState): CompanionGestureResult {
  return { kind: "cancel" };
}
