import type { PortableCardAsset } from "../portable-card";
import type { WildsNourishmentState } from "../wilds-nourishment";
import type { WildsMaterialLotV1 } from "../wilds-steward-construction";
import type { WildsResourceLotV1 } from "../wilds-resource-lot";
import type { ExchangeCard } from "../WildsResourceExchange";
import type { WildsWalletAssetSendSelection } from "./wilds-wallet-asset-send";
import { projectWildsWalletFoodInventory } from "./wilds-wallet-inventory";

export const wildsWalletTradeCategories = [
  { id: "food", label: "Food" },
  { id: "materials", label: "Materials" },
  { id: "creatures", label: "Creatures" },
  { id: "packages", label: "Resource packages" }
] as const;
export type WildsWalletTradeCategory = typeof wildsWalletTradeCategories[number]["id"];
export type WildsWalletTradeChoice = Readonly<{ id: string; label: string; category: WildsWalletTradeCategory; quantity: number; detail?: string; adjustableQuantity?: boolean }>;
export type WildsWalletTradeSelection = WildsWalletAssetSendSelection & Readonly<{ category: WildsWalletTradeCategory }>;

/** Display rows retain the same exact source selection used by the existing send adapter. */
export function projectWildsWalletTradeSelections({ cards = [], nourishment, materialLots = [], resourceLots = [], resourceCards = [] }: {
  cards?: readonly PortableCardAsset[];
  nourishment?: WildsNourishmentState;
  materialLots?: readonly WildsMaterialLotV1[];
  resourceLots?: readonly WildsResourceLotV1[];
  resourceCards?: readonly ExchangeCard[];
}): WildsWalletTradeSelection[] {
  return [
    ...cards.filter(card => card.status === "sealed_local" || card.status === "verified").map(card => ({ category: "creatures" as const, id: `creature:${card.id}`, label: card.manifest.name, quantity: 1, asset: { kind: "creature" as const, assetId: card.id } })),
    ...projectWildsWalletFoodInventory(nourishment).map(food => ({ category: "food" as const, id: `food:${food.id}`, label: food.label, quantity: food.quantity, adjustableQuantity: true, asset: { kind: "inventory" as const, foodItemIds: food.itemIds, materialLotIds: [], resourceLotIds: [] } })),
    ...materialLots.map(lot => ({ category: "materials" as const, id: `material:${lot.lotId}`, label: lot.kind === "timber" ? "Living Timber" : lot.kind === "stone" ? "Foundation Stone" : "Hay", quantity: 1, asset: { kind: "inventory" as const, foodItemIds: [], materialLotIds: [lot.lotId], resourceLotIds: [] } })),
    ...resourceLots.map(lot => ({ category: "food" as const, id: `resource:${lot.lotId}`, label: "Living Honey", quantity: lot.quantity, detail: "Whole sealed lot", asset: { kind: "inventory" as const, foodItemIds: [], materialLotIds: [], resourceLotIds: [lot.lotId] } })),
    ...resourceCards.filter(card => card.transferable).map(card => ({ category: "packages" as const, id: `package:${card.id}`, label: card.title, detail: card.summary, quantity: 1, asset: { kind: "package" as const, packageId: card.id } }))
  ];
}

/** Name search operates only on the bounded display projection, never source IDs or proofs. */
export function filterWildsWalletTradeChoices<T extends WildsWalletTradeChoice>(choices: readonly T[], filter: {
  category?: WildsWalletTradeCategory | "all";
  query?: string;
  selectedOnly?: boolean;
  selected?: Readonly<Record<string, number>>;
}): T[] {
  const query = (filter.query ?? "").trim().toLowerCase();
  return choices.filter(item => (!filter.category || filter.category === "all" || item.category === filter.category)
    && (!query || item.label.toLowerCase().includes(query))
    && (!filter.selectedOnly || filter.selected?.[item.id] !== undefined));
}

/** A wishlist carries names only. It does not identify or claim the peer's holdings. */
export function projectWildsWalletTradeWishlist(selections: readonly WildsWalletTradeSelection[]): WildsWalletTradeChoice[] {
  const choices = new Map<string, WildsWalletTradeChoice>();
  for (const item of selections) {
    const id = `request:${item.category}:${item.label}`;
    if (!choices.has(id)) choices.set(id, { id, label: item.label, category: item.category, quantity: 1, adjustableQuantity: true });
  }
  return [...choices.values()];
}

export function createWildsWalletTradeRequestNote(choices: readonly WildsWalletTradeChoice[], requested: Readonly<Record<string, number>>, note: string): string {
  const items = choices.filter(item => requested[item.id] !== undefined).map(item => {
    const quantity = requested[item.id]!;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 64) throw Error("Choose a whole quantity from 1 to 64 for each requested item.");
    return `${quantity} × ${item.label}`;
  });
  return [items.length ? `Requested: ${items.join(", ")}` : "", note.trim()].filter(Boolean).join(". ");
}
