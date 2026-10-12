import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initialPlayState} from '../src/features/play/game-state';
import {sealCollectedCard} from '../src/features/play/portable-card';
import {admitLegacyCard,appendLivingCardHistory} from '../src/features/play/living-card-proof';
import {calculateWildzMarketLocalCardV129} from '../src/features/market/wildz-market-value-local-v129';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import {createWildzMarketCardPreparer,readWildzMarketCard,wildzMarketCardImageUrl,type PreparedWildzMarketCard} from '../src/features/market/wildz-market-card-preparation';

const asset=initialPlayState.inventory[0]!;
const card=(ownerHandle='seller.receiz.id'):WildzMarketOwnedCard=>({assetId:asset.id,title:asset.manifest.name,proofDigest:asset.proof.digest,ownerHandle,claimKaiUPulse:null,claimHead:null});
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('visible page waits for every decoded exact image and value with at most four cards in flight',async()=>{
 const rows=Array.from({length:9},(_,i)=>card(`seller${i}.receiz.id`));
 const releases:(()=>void)[]=[],images:string[]=[],values:string[]=[];let active=0,maximum=0,reads=0,published=false;
 const preparer=createWildzMarketCardPreparer({readCard:async()=>{reads++;return asset;},decodeImage:async url=>{
  images.push(url);active++;maximum=Math.max(maximum,active);await new Promise<void>(resolve=>releases.push(resolve));active--;
 },readValue:async id=>{values.push(id);}});
 const pending=preparer.prepare([...rows,rows[0]!]).then(ready=>{published=true;return ready;});
 await turn();assert.equal(releases.length,4);assert.equal(published,false);assert.equal(values.length,4);
 releases.splice(0).forEach(release=>release());await turn();assert.equal(releases.length,4);assert.equal(published,false);
 releases.splice(0).forEach(release=>release());await turn();assert.equal(releases.length,1);assert.equal(published,false);
 releases.splice(0).forEach(release=>release());const ready=await pending;
 assert.equal(ready.length,9);assert.equal(maximum,4);assert.equal(values.length,9);
 assert.ok(images.every(url=>url.startsWith('data:image/svg+xml')));assert.ok(images.every(url=>decodeURIComponent(url).includes(asset.proof.digest)));
 assert.equal((await preparer.prepare(rows.map(row=>({...row,value:{proofValuePhiMicro:'1',displayUsdCents:null,valuationKaiUPulse:'100',algorithm:'local'}})))).length,9);
 assert.equal(reads,9);assert.equal(images.length,9);assert.equal(values.length,9);
});

test('an unavailable image, missing card, or wrong card revision cannot paint an incomplete tile',async()=>{
 const imageAsset=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'image.receiz.id',encounterId:'image-decode-error',capturedAt:'2026-08-23T22:45:39.818Z'});
 const missing=card('missing.receiz.id'),image={...card('image.receiz.id'),assetId:imageAsset.id,proofDigest:imageAsset.proof.digest},mismatch={...card('wrong.receiz.id'),proofDigest:'sha256:wrong'},good=card('ready.receiz.id');
 const values:string[]=[];
 const preparer=createWildzMarketCardPreparer({readCard:async row=>{if(row===missing)throw Error('not found');return row===image?imageAsset:asset;},decodeImage:async url=>{if(url.includes(encodeURIComponent(imageAsset.proof.digest)))throw Error('unavailable');},readValue:async id=>{values.push(id);}});
 const ready=await preparer.prepare([missing,image,mismatch,good]);
 assert.deepEqual(ready.map(row=>row.card.ownerHandle),['ready.receiz.id']);assert.deepEqual(values.sort(),[asset.id,imageAsset.id].sort());
});

test('closing or paging cancels pending card work before image, value, or page publication',async()=>{
 const controller=new AbortController();let cancelled=false,images=0,values=0;
 const preparer=createWildzMarketCardPreparer({readCard:async(_row,signal)=>new Promise((_resolve,reject)=>{
  signal?.addEventListener('abort',()=>{cancelled=true;reject(new DOMException('cancelled','AbortError'));},{once:true});
 }),decodeImage:async()=>{images++;},readValue:async()=>{values++;}});
 const pending=preparer.prepare([card('cancelled.receiz.id')],controller.signal);
 await turn();controller.abort();await assert.rejects(pending,{name:'AbortError'});
 assert.equal(cancelled,true);assert.equal(images,0);assert.equal(values,0);
});

test('card preparation retains a bounded cache rather than the full market collection',async()=>{
 let reads=0;const rows=Array.from({length:49},(_,i)=>card(`cached${i}.receiz.id`));
 const preparer=createWildzMarketCardPreparer({readCard:async()=>{reads++;return asset;},decodeImage:async()=>{}});
 assert.equal((await preparer.prepare(rows)).length,49);assert.equal(reads,49);
 await preparer.prepare([rows[48]!]);assert.equal(reads,49);
 await preparer.prepare([rows[0]!]);assert.equal(reads,50);
});

test('first-screen pins survive deep scrolling while the complete asset cache stays bounded',async()=>{
 const rows=Array.from({length:80},(_,i)=>card(`pinned${i}.receiz.id`));
 const preparer=createWildzMarketCardPreparer({readCard:async()=>asset,decodeImage:async()=>{}});
 await preparer.prepare(rows.slice(0,6));preparer.pin(rows.slice(0,6));
 await preparer.prepare(rows.slice(6));
 assert.equal(preparer.peek(rows).size,48);
 assert.equal(preparer.peek(rows.slice(0,6)).size,6);
 assert.equal(preparer.peek(rows.slice(6,12)).size,0);
});

test('shared public card reader normalizes the owner and reuses the exact verified revision',async()=>{
 const original=globalThis.fetch,urls:string[]=[];
 globalThis.fetch=async input=>{urls.push(String(input));return new Response(JSON.stringify({ok:true,record:{schema:'receiz.wilds_public_card.v1',assetId:asset.id,sourceUrl:`https://wildz.quest/cards/${encodeURIComponent(asset.id)}`,registeredAt:'2026-07-15T12:00:00.000Z',asset}}));};
 try{
  const row=card('shared_reader.receiz.id'),first=await readWildzMarketCard(row),second=await readWildzMarketCard({...row,ownerHandle:'@SHARED_READER'});
  assert.equal(first,second);assert.deepEqual(urls,[`/api/cards/${encodeURIComponent(asset.id)}?profile=shared_reader`]);
  await assert.rejects(readWildzMarketCard({...card('wrong_digest.receiz.id'),proofDigest:'sha256:wrong'}),/exact card revision/);
 }finally{globalThis.fetch=original;}
});

test('verified embedded cards need no fetch and tampered embedded cards never enter preparation',async()=>{
 const original=globalThis.fetch;let reads=0;globalThis.fetch=async()=>{reads++;throw Error('unexpected public read');};
 try{
  const row={...card('embedded.receiz.id'),asset};assert.equal(await readWildzMarketCard(row),asset);assert.equal(await readWildzMarketCard(row),asset);
  const bad=structuredClone(asset);bad.proof.digest='sha256:tampered';
  await assert.rejects(readWildzMarketCard({...card('bad_embedded.receiz.id'),asset:bad}),/could not be verified/);assert.equal(reads,0);
 }finally{globalThis.fetch=original;}
});

test('a duplicate with unresolved ownership still prepares the exact public artwork',async()=>{
 const row={...card(''),artworkOwnerHandle:'source_keeper.receiz.id'};
 const urls:string[]=[];
 const ready=await createWildzMarketCardPreparer({readCard:async()=>asset,decodeImage:async url=>{urls.push(url);}}).prepare([row]);
 assert.equal(ready.length,1);assert.equal(ready[0]?.card.ownerHandle,'');assert.match(urls[0]!,/^data:image\/svg\+xml/);assert.ok(decodeURIComponent(urls[0]!).includes(asset.proof.digest));
});

test('local value failure cannot remove a proof-verified card with decoded artwork',async()=>{
 const row=card('value_retry.receiz.id');
 const preparer=createWildzMarketCardPreparer({readCard:async()=>asset,decodeImage:async()=>{},readValue:async()=>{throw Error('local value temporarily unavailable');}});
 const ready=await preparer.prepare([row]);
 assert.equal(ready.length,1);assert.equal(ready[0]?.card.asset.proof.digest,asset.proof.digest);
});

test('a complete proof object supplies its artwork without a second image request',async context=>{
 context.mock.method(globalThis,'fetch',async()=>{throw Error('A complete local proof object must not fetch artwork.');});
 const row={...card('whole_object.receiz.id'),asset};let decoded='';
 const ready=await createWildzMarketCardPreparer({decodeImage:async url=>{decoded=url;}}).prepare([row]);
 assert.equal(ready.length,1);assert.match(decoded,/^data:image\/svg\+xml/);
 const artwork=decodeURIComponent(decoded.slice(decoded.indexOf(',')+1));
 assert.ok(artwork.includes(asset.manifest.name));assert.ok(artwork.includes(asset.proof.digest));
});

test('the bounded prepared view owns artwork instead of the permanently held inventory object',async()=>{
 const held=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'held_art.receiz.id',encounterId:'artwork:lifetime',capturedAt:'2026-08-23T22:45:39.818Z'});
 const row={...card('held_art.receiz.id'),assetId:held.id,proofDigest:held.proof.digest,asset:held};
 const [prepared]=await createWildzMarketCardPreparer({decodeImage:async()=>{}}).prepare([row]);
 assert.equal(wildzMarketCardImageUrl(prepared!.card),prepared!.imageUrl);
 // A new metadata view of the original long-lived inventory asset must not
 // keep a previously rendered URI reachable after prepared-cache eviction.
 assert.ok(!wildzMarketCardImageUrl({...row}).startsWith('data:image/svg+xml'));
 assert.equal(prepared!.card.asset,held);
});

test('a value read for a newer revision cannot replace the loaded complete object artwork',async()=>{
 const original=admitLegacyCard(sealCollectedCard({formId:'mintcub-1',ownerReceizId:'revision.receiz.id',encounterId:'market:exact-artwork',capturedAt:'2026-08-23T22:45:39.818Z'}),'2026-08-23T22:45:39.818Z');
 const newer=appendLivingCardHistory({asset:original,event:{eventId:'artwork:new-revision',rulesetVersion:'wildz.progression.v1',occurredAt:'2026-10-12T06:00:00.000Z',source:{mode:'training',activityId:'artwork:training',actorId:'revision.receiz.id',authority:'local'},evidence:{},effects:[{kind:'progress',xpDelta:1,growthEvents:[]}]}});
 assert.equal(original.id,newer.id);assert.notEqual(original.proof.digest,newer.proof.digest);
 const newerDisplay=await calculateWildzMarketLocalCardV129(newer,{valuationKaiUPulse:'14063111123456',usdPerPhiMicrocents:'0'});
 assert.equal(newerDisplay.status,'unavailable');assert.ok(newerDisplay.artworkSvg?.includes(newer.proof.digest));
 let decoded='';
 const row={...card('revision.receiz.id'),assetId:original.id,proofDigest:original.proof.digest};
 const [ready]=await createWildzMarketCardPreparer({readCard:async()=>original,readValue:async()=>newerDisplay,decodeImage:async url=>{decoded=url;}}).prepare([row]);
 assert.equal(ready?.card.asset.proof.digest,original.proof.digest);
 const svg=decodeURIComponent(decoded.slice(decoded.indexOf(',')+1));
 assert.ok(svg.includes(original.proof.digest));assert.ok(!svg.includes(newer.proof.digest));
});

test('a transferred display card recovers immutable canonical artwork without changing its owner',async context=>{
 const row=card('display_collector.receiz.id'),scoped=`/api/cards/${encodeURIComponent(asset.id)}?profile=display_collector`;
 context.mock.method(globalThis,'fetch',async (input:RequestInfo|URL)=>String(input)===scoped?Response.json({ok:false,error:'wildz_public_card_not_found'},{status:404}):Response.json({ok:true,record:{schema:'receiz.wilds_public_card.v1',assetId:asset.id,sourceUrl:`https://wildz.quest/cards/${encodeURIComponent(asset.id)}`,registeredAt:'2026-07-15T12:00:00.000Z',asset}}));
 const result=await readWildzMarketCard(row);
 assert.equal(result.proof.digest,asset.proof.digest);assert.equal(row.ownerHandle,'display_collector.receiz.id');assert.equal(result.manifest.ownerReceizId,asset.manifest.ownerReceizId);
 await assert.rejects(readWildzMarketCard({...row,ownerHandle:'display_wrong_digest.receiz.id',proofDigest:`sha256:${'0'.repeat(64)}`}),/exact card revision/);
});

test('lookahead admits each complete decoded object while the rest of its group is still pending',async()=>{
 const rows=Array.from({length:9},(_,index)=>card(`ahead_progress${index}.receiz.id`)),releases:(()=>void)[]=[],arrivals:PreparedWildzMarketCard[]=[];
 let settled=false;
 const preparer=createWildzMarketCardPreparer({readCard:async()=>asset,decodeImage:async()=>new Promise<void>(resolve=>releases.push(resolve))});
 const prepare=preparer.prepare as (rows:readonly WildzMarketOwnedCard[],signal:AbortSignal|undefined,onReady:(card:PreparedWildzMarketCard)=>void)=>Promise<readonly PreparedWildzMarketCard[]>;
 const pending=prepare(rows,undefined,card=>arrivals.push(card)).then(result=>{settled=true;return result;});
 await turn();releases.shift()!();await turn();
 const early=arrivals.length,wholeGroupSettled=settled;
 while(!settled){releases.splice(0).forEach(resolve=>resolve());await turn();}
 await pending;
 assert.equal(early,1);assert.equal(wholeGroupSettled,false);assert.equal(arrivals.length,9);
});
