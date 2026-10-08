import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CREATION_WORLD_RULE_HEAD, CREATION_WORLD_PHYSICAL_EVOLUTION_RULE_HEAD } from '../src/features/play/creation/world-source';
import { CREATION_PHYSICAL_BUILD_REACH_RULE } from '../src/features/play/creation/build-reach';
import { createReceizInMemoryOfflineProofQueueStorage } from '@receiz/sdk';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { initialWildsWorldProjection, checkpointWildsWorld, replayWildsWorld, reduceWildsWorldEvent } from '../src/features/play/wilds-world-state';
import { WildsWorldService } from '../src/features/play/wilds-world-service';
import { assertWildsCreationOutboxContinuity, createWildsWorldEdgeAdmissionQueue, persistWildsWorldCommandDurably, restoreWildsWorldEdgeSource, preserveWildsConstructionHistory, type WildsWorldOutboxEntry } from '../src/features/play/wilds-world-outbox';
import { createWildsWorldEvent } from '../src/features/play/wilds-world-event';
import { createWorldCreationController } from '../src/features/play/creation/world-controller';
import { createWorldCreationSourceCompiler, creationWorldSourceHead, creationWorldAvailability, compileWorldCreationSource, projectWildsCreationPersistence, resolveWorldCreationLivestockShelter, isWorldCreationSuccessor, type WildsCreationConstructCommand, type WildsCreationEvolveCommand, type WildsCreationBuildCommand } from '../src/features/play/creation/world-source';
import { createCreationDefinition } from '../src/features/play/creation/definition';
import { compileCreation, type CreationCompileContext, type CreationPlan } from '../src/features/play/creation/compiler';
import { selectCreationResources } from '../src/features/play/creation/resources';
import { projectCreationWorkers, combineCreationTechniques } from '../src/features/play/creation/capabilities';
import { sealCreationInstance } from '../src/features/play/creation/instance';
import { reviseCreationInstance } from '../src/features/play/creation/evolution';
import { resolveWildsLivestockShelter } from '../src/features/play/wilds-livestock';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { prepareCreationNavigation, resolveCreationMovement } from '../src/features/play/creation/navigation';
import type { CreationPoint, CreationPose, CreationShape } from '../src/features/play/creation/types';
import { applyWildsInput, initialPlayState, type PlayState } from '../src/features/play/game-state';
import { admitWildsDiscoveryPhysicalNeighborhood, wildsDiscoverySiteRegionForPosition } from '../src/features/play/wilds-discovery-sites';
import { prepareWildsSiteRuntime } from '../src/features/play/wilds-site-runtime';
import { sampleWildsTerrain } from '../src/features/play/wilds-terrain-authority';
import { wildsTerrainObstaclesForTile } from '../src/features/play/wilds-terrain-obstacles';
import { constructionProofDigest } from '../src/features/play/wilds-construction-project';
import { projectWildsOwnedWorldAdditions, mergeWildsOwnedWorldAdditions, mergeWildsOwnedAdditionSets } from '../src/features/play/wilds-player-world-additions';
import { worldCreationImagePayload } from '../src/features/play/creation/world-image';
import { validateCreationImage } from '../src/features/play/creation/image';
import { createWildzContinuityDatabase } from '../src/lib/storage/wildz-indexed-db';
import { createFakeIndexedDb } from './support/fake-indexed-db';
import type { ReceizOfflineProofQueueSnapshot } from '@receiz/sdk';

const actorId = 'owner:creation-world', pulse = '2026-10-06T12:00:00.000Z';
const authority = { actorId, canonical: true, pulse, occurredAt: pulse, uPulse: 20 };
function fixture(ownerId = actorId, captureOwnerId = ownerId) {
  const source = Array.from({ length: 25 }, (_, index) => projectWildsResourceRegion(index - 12, 0)).flat().find(candidate => candidate.kind === 'timber')!;
  const harvested = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: ownerId, actorPosition: source.position, kaiUPulse: 10 });
  const world = { ...initialWildsWorldProjection(), materialLots: { [harvested.lot.lotId]: harvested.lot }, harvestedSources: { [source.sourceId]: harvested.source } };
  const card = sealCollectedCard({ capturedAt: pulse, encounterId: 'creation-world-source-card', formId: 'mintcub-1', ownerReceizId: captureOwnerId });
  const condition = emptyAdventureCondition(card.id);
  const definition = createCreationDefinition({ schema: 'wildz.creation-definition.v1', grammarVersion: 1, seed: 'creation-world-source', creatorId: ownerId, assets: [], nodes: [{ id: 'bench', parentId: null, pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, shape: { kind: 'box', width: .8, height: .3, depth: .8 }, material: 'timber', attachments: [], supports: [], behaviors: [] }] });
  const context: CreationCompileContext = { worldId: world.worldId, spaceId: 'wildz.space.outer.v1', pose: { position: { x: 5000, y: 100, z: 5000 }, yaw: 0 }, sourceHead: creationWorldSourceHead(world), budget: { timber: 1 }, techniques: combineCreationTechniques(projectCreationWorkers([card], { [card.id]: condition })), physical: [], quality: 'low' };
  const compiled = compileCreation(definition, context); if (compiled.status !== 'ready') throw Error('fixture_compile');
  const resources = selectCreationResources(Object.values(world.materialLots), context.budget, compiled.plan.requiredResources, creationWorldAvailability(world, ownerId));
  const command: WildsCreationConstructCommand = { type: 'creation.construct', commandId: 'creation:command:source', instanceId: 'creation:instance:source', definition, context, planDigest: compiled.plan.digest, workerSources: [{ card, condition }], resources: resources.lots, actorPosition: context.pose.position };
  return { world, card, condition, definition, context, plan: compiled.plan, command, lotId: harvested.lot.lotId };
}
const entry = (command: WildsCreationBuildCommand): WildsWorldOutboxEntry => ({ schema: 'receiz.wilds_world_outbox_entry.v1', actorId, guestId: 'guest:creation-source', command, queuedAt: pulse });

function admittedMovementCreation(shape: CreationShape, pose: CreationPose, instanceId: string) {
  const f = fixture();
  const { digest, ...basis } = f.definition;
  void digest;
  const definition = createCreationDefinition({ ...basis, nodes: [{ ...f.definition.nodes[0], id: 'movement-geometry', shape }] });
  const context = { ...f.context, pose };
  const compiled = compileCreation(definition, context);
  assert.equal(compiled.status, 'ready');
  if (compiled.status !== 'ready') throw Error('movement_fixture_compile');
  const resources = selectCreationResources(Object.values(f.world.materialLots), context.budget, compiled.plan.requiredResources, creationWorldAvailability(f.world, actorId));
  assert.deepEqual(resources.deficits, {});
  const command = { ...f.command, commandId: `command:${instanceId}`, instanceId, definition, context, planDigest: compiled.plan.digest, resources: resources.lots, actorPosition: pose.position };
  const result = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).execute(command, authority);
  assert.equal(result.constitution.result, 'VALID');
  const source = result.projection.creations![instanceId];
  assert.equal(source.instance.stage, 'functional');
  const projection = projectCreationPhysical(source.instance, source.command.definition, compileWorldCreationSource(source));
  return { source, projection, navigation: prepareCreationNavigation([projection]) };
}

function movementState(position: CreationPoint): PlayState {
  return { ...initialPlayState, player: { x: position.x, z: position.z }, siteSpace: { version: 'wildz.site-space-state.v1', spaceId: 'wildz.space.outer.v1', siteKey: null, surfaceId: null, position, flooded: false } };
}

function naturalMovementRuntime(position: CreationPoint) {
  const region = wildsDiscoverySiteRegionForPosition(position);
  return prepareWildsSiteRuntime(admitWildsDiscoveryPhysicalNeighborhood(region.x, region.z));
}

for (const { requirement, x, z } of [{ requirement: 'swim', x: -1000, z: -1000 }, { requirement: 'climb', x: 76, z: -124 }] as const) {
  test(`an admitted created floor permits walking over ${requirement}-restricted ground without granting terrain traversal`, () => {
    const pose = { position: { x, y: 100, z }, yaw: 0 };
    const f = admittedMovementCreation({ kind: 'box', width: 8, height: .01, depth: 8 }, pose, `floor-over-${requirement}`);
    const start = { x, y: 100.01, z }, state = movementState(start), siteRuntime = naturalMovementRuntime(start);
    assert.ok(sampleWildsTerrain(x + 1.05, z).traversal.some(entry => entry.kind === requirement));
    const moved = applyWildsInput(state, { type: 'move', direction: 'east', siteRuntime, creationNavigation: f.navigation });
    assert.ok(Math.abs(moved.player.x - x - 1.05) < .000001, moved.lastEvent);
    assert.ok(Math.abs(moved.siteSpace.position.y - start.y) < .000001);
    const edgeFloor = admittedMovementCreation({ kind: 'box', width: 8, height: .01, depth: 8 }, { position: { x: x - 3.6, y: 100, z }, yaw: 0 }, `floor-edge-${requirement}`);
    const edge = start, leaving = applyWildsInput(movementState(edge), { type: 'move', direction: 'east', siteRuntime, creationNavigation: edgeFloor.navigation });
    assert.ok(sampleWildsTerrain(edge.x + 1.05, z).traversal.some(entry => entry.kind === requirement));
    assert.deepEqual(leaving.player, { x: edge.x, z: edge.z }, 'the floor must not grant traversal outside its footprint');
    assert.ok(Math.abs(leaving.siteSpace.position.y - edge.y) < .000001);
  });
}

test('sliding against an admitted created wall preserves the generated trunk collision checked earlier in gameplay', () => {
  const tree = wildsTerrainObstaclesForTile(-5, 1).find(obstacle => obstacle.id === 'wildz.terrain.v1:-5:1:tree:0')!;
  assert.equal(tree.kind, 'tree');
  const pose = { position: { x: tree.position.x - tree.radius - .12, y: tree.position.y - .2, z: tree.position.z }, yaw: 0 };
  const f = admittedMovementCreation({ kind: 'box', width: .2, height: 1.6, depth: 2 }, pose, 'wall-beside-generated-trunk');
  const point = { x: tree.position.x - tree.radius + .34, z: tree.position.z - tree.radius - .48 };
  const start = { x: point.x, y: sampleWildsTerrain(point.x, point.z).elevation, z: point.z }, state = movementState(start), siteRuntime = naturalMovementRuntime(start);
  const input = { type: 'move-vector' as const, x: 0, z: 1, siteRuntime };
  const groundOnly = applyWildsInput(state, input), moved = applyWildsInput(state, { ...input, creationNavigation: f.navigation });
  const trunkDistance = (position: PlayState['player']) => Math.hypot(position.x - tree.position.x, position.z - tree.position.z);
  const clearance = tree.radius + .38;
  assert.ok(trunkDistance(groundOnly.player) >= clearance - .00001);
  assert.ok(trunkDistance(moved.player) >= clearance - .00001, `creation sliding entered the natural trunk: ${trunkDistance(moved.player)} < ${clearance}`);
  const stationary = resolveCreationMovement(f.navigation, f.source.instance.spaceId, moved.siteSpace.position, moved.siteSpace.position);
  assert.equal(stationary.blocked, false, 'preserving trunk clearance must also preserve the creation wall constraint');
});

test('unchanged complete creation source reuses compilation while returned geometry and nested mutations remain isolated', () => {
  const f = fixture(), result = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).execute(f.command, authority);
  const source = result.projection.creations![f.command.instanceId];
  const compiler = createWorldCreationSourceCompiler({ maxEntries: 1, maxBytes: 1024 * 1024 });
  const first = compiler.compile(source), second = compiler.compile(structuredClone(source));
  assert.equal(first.digest, f.plan.digest);
  assert.equal(second.digest, f.plan.digest);
  assert.equal(compiler.stats().compilations, 1, 'an exact unchanged source must not rebuild its geometry and proof ancestry');
  assert.equal(compiler.stats().reused, 1);
  const originalPosition = second.chunks[0].positions[0];
  first.chunks[0].positions[0] = 123456;
  second.chunks[0].positions[0] = 654321;
  assert.equal(compiler.compile(source).chunks[0].positions[0], originalPosition);
  const altered = structuredClone(source);
  (altered.command.workerSources[0].condition as { fatigue: number }).fatigue = 100;
  assert.throws(() => compiler.compile(altered), /record_invalid/);
  assert.equal(compiler.stats().entries, 1);
  const other = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).execute({ ...f.command, commandId: 'creation:cache:replacement' }, authority).projection.creations![f.command.instanceId];
  compiler.compile(other);
  assert.equal(compiler.stats().entries, 1);
  assert.ok(compiler.stats().bytes <= 1024 * 1024);
  compiler.compile(source);
  assert.equal(compiler.stats().compilations, 3, 'evicted exact source must be checked again');
  const uncached = createWorldCreationSourceCompiler({ maxBytes: 0 });
  uncached.compile(source); uncached.compile(source);
  assert.equal(uncached.stats().compilations, 2);
  assert.equal(uncached.stats().entries, 0);
  assert.equal(Object.keys(projectWildsCreationPersistence(result.projection).creations).length, 1);
  assert.equal(Object.keys(projectWildsCreationPersistence({ ...result.projection, creationEvents: {} }).creations).length, 0);
  assert.equal(Object.keys(projectWildsCreationPersistence({ ...result.projection, consumedMaterialLots: {} }).creations).length, 0);
  assert.equal(Object.keys(projectWildsCreationPersistence({ ...result.projection, creations: { [f.command.instanceId]: altered } }).creations).length, 0);
});

test('registered source admission consumes exact finite materials, replays and deduplicates one functional instance', () => {
  const f = fixture(), service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) });
  const result = service.execute(f.command, authority);
  assert.equal(result.constitution.result, 'VALID');
  assert.equal(result.events.length, 1);
  const source = result.projection.creations![f.command.instanceId];
  assert.equal(source.instance.stage, 'functional');
  assert.equal(result.projection.consumedMaterialLots[f.lotId], source.instance.instanceId);
  assert.equal(compileWorldCreationSource(source).digest, f.plan.digest);
  assert.deepEqual(replayWildsWorld(result.events, checkpointWildsWorld(f.world)), result.projection);
  assert.equal(reduceWildsWorldEvent(result.projection, result.events[0]), result.projection);
  assert.equal(service.execute(f.command, authority).events.length, 0);
  assert.throws(() => service.execute({ ...f.command, instanceId: 'creation:instance:conflict' }, authority), /command_conflict/);
  const secondContext = { ...f.context, sourceHead: creationWorldSourceHead(result.projection), pose: { ...f.context.pose, position: { ...f.context.pose.position, x: 5005 } } };
  const secondPlan = compileCreation(f.definition, secondContext); assert.equal(secondPlan.status, 'ready');
  assert.throws(() => service.execute({ ...f.command, commandId: 'creation:command:spent', instanceId: 'creation:instance:spent', context: secondContext, planDigest: secondPlan.status === 'ready' ? secondPlan.plan.digest : '', actorPosition: secondContext.pose.position }, authority), /materials_unavailable/);
});

test('world execution accepts the same owner handle and Receiz profile alias without rewriting worker proofs', () => {
  for (const [owner, captureOwner] of [['creation_keeper', 'creation_keeper.receiz.id'], ['creation_keeper.receiz.id', 'creation_keeper']] as const) {
    const f = fixture(owner, captureOwner), service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) });
    const result = service.execute(f.command, { ...authority, actorId: owner });
    assert.equal(result.constitution.result, 'VALID');
    assert.equal(result.events.length, 1);
    const source = result.projection.creations![f.command.instanceId];
    assert.equal(source.instance.ownerId, owner);
    assert.deepEqual(source.command.workerSources[0].card, f.card);
    assert.equal(source.command.workerSources[0].card.manifest.ownerReceizId, captureOwner);
    assert.deepEqual(source.instance.embeddedResources, [{ id: f.lotId, head: f.world.materialLots[f.lotId].head, kind: 'timber', quantity: 1 }]);
    assert.equal(result.projection.consumedMaterialLots[f.lotId], source.instance.instanceId);
    assert.equal(compileWorldCreationSource(source).digest, f.plan.digest);
    assert.deepEqual(replayWildsWorld(result.events, checkpointWildsWorld(f.world)), result.projection);
    assert.equal(service.execute(f.command, { ...authority, actorId: owner }).events.length, 0);
  }
});

test('owner alias matching cannot admit another owner, a forged card or a mismatched condition', () => {
  for (const captureOwner of ['creation_keeper_other.receiz.id', 'creation_keeper.receiz.id.evil', 'previous_keeper.receiz.id']) {
    const f = fixture('creation_keeper', captureOwner), service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) });
    assert.throws(() => service.execute(f.command, { ...authority, actorId: 'creation_keeper' }), /creation_world_worker_source_invalid/);
    assert.deepEqual(service.snapshot(), f.world);
  }
  const f = fixture('creation_keeper', 'creation_keeper.receiz.id');
  const forged = structuredClone(f.card); forged.proof.digest = `sha256:${'f'.repeat(64)}`;
  for (const worker of [{ card: forged, condition: f.condition }, { card: f.card, condition: { ...f.condition, assetId: 'another:card' } }]) {
    const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) });
    assert.throws(() => service.execute({ ...f.command, workerSources: [worker] }, { ...authority, actorId: 'creation_keeper' }), /creation_world_worker_source_invalid/);
    assert.deepEqual(service.snapshot(), f.world);
  }
});

test('source boundary rejects altered plans, foreign cards, exhausted crew and omitted canonical tree chunks', () => {
  const f = fixture();
  const reject = (command: WildsCreationConstructCommand, expected: RegExp) => {
    const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) });
    assert.throws(() => service.execute(command, authority), expected);
    assert.deepEqual(service.snapshot(), f.world);
  };
  reject({ ...f.command, planDigest: `sha256:${'f'.repeat(64)}` }, /plan_stale/);
  reject({ ...f.command, workerSources: [{ ...f.command.workerSources[0], condition: { ...f.condition, fatigue: 100 } }] }, /worker_not_ready/);
  const foreign = sealCollectedCard({ capturedAt: pulse, encounterId: 'foreign-worker', formId: 'mintcub-1', ownerReceizId: 'another:owner' });
  reject({ ...f.command, workerSources: [{ card: foreign, condition: emptyAdventureCondition(foreign.id) }] }, /worker_source_invalid/);
  const tree = Array.from({ length: 30 }, (_, index) => wildsTerrainObstaclesForTile(index, 1)).flat().find(obstacle => obstacle.kind === 'tree')!;
  const treeContext = { ...f.context, pose: { position: { ...tree.position, y: tree.position.y + .4 }, yaw: 0 }, physical: [] };
  const treePlan = compileCreation(f.definition, treeContext); assert.equal(treePlan.status, 'ready');
  reject({ ...f.command, context: treeContext, planDigest: treePlan.status === 'ready' ? treePlan.plan.digest : '', actorPosition: treeContext.pose.position }, /canonical_overlap/);
});

test('placement previews detect canonical terrain outside the supplied visible chunks without spending materials', () => {
  const f = fixture();
  const controller = createWorldCreationController({ environment: () => ({ ownerId: actorId, worldId: f.world.worldId, spaceId: f.context.spaceId }),
    world: () => f.world, crew: () => ({ cards: [f.card], conditions: { [f.card.id]: f.condition } }), position: () => f.context.pose.position,
    compileContext: () => f.context, admit: async () => { throw Error('preview must not admit'); }, project: async (instance, definition, plan) => projectCreationPhysical(instance, definition, plan) });
  const validate = (controller as unknown as { validatePlacement?: (plan: CreationPlan) => string | null }).validatePlacement;
  try {
    assert.equal(typeof validate, 'function');
    assert.equal(validate!(f.plan), null);
    const tree = Array.from({ length: 30 }, (_, index) => wildsTerrainObstaclesForTile(index, 1)).flat().find(obstacle => obstacle.kind === 'tree')!;
    // The hidden obstruction is in an offset wing, not at the mansion's origin.
    const { digest, ...basis } = f.definition; void digest;
    const definition = createCreationDefinition({ ...basis, nodes: [{ ...f.definition.nodes[0], pose: { position: { x: 40, y: 0, z: 0 }, yaw: 0 } }] });
    const context = { ...f.context, pose: { position: { ...tree.position, x: tree.position.x - 40, y: tree.position.y + .4 }, yaw: 0 }, physical: [] };
    const result = compileCreation(definition, context); assert.equal(result.status, 'ready');
    if (result.status !== 'ready') throw Error('fixture_compile');
    assert.match(validate!(result.plan)!, /overlaps.*world|world.*overlap/i);
    assert.deepEqual(f.world.consumedMaterialLots, {});
    assert.equal(controller.snapshot().projections.length, 0);
    assert.equal(validate!({ ...f.plan, sourceHead: `sha256:${'e'.repeat(64)}` }) === null, false);
  } finally { controller.close(); }
});

test('replay rejects a forged successor even if its enclosing event digest is recomputed', () => {
  const f = fixture(), service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }), result = service.execute(f.command, authority), original = result.events[0];
  const payload = structuredClone(original.payload) as { record: { instance: { stage: string } } };
  payload.record.instance.stage = 'finished';
  const forged = createWildsWorldEvent({ kind: original.kind, actorId: original.actorId, causeId: original.causeId, pulse: original.pulse, kaiKlok: original.kaiKlok, uPulse: original.uPulse, occurredAt: original.occurredAt, previousEventId: original.previousEventId, payload });
  assert.throws(() => reduceWildsWorldEvent(f.world, forged), /successor_invalid/);
});

test('durable source restoration rebuilds collision/navigation without redispatch, and weaker snapshots cannot erase consumption', async () => {
  const f = fixture(), storage = createReceizInMemoryOfflineProofQueueStorage();
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: f.world, persist: candidate => persistWildsWorldCommandDurably(candidate, storage) });
  await queue.admit(entry(f.command));
  const restored = await restoreWildsWorldEdgeSource(f.world, actorId, storage);
  assert.equal(restored.creations![f.command.instanceId].instance.head, queue.current().creations![f.command.instanceId].instance.head);
  assert.equal(preserveWildsConstructionHistory(restored, f.world), restored);
  let dispatches = 0;
  const controller = createWorldCreationController({ environment: () => ({ ownerId: actorId, worldId: f.world.worldId, spaceId: f.context.spaceId }), world: () => restored, crew: () => ({ cards: [f.card], conditions: { [f.card.id]: f.condition } }), position: () => f.context.pose.position, compileContext: () => f.context, admit: async () => { dispatches++; throw Error('must_not_dispatch'); }, project: async (instance, definition, plan) => projectCreationPhysical(instance, definition, plan) });
  assert.equal(await controller.restore(), 1);
  assert.equal(dispatches, 0);
  assert.equal(controller.snapshot().navigation.instanceCount, 1);
  assert.equal(controller.snapshot().projections[0].solids.length, 1);
  assert.equal((await controller.resolve(f.command.instanceId))?.instance.stage, 'functional');
});

test('world controller installs real finite admission and refuses a crew condition change at final persistence fence', async () => {
  const f = fixture(), storage = createReceizInMemoryOfflineProofQueueStorage();
  let condition = f.condition, invalidate = false, writes = 0;
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: f.world, persist: async candidate => { writes++; await persistWildsWorldCommandDurably(candidate, storage); } });
  const controller = createWorldCreationController({ environment: () => ({ ownerId: actorId, worldId: f.world.worldId, spaceId: f.context.spaceId }), world: queue.current, crew: () => ({ cards: [f.card], conditions: { [f.card.id]: condition } }), position: () => f.context.pose.position, compileContext: (plan: CreationPlan) => ({ ...f.context, pose: plan.pose, sourceHead: creationWorldSourceHead(queue.current()) }), admit: async (command, beforeAdmit) => {
    if (invalidate) condition = { ...condition, life: 'dead' };
    const projection = await queue.admit(entry(command), { beforeAdmit });
    return { projection, events: [] };
  }, project: async (instance, definition, plan) => projectCreationPhysical(instance, definition, plan) });
  const workerId = projectCreationWorkers([f.card], { [f.card.id]: condition })[0].subjectId;
  invalidate = true;
  assert.equal((await controller.commit(f.definition, f.plan, [workerId])).status, 'rejected');
  assert.equal(writes, 0); assert.equal(controller.snapshot().projections.length, 0);
  condition = f.condition; invalidate = false;
  assert.equal((await controller.commit(f.definition, f.plan, [workerId])).status, 'admitted');
  assert.equal(writes, 1); assert.equal(controller.snapshot().projections.length, 1);
  assert.equal(queue.current().consumedMaterialLots[f.lotId], controller.snapshot().projections[0].instanceId);
  assert.equal(constructionProofDigest(controller.snapshot().definitions[f.definition.digest]), constructionProofDigest(f.definition));
});

test('durable aggregate lot conflict rejects a second stale-device source before visible adoption', async () => {
  const f = fixture(), storage = createReceizInMemoryOfflineProofQueueStorage();
  const first = createWildsWorldEdgeAdmissionQueue({ initialProjection: f.world, persist: candidate => persistWildsWorldCommandDurably(candidate, storage) });
  const stale = createWildsWorldEdgeAdmissionQueue({ initialProjection: f.world, persist: candidate => persistWildsWorldCommandDurably(candidate, storage) });
  await first.admit(entry(f.command));
  await assert.rejects(stale.admit(entry({ ...f.command, commandId: 'creation:command:stale-device', instanceId: 'creation:instance:stale-device' })), /durable_material_conflict/);
  assert.equal(Object.keys(stale.current().creations ?? {}).length, 0);
});

test('default atomic admission retains creation continuity, finite consumption and worker lease authority', async () => {
  const f = fixture(), fake = createFakeIndexedDb(), previousFactory = globalThis.indexedDB;
  const database = createWildzContinuityDatabase({ factory: fake.factory });
  const workerId = projectCreationWorkers([f.card], { [f.card.id]: f.condition })[0].subjectId;
  const leaseKey = JSON.stringify(['wildz.crew.v1', actorId, 'creation-lease', workerId]);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fake.factory });
  try {
    await database.transaction(['meta'], 'readwrite', tx => tx.put('meta', { commandId: 'creation:reserved' }, leaseKey));
    const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: f.world, persist: persistWildsWorldCommandDurably });
    await assert.rejects(queue.admit(entry(f.command)), /worker_reserved/);
    assert.equal(queue.current().revision, 0);
    await database.transaction(['meta'], 'readwrite', tx => tx.delete('meta', leaseKey));
    await queue.admit(entry(f.command));
    assert.equal(queue.current().consumedMaterialLots[f.lotId], f.command.instanceId);

    const stale = createWildsWorldEdgeAdmissionQueue({ initialProjection: f.world, persist: persistWildsWorldCommandDurably });
    await assert.rejects(stale.admit(entry({ ...f.command, commandId: 'creation:default:stale', instanceId: 'creation:default:stale-instance' })), /durable_material_conflict/);
    assert.equal(stale.current().revision, 0);
    const snapshot = fake.dump('meta').find(([key]) => key === `receiz:wilds-world-outbox:v1:${actorId}`)![1] as ReceizOfflineProofQueueSnapshot;
    assertWildsCreationOutboxContinuity(snapshot, structuredClone(snapshot));
    assert.throws(() => assertWildsCreationOutboxContinuity(snapshot, { ...snapshot, pending: [] }), /durable_source_changed/);
    const altered = structuredClone(snapshot);
    (altered.pending[0].payload.entry as unknown as WildsWorldOutboxEntry).guestId = 'guest:altered-under-same-command';
    assert.throws(() => assertWildsCreationOutboxContinuity(snapshot, altered), /durable_source_changed/);
  } finally {
    if (previousFactory) Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: previousFactory });
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  }
});

test('owned account continuity carries admitted creations, exact events and spent original material dependencies', async () => {
  const f = fixture(), service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }), result = service.execute(f.command, authority);
  const owned = projectWildsOwnedWorldAdditions(result.projection, actorId), restored = mergeWildsOwnedWorldAdditions(initialWildsWorldProjection(), owned);
  assert.deepEqual(restored.creations, result.projection.creations);
  assert.deepEqual(restored.creationEvents, result.projection.creationEvents);
  assert.deepEqual(restored.constructionCommandReceipts, result.projection.constructionCommandReceipts);
  assert.equal(restored.materialLots[f.lotId].head, result.projection.materialLots[f.lotId].head);
  assert.equal(restored.consumedMaterialLots[f.lotId], f.command.instanceId);
  const payload = worldCreationImagePayload(restored, f.command.instanceId);
  assert.equal(validateCreationImage(payload), true);
  assert.equal(payload.checkpoint.events[0].eventId, result.events[0].eventId);
  const resource = payload.checkpoint.resources[f.lotId] as typeof payload.checkpoint.resources[string] & { sourceLot: unknown; parentHead: string };
  assert.deepEqual(resource.sourceLot, restored.materialLots[f.lotId]);
  assert.equal(resource.parentHead, restored.materialLots[f.lotId].head);
  const receipt = payload.checkpoint.receipts[f.command.commandId] as typeof payload.checkpoint.receipts[string] & { admittedWorldEvent: unknown };
  assert.deepEqual(receipt.admittedWorldEvent, result.events[0]);
});

function evolutionFixture() {
  const f = fixture(), sources = Array.from({ length: 25 }, (_, index) => projectWildsResourceRegion(index - 12, 2)).flat().filter(source => source.kind === 'timber').slice(0, 2);
  const extra = sources.map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: actorId, actorPosition: source.position, kaiUPulse: 11 }));
  const world = { ...f.world, materialLots: { ...f.world.materialLots, ...Object.fromEntries(extra.map(row => [row.lot.lotId, row.lot])) }, harvestedSources: { ...f.world.harvestedSources, ...Object.fromEntries(extra.map(row => [row.source.sourceId, row.source])) } };
  const context = { ...f.context, sourceHead: creationWorldSourceHead(world) }, plan = compileCreation(f.definition, context); assert.equal(plan.status, 'ready');
  if (plan.status !== 'ready') throw Error('fixture');
  const resources = selectCreationResources(Object.values(world.materialLots), context.budget, plan.plan.requiredResources, creationWorldAvailability(world, actorId));
  const command: WildsCreationConstructCommand = { ...f.command, context, planDigest: plan.plan.digest, resources: resources.lots };
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(world) }), birth = service.execute(command, authority), source = birth.projection.creations![command.instanceId];
  const { digest: _digest, ...definitionBasis } = f.definition;
  const definition = createCreationDefinition({ ...definitionBasis, nodes: f.definition.nodes.map(node => ({ ...node, shape: { ...node.shape, width: 1.2 } })) });
  const physical = projectCreationPhysical(source.instance, f.definition, compileWorldCreationSource(source));
  const nextContext: CreationCompileContext = { ...context, sourceHead: creationWorldSourceHead(birth.projection), evolution: { instanceId: source.instance.instanceId, head: source.instance.head, definition: f.definition }, physical: [{ chunkId: 'existing-instance', head: source.instance.head, instanceId: source.instance.instanceId, terrain: [], solids: physical.solids, walkable: physical.walkable, portals: physical.connections }] };
  const nextPlan = compileCreation(definition, nextContext); assert.equal(nextPlan.status, 'ready');
  if (nextPlan.status !== 'ready') throw Error('fixture');
  const selected = selectCreationResources(Object.values(birth.projection.materialLots), nextContext.budget, nextPlan.plan.requiredResources, creationWorldAvailability(birth.projection, actorId));
  const evolve: WildsCreationEvolveCommand = { ...command, type: 'creation.evolve', commandId: 'creation:command:evolve', expectedHead: source.instance.head, definition, context: nextContext, planDigest: nextPlan.plan.digest, resources: selected.lots, actorPosition: { ...context.pose.position, x: context.pose.position.x + 2 } };
  return { f, world, command, service, birth, evolve, nextPlan: nextPlan.plan };
}

test('new physical reach evolution retains exact legacy construction and rejects relabeled rule heads', () => {
  const { world, command, service, birth, evolve } = evolutionFixture();
  assert.equal(birth.projection.creations![command.instanceId].ruleHead, CREATION_WORLD_RULE_HEAD);
  const result = service.execute({ ...evolve, reachRule: CREATION_PHYSICAL_BUILD_REACH_RULE.id }, { ...authority, uPulse: 21 });
  const source = result.projection.creations![command.instanceId];
  assert.equal(source.ruleHead, CREATION_WORLD_PHYSICAL_EVOLUTION_RULE_HEAD);
  assert.deepEqual(source.history![0].command, command);
  assert.equal(source.history![0].ruleHead, CREATION_WORLD_RULE_HEAD);
  assert.deepEqual(replayWildsWorld([...birth.events, ...result.events], checkpointWildsWorld(world)), result.projection);
  assert.ok(compileWorldCreationSource(source));
  assert.throws(() => compileWorldCreationSource({ ...source, ruleHead: CREATION_WORLD_RULE_HEAD }), /record_invalid/);
  const unmarked = { ...source.command };
  delete unmarked.reachRule;
  assert.throws(() => compileWorldCreationSource({ ...source, command: unmarked, commandDigest: constructionProofDigest(unmarked) }), /record_invalid/);
  const distant = { ...source.command, actorPosition: { ...source.command.actorPosition, y: source.command.actorPosition.y + 40 } };
  assert.throws(() => compileWorldCreationSource({ ...source, command: distant, commandDigest: constructionProofDigest(distant) }), /build_out_of_reach/);
});

test('the controller rechecks the live player after preparation and never saves an unreachable build', async () => {
  const f = fixture();
  let position = f.context.pose.position, saved = 0;
  const controller = createWorldCreationController({ environment: () => ({ ownerId: actorId, worldId: f.world.worldId, spaceId: f.context.spaceId }),
    world: () => f.world, crew: () => ({ cards: [f.card], conditions: { [f.card.id]: f.condition } }), position: () => position,
    compileContext: () => f.context, admit: async (build, beforeAdmit) => {
      assert.equal(build.reachRule, CREATION_PHYSICAL_BUILD_REACH_RULE.id);
      position = { ...position, y: position.y + 40 };
      await beforeAdmit(); saved++;
      return { projection: f.world, events: [] };
    }, project: async (instance, definition, plan) => projectCreationPhysical(instance, definition, plan) });
  const result = await controller.commit(f.definition, f.plan, [f.card.id]);
  assert.equal(result.status, 'rejected');
  if (result.status === 'rejected') assert.match(result.reason, /within 12 metres/);
  assert.equal(saved, 0);
  controller.close();
});

test('registered exact-head evolution preserves identity, source payments, history and idempotent replay', () => {
  const { world, command, service, birth, evolve, nextPlan } = evolutionFixture(), result = service.execute(evolve, { ...authority, uPulse: 21 });
  const before = birth.projection.creations![command.instanceId], after = result.projection.creations![command.instanceId];
  assert.equal(result.constitution.result, 'VALID'); assert.equal(result.events[0].kind, 'creation.evolved');
  assert.equal(after.instance.instanceId, before.instance.instanceId); assert.equal(after.instance.parentHead, before.instance.head); assert.equal(after.instance.revision, 1);
  assert.deepEqual(after.instance.nodeStates.bench, before.instance.nodeStates.bench);
  assert.equal(after.instance.embeddedResources.length, 2); assert.equal(compileWorldCreationSource(after).digest, nextPlan.digest);
  assert.equal(isWorldCreationSuccessor(before, after), true); assert.equal(isWorldCreationSuccessor(after, before), false);
  assert.deepEqual(replayWildsWorld([...birth.events, ...result.events], checkpointWildsWorld(world)), result.projection);
  assert.equal(service.execute(evolve, { ...authority, uPulse: 21 }).events.length, 0);
  assert.throws(() => service.execute({ ...evolve, commandId: 'creation:command:stale-edit', context: { ...evolve.context, sourceHead: creationWorldSourceHead(result.projection) } }, { ...authority, uPulse: 22 }), /evolution_source_stale/);
  assert.throws(() => service.execute({ ...evolve, expectedHead: 'sha256:' + '1'.repeat(64) }, { ...authority, uPulse: 21 }), /command_conflict/);
  const { head: _beforeHead, ...beforeBasis } = before.instance;
  const source = { ...after, history: after.history!.map((row,index) => index ? row : { ...row, instance: sealCreationInstance({ ...beforeBasis, nodeStates: { ...before.instance.nodeStates, bench: { ...before.instance.nodeStates.bench, condition: 80 } } }) }) };
  assert.throws(() => compileWorldCreationSource(source), /successor_invalid/);
  assert.equal(Object.keys(projectWildsCreationPersistence({ ...result.projection, creationEvents: { [command.instanceId]: result.events[0] } }).creations).length, 0);
  assert.equal(preserveWildsConstructionHistory(birth.projection, result.projection), result.projection);
  assert.equal(preserveWildsConstructionHistory(result.projection, { ...result.projection, creationEvents: {} }), result.projection);
  const ownedBefore = projectWildsOwnedWorldAdditions(birth.projection, actorId), ownedAfter = projectWildsOwnedWorldAdditions(result.projection, actorId);
  assert.equal(mergeWildsOwnedWorldAdditions(birth.projection, ownedAfter).creations![command.instanceId].instance.head, after.instance.head);
  assert.equal(mergeWildsOwnedWorldAdditions(result.projection, ownedBefore).creations![command.instanceId].instance.head, after.instance.head);
  assert.equal(mergeWildsOwnedAdditionSets(ownedBefore, ownedAfter).creations![command.instanceId].instance.head, after.instance.head);
  const image = worldCreationImagePayload(result.projection, command.instanceId);
  assert.equal(validateCreationImage(image), true); assert.equal(Object.keys(image.checkpoint.resources).length, 2); assert.equal(image.checkpoint.events.length, 2);
});

test('durable evolution restores exact replacement geometry and old receipts without redispatch', async () => {
  const { world, command, birth, evolve, nextPlan } = evolutionFixture(), storage = createReceizInMemoryOfflineProofQueueStorage();
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: world, persist: candidate => persistWildsWorldCommandDurably(candidate, storage) });
  await queue.admit(entry(command));
  let visible = queue.current();
  const controller = createWorldCreationController({ environment: () => ({ ownerId: actorId, worldId: world.worldId, spaceId: evolve.context.spaceId }), world: () => visible, crew: () => ({ cards: evolve.workerSources.map(row => row.card), conditions: Object.fromEntries(evolve.workerSources.map(row => [row.card.id, row.condition])) }), position: () => evolve.actorPosition, compileContext: () => evolve.context, admit: async () => { throw Error('restore_must_not_dispatch'); }, project: async (instance, definition, plan) => projectCreationPhysical(instance, definition, plan) });
  assert.equal(await controller.restore(), 1);
  const actualSource = visible.creations![command.instanceId], actualContext = { ...evolve.context, sourceHead: creationWorldSourceHead(visible), evolution: { instanceId: actualSource.instance.instanceId, head: actualSource.instance.head, definition: actualSource.command.definition }, physical: [] }, compiled = compileCreation(evolve.definition, actualContext); assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') throw Error('fixture');
  const actualEvolve = { ...evolve, expectedHead: actualSource.instance.head, context: actualContext, planDigest: compiled.plan.digest };
  await queue.admit(entry(actualEvolve)); visible = queue.current();
  assert.equal(await controller.restore(), 1); assert.equal(controller.snapshot().projections.length, 1); assert.equal(controller.snapshot().navigation.instanceCount, 1);
  assert.equal(controller.snapshot().projections[0].solids[0].halfExtents.x, .6);
  const restored = await restoreWildsWorldEdgeSource(world, actorId, storage);
  assert.equal(restored.creations![command.instanceId].instance.head, visible.creations![command.instanceId].instance.head);
  assert.deepEqual(restored.creationEvents, visible.creationEvents);
  assert.equal(new WildsWorldService({ checkpoint: checkpointWildsWorld(restored) }).execute(command, authority).events.length, 0);
  assert.equal(compileWorldCreationSource(restored.creations![command.instanceId]).digest, compiled.plan.digest);
  assert.equal(restored.creationEvents![restored.creations![command.instanceId].history![0].eventId].causeId, command.commandId);
});

test('evolution refuses actor trapping, component conversion, occupied replacement and unaffordable edits', () => {
  const { f, service, birth, evolve } = evolutionFixture(), before = birth.projection.creations![evolve.instanceId];
  assert.throws(() => service.execute({ ...evolve, actorPosition: evolve.context.pose.position }, { ...authority, uPulse: 21 }), /occupied_replacement_required/);
  const { digest: _digest, ...definitionBasis } = f.definition;
  const changed = createCreationDefinition({ ...definitionBasis, nodes: f.definition.nodes.map(node => ({ ...node, behaviors: [{ id: 'garden', version: 1, parameters: {} }] })) });
  assert.throws(() => reviseCreationInstance(before.instance, f.definition, changed, [], 21), /component_conversion_required/);
  const { head: _head, ...basis } = before.instance;
  const occupied = sealCreationInstance({ ...basis, nodeStates: { bench: { kind: 'bed', version: 1, nodeId: 'bench', condition: 100, supportIds: [], occupantIds: ['owner:guest'], capacity: 1 } } });
  assert.throws(() => reviseCreationInstance(occupied, f.definition, evolve.definition, [], 21), /occupied_replacement_required/);
  assert.deepEqual(service.snapshot(), birth.projection);
});

test('canonical card affinity grants and paid typed creations qualify livestock, altered fragments do not', () => {
  const f = fixture(), crew = projectCreationWorkers([f.card], { [f.card.id]: f.condition });
  assert.deepEqual(crew[0].techniques, ['assembly', 'carpentry', 'cultivation']);
  const stone = sealCollectedCard({ capturedAt: pulse, encounterId: 'stone-creation-techniques', formId: 'titanseal-1', ownerReceizId: actorId });
  assert.deepEqual(projectCreationWorkers([stone], { [stone.id]: emptyAdventureCondition(stone.id) })[0].techniques, ['assembly', 'masonry']);
  const { digest: _digest, ...basis } = f.definition;
  for (const behavior of ['habitat', 'garden']) {
    const definition = createCreationDefinition({ ...basis, nodes: f.definition.nodes.map(node => ({ ...node, ...(behavior === 'habitat' ? { shape: { kind: 'shell' as const, width: 2, height: 2.2, depth: 2, thickness: .03, doorway: { width: .9, height: 1.9 } } } : {}), behaviors: [{ id: behavior, version: 1, parameters: {} }] })) }), compiled = compileCreation(definition, f.context);
    assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') throw Error('fixture');
    const command = { ...f.command, definition, planDigest: compiled.plan.digest }, result = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).execute(command, authority);
    const shelter = resolveWorldCreationLivestockShelter(result.projection, command.instanceId, actorId);
    assert.equal(shelter?.shelterId, command.instanceId); assert.ok(shelter!.capacity > 0);
    assert.deepEqual(resolveWildsLivestockShelter(result.projection, command.instanceId, actorId), shelter);
    let unrelatedReads = 0;
    const creations = { ...result.projection.creations };
    Object.defineProperty(creations, 'creation:unrelated', { enumerable: true, get() { unrelatedReads++; return result.projection.creations![command.instanceId]; } });
    assert.deepEqual(resolveWorldCreationLivestockShelter({ ...result.projection, creations }, command.instanceId, actorId), shelter);
    assert.equal(unrelatedReads, 0, 'a shelter lookup must verify its own source without scanning every other creation');
    assert.equal(resolveWorldCreationLivestockShelter(result.projection, command.instanceId, 'owner:foreign'), null);
    assert.equal(resolveWorldCreationLivestockShelter({ ...result.projection, consumedMaterialLots: {} }, command.instanceId, actorId), null);
    assert.equal(resolveWorldCreationLivestockShelter({ ...result.projection, creationEvents: {} }, command.instanceId, actorId), null);
  }
});

test('installed controller commits a selected current object edit through the exact durable successor', async () => {
  const { f, world, command, evolve } = evolutionFixture(), storage = createReceizInMemoryOfflineProofQueueStorage();
  let failPersistence = false;
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: world, persist: candidate => { if (failPersistence) throw Error('storage_unavailable'); return persistWildsWorldCommandDurably(candidate, storage); } });
  let context = command.context, projects = 0;
  const controller = createWorldCreationController({ environment: () => ({ ownerId: actorId, worldId: world.worldId, spaceId: context.spaceId }), world: queue.current, crew: () => ({ cards: [f.card], conditions: { [f.card.id]: f.condition } }), position: () => evolve.actorPosition, compileContext: () => context, admit: async (build, beforeAdmit) => ({ projection: await queue.admit(entry(build), { beforeAdmit }), events: [] }), project: async (instance, definition, plan) => { projects++; return projectCreationPhysical(instance, definition, plan); } });
  const initial = compileCreation(f.definition, context); assert.equal(initial.status, 'ready'); if (initial.status !== 'ready') throw Error('fixture');
  const born = await controller.commit(f.definition, initial.plan, [f.card.id]); assert.equal(born.status, 'admitted'); if (born.status !== 'admitted') throw Error('fixture');
  const selected = { instanceId: born.instance.instanceId, head: born.instance.head, definitionDigest: born.instance.definitionDigest }, projection = controller.snapshot().projections[0];
  context = { ...context, sourceHead: creationWorldSourceHead(queue.current()), evolution: { instanceId: selected.instanceId, head: selected.head, definition: f.definition }, physical: [{ chunkId: 'selected-current', instanceId: selected.instanceId, head: selected.head, terrain: [], solids: projection.solids, walkable: projection.walkable, portals: projection.connections }] };
  const preview = compileCreation(evolve.definition, { ...context, physical: [] }); assert.equal(preview.status, 'ready'); if (preview.status !== 'ready') throw Error('fixture');
  const revised = await controller.commit(evolve.definition, preview.plan, [f.card.id], selected); assert.equal(revised.status, 'admitted'); if (revised.status !== 'admitted') throw Error('fixture');
  const admitted = queue.current().creations![selected.instanceId].instance;
  assert.equal(revised.instance.instanceId, selected.instanceId); assert.equal(admitted.parentHead, selected.head); assert.equal(admitted.embeddedResources.length, 2);
  assert.equal(controller.snapshot().projections.length, 1); assert.equal(controller.snapshot().projections[0].solids[0].halfExtents.x, .6);
  assert.equal(await controller.restore(), 1); assert.equal(projects, 2);
  const row = queue.current().creations![selected.instanceId];
  assert.equal((await controller.recover(row.command.commandId, preview.plan)).status, 'admitted'); assert.equal(projects, 2);
  const { digest: _digest, ...basis } = evolve.definition, nextDefinition = createCreationDefinition({ ...basis, nodes: basis.nodes.map(node => ({ ...node, shape: { ...node.shape, width: 1.4 } })) });
  context = { ...context, sourceHead: creationWorldSourceHead(queue.current()), evolution: { instanceId: admitted.instanceId, head: admitted.head, definition: evolve.definition }, physical: [] };
  const next = compileCreation(nextDefinition, context); assert.equal(next.status, 'ready'); if (next.status !== 'ready') throw Error('fixture');
  failPersistence = true;
  assert.equal((await controller.commit(nextDefinition, next.plan, [f.card.id], { instanceId: admitted.instanceId, head: admitted.head, definitionDigest: admitted.definitionDigest })).status, 'unknown');
  assert.equal(controller.snapshot().instances[admitted.instanceId].head, admitted.head); assert.equal(projects, 2);
});
