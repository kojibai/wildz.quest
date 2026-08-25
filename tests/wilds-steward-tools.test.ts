import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsResourceRegion, type WildsResourceSource } from "../src/features/play/wilds-resource-authority";
import {
  createWildsMaterialHarvest,
  createWildsStewardTool,
  createWildsTrailCache,
  createWildsWorkstation,
  initialWildsHarvestedSourceState,
  reviseWildsStewardToolAfterUse,
  verifyWildsStewardTool,
  verifyWildsStructure,
  type WildsMaterialLotV1
} from "../src/features/play/wilds-steward-construction";

const ownerReceizId = "explorer:workshop";
const creature = { subjectId: "creature:workshop", head: `sha256:${"a".repeat(64)}`, willing: true } as const;

function sourceOf(kind: "timber" | "stone") {
  for (let x = -3; x <= 3; x += 1) for (let z = -3; z <= 3; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return source;
  }
  throw new Error(`missing_${kind}`);
}

function lots(kind: "timber" | "stone", count: number, startKai: number): WildsMaterialLotV1[] {
  const source: WildsResourceSource = sourceOf(kind);
  let current = initialWildsHarvestedSourceState(source);
  return Array.from({ length: count }, (_, index) => {
    const result = createWildsMaterialHarvest({
      source,
      current,
      ownerReceizId,
      actorPosition: source.position,
      creature: { ...creature, workFamilies: [kind === "timber" ? "lumber" : "quarry"] },
      kaiUPulse: startKai + index
    });
    current = result.source;
    return result.lot;
  });
}

describe("steward tools, workstations, and storage proofs", () => {
  it("builds exact persistent workbench and cache structures", () => {
    const timber = lots("timber", 5, 100_000);
    const stone = lots("stone", 4, 100_100);
    const workstation = createWildsWorkstation({
      ownerReceizId,
      position: { x: 12, y: 1, z: 18 },
      rotationQuarterTurns: 1,
      lots: [...timber.slice(0, 3), ...stone.slice(0, 2)],
      builder: { creatureSubjectId: creature.subjectId, creatureHead: creature.head },
      existingStructures: [],
      kaiUPulse: 101_000
    });
    const cache = createWildsTrailCache({
      ownerReceizId,
      position: { x: 22, y: 1.2, z: 18 },
      rotationQuarterTurns: 0,
      lots: [...timber.slice(3), ...stone.slice(2)],
      builder: { creatureSubjectId: creature.subjectId, creatureHead: creature.head },
      existingStructures: [workstation],
      kaiUPulse: 101_001
    });
    assert.equal(workstation.blueprint, "steward-workbench");
    assert.deepEqual(workstation.materials, { timber: 3, stone: 2 });
    assert.equal(cache.blueprint, "trail-cache");
    assert.deepEqual(cache.materials, { timber: 2, stone: 2 });
    assert.equal(verifyWildsStructure(workstation), true);
    assert.equal(verifyWildsStructure(cache), true);
    assert.throws(() => createWildsWorkstation({
      ownerReceizId,
      position: { x: 32, y: 1, z: 18 }, rotationQuarterTurns: 0,
      lots: [...timber.slice(0, 2), ...stone.slice(0, 2)],
      builder: { creatureSubjectId: creature.subjectId, creatureHead: creature.head },
      existingStructures: [], kaiUPulse: 101_002
    }), /materials_insufficient/);
  });

  it("crafts a deterministic workbench-bound tool and revises durability on matching work", () => {
    const timber = lots("timber", 4, 200_000);
    const stone = lots("stone", 3, 200_100);
    const workstation = createWildsWorkstation({
      ownerReceizId,
      position: { x: 12, y: 1, z: 18 }, rotationQuarterTurns: 0,
      lots: [...timber.slice(0, 3), ...stone.slice(0, 2)],
      builder: { creatureSubjectId: creature.subjectId, creatureHead: creature.head },
      existingStructures: [], kaiUPulse: 201_000
    });
    const tool = createWildsStewardTool({
      kind: "steward-axe",
      ownerReceizId,
      workstation,
      lots: [timber[3]!, stone[2]!],
      builder: { creatureSubjectId: creature.subjectId, creatureHead: creature.head },
      kaiUPulse: 201_001
    });
    assert.equal(verifyWildsStewardTool(tool), true);
    assert.equal(tool.capability, "lumber");
    assert.deepEqual(tool.durability, { remaining: 24, capacity: 24 });
    const revised = reviseWildsStewardToolAfterUse(tool, { capability: "lumber", kaiUPulse: 201_002 });
    assert.equal(revised.toolId, tool.toolId);
    assert.equal(revised.revision, 1);
    assert.equal(revised.parentHead, tool.head);
    assert.equal(revised.durability.remaining, 23);
    assert.equal(verifyWildsStewardTool(revised), true);
    assert.throws(() => reviseWildsStewardToolAfterUse(tool, { capability: "quarry", kaiUPulse: 201_002 }), /tool_capability_invalid/);

    const source = sourceOf("timber");
    const harvest = createWildsMaterialHarvest({
      source,
      current: initialWildsHarvestedSourceState(source),
      ownerReceizId,
      actorPosition: source.position,
      creature: { ...creature, workFamilies: ["lumber"] },
      tool,
      kaiUPulse: 201_003
    });
    assert.equal(harvest.source.harvestedCapacity, 1);
    assert.equal(harvest.lot.quantity, 1);
    assert.equal(harvest.lot.quality, Math.min(5, source.quality + 1));
    assert.equal(harvest.tool?.durability.remaining, 23);
  });
});
