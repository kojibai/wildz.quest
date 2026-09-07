import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cumulativeWildsConstructionMaterials,
  cumulativeWildsConstructionWork,
  WILDS_CONSTRUCTION_RECIPES,
  wildsConstructionRecipe
} from "../src/features/play/wilds-construction-recipes";
import { WILDS_CONSTRUCTION_CATALOG } from "../src/features/play/wilds-world-construction";

const MATRIX = {
  foundation: [[0, 0, 2, 1], [0, 1, 1, 1], [1, 0, 0, 1], "support"],
  floor: [[0, 2, 1, 1], [1, 1, 0, 1], [1, 1, 0, 1], "floor"],
  room: [[0, 3, 1, 2], [3, 1, 0, 2], [2, 1, 0, 1], "shelter"],
  wall: [[0, 2, 1, 1], [2, 1, 0, 1], [1, 1, 0, 1], "cover"],
  roof: [[0, 2, 0, 1], [4, 1, 0, 2], [2, 0, 0, 1], "cover"],
  door: [[0, 1, 0, 1], [0, 1, 0, 1], [1, 0, 0, 1], "traversal"],
  window: [[0, 1, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], "daylight"],
  column: [[0, 1, 1, 1], [0, 1, 1, 1], [1, 0, 0, 1], "support"],
  stair: [[0, 2, 1, 1], [0, 2, 0, 2], [1, 0, 0, 1], "traversal"],
  bridge: [[0, 3, 2, 2], [0, 3, 1, 2], [2, 1, 0, 1], "traversal"],
  platform: [[0, 2, 1, 1], [0, 2, 1, 2], [1, 1, 0, 1], "traversal"],
  path: [[0, 0, 2, 1], [1, 0, 1, 1], [1, 0, 1, 1], "traversal"],
  storage: [[0, 2, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], "storage"],
  workshop: [[0, 2, 1, 1], [0, 2, 1, 2], [1, 1, 0, 1], "workshop"],
  habitat: [[0, 2, 1, 1], [3, 1, 0, 2], [2, 0, 0, 1], "habitat"],
  bed: [[1, 1, 0, 1], [2, 1, 0, 1], [1, 0, 0, 1], "rest"],
  hearth: [[0, 0, 2, 1], [1, 1, 1, 2], [1, 0, 1, 1], "rest"],
  light: [[0, 1, 1, 1], [1, 0, 0, 1], [1, 0, 0, 1], "light"],
  garden: [[1, 1, 1, 1], [2, 1, 1, 2], [1, 0, 0, 1], "garden"],
  water: [[0, 0, 2, 1], [1, 1, 2, 2], [1, 0, 1, 1], "water"],
  trim: [[1, 1, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], null],
  railing: [[0, 2, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1], "safety"],
  partition: [[1, 1, 0, 1], [2, 1, 0, 1], [1, 0, 0, 1], "cover"]
} as const;

describe("Wilds construction recipes", () => {
  it("defines the exact three-stage recipe matrix for every catalog kind", () => {
    assert.equal(WILDS_CONSTRUCTION_RECIPES.length, 23);
    assert.deepEqual(WILDS_CONSTRUCTION_CATALOG.map((entry) => entry.kind), Object.keys(MATRIX));
    for (const entry of WILDS_CONSTRUCTION_CATALOG) {
      const recipe = wildsConstructionRecipe(entry.kind);
      const expected = MATRIX[entry.kind];
      assert.deepEqual(recipe.stages.map((stage) => [stage.materials.hay, stage.materials.timber, stage.materials.stone, stage.work]), expected.slice(0, 3));
      assert.equal(recipe.functionId, expected[3]);
      assert.equal(recipe.salvagePercent, 50);
      assert.deepEqual(recipe.stages.map((stage) => stage.stage), ["framed", "functional", "finished"]);
      assert.equal(Object.isFrozen(recipe) && Object.isFrozen(recipe.stages) && recipe.stages.every((stage) => Object.isFrozen(stage.materials)), true);
    }
  });

  it("returns exact cumulative material and work requirements", () => {
    const room = wildsConstructionRecipe("room");
    assert.deepEqual(cumulativeWildsConstructionMaterials(room, "functional"), { hay: 3, timber: 4, stone: 1 });
    assert.equal(cumulativeWildsConstructionWork(room, "functional"), 4);
    assert.deepEqual(cumulativeWildsConstructionMaterials(room, "planned"), { hay: 0, timber: 0, stone: 0 });
    assert.equal(cumulativeWildsConstructionWork(room, "planned"), 0);
    assert.throws(() => wildsConstructionRecipe("unknown" as never), /recipe_unknown/);
  });
});
