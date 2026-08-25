import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsResourceAffordance } from "../src/features/play/wilds-resource-affordance";

describe("Wilds resource affordances", () => {
  it("makes possible resource work obvious and explains every unavailable state", () => {
    assert.deepEqual(projectWildsResourceAffordance({ kind: "timber", distance: 9, availableCapacity: 12, pending: false, companionQualified: true }), {
      state: "approach", label: "Living timber", guidance: "Move closer to harvest", enabled: false
    });
    assert.deepEqual(projectWildsResourceAffordance({ kind: "timber", distance: 4, availableCapacity: 12, pending: false, companionQualified: true }), {
      state: "ready", label: "Harvest timber", guidance: "Work together", enabled: true
    });
    assert.deepEqual(projectWildsResourceAffordance({ kind: "timber", distance: 4, availableCapacity: 12, pending: false, companionQualified: false }), {
      state: "companion", label: "Observe timber", guidance: "Reveals why a Woodland companion is needed", enabled: true
    });
    assert.deepEqual(projectWildsResourceAffordance({ kind: "timber", distance: 4, availableCapacity: 12, pending: true, companionQualified: true }), {
      state: "working", label: "Harvesting…", guidance: "Work is being admitted", enabled: false
    });
    assert.deepEqual(projectWildsResourceAffordance({ kind: "timber", distance: 4, availableCapacity: 12, pending: false, companionQualified: true, companionReady: false }), {
      state: "rest", label: "Observe timber", guidance: "Read the source now; gather after your companion rests", enabled: true
    });
    assert.deepEqual(projectWildsResourceAffordance({ kind: "timber", distance: 4, availableCapacity: 0, pending: false, companionQualified: true }), {
      state: "recovering", label: "Timber recovering", guidance: "This living source is replenishing", enabled: false
    });
  });

  it("uses the same explicit action grammar for stone", () => {
    assert.deepEqual(projectWildsResourceAffordance({ kind: "stone", distance: 4, availableCapacity: 8, pending: false, companionQualified: true }), {
      state: "ready", label: "Gather stone", guidance: "Work together", enabled: true
    });
  });
});
