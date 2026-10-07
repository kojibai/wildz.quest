import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReceizInMemoryOfflineProofQueueStorage, type ReceizOfflineProofQueueStorage } from '@receiz/sdk';
import { createWildsWorldWorkerClient } from '../src/features/play/wilds-world-work-client';
import { acknowledgeWildsWorldCommand, persistWildsWorldCommandDurably, prepareAndPersistWildsWorldOutboxEntry, readWildsWorldOutbox, type WildsWorldOutboxEntry } from '../src/features/play/wilds-world-outbox';
import { initialWildsWorldProjection } from '../src/features/play/wilds-world-state';
import { createWildsSourceAuthorityProjection, replanQueuedWildsMaterialHarvest } from '../src/features/play/wilds-source-work-authority';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { withWildsWorldCommandKai } from '../src/features/play/wilds-world-authority';
import { createKaiTemporalRoot } from '../src/features/play/kai-temporal-root';
import { deriveKaiKlokMomentFromUPulse } from '../src/features/play/kai-klok-moment';

type Port = ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;
function entry(commandId = 'command:silent:project'): WildsWorldOutboxEntry {
  return { schema: 'receiz.wilds_world_outbox_entry.v1', actorId: 'global_keeper.receiz.id', guestId: 'guest-12345678', command: { type: 'construction.project.create', commandId, name: 'Silent worker recovery', region: { x: 0, z: 0 } }, queuedAt: '2026-07-19T12:00:00.000Z' };
}
function countedStorage() {
  const storage = createReceizInMemoryOfflineProofQueueStorage(); let writes = 0;
  const port: ReceizOfflineProofQueueStorage = { read: () => storage.read(), async write(value) { writes++; await storage.write(value); }, async remove() { await storage.remove?.(); } };
  return { storage: port, writes: () => writes };
}
function silentWorker() {
  let terminated = false; const messages: Parameters<Port['postMessage']>[0][] = [];
  const port: Port = { onmessage: null, onerror: null, postMessage(message) { messages.push(structuredClone(message)); }, terminate() { terminated = true; } };
  return { port, messages, terminated: () => terminated };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('worker recovery never settled')), 500); });
  try { return await Promise.race([promise, deadline]); } finally { clearTimeout(timer!); }
}

test('a silent committed worker returns the exact durable projection without a second write', async () => {
  const durable = countedStorage(), silent = silentWorker(), base = initialWildsWorldProjection(), intent = entry();
  await prepareAndPersistWildsWorldOutboxEntry(base, intent, undefined, value => persistWildsWorldCommandDurably(value, durable.storage));
  const before = durable.writes();
  const client = createWildsWorldWorkerClient(() => silent.port, { deadlineMs: 5, storage: durable.storage });
  try {
    const result = await bounded(client.run({ kind: 'prepare-persist', base, entry: intent })) as { projection: { revision: number } };
    assert.equal(result.projection.revision, 1); assert.equal(durable.writes(), before); assert.equal(silent.terminated(), true);
    assert.equal((await readWildsWorldOutbox(intent.actorId, durable.storage)).length, 1);
  } finally { client.close(); }
});

test('an absent silent write persists the same command after the durable read barrier', async () => {
  const durable = countedStorage(), silent = silentWorker(), intent = entry('command:silent:absent');
  const client = createWildsWorldWorkerClient(() => silent.port, { deadlineMs: 5, storage: durable.storage });
  try {
    const result = await bounded(client.run({ kind: 'prepare-persist', base: initialWildsWorldProjection(), entry: intent })) as { projection: { revision: number } };
    assert.equal(result.projection.revision, 1); assert.equal(durable.writes(), 1);
    const rows = await readWildsWorldOutbox(intent.actorId, durable.storage);
    assert.equal(rows.length, 1); assert.deepEqual(rows[0].command, intent.command); assert.equal(rows[0].queuedAt, intent.queuedAt);
  } finally { client.close(); }
});

test('recovering a silent committed harvest preserves one material lot and one consumed source action', async () => {
  const durable = countedStorage(), silent = silentWorker(), base = createWildsSourceAuthorityProjection(), source = projectWildsResourceRegion(0, 0).find(s => s.kind === 'timber')!;
  const kaiUPulse = 2000010, kai = createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({ uPulse: kaiUPulse, authority: 'local' }));
  const command = replanQueuedWildsMaterialHarvest({ projection: base, source, actorId: 'global_keeper.receiz.id', actorPosition: source.position, kaiUPulse, commandId: 'command:silent:harvest' });
  const intent = { ...entry(), command: withWildsWorldCommandKai(command, kai) };
  const admitted = await prepareAndPersistWildsWorldOutboxEntry(base, intent, undefined, value => persistWildsWorldCommandDurably(value, durable.storage));
  assert.equal(Object.keys(admitted.projection.materialLots).length, 1);
  const before = durable.writes(), client = createWildsWorldWorkerClient(() => silent.port, { deadlineMs: 5, storage: durable.storage });
  try {
    const result = await bounded(client.run({ kind: 'prepare-persist', base, entry: intent })) as typeof admitted;
    assert.deepEqual(result.projection.materialLots, admitted.projection.materialLots);
    assert.equal(result.projection.harvestedSources[source.sourceId].harvestedCapacity, 1);
    assert.equal(durable.writes(), before);
    assert.equal((await readWildsWorldOutbox(intent.actorId, durable.storage)).length, 1);
  } finally { client.close(); }
});

test('settled durable commands also reconcile and a mismatched command fails closed', async () => {
  const durable = countedStorage(), intent = entry('command:silent:settled');
  await prepareAndPersistWildsWorldOutboxEntry(initialWildsWorldProjection(), intent, undefined, value => persistWildsWorldCommandDurably(value, durable.storage));
  await acknowledgeWildsWorldCommand(intent.actorId, intent.command.commandId, durable.storage);
  const before = durable.writes(), first = silentWorker();
  const client = createWildsWorldWorkerClient(() => first.port, { deadlineMs: 5, storage: durable.storage });
  try { await bounded(client.run({ kind: 'persist', entry: intent })); assert.equal(durable.writes(), before); assert.equal((await readWildsWorldOutbox(intent.actorId, durable.storage)).length, 0); }
  finally { client.close(); }
  const wrong = { ...intent, command: { ...intent.command, name: 'Changed intent' } } as WildsWorldOutboxEntry, second = silentWorker();
  const conflict = createWildsWorldWorkerClient(() => second.port, { deadlineMs: 5, storage: durable.storage });
  try { await assert.rejects(bounded(conflict.run({ kind: 'persist', entry: wrong })), /command_conflict/); assert.equal(durable.writes(), before); }
  finally { conflict.close(); }
});

test('late replies from a timed-out worker cannot settle requests sent to its replacement', async () => {
  const durable = countedStorage(), first = silentWorker(), second = silentWorker(); let created = 0;
  const client = createWildsWorldWorkerClient(() => ++created === 1 ? first.port : second.port, { deadlineMs: 50, storage: durable.storage });
  try {
    const timed = client.run({ kind: 'read', actorId: 'keeper' }), oldReply = first.port.onmessage!;
    assert.deepEqual(await bounded(timed), []);
    const next = client.run({ kind: 'read', actorId: 'keeper' });
    oldReply({ data: { id: second.messages[0].id, ok: true, value: ['late-wrong-value'] } } as MessageEvent);
    second.port.onmessage!({ data: { id: second.messages[0].id, ok: true, value: ['fresh-value'] } } as MessageEvent);
    assert.deepEqual(await bounded(next), ['fresh-value']); assert.equal(created, 2);
  } finally { client.close(); }
});

test('message decoding failures recover safely and ordinary worker errors permit a fresh next worker', async () => {
  const durable = countedStorage(), first = silentWorker(), second = silentWorker(); let created = 0;
  const client = createWildsWorldWorkerClient(() => ++created === 1 ? first.port : second.port, { deadlineMs: 50, storage: durable.storage });
  try {
    const reading = client.run({ kind: 'read', actorId: 'keeper' });
    first.port.onmessageerror!({} as MessageEvent);
    assert.deepEqual(await bounded(reading), []);
    const interrupted = client.run({ kind: 'read', actorId: 'keeper' }), rejected = assert.rejects(interrupted, /worker_interrupted/);
    second.port.onerror!({ preventDefault() {} } as ErrorEvent); await rejected;
    const next = client.run({ kind: 'read', actorId: 'keeper' });
    second.port.onmessage!({ data: { id: second.messages.at(-1)!.id, ok: true, value: [] } } as MessageEvent);
    assert.deepEqual(await bounded(next), []); assert.equal(created, 3);
  } finally { client.close(); }
});
