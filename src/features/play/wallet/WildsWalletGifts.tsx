"use client";
import React,{useRef,useState} from "react";
import styles from "./WildsWalletGifts.module.css";
import type {WildsWalletApproveTrade,WildsWalletTradeAgreement,WildsWalletTradeExchangeResult} from "./wilds-wallet-trade";
export type WildsWalletGift=Readonly<{id:string;agreement:WildsWalletTradeAgreement;incoming:boolean}>;
export function WildsWalletGifts({gifts=[],results={},onAccept,onRecover}:{gifts?:readonly WildsWalletGift[];results?:Readonly<Record<string,WildsWalletTradeExchangeResult>>;onAccept?:WildsWalletApproveTrade;onRecover?:WildsWalletApproveTrade}){
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");const running=useRef(false);
 const act=async(gift:WildsWalletGift,recover:boolean)=>{const callback=recover?onRecover:onAccept;if(!callback||running.current)return;running.current=true;setBusy(gift.id);setError("");try{await callback(gift.agreement);}catch(cause){setError(cause instanceof Error?cause.message:"Check this same gift to recover its status.");}finally{running.current=false;setBusy(null);}};
 if(!gifts.length)return null;
 return <section aria-label="Wallet gifts" className={styles.panel}><h3>Gifts</h3>{gifts.map(gift=>{const result=results[gift.id],settled=result?.status==="committed",checking=result?.status==="pending"||result?.status==="awaiting-peer",failed=result?.status==="failed";
  return <article key={gift.id}><h4>{gift.incoming?`From @${gift.agreement.first.senderHandle}`:`To @${gift.agreement.second.senderHandle}`}</h4><ul>{gift.agreement.first.draft.offered.assets.map((asset,index)=><li key={index}>{asset.kind==="creature"?`Creature · ${asset.assetId}`:asset.kind==="package"?`Resource card · ${asset.packageId}`:`${asset.foodItemIds.length} food · ${asset.materialLotIds.length} materials · ${asset.resourceLotIds.length} resource lots`}</li>)}</ul>
   {settled?<p role="status">{gift.incoming?"Gift received. Its native ownership is yours.":"Gift accepted. Its native ownership moved to the recipient."}</p>:<><p>{gift.incoming?"Review these exact assets before receiving the gift.":"Delivered. Awaiting acceptance; ownership remains yours."}</p><button type="button" disabled={failed||busy!==null||!(checking||!gift.incoming?onRecover:onAccept)} onClick={()=>{void act(gift,checking||!gift.incoming);}}>{busy===gift.id?"Checking gift…":checking||!gift.incoming?"Check same gift":"Receive gift"}</button></>}
   {settled&&result?.assetRecoveryRequired?<button type="button" disabled={busy!==null||!onRecover} onClick={()=>{void act(gift,true);}}>{busy===gift.id?"Refreshing assets…":"Refresh received assets"}</button>:null}
   {(!settled||result?.assetRecoveryRequired)&&result?<p role="status">{result.message.replaceAll("exchange","gift").replaceAll("Exchange","Gift")}</p>:null}
  </article>;
 })}{error?<p role="alert">{error}</p>:null}</section>;
}
