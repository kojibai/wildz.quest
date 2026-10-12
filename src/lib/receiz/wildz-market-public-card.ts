import { verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { parsePublicWildsCardRecord, type PublicWildsCardRecord } from "../../features/play/public-card-registry";
import { WILDZ_PRODUCT } from "../wildz/product";
import { restoreWildzPublicState } from "./wildz-public-state";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

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

/** Artwork transport only. Minimal legacy records carry the verified card but
 * no registration or ownership authority; scoped reads never use creator URLs. */
export async function resolveSdkPublicWildzCardArtwork(
  assetId: string,
  options: { adapter: WildzPublicCardReadAdapter; requestOrigin: string; profileHandle?: string }
): Promise<PortableCardAsset | null> {
  if (!/^wilds:[a-f0-9]{24}$/.test(assetId)) return null;
  if (!options.profileHandle) return resolveSdkPublicWildzCard(assetId, options);
  const owner = parseWildzPlayerCoordinate(options.profileHandle);
  if (!owner) return null;
  const sourceUrl = `${WILDZ_PRODUCT.origin}/u/${owner.actorId}/cards/${encodeURIComponent(assetId)}`;
  const parse = (value: unknown, depth = 0): PortableCardAsset | null => {
    if (!isRecord(value) || depth > 8) return null;
    const record = parsePublicWildsCardRecord(value);
    if (record) return record.assetId === assetId && record.sourceUrl === sourceUrl ? record.asset : null;
    if (value.schema === "receiz.wilds_public_card.v1") {
      if (Object.keys(value).sort().join(",") !== "asset,assetId,schema" || value.assetId !== assetId || !isRecord(value.asset)) return null;
      const asset = value.asset as PortableCardAsset;
      try { return asset.id === assetId && verifyAnyWildsCard(asset).ok ? asset : null; }
      catch { return null; }
    }
    for (const key of ["state", "data", "record", "appState", "result", "storeStateRecord", "appProjectionRecord", "appProjectionData"]) {
      const asset = parse(value[key], depth + 1);
      if (asset) return asset;
    }
    return null;
  };
  try { return parse(await options.adapter.readAppStateByUrl(sourceUrl)); }
  catch { return null; }
}

export async function resolveSdkPublicWildzCard(
  assetId: string,
  options: { adapter: WildzPublicCardReadAdapter; requestOrigin: string; profileHandle?: string }
) {
  if (!/^wilds:[a-f0-9]{24}$/.test(assetId)) return null;
  const handle = options.profileHandle ? parseWildzPlayerCoordinate(options.profileHandle)?.actorId : undefined;
  if (handle) {
    const url = `${WILDZ_PRODUCT.origin}/u/${handle}/cards/${encodeURIComponent(assetId)}`;
    try {
      const scoped = parseExactPublicAsset(await options.adapter.readAppStateByUrl(url), assetId);
      if (scoped) return scoped;
    } catch { /* Fall back to the creator's canonical public card. */ }
  }
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

/** Preserve the collector's actual signed public record and its carried claim.
 * Creator recovery remains available through the unscoped card route. */
export async function resolveSdkPublicWildzCardRecord(assetId:string,options:{adapter:WildzPublicCardReadAdapter;requestOrigin:string;profileHandle?:string}):Promise<PublicWildsCardRecord|null>{
 const owner=options.profileHandle ? parseWildzPlayerCoordinate(options.profileHandle) : null;
 if(options.profileHandle&&!owner)return null;
 const urls=owner ? [`${WILDZ_PRODUCT.origin}/u/${owner.actorId}/cards/${encodeURIComponent(assetId)}`,...publicCardSourceUrls(assetId,options.requestOrigin)] : publicCardSourceUrls(assetId,options.requestOrigin);
 for(const url of urls){
  try{
   const record=parsePublicWildsCardRecord(await options.adapter.readAppStateByUrl(url));
   if(record?.assetId!==assetId||record.sourceUrl!==url)continue;
   if(owner&&new URL(url).pathname.startsWith('/cards/')&&parseWildzPlayerCoordinate(record.asset.manifest.ownerReceizId)?.actorId!==owner.actorId)continue;
   return record;
  }catch{/* Continue exact public recovery. */}
 }
 return null;
}
