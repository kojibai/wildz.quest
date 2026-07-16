import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWildsInput, initialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state.js";
import { createWildsRaidReceipt, projectWildsRaidHistory } from "../src/features/play/wilds-raid-history.js";

const receipt = createWildsRaidReceipt({
  actorId: "player-1", bossId: "boss:crystal:one", familyId: "crystal-burrower", roundId: "round:one",
  actionId: "action:strike:one", sourceEventId: "wve:raid:one", kind: "action", role: "striker", placement: "fighter",
  contributionBand: "strong", result: "accepted", revision: 12, occurredAt: "2026-07-15T12:00:00.000Z",
  cardProofDigest: `sha256:${"a".repeat(64)}`
});

describe("portable raid history", () => {
  it("accepts proof-bound participation once and rejects a forged winning receipt", () => {
    const forged = { ...receipt, sourceEventId: "wve:raid:forged", result: "victory" as const };
    const projection = projectWildsRaidHistory([receipt, receipt, forged]);
    assert.deepEqual(projection.events, [receipt]);
    assert.equal(projection.mastery[receipt.familyId] > 0, true);
    assert.deepEqual(projection.achievements, ["raid-first-contact"]);
  });

  it("migrates V7 and restores V8 raid history", () => {
    const v7 = JSON.stringify({ schema: "receiz.wilds.save.v7", state: initialPlayState });
    assert.deepEqual(restorePlayState(v7).raidEvents, []);
    const state = { ...initialPlayState, raidEvents: [receipt] };
    const serialized = serializePlayState(state);
    assert.match(serialized, /receiz\.wilds\.save\.v8/);
    assert.deepEqual(restorePlayState(serialized).raidEvents, [receipt]);
  });

  it("records an accepted canonical receipt once in player state", () => {
    const once = applyWildsInput(initialPlayState, { type: "record-raid-event", event: receipt });
    const replay = applyWildsInput(once, { type: "record-raid-event", event: receipt });
    assert.deepEqual(once.raidEvents, [receipt]);
    assert.deepEqual(replay, once);
  });
});
