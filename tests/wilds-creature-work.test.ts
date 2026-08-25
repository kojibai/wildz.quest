import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement, reduceWildsBlueprintPreview } from "../src/features/play/wilds-world-construction";
import { createWildsCreatureMandate, evaluateWildsCreatureConsent } from "../src/features/play/wilds-creature-mandate";
import { compileWildsCreatureWorkPlan, projectWildsCreatureWorkProgress } from "../src/features/play/wilds-creature-work";
import { projectWildsResourceRegion, type WildsResourceKind } from "../src/features/play/wilds-resource-authority";

function resource(kind: WildsResourceKind) {
  for (let x = -12; x <= 12; x += 1) for (let z = -12; z <= 12; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return { source, sourceHead: `head:${source.sourceId}`, capacity: source.capacity };
  }
  throw new Error(`missing test resource ${kind}`);
}

function blueprint() {
  let state = createWildsBlueprintPreview("blueprint:work", "wildz.excavation.region.v1:0:0");
  const foundation = previewWildsBlueprintPlacement({
    blueprint: state,
    kind: "foundation",
    pointer: { x: 4, y: 0, z: 4 },
    rotationQuarterTurns: 0,
    heightStep: 0,
    physical: { terrainY: 0, waterline: null, anchors: [], solids: [] }
  });
  state = reduceWildsBlueprintPreview(state, { kind: "place-preview", placement: foundation });
  const room = previewWildsBlueprintPlacement({
    blueprint: state,
    kind: "room",
    pointer: { x: 4, y: 1, z: 4 },
    rotationQuarterTurns: 0,
    heightStep: 0,
    physical: { terrainY: 0, waterline: null, anchors: foundation.anchors, solids: [] }
  });
  return reduceWildsBlueprintPreview(state, { kind: "place-preview", placement: room });
}

describe("bounded creature work planning", () => {
  it("binds an accepted sovereign mandate to exact creature, work, region, budget, and expiry", () => {
    const professions = ["survey", "haul", "shape", "stabilize", "masonry", "finish"] as const;
    const creatureHead = "a".repeat(64);
    const resources = [resource("buried"), resource("timber")] as const;
    const consent = evaluateWildsCreatureConsent({
      creatureSubjectId: "creature:builder",
      creatureHead,
      condition: { energy: 90, fatigue: 4, injury: 0, stress: 3 },
      bond: 80,
      preferences: { professions, avoidHazards: [] },
      capabilities: { professions },
      safety: { risk: 5, hazards: [], supportAvailable: true },
      requested: { professions, maxActions: 64 },
      kaiUPulse: 1
    });
    const mandate = createWildsCreatureMandate({
      consent,
      creatureSubjectId: "creature:builder",
      creatureHead,
      region: { x: 0, z: 0 },
      professions,
      allowedResourceIds: resources.map((entry) => entry.source.sourceId),
      maxActions: 64,
      issuedAtKaiUPulse: 1,
      expiresAtKaiUPulse: 999_999
    });
    const base = {
      blueprint: blueprint(),
      assignments: [{ creatureSubjectId: "creature:builder", creatureHead, professions }],
      allocations: {
        resources,
        tools: [{ subjectId: "tool:mason", head: "head:mason", professions: ["shape", "masonry", "finish"] as const }]
      },
      bounds: { regionX: 0, regionZ: 0, maxActions: 64, expiresAtKaiPulse: "999999" },
      mandates: [mandate]
    } as const;

    assert.equal(compileWildsCreatureWorkPlan(base).valid, true);
    const stale = compileWildsCreatureWorkPlan({
      ...base,
      assignments: [{ ...base.assignments[0], creatureHead: "b".repeat(64) }]
    });
    assert.equal(stale.valid, false);
    assert.ok(stale.reasons.includes("mandate-creature-head-mismatch"));
  });

  it("compiles exact blueprint pieces into a deterministic bounded stage plan", () => {
    const input = {
      blueprint: blueprint(),
      assignments: [
        { creatureSubjectId: "creature:builder", creatureHead: "head:builder", professions: ["survey", "haul", "shape", "stabilize", "masonry", "finish"] }
      ],
      allocations: {
        resources: [resource("buried"), resource("timber")],
        tools: [{ subjectId: "tool:mason", head: "head:mason", professions: ["shape", "masonry", "finish"] }]
      },
      bounds: { regionX: 0, regionZ: 0, maxActions: 64, expiresAtKaiPulse: "999999" }
    } as const;
    const first = compileWildsCreatureWorkPlan(input);
    const second = compileWildsCreatureWorkPlan(input);
    assert.deepEqual(second, first);
    assert.equal(first.valid, true);
    assert.equal(first.stages.length > 0 && first.stages.length <= 64, true);
    assert.equal(first.stages.every((stage, index) => stage.index === index && stage.pieceId), true);
    assert.equal(first.physical, false);
    assert.equal(first.offlineExecution, false);
    assert.equal(first.execute, "blocked-receiz-v122");
    assert.equal(first.writes, 0);
  });

  it("fails closed when profession, allocation, expiry, or action bounds are incomplete", () => {
    const base = {
      blueprint: blueprint(),
      assignments: [{ creatureSubjectId: "creature:builder", creatureHead: "head:builder", professions: ["survey"] }],
      allocations: { resources: [{ ...resource("buried"), capacity: 1 }], tools: [] },
      bounds: { regionX: 0, regionZ: 0, maxActions: 64, expiresAtKaiPulse: "999999" }
    } as const;
    const missingProfession = compileWildsCreatureWorkPlan(base);
    assert.equal(missingProfession.valid, false);
    assert.equal(missingProfession.reasons.includes("profession-unassigned"), true);
    assert.equal(missingProfession.stages.length, 0);
    const noResource = compileWildsCreatureWorkPlan({ ...base, allocations: { ...base.allocations, resources: [] } });
    assert.equal(noResource.reasons.includes("resource-allocation-required"), true);
    const tooLittle = compileWildsCreatureWorkPlan({ ...base, allocations: { ...base.allocations, resources: [{ ...resource("buried"), capacity: 1 }] } });
    assert.equal(tooLittle.reasons.includes("resource-budget-insufficient"), true);
    const duplicatedCreature = compileWildsCreatureWorkPlan({ ...base, assignments: [base.assignments[0], base.assignments[0]] });
    assert.equal(duplicatedCreature.reasons.includes("participant-duplicate"), true);
    const noTool = compileWildsCreatureWorkPlan({
      ...base,
      assignments: [{ ...base.assignments[0], professions: ["survey", "haul", "shape", "stabilize", "masonry", "finish"] }],
      allocations: { resources: [resource("buried"), resource("timber")], tools: [] }
    });
    assert.equal(noTool.reasons.includes("tool-allocation-required"), true);
    assert.throws(() => compileWildsCreatureWorkPlan({ ...base, bounds: { ...base.bounds, maxActions: 0 } }), /action_budget_invalid/);
    assert.throws(() => compileWildsCreatureWorkPlan({ ...base, bounds: { ...base.bounds, expiresAtKaiPulse: "not-kai" } }), /expiry_invalid/);
    assert.throws(() => compileWildsCreatureWorkPlan({ ...base, bounds: { ...base.bounds, expiresAtKaiPulse: `1${"0".repeat(80)}` } }), /expiry_invalid/);
    assert.throws(() => compileWildsCreatureWorkPlan({ ...base, bounds: { ...base.bounds, regionX: 3_906_250 } }), /region_invalid/);
    const forged = resource("buried");
    const forgedPlan = compileWildsCreatureWorkPlan({ ...base, allocations: { ...base.allocations, resources: [{ ...forged, source: { ...forged.source, kind: "timber" } }] } as never });
    assert.equal(forgedPlan.reasons.includes("resource-allocation-required"), true);
  });

  it("projects only prefix progress and never executes offline or consumes allocations", () => {
    const plan = compileWildsCreatureWorkPlan({
      blueprint: blueprint(),
      assignments: [{ creatureSubjectId: "creature:builder", creatureHead: "head:builder", professions: ["survey", "haul", "shape", "stabilize", "masonry", "finish"] }],
      allocations: {
        resources: [resource("buried"), resource("timber")],
        tools: [{ subjectId: "tool:mason", head: "head:mason", professions: ["shape", "masonry", "finish"] }]
      },
      bounds: { regionX: 0, regionZ: 0, maxActions: 64, expiresAtKaiPulse: "999999" }
    });
    const first = projectWildsCreatureWorkProgress(plan, []);
    const progressed = projectWildsCreatureWorkProgress(plan, [plan.stages[0]!.stageId]);
    assert.equal(first.nextStageId, plan.stages[0]!.stageId);
    assert.equal(progressed.nextStageId, plan.stages[1]!.stageId);
    assert.equal(progressed.physical, false);
    assert.equal(progressed.writes, 0);
    assert.deepEqual(plan.allocations.resources[0]?.capacity, resource("buried").capacity);
    assert.throws(() => projectWildsCreatureWorkProgress(plan, [plan.stages[1]!.stageId]), /progress_order_invalid/);
  });
});
