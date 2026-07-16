import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  projectRegionalStory,
  projectHistoricalAtlas,
  projectEnvironmentalAftermath,
  projectReturnContinuity,
  createWorldMemorial,
  createCelebrationMemory,
  type NarrativeMemoryRecord
} from "../src/features/play/wilds-narrative-memory.js";

describe("Slice 7 narrative, memory, and emotional life", () => {
  it("projects the same regional story and characters from the same season seed", () => {
    const first = projectRegionalStory({ regionId: "crystal-coast", seasonSeed: "season:7" });
    assert.deepEqual(first, projectRegionalStory({ regionId: "crystal-coast", seasonSeed: "season:7" }));
    assert.equal(first.characters.length, 3);
    assert.ok(first.chapters.length >= 3);
    assert.notEqual(first.chapters[0]?.id, projectRegionalStory({ regionId: "ember-steppe", seasonSeed: "season:7" }).chapters[0]?.id);
  });

  it("builds historical atlas layers without duplicate memories", () => {
    const records: NarrativeMemoryRecord[] = [
      { memoryId: "memory:festival:1", kind: "celebration", regionId: "crystal-coast", title: "Lantern Tide", summary: "The coast sang together.", occurredAt: "2026-07-15T00:00:00.000Z", sourceEventId: "evt:1", digest: "sha256:1" },
      { memoryId: "memory:festival:1", kind: "celebration", regionId: "crystal-coast", title: "Lantern Tide", summary: "The coast sang together.", occurredAt: "2026-07-15T00:00:00.000Z", sourceEventId: "evt:1", digest: "sha256:1" },
      { memoryId: "memory:ruin:2", kind: "aftermath", regionId: "crystal-coast", title: "Archive opened", summary: "A route remembers the brave.", occurredAt: "2026-07-16T00:00:00.000Z", sourceEventId: "evt:2", digest: "sha256:2" }
    ];
    const atlas = projectHistoricalAtlas(records);
    assert.equal(atlas.layers.length, 2);
    assert.equal(atlas.regions["crystal-coast"], 2);
  });

  it("maps canonical events to bounded environmental aftermath and continuity", () => {
    const aftermath = projectEnvironmentalAftermath({ familyId: "stormfront", eventId: "evt:storm" });
    assert.equal(aftermath.module, "charged-biome");
    assert.ok(aftermath.visualKit.length > 0);
    const continuity = projectReturnContinuity({ playerName: "Ari", regionId: "crystal-coast", memories: [{ title: "Lantern Tide", occurredAt: "2026-07-15T00:00:00.000Z" }] });
    assert.match(continuity.greeting, /Ari/);
    assert.equal(continuity.recap[0], "Lantern Tide");
    assert.ok(continuity.nextHook.length > 0);
  });

  it("creates proof-bound memorials and celebrations idempotently", () => {
    const input = { sourceEventId: "evt:defeat", regionId: "crystal-coast", title: "The Crystal Burrow remembers", summary: "A new path opened.", occurredAt: "2026-07-15T00:00:00.000Z" } as const;
    const memorial = createWorldMemorial(input);
    assert.deepEqual(memorial, createWorldMemorial(input));
    assert.match(memorial.memoryId, /^memory:/);
    const celebration = createCelebrationMemory({ ...input, sourceEventId: "evt:festival", title: "Lantern Tide", summary: "Every explorer added a light." });
    assert.equal(celebration.kind, "celebration");
    assert.notEqual(memorial.memoryId, celebration.memoryId);
  });
});
