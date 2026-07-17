import "server-only";

import { createPublicWildsCardRecord, parsePublicCardParam, type PublicWildsCardRecord } from "@/features/play/public-card-registry";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { createReceizCommerceAdapter } from "./adapter";
import { resolveSdkPublicWildzCard } from "./wildz-market-public-card";
import { createReceizWildzPublicRepository } from "./wildz-public-repository";

export async function resolvePublicWildsCardRecord(
  rawAssetId: string,
  requestOrigin: string
): Promise<PublicWildsCardRecord | null> {
  const { assetId } = parsePublicCardParam(rawAssetId);
  const adapter = createReceizCommerceAdapter();
  const repository = createReceizWildzPublicRepository({ adapter });
  let asset: PortableCardAsset | null = null;
  let registeredAt = new Date().toISOString();
  let repositoryFailure: unknown = null;
  try {
    const { state } = await repository.load();
    const projected = state.cards[assetId];
    if (projected && verifyAnyWildsCard(projected).ok) {
      asset = projected;
      registeredAt = state.updatedAt;
    }
  } catch (cause) {
    repositoryFailure = cause;
  }
  if (!asset) asset = await resolveSdkPublicWildzCard(assetId, { adapter, requestOrigin });
  if (!asset || !verifyAnyWildsCard(asset).ok) {
    if (repositoryFailure) throw repositoryFailure;
    return null;
  }
  return createPublicWildsCardRecord(asset, requestOrigin, registeredAt);
}
