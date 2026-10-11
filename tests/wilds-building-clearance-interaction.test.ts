import assert from 'node:assert/strict';
import {test} from 'node:test';
import '../src/features/play/wilds-building-clearance-interaction';
import {projectWildsBuildingClearancePiles} from '../src/features/play/wilds-building-clearance';
import {deriveWildsClearanceCommandV128} from '../src/lib/receiz/wilds-clearance-admission-v128';
import {initialWildsResourceJournalV128,reduceWildsResourceJournalV128,replayWildsResourceJournalOwnerV128} from '../src/lib/receiz/wilds-resource-journal-v128';
import {paidClearanceTrace,clearanceFixtureTree} from './support/clearance-source-fixture';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
const HEAD='1'.repeat(64);
const modulePath='../src/features/play/wilds-building-clearance-interaction.js';
async function load(){const api=await import(modulePath).catch(()=>({}));assert.equal(typeof api.createWildsClearanceInteraction,'function','gameplay needs a durable owner-bound clearance interaction');return api;}
async function fixture(){
 const f=await paidClearanceTrace({width:6}),owner='alice.receiz.id';
 const paid={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'paid:alice',ownerReceizId:owner,gameplayOwnerId:'explorer',commands:f.commands} as const;
 const before=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),paid,{ownerReceizId:owner,verifyCard:async()=>{}});
 const command=await deriveWildsClearanceCommandV128({state:before,ownerReceizId:owner,gameplayOwnerId:'explorer',commands:f.commands,buildingId:f.buildingId,buildingHead:f.buildingHead,kaiUPulse:f.kaiUPulse,expectedHead:HEAD,commandId:'clearance'});
 const state=await reduceWildsResourceJournalV128(before,{...paid,attemptId:'clearance',commands:[...f.commands,{kind:'world',command,kaiUPulse:f.kaiUPulse}]},{ownerReceizId:owner,expectedNativeHead:HEAD});
 return {state,pile:projectWildsBuildingClearancePiles(Object.values(state.clearances!),{}).find(p=>p.kind==='food')!};
}
const ready=fixture();
async function setup(){
 const {state:initial,pile}=await ready;let state=initial,writes=0,pending=false,beforeCommitHook=()=>{};
 const database=createMemoryWildzContinuityDatabase();
 const binding={keyId:'fixture-key',ownerHandle:'bob.receiz.id',gameplayOwnerId:'bob'};
 let live={...binding,player:{...pile.position},spaceId:'wildz.space.outer.v1',kaiUPulse:100_000_100,foodRoom:true};
 const outcomes=new Map<string,unknown>(),credited=new Set<string>();
 // Real reducer, explicitly non-native card fixture. UI tests do not qualify host authority.
 const exchange={readCurrent:async()=>({state,predecessor:{head:{head:HEAD}}}),recoverClearance:async(id:string)=>outcomes.get(id)??null,
  admitClearancePickup:async(proposal:any,fence?:()=>Promise<void>)=>{beforeCommitHook();await fence?.();writes++;if(pending)return {status:'pending',attemptId:proposal.command.commandId,members:[],reason:'fixture interrupted'};
   const id=proposal.command.commandId,event={schema:'wildz.resource-command.v128',kind:'use',attemptId:id,ownerReceizId:proposal.ownerReceizId,gameplayOwnerId:proposal.gameplayOwnerId,commands:[...(state.traces[proposal.ownerReceizId]?.commands??[]),{kind:'world',command:proposal.command,kaiUPulse:proposal.kaiUPulse}],useCommandId:id} as const;
   state=await reduceWildsResourceJournalV128(state,event,{ownerReceizId:proposal.ownerReceizId,expectedNativeHead:HEAD});
   const replay=await replayWildsResourceJournalOwnerV128(state,proposal.ownerReceizId,proposal.gameplayOwnerId,state.traces[proposal.ownerReceizId].commands);
   const result={status:'admitted',members:[state.looseMembers[Object.keys(state.looseMembers).at(-1)!].member],projection:replay.world,nourishment:replay.nourishment,state,proof:null};outcomes.set(id,result);return result;}};
 const api=await load();
 const make=()=>api.createWildsClearanceInteraction({database,binding,live:()=>live,openRuntime:async()=>({exchange}) as any,flush:async()=>{},apply:async(result:any)=>{if(!live.foodRoom)return false;for(const member of result.members)credited.add(member.id);return true;}});
 return {pile,database,make,get live(){return live;},set live(value){live=value;},get state(){return state;},get writes(){return writes;},get credits(){return credited.size;},set pending(value:boolean){pending=value;},set hook(value:()=>void){beforeCommitHook=value;}};
}
test('side pickup uses real live reach; an original tree pose cannot claim a distant pile',async()=>{const f=await setup();f.live={...f.live,player:clearanceFixtureTree.position};await assert.rejects(f.make().pickup(f.pile),/reach/);assert.equal(f.writes,0);f.live={...f.live,player:f.pile.position};await f.make().pickup(f.pile);assert.equal(f.credits,1);});
test('partial and empty contents survive fresh controllers and source reads',async()=>{const f=await setup(),n=f.pile.remaining;for(let i=0;i<n;i++){f.live={...f.live,kaiUPulse:f.live.kaiUPulse+1};const controller=f.make();await controller.resume();await controller.pickup(f.pile);assert.equal(f.state.clearanceTaken?.[f.pile.pileId],i+1);}assert.equal(projectWildsBuildingClearancePiles(Object.values(f.state.clearances!),f.state.clearanceTaken!).some(p=>p.pileId===f.pile.pileId),false);const exhausted=f.make();await exhausted.resume();await assert.rejects(exhausted.pickup(f.pile),/empty|depleted/);assert.equal(f.credits,n);});
test('full food pack prevents native pickup writes',async()=>{const f=await setup();f.live={...f.live,foodRoom:false};await assert.rejects(f.make().pickup(f.pile),/full/);assert.equal(f.writes,0);assert.equal(f.credits,0);});
test('owner change immediately before admission fails closed and retains exact pending identity',async()=>{const f=await setup();f.hook=()=>{f.live={...f.live,keyId:'another-key'};};await assert.rejects(f.make().pickup(f.pile),/owner|Explorer/);assert.equal(f.writes,0);assert.equal(f.credits,0);});
test('pending native response credits nothing and reload retries the exact attempt',async()=>{const f=await setup();f.pending=true;const a=await f.make().pickup(f.pile);assert.equal(a.status,'pending');assert.equal(f.credits,0);f.pending=false;const b=await f.make().resume();assert.equal(b?.status,'admitted');assert.equal(f.credits,1);assert.equal(f.state.clearanceTaken?.[f.pile.pileId],1);});
test('food pack filling during admission retains admitted portion for later recovery',async()=>{const f=await setup();f.hook=()=>{f.live={...f.live,foodRoom:false};};const a=await f.make().pickup(f.pile);assert.equal(a.status,'retained');assert.equal(f.credits,0);assert.equal(f.writes,1);f.live={...f.live,foodRoom:true};await f.make().resume();assert.equal(f.credits,1);assert.equal(f.writes,1);});

test('owned-additions persistence and remote refresh retain global clearance history after owner changes',async()=>{
 const {state}=await ready;
 const {projectWildsOwnedWorldAdditions,mergeWildsOwnedWorldAdditions}=await import('../src/features/play/wilds-player-world-additions');
 const {preserveWildsConstructionHistory}=await import('../src/features/play/wilds-world-outbox');
 const {createWildsSourceAuthorityProjection}=await import('../src/features/play/wilds-source-work-authority');
 const replay=await replayWildsResourceJournalOwnerV128(state,'alice.receiz.id','explorer',state.traces['alice.receiz.id'].commands);
 const stored=JSON.parse(JSON.stringify(projectWildsOwnedWorldAdditions(replay.world,'explorer')));
 const restored=mergeWildsOwnedWorldAdditions(createWildsSourceAuthorityProjection(),stored);
 assert.deepEqual(restored.buildingClearances,replay.world.buildingClearances);
 const refreshed=preserveWildsConstructionHistory(restored,{...createWildsSourceAuthorityProjection(),revision:restored.revision+1});
 assert.deepEqual(refreshed.buildingClearances,replay.world.buildingClearances);
 const nextOwner=projectWildsOwnedWorldAdditions(refreshed,'bob');
 assert.deepEqual((nextOwner as unknown as typeof refreshed).buildingClearances,replay.world.buildingClearances,'shared source history is independent of building owner');
});

test('natural waterfall chute rocks clear while authored monument solids remain protected',async()=>{
 const {isWildsNaturalSceneryId}=await import('../src/features/play/wilds-build-scenery');
 const {wildsDiscoverySitesForRegion}=await import('../src/features/play/wilds-discovery-sites');
 const {projectWildsWaterfallChute}=await import('../src/features/play/wilds-discovery-monuments');
 const site=Array.from({length:30},(_,i)=>wildsDiscoverySitesForRegion(i,-i)).flat().find(site=>site.waterfall)!;
 const chute=projectWildsWaterfallChute(site)!;assert.ok(chute.parts.length);
 for(const part of chute.parts)assert.equal(isWildsNaturalSceneryId(part.solidId!),true);
 assert.equal(isWildsNaturalSceneryId('monument:arch:stone:0'),false);
});

test('stale competing pickup recovery is definite only after current native ancestry excludes its exact attempt',async()=>{
 const api=await import('../src/lib/receiz/wilds-clearance-admission-v128') as Record<string,unknown>;
 const classify=api.classifyWildsClearanceRecoveryV128 as ((input:Record<string,unknown>)=>string)|undefined;assert.equal(typeof classify,'function');
 const {state,pile}=await ready;const {planWildsClearancePickupV128}=await import('../src/lib/receiz/wilds-clearance-admission-v128');
 const proposal=planWildsClearancePickupV128({source:{state,predecessor:{head:{head:HEAD}}},clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:HEAD,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',player:pile.position,spaceId:'wildz.space.outer.v1',kaiUPulse:100_000_100,commandId:'race:bob'});
 const event={schema:'wildz.resource-command.v128',kind:'use',attemptId:'race:bob',ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:[{kind:'world',command:proposal.command,kaiUPulse:proposal.kaiUPulse}],useCommandId:'race:bob'} as const;
 const admitted=await reduceWildsResourceJournalV128(state,event,{ownerReceizId:'bob.receiz.id',expectedNativeHead:HEAD});assert.equal(admitted.clearanceTaken?.[pile.pileId],1);
 const competing={...event,attemptId:'race:carol',ownerReceizId:'carol.receiz.id',gameplayOwnerId:'carol',commands:[{kind:'world',command:{...proposal.command,commandId:'race:carol'},kaiUPulse:proposal.kaiUPulse}],useCommandId:'race:carol'} as const;
 await reduceWildsResourceJournalV128(state,competing,{ownerReceizId:'carol.receiz.id',expectedNativeHead:HEAD});
 assert.equal(classify!({event,previous:['paid','clearance'],current:{events:[{event:competing}],sourceArtifactShas:['paid','clearance','winner']}}),'rejected');
 assert.equal(classify!({event,previous:['paid','clearance'],current:{events:[{event}],sourceArtifactShas:['paid','clearance','bob','later']}}),'admitted');
 assert.equal(classify!({event,previous:['paid','clearance'],current:null}),'pending');
 assert.equal(classify!({event,previous:['paid','clearance'],current:{events:[],sourceArtifactShas:['paid','clearance']}}),'pending');
 assert.equal(classify!({event,previous:['paid','clearance'],current:{events:[],sourceArtifactShas:['other']}}),'pending');
});

test('placement requests survive runtime-open interruption and reload before native admission',async()=>{
 const api=await load(),database=createMemoryWildzContinuityDatabase(),binding={keyId:'queued-key',ownerHandle:'builder.receiz.id',gameplayOwnerId:'builder'};
 const live={...binding,player:{x:0,y:0,z:0},spaceId:'wildz.space.outer.v1',kaiUPulse:100_000_200,foodRoom:true};
 const request={attemptId:'build:durable-queue',buildingId:'paid-foundation',buildingHead:'exact-paid-head',kaiUPulse:100_000_100};
 let opens=0,flushes=0;const attempts:unknown[]=[];
 const common={database,binding,live:()=>live,flush:async()=>{flushes++;},apply:async()=>true};
 const first=api.createWildsClearanceInteraction({...common,openRuntime:async()=>{opens++;throw Error('fixture runtime unavailable');}});
 await assert.rejects(first.derive(request),/runtime unavailable/);assert.equal(await first.pending(),true);assert.equal(opens,1);
 const second=api.createWildsClearanceInteraction({...common,openRuntime:async()=>({exchange:{recoverClearance:async()=>null,deriveClearance:async(value:unknown)=>{attempts.push(value);return {status:'admitted',members:[]};}}})});
 assert.equal((await second.resume())?.status,'admitted');assert.equal(await second.pending(),false);assert.equal(attempts.length,1);
 assert.deepEqual(attempts[0],{...request,kaiUPulse:live.kaiUPulse});assert.equal(flushes,2,'history flush completes before runtime and never waits on its own construction callback');
});
