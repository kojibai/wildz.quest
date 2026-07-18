import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga } from "../src/features/play/wilds-saga-director.js";
import { evaluateMissionContribution, projectMissionGraph } from "../src/features/play/wilds-saga-missions.js";

const saga = projectWildsSaga({
  moment: deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "world" }),
  framework: wildsSagaFramework(),
  memories: []
});

describe("Wilds saga mission graph", () => {
  it("directs the next primary objective and unlocks prerequisites in order", () => {
    const first = projectMissionGraph({ saga, playerId: "player:ari", contributions: [], currentDayId: saga.dayId });
    const firstNode = saga.chapter.missions.find((mission) => mission.primary)?.nodes[0];
    assert.equal(first.recommended?.definition.id, firstNode?.id);
    assert.equal(first.recommended?.echo, false);
    assert.equal(evaluateMissionContribution({ node: first.recommended!.definition, verb: "battle", amount: 1 }), 0);

    const progressed = projectMissionGraph({
      saga,
      playerId: "player:ari",
      currentDayId: saga.dayId,
      contributions: [{ eventId: "wve:travel", dayId: saga.dayId, objectiveId: firstNode!.id, playerId: "player:ari", verb: firstNode!.acceptedVerbs[0]!, amount: firstNode!.target }]
    });
    assert.equal(progressed.nodes.find((node) => node.definition.id === firstNode?.id)?.state, "complete");
    assert.equal(progressed.recommended?.definition.prerequisites.includes(firstNode!.id), true);
  });

  it("makes prior-day objectives personal Echo missions without world mutation", () => {
    const echo = projectMissionGraph({ saga, playerId: "player:ari", contributions: [], currentDayId: "saga:day:later" });
    assert.equal(echo.nodes[0]?.echo, true);
    assert.equal(echo.nodes[0]?.worldMutable, false);
  });
});
