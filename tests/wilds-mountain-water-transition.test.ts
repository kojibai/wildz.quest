import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { projectWildsAquaticPresentationAtPosition } from "../src/features/play/wilds-aquatic-presentation";
import { admitWildsDiscoveryPhysicalNeighborhood } from "../src/features/play/wilds-discovery-sites";
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY, writeWildsSiteRuntimeAerialCollision, writeWildsSiteRuntimeCamera, writeWildsSiteRuntimeMovement } from "../src/features/play/wilds-site-runtime";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";

const outer = "wildz.space.outer.v1";
const position = { x: -751.915372, z: -739.954461 };

test("a dry admitted mountain above a deep-water seabed presents as land", () => {
  const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-5, -5));
  const floorY = wildsSiteRuntimeGroundY(runtime, outer, position.x, position.z, -8);
  assert.equal(sampleWildsTerrain(position.x, position.z).surface, "deep-water");
  assert.equal(floorY, .603307);
  for (const canSwim of [false, true]) {
    const presentation = projectWildsAquaticPresentationAtPosition({ ...position, groundElevation: floorY, canSwim, airborne: false });
    assert.equal(presentation.mode, "land");
    assert.equal(presentation.actorWorldY, .603307);
    assert.equal(presentation.waterDepth, 0);
    assert.equal(presentation.scubaVisible, false);
    assert.equal(presentation.cameraSubmersionAllowed, false);
  }
});

test("descending a mountain changes water mode at its actual floor height", () => {
  for (const [groundElevation, canSwim, expectedMode] of [
    [-.8, true, "land"], [-1.6, true, "wade"], [-4, true, "swim"], [-4, false, "blocked"]
  ] as const) {
    const presentation = projectWildsAquaticPresentationAtPosition({ ...position, groundElevation, canSwim, airborne: false });
    assert.equal(presentation.mode, expectedMode);
    assert.equal(presentation.terrainElevation, groundElevation);
  }
});

test("a dry mountain foothill over shallows walks at normal speed without a swim capability", () => {
  const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-5, -5));
  const player = { x: -677.261174, z: -751.915435 };
  const state = { ...initialPlayState, player, siteSpace: {
    version: "wildz.site-space-state.v1" as const, spaceId: outer, siteKey: null, surfaceId: null,
    position: { ...player, y: .191047 }, flooded: false
  } };
  assert.equal(sampleWildsTerrain(player.x, player.z).surface, "shallow-water");
  const next = applyWildsInput(state, { type: "move-vector", x: 1, z: 0, siteRuntime: runtime });
  assert.deepEqual(next.player, { x: -676.841174, z: -751.915435 });
  assert.ok(next.siteSpace.position.y > 0);
  assert.equal(next.siteSpace.flooded, false);
});

test("a submerged mountain slope above the deep seabed admits shallow wading during descent", () => {
  const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-5, -5));
  const player = { x: -756.507372, z: -743.781128 };
  const floorY = wildsSiteRuntimeGroundY(runtime, outer, player.x, player.z, Number.NaN);
  const state = { ...initialPlayState, player, siteSpace: {
    version: "wildz.site-space-state.v1" as const, spaceId: outer, siteKey: null, surfaceId: null,
    position: { ...player, y: floorY }, flooded: false
  } };
  assert.equal(sampleWildsTerrain(player.x, player.z).surface, "deep-water");
  assert.equal(floorY, -1.976998);
  const next = applyWildsInput(state, { type: "move-vector", x: -1, z: 0, siteRuntime: runtime });
  assert.deepEqual(next.player, { x: -756.780372, z: -743.781128 });
  assert.equal(next.siteSpace.position.y, -2.117856);
  const presentation = projectWildsAquaticPresentationAtPosition({ ...next.player, groundElevation: next.siteSpace.position.y, canSwim: false, airborne: false });
  assert.equal(presentation.mode, "wade");
});

test("using the mountain floor for water classification preserves its upper-slope climb gate", () => {
  const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(-5, -5));
  const player = { x: -673.243174, z: -753.063435 };
  const state = { ...initialPlayState, player, siteSpace: {
    version: "wildz.site-space-state.v1" as const, spaceId: outer, siteKey: null, surfaceId: null,
    position: { ...player, y: 1.401231 }, flooded: false
  } };
  const next = applyWildsInput(state, { type: "move-vector", x: 1, z: 0, siteRuntime: runtime });
  assert.deepEqual(next.player, player);
  assert.equal(next.siteSpace.position.y, 1.401231);
  assert.match(next.lastEvent, /slope too steep/);
});

test("an overlapping water volume below the mountain floor cannot flood movement or vertical traversal", () => {
  const physical = admitWildsDiscoveryPhysicalNeighborhood(-5, -5);
  const water = physical.waterVolumes.find(volume => volume.kind !== "waterfall")!;
  assert.ok(water);
  const runtime = prepareWildsSiteRuntime({ ...physical, waterVolumes: [{ ...water, spaceId: outer,
    center: { ...position, y: -.4 }, halfExtents: { x: 2, y: .4, z: 2 }
  }] });
  const camera = { floorY: 0, ceilingY: 0, flooded: false, waterSurfaceY: Number.NaN };
  const aerial = { ...camera, obstacleTopY: Number.NaN, protectedAirspace: false, blockerId: null as string | null };
  const movement = { x: 0, z: 0, floorY: 0, ceilingY: 0, flooded: false, blocked: false, blockedByClimb: false, surfaceId: null as string | null };
  writeWildsSiteRuntimeCamera(camera, runtime, outer, position.x, .603307, position.z);
  writeWildsSiteRuntimeAerialCollision(aerial, runtime, outer, position.x, .953307, position.z, 1.55, .38, -8);
  writeWildsSiteRuntimeMovement(movement, runtime, outer, position.x, .603307, position.z, position.x, position.z, .38, -8, true);
  for (const projection of [camera, aerial, movement]) {
    assert.equal(projection.floorY, .603307);
    assert.equal(projection.flooded, false);
  }
});
