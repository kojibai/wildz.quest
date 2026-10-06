import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReceizCreationPlanner, planWildsCreation } from '../src/lib/receiz/wilds-creation-planner';
import { planCreation, type CreationPlannerRequest } from '../src/features/play/creation/planner';
import { compileCreation } from '../src/features/play/creation/compiler';
import { initializeCreationComponents } from '../src/features/play/creation/components';
import { applyCreationPatch } from '../src/features/play/creation/patch';
import { creationShelterStarterPrompt } from '../src/features/play/creation/starter-prompt';
import { creationContextFixture, creationDefinitionFixture } from './support/creation-fixtures';

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
  const selected = creationDefinitionFixture({ creatorId: 'original-maker' }), before = structuredClone(selected);
  const input = request({ actorId: 'recipient', selected, message: 'Make it 6m wide and use stone', context: creationContextFixture({ budget: { stone: 100 }, techniques: ['masonry'] }) }), result = await propose(input);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed' || !('patch' in result.proposal)) throw Error('Expected a patch');
  assert.equal(result.proposal.patch.baseDigest, selected.digest);
  const evolved = applyCreationPatch(selected, result.proposal.patch);
  assert.equal(evolved.seed, selected.seed); assert.equal(evolved.creatorId, 'original-maker');
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
