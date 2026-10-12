import {createReceizAppStateFeed,createReceizPublicStoreStateRecord,RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA,type JsonObject,type ReceizPublicStoreSignedPublish} from '@receiz/sdk';
import {canonicalPortableCardJson,verifyAnyWildsCard} from '../../features/play/portable-card';
import {parsePublicWildzProfileRecord,type PublicWildzProfileRecord} from './wildz-profile-record';
import {latestWildzOwnershipClaims,ownershipSyncProjection} from './wildz-ownership-reconcile';
import {parseWildzPlayerCoordinate,sameWildzPlayerCoordinate} from './wildz-player-coordinate';
import {WILDZ_PRODUCT} from '../wildz/product';
import type {PortableCardAsset} from '../../features/play/portable-card';

export const WILDZ_MARKET_COLLECTION_NAMESPACE='wildz.market-collection.v1';
export type WildzMarketOwnedCard=Readonly<{assetId:string;title:string;proofDigest:string;ownerHandle:string;claimKaiUPulse:string|null;claimHead:string|null;artworkUrl?:string;asset?:PortableCardAsset;valueUnavailable?:string;
 value?:Readonly<{proofValuePhiMicro:string;displayUsdCents:string|null;valuationKaiUPulse:string;algorithm:string;changeBps?:string|null}>}>;
export type WildzMarketTransfer=Readonly<{id:string;assetId:string;fromHandle:string;toHandle:string;kaiUPulse:string|null;headReference:string}>;

export function projectWildzMarketTransfers(records:readonly unknown[],cards:readonly WildzMarketOwnedCard[]):readonly WildzMarketTransfer[]{
 const owned=new Set(cards.map(card=>card.assetId)),seen=new Map<string,WildzMarketTransfer>();
 for(const raw of records){const claim=ownershipSyncProjection(raw);if(!claim||!owned.has(claim.assetId)||sameWildzPlayerCoordinate(claim.ownerReceizId,claim.previousOwnerReceizId))continue;
  const from=parseWildzPlayerCoordinate(claim.previousOwnerReceizId)?.profileHandle,to=parseWildzPlayerCoordinate(claim.ownerReceizId)?.profileHandle;
  if(!from||!to)continue;
  const id=`${claim.assetId}:${claim.headReference}`;
  seen.set(id,{id,assetId:claim.assetId,fromHandle:from,toHandle:to,kaiUPulse:claim.witnessedKaiUPulse??null,headReference:claim.headReference});
 }
 return [...seen.values()].sort((a,b)=>{const x=BigInt(a.kaiUPulse??'0'),y=BigInt(b.kaiUPulse??'0');return x>y?-1:x<y?1:a.id.localeCompare(b.id);});
}
export const wildzMarketCollectionUrl=(owner:string)=>{
 const coordinate=parseWildzPlayerCoordinate(owner);if(!coordinate)throw Error('wildz_market_collection_owner_invalid');
 return `${WILDZ_PRODUCT.origin}/receiz/market-collection/${encodeURIComponent(coordinate.actorId)}`;
};
export const wildzMarketCollectionInput=(record:PublicWildzProfileRecord)=>({tenantHost:WILDZ_PRODUCT.domain,merchantReceizId:parseWildzPlayerCoordinate(record.handle)!.profileHandle,
 title:'Wildz owned creature collection',sourceUrl:wildzMarketCollectionUrl(record.handle),namespace:WILDZ_MARKET_COLLECTION_NAMESPACE,
 projectionState:'published',platform:WILDZ_PRODUCT.name,storeStateRecord:record as unknown as JsonObject});

/** The directory carries the same public gallery, signed by the same owner.
 * It neither publishes private holdings nor authorizes a custody transition. */
export function parseSignedWildzMarketCollection(value:unknown,profileRecord:PublicWildzProfileRecord){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('wildz_market_collection_invalid');
 const signed=value as ReceizPublicStoreSignedPublish<JsonObject>,record=parsePublicWildzProfileRecord(signed.storeStateRecord),input=wildzMarketCollectionInput(profileRecord);
 const expected=createReceizAppStateFeed([createReceizPublicStoreStateRecord({sourceUrl:input.sourceUrl,externalCreatorId:input.merchantReceizId,title:input.title,
  namespace:input.namespace,state:'published',platform:input.platform,record:input.storeStateRecord,data:{storeStateRecord:input.storeStateRecord,tenantHost:input.tenantHost,merchantReceizId:input.merchantReceizId}})],
  {schema:RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA,namespace:input.namespace,externalCreatorId:input.merchantReceizId});
 if(!record||signed.schema!=='receiz.public_store.signed_publish.v1'||signed.tenantHost!==input.tenantHost||signed.merchantReceizId!==input.merchantReceizId
  ||canonicalPortableCardJson(record)!==canonicalPortableCardJson(profileRecord)||canonicalPortableCardJson(signed.feed)!==canonicalPortableCardJson(expected))throw Error('wildz_market_collection_invalid');
 return signed;
}

export function wildzMarketClaimProfileHandles(records:readonly unknown[]){
 return [...new Set(records.flatMap(row=>{const claim=ownershipSyncProjection(row);return claim?[claim.ownerReceizId,claim.previousOwnerReceizId]:[];}))];
}

/** Deduplicate profile cards using the latest witnessed claim, never publication
 * wall time, array order or append count. Unresolved duplicates are omitted. */
export function projectWildzMarketCollection(profiles:readonly PublicWildzProfileRecord[],claims:readonly unknown[]):readonly WildzMarketOwnedCard[]{
 const {heads,conflicts}=latestWildzOwnershipClaims(claims),candidates=new Map<string,WildzMarketOwnedCard[]>();
 const latestProfiles=new Map<string,PublicWildzProfileRecord>();
 for(const profile of profiles){const prior=latestProfiles.get(profile.handle);if(!prior||profile.publishedAt>prior.publishedAt)latestProfiles.set(profile.handle,profile);}
 for(const record of latestProfiles.values())for(const card of record.profile.vault){
  const owner=parseWildzPlayerCoordinate(record.handle)?.profileHandle;if(!owner||conflicts.has(card.id))continue;
  const claim=heads.get(card.id);
  if(claim&&!sameWildzPlayerCoordinate(claim.ownerReceizId,owner))continue;
  const rows=candidates.get(card.id)??[];
  const asset=record.vaultCards?.find(asset=>asset.id===card.id&&asset.proof.digest===card.proofDigest&&verifyAnyWildsCard(asset).ok);
  rows.push({assetId:card.id,title:card.name,proofDigest:card.proofDigest,ownerHandle:owner,claimKaiUPulse:claim?.witnessedKaiUPulse??null,claimHead:claim?.headReference??null,...(asset?{asset}:{})});
  candidates.set(card.id,rows);
 }
 return [...candidates.values()].flatMap(rows=>new Set(rows.map(row=>row.ownerHandle)).size===1?[rows[0]!]:[]).sort((a,b)=>{
  const left=BigInt(a.claimKaiUPulse??'0'),right=BigInt(b.claimKaiUPulse??'0');return left>right?-1:left<right?1:a.assetId.localeCompare(b.assetId);
 });
}
