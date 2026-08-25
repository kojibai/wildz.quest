import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearWildsResourceAuthorityCachesForTests,
  previewWildsHarvest,
  isCanonicalWildsResourceSource,
  projectWildsResourceAvailability,
  projectWildsResourceRegion,
  projectWildsResourceSourceForObstacle,
  wildsResourceAuthorityDiagnostics,
  wildsResourceRegionForPosition
} from "../src/features/play/wilds-resource-authority";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import { wildsTerrainObstaclesForTile } from "../src/features/play/wilds-terrain-obstacles";

describe("deterministic sparse Wilds resource authority", () => {
  it("keeps living source recovery observable instead of restoring within milliseconds", () => {
    const obstacle = Array.from({ length: 49 }, (_, index) => {
      const x = index % 7 - 3;
      const z = Math.floor(index / 7) - 3;
      return wildsTerrainObstaclesForTile(x, z).find((candidate) => candidate.kind === "tree");
    }).find(Boolean)!;
    const source = projectWildsResourceSourceForObstacle(obstacle);
    assert.ok(source.replenishment.intervalPulses >= 1_000_000);
  });

  it("makes every rendered terrain tree and rock an exact canonical living source", () => {
    let checked = 0;
    for (let tileZ = -4; tileZ <= 4; tileZ += 1) for (let tileX = -4; tileX <= 4; tileX += 1) {
      for (const obstacle of wildsTerrainObstaclesForTile(tileX, tileZ)) {
        if (obstacle.kind !== "tree" && obstacle.kind !== "rock") continue;
        const source = projectWildsResourceSourceForObstacle(obstacle);
        checked += 1;
        assert.equal(source.kind, obstacle.kind === "tree" ? "timber" : "stone");
        assert.equal(source.position.x, obstacle.position.x);
        assert.equal(source.position.z, obstacle.position.z);
        assert.equal(isCanonicalWildsResourceSource(source), true);
        assert.equal(previewWildsHarvest({
          source,
          sourceHead: `head:${source.sourceId}:0`,
          explorerSubjectId: "explorer:one",
          creature: { subjectId: "creature:one", head: "head:creature:one", workFamilies: [source.requirements.creature] },
          tool: { subjectId: "tool:one", head: "head:tool:one", family: source.requirements.tool },
          kaiPulse: "123456",
          admittedHarvestedCapacity: 0,
          physicalEvidence: { sourceId: source.sourceId, protected: false, reachable: true, sourceHead: `head:${source.sourceId}:0` }
        }).valid, true);
      }
    }
    assert.ok(checked > 40);
  });

  it("reconstructs exact sources at ordinary, boundary, negative, and extreme canonical coordinates", () => {
    const positions = [
      { x: 0, z: 0 },
      { x: 127.999999, z: -128 },
      { x: -500_000_000, z: 499_999_999.999999 }
    ];
    for (const position of positions) {
      const region = wildsResourceRegionForPosition(position);
      const first = projectWildsResourceRegion(region.x, region.z);
      const bytes = JSON.stringify(first);
      clearWildsResourceAuthorityCachesForTests();
      const restored = projectWildsResourceRegion(region.x, region.z);
      assert.equal(JSON.stringify(restored), bytes);
      assert.equal(Object.isFrozen(restored), true);
      assert.equal(restored.every((source) => source.regionX === region.x && source.regionZ === region.z), true);
      assert.equal(new Set(restored.map((source) => source.sourceId)).size, restored.length);
    }
  });

  it("keeps region admission bounded and performs zero builds on a warm source reference", () => {
    clearWildsResourceAuthorityCachesForTests();
    const source = projectWildsResourceRegion(4, -9)[0];
    const built = wildsResourceAuthorityDiagnostics().regionsBuilt;
    for (let index = 0; index < 10_000; index += 1) {
      assert.equal(projectWildsResourceRegion(4, -9)[0], source);
    }
    assert.equal(wildsResourceAuthorityDiagnostics().regionsBuilt, built);
    for (let index = 0; index < 140; index += 1) projectWildsResourceRegion(index, -index);
    assert.equal(wildsResourceAuthorityDiagnostics().regionCacheSize <= 96, true);
    assert.throws(() => projectWildsResourceRegion(3_906_250, 0), /region_x_invalid/);
    assert.throws(() => projectWildsResourceRegion(Number.NaN, 0), /region_x_invalid/);
    assert.throws(() => wildsResourceRegionForPosition({ x: Number.NaN, z: 0 }), /position_invalid/);
    assert.throws(() => wildsResourceRegionForPosition({ x: 0, z: Number.POSITIVE_INFINITY }), /position_invalid/);
  });

  it("places every source in a physically compatible terrain habitat", () => {
    for (let regionX = -8; regionX <= 8; regionX += 1) {
      for (let regionZ = -8; regionZ <= 8; regionZ += 1) {
        for (const source of projectWildsResourceRegion(regionX, regionZ)) {
          const surface = sampleWildsTerrain(source.position.x, source.position.z).surface;
          if (source.kind === "aquatic") assert.equal(surface === "shallow-water" || surface === "deep-water", true);
          else assert.equal(surface === "shallow-water" || surface === "deep-water", false);
          if (source.kind === "ore") assert.equal(surface === "rock", true);
        }
      }
    }
  });

  it("produces a deterministic zero-write harvest candidate only for the exact source requirements", () => {
    const source = projectWildsResourceRegion(0, 0)[0];
    const input = {
      source,
      sourceHead: `head:${source.sourceId}:0`,
      explorerSubjectId: "explorer:one",
      creature: { subjectId: "creature:one", head: "head:creature:one", workFamilies: [source.requirements.creature] },
      tool: { subjectId: "tool:one", head: "head:tool:one", family: source.requirements.tool },
      kaiPulse: "123456",
      admittedHarvestedCapacity: 0,
      physicalEvidence: { sourceId: source.sourceId, protected: false, reachable: true, sourceHead: `head:${source.sourceId}:0` }
    } as const;
    const first = previewWildsHarvest(input);
    const second = previewWildsHarvest(input);
    assert.deepEqual(second, first);
    assert.equal(first.valid, true);
    assert.equal(first.physical, false);
    assert.equal(first.publish, "blocked-receiz-v122");
    assert.equal(first.writes, 0);
    assert.equal(first.candidate?.origin.sourceId, source.sourceId);
    assert.equal(first.candidate?.capacity > 0, true);
    assert.deepEqual(first.candidate?.heads, { creature: input.creature.head, tool: input.tool.head });
    const { candidateDigest: _candidateDigest, ...candidateBasis } = first.candidate!;
    assert.equal(first.candidate?.candidateDigest, sha256PortableBasis(canonicalPortableCardJson(candidateBasis)));
    assert.equal("proof" in (first.candidate ?? {}), false);
  });

  it("fails closed for protected, unreachable, exhausted, stale, or unqualified harvests", () => {
    const source = projectWildsResourceRegion(-2, 3)[1];
    const base = {
      source,
      sourceHead: "head:source:current",
      explorerSubjectId: "explorer:one",
      creature: { subjectId: "creature:one", head: "head:creature:one", workFamilies: [source.requirements.creature] },
      tool: { subjectId: "tool:one", head: "head:tool:one", family: source.requirements.tool },
      kaiPulse: "999999",
      admittedHarvestedCapacity: 0,
      physicalEvidence: { sourceId: source.sourceId, protected: false, reachable: true, sourceHead: "head:source:current" }
    } as const;
    const invalid = [
      { ...base, physicalEvidence: { ...base.physicalEvidence, protected: true } },
      { ...base, physicalEvidence: { ...base.physicalEvidence, reachable: false } },
      { ...base, admittedHarvestedCapacity: source.capacity },
      { ...base, physicalEvidence: { ...base.physicalEvidence, sourceHead: "head:stale" } },
      { ...base, creature: { ...base.creature, workFamilies: [] } },
      { ...base, tool: { ...base.tool, family: "wrong-tool" } }
    ];
    for (const candidate of invalid) {
      const preview = previewWildsHarvest(candidate);
      assert.equal(preview.valid, false);
      assert.equal(preview.physical, false);
      assert.equal(preview.writes, 0);
      assert.equal(preview.candidate, null);
    }
    const tampered = { ...source, capacity: source.capacity + 10 };
    assert.equal(previewWildsHarvest({ ...base, source: tampered }).reason, "source-noncanonical");
  });

  it("projects replenishment from integer Kai policy without timers, polling, or loot tables", () => {
    const source = projectWildsResourceRegion(7, 11)[2];
    const before = projectWildsResourceAvailability(source, {
      admittedHarvestedCapacity: source.capacity,
      lastHarvestKaiPulse: "1000",
      currentKaiPulse: String(1000 + source.replenishment.intervalPulses - 1)
    });
    const after = projectWildsResourceAvailability(source, {
      admittedHarvestedCapacity: source.capacity,
      lastHarvestKaiPulse: "1000",
      currentKaiPulse: String(1000 + source.replenishment.intervalPulses)
    });
    assert.equal(before.availableCapacity, 0);
    assert.equal(after.availableCapacity, source.replenishment.capacityPerInterval);
    assert.equal(after.nextChangeKaiPulse, String(1000 + source.replenishment.intervalPulses * 2));
    assert.equal(projectWildsResourceAvailability(source, {
      admittedHarvestedCapacity: source.capacity,
      lastHarvestKaiPulse: "0",
      currentKaiPulse: `1${"0".repeat(76)}`
    }).availableCapacity, source.capacity);
    assert.throws(() => projectWildsResourceAvailability(source, {
      admittedHarvestedCapacity: source.capacity,
      lastHarvestKaiPulse: "0",
      currentKaiPulse: `1${"0".repeat(80)}`
    }), /current_kai_invalid/);
  });
});
