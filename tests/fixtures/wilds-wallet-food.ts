import assert from "node:assert/strict";
import { createWildsAnimalFoodReceipt, wildsWildAnimalsForTile } from "../../src/features/play/wilds-animal-ecology";
import { createWildsNourishmentState, creditWildsAnimalFood, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt, type WildsNourishmentPlant } from "../../src/features/play/wilds-nourishment";

export function walletFoodFixture(owner = "explorer") {
  const plants = new Map<string, WildsNourishmentPlant>();
  let animal;
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
    for (const plant of wildsNourishmentPlantsForTile(x, z)) if (!plants.has(plant.foodKind)) plants.set(plant.foodKind, plant);
    animal ??= wildsWildAnimalsForTile(x, z).find(candidate => candidate.species === "ground-bird");
  }
  let nourishment = createWildsNourishmentState(owner);
  for (const [kind, portions] of [["orchard-fruit", 2], ["wild-berries", 1], ["wild-vegetable", 2]] as const) {
    const plant = plants.get(kind);
    assert.ok(plant);
    for (let portion = 0; portion < portions; portion++) {
      const gathered = gatherWildsNourishment({ state: nourishment, ownerReceizId: owner, sourceId: plant.sourceId,
        expectedSourceHead: wildsNourishmentSourceAt(plant, nourishment.sources[plant.sourceId], 100).head,
        kaiUPulse: 100, player: plant.position, spaceId: "wildz.space.outer.v1" });
      assert.equal(gathered.ok, true);
      nourishment = gathered.state;
    }
  }
  assert.ok(animal);
  const meat = creditWildsAnimalFood(nourishment, createWildsAnimalFoodReceipt(animal, "hunt", 0, 100));
  assert.equal(meat.ok, true);
  return { nourishment: meat.state, meatLabel: `${animal.label} meat` };
}
