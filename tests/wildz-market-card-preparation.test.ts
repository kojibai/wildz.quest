import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initialPlayState} from '../src/features/play/game-state';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import {createWildzMarketCardPreparer,readWildzMarketCard} from '../src/features/market/wildz-market-card-preparation';

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
 await turn();assert.equal(releases.length,4);assert.equal(published,false);assert.equal(values.length,0);
 releases.splice(0).forEach(release=>release());await turn();assert.equal(releases.length,4);assert.equal(published,false);
 releases.splice(0).forEach(release=>release());await turn();assert.equal(releases.length,1);assert.equal(published,false);
 releases.splice(0).forEach(release=>release());const ready=await pending;
 assert.equal(ready.length,9);assert.equal(maximum,4);assert.equal(values.length,9);
 assert.ok(images.every(url=>/profile=seller[0-8]&digest=/.test(url)));assert.ok(images.every(url=>!url.includes('.receiz.id')));
 assert.equal((await preparer.prepare(rows.map(row=>({...row,value:{proofValuePhiMicro:'1',displayUsdCents:null,valuationKaiUPulse:'100',algorithm:'local'}})))).length,9);
 assert.equal(reads,9);assert.equal(images.length,9);assert.equal(values.length,9);
});

test('an unavailable image, missing card, or wrong card revision omits the entire tile before values are read',async()=>{
 const missing=card('missing.receiz.id'),image=card('image.receiz.id'),mismatch={...card('wrong.receiz.id'),proofDigest:'sha256:wrong'},good=card('ready.receiz.id');
 const values:string[]=[];
 const preparer=createWildzMarketCardPreparer({readCard:async row=>{if(row===missing)throw Error('not found');return asset;},decodeImage:async url=>{if(url.includes('profile=image&'))throw Error('unavailable');},readValue:async id=>{values.push(id);}});
 const ready=await preparer.prepare([missing,image,mismatch,good]);
 assert.deepEqual(ready.map(row=>row.card.ownerHandle),['ready.receiz.id']);assert.deepEqual(values,[asset.id]);
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
