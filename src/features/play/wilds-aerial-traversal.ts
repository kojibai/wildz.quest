import type { WildsTraversalCapability } from "./wilds-traversal-capabilities";

type Point = Readonly<{ x: number; z: number }>;

export type WildsAerialMode = "ground" | "glide" | "flight";

export type WildsAerialTraversalState = {
  mode: WildsAerialMode;
  altitude: number;
  verticalVelocity: number;
  stamina: number;
  distance: number;
  safeAnchor: { x: number; z: number; elevation: number };
};

export type WildsAerialTraversalResult = Readonly<{
  state: WildsAerialTraversalState;
  reason: "flight-required" | "glide-required" | "launch-height-required" | "flight-recharging" | "flight-energy-low" | "flight-exhausted" | "protected-airspace" | "landed" | null;
  horizontalAllowed: boolean;
}>;

export type MutableWildsAerialRuntimeResult = {
  state: WildsAerialTraversalState;
  reason: WildsAerialTraversalResult["reason"];
  horizontalAllowed: boolean;
};

export type WildsAerialRuntimeStep = {
  deltaSeconds: number;
  groundElevation: number;
  hasFlight: boolean;
  hasGlide: boolean;
  horizontalDistance: number;
  positionX: number;
  positionZ: number;
  verticalOffset: number;
  protectedAirspace?: boolean;
};

export function createWildsAerialRuntimeResult(): MutableWildsAerialRuntimeResult {
  return {
    state: createGroundedWildsAerialState({ x: 0, z: 0 }, 0),
    reason: null,
    horizontalAllowed: true
  };
}

export function writeWildsAerialRuntimeStep(
  state: WildsAerialTraversalState,
  input: WildsAerialRuntimeStep,
  output: MutableWildsAerialRuntimeResult
) {
  if (!Number.isFinite(input.deltaSeconds)
    || !Number.isFinite(input.groundElevation)
    || !Number.isFinite(input.horizontalDistance)
    || !Number.isFinite(input.positionX)
    || !Number.isFinite(input.positionZ)
    || !Number.isFinite(input.verticalOffset)) {
    throw new Error("wilds_aerial_runtime_input_invalid");
  }
  const delta = bounded(input.deltaSeconds, 0, .1);
  const distance = bounded(input.horizontalDistance, 0, 4);
  output.state = state;
  output.reason = null;
  output.horizontalAllowed = true;

  if (state.mode === "ground") {
    state.altitude = quantize(input.groundElevation);
    state.verticalVelocity = 0;
    state.stamina = quantize(Math.min(100, state.stamina + delta * GROUND_ENERGY_RECOVERY_PER_SECOND));
    state.safeAnchor.x = quantize(input.positionX);
    state.safeAnchor.z = quantize(input.positionZ);
    state.safeAnchor.elevation = quantize(input.groundElevation);
    return output;
  }

  if (input.protectedAirspace || (state.mode === "flight" && !input.hasFlight) || (state.mode === "glide" && !input.hasGlide)) {
    state.mode = "ground";
    state.altitude = quantize(input.groundElevation);
    state.verticalVelocity = 0;
    state.safeAnchor.x = quantize(input.positionX);
    state.safeAnchor.z = quantize(input.positionZ);
    state.safeAnchor.elevation = quantize(input.groundElevation);
    output.reason = input.protectedAirspace ? "protected-airspace" : "landed";
    output.horizontalAllowed = false;
    return output;
  }

  state.distance = quantize(state.distance + distance);
  state.altitude = quantize(input.groundElevation + Math.max(0, input.verticalOffset));
  if (state.mode === "flight") {
    state.stamina = quantize(Math.max(0, state.stamina - delta * (1.4 + distance * .8)));
    if (state.stamina <= 0) {
      if (input.hasGlide) {
        state.mode = "glide";
        state.verticalVelocity = -.72;
        output.reason = "flight-exhausted";
      } else {
        state.mode = "ground";
        state.altitude = quantize(input.groundElevation);
        state.verticalVelocity = 0;
        output.reason = "flight-exhausted";
        output.horizontalAllowed = false;
      }
    } else if (state.stamina <= FLIGHT_LOW_ENERGY) {
      output.reason = "flight-energy-low";
    }
    return output;
  }

  state.stamina = quantize(Math.max(0, state.stamina - delta * (.8 + distance * .35)));
  if (state.stamina <= 0 || input.verticalOffset <= AIR_GROUND_CLEARANCE) {
    state.mode = "ground";
    state.altitude = quantize(input.groundElevation);
    state.verticalVelocity = 0;
    output.reason = "landed";
    output.horizontalAllowed = false;
  }
  return output;
}

const AIR_GROUND_CLEARANCE = .35;

const FLIGHT_CEILING = 12;
const GLIDE_LAUNCH_HEIGHT = 2;
export const WILDS_FLIGHT_RELAUNCH_ENERGY = 20;
const FLIGHT_LOW_ENERGY = 25;
const GROUND_ENERGY_RECOVERY_PER_SECOND = 24;

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
  if (input.kind === "flight" && state.stamina < WILDS_FLIGHT_RELAUNCH_ENERGY) return { state, reason: "flight-recharging", horizontalAllowed: false };
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

  if (state.mode === "ground") {
    const stamina = Math.min(100, state.stamina + delta * GROUND_ENERGY_RECOVERY_PER_SECOND);
    return { state: grounded(input.position, input.groundElevation, stamina, state.distance), reason: null, horizontalAllowed: true };
  }
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
      return { state: { ...state, mode: "glide", altitude, verticalVelocity: -0.72, stamina, distance }, reason: "flight-exhausted", horizontalAllowed: true };
    }
    return { state: { ...state, altitude, verticalVelocity, stamina, distance }, reason: stamina <= FLIGHT_LOW_ENERGY ? "flight-energy-low" : null, horizontalAllowed: true };
  }

  const stamina = quantize(Math.max(0, state.stamina - delta * (0.8 + horizontalDistance * 0.35)));
  const verticalVelocity = quantize(Math.max(-2.4, state.verticalVelocity - delta * 0.38));
  const altitude = quantize(state.altitude + verticalVelocity * delta - horizontalDistance * 0.06);
  if (altitude <= input.groundElevation + 0.15 || stamina <= 0) return land();
  return { state: { ...state, altitude, verticalVelocity, stamina, distance }, reason: null, horizontalAllowed: true };
}
