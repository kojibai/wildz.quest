import type { MortalArenaFighter, MortalArenaInput, MortalArenaState } from "./types";

const AXIS_LIMIT = 1_000;
const GRAVITY = 38;

function axis(value: number | undefined) {
  return Math.max(-AXIS_LIMIT, Math.min(AXIS_LIMIT, Math.round(value ?? 0)));
}

export function stepArenaMovement(
  fighter: Readonly<MortalArenaFighter>,
  input: Readonly<MortalArenaInput>,
  arena: MortalArenaState["arena"]
): MortalArenaFighter {
  const grounded = fighter.position.y <= arena.floorY;
  const acceleration = Math.max(18, Math.round(fighter.speed * (grounded ? .38 : .2)));
  const targetX = Math.round(axis(input.moveX) * fighter.speed / 1_000);
  const targetZ = Math.round(axis(input.moveZ) * fighter.speed / 1_000);
  const approach = (current: number, target: number) => current + Math.max(-acceleration, Math.min(acceleration, target - current));
  let velocity = {
    x: approach(fighter.velocity.x, targetX),
    y: grounded && input.jump ? 520 : fighter.velocity.y - (grounded ? 0 : GRAVITY),
    z: approach(fighter.velocity.z, targetZ)
  };
  let position = { x: fighter.position.x + velocity.x, y: Math.max(arena.floorY, fighter.position.y + velocity.y), z: fighter.position.z + velocity.z };
  const radial = Math.hypot(position.x, position.z);
  if (radial > arena.radius) {
    const scale = arena.radius / radial;
    position = { ...position, x: Math.round(position.x * scale), z: Math.round(position.z * scale) };
    velocity = { ...velocity, x: Math.round(velocity.x * .35), z: Math.round(velocity.z * .35) };
  }
  if (position.y === arena.floorY && velocity.y < 0) velocity = { ...velocity, y: 0 };
  const facing = axis(input.moveX) === 0 ? fighter.facing : axis(input.moveX) > 0 ? 1 : -1;
  return { ...fighter, position, velocity, facing, recoveryTicks: Math.max(0, fighter.recoveryTicks - 1) };
}
