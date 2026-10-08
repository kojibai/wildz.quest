import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createWildsConstructionProject } from '../.test-build/src/features/play/wilds-construction-project.js';
import { createWildsConstructionComponent } from '../.test-build/src/features/play/wilds-construction-component.js';
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from '../.test-build/src/features/play/wilds-world-construction.js';
import { createWildsSourceAuthorityProjection, replanQueuedWildsMaterialHarvest } from '../.test-build/src/features/play/wilds-source-work-authority.js';
import { projectWildsResourceRegion } from '../.test-build/src/features/play/wilds-resource-authority.js';
import { prepareAndPersistWildsWorldOutboxEntry } from '../.test-build/src/features/play/wilds-world-outbox.js';
import { withWildsWorldCommandKai } from '../.test-build/src/features/play/wilds-world-authority.js';
import { createKaiTemporalRoot } from '../.test-build/src/features/play/kai-temporal-root.js';
import { deriveKaiKlokMomentFromUPulse } from '../.test-build/src/features/play/kai-klok-moment.js';
import { prepareReceivedWildsWorldProofs } from '../.test-build/src/features/play/wilds-received-proof-immutability.js';
import { cloneWildsWorldWorkerInput, encodeWildsWorldWorkerResult, decodeWildsWorldWorkerResult } from '../.test-build/src/features/play/wilds-world-worker-transfer.js';

const actorId = 'global_keeper.receiz.id', kaiUPulse = 2000010;
const project = createWildsConstructionProject({ ownerReceizId: actorId, name: 'Transfer benchmark', region: { x: 0, z: 0 }, kaiUPulse: 1 });
const evidence = { sourceBlueprint: createWildsBlueprintPreview('blueprint:transfer', 'wildz.excavation.region.v1:0:0'), pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0, physical: { terrainY: 0, waterline: null, anchors: [], solids: [] } };
const placement = previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: 'foundation', ...evidence });
const components = Array.from({ length: 1000 }, (_, i) => createWildsConstructionComponent({ project, evidence, placement, ownerReceizId: actorId, kaiUPulse: 2, commandId: `transfer:${i}` }));
const base = { ...createWildsSourceAuthorityProjection(), constructionProjects: { [project.projectId]: project }, constructionComponents: Object.fromEntries(components.map(row => [row.componentId, row])) };
await prepareReceivedWildsWorldProofs(base);
const source = projectWildsResourceRegion(0, 0).find(row => row.kind === 'timber');
assert.ok(source);
const command = withWildsWorldCommandKai(replanQueuedWildsMaterialHarvest({ projection: base, source, actorId, actorPosition: source.position, kaiUPulse, commandId: 'command:transfer:harvest' }), createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: kaiUPulse, authority: 'local' })));
const work = { kind: 'prepare-persist', base, entry: { schema: 'receiz.wilds_world_outbox_entry.v1', actorId, guestId: 'guest-transfer-benchmark', command, queuedAt: '2026-10-07T23:00:00.000Z' } };
const samples = { before: [], after: [] };
const replyBytes = {};
let expected;
for (let sample = 0; sample < 6; sample++) for (const mode of ['before', 'after']) {
  const started = performance.now();
  const exact = mode === 'before' ? structuredClone(work) : cloneWildsWorldWorkerInput(work);
  const sent = structuredClone(exact); // Simulates the native postMessage boundary.
  const result = await prepareAndPersistWildsWorldOutboxEntry(sent.base, sent.entry, undefined, async () => {});
  const wire = mode === 'before' ? result : encodeWildsWorldWorkerResult(sent, result);
  const received = structuredClone(wire);
  const decoded = mode === 'before' ? received : decodeWildsWorldWorkerResult(exact, received);
  await prepareReceivedWildsWorldProofs(decoded.projection);
  const elapsed = performance.now() - started;
  expected ??= decoded;
  assert.deepEqual(decoded, expected, 'transport optimization must preserve the exact accepted result');
  if (sample > 0) samples[mode].push(elapsed);
  replyBytes[mode] = Buffer.byteLength(JSON.stringify(wire));
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
process.stdout.write(JSON.stringify({ components: components.length, samples: 5, medianMs: Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, median(values)])), replyBytes, note: 'Synthetic local worker handoff plus actual source execution and received-proof preparation. postMessage boundaries use structuredClone; persistence is a no-op. Excludes browser/GPU/iPhone scheduling, real worker transit and IndexedDB latency. Every accepted output is deep-equal.' }, null, 2) + '\n');
