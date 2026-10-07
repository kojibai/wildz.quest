import { createHash } from "node:crypto";
import { receizKaiNow, receizBase64UrlDecode,digestReceizCompositeCanonical, deriveReceizSubjectIdV122, snapshotReceizArtifactInput, validateReceizSubjectAdmissionResultV122, type ReceizBearerInstrumentV1, type ReceizBearerTransferReceiptV1,type ReceizBearerTransferPlanV1 } from "@receiz/sdk";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
import { verifyWildsResourcePackage, type WildsResourcePackageV1 } from "@/features/play/wilds-resource-package";
import type { ReceizCommerceAdapter } from "./adapter";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";

export type WildsResourcePackageBearerRail = Pick<ReceizCommerceAdapter,"admitSubjectV122"|"subjectStateV122"|"previewBearerTransfer"|"issueBearerTransferInstrument"|"inspectBearerTransferInstrument"|"claimBearerTransferInstrument"|"cancelBearerTransfer"|"bearerTransferStatus"|"subjectBrainSearch"|"subjectBrainResolve">;
export type WildsResourcePackageTransferOffer = Readonly<{
  schema: "receiz.wilds.resource-package-transfer-offer.v1";
  package: WildsResourcePackageV1;
  subjectId: string;
  sourceHandle: string;
  targetHandle: string | null;
  instrument: ReceizBearerInstrumentV1;
}>;
export type WildsResourcePackageTransferAdmission = Readonly<{
  schema: "receiz.wilds.resource-package-transfer-admission.v1";
  package: WildsResourcePackageV1;
  subjectId: string;
  sourceHandle: string;
  targetHandle: string | null;
  receipt: ReceizBearerTransferReceiptV1;
  idempotent: boolean;
}>;

function exactPackage(value: unknown) { if(!verifyWildsResourcePackage(value))throw Error("wilds_resource_package_invalid");return value; }
function exactHandle(value: string) { const p=parseWildzPlayerCoordinate(value);if(!p)throw Error("wilds_resource_package_recipient_invalid");return p.profileHandle; }
function capability(authority:WildsWalletReadAuthority,proofDigest?:string) {
  return {receizId:authority.ownerReceizId,capabilityDigest:proofDigest ?? createHash("sha256").update("receiz.wilds.resource-package-capability.v1\0").update(authority.ownerReceizId).update("\0").update(authority.actorId).update("\0").update(authority.profileHandle).digest("hex")};
}

export async function projectWildsResourcePackageSubjectAdmissionV122(packageInput: WildsResourcePackageV1,ownerReceizId:string) {
  const packageProof=exactPackage(packageInput);
  const proofObject=new Blob([new TextEncoder().encode(canonicalPortableCardJson(packageProof))],{type:"application/json"});
  const snapshot=await snapshotReceizArtifactInput(proofObject),subjectId=await deriveReceizSubjectIdV122(snapshot.artifactDigest.value);
  return {subjectId,admittedProofDigest:snapshot.artifactDigest.value,input:{proofObject,ownerReceizId,idempotencyKey:`wildz:package-subject:v128:${subjectId}`,expectedAbsent:true as const}};
}

export function validateWildsResourcePackageTransferOffer(value:unknown):WildsResourcePackageTransferOffer {
  try {
    const offer=value as WildsResourcePackageTransferOffer,proof=exactPackage(offer.package),instrument=offer.instrument,plan=instrument.plan;
    const sourceHandle=exactHandle(offer.sourceHandle),targetHandle=offer.targetHandle===null?null:exactHandle(offer.targetHandle);
    if(offer.schema!=="receiz.wilds.resource-package-transfer-offer.v1" || !offer.subjectId
      || instrument.schema!=="receiz.bearer.instrument.v1" || plan.schema!=="receiz.bearer.transfer_plan.v1"
      || plan.subjectId!==offer.subjectId || plan.transferId!==plan.transferDigest || !/^[a-f0-9]{64}$/.test(plan.subjectDigest)
      || !plan.policy.requiresRecipientAcceptance || instrument.status!=="pending-acceptance"
      || (targetHandle===null ? !plan.policy.openBearer || plan.policy.recipientReceizId!==null
        : plan.policy.openBearer || typeof plan.policy.recipientReceizId!=="string" || !plan.policy.recipientReceizId))throw Error("invalid");
    return {...offer,package:proof,sourceHandle,targetHandle};
  }catch{throw Error("wilds_resource_package_offer_invalid");}
}

export async function issueWildsResourcePackageTransfer(input:{authority:WildsWalletReadAuthority;package:WildsResourcePackageV1;targetHandle?:string|null;recipientReceizId?:string|null;rail:WildsResourcePackageBearerRail;currentKai?:number;beforeIssue?:(plan:ReceizBearerTransferPlanV1)=>Promise<void>}) {
  const packageProof=exactPackage(input.package),targetHandle=input.targetHandle?.trim()?exactHandle(input.targetHandle):null;
  if(targetHandle && !input.recipientReceizId || !targetHandle && input.recipientReceizId)throw Error("receiz_resource_recipient_binding_unavailable");
  const projected=await projectWildsResourcePackageSubjectAdmissionV122(packageProof,input.authority.ownerReceizId);
  let state;
  try {state=await input.rail.subjectStateV122(projected.subjectId);} catch(cause) {
    const status=cause&&typeof cause==="object"&&"status" in cause?Number((cause as {status:unknown}).status):null;
    const message=cause instanceof Error?cause.message:"";
    if(status!==404 && !/(?:^|\b)(?:404|not_found|subject_not_found)(?:\b|$)/i.test(message))throw cause;
    if(!sameWildzPlayerCoordinate(packageProof.ownerReceizId,input.authority.profileHandle) && !sameWildzPlayerCoordinate(packageProof.ownerReceizId,input.authority.actorId))throw Error("wilds_resource_package_owner_invalid");
    const admitted=await validateReceizSubjectAdmissionResultV122(await input.rail.admitSubjectV122(projected.input));
    if(!admitted.ok || admitted.subjectId!==projected.subjectId || admitted.proofDigest!==projected.admittedProofDigest)throw Error("wilds_resource_package_subject_admission_invalid");
    state=await input.rail.subjectStateV122(projected.subjectId);
  }
  if(state.subjectId!==projected.subjectId || state.admittedProofDigest!==projected.admittedProofDigest || state.ownerReceizId!==input.authority.ownerReceizId)throw Error("wilds_resource_package_subject_invalid");
  const currentKai=input.currentKai??receizKaiNow().pulse;
  const plan=await input.rail.previewBearerTransfer({subjectId:state.subjectId,policy:{recipientReceizId:input.recipientReceizId??null,openBearer:targetHandle===null,expiresAtKai:String(currentKai+86400),requiresRecipientAcceptance:true,priorOwnerConversationPolicy:"encrypted-evidence",inventoryDisposition:{}}});
  await input.beforeIssue?.(plan);
  const instrument=await input.rail.issueBearerTransferInstrument({plan,ownerCapability:capability(input.authority,state.admittedProofDigest)});
  const offer=validateWildsResourcePackageTransferOffer({schema:"receiz.wilds.resource-package-transfer-offer.v1",package:packageProof,subjectId:state.subjectId,sourceHandle:exactHandle(input.authority.profileHandle),targetHandle,instrument});
  if(instrument.plan.currentOwnerReceizId!==input.authority.ownerReceizId || instrument.plan.subjectDigest!==projected.admittedProofDigest || instrument.plan.expectedSubjectHead!==state.head)throw Error("wilds_resource_package_instrument_binding_invalid");
  return offer;
}

function nativeTransferNotFound(cause:unknown) {
  const status=cause && typeof cause==="object" && "status" in cause?Number((cause as {status:unknown}).status):null;
  return status===404 || /(?:TRANSFER_NOT_FOUND|subject_not_found|\b404\b)/i.test(cause instanceof Error?cause.message:"");
}

/** Recover the exact saved plan. Native pending bytes come from the subject's
 * primary proof object and must pass native offline inspection before export. */
export async function recoverWildsResourcePackageTransfer(input:{authority:WildsWalletReadAuthority;package:WildsResourcePackageV1;targetHandle:string|null;plan:ReceizBearerTransferPlanV1;rail:WildsResourcePackageBearerRail}) {
  const projected=await projectWildsResourcePackageSubjectAdmissionV122(input.package,input.authority.ownerReceizId),plan=input.plan;
  if(plan.subjectId!==projected.subjectId || plan.subjectDigest!==projected.admittedProofDigest || plan.currentOwnerReceizId!==input.authority.ownerReceizId)throw Error("wilds_resource_package_plan_invalid");
  const state=await input.rail.subjectStateV122(plan.subjectId);
  if(state.ownerReceizId!==input.authority.ownerReceizId || state.admittedProofDigest!==projected.admittedProofDigest)throw Error("wilds_resource_package_owner_invalid");
  let status;
  try{status=await input.rail.bearerTransferStatus(plan.transferId);}catch(cause){
    if(!nativeTransferNotFound(cause))throw cause;
    // The native expected head admits this exact plan once. A delayed competing
    // request cannot issue another instrument after the first changes that head.
    if(state.head!==plan.expectedSubjectHead)throw Error("wilds_resource_package_issuance_pending");
    const instrument=await input.rail.issueBearerTransferInstrument({plan,ownerCapability:capability(input.authority,projected.admittedProofDigest)});
    if(canonicalPortableCardJson(instrument.plan)!==canonicalPortableCardJson(plan))throw Error("wilds_resource_package_instrument_recovery_invalid");
    return validateWildsResourcePackageTransferOffer({schema:"receiz.wilds.resource-package-transfer-offer.v1",package:input.package,subjectId:plan.subjectId,sourceHandle:exactHandle(input.authority.profileHandle),targetHandle:input.targetHandle,instrument});
  }
  if(status.subjectId!==plan.subjectId || status.transferId!==plan.transferId || status.status!=="pending-acceptance")throw Error("wilds_resource_package_issuance_pending");
  const references=await input.rail.subjectBrainSearch(plan.subjectId,{query:"Pending bearer transfer custody",atHead:state.head,limit:64,visibility:"private",types:["event"]});
  const reference=references.find(value=>value.proofObjectId===`transfer-instrument:${status.instrumentDigest}` && value.subjectId===plan.subjectId);
  if(!reference)throw Error("wilds_resource_package_instrument_recovery_pending");
  const context=await input.rail.subjectBrainResolve(plan.subjectId,{atHead:state.head,references:[reference]});
  const proof=context.primaryObjects.find(value=>value.proofObjectId===reference.proofObjectId && value.subjectId===plan.subjectId && value.objectDigest===reference.objectDigest);
  if(!proof || proof.exactBytesB64u.length>1024*1024)throw Error("wilds_resource_package_instrument_recovery_pending");
  let exact:unknown;
  try{exact=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(proof.exactBytesB64u)));}catch{throw Error("wilds_resource_package_instrument_recovery_invalid");}
  if(!exact || typeof exact!=="object" || canonicalPortableCardJson((exact as {plan?:unknown}).plan)!==canonicalPortableCardJson(plan))throw Error("wilds_resource_package_instrument_recovery_invalid");
  const offer=validateWildsResourcePackageTransferOffer({schema:"receiz.wilds.resource-package-transfer-offer.v1",package:input.package,subjectId:plan.subjectId,sourceHandle:exactHandle(input.authority.profileHandle),targetHandle:input.targetHandle,
    instrument:{...exact,exactBytesB64u:proof.exactBytesB64u,artifactDigest:status.instrumentDigest,status:"pending-acceptance"}});
  const inspected=await input.rail.inspectBearerTransferInstrument(offer.instrument);
  if(!inspected.valid || !inspected.offlineVerified || canonicalPortableCardJson(inspected.instrument)!==canonicalPortableCardJson(offer.instrument))throw Error("wilds_resource_package_instrument_recovery_invalid");
  return offer;
}

export async function cancelWildsResourcePackageTransferPlan(input:{authority:WildsWalletReadAuthority;plan:ReceizBearerTransferPlanV1;rail:WildsResourcePackageBearerRail}) {
  if(input.plan.currentOwnerReceizId!==input.authority.ownerReceizId)throw Error("wilds_resource_package_owner_invalid");
  const cancelled=await input.rail.cancelBearerTransfer(input.plan.transferId,capability(input.authority,input.plan.subjectDigest));
  if(!cancelled.ok)throw Error("wilds_resource_package_cancellation_pending");
  const status=await input.rail.bearerTransferStatus(input.plan.transferId);
  if(status.subjectId!==input.plan.subjectId || status.transferId!==input.plan.transferId || status.status!=="cancelled")throw Error("wilds_resource_package_cancellation_pending");
}

export async function claimWildsResourcePackageTransfer(input:{authority:WildsWalletReadAuthority;offer:WildsResourcePackageTransferOffer;rail:WildsResourcePackageBearerRail}):Promise<WildsResourcePackageTransferAdmission> {
  const offer=validateWildsResourcePackageTransferOffer(input.offer),instrument=offer.instrument;
  if(offer.targetHandle && !sameWildzPlayerCoordinate(offer.targetHandle,input.authority.profileHandle))throw Error("wilds_resource_package_recipient_invalid");
  if(instrument.plan.policy.recipientReceizId!==null && instrument.plan.policy.recipientReceizId!==input.authority.ownerReceizId)throw Error("wilds_resource_package_recipient_invalid");
  const projected=await projectWildsResourcePackageSubjectAdmissionV122(offer.package,input.authority.ownerReceizId);
  if(projected.subjectId!==offer.subjectId || projected.admittedProofDigest!==instrument.plan.subjectDigest)throw Error("wilds_resource_package_subject_invalid");
  const inspection=await input.rail.inspectBearerTransferInstrument(instrument);
  if(!inspection.valid || !inspection.offlineVerified || canonicalPortableCardJson(inspection.instrument)!==canonicalPortableCardJson(instrument))throw Error("wilds_resource_package_instrument_invalid");
  const result=await input.rail.claimBearerTransferInstrument(instrument,capability(input.authority));
  if(!result.ok)throw Error(`wilds_resource_package_${(result.code??"claim_unconfirmed").toLowerCase()}`);
  const receipt=result.receipt;
  const pendingHead=digestReceizCompositeCanonical({kind:"receiz.subject.transfer.pending.v1",priorHead:instrument.plan.expectedSubjectHead,transferId:instrument.plan.transferId,policyDigest:instrument.plan.policyDigest});
  if(receipt.transferId!==instrument.plan.transferId || receipt.instrumentDigest!==instrument.artifactDigest || receipt.subjectId!==offer.subjectId
    || receipt.priorOwnerReceizId!==instrument.plan.currentOwnerReceizId || receipt.nextOwnerReceizId!==input.authority.ownerReceizId
    || receipt.priorSubjectHead!==pendingHead)throw Error("wilds_resource_package_receipt_binding_invalid");
  const state=await input.rail.subjectStateV122(offer.subjectId);
  if(state.admittedProofDigest!==projected.admittedProofDigest || state.ownerReceizId!==input.authority.ownerReceizId || state.head!==receipt.nextSubjectHead)throw Error("wilds_resource_package_successor_invalid");
  return {schema:"receiz.wilds.resource-package-transfer-admission.v1",package:offer.package,subjectId:offer.subjectId,sourceHandle:offer.sourceHandle,targetHandle:offer.targetHandle,receipt,idempotent:result.idempotent};
}

export async function cancelWildsResourcePackageTransfer(input:{authority:WildsWalletReadAuthority;offer:WildsResourcePackageTransferOffer;rail:WildsResourcePackageBearerRail}) {
  const offer=validateWildsResourcePackageTransferOffer(input.offer);
  if(offer.instrument.plan.currentOwnerReceizId!==input.authority.ownerReceizId)throw Error("wilds_resource_package_owner_invalid");
  const result=await input.rail.cancelBearerTransfer(offer.instrument.plan.transferId,capability(input.authority,offer.instrument.plan.subjectDigest));
  if(!result.ok)throw Error(`wilds_resource_package_${(result.code??"cancel_unconfirmed").toLowerCase()}`);
  return result;
}
