import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  advanceTrainerEncounter,
  createTrainerEncounter,
  shouldDismissTrainerEncounterForExternalCombat,
  type TrainerEncounterResult
} from "../src/features/play/trainer-encounter";

const trainerId = "trainer:ember-vale";
const worldPosition = { x: 18, z: -7, heading: 1.25 };
const victory: TrainerEncounterResult = {
  outcome: "player_victory",
  xp: 60,
  bond: 2,
  arenaPathStage: 3
};

describe("trainer encounter director", () => {
  it("advances recognition through challenge and cinematic transition into combat", () => {
    let state = createTrainerEncounter(trainerId, worldPosition);
    state = advanceTrainerEncounter(state, { type: "recognize" });
    assert.equal(state.phase, "recognized");
    state = advanceTrainerEncounter(state, { type: "open-challenge" });
    assert.equal(state.phase, "challenge");
    state = advanceTrainerEncounter(state, { type: "accept", rosterIds: ["card:a"], now: 1_000 });
    assert.equal(state.phase, "transition");
    assert.equal(state.transitionStartedAt, 1_000);
    state = advanceTrainerEncounter(state, { type: "transition-complete" });
    assert.equal(state.phase, "combat");
  });

  it("cancels a challenge cleanly back to the mounted world", () => {
    let state = advanceTrainerEncounter(createTrainerEncounter(trainerId, worldPosition), { type: "recognize" });
    state = advanceTrainerEncounter(state, { type: "open-challenge" });
    state = advanceTrainerEncounter(state, { type: "cancel" });
    assert.equal(state.phase, "idle");
    assert.deepEqual(state.returnPosition, worldPosition);
  });

  it("compresses the transition for a repeat encounter", () => {
    let state = createTrainerEncounter(trainerId, worldPosition, { repeat: true });
    state = advanceTrainerEncounter(state, { type: "recognize" });
    state = advanceTrainerEncounter(state, { type: "open-challenge" });
    state = advanceTrainerEncounter(state, { type: "accept", rosterIds: ["card:a"], now: 2_000 });
    assert.equal(state.repeat, true);
    assert.equal(state.transitionDurationMs, 480);
    state = advanceTrainerEncounter(state, { type: "skip-transition" });
    assert.equal(state.phase, "combat");
  });

  it("does not reveal a result until its local settlement is committed", () => {
    let state = createTrainerEncounter(trainerId, worldPosition);
    state = advanceTrainerEncounter(state, { type: "recognize" });
    state = advanceTrainerEncounter(state, { type: "open-challenge" });
    state = advanceTrainerEncounter(state, { type: "accept", rosterIds: ["card:a"] });
    state = advanceTrainerEncounter(state, { type: "transition-complete" });
    const premature = advanceTrainerEncounter(state, { type: "settlement-committed", settlementId: "", result: victory });
    assert.equal(premature.phase, "combat");
    assert.equal(premature.error, "trainer_encounter_settlement_required");
    state = advanceTrainerEncounter(state, { type: "settlement-committed", settlementId: "settlement:1", result: victory });
    assert.equal(state.phase, "result");
    assert.equal(state.settlementId, "settlement:1");
    assert.deepEqual(state.result, victory);
  });

  it("preserves the trainer and world position across result, rematch, and return", () => {
    let state = createTrainerEncounter(trainerId, worldPosition, { repeat: true });
    state = { ...state, phase: "result", settlementId: "settlement:1", result: victory };
    const rematch = advanceTrainerEncounter(state, { type: "rematch" });
    assert.equal(rematch.phase, "challenge");
    assert.equal(rematch.trainerId, trainerId);
    assert.deepEqual(rematch.returnPosition, worldPosition);
    state = advanceTrainerEncounter(state, { type: "continue" });
    assert.equal(state.phase, "returning");
    state = advanceTrainerEncounter(state, { type: "return-complete" });
    assert.equal(state.phase, "idle");
    assert.equal(state.trainerId, trainerId);
    assert.deepEqual(state.returnPosition, worldPosition);
  });

  it("rejects impossible transitions with a semantic error and no phase change", () => {
    const state = createTrainerEncounter(trainerId, worldPosition);
    const next = advanceTrainerEncounter(state, { type: "transition-complete" });
    assert.equal(next.phase, "idle");
    assert.equal(next.error, "trainer_encounter_invalid_transition");
  });

  it("dismisses visible trainer phases when an asynchronous PvP battle takes ownership", () => {
    let challenge = advanceTrainerEncounter(createTrainerEncounter(trainerId, worldPosition), { type: "recognize" });
    challenge = advanceTrainerEncounter(challenge, { type: "open-challenge" });
    const transition = advanceTrainerEncounter(challenge, { type: "accept", rosterIds: ["card:a"], now: 1_000 });
    const combat = advanceTrainerEncounter(transition, { type: "transition-complete" });
    const result = advanceTrainerEncounter(combat, { type: "settlement-committed", settlementId: "settlement:1", result: victory });

    for (const encounter of [challenge, transition, result]) {
      assert.equal(shouldDismissTrainerEncounterForExternalCombat(encounter.phase, {
        wildBattleActive: false,
        pvpBattleActive: false
      }), false);
      assert.equal(shouldDismissTrainerEncounterForExternalCombat(encounter.phase, {
        wildBattleActive: false,
        pvpBattleActive: true
      }), true, encounter.phase);
    }
    assert.equal(shouldDismissTrainerEncounterForExternalCombat(combat.phase, {
      wildBattleActive: false,
      pvpBattleActive: true
    }), true);
    assert.equal(shouldDismissTrainerEncounterForExternalCombat(combat.phase, {
      wildBattleActive: true,
      pvpBattleActive: false
    }), true);
  });
});

describe("trainer encounter presentation", () => {
  it("keeps the world mounted beneath an accessible mobile challenge, transition, and committed result", () => {
    const component = readFileSync("src/features/play/WildsTrainerEncounter.tsx", "utf8");
    const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
    const arena = readFileSync("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");

    for (const token of [
      'role="dialog"',
      'aria-modal="true"',
      "wilds-trainer-challenge",
      "wilds-trainer-transition",
      "wilds-trainer-result",
      "WildsCreatureThumbnail",
      "Continue",
      "Rematch",
      "Review"
    ]) assert.match(component, new RegExp(token));
    assert.match(campaign, /trainerEncounter\?\.phase === "combat"/);
    assert.match(campaign, /exclusiveOwner === "combat" && combatSurface === "trainer" && activeTrainer && activeAsset && trainerEncounter\?\.phase === "combat"/);
    assert.match(campaign, /exclusiveOwner === "trainer" && activeTrainer && activeAsset && trainerEncounter/);
    assert.match(campaign, /shouldDismissTrainerEncounterForExternalCombat/);
    assert.match(campaign, /settlementId: settlement\.id/);
    assert.match(campaign, /dismissSignal=\{commandDismissSignal\}/);
    assert.match(arena, /resultPresentation === "arena"/);
    assert.match(arena, /mode = "adventure"/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.wilds-trainer-challenge, \.wilds-trainer-result/);
    assert.match(css, /min-height: 52px/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
  });

  it("keeps local trainer battles available while remote story sync is reconnecting", () => {
    const panel = readFileSync("src/features/play/WildsSagaPanel.tsx", "utf8");
    assert.match(panel, /disabled=\{!trainer\.available\}/);
    assert.doesNotMatch(panel, /disabled=\{mode !== "receiz_live" \|\| pending\}/);
  });
});
