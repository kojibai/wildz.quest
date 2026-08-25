import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWildsBreakCapability,
  applyWildsRescueCapability,
  beginWildsAnchorHold,
  beginWildsResistanceEnvelope
} from "../src/features/play/wilds-support-capabilities";

test("break advances only an explicitly breakable unprotected source", () => {
  const cracked = applyWildsBreakCapability({ id: "barrier:1", integrity: 1, admittedImpact: 0.4, breakable: true, protected: false, privateOwnerId: null });
  assert.equal(cracked.integrity, 0.6);
  assert.throws(
    () => applyWildsBreakCapability({ id: "tree:healthy", integrity: 1, admittedImpact: 0.4, breakable: false, protected: true, privateOwnerId: null }),
    /wilds_break_protected_source/
  );
  assert.throws(
    () => applyWildsBreakCapability({ id: "home:other", integrity: 1, admittedImpact: 0.4, breakable: true, protected: false, privateOwnerId: "other" }),
    /wilds_break_protected_source/
  );
});

test("resistance protects only a matching hazard and anchor counters exact force", () => {
  const resistance = beginWildsResistanceEnvelope({ hazard: "cold", creatureResistance: "cold", power: 65 });
  const mismatch = beginWildsResistanceEnvelope({ hazard: "storm", creatureResistance: "cold", power: 65 });
  const anchor = beginWildsAnchorHold({ force: { x: 0.8, z: -0.3 }, power: 55 });

  assert.equal(resistance.active, true);
  assert.equal(resistance.protection, 0.65);
  assert.equal(mismatch.active, false);
  assert.deepEqual(anchor.counterForce, { x: -0.44000000000000006, z: 0.165 });
});

test("rescue restores a safe position and margin without erasing injury or consequences", () => {
  const rescued = applyWildsRescueCapability({
    id: "companion:1",
    endangered: true,
    position: { x: 8, z: 8 },
    safeAnchor: { x: 2, z: 3 },
    recoveryMargin: 4,
    injuryCount: 2
  }, 60);

  assert.deepEqual(rescued.position, { x: 2, z: 3 });
  assert.equal(rescued.recoveryMargin, 10);
  assert.equal(rescued.injuryCount, 2);
});

