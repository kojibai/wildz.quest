import type { WildsStewardPhiAwardV1 } from "../wilds-steward-construction";
import { availableWildsFood, describeWildsFoodItem, type WildsFoodKind, type WildsNourishmentState } from "../wilds-nourishment";
import type { WildsResourceLotV1 } from "../wilds-resource-lot";

const foodLabels: Readonly<Record<WildsFoodKind, string>> = {
  "orchard-fruit": "Wild fruit", "wild-berries": "Wild berries", "wild-vegetable": "Wild vegetables",
  "wild-meat": "Wild meat", "wild-eggs": "Wild eggs", "wild-milk": "Wild milk"
};

export function projectWildsWalletFoodInventory(nourishment: WildsNourishmentState | undefined) {
  const groups = new Map<string, { id: string; foodKind: WildsFoodKind; label: string; quantity: number; itemIds: string[]; sourceIds: string[] }>();
  for (const item of availableWildsFood(nourishment)) {
    const label = describeWildsFoodItem(item, nourishment!)?.label ?? foodLabels[item.foodKind];
    const id = `${item.foodKind}:${label}`;
    const group = groups.get(id) ?? { id, foodKind: item.foodKind, label, quantity: 0, itemIds: [], sourceIds: [] };
    group.quantity++;
    group.itemIds.push(item.itemId);
    group.sourceIds.push(item.sourceId);
    groups.set(id, group);
  }
  return [...groups.values()];
}

/** A display projection of the same exact available holdings on every wallet page. */
export function countWildsWalletResourceInventory(input: Readonly<{
  nourishment?: WildsNourishmentState;
  resourceLots: readonly Pick<WildsResourceLotV1, "quantity">[];
  resourceCards: readonly unknown[];
}>) {
  return availableWildsFood(input.nourishment).length
    + input.resourceLots.reduce((total, lot) => total + lot.quantity, 0)
    + input.resourceCards.reduce<number>((total, card) => {
      if (!card || typeof card !== "object" || !("resourceUnits" in card) || card.resourceUnits === undefined) return total + 1;
      const units = card.resourceUnits;
      return total + (typeof units === "number" && Number.isSafeInteger(units) && units >= 0 ? units : 0);
    }, 0);
}

export function totalWildsStewardPhiMicro(
  awards: readonly Pick<WildsStewardPhiAwardV1, "amountPhiMicro">[]
) {
  return awards.reduce((total, award) => {
    if (!/^[0-9]+$/.test(award.amountPhiMicro)) throw new Error("wilds_wallet_phi_award_invalid");
    return total + BigInt(award.amountPhiMicro);
  }, 0n).toString();
}
