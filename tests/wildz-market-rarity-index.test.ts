import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sealCollectedCard,wildsCardVerificationDiagnostics} from '../src/features/play/portable-card';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import {createWildzMarketRarityIndex} from '../src/features/market/wildz-market-rarity-index';
import {discoverWildzOwnedCards,initialMarketDiscovery} from '../src/features/market/wildz-market-discovery';
import {wildzMarketCardKey} from '../src/features/market/wildz-market-card-preparation';

const owned=(formId:string,title:string):WildzMarketOwnedCard=>{
 const asset=sealCollectedCard({formId,ownerReceizId:'seller.receiz.id',encounterId:`rarity-index:${title}`,capturedAt:'2026-08-23T22:45:39.818Z'});
 return {assetId:asset.id,title,proofDigest:asset.proof.digest,ownerHandle:'seller.receiz.id',claimKaiUPulse:null,claimHead:null,asset};
};
const legacy=(card:WildzMarketOwnedCard)=>{const {asset,...row}=card;void asset;return row;};
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('rarity discovery finds an unprepared legacy card anywhere in the catalogue without decoding artwork',async()=>{
 const trail=owned('mintcub-1','Trail'),rare=owned('aerobeak-1','Last rare');
 const rows=[trail,...Array.from({length:71},(_,i)=>legacy(owned('mintcub-1',`Trail ${i}`))),legacy(rare)];
 const assets=new Map([trail,rare,...Array.from({length:71},(_,i)=>owned('mintcub-1',`Trail ${i}`))].map(row=>[row.assetId,row.asset!]));
 const index=createWildzMarketRarityIndex({readCard:async row=>assets.get(row.assetId)!});
 assert.equal(index.snapshot(rows).complete,false);
 const result=await index.scan(rows);
 assert.equal(result.complete,true);
 const selected=discoverWildzOwnedCards(rows,[],{...initialMarketDiscovery,rarity:'rare'},row=>row?result.rarities.get(wildzMarketCardKey(row))??null:null);
 assert.deepEqual(selected.map(row=>row.title),['Last rare']);
 assert.ok([...result.rarities.values()].every(value=>typeof value==='string'||value===null));
 assert.equal(index.snapshot(rows).complete,true);
});

test('catalogue indexing caps reads at four and keeps no-match results pending until all revisions settle',async()=>{
 const cards=Array.from({length:9},(_,i)=>owned('aerobeak-1',`Rare ${i}`)),rows=cards.map(legacy);
 const release:(()=>void)[]=[];let reading=0,maximum=0;
 const index=createWildzMarketRarityIndex({yieldToBrowser:async()=>{},readCard:async row=>{reading++;maximum=Math.max(maximum,reading);await new Promise<void>(resolve=>release.push(resolve));reading--;return cards.find(card=>card.assetId===row.assetId)!.asset!;}});
 const pending=index.scan(rows);await turn();assert.equal(release.length,4);assert.equal(index.snapshot(rows).complete,false);
 release.splice(0).forEach(resolve=>resolve());await turn();assert.equal(release.length,4);assert.equal(index.snapshot(rows).complete,false);
 release.splice(0).forEach(resolve=>resolve());await turn();assert.equal(release.length,1);assert.equal(index.snapshot(rows).complete,false);
 release.splice(0).forEach(resolve=>resolve());assert.equal((await pending).complete,true);assert.equal(maximum,4);
});

test('embedded exact seals are indexed locally while tampered and wrong revisions never supply rarity',async()=>{
 const good=owned('aerobeak-1','Good'),tampered=structuredClone(owned('ledgerfox-1','Tampered'));
 tampered.asset!.manifest.name='Altered without resealing';
 const wrong={...legacy(good),proofDigest:'sha256:wrong'};let reads=0;
 const index=createWildzMarketRarityIndex({readCard:async()=>{reads++;return good.asset!;}});
 const result=await index.scan([good,tampered,wrong]);
 assert.equal(result.complete,true);assert.equal(result.rarities.get(wildzMarketCardKey(good)),'rare');
 assert.equal(result.rarities.get(wildzMarketCardKey(tampered)),null);assert.equal(result.rarities.get(wildzMarketCardKey(wrong)),null);assert.equal(reads,1);
});

test('catalogue metadata prunes removed identities and rescans a changed exact revision',async()=>{
 const old=owned('mintcub-1','Old'),rare=owned('aerobeak-1','New');let reads=0;
 const index=createWildzMarketRarityIndex({readCard:async row=>{reads++;return row.assetId===old.assetId?old.asset!:rare.asset!;}});
 await index.scan([legacy(old)]);const before=await index.scan([legacy(rare)]);
 assert.equal(before.rarities.size,1);assert.equal(before.rarities.has(wildzMarketCardKey(old)),false);assert.equal(before.rarities.get(wildzMarketCardKey(rare)),'rare');
 await index.scan([legacy(rare)]);assert.equal(reads,2);
});

test('closing the market cancels unknown rarity reads without publishing incomplete metadata',async()=>{
 const row=legacy(owned('aerobeak-1','Cancelled'));let observed=false;
 const index=createWildzMarketRarityIndex({yieldToBrowser:async()=>{},readCard:async(_row,signal)=>new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>{observed=true;reject(new DOMException('cancelled','AbortError'));},{once:true}))});
 const controller=new AbortController(),pending=index.scan([row],controller.signal);await turn();controller.abort();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(observed,true);assert.equal(index.snapshot([row]).complete,false);
});


test('render-time catalogue snapshots never inspect or verify complete embedded cards',()=>{
 const rows=Array.from({length:72},(_,i)=>owned('mintcub-1',`Snapshot ${i}`));
 const index=createWildzMarketRarityIndex(),before=wildsCardVerificationDiagnostics();
 const snapshot=index.snapshot(rows);
 assert.deepEqual(wildsCardVerificationDiagnostics(),before);assert.equal(snapshot.complete,false);assert.equal(snapshot.rarities.size,0);
});

test('embedded catalogue verification yields after each four-card batch',async()=>{
 const rows=Array.from({length:9},(_,i)=>owned('aerobeak-1',`Yield ${i}`));
 const release:(()=>void)[]=[];
 const index=createWildzMarketRarityIndex({yieldToBrowser:()=>new Promise<void>(resolve=>release.push(resolve))});
 const pending=index.scan(rows);await turn();assert.equal(index.snapshot(rows).rarities.size,0);assert.equal(release.length,1);
 release.shift()!();await turn();assert.equal(index.snapshot(rows).rarities.size,4);assert.equal(release.length,1);
 release.shift()!();await turn();assert.equal(index.snapshot(rows).rarities.size,8);assert.equal(release.length,1);
 release.shift()!();assert.equal((await pending).complete,true);assert.equal(index.snapshot(rows).rarities.size,9);
});
