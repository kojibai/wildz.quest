import { compressPublicCardRecord, decompressPublicCardRecord } from "./public-card-compression";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import { isAdmittedWildsCard } from "./admitted-inventory";

export type PublicCardParam = {
  assetId: string;
  source: "canonical" | "compact";
};

export type PublicWildsCardRecord = {
  schema: "receiz.wilds_public_card.v1";
  assetId: string;
  sourceUrl: string;
  registeredAt: string;
  asset: PortableCardAsset;
};

export type PublicWildsCardTransportRecord = {
  schema: "receiz.wilds_public_card_transport.v2";
  assetId: string;
  sourceUrl: string;
  recordDeflateB64: string;
  recordByteLength: number;
} | {
  schema: "receiz.wilds_public_card_transport.v1";
  assetId: string;
  sourceUrl: string;
  recordJson: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function admittedIso(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("wildz_public_card_time_invalid");
  }
  return value;
}

export function parsePublicCardParam(value: string): PublicCardParam {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value).trim().toLowerCase();
  } catch {
    throw new Error("wildz_public_card_id_invalid");
  }
  if (/^wilds:[a-f0-9]{24}$/.test(decoded)) return { assetId: decoded, source: "canonical" };
  if (/^[a-f0-9]{24}$/.test(decoded)) return { assetId: `wilds:${decoded}`, source: "compact" };
  throw new Error("wildz_public_card_id_invalid");
}

export function canonicalPublicCardPath(assetId: string) {
  return `/cards/${encodeURIComponent(parsePublicCardParam(assetId).assetId)}`;
}

export function publicWildsCardRecoverySourceUrls(assetId: string, requestOrigin: string, platformDomain: string) {
  const parsed = parsePublicCardParam(assetId);
  const compactPath = `/c/${parsed.assetId.slice("wilds:".length)}`;
  const canonicalPath = canonicalPublicCardPath(parsed.assetId);
  const platformOrigin = new URL(/^https?:\/\//i.test(platformDomain) ? platformDomain : `https://${platformDomain}`).origin;
  const origins = [...new Set([new URL(requestOrigin).origin, platformOrigin])];
  return origins.flatMap((origin) => [`${origin}${canonicalPath}`, `${origin}${compactPath}`]);
}

export function createPublicWildsCardRecord(
  asset: PortableCardAsset,
  sourceOrigin: string,
  registeredAt: string
): PublicWildsCardRecord {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wildz_public_card_verification_failed");
  const origin = new URL(sourceOrigin).origin;
  return {
    schema: "receiz.wilds_public_card.v1",
    assetId: asset.id,
    sourceUrl: `${origin}${canonicalPublicCardPath(asset.id)}`,
    registeredAt: admittedIso(registeredAt),
    asset: structuredClone(asset)
  };
}

export function createPublicWildsCardTransportRecord(record: PublicWildsCardRecord): PublicWildsCardTransportRecord {
  const verified = parsePublicWildsCardRecord(record);
  if (!verified) throw new Error("wildz_public_card_verification_failed");
  return {
    schema: "receiz.wilds_public_card_transport.v2",
    assetId: verified.assetId,
    sourceUrl: verified.sourceUrl,
    ...compressPublicCardRecord(JSON.stringify(verified))
  };
}

/** Compare every transported field against the immutable admitted object. A head
 * match alone is insufficient; this avoids replaying its already admitted history. */
function sameProofContents(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object") return false;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length
      && Object.keys(actual).length === expected.length
      && expected.every((value, index) => sameProofContents(actual[index], value));
  }
  if (Array.isArray(actual)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every(key => Object.hasOwn(actual, key)
    && sameProofContents((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key]));
}

export function parsePublicWildsCardRecord(value: unknown, expectedAsset?: PortableCardAsset): PublicWildsCardRecord | null {
  const admittedAsset = expectedAsset && isAdmittedWildsCard(expectedAsset) ? expectedAsset : null;
  const seen = new Set<object>();
  const parse = (candidate: unknown): PublicWildsCardRecord | null => {
    if (!isRecord(candidate) || seen.has(candidate)) return null;
    seen.add(candidate);
    if (candidate.schema === "receiz.wilds_public_card_transport.v2") {
      try {
        const restored = parse(JSON.parse(decompressPublicCardRecord(candidate.recordDeflateB64, candidate.recordByteLength)));
        return restored && restored.assetId === candidate.assetId && restored.sourceUrl === candidate.sourceUrl ? restored : null;
      } catch { return null; }
    }
    if (candidate.schema === "receiz.wilds_public_card_transport.v1"
      && typeof candidate.assetId === "string"
      && typeof candidate.sourceUrl === "string"
      && typeof candidate.recordJson === "string") {
      try {
        const restored = parse(JSON.parse(candidate.recordJson));
        return restored?.assetId === candidate.assetId && restored.sourceUrl === candidate.sourceUrl
          ? restored
          : null;
      } catch {
        return null;
      }
    }
    if (candidate.schema === "receiz.wilds_public_card.v1"
      && typeof candidate.assetId === "string"
      && typeof candidate.sourceUrl === "string"
      && typeof candidate.registeredAt === "string"
      && isRecord(candidate.asset)) {
      try {
        if (admittedAsset && !sameProofContents(candidate.asset, admittedAsset)) return null;
        const asset = admittedAsset ?? candidate.asset as PortableCardAsset;
        const record: PublicWildsCardRecord = admittedAsset ? {
          schema: "receiz.wilds_public_card.v1", assetId: asset.id,
          sourceUrl: `${new URL(candidate.sourceUrl).origin}${canonicalPublicCardPath(asset.id)}`,
          registeredAt: admittedIso(candidate.registeredAt), asset
        } : createPublicWildsCardRecord(asset, candidate.sourceUrl, candidate.registeredAt);
        const source = new URL(candidate.sourceUrl);
        const collectionPath = /^\/u\/[a-z0-9_]{3,64}\/cards\//.test(source.pathname)
          && source.pathname.endsWith(`/cards/${encodeURIComponent(asset.id)}`) && !source.search && !source.hash;
        return record.assetId === candidate.assetId && (record.sourceUrl === source.toString() || collectionPath)
          ? { ...record, sourceUrl: source.toString() }
          : null;
      } catch {
        return null;
      }
    }
    for (const key of [
      "state",
      "data",
      "record",
      "appState",
      "result",
      "storeStateRecord",
      "appProjectionRecord",
      "appProjectionData"
    ]) {
      const parsed = parse(candidate[key]);
      if (parsed) return parsed;
    }
    return null;
  };
  return parse(value);
}
