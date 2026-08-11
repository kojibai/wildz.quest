import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceArenaMatch, createArenaMatch, type ArenaMatchDefinition } from "../src/features/play/arena/runtime";
import { projectArenaConsequences } from "../src/features/play/arena/consequences";
import { createArenaTranscript, replayArenaTranscript } from "../src/features/play/arena/transcript";
import { arenaFixtureAuthorizeDefinition, arenaFixtureCreateMatch, arenaFixtureDefinition, arenaFixtureFighterHealth, arenaFixtureFrame, arenaFixtureVerification } from "./support/arena-fixtures";
import type { ArenaMode } from "../src/features/play/arena/mode";

function priorConditions(definition: ArenaMatchDefinition) {
  return Object.fromEntries(definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.condition])));
}

function contributionMatch(mode: ArenaMode = "mortal") {
  const definition = arenaFixtureDefinition(mode, 2);
  let state = arenaFixtureCreateMatch(definition);
  const actorId = state.teams[0].activeAssetId;
  const reserveId = state.teams[0].order[1]!;
  state = arenaFixtureFrame(state, [{ contextTargetId: `rescue:${reserveId}` }, {}]);
  state = arenaFixtureFrame(state, [{ combat: { kind: "heavy", direction: { x: 1, y: 0, z: 0 } } }, {}]);
  while (state.frame < 13) state = arenaFixtureFrame(state);
  state = arenaFixtureFrame(state, [{}, { withdraw: true }]);
  const transcript = createArenaTranscript(definition, state, arenaFixtureVerification);
  return { definition, replay: replayArenaTranscript(definition, transcript, arenaFixtureVerification), transcript, actorId, reserveId };
}

function sacrificeVictory() {
  const base = arenaFixtureDefinition("mortal", 2);
  const fragile = arenaFixtureFighterHealth(base.teams[0].fighters[0]!, 1);
  const definition = arenaFixtureAuthorizeDefinition({ ...base, teams: [{ ...base.teams[0], fighters: [fragile, base.teams[0].fighters[1]!] }, base.teams[1]] });
  let state = arenaFixtureCreateMatch(definition);
  const fallenId = state.teams[0].activeAssetId;
  state = arenaFixtureFrame(state, [{}, { combat: { kind: "heavy", direction: { x: -1, y: 0, z: 0 } } }]);
  while (state.frame < 12) state = arenaFixtureFrame(state);
  state = arenaFixtureFrame(state, [{}, { withdraw: true }]);
  const transcript = createArenaTranscript(definition, state, arenaFixtureVerification);
  return { definition, replay: replayArenaTranscript(definition, transcript, arenaFixtureVerification), transcript, fallenId };
}

describe("replay-grounded Arena consequences", () => {
  it("awards bounded XP and mastery only for unique recorded contributions", () => {
    const fixture = contributionMatch();
    const result = projectArenaConsequences({ ...fixture, priorConditions: priorConditions(fixture.definition), encounterId: "arena:encounter:one", checkpointId: "arena:checkpoint:one" });
    assert.ok(result.cards[fixture.actorId]!.xp > 0);
    assert.equal(result.cards[fixture.reserveId]!.xp, 0);
    assert.ok(Object.keys(result.cards[fixture.actorId]!.mastery).length > 0);
    assert.ok(result.cards[fixture.actorId]!.sourceEventIds.length >= 2);
    assert.ok(result.cards[fixture.actorId]!.xp <= 250);
    assert.deepEqual(result.checkpointIds, ["arena:checkpoint:one"]);
    assert.ok(Object.values(result.resourceAwards).every((amount) => amount >= 0 && amount <= 3));
  });

  it("turns replayed damage and rescues into injuries, scars, and relationships", () => {
    const fixture = contributionMatch();
    const result = projectArenaConsequences({ ...fixture, priorConditions: priorConditions(fixture.definition), encounterId: "arena:encounter:two", checkpointId: "arena:checkpoint:two" });
    const actor = result.cards[fixture.actorId]!;
    const reserve = result.cards[fixture.reserveId]!;
    assert.equal(actor.relationshipIds.some((id) => id.includes(fixture.reserveId)), true);
    assert.equal(reserve.relationshipIds.some((id) => id.includes(fixture.actorId)), true);
    const damaged = Object.values(result.cards).find((card) => card.injuriesAdded.length > 0);
    assert.ok(damaged);
    assert.equal(damaged!.scarIds.length, damaged!.injuriesAdded.length);
    assert.ok(damaged!.injuriesAdded.every((injury) => damaged!.sourceEventIds.includes(injury.sourceEventId)));
  });

  it("honors a fallen winner with retirement, epitaph, memorial, and bounded legacy", () => {
    const fixture = sacrificeVictory();
    const result = projectArenaConsequences({ ...fixture, priorConditions: priorConditions(fixture.definition), encounterId: "arena:encounter:sacrifice", checkpointId: "arena:checkpoint:sacrifice" });
    const fallen = result.cards[fixture.fallenId]!;
    assert.equal(fallen.lifeAfter, "dead");
    assert.ok(fallen.epitaph?.includes("carried"));
    assert.equal(result.memorials[0]?.assetId, fixture.fallenId);
    assert.equal(result.memorials[0]?.honoredByTeamVictory, true);
    assert.equal(fallen.achievementIds.includes("arena:honored-sacrifice"), true);
    assert.ok(fallen.xp <= 25);
    assert.deepEqual(fallen.evolutionIds, []);
    assert.equal(result.resourceAwards[fixture.fallenId] ?? 0, 0);
  });

  it("gives practice matches no canonical progression or mortality", () => {
    const fixture = contributionMatch("practice");
    const result = projectArenaConsequences({ ...fixture, priorConditions: priorConditions(fixture.definition), encounterId: "arena:practice", checkpointId: "arena:practice" });
    assert.equal(Object.values(result.cards).every((card) => card.xp === 0 && card.lifeAfter === card.lifeBefore && card.injuriesAdded.length === 0), true);
    assert.deepEqual(result.resourceAwards, {});
    assert.deepEqual(result.checkpointIds, []);
    assert.deepEqual(result.memorials, []);
  });

  it("gives Adventure living progression without mortality and Ranked rating-only card effects", () => {
    const adventure = contributionMatch("adventure");
    const adventureResult = projectArenaConsequences({ ...adventure, priorConditions: priorConditions(adventure.definition), encounterId: "arena:adventure", checkpointId: "arena:adventure" });
    assert.ok(adventureResult.cards[adventure.actorId]!.xp > 0);
    assert.equal(Object.values(adventureResult.cards).every((card) => card.lifeAfter === card.lifeBefore), true);
    assert.deepEqual(adventureResult.checkpointIds, ["arena:adventure"]);

    const ranked = contributionMatch("ranked");
    const rankedResult = projectArenaConsequences({ ...ranked, priorConditions: priorConditions(ranked.definition), encounterId: "arena:ranked", checkpointId: "arena:ranked" });
    assert.equal(Object.values(rankedResult.cards).every((card) => card.xp === 0 && card.injuriesAdded.length === 0 && card.lifeAfter === card.lifeBefore), true);
    assert.deepEqual(rankedResult.resourceAwards, {});
    assert.deepEqual(rankedResult.checkpointIds, ["arena:ranked"]);
  });

  it("rejects foreign prior conditions and a replay for another definition", () => {
    const fixture = contributionMatch();
    const prior = priorConditions(fixture.definition);
    delete prior[fixture.actorId];
    assert.throws(() => projectArenaConsequences({ ...fixture, priorConditions: prior, encounterId: "arena:bad", checkpointId: "arena:bad" }), /arena_consequences_condition_invalid/);
    const altered = priorConditions(fixture.definition);
    altered[fixture.actorId] = { ...altered[fixture.actorId]!, fatigue: altered[fixture.actorId]!.fatigue + 1 };
    assert.throws(() => projectArenaConsequences({ ...fixture, priorConditions: altered, encounterId: "arena:altered", checkpointId: "arena:altered" }), /arena_consequences_condition_invalid/);
  });
});
