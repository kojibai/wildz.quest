'use client';

import {digestReceizCanonicalV122, receizKaiNow} from '@receiz/sdk';
import type {ReceizProofValueUsdBasisV129} from '@receiz/sdk/valuation';
import type {PortableCardAsset} from '../play/portable-card';
import type {WildzMarketValuePort, WildzMarketValueRead} from './wildz-market-value';
import {admitWildzMarketConnectQuoteV128} from '../../lib/receiz/wildz-market-quote-v128';

const CACHE_UPULSES = 6_000_000n;
const unavailable = (message:string):WildzMarketValueRead => ({status:'unavailable', message});

/** Heavy proof verification and chart replay stay off the gameplay thread.
 * Workers terminate on completion/error/timeout; a small display cache retains
 * verified public results only, never SDK custody or authority. */
export function createWildzMarketValueBrowserPortV129(input:Readonly<{
  ownerHandle:string;
  current():void;
  card(assetId:string):Promise<PortableCardAsset|null>;
  ensureReady?():Promise<boolean|void>;
  fetcher?:typeof fetch;
  worker?():Worker;
}>):WildzMarketValuePort {
  const fetcher=input.fetcher??fetch;
  let basis:Readonly<{at:bigint;value:ReceizProofValueUsdBasisV129}>|null=null, basisOpening:Promise<void>|null=null;
  const cache=new Map<string,Readonly<{at:bigint;result:WildzMarketValueRead}>>();
  const running=new Map<string,Promise<WildzMarketValueRead>>();
  let queue:Promise<unknown>=Promise.resolve();
  async function usdBasis(at:bigint) {
    if(basis && at>=basis.at && at-basis.at<CACHE_UPULSES) return;
    if(!basisOpening) {
      const operation=(async()=>{
        input.current();
        if(input.ensureReady && await input.ensureReady()===false)return;
        const response=await fetcher('/api/market/purchases/quote',{method:'POST',credentials:'same-origin',cache:'no-store',
          headers:{'content-type':'application/json'},body:JSON.stringify({priceUsdCents:'1'}),signal:AbortSignal.timeout(10_000)});
        const value:unknown=await response.json();input.current();
        if(!response.ok||!value||typeof value!=='object'||!('quote' in value))return;
        const quote=admitWildzMarketConnectQuoteV128(value.quote);
        if(quote.ownerHandle!==input.ownerHandle||quote.expiresAtKai<=Number(at/1_000_000n))return;
        const priceBasis={algorithm:'receiz.display-usd.v122',version:'1',usdPerPhiMicrocents:quote.usdPerPhiMicrocents,
          connectQuoteDigest:quote.basisDigest,issuedAtKai:quote.issuedAtKai};
        basis={at,value:{algorithm:'receiz.display-usd.v122',version:'1',usdPerPhiMicrocents:quote.usdPerPhiMicrocents,
          priceBasis,priceBasisDigest:await digestReceizCanonicalV122(priceBasis)}};
      })().catch(()=>{basis=null;}).finally(()=>{if(basisOpening===operation)basisOpening=null;});
      basisOpening=operation;
    }
    await basisOpening;
  }
  async function compute(assetId:string,card:PortableCardAsset):Promise<WildzMarketValueRead> {
    const at=BigInt(receizKaiNow().uPulse);
    await usdBasis(at);input.current();
    const worker=input.worker?.()??new Worker(new URL('./wildz-market-value.worker.ts',import.meta.url),{type:'module'});
    return new Promise(resolve=>{
      let active=true;
      const finish=(result:WildzMarketValueRead)=>{
        if(!active)return;active=false;clearTimeout(timer);worker.removeEventListener('message',message);worker.removeEventListener('error',failure);worker.terminate();resolve(result);
      };
      const failure=()=>finish(unavailable('The public proof value could not be checked. Reopen this card to retry.'));
      const message=(event:MessageEvent)=>{
        if(event.data?.type!=='value-result')return;
        const result=event.data.result as WildzMarketValueRead;
        if(result?.status==='ready' && (result.value.assetId!==assetId||result.value.proofDigest!==card.proof.digest))return failure();
        if(result?.status!=='ready'&&result?.status!=='unavailable')return failure();
        finish(result);
      };
      const timer=setTimeout(()=>finish(unavailable('The public proof value check timed out. Reopen this card to retry.')),45_000);
      worker.addEventListener('message',message);worker.addEventListener('error',failure);
      try{worker.postMessage({type:'read-value',assetId,card,evaluation:{valuationKaiUPulse:at.toString(),...(basis?{usdBasis:basis.value}:{})}});}catch{failure();}
    });
  }
  return {async read(assetId){
    try{
      input.current();
      const card=await input.card(assetId);input.current();
      if(!card||card.id!==assetId)return unavailable('The public creature card is unavailable.');
      const at=BigInt(receizKaiNow().uPulse),key=JSON.stringify([assetId,card.proof.digest]);
      const cached=cache.get(key);
      if(cached && at>=cached.at && at-cached.at<CACHE_UPULSES)return cached.result;
      const pending=running.get(key);if(pending)return pending;
      if(running.size>=32)return unavailable('The visible collection is being checked. Reopen this card to refresh its value.');
      const operation=queue.catch(()=>undefined).then(()=>compute(assetId,card)).then(result=>{
        input.current();
        if(result.status==='ready'){
          cache.set(key,{at:BigInt(result.value.valuationKaiUPulse),result});while(cache.size>24)cache.delete(cache.keys().next().value!);
        }
        return result;
      }).catch(()=>unavailable('The public proof value could not refresh. Reopen this card to retry.')).finally(()=>running.delete(key));
      running.set(key,operation);queue=operation;return operation;
    }catch{return unavailable('The public proof value is unavailable for this Explorer.');}
  }};
}
