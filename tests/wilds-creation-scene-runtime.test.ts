import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCreationSceneRuntime } from '../src/features/play/creation/scene-runtime';
import { createCreationPhysicalStore } from '../src/features/play/creation/physical-store';
import { creationOperationContextFixture, creationOperationFixture } from './support/creation-operation-fixtures';
import { compileCreation } from '../src/features/play/creation/compiler';
import { createCreationAdmissionPort, prepareCreationOperation, type CreationOperation } from '../src/features/play/creation/operation';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { creationDefinitionFixture } from './support/creation-fixtures';
import type { CreationNode } from '../src/features/play/creation/types';
const budget = { maximumPages: 4, maximumVertices: 24000, maximumDrawCalls: 12, maximumTextureBytes: 0, maximumUploadBytesPerPaint: 65536 };
async function fixture(nodes?: readonly CreationNode[]) {
    const original = creationOperationContextFixture(), definition = nodes ? creationDefinitionFixture({ nodes }) : original.definition;
    const context = { ...original, definition, state: { ...original.state, definitions: { [definition.digest]: definition } } }, compiled = compileCreation(context.definition, context.compileContext);
    if (compiled.status !== 'ready')
        throw Error('fixture');
    const op = nodes ? prepareCreationOperation(compiled.plan, context) : creationOperationFixture();
    const outcome = (op: CreationOperation) => ({ status: 'admitted' as const, operationId: op.operationId, operationDigest: op.digest, instance: op.command.instance, successorSources: [{ id: op.instanceId, head: op.command.instance.head, kind: 'creation', parentHead: null }, ...op.command.resourceSuccessors.map(r => ({ id: r.id, head: r.head, kind: r.kind, parentHead: op.expectedHeads[r.id] })), ...op.workerAllocations.filter(w => w.work > 0).map(w => ({ id: w.workerId, head: context.authority.sources[0].head, kind: 'creature', parentHead: op.expectedHeads[w.workerId] })), { id: `space:${op.command.instance.spaceId}`, head: context.authority.sources[0].head, kind: 'space', parentHead: op.expectedHeads[`space:${op.command.instance.spaceId}`] }], eventIds: ['fixture:event'], receipt: 'test-only-admission' });
    const port = createCreationAdmissionPort({ executeRaw: async () => outcome(op), lookupRaw: async () => outcome(op), authenticate: async () => true, operationForLookup: async () => op }), store = createCreationPhysicalStore({ project: async (i, d, p) => projectCreationPhysical(i, d, p) });
    assert.equal(await store.adopt(op, await port.execute(op), compiled.plan), true);
    return store.snapshot();
}
test('collision activates only after the exact paced page has rendered', async () => { const source = await fixture(), deferred: (() => void)[] = [], runtime = createCreationSceneRuntime({ defer: fn => deferred.push(fn) }), flush = () => { while (deferred.length)
    deferred.shift()!(); }; runtime.refresh(source, budget); runtime.select({ worldId: 'wildz', spaceId: 'surface', position: { x: 0, y: 0, z: 0 }, radius: 32, limit: 128 }); flush(); assert.equal(runtime.snapshot().navigation.instanceCount, 0); runtime.paint(); flush(); assert.equal(runtime.snapshot().renderProjections.length, 1); assert.equal(runtime.snapshot().navigation.instanceCount, 0); const id = runtime.snapshot().renderProjections[0].chunks[0].id; runtime.rendered(id); flush(); assert.equal(runtime.snapshot().navigation.instanceCount, 1); assert.ok(runtime.snapshot().uploadBytes <= budget.maximumUploadBytesPerPaint); runtime.select({ worldId: 'wildz', spaceId: 'other', position: { x: 0, y: 0, z: 0 }, radius: 32, limit: 128 }); flush(); assert.equal(runtime.snapshot().navigation.instanceCount, 0); runtime.rendered(id); flush(); assert.equal(runtime.snapshot().navigation.instanceCount, 0); runtime.close(); });
test('serialized functional flags cannot populate the scene', async () => { const source = await fixture(), runtime = createCreationSceneRuntime({ defer: fn => fn() }); assert.throws(() => runtime.refresh({ ...source, projections: source.projections.map(p => ({ ...p })) }, budget), /unadmitted/); assert.equal(runtime.snapshot().navigation.instanceCount, 0); });
test('a quality reduction never discards an occupied floor to fit a smaller budget', async () => {
    const source = await fixture(), deferred: (() => void)[] = [], runtime = createCreationSceneRuntime({ defer: fn => deferred.push(fn) }), flush = () => { while (deferred.length)
        deferred.shift()!(); }, query = { worldId: 'wildz', spaceId: 'surface', position: { x: 0, y: .15, z: 0 }, radius: 32, limit: 128 };
    runtime.refresh(source, budget);
    runtime.select(query);
    runtime.paint();
    flush();
    const page = runtime.snapshot().renderProjections[0].chunks[0].id;
    runtime.rendered(page);
    flush();
    runtime.refresh(source, { ...budget, maximumDrawCalls: 0 });
    assert.equal(runtime.select(query), false);
    flush();
    assert.equal(runtime.snapshot().navigation.instanceCount, 1);
    assert.match(runtime.snapshot().blocked || '', /occupied/);
    runtime.select({ ...query, spaceId: 'other' });
    flush();
    assert.equal(runtime.snapshot().navigation.instanceCount, 0);
});
test('refreshing source discovery preserves already rendered unchanged floors', async () => {
    const source = await fixture(), deferred: (() => void)[] = [], runtime = createCreationSceneRuntime({ defer: fn => deferred.push(fn) }), flush = () => { while (deferred.length)
        deferred.shift()!(); }, query = { worldId: 'wildz', spaceId: 'surface', position: { x: 0, y: .15, z: 0 }, radius: 32, limit: 128 };
    runtime.refresh(source, budget);
    runtime.select(query);
    runtime.paint();
    flush();
    const page = runtime.snapshot().renderProjections[0].chunks[0].id;
    runtime.rendered(page);
    flush();
    const navigation = runtime.snapshot().navigation;
    runtime.refresh({ ...source }, budget);
    runtime.select(query);
    flush();
    assert.equal(runtime.snapshot().navigation.instanceCount, 1);
    assert.equal(runtime.snapshot().navigation, navigation);
    assert.equal(runtime.snapshot().renderProjections[0].chunks[0].id, page);
    runtime.paint();
    flush();
    assert.equal(runtime.snapshot().uploadBytes, 0);
    runtime.close();
});

test('walking within resident pages does not republish the scene or replace navigation', async () => {
    const source = await fixture(), deferred: (() => void)[] = [], runtime = createCreationSceneRuntime({ defer: fn => deferred.push(fn) });
    const flush = () => { while (deferred.length) deferred.shift()!(); };
    const query = { worldId: 'wildz', spaceId: 'surface', position: { x: 0, y: .15, z: 0 }, radius: 32, limit: 128 };
    runtime.refresh(source, budget); runtime.select(query); runtime.paint(); flush();
    runtime.snapshot().renderProjections.flatMap(p => p.chunks).forEach(chunk => runtime.rendered(chunk.id)); flush();
    const resident = runtime.snapshot();
    let publications = 0;
    runtime.subscribe(() => publications++);
    for (let i = 0; i < 120; i++) {
        assert.equal(runtime.select({ ...query, position: { x: .1, y: .15, z: i % 2 ? .1 : 0 } }), true);
        runtime.paint(); flush();
    }
    assert.equal(publications, 0, 'unchanged residency must not force React scene work on approach');
    assert.equal(runtime.snapshot(), resident);
    runtime.close();
});
test('re-derived pages are requeued instead of silently losing their upload request', async () => {
    const source = await fixture(), replacement = await fixture(), deferred: (() => void)[] = [], runtime = createCreationSceneRuntime({ defer: fn => deferred.push(fn) }), flush = () => { while (deferred.length)
        deferred.shift()!(); }, query = { worldId: 'wildz', spaceId: 'surface', position: { x: 0, y: .15, z: 0 }, radius: 32, limit: 128 };
    runtime.refresh(source, budget);
    runtime.select(query);
    runtime.paint();
    flush();
    runtime.rendered(runtime.snapshot().renderProjections[0].chunks[0].id);
    flush();
    runtime.refresh(replacement, budget);
    runtime.select(query);
    flush();
    assert.equal(runtime.snapshot().queued, 1);
    runtime.paint();
    flush();
    assert.equal(runtime.snapshot().renderProjections.length, 1);
    runtime.close();
});

test('a supported node chain can cross regions and return without crashing page discovery', async () => {
    const base = creationDefinitionFixture().nodes[0];
    const node = (id: string, x: number, y: number, supports: readonly string[]): CreationNode => ({ ...base, id, shape: { kind: 'box', width: .1, height: .2, depth: .1 }, pose: { position: { x, y, z: 0 }, yaw: 0 }, supports });
    // The node graph is A1 -> B1 -> A2. Regional grouping puts A1 and A2
    // in one page, so the two derived pages depend on one another.
    const source = await fixture([node('A1', 31.9, 0, []), node('B1', 32.1, 0, ['A1']), node('A2', 31.9, .2, ['B1'])]);
    const deferred: (() => void)[] = [], runtime = createCreationSceneRuntime({ defer: work => deferred.push(work) });
    const flush = () => { while (deferred.length) deferred.shift()!(); };
    const query = { worldId: 'wildz', spaceId: 'surface', position: { x: 31.9, y: 0, z: 0 }, radius: 4, limit: 128 };
    assert.doesNotThrow(() => runtime.refresh(source, { ...budget, maximumPages: 1 }));
    runtime.select(query); runtime.paint(); flush();
    assert.equal(runtime.snapshot().renderProjections.length, 0, 'the support group must fit together before any page is selected');
    runtime.refresh(source, { ...budget, maximumUploadBytesPerPaint: 2304 });
    runtime.select(query); runtime.paint(); flush();
    const first = runtime.snapshot().renderProjections[0].chunks;
    assert.equal(first.length, 1, 'uploads still respect the per-paint byte allowance');
    runtime.rendered(first[0].id); flush();
    assert.equal(runtime.snapshot().navigation.instanceCount, 0, 'one rendered page cannot activate a partly rendered support group');
    runtime.paint(); flush();
    const all = runtime.snapshot().renderProjections[0].chunks;
    assert.equal(all.length, 2);
    all.forEach(chunk => runtime.rendered(chunk.id)); flush();
    assert.equal(runtime.snapshot().navigation.instanceCount, 1);
    assert.equal(runtime.snapshot().projections[0].solids.length, 3);
    runtime.close();
});
