import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { admitWildsDiscoveryPhysicalNeighborhood } from "../src/features/play/wilds-discovery-sites";
import { prepareWildsSiteRuntime, writeWildsSiteRuntimeLanding } from "../src/features/play/wilds-site-runtime";
import { wildsTerrainElevation } from "../src/features/play/wilds-terrain-authority";
import { projectWildsAquaticPresentationAtPosition } from "../src/features/play/wilds-aquatic-presentation";
import { createWildsVerticalTraversalState, writeWildsVerticalTraversalStep } from "../src/features/play/wilds-vertical-traversal";
import { resolveWildsRequiredLandingPosition } from "../src/features/play/wilds-grounded-movement";
import { beginWildsAerialTraversal, completeWildsAerialLanding, createGroundedWildsAerialState, requestWildsAerialLanding } from "../src/features/play/wilds-aerial-traversal";

test("powered flight advances horizontal position while retaining the physical floor for rendering and landing", () => {
  const card = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "pilot", encounterId: "flight-position", capturedAt: "2026-08-21T12:05:00.000Z" });
  let state = applyWildsInput(initialPlayState, { type: "import-card", asset: card });
  state = applyWildsInput(state, { type: "select-asset", assetId: card.id });
  const origin = { x: 0, z: 0 };
  state = { ...state, player: origin, siteSpace: { ...state.siteSpace, position: { ...origin, y: wildsTerrainElevation(0, 0) } } };
  const runtime = prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(0, 0));
  const aerial = beginWildsAerialTraversal(createGroundedWildsAerialState(origin, state.siteSpace.position.y), { kind: "flight", capabilities: ["flight"] }).state;
  aerial.altitude = 30;
  for (let index = 0; index < 40; index++) {
    state = applyWildsInput(state, { type: "move-vector", x: 1, z: 0, aerialMode: "flight", verticalWorldY: aerial.altitude, verticalClearance: 30, siteRuntime: runtime });
    assert.equal(state.siteSpace.position.y, wildsTerrainElevation(state.player.x, state.player.z), "airborne altitude must not become the persistent ground origin");
  }
  assert.ok(state.player.x > 15, "horizontal flight must advance beyond the launch neighborhood");
  assert.equal(state.siteSpace.position.x, state.player.x);
  const arrival = { ...state.player };
  requestWildsAerialLanding(aerial, "landed");
  const landing = resolveWildsRequiredLandingPosition(arrival, aerial.safeAnchor, { capabilities: ["flight"] });
  assert.ok(landing);
  const siteLanding = writeWildsSiteRuntimeLanding({ x: 0, z: 0, floorY: 0, found: false }, runtime, state.siteSpace.spaceId, landing.x, wildsTerrainElevation(landing.x, landing.z), landing.z);
  assert.ok(siteLanding.found);
  completeWildsAerialLanding(aerial, siteLanding.x, siteLanding.z, siteLanding.floorY);
  assert.ok(Math.hypot(aerial.safeAnchor.x - arrival.x, aerial.safeAnchor.z - arrival.z) <= 3, "landing stays near the traveled position, not the old launch anchor");
  assert.equal(aerial.mode, "ground");
});

test("landing over deep water preserves the drop coordinate with or without a swimming leader", () => {
  const water = { x: -250, z: -70 };
  const launch = { x: 0, z: 0 };
  assert.deepEqual(resolveWildsRequiredLandingPosition(water, launch, { capabilities: ["flight"] }), water);
  assert.deepEqual(resolveWildsRequiredLandingPosition(water, launch, { capabilities: ["flight", "swim"] }), water);
  assert.deepEqual(resolveWildsRequiredLandingPosition({ x: NaN, z: 0 }, water, { capabilities: ["flight"] }), water, "a water launch remains an admissible recovery anchor");
});


test("a non-swimmer sinks at the drop, can take off again, or switch to a swimming creature", () => {
  const water = { x: -250, z: -70 };
  const sunk = projectWildsAquaticPresentationAtPosition({ ...water, canSwim: false, airborne: false });
  assert.equal(sunk.mode, "blocked");
  assert.equal(sunk.actorWorldY, sunk.terrainElevation);
  assert.equal(sunk.cameraSubmersionAllowed, true);
  assert.equal(sunk.scubaVisible, false);
  assert.ok(sunk.actorWorldY < sunk.waterSurfaceY);
  const winged = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "pilot", encounterId: "water-flight-recovery", capturedAt: "2026-08-21T12:05:00.000Z" });
  let state = applyWildsInput(initialPlayState, { type: "import-card", asset: winged });
  state = applyWildsInput(state, { type: "select-asset", assetId: winged.id });
  state = { ...state, player: water, siteSpace: { ...state.siteSpace, position: { ...water, y: sunk.terrainElevation } } };
  const blocked = applyWildsInput(state, { type: "move-vector", x: 1, z: 0 });
  assert.deepEqual(blocked.player, water, "a water drop does not grant swimming");
  const aerial = beginWildsAerialTraversal(createGroundedWildsAerialState(water, sunk.terrainElevation), { kind: "flight", capabilities: ["flight"] });
  assert.equal(aerial.state.mode, "flight");
  const vertical = createWildsVerticalTraversalState();
  for (let index = 0; index < 100; index++) writeWildsVerticalTraversalStep(vertical, { layer: "air", deltaSeconds: .1, terrainElevation: sunk.terrainElevation, waterSurfaceY: sunk.waterSurfaceY, stamina: 100, powered: true, liftPotential: 1, intent: 1 });
  assert.ok(vertical.worldY > sunk.waterSurfaceY, "powered flight rises out of the water");
  const escaped = applyWildsInput(state, { type: "move-vector", x: 1, z: 0, aerialMode: "flight", verticalWorldY: vertical.worldY });
  assert.ok(escaped.player.x > water.x);
  const swimmer = sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "pilot", encounterId: "water-swim-recovery", capturedAt: "2026-08-21T12:05:00.000Z" });
  state = applyWildsInput(state, { type: "import-card", asset: swimmer });
  state = applyWildsInput(state, { type: "select-asset", assetId: swimmer.id });
  const swimming = applyWildsInput(state, { type: "move-vector", x: 1, z: 0 });
  assert.ok(swimming.player.x > water.x);
  assert.equal(projectWildsAquaticPresentationAtPosition({ ...water, canSwim: true, airborne: false }).mode, "swim");
});
