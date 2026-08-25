import assert from "node:assert/strict";
import test from "node:test";
import {
  beginWildsBalance,
  beginWildsCurrentRide,
  projectWildsTrackTrail,
  reduceWildsSustainedEnvironment,
  toggleWildsCamouflage,
  toggleWildsLivingLight
} from "../src/features/play/wilds-environment-capabilities";

test("current and balance create bounded physical movement support", () => {
  const current = beginWildsCurrentRide({ flow: { x: 4, z: -1 }, flowStrength: 0.8, creaturePower: 60 });
  const balance = beginWildsBalance({ width: 0.35, instability: 0.7, creatureControl: 72 });

  assert.equal(Math.hypot(current.velocity.x, current.velocity.z) <= 1.2, true);
  assert.equal(current.velocity.x > 0, true);
  assert.equal(current.velocity.z < 0, true);
  assert.equal(balance.stability > 0.5, true);
  assert.equal(balance.lateralScale < 1, true);
});

test("light and camouflage toggle locally and expose exact visible consequences", () => {
  const light = toggleWildsLivingLight({ active: false, creaturePower: 50 });
  const dark = toggleWildsCamouflage({ active: false, terrainCompatible: true, creatureControl: 70 });
  const incompatible = toggleWildsCamouflage({ active: false, terrainCompatible: false, creatureControl: 70 });

  assert.deepEqual(light, { active: true, radius: 5, discoveryClarity: 0.75 });
  assert.equal(dark.active, true);
  assert.equal(dark.detectionScale < 1, true);
  assert.deepEqual(incompatible, { active: false, detectionScale: 1, reason: "compatible_cover_required" });
});

test("tracking reads only admitted public traces and orders them deterministically", () => {
  const trail = projectWildsTrackTrail([
    { id: "private", admitted: true, private: true, urgency: 10, distance: 1, position: { x: 1, z: 1 } },
    { id: "far", admitted: true, private: false, urgency: 2, distance: 8, position: { x: 8, z: 0 } },
    { id: "near-b", admitted: true, private: false, urgency: 2, distance: 2, position: { x: 2, z: 1 } },
    { id: "near-a", admitted: true, private: false, urgency: 2, distance: 2, position: { x: 2, z: 0 } },
    { id: "unadmitted", admitted: false, private: false, urgency: 20, distance: 0, position: { x: 0, z: 0 } }
  ]);

  assert.equal(trail?.targetId, "near-a");
  assert.deepEqual(trail?.orderedTraceIds, ["near-a", "near-b", "far"]);
});

test("movement and productive actions break the exact sustained stances", () => {
  assert.equal(reduceWildsSustainedEnvironment({ family: "anchor", active: true }, "movement").active, false);
  assert.equal(reduceWildsSustainedEnvironment({ family: "camouflage", active: true }, "harvest").active, false);
  assert.equal(reduceWildsSustainedEnvironment({ family: "light", active: true }, "movement").active, true);
});

