import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  admitActivityCard,
  advanceActivity,
  createLandmarkSession,
  exitActivity,
  grantActivityReward,
  resolveActivityResult
} from "../src/features/play/wilds-activity-core";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { applyHearttreeIntent, createHearttreeTrial } from "../src/features/play/hearttree-trial";
import { applyArenaIntent, createArenaMatch } from "../src/features/play/arena-match";
import { applyPrismIntent, createPrismRun } from "../src/features/play/prism-run";
import { evaluateLandmarkAccess } from "../src/features/play/wilds-landmark-access";
import { WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks";

const now = "2026-07-15T12:00:00.000Z";
const card = sealCollectedCard({
  capturedAt: now,
  encounterId: "landmark-card-1",
  formId: "mintcub-1",
  ownerReceizId: "player-1"
});

describe("Wilds landmark activity lifecycle", () => {
  it("keeps public places open and makes progression gates explainable", () => {
    const hearttree = WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === "hearttree-sanctum")!;
    const arena = WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === "arena-of-echoes")!;
    const prism = WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === "prism-arcade")!;
    const newcomer = { verifiedCardCount: 1, activeCardLevel: 1, achievementIds: [] as string[], partySize: 1 };

    assert.equal(evaluateLandmarkAccess(hearttree, newcomer).allowed, true);
    assert.equal(evaluateLandmarkAccess(arena, newcomer).allowed, false);
    assert.match(evaluateLandmarkAccess(arena, newcomer).summary, /level 2|Hearttree/i);
    assert.equal(evaluateLandmarkAccess(arena, { ...newcomer, activeCardLevel: 2 }).allowed, true);
    assert.equal(evaluateLandmarkAccess(prism, { ...newcomer, verifiedCardCount: 3 }).allowed, true);
    assert.equal(evaluateLandmarkAccess(prism, { ...newcomer, achievementIds: ["echo-victor"] }).allowed, true);
  });

  it("admits one exact verified card and advances append-only", () => {
    const lobby = createLandmarkSession({
      actorIds: ["player-1"],
      createdAt: now,
      id: "session-1",
      landmarkId: "hearttree-sanctum",
      returnCoordinate: { x: 1, z: 2 }
    });
    const ready = admitActivityCard(lobby, "player-1", card, "admit-1");

    assert.equal(ready.phase, "ready");
    assert.equal(ready.admissions["player-1"]?.proofDigest, card.proof.digest);
    assert.equal(ready.revision, 1);
    assert.deepEqual(admitActivityCard(lobby, "player-1", card, "admit-1"), ready);

    const altered = structuredClone(card);
    altered.manifest.name = "Altered";
    assert.throws(() => admitActivityCard(lobby, "player-1", altered, "admit-2"), /verification/);
    assert.throws(() => admitActivityCard(lobby, "stranger", card, "admit-3"), /actor/);
  });

  it("locks results, grants one reward, and preserves the return coordinate", () => {
    const lobby = createLandmarkSession({
      actorIds: ["player-1"], createdAt: now, id: "session-2",
      landmarkId: "hearttree-sanctum", returnCoordinate: { x: 7, z: -4 }
    });
    const active = advanceActivity(admitActivityCard(lobby, "player-1", card, "admit"), "player-1", "start");
    const result = resolveActivityResult(active, { digest: `sha256:${"b".repeat(64)}`, score: 840, winnerActorId: "player-1" }, "result");
    const rewarded = grantActivityReward(result, { id: "hearttree-awakened", kind: "achievement" }, "reward");

    assert.equal(rewarded.phase, "reward");
    assert.equal(rewarded.reward?.id, "hearttree-awakened");
    assert.throws(() => resolveActivityResult(result, { digest: `sha256:${"c".repeat(64)}`, score: 1 }, "changed"), /result_locked/);
    assert.throws(() => grantActivityReward(rewarded, { id: "other", kind: "cosmetic" }, "other-reward"), /reward_locked/);
    const exited = exitActivity(rewarded, "player-1", "exit");
    assert.equal(exited.phase, "exited");
    assert.deepEqual(exited.returnCoordinate, { x: 7, z: -4 });
  });

  it("replays a Hearttree trial and grants one bounded mastery reward", () => {
    const intents = ["pulse", "north", "guard", "ability:0"] as const;
    const first = intents.reduce(applyHearttreeIntent, createHearttreeTrial("hearttree-seed", card));
    const replay = intents.reduce(applyHearttreeIntent, createHearttreeTrial("hearttree-seed", card));

    assert.deepEqual(replay, first);
    assert.equal(first.phase, "result");
    assert.equal(first.reward?.kind, "achievement");
    assert.equal(first.reward?.unlockId, "hearttree-awakened");
    assert.equal(new Set(first.events.map((event) => event.id)).size, first.events.length);
    assert.equal(first.admittedProofDigest, card.proof.digest);
  });

  it("replays an Arena duel and seals one proof-pinned victory", () => {
    const intents = ["focus", "guard", "strike", "strike"] as const;
    const first = intents.reduce(applyArenaIntent, createArenaMatch("arena-seed", card));
    const replay = intents.reduce(applyArenaIntent, createArenaMatch("arena-seed", card));

    assert.deepEqual(replay, first);
    assert.equal(first.phase, "result");
    assert.equal(first.reward?.kind, "achievement");
    assert.equal(first.reward?.unlockId, "echo-victor");
    assert.equal(first.admittedProofDigest, card.proof.digest);
    assert.equal(new Set(first.events.map((event) => event.id)).size, first.events.length);
  });

  it("replays a Prism co-op run and unlocks one bounded cosmetic", () => {
    const intents = ["sync", "left", "right", "burst"] as const;
    const first = intents.reduce(applyPrismIntent, createPrismRun("prism-seed", card));
    const replay = intents.reduce(applyPrismIntent, createPrismRun("prism-seed", card));

    assert.deepEqual(replay, first);
    assert.equal(first.phase, "result");
    assert.equal(first.reward?.kind, "cosmetic");
    assert.equal(first.reward?.unlockId, "prism-trail");
    assert.equal(first.admittedProofDigest, card.proof.digest);
    assert.equal(new Set(first.events.map((event) => event.id)).size, first.events.length);
  });
});
