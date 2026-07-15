import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWorldProgression, worldMasteryAward, WILDS_WORLD_CHAPTERS } from "../src/features/play/world-progression";

describe("Wilds endless world progression", () => {
  it("cycles through five authored chapters without a terminal cap", () => {
    assert.equal(WILDS_WORLD_CHAPTERS.length, 5);
    assert.equal(projectWorldProgression(0).chapter.id, "verdant-crown");
    assert.equal(projectWorldProgression(100).chapter.id, "ember-reach");
    assert.equal(projectWorldProgression(400).chapter.id, "umbral-bloom");
    assert.equal(projectWorldProgression(500).chapter.id, "verdant-crown");
    assert.equal(projectWorldProgression(500).cycle, 2);
    assert.equal(projectWorldProgression(50_000).cycle > 50, true);
  });

  it("projects deterministic events whose challenge grows by cycle", () => {
    const first = projectWorldProgression(240);
    const replay = projectWorldProgression(240);
    const later = projectWorldProgression(740);
    assert.deepEqual(replay, first);
    assert.equal(first.worldEvent.chapterId, first.chapter.id);
    assert.equal(later.worldEvent.target > first.worldEvent.target, true);
  });

  it("only awards mastery for authoritative gameplay verbs", () => {
    assert.equal(worldMasteryAward("travel"), 1);
    assert.equal(worldMasteryAward("battle"), 8);
    assert.equal(worldMasteryAward("capture"), 18);
    assert.equal(worldMasteryAward("mission"), 25);
    assert.equal(worldMasteryAward("lineage"), 45);
    assert.equal(worldMasteryAward("ascension"), 60);
  });
});
