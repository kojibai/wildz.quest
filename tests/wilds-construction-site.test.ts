import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeWildsConstructionSite,
  contributeWildsConstructionSite,
  createWildsConstructionSite,
  verifyWildsConstructionSite
} from "../src/features/play/wilds-construction-site";
import {
  createWildsMaterialHarvest,
  initialWildsHarvestedSourceState,
  verifyWildsStructure,
  type WildsMaterialLotV1
} from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion, type WildsResourceSource } from "../src/features/play/wilds-resource-authority";

const OWNER = "player:builder";
const HELPER = "player:helper";
const CREATURE = { subjectId: "creature:builder", head: `sha256:${"a".repeat(64)}` };

function sourceOf(kind: "timber" | "stone") {
  for (let x = -3; x <= 3; x += 1) for (let z = -3; z <= 3; z += 1) {
    const source = projectWildsResourceRegion(x, z).find((candidate) => candidate.kind === kind);
    if (source) return source;
  }
  throw new Error(`missing_${kind}`);
}

function lots(kind: "timber" | "stone", count: number, ownerReceizId: string, firstPulse: number) {
  const source = sourceOf(kind);
  let current = initialWildsHarvestedSourceState(source);
  const output: WildsMaterialLotV1[] = [];
  for (let index = 0; index < count; index += 1) {
    const result = createWildsMaterialHarvest({
      source,
      current,
      ownerReceizId,
      actorPosition: source.position,
      creature: {
        subjectId: `${CREATURE.subjectId}:${ownerReceizId.replaceAll(":", "-")}`,
        head: CREATURE.head,
        workFamilies: [source.requirements.creature],
        willing: true
      },
      kaiUPulse: firstPulse + index
    });
    current = result.source;
    output.push(result.lot);
  }
  return output;
}

function shelter() {
  return createWildsConstructionSite({
    blueprint: "trail-shelter",
    placedByReceizId: OWNER,
    actorPosition: { x: 10, z: 10 },
    position: { x: 12, z: 11 },
    rotationQuarterTurns: 0,
    existingStructures: [],
    existingSites: [],
    kaiUPulse: 1_000_000
  });
}

describe("persistent cooperative construction site proof", () => {
  it("places one deterministic empty site without consuming or issuing anything", () => {
    const first = shelter();
    const second = shelter();
    assert.deepEqual(first, second);
    assert.equal(first.stage, "placed");
    assert.deepEqual(first.materialsRequired, { timber: 2, stone: 1 });
    assert.deepEqual(first.contributedLots, []);
    assert.equal(first.workCompleted, 0);
    assert.equal(first.revision, 0);
    assert.equal(first.parentHead, null);
    assert.equal(first.terminalStructureHead, null);
    assert.equal(verifyWildsConstructionSite(first), true);
  });

  it("reserves exact mixed-owner lots and advances one causal head", () => {
    const placed = shelter();
    const timber = lots("timber", 2, HELPER, 1_000_010);
    const stone = lots("stone", 1, OWNER, 1_000_020);
    const contributed = contributeWildsConstructionSite({
      site: placed,
      contributorReceizId: HELPER,
      lots: timber,
      kaiUPulse: 1_000_030
    });
    const ready = contributeWildsConstructionSite({
      site: contributed,
      contributorReceizId: OWNER,
      lots: stone,
      kaiUPulse: 1_000_031
    });

    assert.equal(contributed.parentHead, placed.head);
    assert.equal(contributed.revision, 1);
    assert.equal(ready.parentHead, contributed.head);
    assert.equal(ready.stage, "materials-ready");
    assert.deepEqual(ready.contributorReceizIds, [OWNER, HELPER]);
    assert.deepEqual(ready.contributedLots.map((lot) => lot.lotId), [...timber, ...stone].map((lot) => lot.lotId).sort());
    assert.equal(verifyWildsConstructionSite(ready), true);
  });

  it("rejects over-contribution and a stale or terminal branch", () => {
    const placed = shelter();
    const timber = lots("timber", 2, OWNER, 1_000_040);
    const stone = lots("stone", 1, OWNER, 1_000_050);
    assert.throws(() => contributeWildsConstructionSite({ site: placed, contributorReceizId: OWNER, lots: [...timber, ...stone, ...lots("stone", 1, OWNER, 1_000_060)], kaiUPulse: 1_000_070 }), /materials_exceed/);
    const ready = contributeWildsConstructionSite({ site: placed, contributorReceizId: OWNER, lots: [...timber, ...stone], kaiUPulse: 1_000_071 });
    const completed = completeWildsConstructionSite({
      site: ready,
      lots: [...timber, ...stone],
      workerReceizId: OWNER,
      creature: CREATURE,
      existingStructures: [],
      kaiUPulse: 1_000_072
    });
    assert.throws(() => contributeWildsConstructionSite({ site: completed.site, contributorReceizId: OWNER, lots: [], kaiUPulse: 1_000_073 }), /terminal/);
    assert.throws(() => completeWildsConstructionSite({ site: ready, expectedSiteHead: placed.head, lots: [...timber, ...stone], workerReceizId: OWNER, creature: CREATURE, existingStructures: [], kaiUPulse: 1_000_074 }), /stale/);
  });

  it("completes into one verified structure preserving every exact lot and contributor", () => {
    const placed = shelter();
    const timber = lots("timber", 2, HELPER, 1_000_080);
    const stone = lots("stone", 1, OWNER, 1_000_090);
    const ready = contributeWildsConstructionSite({ site: placed, contributorReceizId: HELPER, lots: timber, kaiUPulse: 1_000_100 });
    const funded = contributeWildsConstructionSite({ site: ready, contributorReceizId: OWNER, lots: stone, kaiUPulse: 1_000_101 });
    const completed = completeWildsConstructionSite({
      site: funded,
      expectedSiteHead: funded.head,
      lots: [...timber, ...stone],
      workerReceizId: HELPER,
      creature: CREATURE,
      existingStructures: [],
      kaiUPulse: 1_000_102
    });

    assert.equal(completed.site.stage, "complete");
    assert.equal(completed.site.workCompleted, 1);
    assert.equal(completed.site.terminalStructureId, completed.structure.structureId);
    assert.equal(completed.site.terminalStructureHead, completed.structure.head);
    assert.equal(verifyWildsConstructionSite(completed.site), true);
    assert.equal(verifyWildsStructure(completed.structure), true);
    assert.deepEqual(completed.structure.consumedLotIds, [...timber, ...stone].map((lot) => lot.lotId).sort());
    assert.deepEqual(completed.structure.materialContributorReceizIds, [OWNER, HELPER]);
  });
});
