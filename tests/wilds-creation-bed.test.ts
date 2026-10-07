import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creationDefinitionFixture, creationContextFixture } from './support/creation-fixtures';
import { compileCreation } from '../src/features/play/creation/compiler';
import { createCreationInstance, sealCreationInstance, type CreationInstance } from '../src/features/play/creation/instance';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { createCreationCurrentSourcePort, type CreationCurrentSource } from '../src/features/play/creation/current-source';
import { createCreationPhysicalStore } from '../src/features/play/creation/physical-store';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { canSleepInCreationBed, projectCreationBedSleepPose, resolveCreationBed, selectCreationBedAtPlayer } from '../src/features/play/creation/bed';
import { creationAccessPreset } from '../src/features/play/creation/access';

async function fixture(yaw = 0, home = false) {
  const base = creationDefinitionFixture().nodes[0];
  const definition = creationDefinitionFixture({ nodes: [...(home ? [base] : []), { ...base, id: 'bed', parentId: home ? 'room' : null, supports: home ? ['room'] : [], pose: { position: home ? { x: -1.2, y: .15, z: .8 } : { x: 0, y: 0, z: 0 }, yaw: 0 }, shape: { kind: 'box', width: .9, height: .2, depth: 2 }, behaviors: [{ id: 'bed', version: 1, parameters: {} }] }] });
  const context = creationContextFixture({ pose: { position: { x: 10, y: 3, z: 5 }, yaw } }), compiled = compileCreation(definition, context);
  if (compiled.status !== 'ready') throw Error('fixture compilation');
  const plan = compiled.plan;
  const initial = createCreationInstance({ instanceId: 'creation:bed', definition, ownerId: 'owner', worldId: 'wildz', spaceId: 'surface', pose: context.pose, kaiUPulse: 1 });
  const { head: unused, ...basis } = initial; void unused;
  let instance = sealCreationInstance({ ...basis, stage: 'functional', nodeStates: initializeCreationComponents(definition, 1) });
  const row = (): CreationCurrentSource => ({ status: 'available', instance, definition, planDigest: plan.digest, source: { fixtureOnly: true, head: instance.head } });
  const port = createCreationCurrentSourcePort({ read: async () => row(), authenticateCurrent: async source => source.instance.head === instance.head });
  const store = createCreationPhysicalStore({ project: async (i, d, p) => projectCreationPhysical(i, d, p), canReplace: async () => true });
  async function publish() {
    const source = await port.read({ instanceId: instance.instanceId, worldId: instance.worldId, spaceId: instance.spaceId });
    if (source.status !== 'available') throw Error('fixture current source');
    assert.equal(await store.adoptCurrent(source, plan), true);
  }
  await publish();
  return { store, instance, definition, plan, space: { spaceId: 'surface', position: { y: 3 } }, async update(changes: Partial<CreationInstance>) { const { head, ...current } = instance; instance = sealCreationInstance({ ...current, ...changes, parentHead: head, revision: instance.revision + 1, kaiUPulse: 2 }); await publish(); } };
}

test('only a real admitted healthy bed offers sleep at its physical footprint', async () => {
  const f = await fixture(), player = { x: 10, z: 5 };
  const bed = selectCreationBedAtPlayer(f.store.snapshot, player, f.space, 'owner', 2);
  assert.ok(bed); assert.equal(bed.instanceId, 'creation:bed'); assert.equal(bed.nodeId, 'bed');
  assert.equal(canSleepInCreationBed(bed, player, f.space, 'owner', 2), true);
  assert.equal(canSleepInCreationBed(JSON.parse(JSON.stringify(bed)), player, f.space, 'owner', 2), false);
  assert.equal(canSleepInCreationBed({ ...bed }, player, f.space, 'owner', 2), false);
  const copied = { ...f.store.snapshot(), projections: f.store.snapshot().projections.map(p => ({ ...p })) };
  assert.equal(selectCreationBedAtPlayer(copied, player, f.space, 'owner', 2), null);
  assert.equal(selectCreationBedAtPlayer(f.store.snapshot, { x: 12, z: 5 }, f.space, 'owner', 2), null);
  assert.equal(selectCreationBedAtPlayer(f.store.snapshot, player, { ...f.space, spaceId: 'elsewhere' }, 'owner', 2), null);
  assert.equal(selectCreationBedAtPlayer(f.store.snapshot, player, { ...f.space, position: { y: 5 } }, 'owner', 2), null);
  assert.equal(resolveCreationBed(f.store.snapshot, 'creation:bed', 'bed', 'visitor', 2), null);
  assert.equal(resolveCreationBed(f.store.snapshot, 'creation:bed', 'bed', 'owner', 0), null);
});

test('rotated beds use their real local footprint and align the sleep pose along the mattress', async () => {
  const f = await fixture(Math.PI / 2), player = { x: 11.2, z: 5 };
  const bed = selectCreationBedAtPlayer(f.store.snapshot, player, f.space, 'owner', 2);
  assert.ok(bed); assert.equal(canSleepInCreationBed(bed, player, f.space, 'owner', 2), true);
  assert.equal(canSleepInCreationBed(bed, { x: 10, z: 6.2 }, f.space, 'owner', 2), false);
  const pose = projectCreationBedSleepPose(bed, { x: 10, z: 5 }, 3, 'owner', 2);
  assert.ok(pose);
  assert.ok(Math.abs(pose.position[0] + .72) < 1e-9); assert.ok(Math.abs(pose.position[2]) < 1e-9);
  assert.ok(Math.abs(pose.position[1] - .42) < 1e-9);
  assert.ok(Math.abs(pose.heading - Math.PI / 2) < 1e-9); assert.equal(pose.pitch, Math.PI / 2);
});

test('walking past distant beds never reparses their definitions', async () => {
  const f = await fixture(), snapshot = f.store.snapshot();
  let reads = 0;
  const definitions = { ...snapshot.definitions };
  Object.defineProperty(definitions, f.instance.definitionDigest, { enumerable: true, get() { reads++; return f.definition; } });
  const source = { ...snapshot, definitions };
  for (let index = 0; index < 100; index++) {
    assert.equal(selectCreationBedAtPlayer(source, { x: 100 + index, z: 100 }, f.space, 'owner', 2), null);
  }
  assert.equal(reads, 0);
  assert.ok(selectCreationBedAtPlayer(source, { x: 10, z: 5 }, f.space, 'owner', 2));
  assert.ok(reads > 0, 'beds within reach must still pass source validation');
});

test('approaching a home doorway does not validate a bed across the room', async () => {
  const f = await fixture(0, true), snapshot = f.store.snapshot();
  let reads = 0;
  const definitions = { ...snapshot.definitions };
  Object.defineProperty(definitions, f.instance.definitionDigest, { enumerable: true, get() { reads++; return snapshot.definitions[f.instance.definitionDigest]; } });
  const source = { ...snapshot, definitions };
  for (let i = 0; i < 100; i++) {
    assert.equal(selectCreationBedAtPlayer(source, { x: 10, z: 2.5 + i * .01 }, f.space, 'owner', 2 + i), null);
  }
  assert.equal(reads, 0, 'the mattress footprint must reject an out-of-reach bed before parsing the home');
});

test('remaining beside an unchanged admitted bed reuses its validated sleep source across clock ticks', async () => {
  const f = await fixture(), player = { x: 10, z: 5 };
  const first = selectCreationBedAtPlayer(f.store.snapshot, player, f.space, 'owner', 2);
  assert.ok(first);
  for (let tick = 3; tick < 103; tick++) {
    assert.equal(selectCreationBedAtPlayer(f.store.snapshot, player, f.space, 'owner', tick), first);
  }
  await f.update({ ownerId: 'recipient', stewardId: 'recipient' });
  assert.equal(selectCreationBedAtPlayer(f.store.snapshot, player, f.space, 'owner', 104), null);
  assert.equal(canSleepInCreationBed(first, player, f.space, 'owner', 104), false);
});

test('a mutable copied instance cannot keep sleep authority after an in-place edit', async () => {
  const f = await fixture(), original = f.store.snapshot();
  const instance = JSON.parse(JSON.stringify(original.instances[f.instance.instanceId]));
  const snapshot = { ...original, instances: { [instance.instanceId]: instance } };
  const bed = resolveCreationBed(snapshot, instance.instanceId, 'bed', 'owner', 2);
  assert.ok(bed);
  instance.nodeStates.bed.condition = 0;
  assert.equal(canSleepInCreationBed(bed, { x: 10, z: 5 }, f.space, 'owner', 3), false);
});

test('a reusable public bed source retains occupancy checks for a different actor', async () => {
  const f = await fixture(), player = { x: 10, z: 5 };
  const state = f.store.snapshot().instances[f.instance.instanceId].nodeStates.bed;
  if (state.kind !== 'bed') throw Error('fixture bed state');
  await f.update({ access: creationAccessPreset('public'), nodeStates: { bed: { ...state, occupantIds: ['owner'] } } });
  const bed = resolveCreationBed(f.store.snapshot, f.instance.instanceId, 'bed', 'owner', 3);
  assert.ok(bed);
  assert.equal(canSleepInCreationBed(bed, player, f.space, 'owner', 3), true);
  assert.equal(canSleepInCreationBed(bed, player, f.space, 'visitor', 3), false);
  assert.equal(projectCreationBedSleepPose(bed, player, 3, 'visitor', 3), null);
  assert.equal(resolveCreationBed(f.store.snapshot, f.instance.instanceId, 'bed', 'visitor', 3), null);
});

test('diagonally rotated mattress edges retain their full local sleep reach', async () => {
  const yaw = Math.PI / 4, f = await fixture(yaw);
  const player = { x: 10 + .8 * Math.cos(yaw) + 1.35 * Math.sin(yaw), z: 5 - .8 * Math.sin(yaw) + 1.35 * Math.cos(yaw) };
  const source = resolveCreationBed(f.store.snapshot, f.instance.instanceId, 'bed', 'owner', 2)!;
  assert.equal(canSleepInCreationBed(source, player, f.space, 'owner', 2), true);
  assert.ok(selectCreationBedAtPlayer(f.store.snapshot, player, f.space, 'owner', 2));
});

test('a retained bed source becomes unusable after current transfer, damage or occupancy', async () => {
  const f = await fixture(), player = { x: 10, z: 5 };
  const bed = resolveCreationBed(f.store.snapshot, 'creation:bed', 'bed', 'owner', 2); assert.ok(bed);
  await f.update({ ownerId: 'recipient', stewardId: 'recipient' });
  assert.equal(canSleepInCreationBed(bed, player, f.space, 'owner', 3), false);
  assert.equal(projectCreationBedSleepPose(bed, player, 3, 'owner', 3), null);
  const next = resolveCreationBed(f.store.snapshot, 'creation:bed', 'bed', 'recipient', 3); assert.ok(next);
  const current = f.store.snapshot().instances['creation:bed'], state = current.nodeStates.bed;
  if (state.kind !== 'bed') throw Error('fixture bed state');
  await f.update({ nodeStates: { bed: { ...state, occupantIds: ['resident:other'] } } });
  assert.equal(resolveCreationBed(f.store.snapshot, 'creation:bed', 'bed', 'recipient', 3), null);
  await f.update({ nodeStates: { bed: { ...state, condition: 0 } } });
  assert.equal(resolveCreationBed(f.store.snapshot, 'creation:bed', 'bed', 'recipient', 3), null);
});
