import {
  canonicalizeReceizV122, createReceizArtifactAdmissionEngine, digestReceizCanonicalV122,
  parseReceizPortableAssetDocument, receizBase64UrlDecode, receizBase64UrlEncode,
  sha256ReceizBytes, verifyReceizArtifact,
  type ReceizArtifactVerificationResult
} from "@receiz/sdk";
import {
  exportReceizProofValueReplayV129, projectReceizProofValueV129, sampleReceizProofValueV129,
  SIGIL_VALUATION_ALGORITHM, SIGIL_VALUATION_POLICY_CHECKSUM, verifyReceizProofValueReplayV129,
  type ReceizProofValueSourceV129, type ReceizProofValueUsdBasisV129, type ReceizRarityPolicyV129
} from "@receiz/sdk/valuation";
import { verifyAnyWildsCard, type PortableCardAsset } from "../play/portable-card";
import { isVerifiedWildzCardDescendant } from "../../lib/receiz/wildz-card-descendant";
import { assertWildzMarketPublicValuePrivacyV129 } from "../../lib/receiz/wildz-market-public-value-source-v129";
import type { WildzMarketValuePort, WildzMarketValueRead } from "./wildz-market-value";

/** Locator constraints are never proof authority. Reopen the complete exact
 * source, then bind its sealed card membership. Do not supply a listing seal,
 * unsealed genome, private Vault or key envelope. */
export type WildzMarketValueSourceV129 = Readonly<{
  assetId: string;
  cardProofDigest: string;
  /** Current signed public card selection. Only exact root/verified descendants
   * can share the first public proof origin; this never grants native custody. */
  selectedCard?: PortableCardAsset;
  artifactBytes: Uint8Array;
  proofArtifactDigest: string;
  /** Retain the original canonical digest across ownership and revisions. */
  originProofArtifactDigest: string;
  historyHead: string | null;
  filename: string;
  mimeType: string;
  portableHistory: boolean;
}>;

export type WildzMarketValueEvaluationV129 = Readonly<{
  valuationKaiUPulse: string;
  /** Explicit model coordinates, with no clock-derived/interpolated points. */
  sampleKaiUPulses?: readonly string[];
  usdBasis?: ReceizProofValueUsdBasisV129;
  rarityPolicy?: ReceizRarityPolicyV129;
  marketReferenceRule?: "last-executed-sale-v129";
}>;

const MAX_SAMPLES = 32;
const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 4;
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
class Unavailable extends Error {}
function fail(code: string): never { throw new Unavailable(code); }
function json(bytes: Uint8Array): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return fail("VALUATION_PUBLIC_PAYLOAD_UNSUPPORTED"); }
}

function coordinate(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,127})$/.test(value)) fail("KAI_VALUATION_INVALID");
  // The installed SDK's exact bridge has this range. Projection/sampling use
  // that bridge themselves; this is only an early input bound, with no rounding.
  if (BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) fail("KAI_VALUATION_INVALID");
}

/** Declared model coordinates only. Call after admitting the origin; an origin
 * with whole-only precision remains null in the source and displayed result. */
export function wildzMarketModelCoordinatesV129(originKaiPulse: string, originKaiUPulse: string | null, valuationKaiUPulse: string): readonly string[] {
  const now = BigInt(valuationKaiUPulse);
  const lower = originKaiUPulse === null ? BigInt(originKaiPulse) * 1_000_000n : BigInt(originKaiUPulse);
  return [...new Set(Array.from({ length: MAX_SAMPLES }, (_, index) => {
    const selected = now - BigInt(MAX_SAMPLES - 1 - index) * 1_000_000n;
    return (selected < lower ? lower : selected).toString();
  }))];
}

/** Public replay is an exact-byte export. Redacting a stronger private source
 * is impossible here. Binary/key-bearing Originals are intentionally excluded.
 * The SDK's JSON private-source checks remain an additional boundary. */
function assertPublicPayload(value: unknown) {
  const pending = [value];
  let count = 0;
  while (pending.length) {
    if (++count > 20_000) fail("VALUATION_PUBLIC_PAYLOAD_LIMIT");
    const next = pending.pop();
    if (Array.isArray(next)) { pending.push(...next); continue; }
    if (!record(next)) continue;
    const schema = String(next.schema ?? next.kind ?? "");
    if (/^receiz\.(identity|key|conversation|chat|account|profile-showcase|economy-showcase|device\.identity)([.-]|$)/.test(schema)
      || ["privateKeyPkcs8CiphertextB64u", "privateKeyPkcs8B64u", "privateKeyPkcs8", "accessToken", "refreshToken", "clientSecret", "access_token", "refresh_token", "client_secret", "bearerToken", "sourceOriginal", "player", "playState"]
        .some(key => key in next)) fail("VALUATION_PRIVATE_SOURCE_UNSUPPORTED");
    if (schema === "wildz.creature-projection.v128") fail("VALUATION_ORIGIN_NOT_CARRIED");
    pending.push(...Object.values(next));
  }
}

/** Extraction runs only after canonical SDK verification and rechecks the
 * payload digest. It never rewraps an artifact or admits manifest authority. */
async function verifiedJsonPayload(bytes: Uint8Array, verified: Extract<ReceizArtifactVerificationResult, { status: "verified-artifact" }>) {
  const envelope = json(bytes);
  try { assertWildzMarketPublicValuePrivacyV129(envelope); }
  catch (cause) {
    if (cause instanceof Error && cause.message === "wildz_market_value_private_source_forbidden") fail("VALUATION_PRIVATE_SOURCE_UNSUPPORTED");
    throw cause;
  }
  if (!record(envelope) || envelope.kind !== "receiz.bundle.v1" || typeof envelope.originalBase64 !== "string")
    return fail("VALUATION_PUBLIC_PAYLOAD_UNSUPPORTED");
  const payload = receizBase64UrlDecode(envelope.originalBase64);
  if (receizBase64UrlEncode(payload) !== envelope.originalBase64 || await sha256ReceizBytes(payload) !== verified.payloadDigest.value)
    fail("ARTIFACT_PAYLOAD_BINDING_FAILED");
  return payload;
}

async function boundCard(bytes: Uint8Array, assetId: string, depth = 0): Promise<PortableCardAsset> {
  if (depth > 4) fail("VALUATION_PORTABLE_DEPTH_LIMIT");
  const body = json(bytes);
  assertPublicPayload(body);
  if (!record(body)) fail("VALUATION_ASSET_BINDING_INVALID");
  if (body.kind === "receiz.bundle.v1") {
    const verification = await verifyReceizArtifact(bytes);
    if (verification.status !== "verified-artifact") fail("ARTIFACT_VERIFICATION_FAILED");
    return boundCard(await verifiedJsonPayload(bytes, verification), assetId, depth + 1);
  }
  if (body.schema === "receiz.portable_asset.v1") {
    const portable = await parseReceizPortableAssetDocument(body);
    const payload = receizBase64UrlDecode(portable.payload.bytesBase64Url);
    if (await sha256ReceizBytes(payload) !== portable.payload.sha256) fail("ARTIFACT_PAYLOAD_BINDING_FAILED");
    return boundCard(payload, assetId, depth + 1);
  }
  // A collection/listing/profile envelope cannot assign its origin to members.
  const candidate = body.schema === "receiz.wilds_public_card.v1" ? body.asset : body;
  if (body.schema === "receiz.wilds_public_card.v1" && body.assetId !== assetId) fail("VALUATION_ASSET_BINDING_INVALID");
  if (!record(candidate) || candidate.id !== assetId || !record(candidate.proof)) fail("VALUATION_ASSET_BINDING_INVALID");
  try { if (!verifyAnyWildsCard(candidate as PortableCardAsset).ok) fail("VALUATION_ASSET_BINDING_INVALID"); }
  catch { fail("VALUATION_ASSET_BINDING_INVALID"); }
  return candidate as PortableCardAsset;
}

function unavailable(cause: unknown): WildzMarketValueRead {
  // Resolver exceptions may include private host details. Only machine codes
  // leave this boundary; never emit supplied file contents or URL credentials.
  const message = cause instanceof Error ? cause.message : "";
  const code = cause instanceof Unavailable ? message
    : /^(?:V129_|ARTIFACT_)[A-Z0-9_:.-]{1,160}$/.test(message) ? message : "VALUATION_PUBLIC_READ_FAILED";
  return { status: "unavailable", message: `No verified valuation is available. Reference: ${code}.` };
}

/** Market-visible local reads only. No transport client, admission store, seal,
 * publication, payment, approval or frame loop is constructed by this port. */
export function createWildzMarketValuePortV129(input: Readonly<{
  resolveSource(assetId: string): Promise<WildzMarketValueSourceV129 | null>;
  evaluation(): WildzMarketValueEvaluationV129;
}>): WildzMarketValuePort {
  const cache = new Map<string, WildzMarketValueRead>();
  const running = new Map<string, Promise<WildzMarketValueRead>>();
  let activeReads = 0;
  async function compute(source: WildzMarketValueSourceV129, evaluation: WildzMarketValueEvaluationV129, explicitSamples: readonly string[] | null): Promise<WildzMarketValueRead> {
    const file = new File([source.artifactBytes.slice().buffer], source.filename, { type: source.mimeType });
    const verification = await verifyReceizArtifact(file);
    if (verification.status !== "verified-artifact") fail(`ARTIFACT_VERIFICATION_FAILED:${verification.status}`);
    if (verification.artifactDigest.value !== source.proofArtifactDigest) fail("ARTIFACT_DIGEST_MISMATCH");
    let basisSource: ReceizProofValueSourceV129 = verification;
    const admission = await createReceizArtifactAdmissionEngine()(verification, { profile: source.portableHistory ? "portable-state" : "document" });
    let rootCard: PortableCardAsset;
    if (source.portableHistory) {
      if (admission.profile !== "portable-state" || (admission.verdict !== "bearer-recovery" && admission.verdict !== "foreign-owner"))
        fail("VALUATION_HISTORY_NOT_ADMITTED");
      basisSource = admission;
      rootCard = await boundCard(admission.verifiedPayload.bytes, source.assetId);
    } else {
      if (admission.profile !== "document" || admission.verdict !== "verified-document") fail("VALUATION_DOCUMENT_NOT_ADMITTED");
      rootCard = await boundCard(await verifiedJsonPayload(source.artifactBytes, verification), source.assetId);
    }
    if (rootCard.proof.digest !== source.cardProofDigest) {
      const selected = source.selectedCard;
      if (!selected || selected.id !== source.assetId || selected.proof.digest !== source.cardProofDigest
        || !isVerifiedWildzCardDescendant(rootCard, selected)) fail("VALUATION_ASSET_BINDING_INVALID");
      assertPublicPayload(selected);
    }
    const basis = {
      source: basisSource, expectedProofDigest: source.proofArtifactDigest,
      ...(source.historyHead === null ? {} : { expectedHistoryHead: source.historyHead }),
      policy: { algorithm: SIGIL_VALUATION_ALGORITHM, checksum: SIGIL_VALUATION_POLICY_CHECKSUM },
      ...(evaluation.usdBasis ? { usdBasis: evaluation.usdBasis } : {}),
      ...(evaluation.rarityPolicy ? { rarityPolicy: evaluation.rarityPolicy } : {}),
      ...(evaluation.marketReferenceRule ? { marketReferenceRule: evaluation.marketReferenceRule } : {})
    } as const;
    const projection = await projectReceizProofValueV129({ ...basis, valuationKaiUPulse: evaluation.valuationKaiUPulse });
    if (projection.status === "unavailable") fail(projection.code);
    if (projection.historyHead !== source.historyHead || projection.originProofDigest !== source.originProofArtifactDigest)
      fail("V129_SOURCE_BINDING_INVALID");
    // These are declared model evaluation coordinates, never observed history
    // or a claim of finer issuance precision. Whole-only origins stay null.
    const samples = explicitSamples ?? wildzMarketModelCoordinatesV129(projection.originKaiPulse, projection.originKaiUPulse, evaluation.valuationKaiUPulse);
    const chart = await sampleReceizProofValueV129({ ...basis, valuationKaiUPulses: samples });
    for (const point of chart.samples) if (point.status === "unavailable") fail(point.code);
    const replay = await exportReceizProofValueReplayV129({ ...basis, valuationKaiUPulses: samples });
    const verifiedReplay = await verifyReceizProofValueReplayV129(replay);
    if (verifiedReplay.status !== "verified-replay") fail(verifiedReplay.code);
    // The download reproduces the displayed current digest as well as the chart.
    const current = verifiedReplay.samples.find(point => point.status === "available" && point.valuationKaiUPulse === evaluation.valuationKaiUPulse);
    if (!current || current.status !== "available" || current.projectionDigest !== projection.projectionDigest)
      fail("V129_REPLAY_PROJECTION_MISMATCH");
    return { status: "ready", value: {
      assetId: source.assetId, proofDigest: source.cardProofDigest,
      proofArtifactDigest: projection.proofDigest, originProofDigest: projection.originProofDigest,
      historyHead: projection.historyHead, algorithm: projection.algorithm, policyChecksum: projection.policyChecksum,
      projectionDigest: projection.projectionDigest, originKaiUPulse: projection.originKaiUPulse, originKaiPulse: projection.originKaiPulse,
      valuationKaiUPulse: projection.valuationKaiUPulse, proofValuePhiMicro: projection.proofValuePhiMicro,
      marketReferenceValuePhiMicro: projection.marketReferenceValuePhiMicro, displayUsdCents: projection.displayUsdCents,
      priceBasisDigest: projection.priceBasisDigest, sampleKind: chart.kind,
      samples: chart.samples.flatMap(point => point.status === "available" ? [{ kaiUPulse: point.valuationKaiUPulse, phiMicro: point.proofValuePhiMicro, usdCents: point.displayUsdCents }] : []),
      calculation: projection.calculation, sdkProjection: projection,
      replay: { filename: `wildz-value-${source.assetId.slice(6)}-v129.json`, json: canonicalizeReceizV122(replay) }
    } };
  }
  return { async read(assetId) {
    if (activeReads >= MAX_CACHE_ENTRIES) return unavailable(new Unavailable("VALUATION_READ_BUSY"));
    activeReads++;
    try {
      if (!/^wilds:[a-f0-9]{24}$/.test(assetId)) fail("VALUATION_ASSET_BINDING_INVALID");
      // Snapshot display operands before the first asynchronous read.
      const evaluation = JSON.parse(canonicalizeReceizV122(input.evaluation())) as WildzMarketValueEvaluationV129;
      coordinate(evaluation.valuationKaiUPulse);
      const requested = evaluation.sampleKaiUPulses;
      if (requested !== undefined && (!Array.isArray(requested) || !requested.length || requested.length > MAX_SAMPLES)) fail("SAMPLE_LIMIT");
      requested?.forEach(coordinate);
      const samples = requested ? [...new Set([...requested, evaluation.valuationKaiUPulse])] : null;
      if (samples && samples.length > MAX_SAMPLES) fail("SAMPLE_LIMIT");
      const found = await input.resolveSource(assetId);
      if (!found) fail("VALUATION_PUBLIC_ARTIFACT_NOT_AVAILABLE");
      if (found.assetId !== assetId || typeof found.cardProofDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(found.cardProofDigest)
        || !sha(found.proofArtifactDigest) || !sha(found.originProofArtifactDigest)
        || found.historyHead !== null && (typeof found.historyHead !== "string" || !found.historyHead)
        || typeof found.portableHistory !== "boolean") fail("VALUATION_ASSET_BINDING_INVALID");
      if (!(found.artifactBytes instanceof Uint8Array) || !found.artifactBytes.length || found.artifactBytes.length > MAX_ARTIFACT_BYTES)
        fail("ARTIFACT_INPUT_INVALID");
      if (typeof found.filename !== "string" || !found.filename || found.filename.length > 240
        || typeof found.mimeType !== "string" || !found.mimeType || found.mimeType.length > 120) fail("ARTIFACT_INPUT_INVALID");
      const source = { ...found, artifactBytes: found.artifactBytes.slice(),
        ...(found.selectedCard ? { selectedCard: JSON.parse(canonicalizeReceizV122(found.selectedCard)) as PortableCardAsset } : {}) };
      const digest = await sha256ReceizBytes(source.artifactBytes);
      if (digest !== source.proofArtifactDigest) fail("ARTIFACT_DIGEST_MISMATCH");
      const key = await digestReceizCanonicalV122({ assetId, cardProofDigest: source.cardProofDigest, digest,
        originProofArtifactDigest: source.originProofArtifactDigest, head: source.historyHead,
        filename: source.filename, mimeType: source.mimeType, portableHistory: source.portableHistory, evaluation, samples,
        selectedCard: source.selectedCard ?? null });
      const cached = cache.get(key);
      if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
      const held = running.get(key);
      if (held) return await held;
      // Failed sources remain refreshable; only verified public replays cache.
      const operation = compute(source, evaluation, samples).catch(unavailable).then(result => {
        if (result.status === "ready") {
          cache.set(key, result);
          while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
        }
        return result;
      }).finally(() => running.delete(key));
      running.set(key, operation);
      return await operation;
    } catch (cause) { return unavailable(cause); }
    finally { activeReads--; }
  } };
}
