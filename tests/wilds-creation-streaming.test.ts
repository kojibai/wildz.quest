import { createCreationDefinition } from '../src/features/play/creation/definition';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCreationPageIndex, selectCreationPages, deriveCreationResidencyBudget } from '../src/features/play/creation/residency';
import { createCreationUploadScheduler } from '../src/features/play/creation/upload-scheduler';
import type { CreationPageRef } from '../src/features/play/creation/chunks';
import { wildsQualityProfileForTier } from '../src/features/play/wilds-quality-profile';
import { creationOperationContextFixture } from './support/creation-operation-fixtures';
import { compileCreation } from '../src/features/play/creation/compiler';
const head = `sha256:${'a'.repeat(64)}`, budget = { maximumPages: 3, maximumVertices: 1000, maximumDrawCalls: 6, maximumTextureBytes: 0, maximumUploadBytesPerPaint: 4096 };
function page(id: string, x: number, dependencies: readonly string[] = []): CreationPageRef { return { pageId: id, head, worldId: 'world', spaceId: 'surface', bounds: { min: { x, y: 0, z: 0 }, max: { x: x + 3, y: 3, z: 3 } }, nodeIds: [id], dependencies, vertices: 100, drawCalls: 1, textureBytes: 0, uploadBytes: 2400 }; }
test('a distant page request stays within the residency budget', () => { const index = createCreationPageIndex(Array.from({ length: 12000 }, (_, i) => page(`page:${i}`, i * 64))); let fullScan = false; const forbidden = { ...index, entries: new Proxy(index.entries, { get(target, key) { if (key === Symbol.iterator || key === 'values' || key === 'entries') {
            fullScan = true;
            throw Error('whole world scan');
        } const v = Reflect.get(target, key, target); return typeof v === 'function' ? v.bind(target) : v; } }) }; const pages = selectCreationPages(forbidden, { worldId: 'world', spaceId: 'surface', position: { x: 640000, y: 0, z: 0 }, radius: 32, limit: 128, pinnedPageIds: [] }, budget); assert.ok(pages.length <= budget.maximumPages); assert.equal(pages[0].pageId, 'page:10000'); assert.equal(fullScan, false); });
test('occupied pages pin their support dependencies and cannot exceed the active budget silently', () => { const index = createCreationPageIndex([page('ground', 0), page('upper', 0, ['ground']), page('far', 64)]); const q = { worldId: 'world', spaceId: 'surface', position: { x: 64, y: 0, z: 0 }, radius: 4, limit: 128, pinnedPageIds: ['upper'] }; assert.deepEqual(selectCreationPages(index, q, budget).map(p => p.pageId).slice(0, 2), ['ground', 'upper']); assert.throws(() => selectCreationPages(index, q, { ...budget, maximumPages: 1 }), /occupied_residency/); });
test('residency takes only measured remaining scene allowance', () => { const profile = wildsQualityProfileForTier('low', false); const b = deriveCreationResidencyBudget(profile, { drawCalls: 159, triangles: 179990, textureBytes: 0, maximumTextureBytes: 0 }); assert.equal(b.maximumDrawCalls, 1); assert.equal(b.maximumVertices, 30); assert.equal(b.maximumTextureBytes, 0); });
test('upload work is bounded per paint and cancellation disposes compatible bundles', () => { const f = creationOperationContextFixture(), compiled = compileCreation(f.definition, f.compileContext); if (compiled.status !== 'ready')
    throw Error('fixture'); const chunk = compiled.plan.chunks[0], bytes = chunk.positions.byteLength + chunk.normals.byteLength; let uploads = 0, disposals = 0; const scheduler = createCreationUploadScheduler({ budget: { ...budget, maximumVertices: 100000, maximumUploadBytesPerPaint: bytes }, upload: c => { uploads++; return { chunk: c, renderReady: true, physicsReady: true, textureBytes: 0 }; }, dispose: () => { disposals++; } }); scheduler.enqueue('first', [chunk, { ...chunk, id: 'second' }]); assert.equal(scheduler.paint().uploadedBytes, bytes); assert.equal(uploads, 1); scheduler.cancel('first'); assert.equal(disposals, 1); assert.equal(scheduler.paint().uploadedBytes, 0); assert.equal(uploads, 1); });
test('an incompatible render-only upload never activates collision or residency', () => { const f = creationOperationContextFixture(), compiled = compileCreation(f.definition, f.compileContext); if (compiled.status !== 'ready')
    throw Error('fixture'); let disposed = 0; const scheduler = createCreationUploadScheduler({ budget: { ...budget, maximumVertices: 100000, maximumUploadBytesPerPaint: 100000 }, upload: chunk => ({ chunk, renderReady: true, physicsReady: false, textureBytes: 0 }), dispose: () => { disposed++; } }); scheduler.enqueue('test', compiled.plan.chunks); assert.equal(scheduler.paint().active.length, 0); assert.equal(disposed, 1); });
test('compiled palace pages fit the lowest upload ceiling and merge repeated materials', () => {
    const f = creationOperationContextFixture(), base = f.definition.nodes[0];
    const definition = createCreationDefinition({ schema: 'wildz.creation-definition.v1', grammarVersion: 1, seed: 'palace', creatorId: f.definition.creatorId, assets: [], nodes: Array.from({ length: 128 }, (_, i) => ({ ...base, id: `room:${i}`, pose: { position: { x: (i % 16) * .1, y: Math.floor(i / 16) * .1, z: 0 }, yaw: 0 } })) });
    const compiled = compileCreation(definition, { ...f.compileContext, budget: { timber: 1000000, stone: 1000000, hay: 1000000 } });
    assert.equal(compiled.status, 'ready');
    if (compiled.status !== 'ready')
        return;
    assert.ok(compiled.plan.chunks.length > 1);
    assert.ok(compiled.plan.chunks.every(c => c.positions.byteLength + c.normals.byteLength <= 65536));
    assert.ok(compiled.plan.chunks.every(c => c.materials.length === 1));
    assert.equal(compiled.plan.chunks.reduce((n, c) => n + c.nodeIds.length, 0), 128);
});
