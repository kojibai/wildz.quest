import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWildsInput, initialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state.js";
import {
  createWildsEcologyReceipt,
  projectWildsEcologyHistory,
  verifyWildsEcologyReceipt
} from "../src/features/play/wilds-ecology-history.js";

const receipt = createWildsEcologyReceipt({
  actorId: "wilds.player.receiz.id",
  siteId: "ecology:echo-ruin:0123456789abcdef01234567",
  familyId: "echo-ruin",
  kind: "activity.accepted",
  sourceEventId: `wve:${"a".repeat(64)}`,
  occurredAt: "2026-07-15T22:00:00.000Z",
  canonicalRevision: 18,
  mastery: 5,
  cardProofDigest: `sha256:${"b".repeat(64)}`
});

describe("Wilds ecology player history", () => {
  it("projects a valid receipt once and rejects tampering", () => {
    const projection = projectWildsEcologyHistory([receipt, receipt]);

    assert.equal(projection.events.length, 1);
    assert.equal(projection.mastery["echo-ruin"], 5);
    assert.equal(projection.knowledge[receipt.siteId]?.visibility, "exact");
    assert.equal(verifyWildsEcologyReceipt({ ...receipt, mastery: 99 }).ok, false);
  });

  it("records ecology history once and serializes Save V9", () => {
    const once = applyWildsInput(initialPlayState, { type: "record-ecology-event", event: receipt });
    const duplicate = applyWildsInput(once, { type: "record-ecology-event", event: receipt });
    const envelope = JSON.parse(serializePlayState(once));

    assert.equal(envelope.schema, "receiz.wilds.save.v9");
    assert.deepEqual(once.ecologyEvents, [receipt]);
    assert.equal(once.ecologyMastery["echo-ruin"], 5);
    assert.deepEqual(duplicate, once);
    assert.deepEqual(restorePlayState(serializePlayState(once)).ecologyEvents, [receipt]);
  });

  it("migrates V6 with safe ecology defaults", () => {
    const legacy = { ...initialPlayState } as Record<string, unknown>;
    delete legacy.ecologyEvents;
    delete legacy.ecologyKnowledge;
    delete legacy.ecologyMastery;

    const migrated = restorePlayState(JSON.stringify({ schema: "receiz.wilds.save.v6", state: legacy }));

    assert.deepEqual(migrated.ecologyEvents, []);
    assert.deepEqual(migrated.ecologyKnowledge, {});
    assert.equal(migrated.ecologyMastery["echo-ruin"], 0);
  });
});
