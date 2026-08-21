import type { WildsTraversalCapability } from "./wilds-traversal-capabilities";

type Point = Readonly<{ x: number; z: number }>;

export type WildsAerialMode = "ground" | "glide" | "flight";

export type WildsAerialTraversalState = Readonly<{
  mode: WildsAerialMode;
  altitude: number;
  verticalVelocity: number;
  stamina: number;
  distance: number;
  safeAnchor: Readonly<{ x: number; z: number; elevation: number }>;
}>;

export type WildsAerialTraversalResult = Readonly<{
  state: WildsAerialTraversalState;
  reason: "flight-required" | "glide-required" | "launch-height-required" | "protected-airspace" | "landed" | null;
  horizontalAllowed: boolean;
}>;

const FLIGHT_CEILING = 12;
const GLIDE_LAUNCH_HEIGHT = 2;

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function bounded(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finitePoint(point: Point) {
  return Number.isFinite(point.x) && Number.isFinite(point.z);
}

function grounded(position: Point, elevation: number, stamina: number, distance: number): WildsAerialTraversalState {
  return {
    mode: "ground",
    altitude: quantize(elevation),
    verticalVelocity: 0,
    stamina: quantize(bounded(stamina, 0, 100)),
    distance: quantize(Math.max(0, distance)),
    safeAnchor: { x: quantize(position.x), z: quantize(position.z), elevation: quantize(elevation) }
  };
}

export function createGroundedWildsAerialState(position: Point, elevation: number): WildsAerialTraversalState {
  if (!finitePoint(position) || !Number.isFinite(elevation)) throw new Error("wilds_aerial_state_invalid");
  return grounded(position, elevation, 100, 0);
}

export function beginWildsAerialTraversal(
  state: WildsAerialTraversalState,
  input: {
    kind: "glide" | "flight";
    capabilities: readonly WildsTraversalCapability[];
    launchHeight?: number;
  }
): WildsAerialTraversalResult {
  const capabilities = new Set(input.capabilities);
  if (input.kind === "flight" && !capabilities.has("flight")) return { state, reason: "flight-required", horizontalAllowed: false };
  if (input.kind === "glide" && !capabilities.has("glide")) return { state, reason: "glide-required", horizontalAllowed: false };
  const launchHeight = input.launchHeight ?? Math.max(0, state.altitude - state.safeAnchor.elevation);
  if (input.kind === "glide" && launchHeight < GLIDE_LAUNCH_HEIGHT) {
    return { state, reason: "launch-height-required", horizontalAllowed: false };
  }
  const altitude = input.kind === "flight"
    ? Math.max(state.altitude, state.safeAnchor.elevation + 0.35)
    : state.safeAnchor.elevation + launchHeight;
  return {
    state: {
      ...state,
      mode: input.kind,
      altitude: quantize(altitude),
      verticalVelocity: input.kind === "flight" ? 2.2 : -0.72
    },
    reason: null,
    horizontalAllowed: true
  };
}

export function advanceWildsAerialTraversal(
  state: WildsAerialTraversalState,
  input: {
    capabilities: readonly WildsTraversalCapability[];
    deltaSeconds: number;
    groundElevation: number;
    horizontalDistance: number;
    position: Point;
    verticalIntent: number;
    landingRequested?: boolean;
    protectedAirspace?: boolean;
  }
): WildsAerialTraversalResult {
  if (!finitePoint(input.position)
    || !Number.isFinite(input.deltaSeconds)
    || !Number.isFinite(input.groundElevation)
    || !Number.isFinite(input.horizontalDistance)
    || !Number.isFinite(input.verticalIntent)) throw new Error("wilds_aerial_input_invalid");
  const delta = bounded(input.deltaSeconds, 0, 0.1);
  const horizontalDistance = bounded(input.horizontalDistance, 0, 4);
  const capabilities = new Set(input.capabilities);
  const land = (reason: WildsAerialTraversalResult["reason"] = "landed"): WildsAerialTraversalResult => ({
    state: grounded(input.position, input.groundElevation, state.stamina, state.distance),
    reason,
    horizontalAllowed: reason !== "protected-airspace"
  });

  if (state.mode === "ground") return { state: grounded(input.position, input.groundElevation, state.stamina, state.distance), reason: null, horizontalAllowed: true };
  if (input.landingRequested) return land();
  if (input.protectedAirspace) return land("protected-airspace");
  if (state.mode === "flight" && !capabilities.has("flight")) {
    if (!capabilities.has("glide") || state.altitude <= input.groundElevation + 0.15) return land();
    return {
      state: { ...state, mode: "glide", verticalVelocity: -0.72 },
      reason: null,
      horizontalAllowed: true
    };
  }
  if (state.mode === "glide" && !capabilities.has("glide")) return land();

  const distance = quantize(state.distance + horizontalDistance);
  if (state.mode === "flight") {
    const stamina = quantize(Math.max(0, state.stamina - delta * (1.4 + horizontalDistance * 0.8)));
    const targetVelocity = bounded(input.verticalIntent, -1, 1) * 3;
    const verticalVelocity = quantize(state.verticalVelocity + (targetVelocity - state.verticalVelocity) * Math.min(1, delta * 5));
    const altitude = quantize(bounded(
      state.altitude + verticalVelocity * delta,
      input.groundElevation + 0.35,
      input.groundElevation + FLIGHT_CEILING
    ));
    if (stamina <= 0) {
      if (!capabilities.has("glide")) return land();
      return { state: { ...state, mode: "glide", altitude, verticalVelocity: -0.72, stamina, distance }, reason: null, horizontalAllowed: true };
    }
    return { state: { ...state, altitude, verticalVelocity, stamina, distance }, reason: null, horizontalAllowed: true };
  }

  const stamina = quantize(Math.max(0, state.stamina - delta * (0.8 + horizontalDistance * 0.35)));
  const verticalVelocity = quantize(Math.max(-2.4, state.verticalVelocity - delta * 0.38));
  const altitude = quantize(state.altitude + verticalVelocity * delta - horizontalDistance * 0.06);
  if (altitude <= input.groundElevation + 0.15 || stamina <= 0) return land();
  return { state: { ...state, altitude, verticalVelocity, stamina, distance }, reason: null, horizontalAllowed: true };
}
