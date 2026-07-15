import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsBiome } from "../src/features/play/wilds-biome";

describe("Verdant Crown biome projection", () => {
  it("regenerates a world tile from stable inputs", () => {
    const first = projectWildsBiome(3, -7, 38);
    assert.deepEqual(first, projectWildsBiome(3, -7, 38));
    assert.notDeepEqual(first, projectWildsBiome(4, -7, 38));
  });

  it("keeps ecology bounded and reserves the origin sanctuary", () => {
    const tile = projectWildsBiome(3, -7, 38);
    assert.ok(["sun-shower", "pollen-drift", "clear"].includes(tile.weather));
    assert.ok(tile.ecology.treeCount >= 2 && tile.ecology.treeCount <= 5);
    assert.ok(tile.ecology.bushCount >= 4 && tile.ecology.bushCount <= 8);
    assert.equal(projectWildsBiome(0, 0, 100).landmark.kind, "hearttree-sanctum");
  });

  it("uses progression only for visible world richness", () => {
    const early = projectWildsBiome(8, 2, 0);
    const mastered = projectWildsBiome(8, 2, 100);
    assert.equal(early.seed, mastered.seed);
    assert.ok(mastered.ecology.flowerCount >= early.ecology.flowerCount);
    assert.ok(mastered.luminosity >= early.luminosity);
  });
});
