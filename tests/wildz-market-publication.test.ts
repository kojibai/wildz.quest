import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReceizClient,createReceizIdIdentity,verifyReceizIdentityPublicKeyProjectionSignature} from '@receiz/sdk';
import type {WildzContinuityDatabase} from '../src/lib/storage/wildz-indexed-db';
import type {WildzIdentitySession} from '../src/lib/receiz/wildz-identity-repository';
import type {WildzMarketSelectionV128} from '../src/lib/receiz/wildz-market-source-types-v128';
import {createWildzMarketControllerV128} from '../src/features/market/wildz-market-controller-v128';
import {initialWildzMarketSourceV128} from '../src/lib/receiz/wildz-market-source-journal-v128';
import {selectWildzMarketAdvertisementV128} from '../src/lib/receiz/wildz-market-publication-browser-v128';
import {POST as relayPublication,GET as readPublications} from '../app/api/wilds/market/publications/route';
import {NextRequest} from 'next/server';
const selection:WildzMarketSelectionV128={asset:{kind:'inventory',foodItemIds:['apple:one'],materialLotIds:[],resourceLotIds:[]},semanticIds:['resource:apple:one'],sourceDigest:'a'.repeat(64),summary:'Apple',resourceUnits:1,creatureCount:0};
const request={attemptId:'list:publication',listingId:`market:listing:${'b'.repeat(64)}`,selection,priceUsdCents:500};
function database():WildzContinuityDatabase{const values=new Map<string,unknown>();return {read:async(_s,k)=>structuredClone(values.get(String(k))??null) as never,transaction:async(_s,_mode,run)=>run({get:async(_s,k)=>structuredClone(values.get(String(k))??null) as never,put:async(_s,v,k)=>{values.set(String(k),structuredClone(v));},delete:async(_s,k)=>{values.delete(String(k));},getAll:async()=>[]})};}
async function fixture(){
 const publicationModule=await import('../src/lib/receiz/wildz-market-publication-v128').catch(()=>null);assert.ok(publicationModule,'Market must publish through the working Profile signed-public-store flow');
 const {keyFile}=await createReceizIdIdentity({username:'publication_seller'});
 const session:WildzIdentitySession={schema:'receiz.wildz.identity_session.v1',keyId:keyFile.keyId,actorId:'publication_seller',username:'publication_seller',displayName:'Seller',portableStateStatus:'missing',localAuthority:'verified',remoteStatus:'offline'};
 let active:WildzIdentitySession|null=session,failAfterWrite=false,omitIndex=false;const writes:string[]=[],records=new Map<string,unknown>();
 const sdk=createReceizClient({fetchImpl:async(url,init)=>{
  const path=new URL(String(url)).pathname;
  assert.ok(!path.includes('v124')&&!path.includes('oidc')&&!path.includes('proof-authority'),'publication must not request an application grant');
  if(init?.method==='POST'){
   assert.equal(path,'/api/public-proof/registry/feed');assert.equal(new Headers(init.headers).has('authorization'),false);
   const signed=JSON.parse(String(init.body)),record=publicationModule.parseSignedWildzMarketPublicationV128(signed);
   assert.equal(await verifyReceizIdentityPublicKeyProjectionSignature({keyId:signed.identityProof.keyId,alg:signed.identityProof.alg,publicKeyRawB64u:signed.identityProof.publicKeyRawB64u,challengeB64Url:signed.identityProof.challengeB64Url,signatureB64Url:signed.identityProof.signatureB64Url}),true);
   const row=signed.feed.records[0];writes.push(String(init.body));records.set(row.sourceUrl,{id:row.id,sourceUrl:row.sourceUrl,externalCreatorId:row.externalCreatorId,
    appNamespace:row.namespace,appObjectId:row.id,appProjectionSchema:row.schema,appProjectionState:row.state,appProjectionData:row.data,schema:row.schema,state:row.state,data:row.data});
   if(failAfterWrite){failAfterWrite=false;throw Error('lost publication response');}
   return Response.json({ok:true,appendAnchorId:'actual-append',knownHead:{appendAnchorId:'actual-append',afterKaiUpulse:'123'},storeStateRecord:record});
  }
  if(path.startsWith('/api/public-proof/namespace/'))return Response.json({ok:true,records:omitIndex?[]:[...records.values()]});
  return Response.json({ok:true,record:records.get(new URL(String(url)).searchParams.get('url')!)});
 }});
 const storage=database();const open=()=>publicationModule.createWildzMarketPublicationSourceV128({sdk,database:storage,keyId:session.keyId,ownerHandle:'publication_seller.receiz.id',currentIdentity:()=>({keyId:session.keyId,ownerHandle:'publication_seller.receiz.id'}),repository:{active:async()=>active,withKeyFile:async(_key,operation)=>operation(keyFile)}});
 return {module:publicationModule,keyFile,session,writes,open,records,setActive:(value:WildzIdentitySession|null)=>{active=value;},loseResponse:()=>{failAfterWrite=true;},omitFeedListing:()=>{omitIndex=true;}};
}
test('Market publishes and cold reads using the same SDK identity-signed public-store rail as Profile',async()=>{
 const f=await fixture(),published=await f.open().list(request);assert.equal(published.listing.status,'active');assert.equal(f.writes.length,1);
 const cold=await f.open().load();assert.deepEqual(cold.state.listings[request.listingId],published.listing);assert.equal(cold.proof,null,'advertisement never impersonates native asset custody');
 const cancelled=await f.open().cancel({attemptId:'listing:cancel',listingId:request.listingId,expectedListingHead:published.listing.listingHead});assert.equal(cancelled.listing.status,'cancelled');
 assert.equal((await f.open().load()).state.listings[request.listingId].status,'cancelled');
});
test('lost publication response recovers the same stored signed request without a duplicate write',async()=>{
 const f=await fixture();f.loseResponse();await assert.rejects(f.open().list(request),/lost publication response/);
 const recovered=await f.open().list(request);assert.equal(recovered.listing.status,'active');assert.equal(f.writes.length,1);
 await assert.rejects(f.open().list({...request,priceUsdCents:600}),/attempt_conflict/);assert.equal(f.writes.length,1);
});

test('publication recovery and withdrawal use the exact URL after the listing leaves the bounded discovery page',async()=>{
 const f=await fixture();f.loseResponse();await assert.rejects(f.open().list(request),/lost publication response/);f.omitFeedListing();
 const recovered=await f.open().list(request);assert.equal(recovered.listing.status,'active');assert.equal(f.writes.length,1);
 const cancelled=await f.open().cancel({attemptId:'listing:cancel',listingId:request.listingId,expectedListingHead:recovered.listing.listingHead});assert.equal(cancelled.listing.status,'cancelled');assert.equal(f.writes.length,2);
 assert.equal((await f.open().list(request)).listing.status,'cancelled','replaying an old listing cannot revive a withdrawn offer');assert.equal(f.writes.length,2);
});

test('malformed unrelated public namespace entries cannot disable valid Market advertisements',async()=>{
 const f=await fixture();await f.open().list(request);f.records.set('other-public-entry',{appNamespace:'wildz.market-listings.v128',sourceUrl:'https://other.example/other',data:{storeStateRecord:{schema:'other'}}});
 assert.equal((await f.open().load()).state.listings[request.listingId].status,'active');
});
test('Market signed publication rejects changed identity, feed, namespace, owner and unsigned state',async()=>{
 const f=await fixture();await f.open().list(request);const signed=JSON.parse(f.writes[0]);
 for(const mutate of [(v:typeof signed)=>{v.feed.records[0].namespace='other';},(v:typeof signed)=>{v.merchantReceizId='other.receiz.id';},(v:typeof signed)=>{v.storeStateRecord.priceUsdCents=600;},(v:typeof signed)=>{v.feed.records.push(v.feed.records[0]);}]){const changed=structuredClone(signed);mutate(changed);assert.throws(()=>f.module.parseSignedWildzMarketPublicationV128(changed),/publication_invalid/);}
 f.setActive({...f.session,keyId:'c'.repeat(64)});await assert.rejects(f.open().list({...request,attemptId:'list:other'}),/identity/);assert.equal(f.writes.length,1);
});

test('the actual Market List, public read and Cancel actions never open the broken native grant',async()=>{
 const f=await fixture();let value:unknown=null,grants=0;
 const forbidden=async()=>{grants++;throw Error('Native application grant must not gate publication.');};
 const create=()=>createWildzMarketControllerV128({keyId:f.session.keyId,ownerHandle:'publication_seller.receiz.id',currentIdentity:()=>({keyId:f.session.keyId,ownerHandle:'publication_seller.receiz.id'}),
  openSource:forbidden,qualifySelection:forbidden,publication:{open:async()=>f.open(),selection:async()=>selection},
  openReadSource:async()=>({load:async()=>({state:initialWildzMarketSourceV128(),head:null,proof:null}),observe:forbidden,verifyReservation:forbidden}),readSelections:()=>[],
  store:{load:()=>structuredClone(value),write:(_key,next)=>{value=structuredClone(next);},withLock:async(_key,action)=>action()},
  staged:{sendWalletAsset:forbidden,assetPort:{prepareSource:forbidden,sendSource:forbidden,observeSource:forbidden,verifyAccepted:forbidden},readConversations:async()=>[],publish:forbidden}});
 const service=create(),listed=await service.list({attemptId:'list:actual-ui',asset:selection.asset,priceUsdCents:'500'});
 assert.equal(listed.status,'listed',listed.message);assert.equal(f.writes.length,1);assert.equal(grants,0);
 const cold=await create().read();assert.equal(cold.listings[0].listingId,listed.listingId);assert.equal(cold.listings[0].status,'active');
 const cancelled=await service.cancel(listed.listingId!);assert.equal(cancelled.status,'cancelled',cancelled.message);
 assert.equal((await create().read()).listings[0].status,'cancelled');assert.equal(grants,0);
});

test('public offer selection binds the held local display and rejects stale selections without opening native custody',()=>{
 const held=[{id:'food:one',label:'Apple',quantity:1,asset:selection.asset}];
 const selected=selectWildzMarketAdvertisementV128(selection.asset,held,'publication_seller.receiz.id');assert.deepEqual(selected.semanticIds,['resource:apple:one']);
 assert.throws(()=>selectWildzMarketAdvertisementV128(selection.asset,[],'publication_seller.receiz.id'),/selection changed/);
 const changed=selectWildzMarketAdvertisementV128(selection.asset,[{...held[0],quantity:2}],'publication_seller.receiz.id');assert.notEqual(changed.sourceDigest,selected.sourceDigest);
});

test('Market relay uses Profile public-store transport, bounds its namespace and preserves safe rejection codes',async()=>{
 const f=await fixture();await f.open().list(request);const signed=JSON.parse(f.writes[0]);
 const before=globalThis.fetch,origin=process.env.RECEIZ_BASE_URL;const calls:Array<{url:string;init?:RequestInit}>=[];
 try{
  process.env.RECEIZ_BASE_URL='https://receiz.example';globalThis.fetch=async(url,init)=>{
   calls.push({url:String(url),init});
   if(init?.method==='POST'){const received=JSON.parse(String(init.body));assert.deepEqual(received,signed);return Response.json({ok:true,appendAnchorId:'actual',knownHead:{appendAnchorId:'actual',afterKaiUpulse:'123'}});}
   return Response.json({ok:true,records:[]});
  };
  const send=(value:unknown)=>relayPublication(new NextRequest('https://wildz.quest/api/wilds/market/publications',{method:'POST',headers:{'content-type':'application/json',cookie:'synthetic-cookie',authorization:'Bearer synthetic-token'},body:JSON.stringify(value)}));
  assert.equal((await send(signed)).status,201);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://receiz.example/api/public-proof/registry/feed');
  const forwarded=new Headers(calls[0].init?.headers);assert.equal(forwarded.has('cookie'),false);assert.equal(forwarded.has('authorization'),false);assert.match(forwarded.get('idempotency-key')!,/^wildz:market-publication:[a-f0-9]{64}$/);
  const changed=structuredClone(signed);changed.feed.records[0].sourceUrl='https://other.example/other';assert.equal((await send(changed)).status,400);assert.equal(calls.length,1);
  assert.equal((await relayPublication(new NextRequest('https://wildz.quest/api/wilds/market/publications',{method:'POST',body:'x'.repeat(1_000_001)}))).status,413);assert.equal(calls.length,1);
  assert.equal((await readPublications(new NextRequest('https://wildz.quest/api/wilds/market/publications'))).status,200);assert.equal(calls[1].url,'https://receiz.example/api/public-proof/namespace/wildz.market-listings.v128');
  const source=signed.feed.records[0].sourceUrl;
  assert.equal((await readPublications(new NextRequest(`https://wildz.quest/api/wilds/market/publications?url=${encodeURIComponent(source)}`))).status,200);
  assert.equal(calls[2].url,`https://receiz.example/api/public-proof/by-url?url=${encodeURIComponent(source)}`);
  assert.equal((await readPublications(new NextRequest('https://wildz.quest/api/wilds/market/publications?url=https://other.example/private'))).status,400);assert.equal(calls.length,3);
  globalThis.fetch=async()=>Response.json({error:'public_store_identity_proof_signature_invalid'},{status:403});
  const denied=await send(signed);assert.equal(denied.status,403);assert.equal((await denied.json()).error,'public_store_identity_proof_signature_invalid');
 }finally{globalThis.fetch=before;if(origin===undefined)delete process.env.RECEIZ_BASE_URL;else process.env.RECEIZ_BASE_URL=origin;}
});
