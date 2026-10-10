import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import type {WildsResourcePackageMember} from '../../features/play/wilds-resource-package';
import type {WildsWalletAssetSendAsset} from '../../features/play/wallet/wilds-wallet-asset-send';
import type {openWildsResourcePackageExchangeBrowserV128} from './wilds-resource-exchange-browser-v128';
import {validateWildzMarketSelectionV128} from './wildz-market-source-journal-v128';
import type {WildzMarketSelectionV128} from './wildz-market-source-types-v128';
function fail(reason:string):never{throw Error(`wildz_market_resource_${reason}`);}
/** Explicit List action only. Full birth/import history is accepted by native
 * source CAS before reading units; existing JSON inventory never grants title.
 * This does not reserve a package or invent its not-yet-known buyer. */
export async function qualifyWildzMarketResourceSelectionV128(input:Readonly<{
 runtime:Awaited<ReturnType<typeof openWildsResourcePackageExchangeBrowserV128>>;
 asset:Exclude<WildsWalletAssetSendAsset,{kind:'creature'}>;summary:string;attemptId:string;
}>):Promise<WildzMarketSelectionV128>{
 const runtime=input.runtime,owner=runtime.ownerReceizId,asset=input.asset;
 let members:readonly WildsResourcePackageMember[],packageHead:string|null=null;
 if(asset.kind==='inventory'){
  const actual=await runtime.exchange.qualifyGameplay({attemptId:`${input.attemptId}:market-trace`});
  const ids=[...asset.foodItemIds,...asset.materialLotIds,...asset.resourceLotIds];
  if(!ids.length||ids.length>64||new Set(ids).size!==ids.length)fail('selection_invalid');
  members=ids.map(id=>{
   const member=actual.replay.members[id];
   if(!member||actual.state.spentMembers[id])fail('member_unavailable');
   const locked=actual.state.reservations[id];if(locked&&actual.state.packages[locked]?.status!=='unpacked')fail('member_reserved');
   if(member.kind==='food'?!asset.foodItemIds.includes(id):member.kind==='material'?!asset.materialLotIds.includes(id):!asset.resourceLotIds.includes(id))fail('member_kind_mismatch');
   return member;
  });
 }else{
  const actual=await runtime.exchange.readCurrent(),record=actual?.state.packages[asset.packageId];
  if(!record||record.ownerReceizId!==owner||record.status!=='claimed')fail('package_unavailable');
  members=record.package.members;packageHead=record.package.head;
 }
 const semanticIds=[...members.map(member=>`resource:${member.id}`),...(asset.kind==='package'?[`package:${asset.packageId}`]:[])].sort();
 const basis=members.map(member=>member.kind==='food'?{kind:member.kind,id:member.id,item:member.foodItem}:member).sort((a,b)=>a.id.localeCompare(b.id));
 const selection:WildzMarketSelectionV128={asset:structuredClone(asset),semanticIds,
  sourceDigest:sha256PortableBasis(canonicalPortableCardJson({schema:'wildz.market-selected-resource-source.v128',ownerReceizId:owner,asset:asset,members:basis,packageHead})).slice(7),
  summary:input.summary,resourceUnits:members.reduce((sum,member)=>sum+(member.kind==='resource'?member.resourceLot.quantity:1),0),creatureCount:0};
 validateWildzMarketSelectionV128(selection);return Object.freeze({...selection,semanticIds:Object.freeze(semanticIds)});
}
