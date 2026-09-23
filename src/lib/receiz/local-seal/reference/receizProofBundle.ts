import { deflateSync, inflateSync } from "fflate";
import { hmacHex } from "./sign";
import {
  coerceReceizBundleSignatureV3,
  type ReceizBundleSignatureV3,
} from "./receizSignatureV3";
import {
  coerceReceizBundleSignatureV4,
  type ReceizBundleSignatureV4,
} from "./receizSignatureV4";
import { jcsCanonicalize } from "./jcs";
import { base64UrlDecode, base64UrlEncode, sha256Hex } from "./sha256";
import { stripPngTextChunksByKeyword } from "./pngChunks";
import { RECEIZ_OWNERSHIP_PROVENANCE_CHUNK_KEY } from "./receizOwnershipProvenanceBundle";
import { deriveSignerKeyId } from "./signerKeyId";

export const RECEIZ_PROOF_BUNDLE_CHUNK_KEY = "receiz.proof_bundle" as const;
const RECEIZ_PROOF_BUNDLE_CODEC = "c1" as const;

const MAX_BUNDLE_ENCODE_BYTES = 24 * 1024;
const MAX_BUNDLE_DECODE_BYTES = 64 * 1024;

export type ReceizCanonicalIdentityInput = Readonly<{
  payloadVersion: "v2" | "v1";
  canonicalTs24: string;
  slug: string;
  code: string;
  kaiPulseEternal: string;
}>;

export function buildReceizCanonicalIdentity(input: ReceizCanonicalIdentityInput): string {
  return [
    "receiz",
    input.payloadVersion,
    `ts=${input.canonicalTs24}`,
    `slug=${input.slug}`,
    `code=${input.code}`,
    `pulse=${input.kaiPulseEternal}`,
  ].join("|");
}

// ✅ Optional WireProof attestation (only present for k=wire/wireproof receipts)
export type WireProofAttestation = Readonly<{
  schema: "wireproof.v1";
  anchorId: string; // 8-hex
  claimHashSha256: string; // 64-hex
  verifierPath: string; // /v/{slug}/{code}/{pulse}?a=...&ms=...
}>;

export type ReceizNativeRecordSeal = Readonly<{
  schema: "receiz.native_record_seal.v1";
  ownerReceizId: string;
  recordId: string;
  payload: Readonly<{ filename: string; mimeType: string; sha256: string }>;
  ownershipContinuity?: ReceizNativeOwnershipContinuity;
  proofPredecessor?: ReceizNativeProofPredecessor;
}>;

// Native capture is an additive, Signature V4-bound proof projection. It is
// deliberately separate from the predecessor-only ownership seal.
export type ReceizNativeCaptureProof = Readonly<Record<string, unknown>>;

export type ReceizNativeProofPredecessor = Readonly<{
  headReference: string;
  artifactSha256: string;
}>;

export type ReceizNativeOwnershipContinuity = Readonly<{
  schema: "receiz.native_ownership_continuity.v1";
  artifactId: string;
  namespace: string;
  genesisOwnerReceizId: string;
  ownerReceizId: string;
  headReference: string;
  historyDigestSha256: string;
  appendCount: number;
  history?: readonly ReceizNativeOwnershipHistoryEntry[];
  predecessor?: ReceizNativeOwnershipPredecessor;
}>;

export type ReceizNativeOwnershipHistoryEntry =
  | Readonly<{
      schema: "receiz.native_ownership_genesis.v1";
      index: 0;
      ownerReceizId: string;
      headReference: string;
      historyDigestSha256: string;
    }>
  | Readonly<{
      schema: "receiz.native_ownership_transfer.v1";
      index: number;
      fromOwnerReceizId: string;
      toOwnerReceizId: string;
      priorHeadReference: string;
      sourceArtifactSha256: string;
      headReference: string;
      historyDigestSha256: string;
    }>;

export type ReceizNativeOwnershipPredecessor = Readonly<{
  headReference: string;
  artifactSha256: string;
  ownerReceizId: string;
  historyDigestSha256: string;
  appendCount: number;
}>;

export type ReceizProofBundle = Readonly<{
  kind: "receiz.proof_bundle";
  payloadVersion: "v2" | "v1";
  createdAtMs: number;
  ts: string;
  tsDisplay?: string;
  tzMinutesEast?: number;
  code: string;
  slug: string;
  verifyPath: string;
  verifyUrl: string;
  kaiPulseEternal: string;
  kaiKlok: string;
  signerKeyId?: string;
  anchorId?: string;
  receizClaimId: string;
  sigilClaimSeed: string;
  zkPoseidonHash?: string;
  groth16Proof?: unknown;
  groth16ProofDigest?: string;
  artifactSha256Basis?: string;
  artifactBasis?: Readonly<{
    algorithm: "sha256";
    normalization: "jpeg-adobe-xmp-app1-v1" | "jpeg-ios-photos-carrier-v2" | "jpeg-ios-photos-carrier-v3" | "jpeg-ios-photos-carrier-v4" | "jpeg-ios-photos-carrier-v5" | "jpeg-ios-photos-carrier-v6";
  }>;
  signatureV3?: ReceizBundleSignatureV3;
  signatureV4?: ReceizBundleSignatureV4;
  nativeRecordSeal?: ReceizNativeRecordSeal;
  nativeCapture?: ReceizNativeCaptureProof;
  nativeCaptureSource?: ReceizNativeCaptureProof;
  nativeCaptureClaim?: ReceizNativeCaptureProof;
  pbiAuthorshipHistory?: readonly ReceizNativeCaptureProof[];

  // ✅ new (optional, WireProof only)
  wireproof?: WireProofAttestation;
}>;

export type BuildReceizProofBundleInput = Readonly<{
  payloadVersion?: "v2";
  createdAtMs: number;
  ts: string;
  tsDisplay?: string;
  tzMinutesEast?: number | null;
  code: string;
  slug: string;
  verifyPath: string;
  verifyUrl: string;
  kaiPulseEternal: string;
  kaiKlok: string;
  signingKey: string;
  signerKeyId?: string;
  anchorId?: string;
  zkPoseidonHash?: string;
  groth16Proof?: unknown;
  groth16ProofDigest?: string;
  artifactSha256Basis: string;
  artifactBasis?: Readonly<{
    algorithm: "sha256";
    normalization: "jpeg-adobe-xmp-app1-v1" | "jpeg-ios-photos-carrier-v2" | "jpeg-ios-photos-carrier-v3" | "jpeg-ios-photos-carrier-v4" | "jpeg-ios-photos-carrier-v5" | "jpeg-ios-photos-carrier-v6";
  }>;

  // ✅ new (optional, WireProof only)
  wireproof?: WireProofAttestation;
}>;

function asFiniteInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asHex64(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) return null;
  return normalized;
}

function asSignerKeyId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(normalized)) return null;
  return normalized;
}

export function isReceizOwnerIdentity(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim().toLowerCase()) return false;
  if (/^[0-9a-f]{64}$/.test(value)) return true;
  return /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?\.receiz\.id$/.test(value);
}

export function coerceReceizNativeRecordSeal(value: unknown): ReceizNativeRecordSeal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (obj.schema !== "receiz.native_record_seal.v1") return null;
  const ownerReceizId = typeof obj.ownerReceizId === "string" ? obj.ownerReceizId : "";
  if (!isReceizOwnerIdentity(ownerReceizId)) return null;
  const recordId = typeof obj.recordId === "string" && obj.recordId.trim() ? obj.recordId : null;
  if (!recordId || !obj.payload || typeof obj.payload !== "object" || Array.isArray(obj.payload)) return null;
  const payload = obj.payload as Record<string, unknown>;
  const filename = typeof payload.filename === "string" && payload.filename.trim() ? payload.filename : null;
  const mimeType = typeof payload.mimeType === "string" && payload.mimeType.trim() ? payload.mimeType : null;
  const sha256 = typeof payload.sha256 === "string" && /^[0-9a-f]{64}$/.test(payload.sha256)
    ? payload.sha256
    : null;
  if (!filename || !mimeType || !sha256) return null;
  const ownershipContinuityRaw = obj.ownershipContinuity;
  const ownershipContinuity = typeof ownershipContinuityRaw === "undefined"
    ? undefined
    : coerceReceizNativeOwnershipContinuity(ownershipContinuityRaw);
  if (typeof ownershipContinuityRaw !== "undefined" && !ownershipContinuity) return null;
  const proofPredecessorRaw = obj.proofPredecessor;
  const proofPredecessor = typeof proofPredecessorRaw === "undefined"
    ? undefined
    : coerceReceizNativeProofPredecessor(proofPredecessorRaw);
  if (typeof proofPredecessorRaw !== "undefined" && !proofPredecessor) return null;
  return {
    schema: "receiz.native_record_seal.v1",
    ownerReceizId,
    recordId,
    payload: { filename, mimeType, sha256 },
    ...(ownershipContinuity ? { ownershipContinuity } : {}),
    ...(proofPredecessor ? { proofPredecessor } : {}),
  };
}

export function coerceReceizNativeProofPredecessor(value: unknown): ReceizNativeProofPredecessor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const headReference = asNonEmptyString(obj.headReference);
  const artifactSha256 = asHex64(obj.artifactSha256);
  if (!headReference || !artifactSha256) return null;
  return { headReference, artifactSha256 };
}

export function coerceReceizNativeOwnershipContinuity(
  value: unknown,
): ReceizNativeOwnershipContinuity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (obj.schema !== "receiz.native_ownership_continuity.v1") return null;
  const artifactId = asHex64(obj.artifactId);
  const namespace = asNonEmptyString(obj.namespace);
  const genesisOwnerReceizId = asNonEmptyString(obj.genesisOwnerReceizId);
  const ownerReceizId = asNonEmptyString(obj.ownerReceizId);
  const headReference = asNonEmptyString(obj.headReference);
  const historyDigestSha256 = asHex64(obj.historyDigestSha256);
  const appendCount = asFiniteInt(obj.appendCount);
  const historyRaw = obj.history;
  const history = typeof historyRaw === "undefined"
    ? undefined
    : Array.isArray(historyRaw)
      ? historyRaw.map(coerceReceizNativeOwnershipHistoryEntry)
      : null;
  const predecessorRaw = obj.predecessor;
  const predecessor = typeof predecessorRaw === "undefined"
    ? undefined
    : coerceReceizNativeOwnershipPredecessor(predecessorRaw);
  if (
    !artifactId
    || !namespace
    || !isReceizOwnerIdentity(genesisOwnerReceizId)
    || !isReceizOwnerIdentity(ownerReceizId)
    || !headReference
    || !historyDigestSha256
    || appendCount === null
    || appendCount < 0
    || (typeof historyRaw !== "undefined" && (!history || history.some((entry) => !entry)))
    || (typeof predecessorRaw !== "undefined" && !predecessor)
    || (appendCount === 0 && predecessor)
  ) return null;
  return {
    schema: "receiz.native_ownership_continuity.v1",
    artifactId,
    namespace,
    genesisOwnerReceizId,
    ownerReceizId,
    headReference,
    historyDigestSha256,
    appendCount,
    ...(history ? { history: history as ReceizNativeOwnershipHistoryEntry[] } : {}),
    ...(predecessor ? { predecessor } : {}),
  };
}

export function coerceReceizNativeOwnershipHistoryEntry(
  value: unknown,
): ReceizNativeOwnershipHistoryEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const index = asFiniteInt(obj.index);
  const headReference = asNonEmptyString(obj.headReference);
  const historyDigestSha256 = asHex64(obj.historyDigestSha256);
  if (obj.schema === "receiz.native_ownership_genesis.v1") {
    const ownerReceizId = asNonEmptyString(obj.ownerReceizId);
    if (index !== 0 || !ownerReceizId || !headReference || !historyDigestSha256) return null;
    return {
      schema: "receiz.native_ownership_genesis.v1",
      index: 0,
      ownerReceizId,
      headReference,
      historyDigestSha256,
    };
  }
  if (obj.schema !== "receiz.native_ownership_transfer.v1") return null;
  const fromOwnerReceizId = asNonEmptyString(obj.fromOwnerReceizId);
  const toOwnerReceizId = asNonEmptyString(obj.toOwnerReceizId);
  const priorHeadReference = asNonEmptyString(obj.priorHeadReference);
  const sourceArtifactSha256 = asHex64(obj.sourceArtifactSha256);
  if (
    index === null
    || index < 1
    || !fromOwnerReceizId
    || !toOwnerReceizId
    || !priorHeadReference
    || !sourceArtifactSha256
    || !headReference
    || !historyDigestSha256
  ) return null;
  return {
    schema: "receiz.native_ownership_transfer.v1",
    index,
    fromOwnerReceizId,
    toOwnerReceizId,
    priorHeadReference,
    sourceArtifactSha256,
    headReference,
    historyDigestSha256,
  };
}

export function coerceReceizNativeOwnershipPredecessor(
  value: unknown,
): ReceizNativeOwnershipPredecessor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const headReference = asNonEmptyString(obj.headReference);
  const artifactSha256 = asHex64(obj.artifactSha256);
  const ownerReceizId = asNonEmptyString(obj.ownerReceizId);
  const historyDigestSha256 = asHex64(obj.historyDigestSha256);
  const appendCount = asFiniteInt(obj.appendCount);
  if (
    !headReference
    || !artifactSha256
    || !ownerReceizId
    || !isReceizOwnerIdentity(ownerReceizId)
    || !historyDigestSha256
    || appendCount === null
    || appendCount < 0
  ) return null;
  return {
    headReference,
    artifactSha256,
    ownerReceizId,
    historyDigestSha256,
    appendCount,
  };
}

export async function createReceizNativeOwnershipGenesis(args: Readonly<{
  artifactId: string;
  namespace: string;
  ownerReceizId: string;
  headReference: string;
}>): Promise<ReceizNativeOwnershipContinuity> {
  const historyDigestSha256 = await sha256Hex(jcsCanonicalize({
    schema: "receiz.ownership.genesis.v1",
    artifactId: args.artifactId,
    namespace: args.namespace,
    ownerReceizId: args.ownerReceizId,
  }));
  return coerceReceizNativeOwnershipContinuity({
    schema: "receiz.native_ownership_continuity.v1",
    artifactId: args.artifactId,
    namespace: args.namespace,
    genesisOwnerReceizId: args.ownerReceizId,
    ownerReceizId: args.ownerReceizId,
    headReference: args.headReference,
    historyDigestSha256,
    appendCount: 0,
    history: [{
      schema: "receiz.native_ownership_genesis.v1",
      index: 0,
      ownerReceizId: args.ownerReceizId,
      headReference: args.headReference,
      historyDigestSha256,
    }],
  }) as ReceizNativeOwnershipContinuity;
}

export async function appendReceizNativeOwnershipContinuity(args: Readonly<{
  predecessor: ReceizNativeOwnershipContinuity;
  predecessorArtifactSha256: string;
  ownerReceizId: string;
  headReference: string;
}>): Promise<ReceizNativeOwnershipContinuity> {
  const predecessor = coerceReceizNativeOwnershipContinuity(args.predecessor);
  const predecessorArtifactSha256 = asHex64(args.predecessorArtifactSha256);
  if (!predecessor || !predecessorArtifactSha256) {
    throw new Error("receiz_native_ownership_predecessor_invalid");
  }
  if (!await verifyReceizNativeOwnershipHistory(predecessor)) {
    throw new Error("receiz_native_ownership_history_invalid");
  }
  const historyDigestSha256 = await sha256Hex(jcsCanonicalize({
    schema: "receiz.ownership.append.v1",
    priorHistoryDigestSha256: predecessor.historyDigestSha256,
    sourceArtifactSha256: predecessorArtifactSha256,
    priorHeadReference: predecessor.headReference,
    fromOwnerReceizId: predecessor.ownerReceizId,
    toOwnerReceizId: args.ownerReceizId,
  }));
  const next = coerceReceizNativeOwnershipContinuity({
    schema: "receiz.native_ownership_continuity.v1",
    artifactId: predecessor.artifactId,
    namespace: predecessor.namespace,
    genesisOwnerReceizId: predecessor.genesisOwnerReceizId,
    ownerReceizId: args.ownerReceizId,
    headReference: args.headReference,
    historyDigestSha256,
    appendCount: predecessor.appendCount + 1,
    history: predecessor.history
      ? [
          ...predecessor.history,
          {
            schema: "receiz.native_ownership_transfer.v1",
            index: predecessor.appendCount + 1,
            fromOwnerReceizId: predecessor.ownerReceizId,
            toOwnerReceizId: args.ownerReceizId,
            priorHeadReference: predecessor.headReference,
            sourceArtifactSha256: predecessorArtifactSha256,
            headReference: args.headReference,
            historyDigestSha256,
          },
        ]
      : undefined,
    predecessor: {
      headReference: predecessor.headReference,
      artifactSha256: predecessorArtifactSha256,
      ownerReceizId: predecessor.ownerReceizId,
      historyDigestSha256: predecessor.historyDigestSha256,
      appendCount: predecessor.appendCount,
    },
  });
  if (!next) throw new Error("receiz_native_ownership_append_invalid");
  return next;
}

export async function verifyReceizNativeOwnershipHistory(
  continuityInput: ReceizNativeOwnershipContinuity,
): Promise<boolean> {
  const continuity = coerceReceizNativeOwnershipContinuity(continuityInput);
  if (!continuity) return false;
  const history = continuity.history;
  // Verified legacy native continuity remains readable. New genesis creation
  // always carries the complete ordered history.
  if (!history) return true;
  if (history.length !== continuity.appendCount + 1) return false;
  const genesis = history[0];
  if (!genesis || genesis.schema !== "receiz.native_ownership_genesis.v1") return false;
  const genesisDigest = await sha256Hex(jcsCanonicalize({
    schema: "receiz.ownership.genesis.v1",
    artifactId: continuity.artifactId,
    namespace: continuity.namespace,
    ownerReceizId: genesis.ownerReceizId,
  }));
  if (
    genesis.index !== 0
    || genesis.ownerReceizId !== continuity.genesisOwnerReceizId
    || genesis.historyDigestSha256 !== genesisDigest
  ) return false;
  let ownerReceizId = genesis.ownerReceizId;
  let headReference = genesis.headReference;
  let historyDigestSha256 = genesis.historyDigestSha256;
  for (let index = 1; index < history.length; index += 1) {
    const entry = history[index];
    if (!entry || entry.schema !== "receiz.native_ownership_transfer.v1") return false;
    if (
      entry.index !== index
      || entry.fromOwnerReceizId !== ownerReceizId
      || entry.priorHeadReference !== headReference
    ) return false;
    const expectedDigest = await sha256Hex(jcsCanonicalize({
      schema: "receiz.ownership.append.v1",
      priorHistoryDigestSha256: historyDigestSha256,
      sourceArtifactSha256: entry.sourceArtifactSha256,
      priorHeadReference: entry.priorHeadReference,
      fromOwnerReceizId: entry.fromOwnerReceizId,
      toOwnerReceizId: entry.toOwnerReceizId,
    }));
    if (entry.historyDigestSha256 !== expectedDigest) return false;
    ownerReceizId = entry.toOwnerReceizId;
    headReference = entry.headReference;
    historyDigestSha256 = entry.historyDigestSha256;
  }
  return ownerReceizId === continuity.ownerReceizId
    && headReference === continuity.headReference
    && historyDigestSha256 === continuity.historyDigestSha256;
}

export async function verifyReceizNativeOwnershipContinuity(args: Readonly<{
  continuity: ReceizNativeOwnershipContinuity;
  ownerReceizId: string;
  headReference: string;
  payloadSha256: string;
}>): Promise<boolean> {
  const continuity = coerceReceizNativeOwnershipContinuity(args.continuity);
  if (
    !continuity
    || continuity.artifactId !== args.payloadSha256
    || continuity.namespace !== `receiz.native-proof:${args.payloadSha256}`
    || continuity.ownerReceizId !== args.ownerReceizId
    || continuity.headReference !== args.headReference
    || !await verifyReceizNativeOwnershipHistory(continuity)
  ) return false;
  if (continuity.appendCount === 0) {
    if (continuity.predecessor) return false;
    const genesisDigest = await sha256Hex(jcsCanonicalize({
      schema: "receiz.ownership.genesis.v1",
      artifactId: continuity.artifactId,
      namespace: continuity.namespace,
      ownerReceizId: continuity.ownerReceizId,
    }));
    return continuity.genesisOwnerReceizId === continuity.ownerReceizId
      && continuity.historyDigestSha256 === genesisDigest;
  }
  const predecessor = continuity.predecessor;
  if (!predecessor || continuity.appendCount !== predecessor.appendCount + 1) return false;
  const appendDigest = await sha256Hex(jcsCanonicalize({
    schema: "receiz.ownership.append.v1",
    priorHistoryDigestSha256: predecessor.historyDigestSha256,
    sourceArtifactSha256: predecessor.artifactSha256,
    priorHeadReference: predecessor.headReference,
    fromOwnerReceizId: predecessor.ownerReceizId,
    toOwnerReceizId: continuity.ownerReceizId,
  }));
  return continuity.historyDigestSha256 === appendDigest;
}

export function stripReceizProofAugmentationChunks(pngBytes: Uint8Array): Uint8Array {
  const withoutProof = stripPngTextChunksByKeyword(pngBytes, RECEIZ_PROOF_BUNDLE_CHUNK_KEY).pngBytes;
  return stripPngTextChunksByKeyword(withoutProof, RECEIZ_OWNERSHIP_PROVENANCE_CHUNK_KEY).pngBytes;
}

export async function computeReceizArtifactSha256Basis(pngBytes: Uint8Array): Promise<string> {
  const stripped = stripReceizProofAugmentationChunks(pngBytes);
  return (await sha256Hex(stripped)).toLowerCase();
}

function asHex8(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(normalized)) return null;
  return normalized;
}

function buildClaimMessageBase(input: {
  ts: string;
  code: string;
  slug: string;
  kaiPulseEternal: string;
  signerKeyId?: string;
  anchorId?: string;
  zkPoseidonHash?: string;
  groth16ProofDigest?: string;
  artifactSha256Basis?: string;
  artifactBasisNormalization?: string;

  // ✅ optional wireproof binders (only appended when present)
  wireproofAnchorId?: string;
  wireproofClaimHashSha256?: string;
}): string {
  const zkPoseidonHash = typeof input.zkPoseidonHash === "string" ? input.zkPoseidonHash.trim() : "";
  const groth16ProofDigest =
    typeof input.groth16ProofDigest === "string" ? input.groth16ProofDigest.trim().toLowerCase() : "";

  const parts = [
    "receiz-claim",
    input.ts,
    input.code,
    input.slug,
    input.kaiPulseEternal,
    input.artifactSha256Basis ?? "",
    zkPoseidonHash,
    groth16ProofDigest,
  ];
  if (input.artifactBasisNormalization) {
    parts.push(input.artifactBasisNormalization);
  }

  if (input.signerKeyId) {
    parts.push(input.signerKeyId);
  }
  if (input.anchorId) {
    parts.push(input.anchorId);
  }

  // Preserve existing claim ids for all non-wireproof receipts.
  if (input.wireproofAnchorId || input.wireproofClaimHashSha256) {
    parts.push(input.wireproofAnchorId ?? "", input.wireproofClaimHashSha256 ?? "");
  }

  return parts.join("|");
}

export async function buildReceizProofBundle(input: BuildReceizProofBundleInput): Promise<ReceizProofBundle> {
  const artifactSha256Basis = asHex64(input.artifactSha256Basis);
  if (!artifactSha256Basis) {
    throw new Error("Invalid artifactSha256Basis");
  }
  const signerKeyId = asSignerKeyId(input.signerKeyId) ?? (await deriveSignerKeyId(input.signingKey));
  if (!signerKeyId) {
    throw new Error("Invalid signing key.");
  }
  const anchorId = asHex8(input.anchorId);

  const claimIdMessageBase = buildClaimMessageBase({
    ts: input.ts,
    code: input.code,
    slug: input.slug,
    kaiPulseEternal: input.kaiPulseEternal,
    signerKeyId,
    anchorId: anchorId ?? undefined,
    artifactSha256Basis,
    artifactBasisNormalization: input.artifactBasis?.normalization,
    zkPoseidonHash: input.zkPoseidonHash,
    groth16ProofDigest: input.groth16ProofDigest,
    wireproofAnchorId: input.wireproof?.anchorId,
    wireproofClaimHashSha256: input.wireproof?.claimHashSha256,
  });
  const seedMessageBase = buildClaimMessageBase({
    ts: input.ts,
    code: input.code,
    slug: input.slug,
    kaiPulseEternal: input.kaiPulseEternal,
    signerKeyId,
    anchorId: anchorId ?? undefined,
    artifactSha256Basis,
    artifactBasisNormalization: input.artifactBasis?.normalization,
    zkPoseidonHash: input.zkPoseidonHash,
    groth16ProofDigest: input.groth16ProofDigest,
    wireproofAnchorId: input.wireproof?.anchorId,
    wireproofClaimHashSha256: input.wireproof?.claimHashSha256,
  });

  const receizClaimId = (await hmacHex(`${claimIdMessageBase}|claim-id`, input.signingKey)).slice(0, 32);
  const sigilClaimSeed = (await hmacHex(`${seedMessageBase}|seed`, input.signingKey)).slice(0, 64);

  const baseBundle: ReceizProofBundle = {
    kind: "receiz.proof_bundle",
    payloadVersion: input.payloadVersion ?? "v2",
    createdAtMs: input.createdAtMs,
    ts: input.ts,
    ...(input.tsDisplay ? { tsDisplay: input.tsDisplay } : {}),
    ...(typeof input.tzMinutesEast === "number" ? { tzMinutesEast: input.tzMinutesEast } : {}),
    code: input.code,
    slug: input.slug,
    verifyPath: input.verifyPath,
    verifyUrl: input.verifyUrl,
    kaiPulseEternal: input.kaiPulseEternal,
    kaiKlok: input.kaiKlok,
    signerKeyId,
    ...(anchorId ? { anchorId } : {}),
    receizClaimId,
    sigilClaimSeed,
    ...(input.zkPoseidonHash ? { zkPoseidonHash: input.zkPoseidonHash } : {}),
    ...(input.groth16Proof ? { groth16Proof: input.groth16Proof } : {}),
    ...(input.groth16ProofDigest ? { groth16ProofDigest: input.groth16ProofDigest } : {}),
    artifactSha256Basis,
    ...(input.artifactBasis ? { artifactBasis: input.artifactBasis } : {}),
    ...(input.wireproof ? { wireproof: input.wireproof } : {}),
  };
  return baseBundle;
}

export function encodeReceizProofBundle(bundle: ReceizProofBundle): string {
  const canonical = jcsCanonicalize(bundle);
  const rawBytes = new TextEncoder().encode(canonical);
  if (rawBytes.byteLength > MAX_BUNDLE_ENCODE_BYTES) {
    throw new Error("Receiz proof bundle too large.");
  }
  const compressed = deflateSync(rawBytes, { level: 9 });
  return `${RECEIZ_PROOF_BUNDLE_CODEC}:${base64UrlEncode(compressed)}`;
}

export function decodeReceizProofBundle(encoded: string): ReceizProofBundle {
  const [codec, payload] = encoded.split(":", 2);
  if (codec !== RECEIZ_PROOF_BUNDLE_CODEC || !payload) {
    const legacyBytes = base64UrlDecode(encoded);
    const parsedLegacy = JSON.parse(new TextDecoder().decode(legacyBytes)) as unknown;
    const legacyBundle = coerceReceizProofBundle(parsedLegacy);
    if (!legacyBundle) throw new Error("Unsupported receiz proof bundle codec.");
    return legacyBundle;
  }
  const compressed = base64UrlDecode(payload);
  const inflated = inflateSync(compressed, { out: new Uint8Array(MAX_BUNDLE_DECODE_BYTES + 1) });
  if (inflated.byteLength > MAX_BUNDLE_DECODE_BYTES) {
    throw new Error("Receiz proof bundle payload too large.");
  }
  const parsed = JSON.parse(new TextDecoder().decode(inflated)) as unknown;
  const bundle = coerceReceizProofBundle(parsed);
  if (!bundle) throw new Error("Invalid receiz proof bundle payload.");
  return bundle;
}

function isPlainProofValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainProofValue);
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isPlainProofValue);
}

function isPlainProofRecord(value: unknown): ReceizNativeCaptureProof | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || !isPlainProofValue(value)) return undefined;
  return value as ReceizNativeCaptureProof;
}

export function coerceReceizProofBundle(value: unknown): ReceizProofBundle | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;

  const kind = asNonEmptyString(obj.kind);
  if (kind !== "receiz.proof_bundle") return null;
  const payloadVersion = asNonEmptyString(obj.payloadVersion);
  if (payloadVersion !== "v2" && payloadVersion !== "v1") return null;

  const createdAtMs = asFiniteInt(obj.createdAtMs);
  const ts = asNonEmptyString(obj.ts);
  const code = asNonEmptyString(obj.code);
  const slug = asNonEmptyString(obj.slug);
  const verifyPath = asNonEmptyString(obj.verifyPath);
  const verifyUrlRaw = obj.verifyUrl;
  const verifyUrl = typeof verifyUrlRaw === "string" ? verifyUrlRaw : "";
  const kaiPulseEternal = asNonEmptyString(obj.kaiPulseEternal);
  const kaiKlok = asNonEmptyString(obj.kaiKlok);
  const signerKeyId = asSignerKeyId(obj.signerKeyId);
  const anchorId = asHex8(obj.anchorId);
  const receizClaimId = asNonEmptyString(obj.receizClaimId);
  const sigilClaimSeed = asNonEmptyString(obj.sigilClaimSeed);
  const zkPoseidonHash = asNonEmptyString(obj.zkPoseidonHash);
  const groth16ProofDigest = asHex64(obj.groth16ProofDigest);
  const artifactSha256Basis = asHex64(obj.artifactSha256Basis);
  const artifactBasisRaw = obj.artifactBasis;
  const artifactBasisNormalization =
    artifactBasisRaw && typeof artifactBasisRaw === "object"
      ? (artifactBasisRaw as Record<string, unknown>).normalization
      : undefined;
  const artifactBasis: ReceizProofBundle["artifactBasis"] =
    artifactBasisRaw
    && typeof artifactBasisRaw === "object"
    && (artifactBasisRaw as Record<string, unknown>).algorithm === "sha256"
    && (
      artifactBasisNormalization === "jpeg-adobe-xmp-app1-v1"
      || artifactBasisNormalization === "jpeg-ios-photos-carrier-v2"
      || artifactBasisNormalization === "jpeg-ios-photos-carrier-v3"
      || artifactBasisNormalization === "jpeg-ios-photos-carrier-v4"
      || artifactBasisNormalization === "jpeg-ios-photos-carrier-v5"
      || artifactBasisNormalization === "jpeg-ios-photos-carrier-v6"
    )
      ? {
          algorithm: "sha256" as const,
          normalization: artifactBasisNormalization,
        }
      : undefined;
  if (typeof artifactBasisRaw !== "undefined" && !artifactBasis) {
    return null;
  }
  const signatureV3Raw = obj.signatureV3;
  const signatureV3 =
    typeof signatureV3Raw === "undefined" ? undefined : coerceReceizBundleSignatureV3(signatureV3Raw);
  if (typeof signatureV3Raw !== "undefined" && !signatureV3) {
    return null;
  }
  const signatureV4Raw = obj.signatureV4;
  const signatureV4 =
    typeof signatureV4Raw === "undefined" ? undefined : coerceReceizBundleSignatureV4(signatureV4Raw);
  if (typeof signatureV4Raw !== "undefined" && !signatureV4) {
    return null;
  }
  const nativeRecordSealRaw = obj.nativeRecordSeal;
  const nativeRecordSeal = typeof nativeRecordSealRaw === "undefined"
    ? undefined
    : coerceReceizNativeRecordSeal(nativeRecordSealRaw);
  if (typeof nativeRecordSealRaw !== "undefined" && !nativeRecordSeal) {
    return null;
  }
  const nativeCapture = isPlainProofRecord(obj.nativeCapture);
  const nativeCaptureSource = isPlainProofRecord(obj.nativeCaptureSource);
  const nativeCaptureClaim = isPlainProofRecord(obj.nativeCaptureClaim);
  const pbiAuthorshipHistory = Array.isArray(obj.pbiAuthorshipHistory)
    ? obj.pbiAuthorshipHistory.map(isPlainProofRecord)
    : undefined;
  if (
    (typeof obj.nativeCapture !== "undefined" && !nativeCapture)
    || (typeof obj.nativeCaptureSource !== "undefined" && !nativeCaptureSource)
    || (typeof obj.nativeCaptureClaim !== "undefined" && !nativeCaptureClaim)
    || (typeof obj.pbiAuthorshipHistory !== "undefined"
      && (!pbiAuthorshipHistory || pbiAuthorshipHistory.some((entry) => !entry)))
  ) {
    return null;
  }
  const groth16ProofRaw = obj.groth16Proof;
  const groth16Proof =
    typeof groth16ProofRaw === "string"
      ? groth16ProofRaw
      : groth16ProofRaw && typeof groth16ProofRaw === "object"
        ? (groth16ProofRaw as Record<string, unknown>)
        : undefined;

  if (
    createdAtMs === null ||
    !ts ||
    !code ||
    !slug ||
    !verifyPath ||
    !kaiPulseEternal ||
    !kaiKlok ||
    !receizClaimId ||
    !sigilClaimSeed
  ) {
    return null;
  }

  const tsDisplayRaw = obj.tsDisplay;
  const tzRaw = obj.tzMinutesEast;

  let wireproof: WireProofAttestation | undefined;
  const wpRaw = obj.wireproof;

  if (wpRaw && typeof wpRaw === "object") {
    const wp = wpRaw as Record<string, unknown>;
    const schema = asNonEmptyString(wp.schema);
    const anchorId = asHex8(wp.anchorId);
    const claimHashSha256 = asHex64(wp.claimHashSha256);
    const verifierPathWp = asNonEmptyString(wp.verifierPath);

    if (schema === "wireproof.v1" && anchorId && claimHashSha256 && verifierPathWp) {
      wireproof = {
        schema: "wireproof.v1",
        anchorId,
        claimHashSha256,
        verifierPath: verifierPathWp,
      };
    }
  }

  return {
    kind: "receiz.proof_bundle",
    payloadVersion,
    createdAtMs,
    ts,
    ...(typeof tsDisplayRaw === "string" && tsDisplayRaw.length > 0 ? { tsDisplay: tsDisplayRaw } : {}),
    ...(typeof tzRaw === "number" && Number.isFinite(tzRaw) ? { tzMinutesEast: Math.trunc(tzRaw) } : {}),
    code,
    slug,
    verifyPath,
    verifyUrl,
    kaiPulseEternal,
    kaiKlok,
    ...(signerKeyId ? { signerKeyId } : {}),
    ...(anchorId ? { anchorId } : {}),
    receizClaimId,
    sigilClaimSeed,
    ...(zkPoseidonHash ? { zkPoseidonHash } : {}),
    ...(groth16Proof ? { groth16Proof } : {}),
    ...(groth16ProofDigest ? { groth16ProofDigest } : {}),
    ...(artifactSha256Basis ? { artifactSha256Basis } : {}),
    ...(artifactBasis ? { artifactBasis } : {}),
    ...(signatureV3 ? { signatureV3 } : {}),
    ...(signatureV4 ? { signatureV4 } : {}),
    ...(nativeRecordSeal ? { nativeRecordSeal } : {}),
    ...(nativeCapture ? { nativeCapture } : {}),
    ...(nativeCaptureSource ? { nativeCaptureSource } : {}),
    ...(nativeCaptureClaim ? { nativeCaptureClaim } : {}),
    ...(pbiAuthorshipHistory ? { pbiAuthorshipHistory: pbiAuthorshipHistory as ReceizNativeCaptureProof[] } : {}),
    ...(wireproof ? { wireproof } : {}),
  };
}

export async function validateReceizBundleSignature(args: {
  bundle: ReceizProofBundle;
  signingKey: string;
}): Promise<boolean> {
  const expectedSignerKeyId = await deriveSignerKeyId(args.signingKey);
  const bundleSignerKeyId = asSignerKeyId(args.bundle.signerKeyId);
  const bundleAnchorId = asHex8(args.bundle.anchorId);
  if (args.bundle.signerKeyId && !bundleSignerKeyId) {
    return false;
  }
  if (bundleSignerKeyId && bundleSignerKeyId !== expectedSignerKeyId) {
    return false;
  }
  if (args.bundle.anchorId && !bundleAnchorId) {
    return false;
  }
  if (bundleAnchorId && !bundleSignerKeyId) {
    return false;
  }

  if (bundleSignerKeyId) {
    const claimIdMessageBaseV2 = buildClaimMessageBase({
      ts: args.bundle.ts,
      code: args.bundle.code,
      slug: args.bundle.slug,
      kaiPulseEternal: args.bundle.kaiPulseEternal,
      signerKeyId: expectedSignerKeyId,
      anchorId: bundleAnchorId ?? undefined,
      artifactSha256Basis: args.bundle.artifactSha256Basis,
      zkPoseidonHash: args.bundle.zkPoseidonHash,
      groth16ProofDigest: args.bundle.groth16ProofDigest,
      wireproofAnchorId: args.bundle.wireproof?.anchorId,
      wireproofClaimHashSha256: args.bundle.wireproof?.claimHashSha256,
    });

    const expectedClaimIdV2 = (await hmacHex(`${claimIdMessageBaseV2}|claim-id`, args.signingKey)).slice(0, 32);

    const seedMessageBaseV2 = buildClaimMessageBase({
      ts: args.bundle.ts,
      code: args.bundle.code,
      slug: args.bundle.slug,
      kaiPulseEternal: args.bundle.kaiPulseEternal,
      signerKeyId: expectedSignerKeyId,
      anchorId: bundleAnchorId ?? undefined,
      artifactSha256Basis: args.bundle.artifactSha256Basis,
      zkPoseidonHash: args.bundle.zkPoseidonHash,
      groth16ProofDigest: args.bundle.groth16ProofDigest,
      wireproofAnchorId: args.bundle.wireproof?.anchorId,
      wireproofClaimHashSha256: args.bundle.wireproof?.claimHashSha256,
    });
    const expectedSeedV2 = (await hmacHex(`${seedMessageBaseV2}|seed`, args.signingKey)).slice(0, 64);
    return expectedClaimIdV2 === args.bundle.receizClaimId && expectedSeedV2 === args.bundle.sigilClaimSeed;
  }

  const claimIdMessageBaseV1 = buildClaimMessageBase({
    ts: args.bundle.ts,
    code: args.bundle.code,
    slug: args.bundle.slug,
    kaiPulseEternal: args.bundle.kaiPulseEternal,
    artifactSha256Basis: args.bundle.artifactSha256Basis,
    zkPoseidonHash: args.bundle.zkPoseidonHash,
    groth16ProofDigest: args.bundle.groth16ProofDigest,
    wireproofAnchorId: args.bundle.wireproof?.anchorId,
    wireproofClaimHashSha256: args.bundle.wireproof?.claimHashSha256,
  });

  const expectedClaimIdV1 = (await hmacHex(`${claimIdMessageBaseV1}|claim-id`, args.signingKey)).slice(0, 32);

  // v1 (legacy): seed binds artifactSha256Basis but not signerKeyId.
  const seedMessageBaseV1 = buildClaimMessageBase({
    ts: args.bundle.ts,
    code: args.bundle.code,
    slug: args.bundle.slug,
    kaiPulseEternal: args.bundle.kaiPulseEternal,
    artifactSha256Basis: args.bundle.artifactSha256Basis,
    zkPoseidonHash: args.bundle.zkPoseidonHash,
    groth16ProofDigest: args.bundle.groth16ProofDigest,
    wireproofAnchorId: args.bundle.wireproof?.anchorId,
    wireproofClaimHashSha256: args.bundle.wireproof?.claimHashSha256,
  });
  const expectedSeedV1 = (await hmacHex(`${seedMessageBaseV1}|seed`, args.signingKey)).slice(0, 64);

  if (expectedClaimIdV1 === args.bundle.receizClaimId && expectedSeedV1 === args.bundle.sigilClaimSeed) {
    return true;
  }

  // v0 (legacy): seed did not bind artifactSha256Basis.
  const seedMessageBaseV0 = buildClaimMessageBase({
    ts: args.bundle.ts,
    code: args.bundle.code,
    slug: args.bundle.slug,
    kaiPulseEternal: args.bundle.kaiPulseEternal,
    zkPoseidonHash: args.bundle.zkPoseidonHash,
    groth16ProofDigest: args.bundle.groth16ProofDigest,
    wireproofAnchorId: args.bundle.wireproof?.anchorId,
    wireproofClaimHashSha256: args.bundle.wireproof?.claimHashSha256,
  });
  const expectedSeedV0 = (await hmacHex(`${seedMessageBaseV0}|seed`, args.signingKey)).slice(0, 64);
  if (expectedClaimIdV1 === args.bundle.receizClaimId && expectedSeedV0 === args.bundle.sigilClaimSeed) {
    return true;
  }

  return false;
}
