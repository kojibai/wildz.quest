import {
  appendReceizPortableAssetOwnership, createReceizClient, deriveReceizPortableOwnershipContinuity,
  parseReceizPortableAssetDocument, receizBase64UrlDecode, receizBase64UrlEncode,
  serializeReceizPortableAssetDocument,
  type ReceizClient, type ReceizOpenedArtifact, type ReceizPortableAssetDocument, type ReceizPortableSealedArtifactV124,
} from "@receiz/sdk";
import { sha256WildzArtifactBytes } from "../../../lib/receiz/wildz-artifact-custody";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "../portable-card";
import { isVerifiedWildzCardDescendant } from "../../../lib/receiz/wildz-card-descendant";
import type { WildsWalletStagedTradeLeg, WildsWalletStagedTradeNativeSourceHead } from "./wilds-wallet-staged-trade-types";

export type WildsWalletBearerGiftLeg = Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>;
export type WildsWalletBearerOpenPort = Pick<ReceizClient["artifacts"], "verifyAndOpen">;
export type WildsWalletBearerSelectionVerifier = (leg: WildsWalletBearerGiftLeg, document: ReceizPortableAssetDocument, opened: ReceizOpenedArtifact) => Promise<void>;
export const WILDS_WALLET_BEARER_MAX_ORIGINAL_BYTES = 1_000_000;
const SHA = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const same = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
const fail = (reason: string): never => { throw Error(`The exact native bearer ${reason}.`); };

/** A byte carrier conveys no authority. Only a pinned SDK open admits it. */
export function admitWildsWalletBearerOriginal(value: unknown): ReceizPortableSealedArtifactV124 {
  if (!record(value) || Object.keys(value).sort().join(",") !== "artifactSha256,exactBytesB64u,filename,mimeType,payloadSha256,schema"
    || value.schema !== "receiz.sealed-artifact-bytes.v124" || typeof value.artifactSha256 !== "string" || !SHA.test(value.artifactSha256)
    || typeof value.payloadSha256 !== "string" || !SHA.test(value.payloadSha256) || typeof value.exactBytesB64u !== "string"
    || !/^[A-Za-z0-9_-]+$/.test(value.exactBytesB64u) || value.exactBytesB64u.length > Math.ceil(WILDS_WALLET_BEARER_MAX_ORIGINAL_BYTES * 4 / 3)
    || typeof value.filename !== "string" || !value.filename || value.filename.length > 256 || /[\r\n\0]/.test(value.filename)
    || typeof value.mimeType !== "string" || !value.mimeType || value.mimeType.length > 128 || /[\r\n\0]/.test(value.mimeType)) throw Error("The exact native bearer Original must be bounded and complete.");
  const bytes = receizBase64UrlDecode(value.exactBytesB64u);
  if (!bytes.length || bytes.length > WILDS_WALLET_BEARER_MAX_ORIGINAL_BYTES || receizBase64UrlEncode(bytes) !== value.exactBytesB64u) fail("Original must be bounded and complete");
  return Object.freeze({ ...value }) as ReceizPortableSealedArtifactV124;
}

const pinnedArtifacts = () => createReceizClient({ fetchImpl: async () => { throw Error("Native bearer proof verification cannot obtain authority from the network."); } }).artifacts;

export async function openWildsWalletBearerOriginal(value: unknown, artifacts: WildsWalletBearerOpenPort = pinnedArtifacts()) {
  const { original, opened } = await openWildsWalletNativeOriginal(value, artifacts);
  const sealed = opened.sealedArtifact;
  let valueDocument: unknown;
  try { valueDocument = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(opened.verifiedPayload.bytes)); } catch { return fail("Original does not carry a portable asset"); }
  const document = await parseReceizPortableAssetDocument(valueDocument);
  const canonicalBytes = serializeReceizPortableAssetDocument(document);
  if (canonicalBytes.length !== opened.verifiedPayload.bytes.length || canonicalBytes.some((byte, index) => byte !== opened.verifiedPayload.bytes[index])) fail("Original portable payload is not canonical");
  const derived = await deriveReceizPortableOwnershipContinuity(document);
  const native = sealed.verification.bundle.nativeRecordSeal;
  const signed = record(native) ? native.ownershipContinuity : undefined;
  const carried = sealed.verification.assetContinuity;
  if (!record(signed) || signed.schema !== "receiz.native_ownership_continuity.v1" || !record(carried)
    || carried.state !== "verified" || carried.carrier !== "portable_asset" || carried.historyComplete !== true
    || typeof signed.headReference !== "string" || !signed.headReference || signed.headReference !== sealed.continuity.claimId
    || sealed.continuity.ownerReceizId !== derived.ownerReceizId || document.ownership.custody !== "bearer"
    || !same(Object.fromEntries(Object.keys(derived).map(key => [key, signed[key]])), derived)
    || !same(Object.fromEntries(Object.keys(derived).map(key => [key, carried[key]])), derived)
    || carried.headReference !== signed.headReference) throw Error("The exact native bearer Original lacks signed complete ownership continuity.");
  const kai = sealed.verification.bundle.kaiPulseEternal;
  if (typeof kai !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(kai)) throw Error("The exact native bearer Original lacks witnessed Kai.");
  return { original, opened, document, derived, headReference: signed.headReference, acceptedKai: kai };
}

export async function openWildsWalletNativeOriginal(value: unknown, artifacts: WildsWalletBearerOpenPort = pinnedArtifacts()) {
  const original = admitWildsWalletBearerOriginal(value), bytes = receizBase64UrlDecode(original.exactBytesB64u);
  if (await sha256WildzArtifactBytes(bytes) !== original.artifactSha256) fail("Original bytes do not match their digest");
  const opened = await artifacts.verifyAndOpen(new File([bytes.slice().buffer], original.filename, { type: original.mimeType }));
  const sealed = opened.sealedArtifact;
  if (opened.legacyCompatibility !== "current-native" || sealed.kind !== "receiz.native-record-seal" || sealed.continuity.signatureVersion !== 4
    || sealed.artifactSha256 !== original.artifactSha256 || sealed.payloadSha256 !== original.payloadSha256
    || opened.verifiedPayload.sha256 !== original.payloadSha256 || await sha256WildzArtifactBytes(opened.verifiedPayload.bytes) !== original.payloadSha256) fail("Original verification failed");
  return { original, opened };
}

export type WildsWalletCreatureProjectionV128 = Readonly<{ schema: "wildz.creature-projection.v128"; sourceArtifactSha256: string; sourceHeadReference: string; card: PortableCardAsset }>;
export async function readWildsWalletCreatureProjectionV128(input: Readonly<{ source: Awaited<ReturnType<typeof openWildsWalletBearerOriginal>>; projectionOriginal: unknown; accepted?: boolean; artifacts?: WildsWalletBearerOpenPort }>) {
  const projection = await openWildsWalletNativeOriginal(input.projectionOriginal, input.artifacts);
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(projection.opened.verifiedPayload.bytes)) as WildsWalletCreatureProjectionV128;
  const immutable = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(receizBase64UrlDecode(input.source.document.payload.bytesBase64Url))) as { schema: string; card: PortableCardAsset };
  if (!payload || Object.keys(payload).sort().join(",") !== "card,schema,sourceArtifactSha256,sourceHeadReference" || payload.schema !== "wildz.creature-projection.v128"
    || !verifyAnyWildsCard(payload.card).ok || immutable.schema !== "wildz.creature-bearer.v128" || !verifyAnyWildsCard(immutable.card).ok
    || !(same(immutable.card, payload.card) || isVerifiedWildzCardDescendant(immutable.card, payload.card))
    || !same(payload, JSON.parse(new TextDecoder().decode(projection.opened.verifiedPayload.bytes)))
    || await sha256WildzArtifactBytes(new TextEncoder().encode(canonicalPortableCardJson(payload))) !== projection.original.payloadSha256) fail("projection does not preserve exact causal creature history");
  const last = input.source.document.provenance.appends.at(-1);
  const owner = projection.opened.sealedArtifact.continuity.ownerReceizId;
  const current = owner === input.source.derived.ownerReceizId && payload.sourceArtifactSha256 === input.source.original.artifactSha256 && payload.sourceHeadReference === input.source.headReference;
  const prior = input.accepted && record(last) && owner === last.fromOwnerReceizId && payload.sourceArtifactSha256 === last.sourceArtifactSha256 && payload.sourceHeadReference === last.priorHeadReference;
  if (!current && !prior) fail("projection belongs to another keeper or exact native source");
  return { ...projection, card: payload.card, projectionCardDigest: await sha256WildzArtifactBytes(new TextEncoder().encode(canonicalPortableCardJson(payload.card))) };
}

function descriptor(legId: string, source: Awaited<ReturnType<typeof openWildsWalletBearerOriginal>>, projection: Awaited<ReturnType<typeof readWildsWalletCreatureProjectionV128>>): WildsWalletStagedTradeNativeSourceHead {
  return Object.freeze({ legId, sourceArtifactSha256: source.original.artifactSha256, sourcePayloadSha256: source.original.payloadSha256,
    artifactId: source.derived.artifactId, namespace: source.derived.namespace, headReference: source.headReference,
    historyDigestSha256: source.derived.historyDigestSha256, appendCount: source.derived.appendCount, ownerHandle: source.derived.ownerReceizId,
    projectionArtifactSha256: projection.original.artifactSha256, projectionPayloadSha256: projection.original.payloadSha256, projectionCardDigest: projection.projectionCardDigest });
}

export async function verifyWildsWalletBearerGiftSource(input: Readonly<{ leg: WildsWalletBearerGiftLeg; original: unknown; projectionOriginal: unknown; assertSelection: WildsWalletBearerSelectionVerifier; artifacts?: WildsWalletBearerOpenPort }>) {
  const source = await openWildsWalletBearerOriginal(input.original, input.artifacts);
  if (source.derived.ownerReceizId !== input.leg.senderHandle || input.leg.request.recipientHandle !== input.leg.recipientHandle
    || input.leg.request.attemptId !== input.leg.attemptId || input.leg.attemptId !== input.leg.legId) fail("source belongs to another owner or stage");
  await input.assertSelection(input.leg, source.document, source.opened);
  const projection = await readWildsWalletCreatureProjectionV128({ source, projectionOriginal: input.projectionOriginal, artifacts: input.artifacts });
  return { ...source, projection, descriptor: descriptor(input.leg.legId, source, projection) };
}

/** Re-derive the entire legal append from the approved predecessor. No receipt
 * JSON, timestamp, current wallet projection, or copied keeper field is authority. */
export async function verifyWildsWalletBearerGiftAccepted(input: Readonly<{ leg: WildsWalletBearerGiftLeg; descriptor: WildsWalletStagedTradeNativeSourceHead; predecessor: unknown; successor: unknown; projectionOriginal: unknown; acceptedNotBeforeKai: string; artifacts?: WildsWalletBearerOpenPort }>) {
  const source = await openWildsWalletBearerOriginal(input.predecessor, input.artifacts);
  const projection = await readWildsWalletCreatureProjectionV128({ source, projectionOriginal: input.projectionOriginal, artifacts: input.artifacts });
  if (source.derived.ownerReceizId !== input.leg.senderHandle || !same(descriptor(input.leg.legId, source, projection), input.descriptor)) fail("source descriptor changed after approval");
  const accepted = await openWildsWalletBearerOriginal(input.successor, input.artifacts);
  const expected = await appendReceizPortableAssetOwnership(source.document, { ownerReceizId: input.leg.recipientHandle, priorHeadReference: source.headReference, sourceArtifactSha256: source.original.artifactSha256 });
  if (!same(expected, accepted.document) || accepted.headReference === source.headReference || accepted.derived.ownerReceizId !== input.leg.recipientHandle
    || accepted.derived.artifactId !== source.derived.artifactId || accepted.derived.namespace !== source.derived.namespace
    || accepted.derived.genesisOwnerReceizId !== source.derived.genesisOwnerReceizId || accepted.derived.appendCount !== source.derived.appendCount + 1) fail("successor does not preserve the exact approved ownership append");
  if (!/^(?:0|[1-9][0-9]*)$/.test(input.acceptedNotBeforeKai) || BigInt(accepted.acceptedKai) <= BigInt(input.acceptedNotBeforeKai)) fail("successor predates the exact approvals");
  return { ...accepted, projection, descriptor: descriptor(input.leg.legId, accepted, projection), ownerHandle: accepted.derived.ownerReceizId };
}
