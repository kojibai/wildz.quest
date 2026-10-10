import type {WildsWalletNativeOwnershipSource} from "./wilds-wallet-native-trade-context";
import {validateWildsRoamingHandoffCard} from "@/lib/receiz/wilds-roaming-handoff";
import {verifyWildsResourcePackage} from "../wilds-resource-package";
import {canonicalPortableCardJson} from "../portable-card";
/** Selection mapping beneath SDK-verified enclosing bytes; this function grants no custody. */
export function assertWildsWalletNativeTradeSourceSelection(source:Pick<WildsWalletNativeOwnershipSource,"asset"|"currentCard">,payloadBytes:Uint8Array):void{
 if(source.asset.kind==="creature"){
  if(!source.currentCard||source.currentCard.id!==source.asset.assetId)throw Error("wilds_native_trade_card_selection_mismatch");
  validateWildsRoamingHandoffCard(payloadBytes,source.currentCard);return;
 }
 const payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(payloadBytes)) as {schema?:unknown;package?:unknown};
 if(payload.schema!=="wildz.native-resource-package.v128"||!verifyWildsResourcePackage(payload.package))throw Error("wilds_native_trade_resource_selection_mismatch");
 const pkg=payload.package;
 if(source.asset.kind==="package"){if(source.asset.packageId!==pkg.packageId)throw Error("wilds_native_trade_resource_selection_mismatch");return;}
 const actual=pkg.members.map(member=>`${member.kind}:${member.id}`).sort();
 const expected=[...source.asset.foodItemIds.map(id=>`food:${id}`),...source.asset.materialLotIds.map(id=>`material:${id}`),...source.asset.resourceLotIds.map(id=>`resource:${id}`)].sort();
 if(canonicalPortableCardJson(actual)!==canonicalPortableCardJson(expected))throw Error("wilds_native_trade_resource_selection_mismatch");
}
