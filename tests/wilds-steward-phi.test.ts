import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import {
  createWildsMaterialHarvest,
  createWildsStewardHarvestOperation,
  createWildsStewardPhiAward,
  createWildsStewardStructureOperation,
  createWildsTrailBridge,
  createWildsTrailShelter,
  initialWildsHarvestedSourceState,
  sumWildsStewardPhiAwards,
  verifyWildsStewardPhiAward
} from "../src/features/play/wilds-steward-construction";
import {
  admitWildsEmission,
  createWildsWorldEmissionGenesis,
  previewWildsEmission
} from "../src/features/play/wilds-world-emission";

const ownerReceizId = "player:steward";
const playerHead = "sha256:" + "a".repeat(64);
const creature = { subjectId: "creature:steward", head: "sha256:" + "b".repeat(64), willing: true } as const;

function sourceOf(kind: "timber" | "stone") {
  for (let x = -2; x <= 2; x += 1) for (let z = -2; z <= 2; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return source;
  }
  throw new Error(`missing_${kind}`);
}

function emission() {
  const capacities: Record<string, string> = {};
  for (let x = -2; x <= 2; x += 1) for (let z = -2; z <= 2; z += 1) capacities[`region:${x}:${z}`] = "1000000";
  return createWildsWorldEmissionGenesis({
    epochId: "epoch:steward:one",
    epochEndsAtKaiUPulse: 10_000_000,
    globalCapacityPhiMicro: "25000000",
    regionCapacityPhiMicro: capacities,
    classCapacityPhiMicro: { construction: "25000000" },
    policyDigest: "c".repeat(64)
  });
}

function harvest(kind: "timber" | "stone", ordinal = 0) {
  const source = sourceOf(kind);
  let current = initialWildsHarvestedSourceState(source);
  let result = createWildsMaterialHarvest({
    source,
    current,
    ownerReceizId,
    actorPosition: source.position,
    creature: { ...creature, workFamilies: [kind === "timber" ? "lumber" : "quarry"] },
    kaiUPulse: 1_000_000
  });
  for (let index = 0; index < ordinal; index += 1) {
    current = result.source;
    result = createWildsMaterialHarvest({
      source,
      current,
      ownerReceizId,
      actorPosition: source.position,
      creature: { ...creature, workFamilies: [kind === "timber" ? "lumber" : "quarry"] },
      kaiUPulse: 1_000_001 + index
    });
  }
  return { source, current, result };
}

describe("source-authoritative stewardship Phi", () => {
  it("issues exact bounded Phi for cooperative renewable timber and stone work", () => {
    for (const [kind, expected] of [["timber", "40000"], ["stone", "20000"]] as const) {
      const work = harvest(kind);
      const operation = createWildsStewardHarvestOperation({
        source: work.source,
        currentSource: work.current,
        harvestedSource: work.result.source,
        lot: work.result.lot,
        ownerReceizId,
        playerHead,
        creatureSubjectId: creature.subjectId,
        creatureHead: creature.head,
        kaiUPulse: work.result.lot.source.kaiUPulse
      });
      assert.equal(operation.intention.regionId, `region:${Math.floor(work.source.position.x / 64)}:${Math.floor(work.source.position.z / 64)}`);
      const currentEmission = emission();
      const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
      assert.equal(preview.amountPhiMicro, expected);
      const nextEmission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
      const award = createWildsStewardPhiAward({ ownerReceizId, operation, currentEmission, nextEmission, amountPhiMicro: expected });
      assert.equal(verifyWildsStewardPhiAward(award), true);
      assert.equal(sumWildsStewardPhiAwards([award], ownerReceizId), expected);
      assert.equal(previewWildsEmission({ emission: nextEmission, operation, contributionClass: "construction" }).reason, "operation_already_consumed");
    }
  });

  it("issues a larger exact award for a durable shared shelter and rejects a forged delta", () => {
    const timberOne = harvest("timber", 0).result.lot;
    const timberTwo = harvest("timber", 1).result.lot;
    const stone = harvest("stone", 0).result.lot;
    const lots = [timberOne, timberTwo, stone];
    const structure = createWildsTrailShelter({
      ownerReceizId,
      position: { x: 12, y: 1.25, z: 12 },
      rotationQuarterTurns: 0,
      lots,
      builder: { creatureSubjectId: creature.subjectId, creatureHead: creature.head },
      existingStructures: [],
      kaiUPulse: 1_100_000
    });
    const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId, playerHead });
    const currentEmission = emission();
    const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
    assert.equal(preview.amountPhiMicro, "80000");
    const nextEmission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
    const award = createWildsStewardPhiAward({ ownerReceizId, operation, currentEmission, nextEmission, amountPhiMicro: "80000" });
    assert.equal(verifyWildsStewardPhiAward(award), true);
    assert.equal(verifyWildsStewardPhiAward({ ...award, amountPhiMicro: "90000" }), false);
  });

  it("issues exact bounded Phi for a durable public bridge", () => {
    const lots = [0, 1, 2, 3].map((ordinal) => harvest("timber", ordinal).result.lot)
      .concat([0, 1].map((ordinal) => harvest("stone", ordinal).result.lot));
    const structure = createWildsTrailBridge({
      ownerReceizId,
      position: { x: -292, z: -289 },
      rotationQuarterTurns: 1,
      lots,
      builder: { creatureSubjectId: creature.subjectId, creatureHead: creature.head },
      existingStructures: [],
      kaiUPulse: 1_200_000
    });
    const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId, playerHead });
    const currentEmission = emission();
    const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });

    assert.equal(operation.intention.kind, "steward.build-trail-bridge");
    assert.deepEqual(operation.stages.map((stage) => stage.profession), ["finish", "haul", "stabilize", "survey"]);
    assert.equal(preview.amountPhiMicro, "140000");
  });
});
