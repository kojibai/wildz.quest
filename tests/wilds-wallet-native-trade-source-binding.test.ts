import assert from "node:assert/strict";
import test from "node:test";
import {assertWildsWalletNativeTradeSourceSelection} from "../src/features/play/wallet/wilds-wallet-native-trade-source-binding";
import {initialPlayState} from "../src/features/play/game-state";
import {embedRoamingCardInPng} from "../src/features/play/card-export";
import {createWildsResourcePackage} from "../src/features/play/wilds-resource-package";
import {walletFoodFixture} from "./fixtures/wilds-wallet-food";
import {sealCollectedCard} from "../src/features/play/portable-card";
import {admitLegacyCard} from "../src/features/play/living-card-proof";
const png=Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64"));
test("the actual opened creature Original must match the exact reviewed card and causal sidecar",()=>{
 const card=initialPlayState.inventory[0]!,other={...card,id:"creature:substitution"},source={asset:{kind:"creature" as const,assetId:card.id},currentCard:card},payload=embedRoamingCardInPng(png,card);
 assert.doesNotThrow(()=>assertWildsWalletNativeTradeSourceSelection(source,payload));
 assert.throws(()=>assertWildsWalletNativeTradeSourceSelection({...source,asset:{kind:"creature",assetId:other.id}},payload),/selection|history|card/);
 assert.throws(()=>assertWildsWalletNativeTradeSourceSelection({...source,currentCard:other},payload),/selection|history|card/);
 assert.throws(()=>assertWildsWalletNativeTradeSourceSelection({asset:source.asset},payload),/selection|card/);
});
test("retransfer matches a received creature's preserved genesis payload and causal sidecar",()=>{
 const original=sealCollectedCard({formId:"voltray-1",ownerReceizId:"alice.receiz.id",encounterId:"gift:genesis",capturedAt:"2026-09-13T12:00:00.000Z"});
 const receivedSidecar=admitLegacyCard(original,"2026-09-14T12:00:00.000Z"),payload=embedRoamingCardInPng(png,original);
 // Current native keeper is admitted separately from immutable card ancestry.
 assert.equal(receivedSidecar.manifest.ownerReceizId,"alice.receiz.id");
 assert.doesNotThrow(()=>assertWildsWalletNativeTradeSourceSelection({asset:{kind:"creature",assetId:original.id},currentCard:receivedSidecar},payload));
 const rewritten=structuredClone(receivedSidecar);rewritten.manifest.ownerReceizId="bob.receiz.id";
 assert.throws(()=>assertWildsWalletNativeTradeSourceSelection({asset:{kind:"creature",assetId:original.id},currentCard:rewritten},payload),/selection|history|card/);
});
test("the opened native resource package must contain precisely the gift's reviewed units",()=>{
 const {nourishment}=walletFoodFixture(),food=Object.values(nourishment.items)[0]!,pkg=createWildsResourcePackage({ownerReceizId:nourishment.ownerReceizId,createdKaiUPulse:101,commandId:"test:package:gift",members:[{kind:"food",id:food.itemId,foodItem:food,nourishment}]});
 const payload=new TextEncoder().encode(JSON.stringify({schema:"wildz.native-resource-package.v128",package:pkg,sourceWorld:{}}));
 assert.doesNotThrow(()=>assertWildsWalletNativeTradeSourceSelection({asset:{kind:"inventory",foodItemIds:[food.itemId],materialLotIds:[],resourceLotIds:[]}},payload));
 assert.doesNotThrow(()=>assertWildsWalletNativeTradeSourceSelection({asset:{kind:"package",packageId:pkg.packageId}},payload));
 assert.throws(()=>assertWildsWalletNativeTradeSourceSelection({asset:{kind:"package",packageId:"wrong"}},payload),/selection/);
 assert.throws(()=>assertWildsWalletNativeTradeSourceSelection({asset:{kind:"inventory",foodItemIds:[],materialLotIds:[food.itemId],resourceLotIds:[]}},payload),/selection/);
 assert.throws(()=>assertWildsWalletNativeTradeSourceSelection({asset:{kind:"inventory",foodItemIds:[food.itemId,"another"],materialLotIds:[],resourceLotIds:[]}},payload),/selection/);
});
