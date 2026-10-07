import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFarmLayoutDefinition, defaultFarmLayoutOptions, type FarmLayoutOptions } from '../src/features/play/creation/farm-layout';
import { compileCreation, type CreationCompileContext } from '../src/features/play/creation/compiler';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { createCreationInstance, sealCreationInstance } from '../src/features/play/creation/instance';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { deriveCreationGeometry, overlapsCreationSolids } from '../src/features/play/creation/geometry';
import { verifyCreationDefinition } from '../src/features/play/creation/definition';
import { creationContextFixture } from './support/creation-fixtures';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { checkpointWildsWorld, initialWildsWorldProjection, replayWildsWorld } from '../src/features/play/wilds-world-state';
import { WildsWorldService } from '../src/features/play/wilds-world-service';
import { combineCreationTechniques, projectCreationWorkers } from '../src/features/play/creation/capabilities';
import { creationWorldAvailability, creationWorldSourceHead, resolveWorldCreationLivestockShelter, type WildsCreationConstructCommand } from '../src/features/play/creation/world-source';
import { selectCreationResources } from '../src/features/play/creation/resources';

const ownerId = 'owner:farm-builder', pulse = '2026-10-07T12:00:00.000Z';
const definition = (options: FarmLayoutOptions = defaultFarmLayoutOptions()) => createFarmLayoutDefinition({ creatorId: ownerId, seed: 'farm-layout-test', options });
const context = (overrides: Partial<CreationCompileContext> = {}) => creationContextFixture({ techniques: ['assembly', 'masonry', 'cultivation'], ...overrides });

// Catch a preset accidentally dropping real shelter/garden components or granting free produce.
test('farm presets create canonical sheltered pens and empty functional crop beds', () => {
  for (const [preset, shelters, gardens] of [['homestead', 1, 2], ['ranch', 4, 0], ['market-garden', 0, 8], ['mixed', 3, 6]] as const) {
    const farm = definition(defaultFarmLayoutOptions(preset));
    assert.ok(verifyCreationDefinition(farm));
    const states = Object.values(initializeCreationComponents(farm, 10));
    assert.equal(states.filter(state => state.kind === 'habitat').length, shelters);
    assert.equal(states.filter(state => state.kind === 'garden').length, gardens);
    for (const state of states) {
      if (state.kind === 'habitat') assert.ok(state.capacity >= 4);
      if (state.kind === 'garden') assert.deepEqual([state.planted, state.waterUnits, state.produce], [0, 0, 0]);
    }
    assert.equal(states.filter(state => state.kind === 'storage').length, 1);
  }
});

// Catch disconnected foundations, blocked doorway approaches, or overlapping template parts.
test('complex farm layouts stay grounded, stage their supports and leave doorways clear', () => {
  for (const size of ['compact', 'standard', 'estate'] as const) {
    const farm = definition({ ...defaultFarmLayoutOptions('mixed'), size, shelterCount: 6, gardenCount: 12 });
    const compiled = compileCreation(farm, context());
    assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') throw Error('farm_compile');
    assert.ok(compiled.plan.requiredResources.timber > 0 && compiled.plan.requiredResources.timber <= 128);
    assert.equal(Math.min(...compiled.plan.chunks.map(chunk => chunk.bounds.min.y)), 0);
    const stageByNode = new Map(compiled.plan.stages.flatMap((stage, index) => stage.map(id => [id, index] as const)));
    for (const node of farm.nodes) for (const support of node.supports) assert.ok(stageByNode.get(support)! < stageByNode.get(node.id)!);
    const solids = compiled.plan.chunks.flatMap(chunk => chunk.solids);
    for (const door of compiled.plan.chunks.flatMap(chunk => chunk.connections)) {
      const clearance = { id: 'doorway-approach', center: { ...door.position, y: door.position.y + 1.05, z: door.position.z - .65 }, halfExtents: { x: .35, y: .85, z: .65 }, yaw: door.yaw };
      assert.ok(solids.every(solid => !overlapsCreationSolids(solid, clearance)), `blocked ${door.id}`);
    }
    for (let i = 0; i < farm.nodes.length; i++) for (let j = i + 1; j < farm.nodes.length; j++) {
      const a = deriveCreationGeometry(farm.nodes[i], farm.nodes[i].pose), b = deriveCreationGeometry(farm.nodes[j], farm.nodes[j].pose);
      assert.ok(a.solids.every(first => b.solids.every(second => !overlapsCreationSolids(first, second))), `overlap ${farm.nodes[i].id}/${farm.nodes[j].id}`);
    }
  }
});

// Catch a free-build branch, crop techniques being omitted, or external physical constraints being erased.
test('farm quotes require exact material budget, cultivation and unobstructed terrain', () => {
  const farm = definition();
  const poor = compileCreation(farm, context({ budget: {} }));
  assert.equal(poor.status, 'blocked'); if (poor.status === 'blocked') assert.ok(poor.blockers.some(blocker => blocker.code === 'resources'));
  const unqualified = compileCreation(farm, context({ techniques: ['assembly'] }));
  assert.equal(unqualified.status, 'blocked'); if (unqualified.status === 'blocked') assert.ok(unqualified.blockers.some(blocker => blocker.code === 'technique'));
  const obstruction = compileCreation(farm, context({ physical: [{ chunkId: 'terrain-tree', head: `sha256:${'b'.repeat(64)}`, terrain: [], solids: [{ id: 'tree', center: { x: 0, y: 1, z: 0 }, halfExtents: { x: 100, y: 1, z: 100 }, yaw: 0 }], walkable: [], portals: [] }] }));
  assert.equal(obstruction.status, 'blocked'); if (obstruction.status === 'blocked') assert.ok(obstruction.blockers.some(blocker => blocker.code === 'overlap'));
  const stone = compileCreation(definition({ ...defaultFarmLayoutOptions('mixed'), material: 'stone', size: 'estate', shelterCount: 6, gardenCount: 12 }), context());
  assert.equal(stone.status, 'ready'); if (stone.status === 'ready') assert.ok(stone.plan.requiredResources.stone <= 256);
});

// Catch bypassed support dependencies: destroying a foundation must remove its shelter from physical projection.
test('farm habitat geometry disappears when its real foundation is destroyed', () => {
  const farm = definition(), compiled = compileCreation(farm, context());
  assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') throw Error('farm_compile');
  const initial = createCreationInstance({ instanceId: 'creation:instance:farm-support', definition: farm, ownerId, worldId: 'wildz', spaceId: 'surface', pose: context().pose, kaiUPulse: 1 });
  const habitat = farm.nodes.find(node => node.behaviors.some(behavior => behavior.id === 'habitat'))!;
  assert.ok(habitat.supports.length);
  const { head: _head, ...basis } = initial, states = initializeCreationComponents(farm, 1), supportId = habitat.supports[0];
  const broken = sealCreationInstance({ ...basis, stage: 'functional', nodeStates: { ...states, [supportId]: { ...states[supportId], condition: 0 } } });
  assert.ok(!projectCreationPhysical(broken, farm, compiled.plan).chunks.some(chunk => chunk.nodeIds.includes(habitat.id)));
});

// Catch unsafe input sizes/types before they can generate unbounded physical graphs.
test('farm builder rejects unbounded counts and empty agricultural layouts', () => {
  const defaults = defaultFarmLayoutOptions();
  for (const options of [{ ...defaults, shelterCount: 7 }, { ...defaults, gardenCount: 13 }, { ...defaults, shelterCount: -1 }, { ...defaults, gardenCount: 1.5 }, { ...defaults, shelterCount: 0, gardenCount: 0 }, { ...defaults, size: 'infinite' }, { ...defaults, paths: 'yes' }]) {
    assert.throws(() => definition(options as FarmLayoutOptions), /farm_layout_options_invalid/);
  }
});

function fundedFarm() {
  const farm = definition({ ...defaultFarmLayoutOptions('mixed'), size: 'compact', shelterCount: 3, gardenCount: 2 });
  const card = sealCollectedCard({ capturedAt: pulse, encounterId: 'farm-builder-crew', formId: 'mintcub-1', ownerReceizId: ownerId });
  const condition = emptyAdventureCondition(card.id), techniques = combineCreationTechniques(projectCreationWorkers([card], { [card.id]: condition }));
  const quote = compileCreation(farm, context({ techniques })); if (quote.status !== 'ready') throw Error('farm_fixture_quote');
  const sources = Array.from({ length: quote.plan.requiredResources.timber + 2 }, (_, index) => projectWildsResourceRegion(index + 40, 0).find(source => source.kind === 'timber')!);
  const harvests = sources.map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: ownerId, actorPosition: source.position, kaiUPulse: 10 }));
  const world = { ...initialWildsWorldProjection(), materialLots: Object.fromEntries(harvests.map(harvest => [harvest.lot.lotId, harvest.lot])), harvestedSources: Object.fromEntries(harvests.map(harvest => [harvest.source.sourceId, harvest.source])) };
  const buildContext = context({ worldId: world.worldId, spaceId: 'wildz.space.outer.v1', sourceHead: creationWorldSourceHead(world), pose: { position: { x: 5000, y: 100, z: 5000 }, yaw: 0 }, budget: quote.plan.requiredResources, techniques });
  const compiled = compileCreation(farm, buildContext); if (compiled.status !== 'ready') throw Error('farm_fixture_compile');
  const resources = selectCreationResources(Object.values(world.materialLots), buildContext.budget, compiled.plan.requiredResources, creationWorldAvailability(world, ownerId));
  assert.deepEqual(resources.deficits, {});
  const command: WildsCreationConstructCommand = { type: 'creation.construct', commandId: 'creation:command:farm', instanceId: 'creation:instance:farm', definition: farm, context: buildContext, planDigest: compiled.plan.digest, workerSources: [{ card, condition }], resources: resources.lots, actorPosition: buildContext.pose.position };
  return { world, farm, command };
}

// Catch decorative pens granting capacity, only the first real shelter being counted, or unpaid fragments becoming livestock sources.
test('a new farm can be built beside its distant physical pens while legacy origin reach stays exact', () => {
  const f = fundedFarm(), authority = { actorId: ownerId, canonical: true, pulse, occurredAt: pulse, uPulse: 20 };
  const pen = f.farm.nodes.find(node => node.id === 'farm:pen:3:foundation')!;
  const actorPosition = { x: f.command.context.pose.position.x + pen.pose.position.x, y: f.command.context.pose.position.y,
    z: f.command.context.pose.position.z + pen.pose.position.z + pen.shape.depth / 2 + 3 };
  assert.ok(Math.hypot(actorPosition.x - f.command.context.pose.position.x, actorPosition.z - f.command.context.pose.position.z) > 12);
  const legacy = { ...f.command, actorPosition };
  assert.throws(() => new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).execute(legacy, authority), /build_out_of_reach/);
  const command = { ...legacy, reachRule: 'wildz.creation-reach.physical.v2' as const };
  const result = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).execute(command, authority);
  assert.equal(result.constitution.result, 'VALID');
  assert.deepEqual(replayWildsWorld(result.events, checkpointWildsWorld(f.world)), result.projection);
  assert.ok(resolveWorldCreationLivestockShelter(result.projection, command.instanceId, ownerId));
  for (const position of [{ ...actorPosition, z: actorPosition.z + 40 }, { ...actorPosition, y: actorPosition.y + 40 }]) {
    assert.throws(() => new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) }).execute({ ...command, actorPosition: position }, authority), /build_out_of_reach/);
  }
});

test('paid admitted farm shelters aggregate capacity and retain exact consumed material lineage', () => {
  const fixture = fundedFarm(), authority = { actorId: ownerId, canonical: true, pulse, occurredAt: pulse, uPulse: 20 };
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(fixture.world) }), result = service.execute(fixture.command, authority);
  const shelter = resolveWorldCreationLivestockShelter(result.projection, fixture.command.instanceId, ownerId);
  assert.equal(shelter?.capacity, 12, 'three usable habitat shells supply four livestock places each');
  assert.deepEqual(replayWildsWorld(result.events, checkpointWildsWorld(fixture.world)), result.projection);
  for (const lot of fixture.command.resources) assert.equal(result.projection.consumedMaterialLots[lot.id], fixture.command.instanceId);
  assert.equal(resolveWorldCreationLivestockShelter({ ...result.projection, consumedMaterialLots: {} }, fixture.command.instanceId, ownerId), null);
  assert.equal(resolveWorldCreationLivestockShelter({ ...result.projection, creationEvents: {} }, fixture.command.instanceId, ownerId), null);
  assert.equal(resolveWorldCreationLivestockShelter(result.projection, fixture.command.instanceId, 'owner:foreign'), null);
  assert.throws(() => new WildsWorldService({ checkpoint: checkpointWildsWorld({ ...fixture.world, materialLots: {} }) }).execute(fixture.command, authority), /source_stale|materials_unavailable/);
});
