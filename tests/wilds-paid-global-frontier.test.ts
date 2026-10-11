import {compileCreation} from '../src/features/play/creation/compiler';
import {creationWorldSourceHead,creationWorldAvailability} from '../src/features/play/creation/world-source';
import {selectCreationResources} from '../src/features/play/creation/resources';
import * as journal from '../src/lib/receiz/wilds-resource-journal-v128';
import {wildsResourceSourceNamespaceV128} from '../src/lib/receiz/wilds-resource-exchange-v128';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {paidClearanceTrace,clearanceFixtureTree} from './support/clearance-source-fixture';
import {initialWildsResourceJournalV128,reduceWildsResourceJournalV128,WILDS_RESOURCE_GENESIS_HEAD_V128,type WildsResourceJournalEventV128} from '../src/lib/receiz/wilds-resource-journal-v128';
import * as clearance from '../src/lib/receiz/wilds-clearance-admission-v128';
import {canonicalPortableCardJson} from '../src/features/play/portable-card';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
const source=readFileSync('src/lib/receiz/wilds-resource-exchange-v128.ts','utf8');
const body=source.slice(source.indexOf(' async function append('),source.indexOf(' async function readUseOutcome('));
const code=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const first=paidClearanceTrace();
for(const mode of ['overlap','adjacent','same-owner-overlap','legacy-site-overlap','legacy-site-adjacent','established-legacy-site-overlap'] as const)test(`actual common append rejects paid overlap before publisher prepare: ${mode}`,async()=>{
 const f=await first,owner='alice.receiz.id',paid={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'global:first',ownerReceizId:owner,gameplayOwnerId:'explorer',commands:f.commands} as const;
 let before=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),paid,{ownerReceizId:owner,verifyCard:async()=>{}});
 const second=await paidClearanceTrace({owner:'neighbor',sourceOffset:15,...(mode.includes('legacy-site')?{foundation:true}:{}),...(mode==='adjacent'?{point:{...clearanceFixtureTree.position,x:clearanceFixtureTree.position.x+12}}:{})});
 let event={...paid,ownerReceizId:mode==='same-owner-overlap'?owner:'neighbor.receiz.id',gameplayOwnerId:mode==='same-owner-overlap'?'explorer':'neighbor',attemptId:'global:second',commands:second.commands} as WildsResourceJournalEventV128;
 if(mode==='same-owner-overlap'){
  const last=f.commands.at(-1)!;assert.equal(last.kind,'world');if(last.kind!=='world'||last.command.type!=='creation.construct')throw Error('fixture');
  const context={...last.command.context,sourceHead:creationWorldSourceHead(f.replay.world)},compiled=compileCreation(last.command.definition,context);assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error('fixture');
  const resources=selectCreationResources(Object.values(f.replay.world.materialLots),context.budget,compiled.plan.requiredResources,creationWorldAvailability(f.replay.world,'explorer'));
  event={...paid,attemptId:'global:same-owner',commands:[...f.commands,{...last,kaiUPulse:f.kaiUPulse+1,command:{...last.command,commandId:'global:same-owner',instanceId:'global:second-building',context,planDigest:compiled.plan.digest,resources:resources.lots}}]};
 }
 if(mode.includes('legacy-site')){
  const commands=second.commands.filter(row=>row.kind==='world'&&row.command.type==='resource.material.harvest');
  const born=await journal.replayWildsResourceJournalOwnerV128(initialWildsResourceJournalV128(),'neighbor.receiz.id','neighbor',commands,async()=>{});
  const lots=Object.values(born.world.materialLots),point={...clearanceFixtureTree.position,...(mode==='legacy-site-adjacent'?{x:clearanceFixtureTree.position.x+16}:{})};
  event={...paid,ownerReceizId:'neighbor.receiz.id',gameplayOwnerId:'neighbor',attemptId:'global:legacy-site',commands:[...commands,{kind:'world',kaiUPulse:second.kaiUPulse,command:{type:'construction.site.place',commandId:'global:legacy-site',blueprint:'trail-shelter',position:point,actorPosition:point,rotationQuarterTurns:0,lotIds:[...lots.filter(l=>l.kind==='timber').slice(0,2),...lots.filter(l=>l.kind==='stone').slice(0,1)].map(l=>l.lotId)}}]};
 }
 let previousEvent:WildsResourceJournalEventV128=paid;
 if(mode==='established-legacy-site-overlap'){previousEvent=event;before=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),event,{ownerReceizId:event.ownerReceizId,verifyCard:async()=>{}});event=paid;}
 const reachesPublisher=mode==='adjacent'||mode==='legacy-site-adjacent';
 const proof={custodyArtifact:{artifactSha256:'fixture'}},verified={state:before,predecessor:{head:{head:'1'.repeat(64)}},events:[{event:previousEvent}]};let publications=0;
 const deps={...journal,...clearance,wildsResourceSourceNamespaceV128,input:{database:createMemoryWildzContinuityDatabase(),locator:{read:async()=>proof},sdk:{},authority:{keyFile:{keyId:'fixture'}}},owner:event.ownerReceizId,key:(id:string)=>id,current:async()=>verified,canonicalPortableCardJson,same:(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b),fail:(reason:string)=>{throw Error(reason);},applicationId:'wildz',verifyWildsResourceSourceProofV128:async()=>verified,reduceWildsResourceJournalV128,initialWildsResourceJournalV128,WILDS_RESOURCE_GENESIS_HEAD_V128,verifyWildsResourceGameplayCardV128:async()=>{},publisher:{publish:async()=>{publications++;throw Error('controlled_native_boundary');}}};
 const append=new Function(...Object.keys(deps),code+'return append;')(...Object.values(deps));
 await assert.rejects(append(event),reachesPublisher?/controlled_native_boundary/:mode==='same-owner-overlap'?/creation_world_terrain_occupied/:/established_structure_overlap/);
 assert.equal(publications,reachesPublisher?1:0);assert.equal(Object.keys(before.traces).length,1);
});

test('actual append simultaneous owners bind one predecessor, recover accepted lost reply, and recheck a fresh retry',async()=>{
 const a=await first,b=await paidClearanceTrace({owner:'neighbor',sourceOffset:15});
 const event=(f:typeof a,owner:string,actor:string):WildsResourceJournalEventV128=>({schema:'wildz.resource-command.v128',kind:'replay',attemptId:`global:race:${actor}`,ownerReceizId:owner,gameplayOwnerId:actor,commands:f.commands});
 const ea=event(a,'alice.receiz.id','explorer'),eb=event(b,'neighbor.receiz.id','neighbor');
 type Verified={state:Awaited<ReturnType<typeof reduceWildsResourceJournalV128>>;events:{event:WildsResourceJournalEventV128}[];predecessor:{head:{head:string}}};
 const proofs=new Map<object,Verified>();let located:object|null=null,publications=0,entered=0,release!:()=>void;
 const barrier=new Promise<void>(resolve=>{release=resolve;});
 function client(owner:string){
  const database=createMemoryWildzContinuityDatabase();
  const deps={...journal,...clearance,wildsResourceSourceNamespaceV128,input:{database,locator:{read:async()=>located},sdk:{},authority:{keyFile:{keyId:'fixture'}}},owner,key:(id:string)=>id,current:async(proof:object|null)=>proof?proofs.get(proof):null,canonicalPortableCardJson,same:(x:unknown,y:unknown)=>canonicalPortableCardJson(x)===canonicalPortableCardJson(y),fail:(reason:string)=>{throw Error(reason);},applicationId:'wildz',verifyWildsResourceSourceProofV128:async(_sdk:unknown,proof:object)=>proofs.get(proof),verifyWildsResourceGameplayCardV128:async()=>{},publisher:{publish:async({page}:{page:{event:WildsResourceJournalEventV128;predecessor:Verified['predecessor']|null}})=>{
   publications++;if(++entered===2)release();if(entered<=2)await barrier;
   const latest=located?proofs.get(located)!:null;
   if((page.predecessor?.head.head??null)!==(latest?.predecessor.head.head??null))throw Error('controlled_native_cas_stale');
   const state=await reduceWildsResourceJournalV128(latest?.state??initialWildsResourceJournalV128(),page.event,{ownerReceizId:owner,verifyCard:async()=>{}});
   // Native CAS atomically checks again after the asynchronous reducer fixture.
   if(located!==null)throw Error('controlled_native_cas_stale');
   located={custodyArtifact:{artifactSha256:'accepted-race'}};proofs.set(located,{state,events:[{event:page.event}],predecessor:{head:{head:'2'.repeat(64)}}});
   throw Error('controlled_accepted_reply_lost');
  }}};
  return new Function(...Object.keys(deps),code+'return append;')(...Object.values(deps)) as (e:WildsResourceJournalEventV128)=>Promise<Verified>;
 }
 const ca=client(ea.ownerReceizId),cb=client(eb.ownerReceizId),outcomes=await Promise.allSettled([ca(ea),cb(eb)]);
 assert.equal(outcomes.filter(row=>row.status==='rejected'&&/accepted_reply_lost/.test(String(row.reason))).length,1);
 assert.equal(outcomes.filter(row=>row.status==='rejected'&&/cas_stale/.test(String(row.reason))).length,1);assert.equal(publications,2);
 assert.ok(located);const accepted=proofs.get(located)!,winner=accepted.events[0].event,winnerClient=winner.ownerReceizId===ea.ownerReceizId?ca:cb,loserClient=winnerClient===ca?cb:ca,loser=winnerClient===ca?eb:ea;
 assert.deepEqual((await winnerClient(winner)).state,accepted.state);assert.equal(publications,2,'accepted recovery never re-prepares');
 await assert.rejects(loserClient({...loser,attemptId:loser.attemptId+':fresh'}),/established_structure_overlap/);
 assert.equal(publications,2,'new frontier rejects before prepare');assert.equal(Object.keys(accepted.state.traces).length,1);
});
