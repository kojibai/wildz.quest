import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsCrewPathStepState, planWildsCrewPath, writeWildsCrewFollowingStep, writeWildsCrewAlongsideTarget, writeWildsCrewTransportPosition, writeWildsCrewPathStep, type WildsCrewNavigationAuthority, type WildsCrewSegmentSampler } from "../src/features/play/wilds-crew-navigation";

const point = (x: number, z = 0, y = 0) => ({ x, y, z });
const clear: WildsCrewSegmentSampler = (_from, to, _mode, out) => { out.allowed = true; out.y = to.y; };
const authority = (sampleSegment = clear): WildsCrewNavigationAuthority => ({ mode: "walk", permittedModes: ["walk"], sampleSegment });

// Test fixture certifies the swept interval, including thin walls between grid nodes.
const wall: WildsCrewSegmentSampler = (from, to, _mode, out) => {
  out.y = 0; out.allowed = true;
  if (Math.min(from.x, to.x) <= 1.6 && Math.max(from.x, to.x) >= 1.4 && Math.min(from.z, to.z) < 1.5 && Math.max(from.z, to.z) > -1.5) out.allowed = false;
};

test("deterministic detour crosses no wall, including the final off-grid target segment", () => {
  const input = { ...authority(wall), start: point(0), target: point(3.4), maxNodes: 120 };
  const route = planWildsCrewPath(input);
  assert.equal(route.reason, "path");
  assert.deepEqual(planWildsCrewPath(input), route);
  assert.ok(route.waypoints.some(p => Math.abs(p.z) >= 2));
  let previous = input.start;
  for (const next of route.waypoints) {
    const sample = { allowed: false, y: NaN }; wall(previous, next, "walk", sample);
    assert.equal(sample.allowed, true); previous = next;
  }
  assert.deepEqual(route.waypoints.at(-1), input.target);
});

test("blocked target and disconnected enclosed start return no partial route", () => {
  const blocked = planWildsCrewPath({ ...authority(wall), start: point(0), target: point(1.5) });
  assert.equal(blocked.reason, "blocked-target"); assert.deepEqual(blocked.waypoints, []);
  const enclosed: WildsCrewSegmentSampler = (from, to, mode, out) => { clear(from, to, mode, out); out.allowed = from.x === to.x && from.z === to.z; };
  const route = planWildsCrewPath({ ...authority(enclosed), start: point(0), target: point(2) });
  assert.equal(route.reason, "unreachable"); assert.deepEqual(route.waypoints, []);
});

test("canonical sampler rejects cliffs and slopes instead of granting climbing", () => {
  const cliff: WildsCrewSegmentSampler = (from, to, _mode, out) => { out.y = to.x >= 1 ? 5 : 0; out.allowed = Math.abs(out.y - from.y) <= .6; };
  const route = planWildsCrewPath({ ...authority(cliff), start: point(0), target: point(3, 0, 5), maxDistance: 4, maxNodes: 128 });
  assert.equal(route.reason, "unreachable"); assert.deepEqual(route.waypoints, []);
});

test("bounded budget is explicit, deterministic, and bounds sampler work", () => {
  let calls = 0;
  const counted: WildsCrewSegmentSampler = (...args) => { calls++; clear(...args); };
  const route = planWildsCrewPath({ ...authority(counted), start: point(0), target: point(20), maxNodes: 4 });
  assert.equal(route.reason, "budget-exhausted"); assert.ok(route.visitedNodes <= 4);
  assert.ok(calls <= 2 + 5 * 4); assert.deepEqual(route.waypoints, []);
});

test("flight and swimming require explicit permission; walk is not implicitly added", () => {
  for (const mode of ["flight", "swim", "walk"] as const) {
    const input = { ...authority(), mode, permittedModes: [], start: point(0), target: point(1) };
    assert.equal(planWildsCrewPath(input).reason, "mode-not-permitted");
    assert.equal(planWildsCrewPath({ ...input, permittedModes: [mode] }).reason, "path");
  }
});

test("advance caps elapsed time and speed, never overshoots, and writes provided objects", () => {
  const position = point(0), state = createWildsCrewPathStepState(), candidate = state.candidate, sample = state.sample;
  writeWildsCrewPathStep(position, [point(100)], state, { ...authority(), speed: 1000, deltaSeconds: 10 });
  assert.ok(Math.abs(position.x - 2.4) < 1e-9); assert.equal(state.reason, "moving");
  const target = point(2.5);
  writeWildsCrewPathStep(position, [target], state, { ...authority(), speed: 10, deltaSeconds: .1 });
  assert.deepEqual(position, target); assert.equal(state.reason, "arrived");
  assert.equal(state.candidate, candidate); assert.equal(state.sample, sample);
});

test("advance checks new walls and changed floors before mutating position", () => {
  const position = point(1), state = createWildsCrewPathStepState();
  writeWildsCrewPathStep(position, [point(2)], state, { ...authority(wall), speed: 20, deltaSeconds: .1 });
  assert.deepEqual(position, point(1)); assert.equal(state.reason, "blocked");
  const raised: WildsCrewSegmentSampler = (_from, _to, _mode, out) => { out.allowed = true; out.y = 10; };
  writeWildsCrewPathStep(position, [point(2)], state, { ...authority(raised), speed: 20, deltaSeconds: .1 });
  assert.deepEqual(position, point(1)); assert.equal(state.reason, "blocked");
});

test("advance follows admitted floor and rejects nonfinite inputs", () => {
  const slope: WildsCrewSegmentSampler = (_from, to, _mode, out) => { out.allowed = true; out.y = to.x * .2; };
  const position = point(0), state = createWildsCrewPathStepState();
  writeWildsCrewPathStep(position, [point(1, 0, .2)], state, { ...authority(slope), speed: 2, deltaSeconds: .1 });
  assert.ok(position.x > 0); assert.equal(position.y, position.x * .2);
  const before = { ...position };
  writeWildsCrewPathStep(position, [point(1)], state, { ...authority(), speed: NaN, deltaSeconds: .1 });
  assert.equal(state.reason, "invalid-input"); assert.deepEqual(position, before);
});

test("curved floors shorten and revalidate the sweep instead of permanently stalling", () => {
  let calls = 0;
  const curved: WildsCrewSegmentSampler = (_from, to, _mode, out) => { calls++; out.allowed = true; out.y = Math.sin(to.x * Math.PI) * .2; };
  const position = point(0), state = createWildsCrewPathStepState();
  writeWildsCrewPathStep(position, [point(1)], state, { ...authority(curved), speed: 2, deltaSeconds: .1 });
  assert.equal(state.reason, "moving"); assert.ok(position.x > 0);
  assert.ok(Math.hypot(position.x, position.y) <= .200001);
  assert.ok(Math.hypot(position.x, position.y) > .19, "curvature must not needlessly halve follow speed");
  assert.equal(position.y, Math.sin(position.x * Math.PI) * .2);
  assert.ok(calls > 1 && calls <= 6);
});


test("continuous moving targets advance each frame even while physical authority references refresh", () => {
  const position = point(0), routeState = createWildsCrewPathStepState(), directState = createWildsCrewPathStepState();
  const target = point(1), directWaypoints = [target];
  let previousX = position.x;
  for (let frame = 0; frame < 600; frame++) {
    target.x += 3 / 60;
    // A refreshed immutable world projection must not require a new route/timer to move.
    writeWildsCrewFollowingStep(position, target, [], routeState, directState, directWaypoints, { ...authority((_from, to, _mode, out) => { out.allowed = true; out.y = to.y; }), speed: 5.5, deltaSeconds: 1 / 60 });
    assert.ok(position.x > previousX, `stopped during moving frame ${frame}`);
    assert.ok(position.x - previousX <= 5.5 / 60 + 1e-6);
    assert.ok(target.x - position.x <= 1.01, `fell behind during moving frame ${frame}`);
    previousX = position.x;
  }
});

test("direct moving-target chase never bypasses a newly built wall", () => {
  const position = point(1.3), routeState = createWildsCrewPathStepState(), directState = createWildsCrewPathStepState();
  const target = point(3), directWaypoints = [target];
  writeWildsCrewFollowingStep(position, target, [], routeState, directState, directWaypoints, { ...authority(wall), speed: 5.5, deltaSeconds: .1 });
  assert.equal(directState.reason, "blocked"); assert.deepEqual(position, point(1.3));
});


test("alongside target follows observed heading and keeps that heading while stationary", () => {
  const player = point(0), state = { playerX: 0, playerZ: 0, heading: 0, desiredHeading: 0 }, target = point(0);
  for (let frame = 0; frame < 120; frame++) { player.x += .05; writeWildsCrewAlongsideTarget(target, state, player, -1.1, 1 / 60); }
  assert.ok(Math.abs(target.x - player.x) < .001, "alongside must not trail along direction of movement");
  assert.ok(Math.abs(target.z - player.z - 1.1) < .001);
  const before = { ...target };
  for (let frame = 0; frame < 60; frame++) writeWildsCrewAlongsideTarget(target, state, player, -1.1, 1 / 60);
  assert.ok(Math.hypot(target.x - before.x, target.z - before.z) < .001);
});


test("explicit party transport admits destination occupancy while ordinary following stays speed limited", () => {
  const position = point(0), destination = point(1000), scratch = { allowed: false, y: NaN };
  writeWildsCrewPathStep(position, [destination], createWildsCrewPathStepState(), { ...authority(), speed: 5.5, deltaSeconds: .1 });
  assert.equal(position.x, .55);
  assert.equal(writeWildsCrewTransportPosition(position, point(1.5), scratch, authority(wall)), false);
  assert.equal(position.x, .55);
  assert.equal(writeWildsCrewTransportPosition(position, destination, scratch, authority()), true);
  assert.deepEqual(position, destination);
});
test("invalid accompanying speed limits cannot corrupt a position with a permissive sampler",()=>{
 for(const accompanyingSpeedLimit of [NaN,Infinity,-1]){
  const position=point(0),state=createWildsCrewPathStepState();
  writeWildsCrewPathStep(position,[point(5)],state,{...authority(),speed:72,deltaSeconds:.02,accompanyingSpeedLimit});
  assert.deepEqual(position,point(0));assert.equal(state.reason,"invalid-input");
 }
});
