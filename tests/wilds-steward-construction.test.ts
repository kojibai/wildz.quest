import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import {
  createWildsMaterialHarvest,
  createWildsTrailBridge,
  createWildsTrailShelter,
  initialWildsHarvestedSourceState,
  projectWildsCreatureWorkFamilies,
  selectWildsTrailBridgeRotation,
  verifyWildsMaterialLot,
  verifyWildsStructure
} from "../src/features/play/wilds-steward-construction";

function sourceOf(kind: "timber" | "stone") {
  for (let x = -12; x <= 12; x += 1) for (let z = -12; z <= 12; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return source;
  }
  throw new Error(`missing_${kind}`);
}

describe("source-authoritative steward construction", () => {
  it("allows baseline explorer harvesting without a creature partner", () => {
    const source = sourceOf("timber");
    const result = createWildsMaterialHarvest({
      source,
      current: initialWildsHarvestedSourceState(source),
      ownerReceizId: "explorer:solo",
      actorPosition: source.position,
      kaiUPulse: 100
    });

    assert.equal(result.lot.contributors.explorerReceizId, "explorer:solo");
    assert.equal(result.lot.contributors.creatureSubjectId, undefined);
    assert.equal(result.lot.quantity, 1);
  });

  it("derives level-one natural work from canonical creature affinity", () => {
    assert.deepEqual(projectWildsCreatureWorkFamilies("Grove"), ["lumber"]);
    assert.deepEqual(projectWildsCreatureWorkFamilies("Stone"), ["quarry"]);
    assert.deepEqual(projectWildsCreatureWorkFamilies("Ember"), ["quarry"]);
    assert.deepEqual(projectWildsCreatureWorkFamilies("Prism"), ["lumber"]);
    assert.deepEqual(projectWildsCreatureWorkFamilies("unknown"), []);
  });

  it("creates one exact conserved material lot and advances the deterministic source head", () => {
    const source = sourceOf("timber");
    const current = initialWildsHarvestedSourceState(source);
    const result = createWildsMaterialHarvest({
      source,
      current,
      ownerReceizId: "explorer:one",
      actorPosition: { x: source.position.x + 1, z: source.position.z },
      creature: { subjectId: "creature:one", head: "sha256:" + "1".repeat(64), workFamilies: ["lumber"], willing: true },
      kaiUPulse: 123_456
    });
    assert.equal(result.lot.kind, "timber");
    assert.equal(result.lot.quantity, 1);
    assert.equal(result.source.harvestedCapacity, 1);
    assert.equal(result.source.parentHead, current.head);
    assert.equal(verifyWildsMaterialLot(result.lot), true);
    assert.notEqual(result.source.head, current.head);
    assert.throws(() => createWildsMaterialHarvest({
      source,
      current,
      ownerReceizId: "explorer:one",
      actorPosition: { x: source.position.x + 1, z: source.position.z },
      creature: { subjectId: "creature:one", head: "sha256:" + "1".repeat(64), workFamilies: ["quarry"], willing: true },
      kaiUPulse: 123_456
    }), /creature_unqualified/);
    assert.throws(() => createWildsMaterialHarvest({
      source,
      current,
      ownerReceizId: "explorer:one",
      actorPosition: { x: source.position.x + 9, z: source.position.z },
      creature: { subjectId: "creature:one", head: "sha256:" + "1".repeat(64), workFamilies: ["lumber"], willing: true },
      kaiUPulse: 123_456
    }), /source_unreachable/);
  });

  it("fails closed for stale source heads, unwilling creatures, and exhausted capacity", () => {
    const source = sourceOf("stone");
    const current = initialWildsHarvestedSourceState(source);
    const input = {
      source,
      current,
      ownerReceizId: "explorer:one",
      actorPosition: { x: source.position.x, z: source.position.z },
      creature: { subjectId: "creature:stone", head: "sha256:" + "2".repeat(64), workFamilies: ["quarry"], willing: true },
      kaiUPulse: 987_654
    } as const;
    assert.throws(() => createWildsMaterialHarvest({ ...input, current: { ...current, head: "sha256:" + "f".repeat(64) } }), /source_head_invalid/);
    assert.throws(() => createWildsMaterialHarvest({ ...input, creature: { ...input.creature, willing: false } }), /creature_unwilling/);
    let exhausted = current;
    for (let index = 0; index < source.capacity; index += 1) {
      exhausted = createWildsMaterialHarvest({ ...input, current: exhausted, kaiUPulse: input.kaiUPulse + index }).source;
    }
    assert.throws(() => createWildsMaterialHarvest({ ...input, current: exhausted, kaiUPulse: input.kaiUPulse + source.capacity }), /source_exhausted/);
  });

  it("builds a persistent shelter from exactly two timber lots and one stone lot once", () => {
    const ownerReceizId = "explorer:one";
    const makeLot = (kind: "timber" | "stone", ordinal: number) => {
      const source = sourceOf(kind);
      let current = initialWildsHarvestedSourceState(source);
      for (let index = 0; index <= ordinal; index += 1) {
        const result = createWildsMaterialHarvest({
          source,
          current,
          ownerReceizId,
          actorPosition: source.position,
          creature: { subjectId: `creature:${kind}`, head: "sha256:" + (kind === "timber" ? "3" : "4").repeat(64), workFamilies: [kind === "timber" ? "lumber" : "quarry"], willing: true },
          kaiUPulse: 200_000 + index
        });
        if (index === ordinal) return result.lot;
        current = result.source;
      }
      throw new Error("lot_missing");
    };
    const lots = [makeLot("timber", 0), makeLot("timber", 1), makeLot("stone", 0)];
    const shelter = createWildsTrailShelter({
      ownerReceizId,
      position: { x: 8, y: 1.25, z: -4 },
      rotationQuarterTurns: 1,
      lots,
      builder: { creatureSubjectId: "creature:builder", creatureHead: "sha256:" + "5".repeat(64) },
      existingStructures: [],
      kaiUPulse: 222_222
    });
    assert.equal(shelter.stage, "complete");
    assert.deepEqual(shelter.materials, { timber: 2, stone: 1 });
    assert.deepEqual(shelter.consumedLotIds, lots.map((lot) => lot.lotId).sort());
    assert.equal(verifyWildsStructure(shelter), true);
    assert.throws(() => createWildsTrailShelter({
      ownerReceizId,
      position: { x: 8, y: 1.25, z: -4 },
      rotationQuarterTurns: 1,
      lots: lots.slice(0, 2),
      builder: { creatureSubjectId: "creature:builder", creatureHead: "sha256:" + "5".repeat(64) },
      existingStructures: [],
      kaiUPulse: 222_222
    }), /materials_insufficient/);
    assert.throws(() => createWildsTrailShelter({
      ownerReceizId,
      position: { x: 9, y: 1.25, z: -4 },
      rotationQuarterTurns: 0,
      lots,
      builder: { creatureSubjectId: "creature:builder", creatureHead: "sha256:" + "5".repeat(64) },
      existingStructures: [shelter],
      kaiUPulse: 222_223
    }), /structure_overlap/);
  });

  it("builds one source-authoritative bridge across water from exact conserved lots", () => {
    assert.equal(selectWildsTrailBridgeRotation({ x: -292, z: -289 }), 1);
    assert.equal(selectWildsTrailBridgeRotation({ x: 0, z: 0 }), null);
    const ownerReceizId = "explorer:bridge";
    const makeLot = (kind: "timber" | "stone", ordinal: number) => {
      const source = sourceOf(kind);
      let current = initialWildsHarvestedSourceState(source);
      for (let index = 0; index <= ordinal; index += 1) {
        const result = createWildsMaterialHarvest({
          source,
          current,
          ownerReceizId,
          actorPosition: source.position,
          creature: { subjectId: `creature:${kind}`, head: "sha256:" + (kind === "timber" ? "6" : "7").repeat(64), workFamilies: [kind === "timber" ? "lumber" : "quarry"], willing: true },
          kaiUPulse: 300_000 + index
        });
        if (index === ordinal) return result.lot;
        current = result.source;
      }
      throw new Error("lot_missing");
    };
    const lots = [0, 1, 2, 3].map((ordinal) => makeLot("timber", ordinal))
      .concat([0, 1].map((ordinal) => makeLot("stone", ordinal)));
    const bridge = createWildsTrailBridge({
      ownerReceizId,
      position: { x: -292, z: -289 },
      rotationQuarterTurns: 1,
      lots,
      builder: { creatureSubjectId: "creature:bridge", creatureHead: "sha256:" + "8".repeat(64) },
      existingStructures: [],
      kaiUPulse: 333_333
    });

    assert.equal(bridge.blueprint, "trail-bridge");
    assert.deepEqual(bridge.materials, { timber: 4, stone: 2 });
    assert.equal(bridge.consumedLotIds.length, 6);
    assert.equal(bridge.physical.centerSurface, "shallow-water");
    assert.equal(bridge.physical.start.surface, "soil");
    assert.equal(bridge.physical.end.surface, "soil");
    assert.equal(verifyWildsStructure(bridge), true);
    assert.equal(verifyWildsStructure({ ...bridge, physical: { ...bridge.physical, deckY: bridge.physical.deckY + 1 } }), false);

    assert.throws(() => createWildsTrailBridge({
      ownerReceizId,
      position: { x: 0, z: 0 },
      rotationQuarterTurns: 1,
      lots,
      builder: { creatureSubjectId: "creature:bridge", creatureHead: "sha256:" + "8".repeat(64) },
      existingStructures: [],
      kaiUPulse: 333_334
    }), /bridge_water_required/);
    assert.throws(() => createWildsTrailBridge({
      ownerReceizId,
      position: { x: -292, z: -289 },
      rotationQuarterTurns: 1,
      lots: lots.slice(0, 5),
      builder: { creatureSubjectId: "creature:bridge", creatureHead: "sha256:" + "8".repeat(64) },
      existingStructures: [],
      kaiUPulse: 333_334
    }), /materials_insufficient/);
  });
});
