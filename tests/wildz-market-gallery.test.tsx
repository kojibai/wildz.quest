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
import {mountMutableReact} from './helpers/react-mutation-renderer';

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

test('scrolling back restores evicted whole cards before mounting their images without a cold image API request',async context=>{
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
 const sentinel=watches.find(watch=>watch.target.props?.className==='loadSentinel'&&watch.margin.includes('2200'));
 assert.ok(sentinel,JSON.stringify(watches.map(watch=>({className:watch.target.props?.className,page:watch.target.props?.['data-gallery-page'],hidden:watch.target.props?.['aria-hidden'],margin:watch.margin}))));sentinel.notify(true);
 for(let frame=0;frame<6;frame++)await view.flush();
 const page=watches.find(watch=>watch.target.props?.['data-gallery-page']===1&&watch.margin==='650px 0px');
 assert.ok(page);page.notify(true);
 for(let frame=0;frame<6;frame++)await view.flush();
 page.notify(false);await view.flush();
 await preparer.prepare(rows.slice(18));assert.equal(preparer.peek(rows.slice(6,12)).size,0);
 const approach=watches.find(watch=>watch.target.props?.['data-gallery-page']===1&&watch.margin==='2200px 0px');
 approach?.notify(false);await view.flush();approach?.notify(true);page.notify(true);
 for(let frame=0;frame<12;frame++)await view.flush();
 assert.equal(preparer.peek(rows.slice(6,12)).size,6);
 assert.ok(rows.slice(6,12).every(row=>(reads.get(row.assetId)??0)>=2));assert.ok(preparer.peek(rows).size<=48);
 const secondPage=view.nodes().find(node=>node.props?.['data-gallery-page']===1)!;
 const images=(node:typeof secondPage):string[]=>[...(node.type==='img'?[String(node.props?.src)]:[]),...node.children.flatMap(images)];
 assert.equal(images(secondPage).length,6);assert.ok(images(secondPage).every(src=>src.startsWith('data:image/svg+xml')));
});
