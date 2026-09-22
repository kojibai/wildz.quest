import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsResourcePlacementProjector } from "../src/features/play/wilds-resource-placements";
import { projectWildsObstaclePlacement, wildsTerrainObstaclesForTile } from "../src/features/play/wilds-terrain-obstacles";
import { projectWildsResourcePresentationAvailability, projectWildsResourceSourceForObstacle } from "../src/features/play/wilds-resource-authority";
import { projectWildsResourceBody, type WildsActiveWorkSource } from "../src/features/play/wilds-work-presentation";
import type { WildsWorldProjection } from "../src/features/play/wilds-world-state";

const obstacles = Array.from({ length: 25 }, (_, index) => wildsTerrainObstaclesForTile(index % 5 - 2, Math.floor(index / 5) - 2)).flat();

describe("retained resource rendering", () => {
  it("retains all transform arrays across unchanged clock ticks and cloned snapshots", () => {
    const project = createWildsResourcePlacementProjector();
    const first = project(obstacles, {}, 0, null);
    assert.ok(first.trees.length && first.rocks.length);
    for (let pulse = 1; pulse <= 100; pulse++) {
      const next = project(obstacles, {}, pulse * 1_000_000, null);
      assert.equal(next.trees, first.trees);
      assert.equal(next.rocks, first.rocks);
    }
  });

  it("matches uncached transforms through harvest, pending clocks, regrowth and work restarts", () => {
    const project = createWildsResourcePlacementProjector();
    const tree = obstacles.find(obstacle => obstacle.kind === "tree")!;
    const source = projectWildsResourceSourceForObstacle(tree);
    const harvested = { [source.sourceId]: { harvestedCapacity: source.capacity, lastHarvestKaiPulse: "1000000" } } as WildsWorldProjection["harvestedSources"];
    const work: WildsActiveWorkSource = { sourceId: source.sourceId, kind: "timber", position: source.position, startedAtMs: 10, settledAtMs: null };
    const pristine = project(obstacles, {}, 0, null);
    for (const pulse of [0, 1_000_000, 1_000_000 + source.replenishment.intervalPulses, 1_000_000 + source.replenishment.intervalPulses * source.capacity]) {
      for (const activeWork of [null, work, { ...work, startedAtMs: 20 }]) {
        const actual = project(obstacles, harvested, pulse, activeWork);
        const expected = obstacles.filter(obstacle => obstacle.kind === "tree").map(obstacle => {
          const resource = projectWildsResourceSourceForObstacle(obstacle);
          const state = harvested[resource.sourceId];
          const availability = projectWildsResourcePresentationAvailability(resource, { admittedHarvestedCapacity: state?.harvestedCapacity ?? 0, lastHarvestKaiPulse: state?.lastHarvestKaiPulse ?? "0", currentKaiPulse: String(pulse) });
          const working = activeWork?.sourceId === resource.sourceId;
          return { ...projectWildsObstaclePlacement(obstacle), resourceBody: projectWildsResourceBody({ kind: "timber", capacity: resource.capacity, availableCapacity: availability.availableCapacity }), working, workStartedAtMs: working ? activeWork.startedAtMs : undefined };
        });
        assert.deepEqual(actual.trees, expected);
        assert.equal(actual.rocks, pristine.rocks);
      }
    }
    assert.deepEqual(project([], {}, 0, null), { trees: [], rocks: [] });
    assert.deepEqual(project(obstacles, {}, 0, null), pristine);
  });
});
