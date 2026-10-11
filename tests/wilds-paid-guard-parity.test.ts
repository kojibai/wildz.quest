import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as journal from '../src/lib/receiz/wilds-resource-journal-v128';
import * as clearance from '../src/lib/receiz/wilds-clearance-admission-v128';
import {wildsResourceSourceNamespaceV128} from '../src/lib/receiz/wilds-resource-exchange-v128';
import {canonicalPortableCardJson} from '../src/features/play/portable-card';
import {paidClearanceTrace} from './support/clearance-source-fixture';
import {previewWildsContinuousBuild} from '../src/features/play/wilds-continuous-builder';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
import {admitWildsDiscoveryPhysicalNeighborhood} from '../src/features/play/wilds-discovery-sites';
import {compileCreation} from '../src/features/play/creation/compiler';
import type {WildsResourceGameplayCommandV128} from '../src/lib/receiz/wilds-resource-gameplay-v128';
const source=readFileSync('src/lib/receiz/wilds-resource-exchange-v128.ts','utf8');
const code=ts.transpileModule(source.slice(source.indexOf(' async function append('),source.indexOf(' async function readUseOutcome(')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const event=(owner:string,commands:readonly WildsResourceGameplayCommandV128[],id:string):journal.WildsResourceJournalEventV128=>({schema:'wildz.resource-command.v128',kind:'replay',attemptId:id,ownerReceizId:owner+'.receiz.id',gameplayOwnerId:owner,commands});
// Actual common append, with only SDK currentness/publication/export controlled.
// Its successful return must retain the accepted event and publish the locator.
async function publish(before:journal.WildsResourceJournalV128,proposal:journal.WildsResourceJournalEventV128){
 let publications=0,locators=0,accepted=before;const proof={custodyArtifact:{artifactSha256:'before'}},prior={state:before,events:[],predecessor:{head:{head:'1'.repeat(64)}}},head='2'.repeat(64),encode=(value:unknown)=>Buffer.from(typeof value==='string'?value:canonicalPortableCardJson(value)).toString('base64url');
 const deps={...journal,...clearance,wildsResourceSourceNamespaceV128,owner:proposal.ownerReceizId,key:(id:string)=>id,applicationId:'wildz',encoded:(v:string)=>v,receizBase64UrlEncode:encode,canonicalPortableCardJson,same:(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b),fail:(r:string)=>{throw Error(r);},verifyWildsResourceGameplayCardV128:async()=>{},verifyWildsResourceSourceProofV128:async()=>prior,portableFor:()=>({}),replayInput:()=>({}),assertWildsResourceSourceRequestCapacityV128:async()=>{},transportReceizSealedArtifactV124:async(v:unknown)=>v,
  readWildsSourceReplayAfterV128:async()=>({head,namespace:{exactBytesB64u:encode(journal.WILDS_RESOURCE_LAW_V128)}}),current:async(p:unknown)=>p===proof?prior:{state:accepted,events:[{event:proposal}],predecessor:{head:{head}}},
  input:{database:createMemoryWildzContinuityDatabase(),authority:{keyFile:{keyId:'fixture'}},locator:{read:async()=>proof,publish:async()=>{locators++;}},sdk:{domains:{exportVerifiedReplayProofObjectV124:async()=>({proofObject:{payload:{bytes:new Uint8Array()}}})},assets:{createProofObject:async()=>({artifactSha256:'after'})}}},
  publisher:{publish:async({page}:{page:{event:journal.WildsResourceJournalEventV128;predecessor:typeof prior.predecessor}})=>{publications++;assert.equal(page.predecessor.head.head,prior.predecessor.head.head);accepted=await journal.reduceWildsResourceJournalV128(before,page.event,{ownerReceizId:proposal.ownerReceizId,verifyCard:async()=>{}});return {status:'published',preparation:{replay:{head}},sourceArtifact:{artifactSha256:'source'}};}}};
 const append=new Function(...Object.keys(deps),code+'return append;')(...Object.values(deps));
 try{const result=await append(proposal);assert.deepEqual(result.state,accepted);assert.equal(publications,1);assert.equal(locators,1);return accepted;}catch(cause){assert.equal(publications,0,'rejection must precede native publisher');assert.equal(locators,0);throw cause;}
}
const corner=(async()=>{
 const f=await paidClearanceTrace({foundation:true,stoneHarvests:4}),commands=[...f.commands];let world=f.replay.world,tick=f.kaiUPulse+1;
 const foundation=world.constructionComponents[f.buildingId],p=foundation.transform.position;
 const request=(x:number,z:number,r:number)=>({pointer:{x,y:foundation.anchors[0].position.y,z},rotationQuarterTurns:r,heightStep:0,surfaceSnap:true,snapVersion:2 as const,landscapeRule:'wildz.build-ground.v2' as const});
 const append=async(command:Extract<WildsResourceGameplayCommandV128,{kind:'world'}>['command'])=>{commands.push({kind:'world',command,kaiUPulse:tick++});world=(await journal.replayWildsResourceJournalOwnerV128(journal.initialWildsResourceJournalV128(),'explorer.receiz.id','explorer',commands,async()=>{})).world;};
 const first=request(p.x,p.z+3,0),preview=previewWildsContinuousBuild(world,'explorer','wall',first);assert.equal(preview.placement.valid,true,preview.placement.cues.join(','));
 await append({type:'construction.component.place',projectId:foundation.projectId,placement:preview.placement,request:first,actorPosition:first.pointer,commandId:'parity:first'});
 const wall=Object.values(world.constructionComponents).find(c=>c.kind==='wall')!;
 for(const kind of ['timber','stone'] as const)for(const lot of Object.values(world.materialLots).filter(l=>l.kind===kind&&!world.consumedMaterialLots[l.lotId]&&!world.reservedMaterialLots[l.lotId]).slice(0,wall.recipe.stages[0].materials[kind]))await append({type:'construction.component.deposit',componentId:wall.componentId,componentHead:wall.head,lotIds:[lot.lotId],actorPosition:first.pointer,commandId:'parity:first:'+lot.lotId});
 await append({type:'construction.component.work',componentId:wall.componentId,componentHead:wall.head,actorPosition:first.pointer,commandId:'parity:first:work'});
 const beforeEvent=event('explorer',[...commands],'parity:before'),before=await journal.reduceWildsResourceJournalV128(journal.initialWildsResourceJournalV128(),beforeEvent,{ownerReceizId:beforeEvent.ownerReceizId,verifyCard:async()=>{}});
 const next=request(p.x+3,p.z,1),v=previewWildsContinuousBuild(world,'explorer','wall',next);assert.equal(v.placement.valid,true,v.placement.cues.join(','));
 await append({type:'construction.component.place',projectId:foundation.projectId,placement:v.placement,request:next,actorPosition:next.pointer,commandId:'parity:corner'});
 const placed=event('explorer',[...commands],'parity:corner:publish'),piece=Object.values(world.constructionComponents).find(c=>c.commandId==='parity:corner')!;
 const continuations:journal.WildsResourceJournalEventV128[]=[];
 for(const kind of ['timber','stone'] as const)for(const lot of Object.values(world.materialLots).filter(l=>l.kind===kind&&!world.consumedMaterialLots[l.lotId]&&!world.reservedMaterialLots[l.lotId]).slice(0,piece.recipe.stages[0].materials[kind])){await append({type:'construction.component.deposit',componentId:piece.componentId,componentHead:piece.head,lotIds:[lot.lotId],actorPosition:next.pointer,commandId:'parity:corner:'+lot.lotId});continuations.push(event('explorer',[...commands],'parity:continue:'+continuations.length));}
 await append({type:'construction.component.work',componentId:piece.componentId,componentHead:piece.head,actorPosition:next.pointer,commandId:'parity:corner:work'});continuations.push(event('explorer',[...commands],'parity:work'));
 return {before,placed,continuations,point:p};
})();
test('actual common append publishes lawful snapped corner and subsequent material/work',async()=>{const f=await corner;let state=await publish(f.before,f.placed);for(const e of f.continuations)state=await publish(state,e);assert.equal(state.traces['explorer.receiz.id'].commands.at(-1)?.kind,'world');});

test('actual common append scopes foreign creation geometry to its admitted space',async()=>{
 const floor=admitWildsDiscoveryPhysicalNeighborhood(0,0).surfaces.find(s=>s.spaceId!=='wildz.space.outer.v1'&&s.halfExtents.x>2&&s.halfExtents.z>2)!;assert.ok(floor);
 const f=await paidClearanceTrace({owner:'neighbor',sourceOffset:15}),last=f.commands.at(-1)!;assert.ok(last.kind==='world'&&last.command.type==='creation.construct');if(last.kind!=='world'||last.command.type!=='creation.construct')throw Error('fixture');
 const context={...last.command.context,spaceId:floor.spaceId,pose:{...last.command.context.pose,position:{...floor.center}},physical:[]},compiled=compileCreation(last.command.definition,context);assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error('fixture');
 const indoor=event('neighbor',[...f.commands.slice(0,-1),{...last,command:{...last.command,context,planDigest:compiled.plan.digest,actorPosition:context.pose.position}}],'parity:indoor');
 const before=await journal.reduceWildsResourceJournalV128(journal.initialWildsResourceJournalV128(),indoor,{ownerReceizId:indoor.ownerReceizId,verifyCard:async()=>{}});
 const outdoor=await paidClearanceTrace({point:{...floor.center}});await publish(before,event('explorer',outdoor.commands,'parity:outdoor'));
});


test('actual common append never grants owned thin-corner contact to a foreign owner',async()=>{
 const f=await corner,g=await paidClearanceTrace({owner:'neighbor',sourceOffset:20,stoneSourceOffset:5,foundation:true,point:f.point});
 // Retain independently reduced historical foundations for both owners. Only
 // the new corner is the candidate, so this isolates the thin foreign contact.
 const base=event('neighbor',g.commands,'parity:foreign:foundation'),before=await journal.reduceWildsResourceJournalV128(f.before,base,{ownerReceizId:base.ownerReceizId,verifyCard:async()=>{}});
 const foundation=g.replay.world.constructionComponents[g.buildingId],request={pointer:{x:f.point.x+3,y:foundation.anchors[0].position.y,z:f.point.z},rotationQuarterTurns:1,heightStep:0,surfaceSnap:true,snapVersion:2 as const,landscapeRule:'wildz.build-ground.v2' as const};
 const preview=previewWildsContinuousBuild(g.replay.world,'neighbor','wall',request);assert.equal(preview.placement.valid,true,preview.placement.cues.join(','));
 const candidate=event('neighbor',[...g.commands,{kind:'world',kaiUPulse:g.kaiUPulse+1,command:{type:'construction.component.place',projectId:foundation.projectId,placement:preview.placement,request,actorPosition:request.pointer,commandId:'parity:foreign:corner'}}],'parity:foreign:corner');
 await assert.rejects(publish(before,candidate),/established_structure_overlap/);
});

test('actual common append preserves same-space foreign interior protection',async()=>{
 const floor=admitWildsDiscoveryPhysicalNeighborhood(0,0).surfaces.find(s=>s.spaceId!=='wildz.space.outer.v1'&&s.halfExtents.x>2&&s.halfExtents.z>2)!;
 const build=async(owner:string,sourceOffset:number)=>{const f=await paidClearanceTrace({owner,sourceOffset}),last=f.commands.at(-1)!;if(last.kind!=='world'||last.command.type!=='creation.construct')throw Error('fixture');
  const context={...last.command.context,spaceId:floor.spaceId,pose:{...last.command.context.pose,position:{...floor.center}},physical:[]},compiled=compileCreation(last.command.definition,context);assert.equal(compiled.status,'ready');if(compiled.status!=='ready')throw Error('fixture');
  return event(owner,[...f.commands.slice(0,-1),{...last,command:{...last.command,context,planDigest:compiled.plan.digest,actorPosition:context.pose.position}}],'parity:interior:'+owner);};
 const first=await build('neighbor',15),before=await journal.reduceWildsResourceJournalV128(journal.initialWildsResourceJournalV128(),first,{ownerReceizId:first.ownerReceizId,verifyCard:async()=>{}});
 await assert.rejects(publish(before,await build('explorer',30)),/established_structure_overlap/);
});
