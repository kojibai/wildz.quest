import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationOperationContextFixture } from './support/creation-operation-fixtures';
import { compileCreation } from '../src/features/play/creation/compiler';
import { prepareCreationOperation } from '../src/features/play/creation/operation';
import { sealCreationInstance } from '../src/features/play/creation/instance';
import { createCreationCurrentSourcePort, verifyCurrentCreationSource, type CreationCurrentSource } from '../src/features/play/creation/current-source';
import { createCreationPhysicalStore, isAdmittedCreationProjection } from '../src/features/play/creation/physical-store';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
function fixture() {
    const context = creationOperationContextFixture(), compiled = compileCreation(context.definition, context.compileContext);
    if (compiled.status !== 'ready')
        throw Error('fixture');
    const operation = prepareCreationOperation(compiled.plan, context), instance = operation.command.instance;
    let current = instance, fail = false;
    const query = { instanceId: instance.instanceId, worldId: instance.worldId, spaceId: instance.spaceId };
    const row = (): CreationCurrentSource => ({ status: 'available', instance: current, definition: context.definition, planDigest: compiled.plan.digest, source: { fixtureOnly: true, currentHead: current.head } });
    const port = createCreationCurrentSourcePort({ read: async () => row(), authenticateCurrent: async (r) => { if (fail)
            throw Error('offline'); return r.instance.head === current.head; } });
    const store = createCreationPhysicalStore({ project: async (i, d, p) => projectCreationPhysical(i, d, p) });
    return { context, plan: compiled.plan, instance, query, port, store, row, setCurrent(next: typeof current) { current = next; }, fail() { fail = true; } };
}
test('current source hydration rejects raw JSON and authenticates before becoming physical', async () => {
    const f = fixture();
    assert.equal(await f.store.adoptCurrent(f.row(), f.plan), false);
    const row = await f.port.read(f.query);
    assert.equal(row.status, 'available');
    if (row.status !== 'available')
        return;
    assert.equal(await verifyCurrentCreationSource(JSON.parse(JSON.stringify(row))), false);
    assert.equal(await f.store.adoptCurrent(row, f.plan), true);
    assert.equal(f.store.snapshot().instances[f.instance.instanceId].head, f.instance.head);
    assert.equal(isAdmittedCreationProjection(f.store.snapshot().projections[0]), true);
});
test('an exact current custody update preserves unchanged rendered and walkable buffers', async () => {
    const f = fixture(), initial = await f.port.read(f.query);
    if (initial.status !== 'available')
        throw Error('fixture');
    assert.equal(await f.store.adoptCurrent(initial, f.plan), true);
    const before = f.store.snapshot(), oldProjection = before.projections[0], { head, ...basis } = f.instance;
    const transferred = sealCreationInstance({ ...basis, parentHead: head, revision: f.instance.revision + 1, ownerId: 'recipient', stewardId: 'recipient', kaiUPulse: f.instance.kaiUPulse + 1 });
    f.setCurrent(transferred);
    const next = await f.port.read(f.query);
    if (next.status !== 'available')
        throw Error('fixture');
    assert.equal(await f.store.adoptCurrent(next, f.plan), true);
    const after = f.store.snapshot();
    assert.equal(after.instances[f.instance.instanceId].ownerId, 'recipient');
    assert.equal(after.projections.length, 1);
    assert.equal(after.projections[0].head, transferred.head);
    assert.equal(after.projections[0].chunks, oldProjection.chunks);
    assert.equal(after.navigation, before.navigation);
    assert.equal(await f.store.adoptCurrent(initial, f.plan), false);
});
test('a source that changes during awaited projection cannot publish a historical object', async () => {
    const f = fixture(), row = await f.port.read(f.query);
    if (row.status !== 'available')
        throw Error('fixture');
    const { head, ...basis } = f.instance, moved = sealCreationInstance({ ...basis, parentHead: head, revision: f.instance.revision + 1, pose: { ...basis.pose, position: { ...basis.pose.position, x: 3 } }, kaiUPulse: f.instance.kaiUPulse + 1 });
    const store = createCreationPhysicalStore({ project: async (i, d, p) => { f.setCurrent(moved); return projectCreationPhysical(i, d, p); } });
    assert.equal(await store.adoptCurrent(row, f.plan), false);
    assert.equal(store.snapshot().projections.length, 0);
});
test('failed current verification preserves the last source and an unqualified port remains unavailable', async () => {
    const f = fixture(), row = await f.port.read(f.query);
    if (row.status !== 'available')
        throw Error('fixture');
    assert.equal(await f.store.adoptCurrent(row, f.plan), true);
    const before = f.store.snapshot();
    f.fail();
    assert.equal(await f.store.adoptCurrent(row, f.plan), false);
    assert.equal(f.store.snapshot(), before);
    assert.equal((await createCreationCurrentSourcePort().read(f.query)).status, 'unavailable');
});
test('closed or cancelled hydration cannot publish while current verification awaits', async () => {
    const f = fixture(), row = await f.port.read(f.query);
    if (row.status !== 'available')
        throw Error('fixture');
    let allowed = true;
    const store = createCreationPhysicalStore({ project: async (i, d, p) => { allowed = false; return projectCreationPhysical(i, d, p); } });
    assert.equal(await store.adoptCurrent(row, f.plan, () => allowed), false);
    assert.equal(store.snapshot().projections.length, 0);
    const closed = createCreationPhysicalStore({ project: async (i, d, p) => { closed.close(); return projectCreationPhysical(i, d, p); } });
    assert.equal(await closed.adoptCurrent(row, f.plan), false);
    assert.equal(closed.snapshot().projections.length, 0);
});
test('an incompatible physical successor needs the occupant and render replacement fence', async () => {
    const f = fixture(), first = await f.port.read(f.query);
    if (first.status !== 'available')
        throw Error('fixture');
    assert.equal(await f.store.adoptCurrent(first, f.plan), true);
    const before = f.store.snapshot();
    const { head, ...basis } = f.instance, id = Object.keys(basis.nodeStates)[0];
    const damaged = sealCreationInstance({ ...basis, parentHead: head, revision: f.instance.revision + 1, kaiUPulse: f.instance.kaiUPulse + 1, nodeStates: { ...basis.nodeStates, [id]: { ...basis.nodeStates[id], condition: 0 } } });
    f.setCurrent(damaged);
    const source = await f.port.read(f.query);
    if (source.status !== 'available')
        throw Error('fixture');
    assert.equal(await f.store.adoptCurrent(source, f.plan), false);
    assert.equal(f.store.snapshot(), before);
    let replacementChecks = 0;
    const qualified = createCreationPhysicalStore({ project: async (i, d, p) => projectCreationPhysical(i, d, p), canReplace: async () => { replacementChecks++; return true; } });
    f.setCurrent(f.instance);
    const base = await f.port.read(f.query);
    if (base.status !== 'available')
        throw Error('fixture');
    assert.equal(await qualified.adoptCurrent(base, f.plan), true);
    f.setCurrent(damaged);
    assert.equal(await qualified.adoptCurrent(source, f.plan), true);
    assert.equal(replacementChecks, 1);
    assert.equal(qualified.snapshot().instances[f.instance.instanceId].head, damaged.head);
});
test('source query and definition-plan binding reject counterfeit current rows', async () => {
    const f = fixture();
    const wrong = createCreationCurrentSourcePort({ read: async () => ({ ...f.row(), planDigest: 'invalid' }), authenticateCurrent: async () => true });
    assert.equal((await wrong.read(f.query)).status, 'unavailable');
    const other = createCreationCurrentSourcePort({ read: async () => f.row(), authenticateCurrent: async () => true });
    assert.equal((await other.read({ ...f.query, spaceId: 'elsewhere' })).status, 'unavailable');
});
