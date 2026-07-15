import { creatureForm } from "./creature-catalog";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import type { PvpCard } from "./pvp-battle-engine";

export function pvpCardFromAsset(asset: PortableCardAsset): PvpCard {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_multiplayer_card_verification_failed");
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_multiplayer_card_form_missing");
  return {
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    name: asset.manifest.name,
    stats: asset.manifest.stats,
    abilities: [
      { name: form.abilities[0].name, power: form.abilities[0].power },
      { name: form.abilities[1].name, power: form.abilities[1].power }
    ]
  };
}
