import { createWildsConstructionProject, createWildsConstructionChunk, appendWildsConstructionProjectChunk } from "../src/features/play/wilds-construction-project.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createOwnerBoundInitialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state.js";
import { createWildsConstructionSite } from "../src/features/play/wilds-construction-site.js";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority.js";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction.js";
import {
  mergeWildsOwnedWorldAdditions,
  mergeWildsOwnedAdditionSets,
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


test("V10 owned additions retain continuous owner projects and exact source chunks", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "builder", name: "Home", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const chunk = createWildsConstructionChunk({ project, kaiUPulse: 1 });
  const linked = appendWildsConstructionProjectChunk({ project, chunk, kaiUPulse: 2 });
  const world = { ...initialWildsWorldProjection(), constructionProjects: { [project.projectId]: linked }, constructionChunks: { [chunk.chunkId]: chunk } };
  const owned = projectWildsOwnedWorldAdditions(world, "builder");
  const restored = mergeWildsOwnedWorldAdditions(initialWildsWorldProjection(), owned);
  assert.deepEqual(restored.constructionProjects, world.constructionProjects);
  assert.deepEqual(restored.constructionChunks, world.constructionChunks);
});

test("portable saves retain exact owner construction sources and exclude unrelated foreign projects", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "builder", name: "Home", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const chunk = createWildsConstructionChunk({ project, kaiUPulse: 1 });
  const linked = appendWildsConstructionProjectChunk({ project, chunk, kaiUPulse: 2 });
  const foreign = createWildsConstructionProject({ ownerReceizId: "neighbor", name: "Elsewhere", region: { x: 1, z: 0 }, kaiUPulse: 1 });
  const world = { ...initialWildsWorldProjection(), constructionProjects: { [project.projectId]: linked, [foreign.projectId]: foreign }, constructionChunks: { [chunk.chunkId]: chunk } };
  const owned = projectWildsOwnedWorldAdditions(world, "builder");
  const saved = { ...createOwnerBoundInitialPlayState("builder"), ownedWorldAdditions: owned };
  const restored = mergeWildsOwnedWorldAdditions(initialWildsWorldProjection(), restorePlayState(serializePlayState(saved), "builder").ownedWorldAdditions);
  assert.deepEqual(restored.constructionProjects, { [project.projectId]: linked });
  assert.deepEqual(restored.constructionChunks, { [chunk.chunkId]: chunk });
  assert.deepEqual(restored.materialLots, {});
});

test("owned-set merges preserve compatible construction history in either order", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "builder", name: "Home", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const chunk = createWildsConstructionChunk({ project, kaiUPulse: 1 });
  const linked = appendWildsConstructionProjectChunk({ project, chunk, kaiUPulse: 2 });
  const empty = projectWildsOwnedWorldAdditions(initialWildsWorldProjection(), "builder");
  const older = { ...empty, constructionProjects: { [project.projectId]: project } };
  const newer = { ...empty, constructionProjects: { [project.projectId]: linked }, constructionChunks: { [chunk.chunkId]: chunk } };
  for (const owned of [mergeWildsOwnedAdditionSets(older, newer), mergeWildsOwnedAdditionSets(newer, older)]) {
    const restored = mergeWildsOwnedWorldAdditions(initialWildsWorldProjection(), owned);
    assert.deepEqual(restored.constructionProjects, newer.constructionProjects);
    assert.deepEqual(restored.constructionChunks, newer.constructionChunks);
  }
});

test("refresh keeps the local construction fork and preserves the remote source through save restore", () => {
  const project = createWildsConstructionProject({ ownerReceizId: "builder", name: "Home", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const chunk = createWildsConstructionChunk({ project, kaiUPulse: 1 });
  const localProject = appendWildsConstructionProjectChunk({ project, chunk, kaiUPulse: 2 });
  const remoteProject = appendWildsConstructionProjectChunk({ project, chunk, kaiUPulse: 3 });
  const base = initialWildsWorldProjection();
  const local = { ...projectWildsOwnedWorldAdditions(base, "builder"), constructionProjects: { [project.projectId]: localProject }, constructionChunks: { [chunk.chunkId]: chunk } };
  const merged = mergeWildsOwnedWorldAdditions({ ...base, constructionProjects: { [project.projectId]: remoteProject } }, local);
  assert.deepEqual(merged.constructionProjects[project.projectId], localProject);
  const state = { ...createOwnerBoundInitialPlayState("builder"), ownedWorldAdditions: projectWildsOwnedWorldAdditions(merged, "builder") };
  const restored = mergeWildsOwnedWorldAdditions(base, restorePlayState(serializePlayState(state), "builder").ownedWorldAdditions);
  assert.deepEqual(restored.constructionProjects[project.projectId], localProject);
  assert.deepEqual(restored.constructionRecoverySources?.[remoteProject.head], remoteProject);
});
