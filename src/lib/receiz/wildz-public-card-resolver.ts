import "server-only";

import { createPublicWildsCardRecord, parsePublicCardParam, type PublicWildsCardRecord } from "@/features/play/public-card-registry";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { createReceizCommerceAdapter } from "./adapter";
import { resolveSdkPublicWildzCard, resolveSdkPublicWildzCardRecord, resolveSdkPublicWildzCardArtwork } from "./wildz-market-public-card";
import { createReceizWildzPublicRepository } from "./wildz-public-repository";

/** Artwork-only output. Recover verified immutable artwork after the scoped
 * lookup; canonical artwork does not establish a collector's ownership. */
export async function resolvePublicWildsCardArtwork(rawAssetId: string, requestOrigin: string, profileHandle?: string) {
  const {assetId} = parsePublicCardParam(rawAssetId);
  if (profileHandle) {
    const scoped = await resolveSdkPublicWildzCardArtwork(assetId, {adapter: createReceizCommerceAdapter(), requestOrigin, profileHandle});
    if (scoped) return scoped;
  }
  return (await resolvePublicWildsCardRecord(assetId, requestOrigin))?.asset ?? null;
}

export async function resolvePublicWildsCardRecord(
  rawAssetId: string,
  requestOrigin: string,
  profileHandle?: string
): Promise<PublicWildsCardRecord | null> {
  const { assetId } = parsePublicCardParam(rawAssetId);
  const adapter = createReceizCommerceAdapter();
  const exact = await resolveSdkPublicWildzCardRecord(assetId,{adapter,requestOrigin,profileHandle});
  if (exact) return exact;
  if (profileHandle) return null;
  const repository = createReceizWildzPublicRepository({ adapter });
  let asset: PortableCardAsset | null = await resolveSdkPublicWildzCard(assetId, { adapter, requestOrigin, profileHandle });
  let registeredAt = new Date().toISOString();
  if (asset) return createPublicWildsCardRecord(asset, requestOrigin, registeredAt);
  let repositoryFailure: unknown = null;
  try {
    const { state } = await repository.load();
    const projected = state.cards[assetId];
    if (!asset && projected && verifyAnyWildsCard(projected).ok) {
      asset = projected;
      registeredAt = state.updatedAt;
    }
  } catch (cause) {
    repositoryFailure = cause;
  }
  if (!asset || !verifyAnyWildsCard(asset).ok) {
    if (repositoryFailure) throw repositoryFailure;
    return null;
  }
  return createPublicWildsCardRecord(asset, requestOrigin, registeredAt);
}
