import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalPortableCardJson} from '../src/features/play/portable-card';
import {projectWildsBuildingClearancePiles} from '../src/features/play/wilds-building-clearance';
import {deriveWildsClearanceCommandV128,planWildsClearancePickupV128,admitWildsClearancePickupV128} from '../src/lib/receiz/wilds-clearance-admission-v128';
import {initialWildsResourceJournalV128,reduceWildsResourceJournalV128,replayWildsResourceJournalOwnerV128,type WildsResourceJournalV128,type WildsResourceJournalEventV128} from '../src/lib/receiz/wilds-resource-journal-v128';
import {paidClearanceTrace,clearanceFixtureTree} from './support/clearance-source-fixture';
import {wildsNourishmentPlantById,wildsNourishmentSourceAt} from '../src/features/play/wilds-nourishment';
import {createReceizInMemoryAdmissionStore,type ReceizAdmissionUnitOfWork} from '@receiz/sdk';
import {sha256PortableBasis} from '../src/features/play/portable-card';
import {createWildsSourceAuthorityProjection,planWildsMaterialHarvest} from '../src/features/play/wilds-source-work-authority';
import {projectWildsResourceSourceForObstacle} from '../src/features/play/wilds-resource-authority';
import {createWildsCreatureMandate,evaluateWildsCreatureConsent} from '../src/features/play/wilds-creature-mandate';

// Application semantics only. Originals use an explicit semantic fixture port;
// native root opening is exercised separately by the opt-in qualification script.
const HEAD='1'.repeat(64),verifyCard=async()=>{};
const fixturePromise=paidClearanceTrace();
async function reservedFixture(custom?:Awaited<ReturnType<typeof paidClearanceTrace>>){
 const fixture=custom??await fixturePromise,owner='alice.receiz.id';
 const paid={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'paid:alice',ownerReceizId:owner,gameplayOwnerId:'explorer',commands:fixture.commands} as const;
 const before=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),paid,{ownerReceizId:owner,verifyCard});
 const command=await deriveWildsClearanceCommandV128({state:before,ownerReceizId:owner,gameplayOwnerId:'explorer',commands:fixture.commands,buildingId:fixture.buildingId,buildingHead:fixture.buildingHead,expectedHead:HEAD,kaiUPulse:fixture.kaiUPulse,commandId:'clearance:alice'});
 const event={...paid,attemptId:command.commandId,commands:[...paid.commands,{kind:'world',command,kaiUPulse:fixture.kaiUPulse}]} as const;
 const state=await reduceWildsResourceJournalV128(before,event,{ownerReceizId:owner,expectedNativeHead:HEAD});
 return {fixture,before,command,event,state};
}
function pickup(state:WildsResourceJournalV128,owner:string,pile:ReturnType<typeof projectWildsBuildingClearancePiles>[number],id:string){
 const proposal=planWildsClearancePickupV128({source:{state,predecessor:{head:{head:HEAD}}},clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:HEAD,ownerReceizId:`${owner}.receiz.id`,gameplayOwnerId:owner==='alice'?'explorer':owner,player:pile.position,spaceId:'wildz.space.outer.v1',kaiUPulse:100_000_100,commandId:id});
 const event={schema:'wildz.resource-command.v128',kind:'use',attemptId:id,ownerReceizId:proposal.ownerReceizId,gameplayOwnerId:proposal.gameplayOwnerId,commands:[...(state.traces[proposal.ownerReceizId]?.commands??[]),{kind:'world',command:proposal.command,kaiUPulse:proposal.kaiUPulse}],useCommandId:id} as const;
 return {proposal,event};
}
test('real paid creation reserves exactly once and two explorers take distinct finite ordinary portions',async()=>{
 const {fixture,before,command,event,state}=await reservedFixture();
 assert.equal(before.clearances,undefined);assert.equal(before.retiredSourceIds,undefined);
 assert.equal(canonicalPortableCardJson(event.commands.slice(0,-1)),canonicalPortableCardJson(fixture.commands));
 const clearance=state.clearances![command.payload.clearance.clearanceId];assert.ok(clearance.sources.length);
 for(const source of clearance.sources)assert.equal(state.retiredSourceIds![source.sourceId],clearance.clearanceId);
 const pile=projectWildsBuildingClearancePiles([clearance],{}).find(row=>row.kind==='timber')!;assert.ok(pile);assert.ok(pile.remaining>=2);
 const a=pickup(state,'alice',pile,'pickup:alice:1');
 const afterA=await reduceWildsResourceJournalV128(state,a.event,{ownerReceizId:a.event.ownerReceizId,expectedNativeHead:HEAD});
 const b=pickup(afterA,'bob',pile,'pickup:bob:1');
 const afterB=await reduceWildsResourceJournalV128(afterA,b.event,{ownerReceizId:b.event.ownerReceizId,expectedNativeHead:HEAD});
 const members=Object.values(afterB.looseMembers);assert.equal(members.length,2);assert.notEqual(members[0].member.id,members[1].member.id);
 assert.ok(members.every(row=>row.member.kind==='material'&&row.member.materialLot.quantity===1));
 assert.equal(projectWildsBuildingClearancePiles([clearance],afterB.clearanceTaken??{}).find(row=>row.pileId===pile.pileId)!.remaining,pile.remaining-2);
 await assert.rejects(reduceWildsResourceJournalV128(afterA,pickup(state,'bob',pile,'pickup:bob:race').event,{ownerReceizId:'bob.receiz.id',expectedNativeHead:HEAD}),/pile_stale/);
 assert.deepEqual(await reduceWildsResourceJournalV128(afterB,b.event,{ownerReceizId:'bob.receiz.id',expectedNativeHead:HEAD}),afterB,'exact accepted replay cannot mint twice');
 const replay=await replayWildsResourceJournalOwnerV128(afterB,'alice.receiz.id','explorer',afterB.traces['alice.receiz.id'].commands);
 assert.deepEqual(replay.world.buildingClearances![clearance.clearanceId],clearance);
});
test('caller manifests, changed native heads and original-tree poses never authorize pickup',async()=>{
 const {state,command}=await reservedFixture(await paidClearanceTrace({width:6})),pile=projectWildsBuildingClearancePiles([command.payload.clearance],{})[0],row=pickup(state,'bob',pile,'pickup:bad:one');
 assert.ok(Math.hypot(pile.position.x-clearanceFixtureTree.position.x,pile.position.z-clearanceFixtureTree.position.z)>2.6);
 await reduceWildsResourceJournalV128(state,row.event,{ownerReceizId:'bob.receiz.id',expectedNativeHead:HEAD});
 const cases=[{...row.proposal.command,expectedHead:'2'.repeat(64)},{...row.proposal.command,player:clearanceFixtureTree.position},{...row.proposal.command,priorTaken:1},{...row.proposal.command,clearance:{...row.proposal.command.clearance,buildingHead:`sha256:${'f'.repeat(64)}`}}];
 for(const bad of cases)await assert.rejects(reduceWildsResourceJournalV128(state,{...row.event,commands:[{kind:'world',command:bad,kaiUPulse:row.proposal.kaiUPulse}]} as WildsResourceJournalEventV128,{ownerReceizId:'bob.receiz.id',expectedNativeHead:HEAD}));
 assert.equal(state.clearanceTaken,undefined);assert.deepEqual(state.looseMembers,{});
 await assert.rejects(reduceWildsResourceJournalV128(state,row.event,{ownerReceizId:'bob.receiz.id'}),/native_head_stale/);
});
test('new admission rejects omitted or altered established neighbor geometry and overlapping paid structures',async()=>{
 const {fixture,before}=await reservedFixture();
 const neighbor=await paidClearanceTrace({owner:'neighbor',sourceOffset:15,point:{...clearanceFixtureTree.position,x:clearanceFixtureTree.position.x+12}});
 const event={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'paid:neighbor',ownerReceizId:'neighbor.receiz.id',gameplayOwnerId:'neighbor',commands:neighbor.commands} as const;
 const shared=await reduceWildsResourceJournalV128(before,event,{ownerReceizId:event.ownerReceizId,verifyCard});
 const command=await deriveWildsClearanceCommandV128({state:shared,ownerReceizId:'alice.receiz.id',gameplayOwnerId:'explorer',commands:fixture.commands,buildingId:fixture.buildingId,buildingHead:fixture.buildingHead,expectedHead:HEAD,kaiUPulse:fixture.kaiUPulse,commandId:'clearance:shared'});
 assert.ok(command.payload.historicalContext!.solids.length);assert.ok(command.payload.historicalContext!.terrain.length);
 const admission={ownerReceizId:'alice.receiz.id',expectedNativeHead:HEAD};
 const append=(cmd:typeof command)=>({...event,attemptId:cmd.commandId,ownerReceizId:admission.ownerReceizId,gameplayOwnerId:'explorer',commands:[...fixture.commands,{kind:'world' as const,command:cmd,kaiUPulse:fixture.kaiUPulse}]});
 await reduceWildsResourceJournalV128(shared,append(command),admission);
 for(const context of [{...command.payload.historicalContext!,solids:[]},{...command.payload.historicalContext!,terrain:[]}])await assert.rejects(reduceWildsResourceJournalV128(shared,append({...command,payload:{...command.payload,historicalContext:context}}),admission),/clearance/);
 const overlap=await paidClearanceTrace({owner:'neighbor',sourceOffset:15});
 const overlapping=await reduceWildsResourceJournalV128(before,{...event,commands:overlap.commands},{ownerReceizId:event.ownerReceizId,verifyCard});
 await assert.rejects(deriveWildsClearanceCommandV128({state:overlapping,ownerReceizId:'alice.receiz.id',gameplayOwnerId:'explorer',commands:fixture.commands,buildingId:fixture.buildingId,buildingHead:fixture.buildingHead,expectedHead:HEAD,kaiUPulse:fixture.kaiUPulse,commandId:'clearance:overlap'}),/established_structure_overlap/);
});

test('paid ordinary foundation reaches the same explicit source reservation',async()=>{
 const f=await paidClearanceTrace({foundation:true}),{state,command}=await reservedFixture(f);
 assert.ok(f.replay.world.constructionComponents[command.payload.clearance.buildingId]);
 assert.ok(Object.keys(state.retiredSourceIds??{}).length>0);
});

test('clearance cannot backdate past a globally admitted neighboring food checkpoint',async()=>{
 const {before,fixture,command}=await reservedFixture(),source=command.payload.clearance.sources.find(row=>row.kind==='food')!,plant=wildsNourishmentPlantById(source.sourceId)!;
 const kaiUPulse=fixture.kaiUPulse+10,gather={kind:'food.gather',commandId:'neighbor:future:food',sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,kaiUPulse).head,kaiUPulse,player:plant.position,spaceId:'wildz.space.outer.v1'} as const;
 const shared=await reduceWildsResourceJournalV128(before,{schema:'wildz.resource-command.v128',kind:'replay',attemptId:gather.commandId,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:[gather]},{ownerReceizId:'bob.receiz.id'});
 await assert.rejects(deriveWildsClearanceCommandV128({state:shared,ownerReceizId:'alice.receiz.id',gameplayOwnerId:'explorer',commands:fixture.commands,buildingId:fixture.buildingId,buildingHead:fixture.buildingHead,expectedHead:HEAD,kaiUPulse:fixture.kaiUPulse,commandId:'clearance:backdated'}),/source_time_stale/);
 assert.equal(shared.clearances,undefined);assert.equal(shared.retiredSourceIds,undefined);
});

test('a lawful ordinary timber harvest cannot reach a retired original source at any later or backdated time',async()=>{
 const {state,fixture}=await reservedFixture(),entry=fixture.commands[0];assert.equal(entry.kind,'world');if(entry.kind!=='world')return;
 const source=projectWildsResourceSourceForObstacle(clearanceFixtureTree),card=entry.card!,creatureSubjectId=`creature:${sha256PortableBasis(card.id).slice(0,32)}`,creatureHead=sha256PortableBasis(card.proof.digest);
 for(const kaiUPulse of [100_000_000,200_000_000]){
  const consent=evaluateWildsCreatureConsent({creatureSubjectId,creatureHead,condition:{energy:100,fatigue:0,injury:0,stress:0},bond:100,preferences:{professions:['lumber'],avoidHazards:[]},capabilities:{professions:['lumber']},safety:{risk:0,hazards:[],supportAvailable:true},requested:{professions:['lumber'],maxActions:1},kaiUPulse});
  const mandate=createWildsCreatureMandate({consent,creatureSubjectId,creatureHead,region:{x:Math.floor(source.position.x/128),z:Math.floor(source.position.z/128)},professions:['lumber'],allowedResourceIds:[source.sourceId],maxActions:1,issuedAtKaiUPulse:kaiUPulse,expiresAtKaiUPulse:kaiUPulse+100});
  const command=planWildsMaterialHarvest({projection:createWildsSourceAuthorityProjection(),source,actorId:'bob',actorPosition:source.position,kaiUPulse,commandId:'retired:timber:harvest',card,mandate});
  const event={schema:'wildz.resource-command.v128',kind:'replay',attemptId:`retired:timber:${kaiUPulse}`,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:[{kind:'world',command,kaiUPulse,card,cardOriginal:entry.cardOriginal}]} as const;
  await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),event,{ownerReceizId:'bob.receiz.id',verifyCard});
  await assert.rejects(reduceWildsResourceJournalV128(state,event,{ownerReceizId:'bob.receiz.id',verifyCard}),/source_retired/);
 }
});

test('uncertain native admission returns no inventory and keeps the same recovery identity',async()=>{
 const {state,command}=await reservedFixture(),pile=projectWildsBuildingClearancePiles([command.payload.clearance],{})[0],row=pickup(state,'bob',pile,'pickup:unknown:reply');
 const attempted:string[]=[];
 const result=await admitWildsClearancePickupV128(row.proposal,{async admitClearancePickup(proposal){attempted.push(proposal.command.commandId);throw Error('lost_native_publication_reply');}});
 assert.deepEqual(result,{status:'pending',attemptId:row.proposal.command.commandId,members:[],reason:'lost_native_publication_reply'});
 const stale=await admitWildsClearancePickupV128(row.proposal,{async admitClearancePickup(){throw Error('wilds_clearance_pile_stale');}});
 assert.equal(stale.status,'pending');assert.deepEqual(stale.members,[]);assert.deepEqual(attempted,[row.proposal.command.commandId]);
 const invalid={...row.proposal,command:{...row.proposal.command,player:{x:999999,y:0,z:0}}};
 const rejected=await admitWildsClearancePickupV128(invalid,{async admitClearancePickup(){throw Error('must_not_call_native_port');}});
 assert.equal(rejected.status,'rejected');assert.deepEqual(rejected.members,[]);
});

test('retired food cannot be gathered through backdating or a future regrown crop; picked food is finite and compact',async()=>{
 const {state,command}=await reservedFixture(),pile=projectWildsBuildingClearancePiles([command.payload.clearance],{}).find(row=>row.kind==='food')!;
 const plant=wildsNourishmentPlantById(pile.sourceId)!;
 for(const kaiUPulse of [100_000_000,wildsNourishmentSourceAt(plant,undefined,100_000_000).nextRegrowthKaiUPulse]){
  const gather={kind:'food.gather',commandId:'retired:food:gather',sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,kaiUPulse).head,kaiUPulse,player:plant.position,spaceId:'wildz.space.outer.v1'} as const;
  await assert.rejects(reduceWildsResourceJournalV128(state,{schema:'wildz.resource-command.v128',kind:'replay',attemptId:`retired:food:${kaiUPulse}`,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:[gather]},{ownerReceizId:'bob.receiz.id'}),/source_retired/);
 }
 let current=state;
 for(let index=0;index<pile.remaining;index++){
  const row=pickup(current,index%2?'alice':'bob',pile,`pickup:food:${index}`);
  current=await reduceWildsResourceJournalV128(current,row.event,{ownerReceizId:row.event.ownerReceizId,expectedNativeHead:HEAD});
 }
 assert.throws(()=>pickup(current,'bob',pile,'pickup:food:empty'),/pile_empty/);
 assert.equal(Object.values(current.looseMembers).filter(row=>row.member.kind==='food').length,pile.remaining);
 const bob=current.traces['bob.receiz.id'],food=Object.values(current.looseMembers).find(row=>row.ownerReceizId==='bob.receiz.id')!.member;
 assert.equal(food.kind,'food');assert.ok(canonicalPortableCardJson(food).length<2500);
 const consume={kind:'food.consume',commandId:'consume:clearance:food',itemId:food.id,kaiUPulse:100_000_200,reserveMicroBreaths:0} as const;
 const consumed=await reduceWildsResourceJournalV128(current,{schema:'wildz.resource-command.v128',kind:'use',attemptId:consume.commandId,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:[...bob.commands,consume],useCommandId:consume.commandId},{ownerReceizId:'bob.receiz.id',expectedNativeHead:HEAD});
 assert.ok(consumed.spentMembers[food.id]);assert.equal(consumed.looseMembers[food.id],undefined);
 const alice=consumed.traces['alice.receiz.id'],member=Object.values(consumed.looseMembers).find(row=>row.ownerReceizId==='alice.receiz.id')!.member;
 const reserved=await reduceWildsResourceJournalV128(consumed,{schema:'wildz.resource-command.v128',kind:'reserve',attemptId:'send:clearance:food',ownerReceizId:'alice.receiz.id',gameplayOwnerId:'explorer',commands:alice.commands,createdKaiUPulse:100_000_300,memberIds:[member.id],recipientHandle:'charlie'},{ownerReceizId:'alice.receiz.id'});
 assert.equal(reserved.looseMembers[member.id],undefined);assert.ok(reserved.reservations[member.id]);
 assert.equal(Object.keys(reserved.spentMembers).length+Object.keys(reserved.looseMembers).length+Object.values(reserved.packages).flatMap(row=>row.package.members).length,pile.remaining);
});

test('released SDK coordination store serializes actual competing final-pile commands without minting two units',async()=>{
 const {state,command}=await reservedFixture(),pile=projectWildsBuildingClearancePiles([command.payload.clearance],{}).find(row=>row.kind==='food')!;
 let before=state;
 for(let index=0;index<pile.remaining-1;index++){const row=pickup(before,'alice',pile,`last:drain:${index}`);before=await reduceWildsResourceJournalV128(before,row.event,{ownerReceizId:row.event.ownerReceizId,expectedNativeHead:HEAD});}
 const a=pickup(before,'alice',pile,'last:alice:pick'),b=pickup(before,'bob',pile,'last:bob:pick');
 const states=await Promise.all([a,b].map(row=>reduceWildsResourceJournalV128(before,row.event,{ownerReceizId:row.event.ownerReceizId,expectedNativeHead:HEAD})));
 const store=createReceizInMemoryAdmissionStore();
 const units=[a,b].map((row,index):ReceizAdmissionUnitOfWork=>{const digest=sha256PortableBasis(canonicalPortableCardJson(row.event));return {schema:'receiz.admission.unit-of-work.v1',aggregateId:'clearance-semantic-coordination-fixture',commandDigest:digest,idempotencyKey:row.event.attemptId,expectedRevision:0,expectedHeadDigest:null,acceptedCommand:JSON.parse(canonicalPortableCardJson(row.event)),events:[{eventDigest:digest}],nextHead:{revision:1,digest:sha256PortableBasis(canonicalPortableCardJson(states[index])),state:JSON.parse(canonicalPortableCardJson(states[index]))},resourceEffects:{},receipt:{eventDigest:digest},outboxIntents:[],auditReference:{eventDigest:digest}};});
 const result=await Promise.all(units.map(unit=>store.commit(unit)));assert.deepEqual(result.map(row=>row.status).sort(),['committed','conflict']);
 const winner=result.findIndex(row=>row.status==='committed'),ledger=await store.inspect();
 assert.equal((await store.commit(units[winner])).status,'idempotent');assert.deepEqual(await store.inspect(),ledger);
 assert.equal(projectWildsBuildingClearancePiles([command.payload.clearance],states[winner].clearanceTaken??{}).some(row=>row.pileId===pile.pileId),false);
 assert.equal(ledger.acceptedCommands.length,1);assert.equal(ledger.events.length,1);assert.equal(ledger.receipts.length,1);
});
