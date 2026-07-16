import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WAYFINDER_HOLLOW,
  WILDS_SETTLEMENTS,
  settlementAtPosition
} from "../src/features/play/wilds-settlements.js";

describe("Wilds settlements", () => {
  it("defines the complete Wayfinder Hollow civic surface", () => {
    assert.equal(WAYFINDER_HOLLOW.id, "wayfinder-hollow");
    assert.equal(WAYFINDER_HOLLOW.districts.length, 5);
    assert.equal(WAYFINDER_HOLLOW.residents.length, 3);
    assert.equal(WAYFINDER_HOLLOW.services.length, 3);
    assert.deepEqual(WILDS_SETTLEMENTS, [WAYFINDER_HOLLOW]);
  });

  it("finds the settlement only inside its authored radius", () => {
    assert.equal(settlementAtPosition({ x: 72, z: 40 })?.id, "wayfinder-hollow");
    assert.equal(settlementAtPosition({ x: 100, z: 100 }), null);
  });
});
