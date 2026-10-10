import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {createWildsWalletGiftAgreement,createWildsWalletTradeAgreement} from "../src/features/play/wallet/wilds-wallet-trade";
import {WildsWalletGifts} from "../src/features/play/wallet/WildsWalletGifts";
import {WildsWalletTerminal} from "../src/features/play/wallet/WildsWalletTerminal";
import {createWildsWalletControllerState} from "../src/features/play/wallet/wilds-wallet-controller";
import {wildsWalletNativeTradeAgreementDigest} from "../src/features/play/wallet/wilds-wallet-native-trade-context";
const request={attemptId:"gift:exact:1",recipientHandle:"@bob",asset:{kind:"inventory" as const,foodItemIds:["fruit:1","meat:1"],materialLotIds:["stone:1"],resourceLotIds:["honey:1"]}};
const agreement=createWildsWalletGiftAgreement("alice",request),id=wildsWalletNativeTradeAgreementDigest(agreement);
const gift={id,agreement,incoming:true};
test("asset gift binds the exact reviewed selection and empty recipient package without requesting consideration",()=>{
 assert.equal(agreement.purpose,"gift");assert.equal(agreement.first.senderHandle,"alice.receiz.id");assert.equal(agreement.second.senderHandle,"bob.receiz.id");assert.deepEqual(agreement.first.draft.offered.assets,[request.asset]);assert.deepEqual(agreement.second.draft.offered,{phiMicro:"0",assets:[]});assert.equal(agreement.first.draft.requestedPhiMicro,"0");assert.ok(Object.isFrozen(agreement.second.draft.offered));assert.ok(Object.isFrozen(agreement.second.draft.offered.assets));
 for(const draft of [{...agreement.second.draft,offered:{phiMicro:"1",assets:[]}},{...agreement.second.draft,requestedPhiMicro:"1"},{...agreement.second.draft,attemptId:"gift:other"}])assert.throws(()=>createWildsWalletTradeAgreement(agreement.first,{...agreement.second,draft},"gift"),/gift_agreement_invalid/);
 assert.throws(()=>createWildsWalletTradeAgreement(agreement.first,agreement.second),/Add/);
 const changed=createWildsWalletGiftAgreement("alice",{...request,asset:{...request.asset,foodItemIds:["fruit:2","meat:1"]}});assert.notEqual(wildsWalletNativeTradeAgreementDigest(changed),id);
});
test("receiving a gift shows a direct acceptance action and never implies that delivery moved ownership",()=>{
 const incoming=renderToStaticMarkup(<WildsWalletGifts gifts={[gift]} onAccept={async()=>({status:"awaiting-peer",message:"Waiting"})}/>);assert.match(incoming,/From @alice.receiz.id/);assert.match(incoming,/2 food · 1 materials · 1 resource lots/);assert.match(incoming,/Receive gift/);assert.doesNotMatch(incoming,/Gift received|Trade|exchange|native ownership is yours/);
 const outgoing=renderToStaticMarkup(<WildsWalletGifts gifts={[{...gift,incoming:false}]} onRecover={async()=>({status:"pending",message:"Checking"})}/>);assert.match(outgoing,/Awaiting acceptance; ownership remains yours/);assert.match(outgoing,/Check same gift/);assert.doesNotMatch(outgoing,/Gift accepted/);
 const settled=renderToStaticMarkup(<WildsWalletGifts gifts={[gift]} results={{[id]:{status:"committed",message:"Complete"}}}/>);assert.match(settled,/Gift received/);assert.doesNotMatch(settled,/Receive gift|Check same gift/);
});
test("incoming gifts are reachable from Wallet Receive as well as Assets without opening the trade builder",()=>{
 const actions={onClose(){},onNavigate(){},onLookupRecipient(){},onSelectRecipient(){},onReviewAmount(){},onStage(){},onAuthorizationPointerStart(){},onAuthorizationPointerCancel(){},onAuthorize(){},onRecover(){},onEditTransfer(){},onResetTransfer(){},onRefresh(){},onRequestReceive(){}};
 for(const page of ["receive","assets"] as const){const markup=renderToStaticMarkup(<WildsWalletTerminal {...actions} publicUsername="bob.receiz.id" state={{...createWildsWalletControllerState("bob.receiz.id"),open:true,page}} walletGifts={[gift]} onAcceptGift={async()=>({status:"awaiting-peer",message:"Accepted"})}/>);assert.match(markup,/Wallet gifts/);assert.match(markup,/Receive gift/);assert.doesNotMatch(markup,/Build your package/);}
});
test("accepted gifts with a local restore failure expose recovery without offering another acceptance",()=>{
 const markup=renderToStaticMarkup(<WildsWalletGifts gifts={[gift]} results={{[id]:{status:"committed",message:"Gift complete. Recovering accepted assets.",assetRecoveryRequired:true}}} onRecover={async()=>({status:"committed",message:"Recovered"})}/>);
 assert.match(markup,/Gift received/);assert.match(markup,/Refresh received assets/);assert.doesNotMatch(markup,/Receive gift<|Awaiting acceptance/);
});
