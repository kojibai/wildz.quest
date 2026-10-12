'use client';
import {defaultContinuityDatabase} from '../../lib/receiz/wildz-active-identity';
import {authorizeWildsWalletReadWithIdentity} from '../play/wallet/wilds-wallet-read-authorization';
import {createWildzMarketFundingPortV128,WildzMarketFundingNoDispatchV128,type WildzMarketFundingStoreV128} from './wildz-market-funding-port-v128';
import type {WildzMarketFundingResultV128} from '../../lib/receiz/wildz-market-funding-v128';
const queues=new Map<string,Promise<unknown>>();
const store:WildzMarketFundingStoreV128={
 read:key=>defaultContinuityDatabase.read('meta',key),write:(key,value)=>defaultContinuityDatabase.transaction(['meta'],'readwrite',tx=>value===null?tx.delete('meta',key):tx.put('meta',value,key)),
 async withLock(key,action){
  if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request(key,action);
  const pending=queues.get(key)??Promise.resolve(),next=pending.catch(()=>undefined).then(action);queues.set(key,next);
  try{return await next;}finally{if(queues.get(key)===next)queues.delete(key);}
 }
};
export function createWildzMarketFundingBrowserV128(input:Readonly<{keyId:string;ownerHandle:string;currentIdentity():Readonly<{keyId:string;ownerHandle:string}>}>){
 return createWildzMarketFundingPortV128({...input,store,authorize:()=>authorizeWildsWalletReadWithIdentity(input.keyId,undefined,'market-funding'),
  request:async body=>{
   const response=await fetch('/api/market/purchases/funding',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'content-type':'application/json','x-wildz-market-return':window.location.pathname==='/market'?'/market':'/'},body:JSON.stringify(body)});
   const result=await response.json();
   if(!response.ok){
    const message=typeof result?.error==='string'?result.error:'The original card checkout could not be checked.';
    if(result?.checkoutDispatched===false)throw new WildzMarketFundingNoDispatchV128(message);
    throw Error(message);
   }
   if(!result||!['ready','checkout','pending','expired','review-required'].includes(result.status)||typeof result.message!=='string')throw Error('The original card checkout response is uncertain.');
   return result as WildzMarketFundingResultV128;
  }
 });
}
