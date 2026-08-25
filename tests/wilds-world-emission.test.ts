import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileWildsLivingOperation, type WildsLivingOperationInputV1 } from "../src/features/play/wilds-living-operation";
import {
  admitWildsEmission,
  createWildsWorldEmissionGenesis,
  previewWildsEmission
} from "../src/features/play/wilds-world-emission";

const operationInput = (overrides: Partial<WildsLivingOperationInputV1> = {}): WildsLivingOperationInputV1 => ({
  operationId: "grove:pollinate:one",
  category: "ecology",
  intention: { kind: "grove.pollinate", regionId: "region:0:0", featureId: "grove:one" },
  participants: [
    { id: "player:one", kind: "player", expectedHead: "a".repeat(64), role: "steward" },
    { id: "creature:bee", kind: "creature", expectedHead: "b".repeat(64), role: "pollinator" }
  ],
  stages: [{ id: "stage:pollinate", profession: "pollinate", participantIds: ["player:one", "creature:bee"] }],
  consequences: {
    usefulOutput: 2, ecologicalRenewal: 5, publicBenefit: 1, cooperation: 2, durability: 1,
    extraction: 0, damage: 0, waste: 0, restorationDebt: 0
  },
  kaiUPulse: 1_000_000,
  expiresAtKaiUPulse: 2_000_000,
  semanticIdempotencyKey: "wildz:grove:pollinate:one",
  ...overrides
});

const genesis = (capacity = "1000000") => createWildsWorldEmissionGenesis({
  epochId: "epoch:kai:one",
  epochEndsAtKaiUPulse: 50_000_000,
  globalCapacityPhiMicro: capacity,
  regionCapacityPhiMicro: { "region:0:0": capacity },
  classCapacityPhiMicro: { ecology: capacity, construction: capacity },
  policyDigest: "c".repeat(64)
});

describe("bounded World Emission authority", () => {
  it("previews lawful regenerative contribution without writing authority", () => {
    const emission = genesis();
    const operation = compileWildsLivingOperation(operationInput());
    assert.deepEqual(previewWildsEmission({ emission, operation, contributionClass: "ecology" }), {
      eligible: true,
      amountPhiMicro: "110000",
      sourceHead: emission.head,
      reason: null,
      writes: 0
    });
  });

  it("issues nothing for extraction or a damage-and-repair loop", () => {
    const emission = genesis();
    const extraction = compileWildsLivingOperation(operationInput({
      operationId: "grove:extract:one",
      semanticIdempotencyKey: "wildz:grove:extract:one",
      consequences: { usefulOutput: 1, ecologicalRenewal: 0, publicBenefit: 0, cooperation: 0, durability: 0, extraction: 4, damage: 0, waste: 0, restorationDebt: 0 }
    }));
    const cycle = compileWildsLivingOperation(operationInput({
      operationId: "grove:cycle:one",
      semanticIdempotencyKey: "wildz:grove:cycle:one",
      consequences: { usefulOutput: 0, ecologicalRenewal: 5, publicBenefit: 0, cooperation: 0, durability: 0, extraction: 0, damage: 1, waste: 0, restorationDebt: 0 }
    }));

    assert.equal(previewWildsEmission({ emission, operation: extraction, contributionClass: "ecology" }).amountPhiMicro, "0");
    assert.equal(previewWildsEmission({ emission, operation: cycle, contributionClass: "ecology" }).amountPhiMicro, "0");
  });

  it("binds global, region, and contribution-class ceilings", () => {
    const operation = compileWildsLivingOperation(operationInput());
    const emission = createWildsWorldEmissionGenesis({
      epochId: "epoch:kai:bounded",
      epochEndsAtKaiUPulse: 50_000_000,
      globalCapacityPhiMicro: "90000",
      regionCapacityPhiMicro: { "region:0:0": "70000" },
      classCapacityPhiMicro: { ecology: "50000" },
      policyDigest: "d".repeat(64)
    });
    assert.equal(previewWildsEmission({ emission, operation, contributionClass: "ecology" }).amountPhiMicro, "50000");
  });

  it("subtracts restoration debt and requires real cooperation for cooperation credit", () => {
    const emission = genesis();
    const debt = compileWildsLivingOperation(operationInput({
      operationId: "grove:debt:one",
      semanticIdempotencyKey: "wildz:grove:debt:one",
      consequences: { ...operationInput().consequences, restorationDebt: 3 }
    }));
    const solo = compileWildsLivingOperation(operationInput({
      operationId: "grove:solo:one",
      semanticIdempotencyKey: "wildz:grove:solo:one",
      participants: [{ id: "player:one", kind: "player", expectedHead: "a".repeat(64), role: "steward" }],
      stages: [{ id: "stage:solo", profession: "pollinate", participantIds: ["player:one"] }]
    }));

    assert.equal(previewWildsEmission({ emission, operation: debt, contributionClass: "ecology" }).amountPhiMicro, "80000");
    assert.equal(previewWildsEmission({ emission, operation: solo, contributionClass: "ecology" }).amountPhiMicro, "90000");
  });

  it("admits an exact preview once and advances append-only capacity", () => {
    const emission = genesis();
    const operation = compileWildsLivingOperation(operationInput());
    const preview = previewWildsEmission({ emission, operation, contributionClass: "ecology" });
    const successor = admitWildsEmission({ emission, operation, contributionClass: "ecology", preview });

    assert.equal(successor.parentHead, emission.head);
    assert.equal(successor.revision, 1);
    assert.equal(successor.globalRemainingPhiMicro, "890000");
    assert.equal(successor.regionRemainingPhiMicro["region:0:0"], "890000");
    assert.equal(successor.classRemainingPhiMicro.ecology, "890000");
    assert.deepEqual(successor.consumedOperationIds, [operation.operationId]);
    assert.equal(previewWildsEmission({ emission: successor, operation, contributionClass: "ecology" }).reason, "operation_already_consumed");
    assert.throws(() => admitWildsEmission({ emission: successor, operation, contributionClass: "ecology", preview }), /preview_mismatch/);
  });
});
