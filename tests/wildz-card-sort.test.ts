import assert from "node:assert/strict";
import { test } from "node:test";
import { sortWildzCards, type WildzCardSortRecord } from "../src/features/play/card-sort";

function card(
  id: string,
  rarity: WildzCardSortRecord["manifest"]["rarity"],
  capturedAt: string
): WildzCardSortRecord {
  return { id, manifest: { name: id, rarity, capturedAt } };
}

test("rarity sorting follows Vault rank and does not mutate the restored collection", () => {
  const cards = [
    card("trail", "trail", "2026-07-01T00:00:00.000Z"),
    card("rare", "rare", "2026-07-03T00:00:00.000Z"),
    card("eternal", "eternal", "2026-07-02T00:00:00.000Z"),
    card("uncommon", "uncommon", "2026-07-05T00:00:00.000Z"),
    card("mythic", "mythic", "2026-07-04T00:00:00.000Z")
  ] as const;
  const originalOrder = cards.map((item) => item.id);

  const sorted = sortWildzCards(cards, "rarity");

  assert.deepEqual(sorted.map((item) => item.id), ["eternal", "mythic", "rare", "uncommon", "trail"]);
  assert.deepEqual(cards.map((item) => item.id), originalOrder);
  assert.notEqual(sorted, cards);
});

test("newest and oldest sorting use sealed capture time with asset-id ties", () => {
  const cards = [
    card("middle-b", "rare", "2026-07-02T00:00:00.000Z"),
    card("newest", "trail", "2026-07-03T00:00:00.000Z"),
    card("oldest", "eternal", "2026-07-01T00:00:00.000Z"),
    card("middle-a", "mythic", "2026-07-02T00:00:00.000Z")
  ];

  assert.deepEqual(sortWildzCards(cards, "newest").map((item) => item.id), ["newest", "middle-a", "middle-b", "oldest"]);
  assert.deepEqual(sortWildzCards(cards, "oldest").map((item) => item.id), ["oldest", "middle-a", "middle-b", "newest"]);
});

test("card ordering exposes only the persisted V3 preference values", () => {
  const cards = [card("b", "trail", "2026-07-15T10:00:00.000Z"), card("a", "trail", "2026-07-15T10:00:00.000Z")];
  assert.deepEqual(sortWildzCards(cards, "rarity").map((item) => item.id), ["a", "b"]);
  // @ts-expect-error `recent` was never part of the persisted V3 contract.
  sortWildzCards(cards, "recent");
});
