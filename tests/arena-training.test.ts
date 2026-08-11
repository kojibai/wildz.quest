import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createArenaTrainingDrill,
  projectArenaLocalGhostThroughFrame,
  recordArenaLocalGhost,
  scoreArenaTrainingAttempt,
  verifyArenaLocalGhost,
  type ArenaTrainingAttempt,
  type ArenaTrainingDrillKind,
} from "../src/features/play/arena/training";

const attempts: Readonly<Record<ArenaTrainingDrillKind, ArenaTrainingAttempt["performance"]>> = {
  spacing: { kind: "spacing", meanDistanceErrorMilli: 400 },
  defense: { kind: "defense", successfulResponses: 4, opportunities: 5, meanReactionFrames: 8 },
  punish: { kind: "punish", successfulResponses: 3, opportunities: 4, meanResponseFrames: 5, meanWindowFrames: 10 },
  ability: { kind: "ability", hits: 7, attempts: 8 },
  tag: { kind: "tag", successfulResponses: 4, opportunities: 5, meanResponseFrames: 6, meanWindowFrames: 12 },
  hazard: { kind: "hazard", exposureFrames: 20, durationFrames: 200 },
  matchup: { kind: "matchup", correctResponses: 9, opportunities: 10 },
};

describe("Arena mastery training", () => {
  it("scores every repeatable drill deterministically in integer basis points", () => {
    const expected: Readonly<Record<ArenaTrainingDrillKind, number>> = {
      spacing: 8000,
      defense: 7000,
      punish: 5000,
      ability: 8750,
      tag: 5500,
      hazard: 9000,
      matchup: 9000,
    };
    for (const kind of Object.keys(attempts) as ArenaTrainingDrillKind[]) {
      const drill = createArenaTrainingDrill({ kind, seed: "repeatable:seed", mode: "practice" });
      const attempt = { drillId: drill.id, performance: attempts[kind] } as ArenaTrainingAttempt;
      assert.deepEqual(scoreArenaTrainingAttempt(drill, attempt), {
        schema: "receiz.wilds.arena_training_score.v1",
        drillId: drill.id,
        kind,
        score: expected[kind],
        grade: expected[kind] >= 9000 ? "master" : expected[kind] >= 7500 ? "advanced" : expected[kind] >= 5000 ? "developing" : "foundation",
      });
      assert.deepEqual(scoreArenaTrainingAttempt(drill, attempt), scoreArenaTrainingAttempt(drill, attempt));
    }
  });

  it("keeps telegraphs and reduced speed Practice-only", () => {
    const drill = createArenaTrainingDrill({
      kind: "defense",
      seed: "aids:seed",
      mode: "practice",
      aids: { readableTelegraphs: true, timeScale: 0.6 },
    });
    assert.deepEqual(drill.aids, { readableTelegraphs: true, timeScale: 0.6 });
    assert.equal(drill.information, "observable-only");
    assert.throws(() => createArenaTrainingDrill({
      kind: "defense",
      seed: "ranked:seed",
      mode: "ranked" as never,
      aids: { readableTelegraphs: true, timeScale: 0.6 },
    }), /arena_training_practice_only/);
  });

  it("records a self-verifying local ghost and never reveals future frames", () => {
    const drill = createArenaTrainingDrill({ kind: "spacing", seed: "ghost:seed", mode: "practice" });
    const ghost = recordArenaLocalGhost(drill, {
      playerId: "player:one",
      inputs: [
        { frame: 10, movement: { moveX: 1, moveZ: 0, jumpPressed: false, sprint: false }, combat: null, tagAssetId: null },
        { frame: 20, movement: { moveX: 0, moveZ: 1, jumpPressed: false, sprint: true }, combat: "dodge", tagAssetId: null },
        { frame: 30, movement: { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false }, combat: "light", tagAssetId: "card:reserve" },
      ],
    });

    assert.equal(ghost.storage, "local-only");
    assert.equal(ghost.mode, "practice");
    assert.equal(ghost.includesOpponentInputs, false);
    assert.deepEqual(verifyArenaLocalGhost(ghost), { ok: true, errors: [] });
    assert.deepEqual(projectArenaLocalGhostThroughFrame(ghost, 20).map((input) => input.frame), [10, 20]);
    assert.deepEqual(projectArenaLocalGhostThroughFrame(ghost, 9), []);
    assert.equal(projectArenaLocalGhostThroughFrame(ghost, 20).some((input) => input.frame > 20), false);
  });

  it("rejects hidden opponent information, malformed metrics, and ghost mutation", () => {
    const drill = createArenaTrainingDrill({ kind: "ability", seed: "safe:seed", mode: "practice" });
    assert.throws(() => scoreArenaTrainingAttempt(drill, {
      drillId: drill.id,
      performance: { kind: "ability", hits: 9, attempts: 8 },
    }), /arena_training_performance_invalid/);
    assert.throws(() => scoreArenaTrainingAttempt(drill, {
      drillId: drill.id,
      performance: { kind: "ability", hits: 4, attempts: 8, opponentFutureAction: "dodge" } as never,
    }), /arena_training_performance_invalid/);
    assert.throws(() => scoreArenaTrainingAttempt(
      { ...drill, seed: "mutated:seed" },
      { drillId: drill.id, performance: { kind: "ability", hits: 4, attempts: 8 } },
    ), /arena_training_drill_invalid/);
    assert.throws(() => recordArenaLocalGhost(drill, {
      playerId: "player:one",
      inputs: [{
        frame: 1,
        movement: { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false },
        combat: null,
        tagAssetId: null,
        opponentFutureInput: "heavy",
      } as never],
    }), /arena_training_ghost_input_invalid/);
    const ghost = recordArenaLocalGhost(drill, {
      playerId: "player:one",
      inputs: [{ frame: 1, movement: { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false }, combat: null, tagAssetId: null }],
    });
    assert.equal(verifyArenaLocalGhost({ ...ghost, playerId: "player:other" }).ok, false);
  });
});
