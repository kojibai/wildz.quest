import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsEarnedPhi } from "../src/features/play/wilds-earned-phi";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { admitWildsEmission, createWildsWorldEmissionGenesis, previewWildsEmission } from "../src/features/play/wilds-world-emission";
import { createWildsMaterialHarvest, createWildsStewardHarvestOperation, createWildsStewardPhiAward, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction";

function harvest(kind: "timber" | "stone", companion = false, capacity = "1000000", ownerReceizId = "explorer:one") {
  const source = Array.from({ length: 25 }, (_, x) => projectWildsResourceRegion(x - 12, 0)).flat().find((candidate) => candidate.kind === kind)!;
  const current = initialWildsHarvestedSourceState(source);
  const creature = companion ? { subjectId: "creature:one", head: "sha256:" + "b".repeat(64), workFamilies: [source.requirements.creature], willing: true } : undefined;
  const result = createWildsMaterialHarvest({ source, current, ownerReceizId, actorPosition: source.position, creature, kaiUPulse: 100 });
  const operation = createWildsStewardHarvestOperation({ source, currentSource: current, harvestedSource: result.source, lot: result.lot,
    ownerReceizId, playerHead: "sha256:" + "a".repeat(64), creatureSubjectId: creature?.subjectId, creatureHead: creature?.head, kaiUPulse: 100 });
  const region = String(operation.intention.regionId);
  const emission = createWildsWorldEmissionGenesis({ epochId: "epoch:rewards", epochEndsAtKaiUPulse: 1000000,
    globalCapacityPhiMicro: capacity, regionCapacityPhiMicro: { [region]: capacity }, classCapacityPhiMicro: { construction: capacity }, policyDigest: "c".repeat(64) });
  const preview = previewWildsEmission({ emission, operation, contributionClass: "construction" });
  const next = admitWildsEmission({ emission, operation, contributionClass: "construction", preview });
  const award = createWildsStewardPhiAward({ ownerReceizId, operation, currentEmission: emission, nextEmission: next, amountPhiMicro: preview.amountPhiMicro });
  return { award, emission, next, operation, region };
}

describe("small frequent world Phi earnings", () => {
  it("already awards every useful harvest, including small solo rewards", () => {
    assert.equal(harvest("stone").award.amountPhiMicro, "10000");
    assert.equal(harvest("timber").award.amountPhiMicro, "20000");
    assert.equal(harvest("stone", true).award.amountPhiMicro, "20000");
    assert.equal(harvest("timber", true).award.amountPhiMicro, "40000");
  });
  it("can award a final .001 Phi remainder while conserving all three ceilings", () => {
    const { award, next, operation, region } = harvest("stone", false, "1000");
    assert.equal(award.amountPhiMicro, "1000");
    assert.equal(next.globalRemainingPhiMicro, "0");
    assert.equal(next.regionRemainingPhiMicro[region], "0");
    assert.equal(next.classRemainingPhiMicro.construction, "0");
    assert.equal(previewWildsEmission({ emission: next, operation, contributionClass: "construction" }).reason, "operation_already_consumed");
  });
  it("projects fresh earnings once, excludes other players and rejects altered awards", () => {
    const one = harvest("stone").award;
    const two = harvest("timber").award;
    const foreign = harvest("timber", false, "1000000", "explorer:other").award;
    const awards = [one, one, two, foreign, { ...one, amountPhiMicro: "999999" }];
    const first = projectWildsEarnedPhi({ awards, ownerReceizId: "explorer:one", previousAwardIds: [one.awardId] });
    assert.equal(first.totalPhiMicro, "30000");
    assert.equal(first.freshPhiMicro, "20000");
    assert.equal(first.freshAwardCount, 1);
    assert.equal(first.awardIds.length, 2);
    const repeat = projectWildsEarnedPhi({ awards, ownerReceizId: "explorer:one", previousAwardIds: first.awardIds });
    assert.equal(repeat.freshPhiMicro, "0");
    assert.equal(repeat.freshAwardCount, 0);
  });
  it("reuses identical worker-cloned records without accepting changed fields", () => {
    const original = harvest("stone").award;
    const project = (award: typeof original) => projectWildsEarnedPhi({ awards: [award], ownerReceizId: "explorer:one" }).totalPhiMicro;
    assert.equal(project(original), "10000");
    const clone = structuredClone(original);
    assert.equal(Object.isFrozen(clone), false);
    assert.equal(project(clone), "10000");
    assert.equal(project({ ...clone, amountPhiMicro: "990000" }), "0");
    assert.equal(project({ ...clone, operationId: "steward:harvest:altered" }), "0");
    assert.equal(project({ ...clone, head: "sha256:" + "f".repeat(64) }), "0");
    assert.equal(project(structuredClone(original)), "10000");
    assert.equal(project(Object.defineProperty({ ...clone }, "amountPhiMicro", { enumerable: true, get: () => "990000" })), "0");
  });
});
