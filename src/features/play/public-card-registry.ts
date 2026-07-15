import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

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

const registryKey = Symbol.for("receiz.wilds.public-card-registry.v1");

function registry() {
  const root = globalThis as typeof globalThis & { [registryKey]?: Map<string, PublicWildsCardRecord> };
  return (root[registryKey] ??= new Map());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function currentRevision(asset: PortableCardAsset) {
  return "revisions" in asset.manifest ? asset.manifest.revisions.length : 0;
}

export function publicWildsCardRecoverySourceUrls(assetId: string, requestOrigin: string, platformDomain: string) {
  const compactPath = `/c/${assetId.slice("wilds:".length)}`;
  const legacyPath = `/cards/${encodeURIComponent(assetId)}`;
  const platformOrigin = new URL(/^https?:\/\//i.test(platformDomain) ? platformDomain : `https://${platformDomain}`).origin;
  const origins = [...new Set([new URL(requestOrigin).origin, platformOrigin])];

  return origins.flatMap((origin) => [`${origin}${compactPath}`, `${origin}${legacyPath}`]);
}

export function admitPublicWildsCard(asset: PortableCardAsset, sourceUrl: string, registeredAt = new Date().toISOString()) {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_public_card_verification_failed");
  const url = new URL(sourceUrl);
  const compactPath = `/c/${asset.id.slice("wilds:".length)}`;
  const legacyPath = `/cards/${encodeURIComponent(asset.id)}`;
  if (!/^https?:$/.test(url.protocol) || (url.pathname !== compactPath && url.pathname !== legacyPath)) throw new Error("wilds_public_card_url_invalid");
  if (!Number.isFinite(Date.parse(registeredAt))) throw new Error("wilds_public_card_time_invalid");

  const record: PublicWildsCardRecord = { schema: "receiz.wilds_public_card.v1", assetId: asset.id, sourceUrl: url.toString(), registeredAt, asset };
  const existing = registry().get(asset.id);
  if (!existing || currentRevision(asset) >= currentRevision(existing.asset)) registry().set(asset.id, record);
  return registry().get(asset.id)!;
}

export function resolveLocalPublicWildsCard(assetId: string) {
  const record = registry().get(assetId);
  return record && verifyAnyWildsCard(record.asset).ok ? record : null;
}

export function parsePublicWildsCardRecord(value: unknown): PublicWildsCardRecord | null {
  if (!isObject(value)) return null;
  if (value.schema === "receiz.wilds_public_card.v1" && value.assetId && value.asset && isObject(value.asset)) {
    try {
      return admitPublicWildsCard(value.asset as PortableCardAsset, String(value.sourceUrl), String(value.registeredAt));
    } catch {
      return null;
    }
  }
  for (const key of ["state", "data", "record", "appState", "result"]) {
    const parsed = parsePublicWildsCardRecord(value[key]);
    if (parsed) return parsed;
  }
  return null;
}

export async function registerPublicWildsCard(asset: PortableCardAsset, options: { identityProof?: PublicWildsCardIdentityProof } = {}) {
  const response = await fetch(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset, ...(options.identityProof ? { identityProof: options.identityProof } : {}) })
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; published?: boolean; record?: PublicWildsCardRecord; error?: string } | null;
  if (!response.ok) throw new Error(result?.error ?? "wilds_public_card_registration_failed");
  if (!result || result.ok !== true || result.published !== true || !result.record) throw new Error("wilds_public_card_publication_failed");
  return result as { ok: true; published: true; record: PublicWildsCardRecord };
}

export async function attemptPublicWildsCardRegistration(
  asset: PortableCardAsset,
  options: { identityProof?: PublicWildsCardIdentityProof } = {}
): Promise<{ published: true; record: PublicWildsCardRecord } | { published: false; error: string }> {
  try {
    const result = await registerPublicWildsCard(asset, options);
    return { published: true, record: result.record };
  } catch (error) {
    return { published: false, error: error instanceof Error ? error.message : "wilds_public_card_registration_failed" };
  }
}
