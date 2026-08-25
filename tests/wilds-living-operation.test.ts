import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileWildsLivingOperation,
  verifyWildsLivingOperationPlan,
  type WildsLivingOperationInputV1
} from "../src/features/play/wilds-living-operation";

const baseInput = (): WildsLivingOperationInputV1 => ({
  operationId: "grove:pollinate:one",
  category: "ecology",
  intention: { kind: "grove.pollinate", regionId: "region:0:0", featureId: "grove:one" },
  participants: [
    { id: "player:one", kind: "player", expectedHead: "a".repeat(64), role: "steward" },
    { id: "creature:bee", kind: "creature", expectedHead: "b".repeat(64), role: "pollinator" }
  ],
  stages: [
    { id: "stage:pollinate", profession: "pollinate", participantIds: ["player:one", "creature:bee"] }
  ],
  consequences: {
    usefulOutput: 2,
    ecologicalRenewal: 5,
    publicBenefit: 1,
    cooperation: 2,
    durability: 1,
    extraction: 0,
    damage: 0,
    waste: 0,
    restorationDebt: 0
  },
  kaiUPulse: 1_000_000,
  expiresAtKaiUPulse: 2_000_000,
  semanticIdempotencyKey: "wildz:grove:pollinate:one"
});

describe("universal living-world operation compiler", () => {
  it("compiles one immutable source-authority preview with exact net contribution", () => {
    const plan = compileWildsLivingOperation(baseInput());

    assert.equal(plan.participants.length, 2);
    assert.equal(plan.netContribution, 11);
    assert.equal(plan.authority, "source-proof-objects");
    assert.equal(plan.writes, 0);
    assert.match(plan.planDigest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(verifyWildsLivingOperationPlan(plan), { ok: true, errors: [] });
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.participants), true);
  });

  it("canonicalizes participant and stage membership order into one digest", () => {
    const left = baseInput();
    const right = baseInput();
    right.participants = [...right.participants].reverse();
    right.stages = [{ ...right.stages[0]!, participantIds: [...right.stages[0]!.participantIds].reverse() }];

    assert.equal(compileWildsLivingOperation(right).planDigest, compileWildsLivingOperation(left).planDigest);
  });

  it("does not mutate any caller-owned object", () => {
    const input = baseInput();
    const before = structuredClone(input);
    compileWildsLivingOperation(input);
    assert.deepEqual(input, before);
  });

  it("fails closed for duplicate or missing participants", () => {
    const duplicate = baseInput();
    duplicate.participants = [duplicate.participants[0]!, duplicate.participants[0]!];
    assert.throws(() => compileWildsLivingOperation(duplicate), /participant_duplicate/);

    const missing = baseInput();
    missing.stages = [{ ...missing.stages[0]!, participantIds: ["creature:unknown"] }];
    assert.throws(() => compileWildsLivingOperation(missing), /stage_participant_missing/);
  });

  it("rejects non-integer contributions and non-forward expiry", () => {
    const fractional = baseInput();
    fractional.consequences = { ...fractional.consequences, ecologicalRenewal: 1.5 };
    assert.throws(() => compileWildsLivingOperation(fractional), /contribution_invalid/);

    const expired = baseInput();
    expired.expiresAtKaiUPulse = expired.kaiUPulse;
    assert.throws(() => compileWildsLivingOperation(expired), /expiry_invalid/);
  });

  it("detects digest and participant mutation", () => {
    const plan = compileWildsLivingOperation(baseInput());
    const mutated = structuredClone(plan) as typeof plan & { participants: Array<{ role: string }> };
    mutated.participants[0]!.role = "extractor";
    const verification = verifyWildsLivingOperationPlan(mutated);

    assert.equal(verification.ok, false);
    assert.ok(verification.errors.includes("plan_digest_invalid"));
  });
});
