import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildzMarketValueBrowserPortV129} from '../src/features/market/wildz-market-value-browser-v129';
import {sealCollectedCard} from '../src/features/play/portable-card';
import type {WildzMarketValueRead} from '../src/features/market/wildz-market-value';

const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'buyer.receiz.id',encounterId:'browser-value:one',capturedAt:'2026-10-10T12:00:00.000Z'});
class PublicWorker extends EventTarget {
  request!: {assetId:string;card:typeof card;evaluation:{valuationKaiUPulse:string;usdBasis?:unknown}};
  stopped=false;
  postMessage(request:PublicWorker['request']){this.request=request;}
  terminate(){this.stopped=true;}
  reply(result:WildzMarketValueRead){this.dispatchEvent(new MessageEvent('message',{data:{type:'value-result',result}}));}
}
function ready(worker:PublicWorker):WildzMarketValueRead{return {status:'ready',value:{assetId:card.id,proofDigest:card.proof.digest,historyHead:null,algorithm:'worker-transport-test',policyChecksum:'test',projectionDigest:'test',originKaiUPulse:null,valuationKaiUPulse:worker.request.evaluation.valuationKaiUPulse,proofValuePhiMicro:'1000000',marketReferenceValuePhiMicro:null,displayUsdCents:null,priceBasisDigest:null,samples:[],calculation:[]}};}
async function opened(workers:PublicWorker[],count:number){for(let n=0;workers.length<count&&n<20;n++)await new Promise(resolve=>setImmediate(resolve));assert.equal(workers.length,count);}
function fixture(){const workers:PublicWorker[]=[],requests:unknown[]=[];let current=true;
 const port=createWildzMarketValueBrowserPortV129({ownerHandle:'buyer.receiz.id',current(){if(!current)throw Error('identity changed');},card:async()=>card,
  fetcher:async (_url,options)=>{requests.push(options);return Response.json({ok:false},{status:401});},worker(){const worker=new PublicWorker();workers.push(worker);return worker as unknown as Worker;}});
 return {port,workers,requests,changeIdentity:()=>{current=false;}};
}

test('visible-card reads coalesce and retain only public transport; finished workers terminate and verified results cache',async()=>{
 const f=fixture(),a=f.port.read(card.id),b=f.port.read(card.id);await opened(f.workers,1);
 const worker=f.workers[0]!;assert.deepEqual(Object.keys(worker.request).sort(),['assetId','card','evaluation','type']);
 assert.equal(worker.request.card.proof.digest,card.proof.digest);assert.match(worker.request.evaluation.valuationKaiUPulse,/^[1-9][0-9]*$/);
 assert.equal(worker.request.evaluation.usdBasis,undefined);worker.reply(ready(worker));
 assert.equal((await a).status,'ready');assert.deepEqual(await a,await b);assert.equal(worker.stopped,true);
 assert.deepEqual(await f.port.read(card.id),await a);assert.equal(f.workers.length,1);assert.equal(f.requests.length,1);
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
