import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildzMarketValueBrowserPortV129} from '../src/features/market/wildz-market-value-browser-v129';
import {sealCollectedCard} from '../src/features/play/portable-card';
import type {WildzMarketValueRead} from '../src/features/market/wildz-market-value';

const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'buyer.receiz.id',encounterId:'browser-value:one',capturedAt:'2026-10-10T12:00:00.000Z'});
class PublicWorker extends EventTarget {
  request!: {requestId:number;assetId:string;card:typeof card;evaluation:{valuationKaiUPulse:string;usdBasis?:unknown}};
  stopped=false;
 constructor(){super();queueMicrotask(()=>this.signalReady());}
 signalReady(){this.dispatchEvent(new MessageEvent('message',{data:{type:'value-ready'}}));}
  postMessage(request:PublicWorker['request']){this.request=request;}
  terminate(){this.stopped=true;}
  reply(result:WildzMarketValueRead){this.dispatchEvent(new MessageEvent('message',{data:{type:'value-result',requestId:this.request.requestId,result}}));}
}
function ready(worker:PublicWorker):WildzMarketValueRead{return {status:'ready',value:{assetId:card.id,proofDigest:card.proof.digest,historyHead:null,algorithm:'worker-transport-test',policyChecksum:'test',projectionDigest:'test',originKaiUPulse:null,valuationKaiUPulse:worker.request.evaluation.valuationKaiUPulse,proofValuePhiMicro:'1000000',marketReferenceValuePhiMicro:null,displayUsdCents:null,priceBasisDigest:null,samples:[],calculation:[]}};}
async function opened(workers:PublicWorker[],count:number){for(let n=0;workers.length<count&&n<20;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(workers.length,count);}
function fixture(){const workers:PublicWorker[]=[],requests:unknown[]=[];let current=true,readyCalls=0,at=16000000123456n;
 const port=createWildzMarketValueBrowserPortV129({ownerHandle:'buyer.receiz.id',current(){if(!current)throw Error('identity changed');},card:async()=>card,
  now:()=>at.toString(),
  ensureReady:async()=>{readyCalls++;return true;},
  fetcher:async (_url,options)=>{requests.push(options);return Response.json({ok:false},{status:401});},worker(){const worker=new PublicWorker();workers.push(worker);return worker as unknown as Worker;}});
 return {port,workers,requests,readyCalls:()=>readyCalls,advance:()=>{at+=1_000_000n;},changeIdentity:()=>{current=false;}};
}

test('visible-card reads calculate without fetch or wallet readiness and reuse a bounded worker',async()=>{
 const f=fixture(),a=f.port.read(card.id),b=f.port.read(card.id);await opened(f.workers,1);
 const worker=f.workers[0]!;assert.deepEqual(Object.keys(worker.request).sort(),['assetId','card','evaluation','requestId','type']);
 assert.equal(worker.request.card.proof.digest,card.proof.digest);assert.match(worker.request.evaluation.valuationKaiUPulse,/^[1-9][0-9]*$/);
 assert.equal(worker.request.evaluation.usdBasis,undefined);worker.reply(ready(worker));
 assert.equal((await a).status,'ready');assert.deepEqual(await a,await b);assert.equal(worker.stopped,false);
 assert.deepEqual(await f.port.read(card.id),await a);assert.equal(f.workers.length,1);assert.equal(f.requests.length,0);assert.equal(f.readyCalls(),0);
 const disposable=f.port as typeof f.port & {dispose?:()=>void};
 assert.equal(typeof disposable.dispose,'function');disposable.dispose?.();assert.equal(worker.stopped,true);
});
test('first card input waits for the actual worker listener instead of disappearing during asynchronous module startup',async()=>{
 class DelayedWorker extends PublicWorker {
  ready=false;posts=0;
  signalReady(){if(this.ready)super.signalReady();}
  postMessage(request:PublicWorker['request']){this.posts++;super.postMessage(request);}
  begin(){this.ready=true;super.signalReady();}
 }
 const worker=new DelayedWorker(),port=createWildzMarketValueBrowserPortV129({card:()=>card,now:()=> '16000000123456',worker:()=>worker as unknown as Worker});
 try{
  const first=port.read(card.id);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(worker.posts,0,'input must remain pending until the worker declares its listener ready');
  worker.begin();assert.equal(worker.posts,1);worker.reply(ready(worker));assert.equal((await first).status,'ready');
  assert.equal((await port.read(card.id)).status,'ready');assert.equal(worker.posts,1);
 }finally{port.dispose?.();}
});
test('a cross-card worker reply cannot supply a value; error cleanup terminates and allows retry',async()=>{
 const f=fixture(),read=f.port.read(card.id);await opened(f.workers,1);const worker=f.workers[0]!,value=ready(worker);
 assert.equal(value.status,'ready');if(value.status==='ready')worker.reply({...value,value:{...value.value,assetId:'other'}});
 assert.equal((await read).status,'unavailable');assert.equal(worker.stopped,true);
 const retry=f.port.read(card.id);await opened(f.workers,2);f.workers[1]!.dispatchEvent(new Event('error'));
 assert.equal((await retry).status,'unavailable');assert.equal(f.workers[1]!.stopped,true);
});
test('an old Explorer cannot retain an in-flight result or start another worker',async()=>{
 const f=fixture(),read=f.port.read(card.id);await opened(f.workers,1);f.changeIdentity();f.workers[0]!.reply(ready(f.workers[0]!));
 assert.equal((await read).status,'unavailable');assert.equal(f.workers[0]!.stopped,true);
 assert.equal((await f.port.read(card.id)).status,'unavailable');assert.equal(f.workers.length,1);
});
test('a new coordinate bucket reuses the worker and retains the exact requested uPulse',async()=>{
 const f=fixture();try{
  const first=f.port.read(card.id);await opened(f.workers,1);const worker=f.workers[0]!;
  assert.equal(worker.request.evaluation.valuationKaiUPulse,'16000000123456');worker.reply(ready(worker));await first;
  f.advance();const next=f.port.read(card.id);
  for(let n=0;worker.request.requestId<2&&n<20;n++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.workers.length,1);assert.equal(worker.request.evaluation.valuationKaiUPulse,'16000001123456');
  worker.reply(ready(worker));assert.equal((await next).status,'ready');
 }finally{f.port.dispose?.();}
});
test('Market release cancels active and queued work and a later read can reopen',async()=>{
 const f=fixture(),active=f.port.read(card.id);await opened(f.workers,1);f.advance();const queued=f.port.read(card.id);
 await new Promise(resolve=>setImmediate(resolve));f.port.release?.();
 assert.equal((await active).status,'unavailable');assert.equal((await queued).status,'unavailable');
 assert.equal(f.workers.length,1);assert.equal(f.workers[0]!.stopped,true);
 const reopen=f.port.read(card.id);await opened(f.workers,2);const worker=f.workers[1]!;
 // A late reply from the released worker cannot populate the reopened cache.
 f.workers[0]!.reply(ready(f.workers[0]!));worker.reply(ready(worker));
 assert.equal((await reopen).status,'ready');f.port.dispose?.();
 assert.equal((await f.port.read(card.id)).status,'unavailable');
});
