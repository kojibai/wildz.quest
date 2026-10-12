import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildzMarketWarmup} from '../src/features/market/wildz-market-warmup';
import {createWildzMarketCardPreparer} from '../src/features/market/wildz-market-card-preparation';
import {initialPlayState} from '../src/features/play/game-state';
import {sealCollectedCard} from '../src/features/play/portable-card';
import type {WildzMarketServiceV128,WildzMarketSnapshotV128} from '../src/features/market/wildz-market-service-v128';

test('entry warming coalesces reads and retains the prepared first screen across repeated opens',async()=>{
 let reads=0,decodes=0,values=0;
 const snapshot:WildzMarketSnapshotV128={status:'ready',message:'',listings:[],purchases:[],sellables:[],collection:Array.from({length:30},(_,i)=>{
  const asset=sealCollectedCard({formId:'mintcub-1',ownerReceizId:`warm${i}.receiz.id`,encounterId:`warm:screen:${i}`,capturedAt:'2026-10-10T12:00:00.000Z'});
  return {assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:`warm${i}.receiz.id`,claimKaiUPulse:null,claimHead:null,asset};
 })};
 const service={snapshot:()=>snapshot,read:async()=>{reads++;return snapshot;},readValue:async()=>{values++;}} as unknown as WildzMarketServiceV128;
 const preparer=createWildzMarketCardPreparer({decodeImage:async()=>{decodes++;},readValue:id=>service.readValue!(id)});
 const warm=createWildzMarketWarmup(service,preparer);
 await Promise.all([warm.ready(),warm.ready()]);
 assert.equal(reads,1);assert.equal(decodes,6);assert.equal(values,6);
 assert.equal(preparer.peek(snapshot.collection!.slice(0,6)).size,6);
 await warm.ready();assert.equal(reads,1);assert.equal(decodes,6);
});

test('an abandoned first-screen warm does not publish or retain incomplete images',async()=>{
 const asset=initialPlayState.inventory[0]!,row={assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:'warm_cancel.receiz.id',claimKaiUPulse:null,claimHead:null,asset};
 const controller=new AbortController();
 const preparer=createWildzMarketCardPreparer({decodeImage:async(_url,signal)=>new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}))});
 const pending=preparer.prepare([row],controller.signal);await new Promise(resolve=>setImmediate(resolve));controller.abort();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(preparer.peek([row]).size,0);
});

test('reopening during an abandoned entry read retries rather than inheriting the abort',async()=>{
 const snapshot:WildzMarketSnapshotV128={status:'ready',message:'',listings:[],purchases:[],sellables:[],collection:[]};
 let finish!:()=>void,reads=0;
 const service={snapshot:()=>snapshot,read:async()=>{if(++reads===1)await new Promise<void>(resolve=>{finish=resolve;});return snapshot;}} as unknown as WildzMarketServiceV128;
 const warm=createWildzMarketWarmup(service,createWildzMarketCardPreparer({decodeImage:async()=>{}}));
 const abandoned=warm.ready();warm.cancel();const reopened=warm.ready();
 finish();await assert.rejects(abandoned,{name:'AbortError'});await reopened;assert.equal(reads,2);
});

test('closing again cancels a queued reopen before it starts another entry read',async()=>{
 const snapshot:WildzMarketSnapshotV128={status:'ready',message:'',listings:[],purchases:[],sellables:[],collection:[]};
 let finish!:()=>void,reads=0;
 const service={snapshot:()=>snapshot,read:async()=>{if(++reads===1)await new Promise<void>(resolve=>{finish=resolve;});return snapshot;}} as unknown as WildzMarketServiceV128;
 const warm=createWildzMarketWarmup(service,createWildzMarketCardPreparer({decodeImage:async()=>{}}));
 const abandoned=assert.rejects(warm.ready(),{name:'AbortError'});warm.cancel();
 const reopened=assert.rejects(warm.ready(),{name:'AbortError'});warm.cancel();finish();
 await Promise.all([abandoned,reopened]);assert.equal(reads,1);
});

test('warming selects actual browse cards and excludes reserved holdings',async()=>{
 const cards=Array.from({length:9},(_,i)=>{
  const asset=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'warm_reserved.receiz.id',encounterId:`warm:reserved:${i}`,capturedAt:'2026-10-10T12:00:00.000Z'});
  return {assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:'warm_reserved.receiz.id',claimKaiUPulse:null,claimHead:null,asset};
 });
 const snapshot:WildzMarketSnapshotV128={status:'ready',message:'',listings:cards.slice(0,3).map(card=>({listingId:card.assetId,title:card.title,kind:'creature',asset:{kind:'creature',assetId:card.assetId},sellerHandle:card.ownerHandle,priceUsdCents:'100',status:'reserved',canBuy:false,canCancel:false})),purchases:[],sellables:[],collection:cards};
 const service={snapshot:()=>snapshot,read:async()=>snapshot} as unknown as WildzMarketServiceV128;
 const preparer=createWildzMarketCardPreparer({decodeImage:async()=>{}}),warm=createWildzMarketWarmup(service,preparer);
 await warm.ready();assert.equal(preparer.peek(cards.slice(0,3)).size,0);assert.equal(preparer.peek(cards.slice(3)).size,6);
});

test('entry warming prepares the following rows before the player starts scrolling',async()=>{
 const rows=Array.from({length:24},(_,index)=>{const asset=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'ahead_keeper.receiz.id',encounterId:`warm-ahead:${index}`,capturedAt:'2026-08-23T22:45:39.818Z'});return {assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:'ahead_keeper.receiz.id',claimKaiUPulse:null,claimHead:null,asset};});
 const snapshot:WildzMarketSnapshotV128={status:'ready',message:'',listings:[],purchases:[],sellables:[],collection:rows};
 const service={snapshot:()=>snapshot,read:async()=>snapshot} as unknown as WildzMarketServiceV128;
 const preparer=createWildzMarketCardPreparer({decodeImage:async()=>{}}),warm=createWildzMarketWarmup(service,preparer);
 await warm.ready();for(let turn=0;turn<12;turn++)await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(preparer.peek(rows.slice(6,18)).size,12);assert.equal(preparer.peek(rows.slice(18)).size,0);
});

test('a changed current first screen is complete before a warmed Market is revealed again',async()=>{
 const held=(id:string)=>{const asset=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'changed_keeper.receiz.id',encounterId:id,capturedAt:'2026-08-23T22:45:39.818Z'});return {assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle:'changed_keeper.receiz.id',claimKaiUPulse:null,claimHead:null,asset};};
 const first=held('first-warm-object'),next=held('current-warm-object');
 let snapshot:WildzMarketSnapshotV128={status:'ready',message:'',listings:[],purchases:[],sellables:[],collection:[first]};
 const service={snapshot:()=>snapshot,read:async()=>snapshot} as unknown as WildzMarketServiceV128;
 const preparer=createWildzMarketCardPreparer({decodeImage:async()=>{}}),warm=createWildzMarketWarmup(service,preparer);
 await warm.ready();snapshot={...snapshot,collection:[next]};await warm.ready();
 assert.equal(preparer.peek([next]).size,1);assert.equal(preparer.peek([next]).get(`${next.assetId}:${next.proofDigest}:changed_keeper`)?.card.asset,next.asset);
});
