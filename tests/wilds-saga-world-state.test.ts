import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWildsWorldEvent, type WildsWorldEvent, type WildsWorldEventKind } from "../src/features/play/wilds-world-event.js";
import { initialWildsWorldProjection, reduceWildsWorldEvent } from "../src/features/play/wilds-world-state.js";

function sagaEvent(input: {
  kind: string;
  payload: unknown;
  kaiKlok: number;
  previous: WildsWorldEvent | null;
  causeId: string;
}) {
  return createWildsWorldEvent({
    kind: input.kind as WildsWorldEventKind,
    actorId: input.kind === "story.objective_contributed" ? "player:ari" : "receiz:pulse",
    causeId: input.causeId,
    pulse: "2026-07-16T12:00:00.000Z",
    kaiKlok: input.kaiKlok,
    occurredAt: `2026-07-16T12:00:0${input.kaiKlok}.000Z`,
    previousEventId: input.previous?.eventId ?? null,
    payload: input.payload
  });
}

describe("Wilds saga world replay", () => {
  it("replays one chapter, contribution, settlement, and achievement idempotently", () => {
    const chapter = { dayId: "saga:day:Y2:M4:D11", chapterId: "chapter:first-light", frameworkVersion: "kai-saga.v1", openedAt: "2026-07-16T00:00:00.000Z", endsAt: "2026-07-17T00:00:00.000Z" };
    const opened = sagaEvent({ kind: "story.chapter_opened", payload: { chapter }, kaiKlok: 1, previous: null, causeId: "story:open" });
    const contribution = sagaEvent({ kind: "story.objective_contributed", payload: { dayId: chapter.dayId, objectiveId: "objective:follow-first-light", playerId: "player:ari", verb: "travel", amount: 1 }, kaiKlok: 2, previous: opened, causeId: "story:contribute" });
    const memory = { chapterId: chapter.chapterId, dayId: chapter.dayId, outcome: "partial", hookId: "route-scarred", settledEventId: `wve:${"a".repeat(64)}`, settledAt: "2026-07-17T00:00:00.000Z" };
    const settled = sagaEvent({ kind: "story.chapter_settled", payload: { memory }, kaiKlok: 3, previous: contribution, causeId: "story:settle" });
    const grant = { grantId: "grant:player:ari:first-light", playerId: "player:ari", definitionId: "achievement:first-light", scopeInstanceId: chapter.dayId, reward: { id: "title:first-light", kind: "title", label: "First Light" } };
    const granted = sagaEvent({ kind: "story.achievement_granted", payload: { grant }, kaiKlok: 4, previous: settled, causeId: "story:grant" });

    let state = initialWildsWorldProjection();
    for (const event of [opened, contribution, settled, granted]) state = reduceWildsWorldEvent(state, event);

    assert.equal(state.story.activeChapter?.dayId, chapter.dayId);
    assert.equal(state.story.objectiveTotals["objective:follow-first-light"], 1);
    assert.equal(state.players["player:ari"]?.contributions["objective:follow-first-light"], 1);
    assert.deepEqual(state.story.memories, [memory]);
    assert.deepEqual(state.players["player:ari"]?.achievementGrantIds, [grant.grantId]);
    assert.strictEqual(reduceWildsWorldEvent(state, granted), state);

    const divergent = sagaEvent({ kind: "story.achievement_granted", payload: { grant: { ...grant, reward: { ...grant.reward, label: "Changed" } } }, kaiKlok: 5, previous: granted, causeId: "story:grant:divergent" });
    assert.throws(() => reduceWildsWorldEvent(state, divergent), /wilds_story_achievement_divergent/);
  });
});
