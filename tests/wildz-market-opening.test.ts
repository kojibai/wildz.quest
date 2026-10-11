import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildzMarketControllerV128} from '../src/features/market/wildz-market-controller-v128';
import {initialWildzMarketSourceV128} from '../src/lib/receiz/wildz-market-source-journal-v128';
import {createWildzMarketPublicReadSourceV128,createWildzMarketPublicSdkV128} from '../src/lib/receiz/wildz-market-public-read-v128';
import {GET as publicSource} from '../app/api/wilds/market/source/route';
import {NextRequest} from 'next/server';

test('an authenticated local Market read never opens a write grant, signs, or enrolls a subject',async()=>{
 let writes=0,reads=0;
 const unavailable=async()=>{writes++;throw Error('remote write authority must not gate opening');};
 const service=createWildzMarketControllerV128({keyId:'a'.repeat(64),ownerHandle:'alice.receiz.id',
  currentIdentity:()=>({keyId:'a'.repeat(64),ownerHandle:'alice.receiz.id'}),
  openReadSource:async()=>({load:async()=>{reads++;return {state:initialWildzMarketSourceV128(),head:null,proof:null};},observe:unavailable,verifyReservation:unavailable}),
  openSource:unavailable,qualifySelection:unavailable,readSelections:()=>[],
  store:{load:()=>null,write:()=>{throw Error('empty browsing must not save an operation');},withLock:async(_key,action)=>action()},
  staged:{sendWalletAsset:unavailable,assetPort:{prepareSource:unavailable,sendSource:unavailable,observeSource:unavailable,verifyAccepted:unavailable},
   readConversations:async()=>[],publish:unavailable}});
 const snapshot=await service.read();
 assert.equal(snapshot.status,'ready');assert.deepEqual(snapshot.listings,[]);
 assert.equal(reads,1);assert.equal(writes,0);
 await assert.rejects(service.previewPurchase('unknown'),/remote write authority/);
 assert.equal(writes,1,'explicit actions retain the actual current-source boundary');
});

test('the real Market SDK public reader opens without cookies, tokens or an application grant',async()=>{
 const calls:Array<{url:string;init?:RequestInit}>=[];
 const source=createWildzMarketPublicReadSourceV128(async(url,init)=>{calls.push({url:String(url),init});return Response.json({ok:true,record:null});});
 assert.deepEqual(await source.load(),{state:initialWildzMarketSourceV128(),head:null,proof:null});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/wilds/market/source?url=https%3A%2F%2Fwildz.quest%2Freceiz%2Fmarket-source-v128');
 assert.equal(calls[0].init?.method,'GET');assert.equal(calls[0].init?.credentials,'omit');
 assert.deepEqual([...new Headers(calls[0].init?.headers)],[]);
 await assert.rejects(source.observe({listingId:'unknown'}),/listing_missing/);
 assert.equal(calls.length,1,'the opened local history is reused for display recovery');
});

test('public Market transport cannot open unrelated URLs, SDK write edges, or trust caller-shaped source state',async()=>{
 let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return Response.json({ok:true,record:{schema:'receiz.app.public_store_state_projection.v1',state:'published',
  data:{storeStateRecord:{schema:'wildz.market-source-locator.v128',proof:{schema:'wildz.market-source-proof.v128',sourceArtifacts:[]}}}}});};
 const sdk=createWildzMarketPublicSdkV128(fetcher);
 await assert.rejects(sdk.publicStore.restoreLatest({url:'https://attacker.example/source'}),/public_path_invalid/);
 await assert.rejects(sdk.request('/api/sdk/v1/subjects/admit',{method:'POST',body:{}}),/public_path_invalid/);
 assert.equal(calls,0);
 await assert.rejects(createWildzMarketPublicReadSourceV128(fetcher).load(),/source_proof_invalid/);
 assert.equal(calls,1);
});

test('public Market route fixes its upstream host and never forwards caller credentials',async()=>{
 const before=globalThis.fetch,origin=process.env.RECEIZ_BASE_URL;
 const calls:Array<{url:string;init?:RequestInit}>=[];
 try{
  process.env.RECEIZ_BASE_URL='https://receiz.example';
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({ok:true,record:null});};
  for(const source of ['https://attacker.example/source','https://wildz.quest/receiz/resource-source-v128']){
   const denied=await publicSource(new NextRequest(`https://wildz.quest/api/wilds/market/source?url=${encodeURIComponent(source)}`));
   assert.equal(denied.status,400);
  }
  const response=await publicSource(new NextRequest('https://wildz.quest/api/wilds/market/source?url=https%3A%2F%2Fwildz.quest%2Freceiz%2Fmarket-source-v128',
   {headers:{cookie:'synthetic-secret',authorization:'Bearer synthetic-secret'}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://receiz.example/api/public-proof/by-url?url=https%3A%2F%2Fwildz.quest%2Freceiz%2Fmarket-source-v128');
  assert.equal(new Headers(calls[0].init?.headers).has('cookie'),false);assert.equal(new Headers(calls[0].init?.headers).has('authorization'),false);
  globalThis.fetch=async()=>new Response(new Uint8Array(2_000_001));
  assert.equal((await publicSource(new NextRequest('https://wildz.quest/api/wilds/market/source?url=https%3A%2F%2Fwildz.quest%2Freceiz%2Fmarket-source-v128'))).status,503);
 }finally{globalThis.fetch=before;if(origin===undefined)delete process.env.RECEIZ_BASE_URL;else process.env.RECEIZ_BASE_URL=origin;}
});
