import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayerBreaths, PLAYER_BREATH_CAPACITY_MICRO } from '../src/features/play/player-breath-energy';
import { sealCreationResourceLot, createCreationResourceCustody } from '../src/features/play/creation/resource-registry';
import { sealCreationMetabolismSource, verifyCreationMetabolismSource, consumeCreationProduce, CREATION_CONSUMPTION_RULE_ID, CREATION_CONSUMPTION_RULE_HEAD } from '../src/features/play/creation/consumption';
import { creationSourceHead } from './support/creation-instance-fixtures';
function fixture(percent = 50) {
    const player = sealCreationMetabolismSource({ schema: 'wildz.creation-metabolism.v1', id: 'metabolism:owner', actorId: 'owner', revision: 0, parentHead: null, kaiUPulse: 100, breaths: createPlayerBreaths(100, percent) });
    const resource = createCreationResourceCustody(sealCreationResourceLot({ schema: 'wildz.creation-resource-lot.v1', id: 'food', kind: 'produce', quantity: 2, ownerId: 'owner', sourceId: 'garden', sourceHead: creationSourceHead, operationId: 'harvest:food', parentHeads: [creationSourceHead], kaiUPulse: 100 }));
    const sources = [{ id: player.id, head: player.head, kind: 'player-metabolism' }, { id: resource.id, head: resource.head, kind: 'material' }, { id: 'actor:owner', head: creationSourceHead, kind: 'actor' }, { id: `rule:${CREATION_CONSUMPTION_RULE_ID}`, head: CREATION_CONSUMPTION_RULE_HEAD, kind: 'rule' }];
    const context = { actorId: 'owner', rules: { [CREATION_CONSUMPTION_RULE_ID]: CREATION_CONSUMPTION_RULE_HEAD }, sources, verifySource: (s: {
            id: string;
            head: string;
            kind: string;
        }) => sources.some(a => a.id === s.id && a.head === s.head && a.kind === s.kind), mandates: [] };
    const command = { operationId: 'consume:food', actorId: 'owner', expectedPlayerHead: player.head, expectedResourceHead: resource.head, actorHead: creationSourceHead, kaiUPulse: 100, quantity: 1 };
    return { player, resource, context, command };
}
test('consuming finite produce debits exact custody and restores only its lawful breath amount', () => {
    const f = fixture(), result = consumeCreationProduce(f.player, f.resource, f.command, f.context);
    assert.equal(result.status, 'proposed');
    if (result.status !== 'proposed')
        return;
    assert.equal(result.resource.quantity, 1);
    assert.equal(result.resource.parentHead, f.resource.head);
    assert.equal(result.player.parentHead, f.player.head);
    assert.equal(result.player.breaths.reserveMicroBreaths - f.player.breaths.reserveMicroBreaths, 64 * 1000000);
    assert.equal(result.restoredMicroBreaths, 64 * 1000000);
    assert.equal(consumeCreationProduce(result.player, result.resource, f.command, f.context).status, 'rejected');
});
test('food recovery cannot exceed capacity and full energy cannot consume a lot', () => {
    const f = fixture(99.9), result = consumeCreationProduce(f.player, f.resource, f.command, f.context);
    assert.equal(result.status, 'proposed');
    if (result.status !== 'proposed')
        return;
    assert.equal(result.player.breaths.reserveMicroBreaths, PLAYER_BREATH_CAPACITY_MICRO);
    assert.equal(result.restoredMicroBreaths, PLAYER_BREATH_CAPACITY_MICRO - f.player.breaths.reserveMicroBreaths);
    const full = fixture(100);
    assert.equal(consumeCreationProduce(full.player, full.resource, full.command, full.context).status, 'rejected');
});
test('stale foreign stored malformed or unauthenticated food has zero effects', () => {
    const f = fixture();
    for (const input of [{ ...f.command, quantity: 0 }, { ...f.command, quantity: 3 }, { ...f.command, kaiUPulse: 99 }, { ...f.command, expectedResourceHead: creationSourceHead }, { ...f.command, actorId: 'other' }])
        assert.equal(consumeCreationProduce(f.player, f.resource, input, f.context).status, 'rejected');
    assert.equal(consumeCreationProduce(f.player, f.resource, f.command, { ...f.context, verifySource: () => false }).status, 'rejected');
    assert.equal(consumeCreationProduce(f.player, { ...f.resource, quantity: 200 }, f.command, f.context).status, 'rejected');
    assert.equal(consumeCreationProduce(f.player, { ...f.resource, containerId: 'storage' }, f.command, f.context).status, 'rejected');
});
test('the last finite food units become spent and retain their exact harvest provenance', () => {
    const f = fixture(), result = consumeCreationProduce(f.player, f.resource, { ...f.command, quantity: 2 }, f.context);
    assert.equal(result.status, 'proposed');
    if (result.status !== 'proposed')
        return;
    assert.equal(result.resource.quantity, 0);
    assert.equal(result.resource.spent, true);
    assert.equal(result.resource.originLot.head, f.resource.originLot.head);
    assert.equal(result.restoredMicroBreaths, 128 * 1000000);
    assert.equal(verifyCreationMetabolismSource(result.player), true);
    assert.equal(consumeCreationProduce(result.player, result.resource, { ...f.command, operationId: 'consume:again', expectedPlayerHead: result.player.head, expectedResourceHead: result.resource.head }, f.context).status, 'rejected');
});
