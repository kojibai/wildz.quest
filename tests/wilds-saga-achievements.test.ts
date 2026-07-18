import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga, wildsSagaInstanceIds } from "../src/features/play/wilds-saga-director.js";
import { achievementGrantCandidates, projectPlayerSagaProgress, projectSagaReturnContinuity } from "../src/features/play/wilds-saga-achievements.js";

const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "world" });
const saga = projectWildsSaga({ moment, framework: wildsSagaFramework(), memories: [] });
const ids = wildsSagaInstanceIds(moment);

describe("Wilds saga achievements", () => {
  it("creates one deterministic daily grant and projects trainer level", () => {
    const definition = saga.chapter.achievements[0]!;
    const events = definition.acceptedVerbs.map((verb, index) => ({ eventId: `wve:cause:${index}`, playerId: "player:ari", verb, amount: index === 0 ? 2 : 1 }));
    const input = { definitions: saga.chapter.achievements, playerId: "player:ari", scopeInstanceIds: { day: ids.dayId, week: ids.weekId, month: ids.monthId, year: ids.yearId, lifetime: "saga:lifetime" }, events, existingGrantIds: [] } as const;
    const candidates = achievementGrantCandidates(input);
    assert.equal(candidates.length, 1);
    assert.deepEqual(candidates, achievementGrantCandidates(input));
    assert.match(candidates[0]!.grantId, /^grant:/);
    assert.deepEqual(projectPlayerSagaProgress({ trainerXp: 250, achievements: candidates }), { trainerXp: 250, trainerLevel: 3, nextLevelAt: 300, title: "Trail Keeper" });
  });

  it("projects a deterministic causal return summary", () => {
    const memories = [{ chapterId: "chapter:prior", dayId: "saga:day:prior", outcome: "failure" as const, hookId: "route-scarred", settledEventId: "wve:prior", settledAt: "2026-07-16T00:00:00.000Z" }];
    const continuity = projectSagaReturnContinuity({ playerName: "Ari", saga, memories });
    assert.match(continuity.greeting, /Ari/);
    assert.match(continuity.causeSummary, /because/i);
    assert.deepEqual(continuity.memories, memories);
  });
});
