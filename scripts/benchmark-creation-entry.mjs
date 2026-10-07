/** pnpm test first. Synthetic CPU timings, not browser FPS. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { creationDefinitionFixture, creationContextFixture } from '../.test-build/tests/support/creation-fixtures.js';
import { compileCreation } from '../.test-build/src/features/play/creation/compiler.js';
import { createCreationInstance, sealCreationInstance } from '../.test-build/src/features/play/creation/instance.js';
import { initializeCreationComponents } from '../.test-build/src/features/play/creation/components.js';
import { createCreationCurrentSourcePort } from '../.test-build/src/features/play/creation/current-source.js';
import { createCreationPhysicalStore } from '../.test-build/src/features/play/creation/physical-store.js';
import { projectCreationPhysical } from '../.test-build/src/features/play/creation/projection.js';
import { selectCreationBedAtPlayer } from '../.test-build/src/features/play/creation/bed.js';

const base = creationDefinitionFixture().nodes[0];
const definition = creationDefinitionFixture({ nodes: [base,
  { ...base, id: 'bed', parentId: 'room', supports: ['room'], pose: { position: { x: -1.2, y: .15, z: .8 }, yaw: 0 }, shape: { kind: 'box', width: .9, height: .2, depth: 2 }, behaviors: [{ id: 'bed', version: 1, parameters: {} }] },
  ...Array.from({ length: 126 }, (_, i) => ({ ...base, id: `detail:${i}`, parentId: 'room', supports: ['room'], pose: { position: { x: 1.5, y: .2 + i * .01, z: 1 }, yaw: 0 }, shape: { kind: 'box', width: .05, height: .01, depth: .05 } }))
] });
const context = creationContextFixture(), compiled = compileCreation(definition, context);
assert.equal(compiled.status, 'ready');
const initial = createCreationInstance({ instanceId: 'benchmark:home', definition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: context.pose, kaiUPulse: 1 });
const { head, ...basis } = initial; void head;
const instance = sealCreationInstance({ ...basis, stage: 'functional', nodeStates: initializeCreationComponents(definition, 1) });
const port = createCreationCurrentSourcePort({ read: async () => ({ status: 'available', instance, definition, planDigest: compiled.plan.digest, source: { fixtureOnly: true } }), authenticateCurrent: async () => true });
const store = createCreationPhysicalStore({ project: async (i, d, p) => projectCreationPhysical(i, d, p) });
const source = await port.read({ instanceId: instance.instanceId, worldId: 'wildz', spaceId: 'surface' });
assert.equal(source.status, 'available');
assert.equal(await store.adoptCurrent(source, compiled.plan), true);
const space = { spaceId: 'surface', position: { y: .15 } };
function measure(player, expected) {
  const times = [];
  for (let sample = 0; sample < 15; sample++) {
    const start = performance.now();
    for (let i = 0; i < 100; i++) assert.equal(!!selectCreationBedAtPlayer(store.snapshot, player, space, 'owner', 2 + i), expected);
    times.push((performance.now() - start) / 100);
  }
  times.sort((a, b) => a - b);
  return { medianMs: times[7], p95Ms: times[14] };
}
console.log(JSON.stringify({ nodes: definition.nodes.length, approachingDoor: measure({ x: 0, z: -2.5 }, false), besideBed: measure({ x: -1.2, z: .8 }, true) }, null, 2));
