import { createReceizClient, RECEIZ_DEFAULT_BASE_URL } from "@receiz/sdk";
import { canonicalWildzHandle, type PublicWildzProfile } from "../../features/profile/public-profile";
import { parsePublicWildzProfileRecord, publicWildzProfileRecoverySourceUrls, type PublicWildzProfileRecord } from "./wildz-profile-record";
import { WILDZ_PRODUCT } from "../wildz/product";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";
import type { WildzPublicProjectionRepository } from "./wildz-public-repository";
import type { WildzPublicProfileAdapterPort } from "./wildz-profile-adapter";

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
