import assert from 'node:assert/strict';
import { test } from 'node:test';
import { performWildsWorldWork } from '../src/features/play/wilds-world-work';
import { createWildsWorldWorkerClient } from '../src/features/play/wilds-world-work-client';
import { projectWildsWorldOutbox, type WildsWorldOutboxEntry } from '../src/features/play/wilds-world-outbox';
import { initialWildsWorldProjection } from '../src/features/play/wilds-world-state';

const actorId = 'global_keeper.receiz.id';
function entry(id: string, owner = actorId): WildsWorldOutboxEntry {
  return { schema: 'receiz.wilds_world_outbox_entry.v1', actorId: owner, guestId: 'guest-12345678',
    command: { type: 'construction.project.create', name: id, region: { x: 0, z: 0 }, commandId: `command:project:${id}` },
    queuedAt: '2026-07-19T12:00:00.000Z' };
}

test('worker pending projection retains exact order, duplicates, and actor filtering without mutating its base', async () => {
  const base = initialWildsWorldProjection();
  const entries = [entry('first'), entry('other', 'other.receiz.id'), entry('first'), entry('second')];
  const result = await performWildsWorldWork({ kind: 'project', base, actorId, entries });
  assert.deepEqual(result, projectWildsWorldOutbox(base, actorId, entries));
  assert.equal(result.revision, 2);
  assert.deepEqual(Object.values(result.constructionProjects).map(project => project.name), ['first', 'second']);
  assert.equal(base.revision, 0);
});

test('missing worker cooperatively projects pending work using exact existing replay law', async () => {
  const client = createWildsWorldWorkerClient(() => { throw Error('worker unavailable'); });
  const base = initialWildsWorldProjection(), entries = Array.from({ length: 12 }, (_, index) => entry(`fallback-${index}`));
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 0);
  try {
    const actual = await client.run({ kind: 'project', base, actorId, entries });
    assert.deepEqual(actual, projectWildsWorldOutbox(base, actorId, entries));
    assert.ok(ticks > 0, 'render tasks can run while fallback projection is pending');
    assert.equal(base.revision, 0);
  } finally { clearInterval(timer); client.close(); }
});

test('closing a pending worker projection rejects it and ignores a late response', async () => {
  type Port = ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;
  let id = 0;
  const port: Port = { onmessage: null, onerror: null, postMessage(message) { id = message.id; }, terminate() {} };
  const client = createWildsWorldWorkerClient(() => port);
  const base = initialWildsWorldProjection(), entries = [entry('close')];
  const pending = client.run({ kind: 'project', base, actorId, entries });
  const rejected = assert.rejects(pending, /wilds_world_worker_interrupted/);
  const late = port.onmessage!;
  client.close();
  late({ data: { id, ok: true, value: projectWildsWorldOutbox(base, actorId, entries) } } as MessageEvent);
  await rejected;
});

test('a live admission completed during pending projection cannot be replaced by the older result', async () => {
  const { reconcileWildsWorldOutboxProjection } = await import('../src/features/play/wilds-world-outbox');
  const base = initialWildsWorldProjection();
  let current = base, finish!: (value: typeof base) => void, adoptions = 0;
  const older = projectWildsWorldOutbox(base, actorId, [entry('older')]);
  const live = projectWildsWorldOutbox(base, actorId, [entry('live')]);
  const pending = reconcileWildsWorldOutboxProjection({ base, actorId, entries: [entry('older')],
    current: () => current, project: () => new Promise(resolve => { finish = resolve; }),
    adopt: value => { adoptions++; current = value; return value; } });
  current = live; finish(older);
  assert.equal(await pending, live);
  assert.equal(adoptions, 0);
  assert.equal(Object.values(current.constructionProjects)[0]?.name, 'live');
});

test('unchanged live state adopts the exact projected result and cancellation never adopts', async () => {
  const { reconcileWildsWorldOutboxProjection } = await import('../src/features/play/wilds-world-outbox');
  const base = initialWildsWorldProjection(), projected = projectWildsWorldOutbox(base, actorId, [entry('ready')]);
  let adoptions = 0;
  const input = { base, actorId, entries: [entry('ready')], current: () => base,
    project: async () => projected, adopt: (value: typeof base) => { adoptions++; return value; } };
  assert.equal(await reconcileWildsWorldOutboxProjection(input), projected);
  assert.equal(adoptions, 1);
  await assert.rejects(reconcileWildsWorldOutboxProjection({ ...input, cancelled: () => true }), /wilds_world_session_changed/);
  assert.equal(adoptions, 1);
});

test('a silent projection worker recovers without reading or writing the durable queue', async () => {
  type Port = ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;
  const port: Port = { onmessage: null, onerror: null, postMessage() {}, terminate() {} };
  const client = createWildsWorldWorkerClient(() => port, { deadlineMs: 5,
    storage: { async read() { throw Error('projection must not read storage'); }, async write() { throw Error('projection must not write storage'); } } });
  const base = initialWildsWorldProjection(), entries = [entry('timeout')];
  try { assert.deepEqual(await client.run({ kind: 'project', base, actorId, entries }), projectWildsWorldOutbox(base, actorId, entries)); }
  finally { client.close(); }
});

test('session cancellation while worker replay is outstanding cannot adopt its completed result', async () => {
  const { reconcileWildsWorldOutboxProjection } = await import('../src/features/play/wilds-world-outbox');
  const base = initialWildsWorldProjection();
  let cancelled = false, finish!: (value: typeof base) => void, adopted = false;
  const pending = reconcileWildsWorldOutboxProjection({ base, actorId, entries: [entry('cancel')],
    current: () => base, project: () => new Promise(resolve => { finish = resolve; }),
    adopt: value => { adopted = true; return value; }, cancelled: () => cancelled });
  cancelled = true; finish(base);
  await assert.rejects(pending, { name: 'AbortError', message: 'wilds_world_session_changed' });
  assert.equal(adopted, false);
});
