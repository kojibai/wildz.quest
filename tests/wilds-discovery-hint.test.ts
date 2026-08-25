import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActiveEncounterState } from "../src/features/play/encounter-state.js";
import { projectWildsDiscoveryHint } from "../src/features/play/wilds-discovery-hint.js";

function hint(layer: "ground" | "air" | "water-column"): ActiveEncounterState {
  return {
    phase: "hint",
    searchedAt: "2026-08-25T12:00:00.000Z",
    searchPoint: { x: 1, z: 2, surfaceWorldY: 3 },
    ownerReceizId: "wildz",
    hotspotId: "hotspot:one",
    familyId: "grove",
    formId: "grove-1",
    cover: "rock",
    proximity: "warm",
    trend: "closer",
    placement: {
      version: "wildz.encounter-placement.v1",
      identity: "placement:one",
      x: 4,
      z: 5,
      layer,
      worldY: 9,
      interactionBand: { minY: 8.2, maxY: 9.8 },
      requiredCapability: layer === "air" ? "flight" : layer === "water-column" ? "swim" : null
    }
  };
}

describe("living discovery hint presentation", () => {
  it("turns an air hint into a directly actionable airborne signal with no ground cover", () => {
    assert.deepEqual(projectWildsDiscoveryHint(hint("air")), {
      medium: "air",
      point: { x: 4, z: 5, surfaceWorldY: 9 },
      showHabitatCover: false,
      activateOnSignal: true
    });
  });

  it("keeps grounded and aquatic clues in their native visual grammar", () => {
    assert.deepEqual(projectWildsDiscoveryHint(hint("ground")), {
      medium: "ground",
      point: { x: 1, z: 2, surfaceWorldY: 3 },
      showHabitatCover: true,
      activateOnSignal: false
    });
    assert.equal(projectWildsDiscoveryHint(hint("water-column"))?.medium, "water");
  });
});
