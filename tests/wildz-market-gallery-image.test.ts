import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildzMarketGalleryImage} from '../src/features/market/wildz-market-gallery-image';

for(const stalled of ['decode','encode','read'] as const)test(`cancelled gallery ${stalled} settles and releases its image and canvas`,async context=>{
 const saved=new Map(['window','document','FileReader'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const canvas={width:0,height:0,getContext:()=>({drawImage(){}}),toBlob(callback:(value:Blob)=>void){if(stalled!=='encode')callback(new Blob(['preview']));}};
 const image={src:'',decoding:'',decode:()=>stalled==='decode'?new Promise<void>(()=>{}):Promise.resolve()};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{Image:class {constructor(){return image;}}}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>canvas}});
 Object.defineProperty(globalThis,'FileReader',{configurable:true,value:class {onload:()=>void=()=>{};onerror:()=>void=()=>{};result='data:image/webp;base64,cHJldmlldw==';readAsDataURL(){if(stalled!=='read')this.onload();}abort(){}}});
 context.after(()=>{for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
 const controller=new AbortController();
 const pending=createWildzMarketGalleryImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg width="750" height="1050" viewBox="0 0 750 1050"></svg>')}`,controller.signal);
 const outcome=pending.then(()=> 'painted',cause=>cause.name);
 for(let frame=0;frame<3;frame++)await new Promise<void>(resolve=>setImmediate(resolve));
 controller.abort();
 assert.equal(await Promise.race([outcome,new Promise<string>(resolve=>setImmediate(()=>resolve('still pending')))]),'AbortError');
 assert.equal(image.src,'');assert.equal(canvas.width*canvas.height,1);
});
