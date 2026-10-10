import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admitWildsDiscoveryPhysicalNeighborhood } from '../src/features/play/wilds-discovery-sites';
import { prepareWildsSiteRuntime, wildsSiteRuntimeGroundY } from '../src/features/play/wilds-site-runtime';
import { sampleWildsTerrain, WILDS_TERRAIN_TILE_SIZE } from '../src/features/play/wilds-terrain-authority';
import { projectCreationCompilePhysical } from '../src/features/play/creation/compile-environment';
import { compileCreation } from '../src/features/play/creation/compiler';
import { assertWorldCreationPlacement, creationWorldSourceHead, creationWorldAvailability, compileWorldCreationSource, type WildsCreationConstructCommand } from '../src/features/play/creation/world-source';
import { initialWildsWorldProjection, checkpointWildsWorld, replayWildsWorld, type WildsWorldProjection } from '../src/features/play/wilds-world-state';
import { previewWildsContinuousBuild } from '../src/features/play/wilds-continuous-builder';
import { creationContextFixture, creationDefinitionFixture } from './support/creation-fixtures';
import { compileCreationPreview } from '../src/features/play/creation/preview-budget';
import type { CreationCompileContext, CreationPlan } from '../src/features/play/creation/compiler';
import { initialCreationConversation, reduceCreationConversation } from '../src/features/play/creation/conversation';
import { composeWildsConstructionTerrain, sampleWildsConstructionTerrainAt, projectWildsConstructionTerrain, createWildsConstructionTerrainSelector, type WildsConstructionTerrainPad } from '../src/features/play/wilds-construction-terrain';
import * as terrainRendering from '../src/features/play/wilds-terrain-rendering';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { combineCreationTechniques, projectCreationWorkers } from '../src/features/play/creation/capabilities';
import { selectCreationResources } from '../src/features/play/creation/resources';
import { groundCreationCompileContext, assertCreationTerrainObjectsClear } from '../src/features/play/creation/ground-placement';
import { WildsWorldService } from '../src/features/play/wilds-world-service';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { prepareCreationNavigation, resolveCreationMovement } from '../src/features/play/creation/navigation';
import { sampleWildsBuildGround } from '../src/features/play/wilds-build-ground';
import { createGearDefinition } from '../src/features/play/creation/equipment-presets';
import { createWorldCreationController } from '../src/features/play/creation/world-controller';
import { creatureForms } from '../src/features/play/creature-catalog';
import { applyWildsInput, initialPlayState, restorePlayState, serializePlayState } from '../src/features/play/game-state';
import type { CreationShape } from '../src/features/play/creation/types';
import { appendWildsDiscoveryVisualSolids } from '../src/features/play/wilds-discovery-monuments';
import { composeWildsBurrowPhysical } from '../src/features/play/wilds-burrow';
import { composeWildsInteriorConstruction } from '../src/features/play/wilds-construction-physics';
import { projectWildsRenderedLivingObstacles } from '../src/features/play/wilds-terrain-obstacles';
import { projectWildsStructureSupports } from '../src/features/play/wilds-structure-support';
import { projectWildsOwnedWorldAdditions } from '../src/features/play/wilds-player-world-additions';

const outer = 'wildz.space.outer.v1';
const summit = { x: -445.5, z: -604 };
const sites = admitWildsDiscoveryPhysicalNeighborhood(-4, -5);
const runtime = prepareWildsSiteRuntime(sites);
const world = initialWildsWorldProjection();
const groundY = wildsSiteRuntimeGroundY(runtime, outer, summit.x, summit.z, -8);
function house() {
  const context = creationContextFixture({ worldId: world.worldId, spaceId: outer,
    sourceHead: creationWorldSourceHead(world), pose: { position: { ...summit, y: groundY }, yaw: 0 } });
  const definition = creationDefinitionFixture();
  return { definition, context };
}

test('a house preview on the real dry mountain summit does not collide with its enclosing mountain box', () => {
  const { definition, context } = house();
  const physical = projectCreationCompilePhysical({ ...context, projections: [], obstacles: [], sites });
  const result = compileCreation(definition, { ...context, physical });
  assert.equal(result.status, 'ready', result.status === 'blocked' ? JSON.stringify(result.blockers) : '');
});

test('canonical house admission uses the mountain surface instead of rejecting its enclosing box', () => {
  const { definition, context } = house();
  const result = compileCreation(definition, context);
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.doesNotThrow(() => assertWorldCreationPlacement(world, result.plan));
});

test('a dry mountain emerging from a lake supports a workbench above its actual floor', () => {
  assert.equal(sampleWildsTerrain(summit.x, summit.z).surface, 'deep-water');
  assert.equal(groundY, 9.341337);
  const request = { pointer: { ...summit, y: groundY }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, snapVersion: 2 as const };
  const preview = previewWildsContinuousBuild(world, 'owner', 'workshop', request);
  assert.equal(preview.placement.valid, true, preview.placement.cues.join(','));
  assert.ok(preview.placement.transform.position.y > 9);
});

const supportChunk = { chunkId: 'wildz.creation.terrain-support.v1', head: 'sha256:' + 'a'.repeat(64), terrain: [], solids: [], walkable: [], portals: [] };
const assertSupportedPlacement = assertWorldCreationPlacement as (source: typeof world, plan: CreationPlan, context?: CreationCompileContext) => void;
test('new house previews keep their real ground contact while grading the surrounding slope', async () => {
  const { definition, context } = house();
  const preview = await compileCreationPreview({ definition, context: { ...context, physical: [supportChunk] },
    owned: context.budget, mode: 'manual', current: () => true,
    compile: async (definition, context) => compileCreation(definition, context) });
  assert.equal(preview?.result.status, 'ready');
  if (preview?.result.status !== 'ready') return;
  assert.equal(preview.result.plan.pose.position.y, 9.341337);
});

for (const [name, position] of [
  ['floating house', { ...summit, y: 14 }],
] as const) test(`current terrain support rejects a ${name}`, () => {
  const { definition, context } = house();
  const supported = { ...context, pose: { position, yaw: 0 }, physical: [supportChunk] };
  const compiled = compileCreation(definition, supported);
  assert.equal(compiled.status, 'ready');
  if (compiled.status === 'ready') assert.throws(() => assertSupportedPlacement(world, compiled.plan, supported), /creation_world_(ground|dry|grade|entry)/);
});

test('placing a house in water raises paid earth above the water surface', async () => {
  const { definition, context } = house(), position = { x: -756.507372, y: -1.976998, z: -743.781128 };
  const supported = { ...context, pose: { position, yaw: 0 }, physical: [supportChunk] };
  const preview = await compileCreationPreview({definition, context:supported, owned:context.budget, mode:'manual',current:()=>true,compile:async(definition,context)=>compileCreation(definition,context)});
  assert.equal(preview?.result.status,'ready');
  if(preview?.result.status!=='ready')return;
  assert.equal(preview.result.plan.pose.position.y,-.86);
  const plan = preview.result.plan;
  assert.doesNotThrow(()=>assertSupportedPlacement(world,plan,supported));
});

test('a large compound takes precedence over a dry steep mountain footprint', () => {
  const { definition, context } = house();
  const compound = creationDefinitionFixture({ nodes: [{ ...definition.nodes[0], shape: { ...definition.nodes[0].shape, width: 28, depth: 24 } }] });
  const supported = { ...context, pose: { position: { x: -751.915372, y: .603307, z: -739.954461 }, yaw: 0 }, physical: [supportChunk] };
  const compiled = compileCreation(compound, supported);
  assert.equal(compiled.status, 'ready');
  if (compiled.status === 'ready') assert.doesNotThrow(() => assertSupportedPlacement(world, compiled.plan, supported));
});

test('cut and fill level the mountain under an entire compound and preserve the distant landscape', () => {
  const pad: WildsConstructionTerrainPad = { id: 'paid:compound', ownerId: 'owner', sourceHead: 'sha256:' + 'c'.repeat(64),
    center: { x: -751.915372, y: .603307, z: -739.954461 }, halfExtents: { x: 14, z: 12 }, yaw: 0 };
  const graded = composeWildsConstructionTerrain(admitWildsDiscoveryPhysicalNeighborhood(-5, -5), [pad]);
  const actual = prepareWildsSiteRuntime(graded);
  for (const [dx, dz] of [[-10, -10], [10, 10], [0, 0], [0, -12]] as const)
    assert.ok(Math.abs(wildsSiteRuntimeGroundY(actual, outer, pad.center.x + dx, pad.center.z + dz, -8) - .603307) < .00001);
  assert.equal(sampleWildsConstructionTerrainAt([pad], 2, 2, 7.874786), 7.874786);
});

test('graded earth renders above a formerly submerged footprint and removes water triangles there', () => {
  const pad: WildsConstructionTerrainPad = { id: 'paid:lake-house', ownerId: 'owner', sourceHead: 'sha256:' + 'c'.repeat(64),
    center: { x: -750, y: .603307, z: -740 }, halfExtents: { x: 14, z: 12 }, yaw: 0 };
  const tileX = Math.floor(-750 / WILDS_TERRAIN_TILE_SIZE), tileZ = Math.floor(-740 / WILDS_TERRAIN_TILE_SIZE);
  const mesh = terrainRendering.buildWildsTerrainMeshProjection(tileX, tileZ, 16);
  const water = terrainRendering.buildWildsTerrainWaterProjection(tileX, tileZ, 0, 16);
  const gradeMesh = (terrainRendering as unknown as { gradeWildsTerrainMeshProjection?: (input: typeof mesh, pads: readonly WildsConstructionTerrainPad[]) => typeof mesh }).gradeWildsTerrainMeshProjection;
  const gradeWater = (terrainRendering as unknown as { gradeWildsTerrainWaterProjection?: (input: typeof water, pads: readonly WildsConstructionTerrainPad[]) => typeof water }).gradeWildsTerrainWaterProjection;
  const changedMesh = gradeMesh?.(mesh, [pad]) ?? mesh, changedWater = gradeWater?.(water, [pad]) ?? water;
  const beneath = changedMesh.vertices.filter(vertex => Math.abs(vertex.world.x + 750) < 10 && Math.abs(vertex.world.z + 740) < 10);
  assert.ok(beneath.length > 0);
  assert.ok(beneath.every(vertex => Math.abs(vertex.position.y - .603307) < .00001));
  assert.ok(changedWater.deep.indices.length < water.deep.indices.length, 'filled dry land cannot keep an overlapping lake water layer');
});

test('a current foundation fills a submerged mountain footing above the waterline', () => {
  const point = { x: -756.5, y: -1.97, z: -744 };
  const preview = previewWildsContinuousBuild(world, 'owner', 'foundation', { pointer: point, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, snapVersion: 2 });
  assert.equal(preview.placement.valid, true);
  assert.equal(preview.placement.transform.position.y, -.56);
});

test('a levelled preview becomes the saved placement pose before build or reload', () => {
  const { definition, context } = house();
  const shifted = { ...context, pose: { ...context.pose, position: { ...context.pose.position, y: 9.38 } } };
  const result = compileCreation(definition, shifted); assert.equal(result.status, 'ready');
  if (result.status !== 'ready') return;
  let state = initialCreationConversation('owner', outer, context.pose);
  state = reduceCreationConversation(state, { type: 'request', requestId: 'ground' });
  state = reduceCreationConversation(state, { type: 'proposal', requestId: 'ground', definition, reply: 'Ready' });
  state = reduceCreationConversation(state, { type: 'compiled', requestId: 'ground', plan: result.plan });
  assert.equal(state.placement.position.y, 9.38);
});

const pulse = '2026-10-10T12:00:00.000Z';
function paidHouse(position: { x: number; y: number; z: number }, terrainSupport = true,
  shape: CreationShape = { kind: 'shell', width: 2, height: 2.2, depth: 2, thickness: .03, doorway: { width: .9, height: 1.9 } }, materialCount = 1) {
  const resources = Array.from({ length: materialCount > 1 ? 100 : 25 }, (_, index) => projectWildsResourceRegion(index - 12, 0)).flat().filter(source => source.kind === 'timber').slice(0, materialCount);
  const harvested = resources.map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: 'owner', actorPosition: source.position, kaiUPulse: 10 }));
  const original = { ...initialWildsWorldProjection(), materialLots: Object.fromEntries(harvested.map(item => [item.lot.lotId, item.lot])), harvestedSources: Object.fromEntries(harvested.map((item, index) => [resources[index].sourceId, item.source])) };
  const card = sealCollectedCard({ capturedAt: pulse, encounterId: 'mountain-house-crew', formId: 'mintcub-1', ownerReceizId: 'owner' });
  const condition = emptyAdventureCondition(card.id);
  const node = house().definition.nodes[0];
  const definition = creationDefinitionFixture({ nodes: [{ ...node, shape }] });
  const context = groundCreationCompileContext(definition, creationContextFixture({ worldId: original.worldId, spaceId: outer,
    sourceHead: creationWorldSourceHead(original), pose: { position, yaw: 0 }, budget: { timber: materialCount },
    techniques: combineCreationTechniques(projectCreationWorkers([card], { [card.id]: condition })), physical: terrainSupport ? [supportChunk] : [] }));
  const compiled = compileCreation(definition, context);
  assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') throw Error('paid_house_compile');
  const selected = selectCreationResources(Object.values(original.materialLots), context.budget, compiled.plan.requiredResources, creationWorldAvailability(original, 'owner'));
  assert.deepEqual(selected.deficits, {});
  const command: WildsCreationConstructCommand = { type: 'creation.construct', commandId: 'creation:mountain-house:command', instanceId: 'creation:mountain-house:instance',
    definition, context, planDigest: compiled.plan.digest, workerSources: [{ card, condition }], resources: selected.lots, actorPosition: context.pose.position };
  const admitted = new WildsWorldService({ checkpoint: checkpointWildsWorld(original) }).execute(command, { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 });
  assert.equal(admitted.constitution.result, 'VALID');
  return { ...admitted, original, command, definition, context, plan: compiled.plan, lotId: harvested[0].lot.lotId };
}

for (const [name, point] of [['mountain', { ...summit, y: groundY }], ['lake', { x: -756.507372, y: -1.976998, z: -743.781128 }],
  ['normal ground', { x: 2, y: sampleWildsBuildGround(2, 2).elevation, z: 2 }]] as const)
  test(`paid ${name} house reconstructs its earth and accessible doorway after replay`, () => {
    const built = paidHouse(point), restored = replayWildsWorld([], checkpointWildsWorld(built.projection));
    const source = restored.creations![built.command.instanceId], plan = compileWorldCreationSource(source);
    assert.equal(plan.digest, built.plan.digest);
    assert.equal(source.instance.head, built.projection.creations![built.command.instanceId].instance.head);
    const pads = projectWildsConstructionTerrain(restored);
    assert.equal(pads.length, 1); assert.equal(pads[0].ownerId, 'owner');
    const regionX = Math.floor(point.x / 128), regionZ = Math.floor(point.z / 128);
    const physical = composeWildsConstructionTerrain(admitWildsDiscoveryPhysicalNeighborhood(regionX, regionZ), pads), runtime = prepareWildsSiteRuntime(physical);
    const floorY = plan.pose.position.y, doorway = { x: point.x, y: floorY, z: point.z - 1.3 };
    assert.ok(Math.abs(wildsSiteRuntimeGroundY(runtime, outer, doorway.x, doorway.z, -8) - floorY) < .000001);
    const creation = projectCreationPhysical(source.instance, source.command.definition, plan);
    const moved = resolveCreationMovement(prepareCreationNavigation([creation]), outer, doorway, { ...doorway, z: point.z });
    assert.equal(moved.blocked, false);
    assert.ok(Math.abs(moved.position.z - point.z) < .00001);
    assert.ok(Math.abs(moved.position.y - (floorY + .03)) < .00001);
    assert.ok(creation.solids.find(solid => solid.id.endsWith(':roof'))!.center.y > moved.position.y + 1.55);
    const gameplay = applyWildsInput({ ...initialPlayState, player: { x: doorway.x, z: doorway.z }, siteSpace: {
      version: 'wildz.site-space-state.v1', spaceId: outer, siteKey: null, surfaceId: null, position: doorway, flooded: false
    } }, { type: 'move', direction: 'south', siteRuntime: runtime, creationNavigation: prepareCreationNavigation([creation]) });
    assert.ok(gameplay.player.z > doorway.z + .9, gameplay.lastEvent);
    assert.ok(Math.abs(gameplay.siteSpace.position.y - (floorY + .03)) < .00001);
  });

test('a paid 28 by 24 mountain compound admits straight and camera-diagonal doorway entry after replay', () => {
  const point = { x: -751.915372, y: .603307, z: -739.954461 };
  const built = paidHouse(point, true, { kind: 'shell', width: 28, height: 3, depth: 24, thickness: .03, doorway: { width: 1.2, height: 2.2 } }, 50);
  const restored = replayWildsWorld([], checkpointWildsWorld(built.projection));
  const source = restored.creations![built.command.instanceId], plan = compileWorldCreationSource(source);
  assert.equal(plan.digest, built.plan.digest);
  const pads = projectWildsConstructionTerrain(restored);
  const physical = composeWildsConstructionTerrain(composeWildsInteriorConstruction(composeWildsBurrowPhysical(
    appendWildsDiscoveryVisualSolids(admitWildsDiscoveryPhysicalNeighborhood(-6, -6)), restored.burrows), restored), pads);
  const runtime = prepareWildsSiteRuntime(physical);
  const navigation = prepareCreationNavigation([projectCreationPhysical(source.instance, source.command.definition, plan)]);
  const doorway = { ...point, z: point.z - 12.6 };
  assert.ok(Math.abs(wildsSiteRuntimeGroundY(runtime, outer, doorway.x, doorway.z, -8) - point.y) < .000001);
  const initial = restorePlayState(serializePlayState({ ...initialPlayState, ownedWorldAdditions: projectWildsOwnedWorldAdditions(restored, 'owner'), player: { x: doorway.x, z: doorway.z }, siteSpace: {
    version: 'wildz.site-space-state.v1' as const, spaceId: outer, siteKey: null, surfaceId: null, position: doorway, flooded: false
  } }), 'owner');
  assert.ok(Math.abs(initial.siteSpace.position.y - point.y) < .000001, `restore lowered the player beneath admitted earth to ${initial.siteSpace.position.y}`);
  const inside = restorePlayState(serializePlayState({ ...initial, player: { x: point.x, z: point.z }, siteSpace: {
    ...initial.siteSpace, position: { ...point, y: point.y + .03 }
  } }), 'owner');
  assert.ok(Math.abs(inside.siteSpace.position.y - (point.y + .03)) < .000001, 'restore retains the admitted floor above the earth');
  const wetPoint = { ...point, z: point.z - 15.5 };
  const wetGround = wildsSiteRuntimeGroundY(runtime, outer, wetPoint.x, wetPoint.z, -8);
  assert.ok(wetGround < -1.06);
  const wet = restorePlayState(serializePlayState({ ...initial, player: { x: wetPoint.x, z: wetPoint.z }, siteSpace: {
    ...initial.siteSpace, position: { ...wetPoint, y: wetGround }
  } }), 'owner');
  assert.equal(wet.siteSpace.flooded, true, 'the submerged outer grading blend stays flooded');
  for (const direction of [{ x: 0, z: 1 }, { x: 4.2, z: 6.6 }]) {
    let state: typeof initialPlayState = initial;
    for (let step = 0; step < 12; step++) {
      state = applyWildsInput(state, { type: 'move-vector', ...direction, siteRuntime: runtime, creationNavigation: navigation,
        additionalObstacles: projectWildsRenderedLivingObstacles(restored), structureSupports: projectWildsStructureSupports(restored) });
      assert.doesNotMatch(state.lastEvent, /Mountain slope too steep|Deep water ahead/);
    }
    assert.ok(state.player.z > point.z - 10, JSON.stringify(state.player));
    assert.ok(Math.abs(state.siteSpace.position.y - (point.y + .03)) < .00001);
  }
});

test('distant construction leaves legacy ground, water and interior restoration unchanged', () => {
  const built = paidHouse({ ...summit, y: groundY }), owned = projectWildsOwnedWorldAdditions(built.projection, 'owner');
  const physical = admitWildsDiscoveryPhysicalNeighborhood(3, 2), portal = physical.portals[0];
  const interior = physical.surfaces.find(surface => surface.spaceId === portal.toSpaceId)!;
  for (const siteSpace of [
    { version: 'wildz.site-space-state.v1' as const, spaceId: outer, siteKey: null, surfaceId: null, position: { x: 5000, y: 100, z: 5000 }, flooded: false },
    { version: 'wildz.site-space-state.v1' as const, spaceId: outer, siteKey: null, surfaceId: null, position: { x: -756.507372, y: -1.976998, z: -743.781128 }, flooded: true },
    { version: 'wildz.site-space-state.v1' as const, spaceId: interior.spaceId, siteKey: interior.siteKey, surfaceId: interior.id, position: { ...portal.position, y: interior.center.y }, flooded: true }
  ]) {
    const base = { ...initialPlayState, player: { x: siteSpace.position.x, z: siteSpace.position.z }, siteSpace };
    const legacy = restorePlayState(serializePlayState(base), 'owner');
    const withDistantPad = restorePlayState(serializePlayState({ ...base, ownedWorldAdditions: owned }), 'owner');
    assert.deepEqual(withDistantPad.siteSpace, legacy.siteSpace);
  }
});

test('old admitted airborne houses replay exact geometry without acquiring a new earth pad', () => {
  const legacy = paidHouse({ x: 5000, y: 100, z: 5000 }, false), restored = replayWildsWorld([], checkpointWildsWorld(legacy.projection));
  const source = restored.creations![legacy.command.instanceId];
  assert.equal(compileWorldCreationSource(source).digest, legacy.plan.digest);
  assert.equal(source.instance.pose.position.y, 100);
  assert.deepEqual(projectWildsConstructionTerrain(restored), []);
});

test('pad selection retains identity across clock and inventory clones but withdraws missing or transferred paid support', () => {
  const built = paidHouse({ ...summit, y: groundY }), select = createWildsConstructionTerrainSelector(), first = select(built.projection);
  assert.equal(first.length, 1);
  assert.equal(select(JSON.parse(JSON.stringify({ ...built.projection, revision: built.projection.revision + 1 }))), first);
  const withdrawn = { ...built.projection, materialLots: {} };
  assert.deepEqual(select(withdrawn), []);
  select(built.projection);
  const transferred = { ...built.projection, materialCustody: { [built.lotId]: { ownerReceizId: 'other-owner', subjectId: 'subject', subjectHead: 'sha256:' + 'f'.repeat(64), receiptId: 'receipt', transferId: 'transfer' } } };
  assert.deepEqual(select(transferred), []);
});

test('portable equipment retains its authored placement and never buys a terrain support marker', () => {
  const definition = createGearDefinition({ creatorId: 'owner', seed: 'equipment-no-earth', kind: 'trail-rifle' });
  const context = creationContextFixture({ spaceId: outer, pose: { position: { ...summit, y: groundY }, yaw: 0 }, physical: [supportChunk] });
  const grounded = groundCreationCompileContext(definition, context);
  assert.deepEqual(grounded.pose, context.pose);
  assert.deepEqual(grounded.physical, []);
});

test('an actual surface gear preview commits, replays and restores without a terrain pad', async () => {
  const initial = paidHouse({ ...summit, y: groundY }, true, undefined, 2).projection;
  const card = sealCollectedCard({ capturedAt: pulse, encounterId: 'terrain-gear-forge-crew', formId: creatureForms.find(form => form.element === 'Ember')!.id, ownerReceizId: 'owner' });
  const condition = emptyAdventureCondition(card.id), definition = createGearDefinition({ creatorId: 'owner', seed: 'surface-gear-proof', kind: 'bow' });
  const context = creationContextFixture({ worldId: initial.worldId, spaceId: outer, sourceHead: creationWorldSourceHead(initial),
    pose: { position: { x: summit.x + 4, y: sampleWildsBuildGround(summit.x + 4, summit.z).elevation, z: summit.z }, yaw: 0 }, budget: { timber: 1 }, physical: [supportChunk],
    techniques: combineCreationTechniques(projectCreationWorkers([card], { [card.id]: condition })) });
  const preview = await compileCreationPreview({ definition, context, owned: context.budget, mode: 'manual', current: () => true,
    compile: async (definition, context) => compileCreation(definition, context) });
  assert.equal(preview?.result.status, 'ready'); if (preview?.result.status !== 'ready') return;
  let current: WildsWorldProjection = initial;
  const controller = createWorldCreationController({ environment: () => ({ ownerId: 'owner', worldId: initial.worldId, spaceId: outer }),
    world: () => current, crew: () => ({ cards: [card], conditions: { [card.id]: condition } }), position: () => context.pose.position,
    compileContext: () => context, project: async (instance, definition, plan) => projectCreationPhysical(instance, definition, plan),
    admit: async (command, beforeAdmit) => {
      await beforeAdmit();
      const admitted = new WildsWorldService({ checkpoint: checkpointWildsWorld(current) }).execute(command,
        { actorId: 'owner', canonical: true, pulse, occurredAt: pulse, uPulse: 20 });
      current = admitted.projection; return admitted;
    } });
  assert.equal(controller.validatePlacement(preview.result.plan, context, definition), null);
  const result = await controller.commit(definition, preview.result.plan, [card.id]);
  assert.equal(result.status, 'admitted', result.status === 'rejected' ? result.reason : result.status);
  const restored = replayWildsWorld([], checkpointWildsWorld(current));
  assert.deepEqual(projectWildsConstructionTerrain(restored), projectWildsConstructionTerrain(initial));
  assert.equal(await controller.restore(), 2);
  assert.equal(controller.snapshot().projections.length, 2);
  const select = createWildsConstructionTerrainSelector(), before = select(restored);
  const gear = Object.values(restored.creations!).find(source => Object.values(source.instance.nodeStates).some(node => node.kind === 'equipment'))!;
  let historyReads = 0;
  const creations = Object.fromEntries(Object.entries(restored.creations!).map(([id, source]) => [id,
    id === gear.instance.instanceId ? { ...source, instance: { ...source.instance, head: 'sha256:' + 'f'.repeat(64) } }
      : Object.defineProperty({ ...source }, 'history', { enumerable: true, get() { historyReads++; throw Error('building_history_not_materialized_for_gear_tick'); } })]));
  assert.equal(select({ ...restored, creations }), before, 'portable gear head changes must not reproject paid building histories');
  assert.equal(historyReads, 0);
});

test('a mountain cut preserves trees and existing building footprints at any prior elevation', () => {
  const { definition, context } = house(), compiled = compileCreation(definition, context);
  assert.equal(compiled.status, 'ready'); if (compiled.status !== 'ready') return;
  const solid = { id: 'protected-tree', center: { ...summit, y: groundY + 30 }, halfExtents: { x: .3, y: 3, z: .3 }, yaw: 0 };
  assert.throws(() => assertCreationTerrainObjectsClear(compiled.plan, [solid]), /terrain_occupied/);
  assert.doesNotThrow(() => assertCreationTerrainObjectsClear(compiled.plan, [{ ...solid, center: { ...solid.center, x: summit.x + 20 } }]));
});
