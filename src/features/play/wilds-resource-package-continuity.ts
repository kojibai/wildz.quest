import { verifyWildsResourcePackage, verifyWildsResourcePackageMember } from "./wilds-resource-package";
import { verifyWildsResourceLot } from "./wilds-resource-lot";
import type { WildsResourcePackageRecord } from "./wilds-resource-package-world";
import type { WildsWorldProjection } from "./wilds-world-state";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";

export type WildsResourcePackagePersistence=Partial<Pick<WildsWorldProjection,"resourcePackages"|"reservedResourceLots"|"reservedFoodItems"|"foodItems"|"foodCustody"|"consumedFoodItems"|"foodConsumptionReceipts"|"resourceLots"|"resourceCustody">>;
const statuses=new Set(["packed","issuing","offered","cancelling","listed","reserved","settling","unpacked"]);
function sameOwner(a:string,b:string){return a===b || sameWildzPlayerCoordinate(a,b);}
function validRecord(value:WildsResourcePackageRecord|undefined):value is WildsResourcePackageRecord {
  return Boolean(value && verifyWildsResourcePackage(value.package) && typeof value.ownerReceizId==="string" && value.ownerReceizId
    && statuses.has(value.status) && Number.isSafeInteger(value.revision) && value.revision>=0 && Number.isSafeInteger(value.updatedKaiUPulse) && value.updatedKaiUPulse>=0
    && Number.isSafeInteger(value.sourceRevision) && value.sourceRevision>=1 && Array.isArray(value.custodyOwners) && value.custodyOwners.length>0
    && value.custodyOwners.every(owner=>typeof owner==="string" && Boolean(owner)));
}
function orderedRecords(records:Record<string,WildsResourcePackageRecord>) {
  return Object.values(records).sort((a,b)=>a.sourceRevision-b.sourceRevision || a.updatedKaiUPulse-b.updatedKaiUPulse || a.revision-b.revision || a.package.packageId.localeCompare(b.package.packageId));
}

/** Saved source continuity is presentation evidence; routes still verify native title before use. */
export function projectWildsResourcePackagePersistence(source:WildsResourcePackagePersistence,ownerReceizId?:string):WildsResourcePackagePersistence {
  const packages=Object.fromEntries(Object.entries(source.resourcePackages??{}).filter(([id,record])=>validRecord(record) && id===record.package.packageId
    && (!ownerReceizId || sameOwner(record.ownerReceizId,ownerReceizId) || sameOwner(record.package.ownerReceizId,ownerReceizId) || record.custodyOwners.some(owner=>sameOwner(owner,ownerReceizId)))));
  const foodIds=new Set(Object.values(packages).flatMap(record=>record.package.members.filter(member=>member.kind==="food").map(member=>member.id)));
  const resourceIds=new Set(Object.values(packages).flatMap(record=>record.package.members.filter(member=>member.kind==="resource").map(member=>member.id)));
  const present=Object.keys(packages).length || source.resourcePackages!==undefined || source.foodItems!==undefined;
  if(!present)return {};
  const foodItems=Object.fromEntries(Object.entries(source.foodItems??{}).filter(([id,member])=>foodIds.has(id) && verifyWildsResourcePackageMember(member) && member.kind==="food" && member.id===id));
  const foodCustody=Object.fromEntries(Object.entries(source.foodCustody??{}).filter(([id,row])=>foodIds.has(id) && row && typeof row.ownerReceizId==="string" && typeof row.packageId==="string" && typeof row.receiptId==="string"));
  const lifecycle=(rows:Record<string,string>|undefined,ids:Set<string>)=>Object.fromEntries(Object.entries(rows??{}).filter(([id,row])=>ids.has(id) && typeof row==="string" && Boolean(row)));
  const foodConsumptionReceipts=Object.fromEntries(Object.entries(source.foodConsumptionReceipts??{}).filter(([id,row])=>foodIds.has(id) && row && typeof row.ownerReceizId==="string" && row.commandId===source.consumedFoodItems?.[id] && Number.isSafeInteger(row.kaiUPulse) && row.kaiUPulse>=0 && typeof row.sourceReceiptId==="string"));
  return {resourcePackages:packages,foodItems,foodCustody,foodConsumptionReceipts,consumedFoodItems:lifecycle(source.consumedFoodItems,foodIds),reservedFoodItems:lifecycle(source.reservedFoodItems,foodIds),
    resourceLots:Object.fromEntries(Object.entries(source.resourceLots??{}).filter(([id,lot])=>resourceIds.has(id) && verifyWildsResourceLot(lot) && lot.lotId===id)),
    resourceCustody:Object.fromEntries(Object.entries(source.resourceCustody??{}).filter(([id,row])=>resourceIds.has(id) && row && typeof row.ownerReceizId==="string")),reservedResourceLots:lifecycle(source.reservedResourceLots,resourceIds)};
}

export function mergeWildsResourcePackagePersistence(left:WildsResourcePackagePersistence,right:WildsResourcePackagePersistence):WildsResourcePackagePersistence {
  if(!left.resourcePackages && !right.resourcePackages && !left.foodItems && !right.foodItems)return {};
  const resourcePackages={...projectWildsResourcePackagePersistence(left).resourcePackages};
  for(const [id,row] of Object.entries(projectWildsResourcePackagePersistence(right).resourcePackages??{})) {
    const prior=resourcePackages[id];
    if(!prior || row.revision>prior.revision || row.revision===prior.revision && row.updatedKaiUPulse>prior.updatedKaiUPulse)resourcePackages[id]=row;
  }
  const reservedFoodItems={...left.reservedFoodItems,...right.reservedFoodItems},reservedResourceLots={...left.reservedResourceLots,...right.reservedResourceLots};
  for(const record of orderedRecords(resourcePackages))for(const member of record.package.members){
    if(member.kind==="material")continue;
    const rows=member.kind==="food"?reservedFoodItems:reservedResourceLots;
    if(record.status==="unpacked"){if(rows[member.id]===record.package.packageId)delete rows[member.id];}
    else rows[member.id]=record.package.packageId;
  }
  return {resourcePackages,foodItems:{...left.foodItems,...right.foodItems},foodCustody:{...right.foodCustody,...left.foodCustody},
    consumedFoodItems:{...left.consumedFoodItems,...right.consumedFoodItems},foodConsumptionReceipts:{...left.foodConsumptionReceipts,...right.foodConsumptionReceipts},reservedFoodItems,reservedResourceLots,resourceLots:{...left.resourceLots,...right.resourceLots},resourceCustody:{...right.resourceCustody,...left.resourceCustody}};
}

/** Carry source successors through a weaker snapshot without resurrecting unpacked locks. */
export function preserveWildsResourcePackageHistory(current:WildsWorldProjection,candidate:WildsWorldProjection):WildsWorldProjection {
  const merged=mergeWildsResourcePackagePersistence(candidate,current);
  if(!merged.resourcePackages)return candidate;
  const reservedMaterialLots={...current.reservedMaterialLots,...candidate.reservedMaterialLots},materialCustody={...current.materialCustody,...candidate.materialCustody},
    foodCustody={...merged.foodCustody},resourceCustody={...merged.resourceCustody},materialLots={...current.materialLots,...candidate.materialLots};
  const records=orderedRecords(merged.resourcePackages);
  for(const record of records)for(const member of record.package.members){
    if(member.kind==="material") {
      materialLots[member.id] ??= member.materialLot;
      if(record.status==="unpacked"){if(reservedMaterialLots[member.id]===record.package.packageId)delete reservedMaterialLots[member.id];}
      else reservedMaterialLots[member.id]=record.package.packageId;
    }
    if(record.receiptId && record.subjectId && record.subjectHead && record.transferId){
      const custody={ownerReceizId:record.ownerReceizId,subjectId:record.subjectId,subjectHead:record.subjectHead,receiptId:record.receiptId,transferId:record.transferId};
      if(member.kind==="material")materialCustody[member.id]=custody;
      else if(member.kind==="resource")resourceCustody[member.id]=custody;
      else foodCustody[member.id]={ownerReceizId:record.ownerReceizId,packageId:record.package.packageId,receiptId:record.receiptId};
    }
  }
  return {...candidate,...merged,reservedMaterialLots,materialCustody,resourceCustody,foodCustody,materialLots};
}
