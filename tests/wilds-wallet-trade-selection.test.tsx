import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createWildsNourishmentState } from "../src/features/play/wilds-nourishment";
import type { WildsMaterialLotV1 } from "../src/features/play/wilds-steward-construction";
import { WildsWalletTrade } from "../src/features/play/wallet/WildsWalletTrade";
import { createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade";
import { createWildsWalletTradeRequestNote, filterWildsWalletTradeChoices, projectWildsWalletTradeSelections, projectWildsWalletTradeWishlist } from "../src/features/play/wallet/wilds-wallet-trade-selection";

// Complete card shape, used only as a display fixture, never proof admission.
const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "alice", encounterId: "trade-display", capturedAt: "2026-10-09T00:00:00.000Z" });
const cards = Array.from({ length: 68 }, (_, index) => ({ ...card, id: `creature:${index + 1}`, manifest: { ...card.manifest, name: `Creature ${index + 1}` } }));
const nourishment = {
  ...createWildsNourishmentState("alice"),
  items: {
    "fruit:1": { schema: "wildz.food-item.v1" as const, itemId: "fruit:1", ownerReceizId: "alice", sourceId: "orchard:one", foodKind: "orchard-fruit" as const, cropDay: 0, slot: 0, gatheredKaiUPulse: 1 },
    "fruit:2": { schema: "wildz.food-item.v1" as const, itemId: "fruit:2", ownerReceizId: "alice", sourceId: "orchard:one", foodKind: "orchard-fruit" as const, cropDay: 0, slot: 1, gatheredKaiUPulse: 1 }
  }
};
const stone: WildsMaterialLotV1 = { schema: "wildz.material-lot.v1", lotId: "stone:one", kind: "stone", quantity: 1, quality: 3, ownerReceizId: "alice", source: { sourceId: "source:stone", sourceHead: "sha256:a", admittedSourceHead: "sha256:b", kaiUPulse: 1 }, contributors: { explorerReceizId: "alice" }, authority: "source-proof-object", head: "sha256:c" };
const recoveryStore = { load: () => null, write() { throw Error("Rendering must not save a trade."); }, clear() { throw Error("Rendering must not clear a trade."); } };

test("a large trade inventory exposes the last creature, food and materials without truncation", () => {
  const markup = renderToStaticMarkup(<WildsWalletTrade publicUsername="alice" cards={cards} nourishment={nourishment} materialLots={[stone]} recoveryStore={recoveryStore} />);
  assert.match(markup, /aria-label="Add Creature 68 to trade"/);
  assert.match(markup, /aria-label="Add Wild fruit to trade"/);
  assert.match(markup, /aria-label="Add Foundation Stone to trade"/);
});

test("trade offers and requested wishlists have independent category and name controls", () => {
  const markup = renderToStaticMarkup(<WildsWalletTrade publicUsername="alice" cards={cards} nourishment={nourishment} materialLots={[stone]} recoveryStore={recoveryStore} />);
  assert.match(markup, /aria-label="Offer asset categories"/);
  assert.match(markup, /aria-label="Requested asset categories"/);
  assert.match(markup, /aria-label="Search requested assets"/);
  assert.match(markup, /aria-label="Request Wild fruit in trade"/);
  assert.match(markup, /peer.+counteroffer/i);
});

test("category and name filtering finds resources after 68 creatures without reading proof payloads", () => {
  const guarded = { ...card };
  Object.defineProperty(guarded, "proof", { get() { throw Error("Search must not inspect source proofs."); } });
  const selections = projectWildsWalletTradeSelections({ cards: [...cards, guarded], nourishment, materialLots: [stone] });
  assert.equal(selections.filter(item => item.category === "creatures").length, 69);
  assert.deepEqual(filterWildsWalletTradeChoices(selections, { category: "food", query: "  FRUIT  " }).map(item => item.label), ["Wild fruit"]);
  assert.deepEqual(filterWildsWalletTradeChoices(selections, { category: "materials" }).map(item => item.id), ["material:stone:one"]);
  assert.equal(filterWildsWalletTradeChoices(selections, { query: "Creature 68" }).length, 1);
  assert.equal(filterWildsWalletTradeChoices(selections, { query: "stone:one" }).length, 0, "opaque source IDs are not search content");
});

test("filtering selected assets leaves the exact offered source IDs and quantities intact", () => {
  const selections = projectWildsWalletTradeSelections({ cards: [cards[67]!], nourishment, materialLots: [stone] });
  const fruit = selections.find(item => item.category === "food")!;
  const selected = { [fruit.id]: 2, "material:stone:one": 1 };
  assert.deepEqual(filterWildsWalletTradeChoices(selections, { selectedOnly: true, selected }).map(item => item.label), ["Wild fruit", "Foundation Stone"]);
  const chosen = selections.filter(item => selected[item.id as keyof typeof selected] !== undefined).map(selection => ({ selection, quantity: selected[selection.id as keyof typeof selected]! }));
  const draft = createWildsWalletTradeDraft({ attemptId: "wallet:trade:selection", recipient: "bob", selfHandle: "alice", phiMicro: "0", requestedPhiMicro: "1", requestNote: "", selections: chosen });
  assert.deepEqual(draft.offered.assets, [
    { kind: "inventory", foodItemIds: ["fruit:1", "fruit:2"], materialLotIds: [], resourceLotIds: [] },
    { kind: "inventory", foodItemIds: [], materialLotIds: ["stone:one"], resourceLotIds: [] }
  ]);
  assert.deepEqual(Object.keys(nourishment.items), ["fruit:1", "fruit:2"]);
});

test("wishlist merges duplicate display names and carries requested quantities only as the existing note", () => {
  const selections = projectWildsWalletTradeSelections({ cards: [], nourishment, materialLots: [stone, { ...stone, lotId: "stone:two" }] });
  const wishlist = projectWildsWalletTradeWishlist(selections);
  assert.deepEqual(wishlist.map(item => item.label), ["Wild fruit", "Foundation Stone"]);
  assert.equal("asset" in wishlist[1]!, false, "the wishlist never claims a peer's source IDs");
  const note = createWildsWalletTradeRequestNote(wishlist, { [wishlist[0]!.id]: 3, [wishlist[1]!.id]: 2 }, "Any quality");
  assert.equal(note, "Requested: 3 × Wild fruit, 2 × Foundation Stone. Any quality");
  assert.equal(createWildsWalletTradeRequestNote(wishlist, {}, "  Living Honey  "), "Living Honey");
  assert.throws(() => createWildsWalletTradeRequestNote(wishlist, { [wishlist[0]!.id]: 0 }, ""), /whole quantity/);
});
