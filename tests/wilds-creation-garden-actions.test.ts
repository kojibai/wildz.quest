import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationDefinitionFixture } from './support/creation-fixtures';
import { creationAuthorityFixture, creationSourceHead } from './support/creation-instance-fixtures';
import { createCreationInstance, sealCreationInstance } from '../src/features/play/creation/instance';
import { emptyCreationState, type CreationState } from '../src/features/play/creation/state';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { sealCreationResourceLot, createCreationResourceCustody, verifyCreationResourceCustody } from '../src/features/play/creation/resource-registry';
import { CREATION_GARDEN_RULES } from '../src/features/play/creation/garden';
import { proposeCreationGardenAction, CREATION_GARDEN_ACTION_RULE_ID, CREATION_GARDEN_ACTION_RULE_HEAD, type CreationGardenCommand } from '../src/features/play/creation/garden-actions';
function fixture() {
    const base = creationDefinitionFixture().nodes[0], definition = creationDefinitionFixture({ nodes: [{ ...base, shape: { kind: 'box', width: 2, height: .2, depth: 2 }, behaviors: [{ id: 'garden', version: 1, parameters: {} }] }] });
    const initial = createCreationInstance({ instanceId: 'garden', definition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, kaiUPulse: 1 }), { head, ...basis } = initial;
    void head;
    const instance = sealCreationInstance({ ...basis, stage: 'functional', access: { ...basis.access, harvest: { mode: 'public', subjects: [] } }, nodeStates: initializeCreationComponents(definition, 1) });
    const lots = ['seed', 'water'].map(kind => createCreationResourceCustody(sealCreationResourceLot({ schema: 'wildz.creation-resource-lot.v1', id: `lot:${kind}`, kind: kind as 'seed' | 'water', quantity: 2, ownerId: 'owner', sourceId: `finite:${kind}`, sourceHead: creationSourceHead, operationId: `extract:${kind}`, parentHeads: [creationSourceHead], kaiUPulse: 1 })));
    const state: CreationState = { ...emptyCreationState(), definitions: { [definition.digest]: definition }, instances: { garden: instance }, resources: Object.fromEntries(lots.map(l => [l.id, l])), custody: { garden: 'owner', ...Object.fromEntries(lots.map(l => [l.id, 'owner'])) } };
    return { state, lots };
}
function authority(state: CreationState, actorId = 'owner') {
    const before = creationAuthorityFixture(state), rule = { id: `rule:${CREATION_GARDEN_ACTION_RULE_ID}`, head: CREATION_GARDEN_ACTION_RULE_HEAD, kind: 'rule' }, actor = { id: `actor:${actorId}`, head: creationSourceHead, kind: 'actor' };
    const sources = [...before.sources.filter(s => !s.id.startsWith('actor:')), actor, rule, ...Object.values(state.resources).map(r => ({ id: r.id, head: r.head, kind: 'material' }))];
    return { ...before, actorId, sources, rules: { ...before.rules, [CREATION_GARDEN_ACTION_RULE_ID]: CREATION_GARDEN_ACTION_RULE_HEAD }, verifySource: (s: {
            id: string;
            head: string;
            kind: string;
        }) => sources.some(v => v.id === s.id && v.head === s.head && v.kind === s.kind) };
}
function care(state: CreationState): Extract<CreationGardenCommand, {
    action: 'care';
}> {
    return { operationId: 'care:first', action: 'care', actorId: 'owner', instanceId: 'garden', nodeId: 'room', kaiUPulse: 2, expectedHeads: { garden: state.instances.garden.head, 'actor:owner': creationSourceHead, ...Object.fromEntries(Object.values(state.resources).map(r => [r.id, r.head])) }, inputs: [{ id: 'lot:seed', quantity: 1 }, { id: 'lot:water', quantity: 1 }] };
}
test('garden care conserves exact partial input custody and retry emits no second output', () => {
    const f = fixture(), command = care(f.state), first = proposeCreationGardenAction(f.state, command, authority(f.state));
    assert.equal(first.status, 'proposed');
    if (first.status !== 'proposed')
        return;
    assert.equal(first.state.resources['lot:seed'].quantity, 1);
    assert.equal(first.state.resources['lot:water'].quantity, 1);
    assert.equal(verifyCreationResourceCustody(first.state.resources['lot:seed']), true);
    assert.equal(first.successorSources.length, 3);
    const garden = first.state.instances.garden.nodeStates.room;
    assert.equal(garden.kind, 'garden');
    if (garden.kind !== 'garden')
        return;
    assert.equal(garden.planted, 1);
    assert.equal(garden.waterUnits, 1);
    assert.equal(garden.produce, 0);
    const retry = proposeCreationGardenAction(first.state, command, authority(first.state));
    assert.equal(retry.status, 'proposed');
    assert.equal(retry.state, first.state);
    if (retry.status === 'proposed')
        assert.equal(retry.successorSources.length, 0);
});
test('a permitted second player harvests one causal produce lot and cannot harvest it twice', () => {
    const f = fixture(), planted = proposeCreationGardenAction(f.state, care(f.state), authority(f.state));
    assert.equal(planted.status, 'proposed');
    if (planted.status !== 'proposed')
        return;
    const command: CreationGardenCommand = { operationId: 'harvest:visitor', action: 'harvest', actorId: 'visitor', instanceId: 'garden', nodeId: 'room', kaiUPulse: 2 + CREATION_GARDEN_RULES.growthIntervalKaiUPulse, expectedHeads: { garden: planted.state.instances.garden.head, 'actor:visitor': creationSourceHead, 'produce:visitor': null }, quantity: 1, lotId: 'produce:visitor' };
    const first = proposeCreationGardenAction(planted.state, command, authority(planted.state, 'visitor'));
    assert.equal(first.status, 'proposed');
    if (first.status !== 'proposed')
        return;
    const produced = first.state.resources[command.lotId];
    assert.equal(produced.ownerId, 'visitor');
    assert.equal(produced.quantity, 1);
    assert.equal(verifyCreationResourceCustody(produced), true);
    assert.equal(first.state.custody[command.lotId], 'visitor');
    assert.equal(first.successorSources.length, 2);
    const retry = proposeCreationGardenAction(first.state, command, authority(first.state, 'visitor'));
    assert.equal(retry.state, first.state);
    const second = proposeCreationGardenAction(first.state, { ...command, operationId: 'harvest:second', lotId: 'produce:second', expectedHeads: { garden: first.state.instances.garden.head, 'actor:visitor': creationSourceHead, 'produce:second': null } }, authority(first.state, 'visitor'));
    assert.equal(second.status, 'rejected');
    assert.equal(second.state, first.state);
});
test('garden actions reject stale, spent, reserved, foreign and counterfeit inputs without writes', () => {
    const f = fixture(), command = care(f.state), seed = f.state.resources['lot:seed'];
    const invalid: CreationState[] = [{ ...f.state, reservations: { 'lot:seed': 'another:operation' } }, { ...f.state, custody: { ...f.state.custody, 'lot:seed': 'other' } }, { ...f.state, resources: { ...f.state.resources, 'lot:seed': { ...seed, spent: true } } }, { ...f.state, resources: { ...f.state.resources, 'lot:seed': { ...seed, quantity: 200 } } }];
    for (const state of invalid) {
        const result = proposeCreationGardenAction(state, command, authority(state));
        assert.equal(result.status, 'rejected');
        assert.equal(result.state, state);
    }
    assert.equal(proposeCreationGardenAction(f.state, { ...command, expectedHeads: { ...command.expectedHeads, 'lot:seed': creationSourceHead } }, authority(f.state)).status, 'rejected');
    assert.equal(proposeCreationGardenAction(f.state, { ...command, inputs: [...command.inputs, command.inputs[0]] }, authority(f.state)).status, 'rejected');
    assert.equal(proposeCreationGardenAction(f.state, command, { ...authority(f.state), verifySource: () => false }).status, 'rejected');
});
test('harvest genesis cannot overwrite an existing lot or ignore a current source head', () => {
    const f = fixture(), command: CreationGardenCommand = { action: 'harvest', operationId: 'harvest:collision', actorId: 'owner', instanceId: 'garden', nodeId: 'room', kaiUPulse: 2, expectedHeads: { garden: f.state.instances.garden.head, 'actor:owner': creationSourceHead, 'lot:seed': null }, quantity: 1, lotId: 'lot:seed' };
    const result = proposeCreationGardenAction(f.state, command, authority(f.state));
    assert.equal(result.status, 'rejected');
    assert.equal(result.state, f.state);
});
