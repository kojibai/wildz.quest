import { canonicalPortableCardJson, sha256PortableBasis, verifyAnyWildsCard } from "./portable-card";
import type { WildsCardTransferOffer } from "@/lib/receiz/wilds-card-transfer";
import { verifyWildsResourceLot } from "./wilds-resource-lot";
import type { WildsResourceTransferOffer } from "@/lib/receiz/wilds-resource-transfer";

export const WILDS_PORTABLE_CLAIM_SCHEMA = "receiz.wildz.portable-claim.v1" as const;
export const WILDS_PORTABLE_CLAIM_MAX_BYTES = 128 * 1024;

export type WildsPortableClaimKind =
  | "phi"
  | "resource"
  | "card"
  | "creature-custody"
  | "experience-access"
  | "world-right";

export type WildsPortableExecutionCarrier = Readonly<{
  kind: "portable-execution";
  exactPlanDigest: string;
  transitionSet: unknown;
}>;

export type WildsBearerCardClaimCarrier = Readonly<{
  kind: "bearer-card";
  offer: WildsCardTransferOffer;
}>;

export type WildsBearerResourceClaimCarrier = Readonly<{
  kind: "bearer-resource";
  offer: WildsResourceTransferOffer;
}>;

export type WildsPortableClaimCarrier = WildsPortableExecutionCarrier | WildsBearerCardClaimCarrier | WildsBearerResourceClaimCarrier;

export type WildsPortableClaim = Readonly<{
  schema: typeof WILDS_PORTABLE_CLAIM_SCHEMA;
  claimId: string;
  kind: WildsPortableClaimKind;
  title: string;
  source: Readonly<{
    ownerReceizId: string;
    subjectId: string;
    head: string;
    proofObjectDigest: string;
  }>;
  recipient: Readonly<{ handle: string | null }>;
  issuedAtKai: number;
  expiresAtKai: number;
  carrier: WildsPortableClaimCarrier;
  authority: Readonly<{
    claimIsProofAuthority: false;
    representationCanCommit: false;
    strongerTruth: "sealed-receiz-proof-object";
  }>;
}>;

export type WildsPortableClaimInput = Omit<WildsPortableClaim, "schema" | "claimId" | "authority">;

const DIGEST = /^[a-f0-9]{64}$/;
const KINDS = new Set<WildsPortableClaimKind>([
  "phi",
  "resource",
  "card",
  "creature-custody",
  "experience-access",
  "world-right"
]);

function record(value: unknown, code = "wilds_portable_claim_invalid") {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function text(value: unknown, code: string, maximum = 240) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > maximum) throw new Error(code);
  return value;
}

function exactDigest(value: unknown, code: string) {
  if (typeof value !== "string" || !DIGEST.test(value)) throw new Error(code);
  return value;
}

function transitionCarrier(value: unknown): WildsPortableExecutionCarrier {
  const carrier = record(value, "wilds_portable_claim_carrier_invalid");
  const transitionSet = record(carrier.transitionSet, "wilds_portable_claim_carrier_invalid");
  const exactPlanDigest = exactDigest(carrier.exactPlanDigest, "wilds_portable_claim_carrier_invalid");
  if (carrier.kind !== "portable-execution"
    || transitionSet.schema !== "receiz.portable-execution-transition-set.v124"
    || transitionSet.exactPlanDigest !== exactPlanDigest
    || transitionSet.applicationId !== "wildz"
    || !Array.isArray(transitionSet.members)
    || record(transitionSet.authority, "wilds_portable_claim_carrier_invalid").strongerTruth !== "sealed-receiz-proof-object") {
    throw new Error("wilds_portable_claim_carrier_invalid");
  }
  return Object.freeze({ kind: "portable-execution", exactPlanDigest, transitionSet: carrier.transitionSet });
}

function claimCarrier(value: unknown): WildsPortableClaimCarrier {
  const item = record(value, "wilds_portable_claim_carrier_invalid");
  if (item.kind === "portable-execution") return transitionCarrier(item);
  if (item.kind === "bearer-card") {
    try {
      const offer = item.offer as WildsCardTransferOffer;
      const instrument = offer.instrument;
      if (offer.schema !== "receiz.wilds.card-transfer-offer.v1" || !verifyAnyWildsCard(offer.card).ok
        || !offer.subjectId || !offer.sourceHandle || !offer.targetHandle
        || instrument.schema !== "receiz.bearer.instrument.v1"
        || instrument.plan.schema !== "receiz.bearer.transfer_plan.v1"
        || instrument.plan.subjectId !== offer.subjectId
        || instrument.plan.transferId !== instrument.plan.transferDigest
        || instrument.plan.currentOwnerReceizId.length < 3
        || !instrument.plan.policy.openBearer
        || !instrument.plan.policy.requiresRecipientAcceptance
        || instrument.plan.policy.recipientReceizId !== null
        || instrument.status !== "pending-acceptance") throw new Error("invalid");
      return Object.freeze({ kind: "bearer-card" as const, offer });
    } catch {
      throw new Error("wilds_portable_claim_carrier_invalid");
    }
  }
  if (item.kind === "bearer-resource") {
    try {
      const offer = item.offer as WildsResourceTransferOffer;
      const instrument = offer.instrument;
      if (offer.schema !== "receiz.wilds.resource-transfer-offer.v1" || !verifyWildsResourceLot(offer.resourceLot)
        || !offer.subjectId || !offer.sourceHandle || !offer.targetHandle
        || instrument.schema !== "receiz.bearer.instrument.v1" || instrument.plan.schema !== "receiz.bearer.transfer_plan.v1"
        || instrument.plan.subjectId !== offer.subjectId || instrument.plan.transferId !== instrument.plan.transferDigest
        || !instrument.plan.policy.openBearer || !instrument.plan.policy.requiresRecipientAcceptance
        || instrument.plan.policy.recipientReceizId !== null || instrument.status !== "pending-acceptance") throw new Error("invalid");
      return Object.freeze({ kind: "bearer-resource" as const, offer });
    } catch {
      throw new Error("wilds_portable_claim_carrier_invalid");
    }
  }
  throw new Error("wilds_portable_claim_carrier_invalid");
}

function basis(input: WildsPortableClaimInput) {
  if (!KINDS.has(input.kind)) throw new Error("wilds_portable_claim_kind_invalid");
  const title = text(input.title, "wilds_portable_claim_title_invalid", 120);
  const source = record(input.source);
  const recipient = record(input.recipient);
  const handle = recipient.handle === null ? null : text(recipient.handle, "wilds_portable_claim_recipient_invalid", 80);
  if (!Number.isSafeInteger(input.issuedAtKai) || input.issuedAtKai < 0
    || !Number.isSafeInteger(input.expiresAtKai) || input.expiresAtKai <= input.issuedAtKai) {
    throw new Error("wilds_portable_claim_kai_invalid");
  }
  const normalizedSource = Object.freeze({
    ownerReceizId: text(source.ownerReceizId, "wilds_portable_claim_source_invalid"),
    subjectId: text(source.subjectId, "wilds_portable_claim_source_invalid"),
    head: exactDigest(source.head, "wilds_portable_claim_source_invalid"),
    proofObjectDigest: exactDigest(source.proofObjectDigest, "wilds_portable_claim_source_invalid")
  });
  const normalizedCarrier = claimCarrier(input.carrier);
  if (normalizedCarrier.kind === "bearer-card") {
    const { offer } = normalizedCarrier;
    const { plan } = offer.instrument;
    if ((input.kind !== "card" && input.kind !== "creature-custody")
      || title !== offer.card.manifest.name
      || normalizedSource.ownerReceizId !== plan.currentOwnerReceizId
      || normalizedSource.subjectId !== offer.subjectId
      || normalizedSource.head !== plan.expectedSubjectHead
      || normalizedSource.proofObjectDigest !== plan.subjectDigest
      || handle !== offer.targetHandle
      || String(input.issuedAtKai) !== offer.instrument.issuedAtKai
      || String(input.expiresAtKai) !== plan.policy.expiresAtKai) {
      throw new Error("wilds_portable_claim_carrier_invalid");
    }
  } else if (normalizedCarrier.kind === "bearer-resource") {
    const { offer } = normalizedCarrier;
    const { plan } = offer.instrument;
    if (input.kind !== "resource" || title !== "Living Honey"
      || normalizedSource.ownerReceizId !== plan.currentOwnerReceizId
      || normalizedSource.subjectId !== offer.subjectId
      || normalizedSource.head !== plan.expectedSubjectHead
      || normalizedSource.proofObjectDigest !== plan.subjectDigest
      || handle !== offer.targetHandle
      || String(input.issuedAtKai) !== offer.instrument.issuedAtKai
      || String(input.expiresAtKai) !== plan.policy.expiresAtKai) {
      throw new Error("wilds_portable_claim_carrier_invalid");
    }
  }
  return Object.freeze({
    schema: WILDS_PORTABLE_CLAIM_SCHEMA,
    kind: input.kind,
    title,
    source: normalizedSource,
    recipient: Object.freeze({ handle }),
    issuedAtKai: input.issuedAtKai,
    expiresAtKai: input.expiresAtKai,
    carrier: normalizedCarrier,
    authority: Object.freeze({
      claimIsProofAuthority: false as const,
      representationCanCommit: false as const,
      strongerTruth: "sealed-receiz-proof-object" as const
    })
  });
}

function claimIdFor(value: ReturnType<typeof basis>) {
  return `wildz-claim:${sha256PortableBasis(canonicalPortableCardJson(value)).replace(/^sha256:/, "")}`;
}

export function createWildsPortableClaim(input: WildsPortableClaimInput): WildsPortableClaim {
  const normalized = basis(input);
  return Object.freeze({ ...normalized, claimId: claimIdFor(normalized) });
}

export function createWildsCardPortableClaim(offerInput: WildsCardTransferOffer) {
  const { offer } = claimCarrier({ kind: "bearer-card", offer: offerInput }) as WildsBearerCardClaimCarrier;
  const issuedAtKai = Number(offer.instrument.issuedAtKai);
  const expiresAtKai = Number(offer.instrument.plan.policy.expiresAtKai);
  if (!Number.isSafeInteger(issuedAtKai) || !Number.isSafeInteger(expiresAtKai)) {
    throw new Error("wilds_portable_claim_kai_invalid");
  }
  return createWildsPortableClaim({
    kind: "card",
    title: offer.card.manifest.name,
    source: {
      ownerReceizId: offer.instrument.plan.currentOwnerReceizId,
      subjectId: offer.subjectId,
      head: offer.instrument.plan.expectedSubjectHead,
      proofObjectDigest: offer.instrument.plan.subjectDigest
    },
    recipient: { handle: offer.targetHandle },
    issuedAtKai,
    expiresAtKai,
    carrier: { kind: "bearer-card", offer }
  });
}

export function createWildsResourcePortableClaim(offerInput: WildsResourceTransferOffer) {
  const { offer } = claimCarrier({ kind: "bearer-resource", offer: offerInput }) as WildsBearerResourceClaimCarrier;
  const issuedAtKai = Number(offer.instrument.issuedAtKai);
  const expiresAtKai = Number(offer.instrument.plan.policy.expiresAtKai);
  if (!Number.isSafeInteger(issuedAtKai) || !Number.isSafeInteger(expiresAtKai)) throw new Error("wilds_portable_claim_kai_invalid");
  return createWildsPortableClaim({
    kind: "resource",
    title: "Living Honey",
    source: {
      ownerReceizId: offer.instrument.plan.currentOwnerReceizId,
      subjectId: offer.subjectId,
      head: offer.instrument.plan.expectedSubjectHead,
      proofObjectDigest: offer.instrument.plan.subjectDigest
    },
    recipient: { handle: offer.targetHandle },
    issuedAtKai,
    expiresAtKai,
    carrier: { kind: "bearer-resource", offer }
  });
}

export function validateWildsPortableClaim(value: unknown): WildsPortableClaim {
  const item = record(value);
  if (item.schema !== WILDS_PORTABLE_CLAIM_SCHEMA) throw new Error("wilds_portable_claim_invalid");
  const normalized = createWildsPortableClaim({
    kind: item.kind as WildsPortableClaimKind,
    title: item.title as string,
    source: item.source as WildsPortableClaimInput["source"],
    recipient: item.recipient as WildsPortableClaimInput["recipient"],
    issuedAtKai: item.issuedAtKai as number,
    expiresAtKai: item.expiresAtKai as number,
    carrier: item.carrier as WildsPortableClaimCarrier
  });
  if (item.claimId !== normalized.claimId
    || canonicalPortableCardJson(item.authority) !== canonicalPortableCardJson(normalized.authority)) {
    throw new Error("wilds_portable_claim_digest_invalid");
  }
  return normalized;
}

function encodeUtf8(value: string) {
  if (typeof window === "undefined" && typeof Buffer !== "undefined") return Buffer.from(value, "utf8").toString("base64url");
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeUtf8(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("wilds_portable_claim_encoding_invalid");
  if (typeof window === "undefined" && typeof Buffer !== "undefined") return Buffer.from(value, "base64url").toString("utf8");
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat((4 - value.length % 4) % 4)}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeWildsPortableClaim(claim: WildsPortableClaim) {
  const canonical = canonicalPortableCardJson(validateWildsPortableClaim(claim));
  if (new TextEncoder().encode(canonical).byteLength > WILDS_PORTABLE_CLAIM_MAX_BYTES) {
    throw new Error("wilds_portable_claim_too_large");
  }
  return encodeUtf8(canonical);
}

export function decodeWildsPortableClaim(encoded: string) {
  if (!encoded || encoded.length > WILDS_PORTABLE_CLAIM_MAX_BYTES * 2) throw new Error("wilds_portable_claim_encoding_invalid");
  try {
    return validateWildsPortableClaim(JSON.parse(decodeUtf8(encoded)) as unknown);
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("wilds_portable_claim_")) throw cause;
    throw new Error("wilds_portable_claim_encoding_invalid");
  }
}

export function wildsPortableClaimUrl(origin: string, claim: WildsPortableClaim) {
  const url = new URL("/claim", origin);
  url.hash = `proof=${encodeWildsPortableClaim(claim)}`;
  return url.toString();
}
