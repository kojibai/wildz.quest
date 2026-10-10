"use client";

import { receizKaiNow } from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis } from "../play/portable-card";
import { parseWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { admitWildzMarketConnectQuoteV128, sameWildzMarketConnectQuoteV128, type WildzMarketConnectQuoteV128 } from "../../lib/receiz/wildz-market-quote-v128";
import type { WildzMarketSourceRepositoryV128, WildzMarketSourceSnapshotV128, WildzMarketSelectionV128, WildzMarketListingV128, WildzMarketSourceEventV128, WildzMarketReservationV128 } from "../../lib/receiz/wildz-market-source-types-v128";
import { validateWildzMarketSelectionV128 } from "../../lib/receiz/wildz-market-source-journal-v128";
import { createWildsWalletStagedTradeAdapter, type WildsWalletStagedTradeAdapterInput } from "../play/wallet/wilds-wallet-staged-trade-adapter";
import { createWildsWalletConnectPhiPort, type WildsWalletConnectPhiLeg } from "../play/wallet/wilds-wallet-connect-phi-port";
import { createWildsWalletStagedTradePlan, type WildsWalletStagedTradeAssetAuthority, type WildsWalletStagedTradePlan, type WildsWalletStagedTradeResult } from "../play/wallet/wilds-wallet-staged-trade-types";
import { admitWildsWalletStagedTradeMessage } from "../play/wallet/wilds-wallet-staged-trade-messaging";
import { admitWildsWalletStagedTradeRecovery, wildsWalletBrowserStagedTradeRecoveryStore, type WildsWalletStagedTradeRecoveryEntry } from "../play/wallet/wilds-wallet-staged-trade-recovery";
import { verifyWildsWalletStagedTradeIdentityApproval } from "../play/wallet/wilds-wallet-staged-trade-identity";
import { createWildzMarketPurchaseAgreementV128, type WildzMarketPurchaseTermsV128 } from "./wildz-market-purchase-terms-v128";
import { admitWildzMarketRecoveryV128, wildzMarketBrowserRecoveryStoreV128, wildzMarketStorageErrorV128, type WildzMarketRecoveryStoreV128, type WildzMarketRecoveryV128, type WildzMarketPurchaseCheckpointV128 } from "./wildz-market-recovery-v128";
import type { WildzMarketServiceV128, WildzMarketSnapshotV128, WildzMarketPurchaseReviewV128, WildzMarketResultV128, WildzMarketReadSelectionsV128 } from "./wildz-market-service-v128";
import {createWildzMarketArchiveStoreV128,type WildzMarketArchiveStoreV128} from "./wildz-market-archive-v128";
import {wildsWalletBrowserStagedTradeArchiveStore} from "../play/wallet/wilds-wallet-staged-trade-archive";
import type { WildsWalletAssetSendAsset } from "../play/wallet/wilds-wallet-asset-send";

type Transition=Extract<WildzMarketSourceEventV128,{kind:"approved"|"progress"|"terminal-consent"}>;
export type WildzMarketServiceInputV128=Readonly<{
 keyId:string;ownerHandle:string;currentIdentity():Readonly<{keyId:string;ownerHandle:string}>;
 openSource(callbacks:Readonly<{verifyTransition(event:Transition,listing:WildzMarketListingV128):Promise<void>}>):Promise<WildzMarketSourceRepositoryV128>;
 qualifySelection(asset:WildsWalletAssetSendAsset):Promise<WildzMarketSelectionV128>;
 readSelections:WildzMarketReadSelectionsV128;
 staged:Omit<WildsWalletStagedTradeAdapterInput,"keyId"|"ownerHandle"|"currentIdentity"|"phi"|"marketExecution">;
 fetcher?:typeof fetch;store?:WildzMarketRecoveryStoreV128;archiveStore?:WildzMarketArchiveStoreV128;currentKai?():number;
}>;
/** Trusted native boundary ports are injectable for isolated tests. The public
 * production factory supplies the released SDK verifiers and Connect sender. */
export type WildzMarketNativePortsV128=Readonly<{
 verifyApproval?:typeof verifyWildsWalletStagedTradeIdentityApproval;
 createAdapter?:typeof createWildsWalletStagedTradeAdapter;
 createPhi?:typeof createWildsWalletConnectPhiPort;
}>;
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value)).replace(/^sha256:/,"");
const failure=(cause:unknown):WildzMarketResultV128=>({status:"failed",message:cause instanceof Error?cause.message:"The exact marketplace action could not be opened."});
class QuoteChanged extends Error { constructor(){super("The actual wallet quote changed or expired before payment. Review the current USD price and exact Phi again.");} }

/** A staged purchase coordinator. Native proof admission and each real rail
 * remain separate; this service never claims atomic payment-and-asset custody. */
export function createWildzMarketControllerV128(input:WildzMarketServiceInputV128,native:WildzMarketNativePortsV128={}):WildzMarketServiceV128{
 if(parseWildzPlayerCoordinate(input.ownerHandle)?.profileHandle!==input.ownerHandle||!input.keyId)throw Error("The current marketplace Explorer is required.");
 const ownerKey=JSON.stringify([input.ownerHandle,input.keyId]),store=input.store??wildzMarketBrowserRecoveryStoreV128;
 const archive=input.archiveStore??(input.store===undefined?createWildzMarketArchiveStoreV128():undefined),archiveOwner={keyId:input.keyId,ownerHandle:input.ownerHandle};
 const archivedEntries=new Map<string,WildsWalletStagedTradeRecoveryEntry>();
 const stagedArchive=input.staged.archiveStore??(input.staged.recoveryStore===undefined?wildsWalletBrowserStagedTradeArchiveStore:undefined);
 const stagedStore=input.staged.recoveryStore??wildsWalletBrowserStagedTradeRecoveryStore;
 const verifyApproval=native.verifyApproval??verifyWildsWalletStagedTradeIdentityApproval;
 const listeners=new Set<(snapshot:WildzMarketSnapshotV128)=>void>();
 let sourceSnapshot:WildzMarketSourceSnapshotV128|null=null;
 let snapshot:WildzMarketSnapshotV128={status:"ready",message:"Open the market to check current source listings.",listings:[],purchases:[],sellables:[]};
 let sourceOpening:Promise<WildzMarketSourceRepositoryV128>|null=null;
 const current=()=>{const binding=input.currentIdentity();if(binding.keyId!==input.keyId||binding.ownerHandle!==input.ownerHandle)throw Error("The Explorer changed. Reopen the same marketplace action.");};
 const kai=()=>input.currentKai?.()??receizKaiNow().pulse;
 const load=()=>{current();return admitWildzMarketRecoveryV128(store.load(ownerKey),input.ownerHandle,input.keyId);};
 const save=(value:WildzMarketRecoveryV128)=>{current();store.write(ownerKey,value);if(!same(load(),value))throw wildzMarketStorageErrorV128();};
 const replacePurchase=(checkpoint:WildzMarketPurchaseCheckpointV128)=>{
  const record=load(),id=checkpoint.agreement.market!.purchaseId,index=record.purchases.findIndex(item=>item.agreement.market!.purchaseId===id),purchases=[...record.purchases];
  if(index<0)purchases.push(checkpoint);else purchases[index]=checkpoint;save({...record,purchases,pendingReservations:record.pendingReservations.filter(attempt=>attempt.reservationId!==checkpoint.agreement.market!.reservationId)});return checkpoint;
 };
 const purchase=(id:string)=>{const saved=load().purchases.find(item=>item.agreement.market!.purchaseId===id);if(!saved)throw Error("Open and save this exact marketplace review first.");return saved;};
 const termsFor=(plan:WildsWalletStagedTradePlan)=>{if(plan.agreement.purpose!=="market"||!plan.agreement.market)throw Error("Only an exact marketplace purchase may use this service.");return plan.agreement.market;};
 const savedPlan=(plan:WildsWalletStagedTradePlan)=>{const terms=termsFor(plan),saved=purchase(terms.purchaseId);if(!same(createWildsWalletStagedTradePlan(saved.agreement),plan))throw Error("This saved purchase has different exact terms.");return saved;};
 const entry=(plan:WildsWalletStagedTradePlan):WildsWalletStagedTradeRecoveryEntry|undefined=>{
  const raw=stagedStore.load(input.ownerHandle);if(raw==null)return archivedEntries.get(plan.tradeId);
  if(!object(raw)||!object(raw.binding)||raw.binding.ownerHandle!==input.ownerHandle||raw.binding.keyId!==input.keyId||typeof raw.binding.identityArtifactDigest!=="string")throw wildzMarketStorageErrorV128();
  const record=admitWildsWalletStagedTradeRecovery(raw,{ownerHandle:input.ownerHandle,keyId:input.keyId,identityArtifactDigest:raw.binding.identityArtifactDigest});
  return record.trades.find(item=>item.plan.tradeId===plan.tradeId&&same(item.plan,plan))??archivedEntries.get(plan.tradeId);
 };
 const approvals=async(plan:WildsWalletStagedTradePlan)=>{
  const saved=entry(plan);if(!saved||saved.approvals.length!==2)throw Error("Both exact device approvals are required before marketplace payment or delivery.");
  const identities=await Promise.all(saved.approvals.map(approval=>verifyApproval(approval,plan)));current();
  for(let index=0;index<identities.length;index++){
   const identity=identities[index]!,approval=saved.approvals[index]!;
   if(identity.ownerHandle!==approval.ownerHandle||identity.keyId!==approval.keyId||identity.identityArtifactDigest!==approval.identityArtifactDigest||approval.ownerHandle===input.ownerHandle&&approval.keyId!==input.keyId)throw Error("The marketplace device approval belongs to another Explorer.");
  }
  return {saved,identities};
 };
 const authority=async(plan:WildsWalletStagedTradePlan):Promise<WildsWalletStagedTradeAssetAuthority>=>{
  const admitted=await approvals(plan);return {plan,approvals:admitted.saved.approvals,acceptedNotBeforeKai:admitted.identities.reduce((maximum,identity)=>BigInt(identity.approvalKai)>maximum?BigInt(identity.approvalKai):maximum,0n).toString()};
 };
 const source=async()=>{
  current();if(!sourceOpening){const operation=input.openSource({verifyTransition});sourceOpening=operation;void operation.finally(()=>{if(sourceOpening===operation)sourceOpening=null;}).catch(()=>undefined);}
  const opened=await sourceOpening;current();return opened;
 };
 const reservation=async(plan:WildsWalletStagedTradePlan)=>{
  const terms=termsFor(plan);savedPlan(plan);
  const actual=await (await source()).verifyReservation({listingId:terms.listingId,reservationId:terms.reservationId,buyerHandle:terms.buyerHandle,sellerHandle:terms.sellerHandle,priceUsdCents:Number(terms.quote.priceUsdCents),listingHead:terms.listingHead});current();sourceSnapshot=actual.snapshot;
  assertListing(terms,actual.listing);return actual.listing;
 };
 function assertListing(terms:WildzMarketPurchaseTermsV128,listing:WildzMarketListingV128){
  const r=listing.reservation;
  if(!r||r.reservationId!==terms.reservationId||r.buyerHandle!==terms.buyerHandle||r.sellerHandle!==terms.sellerHandle||r.listingHead!==terms.listingHead||listing.sellerHandle!==terms.sellerHandle||String(listing.priceUsdCents)!==terms.quote.priceUsdCents
   ||listing.selection.sourceDigest!==terms.sourceDigest||!same(listing.selection.asset,terms.asset)||r.phase==="reserved"&&r.reservationHead!==terms.reservationHead)throw Error("The exact named listing source or reservation changed. No new payment was started.");
  if(r.phase!=="reserved"&&r.phase!=="cancelled"&&(r.planDigest!==digest(createWildsWalletStagedTradePlan(purchase(terms.purchaseId).agreement))||r.quoteDigest!==digest(terms.quote)||r.amountPhiMicro!==terms.quote.amountPhiMicro))throw Error("Another approved purchase already holds this source reservation.");
 }
 const quote=async(priceUsdCents:string):Promise<WildzMarketConnectQuoteV128>=>{
  if(input.staged.ensureReady&&await input.staged.ensureReady()===false)throw Error("Reconnect the same Explorer before reviewing the current market quote.");current();
  const response=await (input.fetcher??fetch)("/api/market/purchases/quote",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({priceUsdCents})});
  const body:unknown=await response.json();current();if(!response.ok||!object(body)||Object.keys(body).join(",")!=="quote")throw Error("The actual buyer wallet quote is unavailable. Nothing was sent.");
  const actual=admitWildzMarketConnectQuoteV128(body.quote);if(actual.ownerHandle!==input.ownerHandle||actual.priceUsdCents!==priceUsdCents||actual.expiresAtKai<=kai())throw Error("The actual current buyer quote is required.");return actual;
 };
 const phi=(native.createPhi??createWildsWalletConnectPhiPort)({keyId:input.keyId,ownerHandle:input.ownerHandle,currentBinding:input.currentIdentity,ensureReady:input.staged.ensureReady,fetcher:input.fetcher,
  beforeSubmit:async leg=>{
   const checkpoint=load().purchases.find(item=>createWildsWalletStagedTradePlan(item.agreement).legs.some(candidate=>candidate.kind==="phi"&&same(candidate, {...leg,kind:"phi",legId:leg.attemptId})));
   if(!checkpoint)throw Error("This exact payment is not part of a saved marketplace purchase.");
   const plan=createWildsWalletStagedTradePlan(checkpoint.agreement),terms=termsFor(plan);
   if(terms.buyerHandle!==input.ownerHandle||leg.amountPhiMicro!==terms.quote.amountPhiMicro||leg.recipientHandle!==terms.sellerHandle)throw Error("The payment does not match this named marketplace purchase.");
   let listing=await reservation(plan);await approvals(plan);
   // This is the final pre-debit read. Submitted/uncertain attempts never
   // re-enter it: the Connect port observes their original sealed nonce only.
   if(checkpoint.reviewRequired||terms.quote.expiresAtKai<=kai()||!sameWildzMarketConnectQuoteV128(terms.quote,await quote(terms.quote.priceUsdCents))){replacePurchase({...checkpoint,reviewRequired:true,message:new QuoteChanged().message});throw new QuoteChanged();}
   if(listing.reservation!.phase==="reserved")listing=await progressApproved(plan,listing);
   if(listing.reservation!.phase==="approved")listing=await progress(plan,listing,"payment-pending");
   if(listing.reservation!.phase!=="payment-pending")throw Error("Resolve the original purchase payment before starting any new debit.");
  }
 });
 const verifyPayment=async(plan:WildsWalletStagedTradePlan)=>{
  const saved=(await approvals(plan)).saved,leg=plan.legs[0]!;if(leg.kind!=="phi"||saved.legs[0]?.status!=="committed")throw Error("The actual buyer payment receipt is required before asset delivery.");
  const receipt=saved.legs[0].receipt;await phi.verifyPhiReceipt(leg,{status:"committed",receipt});current();return receipt;
 };
 const verifyAsset=async(plan:WildsWalletStagedTradePlan)=>{
  const saved=(await approvals(plan)).saved,leg=plan.legs[1]!;if(leg.kind!=="asset"||saved.legs[1]?.status!=="accepted")throw Error("The actual native source acceptance is required before the sale can complete.");
  const descriptor=saved.approvals.find(approval=>approval.ownerHandle===leg.senderHandle)?.sourceHeads.find(head=>head.legId===leg.legId);
  if(!descriptor)throw Error("The exact seller-approved asset source is required.");
  const receipt=saved.legs[1].receipt;await input.staged.assetPort.verifyAccepted(leg,descriptor,{status:"accepted",receipt},await authority(plan));current();return receipt;
 };
 async function verifyTransition(event:Transition,listing:WildzMarketListingV128){
  current();const checkpoint=load().purchases.find(saved=>saved.agreement.market!.listingId===event.listingId&&saved.agreement.market!.reservationId===event.reservationId
   &&(event.kind!=="approved"||digest(createWildsWalletStagedTradePlan(saved.agreement))===event.planDigest));
  if(!checkpoint)throw Error("The exact private purchase proofs are required for this source transition.");
  const plan=createWildsWalletStagedTradePlan(checkpoint.agreement),terms=termsFor(plan);assertListing(terms,listing);
  const admitted=await approvals(plan),asset=plan.legs[1]!;
  const descriptor=admitted.saved.approvals.find(approval=>approval.ownerHandle===terms.sellerHandle)?.sourceHeads.find(head=>head.legId===asset.legId);
  if(!descriptor)throw Error("The exact approved seller source descriptor is required.");
  if(event.kind==="approved"){
   if(listing.reservation?.phase!=="reserved"||event.expectedReservationHead!==terms.reservationHead||event.quoteDigest!==digest(terms.quote)||event.planDigest!==digest(plan)||event.amountPhiMicro!==terms.quote.amountPhiMicro||event.approvalDigest!==digest([...admitted.saved.approvals].sort((a,b)=>a.ownerHandle.localeCompare(b.ownerHandle)))||!same(event.sourceHead,descriptor))throw Error("This source approval does not bind both exact marketplace device approvals.");
  }else if(event.kind==="terminal-consent"){
   if(event.planDigest!==digest(plan)||event.approvalDigest!==digest([...admitted.saved.approvals].sort((a,b)=>a.ownerHandle.localeCompare(b.ownerHandle))))throw Error("The closing consents do not match both exact approvals.");
   if(event.outcome==="completed"){const payment=await verifyPayment(plan),accepted=await verifyAsset(plan);if(event.paymentReceiptDigest!==digest(payment)||event.assetReceiptDigest!==digest(accepted)||event.zeroWriteReceiptDigest!==null)throw Error("Actual independently verified payment and delivery are required for closing consent.");}
   else{const receipt=await verifyZeroWrite(plan);if(event.paymentReceiptDigest!==null||event.assetReceiptDigest!==null||event.zeroWriteReceiptDigest!==digest(receipt))throw Error("The actual expired rejection witness is required for voluntary closing consent.");}
  }else{
   if(event.phase==="payment-pending"){if(event.actorHandle!==terms.buyerHandle||checkpoint.reviewRequired||terms.quote.expiresAtKai<=kai())throw new QuoteChanged();}
   else if(event.phase==="paid"||event.phase==="asset-pending"){const payment=await verifyPayment(plan);if(event.receiptDigest!==digest(payment))throw Error("The source progress does not match the actual canonical payment.");}
   else {await verifyPayment(plan);const accepted=await verifyAsset(plan);if(event.receiptDigest!==digest(accepted))throw Error("The source progress does not match the exact accepted delivery.");}
  }
 }
 async function progressApproved(plan:WildsWalletStagedTradePlan,listing:WildzMarketListingV128){
  const admitted=await approvals(plan),terms=termsFor(plan),descriptor=admitted.saved.approvals.find(approval=>approval.ownerHandle===terms.sellerHandle)!.sourceHeads[0]!;
  const result=await (await source()).transition({schema:"wildz.market-source-command.v128",kind:"approved",actorHandle:input.ownerHandle,attemptId:`${terms.purchaseId}:approved`,listingId:terms.listingId,reservationId:terms.reservationId,expectedReservationHead:listing.reservation!.reservationHead,quoteDigest:digest(terms.quote),planDigest:digest(plan),amountPhiMicro:terms.quote.amountPhiMicro,sourceHead:descriptor,approvalDigest:digest([...admitted.saved.approvals].sort((a,b)=>a.ownerHandle.localeCompare(b.ownerHandle)))});
  current();sourceSnapshot=result.snapshot;return result.listing;
 }
 async function progress(plan:WildsWalletStagedTradePlan,listing:WildzMarketListingV128,phase:Extract<Transition,{kind:"progress"}>["phase"]){
  const terms=termsFor(plan);let receiptDigest:string|undefined;
  if(phase==="paid"||phase==="asset-pending")receiptDigest=digest(await verifyPayment(plan));
  if(phase==="asset-accepted")receiptDigest=digest(await verifyAsset(plan));
  const result=await (await source()).transition({schema:"wildz.market-source-command.v128",kind:"progress",actorHandle:input.ownerHandle,attemptId:`${terms.purchaseId}:${phase}`,listingId:terms.listingId,reservationId:terms.reservationId,expectedReservationHead:listing.reservation!.reservationHead,phase,...(receiptDigest?{receiptDigest}:{})});
  current();sourceSnapshot=result.snapshot;return result.listing;
 }
 const observedRejection=async(plan:WildsWalletStagedTradePlan)=>{
  const saved=(await approvals(plan)).saved,leg=plan.legs[0]!;
  if(leg.kind!=="phi")throw Error("The exact payment leg is required.");
  let receipt=purchase(termsFor(plan).purchaseId).noWriteReceipt??saved.legs[0]?.receipt;
  if(!receipt)for(const conversation of await input.staged.readConversations())for(const message of conversation.messages){
   if(message.deletedAt||message.editedAt||message.senderHandle!==leg.senderHandle||message.recipientHandle!==leg.recipientHandle)continue;
   if(object(message.context)&&message.context.kind==="trade-staged-progress"&&message.context.tradeId===plan.tradeId&&message.context.legId===leg.legId&&object(message.context.outcome)&&message.context.outcome.receipt)receipt=message.context.outcome.receipt;
  }
  const observed=await phi.observePhi(leg,receipt);current();
  if(observed.status!=="failed"||!observed.receipt||observed.receipt.schema!=="wildz.wallet.connect-zero-write-receipt.v1")throw Error("The original payment remains unresolved or has committed. Keep its reservation.");
  const checkpoint=savedPlan(plan);replacePurchase({...checkpoint,noWriteReceipt:observed.receipt});return observed.receipt;
 };
 const verifyZeroWrite=async(plan:WildsWalletStagedTradePlan)=>{
  const receipt=await observedRejection(plan),leg=plan.legs[0]!;
  if(leg.kind!=="phi")throw Error("The exact payment leg is required.");
  await phi.verifyPhiZeroWrite(leg,receipt);current();return receipt;
 };
 async function closeSource(plan:WildsWalletStagedTradePlan,listing:WildzMarketListingV128,outcome:"completed"|"zero-write"){
  const terms=termsFor(plan),admitted=await approvals(plan),r=listing.reservation!;
  if(r.terminalConsent?.actors.includes(input.ownerHandle))return listing;
  const closing=outcome==="completed"?{paymentReceiptDigest:digest(await verifyPayment(plan)),assetReceiptDigest:digest(await verifyAsset(plan)),zeroWriteReceiptDigest:null}:{paymentReceiptDigest:null,assetReceiptDigest:null,zeroWriteReceiptDigest:digest(await verifyZeroWrite(plan))};
  const result=await (await source()).transition({schema:"wildz.market-source-command.v128",kind:"terminal-consent",actorHandle:input.ownerHandle,attemptId:`${terms.purchaseId}:terminal:${outcome}:${input.ownerHandle}`,listingId:terms.listingId,reservationId:terms.reservationId,expectedReservationHead:r.reservationHead,outcome,planDigest:digest(plan),approvalDigest:digest([...admitted.saved.approvals].sort((a,b)=>a.ownerHandle.localeCompare(b.ownerHandle))),...closing});
  current();sourceSnapshot=result.snapshot;return result.listing;
 }
 const adapter=(native.createAdapter??createWildsWalletStagedTradeAdapter)({...input.staged,keyId:input.keyId,ownerHandle:input.ownerHandle,currentIdentity:input.currentIdentity,phi,fetcher:input.fetcher??input.staged.fetcher,
  marketExecution:{assert:async(plan,phase)=>{
   const checkpoint=savedPlan(plan),terms=termsFor(plan);let listing=await reservation(plan);
   if(phase==="approve"){
    if(checkpoint.reviewRequired||terms.quote.expiresAtKai<=kai()){replacePurchase({...checkpoint,reviewRequired:true,message:new QuoteChanged().message});throw new QuoteChanged();}
    if(input.ownerHandle===terms.sellerHandle&&!same(await input.qualifySelection(terms.asset),listing.selection))throw Error("The seller's current source changed. Review a new qualified listing.");
   }
   if(phase==="send-phi"){if(input.ownerHandle!==terms.buyerHandle||checkpoint.reviewRequired)throw new QuoteChanged();await approvals(plan);}
   if(phase==="send-asset"||phase==="accept-asset"){
    await verifyPayment(plan);
    if(listing.reservation!.phase==="payment-pending")listing=await progress(plan,listing,"paid");
    if(phase==="send-asset"&&listing.reservation!.phase==="paid")listing=await progress(plan,listing,"asset-pending");
    if(!["asset-pending","asset-accepted","completed"].includes(listing.reservation!.phase))throw Error("Resolve the canonical payment and exact source delivery before accepting this purchase.");
   }
  }}
 });
 const phaseFor=(checkpoint:WildzMarketPurchaseCheckpointV128):WildzMarketPurchaseReviewV128["phase"]=>{
  if(checkpoint.reviewRequired)return "review-required";
  const listed=sourceSnapshot?.state.listings[checkpoint.agreement.market!.listingId];
  if(listed&&(listed.status==="cancelled"||listed.reservation?.reservationId!==checkpoint.agreement.market!.reservationId))return "review-required";
  const plan=createWildsWalletStagedTradePlan(checkpoint.agreement),saved=entry(plan);
  if(saved?.legs.every(leg=>leg.status==="accepted"||leg.status==="committed"))return saved.legs.some(leg=>leg.projectionPending===true)||checkpoint.assetRecoveryRequired||listed?.reservation?.phase!=="completed"?"received":"completed";
  if(saved?.legs[1]?.status==="accepted")return "received";
  if(saved?.legs[0]?.status==="committed")return saved.legs[1]?.status==="offered"?"awaiting-acceptance":"paid";
  if(saved?.legs[0]?.status==="pending")return "payment-pending";
  if(saved?.legs.some(leg=>leg.status==="failed"))return "failed";
  return saved?.approvals.length?"awaiting-approvals":"review";
 };
 const isExpiredNoWrite=(receipt:unknown)=>object(receipt)&&receipt.schema==="wildz.wallet.connect-zero-write-receipt.v1"&&typeof receipt.retryAfterKai==="number"&&receipt.retryAfterKai<=kai();
 const view=(checkpoint:WildzMarketPurchaseCheckpointV128):WildzMarketPurchaseReviewV128=>{
  const terms=checkpoint.agreement.market!,plan=createWildsWalletStagedTradePlan(checkpoint.agreement),saved=entry(plan),phase=phaseFor(checkpoint),own=saved?.approvals.some(approval=>approval.ownerHandle===input.ownerHandle);
  const listed=sourceSnapshot?.state.listings[terms.listingId];
  return {purchaseId:terms.purchaseId,listingId:terms.listingId,reservationId:terms.reservationId,title:listed?.selection.summary??"Marketplace asset",kind:terms.asset.kind,buyerHandle:terms.buyerHandle,sellerHandle:terms.sellerHandle,priceUsdCents:terms.quote.priceUsdCents,amountPhiMicro:terms.quote.amountPhiMicro,usdPerPhiMicrocents:terms.quote.usdPerPhiMicrocents,expiresAtKai:terms.quote.expiresAtKai,phase,agreement:checkpoint.agreement,
   canCancel:!!listed?.reservation&&listed.reservation.reservationId===terms.reservationId&&listed.status==="reserved"&&(["reserved","approved"].includes(listed.reservation.phase)||listed.reservation.phase==="payment-pending"&&isExpiredNoWrite(checkpoint.noWriteReceipt??saved?.legs[0]?.receipt)),canApprove:listed?.status==="reserved"&&listed.reservation?.phase==="reserved"&&!own&&["review","awaiting-approvals"].includes(phase)&&!checkpoint.reviewRequired&&terms.quote.expiresAtKai>kai(),canResume:!!own&&phase!=="review-required",canAccept:phase!=="review-required"&&input.ownerHandle===terms.buyerHandle&&saved?.legs[0]?.status==="committed"&&(saved.legs[1]?.status==="offered"||saved.legs[1]?.status==="pending"||saved.legs[1]?.projectionPending===true),message:checkpoint.message,...(checkpoint.assetRecoveryRequired?{assetRecoveryRequired:true}: {})};
 };
 const emit=(message=snapshot.message)=>{
  current();const record=load(),listings=Object.values(sourceSnapshot?.state.listings??{});
  snapshot={status:"ready",message,listings:listings.map(listing=>({listingId:listing.listingId,title:listing.selection.summary,kind:listing.selection.asset.kind,asset:listing.selection.asset,sellerHandle:listing.sellerHandle,priceUsdCents:String(listing.priceUsdCents),status:listing.status,canBuy:listing.status==="active"&&listing.sellerHandle!==input.ownerHandle,canCancel:listing.sellerHandle===input.ownerHandle&&listing.status==="active"||listing.status==="reserved"&&[listing.reservation?.buyerHandle,listing.reservation?.sellerHandle].includes(input.ownerHandle)&&["reserved","approved"].includes(listing.reservation!.phase)})),purchases:record.purchases.map(view),pendingListings:record.lists.filter(attempt=>!attempt.published).map(attempt=>({...attempt,title:attempt.selection?.summary??"Saved source listing",summary:attempt.selection?.summary??"Check this exact source and price."})),sellables:input.readSelections().map(selection=>{
 const locked=listings.some(listing=>["active","reserved"].includes(listing.status)&&same(listing.selection.asset,selection.asset))||record.lists.some(attempt=>!attempt.published&&same(attempt.asset,selection.asset));
   return {id:selection.id,title:selection.label,kind:selection.asset.kind,asset:selection.asset,summary:selection.detail??selection.label,...(locked?{disabledReason:"This source has an active listing or an exact listing continuation."}:{})};
  })};for(const listener of listeners)listener(snapshot);return snapshot;
 };
 const rememberResult=async(id:string,result:WildsWalletStagedTradeResult):Promise<WildzMarketResultV128>=>{
  let checkpoint=purchase(id);replacePurchase({...checkpoint,message:result.message,...(result.assetRecoveryRequired?{assetRecoveryRequired:true}: {})});
  const plan=createWildsWalletStagedTradePlan(checkpoint.agreement);let listing=await reservation(plan);
  const saved=entry(plan);
  if(saved?.legs[0]?.status==="failed"||result.status==="failed")try{await observedRejection(plan);}catch{/* An unknown or pre-submit failure cannot close a financial reservation. */}
  if(saved?.legs[0]?.status==="committed"){
   await verifyPayment(plan);
   if(listing.reservation!.phase==="payment-pending")listing=await progress(plan,listing,"paid");
  }
  if(saved?.legs[1]?.status==="accepted"){
   await verifyAsset(plan);
   if(listing.reservation!.phase==="asset-pending")listing=await progress(plan,listing,"asset-accepted");
   if(listing.reservation!.phase==="asset-accepted")listing=await closeSource(plan,listing,"completed");
   if(listing.reservation!.phase!=="completed"){emit("Both native receipts are verified. The other named participant must check this same purchase to close the source listing.");return {status:"pending",purchaseId:id,message:"Payment and delivery are verified. Waiting for the other named participant to consent to closing this source listing.",...(result.assetRecoveryRequired?{assetRecoveryRequired:true}:{})};}
  }
  checkpoint=purchase(id);if(result.assetRecoveryRequired!==true&&checkpoint.assetRecoveryRequired){const {assetRecoveryRequired:_removed,...repaired}=checkpoint;void _removed;replacePurchase(repaired);}
  emit(result.message);return {status:checkpoint.reviewRequired?"review-required":result.status,purchaseId:id,message:checkpoint.reviewRequired?new QuoteChanged().message:result.message,...(result.assetRecoveryRequired?{assetRecoveryRequired:true}:{})};
 };
   const makePurchaseRoom=async()=>{
  let record=load();if(record.purchases.length+record.pendingReservations.length<32){save(record);return;}
  if(archive)for(const checkpoint of record.purchases){
   if(checkpoint.assetRecoveryRequired||checkpoint.reviewRequired)continue;
   const plan=createWildsWalletStagedTradePlan(checkpoint.agreement);let saved=entry(plan);
   const raw=stagedStore.load(input.ownerHandle);if(raw===null||raw===undefined)continue;if(!object(raw)||!object(raw.binding))throw wildzMarketStorageErrorV128();
   const binding=raw.binding as unknown as import("../play/wallet/wilds-wallet-staged-trade-types").WildsWalletStagedTradeBinding;
   if(!saved&&stagedArchive){const retained=await stagedArchive.read(binding,plan.tradeId);current();if(retained){archivedEntries.clear();archivedEntries.set(plan.tradeId,retained);saved=retained;}}
   if(!saved||saved.approvals.length!==2||saved.legs.some(leg=>!["committed","accepted"].includes(leg.status)||leg.projectionPending))continue;
   const listing=await reservation(plan);if(listing.reservation?.phase!=="completed"||listing.status!=="sold")continue;
   await verifyPayment(plan);await verifyAsset(plan);current();
   if(!stagedArchive)throw Error("The completed native trade archive is unavailable; keep its active market continuation.");
   await stagedArchive.retain(binding,saved);if(!same(await stagedArchive.read(binding,plan.tradeId),saved))throw wildzMarketStorageErrorV128();
   const value={checkpoint,binding,entry:saved};await archive.retainPurchase(archiveOwner,value);current();
   if(!same(await archive.readPurchase(archiveOwner,checkpoint.agreement.market!.purchaseId),value))throw wildzMarketStorageErrorV128();
   record=load();save({...record,purchases:record.purchases.filter(item=>item.agreement.market!.purchaseId!==checkpoint.agreement.market!.purchaseId)});archivedEntries.clear();return;
  }
  throw Error("The market continuation queue is full. Resolve its original pending purchases before reserving another listing.");
 };
 const restorePurchase=async(id:string)=>{
  if(load().purchases.some(item=>item.agreement.market!.purchaseId===id))return;
  const value=await archive?.readPurchase(archiveOwner,id);current();if(!value)throw Error("This exact private market history is unavailable.");
  const plan=createWildsWalletStagedTradePlan(value.checkpoint.agreement);archivedEntries.clear();archivedEntries.set(plan.tradeId,value.entry);
  try{const identities=await Promise.all(value.entry.approvals.map(approval=>verifyApproval(approval,plan)));current();
   identities.forEach((identity,index)=>{const approval=value.entry.approvals[index]!;if(identity.ownerHandle!==approval.ownerHandle||identity.keyId!==approval.keyId||identity.identityArtifactDigest!==approval.identityArtifactDigest||approval.ownerHandle===input.ownerHandle&&approval.keyId!==input.keyId)throw Error("The archived approval belongs to another Explorer.");});const leg=plan.legs[0]!;if(leg.kind!=="phi")throw Error("The exact archived payment is required.");await phi.verifyPhiReceipt(leg,{status:"committed",receipt:value.entry.legs[0]!.receipt});
   const asset=plan.legs[1]!;if(asset.kind!=="asset")throw Error("The exact archived asset is required.");const descriptor=value.entry.approvals.find(approval=>approval.ownerHandle===asset.senderHandle)?.sourceHeads.find(head=>head.legId===asset.legId);if(!descriptor)throw Error("The exact archived descriptor is required.");
   await input.staged.assetPort.verifyAccepted(asset,descriptor,{status:"accepted",receipt:value.entry.legs[1]!.receipt},{plan,approvals:value.entry.approvals,acceptedNotBeforeKai:identities.reduce((max,identity)=>BigInt(identity.approvalKai)>max?BigInt(identity.approvalKai):max,0n).toString()});
   const active=load();if(active.purchases.length+active.pendingReservations.length>=32)return true;
   replacePurchase(value.checkpoint);
  }catch(cause){archivedEntries.delete(plan.tradeId);throw cause;}
 };
 const makeListRoom=async()=>{
  const record=load();if(record.lists.length<64)return;
  if(archive){const repo=await source();sourceSnapshot=await repo.load();current();
   const eligible=record.lists.filter(attempt=>attempt.published&&attempt.selection);
   const retainTerminal=async(attempt:(typeof record.lists)[number],actual:WildzMarketListingV128|undefined)=>{
    if(!actual||!["sold","cancelled"].includes(actual.status)||actual.sellerHandle!==input.ownerHandle||!same(actual.selection,attempt.selection))return false;
    await archive.retainList(archiveOwner,attempt);current();save({...load(),lists:record.lists.filter(item=>item.attemptId!==attempt.attemptId)});return true;
   };
   for(const attempt of eligible)if(await retainTerminal(attempt,sourceSnapshot.state.listings[attempt.listingId]))return;
   const cursor=record.listArchiveCursor??0,ordered=Array.from({length:record.lists.length},(_,index)=>record.lists[(cursor+index)%record.lists.length]!);
   const missing=ordered.filter(attempt=>attempt.published&&attempt.selection&&!sourceSnapshot!.state.listings[attempt.listingId]).slice(0,3);
   save({...record,listArchiveCursor:(cursor+3)%record.lists.length});
   // A historical terminal may have left the bounded display projection. Its
   // exact complete native source still decides eligibility; cap reads to 3.
   const observations=await Promise.allSettled(missing.map(async attempt=>(await repo.observe({listingId:attempt.listingId})).listing));current();
   const historical=observations.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
   for(const attempt of eligible){
    const actual=sourceSnapshot.state.listings[attempt.listingId]??historical.find(listing=>listing.listingId===attempt.listingId);
    if(await retainTerminal(attempt,actual))return;
   }
  }throw Error("The listing continuation queue is full. Keep and resolve its original uncertain publications.");
 };
 const locked=async<T>(action:()=>Promise<T>)=>{current();return store.withLock(ownerKey,async()=>{current();const result=await action();current();return result;});};
 const run=async(id:string,action:()=>Promise<WildsWalletStagedTradeResult>):Promise<WildzMarketResultV128>=>{
  try{return await locked(async()=>{if(await restorePurchase(id)===true)return {status:"completed",purchaseId:id,message:"The exact archived payment and native delivery were independently verified. No new operation was authorized."};return rememberResult(id,await action());});}catch(cause){
   try{const checkpoint=purchase(id);emit();if(checkpoint.reviewRequired)return {status:"review-required",purchaseId:id,message:new QuoteChanged().message};}catch{/* Changed identity/storage cannot update another account. */}
   return {status:"pending",purchaseId:id,message:cause instanceof Error?cause.message:"Check this same purchase; no replacement payment was issued."};
  }finally{archivedEntries.clear();}
 };
 return {
  binding:Object.freeze({keyId:input.keyId,ownerHandle:input.ownerHandle}),snapshot:()=>snapshot,
  subscribe(listener){current();listeners.add(listener);return()=>listeners.delete(listener);},
  async read(){return locked(async()=>{current();const repo=await source();sourceSnapshot=await repo.load();current();
   const recovered=load();
   for(const attempt of recovered.lists.filter(item=>!item.published)){
    const listed=sourceSnapshot.state.listings[attempt.listingId];
    if(listed&&listed.sellerHandle===input.ownerHandle&&String(listed.priceUsdCents)===attempt.priceUsdCents&&attempt.selection&&same(listed.selection,attempt.selection)){
     const record=load();save({...record,lists:record.lists.map(item=>item.attemptId===attempt.attemptId?{...item,published:true}:item)});
    }
   }
   // A saved reservation intent precedes CAS but grants no device approval.
   // Reconstruct its frozen review from exact admitted history, or retire only
   // a proved pre-payment release. Unavailable/unknown originals stay saved.
   const pending=load(),cursor=pending.reservationReadCursor??0,intents=Array.from({length:Math.min(3,pending.pendingReservations.length)},(_,offset)=>pending.pendingReservations[(cursor+offset)%pending.pendingReservations.length]!);
   if(pending.pendingReservations.length>3)save({...pending,reservationReadCursor:(cursor+3)%pending.pendingReservations.length});
   const observed=await Promise.allSettled(intents.map(async intent=>({intent,actual:await repo.observe({listingId:intent.listingId})})));current();
   for(const result of observed){if(result.status!=="fulfilled")continue;const {intent,actual}=result.value,listed=actual.listing;sourceSnapshot=actual.snapshot;
    if(listed.sellerHandle!==intent.sellerHandle||!same(listed.selection,intent.selection)||String(listed.priceUsdCents)!==intent.quote.priceUsdCents)continue;
    if(listed.reservation?.reservationId===intent.reservationId){
     if(listed.reservation.phase!=="reserved"||listed.reservation.buyerHandle!==input.ownerHandle||listed.reservation.listingHead!==intent.listingHead)continue;
     const agreement=createWildzMarketPurchaseAgreementV128({schema:"wildz.market.purchase-terms.v128",listingId:listed.listingId,listingHead:intent.listingHead,reservationId:intent.reservationId,reservationHead:listed.reservation.reservationHead,buyerHandle:input.ownerHandle,sellerHandle:intent.sellerHandle,sourceDigest:intent.selection.sourceDigest,asset:intent.selection.asset,quote:intent.quote});
     replacePurchase({agreement,...(intent.quote.expiresAtKai<=kai()?{reviewRequired:true}:{}),message:"The original named reservation was independently recovered. Review its frozen quote before approving anything."});
    }else{
     if(listed.status==="active"&&!listed.reservation&&listed.listingHead===intent.listingHead)continue;
     // Exact source replay can change this reservation identity only through
     // its lawful pre-payment release, before the sticky payment-pending phase.
     const record=load();save({...record,pendingReservations:record.pendingReservations.filter(saved=>saved.reservationId!==intent.reservationId)});
    }
   }
   // Incoming approvals identify reviews only. Read never signs, pays, sends,
   // accepts, or calls adapter.advance for a purchase not explicitly approved.
   for(const conversation of await input.staged.readConversations())for(const message of conversation.messages){
    if(message.deletedAt||message.editedAt||message.recipientHandle!==input.ownerHandle)continue;
    try{const context=admitWildsWalletStagedTradeMessage(message.context,message.senderHandle,message.recipientHandle);if(context.kind!=="trade-staged-approval"||context.plan.agreement.purpose!=="market")continue;
     const terms=termsFor(context.plan);if(context.approval.ownerHandle!==message.senderHandle)continue;await verifyApproval(context.approval,context.plan);current();
     if(!load().purchases.some(item=>item.agreement.market!.purchaseId===terms.purchaseId)){
      const actual=await repo.verifyReservation({listingId:terms.listingId,reservationId:terms.reservationId,buyerHandle:terms.buyerHandle,sellerHandle:terms.sellerHandle,priceUsdCents:Number(terms.quote.priceUsdCents),listingHead:terms.listingHead});
      if(actual.listing.selection.sourceDigest!==terms.sourceDigest||!same(actual.listing.selection.asset,terms.asset)||actual.listing.reservation?.phase!=="reserved"||actual.listing.reservation.reservationHead!==terms.reservationHead)continue;
      await makePurchaseRoom();replacePurchase({agreement:context.plan.agreement,message:"Review the named buyer, actual USD quote, exact Phi and native asset before approving this purchase."});
     }
    }catch{/* Unverified transport cannot create purchase authority. */}
   }return emit("Current source listings checked. Purchases settle as separate payment and recipient acceptance stages.");
  });},
  async list(request){let dispatched=false;
   try{return await locked(async()=>{
    if(!request.attemptId||request.attemptId.length>256||!/^[1-9][0-9]{0,15}$/.test(request.priceUsdCents)||BigInt(request.priceUsdCents)>1_000_000_000n)throw Error("Enter a positive whole USD-cent price and retain this exact listing attempt.");
    let record=load(),attempt=record.lists.find(item=>item.attemptId===request.attemptId);
    if(attempt&&(!same(attempt.asset,request.asset)||attempt.priceUsdCents!==request.priceUsdCents))throw Error("This listing attempt already has different source or price terms.");
    if(!attempt){await makeListRoom();record=load();attempt={...request,listingId:`market:listing:${digest({ownerHandle:input.ownerHandle,keyId:input.keyId,request})}`};save({...record,lists:[...record.lists,attempt]});}
    if(!attempt.selection){const selection=await input.qualifySelection(request.asset);current();validateWildzMarketSelectionV128(selection);if(!same(selection.asset,request.asset))throw Error("The qualified source differs from this selected asset.");attempt={...attempt,selection};record=load();save({...record,lists:record.lists.map(item=>item.attemptId===request.attemptId?attempt!:item)});}
    const repo=await source();dispatched=true;
    const actual=await repo.list({attemptId:attempt.attemptId,listingId:attempt.listingId,selection:attempt.selection!,priceUsdCents:Number(attempt.priceUsdCents)});current();sourceSnapshot=actual.snapshot;
    record=load();save({...record,lists:record.lists.map(item=>item.attemptId===request.attemptId?{...item,published:true}:item)});emit("The SDK source listing is confirmed.");
    return {status:actual.listing.status==="cancelled"?"cancelled":"listed",listingId:actual.listing.listingId,message:"The exact source listing is confirmed."};
   });}catch(cause){try{emit();}catch{}return dispatched?{status:"pending",message:"Check the same listing attempt. Its source publication response is uncertain."}:failure(cause);}
  },
  async cancel(listingId){let dispatched=false;try{return await locked(async()=>{
   const repo=await source();let actual=await repo.observe({listingId});current();let listing=actual.listing;
   if(listing.status==="reserved"){
    const reservation=listing.reservation!;
    if(reservation.phase==="payment-pending"){
     const checkpoint=load().purchases.find(saved=>saved.agreement.market!.reservationId===reservation.reservationId);
     if(!checkpoint)throw Error("Keep this original reservation until its exact private payment proofs are restored.");
     const plan=createWildsWalletStagedTradePlan(checkpoint.agreement);await verifyZeroWrite(plan);dispatched=true;
     const closed=await closeSource(plan,listing,"zero-write");emit("The known rejection was checked. Both named participants must voluntarily close this original reservation.");
     return {status:closed.status==="cancelled"?"cancelled":"pending",listingId,purchaseId:checkpoint.agreement.market!.purchaseId,message:closed.status==="cancelled"?"Both participants closed the rejected purchase. No replacement payment was authorized.":"Your closing consent is saved. The other named participant must check the same rejected purchase and consent to closure."};
    }
    if(![reservation.buyerHandle,reservation.sellerHandle].includes(input.ownerHandle)||!["reserved","approved"].includes(reservation.phase))throw Error("Resolve the original payment. A pending or paid source reservation cannot be released.");
    dispatched=true;actual=await repo.transition({schema:"wildz.market-source-command.v128",kind:"release",actorHandle:input.ownerHandle,attemptId:`${reservation.reservationId}:cancel-release`,listingId,reservationId:reservation.reservationId,expectedReservationHead:reservation.reservationHead});current();listing=actual.listing;sourceSnapshot=actual.snapshot;
    const record=load();save({...record,pendingReservations:record.pendingReservations.filter(attempt=>attempt.reservationId!==reservation.reservationId),purchases:record.purchases.map(checkpoint=>checkpoint.agreement.market!.reservationId===reservation.reservationId?{...checkpoint,reviewRequired:true,message:"This pre-payment reservation was released. Review a new named purchase before any payment."}:checkpoint)});
    if(reservation.buyerHandle===input.ownerHandle){emit("The pre-payment purchase reservation is released.");return {status:"cancelled",listingId,message:"The pre-payment purchase is cancelled; the seller's listing is available again."};}
   }
   if(listing.sellerHandle!==input.ownerHandle||!["active","cancelled"].includes(listing.status))throw Error("Only this listing's seller may withdraw the source advertisement.");
   // Withdrawal grants no asset custody. The authenticated source seller and
   // exact active listing head can withdraw even if the advertised asset grew
   // or became unavailable; reserved/payment-locked purchases cannot cancel.
   if(listing.status!=="cancelled"){dispatched=true;const cancelled=await repo.cancel({attemptId:`${listingId}:cancel`,listingId,expectedListingHead:listing.listingHead});sourceSnapshot=cancelled.snapshot;}else sourceSnapshot=actual.snapshot;
   current();emit("The source cancellation is confirmed.");return {status:"cancelled",listingId,message:"The exact source listing is cancelled."};
  });}catch(cause){return dispatched?{status:"pending",listingId,message:"Check the same listing cancellation; its original source response is uncertain."}:failure(cause);}},
  async previewPurchase(listingId){return locked(async()=>{
   const repo=await source();let actual=await repo.observe({listingId});current();let listing=actual.listing;
   if(listing.sellerHandle===input.ownerHandle)throw Error("Choose another Explorer's current listing.");
   const old=load().purchases.find(item=>item.agreement.market!.listingId===listingId&&item.agreement.market!.reservationId===listing.reservation?.reservationId);
   if(old&&!old.reviewRequired&&old.agreement.market!.quote.expiresAtKai>kai()){sourceSnapshot=actual.snapshot;emit();return view(old);}
   if(listing.reservation){
    if(listing.reservation.buyerHandle!==input.ownerHandle||!["reserved","approved"].includes(listing.reservation.phase))throw Error("Resolve the original purchase. An uncertain payment cannot be replaced by a new quote.");
    if(listing.reservation.phase==="approved"){
     const released=await repo.transition({schema:"wildz.market-source-command.v128",kind:"release",actorHandle:input.ownerHandle,attemptId:`${listing.reservation.reservationId}:review-release`,listingId,reservationId:listing.reservation.reservationId,expectedReservationHead:listing.reservation.reservationHead});listing=released.listing;actual=released;
    }
   }
   let pending=load().pendingReservations.find(attempt=>attempt.listingId===listingId);
   if(pending&&(pending.sellerHandle!==listing.sellerHandle||!same(pending.selection,listing.selection)||String(listing.priceUsdCents)!==pending.quote.priceUsdCents||listing.status==="active"&&pending.listingHead!==listing.listingHead||listing.reservation&&pending.reservationId!==listing.reservation.reservationId))throw Error("Resolve the exact saved reservation attempt before reviewing a changed listing.");
   if(!pending){
    await makePurchaseRoom();const actualQuote=await quote(String(listing.priceUsdCents));
    const reservationId=listing.reservation?.reservationId??`market:reservation:${digest({listingId,listingHead:listing.listingHead,buyerHandle:input.ownerHandle})}`;
    pending={listingId,listingHead:listing.reservation?.listingHead??listing.listingHead,reservationId,sellerHandle:listing.sellerHandle,selection:listing.selection,quote:actualQuote};
    const record=load();save({...record,pendingReservations:[...record.pendingReservations,pending]});
   }
   const actualQuote=pending.quote;
   if(listing.status==="active"){
    actual=await repo.reserve({attemptId:pending.reservationId,listingId,expectedListingHead:pending.listingHead,reservationId:pending.reservationId});listing=actual.listing;
   }
   if(listing.reservation?.buyerHandle!==input.ownerHandle||listing.reservation.phase!=="reserved")throw Error("The exact named buyer reservation could not be admitted.");
   const agreement=createWildzMarketPurchaseAgreementV128({schema:"wildz.market.purchase-terms.v128",listingId,listingHead:listing.reservation.listingHead,reservationId:listing.reservation.reservationId,reservationHead:listing.reservation.reservationHead,buyerHandle:input.ownerHandle,sellerHandle:listing.sellerHandle,sourceDigest:listing.selection.sourceDigest,asset:listing.selection.asset,quote:actualQuote});
   const checkpoint=replacePurchase({agreement,...(actualQuote.expiresAtKai<=kai()?{reviewRequired:true}:{}),message:"Review this exact USD price and frozen Phi. Payment occurs first; the seller delivers this native source and you explicitly accept it afterward."});sourceSnapshot=actual.snapshot;emit();return view(checkpoint);
  });},
  approvePurchase:id=>run(id,()=>adapter.approve(purchase(id).agreement)),
  resume:id=>run(id,async()=>{
   const checkpoint=purchase(id),plan=createWildsWalletStagedTradePlan(checkpoint.agreement),leg=plan.legs[0]!;
   // A prepared native attempt has never crossed /execute. An explicit Check
   // can finish that same preparation. Submitted attempts stay read-only.
   if(leg.kind==="phi"&&leg.senderHandle===input.ownerHandle&&entry(plan)?.approvals.length===2&&phi.submissionPhase(leg)==="prepared")await phi.sendPhi(leg);
   return adapter.resume(checkpoint.agreement);
  }),
  accept:id=>run(id,async()=>{const checkpoint=purchase(id),plan=createWildsWalletStagedTradePlan(checkpoint.agreement);if(plan.legs[1]?.kind!=="asset"||plan.legs[1].recipientHandle!==input.ownerHandle)throw Error("Only the exact buyer may accept this purchase.");return adapter.acceptIncomingAsset(plan.legs[1].legId);}),
  async receive(context,senderHandle){
   current();let checkpoint:WildzMarketPurchaseCheckpointV128|undefined;
   if(object(context)&&object(context.plan)&&object(context.plan.agreement)&&context.plan.agreement.purpose==="market"){
    try{const message=admitWildsWalletStagedTradeMessage(context,senderHandle,input.ownerHandle);if(message.kind!=="trade-staged-approval")throw Error("The exact purchase approval is required.");checkpoint=load().purchases.find(item=>item.agreement.market!.purchaseId===termsFor(message.plan).purchaseId);}catch{return {status:"failed",message:"This message does not carry a valid exact marketplace approval."};}
   }else if(object(context)&&typeof context.tradeId==="string")checkpoint=load().purchases.find(item=>createWildsWalletStagedTradePlan(item.agreement).tradeId===context.tradeId);
   if(!checkpoint)return {status:"awaiting-peer",message:"Open the marketplace to independently review this exact purchase request."};
   const plan=createWildsWalletStagedTradePlan(checkpoint.agreement);
   if(!entry(plan)?.approvals.some(approval=>approval.ownerHandle===input.ownerHandle&&approval.keyId===input.keyId))return {status:"awaiting-peer",purchaseId:checkpoint.agreement.market!.purchaseId,message:"Review and explicitly approve the exact marketplace purchase before it can advance."};
   return run(checkpoint.agreement.market!.purchaseId,()=>adapter.receive(context,senderHandle));
  }
 };
}
