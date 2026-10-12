import {
  canonicalizeReceizV122, createReceizAppStateFeed, createReceizArtifactAdmissionEngine,
  createReceizPublicStoreStateRecord, RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA,
  receizBase64UrlDecode, receizBase64UrlEncode, sha256ReceizBytes, verifyReceizArtifact,
  type JsonObject, type ReceizClient, type ReceizPortableSealedArtifactV124, type ReceizPublicStoreSignedPublish
} from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis, verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import type { WildsWalletCreatureProjectionV128 } from "../../features/play/wallet/wilds-wallet-bearer-gift-proof";
import { isVerifiedWildzCardDescendant } from "./wildz-card-descendant";
import type { WildzMarketValueSourceV129 } from "../../features/market/wildz-market-value-v129";
import { WILDZ_PRODUCT } from "../wildz/product";

export const WILDZ_MARKET_VALUE_NAMESPACE_V129 = "wildz.market-values.v129";
export const WILDZ_MARKET_VALUE_RECORD_MAX_BYTES_V129 = 512 * 1024;
export type WildzMarketPublicValueRecordV129 = Readonly<{
  schema: "wildz.market-public-value-source.v129";
  assetId: string;
  applicationId: string;
  publisherHandle: string;
  /** Immutable first public proof issuance. Never a private capture/Vault root. */
  root: ReceizPortableSealedArtifactV124;
  /** Separate public certificate of the independently qualified native card.
   * Carries only the projection; private native Original bytes are excluded. */
  projectionOriginal: ReceizPortableSealedArtifactV124;
}>;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const same = (a: unknown, b: unknown) => canonicalizeReceizV122(a) === canonicalizeReceizV122(b);
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function fail(reason: string): never { throw Error(`wildz_market_value_${reason}`); }
export function wildzMarketPublicValueUrlV129(assetId: string) {
  if (!/^wilds:[a-f0-9]{24}$/.test(assetId)) fail("asset_invalid");
  return `${WILDZ_PRODUCT.origin}/receiz/market-value-v129/${assetId.slice(6)}`;
}
export function wildzMarketPublicValueRecordV129(value: unknown): WildzMarketPublicValueRecordV129 {
  if (!object(value) || Object.keys(value).sort().join() !== "applicationId,assetId,projectionOriginal,publisherHandle,root,schema"
    || value.schema !== "wildz.market-public-value-source.v129" || typeof value.applicationId !== "string" || !value.applicationId
    || typeof value.assetId !== "string" || typeof value.publisherHandle !== "string"
    || !/^[a-z0-9][a-z0-9._-]{0,63}\.receiz\.id$/.test(value.publisherHandle)) fail("record_invalid");
  wildzMarketPublicValueUrlV129(value.assetId);
  assertWildzMarketPublicValueTransportV129(value.root);
  assertWildzMarketPublicValueTransportV129(value.projectionOriginal);
  if (new TextEncoder().encode(canonicalizeReceizV122(value)).length > WILDZ_MARKET_VALUE_RECORD_MAX_BYTES_V129) fail("record_invalid");
  return value as WildzMarketPublicValueRecordV129;
}
export function assertWildzMarketPublicValueTransportV129(root: unknown): asserts root is ReceizPortableSealedArtifactV124 {
  if (!object(root) || Object.keys(root).sort().join() !== "artifactSha256,exactBytesB64u,filename,mimeType,payloadSha256,schema"
    || root.schema !== "receiz.sealed-artifact-bytes.v124" || !sha(root.artifactSha256) || !sha(root.payloadSha256)
    || typeof root.exactBytesB64u !== "string" || !/^[A-Za-z0-9_-]+$/.test(root.exactBytesB64u)
    || typeof root.filename !== "string" || !root.filename || root.filename.length > 240
    || typeof root.mimeType !== "string" || !root.mimeType || root.mimeType.length > 120
    || root.exactBytesB64u.length > WILDZ_MARKET_VALUE_RECORD_MAX_BYTES_V129) fail("record_invalid");
}

async function openPublicValueJsonArtifactV129(root: ReceizPortableSealedArtifactV124) {
  assertWildzMarketPublicValueTransportV129(root);
  const bytes = receizBase64UrlDecode(root.exactBytesB64u);
  if (receizBase64UrlEncode(bytes) !== root.exactBytesB64u || await sha256ReceizBytes(bytes) !== root.artifactSha256)
    fail("artifact_digest_mismatch");
  let envelope: unknown;
  try { envelope = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { fail("public_json_required"); }
  assertWildzMarketPublicValuePrivacyV129(envelope);
  const verification = await verifyReceizArtifact(new File([bytes.slice().buffer], root.filename, { type: root.mimeType }));
  if (verification.status !== "verified-artifact" || verification.artifactDigest.value !== root.artifactSha256
    || verification.payloadDigest.value !== root.payloadSha256) fail("artifact_not_verified");
  const admission = await createReceizArtifactAdmissionEngine()(verification, { profile: "document" });
  if (admission.profile !== "document" || admission.verdict !== "verified-document") fail("artifact_not_admitted");
  if (!object(envelope) || envelope.kind !== "receiz.bundle.v1" || typeof envelope.originalBase64 !== "string") fail("public_json_required");
  const payload = receizBase64UrlDecode(envelope.originalBase64);
  if (receizBase64UrlEncode(payload) !== envelope.originalBase64 || await sha256ReceizBytes(payload) !== verification.payloadDigest.value)
    fail("payload_binding_invalid");
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload)); }
  catch { fail("public_json_required"); }
  assertWildzMarketPublicValuePrivacyV129(value);
  return { value, bytes, verification, admission };
}

/** Parsing is subordinate to enclosing SDK verification; this public payload
 * contains no private Original, key, player archive or caller valuation data. */
export function parseWildzMarketPublicValueProjectionPayloadV129(value: unknown): WildsWalletCreatureProjectionV128 {
  if (!object(value) || Object.keys(value).sort().join() !== "card,schema,sourceArtifactSha256,sourceHeadReference"
    || value.schema !== "wildz.creature-projection.v128" || !sha(value.sourceArtifactSha256)
    || typeof value.sourceHeadReference !== "string" || !value.sourceHeadReference || value.sourceHeadReference.length > 256)
    fail("projection_invalid");
  assertWildzMarketPublicValueCardV129(value.card);
  return value as WildsWalletCreatureProjectionV128;
}

/** Existing six-field native selection digest law, unchanged. Call only after
 * admission of the projectionOriginal that binds these exact public operands. */
export function wildzMarketValueProjectionSourceDigestV129(projectionArtifactSha256: string, projection: WildsWalletCreatureProjectionV128): string {
  if (!sha(projectionArtifactSha256)) fail("projection_invalid");
  return sha256PortableBasis(canonicalPortableCardJson({ schema: "wildz.market.creature-selection.v128",
    original: projection.sourceArtifactSha256, projection: projectionArtifactSha256, head: projection.sourceHeadReference,
    asset: { kind: "creature", assetId: projection.card.id } })).slice(7);
}

export async function verifyWildzMarketPublicValueProjectionV129(projectionOriginal: ReceizPortableSealedArtifactV124, publisherHandle: string, assetId: string) {
  const opened = await openPublicValueJsonArtifactV129(projectionOriginal);
  if (opened.admission.ownerReceizId !== publisherHandle || opened.verification.continuity.state !== "verified"
    || opened.verification.continuity.ownerReceizId !== publisherHandle) fail("projection_owner_invalid");
  const projection = parseWildzMarketPublicValueProjectionPayloadV129(opened.value);
  if (projection.card.id !== assetId) fail("card_binding_invalid");
  return { projection, card: projection.card, projectionOriginal, sourceDigest: wildzMarketValueProjectionSourceDigestV129(projectionOriginal.artifactSha256, projection),
    verification: opened.verification };
}

export function wildzMarketValueSameProofCardV129(left: PortableCardAsset, right: PortableCardAsset): boolean {
  return left.id === right.id && same(left.proof, right.proof) && same(left.manifest, right.manifest);
}

/** Both complete public artifacts are admitted before domain matching. The
 * bare root supplies new public issuance; its certificate joins native source. */
export async function verifyWildzMarketPublicValueRootV129(value: unknown) {
  const record = wildzMarketPublicValueRecordV129(value);
  const opened = await openPublicValueJsonArtifactV129(record.root);
  const card = opened.value;
  assertWildzMarketPublicValueCardV129(card);
  if (card.id !== record.assetId) fail("card_binding_invalid");
  const certificate = await verifyWildzMarketPublicValueProjectionV129(record.projectionOriginal, record.publisherHandle, record.assetId);
  if (!wildzMarketValueSameProofCardV129(card, certificate.card)) fail("projection_card_binding_invalid");
  const originKaiPulse = opened.verification.verification.bundle.kaiPulseEternal;
  if (typeof originKaiPulse !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(originKaiPulse)) fail("origin_not_carried");
  const historyHead = opened.verification.continuity.state === "verified" ? opened.verification.continuity.headReference ?? null : null;
  return { record, card, bytes: opened.bytes, verification: opened.verification, certificate, historyHead, originKaiPulse };
}

/** Full JSON envelope and payload privacy boundary. Unknown namespace and
 * metadata objects, including carried JSON strings, are examined unchanged.
 * A private source is refused wholesale; no stronger bytes can be redacted. */
export function assertWildzMarketPublicValuePrivacyV129(value: unknown): void {
  const pending = [value];
  let count = 0;
  while (pending.length) {
    if (++count > 20_000) fail("card_too_large");
    const next = pending.pop();
    if (Array.isArray(next)) { pending.push(...next); continue; }
    if (typeof next === "string" && /^[\s]*[\[{]/.test(next)) {
      try { pending.push(JSON.parse(next)); } catch { /* Public text, not carried JSON. */ }
      continue;
    }
    if (!object(next)) continue;
    if (["privateKeyPkcs8CiphertextB64u", "privateKeyPkcs8B64u", "privateKeyPkcs8", "accessToken", "refreshToken", "clientSecret", "sourceOriginal", "player", "playState", "access_token", "refresh_token", "client_secret", "bearerToken"]
      .some(key => key in next) || /^receiz\.(identity|key|conversation|chat|account|profile-showcase|economy-showcase)([.-]|$)/.test(String(next.schema ?? ""))) fail("private_source_forbidden");
    pending.push(...Object.values(next));
  }
}

/** Privacy check is intentionally before Record -> Seal/public signing. */
export function assertWildzMarketPublicValueCardV129(value: unknown): asserts value is PortableCardAsset {
  assertWildzMarketPublicValuePrivacyV129(value);
  try { if (!object(value) || !verifyAnyWildsCard(value as PortableCardAsset).ok) fail("public_card_required"); }
  catch { fail("public_card_required"); }
}

export function assertWildzMarketValueDescendantV129(root: PortableCardAsset, selected: PortableCardAsset) {
  assertWildzMarketPublicValueCardV129(selected);
  const sameProof = root.proof.digest === selected.proof.digest && same(root.manifest, selected.manifest);
  if (root.id !== selected.id || !(sameProof || isVerifiedWildzCardDescendant(root, selected))) fail("card_binding_invalid");
}

export function wildzMarketValuePublicationInputV129(record: WildzMarketPublicValueRecordV129) {
  return { tenantHost: WILDZ_PRODUCT.domain, merchantReceizId: record.publisherHandle,
    sourceUrl: wildzMarketPublicValueUrlV129(record.assetId), namespace: WILDZ_MARKET_VALUE_NAMESPACE_V129,
    title: "Wildz public creature proof issuance", platform: WILDZ_PRODUCT.name, projectionState: "published" as const,
    storeStateRecord: record as unknown as JsonObject };
}
export function parseSignedWildzMarketValuePublicationV129(value: unknown) {
  assertWildzMarketPublicValuePrivacyV129(value);
  if (!object(value)) fail("signed_publication_invalid");
  const signed = value as ReceizPublicStoreSignedPublish<JsonObject>;
  const record = wildzMarketPublicValueRecordV129(signed.storeStateRecord), input = wildzMarketValuePublicationInputV129(record);
  const feed = createReceizAppStateFeed([createReceizPublicStoreStateRecord({
    sourceUrl: input.sourceUrl, externalCreatorId: input.merchantReceizId, title: input.title,
    namespace: input.namespace, state: "published", platform: input.platform, record: input.storeStateRecord,
    data: { storeStateRecord: input.storeStateRecord, tenantHost: input.tenantHost, merchantReceizId: input.merchantReceizId }
  })], { schema: RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA, namespace: input.namespace, externalCreatorId: input.merchantReceizId });
  if (signed.schema !== "receiz.public_store.signed_publish.v1" || signed.tenantHost !== input.tenantHost
    || signed.merchantReceizId !== input.merchantReceizId || !same(signed.feed, feed)) fail("signed_publication_invalid");
  return { record, signed };
}

export async function readWildzMarketPublicValueRecordV129(sdk: ReceizClient, assetId: string) {
  const url = wildzMarketPublicValueUrlV129(assetId);
  const result = await sdk.publicStore.restoreLatest({ url, tenantHost: WILDZ_PRODUCT.domain });
  if (!result.storeStateRecord) return null;
  const record = wildzMarketPublicValueRecordV129(result.storeStateRecord);
  if (record.assetId !== assetId || result.record?.sourceUrl !== url || result.record.externalCreatorId !== record.publisherHandle)
    fail("locator_binding_invalid");
  await verifyWildzMarketPublicValueRootV129(record);
  return record;
}

export async function readWildzMarketPublicValueSourceV129(assetId: string, selected: PortableCardAsset, fetcher: typeof fetch = fetch): Promise<WildzMarketValueSourceV129 | null> {
  const response = await fetcher(`/api/wilds/market/value/${encodeURIComponent(assetId)}`, { method: "GET", credentials: "omit", cache: "no-store", redirect: "error" });
  if (response.status === 404) return null;
  if (!response.ok) fail("public_read_unavailable");
  const value = await response.json() as { ok?: boolean; record?: unknown };
  if (value.ok !== true) fail("public_read_unavailable");
  const root = await verifyWildzMarketPublicValueRootV129(value.record);
  if (root.record.assetId !== assetId) fail("card_binding_invalid");
  assertWildzMarketValueDescendantV129(root.card, selected);
  return { assetId, cardProofDigest: selected.proof.digest, selectedCard: selected,
    artifactBytes: root.bytes, proofArtifactDigest: root.record.root.artifactSha256,
    originProofArtifactDigest: root.record.root.artifactSha256, historyHead: root.historyHead,
    filename: root.record.root.filename, mimeType: root.record.root.mimeType, portableHistory: false };
}
