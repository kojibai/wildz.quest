"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {parseWildzPlayerCoordinate} from "@/lib/receiz/wildz-player-coordinate";
import type {WildsDirectMessage} from "../wilds-messenger-core";
import {createWildsWalletNativeTradeRuntime} from "./wilds-wallet-native-trade-runtime";
import {wildsWalletNativeTradeAgreementDigest,type WildsWalletNativeTradeMessage} from "./wilds-wallet-native-trade-context";
import {createWildsWalletGiftAgreement,createWildsWalletTradeAgreement,type WildsWalletApproveTrade,type WildsWalletTradeExchangeResult} from "./wilds-wallet-trade";
import type {WildsWalletAssetSend} from "./wilds-wallet-asset-send";
type RuntimeInput=Parameters<typeof createWildsWalletNativeTradeRuntime>[0];

/** Receiving a private peer message can advance only consent already saved on this device. */
export function useWildsWalletNativeTrade(input:Readonly<{
 owner:string;keyId:string|undefined;messages:readonly WildsDirectMessage[];
 ownershipSource:RuntimeInput["ownershipSource"];publish:RuntimeInput["publish"];adopt:RuntimeInput["adopt"];
}>){
 const live=useRef(input);live.current=input;
 const [exchangeResults,setExchangeResults]=useState<Readonly<Record<string,WildsWalletTradeExchangeResult>>>({});
 const owner=parseWildzPlayerCoordinate(input.owner)?.profileHandle??"",keyId=input.keyId??"";
 const runtime=useMemo(()=>{
  if(!owner||!keyId)return null;
  const current=()=>{if(parseWildzPlayerCoordinate(live.current.owner)?.profileHandle!==owner||live.current.keyId!==keyId)throw Error("The active account changed. Reopen Trade.");return live.current;};
  return createWildsWalletNativeTradeRuntime({owner:()=>{current();return owner;},keyId:()=>{current();return keyId;},
   ownershipSource:(...args)=>current().ownershipSource(...args),publish:(...args)=>current().publish(...args),adopt:(...args)=>current().adopt(...args)});
 },[owner,keyId]);
 const account=useRef({owner,keyId});account.current={owner,keyId};
 const record=useCallback((result:WildsWalletTradeExchangeResult)=>{if(account.current.owner!==owner||account.current.keyId!==keyId)return;if(result.tradeId)setExchangeResults(current=>current[result.tradeId!]?.status==="committed"&&result.status!=="committed"?current:({...current,[result.tradeId!]:result}));},[owner,keyId]);
 useEffect(()=>setExchangeResults({}),[owner,keyId]);
 const peerMessages=useCallback(()=>live.current.messages.filter(message=>!message.deletedAt&&message.context?.kind==="trade-native"&&parseWildzPlayerCoordinate(message.senderHandle)?.profileHandle!==owner&&parseWildzPlayerCoordinate(message.recipientHandle)?.profileHandle===owner),[owner]);
 const seen=useRef(new Set<string>());
 useEffect(()=>{seen.current.clear();},[runtime]);
 useEffect(()=>{
  if(!runtime)return;
  const messages=peerMessages().filter(message=>!seen.current.has(message.id));for(const message of messages)seen.current.add(message.id);
  for(const message of messages)void Promise.resolve().then(()=>runtime.receive(message.context,message.senderHandle)).then(record).catch(()=>{/* A malformed or stale peer source grants no action. Explicit Check reports the bound attempt. */});
 },[runtime,input.messages,peerMessages,record]);
 const approveAgreement=useCallback<WildsWalletApproveTrade>(async agreement=>{
  if(!runtime)return {status:"failed",message:"Sign in with your device identity to approve this exchange."};
  let result=await runtime.approveAgreement(agreement);record(result);
  // Preparations that arrived before this device's review never granted implicit consent.
  const digest=wildsWalletNativeTradeAgreementDigest(agreement);
  for(const message of peerMessages())if(wildsWalletNativeTradeAgreementDigest((message.context as WildsWalletNativeTradeMessage).agreement)===digest){result=await runtime.receive(message.context,message.senderHandle);record(result);}
  return result;
 },[runtime,record,peerMessages]);
 const recoverAgreement=useCallback<WildsWalletApproveTrade>(async agreement=>{
  if(!runtime)return {status:"failed",message:"Reopen the approving account to check this exact exchange."};
  let result=await runtime.recoverAgreement(agreement);record(result);
  if(result.status!=="committed")for(const message of peerMessages())if(wildsWalletNativeTradeAgreementDigest((message.context as WildsWalletNativeTradeMessage).agreement)===wildsWalletNativeTradeAgreementDigest(agreement)){result=await runtime.receive(message.context,message.senderHandle);record(result);}
  return result;
 },[runtime,record,peerMessages]);
 const gifts=useMemo(()=>{const found=new Map<string,import("./wilds-wallet-trade").WildsWalletTradeAgreement>();for(const message of input.messages){const context=message.context;if(!message.deletedAt&&context?.kind==="trade-native"&&context.agreement.purpose==="gift")try{const agreement=createWildsWalletTradeAgreement(context.agreement.first,context.agreement.second,"gift");if([agreement.first.senderHandle,agreement.second.senderHandle].includes(owner))found.set(wildsWalletNativeTradeAgreementDigest(agreement),agreement);}catch{}}return [...found].map(([id,agreement])=>({id,agreement,incoming:agreement.second.senderHandle===owner}));},[input.messages,owner]);
 const sendGift=useCallback<WildsWalletAssetSend>(async request=>{
  const agreement=createWildsWalletGiftAgreement(owner,request);
  try{const result=await approveAgreement(agreement);if(result.status==="committed")return {status:"sent",message:"Gift accepted and sent. Native ownership moved to the recipient."};if(result.status==="failed")return {status:"failed",message:result.message,retryable:false};if(result.status==="awaiting-peer")return {status:"sent",message:`Gift delivered to @${agreement.second.senderHandle}. Awaiting their acceptance; ownership remains yours.`};return {status:"pending",message:"Checking this same gift. Its exact approval and sources are saved.",retryable:true};}
  catch(cause){return {status:"pending",message:cause instanceof Error?cause.message:"Check this same gift before sending again.",retryable:true};}
 },[owner,approveAgreement]);
 return {approveAgreement,recoverAgreement,exchangeResults,gifts,sendGift};
}
