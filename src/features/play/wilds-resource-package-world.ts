import { canonicalPortableCardJson } from "./portable-card";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { verifyWildsResourcePackage, type WildsResourcePackageV1, type WildsResourcePackageMember } from "./wilds-resource-package";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { ReceizBearerTransferPlanV1 } from "@receiz/sdk";

export type WildsResourcePackageRecord = {
  package: WildsResourcePackageV1;
  ownerReceizId: string;
  revision: number;
  updatedKaiUPulse: number;
  sourceRevision: number;
  custodyOwners: readonly string[];
  status: "packed" | "issuing" | "offered" | "cancelling" | "listed" | "reserved" | "settling" | "unpacked";
  subjectId?: string;
  subjectHead?: string;
  receiptId?: string;
  transferId?: string;
  offer?: Readonly<{transferId:string;artifactDigest:string;targetHandle:string|null}>;
  sealedOffer?: string;
  listingId?: string;
  tradeId?: string;
  buyerReceizId?: string;
  reservationExpiresKaiUPulse?: number;
  transferProtocol?:"plan-before-issue-v1";
  transferTargetHandle?:string|null;
  transferPlan?:ReceizBearerTransferPlanV1;
};

export type WildsFoodCustody = Readonly<{ ownerReceizId: string; packageId: string; receiptId: string }>;
export type WildsFoodConsumptionReceipt = Readonly<{ownerReceizId:string;commandId:string;kaiUPulse:number;sourceReceiptId:string}>;
export type WildsResourcePackageCommand =
  | { type: "resource.package.create"; package: WildsResourcePackageV1; commandId: string }
  | { type: "resource.package.native-adopt"; packageId: string; fromOwnerReceizId: string; toOwnerReceizId: string; worldPackageHead: string; artifactId: string; nativeHead: string; receiptId: string; operationId: string; commandId: string }
  | { type: "resource.package.begin-transfer"; packageId: string; targetHandle?:string|null; commandId: string }
  | { type: "resource.package.plan-transfer"; packageId: string; plan:ReceizBearerTransferPlanV1; targetHandle:string|null; commandId: string }
  | { type: "resource.package.abort-transfer"; packageId:string; transferId:string|null; commandId:string }
  | { type: "resource.package.offer"; packageId: string; offer: Readonly<{transferId:string;artifactDigest:string;targetHandle:string|null}>; subjectId: string; sealedOffer: string; commandId: string }
  | { type: "resource.package.transfer.admit"; packageId: string; subjectId: string; subjectHead: string; receiptId: string; transferId: string; commandId: string }
  | { type: "resource.package.cancel.begin"; packageId: string; transferId: string; commandId: string }
  | { type: "resource.package.cancel-transfer"; packageId: string; transferId: string; commandId: string }
  | { type: "resource.package.unpack"; packageId: string; commandId: string }
  | { type: "resource.package.market.list"; packageId: string; listingId: string; commandId: string }
  | { type: "resource.package.market.reserve"; packageId: string; listingId: string; tradeId: string; buyerReceizId: string; expiresAtKaiUPulse: number; commandId: string }
  | { type: "resource.package.market.unreserve"; packageId: string; listingId: string; tradeId: string; commandId: string }
  | { type: "resource.package.market.pay"; packageId: string; listingId: string; tradeId: string; commandId: string }
  | { type: "resource.package.market.release"; packageId: string; listingId: string; commandId: string }
  | { type: "resource.food.consume"; itemId: string; commandId: string };

function sameOwner(a: string,b: string) { return a === b || sameWildzPlayerCoordinate(a,b); }
function exactMember(a: WildsResourcePackageMember | undefined,b: WildsResourcePackageMember) { return Boolean(a && canonicalPortableCardJson(a) === canonicalPortableCardJson(b)); }

/** The durable gameplay edge reserves exact sources; native receipts alone establish later title. */
export function applyWildsResourcePackageCommand(world: WildsWorldProjection,command: WildsResourcePackageCommand,actorId: string,currentKaiUPulse=0): Partial<WildsWorldProjection> {
  const resourcePackages = {...world.resourcePackages};
  if (command.type === "resource.food.consume") {
    const member = world.foodItems?.[command.itemId], custody = world.foodCustody?.[command.itemId];
    if (!member || !custody || !sameOwner(custody.ownerReceizId,actorId) || world.reservedFoodItems?.[command.itemId]) throw Error("wilds_resource_food_unavailable");
    if (world.consumedFoodItems?.[command.itemId]) throw Error("wilds_resource_food_consumed");
    return {consumedFoodItems:{...world.consumedFoodItems,[command.itemId]:command.commandId},foodConsumptionReceipts:{...world.foodConsumptionReceipts,[command.itemId]:{ownerReceizId:actorId,commandId:command.commandId,kaiUPulse:currentKaiUPulse,sourceReceiptId:custody.receiptId}}};
  }
  if (command.type === "resource.package.create") {
    const proof = command.package;
    if (!verifyWildsResourcePackage(proof) || !sameOwner(proof.ownerReceizId,actorId)) throw Error("wilds_resource_package_owner_invalid");
    if (resourcePackages[proof.packageId]) throw Error("wilds_resource_package_exists");
    const reservedMaterialLots={...world.reservedMaterialLots},reservedResourceLots={...world.reservedResourceLots},reservedFoodItems={...world.reservedFoodItems};
    const foodItems={...world.foodItems},foodCustody={...world.foodCustody};
    for (const member of proof.members) {
      if (member.kind === "material") {
        const lot=world.materialLots[member.id],owner=world.materialCustody[member.id]?.ownerReceizId ?? lot?.ownerReceizId;
        if (!lot || !owner || !sameOwner(owner,actorId) || canonicalPortableCardJson(lot)!==canonicalPortableCardJson(member.materialLot)
          || world.consumedMaterialLots[member.id] || reservedMaterialLots[member.id] || world.storedMaterialLots[member.id]) throw Error("wilds_resource_package_member_unavailable");
        reservedMaterialLots[member.id]=proof.packageId;
      } else if (member.kind === "resource") {
        const lot=world.resourceLots[member.id],owner=world.resourceCustody[member.id]?.ownerReceizId ?? lot?.ownerReceizId;
        if (!lot || !owner || !sameOwner(owner,actorId) || canonicalPortableCardJson(lot)!==canonicalPortableCardJson(member.resourceLot) || reservedResourceLots[member.id]) throw Error("wilds_resource_package_member_unavailable");
        reservedResourceLots[member.id]=proof.packageId;
      } else {
        const known=foodItems[member.id],owner=foodCustody[member.id]?.ownerReceizId ?? member.foodItem.ownerReceizId;
        if (!sameOwner(owner,actorId) || (known && !exactMember(known,member)) || reservedFoodItems[member.id] || world.consumedFoodItems?.[member.id]) throw Error("wilds_resource_package_member_unavailable");
        foodItems[member.id]=member;
        foodCustody[member.id] ??= {ownerReceizId:actorId,packageId:proof.packageId,receiptId:"source-admission"};
        reservedFoodItems[member.id]=proof.packageId;
      }
    }
    resourcePackages[proof.packageId]={package:proof,ownerReceizId:actorId,revision:0,sourceRevision:world.revision+1,custodyOwners:[actorId],updatedKaiUPulse:currentKaiUPulse||proof.createdKaiUPulse,status:"packed"};
    return {resourcePackages,reservedMaterialLots,reservedResourceLots,reservedFoodItems,foodItems,foodCustody};
  }
  const current=resourcePackages[command.packageId];
  if (!current) throw Error("wilds_resource_package_missing");
  const record={...current,revision:(current.revision??0)+1,sourceRevision:world.revision+1,updatedKaiUPulse:Math.max(current.updatedKaiUPulse??0,currentKaiUPulse)};
  resourcePackages[command.packageId]=record;
  if (command.type === "resource.package.native-adopt") {
    // The native source boundary admits the complete receipt before this pure
    // projection. Legacy offered/claim state is never manufactured here.
    if (!sameOwner(command.toOwnerReceizId, actorId) || record.package.head !== command.worldPackageHead
      || !/^[a-f0-9]{64}$/.test(command.artifactId) || !/^[a-f0-9]{64}$/.test(command.nativeHead)
      || !/^[a-f0-9]{64}$/.test(command.receiptId) || !command.operationId) throw Error("wilds_resource_native_receipt_invalid");
    if (record.receiptId === command.receiptId && record.transferId === command.operationId && sameOwner(record.ownerReceizId, actorId)) return {};
    if (record.status !== "packed" || !sameOwner(record.ownerReceizId, command.fromOwnerReceizId)) throw Error("wilds_resource_native_source_stale");
    record.custodyOwners = [...new Set([...record.custodyOwners, record.ownerReceizId, actorId])];
    record.ownerReceizId = actorId; record.subjectId = command.artifactId; record.subjectHead = command.nativeHead;
    record.receiptId = command.receiptId; record.transferId = command.operationId;
    const materialCustody = { ...world.materialCustody }, resourceCustody = { ...world.resourceCustody }, foodCustody = { ...world.foodCustody };
    for (const member of record.package.members) {
      const custody = { ownerReceizId: actorId, subjectId: command.artifactId, subjectHead: command.nativeHead, receiptId: command.receiptId, transferId: command.operationId };
      if (member.kind === "material") materialCustody[member.id] = custody;
      else if (member.kind === "resource") resourceCustody[member.id] = custody;
      else foodCustody[member.id] = { ownerReceizId: actorId, packageId: command.packageId, receiptId: command.receiptId };
    }
    return { resourcePackages, materialCustody, resourceCustody, foodCustody };
  }
  if (command.type === "resource.package.transfer.admit") {
    if (record.status === "unpacked" || !/^[a-f0-9]{64}$/.test(command.subjectHead) || !command.subjectId || !command.receiptId || !command.transferId) throw Error("wilds_resource_package_transfer_invalid");
    if (record.transferId===command.transferId) {
      if (!sameOwner(record.ownerReceizId,actorId)) throw Error("wilds_resource_package_transfer_replay");
      return {};
    }
    if(!["offered","cancelling","settling"].includes(record.status) || record.offer?.transferId!==command.transferId)throw Error("wilds_resource_package_transfer_invalid");
    if (record.status === "settling" && !sameOwner(record.buyerReceizId ?? "",actorId)) throw Error("wilds_resource_package_market_buyer_invalid");
    record.custodyOwners=[...new Set([...record.custodyOwners,record.ownerReceizId,actorId])];
    record.ownerReceizId=actorId;record.status="packed";record.subjectId=command.subjectId;record.subjectHead=command.subjectHead;record.receiptId=command.receiptId;record.transferId=command.transferId;
    delete record.offer;delete record.sealedOffer;delete record.listingId;delete record.tradeId;delete record.buyerReceizId;delete record.transferPlan;delete record.transferTargetHandle;delete record.transferProtocol;
    const materialCustody={...world.materialCustody},resourceCustody={...world.resourceCustody},foodCustody={...world.foodCustody};
    for (const member of record.package.members) {
      const custody={ownerReceizId:actorId,subjectId:command.subjectId,subjectHead:command.subjectHead,receiptId:command.receiptId,transferId:command.transferId};
      if (member.kind === "material") materialCustody[member.id]=custody;
      else if (member.kind === "resource") resourceCustody[member.id]=custody;
      else foodCustody[member.id]={ownerReceizId:actorId,packageId:command.packageId,receiptId:command.receiptId};
    }
    return {resourcePackages,materialCustody,resourceCustody,foodCustody};
  }
  if (command.type === "resource.package.market.reserve") {
    if(record.status==="reserved" && currentKaiUPulse>=(record.reservationExpiresKaiUPulse??Number.MAX_SAFE_INTEGER)){record.status="listed";delete record.tradeId;delete record.buyerReceizId;}
    if(record.status!=="listed" || record.listingId!==command.listingId || sameOwner(record.ownerReceizId,actorId) || !sameOwner(command.buyerReceizId,actorId) || !command.tradeId) throw Error("wilds_resource_package_market_unavailable");
    if(!Number.isSafeInteger(command.expiresAtKaiUPulse) || command.expiresAtKaiUPulse<=currentKaiUPulse)throw Error("wilds_resource_package_market_expired");
    record.status="reserved";record.tradeId=command.tradeId;record.buyerReceizId=actorId;record.reservationExpiresKaiUPulse=command.expiresAtKaiUPulse;
    return {resourcePackages};
  }
  if (command.type === "resource.package.market.unreserve") {
    if(record.listingId===command.listingId && (record.status==="listed" || ["reserved","settling"].includes(record.status) && record.tradeId!==command.tradeId))return {};
    if(record.status!=="reserved" || record.listingId!==command.listingId || record.tradeId!==command.tradeId || !sameOwner(record.buyerReceizId ?? "",actorId)) throw Error("wilds_resource_package_market_unavailable");
    record.status="listed";delete record.tradeId;delete record.buyerReceizId;return {resourcePackages};
  }
  if (command.type === "resource.package.market.pay") {
    if(record.status==="settling" && record.listingId===command.listingId && record.tradeId===command.tradeId && sameOwner(record.buyerReceizId??"",actorId))return {};
    if(record.status!=="reserved" || record.listingId!==command.listingId || sameOwner(record.ownerReceizId,actorId) || !command.tradeId)throw Error("wilds_resource_package_market_unavailable");
    // The private server boundary has verified the registry's irrevocable
    // paying trade. A different same-listing reservation can only be an orphan
    // whose registry CAS lost; keep every member locked while reconciling it.
    record.tradeId=command.tradeId;record.buyerReceizId=actorId;record.status="settling";return {resourcePackages};
  }
  if (!sameOwner(record.ownerReceizId,actorId)) throw Error("wilds_resource_package_owner_invalid");
  if (command.type === "resource.package.begin-transfer") {
    if(record.status!=="packed") throw Error("wilds_resource_package_unavailable");record.status="issuing";
    record.transferProtocol="plan-before-issue-v1";record.transferTargetHandle=command.targetHandle??null;
  } else if(command.type==="resource.package.plan-transfer"){
    if(record.status!=="issuing" || record.transferProtocol!=="plan-before-issue-v1" || record.transferPlan || command.targetHandle!==record.transferTargetHandle
      || command.plan.schema!=="receiz.bearer.transfer_plan.v1" || command.plan.transferId!==command.plan.transferDigest || !command.plan.subjectId)throw Error("wilds_resource_package_plan_invalid");
    record.transferPlan=command.plan;record.subjectId=command.plan.subjectId;
  } else if(command.type==="resource.package.abort-transfer"){
    if(record.status!=="issuing" || record.transferProtocol!=="plan-before-issue-v1" || (record.transferPlan?.transferId??null)!==command.transferId)throw Error("wilds_resource_package_cancel_invalid");
    record.status="packed";delete record.transferPlan;delete record.transferTargetHandle;delete record.transferProtocol;
  } else if (command.type === "resource.package.offer") {
    if(record.status!=="issuing") throw Error("wilds_resource_package_unavailable");record.status="offered";
    const offer=command.offer;
    if (!offer.transferId || !offer.artifactDigest || record.transferPlan?.transferId!==offer.transferId) throw Error("wilds_resource_package_offer_invalid");
    if(typeof command.sealedOffer!=="string" || !command.sealedOffer.startsWith("v1."))throw Error("wilds_resource_package_offer_invalid");
    record.offer=offer;record.subjectId=command.subjectId;record.sealedOffer=command.sealedOffer;
  } else if (command.type === "resource.package.cancel.begin") {
    if(!["offered","cancelling"].includes(record.status) || !record.offer || record.offer.transferId!==command.transferId) throw Error("wilds_resource_package_cancel_invalid");
    if(record.status==="cancelling")return {};
    record.status="cancelling";
  } else if (command.type === "resource.package.cancel-transfer") {
    if(record.status!=="cancelling" || !record.offer || record.offer.transferId!==command.transferId) throw Error("wilds_resource_package_cancel_invalid");
    record.status="packed";delete record.offer;delete record.sealedOffer;delete record.transferPlan;delete record.transferTargetHandle;delete record.transferProtocol;
  } else if (command.type === "resource.package.market.list") {
    if(record.status!=="offered" || !command.listingId) throw Error("wilds_resource_package_market_unavailable");record.status="listed";record.listingId=command.listingId;
  } else if (command.type === "resource.package.market.release") {
    if(record.status!=="listed" && !(record.status==="reserved" && currentKaiUPulse>=(record.reservationExpiresKaiUPulse??Number.MAX_SAFE_INTEGER)) || record.listingId!==command.listingId) throw Error("wilds_resource_package_market_unavailable");
    record.status="packed";delete record.listingId;delete record.offer;delete record.sealedOffer;delete record.transferPlan;delete record.transferTargetHandle;delete record.transferProtocol;
  } else if (command.type === "resource.package.unpack") {
    if(record.status!=="packed") throw Error("wilds_resource_package_unavailable");
    record.status="unpacked";
    const reservedMaterialLots={...world.reservedMaterialLots},reservedResourceLots={...world.reservedResourceLots},reservedFoodItems={...world.reservedFoodItems};
    for(const member of record.package.members) {
      const rows=member.kind==="material"?reservedMaterialLots:member.kind==="resource"?reservedResourceLots:reservedFoodItems;
      if(rows[member.id]!==command.packageId) throw Error("wilds_resource_package_reservation_invalid");delete rows[member.id];
    }
    return {resourcePackages,reservedMaterialLots,reservedResourceLots,reservedFoodItems};
  }
  return {resourcePackages};
}
