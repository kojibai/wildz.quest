import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsConstructionSite, contributeWildsConstructionSite } from "../src/features/play/wilds-construction-site";
import { createWildsWorldEvent } from "../src/features/play/wilds-world-event";
import { checkpointWildsWorld, initialWildsWorldProjection, reduceWildsWorldEvent, replayWildsWorld, type WildsWorldCheckpoint } from "../src/features/play/wilds-world-state";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState, type WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";

const TIME = "2026-08-25T12:00:00.000Z";
const OWNER = "player:builder";
const HELPER = "player:helper";

function lot(kind: "timber" | "stone", ownerReceizId: string, kaiUPulse: number): WildsMaterialLotV1 {
  const source = [-2, -1, 0, 1, 2].flatMap((x) => [-2, -1, 0, 1, 2].flatMap((z) => projectWildsResourceRegion(x, z)))
    .find((candidate) => candidate.kind === kind)!;
  return createWildsMaterialHarvest({
    source,
    current: initialWildsHarvestedSourceState(source),
    ownerReceizId,
    actorPosition: source.position,
    creature: { subjectId: `creature:${ownerReceizId.replaceAll(":", "-")}`, head: `sha256:${"a".repeat(64)}`, workFamilies: [source.requirements.creature], willing: true },
    kaiUPulse
  }).lot;
}

function event(kind: "construction.site_placed" | "construction.site_contributed", actorId: string, payload: unknown, previousEventId: string | null, uPulse: number) {
  return createWildsWorldEvent({ kind, actorId, causeId: `command:${uPulse}`, pulse: TIME, occurredAt: TIME, kaiKlok: uPulse, uPulse, previousEventId, payload });
}

describe("construction site world projection", () => {
  it("places without reserving materials then reserves an exact contributed lot once", () => {
    const timber = lot("timber", HELPER, 2_000_001);
    const site = createWildsConstructionSite({ blueprint: "trail-shelter", placedByReceizId: OWNER, actorPosition: { x: 10, z: 10 }, position: { x: 12, z: 11 }, rotationQuarterTurns: 0, existingStructures: [], existingSites: [], kaiUPulse: 2_000_010 });
    const placedEvent = event("construction.site_placed", OWNER, { site }, null, 2_000_010);
    const seeded = { ...initialWildsWorldProjection(), materialLots: { [timber.lotId]: timber } };
    const placed = reduceWildsWorldEvent(seeded, placedEvent);
    assert.equal(placed.constructionSites[site.siteId]?.head, site.head);
    assert.deepEqual(placed.reservedMaterialLots, {});

    const nextSite = contributeWildsConstructionSite({ site, contributorReceizId: HELPER, lots: [timber], kaiUPulse: 2_000_011 });
    const contributionEvent = event("construction.site_contributed", HELPER, { site: nextSite }, placedEvent.eventId, 2_000_011);
    const contributed = reduceWildsWorldEvent(placed, contributionEvent);
    assert.equal(contributed.constructionSites[site.siteId]?.head, nextSite.head);
    assert.equal(contributed.reservedMaterialLots[timber.lotId], site.siteId);
    assert.throws(() => reduceWildsWorldEvent({ ...placed, consumedMaterialLots: { [timber.lotId]: "other" } }, contributionEvent), /material_invalid/);
  });

  it("hydrates exact legacy V3 checkpoints with empty construction maps", () => {
    const checkpoint = checkpointWildsWorld(initialWildsWorldProjection());
    const legacyProjection = { ...checkpoint.projection } as Partial<typeof checkpoint.projection>;
    delete legacyProjection.constructionSites;
    delete legacyProjection.reservedMaterialLots;
    const legacy = {
      ...checkpoint,
      projection: legacyProjection,
      projectionDigest: sha256PortableBasis(canonicalPortableCardJson(legacyProjection))
    } as unknown as WildsWorldCheckpoint;
    const restored = replayWildsWorld([], legacy);
    assert.deepEqual(restored.constructionSites, {});
    assert.deepEqual(restored.reservedMaterialLots, {});
  });
});
