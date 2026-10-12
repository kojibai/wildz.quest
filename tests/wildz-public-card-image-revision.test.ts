import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NextRequest} from 'next/server';
import {GET} from '../app/api/cards/[assetId]/image/route';
import {initialPlayState} from '../src/features/play/game-state';
import * as publicCard from '../src/lib/receiz/wildz-market-public-card';
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

test('unscoped artwork recovers an exact repository card while a missing collector scope stays missing',async context=>{
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
 const missing=await GET(new NextRequest(`${url}&profile=collector`),{params});
 assert.equal(missing.status,404);assert.equal(repositoryReads,1,'collector reads cannot recover from the unscoped repository');
 const changed=await GET(new NextRequest(url.replace(encodeURIComponent(asset.proof.digest),encodeURIComponent('sha256:'+'0'.repeat(64)))),{params});
 assert.equal(changed.status,409);
});
