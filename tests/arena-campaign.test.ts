import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectArenaFighter } from "../src/features/play/arena/card-fighter";
import { generateArenaPath, validateArenaEncounterSolvability } from "../src/features/play/arena/campaign";
import { arenaFixtureCard, arenaFixtureRevision } from "./support/arena-fixtures";

function roster() {
  return ["mintcub-1", "voltray-1", "titanseal-1"].map((formId, index) => {
    const card = arenaFixtureCard(formId, `path-${index}`);
    return projectArenaFighter(card, arenaFixtureRevision(card));
  });
}

describe("remembered strategic Arena Path", () => {
  it("reproduces a complete teaching-to-boss path shaped to the roster", () => {
    const input = { seed: "arena:path:one", playerId: "player:one", roster: roster(), completedEncounterIds: [] };
    const first = generateArenaPath(input);
    assert.deepEqual(generateArenaPath(input), first);
    assert.equal(first.encounters.filter((encounter) => encounter.tier === "learner").length >= 2, true);
    assert.equal(first.encounters.filter((encounter) => encounter.tier === "rival").length, 3);
    assert.equal(first.encounters.filter((encounter) => encounter.tier === "champion").length, 1);
    assert.equal(first.encounters.filter((encounter) => encounter.tier === "boss").length, 1);
    assert.ok(first.encounters.every((encounter) => encounter.recommendedAssetIds.every((id) => input.roster.some((fighter) => fighter.assetId === id))));
    assert.ok(first.encounters.every((encounter) => validateArenaEncounterSolvability(encounter, input.roster).ok));
  });

  it("remembers completed levels and resumes from the next sealed checkpoint", () => {
    const initial = generateArenaPath({ seed: "arena:path:resume", playerId: "player:one", roster: roster(), completedEncounterIds: [] });
    const completed = initial.encounters.slice(0, 4).map((encounter) => encounter.id);
    const resumed = generateArenaPath({ seed: "arena:path:resume", playerId: "player:one", roster: roster(), completedEncounterIds: completed });
    assert.equal(resumed.currentEncounterId, initial.encounters[4]!.id);
    assert.equal(resumed.checkpoint.completedEncounterIds.length, 4);
    assert.equal(resumed.checkpoint.lastCompletedEncounterId, completed.at(-1));
  });

  it("escalates behavior, geometry, hazards, counters, and swaps instead of health alone", () => {
    const path = generateArenaPath({ seed: "arena:path:difficulty", playerId: "player:one", roster: roster(), completedEncounterIds: [] });
    const learner = path.encounters.find((encounter) => encounter.tier === "learner")!;
    const champion = path.encounters.find((encounter) => encounter.tier === "champion")!;
    assert.ok(champion.difficulty.behaviorDepth > learner.difficulty.behaviorDepth);
    assert.ok(champion.difficulty.hazardComplexity > learner.difficulty.hazardComplexity);
    assert.ok(champion.difficulty.teamSwaps > learner.difficulty.teamSwaps);
    assert.ok(champion.difficulty.reactionFrames < learner.difficulty.reactionFrames);
    assert.ok(champion.difficulty.healthMultiplier <= 1.25);
    assert.ok(champion.counterOpportunities.length >= 3);
    assert.ok(champion.retreatPreparation.length >= 2);
  });

  it("seals a three-phase boss with discoverable weaknesses and transition frames", () => {
    const path = generateArenaPath({ seed: "arena:path:boss", playerId: "player:one", roster: roster(), completedEncounterIds: [] });
    const boss = path.encounters.find((encounter) => encounter.tier === "boss")!;
    assert.equal(boss.bossPhases.length, 3);
    assert.deepEqual(boss.bossPhases.map((phase) => phase.vitalityThreshold), [0.75, 0.45, 0.15]);
    assert.ok(boss.bossPhases.every((phase) => phase.transitionFrame > 0 && phase.weakness && phase.legalActions.length > 0));
    const mutated = { ...boss, counterOpportunities: [] };
    assert.equal(validateArenaEncounterSolvability(mutated, roster()).ok, false);
  });
});
