import { parsePublicWildsCardRecord } from "@/features/play/public-card-registry";
import { standaloneCardUrl } from "@/features/play/card-export";
import type { PortableCardAsset } from "@/features/play/portable-card";
import QRCode from "qrcode";
import type { PublicWildzCard } from "./public-profile";

export function profileVaultCardImageUrl(assetId: string) {
  return `/api/cards/${encodeURIComponent(assetId)}/image`;
}

export function profileVaultCardQrDataUrl(assetId: string, origin: string) {
  return QRCode.toDataURL(standaloneCardUrl(assetId, origin), {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 160
  });
}

function matchesPublicCard(card: PublicWildzCard, asset: PortableCardAsset) {
  return asset.id === card.id
    && asset.manifest.name === card.name
    && asset.proof.digest === card.proofDigest;
}

export function ownerProfileVaultAssets(
  cards: readonly PublicWildzCard[],
  assets: readonly PortableCardAsset[]
) {
  const publicCards = new Map(cards.map((card) => [card.id, card]));
  const admitted = new Map<string, PortableCardAsset>();
  for (const asset of assets) {
    const card = publicCards.get(asset.id);
    if (card && matchesPublicCard(card, asset)) admitted.set(asset.id, asset);
  }
  return admitted;
}

export function parseProfileVaultPublicAsset(card: PublicWildzCard, value: unknown) {
  const record = parsePublicWildsCardRecord(value);
  return record && record.assetId === card.id && matchesPublicCard(card, record.asset)
    ? record.asset
    : null;
}
