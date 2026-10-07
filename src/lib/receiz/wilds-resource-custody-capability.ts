import { findWildsWorldRecord, type WildsWorldRecord } from "@/features/play/wilds-world-record";
import type { WildsResourcePackageMember } from "@/features/play/wilds-resource-package";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import {resolveResourcePackageMarketConditionalRail} from "./resource-package-market-capability";

export const WILDS_RESOURCE_CUSTODY_UNAVAILABLE="receiz_conditional_resource_custody_unavailable";
export const WILDS_RESOURCE_CUSTODY_NAMESPACE="wilds:global:v3";
export const WILDS_FOOD_SOURCE_UNAVAILABLE="receiz_admitted_food_source_unavailable";
export type WildsWorldConditionalAppendRail=Readonly<{
  readLatest(input:{namespace:string}):Promise<unknown>;
  compareAndAppend(input:{namespace:string;expectedHead:{revision:number;lastEventId:string|null};record:WildsWorldRecord;idempotencyKey:string}):Promise<unknown>;
  verifyAdmissionProof(input:{record:WildsWorldRecord;proof:unknown}):Promise<boolean>;
}>;
function record(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
function sourcePort(value:unknown) {
  if(!record(value))return null;
  return record(value.wildzWorld)?value.wildzWorld:record(value.client)&&record(value.client.wildzWorld)?value.client.wildzWorld:null;
}

/** Only an actual conditional source rail qualifies. A public feed write is not CAS. */
export function resolveWildsWorldConditionalAppendRail(value:unknown):WildsWorldConditionalAppendRail|null {
  const candidate=sourcePort(value);
  if(!candidate || typeof candidate.readLatest!=="function" || typeof candidate.compareAndAppend!=="function" || typeof candidate.verifyAdmissionProof!=="function")return null;
  return {readLatest:candidate.readLatest.bind(candidate) as WildsWorldConditionalAppendRail["readLatest"],compareAndAppend:candidate.compareAndAppend.bind(candidate) as WildsWorldConditionalAppendRail["compareAndAppend"],verifyAdmissionProof:candidate.verifyAdmissionProof.bind(candidate) as WildsWorldConditionalAppendRail["verifyAdmissionProof"]};
}

export function wildsResourceCustodyCapability(adapter:unknown) {
  const available=Boolean(resolveWildsWorldConditionalAppendRail(adapter));
  const foodAvailable=available && typeof sourcePort(adapter)?.verifyFoodGatherAdmission==="function";
  const marketAvailable=available && Boolean(resolveResourcePackageMarketConditionalRail(adapter));
  return {sourceLock:available?"available" as const:"unavailable" as const,foodSource:foodAvailable?"available" as const:"unavailable" as const,resourceTransfer:available?"available" as const:"unavailable" as const,
    resourceMarket:marketAvailable?"available" as const:"unavailable" as const,reasonCode:available?null:WILDS_RESOURCE_CUSTODY_UNAVAILABLE};
}

/** A finite local checkpoint cannot authenticate a shared plant slot or hunt.
 * This backend method must resolve and verify the actual admitted gather history. */
export async function assertWildsFoodGatherAdmission(adapter:unknown,member:Extract<WildsResourcePackageMember,{kind:"food"}>,actorReceizId:string,kaiUPulse:number) {
  requireWildsResourceCustodyRail(adapter);
  if(member.nourishment.lastKaiUPulse>kaiUPulse || member.foodItem.gatheredKaiUPulse>kaiUPulse)throw Error("wilds_resource_food_future_source_invalid");
  const port=sourcePort(adapter);
  if(!port || typeof port.verifyFoodGatherAdmission!=="function")throw Error(WILDS_FOOD_SOURCE_UNAVAILABLE);
  const verified=await port.verifyFoodGatherAdmission.call(port,{member,actorReceizId});
  if(verified!==true)throw Error("wilds_resource_food_source_unadmitted");
}

/** Named recipients need an authenticated account binding, never a guessed ID. */
export async function resolveWildsResourceRecipientIdentity(adapter:unknown,profileHandle:string):Promise<string> {
  requireWildsResourceCustodyRail(adapter);
  const port=sourcePort(adapter);
  if(!port || typeof port.resolveRecipientIdentity!=="function")throw Error("receiz_resource_recipient_binding_unavailable");
  const result=await port.resolveRecipientIdentity.call(port,{profileHandle});
  if(!record(result) || result.verified!==true || typeof result.receizActorId!=="string" || !result.receizActorId
    || typeof result.profileHandle!=="string" || !sameWildzPlayerCoordinate(result.profileHandle,profileHandle))throw Error("wilds_resource_package_recipient_binding_invalid");
  return result.receizActorId;
}

export function requireWildsResourceCustodyRail(adapter:unknown) {
  const rail=resolveWildsWorldConditionalAppendRail(adapter);
  if(!rail)throw Error(WILDS_RESOURCE_CUSTODY_UNAVAILABLE);
  return rail;
}

export async function verifiedWildsConditionalWorldRecord(rail:WildsWorldConditionalAppendRail,value:unknown) {
  if(!record(value))throw Error("wilds_resource_custody_response_invalid");
  const world=findWildsWorldRecord(value.record??value);
  if(!world || !await rail.verifyAdmissionProof({record:world,proof:value.admissionProof}))throw Error("wilds_resource_custody_proof_invalid");
  return world;
}
