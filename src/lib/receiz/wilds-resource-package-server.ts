import { requireWildsResourceCustodyRail, assertWildsFoodGatherAdmission, resolveWildsResourceRecipientIdentity } from "./wilds-resource-custody-capability";
import { sealResourcePackageMarketOffer, openResourcePackageMarketOffer } from "./resource-package-market-seal";
import type { NextRequest } from "next/server";
import { receizKaiNow } from "@receiz/sdk";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse } from "@/features/play/kai-klok-moment";
import { createKaiTemporalRoot } from "@/features/play/kai-temporal-root";
import { createWildsResourcePackage, verifyWildsResourcePackageMember, type WildsResourcePackageMember } from "@/features/play/wilds-resource-package";
import { restoreWildsNourishmentState } from "@/features/play/wilds-nourishment";
import { createWildsResourcePackagePortableClaim, encodeWildsPortableClaim, wildsPortableClaimUrl } from "@/features/play/wilds-portable-claim";
import type { WildsResourcePackageCommand } from "@/features/play/wilds-resource-package-world";
import { createReceizCommerceAdapter } from "./adapter";
import { resolveWildsMultiplayerActor, type WildsMultiplayerActor } from "./wilds-multiplayer-server";
import { executeWildsWorldCommand, wildsResourceCustodySnapshot } from "./wilds-world-server";
import { sameWildzPlayerCoordinate,parseWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { issueWildsResourcePackageTransfer, recoverWildsResourcePackageTransfer, cancelWildsResourcePackageTransferPlan, claimWildsResourcePackageTransfer, cancelWildsResourcePackageTransfer, validateWildsResourcePackageTransferOffer, type WildsResourcePackageTransferOffer } from "./wilds-resource-package";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";
import type { ResourcePackageMarketCustody } from "./resource-package-market";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
import {executeOfferedResourcePackageCancellation} from "./wilds-resource-package-cancellation";
import {assertWildsResourcePackageCancelledListing} from "./wilds-resource-package-market-authority";

async function principal(request:NextRequest) {
  const actor=await resolveWildsMultiplayerActor(request);
  if(actor.practice || !actor.accessToken)throw Error("wilds_resource_package_authority_required");
  const authority:WildsWalletReadAuthority={accessToken:actor.accessToken,ownerReceizId:actor.receizActorId,actorId:actor.playerId,profileHandle:actor.handle};
  const rail=createReceizCommerceAdapter({accessToken:actor.accessToken});
  requireWildsResourceCustodyRail(rail);
  return {actor,authority,rail};
}
export async function assertWildsResourcePackageCustodyAvailable(request:NextRequest) {await principal(request);}

function actorMatches(actor:WildsMultiplayerActor,other:{actorId:string;profileHandle:string;receizUserId:string}) {
  if(actor.receizActorId!==other.receizUserId || !sameWildzPlayerCoordinate(actor.handle,other.profileHandle))throw Error("wilds_resource_package_owner_invalid");
}
function commandKai() {return createKaiTemporalRoot(deriveKaiKlokMomentFromUPulse({uPulse:receizKaiNow().uPulse,authority:"world"}));}

export async function executeWildsResourcePackageCommand(request:NextRequest,command:WildsResourcePackageCommand,context:Readonly<{marketCoordinator?:true}>={}) {
  const world=await executeWildsWorldCommand(request,{command:{...command,kai:commandKai()}},context.marketCoordinator?{resourcePackageMarketCoordinator:true}:{});
  if(!world.publication.published || world.publication.mode!=="receiz_live")throw Error("wilds_resource_package_publication_pending");
  return world;
}

function ids(value:unknown) {
  if(value===undefined)return [];
  if(!Array.isArray(value) || value.length>64 || value.some(id=>typeof id!=="string" || !id || id.length>800) || new Set(value).size!==value.length)throw Error("wilds_resource_package_ids_invalid");
  return value as string[];
}

export async function createWildsResourcePackageFromInventory(request:NextRequest,input:Record<string,unknown>) {
  const {actor,rail}=await principal(request),snapshot=await wildsResourceCustodySnapshot(request,actor),world=snapshot.projection;
  const materialIds=ids(input.materialLotIds),resourceIds=ids(input.resourceLotIds),foodIds=ids(input.foodItemIds);
  const restored=restoreWildsNourishmentState(input.nourishment,actor.handle) ?? restoreWildsNourishmentState(input.nourishment,actor.playerId);
  const members:WildsResourcePackageMember[]=[];
  for(const id of materialIds){const materialLot=world.materialLots[id];if(!materialLot)throw Error("wilds_resource_package_member_missing");members.push({kind:"material",id,materialLot});}
  for(const id of resourceIds){const resourceLot=world.resourceLots[id];if(!resourceLot)throw Error("wilds_resource_package_member_missing");members.push({kind:"resource",id,resourceLot});}
  for(const id of foodIds){
    const known=world.foodItems?.[id];
    if(known){members.push(known);continue;}
    const foodItem=restored?.items[id];
    if(!restored || !foodItem || foodItem.consumedKaiUPulse!==undefined)throw Error("wilds_resource_package_food_source_required");
    // Preserve only this finite gather's source evidence. Source hashing does
    // not claim native authenticity; authenticated admission occurs after locks.
    const nourishment={schema:restored.schema,ownerReceizId:restored.ownerReceizId,lastKaiUPulse:restored.lastKaiUPulse,items:{[id]:foodItem},sources:restored.sources[foodItem.sourceId]?{[foodItem.sourceId]:restored.sources[foodItem.sourceId]!}:{},animalFoodSources:restored.animalFoodSources[foodItem.sourceId]?{[foodItem.sourceId]:restored.animalFoodSources[foodItem.sourceId]!}:{}};
    const member={kind:"food" as const,id,foodItem,nourishment};
    if(!verifyWildsResourcePackageMember(member))throw Error("wilds_resource_package_food_source_invalid");
    await assertWildsFoodGatherAdmission(rail,member,actor.receizActorId,receizKaiNow().uPulse);
    members.push(member);
  }
  const commandId=typeof input.commandId==="string"?input.commandId:"";
  let packageProof=createWildsResourcePackage({ownerReceizId:actor.handle,createdKaiUPulse:Math.max(receizKaiNow().uPulse,restored?.lastKaiUPulse??0),commandId,members});
  const prior=world.resourcePackages?.[packageProof.packageId];
  if(prior){
    if(!sameWildzPlayerCoordinate(prior.ownerReceizId,actor.handle) || canonicalPortableCardJson(prior.package.members)!==canonicalPortableCardJson(packageProof.members))throw Error("wilds_resource_package_command_conflict");
    // Retry the exact admitted source command, including its original Kai time.
    packageProof=prior.package;
  }
  const result=await executeWildsResourcePackageCommand(request,{type:"resource.package.create",package:packageProof,commandId});
  return {package:packageProof,world:result};
}

export async function prepareWildsResourcePackageTransfer(request:NextRequest,input:{packageId:string;targetHandle?:string|null}) {
  const {actor,authority,rail}=await principal(request),snapshot=await wildsResourceCustodySnapshot(request,actor),record=snapshot.projection.resourcePackages?.[input.packageId];
  if(!record || !sameWildzPlayerCoordinate(record.ownerReceizId,actor.handle))throw Error("wilds_resource_package_owner_invalid");
  const targetText=input.targetHandle?.trim()??"";
  const parsedTarget=targetText?parseWildzPlayerCoordinate(targetText):null;
  if(targetText && !parsedTarget)throw Error("wilds_resource_package_recipient_invalid");
  const target=parsedTarget?.profileHandle??null;
  if(record.status==="offered" && record.sealedOffer){
    const offer=validateWildsResourcePackageTransferOffer(openResourcePackageMarketOffer(record.sealedOffer,input.packageId));
    if(offer.targetHandle!==target)throw Error("wilds_resource_package_recipient_conflict");
    const claim=createWildsResourcePackagePortableClaim(offer);
    const world=await executeWildsResourcePackageCommand(request,{type:"resource.package.offer",packageId:input.packageId,subjectId:offer.subjectId,offer:record.offer!,sealedOffer:record.sealedOffer,commandId:`package:offer:${offer.instrument.plan.transferId}`});
    return {offer,claimId:claim.claimId,claimProof:encodeWildsPortableClaim(claim),claimUrl:wildsPortableClaimUrl(new URL(request.url).origin,claim),world};
  }
  // Verify escrow configuration before touching native custody.
  sealResourcePackageMarketOffer({},input.packageId);
  if(record.status!=="packed" && record.status!=="issuing")throw Error("wilds_resource_package_unavailable");
  if(record.status==="issuing" && (record.transferProtocol!=="plan-before-issue-v1" || record.transferTargetHandle!==target))throw Error("wilds_resource_package_issuance_pending");
  const recipientReceizId=record.transferPlan?.policy.recipientReceizId??(target?await resolveWildsResourceRecipientIdentity(rail,target):null);
  if(record.status==="packed"){
    const attempt=`package:send:${input.packageId.slice(-64)}:${target?.replace(/[^a-z0-9_]/gi,"").slice(0,30)||"open"}:${record.revision}`;
    await executeWildsResourcePackageCommand(request,{type:"resource.package.begin-transfer",packageId:input.packageId,targetHandle:target,commandId:attempt});
  }
  const offer=record.transferPlan
    ? await recoverWildsResourcePackageTransfer({authority,package:record.package,targetHandle:target,plan:record.transferPlan,rail})
    : await issueWildsResourcePackageTransfer({authority,package:record.package,targetHandle:target,recipientReceizId,rail,beforeIssue:async(plan)=>{
      await executeWildsResourcePackageCommand(request,{type:"resource.package.plan-transfer",packageId:input.packageId,plan,targetHandle:target,commandId:`package:plan:${plan.transferId}`});
    }});
  const world=await executeWildsResourcePackageCommand(request,{type:"resource.package.offer",packageId:input.packageId,subjectId:offer.subjectId,
    offer:{transferId:offer.instrument.plan.transferId,artifactDigest:offer.instrument.artifactDigest,targetHandle:offer.targetHandle},sealedOffer:sealResourcePackageMarketOffer(offer,input.packageId),commandId:`package:offer:${offer.instrument.plan.transferId}`});
  const claim=createWildsResourcePackagePortableClaim(offer);
  return {offer,claimId:claim.claimId,claimProof:encodeWildsPortableClaim(claim),claimUrl:wildsPortableClaimUrl(new URL(request.url).origin,claim),world};
}

export async function admitWildsResourcePackageClaim(request:NextRequest,offerInput:WildsResourcePackageTransferOffer,market?:{listingId:string;tradeId:string}) {
  const {actor,authority,rail}=await principal(request),offer=validateWildsResourcePackageTransferOffer(offerInput),snapshot=await wildsResourceCustodySnapshot(request,actor),record=snapshot.projection.resourcePackages?.[offer.package.packageId];
  if(!record || record.package.head!==offer.package.head)throw Error("wilds_resource_package_unavailable");
  if(record.status==="unpacked" || record.status==="packed" && record.transferId===offer.instrument.plan.transferId){
    if(record.transferId!==offer.instrument.plan.transferId || !sameWildzPlayerCoordinate(record.ownerReceizId,actor.handle))throw Error("wilds_resource_package_unavailable");
    const admission=await claimWildsResourcePackageTransfer({authority,offer,rail});
    if(!admission.idempotent || admission.receipt.receiptId!==record.receiptId)throw Error("wilds_resource_package_replay_invalid");
    return {admission,world:snapshot};
  }
  if(!record.offer || record.offer.transferId!==offer.instrument.plan.transferId || record.offer.artifactDigest!==offer.instrument.artifactDigest || record.offer.targetHandle!==offer.targetHandle)throw Error("wilds_resource_package_offer_binding_invalid");
  if(["listed","reserved","settling"].includes(record.status) && (!market || record.status!=="settling" || record.listingId!==market.listingId || record.tradeId!==market.tradeId))throw Error("wilds_resource_package_market_payment_required");
  const admission=await claimWildsResourcePackageTransfer({authority,offer,rail});
  const world=await executeWildsResourcePackageCommand(request,{type:"resource.package.transfer.admit",packageId:offer.package.packageId,subjectId:admission.subjectId,
    subjectHead:admission.receipt.nextSubjectHead,receiptId:admission.receipt.receiptId,transferId:admission.receipt.transferId,commandId:`package:claim:${admission.receipt.transferId}`});
  return {admission,world};
}

export async function unpackWildsResourcePackage(request:NextRequest,packageId:string) {
  const {actor}=await principal(request),record=(await wildsResourceCustodySnapshot(request,actor)).projection.resourcePackages?.[packageId];
  if(!record || !sameWildzPlayerCoordinate(record.ownerReceizId,actor.handle))throw Error("wilds_resource_package_owner_invalid");
  const world=await executeWildsResourcePackageCommand(request,{type:"resource.package.unpack",packageId,commandId:`package:unpack:${packageId.slice(-64)}:${record.transferId??"source"}`});
  return {package:record.package,members:record.package.members,receiptId:record.receiptId??"source-admission",ownerReceizId:actor.handle,world};
}

export async function cancelWildsResourcePackageOffer(request:NextRequest,offerInput:WildsResourcePackageTransferOffer) {
  const {actor,authority,rail}=await principal(request),offer=validateWildsResourcePackageTransferOffer(offerInput);
  return executeOfferedResourcePackageCancellation({ownerHandle:actor.handle,offer,
    readVerifiedSource:async()=>(await wildsResourceCustodySnapshot(request,actor)).projection,
    reserveCancellation:()=>executeWildsResourcePackageCommand(request,{type:"resource.package.cancel.begin",packageId:offer.package.packageId,transferId:offer.instrument.plan.transferId,commandId:`package:cancel-begin:${offer.instrument.plan.transferId}`}),
    cancelNative:()=>cancelWildsResourcePackageTransfer({authority,offer,rail}),
    commitCancellation:()=>executeWildsResourcePackageCommand(request,{type:"resource.package.cancel-transfer",packageId:offer.package.packageId,transferId:offer.instrument.plan.transferId,commandId:`package:cancel:${offer.instrument.plan.transferId}`})});
}

export async function cancelWildsPendingResourcePackageTransfer(request:NextRequest,packageId:string) {
  const {actor,authority,rail}=await principal(request),record=(await wildsResourceCustodySnapshot(request,actor)).projection.resourcePackages?.[packageId];
  if(record && sameWildzPlayerCoordinate(record.ownerReceizId,actor.handle) && ["offered","cancelling"].includes(record.status) && record.sealedOffer){
    return cancelWildsResourcePackageOffer(request,validateWildsResourcePackageTransferOffer(openResourcePackageMarketOffer(record.sealedOffer,packageId)));
  }
  if(!record || !sameWildzPlayerCoordinate(record.ownerReceizId,actor.handle) || record.status!=="issuing" || record.transferProtocol!=="plan-before-issue-v1")throw Error("wilds_resource_package_cancellation_pending");
  if(record.transferPlan)await cancelWildsResourcePackageTransferPlan({authority,plan:record.transferPlan,rail});
  return executeWildsResourcePackageCommand(request,{type:"resource.package.abort-transfer",packageId,transferId:record.transferPlan?.transferId??null,commandId:`package:abort:${packageId.slice(-64)}:${record.transferPlan?.transferId.slice(-24)??record.revision}`});
}

export function createResourcePackageMarketCustody(request:NextRequest):ResourcePackageMarketCustody {
  return {
    assertAvailable:()=>assertWildsResourcePackageCustodyAvailable(request),
    async list({packageId,listingId,actor:cookieActor}) {
      const {actor}=await principal(request);actorMatches(actor,cookieActor);
      const current=(await wildsResourceCustodySnapshot(request,actor)).projection.resourcePackages?.[packageId];
      if(current?.status==="listed" && current.listingId===listingId && current.sealedOffer){const offer=validateWildsResourcePackageTransferOffer(openResourcePackageMarketOffer(current.sealedOffer,packageId));return {package:current.package,subjectId:offer.subjectId,offer};}
      const prepared=await prepareWildsResourcePackageTransfer(request,{packageId,targetHandle:null});
      await executeWildsResourcePackageCommand(request,{type:"resource.package.market.list",packageId,listingId,commandId:`package:list:${listingId.slice(-64)}`},{marketCoordinator:true});
      return {package:prepared.offer.package,subjectId:prepared.offer.subjectId,offer:prepared.offer};
    },
    async reserve({listing,trade,actor:cookieActor}) {
      const {actor}=await principal(request);actorMatches(actor,cookieActor);
      await executeWildsResourcePackageCommand(request,{type:"resource.package.market.reserve",packageId:listing.packageId,listingId:listing.id,tradeId:trade.id,buyerReceizId:actor.handle,expiresAtKaiUPulse:deriveKaiKlokMoment({occurredAt:trade.expiresAt,authority:"world"}).uPulse,commandId:`package:reserve:${trade.id.slice(-64)}`},{marketCoordinator:true});
    },
    async startPayment({listing,trade,actor:cookieActor,offer:offerInput}) {
      const {actor,rail}=await principal(request);actorMatches(actor,cookieActor);
      const offer=validateWildsResourcePackageTransferOffer(offerInput),inspection=await rail.inspectBearerTransferInstrument(offer.instrument),status=await rail.bearerTransferStatus(offer.instrument.plan.transferId);
      if(!inspection.valid || !inspection.offlineVerified || status.status!=="pending-acceptance" || offer.package.head!==listing.packageHead || offer.subjectId!==listing.subjectId
        || Number(offer.instrument.plan.policy.expiresAtKai)<=receizKaiNow().pulse)throw Error("wilds_resource_package_market_instrument_invalid");
      await executeWildsResourcePackageCommand(request,{type:"resource.package.market.pay",packageId:listing.packageId,listingId:listing.id,tradeId:trade.id,commandId:`package:pay:${trade.id.slice(-64)}`},{marketCoordinator:true});
    },
    async claim({listing,trade,actor:cookieActor,offer:offerInput}) {
      const {actor}=await principal(request);actorMatches(actor,cookieActor);
      if(trade.status!=="paid" || !trade.payment)throw Error("wilds_resource_package_market_payment_required");
      const record=(await wildsResourceCustodySnapshot(request,actor)).projection.resourcePackages?.[listing.packageId];
      if(!record || !(record.status==="settling" && record.listingId===listing.id && record.tradeId===trade.id && sameWildzPlayerCoordinate(record.buyerReceizId??"",actor.handle) || ["packed","unpacked"].includes(record.status) && record.ownerReceizId===actor.handle && record.transferId===(offerInput as WildsResourcePackageTransferOffer).instrument?.plan?.transferId))throw Error("wilds_resource_package_market_buyer_invalid");
      const {admission}=await admitWildsResourcePackageClaim(request,validateWildsResourcePackageTransferOffer(offerInput),{listingId:listing.id,tradeId:trade.id});return admission.receipt;
    },
    async release({listing,trade,actor:cookieActor,offer:offerInput}) {
      const {actor,authority,rail}=await principal(request);actorMatches(actor,cookieActor);
      if(trade){
        const current=(await wildsResourceCustodySnapshot(request,actor)).projection.resourcePackages?.[listing.packageId];
        // A released tombstone may outlive this listing or the seller's title.
        // Cleanup never touches a later trade; its exact reservation is gone.
        if(!current || current.listingId!==listing.id || current.tradeId!==trade.id && current.status!=="listed")return;
        await executeWildsResourcePackageCommand(request,{type:"resource.package.market.unreserve",packageId:listing.packageId,listingId:listing.id,tradeId:trade.id,commandId:`package:unreserve:${trade.id.slice(-64)}`},{marketCoordinator:true});return;
      }
      const offer=validateWildsResourcePackageTransferOffer(offerInput);
      const record=(await wildsResourceCustodySnapshot(request,actor)).projection.resourcePackages?.[listing.packageId];
      if(record?.status==="packed" && !record.offer)return;
      if(!record || record.offer?.transferId!==offer.instrument.plan.transferId || record.offer.artifactDigest!==offer.instrument.artifactDigest
        || record.offer.targetHandle!==offer.targetHandle || record.status==="reserved" && receizKaiNow().uPulse<(record.reservationExpiresKaiUPulse??Number.MAX_SAFE_INTEGER))throw Error("wilds_resource_package_market_cancellation_unavailable");
      const {createResourcePackageMarketRepository}=await import("./resource-package-market-repository");
      const market=await createResourcePackageMarketRepository(rail).load();
      if(market.status!=="ready")throw Error("wilds_resource_package_market_cancellation_unavailable");
      assertWildsResourcePackageCancelledListing(market.state,{record,packageId:listing.packageId,listingId:listing.id,subjectId:offer.subjectId,sellerReceizId:actor.receizActorId,sellerHandle:actor.handle});
      await cancelWildsResourcePackageTransfer({authority,offer,rail});
      await executeWildsResourcePackageCommand(request,{type:"resource.package.market.release",packageId:listing.packageId,listingId:listing.id,commandId:`package:unlist:${listing.id.slice(-64)}`},{marketCoordinator:true});
    }
  };
}
