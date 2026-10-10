import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import {parseWildzPlayerCoordinate} from './wildz-player-coordinate';
import type {WildzMarketSourceStateV128,WildzMarketSourceEventV128,WildzMarketSelectionV128,WildzMarketReservationV128} from './wildz-market-source-types-v128';
export const WILDZ_MARKET_SOURCE_DOMAIN_V128='world:wildz:market:v128';
export const WILDZ_MARKET_SOURCE_NAMESPACE_V128='wildz.market.v128';
export const WILDZ_MARKET_SOURCE_LAW_V128=Object.freeze({schema:'wildz.market-source-law.v128',version:3,semanticLocks:'one-shared-cas-exact-native-identity-and-finite-member-ids',custody:'private-sdk-admission-before-full-plan-approval',payment:'canonical-private-receipt-independent-from-sale-intent',expiry:'no-automatic-release-after-payment-pending',reducer:'wildz-market-source-journal-v128:4',terminal:'two-distinct-native-device-source-consents-exact-closing-terms',namespace:'immutable-law',terminalProjectionLimit:64});
const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value)).slice(7);
export const WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128=digest(WILDZ_MARKET_SOURCE_LAW_V128);
export const WILDZ_MARKET_SOURCE_REDUCER_DIGEST_V128=digest({...WILDZ_MARKET_SOURCE_LAW_V128,implementation:'closed-source-law'});
export const WILDZ_MARKET_SOURCE_GENESIS_HEAD_V128=digest({schema:'wildz.market-source-genesis.v128',law:WILDZ_MARKET_SOURCE_LAW_V128});
const sha=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9:._-]{6,180}$/.test(value);
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
function fail(reason:string):never{throw Error(`wildz_market_source_${reason}`);}
export function initialWildzMarketSourceV128():WildzMarketSourceStateV128{return {schema:'wildz.market-source-state.v128',listings:{},semanticLocks:{},terminalOrder:[]};}
export function wildzMarketSourceHeadV128(state:WildzMarketSourceStateV128){return digest(state);}
export function validateWildzMarketSelectionV128(selection:WildzMarketSelectionV128){
 if(!selection||!same(Object.keys(selection).sort(),['asset','creatureCount','resourceUnits','semanticIds','sourceDigest','summary'])||!sha(selection.sourceDigest)
  ||typeof selection.summary!=='string'||selection.summary.length<1||selection.summary.length>240||/[\u0000-\u001f\u007f]/.test(selection.summary)
  ||!Number.isSafeInteger(selection.resourceUnits)||selection.resourceUnits<0||selection.resourceUnits>1_000_000
  ||!Number.isSafeInteger(selection.creatureCount)||selection.creatureCount<0||selection.creatureCount>1
  ||!Array.isArray(selection.semanticIds)||!selection.semanticIds.length||selection.semanticIds.length>65
  ||selection.semanticIds.some(item=>typeof item!=='string'||!item||item.length>1000||/[\u0000-\u001f\u007f]/.test(item))
  ||new Set(selection.semanticIds).size!==selection.semanticIds.length||!same(selection.semanticIds,[...selection.semanticIds].sort()))fail('selection_invalid');
 const asset=selection.asset;
 if(asset.kind==='inventory'){
  if(!same(Object.keys(asset).sort(),['foodItemIds','kind','materialLotIds','resourceLotIds'])||[asset.foodItemIds,asset.materialLotIds,asset.resourceLotIds].some(items=>!Array.isArray(items)))fail('selection_invalid');
  const ids=[...asset.foodItemIds,...asset.materialLotIds,...asset.resourceLotIds];
  if(!ids.length||ids.length>64||new Set(ids).size!==ids.length||ids.some(item=>typeof item!=='string'||!item||item.length>800)
   ||!same(selection.semanticIds,ids.map(item=>`resource:${item}`).sort())||selection.creatureCount!==0)fail('semantic_ids');
 }else if(asset.kind==='package'){
  if(!same(Object.keys(asset).sort(),['kind','packageId'])||!/^wildz:package:[a-f0-9]{64}$/.test(asset.packageId)
   ||!selection.semanticIds.includes(`package:${asset.packageId}`)||selection.semanticIds.filter(item=>item.startsWith('package:')).length!==1
   ||selection.semanticIds.some(item=>!item.startsWith('resource:')&&!item.startsWith('package:'))||selection.creatureCount!==0)fail('semantic_ids');
 }else if(asset.kind==='creature'){
  if(!same(Object.keys(asset).sort(),['assetId','kind'])||typeof asset.assetId!=='string'||!asset.assetId||asset.assetId.length>800
   ||selection.semanticIds.length!==1||!/^creature:.+:[a-f0-9]{64}$/.test(selection.semanticIds[0]!)||selection.creatureCount!==1||selection.resourceUnits!==0)fail('semantic_ids');
 }else fail('selection_invalid');
 return selection;
}
/** This law admits authenticated market intentions and sticky reservations.
 * A phase reports the peers' signed evidence digests; it grants no asset or
 * payment authority. The private purchase adapter re-admits those Originals. */
export function reduceWildzMarketSourceV128(before:WildzMarketSourceStateV128,event:WildzMarketSourceEventV128,actualActorHandle:string):WildzMarketSourceStateV128{
 if(!event||event.schema!=='wildz.market-source-command.v128'||event.actorHandle!==actualActorHandle
  ||parseWildzPlayerCoordinate(actualActorHandle)?.profileHandle!==actualActorHandle)fail('actor_mismatch');
 if(!id(event.attemptId)||!id(event.listingId))fail('command_invalid');
 const common=['actorHandle','attemptId','kind','listingId','schema'];
 const fields:Record<WildzMarketSourceEventV128['kind'],readonly string[]>={list:['priceUsdCents','selection'],cancel:['expectedListingHead'],reserve:['expectedListingHead','reservationId'],release:['expectedReservationHead','reservationId'],approved:['amountPhiMicro','approvalDigest','expectedReservationHead','planDigest','quoteDigest','reservationId','sourceHead'],'terminal-consent':['approvalDigest','assetReceiptDigest','expectedReservationHead','outcome','paymentReceiptDigest','planDigest','reservationId','zeroWriteReceiptDigest'],progress:['expectedReservationHead','phase','reservationId',...(event.kind==='progress'&&event.receiptDigest!==undefined?['receiptDigest']:[])]};
 if(!fields[event.kind]||!same(Object.keys(event).sort(),[...common,...fields[event.kind]].sort()))fail('command_invalid');
 const listed=before.listings[event.listingId];
 const eventHead=digest({schema:'wildz.market-row-head.v128',prior:listed?.reservation?.reservationHead??listed?.listingHead??null,event});
 const listings={...before.listings},semanticLocks={...before.semanticLocks};
 const release=()=>{for(const semantic of listed!.selection.semanticIds){if(semanticLocks[semantic]!==listed!.listingId)fail('semantic_lock_mismatch');delete semanticLocks[semantic];}};
 if(event.kind==='list'){
  validateWildzMarketSelectionV128(event.selection);
  if(listed||Object.values(before.listings).filter(row=>row.status==='active'||row.status==='reserved').length>=512||!Number.isSafeInteger(event.priceUsdCents)||event.priceUsdCents<1||event.priceUsdCents>1_000_000_000)fail('listing_invalid');
  for(const semantic of event.selection.semanticIds){if(semanticLocks[semantic])fail('semantic_locked');semanticLocks[semantic]=event.listingId;}
  listings[event.listingId]={listingId:event.listingId,sellerHandle:event.actorHandle,selection:structuredClone(event.selection),priceUsdCents:event.priceUsdCents,listingHead:eventHead,status:'active',reservation:null};
 }else if(event.kind==='cancel'){
  if(!listed||listed.status!=='active'||listed.reservation||listed.listingHead!==event.expectedListingHead||listed.sellerHandle!==event.actorHandle)fail('listing_unavailable');
  release();listings[event.listingId]={...listed,status:'cancelled',listingHead:eventHead};
 }else if(event.kind==='reserve'){
  if(!listed||listed.status!=='active'||listed.reservation||listed.listingHead!==event.expectedListingHead||listed.sellerHandle===event.actorHandle||!id(event.reservationId))fail('listing_unavailable');
  listings[event.listingId]={...listed,status:'reserved',reservation:{reservationId:event.reservationId,listingId:listed.listingId,listingHead:listed.listingHead,reservationHead:eventHead,buyerHandle:event.actorHandle,sellerHandle:listed.sellerHandle,priceUsdCents:listed.priceUsdCents,phase:'reserved'}};
 }else{
  const reservation=listed?.reservation;
  if(!listed||listed.status!=='reserved'||!reservation||reservation.reservationId!==event.reservationId||reservation.reservationHead!==event.expectedReservationHead)fail('reservation_unavailable');
  if(![reservation.buyerHandle,reservation.sellerHandle].includes(event.actorHandle))fail('participant_required');
  // An in-flight native debit may become observable after the first expired
  // zero-write coordination consent. Canonical payment wins; this progress
  // still reports only intention here and requires private receipt admission
  // before publication. It never releases the source or grants asset custody.
  const supersedesZeroWrite=reservation.terminalConsent?.outcome==='zero-write'&&reservation.phase==='payment-pending'
   &&event.kind==='progress'&&event.phase==='paid'&&sha(event.receiptDigest);
  if(reservation.terminalConsent&&event.kind!=='terminal-consent'&&!supersedesZeroWrite)fail('terminal_consent_locked');
  if(event.kind==='release'){
   if(!['reserved','approved'].includes(reservation.phase))fail('payment_locked');
   // Retain semantic locks while the same seller offer is available again.
   listings[event.listingId]={...listed,status:'active',listingHead:eventHead,reservation:null};
  }else if(event.kind==='approved'){
   if(reservation.phase!=='reserved'||![event.quoteDigest,event.planDigest,event.approvalDigest].every(sha)||!/^[1-9][0-9]{0,30}$/.test(event.amountPhiMicro))fail('approval_invalid');
   const source=event.sourceHead;
   if(!source||source.ownerHandle!==reservation.sellerHandle||![source.sourceArtifactSha256,source.sourcePayloadSha256].every(sha))fail('descriptor_selection');
   if('protocol' in source){
    const expected=listed.selection.semanticIds.filter(item=>item.startsWith('resource:')).map(item=>item.slice(9));
    if(source.protocol!=='wildz.resource-source.v128'||!same(source.memberIds,expected)||listed.selection.asset.kind==='creature'
     ||listed.selection.asset.kind==='package'&&source.packageId!==listed.selection.asset.packageId)fail('descriptor_selection');
   }else if(listed.selection.asset.kind!=='creature'||listed.selection.semanticIds[0]!==`creature:${source.namespace}:${source.artifactId}`)fail('descriptor_selection');
   listings[event.listingId]={...listed,reservation:{...reservation,phase:'approved',reservationHead:eventHead,quoteDigest:event.quoteDigest,planDigest:event.planDigest,amountPhiMicro:event.amountPhiMicro,sourceHead:structuredClone(source),approvalDigest:event.approvalDigest}};
  }else if(event.kind==='terminal-consent'){
   if(!['completed','zero-write'].includes(event.outcome)||event.planDigest!==reservation.planDigest||event.approvalDigest!==reservation.approvalDigest
    ||![event.planDigest,event.approvalDigest].every(sha))fail('terminal_consent_invalid');
   if(event.outcome==='completed'?(reservation.phase!=='asset-accepted'||event.paymentReceiptDigest!==reservation.paymentReceiptDigest||event.assetReceiptDigest!==reservation.assetReceiptDigest
      ||!sha(event.paymentReceiptDigest)||!sha(event.assetReceiptDigest)||event.zeroWriteReceiptDigest!==null)
     :(reservation.phase!=='payment-pending'||event.paymentReceiptDigest!==null||event.assetReceiptDigest!==null||!sha(event.zeroWriteReceiptDigest)))fail('terminal_receipts_required');
   const terms={outcome:event.outcome,planDigest:event.planDigest,approvalDigest:event.approvalDigest,paymentReceiptDigest:event.paymentReceiptDigest,assetReceiptDigest:event.assetReceiptDigest,zeroWriteReceiptDigest:event.zeroWriteReceiptDigest};
   const prior=reservation.terminalConsent;
   if(prior){const {actors:_,...actual}=prior;if(!same(actual,terms)||prior.actors.includes(event.actorHandle))fail('terminal_consent_mismatch');}
   const actors=[...(prior?.actors??[]),event.actorHandle].sort(),closed=actors.length===2;
   if(closed)release();
   listings[event.listingId]={...listed,status:closed?(event.outcome==='completed'?'sold':'cancelled'):'reserved',reservation:{...reservation,reservationHead:eventHead,terminalConsent:{...terms,actors},...(closed?{phase:event.outcome==='completed'?'completed' as const:'cancelled' as const}:{})}};
  }else if(event.kind==='progress'){
   if((event.phase as string)==='completed')fail('dual_terminal_consent_required');
   const next:{[P in typeof event.phase]:readonly [string,string]}={ 'payment-pending':['approved',reservation.buyerHandle],paid:['payment-pending',event.actorHandle],'asset-pending':['paid',reservation.sellerHandle],'asset-accepted':['asset-pending',event.actorHandle]};
   const [phase,actor]=next[event.phase]??fail('phase_invalid');
   if(reservation.phase!==phase||event.actorHandle!==actor||event.phase!=='payment-pending'&&!sha(event.receiptDigest))fail('phase_invalid');
   const {terminalConsent,...withoutClosing}=reservation;
   const updated:WildzMarketReservationV128={...withoutClosing,...(terminalConsent&&!supersedesZeroWrite?{terminalConsent}:{}),phase:event.phase,reservationHead:eventHead,
    ...(event.phase==='paid'?{paymentReceiptDigest:event.receiptDigest!}:{}),...(event.phase==='asset-accepted'?{assetReceiptDigest:event.receiptDigest!}:{})};
   listings[event.listingId]={...listed,status:'reserved',reservation:updated};
  }else fail('command_invalid');
 }
 const terminalOrder=[...before.terminalOrder];
 if(listings[event.listingId]?.status==='cancelled'||listings[event.listingId]?.status==='sold')terminalOrder.push(event.listingId);
 while(terminalOrder.length>64){const expired=terminalOrder.shift()!;if(listings[expired]?.status==='sold'||listings[expired]?.status==='cancelled')delete listings[expired];}
 return {schema:before.schema,listings,semanticLocks,terminalOrder};
}
