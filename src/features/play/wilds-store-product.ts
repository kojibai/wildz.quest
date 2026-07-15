import type { Product } from "../../types/domain";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

function priceLabel(value: string) {
  const match = value.trim().match(/^\$?([0-9]+(?:\.[0-9]{1,2})?)$/);
  const amount = match ? Number(match[1]) : 0;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("wilds_product_price_invalid");
  return `$${amount.toFixed(2)}`;
}

export function wildsStoreProduct(asset: PortableCardAsset, price: string, custodyOwnerReceizId = asset.manifest.ownerReceizId): Product {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_product_card_invalid");
  const listingOwner = custodyOwnerReceizId.trim();
  if (!listingOwner) throw new Error("wilds_product_owner_required");
  const shortId = asset.id.slice("wilds:".length);
  const title = `${asset.manifest.name} · ${asset.manifest.rarity} Wilds Card`;
  const stats = asset.manifest.stats;
  const fullDescription = [
    `${asset.manifest.name} is a unique Stage ${asset.manifest.stage} ${asset.manifest.rarity} ${asset.manifest.species} living Wilds card with ${asset.manifest.foil} foil.`,
    `Health ${stats.health} · Power ${stats.power} · Guard ${stats.guard} · Speed ${stats.speed} · Bond ${stats.bond}.`,
    `Abilities: ${asset.manifest.abilityNames.join(" and ")}.`,
    `Visual DNA: ${asset.manifest.variant.traits.visualFingerprint}. Kai pulse: ${asset.manifest.variant.kaiPulse}.`,
    `Offline proof: ${asset.proof.digest}. Original sealed owner: ${asset.manifest.ownerReceizId}. Verified bearer custody: ${listingOwner}.`,
    "Purchase settlement appends the ownership handoff to the Receiz proof trail and retires this one-of-one listing."
  ].join(" ");

  return {
    id: `wilds-card-${shortId}`,
    name: title,
    subtitle: `Unique Stage ${asset.manifest.stage} proof-sealed ${asset.manifest.species}`,
    type: "receized_asset",
    priceLabel: priceLabel(price),
    status: "active",
    inventoryLabel: "1 of 1",
    rewardEligible: false,
    sealed: true,
    imageTone: "card",
    imageUrl: `/api/cards/${encodeURIComponent(asset.id)}/image`,
    description: fullDescription,
    seo: {
      title,
      description: `Own the unique ${asset.manifest.name} Wilds card, sealed by Receiz proof.`,
      canonicalPath: `/products/wilds-card-${shortId}`,
      keywords: [asset.manifest.name, asset.manifest.species, asset.manifest.rarity, "Wilds card", "Receiz"]
    },
    wildsAsset: {
      schema: "receiz.wilds_store_product.v1",
      assetId: asset.id,
      proofDigest: asset.proof.digest,
      ownerReceizId: listingOwner
    }
  };
}
