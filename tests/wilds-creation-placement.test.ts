import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { initialCreationConversation, reduceCreationConversation } from '../src/features/play/creation/conversation';
import { compileCreation } from '../src/features/play/creation/compiler';
import {createCreationDefinition} from '../src/features/play/creation/definition';
import * as previewBudget from '../src/features/play/creation/preview-budget';
import * as savedGoal from '../src/features/play/creation/saved-goal';
import {prepareAffordableCreation} from '../src/features/play/creation/affordable-phase';
import * as draft from '../src/features/play/creation/draft';
import * as compileEnvironment from '../src/features/play/creation/compile-environment';
import * as groundPlacement from '../src/features/play/creation/ground-placement';
import { constructionProofDigest } from '../src/features/play/wilds-construction-project';
import { planCreation } from '../src/features/play/creation/planner';
import { applyCreationPatch } from '../src/features/play/creation/patch';
import { creationDefinitionFixture, creationContextFixture } from './support/creation-fixtures';
import type { CreationWorker } from '../src/features/play/creation/capabilities';
import type { CreationConversationEvent } from '../src/features/play/creation/conversation';
import type { useCreationConversation } from '../src/features/play/creation/use-creation-conversation';
import type {CreationInstance} from '../src/features/play/creation/instance';
import * as capabilities from '../src/features/play/creation/capabilities';
import { createWorldCreationController } from '../src/features/play/creation/world-controller';
import { projectCreationPhysical } from '../src/features/play/creation/projection';
import { creationWorldSourceHead,type WildsCreationSourceRecord } from '../src/features/play/creation/world-source';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { checkpointWildsWorld, initialWildsWorldProjection, replayWildsWorld } from '../src/features/play/wilds-world-state';
import { createWildsWorldEdgeAdmissionQueue, persistWildsWorldCommandDurably } from '../src/features/play/wilds-world-outbox';
import { createReceizInMemoryOfflineProofQueueStorage } from '@receiz/sdk';
import { createCreationSceneRuntime } from '../src/features/play/creation/scene-runtime';
import { createCreationRenderGeometry } from '../src/features/play/creation/render-geometry';
import { resolveCreationMovement } from '../src/features/play/creation/navigation';

type Hook = ReturnType<typeof useCreationConversation>;
async function mountConversation(saved?: string, overrides: Partial<Parameters<typeof useCreationConversation>[0]> = {}, options:{storage?:Map<string,string>;failWrites?:()=>boolean;phase?:(definition:Parameters<typeof prepareAffordableCreation>[0],context:Parameters<typeof prepareAffordableCreation>[1],mode:'automatic'|'manual')=>Promise<ReturnType<typeof prepareAffordableCreation>>}={}) {
  const slots: { value: any; deps?: unknown[]; cleanup?: () => void }[] = [];
  let cursor = 0, effects: (() => void)[] = [], plannerCalls = 0, commits = 0;
  const storage = options.storage||new Map<string, string>();
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
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => {if(options.failWrites?.())throw Error('quota');storage.set(key,value);} },
    require(name: string) {
      if (name === 'react') return react;
      if (name === './conversation') return { initialCreationConversation, reduceCreationConversation };
      if (name === './planner') return { planCreation };
      if (name === './patch') return { applyCreationPatch };
      if (name === './preview-budget') return previewBudget;
      if (name === './saved-goal') return savedGoal;
      if (name === './draft') return draft;
      if (name === './compile-environment') return compileEnvironment;
      if (name === './ground-placement') return groundPlacement;
      if (name === './capabilities') return capabilities;
      if (name === '../wilds-construction-project') return { constructionProofDigest };
      if (name === './worker-client') return { createCreationWorkerClient: () => ({ async compile(_id: string, definition: Parameters<typeof compileCreation>[0], context: Parameters<typeof compileCreation>[1]) { return compileCreation(definition, context); }, async phase(_id:string,definition:Parameters<typeof compileCreation>[0],context:Parameters<typeof compileCreation>[1],mode:'automatic'|'manual'){return options.phase?options.phase(definition,context,mode):prepareAffordableCreation(definition,context,mode);}, cancel() {}, close() {} }) };
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
  return { input, definition, settle, change, current: () => hook!, plannerCalls: () => plannerCalls, commits: () => commits, saved: () => storage.get(key)!, storage,
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

test('a blocked full-footprint preview can move and retry the complete saved design without a new AI request or material spend', async () => {
  let obstructed = true;
  const session = await mountConversation(undefined, { validatePlacement: () => obstructed ? 'creation_world_canonical_overlap' : null });
  try {
    await session.change({ type: 'workers', ids: ['worker'] });
    await session.change({ type: 'budget', budget: { timber: 10000 } });
    await session.change({ type: 'selection', definition: session.definition });
    assert.equal(session.current().state.status, 'blocked');
    assert.equal(session.current().canBuild, false);
    assert.match(session.current().state.reason!, /overlaps a tree, structure/);
    assert.ok(session.current().state.plan, 'retain the full preview so the player can move it');
    await session.current().build();
    assert.equal(session.commits(), 0);
    obstructed = false;
    const pose = { position: { x: 20, y: 0, z: 12 }, yaw: .4 };
    await session.change({ type: 'placement', pose });
    await new Promise(resolve => setTimeout(resolve, 160)); await session.settle();
    assert.equal(session.current().canBuild, true);
    assert.equal(session.current().state.definition?.digest, session.definition.digest);
    assert.deepEqual(session.current().state.placement, pose);
    assert.deepEqual(session.current().state.budget, { timber: 10000 });
    assert.equal(session.plannerCalls(), 0);
    await session.current().build(); await session.settle();
    assert.equal(session.commits(), 1);
  } finally { session.unmount(); }
});


test('preparing a preset uses its crew and finite resource budget in one selection', async () => {
  const session = await mountConversation();
  const prepared = await session.change({ type: 'selection', definition: session.definition, workerIds: ['worker'], budget: { timber: 10000 } });
  assert.equal(prepared.canBuild, true);
  assert.deepEqual(prepared.state.workerIds, ['worker']);
  assert.deepEqual(prepared.state.budget, prepared.state.plan?.requiredResources);
  assert.ok(prepared.state.budget.timber <= 10000, 'automatic allocation stays inside the owned ceiling');
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
      const scene = createCreationSceneRuntime({ defer: work => work() });
      scene.refresh(controller.snapshot(), { maximumPages: 4, maximumVertices: 24000, maximumDrawCalls: 12, maximumTextureBytes: 0, maximumUploadBytesPerPaint: 98304 });
      assert.equal(scene.select({ worldId: context.worldId, spaceId: context.spaceId, position: context.pose.position, radius: 64, limit: 128 }), true);
      scene.paint();
      assert.equal(scene.snapshot().renderProjections.length, 1);
      assert.equal(scene.snapshot().navigation.instanceCount, 0);
      for (const chunk of scene.snapshot().renderProjections[0].chunks) {
        const geometry = createCreationRenderGeometry(chunk);
        assert.ok(geometry.getAttribute('position').count > 0);
        assert.ok(Array.from(geometry.getAttribute('uv').array).every(Number.isFinite));
        geometry.dispose();
        scene.rendered(chunk.id);
      }
      assert.equal(scene.snapshot().navigation.instanceCount, 1);
      const start = { ...context.pose.position, y: context.pose.position.y + .15 }, end = { ...start, x: start.x + 4 };
      assert.equal(resolveCreationMovement(scene.snapshot().navigation, context.spaceId, start, end).blocked, true);
      scene.close();
      assert.equal(source.command.resources.length, preview.requiredResources.timber);
      assert.ok(source.command.resources.every(lot => queue.current().consumedMaterialLots[lot.id] === instanceId));
      assert.equal(replayWildsWorld([], checkpointWildsWorld(queue.current())).creations![instanceId].instance.head, source.instance.head);
      await session.current().build();
      assert.equal(Object.keys(queue.current().creations!).length, 1);
    } finally { session.unmount(); controller.close(); }
  });
}

test('new prompt automatically quotes and allocates exact owned costs without resource input',async()=>{
 const session=await mountConversation();
 await session.change({type:'workers',ids:['worker']});await session.change({type:'draft',text:'Build a room'});
 await session.current().ask();await session.settle();
 const current=session.current();assert.equal(current.state.status,'preview');assert.equal(current.state.budgetMode,'automatic');
 assert.deepEqual(current.state.budget,current.state.plan?.requiredResources);assert.deepEqual(current.state.quote?.requiredResources,current.state.plan?.requiredResources);
 assert.equal(current.state.minimized,false,'the upfront quote remains visible');
 await current.build();await session.settle();assert.equal(session.commits(),1);session.unmount();
});

test('manual ceilings stay fixed and inventory changes invalidate an otherwise ready preview',async()=>{
 const session=await mountConversation();await session.change({type:'workers',ids:['worker']});
 await session.change({type:'budget',budget:{timber:1}});await session.change({type:'draft',text:'Build a room'});
 await session.current().ask();await session.settle();
 assert.equal(session.current().state.status,'blocked');assert.equal(session.current().state.budget.timber,1);assert.ok(session.current().state.quote!.requiredResources.timber>1);
 await session.change({type:'budget',budget:{timber:1},mode:'automatic'});
 assert.equal(session.current().canBuild,true);
 session.input.context={...session.input.context,budget:{timber:0}};await session.settle();
 assert.equal(session.current().canBuild,false);assert.equal(session.current().state.status,'blocked');assert.equal(session.current().state.budget.timber,0);
 assert.ok(session.current().state.quote!.requiredResources.timber>0);assert.equal(session.current().state.definition?.digest,session.definition.digest);session.unmount();
});

test('an affordable phase preserves the complete goal and later charges only unfinished parts',async()=>{
  const base=creationDefinitionFixture(),{digest,...basis}=base;
  void digest;
  const definition=createCreationDefinition({...basis,nodes:[0,4,8].map((x,i)=>({...base.nodes[0],id:`chest-${i+1}`,parentId:null,pose:{position:{x,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},supports:[],attachments:[],behaviors:[{id:'storage',version:1,parameters:{}}]}))});
  const session=await mountConversation(undefined,{context:creationContextFixture({budget:{timber:3}})});
  try{
    await session.change({type:'budget',budget:{timber:1}});
    await session.change({type:'selection',definition,workerIds:['worker']});
    assert.equal(session.current().state.status,'blocked');
    await session.change({type:'phase'});
    const phase=session.current().state;
    assert.equal(phase.status,'preview','one complete chest must be offered inside the one-timber manual limit');
    assert.equal(phase.definition?.nodes.length,1);
    assert.equal(phase.targetDefinition?.digest,definition.digest);
    assert.deepEqual(phase.plan?.requiredResources,{timber:1});
    await session.current().build();await session.settle();
    assert.equal(session.current().state.instance?.instanceId,'creation:placed');
    assert.equal(session.current().state.definition?.digest,definition.digest,'admission reopens the full saved goal');
    assert.equal(session.current().state.selectedDefinition?.nodes.length,1);
    assert.deepEqual(session.current().state.quote?.requiredResources,{timber:2});
    const resumed=await session.change({type:'budget',budget:{timber:2}});
    assert.equal(resumed.canBuild,true);
    assert.deepEqual(resumed.state.plan?.requiredResources,{timber:2});
    assert.equal(resumed.state.plan?.evolution?.instanceId,'creation:placed');
    await resumed.build();await session.settle();
    assert.equal(session.current().state.instance?.instanceId,'creation:placed');
    assert.equal(session.current().state.selectedDefinition?.nodes.length,3);
    assert.equal(session.commits(),2);
  }finally{session.unmount();}
});

test('saved phase previews restore the full target and retain manual ceilings after reload',async()=>{
  const base=creationDefinitionFixture(),{digest,...basis}=base;void digest;
  const goal=createCreationDefinition({...basis,nodes:[0,4].map((x,i)=>({...base.nodes[0],id:`storage-${i}`,pose:{position:{x,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},behaviors:[{id:'storage',version:1,parameters:{}}]}))});
  const first=await mountConversation(undefined,{context:creationContextFixture({budget:{timber:2}})});
  await first.change({type:'budget',budget:{timber:1}});await first.change({type:'selection',definition:goal,workerIds:['worker']});await first.change({type:'phase'});
  const saved=first.saved();first.unmount();
  const reloaded=await mountConversation(saved,{context:creationContextFixture({budget:{timber:2}})});
  try{
    assert.equal(reloaded.current().state.targetDefinition?.digest,goal.digest);
    assert.equal(reloaded.current().state.definition?.nodes.length,1);
    assert.equal(reloaded.current().state.budget.timber,1);
    assert.equal(reloaded.current().canBuild,true);
    await reloaded.change({type:'budget',budget:{timber:2}});
    assert.equal(reloaded.current().state.definition?.nodes.length,2,'a phase edit should use the new ceiling for the saved goal');
  }finally{reloaded.unmount();}
});

test('starting another draft and reloading does not erase a built section’s saved expansion goal',async()=>{
  const base=creationDefinitionFixture(),{digest,...basis}=base;void digest;
  const goal=createCreationDefinition({...basis,nodes:[3,6].map((x,i)=>({...base.nodes[0],id:`box-${i}`,pose:{position:{x,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},behaviors:[{id:'storage',version:1,parameters:{}}]}))});
  const context=creationContextFixture({budget:{timber:2}});
  let session=await mountConversation(undefined,{context});
  try{
    await session.change({type:'budget',budget:{timber:1}});await session.change({type:'selection',definition:goal,workerIds:['worker']});await session.change({type:'phase'});
    const part=session.current().state.definition!;
    await session.current().build();await session.settle();
    const instance=session.current().state.instance!;
    await session.change({type:'selection',definition:null});
    await session.change({type:'draft',text:'A separate garden design'});
    const saved=session.saved(),storage=session.storage;
    session.unmount();session=await mountConversation(saved,{context},{storage});
    await session.change({type:'selection',definition:part,instance});
    assert.equal(session.current().state.definition?.digest,goal.digest,'reselecting the verified section must reopen its saved full goal');
    assert.deepEqual(session.current().state.plan?.requiredResources,{timber:1});
    assert.equal(session.current().canBuild,true);
  }finally{session.unmount();}
});

test('three paid construction phases survive reload and finish one exact world instance without reusing materials',async()=>{
  const owner='owner',pulse='2026-10-07T06:00:00.000Z',card=sealCollectedCard({capturedAt:pulse,encounterId:'phased-build',formId:'mintcub-1',ownerReceizId:owner}),cards=[card],conditions={[card.id]:emptyAdventureCondition(card.id)},workers=capabilities.projectCreationWorkers(cards,conditions);
  const sources=Array.from({length:25},(_,i)=>projectWildsResourceRegion(i-12,0)).flat().filter(source=>source.kind==='timber').slice(0,10);
  const harvested=sources.map(source=>createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:owner,actorPosition:source.position,kaiUPulse:10}));
  const world={...initialWildsWorldProjection(),materialLots:Object.fromEntries(harvested.map(row=>[row.lot.lotId,row.lot])),harvestedSources:Object.fromEntries(harvested.map(row=>[row.source.sourceId,row.source]))};
  const storage=createReceizInMemoryOfflineProofQueueStorage(),queue=createWildsWorldEdgeAdmissionQueue({initialProjection:world,persist:candidate=>persistWildsWorldCommandDurably(candidate,storage)});
  let context=creationContextFixture({worldId:world.worldId,spaceId:'wildz.space.outer.v1',sourceHead:creationWorldSourceHead(world),pose:{position:{x:5000,y:100,z:5000},yaw:0},budget:{timber:harvested.length},techniques:[]}),commitContext=context,writes=0;
  const controller=createWorldCreationController({environment:()=>({ownerId:owner,worldId:world.worldId,spaceId:context.spaceId}),world:queue.current,crew:()=>({cards,conditions}),position:()=>context.pose.position,compileContext:()=>commitContext,
    admit:async(command,beforeAdmit)=>{writes++;return {projection:await queue.admit({schema:'receiz.wilds_world_outbox_entry.v1',actorId:owner,guestId:'phased-test',command,queuedAt:pulse},{beforeAdmit}),events:[]};},project:async(instance,definition,plan)=>projectCreationPhysical(instance,definition,plan)});
  const base=creationDefinitionFixture(),{digest,...basis}=base;void digest;
  const goal=createCreationDefinition({...basis,nodes:[3,6,9].map((x,i)=>({...base.nodes[0],id:`paid-chest-${i+1}`,pose:{position:{x,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},behaviors:[{id:'storage',version:1,parameters:{}}]}))});
  const overrides={spaceId:context.spaceId,context,workers,restoreObject:async(ref:NonNullable<Hook['state']['instance']>)=>{const source=await controller.resolve(ref.instanceId);return source?{definition:source.definition,instance:source.instance}:null;},commit:async(plan:NonNullable<Hook['state']['plan']>,definition:NonNullable<Hook['state']['definition']>,ids:readonly string[],selected?:Hook['state']['instance'],supplied?:typeof context)=>{commitContext=supplied!;return controller.commit(definition,plan,ids,selected);}};
  let session=await mountConversation(undefined,overrides),instanceId:string|null=null;
  try{
    await session.change({type:'budget',budget:{timber:1}});await session.change({type:'selection',definition:goal,workerIds:workers.map(w=>w.assetId)});
    for(let phase=1;phase<=3;phase++){
      if(session.current().state.status==='blocked')await session.change({type:'phase'});
      assert.equal(session.current().canBuild,true);assert.deepEqual(session.current().state.plan?.requiredResources,{timber:1});
      const prior:CreationInstance|null=instanceId?queue.current().creations![instanceId].instance:null;
      await session.current().build();await session.settle();
      const ref=session.current().state.instance!;assert.ok(ref);
      if(instanceId)assert.equal(ref.instanceId,instanceId);else instanceId=ref.instanceId;
      const source:WildsCreationSourceRecord=queue.current().creations![instanceId];assert.equal(Object.keys(source.instance.nodeStates).length,phase);assert.equal(source.instance.embeddedResources.length,phase);
      assert.equal(Object.keys(queue.current().consumedMaterialLots).length,phase);
      if(prior){assert.equal(source.instance.parentHead,prior.head);for(const [id,state] of Object.entries(prior.nodeStates))assert.deepEqual(source.instance.nodeStates[id],state);}
      context={...context,sourceHead:creationWorldSourceHead(queue.current()),budget:{timber:harvested.length-phase}};session.input.context=context;await session.settle();
      if(phase===1){const saved=session.saved(),restored=await draft.restoreCreationDraft(saved,{ownerId:owner,spaceId:context.spaceId},overrides.restoreObject);assert.equal(restored.status,'ready',restored.status==='recovery'?restored.reason:'restored');session.unmount();session=await mountConversation(saved,{...overrides,context});assert.equal(session.current().state.definition?.digest,goal.digest,session.current().state.reason||'restored goal');assert.deepEqual(session.current().state.quote?.requiredResources,{timber:2});}
    }
    assert.equal(writes,3);assert.equal(Object.keys(queue.current().creations!).length,1);
    const source=queue.current().creations![instanceId!];assert.equal(source.instance.definitionDigest,goal.digest);
    assert.equal(new Set(source.instance.embeddedResources.map(lot=>lot.id)).size,3);
    assert.equal(replayWildsWorld([],checkpointWildsWorld(queue.current())).creations![instanceId!].instance.head,source.instance.head);
  }finally{session.unmount();controller.close();}
});

test('a failed full-goal save prevents a paid partial build with zero material writes',async()=>{
  const base=creationDefinitionFixture(),{digest,...basis}=base;void digest;
  const goal=createCreationDefinition({...basis,nodes:[3,6].map((x,i)=>({...base.nodes[0],id:`chest-${i}`,pose:{position:{x,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},behaviors:[{id:'storage',version:1,parameters:{}}]}))});
  let fail=false;const session=await mountConversation(undefined,{context:creationContextFixture({budget:{timber:2}})},{failWrites:()=>fail});
  try{await session.change({type:'budget',budget:{timber:1}});await session.change({type:'selection',definition:goal,workerIds:['worker']});await session.change({type:'phase'});fail=true;
    await session.current().build();await session.settle();assert.equal(session.commits(),0);assert.equal(session.current().state.status,'blocked');assert.equal(session.current().state.targetDefinition?.digest,goal.digest);
  }finally{session.unmount();}
});

test('an inventory change fences a delayed phase and prevents stale paid preview adoption',async()=>{
  const base=creationDefinitionFixture(),{digest,...basis}=base;void digest;
  const goal=createCreationDefinition({...basis,nodes:[3,6].map((x,i)=>({...base.nodes[0],id:`chest-${i}`,pose:{position:{x,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},behaviors:[{id:'storage',version:1,parameters:{}}]}))});
  let release:(()=>void)|undefined;
  const session=await mountConversation(undefined,{context:creationContextFixture({budget:{timber:1}})},{phase:async(definition,context,mode)=>{const result=prepareAffordableCreation(definition,context,mode);await new Promise<void>(resolve=>{release=resolve;});return result;}});
  try{await session.change({type:'selection',definition:goal,workerIds:['worker']});await session.change({type:'phase'});assert.equal(session.current().state.status,'planning');
    session.input.context={...session.input.context,budget:{timber:0}};await session.settle();release!();await session.settle();
    assert.equal(session.current().canBuild,false);assert.equal(session.current().state.definition?.digest,goal.digest);assert.equal(session.current().state.plan,null);assert.equal(session.commits(),0);
  }finally{session.unmount();}
});
