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

export function parsePublicWildsCardRecord(value: unknown): PublicWildsCardRecord | null {
  const seen = new Set<object>();
  const parse = (candidate: unknown): PublicWildsCardRecord | null => {
    if (!isRecord(candidate) || seen.has(candidate)) return null;
    seen.add(candidate);
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
    for (const key of ["state", "data", "record", "appState", "result", "storeStateRecord"]) {
      const parsed = parse(candidate[key]);
      if (parsed) return parsed;
    }
    return null;
  };
  return parse(value);
}

export async function registerPublicWildsCard(
  asset: PortableCardAsset,
  fetcher: typeof fetch = globalThis.fetch
) {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wildz_public_card_verification_failed");
  const response = await fetcher(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset })
  });
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    record?: PublicWildsCardRecord;
    error?: string;
  } | null;
  if (!response.ok || payload?.ok !== true || payload.record?.asset?.id !== asset.id) {
    throw new Error(payload?.error ?? "wildz_public_card_registration_failed");
  }
  return payload.record;
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
