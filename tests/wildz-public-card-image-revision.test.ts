import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NextRequest} from 'next/server';
import {GET} from '../app/api/cards/[assetId]/image/route';
import {initialPlayState} from '../src/features/play/game-state';
import {sealCollectedCard} from '../src/features/play/portable-card';
import {createPublicWildsCardRecord} from '../src/features/play/public-card-registry';
import * as publicCard from '../src/lib/receiz/wildz-market-public-card';
import {resolvePublicWildsCardRecord} from '../src/lib/receiz/wildz-public-card-resolver';
import {emptyWildzPublicState} from '../src/lib/receiz/wildz-public-state';

test('card images are pinned to the requested proof revision and reject malformed digests before lookup',async context=>{
 const asset=initialPlayState.inventory[0]!,params=Promise.resolve({assetId:asset.id});
 let reads=0;
 context.mock.method(globalThis,'fetch',async()=>{reads++;return Response.json({ok:true,record:{schema:'receiz.wilds_public_card.v1',assetId:asset.id,asset}});});
 const url=`https://wildz.quest/api/cards/${encodeURIComponent(asset.id)}/image?profile=cardowner`;
 const invalid=await GET(new NextRequest(`${url}&digest=wrong`),{params});
 assert.equal(invalid.status,400);assert.equal(reads,0);
 const exact=await GET(new NextRequest(`${url}&digest=${encodeURIComponent(asset.proof.digest)}`),{params});
 assert.equal(exact.status,200);assert.match(exact.headers.get('content-type')??'',/image\/svg/);
 assert.match(await exact.text(),new RegExp(asset.manifest.name));
 const changed=await GET(new NextRequest(`${url}&digest=sha256:${'0'.repeat(64)}`),{params});
 assert.equal(changed.status,409);assert.equal(changed.headers.get('cache-control'),'no-store');
});

test('legacy scoped artwork stays image-only and never falls back to creator ownership',async()=>{
 const artwork=(publicCard as Record<string,unknown>).resolveSdkPublicWildzCardArtwork as typeof publicCard.resolveSdkPublicWildzCard|undefined;
 assert.equal(typeof artwork,'function');
 const asset=initialPlayState.inventory[0]!,scope=`https://wildz.quest/u/collector/cards/${encodeURIComponent(asset.id)}`;
 const legacy={schema:'receiz.wilds_public_card.v1',assetId:asset.id,asset},reads:string[]=[];
 const adapter={readAppStateByUrl:async(url:string)=>{reads.push(url);return legacy;}};
 const options={adapter,requestOrigin:'https://wildz.quest',profileHandle:'collector'};
 assert.equal((await artwork!(asset.id,options))?.proof.digest,asset.proof.digest);
 assert.deepEqual(reads,[scope]);
 assert.equal(await publicCard.resolveSdkPublicWildzCardRecord(asset.id,options),null,'artwork must not synthesize a registration or collector record');
 reads.length=0;
 assert.equal(await artwork!(asset.id,{...options,adapter:{readAppStateByUrl:async url=>{reads.push(url);return url===scope?null:legacy;}}}),null);
 assert.deepEqual(reads,[scope]);
 const canonical={...legacy,sourceUrl:`https://wildz.quest/cards/${encodeURIComponent(asset.id)}`,registeredAt:'2026-10-12T12:00:00.000Z'};
 assert.equal(await artwork!(asset.id,{...options,adapter:{readAppStateByUrl:async()=>canonical}}),null,'a canonical record returned at the collector URL does not bind scoped artwork');
 const edited=structuredClone(asset);edited.manifest.name='tampered';
 assert.equal(await artwork!(asset.id,{...options,adapter:{readAppStateByUrl:async()=>({...legacy,asset:edited})}}),null);
 assert.equal(await artwork!(asset.id,{...options,adapter:{readAppStateByUrl:async()=>({...legacy,assetId:'wilds:'+'0'.repeat(24)})}}),null);
});

test('scoped artwork recovers an exact repository card without inventing a collector record',async context=>{
 const asset=initialPlayState.inventory[0]!,params=Promise.resolve({assetId:asset.id});
 const state={...emptyWildzPublicState(),revision:7,updatedAt:'2026-10-12T12:00:00.000Z',cards:{[asset.id]:asset}};
 let repositoryReads=0;
 context.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>{
  const sourceUrl=new URL(String(url)).searchParams.get('url');
  if(sourceUrl==='https://wildz.quest'){
   repositoryReads++;
   return Response.json({ok:true,record:{sourceUrl,data:{storeStateRecord:state}}});
  }
  return Response.json({ok:true,record:null});
 });
 const url=`https://wildz.quest/api/cards/${encodeURIComponent(asset.id)}/image?digest=${encodeURIComponent(asset.proof.digest)}`;
 const recovered=await GET(new NextRequest(url),{params});
 assert.equal(recovered.status,200);assert.equal(repositoryReads,1);
 assert.match(await recovered.text(),new RegExp(asset.manifest.name));
 const collectorArtwork=await GET(new NextRequest(`${url}&profile=collector`),{params});
 assert.equal(collectorArtwork.status,200);assert.equal(repositoryReads,2);
 assert.match(await collectorArtwork.text(),new RegExp(asset.manifest.name));
 assert.equal(await resolvePublicWildsCardRecord(asset.id,'https://wildz.quest','collector'),null,'artwork recovery must not create a collector registration or ownership claim');
 assert.equal(repositoryReads,2,'strict collector records cannot recover from the unscoped repository');
 const changed=await GET(new NextRequest(url.replace(encodeURIComponent(asset.proof.digest),encodeURIComponent('sha256:'+'0'.repeat(64)))),{params});
 assert.equal(changed.status,409);
});

for(const profileHandle of ['birth_keeper','next_keeper']){
 test(`a canonical-only card renders exact artwork for ${profileHandle} without changing collector truth`,async context=>{
  const asset=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'birth_keeper.receiz.id',encounterId:'canonical-only-artwork',capturedAt:'2026-10-12T12:00:00.000Z'});
  const canonical=createPublicWildsCardRecord(asset,'https://wildz.quest','2026-10-12T12:00:00.000Z');
  const reads:string[]=[];
  context.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,init?:RequestInit)=>{
   assert.equal(init?.method??'GET','GET','artwork recovery must only read public state');
   const sourceUrl=new URL(String(url)).searchParams.get('url');
   if(sourceUrl)reads.push(sourceUrl);
   return Response.json({ok:true,record:sourceUrl===canonical.sourceUrl?canonical:null});
  });
  const params=Promise.resolve({assetId:asset.id});
  const url=`https://wildz.quest/api/cards/${encodeURIComponent(asset.id)}/image?profile=${profileHandle}`;
  const malformed=await GET(new NextRequest(`${url}&digest=bad`),{params});
  assert.equal(malformed.status,400);assert.equal(reads.length,0);
  const exact=await GET(new NextRequest(`${url}&digest=${encodeURIComponent(asset.proof.digest)}`),{params});
  assert.equal(exact.status,200);
  assert.match(await exact.text(),new RegExp(asset.manifest.name));
  assert.equal(reads[0],`https://wildz.quest/u/${profileHandle}/cards/${encodeURIComponent(asset.id)}`);
  assert.ok(reads.includes(canonical.sourceUrl),'missing scoped artwork recovers the verified canonical card');
  const changed=await GET(new NextRequest(`${url}&digest=${encodeURIComponent('sha256:'+'0'.repeat(64))}`),{params});
  assert.equal(changed.status,409);assert.equal(changed.headers.get('cache-control'),'no-store');
  const record=await resolvePublicWildsCardRecord(asset.id,'https://wildz.quest',profileHandle);
  if(profileHandle==='birth_keeper'){
   assert.equal(record?.sourceUrl,canonical.sourceUrl);
   assert.equal(record?.ownershipClaims,undefined);
  }else{
   assert.equal(record,null,'display artwork must not assign the birth-owner record to the next collector');
  }
 });
}

test('scoped artwork recovery rejects a canonical card with a bad proof or the wrong asset ID',async context=>{
 const asset=initialPlayState.inventory[0]!,params=Promise.resolve({assetId:asset.id});
 const canonical=createPublicWildsCardRecord(asset,'https://wildz.quest','2026-10-12T12:00:00.000Z');
 const tampered=structuredClone(canonical);tampered.asset.manifest.name='tampered';
 let record:unknown=tampered;
 context.mock.method(globalThis,'fetch',async(url:RequestInfo|URL)=>{
  const sourceUrl=new URL(String(url)).searchParams.get('url');
  return Response.json({ok:true,record:sourceUrl===canonical.sourceUrl?record:null});
 });
 const url=`https://wildz.quest/api/cards/${encodeURIComponent(asset.id)}/image?profile=next_keeper&digest=${encodeURIComponent(asset.proof.digest)}`;
 assert.equal((await GET(new NextRequest(url),{params})).status,404);
 record={...canonical,assetId:'wilds:'+'0'.repeat(24)};
 assert.equal((await GET(new NextRequest(url),{params})).status,404);
});
