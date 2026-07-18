import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga } from "../src/features/play/wilds-saga-director.js";
import { projectCampaignOpponentFromTrainer, projectSagaTrainers, trainerArenaNpc } from "../src/features/play/wilds-saga-trainers.js";

const saga = projectWildsSaga({
  moment: deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "world" }),
  framework: wildsSagaFramework(),
  memories: []
});

describe("Wilds seeded saga trainers", () => {
  it("projects a stable explicitly NPC population with arena-ready behavior", () => {
    const first = projectSagaTrainers({ saga, playerLevel: 7, battleMemories: [] });
    assert.deepEqual(first, projectSagaTrainers({ saga, playerLevel: 7, battleMemories: [] }));
    assert.ok(first.length >= 3);
    assert.ok(first.every((trainer) => trainer.kind === "npc"));
    assert.ok(first.every((trainer) => trainer.seed >= 0 && trainer.seed <= 0xffffffff));
    assert.ok(first.some((trainer) => trainer.recurring));
    assert.equal(trainerArenaNpc(first[0]!).actorId, first[0]!.id);
    assert.equal(projectCampaignOpponentFromTrainer(first[0]!).id, first[0]!.id);
    const xs = first.map((trainer) => trainer.position[0]);
    const zs = first.map((trainer) => trainer.position[2]);
    assert.ok(Math.max(...xs) - Math.min(...xs) >= 100 || Math.max(...zs) - Math.min(...zs) >= 100);
    assert.ok(first.every((trainer) => Math.abs(trainer.position[0]) <= 192 && Math.abs(trainer.position[2]) <= 192));
  });

  it("evolves a remembered trainer rematch deterministically", () => {
    const first = projectSagaTrainers({ saga, playerLevel: 7, battleMemories: [] });
    const battleMemories = [{ trainerId: first[0]!.id, playerId: "player:ari", outcome: "player_victory" as const, settledEventId: "wve:battle", settledAt: "2026-07-16T12:00:00.000Z" }];
    const rematch = projectSagaTrainers({ saga, playerLevel: 7, battleMemories });
    const evolved = rematch.find((trainer) => trainer.id === first[0]!.id);
    assert.equal(evolved?.rematchIndex, 1);
    assert.notDeepEqual(evolved?.rosterFormIds, first[0]!.rosterFormIds);
    assert.deepEqual(rematch, projectSagaTrainers({ saga, playerLevel: 7, battleMemories }));
  });
});
