'use client';
import {defaultContinuityDatabase,defaultIdentityRepository} from './wildz-active-identity';
import {readWildzIdentityForSigning} from './wildz-identity-signing-read';
import {createWildzMarketPublicationSdkV128,createWildzMarketPublicationSourceV128} from './wildz-market-publication-v128';
import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import type {WildsWalletAssetSendAsset,WildsWalletAssetSendSelection} from '../../features/play/wallet/wilds-wallet-asset-send';
import {validateWildzMarketSelectionV128} from './wildz-market-source-journal-v128';
import type {WildzMarketSelectionV128} from './wildz-market-source-types-v128';

/** A public offer from the current local Explorer. Its display fingerprint
 * carries no native title; purchase reopens the exact native asset privately. */
export function selectWildzMarketAdvertisementV128(asset:WildsWalletAssetSendAsset,held:readonly WildsWalletAssetSendSelection[],ownerHandle:string):WildzMarketSelectionV128{
 const selected=held.find(item=>canonicalPortableCardJson(item.asset)===canonicalPortableCardJson(asset));
 if(!selected)throw Error('This selection changed. Reopen Market and choose a held item.');
 const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value)).slice(7);
 const semanticIds=asset.kind==='inventory'?[...asset.foodItemIds,...asset.materialLotIds,...asset.resourceLotIds].map(id=>`resource:${id}`).sort()
  :asset.kind==='package'?[`package:${asset.packageId}`]:[`creature:profile:${ownerHandle}:${digest(asset.assetId)}`];
 return validateWildzMarketSelectionV128({asset:structuredClone(asset),semanticIds,sourceDigest:digest({schema:'wildz.market-advertisement-selection.v128',ownerHandle,asset,selected}),
  summary:selected.label.slice(0,240),resourceUnits:asset.kind==='creature'?0:selected.quantity,creatureCount:asset.kind==='creature'?1:0});
}

export function openWildzMarketPublicationBrowserV128(input:Readonly<{keyId:string;ownerHandle:string;currentIdentity():Readonly<{keyId:string;ownerHandle:string}>}>){
 return createWildzMarketPublicationSourceV128({...input,sdk:createWildzMarketPublicationSdkV128(),database:defaultContinuityDatabase,
  repository:{active:()=>defaultIdentityRepository.active(),withKeyFile:async(keyId,operation)=>operation(await readWildzIdentityForSigning(keyId))}});
}
