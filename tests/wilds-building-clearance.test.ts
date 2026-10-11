import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { createCreationDefinition } from '../src/features/play/creation/definition';
import { compileCreation } from '../src/features/play/creation/compiler';
import { combineCreationTechniques, projectCreationWorkers } from '../src/features/play/creation/capabilities';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { selectCreationResources } from '../src/features/play/creation/resources';
import { groundCreationCompileContext } from '../src/features/play/creation/ground-placement';
import { creationWorldAvailability, creationWorldSourceHead, compileWorldCreationSource, type WildsCreationConstructCommand } from '../src/features/play/creation/world-source';
import { createWildsWorldEvent } from '../src/features/play/wilds-world-event';
import { initialWildsWorldProjection, checkpointWildsWorld, replayWildsWorld } from '../src/features/play/wilds-world-state';
import { WildsWorldService } from '../src/features/play/wilds-world-service';
import { previewWildsContinuousBuild } from '../src/features/play/wilds-continuous-builder';
import { regionForPosition } from '../src/features/play/multiplayer-core';
import { admitWildsDiscoveryPhysicalNeighborhood, WILDS_DISCOVERY_SITE_REGION_SIZE } from '../src/features/play/wilds-discovery-sites';
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY } from '../src/features/play/wilds-site-runtime';
import { sampleWildsTerrain, WILDS_TERRAIN_TILE_SIZE } from '../src/features/play/wilds-terrain-authority';
import { composeWildsConstructionTerrain, projectWildsConstructionTerrain } from '../src/features/play/wilds-construction-terrain';
import { wildsBuildSceneryClearedAt } from '../src/features/play/wilds-build-scenery';
import { projectWildsConstructionProgress } from '../src/features/play/wilds-construction-component';
import { sampleWildsConstructionTerrainAt } from '../src/features/play/wilds-construction-terrain';
import { sampleWildsBuildGround } from '../src/features/play/wilds-build-ground';
import { projectWildsResourceRegion, projectWildsResourceSourceForObstacle } from '../src/features/play/wilds-resource-authority';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { wildsTerrainObstaclesForTile } from '../src/features/play/wilds-terrain-obstacles';
import { wildsNourishmentPlantsForTile, wildsNourishmentSourceAt, type WildsNourishmentState, gatherWildsNourishment } from '../src/features/play/wilds-nourishment';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { creationContextFixture } from './support/creation-fixtures';

// First RED deliberately exercises the missing public model at runtime. Once it
// exists, all assertions below exercise actual paid construction and source laws.
async function model() {
  const path = '../src/features/play/wilds-building-clearance.js';
  const loaded = await import(path).catch(() => null);
  assert.ok(loaded?.deriveWildsBuildingClearance, 'paid footprint must derive a finite clearance candidate');
  return loaded as typeof import('../src/features/play/wilds-building-clearance');
}
const pulse = '2026-10-10T12:00:00.000Z', outer = 'wildz.space.outer.v1';
const trees = Array.from({ length: 30 }, (_, x) => wildsTerrainObstaclesForTile(x, 1)).flat();
const tree = trees.find(item => item.kind === 'tree')!, rock = trees.find(item => item.kind === 'rock')!;
const vegetables = Array.from({ length: 30 }, (_, x) => wildsNourishmentPlantsForTile(x, 1)).flat();
const vegetable = vegetables.find(item => item.kind === 'wild-vegetable')!;
function paidBuilding(point = tree.position, yaw = 0, width = 2, depth = 2, options: { wingOffset?: number; prior?: ReturnType<typeof initialWildsWorldProjection>; name?: string } = {}) {
  const sources = Array.from({ length: 50 }, (_, x) => projectWildsResourceRegion(x - 25, 0)).flat().filter(item => item.kind === 'timber').slice(0, 60);
  const lots = sources.map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: 'owner', actorPosition: source.position, kaiUPulse: 10 }));
  const world = options.prior ?? { ...initialWildsWorldProjection(), materialLots: Object.fromEntries(lots.map(item => [item.lot.lotId, item.lot])) };
  const card = sealCollectedCard({ capturedAt: pulse, encounterId: 'clearance-crew', formId: 'mintcub-1', ownerReceizId: 'owner' });
  const condition = emptyAdventureCondition(card.id);
  const definition = createCreationDefinition({ schema: 'wildz.creation-definition.v1', grammarVersion: 1, creatorId: 'owner', seed: 'clearance-house', assets: [], nodes: [{ id: 'room', parentId: null, pose: { position: { x: 0, y: 0, z: 0 }, yaw: 0 }, shape: { kind: 'shell', width, height: 2.2, depth, thickness: .03, doorway: { width: .9, height: 1.9 } }, material: 'timber', attachments: [], supports: [], behaviors: [] }] });
  const actualDefinition = options.wingOffset ? createCreationDefinition({ schema: definition.schema, grammarVersion: definition.grammarVersion, creatorId: definition.creatorId, seed: definition.seed, assets: definition.assets, nodes: [...definition.nodes, { ...definition.nodes[0], id: 'offset-wing', pose: { position: { x: options.wingOffset, y: 0, z: 0 }, yaw: 0 } }] }) : definition;
  const groundPads = projectWildsConstructionTerrain(world);
  const context = groundCreationCompileContext(actualDefinition, creationContextFixture({ worldId: world.worldId, spaceId: outer, sourceHead: creationWorldSourceHead(world), pose: { position: { ...point, y: sampleWildsConstructionTerrainAt(groundPads, point.x, point.z, sampleWildsBuildGround(point.x, point.z).elevation) }, yaw }, budget: { timber: lots.length }, techniques: combineCreationTechniques(projectCreationWorkers([card], { [card.id]: condition })), physical: [{ chunkId: 'wildz.creation.terrain-support.v2', head: 'sha256:' + 'a'.repeat(64), terrain: [], portals: [], solids: [], walkable: groundPads.map(pad => ({ ...pad, halfExtents: { ...pad.halfExtents, y: 0 } })) }] }));
  const compiled = compileCreation(actualDefinition, context);
  assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') throw Error('fixture_compile');
  const selected = selectCreationResources(Object.values(world.materialLots), context.budget, compiled.plan.requiredResources, creationWorldAvailability(world, 'owner'));
  assert.deepEqual(selected.deficits, {});
  const command: WildsCreationConstructCommand = { type: 'creation.construct', commandId: `creation:clearance:${options.name ?? 'command'}`, instanceId: `creation:clearance:${options.name ?? 'instance'}`, definition: actualDefinition, context, planDigest: compiled.plan.digest, workerSources: [{ card, condition }], resources: selected.lots, actorPosition: context.pose.position };
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(world) });
  const result = service.execute(command, { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 });
  assert.equal(result.constitution.result, 'VALID');
  return { world, command, service, result, plan: compiled.plan, source: result.projection.creations![command.instanceId] };
}
function genesisCheckpoints(point?: Readonly<{ x: number; z: number }>) {
  const tiles = Array.from({ length: 42 }, (_, x) => Array.from({ length: 10 }, (_, z) => [x - 6, z - 4] as const)).flat();
  if (point) {
    const tx = Math.floor(point.x / WILDS_TERRAIN_TILE_SIZE), tz = Math.floor(point.z / WILDS_TERRAIN_TILE_SIZE);
    for (let x = tx - 4; x <= tx + 4; x++) for (let z = tz - 4; z <= tz + 4; z++) tiles.push([x, z]);
  }
  const materials = Object.fromEntries(tiles.flatMap(([x, z]) => wildsTerrainObstaclesForTile(x, z)).map(obstacle => [projectWildsResourceSourceForObstacle(obstacle).sourceId, null]));
  const food = Object.fromEntries(tiles.flatMap(([x, z]) => wildsNourishmentPlantsForTile(x, z)).map(plant => [plant.sourceId, null]));
  return { materials, food, retiredSourceIds: [] };
}
function gathered(plant: typeof vegetable, quantity: number) {
  let state: WildsNourishmentState = { schema: 'wildz.player-nourishment.v1', ownerReceizId: 'owner', lastKaiUPulse: 0, sources: {}, items: {}, animalFoodSources: {} };
  for (let i = 0; i < quantity; i++) {
    const crop = wildsNourishmentSourceAt(plant, state.sources[plant.sourceId], 15);
    const result = gatherWildsNourishment({ state, ownerReceizId: 'owner', sourceId: plant.sourceId, expectedSourceHead: crop.head, kaiUPulse: 15, player: plant.position, spaceId: outer });
    assert.equal(result.ok, true); if (!result.ok) throw Error('gather_failed');
    state = result.state;
  }
  return state.sources[plant.sourceId];
}

test('actual paid procedural tree freezes timber and its current fruit crop beside the footprint', async () => {
  const { deriveWildsBuildingClearance, verifyWildsBuildingClearance, projectWildsBuildingClearancePiles } = await model();
  const f = paidBuilding(), source = projectWildsResourceSourceForObstacle(tree);
  const fruit = vegetables.find(plant => plant.terrainTreeId === tree.id)!;
  const first = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: 'owner', actorPosition: source.position, kaiUPulse: 12 });
  const second = createWildsMaterialHarvest({ source, current: first.source, ownerReceizId: 'owner', actorPosition: source.position, kaiUPulse: 13 });
  const checkpoints = genesisCheckpoints();
  const inputs = { world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: { ...checkpoints, materials: { ...checkpoints.materials, [source.sourceId]: second.source }, food: { ...checkpoints.food, [fruit.sourceId]: gathered(fruit, 1) } }, kaiUPulse: 20 };
  const clearance = deriveWildsBuildingClearance(inputs);
  assert.equal(clearance.sources.find(item => item.sourceId === source.sourceId)!.remaining, source.capacity - 2);
  assert.equal(clearance.sources.find(item => item.sourceId === fruit.sourceId)!.remaining, 2);
  assert.equal(clearance.sources.find(item => item.sourceId === source.sourceId)!.sourceHead, second.source.head);
  assert.equal(verifyWildsBuildingClearance(clearance, inputs), true);
  assert.equal(verifyWildsBuildingClearance({ ...clearance, sources: clearance.sources.map(item => ({ ...item, remaining: item.remaining + 1 })) }, inputs), false);
  assert.equal(verifyWildsBuildingClearance(clearance, { ...inputs, buildingHead: 'sha256:' + 'f'.repeat(64) }), false);
  const piles = projectWildsBuildingClearancePiles([clearance], {});
  assert.equal(piles.length, 2);
  for (const pile of piles) assert.ok(Math.abs(pile.position.x - f.plan.pose.position.x) > 1.35 || Math.abs(pile.position.z - f.plan.pose.position.z) > 1.35, 'pile must be outside walls and doorway');
  assert.deepEqual(deriveWildsBuildingClearance(inputs), clearance);
});

test('exhausted current food yields zero and missed crop days never accumulate', async () => {
  const { deriveWildsBuildingClearance } = await model();
  const f = paidBuilding(), fruit = vegetables.find(plant => plant.terrainTreeId === tree.id)!;
  const checkpoints = genesisCheckpoints(), food = { ...checkpoints.food, [fruit.sourceId]: gathered(fruit, 3) };
  const input = { world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: { ...checkpoints, food }, kaiUPulse: 20 };
  const zero = deriveWildsBuildingClearance(input);
  assert.equal(zero.sources.find(item => item.sourceId === fruit.sourceId)!.remaining, 0);
  assert.equal((await model()).projectWildsBuildingClearancePiles([zero], {}).some(item => item.sourceId === fruit.sourceId), false);
  assert.equal(deriveWildsBuildingClearance({ ...input, kaiUPulse: Number(KAI_N_DAY_MICRO * 20n) }).sources.find(item => item.sourceId === fruit.sourceId)!.remaining, 3);
});

for (const [name, point, sourceId, quantity] of [['rock', rock.position, projectWildsResourceSourceForObstacle(rock).sourceId, projectWildsResourceSourceForObstacle(rock).capacity], ['vegetable', vegetable.position, vegetable.sourceId, 2]] as const)
  test(`actual ${name} freezes its finite original capacity`, async () => {
    const { deriveWildsBuildingClearance } = await model(), f = paidBuilding(point);
    const result = deriveWildsBuildingClearance({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 });
    assert.equal(result.sources.find(source => source.sourceId === sourceId)!.remaining, quantity);
  });

test('missing checkpoints and unpaid, markerless, or absent constructions cannot derive clearance', async () => {
  const { deriveWildsBuildingClearance } = await model(), f = paidBuilding();
  const inputs = { world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 };
  assert.throws(() => deriveWildsBuildingClearance({ ...inputs, sourceCheckpoints: { materials: {}, food: {}, retiredSourceIds: [] } }), /checkpoint_missing/);
  assert.throws(() => deriveWildsBuildingClearance({ ...inputs, world: { ...inputs.world, consumedMaterialLots: {} } }), /building_unadmitted/);
  assert.throws(() => deriveWildsBuildingClearance({ ...inputs, world: f.world }), /building_unadmitted/);
  assert.equal('buildingClearances' in f.world, false);
  assert.equal('buildingClearances' in replayWildsWorld([], checkpointWildsWorld(f.world)), false);
  assert.equal('buildingClearances' in f.result.projection, false, 'missing explicit checkpoints must not default to globally fresh quantities');
});

test('rotated paid compound enumerates only oriented intersections once and projects finite depletion', async () => {
  const { deriveWildsBuildingClearance, projectWildsBuildingClearancePiles } = await model(), f = paidBuilding(tree.position, Math.PI / 4, 18, 12);
  const clearance = deriveWildsBuildingClearance({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 });
  assert.ok(clearance.sources.some(source => source.sourceId === projectWildsResourceSourceForObstacle(tree).sourceId));
  assert.equal(new Set(clearance.sources.map(source => source.sourceId)).size, clearance.sources.length);
  assert.equal(clearance.footprints[0].yaw, Math.PI / 4);
  const piles = projectWildsBuildingClearancePiles([clearance], {}), first = piles[0];
  const partial = projectWildsBuildingClearancePiles([clearance], { [first.pileId]: 1 });
  assert.equal(partial.find(pile => pile.pileId === first.pileId)!.remaining, first.remaining - 1);
  assert.deepEqual(partial.find(pile => pile.pileId === first.pileId)!.position, first.position);
  assert.equal(projectWildsBuildingClearancePiles([clearance], { [first.pileId]: first.remaining }).some(pile => pile.pileId === first.pileId), false);
  assert.throws(() => projectWildsBuildingClearancePiles([clearance], { [first.pileId]: first.remaining + 1 }), /depletion_invalid/);
});


test('explicit paid command checkpoints persist one consequence through exact retry and reload', async () => {
  const f = paidBuilding(), command = { ...f.command, clearanceSourceCheckpoints: genesisCheckpoints() };
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) });
  const built = service.execute(command, { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 });
  const history = built.projection.buildingClearances;
  assert.equal(Object.keys(history ?? {}).length, 1, 'explicit checkpoints must bind a persistent construction consequence');
  assert.deepEqual(replayWildsWorld(built.events, checkpointWildsWorld(f.world)), built.projection);
  assert.equal(service.execute(command, { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 }).events.length, 0);
  const restored = replayWildsWorld([], checkpointWildsWorld({ ...built.projection, creations: {}, creationEvents: {} }));
  assert.deepEqual(restored.buildingClearances, history, 'demolition/withdrawal cannot erase the original finite consequence');
});

test('a distinct exact clearance append preserves the already admitted creation bytes', async () => {
  const m = await model() as Awaited<ReturnType<typeof model>> & { deriveWildsBuildingClearanceEventPayload?: (input: { world: typeof f.result.projection; buildingId: string; buildingHead: string; sourceCheckpoints: ReturnType<typeof genesisCheckpoints>; kaiUPulse: number }) => { clearance: { buildingKaiUPulse: number } } };
  assert.equal(typeof m.deriveWildsBuildingClearanceEventPayload, 'function', 'already captured construction needs a separate causal clearance append');
  const f = paidBuilding(), before = JSON.stringify(f.result.projection.creations);
  const payload = m.deriveWildsBuildingClearanceEventPayload!({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 21 });
  assert.equal(payload.clearance.buildingKaiUPulse, 20);
  const event = createWildsWorldEvent({ kind: 'construction.clearance_derived' as 'creation.constructed', actorId: 'owner', causeId: 'clearance:after-local-capture', pulse, occurredAt: pulse, uPulse: 21, kaiKlok: 1, previousEventId: f.result.projection.cursor!.eventId, payload });
  const restored = replayWildsWorld([event], checkpointWildsWorld(f.result.projection));
  assert.equal(Object.keys(restored.buildingClearances ?? {}).length, 1);
  assert.equal(JSON.stringify(restored.creations), before);
});


test('ordinary foundation derives only its actual paid footprint after material and work admission', async () => {
  const { deriveWildsBuildingClearance } = await model();
  const materialSources = Array.from({ length: 50 }, (_, x) => projectWildsResourceRegion(x - 25, 0)).flat().filter(source => source.kind === 'timber' || source.kind === 'stone');
  const harvested = materialSources.map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: 'owner', actorPosition: source.position, kaiUPulse: 10 }));
  const world = { ...initialWildsWorldProjection(), materialLots: Object.fromEntries(harvested.map(item => [item.lot.lotId, item.lot])) };
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(world) });
  const authority = { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 };
  service.execute({ type: 'construction.project.create', name: 'Clearance foundation', region: regionForPosition(tree.position), commandId: 'project:clearance-manual' }, authority);
  const request = { pointer: { ...tree.position, y: sampleWildsBuildGround(tree.position.x, tree.position.z).elevation }, rotationQuarterTurns: 1, heightStep: 0, surfaceSnap: true, snapVersion: 2 as const, landscapeRule: 'wildz.build-ground.v2' as const };
  const preview = previewWildsContinuousBuild(service.snapshot(), 'owner', 'foundation', request);
  assert.equal(preview.placement.valid, true, preview.placement.cues.join(','));
  service.execute({ type: 'construction.component.place', projectId: preview.project!.projectId, placement: preview.placement, request, actorPosition: request.pointer, commandId: 'place:clearance-manual' }, authority);
  const component = Object.values(service.snapshot().constructionComponents)[0];
  const inputs = { buildingId: component.componentId, buildingHead: component.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 };
  assert.throws(() => deriveWildsBuildingClearance({ ...inputs, world: service.snapshot() }), /building_unpaid|building_unadmitted|footprint_invalid/);
  const required = component.recipe.stages[0].materials;
  for (const kind of ['timber', 'stone'] as const) {
    const lots = harvested.filter(item => item.lot.kind === kind).slice(0, required[kind]);
    for (const [index, lot] of lots.entries()) service.execute({ type: 'construction.component.deposit', componentId: component.componentId, componentHead: component.head, lotIds: [lot.lot.lotId], actorPosition: request.pointer, commandId: `deposit:clearance-${kind}-${index}` }, authority);
  }
  assert.throws(() => deriveWildsBuildingClearance({ ...inputs, world: service.snapshot() }), /building_unpaid|building_unadmitted|footprint_invalid/, 'deposits alone do not clear unpaid future stages');
  service.execute({ type: 'construction.component.work', componentId: component.componentId, componentHead: component.head, actorPosition: request.pointer, commandId: 'work:clearance-frame' }, authority);
  const progress = projectWildsConstructionProgress(component, Object.values(service.snapshot().constructionMaterialContributions), Object.values(service.snapshot().constructionWorkContributions));
  assert.equal(progress.stage, 'framed');
  const clearance = deriveWildsBuildingClearance({ ...inputs, world: service.snapshot() });
  assert.equal(clearance.buildingId, component.componentId);
  assert.ok(clearance.sources.some(source => source.sourceId === projectWildsResourceSourceForObstacle(tree).sourceId));
});


test('canopy clearance includes fruit when the original trunk is outside the apron', async () => {
  const m = await model(), point = { ...tree.position, x: tree.position.x + 3 };
  const f = paidBuilding(point), result = m.deriveWildsBuildingClearance({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 });
  assert.ok(Math.abs(tree.position.x - f.plan.pose.position.x) > 2.45);
  assert.ok(result.sources.some(source => source.sourceId === projectWildsResourceSourceForObstacle(tree).sourceId));
  assert.ok(result.sources.some(source => source.sourceId === vegetables.find(plant => plant.terrainTreeId === tree.id)!.sourceId));
});

test('zero remaining material is still retired and previously retired sources cannot reserve again', async () => {
  const m = await model(), f = paidBuilding(), original = projectWildsResourceSourceForObstacle(tree);
  let current = initialWildsHarvestedSourceState(original);
  for (let count = 0; count < original.capacity; count++) current = createWildsMaterialHarvest({ source: original, current, ownerReceizId: 'owner', actorPosition: original.position, kaiUPulse: 15 }).source;
  const checkpoints = genesisCheckpoints(), inputs = { world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: { ...checkpoints, materials: { ...checkpoints.materials, [original.sourceId]: current } }, kaiUPulse: 20 };
  const clearance = m.deriveWildsBuildingClearance(inputs);
  assert.equal(clearance.sources.find(source => source.sourceId === original.sourceId)!.remaining, 0);
  assert.equal(m.projectWildsBuildingClearancePiles([clearance], {}).some(source => source.sourceId === original.sourceId), false);
  const retired = m.deriveWildsBuildingClearance({ ...inputs, sourceCheckpoints: { ...checkpoints, retiredSourceIds: clearance.sources.map(source => source.sourceId) } });
  assert.equal(retired.sources.length, 0);
});

test('an established own offset wing blocks ordinary building even far from its instance center', () => {
  const f = paidBuilding({ ...tree.position, x: tree.position.x - 80 }, 0, 2, 2, { wingOffset: 80 });
  const request = { pointer: tree.position, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, snapVersion: 2 as const, landscapeRule: 'wildz.build-ground.v2' as const };
  assert.equal(previewWildsContinuousBuild(f.result.projection, 'owner', 'foundation', request).placement.valid, false);
});

test('finite piles use an available side when the nearest side belongs to an established neighbor', async () => {
  const m = await model(), f = paidBuilding();
  const neighbor = paidBuilding({ ...tree.position, x: tree.position.x + 3.4 }, 0, 2, 2, { prior: f.result.projection, name: 'neighbor' });
  const clearance = m.deriveWildsBuildingClearance({ world: neighbor.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 });
  for (const source of clearance.sources) assert.ok(Math.abs(source.position.x - neighbor.plan.pose.position.x) > 2 || Math.abs(source.position.z - neighbor.plan.pose.position.z) > 2);
});

test('persistent clearance removes original scenery after its building is withdrawn', async () => {
  const m = await model(), f = paidBuilding();
  const clearance = m.deriveWildsBuildingClearance({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 });
  const withdrawn = { ...f.result.projection, creations: {}, creationEvents: {}, buildingClearances: { [clearance.clearanceId]: clearance } };
  const pads = projectWildsConstructionTerrain(withdrawn);
  assert.equal(wildsBuildSceneryClearedAt(pads.filter(pad => pad.clearsScenery), tree.position.x, tree.position.z), true);
});


test('historical salvage keeps its exact reachable grade after mountain and water footing withdrawal', async () => {
  const m = await model(), point = { x: -445.5, y: 0, z: -604 };
  assert.equal(sampleWildsTerrain(point.x, point.z).surface, 'deep-water', 'actual authored mountain rises out of canonical water');
  const f = paidBuilding(point, 0, 28, 24);
  const clearance = m.deriveWildsBuildingClearance({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(point), kaiUPulse: 20 });
  const piles = m.projectWildsBuildingClearancePiles([clearance], {});
  assert.ok(piles.length > 0, 'actual original sources yield finite piles');
  const withdrawn = { ...f.result.projection, creations: {}, creationEvents: {}, buildingClearances: { [clearance.clearanceId]: clearance } };
  const pads = projectWildsConstructionTerrain(withdrawn);
  assert.ok(piles.some(pile => Math.abs(sampleWildsBuildGround(pile.position.x, pile.position.z).elevation - pile.position.y) > 1), 'without retained grading the mountain withdrawal moves a pile floor');
  for (const pile of piles) {
    const { x, y, z } = pile.position;
    assert.equal(sampleWildsConstructionTerrainAt(pads, x, z, sampleWildsBuildGround(x, z).elevation), y, 'persistent pile needs its exact admitted floor');
    const physical = composeWildsConstructionTerrain(admitWildsDiscoveryPhysicalNeighborhood(Math.floor(x / WILDS_DISCOVERY_SITE_REGION_SIZE), Math.floor(z / WILDS_DISCOVERY_SITE_REGION_SIZE)), pads);
    assert.ok(Math.abs(wildsSiteRuntimeGroundY(prepareWildsSiteRuntime(physical), outer, x, z, sampleWildsBuildGround(x, z).elevation) - y) < .03, 'actual movement mountain triangles retain the same laydown floor');
  }
  assert.equal(sampleWildsConstructionTerrainAt(projectWildsConstructionTerrain({ ...withdrawn, buildingClearances: undefined }), point.x, point.z, sampleWildsBuildGround(point.x, point.z).elevation), sampleWildsBuildGround(point.x, point.z).elevation, 'legacy withdrawal still restores canonical terrain');
});

test('an explicitly undefined food checkpoint never supplies fresh crop capacity', async () => {
  const m = await model(), f = paidBuilding(), fruit = vegetables.find(plant => plant.terrainTreeId === tree.id)!;
  const checkpoints = genesisCheckpoints();
  assert.throws(() => m.deriveWildsBuildingClearance({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: { ...checkpoints, food: { ...checkpoints.food, [fruit.sourceId]: undefined } as never }, kaiUPulse: 20 }), /food_checkpoint_invalid/);
});


test('actual paid evolution appends new source retirement while preserving original clearance bytes', async () => {
  const m = await model(), f = paidBuilding(), checkpoints = genesisCheckpoints();
  const birthService = new WildsWorldService({ checkpoint: checkpointWildsWorld(f.world) });
  const birth = birthService.execute({ ...f.command, clearanceSourceCheckpoints: checkpoints }, { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 });
  const originalHistory = birth.projection.buildingClearances!, original = Object.values(originalHistory)[0], before = JSON.stringify(original);
  const source = birth.projection.creations![f.command.instanceId];
  const { digest: _digest, ...basis } = f.command.definition;
  const definition = createCreationDefinition({ ...basis, nodes: basis.nodes.map(node => ({ ...node, shape: { ...node.shape, width: 18, depth: 12 } })) });
  const physical = projectCreationPhysical(source.instance, source.command.definition, compileWorldCreationSource(source));
  const context = { ...f.command.context, sourceHead: creationWorldSourceHead(birth.projection), evolution: { instanceId: source.instance.instanceId, head: source.instance.head, definition: source.command.definition },
    physical: [...f.command.context.physical, { chunkId: 'existing-instance', head: source.instance.head, instanceId: source.instance.instanceId, terrain: [], solids: physical.solids, walkable: physical.walkable, portals: physical.connections }] };
  const compiled = compileCreation(definition, context);
  assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') throw Error('evolution_fixture_compile');
  const resources = selectCreationResources(Object.values(birth.projection.materialLots), context.budget, compiled.plan.requiredResources, creationWorldAvailability(birth.projection, 'owner'));
  assert.deepEqual(resources.deficits, {});
  const evolved = birthService.execute({ ...f.command, type: 'creation.evolve', commandId: 'clearance:evolve', expectedHead: source.instance.head, definition, context, planDigest: compiled.plan.digest, resources: resources.lots, actorPosition: { ...context.pose.position, x: context.pose.position.x + 11 }, clearanceSourceCheckpoints: checkpoints }, { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 21 });
  assert.equal(JSON.stringify(evolved.projection.buildingClearances![original.clearanceId]), before);
  const all = Object.values(evolved.projection.buildingClearances!);
  assert.equal(all.length, 2);
  const ids = all.flatMap(clearance => clearance.sources.map(item => item.sourceId));
  assert.equal(new Set(ids).size, ids.length, 'evolution may retire new sources once but cannot reserve original sources again');
  assert.ok(all.find(clearance => clearance.clearanceId !== original.clearanceId)!.sources.length > 0);
  assert.deepEqual(replayWildsWorld([...birth.events, ...evolved.events], checkpointWildsWorld(f.world)), evolved.projection);
  assert.equal(m.projectWildsBuildingClearancePiles(all, {}).find(pile => pile.sourceId === original.sources[0].sourceId)!.remaining, original.sources[0].remaining);
});


test('side laydowns avoid surviving canonical scenery outside the cleared footprint', async () => {
  const m = await model();
  for (const origin of trees.filter(item => item.kind === 'tree').slice(0, 8)) {
    const f = paidBuilding(origin.position), clearance = m.deriveWildsBuildingClearance({ world: f.result.projection, buildingId: f.command.instanceId, buildingHead: f.source.instance.head, sourceCheckpoints: genesisCheckpoints(origin.position), kaiUPulse: 20 });
    const removed = new Set(clearance.sources.map(source => source.sourceId));
    for (const pile of m.projectWildsBuildingClearancePiles([clearance], {})) {
      const tx = Math.floor(pile.position.x / WILDS_TERRAIN_TILE_SIZE), tz = Math.floor(pile.position.z / WILDS_TERRAIN_TILE_SIZE);
      for (let x = tx - 1; x <= tx + 1; x++) for (let z = tz - 1; z <= tz + 1; z++) for (const obstacle of wildsTerrainObstaclesForTile(x, z)) {
        if (removed.has(projectWildsResourceSourceForObstacle(obstacle).sourceId)) continue;
        assert.ok(Math.hypot(pile.position.x - obstacle.position.x, pile.position.z - obstacle.position.z) >= obstacle.radius + .8, `laydown blocks standing original scenery ${obstacle.id}`);
      }
    }
  }
});


test('a generated blocker beyond the pointer query is included after a floor snaps eight meters', () => {
  const supply = paidBuilding({ x: 225.4, y: 0, z: 200 });
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(supply.world) });
  const authority = { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 };
  service.execute({ type: 'construction.project.create', name: 'Snapped foundation', region: regionForPosition({ x: 223, z: 200 }), commandId: 'project:snap-envelope' }, authority);
  const foundationRequest = { pointer: { x: 223, y: sampleWildsBuildGround(223, 200).elevation, z: 200 }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true };
  const foundation = previewWildsContinuousBuild(service.snapshot(), 'owner', 'foundation', foundationRequest);
  assert.equal(foundation.placement.valid, true);
  service.execute({ type: 'construction.component.place', projectId: foundation.project!.projectId, placement: foundation.placement, request: foundationRequest, actorPosition: foundationRequest.pointer, commandId: 'place:snap-envelope-foundation' }, authority);
  const request = { pointer: { x: 215, y: foundation.placement.anchors[0].position.y, z: 200 }, rotationQuarterTurns: 0, heightStep: 0,
    surfaceSnap: false, snapVersion: 2 as const, landscapeRule: 'wildz.build-ground.v2' as const };
  const baseline = previewWildsContinuousBuild(service.snapshot(), 'owner', 'floor', request);
  assert.equal(baseline.placement.transform.position.x, 223);
  assert.equal(baseline.placement.valid, true, `unblocked actual snapped floor baseline: ${baseline.placement.cues}`);
  const neighbor = paidBuilding({ x: 225.4, y: 0, z: 200 }, 0, 2, 2, { prior: service.snapshot(), name: 'snap-envelope-neighbor' });
  const floor = previewWildsContinuousBuild(neighbor.result.projection, 'owner', 'floor', request);
  assert.equal(floor.placement.transform.position.x, 223);
  assert.equal(floor.placement.geometry.center.x + floor.placement.geometry.halfExtents.x, 226);
  assert.equal(floor.placement.valid, false, 'the final floor intersects the real generated neighbor beginning at x=224.4');
  assert.ok(floor.placement.cues.includes('blocked'));
});

test('a real paid elevated supported floor preserves its foundation without creating upper earth or clearance', async () => {
  const m = await model();
  const sources = Array.from({ length: 50 }, (_, x) => projectWildsResourceRegion(x - 25, 0)).flat().filter(source => source.kind === 'timber' || source.kind === 'stone');
  const lots = sources.map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: 'owner', actorPosition: source.position, kaiUPulse: 10 }).lot);
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld({ ...initialWildsWorldProjection(), materialLots: Object.fromEntries(lots.map(lot => [lot.lotId, lot])) }) });
  const authority = { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 };
  service.execute({ type: 'construction.project.create', name: 'Supported floor', region: regionForPosition(tree.position), commandId: 'project:attached-floor' }, authority);
  const foundationRequest = { pointer: { ...tree.position, y: sampleWildsBuildGround(tree.position.x, tree.position.z).elevation }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, snapVersion: 2 as const, landscapeRule: 'wildz.build-ground.v2' as const };
  const foundation = previewWildsContinuousBuild(service.snapshot(), 'owner', 'foundation', foundationRequest);
  assert.equal(foundation.placement.valid, true);
  service.execute({ type: 'construction.component.place', projectId: foundation.project!.projectId, placement: foundation.placement, request: foundationRequest, actorPosition: foundationRequest.pointer, commandId: 'place:attached-foundation' }, authority);
  const support = Object.values(service.snapshot().constructionComponents)[0];
  for (const [index, lot] of lots.filter(lot => lot.kind === 'stone').slice(0, support.recipe.stages[0].materials.stone).entries())
    service.execute({ type: 'construction.component.deposit', componentId: support.componentId, componentHead: support.head, lotIds: [lot.lotId], actorPosition: foundationRequest.pointer, commandId: `deposit:attached-foundation:${index}` }, authority);
  service.execute({ type: 'construction.component.work', componentId: support.componentId, componentHead: support.head, actorPosition: foundationRequest.pointer, commandId: 'work:attached-foundation' }, authority);
  const before = projectWildsConstructionTerrain(service.snapshot());
  assert.ok(before.length > 0);
  for (const [kind, dx, dz] of [['wall', 0, 3], ['bed', 1, 0]] as const) {
    const attached = previewWildsContinuousBuild(service.snapshot(), 'owner', kind, { ...foundationRequest,
      pointer: { x: foundationRequest.pointer.x + dx, y: support.anchors[0].position.y, z: foundationRequest.pointer.z + dz } });
    assert.equal(attached.placement.valid, true, `v2 ${kind} attachment preserves real foundation support: ${attached.placement.cues}`);
  }
  const floorRequest = { ...foundationRequest, pointer: { ...foundationRequest.pointer, y: support.anchors[0].position.y }, heightStep: 12 };
  const preview = previewWildsContinuousBuild(service.snapshot(), 'owner', 'floor', floorRequest);
  assert.equal(preview.placement.valid, true, 'actual support attachment remains valid');
  service.execute({ type: 'construction.component.place', projectId: support.projectId, placement: preview.placement, request: floorRequest, actorPosition: floorRequest.pointer, commandId: 'place:attached-floor' }, authority);
  const floor = Object.values(service.snapshot().constructionComponents).find(component => component.kind === 'floor')!;
  for (const kind of ['timber', 'stone'] as const) {
    const available = lots.filter(lot => lot.kind === kind && !service.snapshot().consumedMaterialLots[lot.lotId]);
    for (const [index, lot] of available.slice(0, floor.recipe.stages[0].materials[kind]).entries())
      service.execute({ type: 'construction.component.deposit', componentId: floor.componentId, componentHead: floor.head, lotIds: [lot.lotId], actorPosition: floorRequest.pointer, commandId: `deposit:attached-floor:${kind}:${index}` }, authority);
  }
  service.execute({ type: 'construction.component.work', componentId: floor.componentId, componentHead: floor.head, actorPosition: floorRequest.pointer, commandId: 'work:attached-floor' }, authority);
  assert.equal(projectWildsConstructionProgress(floor, Object.values(service.snapshot().constructionMaterialContributions), Object.values(service.snapshot().constructionWorkContributions)).stage, 'framed');
  assert.deepEqual(projectWildsConstructionTerrain(service.snapshot()), before, 'attached upper floor must not create a soil-grading pad');
  assert.throws(() => m.deriveWildsBuildingClearance({ world: service.snapshot(), buildingId: floor.componentId, buildingHead: floor.head, sourceCheckpoints: genesisCheckpoints(), kaiUPulse: 20 }), /building_unsupported/);
});

test('composed scenery owns a deeply immutable derived footprint without freezing caller pads',()=>{
 const f=paidBuilding(),pads=structuredClone(projectWildsConstructionTerrain(f.result.projection));
 const point=f.command.context.pose.position;
 const physical=composeWildsConstructionTerrain(admitWildsDiscoveryPhysicalNeighborhood(Math.floor(point.x/WILDS_DISCOVERY_SITE_REGION_SIZE),Math.floor(point.z/WILDS_DISCOVERY_SITE_REGION_SIZE)),pads);
 assert.ok(physical.sceneryClearance?.length);
 assert.ok(Object.isFrozen(physical.sceneryClearance));
 for(const pad of physical.sceneryClearance!){assert.ok(Object.isFrozen(pad));assert.ok(Object.isFrozen(pad.center));assert.ok(Object.isFrozen(pad.halfExtents));}
 assert.equal(Object.isFrozen(pads),false);assert.equal(Object.isFrozen(pads[0].center),false);
 const before=structuredClone(physical.sceneryClearance);(pads[0].center as {x:number}).x+=100;
 assert.deepEqual(physical.sceneryClearance,before);
});
