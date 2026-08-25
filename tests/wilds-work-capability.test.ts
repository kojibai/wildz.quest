import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { projectWildsWorkCapabilityMeters } from "../src/features/play/wilds-work-capability";

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
});
