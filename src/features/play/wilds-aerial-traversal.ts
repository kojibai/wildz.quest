import type { WildsTraversalCapability } from "./wilds-traversal-capabilities";

type Point = Readonly<{ x: number; z: number }>;

export type WildsAerialMode = "ground" | "glide" | "flight";
export type WildsAerialLandingReason = "flight-exhausted" | "protected-airspace" | "landed";

export type WildsAerialTraversalState = {
  mode: WildsAerialMode;
  altitude: number;
  verticalVelocity: number;
  stamina: number;
  distance: number;
  safeAnchor: { x: number; z: number; elevation: number };
  landingRequired: boolean;
  landingReason: WildsAerialLandingReason | null;
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
  flightEndurancePotential?: number;
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
    || (input.flightEndurancePotential !== undefined && !Number.isFinite(input.flightEndurancePotential))
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

  if (state.landingRequired) {
    output.reason = state.landingReason;
    output.horizontalAllowed = false;
    return output;
  }

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
    const reason = input.protectedAirspace ? "protected-airspace" : "landed";
    requestWildsAerialLanding(state, reason);
    output.reason = reason;
    output.horizontalAllowed = false;
    return output;
  }

  state.distance = quantize(state.distance + distance);
  if (state.mode === "flight") {
    const endurance = bounded(input.flightEndurancePotential ?? 0, 0, 1);
    const enduranceMultiplier = 1 - endurance * .5;
    state.stamina = quantize(Math.max(0, state.stamina - delta * (1.4 + distance * .8) * enduranceMultiplier));
    if (state.stamina <= 0) {
      if (input.hasGlide) {
        state.mode = "glide";
        state.verticalVelocity = -.72;
        output.reason = "flight-exhausted";
      } else {
        requestWildsAerialLanding(state, "flight-exhausted");
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
    const reason = state.stamina <= 0 ? "flight-exhausted" : "landed";
    requestWildsAerialLanding(state, reason);
    output.reason = reason;
    output.horizontalAllowed = false;
  }
  return output;
}

const AIR_GROUND_CLEARANCE = .35;

const GLIDE_LAUNCH_HEIGHT = 2;
export const WILDS_FLIGHT_RELAUNCH_ENERGY = 20;
const FLIGHT_LOW_ENERGY = 25;
const GROUND_ENERGY_RECOVERY_PER_SECOND = 24;

export function projectWildsFlightEndurancePotential(level: number) {
  if (!Number.isFinite(level)) throw new Error("wilds_flight_level_invalid");
  return bounded((Math.max(1, Math.floor(level)) - 1) / 19, 0, 1);
}

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
    safeAnchor: { x: quantize(position.x), z: quantize(position.z), elevation: quantize(elevation) },
    landingRequired: false,
    landingReason: null
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
      verticalVelocity: input.kind === "flight" ? 2.2 : -0.72,
      landingRequired: false,
      landingReason: null
    },
    reason: null,
    horizontalAllowed: true
  };
}

export function requestWildsAerialLanding(
  state: WildsAerialTraversalState,
  reason: WildsAerialLandingReason = "landed"
) {
  if (state.mode === "ground") return state;
  state.landingRequired = true;
  state.landingReason = reason;
  state.verticalVelocity = Math.min(0, state.verticalVelocity);
  return state;
}

export function completeWildsAerialLanding(
  state: WildsAerialTraversalState,
  x: number,
  z: number,
  elevation: number
) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(elevation)) {
    throw new Error("wilds_aerial_landing_invalid");
  }
  state.mode = "ground";
  state.altitude = quantize(elevation);
  state.verticalVelocity = 0;
  state.safeAnchor.x = quantize(x);
  state.safeAnchor.z = quantize(z);
  state.safeAnchor.elevation = quantize(elevation);
  state.landingRequired = false;
  state.landingReason = null;
  return state;
}
