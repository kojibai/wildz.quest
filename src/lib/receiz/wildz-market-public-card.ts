import { verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { parsePublicWildsCardRecord } from "../../features/play/public-card-registry";
import { WILDZ_PRODUCT } from "../wildz/product";
import { restoreWildzPublicState } from "./wildz-public-state";

export type WildzPublicCardReadAdapter = {
  readAppStateByUrl(url: string): Promise<unknown>;
  resolvePublicStore?(input: { id?: string; url?: string }): Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseExactPublicAsset(value: unknown, assetId: string, depth = 0): PortableCardAsset | null {
  if (!isRecord(value) || depth > 8) return null;
  const exactCardRecord = parsePublicWildsCardRecord(value);
  if (exactCardRecord?.assetId === assetId) return exactCardRecord.asset;
  const publicProjectionAsset = restoreWildzPublicState(value).cards[assetId];
  if (publicProjectionAsset) return publicProjectionAsset;
  if (value.schema === "receiz.wilds_public_card.v1"
    && value.assetId === assetId
    && isRecord(value.asset)) {
    const asset = value.asset as PortableCardAsset;
    try {
      return asset.id === assetId && verifyAnyWildsCard(asset).ok ? asset : null;
    } catch {
      return null;
    }
  }
  for (const key of ["state", "data", "record", "appState", "result", "storeStateRecord"]) {
    const parsed = parseExactPublicAsset(value[key], assetId, depth + 1);
    if (parsed) return parsed;
  }
  return null;
}

function publicCardSourceUrls(assetId: string, requestOrigin: string) {
  const compactId = assetId.slice("wilds:".length);
  const paths = [`/cards/${encodeURIComponent(assetId)}`, `/c/${compactId}`];
  const origins: string[] = [];
  for (const candidate of [requestOrigin, WILDZ_PRODUCT.origin]) {
    try {
      const origin = new URL(candidate).origin;
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      // Invalid request origins do not become SDK lookup authority.
    }
  }
  return origins.flatMap((origin) => paths.map((path) => `${origin}${path}`));
}

export async function resolveSdkPublicWildzCard(
  assetId: string,
  options: { adapter: WildzPublicCardReadAdapter; requestOrigin: string }
) {
  if (!/^wilds:[a-f0-9]{24}$/.test(assetId)) return null;
  if (options.adapter.resolvePublicStore) {
    try {
      const resolvedById = parseExactPublicAsset(
        await options.adapter.resolvePublicStore({ id: assetId }),
        assetId
      );
      if (resolvedById) return resolvedById;
    } catch {
      // Continue through canonical cross-platform source URLs.
    }
  }
  for (const sourceUrl of publicCardSourceUrls(assetId, options.requestOrigin)) {
    try {
      const direct = parseExactPublicAsset(await options.adapter.readAppStateByUrl(sourceUrl), assetId);
      if (direct) return direct;
      if (options.adapter.resolvePublicStore) {
        const resolved = parseExactPublicAsset(await options.adapter.resolvePublicStore({ url: sourceUrl }), assetId);
        if (resolved) return resolved;
      }
    } catch {
      // Continue to the next canonical source without accepting local state.
    }
  }
  return null;
}
