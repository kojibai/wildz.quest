import {admitWildzMarketConnectQuoteV128,type WildzMarketConnectQuoteV128} from "../../lib/receiz/wildz-market-quote-v128";
import { canonicalPortableCardJson } from "../play/portable-card";
import { createWildsWalletStagedTradePlan } from "../play/wallet/wilds-wallet-staged-trade-types";
import { admitWildsWalletConnectPhiNoWriteReceipt, type WildsWalletConnectPhiNoWriteReceipt } from "../play/wallet/wilds-wallet-connect-phi-port";
import type { WildsWalletTradeAgreement } from "../play/wallet/wilds-wallet-trade";
import type { WildsWalletAssetSendAsset } from "../play/wallet/wilds-wallet-asset-send";
import type { WildzMarketSelectionV128 } from "../../lib/receiz/wildz-market-source-types-v128";
import { validateWildzMarketSelectionV128 } from "../../lib/receiz/wildz-market-source-journal-v128";

export type WildzMarketListAttemptV128 = Readonly<{attemptId:string;listingId:string;asset:WildsWalletAssetSendAsset;priceUsdCents:string;selection?:WildzMarketSelectionV128;published?:true}>;
export type WildzMarketPurchaseCheckpointV128 = Readonly<{agreement:WildsWalletTradeAgreement;message:string;reviewRequired?:true;assetRecoveryRequired?:true;noWriteReceipt?:WildsWalletConnectPhiNoWriteReceipt}>;
export type WildzMarketReservationAttemptV128=Readonly<{listingId:string;listingHead:string;reservationId:string;sellerHandle:string;selection:WildzMarketSelectionV128;quote:WildzMarketConnectQuoteV128}>;
export type WildzMarketRecoveryV128 = Readonly<{schema:"wildz.market-recovery.v128";ownerHandle:string;keyId:string;lists:readonly WildzMarketListAttemptV128[];purchases:readonly WildzMarketPurchaseCheckpointV128[];pendingReservations:readonly WildzMarketReservationAttemptV128[];listArchiveCursor?:number;reservationReadCursor?:number}>;
export type WildzMarketRecoveryStoreV128 = Readonly<{load(ownerKey:string):unknown;write(ownerKey:string,value:WildzMarketRecoveryV128):void;withLock<T>(ownerKey:string,action:()=>Promise<T>):Promise<T>}>;
const MAX_BYTES=1_000_000;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const exact=(value:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
export const wildzMarketStorageErrorV128=()=>Error("The exact market continuation could not be saved and read back. No new payment or delivery was started.");
export function admitWildzMarketRecoveryV128(value:unknown,ownerHandle:string,keyId:string):WildzMarketRecoveryV128{
 if(value==null)return {schema:"wildz.market-recovery.v128",ownerHandle,keyId,lists:[],purchases:[],pendingReservations:[]};
 if(!object(value)||!exact(value,["schema","ownerHandle","keyId","lists","purchases"],["pendingReservations","listArchiveCursor","reservationReadCursor"])||value.schema!=="wildz.market-recovery.v128"||value.ownerHandle!==ownerHandle||value.keyId!==keyId
  ||!Array.isArray(value.lists)||value.lists.length>64||!Array.isArray(value.purchases)||value.purchases.length>32||JSON.stringify(value).length>MAX_BYTES)throw wildzMarketStorageErrorV128();
 if(value.listArchiveCursor!==undefined&&(!Number.isSafeInteger(value.listArchiveCursor)||(value.listArchiveCursor as number)<0||(value.listArchiveCursor as number)>=64)||value.reservationReadCursor!==undefined&&(!Number.isSafeInteger(value.reservationReadCursor)||(value.reservationReadCursor as number)<0||(value.reservationReadCursor as number)>=32))throw wildzMarketStorageErrorV128();
 const lists=value.lists.map(raw=>{
  if(!object(raw)||!exact(raw,["attemptId","listingId","asset","priceUsdCents"],["selection","published"])||typeof raw.attemptId!=="string"||!raw.attemptId||raw.attemptId.length>256
   ||typeof raw.listingId!=="string"||!/^market:listing:[a-f0-9]{64}$/.test(raw.listingId)||typeof raw.priceUsdCents!=="string"||!/^[1-9][0-9]{0,15}$/.test(raw.priceUsdCents)||BigInt(raw.priceUsdCents)>BigInt(Number.MAX_SAFE_INTEGER)
   ||raw.published!==undefined&&raw.published!==true||!object(raw.asset))throw wildzMarketStorageErrorV128();
  if(raw.selection){validateWildzMarketSelectionV128(raw.selection as WildzMarketSelectionV128);if(!same((raw.selection as WildzMarketSelectionV128).asset,raw.asset))throw wildzMarketStorageErrorV128();}
  return structuredClone(raw) as WildzMarketListAttemptV128;
 });
 const pendingReservations=(value.pendingReservations??[]) as unknown;
 if(!Array.isArray(pendingReservations)||pendingReservations.length>32||pendingReservations.length+value.purchases.length>32)throw wildzMarketStorageErrorV128();
 const reservations=pendingReservations.map(raw=>{
  if(!object(raw)||!exact(raw,["listingId","listingHead","reservationId","sellerHandle","selection","quote"])||typeof raw.listingId!=="string"||!raw.listingId||typeof raw.listingHead!=="string"||!raw.listingHead||typeof raw.reservationId!=="string"||!raw.reservationId||typeof raw.sellerHandle!=="string"||raw.sellerHandle===ownerHandle)throw wildzMarketStorageErrorV128();
  const quote=admitWildzMarketConnectQuoteV128(raw.quote);if(quote.ownerHandle!==ownerHandle)throw wildzMarketStorageErrorV128();validateWildzMarketSelectionV128(raw.selection as WildzMarketSelectionV128);
  return structuredClone(raw) as WildzMarketReservationAttemptV128;
 });
 if(new Set(reservations.map(item=>item.reservationId)).size!==reservations.length)throw wildzMarketStorageErrorV128();
 const purchases=value.purchases.map(raw=>{
  if(!object(raw)||!exact(raw,["agreement","message"],["reviewRequired","assetRecoveryRequired","noWriteReceipt"])||typeof raw.message!=="string"||raw.message.length>1000||raw.reviewRequired!==undefined&&raw.reviewRequired!==true||raw.assetRecoveryRequired!==undefined&&raw.assetRecoveryRequired!==true)throw wildzMarketStorageErrorV128();
  const plan=createWildsWalletStagedTradePlan(raw.agreement as WildsWalletTradeAgreement);
  if(plan.agreement.purpose!=="market"||!plan.agreement.market||!same(plan.agreement,raw.agreement)||![plan.agreement.market.buyerHandle,plan.agreement.market.sellerHandle].includes(ownerHandle))throw wildzMarketStorageErrorV128();
  if(raw.noWriteReceipt){const leg=plan.legs[0]!;if(leg.kind!=="phi")throw wildzMarketStorageErrorV128();admitWildsWalletConnectPhiNoWriteReceipt(raw.noWriteReceipt,leg);}
  return structuredClone(raw) as WildzMarketPurchaseCheckpointV128;
 });
 if(new Set(lists.map(item=>item.attemptId)).size!==lists.length||new Set(purchases.map(item=>item.agreement.market!.purchaseId)).size!==purchases.length)throw wildzMarketStorageErrorV128();
 return Object.freeze({schema:value.schema,ownerHandle,keyId,lists:Object.freeze(lists),purchases:Object.freeze(purchases),pendingReservations:Object.freeze(reservations),...(value.listArchiveCursor===undefined?{}:{listArchiveCursor:value.listArchiveCursor as number}),...(value.reservationReadCursor===undefined?{}:{reservationReadCursor:value.reservationReadCursor as number})});
}
const key=(ownerKey:string)=>`wildz:market:v128:${encodeURIComponent(ownerKey)}`;
export const wildzMarketBrowserRecoveryStoreV128:WildzMarketRecoveryStoreV128={
 load(ownerKey){if(typeof window==="undefined")throw wildzMarketStorageErrorV128();const raw=window.localStorage.getItem(key(ownerKey));if(raw===null)return null;if(raw.length>MAX_BYTES)throw wildzMarketStorageErrorV128();return JSON.parse(raw);},
 write(ownerKey,value){if(typeof window==="undefined")throw wildzMarketStorageErrorV128();admitWildzMarketRecoveryV128(value,value.ownerHandle,value.keyId);const raw=JSON.stringify(value);window.localStorage.setItem(key(ownerKey),raw);if(window.localStorage.getItem(key(ownerKey))!==raw)throw wildzMarketStorageErrorV128();},
 async withLock(ownerKey,action){if(typeof navigator==="undefined"||!navigator.locks)throw wildzMarketStorageErrorV128();return navigator.locks.request(key(ownerKey),action);}
};
