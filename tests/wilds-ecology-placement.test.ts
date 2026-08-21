import assert from "node:assert/strict";
import test from "node:test";
import { projectWildsEcologyInstance } from "../src/features/play/wilds-ecology-placement";

test("approaching a tree never removes it from the visible world", () => {
  const tree = { x: 20, z: -4 };
  const shape: [number, number, number] = [1, 1.8, 1];

  const distant = projectWildsEcologyInstance(tree, { x: 0, z: 0 }, 0.64, shape, 13.6);
  const approached = projectWildsEcologyInstance(tree, { x: 19, z: -4 }, 0.64, shape, 13.6);

  assert.deepEqual(distant.scale, shape);
  assert.deepEqual(approached.scale, shape);
  assert.deepEqual(approached.position, [1, 0.64, 0]);
});

test("the original arrival clearing remains stable in world space", () => {
  const tree = { x: 4, z: 3 };
  const shape: [number, number, number] = [1, 1.8, 1];

  const atArrival = projectWildsEcologyInstance(tree, { x: 0, z: 0 }, 0.64, shape, 13.6);
  const afterTravel = projectWildsEcologyInstance(tree, { x: 30, z: 30 }, 0.64, shape, 13.6);

  assert.deepEqual(atArrival.scale, [0, 0, 0]);
  assert.deepEqual(afterTravel.scale, [0, 0, 0]);
});
