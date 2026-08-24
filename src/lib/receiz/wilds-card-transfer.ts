import { createHash } from "node:crypto";
import {
  receizKaiNow,
  type ReceizBearerInstrumentV1,
  type ReceizBearerTransferReceiptV1
} from "@receiz/sdk";
import {
  canonicalPortableCardJson,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "@/features/play/portable-card";
import type { ReceizCommerceAdapter } from "./adapter";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";
import {
  admitWildsCreatureSubjectV122,
  projectWildsCreatureSubjectAdmissionV122
} from "./wilds-v122-subjects";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";

type BearerRail = Pick<ReceizCommerceAdapter,
  | "admitSubjectV122"
  | "subjectStateV122"
  | "previewBearerTransfer"
  | "issueBearerTransferInstrument"
  | "inspectBearerTransferInstrument"
  | "claimBearerTransferInstrument"
>;

export type WildsCardTransferOffer = Readonly<{
  schema: "receiz.wilds.card-transfer-offer.v1";
  card: PortableCardAsset;
  subjectId: string;
  sourceHandle: string;
  targetHandle: string;
  instrument: ReceizBearerInstrumentV1;
}>;

export type WildsCardTransferAdmission = Readonly<{
  schema: "receiz.wilds.card-transfer-admission.v1";
  card: PortableCardAsset;
  subjectId: string;
  sourceHandle: string;
  targetHandle: string;
  receipt: ReceizBearerTransferReceiptV1;
  idempotent: boolean;
}>;

function exactCard(card: PortableCardAsset) {
  if (!verifyAnyWildsCard(card).ok) throw new Error("wilds_card_transfer_card_invalid");
  return card;
}

function exactTarget(targetHandle: string) {
  const coordinate = parseWildzPlayerCoordinate(targetHandle);
  if (!coordinate) throw new Error("wilds_card_transfer_recipient_invalid");
  return coordinate.profileHandle;
}

function capabilityDigest(authority: WildsWalletReadAuthority, proofDigest?: string) {
  if (proofDigest && /^[a-f0-9]{64}$/.test(proofDigest)) return proofDigest;
  // This digest only binds the already-verified edge identity's consent to the
  // bearer operation. It is not ownership truth and cannot outrank the source.
  return createHash("sha256")
    .update("receiz.wilds.bearer-capability.v1\0")
    .update(authority.ownerReceizId).update("\0")
    .update(authority.actorId).update("\0")
    .update(authority.profileHandle)
    .digest("hex");
}

function missingSubject(cause: unknown) {
  const status = cause && typeof cause === "object" && "status" in cause
    ? Number((cause as { status?: unknown }).status)
    : null;
  const message = cause instanceof Error ? cause.message : "";
  return status === 404 || /(?:^|\b)(?:404|not_found|subject_not_found)(?:\b|$)/i.test(message);
}

export function validateWildsCardTransferOffer(value: WildsCardTransferOffer) {
  const card = exactCard(value.card);
  const targetHandle = exactTarget(value.targetHandle);
  const sourceHandle = exactTarget(value.sourceHandle);
  const instrument = value.instrument;
  if (value.schema !== "receiz.wilds.card-transfer-offer.v1"
    || instrument.schema !== "receiz.bearer.instrument.v1"
    || instrument.plan.subjectId !== value.subjectId
    || instrument.plan.transferId !== instrument.plan.transferDigest
    || !instrument.plan.policy.openBearer
    || !instrument.plan.policy.requiresRecipientAcceptance
    || instrument.plan.policy.recipientReceizId !== null
    || instrument.status !== "pending-acceptance") {
    throw new Error("wilds_card_transfer_offer_invalid");
  }
  return { card, sourceHandle, targetHandle, instrument };
}

export async function issueWildsCardTransfer(input: Readonly<{
  authority: WildsWalletReadAuthority;
  card: PortableCardAsset;
  targetHandle: string;
  rail: BearerRail;
  currentKai?: number;
}>): Promise<WildsCardTransferOffer> {
  const card = exactCard(input.card);
  const targetHandle = exactTarget(input.targetHandle);
  const projected = await projectWildsCreatureSubjectAdmissionV122(card, input.authority.ownerReceizId);
  try {
    const existing = await input.rail.subjectStateV122(projected.subjectId);
    if (existing.ownerReceizId !== input.authority.ownerReceizId
      || existing.admittedProofDigest !== projected.admittedProofDigest) {
      throw new Error("wilds_card_transfer_owner_invalid");
    }
  } catch (cause) {
    if (!missingSubject(cause)) throw cause;
    // A previously unseen card can only enter the bearer rail from the owner
    // written in its verified source. Imported transfers must already have an
    // admitted ownership head and are handled by the existing-state branch.
    if (!sameWildzPlayerCoordinate(card.manifest.ownerReceizId, input.authority.profileHandle)) {
      throw new Error("wilds_card_transfer_owner_invalid");
    }
  }
  const state = await admitWildsCreatureSubjectV122({
    card,
    ownerReceizId: input.authority.ownerReceizId,
    rail: input.rail
  });
  if (state.ownerReceizId !== input.authority.ownerReceizId) {
    throw new Error("wilds_card_transfer_owner_invalid");
  }
  const currentKai = input.currentKai ?? receizKaiNow().pulse;
  const plan = await input.rail.previewBearerTransfer({
    subjectId: state.subjectId,
    policy: {
      recipientReceizId: null,
      openBearer: true,
      expiresAtKai: String(currentKai + 86_400),
      requiresRecipientAcceptance: true,
      priorOwnerConversationPolicy: "encrypted-evidence",
      inventoryDisposition: {}
    }
  });
  const instrument = await input.rail.issueBearerTransferInstrument({
    plan,
    ownerCapability: {
      receizId: input.authority.ownerReceizId,
      capabilityDigest: capabilityDigest(input.authority, state.admittedProofDigest)
    }
  });
  if (instrument.plan.subjectId !== state.subjectId
    || instrument.plan.currentOwnerReceizId !== input.authority.ownerReceizId
    || instrument.status !== "pending-acceptance") {
    throw new Error("wilds_card_transfer_instrument_binding_invalid");
  }
  return Object.freeze({
    schema: "receiz.wilds.card-transfer-offer.v1",
    card,
    subjectId: state.subjectId,
    sourceHandle: exactTarget(input.authority.profileHandle),
    targetHandle,
    instrument
  });
}

export async function claimWildsCardTransfer(input: Readonly<{
  authority: WildsWalletReadAuthority;
  offer: WildsCardTransferOffer;
  rail: BearerRail;
}>): Promise<WildsCardTransferAdmission> {
  const { card, sourceHandle, targetHandle, instrument } = validateWildsCardTransferOffer(input.offer);
  if (!sameWildzPlayerCoordinate(targetHandle, input.authority.profileHandle)) {
    throw new Error("wilds_card_transfer_recipient_invalid");
  }
  const inspection = await input.rail.inspectBearerTransferInstrument(instrument);
  if (!inspection.valid || !inspection.offlineVerified
    || inspection.instrument.artifactDigest !== instrument.artifactDigest) {
    throw new Error("wilds_card_transfer_instrument_invalid");
  }
  const result = await input.rail.claimBearerTransferInstrument(instrument, {
    receizId: input.authority.ownerReceizId,
    capabilityDigest: capabilityDigest(input.authority)
  });
  if (!result.ok) throw new Error(`wilds_card_transfer_${result.code.toLowerCase()}`);
  if (result.receipt.transferId !== instrument.plan.transferId
    || result.receipt.subjectId !== input.offer.subjectId
    || result.receipt.priorOwnerReceizId !== instrument.plan.currentOwnerReceizId
    || result.receipt.nextOwnerReceizId !== input.authority.ownerReceizId) {
    throw new Error("wilds_card_transfer_receipt_binding_invalid");
  }
  // Force canonical serialization here so malformed or cyclic client input can
  // never enter the private conversation projection after admission.
  canonicalPortableCardJson(card);
  return Object.freeze({
    schema: "receiz.wilds.card-transfer-admission.v1",
    card,
    subjectId: input.offer.subjectId,
    sourceHandle,
    targetHandle,
    receipt: result.receipt,
    idempotent: result.idempotent
  });
}
