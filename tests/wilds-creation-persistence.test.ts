import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationStateFixture, creationInstanceFixture } from './support/creation-instance-fixtures';
import { exportCreationPersistence, restoreCreationPersistence } from '../src/features/play/creation/persistence';
import { emptyCreationState } from '../src/features/play/creation/state';
test('restores creation identity without a planner request', async () => { const original = creationInstanceFixture(), state = creationStateFixture(), saved = exportCreationPersistence(state); let plannerCalls = 0; const restored = await restoreCreationPersistence(saved, async (source) => source.id === original.instanceId && source.head === original.head); assert.equal(restored.state.instances[original.instanceId].instanceId, original.instanceId); assert.equal(plannerCalls, 0); assert.deepEqual(restored.state.definitions, state.definitions); });
test('unverified, altered and unsupported sources remain retained without becoming usable', async () => { const saved = exportCreationPersistence(creationStateFixture()); const unverified = await restoreCreationPersistence(saved, async () => false); assert.equal(Object.keys(unverified.state.instances).length, 0); assert.equal(unverified.retained.length, 1); const altered = JSON.parse(JSON.stringify(saved)); altered.instances[0].ownerId = 'forged-owner'; const tampered = await restoreCreationPersistence(altered, async () => true); assert.equal(Object.keys(tampered.state.instances).length, 0); const original = ' { "schema": "wildz.creation-persistence.v999", "payload": 7 } '; const future = await restoreCreationPersistence(original, async () => true); assert.equal(future.unsupported[0], original); });
test('legacy absence and missing assets are additive and do not fabricate restored geometry', async () => { assert.deepEqual((await restoreCreationPersistence(undefined, async () => false)).state, emptyCreationState()); const saved = exportCreationPersistence(creationStateFixture()); const result = await restoreCreationPersistence(saved, async () => true); assert.equal(result.retained.length, 0); });
test('malformed history is retained as unsupported instead of throwing or granting replay', async () => { const saved = JSON.parse(JSON.stringify(exportCreationPersistence(creationStateFixture()))); saved.receipts.bad = null; const restored = await restoreCreationPersistence(saved, async () => true); assert.equal(restored.unsupported.length, 1); assert.equal(Object.keys(restored.state.instances).length, 0); });
test('room grants survive checkpoints only after their current sources are verified', async () => {
    const { sealCreationOccupancyGrant } = await import('../src/features/play/creation/occupancy'), state = creationStateFixture(), instance = Object.values(state.instances)[0];
    const grant = sealCreationOccupancyGrant({ grantId: 'grant:home', instanceId: instance.instanceId, ownerId: 'owner', subjectId: 'visitor', roomNodeIds: ['room'], permissions: ['inhabit'], expiresAtKaiUPulse: null, revision: 0, parentHead: null, kaiUPulse: 1 });
    const checkpoint = exportCreationPersistence({ ...state, occupancyGrants: { [grant.grantId]: grant } });
    const restored = await restoreCreationPersistence(checkpoint, async () => true);
    assert.equal(restored.state.occupancyGrants?.[grant.grantId].head, grant.head);
    const unavailable = await restoreCreationPersistence(checkpoint, async (source) => source.kind !== 'creation-occupancy');
    assert.equal(Object.keys(unavailable.state.occupancyGrants || {}).length, 0);
    assert.equal(unavailable.retained.at(-1)?.reason, 'creation_occupancy_unverified');
});
test('missing referenced asset bytes retain the object without making it usable', async () => {
    const { creationDefinitionFixture } = await import('./support/creation-fixtures'), { createCreationInstance } = await import('../src/features/play/creation/instance');
    const definition = creationDefinitionFixture({ assets: [{ digest: `sha256:${'d'.repeat(64)}`, kind: 'texture', bytes: 64, vertices: 0, triangles: 0, uri: 'https://example.invalid/source-texture' }] });
    const instance = createCreationInstance({ instanceId: 'asset:home', definition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, kaiUPulse: 1 });
    const checkpoint = exportCreationPersistence({ ...emptyCreationState(), definitions: { [definition.digest]: definition }, instances: { [instance.instanceId]: instance }, custody: { [instance.instanceId]: 'owner' } });
    const restored = await restoreCreationPersistence(checkpoint, async () => true, async () => false);
    assert.equal(Object.keys(restored.state.instances).length, 0);
    assert.equal(restored.retained.length, 2);
    assert.equal(restored.retained[0].reason, 'creation_assets_unavailable');
    assert.deepEqual(restored.retained[1].value, checkpoint.instances[0]);
});
test('a receipt verification outage is retained without failing a valid object restore', async () => {
    const state = creationStateFixture(), instance = Object.values(state.instances)[0], head = `sha256:${'e'.repeat(64)}`;
    const checkpoint = exportCreationPersistence({ ...state, receipts: { op: { operationId: 'op', instanceId: instance.instanceId, commandDigest: head, successorHead: instance.head } } });
    const restored = await restoreCreationPersistence(checkpoint, async (source) => { if (source.kind === 'creation-receipt')
        throw Error('reader offline'); return true; });
    assert.equal(restored.state.instances[instance.instanceId].head, instance.head);
    assert.equal(Object.keys(restored.state.receipts).length, 0);
    assert.equal(restored.retained.at(-1)?.reason, 'creation_receipt_unverified');
});

test('checkpoint metabolism requires its exact authenticated source and never restores JSON energy alone', async () => {
 const { sealCreationMetabolismSource } = await import('../src/features/play/creation/consumption');
 const { createPlayerBreaths } = await import('../src/features/play/player-breath-energy');
 const source=sealCreationMetabolismSource({schema:'wildz.creation-metabolism.v1',id:'metabolism:owner',actorId:'owner',revision:0,parentHead:null,kaiUPulse:100,breaths:createPlayerBreaths(100,50)});
 const state={...emptyCreationState(),metabolism:{[source.id]:source}}, exported=exportCreationPersistence(state);
 const denied=await restoreCreationPersistence(exported,async()=>false);assert.deepEqual(denied.state.metabolism,{});assert.equal(denied.retained[0].reason,'creation_metabolism_unverified');
 const restored=await restoreCreationPersistence(exported,async ref=>ref.id===source.id&&ref.head===source.head&&ref.kind==='player-metabolism');assert.equal(restored.state.metabolism?.[source.id].head,source.head);
});
