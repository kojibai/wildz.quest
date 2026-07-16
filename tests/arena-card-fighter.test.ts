import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { assertArenaFighterPlayable, projectArenaFighter } from "../src/features/play/arena/card-fighter";
import { arenaFixtureCard, arenaFixtureRevision } from "./support/arena-fixtures";

describe("exact card-to-Arena fighter projection", () => {
  it("preserves proof, revision, exact stats, and exact named abilities", () => {
    const card = arenaFixtureCard("mintcub-1", "projection");
    const revision = arenaFixtureRevision(card);
    const fighter = projectArenaFighter(card, revision);
    assert.equal(fighter.assetId, card.id);
    assert.equal(fighter.proofDigest, card.proof.digest);
    assert.equal(fighter.revisionDigest, revision.digest);
    assert.deepEqual(fighter.baseStats, card.manifest.stats);
    assert.deepEqual(fighter.stats, card.manifest.stats);
    assert.deepEqual(fighter.abilityNames, card.manifest.abilityNames);
    assert.equal(fighter.abilityPowers.every((power) => power > 0), true);
    assert.equal(fighter.bodyFamily, "small");
    assert.equal(fighter.playable, true);
  });

  it("turns real anatomy and element into materially different fighters", () => {
    const forms = ["mintcub-1", "voltray-1", "ledgerfox-1", "titanseal-1"];
    const fighters = forms.map((formId) => {
      const card = arenaFixtureCard(formId, `physical-${formId}`);
      return projectArenaFighter(card, arenaFixtureRevision(card));
    });
    assert.deepEqual(fighters.map((fighter) => fighter.bodyFamily), ["small", "winged", "quadruped", "heavy"]);
    assert.equal(fighters[1]!.locomotion.includes("fly"), true);
    assert.equal(fighters[2]!.locomotion.includes("swim"), true);
    assert.equal(fighters[3]!.locomotion.includes("dig"), true);
    assert.ok(fighters[1]!.airControl > fighters[3]!.airControl);
    assert.ok(fighters[3]!.mass > fighters[0]!.mass);
    assert.notDeepEqual(fighters[0]!.collision, fighters[3]!.collision);
  });

  it("makes fatigue and physical injury change real movement and vitality", () => {
    const card = arenaFixtureCard("voltray-1", "injury");
    const healthy = projectArenaFighter(card, arenaFixtureRevision(card));
    const condition = {
      ...emptyAdventureCondition(card.id), fatigue: 50,
      injuries: [{ id: "arena:wing", kind: "wing" as const, severity: 3 as const, sourceEventId: "arena:event:fall" }],
    };
    const injured = projectArenaFighter(card, arenaFixtureRevision(card, condition));
    assert.equal(healthy.locomotion.includes("fly"), true);
    assert.equal(injured.locomotion.includes("fly"), false);
    assert.ok(injured.stats.speed < healthy.stats.speed);
    assert.ok(injured.maxVitality < healthy.maxVitality);
    assert.ok(injured.airControl < healthy.airControl);
  });

  it("rejects retirement, foreign revision state, and tampered proofs", () => {
    const card = arenaFixtureCard("mintcub-1", "invalid");
    const retiredCondition = { ...emptyAdventureCondition(card.id), life: "dead" as const, retiredAt: "2026-07-16T21:02:00.000Z", retirementCauseEventId: "arena:event:zero" };
    const retired = projectArenaFighter(card, arenaFixtureRevision(card, retiredCondition));
    assert.equal(retired.playable, false);
    assert.throws(() => assertArenaFighterPlayable(retired), /arena_fighter_retired/);
    const other = arenaFixtureCard("mintcub-1", "other");
    assert.throws(() => projectArenaFighter(card, arenaFixtureRevision(other)), /arena_fighter_revision_asset_invalid/);
    assert.throws(() => projectArenaFighter({ ...card, proof: { ...card.proof, digest: `sha256:${"0".repeat(64)}` } }, arenaFixtureRevision(card)), /arena_fighter_card_proof_invalid/);
  });
});
