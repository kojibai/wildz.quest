import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import assert from "node:assert/strict";
import { test } from "node:test";
import { admitWildsDiscoveryPhysicalNeighborhood } from "../src/features/play/wilds-discovery-sites";
import { prepareWildsSiteRuntime } from "../src/features/play/wilds-site-runtime";
import { canWildsCrewTravel, createWildsCrewPhysicalSampler } from "../src/features/play/wilds-crew-physical-navigation";
import { wildsTerrainElevation } from "../src/features/play/wilds-terrain-authority";
import type { WildsTerrainObstacle } from "../src/features/play/wilds-terrain-obstacles";

const physical = admitWildsDiscoveryPhysicalNeighborhood(0, 0);
const runtime = prepareWildsSiteRuntime({ ...physical, mountainFields: [], surfaces: [], solids: [], ceilings: [], waterVolumes: [], sites: [], portals: [], encounterVolumes: [] });
const from = { x: 0, y: wildsTerrainElevation(0, 0), z: 0 };
const to = { x: 1.6, y: wildsTerrainElevation(1.6, 0), z: 0 };
const wall: WildsTerrainObstacle = { id: "canonical-thin-wall", kind: "structure", material: "solid", position: { x: .8, y: from.y + .75, z: 0 }, radius: 1.1, shape: { kind: "box", halfX: .005, halfY: .75, halfZ: 1 }, visualScale: 1 };
const output = () => ({ allowed: false, y: NaN });

test("canonical swept obstacle test rejects a thin wall between clear endpoints", () => {
  const sample = createWildsCrewPhysicalSampler({ runtime, spaceId: "wildz.space.outer.v1", obstacles: [], originX: 0, originZ: 0 });
  const out = output(); sample(from, to, "walk", out); assert.equal(out.allowed, true);
  const blocked = createWildsCrewPhysicalSampler({ runtime, spaceId: "wildz.space.outer.v1", obstacles: [wall], originX: 0, originZ: 0 });
  blocked(from, to, "walk", out); assert.equal(out.allowed, false);
});

test("walk sampler refuses unsupported locomotion, uncovered caves, and distant movement", () => {
  const sample = createWildsCrewPhysicalSampler({ runtime, spaceId: "wildz.space.outer.v1", obstacles: [], originX: 0, originZ: 0 });
  const out = output();
  sample(from, to, "flight", out); assert.equal(out.allowed, false);
  sample(from, to, "swim", out); assert.equal(out.allowed, false);
  sample(from, { ...to, x: 40 }, "walk", out); assert.equal(out.allowed, false);
  const cave = createWildsCrewPhysicalSampler({ runtime, spaceId: "missing-cave", obstacles: [], originX: 0, originZ: 0 });
  cave(from, to, "walk", out); assert.equal(out.allowed, false);
});

test("obstacle budget fails closed instead of scanning an unbounded neighborhood", () => {
  const sample = createWildsCrewPhysicalSampler({ runtime, spaceId: "wildz.space.outer.v1", obstacles: Array.from({ length: 4097 }, (_, i) => ({ ...wall, id: String(i) })), originX: 0, originZ: 0 });
  const out = output(); sample(from, from, "walk", out); assert.equal(out.allowed, false);
});

test("cave floor support is required continuously and flooded floors are refused", () => {
  const surface = { id: "floor", siteKey: "cave", spaceId: "cave", kind: "interior-floor" as const, center: { x: 0, y: -10, z: 0 }, halfExtents: { x: 1, y: .1, z: 3 }, flooded: false };
  const caveRuntime = prepareWildsSiteRuntime({ ...runtime.physical, surfaces: [surface] });
  const cave = createWildsCrewPhysicalSampler({ runtime: caveRuntime, spaceId: "cave", obstacles: [], originX: 0, originZ: 0 });
  const a = { x: 0, y: -10, z: 0 }, out = output();
  cave(a, { ...a, x: .5 }, "walk", out); assert.equal(out.allowed, true); assert.equal(out.y, -10);
  cave(a, { ...a, x: 1.5 }, "walk", out); assert.equal(out.allowed, false);
  const flooded = createWildsCrewPhysicalSampler({ runtime: prepareWildsSiteRuntime({ ...runtime.physical, surfaces: [{ ...surface, flooded: true }] }), spaceId: "cave", obstacles: [], originX: 0, originZ: 0 });
  flooded(a, a, "walk", out); assert.equal(out.allowed, false);
});

test("fractional frame steps tolerate canonical coordinate quantization", () => {
  const sample = createWildsCrewPhysicalSampler({ runtime, spaceId: "wildz.space.outer.v1", obstacles: [], originX: 0, originZ: 0 });
  const a = { x: .0135783, z: .0463827, y: wildsTerrainElevation(.0135783, .0463827) };
  const b = { x: .02493042, z: .06820398, y: wildsTerrainElevation(.02493042, .06820398) };
  const out = output(); sample(a, b, "walk", out);
  assert.equal(out.allowed, true); assert.ok(Number.isFinite(out.y));
});

test("travel readiness fails closed for tired, injured, resting, dead and missing conditions", () => {
  const condition = emptyAdventureCondition("worker");
  assert.equal(canWildsCrewTravel(condition), true);
  assert.equal(canWildsCrewTravel(undefined), false);
  assert.equal(canWildsCrewTravel({ ...condition, fatigue: 85 }), false);
  assert.equal(canWildsCrewTravel({ ...condition, life: "dead" }), false);
  assert.equal(canWildsCrewTravel({ ...condition, injuries: [{ id: "injury", sourceEventId: "event", severity: 2, kind: "limb" }] }), false);
  assert.equal(canWildsCrewTravel({ ...condition, recovery: { state: "resting", trauma: 20, lastEventId: "event" } }), false);
});

test("planned canonical terrain routes advance repeatedly and physically recall to origin", async () => {
  const { planWildsCrewPath, createWildsCrewPathStepState, writeWildsCrewPathStep } = await import("../src/features/play/wilds-crew-navigation");
  const sampleSegment = createWildsCrewPhysicalSampler({ runtime, spaceId: "wildz.space.outer.v1", obstacles: [], originX: 0, originZ: 0 });
  const authority = { mode: "walk" as const, permittedModes: ["walk" as const], sampleSegment };
  const position = { ...from };
  for (const target of [to, from]) {
    const planned = planWildsCrewPath({ ...authority, start: position, target, cellSize: .8, maxNodes: 96 });
    assert.equal(planned.reason, "path");
    const state = createWildsCrewPathStepState();
    for (let i = 0; i < 200 && state.reason !== "arrived"; i++) {
      const before = { ...position };
      writeWildsCrewPathStep(position, planned.waypoints, state, { ...authority, speed: 5.5, deltaSeconds: 1 / 60 });
      assert.ok(Math.hypot(position.x - before.x, position.y - before.y, position.z - before.z) <= 5.5 / 60 + .000001);
      assert.notEqual(state.reason, "blocked");
    }
    assert.equal(state.reason, "arrived"); assert.ok(Math.hypot(position.x - target.x, position.z - target.z) < .000001);
  }
});
