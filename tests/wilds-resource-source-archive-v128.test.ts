import assert from 'node:assert/strict';import {test} from 'node:test';
import {createReceizClient,createReceizIdentityKeyFile,receizBase64UrlDecode,receizBase64UrlEncode,sha256ReceizBytes,type ReceizPortableSealedArtifactV124,type ReceizClient} from '@receiz/sdk';
import {createWildsResourcePublicStoreLocatorV128,verifyWildsResourceSourceProofV128,type WildsResourceSourceProofV128} from '../src/lib/receiz/wilds-resource-exchange-v128';
import type {WildsResourceSourceAuthorV128} from '../src/lib/receiz/wilds-resource-source-v128';
import {createWildsWalletSourceSdkClientV128} from '../src/features/play/wallet/wilds-wallet-source-sdk-v128';
import {initialWildsResourceJournalV128,reduceWildsResourceJournalV128} from '../src/lib/receiz/wilds-resource-journal-v128';
async function archive(){const m=await import('../src/lib/receiz/wilds-resource-source-archive-v128').catch(()=>null);assert.ok(m,'bounded complete resource ancestry archive required');return m;}
async function original(bytes:Uint8Array):Promise<ReceizPortableSealedArtifactV124>{return {schema:'receiz.sealed-artifact-bytes.v124',exactBytesB64u:receizBase64UrlEncode(bytes),artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:'a'.repeat(64),filename:'diagnostic.receizbundle',mimeType:'application/vnd.receiz.bundle+json'};}
test('resource locator sends a large enclosing Original within actual SDK signed2MiB bounds and reopens exact bytes',async()=>{
 const {keyFile}=await createReceizIdentityKeyFile({owner:{uid:'resource_archive_test',username:'alice'}}),requests:Array<Record<string,unknown>>=[],records=new Map<string,unknown>();
 const sdk=createWildsWalletSourceSdkClientV128({applicationId:'wildz',fetcher:async(_url,init)=>{
  const text=String(init?.body);assert.ok(new TextEncoder().encode(text).length<=2_000_000,'actual signed same-origin wrapper exceeds production bound');
  const wire=JSON.parse(text);if(wire.method==='GET')return Response.json({ok:true,record:records.get(new URLSearchParams(wire.query).get('url')!)});
  const value=wire.body;requests.push(value);const record=value.feed.records[0];records.set(record.sourceUrl,record);return Response.json({});
 }});
 const authority={keyFile,ownerReceizId:'alice.receiz.id'} as WildsResourceSourceAuthorV128;
 const proof:WildsResourceSourceProofV128={schema:'wildz.resource-source-proof.v128',custodyArtifact:await original(new Uint8Array(600_000).map((_,i)=>i%251)),sourceArtifacts:[await original(new TextEncoder().encode('diagnostic source Original'))]};
 const locator=createWildsResourcePublicStoreLocatorV128({sdk,authority,sourceUrl:'https://wildz.quest/receiz/resource-source-v128'});
 await locator.publish(proof);assert.ok(requests.length>2);
 assert.equal((requests.at(-1)!.storeStateRecord as {proof:{schema:string}}).proof.schema,'wildz.resource-source-reference.v128');
 assert.deepEqual(await createWildsResourcePublicStoreLocatorV128({sdk,authority,sourceUrl:'https://wildz.quest/receiz/resource-source-v128'}).read(),{...proof,archivePages:[]});
});
test('resource archive retains and replays every one of130 diagnostic source events rather than a checkpoint',async()=>{
 const m=await archive(),pages=new Map<string,unknown>(),events=Array.from({length:130},(_,n)=>({schema:'wildz.resource-command.v128' as const,kind:'replay' as const,attemptId:`archive:replay:${n}`,ownerReceizId:'alice.receiz.id',gameplayOwnerId:'alice',commands:[]}));
 const sources=await Promise.all(events.map(event=>original(new TextEncoder().encode(JSON.stringify(event))))),proof:WildsResourceSourceProofV128={schema:'wildz.resource-source-proof.v128',custodyArtifact:sources.at(-1)!,sourceArtifacts:sources};
 const compact=await m.compactWildsResourceSourceProofV128(proof,async(page,ref)=>{pages.set(ref.digest,page);},async(page,ref)=>{pages.set(ref.digest,page);});
 assert.ok(compact.sourceArtifacts.length<=32);assert.equal(compact.archivePages?.length,1);
 let state=initialWildsResourceJournalV128(),count=0;const shas:string[]=[];
 for await(const source of m.iterateWildsResourceSourceOriginalsV128(compact,async ref=>pages.get(ref.digest))){
  // Diagnostic byte transport only. Production first root-admits every native
  // Original via verifyWildsResourceSourceProofV128 before executing this law.
  state=await reduceWildsResourceJournalV128(state,JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(source.exactBytesB64u))),{ownerReceizId:'alice.receiz.id',verifyCard:async()=>assert.fail('no cards'),verifyPackage:async()=>assert.fail('no packages')});
  count++;shas.push(source.artifactSha256);
 }
 assert.equal(count,130);assert.deepEqual(shas,sources.map(source=>source.artifactSha256));assert.equal(state.traces['alice.receiz.id']?.commands.length,0);
});
test('resource archive missing or changed ancestry rejects before replay can silently skip it',async()=>{
 const m=await archive(),pages=new Map<string,unknown>(),sources=await Promise.all(Array.from({length:130},(_,n)=>original(new TextEncoder().encode(`diagnostic:${n}`))));
 const compact=await m.compactWildsResourceSourceProofV128({schema:'wildz.resource-source-proof.v128',custodyArtifact:sources.at(-1)!,sourceArtifacts:sources},async(page,ref)=>{pages.set(ref.digest,page);},async(page,ref)=>{pages.set(ref.digest,page);});
 await assert.rejects(async()=>{for await(const source of m.iterateWildsResourceSourceOriginalsV128(compact,async()=>null)){void source;}},/archive_page_invalid/);
 await assert.rejects(async()=>{for await(const source of m.iterateWildsResourceSourceOriginalsV128(compact,async ref=>{const page=structuredClone(pages.get(ref.digest)) as {sourceArtifacts:ReceizPortableSealedArtifactV124[]};page.sourceArtifacts.reverse();return page;})){void source;}},/archive_digest/);
});
test('more than128 source leaves must still reach native root admission and reject fabricated native authority',async()=>{
 let opens=0;const source=await original(new TextEncoder().encode('unsealed diagnostic data'));
 const sdk={artifacts:{verifyAndOpen:async()=>{opens++;throw Error('not a native Original');}}} as unknown as ReceizClient;
 await assert.rejects(verifyWildsResourceSourceProofV128(sdk,{schema:'wildz.resource-source-proof.v128',custodyArtifact:source,sourceArtifacts:Array.from({length:130},()=>source)},{applicationId:'wildz'}),/wildz_artifact_verification_failed/);
 assert.equal(opens,1);
});

test('accepted locator reply loss republishes the same exact custody and ancestry bytes across cold recreation',async()=>{
 const {keyFile}=await createReceizIdentityKeyFile({owner:{uid:'resource_archive_reply',username:'alice'}}),records=new Map<string,unknown>(),attempts:string[]=[];let dropped=false;
 const sdk=createReceizClient({applicationId:'wildz',fetchImpl:async(url,init)=>{
  if((init?.method??'GET')==='GET')return Response.json({ok:true,record:records.get(new URL(String(url)).searchParams.get('url')!)});
  const value=JSON.parse(String(init?.body)),record=value.feed.records[0];records.set(record.sourceUrl,record);attempts.push(new Headers(init?.headers).get('idempotency-key')??new Headers(init?.headers).get('x-idempotency-key')??'');
  if(record.sourceUrl==='https://wildz.quest/receiz/resource-source-v128'&&!dropped){dropped=true;throw Error('diagnostic accepted publication reply lost');}return Response.json({});
 }});
 const source=await original(new TextEncoder().encode('immutable diagnostic Original')),proof:WildsResourceSourceProofV128={schema:'wildz.resource-source-proof.v128',custodyArtifact:source,sourceArtifacts:[source]},input={sdk,authority:{keyFile,ownerReceizId:'alice.receiz.id'} as WildsResourceSourceAuthorV128,sourceUrl:'https://wildz.quest/receiz/resource-source-v128'};
 await assert.rejects(createWildsResourcePublicStoreLocatorV128(input).publish(proof),/reply lost/);
 const recovered=createWildsResourcePublicStoreLocatorV128(input);assert.deepEqual(await recovered.read(),{...proof,archivePages:[]});
 await recovered.publish(proof);assert.deepEqual(await recovered.read(),{...proof,archivePages:[]});
 assert.equal(attempts.filter(id=>id===`wildz:resource-locator:${source.artifactSha256}`).length,2);
});
test('before-CAS byte budgets cover the downstream custody multipart and exact source wrapper',async()=>{
 const m=await archive(),source=await original(new Uint8Array(1_499_700));
 // Each source wrapper is independently bounded. A custody carrier containing
 // two exact Originals can be too large even when this publication still fits.
 const request={applicationId:'wildz',authoritySessionHandle:'diagnostic-session',sourceArtifact:await original(new Uint8Array(800_000))};
 await m.assertWildsResourceSourceRequestCapacityV128(request,new Uint8Array(100));
 await assert.rejects(m.assertWildsResourceSourceRequestCapacityV128(request,new Uint8Array(2_000_000)),/custody_request_too_large/);
 await assert.rejects(m.assertWildsResourceSourceRequestCapacityV128({...request,sourceArtifact:source},new Uint8Array(100)),/source_request_too_large/);
});
test('resource archive proxy qualification rejects extra nested Original-reference fields',async()=>{
 const m=await archive(),pages=new Map<string,unknown>(),sources=await Promise.all(Array.from({length:33},(_,n)=>original(new TextEncoder().encode(`strict:${n}`))));
 const compact=await m.compactWildsResourceSourceProofV128({schema:'wildz.resource-source-proof.v128',custodyArtifact:sources.at(-1)!,sourceArtifacts:sources},async(page,ref)=>{pages.set(ref.digest,page);},async(page,ref)=>{pages.set(ref.digest,page);});
 const page=structuredClone(pages.get(compact.archivePages![0]!.digest)) as {sourceArtifacts:Array<Record<string,unknown>>};page.sourceArtifacts[0]!.authority='caller-created';
 assert.throws(()=>m.describeWildsResourceSourceArchivePageV128(page),/original_reference_invalid/);
});

test('archived130-source bytes are reconstructed before the actual released SDK rejects unsealed authority',async()=>{
 const m=await archive(),pages=new Map<string,unknown>(),sources=await Promise.all(Array.from({length:130},(_,n)=>original(new TextEncoder().encode(`unsealed diagnostic event:${n}`))));
 const compact=await m.compactWildsResourceSourceProofV128({schema:'wildz.resource-source-proof.v128',custodyArtifact:sources.at(-1)!,sourceArtifacts:sources},async(page,ref)=>{pages.set(ref.digest,page);},async(page,ref)=>{pages.set(ref.digest,page);});let reads=0;
 const sdk=createReceizClient({applicationId:'wildz',fetchImpl:async url=>{reads++;const digest=new URL(String(url)).searchParams.get('url')?.split('/').at(-1);return Response.json({ok:true,record:{schema:'receiz.app.public_store_state_projection.v1',state:'published',data:{storeStateRecord:{schema:'wildz.resource-source-page-locator.v128',page:pages.get(digest!)}}}});}});
 await assert.rejects(verifyWildsResourceSourceProofV128(sdk,compact,{applicationId:'wildz'}),/wildz_artifact_verification_failed/);
 assert.ok(reads>compact.archivePages!.length,'replay restored archive and byte pages before native root opening');
});
