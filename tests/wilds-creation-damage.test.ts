import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationDefinitionFixture } from './support/creation-fixtures';
import { creationAuthorityFixture, creationSourceHead } from './support/creation-instance-fixtures';
import { prepareCreationRepair, CREATION_REPAIR_RULE_ID, CREATION_REPAIR_RULE_HEAD } from '../src/features/play/creation/repair';
import { sealConstructionProof } from '../src/features/play/wilds-construction-project';
import { createCreationInstance, sealCreationInstance } from '../src/features/play/creation/instance';
import { emptyCreationState } from '../src/features/play/creation/state';
import { resolveCreationDamage, CREATION_DAMAGE_RULE_ID, CREATION_DAMAGE_RULE_HEAD } from '../src/features/play/creation/damage';
function fixture() { const base = creationDefinitionFixture().nodes[0], definition = creationDefinitionFixture({ nodes: [base, { ...base, id: 'upper', supports: [base.id], pose: { position: { x: 0, y: 4, z: 0 }, yaw: 0 } }] }), initial = createCreationInstance({ instanceId: 'house', definition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, kaiUPulse: 1 }), { head, ...basis } = initial; void head; const instance = sealCreationInstance({ ...basis, stage: 'functional', embeddedResources: [{ id: 'timber-lot', head: creationSourceHead, kind: 'timber', quantity: 4 }] }), state = { ...emptyCreationState(), instances: { house: instance }, definitions: { [definition.digest]: definition }, custody: { house: 'owner' } }, original = creationAuthorityFixture(state), rule = { id: `rule:${CREATION_DAMAGE_RULE_ID}`, head: CREATION_DAMAGE_RULE_HEAD, kind: 'rule' }, context = { ...original, rules: { ...original.rules, [CREATION_DAMAGE_RULE_ID]: CREATION_DAMAGE_RULE_HEAD }, sources: [...original.sources, rule], verifySource: (source: {
        id: string;
        head: string;
        kind: string;
    }) => source.id === rule.id && source.head === rule.head || original.verifySource(source) }, command = { operationId: 'demolish:one', actorId: 'owner', instanceId: 'house', expectedHeads: { house: instance.head, 'actor:owner': creationSourceHead }, kaiUPulse: 2, action: 'demolish' as const, nodeId: base.id }; return { state, context, command }; }
test('destroying a support cascades into dependent floors and salvages finite embedded matter once', () => { const f = fixture(), result = resolveCreationDamage(f.state, f.command, f.context); assert.equal(result.status, 'proposed'); if (result.status !== 'proposed')
    return; assert.equal(result.state.instances.house.nodeStates.upper.condition, 0); assert.equal(result.state.instances.house.stage, 'destroyed'); assert.equal(result.salvage?.timber, 2); assert.equal(result.state.instances.house.embeddedResources.length, 0); const second = resolveCreationDamage(result.state, { ...f.command, operationId: 'demolish:again', expectedHeads: { ...f.command.expectedHeads, house: result.state.instances.house.head } }, f.context); assert.equal(second.status, 'rejected'); assert.equal(second.state, result.state); });
test('protected targets and occupied structures reject without any partial physical change', () => { const f = fixture(); assert.equal(resolveCreationDamage(f.state, { ...f.command, actorId: 'other' }, f.context).status, 'rejected'); const house = f.state.instances.house, { head, ...basis } = house, occupied = sealCreationInstance({ ...basis, nodeStates: { ...basis.nodeStates, upper: { version: 1, nodeId: 'upper', kind: 'habitat', condition: 100, supportIds: ['room'], capacity: 1, occupantIds: ['resident'] } } }); void head; const state = { ...f.state, instances: { house: occupied } }; const result = resolveCreationDamage(state, { ...f.command, expectedHeads: { ...f.command.expectedHeads, house: occupied.head } }, f.context); assert.equal(result.status, 'rejected'); assert.equal(result.state, state); });
test('repair preserves instance identity and consumes an exact unspent material lot', () => { const f = fixture(), destroyed = resolveCreationDamage(f.state, f.command, f.context); if (destroyed.status !== 'proposed')
    throw Error('fixture'); const instance = destroyed.state.instances.house, lot = sealConstructionProof({ id: 'repair-lot', kind: 'timber', quantity: 4, spent: false, ownerId: 'owner' }), state = { ...destroyed.state, resources: { [lot.id]: lot }, custody: { ...destroyed.state.custody, [lot.id]: 'owner' } }, before = creationAuthorityFixture(state), rule = { id: `rule:${CREATION_REPAIR_RULE_ID}`, head: CREATION_REPAIR_RULE_HEAD, kind: 'rule' }, source = { id: lot.id, head: lot.head, kind: 'material' }, context = { ...before, rules: { ...before.rules, [CREATION_REPAIR_RULE_ID]: CREATION_REPAIR_RULE_HEAD }, sources: [...before.sources, rule, source], verifySource: (s: {
        id: string;
        head: string;
        kind: string;
    }) => s.id === rule.id && s.head === rule.head || s.id === source.id && s.head === source.head || before.verifySource(s) }, command = { operationId: 'repair:first', actorId: 'owner', instanceId: 'house', expectedHeads: { house: instance.head, [lot.id]: lot.head, 'actor:owner': creationSourceHead }, kaiUPulse: 3, action: 'repair' as const, nodeId: 'room', resources: { lots: [{ id: lot.id, head: lot.head, kind: 'timber', quantity: 4 }], deficits: {} } }; const repaired = prepareCreationRepair(state, command, context); assert.equal(repaired.status, 'proposed'); if (repaired.status !== 'proposed')
    return; assert.equal(repaired.state.instances.house.instanceId, instance.instanceId); assert.equal(repaired.state.instances.house.nodeStates.room.condition, 100); assert.equal(repaired.state.resources[lot.id].spent, true); assert.equal(repaired.state.resources[lot.id].quantity, 0); assert.equal(prepareCreationRepair(state, { ...command, resources: { lots: [], deficits: { timber: 4 } } }, context).status, 'rejected'); assert.equal(prepareCreationRepair(repaired.state, { ...command, operationId: 'repair:repeat' }, context).status, 'rejected'); });
test('repairing ordinary weapon wear consumes material and emits its spent successor', () => {
    const base = creationDefinitionFixture().nodes[0], definition = creationDefinitionFixture({ nodes: [{ ...base, shape: { kind: 'box', width: .2, height: .1, depth: 1 }, behaviors: [{ id: 'weapon', version: 1, parameters: {} }] }] });
    const initial = createCreationInstance({ instanceId: 'worn-tool', definition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, kaiUPulse: 1 });
    const { head: unused, ...basis } = initial;
    void unused;
    const instance = sealCreationInstance({ ...basis, stage: 'functional', nodeStates: { room: { version: 1, nodeId: 'room', condition: 100, supportIds: [], kind: 'equipment', equipmentKind: 'weapon', capabilityId: 'strike.timber.v1', durability: 40, capacity: 120, mass: .02, actionProfileId: 'creation.timber.weapon.v1', equippedBy: null, lastActionKaiUPulse: 1, lastActionId: 'attack:prior' } } });
    const lot = sealConstructionProof({ id: 'repair-wear', kind: 'timber', quantity: 3, spent: false, ownerId: 'owner' }), state = { ...emptyCreationState(), definitions: { [definition.digest]: definition }, instances: { [instance.instanceId]: instance }, resources: { [lot.id]: lot }, custody: { [lot.id]: 'owner', [instance.instanceId]: 'owner' } };
    const before = creationAuthorityFixture(state), rule = { id: `rule:${CREATION_REPAIR_RULE_ID}`, head: CREATION_REPAIR_RULE_HEAD, kind: 'rule' }, source = { id: lot.id, head: lot.head, kind: 'material' }, context = { ...before, rules: { ...before.rules, [CREATION_REPAIR_RULE_ID]: CREATION_REPAIR_RULE_HEAD }, sources: [...before.sources, rule, source], verifySource: (s: {
            id: string;
            head: string;
            kind: string;
        }) => s.id === rule.id && s.head === rule.head || s.id === source.id && s.head === source.head || before.verifySource(s) };
    const command = { operationId: 'repair:wear', actorId: 'owner', instanceId: instance.instanceId, expectedHeads: { [instance.instanceId]: instance.head, [lot.id]: lot.head, 'actor:owner': creationSourceHead }, kaiUPulse: 2, action: 'repair' as const, nodeId: 'room', resources: { lots: [{ id: lot.id, head: lot.head, kind: 'timber', quantity: 3 }], deficits: {} } };
    const result = prepareCreationRepair(state, command, context);
    assert.equal(result.status, 'proposed');
    if (result.status !== 'proposed')
        return;
    const equipment = result.state.instances[instance.instanceId].nodeStates.room;
    assert.equal(equipment.kind, 'equipment');
    if (equipment.kind === 'equipment') {
        assert.equal(equipment.durability, 120);
        assert.equal(equipment.lastActionId, 'attack:prior');
    }
    assert.equal(result.state.resources[lot.id].quantity, 0);
    assert.ok(result.successorSources.some(source => 'id' in source && source.id === lot.id && source.head === result.state.resources[lot.id].head));
});
