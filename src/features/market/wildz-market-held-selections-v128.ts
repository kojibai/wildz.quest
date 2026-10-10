import type { PortableCardAsset } from "../play/portable-card";
import type { WildsNourishmentState } from "../play/wilds-nourishment";
import type { WildsMaterialLotV1 } from "../play/wilds-steward-construction";
import type { WildsResourceLotV1 } from "../play/wilds-resource-lot";
import type { ExchangeCard } from "../play/WildsResourceExchange";
import type { WildsWalletAssetSendSelection } from "../play/wallet/wilds-wallet-asset-send";
import { projectWildsWalletFoodInventory } from "../play/wallet/wilds-wallet-inventory";

/** Cached display selections only. Listing always reopens the actual SDK source
 * and independently qualifies every member; this helper grants no custody. */
export function projectWildzMarketHeldSelectionsV128(input: Readonly<{
  cards: readonly PortableCardAsset[]; canOperate(card: PortableCardAsset): boolean;
  nourishment?: WildsNourishmentState;
  materialLots: readonly WildsMaterialLotV1[];
  resourceLots: readonly WildsResourceLotV1[];
  resourceCards: readonly ExchangeCard[];
}>): readonly WildsWalletAssetSendSelection[] {
  return [
    ...input.cards.filter(card => input.canOperate(card) && (card.status === "sealed_local" || card.status === "verified" || card.status === "listed")).map(card => ({
      id: `creature:${card.id}`, label: card.manifest.name, detail: card.status === "listed" ? "Already listed" : "Current companion", quantity: 1,
      asset: { kind: "creature" as const, assetId: card.id }
    })),
    ...projectWildsWalletFoodInventory(input.nourishment).map(food => ({
      id: `food:${food.id}`, label: food.label, detail: "Exact available portions", quantity: Math.min(64, food.quantity),
      asset: { kind: "inventory" as const, foodItemIds: food.itemIds.slice(0, 64), materialLotIds: [], resourceLotIds: [] }
    })),
    ...input.materialLots.map(lot => ({
      id: `material:${lot.lotId}`, label: lot.kind === "timber" ? "Living Timber" : lot.kind === "stone" ? "Foundation Stone" : "Hay", quantity: 1,
      asset: { kind: "inventory" as const, foodItemIds: [], materialLotIds: [lot.lotId], resourceLotIds: [] }
    })),
    ...input.resourceLots.map(lot => ({
      id: `resource:${lot.lotId}`, label: "Living Honey", detail: `${lot.quantity} units · whole sealed lot`, quantity: lot.quantity,
      asset: { kind: "inventory" as const, foodItemIds: [], materialLotIds: [], resourceLotIds: [lot.lotId] }
    })),
    ...input.resourceCards.filter(card => card.transferable).map(card => ({
      id: `package:${card.id}`, label: card.title, detail: card.summary, quantity: 1,
      asset: { kind: "package" as const, packageId: card.id }
    }))
  ];
}
