import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { createArenaLivingRevision, deriveArenaLifeState, verifyArenaLivingRevision } from "../src/features/play/arena/living-revision";

function revisionInput(assetId = "card:arena:one") {
  return {
    assetId,
    eventId: "arena:event:genesis",
    rulesetId: "wilds.arena.v1",
    occurredAt: "2026-07-16T20:00:00.000Z",
    condition: emptyAdventureCondition(assetId),
    scarIds: [], relationshipIds: [], achievementIds: [], evolutionIds: [], matchReceiptDigests: [],
  } as const;
}

describe("Arena living revision chain", () => {
  it("creates and verifies a content-addressed genesis revision", () => {
    const revision = createArenaLivingRevision(revisionInput());
    assert.equal(revision.revision, 1);
    assert.equal(revision.parentDigest, null);
    assert.equal(revision.lifeState, "healthy");
    assert.match(revision.digest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(verifyArenaLivingRevision(revision), { ok: true, errors: [] });
    assert.equal(createArenaLivingRevision(revisionInput()).digest, revision.digest);
  });

  it("requires an exact parent and advances one canonical revision", () => {
    const parent = createArenaLivingRevision(revisionInput());
    const child = createArenaLivingRevision({
      ...revisionInput(), parent, eventId: "arena:event:match:one", occurredAt: "2026-07-16T20:05:00.000Z",
      condition: { ...parent.condition, fatigue: 24 }, achievementIds: ["arena:first-step"],
    });
    assert.equal(child.revision, 2);
    assert.equal(child.parentDigest, parent.digest);
    assert.equal(child.lifeState, "strained");
    assert.deepEqual(verifyArenaLivingRevision(child, parent), { ok: true, errors: [] });
    assert.equal(verifyArenaLivingRevision(child).ok, false);
    assert.equal(verifyArenaLivingRevision({ ...child, parentDigest: `sha256:${"0".repeat(64)}` }, parent).ok, false);
  });

  it("derives embodied condition bands deterministically", () => {
    const base = emptyAdventureCondition("card:bands");
    assert.equal(deriveArenaLifeState(base), "healthy");
    assert.equal(deriveArenaLifeState({ ...base, fatigue: 25 }), "strained");
    assert.equal(deriveArenaLifeState({ ...base, fatigue: 65 }), "wounded");
    assert.equal(deriveArenaLifeState({ ...base, fatigue: 88 }), "critical");
    assert.equal(deriveArenaLifeState({ ...base, fatigue: 98 }), "mortal");
    assert.equal(deriveArenaLifeState({ ...base, life: "dead", retiredAt: "2026-07-16T20:10:00.000Z", retirementCauseEventId: "arena:event:zero" }), "retired");
  });

  it("makes retirement irreversible across every descendant", () => {
    const assetId = "card:retired";
    const retired = createArenaLivingRevision({
      ...revisionInput(assetId), eventId: "arena:event:zero",
      condition: { ...emptyAdventureCondition(assetId), life: "dead", retiredAt: "2026-07-16T20:10:00.000Z", retirementCauseEventId: "arena:event:zero" },
    });
    assert.equal(retired.lifeState, "retired");
    assert.throws(() => createArenaLivingRevision({
      ...revisionInput(assetId), parent: retired, condition: emptyAdventureCondition(assetId), eventId: "arena:event:illegal-revival",
    }), /arena_revision_retirement_irreversible/);
  });

  it("rejects tampering, invalid chronology, duplicate history, and foreign assets", () => {
    const parent = createArenaLivingRevision(revisionInput());
    assert.throws(() => createArenaLivingRevision({ ...revisionInput("card:other"), parent }), /arena_revision_parent_asset_invalid/);
    assert.throws(() => createArenaLivingRevision({ ...revisionInput(), parent, occurredAt: "2026-07-16T19:00:00.000Z" }), /arena_revision_time_invalid/);
    assert.throws(() => createArenaLivingRevision({ ...revisionInput(), scarIds: ["scar:one", "scar:one"] }), /arena_revision_history_invalid/);
    assert.equal(verifyArenaLivingRevision({ ...parent, eventId: "arena:event:tampered" }).ok, false);
  });
});
