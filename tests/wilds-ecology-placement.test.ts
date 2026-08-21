import assert from "node:assert/strict";
import test from "node:test";
import { projectWildsEcologyInstance } from "../src/features/play/wilds-ecology-placement";
import { wildsTerrainRelativeElevation } from "../src/features/play/wilds-terrain-rendering";
import { wildsTerrainElevation } from "../src/features/play/wilds-terrain-authority";

test("approaching a tree never removes it from the visible world", () => {
  const tree = { x: 20, z: -4 };
  const shape: [number, number, number] = [1, 1.8, 1];

  const distant = projectWildsEcologyInstance(tree, { x: 0, z: 0 }, 0.64, shape, 13.6);
  const approached = projectWildsEcologyInstance(tree, { x: 19, z: -4 }, 0.64, shape, 13.6);

  assert.deepEqual(distant.scale, shape);
  assert.deepEqual(approached.scale, shape);
  assert.deepEqual(approached.position, [
    1,
    0.64 + wildsTerrainRelativeElevation(tree.x, tree.z, { x: 19, z: -4 }),
    0
  ]);
});

test("the original arrival clearing remains stable in world space", () => {
  const tree = { x: 4, z: 3 };
  const shape: [number, number, number] = [1, 1.8, 1];

  const atArrival = projectWildsEcologyInstance(tree, { x: 0, z: 0 }, 0.64, shape, 13.6);
  const afterTravel = projectWildsEcologyInstance(tree, { x: 30, z: 30 }, 0.64, shape, 13.6);

  assert.deepEqual(atArrival.scale, [0, 0, 0]);
  assert.deepEqual(afterTravel.scale, [0, 0, 0]);
});

test("ecology shares the player's authoritative local terrain projection", () => {
  const tree = { x: 45.25, z: -23.75 };
  const player = { x: 37.25, z: -18.5 };
  const projected = projectWildsEcologyInstance(tree, player, 0.64, [1, 1.8, 1]);

  assert.equal(projected.position[1], 0.64 + wildsTerrainRelativeElevation(tree.x, tree.z, player));
});

test("ecology accepts the already-admitted player anchor without changing placement", () => {
  const tree = { x: 45.25, z: -23.75 };
  const player = { x: 37.25, z: -18.5 };
  const anchorElevation = wildsTerrainElevation(player.x, player.z);

  const projected = projectWildsEcologyInstance(tree, player, 0.64, [1, 1.8, 1], 0, anchorElevation);

  assert.deepEqual(projected.position, [
    tree.x - player.x,
    0.64 + (wildsTerrainElevation(tree.x, tree.z) - anchorElevation),
    tree.z - player.z
  ]);
});
