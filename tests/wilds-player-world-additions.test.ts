import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsConstructionSite } from "../src/features/play/wilds-construction-site.js";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority.js";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction.js";
import {
  mergeWildsOwnedWorldAdditions,
  projectWildsOwnedWorldAdditions
} from "../src/features/play/wilds-player-world-additions.js";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state.js";

function site(owner: string, x: number, kaiUPulse: number) {
  return createWildsConstructionSite({
    blueprint: "trail-shelter",
    placedByReceizId: owner,
    actorPosition: { x, z: 10 },
    position: { x: x + 2, z: 11 },
    rotationQuarterTurns: 0,
    existingStructures: [],
    existingSites: [],
    kaiUPulse
  });
}

test("projects only the verified proof objects owned by the active Receiz ID", () => {
  const mine = site("builder.receiz.id", 10, 2_000_010);
  const theirs = site("neighbor.receiz.id", 30, 2_000_011);
  const world = initialWildsWorldProjection();
  world.constructionSites = { [theirs.siteId]: theirs, [mine.siteId]: mine };

  const owned = projectWildsOwnedWorldAdditions(world, "builder");

  assert.deepEqual(Object.keys(owned.constructionSites), [mine.siteId]);
  assert.deepEqual(owned.structures, {});
});

test("a saved source-owned shelter fills a missing global projection after refresh", () => {
  const mine = site("builder", 10, 2_000_010);
  const world = initialWildsWorldProjection();

  const restored = mergeWildsOwnedWorldAdditions(world, {
    constructionSites: { [mine.siteId]: mine },
    structures: {}, harvestedSources: {}, materialLots: {}, consumedMaterialLots: {}, reservedMaterialLots: {}, storedMaterialLots: {}
  });

  assert.equal(restored.constructionSites[mine.siteId]?.head, mine.head);
  assert.equal(restored.revision, world.revision);
});

test("sealed timber and stone holdings survive a missing global projection after refresh", () => {
  const ownerReceizId = "builder.receiz.id";
  const sources = Array.from({ length: 25 }, (_, index) => projectWildsResourceRegion(index - 12, 0)).flat();
  const timberSource = sources.find((source) => source.kind === "timber");
  const stoneSource = sources.find((source) => source.kind === "stone");
  assert.ok(timberSource);
  assert.ok(stoneSource);
  const timber = createWildsMaterialHarvest({
    source: timberSource,
    current: initialWildsHarvestedSourceState(timberSource),
    ownerReceizId,
    actorPosition: timberSource.position,
    kaiUPulse: 2_000_020
  });
  const stone = createWildsMaterialHarvest({
    source: stoneSource,
    current: initialWildsHarvestedSourceState(stoneSource),
    ownerReceizId,
    actorPosition: stoneSource.position,
    kaiUPulse: 2_000_021
  });
  const admitted = initialWildsWorldProjection();
  admitted.materialLots = { [timber.lot.lotId]: timber.lot, [stone.lot.lotId]: stone.lot };
  admitted.harvestedSources = { [timber.source.sourceId]: timber.source, [stone.source.sourceId]: stone.source };

  const sealed = projectWildsOwnedWorldAdditions(admitted, ownerReceizId);
  const restored = mergeWildsOwnedWorldAdditions(initialWildsWorldProjection(), sealed);

  assert.deepEqual(Object.keys(restored.materialLots).sort(), [stone.lot.lotId, timber.lot.lotId].sort());
  assert.equal(restored.harvestedSources[timber.source.sourceId]?.head, timber.source.head);
  assert.equal(restored.harvestedSources[stone.source.sourceId]?.head, stone.source.head);
});

test("sealed material lifecycle state cannot be rolled back by a stale projection", () => {
  const ownerReceizId = "builder.receiz.id";
  const source = Array.from({ length: 25 }, (_, index) => projectWildsResourceRegion(index - 12, 0)).flat()
    .find((candidate) => candidate.kind === "timber");
  assert.ok(source);
  const harvest = createWildsMaterialHarvest({
    source,
    current: initialWildsHarvestedSourceState(source),
    ownerReceizId,
    actorPosition: source.position,
    kaiUPulse: 2_000_030
  });
  const world = initialWildsWorldProjection();
  world.materialLots = { [harvest.lot.lotId]: harvest.lot };
  world.reservedMaterialLots = { [harvest.lot.lotId]: "site:stale" };
  const sealed = projectWildsOwnedWorldAdditions({
    ...world,
    reservedMaterialLots: {},
    consumedMaterialLots: { [harvest.lot.lotId]: "structure:complete" }
  }, ownerReceizId);

  const restored = mergeWildsOwnedWorldAdditions(world, sealed);

  assert.equal(restored.consumedMaterialLots[harvest.lot.lotId], "structure:complete");
  assert.equal(restored.reservedMaterialLots[harvest.lot.lotId], undefined);
});
