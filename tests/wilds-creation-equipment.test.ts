import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationDefinitionFixture } from './support/creation-fixtures';
import { creationAuthorityFixture, creationSourceHead } from './support/creation-instance-fixtures';
import { createCreationInstance, sealCreationInstance } from '../src/features/play/creation/instance';
import { emptyCreationState } from '../src/features/play/creation/state';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { equipCreation, resolveCreationEquipmentAction, CREATION_EQUIPMENT_RULE_ID, CREATION_EQUIPMENT_RULE_HEAD, currentCreationEquipment } from '../src/features/play/creation/equipment';
function fixture() { const base = creationDefinitionFixture().nodes[0], definition = creationDefinitionFixture({ nodes: [{ ...base, shape: { kind: 'box', width: .2, height: .1, depth: 1 }, behaviors: [{ id: 'weapon', version: 1, parameters: {} }] }] }); const initial = createCreationInstance({ instanceId: 'weapon', definition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, kaiUPulse: 1 }), { head, ...basis } = initial; void head; const instance = sealCreationInstance({ ...basis, stage: 'functional', nodeStates: initializeCreationComponents(definition, 1) }), state = { ...emptyCreationState(), instances: { weapon: instance }, definitions: { [definition.digest]: definition }, custody: { weapon: 'owner' } }, source = { id: `rule:${CREATION_EQUIPMENT_RULE_ID}`, head: CREATION_EQUIPMENT_RULE_HEAD, kind: 'rule' }, before = creationAuthorityFixture(state), context = { ...before, rules: { ...before.rules, [CREATION_EQUIPMENT_RULE_ID]: CREATION_EQUIPMENT_RULE_HEAD }, sources: [...before.sources, source], verifySource: (s: {
        id: string;
        head: string;
        kind: string;
    }) => s.id === source.id && s.head === source.head || before.verifySource(s) }; const command = { operationId: 'equip:first', actorId: 'owner', instanceId: 'weapon', expectedHeads: { weapon: instance.head, 'actor:owner': creationSourceHead }, kaiUPulse: 2, action: 'equip' as const, nodeId: 'room', slot: 'hand' as const }; return { instance, state, context, command }; }
test('equipping consumes current custody and invalidates the old owner after transfer', () => { const f = fixture(), transition = equipCreation(f.state, f.command, f.context); assert.equal(transition.status, 'proposed'); if (transition.status !== 'proposed')
    return; const equipped = transition.state.instances.weapon; assert.equal(currentCreationEquipment(equipped, 'owner')?.nodeId, 'room'); const { head, ...basis } = equipped, transferred = sealCreationInstance({ ...basis, ownerId: 'recipient', stewardId: 'recipient', revision: equipped.revision + 1, parentHead: head }); assert.equal(currentCreationEquipment(transferred, 'owner'), null); assert.equal(transferred.ownerId, 'recipient'); });
test('weapon actions are bounded by real range, wear, recovery and exact heads', () => { const f = fixture(), transition = equipCreation(f.state, f.command, f.context); if (transition.status !== 'proposed')
    throw Error('fixture'); const instance = transition.state.instances.weapon, request = { actionId: 'attack:first', actorId: 'owner', expectedHead: instance.head, targetId: 'target', targetHead: creationSourceHead, spaceId: 'surface', position: { x: 0, y: 0, z: 0 }, targetPosition: { x: 1, y: 0, z: 0 }, kaiUPulse: 2 }; const result = resolveCreationEquipmentAction(instance, request); assert.equal(result.status, 'proposed'); if (result.status !== 'proposed')
    return; assert.equal(result.damage, 4); assert.equal(result.instance.nodeStates.room.kind, 'equipment'); assert.equal(resolveCreationEquipmentAction(result.instance, { ...request, actionId: 'attack:next', expectedHead: result.instance.head, kaiUPulse: 3 }).status, 'rejected'); assert.equal(resolveCreationEquipmentAction(instance, { ...request, targetPosition: { x: 100, y: 0, z: 0 } }).status, 'rejected'); assert.equal(resolveCreationEquipmentAction(instance, { ...request, expectedHead: creationSourceHead }).status, 'rejected'); assert.equal(resolveCreationEquipmentAction(instance, { ...request, actorId: 'other' }).status, 'rejected'); });
test('a forged component profile and incompatible slot cannot create an action', () => { const f = fixture(); assert.equal(equipCreation(f.state, { ...f.command, slot: 'body' }, f.context).status, 'rejected'); assert.equal(equipCreation(f.state, f.command, { ...f.context, verifySource: () => false }).status, 'rejected'); });
test('exact equip retry after the head advances produces no second state change', () => { const f = fixture(), first = equipCreation(f.state, f.command, f.context); assert.equal(first.status, 'proposed'); if (first.status !== 'proposed')
    return; const next = first.state, current = next.instances.weapon, before = creationAuthorityFixture(next), rule = { id: `rule:${CREATION_EQUIPMENT_RULE_ID}`, head: CREATION_EQUIPMENT_RULE_HEAD, kind: 'rule' }, context = { ...before, rules: { ...before.rules, [CREATION_EQUIPMENT_RULE_ID]: CREATION_EQUIPMENT_RULE_HEAD }, sources: [...before.sources, rule], verifySource: (source: {
        id: string;
        head: string;
        kind: string;
    }) => source.id === rule.id && source.head === rule.head || before.verifySource(source) }; const retry = equipCreation(next, f.command, context); assert.equal(retry.status, 'proposed'); assert.equal(retry.state, next); assert.equal(retry.state.instances.weapon.head, current.head); });
test('equipping verifies complete assembly mass and fixed profile capacity', () => {
    const f = fixture(), old = f.instance, { head: unused, ...basis } = old;
    void unused;
    const component = basis.nodeStates.room;
    if (component.kind !== 'equipment')
        throw Error('fixture');
    const forged = sealCreationInstance({ ...basis, nodeStates: { room: { ...component, mass: component.mass / 2, capacity: 999999, durability: 999999 } } }), state = { ...f.state, instances: { weapon: forged } }, before = creationAuthorityFixture(state), rule = { id: `rule:${CREATION_EQUIPMENT_RULE_ID}`, head: CREATION_EQUIPMENT_RULE_HEAD, kind: 'rule' }, context = { ...before, rules: { ...before.rules, [CREATION_EQUIPMENT_RULE_ID]: CREATION_EQUIPMENT_RULE_HEAD }, sources: [...before.sources, rule], verifySource: (s: {
            id: string;
            head: string;
            kind: string;
        }) => s.id === rule.id && s.head === rule.head || before.verifySource(s) };
    const result = equipCreation(state, { ...f.command, expectedHeads: { ...f.command.expectedHeads, weapon: forged.head } }, context);
    assert.equal(result.status, 'rejected');
    assert.equal(result.state, state);
    assert.equal(equipCreation(f.state, { ...f.command, action: 'unexpected' as 'equip' }, f.context).status, 'rejected');
});
