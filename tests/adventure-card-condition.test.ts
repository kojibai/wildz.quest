import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAdventureConditionDelta,
  effectiveAdventureStats,
  emptyAdventureCondition,
  validateAdventureCondition,
  type AdventureConditionDelta,
} from "../src/features/play/adventure/card-condition";
import {
  adventureConditionToHearttree,
  hearttreeConditionToAdventure,
  type HearttreeCardCondition,
} from "../src/features/play/hearttree/card-capability";

describe("shared Wilds adventure card conditions", () => {
  it("validates embodied recovery and canonical retirement metadata", () => {
    const base = emptyAdventureCondition("card:arena-condition");
    const resting = validateAdventureCondition({ ...base, recovery: { state: "resting", trauma: 42, lastEventId: "arena:event:care" } });
    assert.equal(resting.recovery?.trauma, 42);
    const retired = validateAdventureCondition({ ...base, life: "dead", retiredAt: "2026-07-16T20:10:00.000Z", retirementCauseEventId: "arena:event:zero" });
    assert.equal(retired.life, "dead");
    assert.throws(() => validateAdventureCondition({ ...base, retiredAt: "not-a-time" }), /adventure_condition_retirement_invalid/);
    assert.throws(() => validateAdventureCondition({ ...base, recovery: { state: "resting", trauma: 101, lastEventId: null } }), /adventure_condition_recovery_invalid/);
  });

  it("applies bounded cross-location progression without duplicating evidence", () => {
    const initial = emptyAdventureCondition("card:one");
    const delta: AdventureConditionDelta = {
      assetId: initial.assetId,
      lifeBefore: "alive",
      lifeAfter: "alive",
      fatigueDelta: 12,
      xp: { market: 40 },
      mastery: { negotiation: 1 },
      injuriesAdded: [{ id: "injury:one", kind: "focus", severity: 1, sourceEventId: "market:event:one" }],
      upgradeIdsAdded: ["market:upgrade:one"],
      receiptDigestsAdded: [`sha256:${"a".repeat(64)}`],
    };

    const progressed = applyAdventureConditionDelta(initial, delta);
    const duplicate = applyAdventureConditionDelta(progressed, { ...delta, lifeBefore: "alive" });

    assert.equal(progressed.fatigue, 12);
    assert.equal(progressed.xp.market, 40);
    assert.equal(progressed.mastery.negotiation, 1);
    assert.deepEqual(progressed.injuries.map((injury) => injury.id), ["injury:one"]);
    assert.deepEqual(progressed.upgradeIds, ["market:upgrade:one"]);
    assert.deepEqual(progressed.receiptDigests, [`sha256:${"a".repeat(64)}`]);
    assert.equal(duplicate.injuries.length, 1);
    assert.equal(duplicate.upgradeIds.length, 1);
    assert.equal(duplicate.receiptDigests.length, 1);
  });

  it("makes death irreversible", () => {
    const dead = { ...emptyAdventureCondition("card:dead"), life: "dead" as const };
    assert.throws(() => applyAdventureConditionDelta(dead, {
      assetId: dead.assetId,
      lifeBefore: "dead",
      lifeAfter: "alive",
      fatigueDelta: 0,
      xp: {},
      mastery: {},
      injuriesAdded: [],
      upgradeIdsAdded: [],
      receiptDigestsAdded: [],
    }), /adventure_death_irreversible/);
  });

  it("projects fatigue and specific injuries onto effective real stats", () => {
    const condition = {
      ...emptyAdventureCondition("card:stats"),
      fatigue: 20,
      injuries: [
        { id: "limb:one", kind: "limb" as const, severity: 2 as const, sourceEventId: "event:limb" },
        { id: "guard:one", kind: "guard" as const, severity: 1 as const, sourceEventId: "event:guard" },
      ],
    };
    const effective = effectiveAdventureStats({ health: 100, power: 70, guard: 60, speed: 50, bond: 40 }, condition);

    assert.deepEqual(effective, { health: 97, power: 70, guard: 52, speed: 38, bond: 40 });
  });

  it("fails closed on foreign, malformed, or unbounded condition values", () => {
    assert.throws(() => emptyAdventureCondition(" "), /asset_required/);
    assert.throws(() => validateAdventureCondition({ ...emptyAdventureCondition("card:bad"), fatigue: 101 }), /fatigue_invalid/);
    assert.throws(() => validateAdventureCondition({
      ...emptyAdventureCondition("card:bad"),
      injuries: [{ id: "", kind: "focus", severity: 1, sourceEventId: "event" }],
    }), /injury_invalid/);
  });

  it("round-trips every legacy Hearttree field through the shared condition", () => {
    const legacy: HearttreeCardCondition = {
      assetId: "card:hearttree",
      life: "dead",
      fatigue: 23,
      injuries: [{ id: "hearttree:injury:one", kind: "guard", severity: 2, sourceEventId: "hearttree:event:one" }],
      hearttreeXp: 88,
      mastery: 7,
      upgradeIds: ["hearttree:upgrade:one"],
    };

    const shared = hearttreeConditionToAdventure(legacy);
    assert.equal(shared.xp.hearttree, 88);
    assert.equal(shared.mastery.hearttree, 7);
    assert.deepEqual(adventureConditionToHearttree(shared), legacy);
  });
});
