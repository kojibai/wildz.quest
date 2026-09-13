import { portableCardBaseProofAsset, type PortableCardAsset } from "../../features/play/portable-card";
import { cardArtifactFingerprint } from "../../features/play/prepared-card-artifact";
import { readPortableVaultFromPng, readWildzPlayerVaultAppendFromPng } from "../../features/play/card-export";
import { requireWildzIdentityBindingFromEnvelope } from "./wildz-identity-binding";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { splitWildzPngEnvelope } from "./wildz-png-envelope";
import { admitLegacyCard } from "../../features/play/living-card-proof";
import { isLivingCardAsset } from "../../features/play/living-card-types";

export function normalizedWildzExportCardFingerprint(asset: PortableCardAsset) {
  return cardArtifactFingerprint(isLivingCardAsset(asset) ? asset : admitLegacyCard(asset, asset.manifest.capturedAt));
}

/** Only reuse a current, single-card export signed by this identity. The caller
 * separately verifies the enclosing retained seal before opening this payload. */
export async function matchesWildzOwnedCardExport(payload: Uint8Array, input: {
  asset: PortableCardAsset; keyId: string; ownerReceizId: string;
}) {
  const binding = await requireWildzIdentityBindingFromEnvelope(payload);
  const { pngBasis } = splitWildzPngEnvelope(payload);
  const vault = readPortableVaultFromPng(pngBasis);
  const current = readWildzPlayerVaultAppendFromPng(pngBasis).player.playState.inventory;
  const currentCard = current.find((asset) => asset.id === input.asset.id);
  // Player-vault normalization deterministically admits freshly caught V1 cards
  // into living V2 cards. Compare that exact expected admission, not V1 vs V2.
  const expected = isLivingCardAsset(input.asset) ? input.asset
    : admitLegacyCard(input.asset, input.asset.manifest.capturedAt);
  return binding.keyId === input.keyId && sameWildzPlayerCoordinate(binding.playerId, input.ownerReceizId)
    && vault.assets.length === 1
    && cardArtifactFingerprint(vault.assets[0]) === cardArtifactFingerprint(portableCardBaseProofAsset(input.asset))
    && current.filter((asset) => asset.id === input.asset.id).length === 1
    && currentCard !== undefined && cardArtifactFingerprint(currentCard) === cardArtifactFingerprint(expected);
}
