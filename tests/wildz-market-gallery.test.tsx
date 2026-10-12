import assert from 'node:assert/strict';
/* eslint-disable @next/next/no-img-element -- Native image nodes measure the gallery's mount bounds. */
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {WildzMarketDiscovery} from '../src/features/market/WildzMarketDiscovery';
import {WildzMarketGalleryPage} from '../src/features/market/WildzMarketGalleryPage';
import {createWildzMarketCardPreparer} from '../src/features/market/wildz-market-card-preparation';
import {sealCollectedCard,wildsCardVerificationDiagnostics} from '../src/features/play/portable-card';
import type {WildzMarketOwnedCard} from '../src/lib/receiz/wildz-market-collection';
import {initialMarketDiscovery} from '../src/features/market/wildz-market-discovery';
import type {WildzMarketListingViewV128} from '../src/features/market/wildz-market-service-v128';
import {mountMutableReact} from './helpers/react-mutation-renderer';

const owned=(index:number):WildzMarketOwnedCard=>{
 const asset=sealCollectedCard({formId:index===71?'aerobeak-1':'mintcub-1',ownerReceizId:'seller.receiz.id',encounterId:`gallery-lookahead:${index}`,capturedAt:'2026-08-23T22:45:39.818Z'});
 return {assetId:asset.id,title:`Card ${index}`,proofDigest:asset.proof.digest,ownerHandle:'seller.receiz.id',claimKaiUPulse:null,claimHead:null,asset};
};
const noOp=()=>{};

test('a decoded card front stays painted outside the observer window for an immediate reverse scroll',async context=>{
 const saved=new Map(['IntersectionObserver','ResizeObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let notify:(near:boolean)=>void=()=>{};
 Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,value:class {
  constructor(callback:(entries:{isIntersecting:boolean}[])=>void){notify=near=>callback([{isIntersecting:near}]);}
  observe(){}disconnect(){}
 }});
 Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class {observe(){}disconnect(){}}});
 context.after(()=>{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 const view=await mountMutableReact(<WildzMarketGalleryPage active ready eager index={4} columns={2}><img alt="Complete card" src="/card.webp"/></WildzMarketGalleryPage>,{publicInstance:node=>node.type==='div'?{closest:()=>null}:null});
 context.after(()=>view.unmount());await view.flush();
 const front=view.nodes().find(node=>node.type==='img');assert.ok(front);
 notify(false);for(let frame=0;frame<4;frame++)await view.flush();
 // Momentum scrolling can reverse before any enter notification is delivered.
 assert.equal(view.nodes().find(node=>node.type==='img'),front);
 assert.equal(view.nodes().find(node=>node.props?.['data-gallery-page']===4)?.props?.['aria-hidden'],undefined);
});

test('the two-column feed reserves every row immediately and keeps resources out of creature pairs',async context=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{href:'http://127.0.0.1:3100/test-fixtures/market'},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})}});
 context.after(()=>{if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');});
 const rows=Array.from({length:72},(_,i)=>owned(i)),preparer=createWildzMarketCardPreparer({decodeImage:async()=>{}});
 const listings:WildzMarketListingViewV128[]=[{listingId:'gallery:resource',title:'Trail supplies',kind:'inventory',asset:{kind:'inventory',foodItemIds:[],materialLotIds:[],resourceLotIds:[]},sellerHandle:'seller.receiz.id',priceUsdCents:'100',status:'active',canBuy:true,canCancel:false}];
 await preparer.prepare(rows.slice(0,18));
 const view=await mountMutableReact(<WildzMarketDiscovery cardPreparer={preparer} collection={rows} listings={listings} selection={initialMarketDiscovery} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>);context.after(()=>view.unmount());
 for(let frame=0;frame<8;frame++)await view.flush();
 const pages=view.nodes().filter(node=>node.props?.['data-gallery-page']!==undefined);
 assert.equal(pages.length,37);assert.match(view.text(),/73 cards/);
 const articles=(node:typeof pages[number]):typeof pages=>[...(node.type==='article'?[node]:[]),...node.children.flatMap(articles)];
 assert.ok(pages.filter(page=>page.props?.['data-rendered']).every(page=>{const tiles=articles(page);return tiles.length===2||tiles.length===1&&tiles[0]!.props?.['data-listing-id']==='gallery:resource';}));
});

test('a ready next row renders before a slower later row finishes',async context=>{
 const saved=new Map(['window','IntersectionObserver','ResizeObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{href:'http://127.0.0.1:3100/test-fixtures/market'},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})}});
 Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,value:class {
  constructor(private callback:(entries:{isIntersecting:boolean}[])=>void,private options:{rootMargin?:string}={}){}
  observe(target:{props?:Record<string,unknown>}){const index=target.props?.['data-gallery-page'];if(typeof index==='number')this.callback([{isIntersecting:index<(this.options.rootMargin==='650px 0px'?4:8)}]);}disconnect(){}
 }});
 Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class {observe(){}disconnect(){}}});
 context.after(()=>{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 const rows=Array.from({length:30},(_,i)=>owned(i));let release!:()=>void;
 const stalled=new Promise<void>(resolve=>{release=resolve;});context.after(release);
 const preparer=createWildzMarketCardPreparer({decodeImage:async url=>{if(url.includes(encodeURIComponent(rows[10]!.proofDigest)))await stalled;}});
 await preparer.prepare(rows.slice(0,6));
 const root={clientHeight:844,getBoundingClientRect:()=>({height:844,top:0,bottom:844})};
 const view=await mountMutableReact(<WildzMarketDiscovery cardPreparer={preparer} collection={rows} listings={[]} selection={initialMarketDiscovery} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>,{publicInstance:node=>node.type==='div'||node.type==='section'?{props:node.props,closest:()=>root,getBoundingClientRect:()=>({height:450,top:0,bottom:450})}:null});context.after(()=>view.unmount());
 for(let frame=0;frame<16;frame++)await view.flush();
 const next=view.nodes().find(node=>node.props?.['data-gallery-page']===3);
 assert.ok(next);assert.equal(next.props?.['data-rendered'],true);
 const images=(node:typeof next):number=>(node.type==='img'?1:0)+node.children.reduce((sum,child)=>sum+images(child),0);
 assert.equal(images(next),2);assert.equal(preparer.peek([rows[10]!]).size,0);
});

test('a rarity filter stays loading while unseen legacy revisions are being indexed',()=>{
 const {asset,...row}=owned(71);void asset;
 const html=renderToStaticMarkup(<WildzMarketDiscovery collection={[row]} listings={[]} selection={{...initialMarketDiscovery,rarity:'rare'}} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>);
 assert.match(html,/Loading Market/);assert.doesNotMatch(html,/No matching cards|0 cards match/);
});

test('all prepared small fronts render immediately while undecoded rows preserve scroll space',async()=>{
 const rows=Array.from({length:72},(_,i)=>owned(i)),preparer=createWildzMarketCardPreparer({decodeImage:async()=>{}});
 await preparer.prepare(rows.slice(0,18));
 const before=wildsCardVerificationDiagnostics();
 const html=renderToStaticMarkup(<WildzMarketDiscovery cardPreparer={preparer} collection={rows} listings={[]} selection={initialMarketDiscovery} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>);
 assert.deepEqual(wildsCardVerificationDiagnostics(),before);
 assert.equal((html.match(/complete creature card/g)??[]).length,18);assert.doesNotMatch(html,/View creature · Card 71/);
 const distant=renderToStaticMarkup(<>{Array.from({length:11},(_,i)=><WildzMarketGalleryPage key={i} active ready={false} index={i+1} columns={2}><img alt={`Distant ${i}`} src="/card.webp"/></WildzMarketGalleryPage>)}</>);
 assert.doesNotMatch(distant,/<img/);assert.equal((distant.match(/height:450px/g)??[]).length,11);
});

test('a transient preparation failure cannot shrink an 86-card catalogue as effects settle',async context=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{href:'http://127.0.0.1:3100/test-fixtures/market'},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})}});
 context.after(()=>{if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');});
 const rows=Array.from({length:86},(_,index)=>owned(index));
 const preparer=createWildzMarketCardPreparer({decodeImage:async url=>{if(url.includes(encodeURIComponent(rows[1]!.proofDigest)))throw Error('network interrupted');}});
 const view=await mountMutableReact(<WildzMarketDiscovery cardPreparer={preparer} collection={rows} listings={[]} selection={initialMarketDiscovery} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>);
 context.after(()=>view.unmount());
 for(let frame=0;frame<12;frame++)await view.flush();
 assert.match(view.text(),/86 cards/);assert.doesNotMatch(view.text(),/85 cards/);
});

test('a new identity service can prepare a whole card that failed in the previous service',async context=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{href:'http://127.0.0.1:3100/test-fixtures/market'},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})}});
 context.after(()=>{if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');});
 const rows=Array.from({length:6},(_,i)=>owned(i));
 const failed=createWildzMarketCardPreparer({decodeImage:async()=>{throw Error('guest read failed');}});
 const render=(cardPreparer:ReturnType<typeof createWildzMarketCardPreparer>)=><WildzMarketDiscovery cardPreparer={cardPreparer} collection={rows} listings={[]} selection={initialMarketDiscovery} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>;
 const view=await mountMutableReact(render(failed));context.after(()=>view.unmount());
 for(let frame=0;frame<6;frame++)await view.flush();assert.equal(failed.peek(rows).size,0);
 const held=createWildzMarketCardPreparer({decodeImage:async()=>{}});
 await view.update(render(held));for(let frame=0;frame<8;frame++)await view.flush();
 assert.equal(held.peek(rows).size,6);assert.equal(view.nodes().filter(node=>node.type==='img').length,6);
});

test('scrolling back uses retained fronts without rereading evicted complete proof objects',async context=>{
 const saved=new Map(['window','IntersectionObserver','ResizeObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const watches:{target:{props?:Record<string,unknown>};margin:string;notify(near:boolean):void}[]=[];
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{href:'http://127.0.0.1:3100/test-fixtures/market'},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})}});
 Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,value:class {
  constructor(private callback:(entries:{isIntersecting:boolean}[])=>void,private options:{rootMargin?:string}={}){}
  observe(target:{props?:Record<string,unknown>}){watches.push({target,margin:this.options.rootMargin??'',notify:near=>this.callback([{isIntersecting:near}])});}disconnect(){}
 }});
 Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class {observe(){}disconnect(){}}});
 context.after(()=>{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 const rows=Array.from({length:80},(_,i)=>owned(i)),reads=new Map<string,number>();
 const preparer=createWildzMarketCardPreparer({readCard:async row=>{reads.set(row.assetId,(reads.get(row.assetId)??0)+1);return row.asset!;},decodeImage:async()=>{}});
 preparer.pin(rows.slice(0,6));await preparer.prepare(rows.slice(0,18));
 const root={clientHeight:844,getBoundingClientRect:()=>({height:844,top:0,bottom:844})};
 const view=await mountMutableReact(<WildzMarketDiscovery cardPreparer={preparer} collection={rows} listings={[]} selection={initialMarketDiscovery} onChange={noOp} onView={noOp} loading={false} onRefresh={noOp} refreshing={false}/>,{publicInstance:node=>node.type==='div'||node.type==='section'?{props:node.props,closest:()=>root,getBoundingClientRect:()=>({height:900,top:0,bottom:900})}:null});
 context.after(()=>view.unmount());
 for(let frame=0;frame<6;frame++)await view.flush();
 const page=[...watches].reverse().find(watch=>watch.target.props?.['data-gallery-page']===3&&watch.margin==='650px 0px');
 assert.ok(page);page.notify(true);
 for(let frame=0;frame<6;frame++)await view.flush();
 page.notify(false);await view.flush();
 await preparer.prepare(rows.slice(18));assert.equal(preparer.peek(rows.slice(6,8)).size,0);
 const approach=[...watches].reverse().find(watch=>watch.target.props?.['data-gallery-page']===3&&watch.margin==='2200px 0px');
 approach?.notify(false);await view.flush();approach?.notify(true);page.notify(true);
 for(let frame=0;frame<12;frame++)await view.flush();
 assert.equal(preparer.peek(rows.slice(6,8)).size,0);
 assert.equal(preparer.peekGallery(rows.slice(6,8)).size,2);
 assert.ok(rows.slice(6,8).every(row=>reads.get(row.assetId)===1));assert.ok(preparer.peek(rows).size<=48);
 const secondPage=view.nodes().find(node=>node.props?.['data-gallery-page']===3)!;
 const images=(node:typeof secondPage):string[]=>[...(node.type==='img'?[String(node.props?.src)]:[]),...node.children.flatMap(images)];
 assert.equal(images(secondPage).length,2);assert.ok(images(secondPage).every(src=>src.startsWith('data:image/svg+xml')));
});
