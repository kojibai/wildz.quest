import type { CreatureRarity } from "./creature-catalog";

export type WildzCardSort = "rarity" | "newest" | "oldest";

export type WildzCardSortRecord = {
  id: string;
  manifest: {
    name: string;
    rarity: CreatureRarity;
    capturedAt: string;
  };
};

const RARITY_RANK: Record<CreatureRarity, number> = {
  trail: 0,
  uncommon: 1,
  rare: 2,
  mythic: 3,
  eternal: 4
};

function capturedTime(card: WildzCardSortRecord) {
  const value = Date.parse(card.manifest.capturedAt);
  return Number.isFinite(value) ? value : null;
}

function compareCapturedAt(left: WildzCardSortRecord, right: WildzCardSortRecord, direction: "newest" | "oldest") {
  const leftTime = capturedTime(left);
  const rightTime = capturedTime(right);
  if (leftTime === null && rightTime !== null) return 1;
  if (leftTime !== null && rightTime === null) return -1;
  if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
    return direction === "newest" ? rightTime - leftTime : leftTime - rightTime;
  }
  return 0;
}

function deterministicCardOrder(left: WildzCardSortRecord, right: WildzCardSortRecord) {
  return left.id.localeCompare(right.id);
}

export function sortWildzCards<T extends WildzCardSortRecord>(cards: readonly T[], sort: WildzCardSort): T[] {
  return [...cards].sort((left, right) => {
    if (sort === "rarity") {
      const rarityDifference = RARITY_RANK[right.manifest.rarity] - RARITY_RANK[left.manifest.rarity];
      if (rarityDifference) return rarityDifference;
      return compareCapturedAt(left, right, "newest") || deterministicCardOrder(left, right);
    }
    return compareCapturedAt(left, right, sort) || deterministicCardOrder(left, right);
  });
}
