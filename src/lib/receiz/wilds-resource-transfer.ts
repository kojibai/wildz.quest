import { createHash } from "node:crypto";
import {
  receizKaiNow,
  deriveReceizSubjectIdV122,
  snapshotReceizArtifactInput,
  validateReceizSubjectAdmissionResultV122,
  type ReceizBearerInstrumentV1,
  type ReceizBearerTransferReceiptV1,
  type ReceizSubjectStateV122
} from "@receiz/sdk";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
import { verifyWildsResourceLot, type WildsResourceLotV1 } from "@/features/play/wilds-resource-lot";
import type { ReceizCommerceAdapter } from "./adapter";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";

type BearerRail = Pick<ReceizCommerceAdapter,
  "admitSubjectV122" | "subjectStateV122" | "previewBearerTransfer" | "issueBearerTransferInstrument" | "inspectBearerTransferInstrument" | "claimBearerTransferInstrument"
>;

export type WildsResourceTransferOffer = Readonly<{
  schema: "receiz.wilds.resource-transfer-offer.v1";
  resourceLot: WildsResourceLotV1;
  subjectId: string;
  sourceHandle: string;
  targetHandle: string;
  instrument: ReceizBearerInstrumentV1;
}>;

export type WildsResourceTransferAdmission = Readonly<{
  schema: "receiz.wilds.resource-transfer-admission.v1";
  resourceLot: WildsResourceLotV1;
  subjectId: string;
  sourceHandle: string;
  targetHandle: string;
  receipt: ReceizBearerTransferReceiptV1;
  idempotent: boolean;
}>;

function exactLot(value: unknown) {
  if (!verifyWildsResourceLot(value)) throw new Error("wilds_resource_transfer_lot_invalid");
  return value;
}

function exactTarget(value: string) {
  const coordinate = parseWildzPlayerCoordinate(value);
  if (!coordinate) throw new Error("wilds_resource_transfer_recipient_invalid");
  return coordinate.profileHandle;
}

function capabilityDigest(authority: WildsWalletReadAuthority, proofDigest?: string) {
  if (proofDigest && /^[a-f0-9]{64}$/.test(proofDigest)) return proofDigest;
  return createHash("sha256").update("receiz.wilds.resource-bearer-capability.v1\0")
    .update(authority.ownerReceizId).update("\0").update(authority.actorId).update("\0").update(authority.profileHandle).digest("hex");
}

function missingSubject(cause: unknown) {
  const status = cause && typeof cause === "object" && "status" in cause ? Number((cause as { status?: unknown }).status) : null;
  const message = cause instanceof Error ? cause.message : "";
  return status === 404 || /(?:^|\b)(?:404|not_found|subject_not_found)(?:\b|$)/i.test(message);
}

export async function projectWildsResourceSubjectAdmissionV122(resourceLot: WildsResourceLotV1, ownerReceizId: string) {
  const lot = exactLot(resourceLot);
  const proofObject = new Blob([new TextEncoder().encode(canonicalPortableCardJson(lot))], { type: "application/json" });
  const snapshot = await snapshotReceizArtifactInput(proofObject);
  const subjectId = await deriveReceizSubjectIdV122(snapshot.artifactDigest.value);
  return Object.freeze({
    subjectId,
    admittedProofDigest: snapshot.artifactDigest.value,
    input: Object.freeze({ proofObject, ownerReceizId, idempotencyKey: `wildz:resource-subject:v124:${subjectId}`, expectedAbsent: true as const })
  });
}

function assertState(state: ReceizSubjectStateV122, projected: Awaited<ReturnType<typeof projectWildsResourceSubjectAdmissionV122>>, ownerReceizId: string) {
  if (state.subjectId !== projected.subjectId || state.admittedProofDigest !== projected.admittedProofDigest || state.ownerReceizId !== ownerReceizId) {
    throw new Error("wilds_resource_transfer_subject_invalid");
  }
  return state;
}

async function admitResourceSubject(resourceLot: WildsResourceLotV1, authority: WildsWalletReadAuthority, rail: BearerRail) {
  const projected = await projectWildsResourceSubjectAdmissionV122(resourceLot, authority.ownerReceizId);
  try { return assertState(await rail.subjectStateV122(projected.subjectId), projected, authority.ownerReceizId); }
  catch (cause) { if (!missingSubject(cause)) throw cause; }
  if (!sameWildzPlayerCoordinate(resourceLot.ownerReceizId, authority.profileHandle)
    && !sameWildzPlayerCoordinate(resourceLot.ownerReceizId, authority.ownerReceizId)) {
    throw new Error("wilds_resource_transfer_owner_invalid");
  }
  const result = await validateReceizSubjectAdmissionResultV122(await rail.admitSubjectV122(projected.input));
  if (!result.ok || result.subjectId !== projected.subjectId || result.proofDigest !== projected.admittedProofDigest) {
    throw new Error("wilds_resource_transfer_subject_admission_invalid");
  }
  return assertState(await rail.subjectStateV122(projected.subjectId), projected, authority.ownerReceizId);
}

export function validateWildsResourceTransferOffer(value: WildsResourceTransferOffer) {
  const resourceLot = exactLot(value.resourceLot);
  const sourceHandle = exactTarget(value.sourceHandle);
  const targetHandle = exactTarget(value.targetHandle);
  const instrument = value.instrument;
  if (value.schema !== "receiz.wilds.resource-transfer-offer.v1" || instrument.schema !== "receiz.bearer.instrument.v1"
    || instrument.plan.subjectId !== value.subjectId || instrument.plan.transferId !== instrument.plan.transferDigest
    || !instrument.plan.policy.openBearer || !instrument.plan.policy.requiresRecipientAcceptance
    || instrument.plan.policy.recipientReceizId !== null || instrument.status !== "pending-acceptance"
    || !/^[a-f0-9]{64}$/.test(instrument.plan.subjectDigest)) {
    throw new Error("wilds_resource_transfer_offer_invalid");
  }
  return { resourceLot, sourceHandle, targetHandle, instrument };
}

export async function issueWildsResourceTransfer(input: Readonly<{
  authority: WildsWalletReadAuthority; resourceLot: WildsResourceLotV1; targetHandle: string; rail: BearerRail; currentKai?: number;
}>): Promise<WildsResourceTransferOffer> {
  const resourceLot = exactLot(input.resourceLot);
  const targetHandle = exactTarget(input.targetHandle);
  const state = await admitResourceSubject(resourceLot, input.authority, input.rail);
  const currentKai = input.currentKai ?? receizKaiNow().pulse;
  const plan = await input.rail.previewBearerTransfer({
    subjectId: state.subjectId,
    policy: { recipientReceizId: null, openBearer: true, expiresAtKai: String(currentKai + 86_400), requiresRecipientAcceptance: true, priorOwnerConversationPolicy: "encrypted-evidence", inventoryDisposition: {} }
  });
  const instrument = await input.rail.issueBearerTransferInstrument({ plan, ownerCapability: { receizId: input.authority.ownerReceizId, capabilityDigest: capabilityDigest(input.authority, state.admittedProofDigest) } });
  if (instrument.plan.subjectId !== state.subjectId || instrument.plan.currentOwnerReceizId !== input.authority.ownerReceizId || instrument.status !== "pending-acceptance") {
    throw new Error("wilds_resource_transfer_instrument_binding_invalid");
  }
  return Object.freeze({ schema: "receiz.wilds.resource-transfer-offer.v1", resourceLot, subjectId: state.subjectId, sourceHandle: exactTarget(input.authority.profileHandle), targetHandle, instrument });
}

export async function claimWildsResourceTransfer(input: Readonly<{
  authority: WildsWalletReadAuthority; offer: WildsResourceTransferOffer; rail: BearerRail;
}>): Promise<WildsResourceTransferAdmission> {
  const { resourceLot, sourceHandle, targetHandle, instrument } = validateWildsResourceTransferOffer(input.offer);
  if (!sameWildzPlayerCoordinate(targetHandle, input.authority.profileHandle)) throw new Error("wilds_resource_transfer_recipient_invalid");
  const inspection = await input.rail.inspectBearerTransferInstrument(instrument);
  if (!inspection.valid || !inspection.offlineVerified || inspection.instrument.artifactDigest !== instrument.artifactDigest) throw new Error("wilds_resource_transfer_instrument_invalid");
  const result = await input.rail.claimBearerTransferInstrument(instrument, { receizId: input.authority.ownerReceizId, capabilityDigest: capabilityDigest(input.authority) });
  if (!result.ok) throw new Error(`wilds_resource_transfer_${result.code.toLowerCase()}`);
  if (result.receipt.transferId !== instrument.plan.transferId || result.receipt.subjectId !== input.offer.subjectId
    || result.receipt.priorOwnerReceizId !== instrument.plan.currentOwnerReceizId || result.receipt.nextOwnerReceizId !== input.authority.ownerReceizId) {
    throw new Error("wilds_resource_transfer_receipt_binding_invalid");
  }
  return Object.freeze({ schema: "receiz.wilds.resource-transfer-admission.v1", resourceLot, subjectId: input.offer.subjectId, sourceHandle, targetHandle, receipt: result.receipt, idempotent: result.idempotent });
}
