import assert from "node:assert/strict";
import test from "node:test";
import { wildsPlayerTapDestination, writeWildsPlayerViewPose, writeWildsEmbodiedEyeAnchor, wildsFirstPersonZoomedOut, prioritizeWildsLocalPlayerHit, WILDS_FIRST_PERSON_DISTANCE } from "../src/features/play/wilds-player-view";

test("embodied first person follows the rendered eye and jump without changing free look", () => {
  const position={x:0,y:1.35,z:.045},target={x:0,y:1.35,z:0},eye={x:.1,y:1.29,z:-.16};
  writeWildsEmbodiedEyeAnchor(position,target,eye,.8);
  assert.deepEqual(position,{x:.1,y:2.09,z:-.16});
  assert.ok(Math.abs(position.z-target.z-.045)<1e-8);
  assert.ok(Math.abs(position.y-target.y)<1e-8);
  assert.equal(wildsFirstPersonZoomedOut(position,target),false);
  position.z+=.001;
  assert.equal(wildsFirstPersonZoomedOut(position,target),true);
});

test("a sleeping avatar enters its dream; an awake avatar enters first person", () => {
  assert.equal(wildsPlayerTapDestination("bed"), "dream");
  assert.equal(wildsPlayerTapDestination("sleep"), "dream");
  assert.equal(wildsPlayerTapDestination("active"), "first-person");
  assert.equal(wildsPlayerTapDestination("camp"), "first-person");
});
test("a real avatar mesh wins over an overlapping resource tap proxy, while ordinary occlusion retains its order", () => {
  const player = {name: "player", parent: null, userData: {wildsLocalPlayer: true}};
  const body = {object: {name: "body", parent: player, userData: {}}};
  const proxy = {object: {name: "resource-tap-proxy", parent: null, userData: {}}};
  const wall = {object: {name: "wall", parent: null, userData: {}}};
  assert.deepEqual(prioritizeWildsLocalPlayerHit([proxy,body]), [body,proxy]);
  const opaque = [wall,body]; assert.equal(prioritizeWildsLocalPlayerHit(opaque),opaque);
  const covered = [proxy,wall,body]; assert.equal(prioritizeWildsLocalPlayerHit(covered),covered);
  const behindWall = [wall,proxy,body]; assert.equal(prioritizeWildsLocalPlayerHit(behindWall),behindWall);
});
test("first person preserves the viewed direction and zoom-out restores the orbit distance", () => {
  const position = {x: 4, y: 3.9, z: -4}, target = {x: 0, y: .9, z: 0};
  const radius = Math.hypot(4, 3, -4), priorDirection = [4 / radius, 3 / radius, -4 / radius];
  writeWildsPlayerViewPose(position, target, 1.38, WILDS_FIRST_PERSON_DISTANCE);
  assert.equal(wildsFirstPersonZoomedOut(position, target), false);
  assert.ok(Math.abs(position.x / WILDS_FIRST_PERSON_DISTANCE - priorDirection[0]) < 1e-8);
  position.x *= 1.25; position.y = target.y + (position.y - target.y) * 1.25; position.z *= 1.25;
  assert.equal(wildsFirstPersonZoomedOut(position, target), true);
  writeWildsPlayerViewPose(position, target, .9, radius);
  assert.ok(Math.abs(Math.hypot(position.x, position.y - target.y, position.z) - radius) < 1e-8);
  assert.ok(Math.abs(position.z / radius - priorDirection[2]) < 1e-8);
});
