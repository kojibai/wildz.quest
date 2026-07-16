import type { ArenaFighterDefinition } from "./card-fighter";
import { ARENA_FIXED_HZ, assertArenaVec3, type ArenaVec3 } from "./rules";

export type ArenaMovementInput = Readonly<{ moveX: number; moveZ: number; jumpPressed: boolean; sprint: boolean }>;
export type ArenaObstacle = Readonly<{ id: string; min: ArenaVec3; max: ArenaVec3 }>;
export type ArenaRamp = Readonly<{ id: string; minX: number; maxX: number; minZ: number; maxZ: number; lowY: number; highY: number; axis: "x" | "z" }>;
export type ArenaStageDefinition = Readonly<{
  id: string;
  groundY: number;
  fallY: number;
  spawn: ArenaVec3;
  bounds: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  obstacles: readonly ArenaObstacle[];
  ramps?: readonly ArenaRamp[];
}>;
export type ArenaKinematicState = Readonly<{
  position: ArenaVec3;
  velocity: ArenaVec3;
  facing: ArenaVec3;
  grounded: boolean;
  recoveryCharges: number;
  fallFrames: number;
}>;
export type ArenaMovementEvent = Readonly<{ kind: "jump" | "recover" | "land" | "fall-damage"; amount: number }>;
export type ArenaMovementResult = Readonly<{ state: ArenaKinematicState; events: readonly ArenaMovementEvent[] }>;

const quantum = 1_000;
const quantize = (value: number) => Math.round(value * quantum) / quantum;
const approach = (value: number, target: number, amount: number) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

export function initialArenaKinematicState(position: ArenaVec3): ArenaKinematicState {
  assertArenaVec3(position);
  return { position: { ...position }, velocity: { x: 0, y: 0, z: 0 }, facing: { x: 0, y: 0, z: 1 }, grounded: position.y === 0, recoveryCharges: 1, fallFrames: 0 };
}

function validate(stage: ArenaStageDefinition, state: ArenaKinematicState, input: ArenaMovementInput) {
  assertArenaVec3(state.position);
  assertArenaVec3(state.velocity);
  if (![stage.groundY, stage.fallY, stage.bounds.minX, stage.bounds.maxX, stage.bounds.minZ, stage.bounds.maxZ].every(Number.isFinite)
    || stage.bounds.minX >= stage.bounds.maxX || stage.bounds.minZ >= stage.bounds.maxZ || stage.fallY >= stage.groundY) throw new Error("arena_stage_invalid");
  if (![input.moveX, input.moveZ].every(Number.isFinite) || Math.abs(input.moveX) > 1 || Math.abs(input.moveZ) > 1) throw new Error("arena_movement_input_invalid");
}

function obstacleCollision(stage: ArenaStageDefinition, actor: ArenaFighterDefinition, prior: ArenaVec3, next: ArenaVec3) {
  let x = next.x;
  let z = next.z;
  for (const obstacle of stage.obstacles) {
    const vertical = next.y + actor.collision.height >= obstacle.min.y && next.y <= obstacle.max.y;
    const insideX = x + actor.collision.radius > obstacle.min.x && x - actor.collision.radius < obstacle.max.x;
    const insideZ = z + actor.collision.radius > obstacle.min.z && z - actor.collision.radius < obstacle.max.z;
    if (!vertical || !insideX || !insideZ) continue;
    const priorInsideX = prior.x + actor.collision.radius > obstacle.min.x && prior.x - actor.collision.radius < obstacle.max.x;
    const priorInsideZ = prior.z + actor.collision.radius > obstacle.min.z && prior.z - actor.collision.radius < obstacle.max.z;
    if (!priorInsideX) x = prior.x;
    else if (!priorInsideZ) z = prior.z;
    else { x = prior.x; z = prior.z; }
  }
  return { x, y: next.y, z };
}

function groundAt(stage: ArenaStageDefinition, position: ArenaVec3) {
  for (const ramp of stage.ramps ?? []) {
    if (position.x < ramp.minX || position.x > ramp.maxX || position.z < ramp.minZ || position.z > ramp.maxZ) continue;
    const ratio = ramp.axis === "x"
      ? (position.x - ramp.minX) / (ramp.maxX - ramp.minX)
      : (position.z - ramp.minZ) / (ramp.maxZ - ramp.minZ);
    return ramp.lowY + Math.max(0, Math.min(1, ratio)) * (ramp.highY - ramp.lowY);
  }
  return stage.groundY;
}

export function stepArenaMovement(
  actor: ArenaFighterDefinition,
  stage: ArenaStageDefinition,
  prior: ArenaKinematicState,
  input: ArenaMovementInput,
): ArenaMovementResult {
  validate(stage, prior, input);
  const events: ArenaMovementEvent[] = [];
  const magnitude = Math.hypot(input.moveX, input.moveZ);
  const moveX = magnitude > 1 ? input.moveX / magnitude : input.moveX;
  const moveZ = magnitude > 1 ? input.moveZ / magnitude : input.moveZ;
  const sprint = input.sprint ? 1.25 : 1;
  const targetX = moveX * actor.moveSpeed * sprint;
  const targetZ = moveZ * actor.moveSpeed * sprint;
  const control = prior.grounded ? 28 : 14 * actor.airControl;
  let velocity = {
    x: approach(prior.velocity.x, targetX, control / ARENA_FIXED_HZ),
    y: prior.velocity.y,
    z: approach(prior.velocity.z, targetZ, control / ARENA_FIXED_HZ),
  };
  let grounded = prior.grounded;
  let recoveryCharges = prior.recoveryCharges;
  if (input.jumpPressed && grounded) {
    velocity.y = actor.jumpImpulse;
    grounded = false;
    events.push({ kind: "jump", amount: actor.jumpImpulse });
  } else if (input.jumpPressed && !grounded && recoveryCharges > 0 && actor.locomotion.includes("fly")) {
    velocity.y = actor.jumpImpulse * 0.72;
    velocity.x += moveX * actor.airControl;
    velocity.z += moveZ * actor.airControl;
    recoveryCharges -= 1;
    events.push({ kind: "recover", amount: velocity.y });
  }
  if (!grounded) velocity.y -= 18 / ARENA_FIXED_HZ;
  let position = {
    x: prior.position.x + velocity.x / ARENA_FIXED_HZ,
    y: prior.position.y + velocity.y / ARENA_FIXED_HZ,
    z: prior.position.z + velocity.z / ARENA_FIXED_HZ,
  };
  position = obstacleCollision(stage, actor, prior.position, position);
  position.x = Math.max(stage.bounds.minX + actor.collision.radius, Math.min(stage.bounds.maxX - actor.collision.radius, position.x));
  position.z = Math.max(stage.bounds.minZ + actor.collision.radius, Math.min(stage.bounds.maxZ - actor.collision.radius, position.z));
  const surfaceY = groundAt(stage, position);
  if (grounded) position.y = surfaceY;
  if (!grounded && prior.position.y >= surfaceY && position.y <= surfaceY) {
    position.y = surfaceY;
    velocity.y = 0;
    grounded = true;
    recoveryCharges = 1;
    events.push({ kind: "land", amount: Math.max(0, -prior.velocity.y) });
  }
  if (position.y < stage.fallY) {
    position = { ...stage.spawn };
    velocity = { x: 0, y: 0, z: 0 };
    grounded = stage.spawn.y === stage.groundY;
    recoveryCharges = 1;
    events.push({ kind: "fall-damage", amount: Math.max(8, Math.round(actor.maxVitality * 0.18)) });
  }
  const facing = magnitude > 0.05 ? { x: quantize(moveX), y: 0, z: quantize(moveZ) } : prior.facing;
  return {
    state: {
      position: { x: quantize(position.x), y: quantize(position.y), z: quantize(position.z) },
      velocity: { x: quantize(velocity.x), y: quantize(velocity.y), z: quantize(velocity.z) },
      facing,
      grounded,
      recoveryCharges,
      fallFrames: grounded ? 0 : prior.fallFrames + 1,
    },
    events,
  };
}
