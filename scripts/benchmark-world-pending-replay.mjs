/** Run after compiling tests: node scripts/benchmark-world-pending-replay.mjs */
import assert from 'node:assert/strict';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { performWildsWorldWork } from '../.test-build/src/features/play/wilds-world-work.js';
import { createWildsWorldWorkerClient } from '../.test-build/src/features/play/wilds-world-work-client.js';
import { projectWildsWorldOutbox } from '../.test-build/src/features/play/wilds-world-outbox.js';
import { checkpointWildsWorld, initialWildsWorldProjection } from '../.test-build/src/features/play/wilds-world-state.js';
import { WildsWorldService } from '../.test-build/src/features/play/wilds-world-service.js';
import { createWildsConstructionProject } from '../.test-build/src/features/play/wilds-construction-project.js';

if (!isMainThread) {
  parentPort.on('message', async ({ id, work }) => {
    try { parentPort.postMessage({ id, ok: true, value: await performWildsWorldWork(work) }); }
    catch (error) { parentPort.postMessage({ id, ok: false, error: error.message }); }
  });
} else {
  const actorId = 'global_keeper.receiz.id';
  const base = initialWildsWorldProjection();
  for (let index = 0; index < 600; index++) {
    const project = createWildsConstructionProject({ ownerReceizId: actorId, name: `Existing ${index}`, region: { x: index, z: 0 }, kaiUPulse: index + 1 });
    base.constructionProjects[project.projectId] = project;
  }
  const entries = Array.from({ length: 10 }, (_, index) => ({ schema: 'receiz.wilds_world_outbox_entry.v1', actorId,
    guestId: 'guest-benchmark', queuedAt: '2026-07-19T12:00:00.000Z',
    command: { type: 'construction.project.create', commandId: `command:bench:${index}`, name: `Pending ${index}`, region: { x: 0, z: 0 } } }));
  const client = createWildsWorldWorkerClient(() => {
    const worker = new Worker(new URL(import.meta.url));
    const port = { onmessage: null, onerror: null, postMessage: message => worker.postMessage(message), terminate: () => void worker.terminate() };
    worker.on('message', data => port.onmessage?.({ data }));
    worker.on('error', error => port.onerror?.({ message: error.message }));
    return port;
  });
  const fallback = createWildsWorldWorkerClient(() => { throw Error('benchmark worker unavailable'); });
  async function measure(name, action) {
    let ticks = 0, maxGap = 0, last = performance.now();
    const timer = setInterval(() => { const now = performance.now(); ticks++; maxGap = Math.max(maxGap, now - last); last = now; }, 0);
    const start = performance.now();
    try {
      const result = await action();
      const end = performance.now(); maxGap = Math.max(maxGap, end - last);
      console.log(JSON.stringify({ name, elapsedMs: +(end - start).toFixed(2), heartbeatTicks: ticks, maxHeartbeatGapMs: +maxGap.toFixed(2) }));
      return result;
    } finally { clearInterval(timer); }
  }
  try {
    // Exact pre-change path: synthesize and reverify a checkpoint for each
    // command. This fixture contains no imported admitted-source envelopes.
    const before = await measure('previous synchronous replay with checkpoint roundtrip', () => entries.reduce((projection, entry) =>
      new WildsWorldService({ checkpoint: checkpointWildsWorld(projection) }).execute(entry.command, {
        actorId, canonical: true, pulse: entry.queuedAt, occurredAt: entry.queuedAt
      }).projection, base));
    const direct = await measure('local projection replay without redundant checkpoint hashes', () => projectWildsWorldOutbox(base, actorId, entries));
    assert.deepEqual(direct, before);
    const after = await measure('worker refresh replay including transfer and proof preparation', () => client.run({ kind: 'project', base, actorId, entries }));
    assert.deepEqual(after, before);
    const recovered = await measure('cooperative worker-unavailable fallback', () => fallback.run({ kind: 'project', base, actorId, entries }));
    assert.deepEqual(recovered, before);
    assert.equal(Object.keys(base.constructionProjects).length, 600);
  } finally { client.close(); fallback.close(); }
}
