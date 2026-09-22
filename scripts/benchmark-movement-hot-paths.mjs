/** pnpm test first. Optional argument: alternate compiled build directory.
 * Synthetic CPU/allocation benchmark, not a browser frame-time measurement.
 */
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const build = resolve(process.argv[2] ?? '.test-build');
const { createWildsOrderedSpatialIndex } = await import(pathToFileURL(resolve(build, 'src/features/play/wilds-ordered-spatial-index.js')));
const { resolveWildsGroundMovement } = await import(pathToFileURL(resolve(build, 'src/features/play/wilds-grounded-movement.js')));
const records = Array.from({ length: 10000 }, (_, i) => ({
  minX: i % 100 * 4, maxX: i % 100 * 4 + 1,
  minZ: Math.floor(i / 100) * 4, maxZ: Math.floor(i / 100) * 4 + 1
}));
const query = createWildsOrderedSpatialIndex(records, value => value);
function medianPerCall(run) {
  for (let i = 0; i < 2000; i++) run(i);
  const batches = [];
  for (let batch = 0; batch < 15; batch++) {
    const start = performance.now();
    for (let i = 0; i < 2000; i++) run(i);
    batches.push((performance.now() - start) / 2000);
  }
  return batches.sort((a, b) => a - b)[7];
}
const options = { obstacles: [], capabilities: ['swim', 'climb'] };
console.log(JSON.stringify({
  scenario: 'Moving inside a spatial cell; ordinary walking without contacts. Fifteen warmed batches, 2000 calls each.',
  spatialQueryMs: medianPerCall(i => query({ minX: 1 + i % 100 * .1, maxX: 1.76 + i % 100 * .1, minZ: 2, maxZ: 2.76 })),
  groundMovementMs: medianPerCall(i => resolveWildsGroundMovement({ x: i % 100 * .1, z: 2 }, { x: i % 100 * .1 + .04, z: 2 }, options))
}, null, 2));
