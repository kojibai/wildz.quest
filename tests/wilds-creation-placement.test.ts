import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { initialCreationConversation, reduceCreationConversation } from '../src/features/play/creation/conversation';
import { compileCreation } from '../src/features/play/creation/compiler';
import * as draft from '../src/features/play/creation/draft';
import * as compileEnvironment from '../src/features/play/creation/compile-environment';
import { constructionProofDigest } from '../src/features/play/wilds-construction-project';
import { planCreation } from '../src/features/play/creation/planner';
import { applyCreationPatch } from '../src/features/play/creation/patch';
import { creationDefinitionFixture, creationContextFixture } from './support/creation-fixtures';
import type { CreationWorker } from '../src/features/play/creation/capabilities';
import type { CreationConversationEvent } from '../src/features/play/creation/conversation';
import type { useCreationConversation } from '../src/features/play/creation/use-creation-conversation';
import * as capabilities from '../src/features/play/creation/capabilities';
import { createWorldCreationController } from '../src/features/play/creation/world-controller';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { creationWorldSourceHead } from '../src/features/play/creation/world-source';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { checkpointWildsWorld, initialWildsWorldProjection, replayWildsWorld } from '../src/features/play/wilds-world-state';
import { createWildsWorldEdgeAdmissionQueue, persistWildsWorldCommandDurably } from '../src/features/play/wilds-world-outbox';
import { createReceizInMemoryOfflineProofQueueStorage } from '@receiz/sdk';

type Hook = ReturnType<typeof useCreationConversation>;
async function mountConversation(saved?: string, overrides: Partial<Parameters<typeof useCreationConversation>[0]> = {}) {
  const slots: { value: any; deps?: unknown[]; cleanup?: () => void }[] = [];
  let cursor = 0, effects: (() => void)[] = [], plannerCalls = 0, commits = 0;
  const storage = new Map<string, string>();
  const key = `wildz:creation-draft:v1:${overrides.ownerId ?? 'owner'}:${overrides.spaceId ?? 'surface'}`;
  if (saved) storage.set(key, saved);
  const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i])));
  const react = {
    useRef(value: unknown) { return (slots[cursor++] ??= { value: { current: value } }).value; },
    useState(value: unknown) { const slot = slots[cursor++] ??= { value }; return [slot.value, (next: unknown) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
    useReducer(reducer: (state: unknown, event: unknown) => unknown, value: unknown, initialize?: (value: unknown) => unknown) {
      const slot = slots[cursor++] ??= { value: initialize ? initialize(value) : value };
      return [slot.value, (event: unknown) => { slot.value = reducer(slot.value, event); }];
    },
    useMemo(factory: () => unknown, deps: unknown[]) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { value: factory(), deps }; return slots[index].value; },
    useCallback(callback: unknown, deps: unknown[]) { return react.useMemo(() => callback, deps); },
    useEffect(effect: () => (() => void) | void, deps?: unknown[]) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => { slots[index]?.cleanup?.(); slots[index] = { value: undefined, deps, cleanup: effect() || undefined }; });
    }
  };
  const definition = creationDefinitionFixture(), context = creationContextFixture();
  const input: Parameters<typeof useCreationConversation>[0] = {
    ownerId: 'owner', spaceId: 'surface', context,
    workers: [{ assetId: 'worker', subjectId: 'creature:worker', head: 'sha256:' + 'b'.repeat(64), proofDigest: 'sha256:' + 'b'.repeat(64), ready: true, reasons: [], techniques: ['assembly'] } satisfies CreationWorker],
    planner: { async propose(request) { plannerCalls++; return { requestId: request.requestId, definition, reply: 'Ready.' }; } },
    async commit(plan) { commits++; return { status: 'admitted', instance: { instanceId: 'creation:placed', head: 'sha256:' + 'c'.repeat(64), definitionDigest: plan.definitionDigest } }; },
    ...overrides
  };
  const testModule = { exports: {} as { useCreationConversation: typeof useCreationConversation } };
  const output = ts.transpileModule(readFileSync('src/features/play/creation/use-creation-conversation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const environment = { module: testModule, exports: testModule.exports, crypto, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    require(name: string) {
      if (name === 'react') return react;
      if (name === './conversation') return { initialCreationConversation, reduceCreationConversation };
      if (name === './planner') return { planCreation };
      if (name === './patch') return { applyCreationPatch };
      if (name === './draft') return draft;
      if (name === './compile-environment') return compileEnvironment;
      if (name === './capabilities') return capabilities;
      if (name === '../wilds-construction-project') return { constructionProofDigest };
      if (name === './worker-client') return { createCreationWorkerClient: () => ({ async compile(_id: string, definition: Parameters<typeof compileCreation>[0], context: Parameters<typeof compileCreation>[1]) { return compileCreation(definition, context); }, cancel() {}, close() {} }) };
      throw Error(`Unexpected hook dependency: ${name}`);
    }
  };
  // Keep plain proof objects in the same realm as the real compiler/validator.
  Function(...Object.keys(environment), output)(...Object.values(environment));
  let hook: Hook;
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      cursor = 0; hook = testModule.exports.useCreationConversation(input);
      const pending = effects; effects = []; pending.forEach(effect => effect());
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    return hook!;
  };
  const change = async (event: CreationConversationEvent) => { hook!.change(event); return settle(); };
  await settle();
  return { input, definition, settle, change, current: () => hook!, plannerCalls: () => plannerCalls, commits: () => commits, saved: () => storage.get(key)!,
    unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}

test('selecting a saved creation draft compiles a placeable plan without another AI request', async () => {
  const session = await mountConversation();
  await session.change({ type: 'workers', ids: ['worker'] });
  await session.change({ type: 'budget', budget: { timber: 10000 } });
  const selected = await session.change({ type: 'selection', definition: session.definition });
  assert.equal(selected.state.status, 'preview');
  assert.equal(selected.canBuild, true);
  assert.equal(session.plannerCalls(), 0);
  await selected.build(); await session.settle();
  assert.equal(session.current().state.instance?.instanceId, 'creation:placed');
  assert.equal(session.commits(), 1);
  session.unmount();
});

test('a world refresh recompiles the current placement instead of silently disabling Build', async () => {
  const session = await mountConversation();
  await session.change({ type: 'workers', ids: ['worker'] });
  await session.change({ type: 'budget', budget: { timber: 10000 } });
  await session.change({ type: 'draft', text: 'Build a room' });
  await session.current().ask(); await session.settle();
  assert.equal(session.current().canBuild, true);
  session.input.context = { ...session.input.context, sourceHead: 'sha256:' + 'd'.repeat(64) };
  await session.settle();
  assert.equal(session.current().canBuild, true);
  assert.equal(session.current().state.plan?.sourceHead, session.input.context.sourceHead);
  assert.equal(session.plannerCalls(), 1);
  session.unmount();
});

test('reopening a saved draft restores its crew, materials and placement before compiling', async () => {
  const definition = creationDefinitionFixture(), placement = { position: { x: 7, y: 0, z: 8 }, yaw: .5 };
  const session = await mountConversation(JSON.stringify({ ownerId: 'owner', spaceId: 'surface', draft: '', definition, instance: null, workerIds: ['worker'], budget: { timber: 10000 }, placement }));
  assert.deepEqual(session.current().state.workerIds, ['worker']);
  assert.deepEqual(session.current().state.budget, { timber: 10000 });
  assert.deepEqual(session.current().state.placement, placement);
  assert.equal(session.current().canBuild, true);
  assert.equal(session.plannerCalls(), 0);
  session.unmount();
});

test('a blocked placement expands the conversation so the build failure is visible', () => {
  const state = { ...initialCreationConversation('owner', 'surface', creationContextFixture().pose), minimized: true, status: 'committing' as const };
  const rejected = reduceCreationConversation(state, { type: 'blocked', reason: 'Move within reach to build.' });
  assert.equal(rejected.minimized, false);
  assert.equal(rejected.reason, 'Move within reach to build.');
  assert.equal(rejected.instance, null);
});


test('preparing a preset uses its crew and finite resource budget in one selection', async () => {
  const session = await mountConversation();
  const prepared = await session.change({ type: 'selection', definition: session.definition, workerIds: ['worker'], budget: { timber: 10000 } });
  assert.equal(prepared.canBuild, true);
  assert.deepEqual(prepared.state.workerIds, ['worker']);
  assert.deepEqual(prepared.state.budget, { timber: 10000 });
  assert.equal(session.plannerCalls(), 0);
  session.unmount();
});

for (const workflow of ['ask', 'select', 'restore'] as const) {
  test(`${workflow}: a mixed crew preview places a paid physical creation through world admission`, async () => {
    const pulse = '2026-10-07T06:00:00.000Z', owner = 'owner';
    // Tide's water technique comes before Grove adds cultivation in selection order.
    const cards = ['ledgerfox-1', 'mintcub-1'].map(formId => sealCollectedCard({ capturedAt: pulse, encounterId: `placement:${workflow}:${formId}`, formId, ownerReceizId: owner }));
    const conditions = Object.fromEntries(cards.map(card => [card.id, emptyAdventureCondition(card.id)]));
    const workers = capabilities.projectCreationWorkers(cards, conditions);
    const sources = Array.from({ length: 25 }, (_, i) => projectWildsResourceRegion(i - 12, 0)).flat().filter(source => source.kind === 'timber').slice(0, 20);
    const harvested = sources.map(source => createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: owner, actorPosition: source.position, kaiUPulse: 10 }));
    const world = { ...initialWildsWorldProjection(), materialLots: Object.fromEntries(harvested.map(row => [row.lot.lotId, row.lot])), harvestedSources: Object.fromEntries(harvested.map(row => [row.source.sourceId, row.source])) };
    const storage = createReceizInMemoryOfflineProofQueueStorage();
    const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: world, persist: candidate => persistWildsWorldCommandDurably(candidate, storage) });
    const context = creationContextFixture({ worldId: world.worldId, spaceId: 'wildz.space.outer.v1', sourceHead: creationWorldSourceHead(world), pose: { position: { x: 5000, y: 100, z: 5000 }, yaw: 0 }, budget: { timber: harvested.length }, techniques: [] });
    let commitContext = context;
    const controller = createWorldCreationController({ environment: () => ({ ownerId: owner, worldId: world.worldId, spaceId: context.spaceId }), world: queue.current, crew: () => ({ cards, conditions }), position: () => context.pose.position, compileContext: () => commitContext,
      admit: async (command, beforeAdmit) => ({ projection: await queue.admit({ schema: 'receiz.wilds_world_outbox_entry.v1', actorId: owner, guestId: 'placement-test', command, queuedAt: pulse }, { beforeAdmit }), events: [] }),
      project: async (instance, definition, plan) => projectCreationPhysical(instance, definition, plan) });
    const definition = creationDefinitionFixture(), ids = workers.map(worker => worker.assetId);
    const saved = workflow === 'restore' ? JSON.stringify({ ownerId: owner, spaceId: context.spaceId, draft: '', definition, workerIds: ids, budget: context.budget, placement: context.pose }) : undefined;
    const session = await mountConversation(saved, { spaceId: context.spaceId, context, workers,
      async commit(plan, definition, workerIds, selected, suppliedContext) { commitContext = suppliedContext!; return controller.commit(definition, plan, workerIds, selected); } });
    try {
      if (workflow === 'ask') {
        await session.change({ type: 'workers', ids }); await session.change({ type: 'budget', budget: context.budget });
        await session.change({ type: 'draft', text: 'Build my shelter' }); await session.current().ask(); await session.settle();
      } else if (workflow === 'select') await session.change({ type: 'selection', definition, workerIds: ids, budget: context.budget });
      assert.equal(session.current().canBuild, true);
      const preview = session.current().state.plan!;
      await session.current().build(); await session.settle();
      assert.equal(session.current().state.reason, 'Built and saved in the world.');
      const instanceId = session.current().state.instance!.instanceId;
      const source = queue.current().creations![instanceId];
      assert.equal(source.command.planDigest, preview.digest);
      assert.equal(source.instance.stage, 'functional');
      assert.equal(controller.snapshot().projections.length, 1);
      assert.ok(controller.snapshot().projections[0].solids.length > 0);
      assert.equal(source.command.resources.length, preview.requiredResources.timber);
      assert.ok(source.command.resources.every(lot => queue.current().consumedMaterialLots[lot.id] === instanceId));
      assert.equal(replayWildsWorld([], checkpointWildsWorld(queue.current())).creations![instanceId].instance.head, source.instance.head);
      await session.current().build();
      assert.equal(Object.keys(queue.current().creations!).length, 1);
    } finally { session.unmount(); controller.close(); }
  });
}
