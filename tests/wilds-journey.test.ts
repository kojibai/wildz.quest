import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseWildsJourney, rememberWildsJourney, sanitizeWildsJourney, sanitizeWildsJourneyInput,
  wildsJourneyMemoryId, wildsJourneyStorageKey, WILDS_JOURNEY_LIMIT,
  type WildsJourneyInput, type WildsJourneyMemory
} from "../src/features/play/wilds-journey.js";

const event = (overrides: Partial<WildsJourneyInput> = {}): WildsJourneyInput => ({
  kind: "harvest", subjectId: "tree:1", companionId: "creature:fern", companionName: "Fern",
  label: "Fern helped gather timber", position: { x: 12, z: -5 }, ...overrides
});

describe("shared companion journey", () => {
  it("records only supplied facts and preserves the first meeting across renames and places", () => {
    const first = rememberWildsJourney([], event({ kind: "met", subjectId: "meadow", label: "Met Fern" }), 100);
    const repeated = rememberWildsJourney(first, event({ kind: "met", subjectId: "hill", companionName: "Sprig" }), 200);
    assert.equal(repeated, first);
    assert.equal(first[0].timestamp, 100);
    assert.deepEqual(first[0].position, { x: 12, z: -5 });
    assert.equal(first[0].label, "Met Fern");
  });

  it("deduplicates the same completed action but retains different companions and subjects", () => {
    const first = rememberWildsJourney([], event(), 100);
    assert.equal(rememberWildsJourney(first, event(), 200), first);
    const second = rememberWildsJourney(first, event({ subjectId: "tree:2" }), 200);
    assert.equal(rememberWildsJourney(second, event({ companionId: "creature:ember" }), 300).length, 3);
    assert.notEqual(wildsJourneyMemoryId(event({ subjectId: "a:b", companionId: "c" })),
      wildsJourneyMemoryId(event({ subjectId: "a", companionId: "b:c" })));
  });

  it("keeps a bounded recent journal", () => {
    let memories: readonly WildsJourneyMemory[] = [];
    for (let i = 0; i < 100; i++) memories = rememberWildsJourney(memories, event({ subjectId: `tree:${i}` }), i);
    assert.equal(memories.length, WILDS_JOURNEY_LIMIT);
    assert.equal(memories[0].subjectId, "tree:20");
    assert.equal(memories.at(-1)?.subjectId, "tree:99");
  });

  it("rejects corrupt storage, invalid positions, invented kinds and ungrounded meetings", () => {
    assert.deepEqual(parseWildsJourney("not json"), []);
    assert.deepEqual(parseWildsJourney('{"memories":[]}'), []);
    assert.deepEqual(parseWildsJourney(" ".repeat(300_001)), []);
    assert.equal(sanitizeWildsJourneyInput(event({ kind: "reward" as "harvest" })), null);
    assert.equal(sanitizeWildsJourneyInput(event({ position: { x: Infinity, z: 0 } })), null);
    assert.equal(sanitizeWildsJourneyInput(event({ kind: "met", companionId: undefined })), null);
    assert.deepEqual(sanitizeWildsJourney([{ ...event(), timestamp: -1 }]), []);
    assert.equal(rememberWildsJourney([], event(), NaN).length, 0);
  });

  it("rebuilds identities from valid fields and ignores extra authority claims", () => {
    const rows = sanitizeWildsJourney([
      { ...event(), timestamp: 200, id: "forged", reward: 50 },
      { ...event(), timestamp: 100, id: "another-forged" }
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, wildsJourneyMemoryId(event()));
    assert.equal(rows[0].timestamp, 100);
    assert.equal("reward" in rows[0], false);
    assert.deepEqual(parseWildsJourney(JSON.stringify(rows)), rows);
  });

  it("scopes persistence by exact owner and bounds display text", () => {
    assert.notEqual(wildsJourneyStorageKey("wilds:a/b"), wildsJourneyStorageKey("wilds:a%2Fb"));
    assert.notEqual(wildsJourneyStorageKey("alice"), wildsJourneyStorageKey("bob"));
    const clean = sanitizeWildsJourneyInput(event({ label: "x".repeat(500), companionName: "y".repeat(500) }));
    assert.equal(clean?.label.length, 240);
    assert.equal(clean?.companionName?.length, 80);
  });
});
