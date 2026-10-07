import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReceizCreationPlanner, planWildsCreation } from '../src/lib/receiz/wilds-creation-planner';
import { planCreation, type CreationPlannerRequest } from '../src/features/play/creation/planner';
import { compileCreation } from '../src/features/play/creation/compiler';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { applyCreationPatch } from '../src/features/play/creation/patch';
import { creationShelterStarterPrompt } from '../src/features/play/creation/starter-prompt';
import { creationContextFixture, creationDefinitionFixture } from './support/creation-fixtures';
import { prepareCreationNavigation, resolveCreationMovement } from '../src/features/play/creation/navigation';
import { creationNodePoses } from '../src/features/play/creation/projection';
import type { CreationPoint } from '../src/features/play/creation/types';
import { createCreationPageIndex, deriveCreationResidencyBudget, selectCreationPages } from '../src/features/play/creation/residency';
import { creationRenderUploadBytes } from '../src/features/play/creation/render-geometry';
import { wildsQualityProfileForTier } from '../src/features/play/wilds-quality-profile';

function request(overrides: Partial<CreationPlannerRequest> = {}): CreationPlannerRequest {
  return {
    requestId: 'local:first', actorId: 'owner', selected: null,
    message: creationShelterStarterPrompt({ displayName: 'Mint Trail', pose: { position: { x: 12, y: 0, z: -8 }, yaw: 0 } }),
    workers: [{ assetId: 'card', subjectId: 'creature', head: `sha256:${'a'.repeat(64)}`, proofDigest: `sha256:${'b'.repeat(64)}`, techniques: ['assembly'], ready: true, reasons: [] }],
    context: creationContextFixture({ budget: { timber: 12 }, techniques: ['assembly'] }),
    ...overrides,
  };
}
async function propose(input: CreationPlannerRequest, signal = new AbortController().signal) {
  return planCreation(input, createReceizCreationPlanner({ actorId: input.actorId }), signal);
}

test('a ten-room mansion with multiple floors produces a finite habitable composition', async () => {
  const input = request({ message: 'Build a timber mansion with multiple floors and 10 rooms', context: creationContextFixture({ budget: { timber: 1000 }, techniques: ['assembly'] }) });
  const result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a mansion definition');
  const definition = result.proposal.definition, rooms = definition.nodes.filter(n => n.behaviors.some(b => b.id === 'habitat'));
  assert.equal(rooms.length, 10, 'the requested room count must survive planning');
  assert.equal(new Set(rooms.map(room => room.pose.position.y)).size, 2, 'multiple floors means two usable levels');
  assert.ok(rooms.every(room => room.shape.doorway && room.shape.doorway.width >= 1.2 && room.shape.doorway.height >= 2.2));
  assert.ok(definition.nodes.some(n => n.id.startsWith('stair-')));
  assert.ok(definition.nodes.length <= 128);
  const compiled = compileCreation(definition, input.context);
  assert.equal(compiled.status, 'ready');
  if (compiled.status !== 'ready') throw Error('Expected ready mansion compilation');
  assert.ok(Number.isSafeInteger(compiled.plan.requiredResources.timber) && compiled.plan.requiredResources.timber > 12 && compiled.plan.requiredResources.timber <= 1000);
  assert.ok(Number.isSafeInteger(compiled.plan.requiredWork) && compiled.plan.requiredWork > 0);
});

test('a firearm request explains the missing mechanics without substituting a close-range weapon', async () => {
  for (const message of ['Build a firearm', 'Make a timber rifle', 'Create a pistol', 'Add ammunition to it']) {
    const input = request({ message }), before = structuredClone(input);
    const result = await planWildsCreation(input, { actorId: 'owner' }, new AbortController().signal);
    assert.equal(result.status, 'blocked');
    if (result.status === 'blocked') {
      assert.match(result.reason, /ranged attacks, projectiles and ammunition/);
      assert.doesNotMatch(result.reason, /too large/i);
    }
    assert.deepEqual(input, before);
  }
});

test('counted house floors have walkable stairs and clear room entrances after world rotation', async () => {
  const context = creationContextFixture({ pose: { position: { x: 137, y: 11, z: -63 }, yaw: .61 }, budget: { timber: 1000 }, techniques: ['assembly'] });
  const result = await propose(request({ message: 'Build a three-storey timber house with ten rooms', context }));
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a counted house');
  const definition = result.proposal.definition, compiled = compileCreation(definition, context);
  assert.equal(compiled.status, 'ready');
  if (compiled.status !== 'ready') throw Error('Expected ready house');
  const chunks = compiled.plan.chunks, poses = creationNodePoses(definition, context.pose);
  const navigation = prepareCreationNavigation([{ instanceId: 'walking-house', head: 'walking-head', definitionDigest: definition.digest, worldId: context.worldId, spaceId: context.spaceId,
    chunks, solids: chunks.flatMap(chunk => chunk.solids), walkable: chunks.flatMap(chunk => chunk.walkable), interiors: chunks.flatMap(chunk => chunk.interiors), connections: chunks.flatMap(chunk => chunk.connections), nodePoses: poses }]);
  const world = (p: CreationPoint): CreationPoint => ({ x: context.pose.position.x + p.x * Math.cos(context.pose.yaw) + p.z * Math.sin(context.pose.yaw), y: context.pose.position.y + p.y, z: context.pose.position.z - p.x * Math.sin(context.pose.yaw) + p.z * Math.cos(context.pose.yaw) });
  const walk = (from: CreationPoint, to: CreationPoint) => {
    const moved = resolveCreationMovement(navigation, context.spaceId, from, to);
    assert.equal(moved.blocked, false, `route from ${JSON.stringify(from)} to ${JSON.stringify(to)} must be clear`);
    assert.ok(Math.hypot(moved.position.x - to.x, moved.position.z - to.z) < 1e-7);
    return moved.position;
  };
  const rooms = definition.nodes.filter(n => n.behaviors.some(b => b.id === 'habitat'));
  assert.equal(rooms.length, 10);
  assert.equal(new Set(rooms.map(room => poses.get(room.id)!.position.y)).size, 3);
  for (const room of rooms) {
    const p = room.pose.position, floor = p.y + room.shape.thickness!;
    walk(world({ x: p.x, y: floor, z: -room.shape.depth / 2 - 1 }), world({ x: p.x, y: floor, z: 0 }));
    if (p.y > 0) assert.ok(room.supports.some(id => rooms.some(lower => lower.id === id && lower.pose.position.y < p.y)));
  }
  for (let flight = 1; flight < 3; flight++) {
    const steps = definition.nodes.filter(n => n.id.startsWith(`stair-${flight}-step-`)).sort((a, b) => a.pose.position.y - b.pose.position.y);
    assert.ok(steps.length >= 16);
    const first = steps[0], last = steps.at(-1)!, gallery = definition.nodes.find(n => n.id === `gallery-${flight}`)!;
    const landingX = first.pose.position.x < 0 ? -4 : 4;
    let position = world({ x: landingX, y: gallery.pose.position.y + gallery.shape.height, z: gallery.pose.position.z });
    position = walk(position, world({ x: landingX, y: gallery.pose.position.y + gallery.shape.height, z: first.pose.position.z }));
    for (const step of steps) {
      assert.ok(step.shape.height <= .2 + 1e-9 && step.shape.depth >= 1.4);
      position = walk(position, world({ ...step.pose.position, y: step.pose.position.y + step.shape.height }));
    }
    assert.ok(Math.abs(position.y - context.pose.position.y - last.pose.position.y - last.shape.height) < 1e-7);
    position = walk(position, world({ x: -landingX, y: last.pose.position.y + last.shape.height, z: last.pose.position.z }));
    const upperGallery = definition.nodes.find(n => n.id === `gallery-${flight + 1}`)!;
    walk(position, world({ x: -landingX, y: upperGallery.pose.position.y + upperGallery.shape.height, z: upperGallery.pose.position.z }));
  }
});

test('a mansion keeps its real material shortage instead of shrinking the requested rooms', async () => {
  const input = request({ message: 'Build a mansion with 10 rooms and two floors' }), result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a mansion quote');
  assert.equal(result.proposal.definition.nodes.filter(n => n.behaviors.some(b => b.id === 'habitat')).length, 10);
  const compiled = compileCreation(result.proposal.definition, input.context);
  assert.equal(compiled.status, 'blocked');
  if (compiled.status === 'blocked') assert.ok(compiled.blockers.some(blocker => blocker.code === 'resources' && /timber/.test(blocker.message)));
});

test('the maximum room layout and its stairs fit a low-tier nearby page residency budget', async () => {
  const input = request({ message: 'Build a timber house with 24 rooms and 4 floors', context: creationContextFixture() }), result = await propose(input);
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a mansion quote');
  const definition = result.proposal.definition, compiled = compileCreation(definition, input.context);
  if (compiled.status !== 'ready') throw Error('Expected ready mansion');
  const chunks = compiled.plan.chunks, owners = new Map(chunks.flatMap(chunk => chunk.nodeIds.map(id => [id, chunk.id] as const)));
  const index = createCreationPageIndex(chunks.map(chunk => ({ pageId: chunk.id, head: definition.digest, worldId: input.context.worldId, spaceId: input.context.spaceId,
    bounds: chunk.bounds, nodeIds: chunk.nodeIds, vertices: chunk.positions.length / 3, drawCalls: chunk.materials.length, textureBytes: 0, uploadBytes: creationRenderUploadBytes(chunk),
    dependencies: [...new Set(definition.nodes.filter(node => chunk.nodeIds.includes(node.id)).flatMap(node => [...node.supports, ...(node.parentId ? [node.parentId] : [])].map(id => owners.get(id)!).filter(id => id !== chunk.id)))] })));
  const selected = selectCreationPages(index, { worldId: input.context.worldId, spaceId: input.context.spaceId, position: { x: 0, y: .1, z: -5.7 }, radius: 64, limit: 128, pinnedPageIds: [] },
    deriveCreationResidencyBudget(wildsQualityProfileForTier('low', false), { drawCalls: 0, triangles: 0, textureBytes: 0, maximumTextureBytes: 0 }));
  const nodes = selected.flatMap(page => page.nodeIds);
  assert.ok(nodes.some(id => id.startsWith('stair-')), 'the complete stair support closure must fit alongside its rooms');
  assert.ok(nodes.includes('landing-4'), 'the top landing must load with its stair support');
  assert.equal(nodes.filter(id => /^room(?:-\d+)?$/.test(id)).length, 24);
});

test('composed dimensions and part counts stay inside finite local bounds', async () => {
  for (const message of ['Build a timber house with 24 rooms on one floor, 6m wide', 'Build a timber house with 24 rooms on one floor, 5.3m wide with a garden', 'Build a timber house with ten rooms on four floors, 9m tall', 'Build a timber house with four rooms, 123m deep', 'Build a timber house with four rooms, .3m thick', 'Build a timber house with 24 rooms on four floors, 7m tall']) {
    const result = await planWildsCreation(request({ message }), { actorId: 'owner' }, new AbortController().signal);
    assert.equal(result.status, 'blocked', message);
    if (result.status === 'blocked') assert.match(result.reason, /128|32m|thickness/);
  }
});

test('a multi-story house recognizes the alternative floor wording', async () => {
  const result = await propose(request({ message: 'Build a multi-story timber house with ten rooms' }));
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a multi-story house');
  const rooms = result.proposal.definition.nodes.filter(n => n.behaviors.some(b => b.id === 'habitat'));
  assert.equal(rooms.length, 10);
  assert.equal(new Set(rooms.map(n => n.pose.position.y)).size, 2);
});

test('room and floor count bounds produce specific refusals without changing the draft', async () => {
  for (const message of ['Build a mansion with 25 rooms', 'Build a house with twenty-five rooms', 'Build a house with thirty rooms', 'Build a 5-floor house with 10 rooms', 'Build a house with 10.5 rooms', 'Build a house with .5 rooms', 'Build a house with -1 rooms', 'Build a house with zero rooms', 'Build a house with 0 floors', 'Build a house with 2 rooms and 3 floors', 'Build a house with one hundred rooms', 'Build a house with one hundred and twenty rooms']) {
    const input = request({ message }), before = structuredClone(input);
    const result = await planWildsCreation(input, { actorId: 'owner' }, new AbortController().signal);
    assert.equal(result.status, 'blocked', message);
    if (result.status === 'blocked') assert.match(result.reason, /room|floor|whole numbers/i);
    assert.deepEqual(input, before);
  }
});

test('taller composed rooms keep human-scale stair treads', async () => {
  const input = request({ message: 'Build a two-storey timber house with four rooms, 8m tall', context: creationContextFixture() });
  const result = await propose(input);
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a tall house');
  const stairs = result.proposal.definition.nodes.filter(node => node.id.startsWith('stair-'));
  assert.ok(stairs.length > 16);
  assert.ok(stairs.every(node => node.shape.width >= .35 && node.shape.height <= .2 + 1e-9), 'tread depth and riser height must stay usable as floor height grows');
  assert.equal(compileCreation(result.proposal.definition, input.context).status, 'ready');
});

test('the largest local room count fits a finite supported graph', async () => {
  const input = request({ message: 'Build a timber house with twenty-four rooms on four floors', context: creationContextFixture() }), result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected bounded house');
  assert.equal(result.proposal.definition.nodes.filter(n => n.behaviors.some(b => b.id === 'habitat')).length, 24);
  assert.ok(result.proposal.definition.nodes.length <= 128);
  assert.equal(compileCreation(result.proposal.definition, input.context).status, 'ready');
});

test('a verified account without a bearer token can propose a finite personal home and usable bed', async () => {
  const input = request(), before = structuredClone(input), result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a definition');
  const definition = result.proposal.definition, compiled = compileCreation(definition, input.context);
  assert.equal(compiled.status, 'ready');
  if (compiled.status !== 'ready') throw Error('Expected a ready compilation');
  assert.ok(compiled.plan.requiredResources.timber > 0 && compiled.plan.requiredResources.timber <= 12);
  const room = definition.nodes.find(n => n.behaviors.some(b => b.id === 'habitat'));
  const bed = definition.nodes.find(n => n.behaviors.some(b => b.id === 'bed'));
  assert.ok(room?.shape.doorway && room.shape.doorway.width >= .8 && room.shape.doorway.height >= 1.8);
  assert.ok(bed && bed.id !== room.id && bed.supports.includes(room.id));
  const components = initializeCreationComponents(definition, 1);
  assert.equal(components[bed.id].kind, 'bed');
  assert.equal(components[room.id].kind, 'habitat');
  assert.deepEqual(input, before);
  assert.match(result.proposal.reply, /local|deterministic/i);
});

test('explicit dimensions and registered material modifiers survive local generation', async () => {
  const input = request({ message: 'Build a stone home 5m wide, 4m deep, 3m tall with a hay bed', context: creationContextFixture({ budget: { stone: 100, hay: 10 }, techniques: ['assembly', 'masonry'] }) });
  const result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a definition');
  const room = result.proposal.definition.nodes.find(n => n.behaviors.some(b => b.id === 'habitat'))!;
  assert.deepEqual([room.shape.width, room.shape.depth, room.shape.height, room.material], [5, 4, 3, 'stone']);
  const bed = result.proposal.definition.nodes.find(n => n.behaviors.some(b => b.id === 'bed'))!;
  assert.equal(bed.material, 'hay');
  assert.equal(compileCreation(result.proposal.definition, input.context).status, 'ready');
});

test('an insufficient budget remains a real compiler resource blocker', async () => {
  const input = request({ context: creationContextFixture({ budget: { timber: 0 }, techniques: ['assembly'] }) }), result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a definition');
  const compiled = compileCreation(result.proposal.definition, input.context);
  assert.equal(compiled.status, 'blocked');
  if (compiled.status !== 'blocked') throw Error('Expected insufficient materials');
  assert.ok(compiled.blockers.some(b => b.code === 'resources' && /timber/.test(b.message)));
});

test('selected evolution uses a patch while preserving seed, creator and unrelated nodes', async () => {
  const selected = creationDefinitionFixture({ creatorId: 'original-maker', assets: [{ digest: `sha256:${'d'.repeat(64)}`, kind: 'texture', bytes: 64, vertices: 0, triangles: 0, uri: 'https://example.invalid/source-texture' }] }), before = structuredClone(selected);
  const input = request({ actorId: 'recipient', selected, message: 'Make it 6m wide and use stone', context: creationContextFixture({ budget: { stone: 100 }, techniques: ['masonry'] }) }), result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('patch' in result.proposal)) throw Error('Expected a patch');
  assert.equal(result.proposal.patch.baseDigest, selected.digest);
  const evolved = applyCreationPatch(selected, result.proposal.patch);
  assert.equal(evolved.seed, selected.seed); assert.equal(evolved.creatorId, 'original-maker');
  assert.deepEqual(evolved.assets, selected.assets);
  assert.equal(evolved.nodes[0].id, 'room'); assert.equal(evolved.nodes[0].shape.width, 6); assert.equal(evolved.nodes[0].material, 'stone');
  assert.deepEqual(selected, before);
});

test('registered equipment and garden intents have working components and qualified technique requirements', async () => {
  for (const [message, behavior, technique] of [['Build a stone hammer tool', 'tool', 'forging'], ['Create a timber garden bed', 'garden', 'cultivation']] as const) {
    const input = request({ message, context: creationContextFixture({ budget: { timber: 12, stone: 12 }, techniques: ['assembly', 'masonry', technique] }) }), result = await propose(input);
    assert.equal(result.status, 'proposed');
    if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected a definition');
    const definition = result.proposal.definition;
    assert.ok(definition.nodes.length > 1);
    const compiled = compileCreation(definition, input.context); assert.equal(compiled.status, 'ready');
    const active = definition.nodes.find(n => n.behaviors.some(b => b.id === behavior))!;
    assert.equal(initializeCreationComponents(definition, 1)[active.id].kind, behavior === 'tool' ? 'equipment' : 'garden');
    const missing = compileCreation(definition, { ...input.context, techniques: ['assembly', 'masonry'] });
    assert.equal(missing.status, 'blocked');
    if (missing.status === 'blocked') assert.ok(missing.blockers.some(b => b.code === 'technique' && b.message.includes(technique)));
  }
});

test('cancelled local proposals do not alter the selected draft', async () => {
  const input = request({ selected: creationDefinitionFixture() }), before = structuredClone(input.selected), abort = new AbortController();
  abort.abort();
  const result = await propose(input, abort.signal);
  assert.equal(result.status, 'unavailable');
  if (result.status === 'unavailable') assert.match(result.reason, /cancelled/i);
  assert.deepEqual(input.selected, before);
});

test('cancelling an optional remote enhancement does not wait for a silent transport', async () => {
  const originalFetch = globalThis.fetch, previousFlag = process.env.RECEIZ_CREATION_REMOTE_ENHANCEMENT;
  const abort = new AbortController(); let requested = 0;
  process.env.RECEIZ_CREATION_REMOTE_ENHANCEMENT = 'true';
  globalThis.fetch = () => { requested++; abort.abort(); return new Promise<Response>(() => {}); };
  let timer: ReturnType<typeof setTimeout>;
  try {
    const cancellation = planCreation(request(), createReceizCreationPlanner({ actorId: 'owner', accessToken: 'remote-enhancement-test-token' }), abort.signal);
    const result = await Promise.race([cancellation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('remote cancellation never settled')), 500); })]);
    assert.equal(requested, 1); assert.equal(result.status, 'unavailable');
    if (result.status === 'unavailable') assert.match(result.reason, /cancelled/i);
  } finally {
    clearTimeout(timer!); globalThis.fetch = originalFetch;
    if (previousFlag === undefined) delete process.env.RECEIZ_CREATION_REMOTE_ENHANCEMENT; else process.env.RECEIZ_CREATION_REMOTE_ENHANCEMENT = previousFlag;
  }
});

test('unsupported prompts explain the available grammar and preserve the selected draft', async () => {
  for (const message of ['Create a perpetual-motion flying portal home', 'Create an invisible music-making octopus', 'Build a steel home', 'Make it purple']) {
    const input = request({ message, selected: message.startsWith('Make') ? creationDefinitionFixture() : null }), before = structuredClone(input);
    const result = await planWildsCreation(input, { actorId: 'owner' }, new AbortController().signal);
    assert.equal(result.status, 'blocked');
    if (result.status === 'blocked') { assert.match(result.reason, /local|registered|supported|graph/i); assert.match(result.reason, /draft is saved/i); }
    assert.deepEqual(input, before);
  }
});

test('explicit graphs are parsed faithfully and unknown mechanics are refused', async () => {
  const definition = creationDefinitionFixture(), input = request({ message: JSON.stringify(definition) });
  const result = await propose(input); assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('definition' in result.proposal)) throw Error('Expected graph');
  assert.deepEqual(result.proposal.definition, definition);
  for (const behaviors of [[{ id: 'infinite-money', version: 1, parameters: {} }], [{ id: 'portal', version: 1, parameters: {} }], [{ id: 'bed', version: 1, parameters: { capacity: 9999 } }]]) {
    const { digest: unused, ...basis } = definition; void unused;
    const bad = request({ message: JSON.stringify({ ...basis, nodes: [{ ...basis.nodes[0], behaviors }] }) });
    const response = await planWildsCreation(bad, { actorId: 'owner' }, new AbortController().signal);
    assert.equal(response.status, 'blocked');
  }
});

test('an explicit evolution graph retains the selected seed and creator through patches', async () => {
  const selected = creationDefinitionFixture({ creatorId: 'original-maker' }), { digest: unused, ...basis } = selected; void unused;
  const graph = { ...basis, nodes: [{ ...basis.nodes[0], shape: { ...basis.nodes[0].shape, width: 5 } }] };
  const result = await propose(request({ actorId: 'recipient', selected, message: JSON.stringify(graph) }));
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('patch' in result.proposal)) throw Error('Expected patch');
  const evolved = applyCreationPatch(selected, result.proposal.patch);
  assert.equal(evolved.seed, 'fixture'); assert.equal(evolved.creatorId, 'original-maker'); assert.equal(evolved.nodes[0].shape.width, 5);
});

test('leading decimal dimensions and material-only edits are never silently reinterpreted', async () => {
  const small = await propose(request({ message: 'Create a timber box .5m wide, .2m high, .4m deep' }));
  assert.equal(small.status, 'proposed');
  if (small.status !== 'proposed' || !('definition' in small.proposal)) throw Error('Expected primitive');
  assert.deepEqual([small.proposal.definition.nodes[0].shape.width, small.proposal.definition.nodes[0].shape.height, small.proposal.definition.nodes[0].shape.depth], [.5, .2, .4]);
  const selected = creationDefinitionFixture(), edited = await propose(request({ selected, message: 'Make it stone' }));
  assert.equal(edited.status, 'proposed');
  if (edited.status !== 'proposed' || !('patch' in edited.proposal)) throw Error('Expected material patch');
  assert.equal(applyCreationPatch(selected, edited.proposal.patch).nodes[0].material, 'stone');
});
