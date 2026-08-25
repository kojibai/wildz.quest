import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { applyWildsInput, createOwnerBoundInitialPlayState, selectedAsset } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { applyWildsCompanionWork, projectWildsWorkCapabilityMeters, selectNearestWildsWorkSource, selectWildsResourceWorkPartner } from "../src/features/play/wilds-work-capability";
import type { WildsResourceSource } from "../src/features/play/wilds-resource-authority";

function card(formId: string) {
  return sealCollectedCard({ formId, ownerReceizId: "wilds.work.player", encounterId: `work:${formId}`, capturedAt: "2026-08-25T12:00:00.000Z" });
}

describe("creature work capability meters", () => {
  it("projects timber and quarry capability from the same creature authority used by harvesting", () => {
    assert.deepEqual(projectWildsWorkCapabilityMeters(card("mintcub-1")).map((item) => item.family), ["lumber"]);
    assert.deepEqual(projectWildsWorkCapabilityMeters(card("titanseal-1")).map((item) => item.family), ["quarry"]);
  });

  it("shows current usable capacity without making imported cards falsely unrested", () => {
    const asset = card("mintcub-1");
    assert.equal(projectWildsWorkCapabilityMeters(asset)[0]?.value, 100);
    assert.equal(projectWildsWorkCapabilityMeters(asset)[0]?.state, "ready");
    const tired = { ...emptyAdventureCondition(asset.id), fatigue: 70 };
    assert.equal(projectWildsWorkCapabilityMeters(asset, tired)[0]?.state, "rest");
  });

  it("spends only three percent when a companion assists one source action", () => {
    const asset = card("mintcub-1");
    const worked = applyWildsCompanionWork(emptyAdventureCondition(asset.id));
    assert.equal(worked.fatigue, 3);
    assert.equal(projectWildsWorkCapabilityMeters(asset, worked)[0]?.value, 97);
  });

  it("records assisted work in persistent play state and camp restores it", () => {
    const state = createOwnerBoundInitialPlayState("wilds.work.player");
    const active = selectedAsset(state)!;
    const worked = applyWildsInput(state, { type: "record-steward-work", assetId: active.id });
    assert.equal(worked.adventureConditions[active.id]?.fatigue, 3);
    assert.equal(worked.hearttreeConditions[active.id]?.fatigue, 3);
    const rested = applyWildsInput(worked, { type: "rest", at: "2026-08-25T12:01:00.000Z" });
    assert.equal(rested.adventureConditions[active.id]?.fatigue, 0);
  });

  it("automatically brings forward a rested companion for the touched source", () => {
    const lumber = card("mintcub-1");
    const quarry = card("titanseal-1");
    const conditions = {
      [lumber.id]: emptyAdventureCondition(lumber.id),
      [quarry.id]: emptyAdventureCondition(quarry.id)
    };

    assert.equal(selectWildsResourceWorkPartner([lumber, quarry], conditions, "quarry", lumber.id)?.id, quarry.id);
    assert.equal(selectWildsResourceWorkPartner([lumber, quarry], conditions, "lumber", lumber.id)?.id, lumber.id);
  });

  it("never auto-selects an exhausted companion", () => {
    const lumber = card("mintcub-1");
    const quarry = card("titanseal-1");
    const conditions = {
      [lumber.id]: emptyAdventureCondition(lumber.id),
      [quarry.id]: { ...emptyAdventureCondition(quarry.id), fatigue: 90 }
    };

    assert.equal(selectWildsResourceWorkPartner([lumber, quarry], conditions, "quarry", lumber.id), null);
  });

  it("routes a work control to the nearest ready matching source within physical reach", () => {
    const source = (sourceId: string, kind: "timber" | "stone", x: number, z: number): WildsResourceSource => ({
      schema: "wildz.resource-source.v1", sourceId, regionX: 0, regionZ: 0, slot: 0, kind,
      position: { x, y: 0, z }, capacity: 10, quality: 1,
      requirements: { creature: kind === "timber" ? "lumber" : "quarry", tool: kind === "timber" ? "axe" : "hammer" },
      replenishment: { intervalPulses: 1, capacityPerInterval: 1 }
    });
    const recovering = source("tree:recovering", "timber", 1, 0);
    const readyFar = source("tree:far", "timber", 4, 0);
    const readyNear = source("tree:near", "timber", 2, 0);
    const stone = source("stone:near", "stone", 1, 0);

    assert.equal(selectNearestWildsWorkSource([
      { source: recovering, availableCapacity: 0 },
      { source: readyFar, availableCapacity: 1 },
      { source: stone, availableCapacity: 1 },
      { source: readyNear, availableCapacity: 1 }
    ], "lumber", { x: 0, z: 0 }, 5.5)?.sourceId, "tree:near");
    assert.equal(selectNearestWildsWorkSource([{ source: readyFar, availableCapacity: 1 }], "lumber", { x: 0, z: 0 }, 3), null);
  });
});
