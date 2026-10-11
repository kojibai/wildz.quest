import {assertWildsPaidPlacementFrontierV128} from '../.test-build/src/lib/receiz/wilds-clearance-admission-v128.js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const root=process.cwd(),base=root+'/.test-build/src/';
const load=p=>import(base+p+'.js');
const {replayWildsResourceGameplayV128}=await load('lib/receiz/wilds-resource-gameplay-v128');
const {initialWildsResourceJournalV128,reduceWildsResourceJournalV128,replayWildsResourceJournalOwnerV128}=await load('lib/receiz/wilds-resource-journal-v128');
const {createWildsSourceAuthorityProjection,planWildsMaterialHarvest}=await load('features/play/wilds-source-work-authority');
const {projectWildsResourceRegion}=await load('features/play/wilds-resource-authority');
const {projectWildsOwnedWorldAdditions,mergeWildsOwnedWorldAdditions}=await load('features/play/wilds-player-world-additions');
const {selectWildsWalletSourceLotsV128}=await load('features/play/wallet/wilds-wallet-resource-use-projection-v128');
const {wildsMaterialCustodian}=await load('features/play/wilds-world-state');
const OWNER='alice.receiz.id',GAMEPLAY='alice',KAI=100000000;
const original={schema:'receiz.sealed-artifact-bytes.v124',exactBytesB64u:'eA',artifactSha256:'a'.repeat(64),payloadSha256:'b'.repeat(64),filename:'fixture.receizbundle',mimeType:'application/vnd.receiz.bundle+json'};
const source=projectWildsResourceRegion(0,0).find(item=>item.kind==='hay');
const harvest=planWildsMaterialHarvest({projection:createWildsSourceAuthorityProjection(),source,actorId:GAMEPLAY,actorPosition:source.position,kaiUPulse:KAI,commandId:'harvest:pending-route:hay'});
const commands=[{kind:'world',command:harvest,kaiUPulse:KAI}],born=await replayWildsResourceGameplayV128({gameplayOwnerId:GAMEPLAY,commands});
const lot=Object.values(born.world.materialLots)[0],checkpoint=structuredClone(projectWildsOwnedWorldAdditions(born.world,GAMEPLAY));
const reserve={schema:'wildz.resource-command.v128',kind:'reserve',attemptId:'package:pending-route:hay',ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,commands,createdKaiUPulse:KAI+1,memberIds:[lot.lotId],recipientHandle:'bob'};
let state=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),reserve,{ownerReceizId:OWNER});
const packageId=Object.keys(state.packages)[0],bob={ownerReceizId:'bob.receiz.id',verifyPackage:async()=>({genesisOwnerReceizId:OWNER,artifactSha256:original.artifactSha256})};
const claim={schema:'wildz.resource-command.v128',kind:'claim',attemptId:'receive:pending-route:hay',ownerReceizId:bob.ownerReceizId,packageId,artifact:original};
state=await reduceWildsResourceJournalV128(state,claim,bob);state=await reduceWildsResourceJournalV128(state,{...claim,kind:'unpack',attemptId:'unpack:pending-route:hay',kaiUPulse:KAI+3000000},bob);
const imported=await replayWildsResourceJournalOwnerV128(state,bob.ownerReceizId,'bob',[]);
const importedSaved=structuredClone(projectWildsOwnedWorldAdditions(imported.world,'bob'));
const restored=mergeWildsOwnedWorldAdditions(createWildsSourceAuthorityProjection(),importedSaved);
const remount=mergeWildsOwnedWorldAdditions(createWildsSourceAuthorityProjection(),checkpoint);
const select=(world,owner)=>selectWildsWalletSourceLotsV128({world,ownerReceizId:owner,availableMembers:[],lockedMemberIds:new Set()}).materialLots.map(l=>l.lotId);
const senderCurrent=await replayWildsResourceJournalOwnerV128(state,OWNER,GAMEPLAY,commands);
const result={scope:'Synthetic boundary-admitted journal package; no native artifact/currentness qualification',lotId:lot.lotId,importedCurrentCustodian:wildsMaterialCustodian(imported.world,lot),importedCheckpointLots:Object.keys(importedSaved.materialLots),importedRemountCustodian:wildsMaterialCustodian(restored,lot),importedPendingSelection:select(restored,'bob'),localBeforePackagingSelection:select(born.world,GAMEPLAY),senderSourceAfterTransferSelection:select(senderCurrent.world,GAMEPLAY),senderPrepackCheckpointAfterTransferPendingSelection:select(remount,GAMEPLAY),senderCurrentReservation:senderCurrent.world.reservedMaterialLots[lot.lotId],nativeCalls:0};
const ts=await import(root+'/node_modules/typescript/lib/typescript.js');
const campaignSource=readFileSync(root+'/src/features/play/PlayCampaign.tsx','utf8');
const callback=campaignSource.slice(campaignSource.indexOf('  admitResourceSourceCommandRef.current = async (entry, beforeAdmit) => {'),campaignSource.indexOf('  const ensureWalletTradeReady = useCallback'));
const compiledCallback=ts.transpileModule(callback,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {sealCollectedCard}=await load('features/play/portable-card');
const {emptyAdventureCondition}=await load('features/play/adventure/card-condition');
const {createCreationDefinition}=await load('features/play/creation/definition');
const {compileCreation}=await load('features/play/creation/compiler');
const {combineCreationTechniques,projectCreationWorkers}=await load('features/play/creation/capabilities');
const {selectCreationResources}=await load('features/play/creation/resources');
const {creationWorldSourceHead,creationWorldAvailability}=await load('features/play/creation/world-source');
const {verifyWildsWorldAdmittedSource,createWildsWorldEdgeAdmissionQueue,persistWildsWorldCommandDurably}=await load('features/play/wilds-world-outbox');
const {createReceizInMemoryOfflineProofQueueStorage}=await import(root+'/node_modules/@receiz/sdk/dist/index.js');
const card=sealCollectedCard({capturedAt:'2026-10-10T00:00:00.000Z',encounterId:'pending-route-worker',formId:'mintcub-1',ownerReceizId:GAMEPLAY}),condition=emptyAdventureCondition(card.id);
const definition=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:'pending-route',creatorId:GAMEPLAY,assets:[],nodes:[{id:'cushion',parentId:null,pose:{position:{x:0,y:0,z:0},yaw:0},shape:{kind:'box',width:.2,height:.2,depth:.2},material:'hay',attachments:[],supports:[],behaviors:[]}]});
const context={worldId:remount.worldId,spaceId:'wildz.space.outer.v1',pose:{position:{x:5000,y:100,z:5000},yaw:0},sourceHead:creationWorldSourceHead(remount),budget:{hay:1},techniques:combineCreationTechniques(projectCreationWorkers([card],{[card.id]:condition})),physical:[],quality:'low'};
const compiled=compileCreation(definition,context);if(compiled.status!=='ready')throw Error('route_compile_'+compiled.status);
const resources=selectCreationResources([lot],context.budget,compiled.plan.requiredResources,creationWorldAvailability(remount,GAMEPLAY));
const command={type:'creation.construct',commandId:'creation:pending-route',instanceId:'creation:pending-route',definition,context,planDigest:compiled.plan.digest,workerSources:[{card,condition}],resources:resources.lots,actorPosition:context.pose.position};
const entry={schema:'receiz.wilds_world_outbox_entry.v1',actorId:GAMEPLAY,guestId:'qa:pending-route',command,queuedAt:'2026-10-10T00:00:00.000Z'};
const {withWildsWorldCommandKai}=await load('features/play/wilds-world-authority');
const {deriveKaiKlokMomentFromUPulse}=await load('features/play/kai-klok-moment');
const {createKaiTemporalRoot}=await load('features/play/kai-temporal-root');
entry.command=withWildsWorldCommandKai(command,createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:KAI+4000000,authority:'local'})));
const ordinaryContext={...context,sourceHead:creationWorldSourceHead(born.world)};
const ordinaryPlan=compileCreation(definition,ordinaryContext);assert.equal(ordinaryPlan.status,'ready');
const ordinaryEntry={...entry,command:{...entry.command,context:ordinaryContext,planDigest:ordinaryPlan.plan.digest}};
const {canonicalPortableCardJson}=await load('features/play/portable-card');
const {checkpointWildsWorld}=await load('features/play/wilds-world-state');
const {isWildsEdgeImmediateConstructionCommand}=await load('features/play/wilds-world-authority');
const {projectActiveCreationContext}=await load('features/play/creation/live-context');
const {mergeQualifiedWildsResourceWorldV128}=await load('lib/receiz/wilds-resource-gameplay-v128');
const {wildsResourceGameplayCommandIdV128}=await load('lib/receiz/wilds-resource-gameplay-v128');
const {persistWildsOrdinaryMaterialAdmission}=await load('features/play/wilds-material-edge-admission');
const {createMemoryWildzContinuityDatabase}=await import(root+'/.test-build/tests/support/memory-wildz-continuity-database.js');
const {createWildzIdentityRepository}=await load('lib/receiz/wildz-identity-repository');
const {createWildsWalletResourceProjectionStoreV128}=await load('features/play/wallet/wilds-wallet-resource-projection-store-v128');
const {createReceizIdentityKeyFile}=await import(root+'/node_modules/@receiz/sdk/dist/index.js');
const {rejectUnpreparedWildsMaterialV128}=await load('lib/receiz/wilds-material-publication-fence-v128');
const exchangeSource=readFileSync(root+'/src/lib/receiz/wilds-resource-exchange-v128.ts','utf8');
const method=exchangeSource.slice(exchangeSource.indexOf('  async admitMaterialCommand('),exchangeSource.indexOf('  async qualifyGameplay('));
const previewMethod=exchangeSource.slice(exchangeSource.indexOf('  async previewGameplay('),exchangeSource.indexOf('  async use('));
const methodCode=ts.transpileModule('const operation={'+method+previewMethod+'};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
// Source/currentness/CAS is the explicitly simulated external boundary. The
// actual production method, journal law, Campaign callback and edge queue run.
// These results never claim a sealed native host acceptance.
function nativeBoundary(initial=null,{race=false,offline=false,loseReply=false,history=commands,verifyFailure=false}={}){
 let currentState=initial,accepted=null,calls=0,retained=null;
 const nativeDatabase=createMemoryWildzContinuityDatabase();
 const deps={assertWildsPaidPlacementFrontierV128,input:{database:{...nativeDatabase,read:async(store,key)=>key.includes('resource-exchange-attempt')?retained:nativeDatabase.read(store,key)},locator:{read:async()=>currentState},gameplayOwnerId:GAMEPLAY,authority:{keyFile:{keyId:'fixture'}},resolveOriginal:async()=>original,sdk:{}},owner:OWNER,key:id=>JSON.stringify(['wildz.resource-exchange-attempt.v128',OWNER,id]),
  current:async()=>{if(offline)throw Error('source_offline');return currentState?{state:currentState,events:accepted?.events??[],predecessor:{head:{head:'controlled-current'}}}:null;},
  rejectUnpreparedWildsMaterialV128,reduceWildsResourceJournalV128,
  same:(a,b)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b),fail:reason=>{throw Error(reason);},wildsResourceGameplayCommandIdV128,
  resolveWildsResourceGameplayOriginalsV128:async()=>({commands:history}),
  verifyWildsWorldAdmittedSource,checkpointWildsWorld,isWildsEdgeImmediateConstructionCommand,initialWildsResourceJournalV128,replayWildsResourceJournalOwnerV128,verifyWildsResourceGameplayCardV128:async()=>{if(verifyFailure)throw Error('native_verification_offline');},
  append:async(event,fence,check)=>{
   calls++;
   if(accepted){assert.deepEqual(event,retained.event);return accepted;}
   retained={event:structuredClone(event)};
   const before=race?state:currentState??initialWildsResourceJournalV128();
   const after=await reduceWildsResourceJournalV128(before,event,{ownerReceizId:OWNER,verifyCard:async()=>{}});
   await check(after);await fence?.();
   await nativeDatabase.transaction(['meta'],'readwrite',tx=>tx.put('meta',{preparation:'controlled-boundary'},JSON.stringify(['wildz.resource-source-attempt.v128',OWNER,event.attemptId])));
   accepted={state:after,events:[{event:structuredClone(event)}]};currentState=after;
   if(loseReply){loseReply=false;throw Error('native_accepted_reply_lost');}
   return accepted;
  }};
 const operation=new Function(...Object.keys(deps),methodCode+'return operation;')(...Object.values(deps));
 return {operation,nativeDatabase,counts:()=>({calls,accepted:Boolean(accepted)})};
}
async function campaign(boundary,options={}){
 const {keyFile}=await createReceizIdentityKeyFile({owner:{uid:'material-route',username:'alice'}});
 const database=createMemoryWildzContinuityDatabase(),repository=createWildzIdentityRepository({database}),prepared=await repository.prepare(keyFile);
 await database.transaction(['identities','meta'],'readwrite',tx=>repository.writePrepared(tx,prepared,true));
 const identity={keyId:keyFile.keyId,ownerHandle:OWNER,incarnation:prepared.session.walletObservationEpoch??'legacy'};
 const store=()=>createWildsWalletResourceProjectionStoreV128({...identity,actorId:prepared.session.actorId,currentIdentity:()=>identity,openRuntime:async()=>{throw Error('no presentation authority');}}, {database:async()=>database});
 const ref={},order=[];
 const deps={admitResourceSourceCommandRef:ref,clearanceBeforeConstructionRef:{current:async()=>{}},livingWorld:{currentApplicationResourceSource:()=>null},creationWorldSourceHead,
  walletAssetPort:{openClearanceRuntime:async()=>({exchange:{admitMaterialCommand:async(...args)=>{order.push('classify');const result=await boundary.operation.admitMaterialCommand(...args);if(options.logout)await repository.logout();return result;}}})},
  walletSourceUse:{observe:async()=>{order.push('observe');return options.recovered??null;},recover:async()=>{order.push('recover');return null;},use:async(...args)=>{order.push('use');if(options.use)return options.use(...args);throw Error('actual_source_reserved_or_spent');}},
  walletSourceStore:store(),walletTradeIdentityRef:{current:identity},resourceGameplayCapture:{flush:async()=>{}},canonicalPortableCardJson,
  walletSourceProjection:{lockedMemberIds:new Set(options.locked?[lot.lotId]:[])},markWalletObservationPending:async()=>{},currentWalletSourceRows:[],
  walletIdentityKey:prepared.session.actorId,walletObservationEpoch:identity.incarnation,setWalletSourceRows:()=>{}};
 const mount=()=>{deps.walletSourceStore=store();new Function(...Object.keys(deps),compiledCallback)(...Object.values(deps));return ref.current;};
 return {invoke:mount(),mount,database,repository,order,store,identity};
}
function edge({fail=false}={}){
 let writes=0,captures=0;
 const storage=createReceizInMemoryOfflineProofQueueStorage();
 const persist=async candidate=>{if(fail){fail=false;throw Error('edge_storage_failed');}await persistWildsWorldCommandDurably(candidate,storage);writes++;};
 const queue=createWildsWorldEdgeAdmissionQueue({initialProjection:remount,persist});
 return {queue,counts:()=>({writes,captures}),apply:admission=>persistWildsOrdinaryMaterialAdmission({admission,persist,restore:async()=>{},capture:async()=>{captures++;},apply:projection=>queue.adopt(mergeQualifiedWildsResourceWorldV128(queue.current(),projection))})};
}
test('actual transferred journal → stale checkpoint → Campaign cannot enter ordinary edge',async()=>{
 assert.deepEqual(select(senderCurrent.world,GAMEPLAY),[]);assert.deepEqual(select(remount,GAMEPLAY),[lot.lotId]);
 const f=await campaign(nativeBoundary(state)),e=edge();
 await assert.rejects(f.invoke(entry),/materials|reserved_or_spent/);assert.equal(e.counts().writes,0);assert.equal(e.queue.current().creations[command.instanceId],undefined);
 assert.deepEqual(f.order,['classify']);
});
test('ordinary exact command wins existing replay law before real ordinary persistence',async()=>{
 const n=nativeBoundary(),f=await campaign(n),e=edge();const admitted=await f.invoke(ordinaryEntry);
 assert.equal(admitted.ordinary,true);assert.equal(n.counts().accepted,true);assert.equal(e.counts().writes,0);
 const final=await e.apply(admitted);assert.equal(e.counts().writes,1);assert.ok(final.creations[command.instanceId]);assert.equal(final.consumedMaterialLots[lot.lotId],command.commandId);
});
test('reservation between source read and replay append denies the exact effect and edge',async()=>{
 const n=nativeBoundary(null,{race:true}),f=await campaign(n),e=edge();await assert.rejects(f.invoke(ordinaryEntry),/effect|required|reserved|trace|source_stale/);assert.equal(n.counts().accepted,false);assert.equal(e.counts().writes,0);
});
test('missing source/failed classification stays pending with zero ordinary writes',async()=>{
 const f=await campaign(nativeBoundary(null,{offline:true})),e=edge();await assert.rejects(f.invoke(entry),/offline/);assert.equal(e.counts().writes,0);
 const retry={...entry,command:{...entry.command,commandId:'creation:new-retry'}};assert.equal((await f.store().prepareMaterial(retry)).command.commandId,entry.command.commandId);
});
test('native acceptance then edge failure survives fresh store and changed retry ID',async()=>{
 const n=nativeBoundary(),f=await campaign(n),e=edge({fail:true});const first=await f.invoke(ordinaryEntry);await assert.rejects(e.apply(first),/storage_failed/);
 const retry={...entry,command:{...entry.command,commandId:'creation:new-retry',instanceId:'creation:new-retry'}};
 const recovered=await f.mount()(retry);assert.equal(recovered.entry.command.commandId,entry.command.commandId);
 const final=await e.apply(recovered);assert.equal(e.counts().writes,1);assert.ok(final.creations[command.instanceId]);assert.equal(final.creations['creation:new-retry'],undefined);
 assert.equal((await f.store().prepareMaterial(retry)).command.commandId,'creation:new-retry');
});
test('native accepted reply lost resumes exact event after remount without new command',async()=>{
 const n=nativeBoundary(null,{loseReply:true}),f=await campaign(n),e=edge();await assert.rejects(f.invoke(ordinaryEntry),/reply_lost/);assert.equal(n.counts().accepted,true);
 const retry={...entry,command:{...entry.command,commandId:'creation:changed-id'}};const recovered=await f.mount()(retry);assert.equal(recovered.entry.command.commandId,entry.command.commandId);await e.apply(recovered);assert.equal(e.counts().writes,1);
});
test('logout after native acceptance prevents ordinary handoff and retains exact pending entry',async()=>{
 const f=await campaign(nativeBoundary(),{logout:true}),e=edge();await assert.rejects(f.invoke(ordinaryEntry),/Explorer changed/);assert.equal(e.counts().writes,0);
});
test('source locks fail after exact observe/recover and before fresh use',async()=>{
 const n=nativeBoundary(state);await n.nativeDatabase.transaction(['meta'],'readwrite',tx=>tx.put('meta',{preparation:'uncertain'},JSON.stringify(['wildz.resource-source-attempt.v128',OWNER,`material-use:${entry.command.commandId}`])));
 const f=await campaign(n,{locked:true});await assert.rejects(f.invoke(entry),/reserved, spent/);assert.deepEqual(f.order,['classify','observe','recover']);
});

test('restored ordinary checkpoint → production source preview/planner → native replay → durable visible source outcome',async()=>{
 const n=nativeBoundary(),preview=await n.operation.previewGameplay();
 assert.notEqual(creationWorldSourceHead(remount),creationWorldSourceHead(preview.replay.world));
 const planned=projectActiveCreationContext({active:true,context,world:()=>preview.replay.world,physical:{projections:[],obstacles:[]}});
 const plan=compileCreation(definition,planned);assert.equal(plan.status,'ready');
 const selection=selectCreationResources(Object.values(preview.replay.world.materialLots),planned.budget,plan.plan.requiredResources,creationWorldAvailability(preview.replay.world,GAMEPLAY));
 const plannedEntry={...entry,command:{...entry.command,context:planned,planDigest:plan.plan.digest,resources:selection.lots}};
 const f=await campaign(n),e=edge(),admitted=await f.invoke(plannedEntry);
 assert.deepEqual(admitted.entry.command,plannedEntry.command);assert.ok(admitted.entry.admittedSource);
 const final=await e.apply(admitted);assert.equal(e.counts().writes,1);assert.ok(final.creations[command.instanceId]);assert.equal(final.consumedMaterialLots[lot.lotId],command.commandId);
});
test('transferred restored checkpoint source preview removes material before production planning',async()=>{
 const n=nativeBoundary(state),preview=await n.operation.previewGameplay();
 assert.deepEqual(select(preview.replay.world,GAMEPLAY),[]);
});

test('definitively rejected transferred command releases the exact pending entry',async()=>{
 const f=await campaign(nativeBoundary(state));
 await assert.rejects(f.invoke(entry),/materials|source|reserved|spent/);
 const retry={...ordinaryEntry,command:{...ordinaryEntry.command,commandId:'creation:valid-next'}};
 assert.equal((await f.store().prepareMaterial(retry)).command.commandId,retry.command.commandId);
});

const otherSource=projectWildsResourceRegion(1,0).find(item=>item.kind==='hay');
const otherHarvest=planWildsMaterialHarvest({projection:born.world,source:otherSource,actorId:GAMEPLAY,actorPosition:otherSource.position,kaiUPulse:KAI+1,commandId:'harvest:pending-route:other'});
const twoHarvests=[...commands,{kind:'world',command:otherHarvest,kaiUPulse:KAI+1}];
async function freshPlan(n,id){
 const preview=await n.operation.previewGameplay();
 const planned=projectActiveCreationContext({active:true,context,world:()=>preview.replay.world,physical:{projections:[],obstacles:[]}}),plan=compileCreation(definition,planned);assert.equal(plan.status,'ready');
 const selected=selectCreationResources(Object.values(preview.replay.world.materialLots),planned.budget,plan.plan.requiredResources,creationWorldAvailability(preview.replay.world,GAMEPLAY));
 return {...entry,command:{...entry.command,commandId:id,instanceId:id,context:planned,planDigest:plan.plan.digest,resources:selected.lots}};
}
test('transferred rejection then different legitimate material intent plans, persists and becomes functional',async()=>{
 const n=nativeBoundary(state,{history:twoHarvests}),f=await campaign(n),e=edge();
 await assert.rejects(f.invoke(entry),/materials/);
 const next=await freshPlan(n,'creation:other-owned-lot');assert.notEqual(next.command.resources[0].id,lot.lotId);
 const final=await e.apply(await f.invoke(next));assert.ok(final.creations[next.command.instanceId]);assert.equal(e.counts().writes,1);
});
test('unrelated source advance rejects stale preview before preparation then new valid plan succeeds',async()=>{
 const advanced=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),{schema:'wildz.resource-command.v128',kind:'replay',ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,attemptId:'source:advance:other',commands:twoHarvests},{ownerReceizId:OWNER});
 const n=nativeBoundary(advanced,{history:twoHarvests}),f=await campaign(n),e=edge();
 await assert.rejects(f.invoke(ordinaryEntry),/materials/);assert.equal(n.counts().calls,0);
 const next=await freshPlan(n,'creation:current-preview');const final=await e.apply(await f.invoke(next));assert.ok(final.creations[next.command.instanceId]);assert.equal(e.counts().writes,1);
});
test('verification/offline error at preflight cannot release pending command',async()=>{
 const current=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),{schema:'wildz.resource-command.v128',kind:'replay',ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,attemptId:'source:initial:harvest',commands},{ownerReceizId:OWNER});
 const n=nativeBoundary(current,{verifyFailure:true}),f=await campaign(n);
 await assert.rejects(f.invoke(ordinaryEntry),/offline/);
 const next={...entry,command:{...entry.command,commandId:'creation:cannot-replace'}};
 assert.equal((await f.store().prepareMaterial(next)).command.commandId,ordinaryEntry.command.commandId);
});

test('source-owned stale preview releases before preparation and valid replan keeps observe→recover→use',async()=>{
 const bobHarvest=planWildsMaterialHarvest({projection:createWildsSourceAuthorityProjection(),source,actorId:'bob',actorPosition:source.position,kaiUPulse:KAI,commandId:'harvest:bob:hay'});
 const bobCommands=[{kind:'world',command:bobHarvest,kaiUPulse:KAI}],bobBorn=await replayWildsResourceGameplayV128({gameplayOwnerId:'bob',commands:bobCommands});
 const bobLot=Object.values(bobBorn.world.materialLots)[0];
 let received=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),{schema:'wildz.resource-command.v128',kind:'reserve',attemptId:'bob:send:alice',ownerReceizId:bob.ownerReceizId,gameplayOwnerId:'bob',commands:bobCommands,createdKaiUPulse:KAI+1,memberIds:[bobLot.lotId],recipientHandle:'alice'},{ownerReceizId:bob.ownerReceizId});
 const pkg=Object.keys(received.packages)[0],receive={schema:'wildz.resource-command.v128',kind:'claim',attemptId:'alice:receive:claim',ownerReceizId:OWNER,packageId:pkg,artifact:original};
 const admission={ownerReceizId:OWNER,verifyPackage:async()=>({genesisOwnerReceizId:bob.ownerReceizId,artifactSha256:original.artifactSha256})};
 received=await reduceWildsResourceJournalV128(received,receive,admission);
 received=await reduceWildsResourceJournalV128(received,{...receive,kind:'unpack',attemptId:'alice:receive:unpack',kaiUPulse:KAI+3000000},admission);
 const n=nativeBoundary(received,{history:[]}),f=await campaign(n,{use:async(request,fence)=>{
  await fence();
  const raw=request.command,enriched={...raw,workerOriginals:Object.fromEntries(raw.command.workerSources.map(source=>[source.card.id,original]))};
  const event={schema:'wildz.resource-command.v128',kind:'use',attemptId:request.attemptId,ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,commands:[enriched],useCommandId:raw.command.commandId};
  const accepted=await reduceWildsResourceJournalV128(received,event,{ownerReceizId:OWNER,verifyCard:async()=>{}});
  const replay=await replayWildsResourceJournalOwnerV128(accepted,OWNER,GAMEPLAY,event.commands,async()=>{});
  return {projection:replay.world,events:replay.eventsByCommand[raw.command.commandId]};
 }});
 const current=await freshPlan(n,'creation:received-stale');assert.equal(current.command.resources.length,1);
 const stale={...current,command:{...current.command,context:entry.command.context,planDigest:entry.command.planDigest}};
 await assert.rejects(f.invoke(stale),/materials/);
 const next=await freshPlan(n,'creation:received-valid');const result=await f.invoke(next);
 assert.equal(result.ordinary,undefined);assert.ok(result.projection.creations[next.command.instanceId]);
 assert.deepEqual(f.order,['classify','classify','observe','recover','use']);await result.beforeApply();await result.afterAdmit();
});

test('publication dispatch callback runs once and never during verified rejection',async()=>{
 let dispatches=0;const f=await campaign(nativeBoundary()),e=edge();
 await e.apply(await f.invoke(ordinaryEntry,async()=>{dispatches++;if(dispatches>1)throw Error('crew_dispatch_repeated');}));assert.equal(dispatches,1);
 const rejected=await campaign(nativeBoundary(state));await assert.rejects(rejected.invoke(entry,async()=>{dispatches++;}),/materials/);assert.equal(dispatches,1);
});
test('logout during async capture prevents acknowledgement or later adoption after scoped visible application',async()=>{
 const f=await campaign(nativeBoundary()),admitted=await f.invoke(ordinaryEntry);let writes=0,visible=0;
 await assert.rejects(persistWildsOrdinaryMaterialAdmission({admission:admitted,restore:async()=>{},persist:async()=>{writes++;},capture:async()=>{await f.repository.logout();},apply:projection=>{visible++;return projection;}}),/Explorer changed/);
 assert.equal(writes,1);assert.equal(visible,1);assert.ok(f.database.dump().meta.some(([key])=>String(key).includes('wallet.material-action')));
});

test('construction continuation observes the already persisted and adopted exact building',async()=>{
 const f=await campaign(nativeBoundary()),admitted=await f.invoke(ordinaryEntry);let persisted=false,visible=null;
 await persistWildsOrdinaryMaterialAdmission({admission:admitted,restore:async()=>{},persist:async()=>{persisted=true;},apply:projection=>{assert.equal(persisted,true);visible=projection;return projection;},capture:async()=>{assert.ok(visible?.creations[command.instanceId]);}});
});
test('capture succeeded then ack failed, preview enrichment, fresh retry retains one exact semantic row',async()=>{
 const {queueWildsResourceGameplayV128,resolveWildsResourceGameplayOriginalsV128,readWildsResourceGameplayHistoryV128}=await load('lib/receiz/wilds-resource-gameplay-store-v128');
 const n=nativeBoundary(),f=await campaign(n),database=createMemoryWildzContinuityDatabase();let failAck=true,dispatches=0;
 const capture=async(saved)=>queueWildsResourceGameplayV128({database,ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,command:{kind:'world',command:saved.command,kaiUPulse:saved.command.kai.uPulse}});
 const apply=async(admission)=>persistWildsOrdinaryMaterialAdmission({admission:{...admission,afterAdmit:async()=>{if(failAck){failAck=false;throw Error('ack_failed');}await admission.afterAdmit();}},restore:async()=>{},persist:async()=>{},apply:projection=>projection,capture});
 await assert.rejects(apply(await f.invoke(ordinaryEntry,async()=>{dispatches++;})),/ack_failed/);
 await resolveWildsResourceGameplayOriginalsV128({database,ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,resolveOriginal:async()=>original});
 const next={...entry,command:{...entry.command,commandId:'creation:retry-after-capture'}};
 const recovered=await f.mount()(next,async()=>{dispatches++;});assert.equal(recovered.entry.command.commandId,ordinaryEntry.command.commandId);await apply(recovered);
 const history=await readWildsResourceGameplayHistoryV128(database,OWNER,GAMEPLAY);assert.equal(history.commands.length,1);assert.deepEqual(history.commands[0].workerOriginals[card.id],original);assert.equal(dispatches,1);
 await assert.rejects(queueWildsResourceGameplayV128({database,ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,command:{...history.commands[0],kaiUPulse:KAI+1}}),/conflict/);
});

test('actual capture hook never invokes the current construction continuation after scope replacement',async()=>{
 let code=ts.transpileModule(readFileSync(root+'/src/features/play/useWildsResourceGameplayCapture.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/^import .*?;\n/gm,'').replace('export function useWildsResourceGameplayCapture','function useWildsResourceGameplayCapture')
  .replaceAll("import('@/lib/receiz/wildz-active-identity')",'Promise.resolve(databaseModule)').replaceAll("import('@/lib/receiz/wilds-resource-gameplay-store-v128')",'Promise.resolve(queueModule)');
 const refs=[];let cursor=0,release,continuations=0;const cleanups=[];
 const waiting=new Promise(resolve=>{release=resolve;});
 const useRef=value=>refs[cursor++]??(refs[cursor-1]={current:value});
 const {isWildsResourceGameplayWorldCommandV128}=await load('lib/receiz/wilds-resource-gameplay-v128');
 const hook=new Function('useRef','useEffect','useCallback','isWildsResourceGameplayWorldCommandV128','sameWildsResourceCaptureBinding','databaseModule','queueModule',code+';return useWildsResourceGameplayCapture;')(useRef,(effect,deps)=>{if(deps?.length===0){const cleanup=effect();if(cleanup)cleanups.push(cleanup);}},fn=>fn,isWildsResourceGameplayWorldCommandV128,(a,b)=>a.ownerHandle===b.ownerHandle&&a.gameplayOwnerId===b.gameplayOwnerId,{defaultContinuityDatabase:{}},{queueWildsResourceGameplayV128:async()=>waiting});
 const input={enabled:true,ownerHandle:OWNER,gameplayOwnerId:GAMEPLAY,state:{},captureScope:'key:incarnation:one',onConstructionCaptured:async()=>{continuations++;}};
 const first=hook(input),pending=first.captureWorld(ordinaryEntry);cursor=0;hook({...input,captureScope:'key:incarnation:two'});release();await pending;assert.equal(continuations,0);
 cursor=0;const fresh=hook({...input,captureScope:'key:incarnation:two'});await fresh.captureWorld(ordinaryEntry);assert.equal(continuations,1);
 const abandoned=fresh.captureWorld(ordinaryEntry);for(const cleanup of cleanups)cleanup();await abandoned;assert.equal(continuations,1);
});


for(const recoveryMode of ['recover','logout','pose'])test(`real publisher lost reply → fresh crew authorization → Campaign saved dispatch: ${recoveryMode}`,async()=>{
 const {crewDeliveryFixture}=await import(root+'/.test-build/tests/support/crew-delivery-fixture.js');
 const {publisherFixture}=await import(root+'/.test-build/tests/support/crew-publisher-fixture.js');
 const {prepareWildsCrewDelivery,createWildsCrewDelivery}=await load('features/play/wilds-crew-delivery');
 const {createWildsCrewJournal}=await load('features/play/wilds-crew-journal');
 const {createWildsResourceSourceClientV128,createWildsResourceSourceRecoveryStoreV128}=await load('lib/receiz/wilds-resource-source-client-v128');
 const crew=await crewDeliveryFixture(GAMEPLAY),prepared=await prepareWildsCrewDelivery(crew.request),p=await publisherFixture();
 const saved={schema:'receiz.wilds_world_outbox_entry.v1',actorId:GAMEPLAY,guestId:'crew',command:prepared.source.command,card:prepared.card,queuedAt:'2026-10-10T00:00:00.000Z'};
 await p.create().publish({attemptId:'crew:route',page:p.page});
 const retained=await p.store.read(OWNER,'crew:route');assert.ok(retained);await p.store.retainSource(retained,original);
 let publishes=0,nativeAccepts=0,fences=0,visibleWrites=0,captures=0,pulse=1000000,admitted=null,recovering=false;
 const sdk={sources:{publishSealedSourceV124:async()=>{publishes++;if(!nativeAccepts)nativeAccepts++;if(publishes===1)throw Error('accepted before lost reply/export/locator');return {artifactSha256:original.artifactSha256,sourceKind:'replay-segment',status:'published'};}}};
 const sourceProjection=createWildsWorldEdgeAdmissionQueue({initialProjection:crew.request.projection,persist:async()=>{}});
 const boundary={operation:{admitMaterialCommand:async(request,beforeCommit)=>{
  assert.deepEqual(request.command.command,saved.command);
  const client=createWildsResourceSourceClientV128({sdk,authority:p.authority,session:p.session,recoveryStore:createWildsResourceSourceRecoveryStoreV128(p.storage)});
  const receipt=await client.publish({attemptId:'crew:route',page:p.page,beforeCommit:async()=>{fences++;await beforeCommit();}});
  if(receipt.status!=='published')throw Error(receipt.message);
  const projection=await sourceProjection.admit(saved);
  return {kind:'ordinary',command:request.command,projection,events:[]};
 }}};
 const f=await campaign(boundary);
 const make=()=>createWildsCrewDelivery({journal:createWildsCrewJournal('sdk-owner',crew.db),observeKaiUPulse:()=>pulse++,lookup:async()=>admitted,
  authorizeCapability:async request=>({ok:true,commandDigest:request.commandDigest,workerSubjectId:request.source.workerSubjectId,workerHead:request.source.workerHead,cardProofDigest:request.source.cardProofDigest,capability:'haul',maximumMaterialLots:6}),
  authorize:async request=>{if(recovering&&recoveryMode==='logout')await f.repository.logout();if(recovering&&recoveryMode==='pose')throw Error('live_worker_pose_unavailable');return {ok:true,mandateDigest:request.source.mandateDigest,ownerHead:request.source.ownerHead,workerHead:request.source.workerHead,worldId:request.source.worldId,regionId:request.authorizationCommand.regionId,commandDigest:request.commandDigest};},
  admit:async(command,card,beforeAdmit)=>f.invoke({...saved,command,card},beforeAdmit)});
 assert.equal((await make().execute(prepared,null)).ok,false);assert.equal(fences,1);assert.equal(nativeAccepts,1);assert.equal(visibleWrites,0);
 recovering=true;const fresh=make(),retry={...saved,command:{...saved.command,commandId:'crew:NEW-retry'}};
 if(recoveryMode!=='recover'){
  await assert.rejects(f.mount()(retry,fresh.authorizePending),/Explorer changed|live_worker_pose_unavailable/);
  assert.equal(publishes,1);assert.equal(fences,2);assert.equal(visibleWrites,0);assert.equal(captures,0);
  assert.equal((await crew.journal.command(prepared.commandDigest)).phase,'pending');
  assert.deepEqual((await p.store.read(OWNER,'crew:route')).sourceArtifact,original);return;
 }
 const admission=await f.mount()(retry,fresh.authorizePending);
 assert.deepEqual(admission.entry.command,saved.command);assert.equal(fences,2);assert.equal(publishes,2);assert.equal(nativeAccepts,1);
 await persistWildsOrdinaryMaterialAdmission({admission,persist:async()=>{visibleWrites++;},restore:async()=>{},capture:async()=>{captures++;},apply:projection=>{admitted=projection;return projection;}});
 assert.equal((await fresh.recover(prepared.commandDigest)).ok,true);assert.equal((await fresh.recover(prepared.commandDigest)).ok,true);
 assert.equal(visibleWrites,1);assert.equal(captures,1);assert.equal(admitted.reservedMaterialLots[prepared.lotIds[0]],prepared.source.command.siteId);
 assert.deepEqual((await crew.journal.history(prepared.workerId)).events.map(event=>event.phase),['admitted','pending','proposed']);
 assert.equal((await f.store().prepareMaterial(retry)).command.commandId,'crew:NEW-retry');
 assert.deepEqual((await p.store.read(OWNER,'crew:route')).sourceArtifact,original);
});

for(const handoffKind of ['ordinary','source'])for(const revocation of ['none','capability','mandate','recall','scope','async-scope','async-recall'])test(`accepted native recovery authorizes BEFORE actual ${handoffKind} handoff: ${revocation}`,async()=>{
 const {crewDeliveryFixture}=await import(root+'/.test-build/tests/support/crew-delivery-fixture.js');
 const {prepareWildsCrewDelivery,createWildsCrewDelivery}=await load('features/play/wilds-crew-delivery');
 const {createWildsCrewJournal}=await load('features/play/wilds-crew-journal');
 const {prepareWildsWorldOutboxEntry}=await load('features/play/wilds-world-outbox');
 const {replayWildsWorld}=await load('features/play/wilds-world-state');
 const crew=await crewDeliveryFixture(GAMEPLAY),prepared=await prepareWildsCrewDelivery(crew.request);
 const saved={schema:'receiz.wilds_world_outbox_entry.v1',actorId:GAMEPLAY,guestId:'crew',command:prepared.source.command,card:prepared.card,queuedAt:'2026-10-10T00:00:00.000Z'};
 const accepted=prepareWildsWorldOutboxEntry(crew.request.projection,saved);
 assert.ok(accepted.events.length);assert.deepEqual(replayWildsWorld(accepted.events,checkpointWildsWorld(crew.request.projection)),accepted.projection);
 let recovering=false,revoked=false,pulse=1000000,writes=0,adoptions=0,captures=0,acks=0,visible=null;
 const order=[];
 const boundary={operation:{admitMaterialCommand:async(request,beforeCommit)=>{
  assert.deepEqual(request.command.command,saved.command);
  if(!recovering){await beforeCommit();throw Error('native_accepted_reply_lost');}
  revoked=true;order.push('native-accepted');
  if(revocation==='recall')await crew.jobs.transition({jobId:prepared.jobId,expectedHead:prepared.expectedJobHead,requestId:'recalled',observedKaiUPulse:1000001,action:{type:'recall'}});
  if(revocation==='scope')await f.repository.logout();
  return handoffKind==='source'?{kind:'source',memberIds:prepared.lotIds}:{kind:'ordinary',command:request.command,projection:accepted.projection,events:accepted.events};
 }}};
 const f=await campaign(boundary,handoffKind==='source'?{recovered:{projection:accepted.projection,events:accepted.events}}:{});
 const worldHook=readFileSync(root+'/src/features/play/use-wilds-world.ts','utf8');
 const handoffCode=ts.transpileModule('async function applyHandoff(sourceAdmitted,entry,crewAdmission){'+worldHook.slice(worldHook.indexOf('    if (sourceAdmitted && "ordinary" in sourceAdmitted) {'),worldHook.indexOf('    if (isWildsEdgeImmediateConstructionCommand(rootedCommand)) {'))+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const ports={persistWildsOrdinaryMaterialAdmission,persistWildsWorldCommand:async candidate=>{assert.deepEqual(candidate.command,saved.command);order.push('persist');writes++;},restoreSession:async()=>{},
  adoptApplicationResourceWorld:projection=>{order.push('adopt');adoptions++;visible=projection;return projection;},commandListener:{current:async()=>{order.push('capture');captures++;}},groveCaptureMandates:{current:new Map()},setError:()=>{}};
 const applyHandoff=new Function(...Object.keys(ports),handoffCode+';return applyHandoff;')(...Object.values(ports));
 const make=()=>createWildsCrewDelivery({journal:createWildsCrewJournal('sdk-owner',crew.db),observeKaiUPulse:()=>pulse++,lookup:async()=>visible,
  authorizeCapability:async request=>{order.push('capability');return revoked&&revocation==='capability'?{ok:false}:{ok:true,commandDigest:request.commandDigest,workerSubjectId:request.source.workerSubjectId,workerHead:request.source.workerHead,cardProofDigest:request.source.cardProofDigest,capability:'haul',maximumMaterialLots:6};},
  authorize:async request=>{order.push('mandate');if(revoked&&revocation==='async-scope')await f.repository.logout();if(revoked&&revocation==='async-recall')await crew.jobs.transition({jobId:prepared.jobId,expectedHead:prepared.expectedJobHead,requestId:'async-recall',observedKaiUPulse:1000001,action:{type:'recall'}});return revoked&&revocation==='mandate'?{ok:false}:{ok:true,mandateDigest:request.source.mandateDigest,ownerHead:request.source.ownerHead,workerHead:request.source.workerHead,worldId:request.source.worldId,regionId:request.authorizationCommand.regionId,commandDigest:request.commandDigest};},
  admit:async(command,card,beforeAdmit)=>{
   const handoff=await f.invoke({...saved,command,card},beforeAdmit),after=handoff.afterAdmit;
   return {projection:await applyHandoff({...handoff,afterAdmit:async()=>{acks++;await after();}},saved)};
  }});
 assert.equal((await make().execute(prepared,null)).ok,false);assert.equal(writes,0);order.length=0;
 recovering=true;const fresh=make(),outcome=await fresh.recover(prepared.commandDigest,saved);
 const succeeds=revocation==='none';assert.equal(outcome.ok,succeeds);
 assert.equal(writes,succeeds&&handoffKind==='ordinary'?1:0);assert.equal(adoptions,succeeds?1:0);assert.equal(captures,succeeds?1:0);assert.equal(acks,succeeds?1:0);
 if(succeeds){assert.ok(order.indexOf('mandate')<order.indexOf('adopt'));if(handoffKind==='ordinary')assert.ok(order.indexOf('mandate')<order.indexOf('persist'));assert.equal((await fresh.recover(prepared.commandDigest)).ok,true);assert.equal(writes,handoffKind==='ordinary'?1:0);}
 else assert.equal((await crew.journal.command(prepared.commandDigest)).phase,'pending');
});


test('ordinary admittedSource handoff checks late recovery authorization before durable writes',async()=>{
 const n=nativeBoundary(),f=await campaign(n),e=edge();let checks=0;
 const callback=Object.assign(async()=>{}, {beforeApply:async()=>{checks++;throw Error('exact_pending_authority_revoked');}});
 const handoff=await f.invoke(ordinaryEntry,callback);
 assert.ok(handoff.entry.admittedSource);assert.ok(verifyWildsWorldAdmittedSource(handoff.entry).creations[ordinaryEntry.command.instanceId]);
 await assert.rejects(e.apply(handoff),/exact_pending_authority_revoked/);assert.equal(checks,1);assert.deepEqual(e.counts(),{writes:0,captures:0});
 assert.equal(e.queue.current().creations[ordinaryEntry.command.instanceId],undefined);
 assert.equal((await f.store().prepareMaterial({...ordinaryEntry,command:{...ordinaryEntry.command,commandId:'retry:new'}})).command.commandId,ordinaryEntry.command.commandId);
});

test('accepted source without an initial crew dispatch cannot manufacture one during local handoff',async()=>{
 const {crewDeliveryFixture}=await import(root+'/.test-build/tests/support/crew-delivery-fixture.js');
 const {prepareWildsCrewDelivery,createWildsCrewDelivery}=await load('features/play/wilds-crew-delivery');
 const {prepareWildsWorldOutboxEntry}=await load('features/play/wilds-world-outbox');
 const crew=await crewDeliveryFixture(GAMEPLAY),prepared=await prepareWildsCrewDelivery(crew.request);
 const saved={schema:'receiz.wilds_world_outbox_entry.v1',actorId:GAMEPLAY,guestId:'crew',command:prepared.source.command,card:prepared.card,queuedAt:'2026-10-10T00:00:00.000Z'},accepted=prepareWildsWorldOutboxEntry(crew.request.projection,saved);
 let writes=0,adopts=0,captures=0,acks=0;
 const f=await campaign({operation:{admitMaterialCommand:async request=>({kind:'ordinary',command:request.command,projection:accepted.projection,events:accepted.events})}});
 const runtime=createWildsCrewDelivery({journal:crew.journal,observeKaiUPulse:()=>1000000,lookup:async()=>null,
  authorizeCapability:async request=>({ok:true,commandDigest:request.commandDigest,workerSubjectId:request.source.workerSubjectId,workerHead:request.source.workerHead,cardProofDigest:request.source.cardProofDigest,capability:'haul',maximumMaterialLots:6}),
  authorize:async request=>({ok:true,mandateDigest:request.source.mandateDigest,ownerHead:request.source.ownerHead,workerHead:request.source.workerHead,worldId:request.source.worldId,regionId:request.authorizationCommand.regionId,commandDigest:request.commandDigest}),
  admit:async(command,card,callback)=>{
   const handoff=await f.invoke({...saved,command,card},callback);
   return {projection:await persistWildsOrdinaryMaterialAdmission({admission:{...handoff,afterAdmit:async()=>{acks++;}},persist:async()=>{writes++;},restore:async()=>{},apply:projection=>{adopts++;return projection;},capture:async()=>{captures++;}})};
  }});
 assert.equal((await runtime.execute(prepared,null)).ok,false);assert.deepEqual({writes,adopts,captures,acks},{writes:0,adopts:0,captures:0,acks:0});
 assert.equal((await crew.journal.history(prepared.workerId)).events.filter(event=>event.phase==='pending').length,0);
});

test('same-genesis Alice→Bob→Alice uses the actual source preview, Campaign route, and exact native use reducer',async()=>{
 let returned=await reduceWildsResourceJournalV128(state,{schema:'wildz.resource-command.v128',kind:'reserve',attemptId:'return:campaign:alice',ownerReceizId:bob.ownerReceizId,gameplayOwnerId:'bob',commands:[],createdKaiUPulse:KAI+3000001,memberIds:[lot.lotId],recipientHandle:'alice'},{ownerReceizId:bob.ownerReceizId});
 const pkg=Object.values(returned.packages).find(row=>row.recipientHandle==='alice').package.packageId;
 const receive={schema:'wildz.resource-command.v128',kind:'claim',attemptId:'return:campaign:claim',ownerReceizId:OWNER,packageId:pkg,artifact:original};
 const admission={ownerReceizId:OWNER,verifyPackage:async()=>({genesisOwnerReceizId:bob.ownerReceizId,artifactSha256:original.artifactSha256})};
 returned=await reduceWildsResourceJournalV128(returned,receive,admission);
 returned=await reduceWildsResourceJournalV128(returned,{...receive,kind:'unpack',attemptId:'return:campaign:unpack',kaiUPulse:KAI+3000002},admission);
 const n=nativeBoundary(returned),f=await campaign(n,{use:async request=>{
  const raw={...request.command,workerOriginals:{[card.id]:original}},event={schema:'wildz.resource-command.v128',kind:'use',attemptId:request.attemptId,ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,commands:[...commands,raw],useCommandId:raw.command.commandId};
  returned=await reduceWildsResourceJournalV128(returned,event,{ownerReceizId:OWNER,verifyCard:async()=>{}});
  const replay=await replayWildsResourceJournalOwnerV128(returned,OWNER,GAMEPLAY,returned.traces[OWNER].commands);
  return {projection:replay.world,events:replay.eventsByCommand[raw.command.commandId]};
 }});
 const next=await freshPlan(n,'creation:returned-valid');assert.equal(next.command.resources.length,1);
 const result=await f.invoke(next);assert.equal(result.ordinary,undefined);assert.ok(result.projection.creations[next.command.instanceId]);
 assert.ok(returned.spentMembers[lot.lotId]);assert.equal(returned.looseMembers[lot.lotId],undefined);
 await result.beforeApply();await result.afterAdmit();
 await assert.rejects(reduceWildsResourceJournalV128(returned,{schema:'wildz.resource-command.v128',kind:'reserve',attemptId:'return:spent:repack',ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,commands:returned.traces[OWNER].commands,createdKaiUPulse:KAI+5000000,memberIds:[lot.lotId],recipientHandle:'bob'},admission),/member_spent|member_source_missing/);
});

test('global placement rejection cancels only an unprepared exact material intent, then adjacent intent succeeds',async()=>{
 const foreignSource=projectWildsResourceRegion(1,0).find(row=>row.kind==='hay');assert.ok(foreignSource);
 const foreignHarvest=planWildsMaterialHarvest({projection:createWildsSourceAuthorityProjection(),source:foreignSource,actorId:'bob',actorPosition:foreignSource.position,kaiUPulse:KAI,commandId:'global:bob:harvest'});
 const foreignHistory=[{kind:'world',command:foreignHarvest,kaiUPulse:KAI}],born=await replayWildsResourceGameplayV128({gameplayOwnerId:'bob',commands:foreignHistory});
 const foreignCard=sealCollectedCard({capturedAt:'2026-10-10T00:00:00.000Z',encounterId:'global-bob',formId:'mintcub-1',ownerReceizId:'bob'}),condition=emptyAdventureCondition(foreignCard.id);
 const {digest:_digest,...basis}=definition,foreignDefinition=createCreationDefinition({...basis,creatorId:'bob'});
 const context={...ordinaryEntry.command.context,sourceHead:creationWorldSourceHead(born.world),techniques:combineCreationTechniques(projectCreationWorkers([foreignCard],{[foreignCard.id]:condition}))};
 const compiled=compileCreation(foreignDefinition,context);assert.equal(compiled.status,'ready');
 const resources=selectCreationResources(Object.values(born.world.materialLots),context.budget,compiled.plan.requiredResources,creationWorldAvailability(born.world,'bob'));
 const command={...ordinaryEntry.command,commandId:'global:bob:build',instanceId:'global:bob:building',definition:foreignDefinition,context,planDigest:compiled.plan.digest,workerSources:[{card:foreignCard,condition}],resources:resources.lots};
 const foreign=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),{schema:'wildz.resource-command.v128',kind:'replay',attemptId:'global:bob:paid',ownerReceizId:bob.ownerReceizId,gameplayOwnerId:'bob',commands:[...foreignHistory,{kind:'world',command,kaiUPulse:KAI+4000000,workerOriginals:{[foreignCard.id]:original}}]},{ownerReceizId:bob.ownerReceizId,verifyCard:async()=>{}});
 const n=nativeBoundary(foreign),f=await campaign(n),blocked=await freshPlan(n,'global:alice:blocked');
 await assert.rejects(f.invoke(blocked),/materials/);assert.equal(n.counts().calls,0);
 const next=await freshPlan(n,'global:alice:adjacent'),context2={...next.command.context,pose:{...next.command.context.pose,position:{...next.command.context.pose.position,x:next.command.context.pose.position.x+10}}};
 const plan=compileCreation(next.command.definition,context2);assert.equal(plan.status,'ready');
 const adjacent={...next,command:{...next.command,context:context2,planDigest:plan.plan.digest,actorPosition:context2.pose.position}};
 const admitted=await f.invoke(adjacent),local=edge();await local.apply(admitted);
 assert.equal(local.counts().writes,1);assert.equal(n.counts().calls,1);
 assert.equal(Object.keys(foreign.traces).length,1,'rejected candidate never changes native predecessor');
});
