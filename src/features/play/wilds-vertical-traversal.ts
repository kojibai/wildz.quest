import { WILDS_PLAYER_BODY_HEIGHT } from "./wilds-player-body";

export type WildsVerticalTraversalLayer = "ground" | "water" | "air";
export type WildsVerticalTraversalIntent = -1 | 0 | 1;

export type WildsVerticalTraversalState = {
  layer: WildsVerticalTraversalLayer;
  offset: number;
  worldY: number;
  intent: WildsVerticalTraversalIntent;
  safeMin: number;
  safeMax: number;
};

export type WildsVerticalTraversalStep = {
  layer: WildsVerticalTraversalLayer;
  deltaSeconds: number;
  intent: WildsVerticalTraversalIntent;
  terrainElevation: number;
  waterSurfaceY?: number;
  pressurePotential?: number;
  liftPotential?: number;
  stamina: number;
  powered?: boolean;
  obstacleTopY?: number;
  ceilingY?: number;
  initialOffset?: number;
};

const WATER_FLOOR_CLEARANCE = .32;
const WATER_SURFACE_CLEARANCE = .85;
const AIR_GROUND_CLEARANCE = .35;
const AIR_OBSTACLE_CLEARANCE = .35;
const AIR_CEILING_CLEARANCE = .45;
export const WILDS_POWERED_FLIGHT_CRUISE_CLEARANCE = 6;
const POWERED_TAKEOFF_SPEED = 2.15;
const POWERED_ASCENT_BASE_SPEED = 1.2;
const POWERED_ASCENT_LIFT_SPEED = .7;
const POWERED_DESCENT_SPEED = 1.05;

function bounded(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function createWildsVerticalTraversalState(): WildsVerticalTraversalState {
  return { layer: "ground", offset: 0, worldY: 0, intent: 0, safeMin: 0, safeMax: 0 };
}

export function resetWildsVerticalTraversalState(state: WildsVerticalTraversalState) {
  state.layer = "ground";
  state.offset = 0;
  state.worldY = 0;
  state.intent = 0;
  state.safeMin = 0;
  state.safeMax = 0;
  return state;
}

export function writeWildsVerticalTraversalStep(
  state: WildsVerticalTraversalState,
  input: WildsVerticalTraversalStep
) {
  if (!Number.isFinite(input.deltaSeconds)
    || !Number.isFinite(input.terrainElevation)
    || !Number.isFinite(input.stamina)) throw new Error("wilds_vertical_traversal_input_invalid");

  const priorLayer = state.layer;
  const delta = bounded(input.deltaSeconds, 0, .1);
  state.layer = input.layer;
  state.intent = input.intent;

  if (input.layer === "ground") {
    resetWildsVerticalTraversalState(state);
    state.worldY = quantize(input.terrainElevation);
    return state;
  }

  if (input.layer === "water") {
    if (!Number.isFinite(input.waterSurfaceY)) throw new Error("wilds_vertical_waterline_invalid");
    const column = Math.max(0, input.waterSurfaceY! - input.terrainElevation);
    const pressure = bounded(input.pressurePotential ?? 0, 0, 1);
    const admittedDepth = Math.min(column - WATER_FLOOR_CLEARANCE, 2.25 + pressure * 8);
    state.safeMin = quantize(Math.max(WATER_FLOOR_CLEARANCE, column - Math.max(0, admittedDepth)));
    state.safeMax = quantize(Math.max(state.safeMin, column - WATER_SURFACE_CLEARANCE));
    if (priorLayer !== "water") {
      state.offset = quantize(bounded(input.initialOffset ?? state.safeMax, state.safeMin, state.safeMax));
    } else {
      state.offset = quantize(bounded(state.worldY - input.terrainElevation, state.safeMin, state.safeMax));
    }
    const exhausted = input.stamina <= 0;
    const direction = exhausted ? 1 : input.intent;
    const speed = direction > 0 ? 1.35 : .9 + pressure * .85;
    state.offset = quantize(bounded(state.offset + direction * speed * delta, state.safeMin, state.safeMax));
    state.worldY = quantize(input.terrainElevation + state.offset);
    return state;
  }

  const lift = bounded(input.liftPotential ?? 0, 0, 1);
  if (priorLayer === "air") state.offset = quantize(state.worldY - input.terrainElevation);
  const obstacleFloor = Number.isFinite(input.obstacleTopY)
    ? input.obstacleTopY! - input.terrainElevation + AIR_OBSTACLE_CLEARANCE
    : AIR_GROUND_CLEARANCE;
  const aboveObstacle = priorLayer === "air" && state.offset >= obstacleFloor - .000001;
  const baseLiftCeiling = input.powered === true ? 10 + lift * 10 : 2 + lift * 10;
  const liftCeiling = input.powered !== true && priorLayer === "air"
    ? Math.max(baseLiftCeiling, state.offset)
    : baseLiftCeiling;
  const physicalCeiling = Number.isFinite(input.ceilingY)
    ? input.ceilingY! - input.terrainElevation - WILDS_PLAYER_BODY_HEIGHT - AIR_CEILING_CLEARANCE
    : liftCeiling;
  const admittedCeiling = Math.max(AIR_GROUND_CLEARANCE, Math.min(liftCeiling, physicalCeiling));
  const ceilingIntersectsActor = priorLayer === "air"
    && Number.isFinite(input.ceilingY)
    && input.terrainElevation + state.offset + WILDS_PLAYER_BODY_HEIGHT > input.ceilingY! + .000001;
  if (ceilingIntersectsActor) {
    state.safeMin = state.offset;
    state.safeMax = state.offset;
    state.worldY = quantize(input.terrainElevation + state.offset);
    return state;
  }
  const continuousCeiling = priorLayer === "air" ? Math.max(admittedCeiling, state.offset) : admittedCeiling;
  const poweredCruiseActive = input.powered === true && input.stamina > 0;
  const poweredCruiseTarget = poweredCruiseActive
    ? Math.min(WILDS_POWERED_FLIGHT_CRUISE_CLEARANCE, admittedCeiling)
    : AIR_GROUND_CLEARANCE;
  const reachedPoweredCruise = poweredCruiseActive
    && priorLayer === "air"
    && state.offset >= poweredCruiseTarget - .000001;
  const flightFloor = reachedPoweredCruise ? poweredCruiseTarget : AIR_GROUND_CLEARANCE;
  state.safeMax = quantize(continuousCeiling);
  state.safeMin = quantize(Math.min(
    state.safeMax,
    aboveObstacle ? Math.max(flightFloor, obstacleFloor) : flightFloor
  ));
  if (priorLayer !== "air") {
    state.offset = quantize(bounded(input.initialOffset ?? state.safeMin, state.safeMin, state.safeMax));
  } else {
    state.offset = quantize(bounded(state.offset, state.safeMin, state.safeMax));
  }
  const canClimb = input.powered === true && input.stamina > 0;
  const actorFootY = input.terrainElevation + state.offset;
  const blockedBelowObstacle = Number.isFinite(input.obstacleTopY)
    && actorFootY < input.obstacleTopY! + AIR_OBSTACLE_CLEARANCE - .000001;
  const risingToPoweredCruise = canClimb && state.offset < poweredCruiseTarget - .000001;
  const direction = canClimb
    ? (input.intent > 0 || risingToPoweredCruise) && blockedBelowObstacle
      ? 0
      : risingToPoweredCruise
        ? 1
        : input.intent
    : -1;
  const speed = direction > 0
    ? risingToPoweredCruise
      ? POWERED_TAKEOFF_SPEED
      : POWERED_ASCENT_BASE_SPEED + lift * POWERED_ASCENT_LIFT_SPEED
    : direction < 0
      ? input.powered === true ? POWERED_DESCENT_SPEED : 1.25
      : 0;
  const poweredCruiseCeiling = risingToPoweredCruise
    ? poweredCruiseTarget
    : state.safeMax;
  state.offset = quantize(bounded(state.offset + direction * speed * delta, state.safeMin, poweredCruiseCeiling));
  state.worldY = quantize(input.terrainElevation + state.offset);
  return state;
}
