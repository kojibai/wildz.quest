import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WILDS_SAGA_FRAMEWORK_VERSION, wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";

describe("Wilds authored Kai saga framework", () => {
  it("ships one pinned six-day arc with complete Ark, mission, trainer, achievement, and tournament content", () => {
    const framework = wildsSagaFramework();
    assert.equal(WILDS_SAGA_FRAMEWORK_VERSION, "kai-saga.v1");
    assert.equal(framework.version, WILDS_SAGA_FRAMEWORK_VERSION);
    assert.equal(framework.dailyChapters.length, 6);
    assert.deepEqual(framework.dailyChapters.map((chapter) => chapter.dayIndex), [0, 1, 2, 3, 4, 5]);
    for (const chapter of framework.dailyChapters) {
      assert.deepEqual(Object.keys(chapter.acts), ["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"]);
      assert.ok(chapter.missions.some((mission) => mission.primary));
      assert.ok(chapter.trainers.length >= 3);
      assert.ok(chapter.achievements.length >= 1);
      assert.ok(chapter.tournament);
      assert.doesNotMatch(JSON.stringify(chapter), /brandable|merchant reward|coupon|businessUse/i);
    }
  });

  it("pins persistent characters and a recurring rival", () => {
    const framework = wildsSagaFramework();
    assert.deepEqual(framework.characters.slice(0, 3).map((character) => character.name), ["Sola Reed", "Mira Vale", "Oren Moss"]);
    assert.ok(framework.characters.some((character) => character.role === "rival"));
    assert.ok(framework.characters.some((character) => character.role === "champion"));
  });
});
