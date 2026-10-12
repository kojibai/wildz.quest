import assert from 'node:assert/strict';
/* eslint-disable @next/next/no-img-element -- Native image nodes measure the gallery's mount bounds. */
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {WildzMarketDiscovery} from '../src/features/market/WildzMarketDiscovery';
import {WildzMarketGalleryPage,wildzMarketGalleryLookahead} from '../src/features/market/WildzMarketGalleryPage';
import {createWildzMarketCardPreparer} from '../src/features/market/wildz-market-card-preparation';
import {sealCollectedCard,wildsCardVerificationDiagnostics} from '../src/features/play/portable-card';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import {initialMarketDiscovery} from '../src/features/market/wildz-market-discovery';

const owned=(index:number):WildzMarketOwnedCard=>{
 const asset=sealCollectedCard({formId:index===71?'aerobeak-1':'mintcub-1',ownerReceizId:'seller.receiz.id',encounterId:`gallery-lookahead:${index}`,capturedAt:'2026-08-23T22:45:39.818Z'});
 return {assetId:asset.id,title:`Card ${index}`,proofDigest:asset.proof.digest,ownerHandle:'seller.receiz.id',claimKaiUPulse:null,claimHead:null,asset};
};
const noOp=()=>{};

test('a rarity filter stays loading while unseen legacy revisions are being indexed',()=>{
 const {asset,...row}=owned(71);void asset;
 const html=renderToStaticMarkup(<WildzMarketDiscovery collection={[row]} listings={[]} selection={{...initialMarketDiscovery,rarity:'rare'}} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>);
 assert.match(html,/Loading Market/);assert.doesNotMatch(html,/No matching cards|0 cards match/);
});

test('lookahead decodes exactly the next two groups before they are mounted',async()=>{
 const rows=Array.from({length:72},(_,i)=>owned(i)),decoded:string[]=[];
 const preparer=createWildzMarketCardPreparer({decodeImage:async url=>{decoded.push(url);}});
 const ahead=wildzMarketGalleryLookahead(rows,6);
 const prepared=await preparer.prepare(ahead);
 assert.deepEqual(prepared.map(card=>card.card.title),Array.from({length:12},(_,i)=>`Card ${i+6}`));
 assert.equal(decoded.length,12);assert.equal(preparer.peek(rows.slice(0,6)).size,0);assert.equal(preparer.peek(rows.slice(18)).size,0);
 const html=renderToStaticMarkup(<WildzMarketGalleryPage active index={1} columns={2}>{ahead.map(row=><img key={row.assetId} alt={row.title} src="/card.webp"/>)}</WildzMarketGalleryPage>);
 assert.doesNotMatch(html,/<img/);assert.match(html,/height:900px/);
});

test('a prepared first screen renders six cards while all remaining groups preserve scroll space without images',async()=>{
 const rows=Array.from({length:72},(_,i)=>owned(i)),preparer=createWildzMarketCardPreparer({decodeImage:async()=>{}});
 await preparer.prepare(rows.slice(0,18));
 const before=wildsCardVerificationDiagnostics();
 const html=renderToStaticMarkup(<WildzMarketDiscovery cardPreparer={preparer} collection={rows} listings={[]} selection={initialMarketDiscovery} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>);
 assert.deepEqual(wildsCardVerificationDiagnostics(),before);
 assert.equal((html.match(/complete creature card/g)??[]).length,6);assert.doesNotMatch(html,/View creature · Card 6|View creature · Card 71/);
 const distant=renderToStaticMarkup(<>{Array.from({length:11},(_,i)=><WildzMarketGalleryPage key={i} active index={i+1} columns={2}><img alt={`Distant ${i}`} src="/card.webp"/></WildzMarketGalleryPage>)}</>);
 assert.doesNotMatch(distant,/<img/);assert.equal((distant.match(/height:900px/g)??[]).length,11);
});
