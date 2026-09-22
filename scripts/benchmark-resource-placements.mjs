/** Run after pnpm test. Synthetic CPU measurements, not browser frame timings. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const compiled = resolve(process.argv[2] ?? ".test-build", "src/features/play");
const load = name => import(pathToFileURL(resolve(compiled, `${name}.js`)).href);
const { createWildsResourcePlacementProjector } = await load("wilds-resource-placements");
const { wildsTerrainObstaclesForTile, projectWildsObstaclePlacement } = await load("wilds-terrain-obstacles");
const { projectWildsResourcePresentationAvailability, projectWildsResourceSourceForObstacle } = await load("wilds-resource-authority");
const { projectWildsResourceBody } = await load("wilds-work-presentation");
const obstacles = Array.from({ length: 25 }, (_, i) => wildsTerrainObstaclesForTile(i % 5 - 2, Math.floor(i / 5) - 2)).flat();
function original(pulse) {
  const placement = obstacle => {
    const source = projectWildsResourceSourceForObstacle(obstacle);
    const { availableCapacity } = projectWildsResourcePresentationAvailability(source, { admittedHarvestedCapacity: 0, lastHarvestKaiPulse: "0", currentKaiPulse: String(pulse) });
    return { ...projectWildsObstaclePlacement(obstacle), resourceBody: projectWildsResourceBody({ kind: source.kind === "timber" ? "timber" : "stone", capacity: source.capacity, availableCapacity }), working: false, workStartedAtMs: undefined };
  };
  return { trees: obstacles.filter(o => o.kind === "tree").map(placement), rocks: obstacles.filter(o => o.kind === "rock").map(placement) };
}
const project = createWildsResourcePlacementProjector();
const retained = pulse => project(obstacles, {}, pulse, null);
assert.deepEqual(retained(0), original(0));
function measure(run) {
  let previous = run(0), matrixWrites = 0;
  const samples = [];
  for (let i = 1; i <= 1000; i++) {
    const start = performance.now();
    const next = run(i * 1_000_000);
    samples.push(performance.now() - start);
    if (previous.trees !== next.trees) matrixWrites += next.trees.length * 4;
    if (previous.rocks !== next.rocks) matrixWrites += next.rocks.length;
    previous = next;
  }
  samples.sort((a, b) => a - b);
  return { medianMs: samples[500], p95Ms: samples[950], instanceMatrixWritesTriggered: matrixWrites };
}
console.log(JSON.stringify({ scenario: "1000 unchanged Kai snapshots over a 5x5 terrain neighborhood", trees: retained(0).trees.length, rocks: retained(0).rocks.length, original: measure(original), retained: measure(retained) }, null, 2));
