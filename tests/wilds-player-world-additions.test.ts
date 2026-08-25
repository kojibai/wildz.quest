import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsConstructionSite } from "../src/features/play/wilds-construction-site.js";
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
    structures: {}
  });

  assert.equal(restored.constructionSites[mine.siteId]?.head, mine.head);
  assert.equal(restored.revision, world.revision);
});
