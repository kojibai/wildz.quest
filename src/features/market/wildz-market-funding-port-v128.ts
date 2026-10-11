'use client';
import {canonicalPortableCardJson} from '../play/portable-card';
import {admitWildzMarketConnectQuoteV128,type WildzMarketConnectQuoteV128} from '../../lib/receiz/wildz-market-quote-v128';
import type {WildzMarketFundingRequestV128,WildzMarketFundingResultV128} from '../../lib/receiz/wildz-market-funding-v128';
import {validateWildzCardCheckoutUrlV128} from '../../lib/receiz/wildz-card-checkout-url-v128';

type Purchase=Readonly<{purchaseId:string;quote:WildzMarketConnectQuoteV128}>;
type Saved=Readonly<{schema:'wildz.market-funding.v128';keyId:string;ownerHandle:string;purchase:Purchase;phase:'creating'|'checkout'|'expired';sessionId?:string;topupUsdCents?:string;checkoutUrl?:string}>;
export type WildzMarketFundingPortV128=Readonly<{ensure(purchase:Purchase,allowCheckout:boolean):Promise<WildzMarketFundingResultV128>}>;
export type WildzMarketFundingStoreV128=Readonly<{read(key:string):Promise<unknown>;write(key:string,value:unknown):Promise<void>;withLock<T>(key:string,action:()=>Promise<T>):Promise<T>}>;
export function createWildzMarketFundingPortV128(input:Readonly<{
 keyId:string;ownerHandle:string;currentIdentity():Readonly<{keyId:string;ownerHandle:string}>;
 store:WildzMarketFundingStoreV128;authorize():Promise<boolean>;
 request(value:WildzMarketFundingRequestV128):Promise<WildzMarketFundingResultV128>;
}>):WildzMarketFundingPortV128{
 const current=()=>{const identity=input.currentIdentity();if(identity.keyId!==input.keyId||identity.ownerHandle!==input.ownerHandle)throw Error('The checkout identity changed. Reopen Market.');};
 const pending=(message:string):WildzMarketFundingResultV128=>({status:'pending',message});
 return {ensure:async(purchase,allowCheckout)=>{
  current();const quote=admitWildzMarketConnectQuoteV128(purchase.quote);if(quote.ownerHandle!==input.ownerHandle||!/^market:purchase:[a-f0-9]{64}$/.test(purchase.purchaseId))throw Error('The exact buyer purchase is required.');
  const key=JSON.stringify(['wildz.market-funding.v128',input.ownerHandle,input.keyId,purchase.purchaseId]);
  return input.store.withLock(key,async()=>{
   current();let saved=await input.store.read(key) as Saved|null;current();
   if(saved&&(saved.schema!=='wildz.market-funding.v128'||saved.keyId!==input.keyId||saved.ownerHandle!==input.ownerHandle||canonicalPortableCardJson(saved.purchase)!==canonicalPortableCardJson(purchase)||!['creating','checkout','expired'].includes(saved.phase)))throw Error('The saved card checkout differs from this purchase.');
   if(saved?.phase==='checkout'&&(!/^cs_[a-zA-Z0-9_]{8,200}$/.test(saved.sessionId??'')||!/^\d{1,8}$/.test(saved.topupUsdCents??'')))throw Error('The saved card checkout session is invalid.');
   if(!await input.authorize())return pending('The current Receiz ID could not authorize wallet funding. Resume this same purchase to retry.');current();
   const base={purchaseId:purchase.purchaseId,quote};
   if(saved?.phase==='creating'){
    const observed=await input.request({...base,action:'read'});current();
    return observed.status==='ready'||observed.status==='review-required'?observed:pending('The original card checkout reply is uncertain. Check your wallet or the original checkout before opening another payment.');
   }
   if(saved?.phase==='checkout'){
    const result=await input.request({...base,action:'check',sessionId:saved.sessionId!,topupUsdCents:saved.topupUsdCents!});current();
    if(result.status==='expired')await input.store.write(key,{...saved,phase:'expired'});current();
    if(result.status==='checkout'){
     if(result.sessionId!==saved.sessionId||result.topupUsdCents!==saved.topupUsdCents)throw Error('The original card checkout session changed.');
     validateWildzCardCheckoutUrlV128(result.checkoutUrl);
     // Incoming peer messages may check existing funding but cannot navigate
     // away from gameplay or create a new card checkout.
     if(!allowCheckout)return pending('Your wallet is short. Resume this purchase in Market to continue its saved card checkout.');
    }
    return result;
   }
   if(!allowCheckout){const result=await input.request({...base,action:'read'});current();return result;}
   saved={schema:'wildz.market-funding.v128',keyId:input.keyId,ownerHandle:input.ownerHandle,purchase:structuredClone(purchase),phase:'creating'};
   await input.store.write(key,saved);current();
   let result:WildzMarketFundingResultV128;
   try{result=await input.request({...base,action:'create'});current();}
   catch(cause){
    current();
    // Only a response proving no checkout dispatch permits a later retry.
    if(cause instanceof WildzMarketFundingNoDispatchV128)await input.store.write(key,null);
    return pending(cause instanceof Error?cause.message:'The original card checkout response is uncertain.');
   }
   if(result.status==='checkout'){
    const url=validateWildzCardCheckoutUrlV128(result.checkoutUrl);
    if(!/^cs_[a-zA-Z0-9_]{8,200}$/.test(result.sessionId??'')||!/^\d{1,8}$/.test(result.topupUsdCents??''))throw Error('The hosted card checkout session is invalid.');
    await input.store.write(key,{...saved,phase:'checkout',sessionId:result.sessionId,topupUsdCents:result.topupUsdCents,checkoutUrl:url});current();
   }else if(result.status==='ready'||result.status==='review-required')await input.store.write(key,null);
   current();return result;
  });
 }};
}
export class WildzMarketFundingNoDispatchV128 extends Error {}
