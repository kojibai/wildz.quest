import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationDefinitionFixture } from './support/creation-fixtures';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { validateCreationNodeState } from '../src/features/play/creation/instance';
function definition(id: string, parameters: Record<string, number | string | boolean> = {}) { const base = creationDefinitionFixture().nodes[0]; return creationDefinitionFixture({ nodes: [{ ...base, shape: id === 'habitat' ? { kind: 'shell', width: 3, height: 3, depth: 3, thickness: .15, doorway: { width: 1, height: 2 } } : { kind: 'box', width: 1, height: .2, depth: 2 }, behaviors: [{ id, version: 1, parameters }] }] }); }
test('functional components initialize from a fixed law without generated stats or contents', () => { for (const id of ['bed', 'storage', 'habitat', 'tool', 'weapon', 'garden', 'joint']) {
    const states = initializeCreationComponents(definition(id), 100);
    assert.equal(Object.keys(states).length, 1);
    validateCreationNodeState(states.room);
    assert.notEqual(states.room.kind, 'condition');
    if (states.room.kind === 'storage')
        assert.deepEqual(states.room.lotIds, []);
    if (states.room.kind === 'garden')
        assert.equal(states.room.produce, 0);
    if (states.room.kind === 'equipment')
        assert.equal(states.room.equippedBy, null);
} });
test('prompt-supplied overpowering or free component quantities cannot initialize', () => { for (const [id, parameters] of [['weapon', { damage: 999999 }], ['storage', { capacity: 999999 }], ['garden', { produce: 100 }], ['bed', { occupants: 4 }]] as const)
    assert.throws(() => initializeCreationComponents(definition(id, parameters), 100), /parameter/); assert.throws(() => initializeCreationComponents(definition('portal'), 100), /law/); });
test('bed and habitat capacity requires physically usable dimensions', () => {
    const base = creationDefinitionFixture().nodes[0];
    for (const [id, shape] of [['bed', { kind: 'box', width: .1, height: .02, depth: .1 }], ['habitat', { kind: 'shell', width: 1, height: .3, depth: 1, thickness: .1 }]] as const) {
        const tiny = creationDefinitionFixture({ nodes: [{ ...base, shape, behaviors: [{ id, version: 1, parameters: {} }] }] });
        assert.throws(() => initializeCreationComponents(tiny, 100), /fit/);
    }
});
test('a small weapon component cannot make a heavy surrounding assembly carryable', () => {
    const base = creationDefinitionFixture().nodes[0];
    const heavy = creationDefinitionFixture({ nodes: [{ ...base, shape: { kind: 'box', width: .2, height: .1, depth: 1 }, behaviors: [{ id: 'weapon', version: 1, parameters: {} }] }, { ...base, id: 'huge-handle', shape: { kind: 'box', width: 4, height: 4, depth: 4 }, behaviors: [] }] });
    assert.throws(() => initializeCreationComponents(heavy, 100), /mass/);
    const light = creationDefinitionFixture({ nodes: [{ ...base, shape: { kind: 'box', width: .2, height: .1, depth: 1 }, behaviors: [{ id: 'weapon', version: 1, parameters: {} }] }, { ...base, id: 'handle', shape: { kind: 'box', width: .1, height: .1, depth: 1 }, behaviors: [] }] });
    const node = initializeCreationComponents(light, 100).room;
    assert.equal(node.kind, 'equipment');
    if (node.kind === 'equipment')
        assert.ok(Math.abs(node.mass - .03) < 1e-8);
});
