export type WildsEnvironmentCapabilityFamily = "current" | "balance" | "light" | "camouflage" | "track" | "anchor";

function bounded(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function beginWildsCurrentRide(input: Readonly<{
  flow: Readonly<{ x: number; z: number }>;
  flowStrength: number;
  creaturePower: number;
}>) {
  const length = Math.hypot(input.flow.x, input.flow.z);
  if (!Number.isFinite(length) || length <= 0) throw new Error("wilds_current_flow_invalid");
  const speed = bounded(input.flowStrength, 0, 1) * (.6 + bounded(input.creaturePower, 0, 100) / 100 * .6);
  return Object.freeze({
    velocity: Object.freeze({ x: input.flow.x / length * speed, z: input.flow.z / length * speed }),
    speed
  });
}

export function beginWildsBalance(input: Readonly<{
  width: number;
  instability: number;
  creatureControl: number;
}>) {
  if (!Number.isFinite(input.width) || input.width <= 0) throw new Error("wilds_balance_surface_invalid");
  const control = bounded(input.creatureControl, 0, 100) / 100;
  const instability = bounded(input.instability);
  const stability = bounded(1 - instability * (1 - control));
  return Object.freeze({ stability, lateralScale: Math.max(.25, 1 - control * .55) });
}

export function toggleWildsLivingLight(input: Readonly<{ active: boolean; creaturePower: number }>) {
  const active = !input.active;
  const power = bounded(input.creaturePower, 0, 100);
  return Object.freeze({
    active,
    radius: active ? Math.round((3 + power / 25) * 10) / 10 : 0,
    discoveryClarity: active ? Math.round((.5 + power / 200) * 100) / 100 : 0
  });
}

export function toggleWildsCamouflage(input: Readonly<{
  active: boolean;
  terrainCompatible: boolean;
  creatureControl: number;
}>) {
  if (!input.active && !input.terrainCompatible) {
    return Object.freeze({ active: false as const, detectionScale: 1, reason: "compatible_cover_required" as const });
  }
  const active = !input.active;
  return Object.freeze({
    active,
    detectionScale: active ? Math.max(.2, .65 - bounded(input.creatureControl, 0, 100) * .005) : 1,
    reason: null
  });
}

export type WildsTrackTrace = Readonly<{
  id: string;
  admitted: boolean;
  private: boolean;
  urgency: number;
  distance: number;
  position: Readonly<{ x: number; z: number }>;
}>;

export function projectWildsTrackTrail(traces: readonly WildsTrackTrace[]) {
  const ordered = traces
    .filter((trace) => trace.admitted && !trace.private && Number.isFinite(trace.distance) && trace.distance >= 0)
    .sort((left, right) => right.urgency - left.urgency || left.distance - right.distance || left.id.localeCompare(right.id))
    .slice(0, 8);
  const primary = ordered[0];
  if (!primary) return null;
  return Object.freeze({
    targetId: primary.id,
    targetPosition: primary.position,
    orderedTraceIds: Object.freeze(ordered.map((trace) => trace.id))
  });
}

export type WildsSustainedEnvironmentState = Readonly<{
  family: WildsEnvironmentCapabilityFamily;
  active: boolean;
}>;

export type WildsSustainedBreakEvent = "movement" | "sprint" | "attack" | "harvest" | "construction";

export function reduceWildsSustainedEnvironment(
  state: WildsSustainedEnvironmentState,
  event: WildsSustainedBreakEvent
): WildsSustainedEnvironmentState {
  const breaksAnchor = state.family === "anchor" && event === "movement";
  const breaksCamouflage = state.family === "camouflage" && ["sprint", "attack", "harvest", "construction"].includes(event);
  return breaksAnchor || breaksCamouflage ? Object.freeze({ ...state, active: false }) : state;
}

