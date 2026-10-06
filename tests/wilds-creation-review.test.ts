import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationDefinitionFixture, creationContextFixture } from './support/creation-fixtures';
import { creationAuthorityFixture, creationSourceHead } from './support/creation-instance-fixtures';
import { compileCreation } from '../src/features/play/creation/compiler';
import { deriveCreationGeometry, overlapsCreationSolids } from '../src/features/play/creation/geometry';
import { creationRegionIds, createCreationSpatialIndex, selectCreationNeighborhood } from '../src/features/play/creation/index';
import { createCreationPageIndex, selectCreationPages } from '../src/features/play/creation/residency';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { createCreationInstance, sealCreationInstance } from '../src/features/play/creation/instance';
import { emptyCreationState, type CreationState } from '../src/features/play/creation/state';
import { resolveCreationDamage, CREATION_DAMAGE_RULE_ID, CREATION_DAMAGE_RULE_HEAD, type CreationAttack } from '../src/features/play/creation/damage';
import type { CreationPageRef } from '../src/features/play/creation/chunks';

for (const mixed of [false, true]) {
  test(`an empty water adapter blocks ${mixed ? 'a mixed graph' : 'its own chunk'} before admission`, () => {
    const room = creationDefinitionFixture().nodes[0];
    const water = { ...room, id: 'water', shape: { kind: 'catalog' as const, piece: 'water', width: 4, height: 1, depth: 4 } };
    const result = compileCreation(creationDefinitionFixture({ nodes: mixed ? [room, water] : [water] }), creationContextFixture());
    assert.equal(result.status, 'blocked');
    if (result.status === 'blocked') assert.ok(result.blockers.some(b => b.code === 'geometry' && b.nodeId === 'water'));
  });
}

test('overlap follows the transformed thin bars at arbitrary positive and negative yaw', () => {
  const node = { ...creationDefinitionFixture().nodes[0], shape: { kind: 'box' as const, width: 4, height: 1, depth: .4 } };
  for (const yaw of [0, Math.PI / 2, Math.PI / 6, -Math.PI / 7, Math.PI * 2 / 3]) {
    const a = deriveCreationGeometry(node, { position: { x: 0, y: 0, z: 0 }, yaw }).solids[0];
    // Local depth is the normal to the long side. Two .4m-deep bars overlap only below .4m separation.
    const at = (separation: number) => deriveCreationGeometry(node, { position: { x: Math.sin(yaw) * separation, y: 0, z: Math.cos(yaw) * separation }, yaw }).solids[0];
    assert.equal(overlapsCreationSolids(a, at(.6)), false, `separated at ${yaw}`);
    assert.equal(overlapsCreationSolids(at(.6), a), false, `symmetric at ${yaw}`);
    assert.equal(overlapsCreationSolids(a, at(.3)), true, `intersecting at ${yaw}`);
    assert.equal(overlapsCreationSolids(a, at(.4)), false, `touching at ${yaw}`);
  }
});

test('compilation permits a separated rotated bar but blocks an intersecting one', () => {
  const yaw = Math.PI / 6;
  const node = { ...creationDefinitionFixture().nodes[0], shape: { kind: 'box' as const, width: 4, height: 1, depth: .4 }, pose: { position: { x: 0, y: 0, z: 0 }, yaw } };
  const definition = creationDefinitionFixture({ nodes: [node] });
  for (const [separation, expected] of [[.6, 'ready'], [.3, 'blocked']] as const) {
    const existing = deriveCreationGeometry(node, { position: { x: Math.sin(yaw) * separation, y: 0, z: Math.cos(yaw) * separation }, yaw });
    const physical = [{ chunkId: 'existing', head: creationSourceHead, terrain: [], solids: existing.solids, walkable: existing.walkable, portals: existing.connections }];
    assert.equal(compileCreation(definition, creationContextFixture({ physical })).status, expected);
  }
});

function page(id: string, bounds: CreationPageRef['bounds']): CreationPageRef {
  return { pageId: id, head: creationSourceHead, worldId: 'wildz', spaceId: 'surface', bounds, nodeIds: [id], dependencies: [], vertices: 100, drawCalls: 1, textureBytes: 0, uploadBytes: 3200 };
}
const floor = page('floor', { min: { x: -64, y: -.1, z: -64 }, max: { x: 64, y: .1, z: 64 } });
const adjacent = page('adjacent', { min: { x: 1, y: 0, z: 0 }, max: { x: 2, y: 1, z: 1 } });
const query = { worldId: 'wildz', spaceId: 'surface', position: { x: 0, y: 0, z: 0 }, radius: 8, limit: 128 };

test('neighborhood ranks containing bounds first and accounts for vertical distance', () => {
  const overhead = page('overhead', { min: { x: 0, y: 4, z: 0 }, max: { x: 1, y: 5, z: 1 } });
  const index = createCreationSpatialIndex([overhead, adjacent, floor].map(p => ({ ...p, instanceId: p.pageId, definitionDigest: creationSourceHead, regionIds: creationRegionIds(p.bounds) })));
  assert.deepEqual(selectCreationNeighborhood(index, query).map(e => e.instanceId), ['floor', 'adjacent', 'overhead']);
  assert.equal(selectCreationNeighborhood(index, { ...query, limit: 1 })[0].instanceId, 'floor');
});

test('initial one-page residency includes the floor containing the player', () => {
  const index = createCreationPageIndex([adjacent, floor]);
  const budget = { maximumPages: 1, maximumVertices: 100, maximumDrawCalls: 1, maximumTextureBytes: 0, maximumUploadBytesPerPaint: 4096 };
  assert.deepEqual(selectCreationPages(index, { ...query, pinnedPageIds: [] }, budget).map(p => p.pageId), ['floor']);
});

test('equally distant bounds retain stable source-ID ordering', () => {
  const index = createCreationPageIndex([{ ...floor, pageId: 'z-floor' }, { ...floor, pageId: 'a-floor' }]);
  assert.deepEqual(selectCreationNeighborhood(index, query).map(p => p.instanceId), ['a-floor', 'z-floor']);
});

test('a funded 4096m shape is blocked before its oversized chunk reaches the page index', () => {
  const node = { ...creationDefinitionFixture().nodes[0], shape: { kind: 'box' as const, width: 4096, height: 1, depth: 4096 } };
  const result = compileCreation(creationDefinitionFixture({ nodes: [node] }), creationContextFixture({ budget: { timber: 1_000_000_000 } }));
  assert.equal(result.status, 'blocked');
  if (result.status === 'blocked') assert.ok(result.blockers.some(b => b.message.includes('creation_index_region_budget')));
});

test('chunk coverage is checked after combining individually indexable shapes', () => {
  const base = { ...creationDefinitionFixture().nodes[0], shape: { kind: 'box' as const, width: 2016, height: 1, depth: 2016 } };
  const context = creationContextFixture({ budget: { timber: 1_000_000_000 } });
  const single = compileCreation(creationDefinitionFixture({ nodes: [base] }), context);
  assert.equal(single.status, 'ready');
  if (single.status === 'ready') assert.equal(creationRegionIds(single.plan.chunks[0].bounds).length, 4096);
  const second = { ...base, id: 'second', pose: { position: { x: 31, y: 0, z: 31 }, yaw: 0 } };
  const result = compileCreation(creationDefinitionFixture({ nodes: [base, second] }), context);
  assert.equal(result.status, 'blocked');
  if (result.status === 'blocked') assert.ok(result.blockers.some(b => b.message.includes('creation_index_region_budget')));
});

function damageFixture(self: boolean) {
  const base = creationDefinitionFixture().nodes[0];
  const weaponDefinition = creationDefinitionFixture({ nodes: [{ ...base, shape: { kind: 'box', width: .2, height: .1, depth: 1 }, behaviors: [{ id: 'weapon', version: 1, parameters: {} }] }] });
  const initial = createCreationInstance({ instanceId: 'weapon', definition: weaponDefinition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, kaiUPulse: 1 });
  const { head, ...basis } = initial; void head;
  const nodes = initializeCreationComponents(weaponDefinition, 1), equipment = nodes.room;
  if (equipment.kind !== 'equipment') throw Error('fixture equipment');
  const weapon = sealCreationInstance({ ...basis, stage: 'functional', nodeStates: { room: { ...equipment, equippedBy: 'owner' } } });
  const houseDefinition = creationDefinitionFixture();
  const houseInitial = createCreationInstance({ instanceId: 'house', definition: houseDefinition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, kaiUPulse: 1 });
  const { head: houseHead, ...houseBasis } = houseInitial; void houseHead;
  const house = sealCreationInstance({ ...houseBasis, stage: 'functional' });
  const target = self ? weapon : house;
  const state: CreationState = { ...emptyCreationState(), instances: { weapon, house }, definitions: { [weaponDefinition.digest]: weaponDefinition, [houseDefinition.digest]: houseDefinition }, custody: { weapon: 'owner', house: 'owner' } };
  const original = creationAuthorityFixture(state), rule = { id: `rule:${CREATION_DAMAGE_RULE_ID}`, head: CREATION_DAMAGE_RULE_HEAD, kind: 'rule' };
  const context = { ...original, rules: { ...original.rules, [CREATION_DAMAGE_RULE_ID]: CREATION_DAMAGE_RULE_HEAD }, sources: [...original.sources, rule], verifySource: (s: { id: string; head: string; kind: string }) => s.id === rule.id && s.head === rule.head && s.kind === rule.kind || original.verifySource(s) };
  const attack: CreationAttack = { operationId: 'strike:one', actorId: 'owner', instanceId: target.instanceId, expectedHeads: { [target.instanceId]: target.head, weapon: weapon.head, 'actor:owner': creationSourceHead }, kaiUPulse: 2, action: 'damage', nodeId: 'room', equipmentId: 'weapon', equipment: { actionId: 'strike:one', actorId: 'owner', expectedHead: weapon.head, targetId: target.instanceId, targetHead: target.head, spaceId: 'surface', position: { x: 0, y: 0, z: 0 }, targetPosition: { x: 0, y: 0, z: 0 }, kaiUPulse: 2 } };
  return { state, context, attack };
}

test('an equipped creation cannot attack itself or issue conflicting successors', () => {
  const f = damageFixture(true), result = resolveCreationDamage(f.state, f.attack, f.context);
  assert.equal(result.status, 'rejected');
  assert.equal(result.state, f.state);
  if (result.status === 'rejected') {
    assert.equal(result.reason, 'creation_damage_self_target_unavailable');
    assert.equal(result.writes, 0);
  }
  assert.deepEqual(result.state.receipts, {});
  assert.deepEqual(result.state.events, []);
});

test('a separate target joins damage and weapon wear with one successor per source', () => {
  const f = damageFixture(false), result = resolveCreationDamage(f.state, f.attack, f.context);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed') return;
  assert.equal(result.state.instances.house.nodeStates.room.condition, 96);
  const weapon = result.state.instances.weapon.nodeStates.room;
  assert.equal(weapon.kind, 'equipment');
  if (weapon.kind === 'equipment') assert.equal(weapon.durability, 119);
  assert.equal(result.successorSources.length, 2);
  assert.equal(new Set(result.successorSources.map(s => 'instanceId' in s ? s.instanceId : s.id)).size, 2);
  assert.equal(result.state.receipts[f.attack.operationId].successorHead, result.state.instances.house.head);
  assert.equal(result.state.instances.house.parentHead, f.state.instances.house.head);
  assert.equal(result.state.instances.weapon.parentHead, f.state.instances.weapon.head);
});
