import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildzMarketPublicBrowseService} from '../src/features/market/wildz-market-public-browse';
import {initialWildzMarketSourceV128} from '../src/lib/receiz/wildz-market-source-journal-v128';
import type {WildzMarketSourceSnapshotV128} from '../src/lib/receiz/wildz-market-source-types-v128';
import {initialPlayState} from '../src/features/play/game-state';
import {calculateWildzMarketLocalValueV129} from '../src/features/market/wildz-market-value-local-v129';
import {quoteReceizDisplayUsdV122} from '@receiz/sdk';
import type {PortableCardAsset} from '../src/features/play/portable-card';
import type {WildzMarketLocalValueEvaluationV129} from '../src/features/market/wildz-market-value-local-v129';

const asset=initialPlayState.inventory[0]!;
const empty=():WildzMarketSourceSnapshotV128=>({state:initialWildzMarketSourceV128(),head:null,proof:null});
const collection={cards:[{assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:'publicseller.receiz.id',claimKaiUPulse:null,claimHead:null,asset}],transfers:[]};

test('anonymous browsing reads public cards without an identity or write port and coalesces entry reads',async()=>{
 let reads=0;
 const service=createWildzMarketPublicBrowseService({readNative:async()=>empty(),readAdvertisements:async()=>empty(),readCollection:async()=>{reads++;return collection;},value:{read:async()=>({status:'unavailable',message:'No held USD basis.'})}});
 assert.equal(service.binding.keyId,'');assert.equal(service.binding.ownerHandle,'');
 const [first,second]=await Promise.all([service.read(),service.read()]);
 assert.equal(first,second);assert.equal(reads,1);assert.equal(first.status,'ready');assert.equal(first.collection?.[0]?.assetId,asset.id);
 for(const call of [()=>service.list({asset:{kind:'creature',assetId:asset.id},priceUsdCents:'100',attemptId:'public-test'}),()=>service.approvePurchase('public-test'),()=>service.accept('public-test'),()=>service.cancel('public-test')])assert.equal((await call()).status,'failed');
 await assert.rejects(service.previewPurchase('public-test'),/identity/i);
 assert.equal(reads,1);
});

test('public collection remains browsable when a listing source is temporarily unavailable',async()=>{
 const service=createWildzMarketPublicBrowseService({readNative:async()=>{throw Error('offline');},readAdvertisements:async()=>empty(),readCollection:async()=>collection,value:{read:async()=>({status:'unavailable',message:'No value.'})}});
 const snapshot=await service.read();assert.equal(snapshot.status,'ready');assert.equal(snapshot.collection?.length,1);assert.match(snapshot.message,/listings/i);
});

test('public browse forwards an already held USD rate to its default local value port',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'Worker');
 class LocalCalculationWorker extends EventTarget {
  postMessage(request:{requestId:number;card:PortableCardAsset;evaluation:WildzMarketLocalValueEvaluationV129}){
   void calculateWildzMarketLocalValueV129(structuredClone(request.card),request.evaluation).then(result=>{
    this.dispatchEvent(new MessageEvent('message',{data:{type:'value-result',requestId:request.requestId,result}}));
   });
  }
  terminate(){}
 }
 Object.defineProperty(globalThis,'Worker',{configurable:true,value:LocalCalculationWorker});
 let rate='40750000000';
 const options={readNative:async()=>empty(),readAdvertisements:async()=>empty(),readCollection:async()=>collection,
  usdPerPhiMicrocents:()=>rate};
 const service=createWildzMarketPublicBrowseService(options);
 try{
  await service.read();const result=await service.readValue!(asset.id);
  assert.equal(result.status,'ready');if(result.status!=='ready')return;
  assert.equal(result.value.displayUsdCents,quoteReceizDisplayUsdV122(result.value.proofValuePhiMicro,rate));
  assert.equal(service.snapshot().collection?.[0]?.value?.displayUsdCents,result.value.displayUsdCents);
  rate='200000000';const changed=await service.readValue!(asset.id);
  assert.equal(changed.status,'ready');if(changed.status!=='ready')return;
  assert.equal(changed.value.displayUsdCents,quoteReceizDisplayUsdV122(changed.value.proofValuePhiMicro,rate));
  assert.notEqual(changed.value.priceBasisDigest,result.value.priceBasisDigest);
 }finally{
  service.releaseValue?.();if(previous)Object.defineProperty(globalThis,'Worker',previous);else Reflect.deleteProperty(globalThis,'Worker');
 }
});
