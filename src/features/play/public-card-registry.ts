import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

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

export type PublicWildsCardIdentityProof = {
  keyFile: unknown;
  passphrase?: string;
};

export type PublicWildsCardTransportRecord = {
  schema: "receiz.wilds_public_card_transport.v1";
  assetId: string;
  sourceUrl: string;
  recordJson: string;
};

type CommittedPublicRestore = {
  restoreStatus: "committed";
  verifiedAssetIds: readonly string[];
  ownerState?: { playState: { inventory: readonly PortableCardAsset[] } };
  playState?: { inventory: readonly PortableCardAsset[] };
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
    schema: "receiz.wilds_public_card_transport.v1",
    assetId: verified.assetId,
    sourceUrl: verified.sourceUrl,
    recordJson: JSON.stringify(verified)
  };
}

export function parsePublicWildsCardRecord(value: unknown): PublicWildsCardRecord | null {
  const seen = new Set<object>();
  const parse = (candidate: unknown): PublicWildsCardRecord | null => {
    if (!isRecord(candidate) || seen.has(candidate)) return null;
    seen.add(candidate);
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
        const asset = candidate.asset as PortableCardAsset;
        const record = createPublicWildsCardRecord(asset, candidate.sourceUrl, candidate.registeredAt);
        return record.assetId === candidate.assetId && record.sourceUrl === new URL(candidate.sourceUrl).toString()
          ? record
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

export async function registerPublicWildsCard(
  asset: PortableCardAsset,
  fetcher: typeof fetch = globalThis.fetch,
  options: { identityProof?: PublicWildsCardIdentityProof } = {}
) {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wildz_public_card_verification_failed");
  let identityProof = options.identityProof;
  if (!identityProof && typeof indexedDB !== "undefined") {
    try {
      const { defaultIdentityRepository } = await import("../../lib/receiz/wildz-identity-adapter");
      const session = await defaultIdentityRepository.active();
      if (session?.localAuthority === "verified") {
        identityProof = await defaultIdentityRepository.withKeyFile(session.keyId, async (keyFile) => ({ keyFile }));
      }
    } catch {
      // A connected Receiz session can publish without a local identity key.
    }
  }
  const response = await fetcher(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset, ...(identityProof ? { identityProof } : {}) })
  });
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    record?: PublicWildsCardRecord;
    error?: string;
  } | null;
  const record = parsePublicWildsCardRecord(payload?.record);
  if (!response.ok
    || payload?.ok !== true
    || record?.assetId !== asset.id
    || record.asset.proof.digest !== asset.proof.digest) {
    throw new Error(payload?.error ?? "wildz_public_card_registration_failed");
  }
  return record;
}

/**
 * Publication is not enough for an exported QR: prove that the public GET works
 * without the owner's cookies and returns this exact verified proof revision.
 */
export async function requireGloballyAvailablePublicWildsCard(
  asset: PortableCardAsset,
  fetcher: typeof fetch = globalThis.fetch
) {
  await registerPublicWildsCard(asset, fetcher);
  const response = await fetcher(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    headers: { accept: "application/json", "cache-control": "no-cache" }
  });
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    record?: PublicWildsCardRecord;
  } | null;
  const record = parsePublicWildsCardRecord(payload?.record);
  if (!response.ok
    || payload?.ok !== true
    || record?.assetId !== asset.id
    || record.asset.proof.digest !== asset.proof.digest) {
    throw new Error("wildz_public_card_anonymous_read_required");
  }
  return record;
}

export async function attemptPublicWildsCardRegistration(
  asset: PortableCardAsset
): Promise<{ published: true; record: PublicWildsCardRecord } | { published: false; error: string }> {
  try {
    return { published: true, record: await registerPublicWildsCard(asset) };
  } catch (error) {
    return {
      published: false,
      error: error instanceof Error ? error.message : "wildz_public_card_registration_failed"
    };
  }
}

export async function registerVerifiedRestoredWildsCards(input: CommittedPublicRestore) {
  if (input.restoreStatus !== "committed") throw new Error("wildz_publication_restore_incomplete");
  const inventory = input.ownerState?.playState.inventory ?? input.playState?.inventory;
  if (!inventory) throw new Error("wildz_publication_inventory_incomplete");
  const expectedIds = [...new Set(input.verifiedAssetIds)].sort();
  if (expectedIds.length !== input.verifiedAssetIds.length) throw new Error("wildz_publication_inventory_incomplete");
  const verifiedById = new Map<string, PortableCardAsset>();
  for (const asset of inventory) {
    if (verifyAnyWildsCard(asset).ok) verifiedById.set(asset.id, asset);
  }
  const assets = expectedIds.map((assetId) => verifiedById.get(assetId));
  if (assets.some((asset) => !asset)) throw new Error("wildz_publication_inventory_incomplete");
  const published: PublicWildsCardRecord[] = [];
  for (const asset of assets) published.push(await registerPublicWildsCard(asset!));
  return published;
}
