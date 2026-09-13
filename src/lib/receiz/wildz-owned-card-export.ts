import { portableCardBaseProofAsset, type PortableCardAsset } from "../../features/play/portable-card";
import { cardArtifactFingerprint } from "../../features/play/prepared-card-artifact";
import { readPortableVaultFromPng, readWildzPlayerVaultAppendFromPng } from "../../features/play/card-export";
import { requireWildzIdentityBindingFromEnvelope } from "./wildz-identity-binding";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { splitWildzPngEnvelope } from "./wildz-png-envelope";

/** Only reuse a current, single-card export signed by this identity. The caller
 * separately verifies the enclosing retained seal before opening this payload. */
export async function matchesWildzOwnedCardExport(payload: Uint8Array, input: {
  asset: PortableCardAsset; keyId: string; ownerReceizId: string;
}) {
  const binding = await requireWildzIdentityBindingFromEnvelope(payload);
  const { pngBasis } = splitWildzPngEnvelope(payload);
  const vault = readPortableVaultFromPng(pngBasis);
  const current = readWildzPlayerVaultAppendFromPng(pngBasis).player.playState.inventory;
  return binding.keyId === input.keyId && sameWildzPlayerCoordinate(binding.playerId, input.ownerReceizId)
    && sameWildzPlayerCoordinate(input.asset.manifest.ownerReceizId, input.ownerReceizId)
    && vault.assets.length === 1
    && cardArtifactFingerprint(vault.assets[0]) === cardArtifactFingerprint(portableCardBaseProofAsset(input.asset))
    && current.length === 1 && current[0].id === input.asset.id
    && cardArtifactFingerprint(current[0]) === cardArtifactFingerprint(input.asset);
}
