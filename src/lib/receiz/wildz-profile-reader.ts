import { createReceizClient, RECEIZ_DEFAULT_BASE_URL } from "@receiz/sdk";
import { canonicalWildzHandle, type PublicWildzProfile } from "../../features/profile/public-profile";
import { parsePublicWildzProfileRecord, publicWildzProfileRecoverySourceUrls, type PublicWildzProfileRecord } from "./wildz-profile-record";
import { WILDZ_PRODUCT } from "../wildz/product";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";
import type { WildzPublicProjectionRepository } from "./wildz-public-repository";
import type { WildzPublicProfileAdapterPort } from "./wildz-profile-adapter";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

type ProfileReadOptions = {
  adapter?: WildzPublicProfileAdapterPort;
  requestOrigin?: string;
  platformDomain?: string;
};

/** Public display reads need the SDK's public source reader, without loading
 * identity signing, card publication or the commerce adapter first. */
export async function resolvePublicWildzProfileRecord(username: string, options: ProfileReadOptions = {}): Promise<PublicWildzProfileRecord | null> {
  const handle = canonicalWildzHandle(username);
  const reader = options.adapter ?? createReceizClient({
    baseUrl: process.env.RECEIZ_BASE_URL || RECEIZ_DEFAULT_BASE_URL,
    applicationId: WILDZ_RECEIZ_APPLICATION_ID
  }).appState;
  for (const sourceUrl of publicWildzProfileRecoverySourceUrls(handle, options.requestOrigin ?? WILDZ_PRODUCT.origin, options.platformDomain ?? WILDZ_PRODUCT.domain)) {
    try {
      const value = "readAppStateByUrl" in reader ? await reader.readAppStateByUrl(sourceUrl) : await reader.byUrl(sourceUrl);
      const record = parsePublicWildzProfileRecord(value);
      if (record?.handle === handle) return record;
    } catch {
      // Try the canonical production origin before reporting it unavailable.
    }
  }
  return null;
}

export async function resolvePublicWildzProfile(username: string, options: ProfileReadOptions & { repository?: WildzPublicProjectionRepository } = {}): Promise<PublicWildzProfile | null> {
  if (options.repository) return (await options.repository.load()).state.profiles[canonicalWildzHandle(username)] ?? null;
  return (await resolvePublicWildzProfileRecord(username, options))?.profile ?? null;
}

/** Like Bankeiz's prepared public asset catalog, discover known routes at build
 * time. Directory metadata locates profiles; each page still reads its current
 * canonical source. Originals, custody and account data are not opened here. */
export async function publicWildzProfileBuildParams(readDirectory?: (namespace: string) => Promise<unknown>): Promise<{ handle: string }[]> {
  try {
    const { WILDZ_MARKET_COLLECTION_NAMESPACE, wildzMarketCollectionUrl } = await import("./wildz-market-collection");
    const read = readDirectory ?? (namespace => createReceizClient({
      baseUrl: process.env.RECEIZ_BASE_URL || RECEIZ_DEFAULT_BASE_URL,
      fetchImpl: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) })
    }).appState.byNamespace(namespace));
    const value = await read(WILDZ_MARKET_COLLECTION_NAMESPACE) as { ok?: boolean; records?: unknown[] } | null;
    if (!value?.ok || !Array.isArray(value.records) || value.records.length > 5000) return [];
    const handles = new Set<string>();
    for (const candidate of value.records) {
      if (!candidate || typeof candidate !== "object") continue;
      const row = candidate as Record<string, unknown>;
      if (row.appNamespace !== WILDZ_MARKET_COLLECTION_NAMESPACE || row.appProjectionState !== "published" || typeof row.sourceUrl !== "string") continue;
      const coordinate = typeof row.externalCreatorId === "string" ? parseWildzPlayerCoordinate(row.externalCreatorId) : null;
      if (coordinate && row.externalCreatorId === coordinate.profileHandle && row.sourceUrl === wildzMarketCollectionUrl(coordinate.actorId)) handles.add(coordinate.actorId);
    }
    return [...handles].sort().slice(0, 1000).map(handle => ({ handle }));
  } catch { return []; }
}
