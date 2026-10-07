import assert from "node:assert/strict";
import test from "node:test";
import { playableInventory, type PlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { admitLocallySealedWildsInventory } from "../src/features/play/admitted-inventory";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";

test("a large admitted roster uses a bounded number of inventory reads", () => {
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "roster", encounterId: "roster", capturedAt: "2026-10-06T00:00:00.000Z" });
  const cards = admitLocallySealedWildsInventory(Array.from({ length: 1000 }, (_, index) => ({ ...card, id: `roster:${index}` })));
  let reads = 0;
  const inventory = new Proxy(cards, { get(target, key, receiver) {
    if (typeof key === "string" && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, receiver);
  } });
  const result = playableInventory({ inventory, adventureConditions: {} });
  assert.equal(result.length, 1000);
  assert.equal(result[999], cards[999]);
  assert.ok(reads <= cards.length * 3, `roster read ${reads} cards for ${cards.length} entries`);
});

test("roster filtering retains order, retirement rules and first-entry duplicate semantics", () => {
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "roster", encounterId: "rules", capturedAt: "2026-10-06T00:00:00.000Z" });
  const alive = { ...card, id: "alive" }, dead = { ...card, id: "dead" };
  admitLocallySealedWildsInventory([alive, dead]);
  const invalid = { ...card, id: "invalid", proof: { ...card.proof, digest: "invalid" } };
  const duplicate = { ...alive, id: "invalid" };
  admitLocallySealedWildsInventory([duplicate]);
  const conditions: PlayState["adventureConditions"] = { dead: { ...emptyAdventureCondition("dead"), life: "dead" } };
  assert.deepEqual(playableInventory({ inventory: [alive, dead, invalid, duplicate], adventureConditions: conditions }), [alive]);
});
