'use client';

import {receizKaiNow} from '@receiz/sdk';
import type {PortableCardAsset} from '../play/portable-card';
import type {WildzMarketValuePort,WildzMarketValueRead} from './wildz-market-value';
import type {WildzMarketLocalValueEvaluationV129} from './wildz-market-value-local-v129';

// The SDK law evaluates whole pulses, so a pulse bucket is its actual numeric
// resolution (~5.24 seconds), while each result retains its exact read uPulse.
const CACHE_UPULSES=1_000_000n,MAX_CACHE=8,MAX_PENDING=24,WORKER_IDLE_MS=30_000;
const unavailable=(message:string):WildzMarketValueRead=>({status:'unavailable',message});

/** One reusable worker performs bounded local SDK math only while a card is
 * requested. No login, quote API, publication or native proof-root read is
 * required. The port owns worker/cache cleanup when Market closes. */
export function createWildzMarketValueBrowserPortV129(input:Readonly<{
 ownerHandle?:string;
 current?():void;
 card(assetId:string):PortableCardAsset|null|Promise<PortableCardAsset|null>;
 /** Optional replay/display override; absent it the worker derives Receiz's
  * canonical public Wallet display rate locally for every identity. */
 usdPerPhiMicrocents?():string|null;
 now?():string;
 /** Retained for callers migrating from the old port. Neither is invoked. */
 ensureReady?():Promise<boolean|void>;
 fetcher?:typeof fetch;
 worker?():Worker;
}>):WildzMarketValuePort {
 const cache=new Map<string,WildzMarketValueRead>(),running=new Map<string,Promise<WildzMarketValueRead>>();
 let queue:Promise<unknown>=Promise.resolve(),worker:Worker|null=null,workerReady=false,disposed=false,requestId=0,generation=0;
 let idle:ReturnType<typeof setTimeout>|null=null,cancelActive:(()=>void)|null=null;
 function stopWorker(){if(idle)clearTimeout(idle);idle=null;worker?.terminate();worker=null;workerReady=false;}
 function idleWorker(){if(idle)clearTimeout(idle);idle=setTimeout(stopWorker,WORKER_IDLE_MS);}
 function release(){generation++;cancelActive?.();stopWorker();cache.clear();running.clear();queue=Promise.resolve();}
 function compute(assetId:string,card:PortableCardAsset,evaluation:WildzMarketLocalValueEvaluationV129,selectedGeneration:number):Promise<WildzMarketValueRead>{
  if(disposed||selectedGeneration!==generation)return Promise.resolve(unavailable('Market value reading has closed.'));
  input.current?.();if(idle)clearTimeout(idle);idle=null;
  worker??=input.worker?.()??new Worker(new URL('./wildz-market-value.worker.ts',import.meta.url),{type:'module',name:'wildz-market-value'});
  const activeWorker=worker,id=++requestId;
  return new Promise(resolve=>{
   let active=true,sent=false;
   const finish=(result:WildzMarketValueRead,stop=false)=>{
    if(!active)return;active=false;clearTimeout(timer);
    activeWorker.removeEventListener('message',message);activeWorker.removeEventListener('error',failure);cancelActive=null;
    if(stop)stopWorker();else idleWorker();resolve(result);
   };
   const failure=()=>finish(unavailable('The local card value could not refresh. Reopen this card to retry.'),true);
   const send=()=>{
    if(!active||sent)return;
    try{input.current?.();sent=true;activeWorker.postMessage({type:'read-value',requestId:id,assetId,card,evaluation});}catch{failure();}
   };
   const message=(event:MessageEvent)=>{
    if(event.data?.type==='value-ready'){workerReady=true;send();return;}
    if(!sent)return;
    if(event.data?.type!=='value-result'||event.data.requestId!==id)return;
    const result=event.data.result as WildzMarketValueRead;
    if(result?.status==='ready'&&(result.value.assetId!==assetId||result.value.proofDigest!==card.proof.digest
     ||result.value.valuationKaiUPulse!==evaluation.valuationKaiUPulse))return failure();
    if(result?.status!=='ready'&&result?.status!=='unavailable')return failure();
    try{input.current?.();finish(result);}catch{failure();}
   };
   const timer=setTimeout(()=>finish(unavailable('The local card value calculation timed out. Reopen this card to retry.'),true),10_000);
   cancelActive=()=>finish(unavailable('Market value reading has closed.'),true);
   activeWorker.addEventListener('message',message);activeWorker.addEventListener('error',failure);
   // Webpack's production worker entry can finish loading shared modules
   // asynchronously. Its message listener must exist before the first input.
   if(workerReady)send();
  });
 }
 return {release,dispose(){if(disposed)return;disposed=true;release();},async read(assetId){
  try{
   if(disposed)return unavailable('Market value reading has closed.');
   input.current?.();const selectedGeneration=generation;
   const card=await input.card(assetId);input.current?.();
   if(disposed||selectedGeneration!==generation)return unavailable('Market value reading has closed.');
   if(!card||card.id!==assetId)return unavailable('The creature card is unavailable.');
   const valuationKaiUPulse=input.now?.()??String(receizKaiNow().uPulse);
   if(!/^(?:0|[1-9][0-9]{0,15})$/.test(valuationKaiUPulse))return unavailable('The current Kai coordinate is unavailable.');
   const at=BigInt(valuationKaiUPulse),rate=input.usdPerPhiMicrocents?.()??null;
   const key=JSON.stringify([assetId,card.proof.digest,(at/CACHE_UPULSES).toString(),rate]);
   const cached=cache.get(key);if(cached){cache.delete(key);cache.set(key,cached);return cached;}
   const pending=running.get(key);if(pending)return pending;
   if(running.size>=MAX_PENDING)return unavailable('The visible collection is refreshing. Reopen this card to read its value.');
   const evaluation:WildzMarketLocalValueEvaluationV129={valuationKaiUPulse,...(rate!==null?{usdPerPhiMicrocents:rate}:{})};
   const operation=queue.catch(()=>undefined).then(()=>compute(assetId,card,evaluation,selectedGeneration)).then(result=>{
    if(disposed||selectedGeneration!==generation)return unavailable('Market value reading has closed.');input.current?.();
    if(result.status==='ready'){cache.set(key,result);while(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value!);}
    return result;
   }).catch(()=>{if(selectedGeneration===generation)stopWorker();return unavailable('The local card value is unavailable.');})
    .finally(()=>{if(running.get(key)===operation)running.delete(key);});
   running.set(key,operation);queue=operation;return operation;
  }catch{return unavailable('The local card value is unavailable.');}
 }};
}
