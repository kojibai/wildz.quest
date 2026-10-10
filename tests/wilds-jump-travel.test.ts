import assert from "node:assert/strict";
import test from "node:test";
import { advanceWildsJumpTravel, captureWildsJumpTravel } from "../src/features/play/wilds-jump-travel";

test("a running or walking jump retains the exact takeoff vector and ground cadence", () => {
  for (const mode of ["walk", "run"] as const) {
    const input = {type: "move-vector" as const, x: .6, z: -.8, mode};
    const travel = captureWildsJumpTravel({input, at: 100}, 110)!;
    let steps = 0; for (let frame = 0; frame < 54; frame++) steps += advanceWildsJumpTravel(travel, 1 / 60);
    assert.equal(steps, 20);
    assert.deepEqual(travel.input, input);
    input.x = 0;
    assert.equal(travel.input.type === "move-vector" && travel.input.x, .6);
  }
});
test("idle jump stays vertical and a stalled frame cannot teleport takeoff momentum", () => {
  assert.equal(captureWildsJumpTravel(null, 200), null);
  assert.equal(captureWildsJumpTravel({input: {type: "move-vector", x: 0, z: 0}, at: 100}, 110), null);
  assert.equal(captureWildsJumpTravel({input: {type: "move", direction: "north"}, at: 100}, 251), null);
  const travel = captureWildsJumpTravel({input: {type: "move-vector", x: 0, z: -1, mode: "run"}, at: 100}, 110)!;
  assert.equal(advanceWildsJumpTravel(travel, 10), 2);
  assert.equal(advanceWildsJumpTravel(travel, Number.NaN), 0);
});
