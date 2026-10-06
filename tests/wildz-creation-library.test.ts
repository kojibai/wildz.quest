import assert from 'node:assert/strict';
import {test} from 'node:test';
import {receizBase64UrlEncode} from '@receiz/sdk';
import {createWildzCreationLibrary} from '../src/lib/receiz/wildz-creation-library';
import {createWildzCreationArtifactReader} from '../src/lib/receiz/wildz-creation-artifact';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
import {creationOperationContextFixture} from './support/creation-operation-fixtures';
import {compileCreation} from '../src/features/play/creation/compiler';
import {prepareCreationOperation} from '../src/features/play/creation/operation';
import {emptyCreationState} from '../src/features/play/creation/state';
import {exportCreationPersistence} from '../src/features/play/creation/persistence';
import {embedCreationImage,type CreationImagePayload} from '../src/features/play/creation/image';
import {sealCreationInstance} from '../src/features/play/creation/instance';
import {sha256WildzArtifactBytes} from '../src/lib/receiz/wildz-artifact-custody';
const pixels=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
const scope={keyId:'test-device-key',actorId:'owner'};
function payload():CreationImagePayload{
 const c=creationOperationContextFixture(),compiled=compileCreation(c.definition,c.compileContext);
 if(compiled.status!=='ready')throw Error('fixture');
 const op=prepareCreationOperation(compiled.plan,c);
 return {schema:'wildz.creation-image.v1',instanceId:op.instanceId,assetBytes:{},checkpoint:exportCreationPersistence({...emptyCreationState(),definitions:{[c.definition.digest]:c.definition},instances:{[op.instanceId]:op.command.instance},resources:Object.fromEntries(op.command.resourceSuccessors.map(r=>[r.id,r])),custody:{[op.instanceId]:'owner',...Object.fromEntries(op.resources.map(r=>[r.id,'owner']))}})};
}
async function fixture(){
 const database=createMemoryWildzContinuityDatabase();
 const images=new Map<string,{payload:CreationImagePayload;owner:string|null;predecessors:string[]}>(),retained=new Map<string,{bytes:Uint8Array;predecessors:string[]}>();let retains=0,opens=0;
 const reader=createWildzCreationArtifactReader(async input=>{opens++;const row=images.get(new TextDecoder().decode(input.bytes));if(!row)throw Error('canonical_test_source_invalid');return {payloadBytes:embedCreationImage(pixels,row.payload),ownerReceizId:row.owner,compatibility:row.owner?'current-native' as const:'verified-document' as const};});
 const sources={async retain(input:{bytes:Uint8Array;filename:string;mimeType:string;assetId?:string}){retains++;const sha=await sha256WildzArtifactBytes(input.bytes),row=images.get(new TextDecoder().decode(input.bytes))!;retained.set(sha,{bytes:input.bytes.slice(),predecessors:row.predecessors});return {schema:'receiz.sealed-artifact-bytes.v124' as const,exactBytesB64u:receizBase64UrlEncode(input.bytes),filename:input.filename,mimeType:input.mimeType,artifactSha256:sha,payloadSha256:sha};},
 async read(sha:string){const row=retained.get(sha);return row?{artifact:{schema:'receiz.sealed-artifact-bytes.v124' as const,exactBytesB64u:receizBase64UrlEncode(row.bytes),filename:'creation.receiz',mimeType:'application/octet-stream',artifactSha256:sha,payloadSha256:sha},predecessors:row.predecessors}:null;}};
 const dependencies={database,sources,readArtifact:reader};
 async function add(name:string,p=payload(),owner:string|null='owner.receiz.id',predecessors:string[]=[]){const bytes=new TextEncoder().encode(name);images.set(name,{payload:p,owner,predecessors});return {bytes,mimeType:'application/vnd.receiz.artifact',name:name+'.receiz',sha:await sha256WildzArtifactBytes(bytes)};}
 return {database,images,dependencies,add,library:createWildzCreationLibrary(dependencies),get opens(){return opens;},get retains(){return retains;}};
}
test('account creations retain exact proof bytes and restore without a planner or reseal',async()=>{
 const f=await fixture(),source=await f.add('owned-source');await f.library.retain(scope,source);await f.library.retain(scope,source);
 const restored=createWildzCreationLibrary(f.dependencies),page=await restored.page(scope);
 assert.equal(page.entries.length,1);assert.equal(page.entries[0].instanceId,payload().instanceId);assert.equal(page.entries[0].status,'owned');
 const exported=await restored.export(scope,payload().instanceId);assert.deepEqual(exported.bytes,source.bytes);exported.bytes.fill(0);
 assert.deepEqual((await restored.export(scope,payload().instanceId)).bytes,source.bytes);
 assert.equal((await restored.page({keyId:'another-key',actorId:'owner'})).entries.length,0);
 assert.equal((await restored.page({keyId:scope.keyId,actorId:'other'})).entries.length,0);
 assert.ok(f.opens>=4);
});
test('document backups are recoverable and never become native object custody',async()=>{
 const f=await fixture(),backup=await f.add('document-backup',payload(),null);await f.library.retain(scope,backup);
 assert.equal((await f.library.page(scope)).entries[0]?.status,'recovery');assert.equal(f.retains,0);
 assert.deepEqual((await f.library.export(scope,payload().instanceId)).bytes,backup.bytes);
 const foreign=await f.add('foreign-native',payload(),'other.receiz.id');
 await assert.rejects(f.library.retain(scope,foreign),/owner_mismatch/);
 const original=f.dependencies.readArtifact,forged=createWildzCreationLibrary({...f.dependencies,readArtifact:async input=>({...await original(input)})});
 await assert.rejects(forged.retain(scope,backup),/source_unverified/);
});
test('verified source lineage selects its descendant independently of import order',async()=>{
 const f=await fixture(),p=payload(),original=await f.add('original',p);
 const old=p.checkpoint.instances[0],{head,...basis}=old;const next=sealCreationInstance({...basis,parentHead:head,revision:old.revision+1});
 const updated={...p,checkpoint:{...p.checkpoint,instances:[next]}},successor=await f.add('successor',updated,'owner.receiz.id',[original.sha]);
 await f.library.retain(scope,successor);await f.library.retain(scope,original);
 const page=await f.library.page(scope);assert.equal(page.entries[0]?.status,'owned');assert.equal(page.entries[0]?.artifactSha256,successor.sha);
 assert.deepEqual((await f.library.export(scope,p.instanceId)).bytes,successor.bytes);
 const fork=await f.add('unrelated-new-genesis',updated);await f.library.retain(scope,fork);
 assert.equal((await f.library.page(scope)).entries[0]?.status,'conflict');
 await assert.rejects(f.library.export(scope,p.instanceId),/history_conflict/);
});
test('membership remains atomic when retention fails and the same source can recover',async()=>{
 const f=await fixture(),source=await f.add('atomic-source');f.database.failNextTransactionAfterPuts(2);
 await assert.rejects(f.library.retain(scope,source),/transaction_failed/);assert.equal((await f.library.page(scope)).entries.length,0);
 await f.library.retain(scope,source);assert.equal((await f.library.page(scope)).entries.length,1);
 await assert.rejects(f.library.page(scope,null,65),/page_invalid/);
 await assert.rejects(f.library.page(scope,'unrelated-cursor'),/index_invalid/);
});
test('export rechecks native ownership and does not trust cached source metadata',async()=>{
 const f=await fixture(),source=await f.add('transferable');await f.library.retain(scope,source);
 f.images.get('transferable')!.owner='recipient.receiz.id';
 assert.equal((await f.library.page(scope)).entries[0]?.status,'transferred');
 await assert.rejects(f.library.export(scope,payload().instanceId),/owner_mismatch/);
});

test('object menu work is demand-driven and selection reopens its current custody',async()=>{
 const {createCreationLibrarySession}=await import('../src/features/play/creation/library-session');
 const f=await fixture(),source=await f.add('menu-source');await f.library.retain(scope,source);const before=f.opens;let selected=0;
 const session=createCreationLibrarySession({scope:()=>scope,port:f.library,select:()=>{selected++;}});
 assert.equal(f.opens,before);assert.equal(session.snapshot().entries.length,0);
 await session.refresh();assert.equal(session.snapshot().entries[0]?.status,'owned');
 assert.equal(await session.select(payload().instanceId),true);assert.equal(selected,1);
 f.images.get('menu-source')!.owner='recipient.receiz.id';
 assert.equal(await session.select(payload().instanceId),false);assert.equal(selected,1);
 assert.equal(await session.export(payload().instanceId),null);session.close();
});
test('late account reads cannot replace the new account menu or download its old source',async()=>{
 const {createCreationLibrarySession}=await import('../src/features/play/creation/library-session');
 const f=await fixture(),source=await f.add('late-source');await f.library.retain(scope,source);
 let current=scope,resolve:()=>void=()=>{};const gate=new Promise<void>(done=>{resolve=done;});let selected=0;
 const port={...f.library,page:async (...args:Parameters<typeof f.library.page>)=>{await gate;return f.library.page(...args);}};
 const session=createCreationLibrarySession({scope:()=>current,port,select:()=>{selected++;}});
 const pending=session.refresh();current={keyId:'new-account',actorId:'recipient'};resolve();await pending;
 assert.deepEqual(session.snapshot().entries,[]);assert.equal(await session.select(payload().instanceId),false);assert.equal(selected,0);
 const download=createCreationLibrarySession({scope:()=>current,port:{...f.library,export:async(...args)=>{const bytes=await f.library.export(...args);current={keyId:'another',actorId:'other'};return bytes;}},select:()=>{}});
 current=scope;assert.equal(await download.export(payload().instanceId),null);download.close();session.close();
});

test('cancelling menu work survives React effect replay and ignores a pending old result',async()=>{
 const {createCreationLibrarySession}=await import('../src/features/play/creation/library-session');
 const f=await fixture(),source=await f.add('effect-replay');await f.library.retain(scope,source);
 const session=createCreationLibrarySession({scope:()=>scope,port:f.library,select:()=>{}});
 assert.equal(typeof (session as unknown as {cancel?:unknown}).cancel,'function');
 const lifecycle=session as typeof session&{cancel():void};
 lifecycle.cancel();await session.refresh();assert.equal(session.snapshot().entries[0]?.status,'owned');
 lifecycle.cancel();assert.equal(session.snapshot().busy,false);await session.refresh();assert.equal(session.snapshot().entries[0]?.status,'owned');session.close();
});
