import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectArenaFighter } from "../src/features/play/arena/card-fighter";
import {
  beginArenaAction,
  createArenaCombatantState,
  resolveArenaHit,
  type ArenaCombatContext,
  type ArenaHitContext,
} from "../src/features/play/arena/combat";
import { initialArenaKinematicState } from "../src/features/play/arena/movement";
import { arenaFixtureCard, arenaFixtureRevision } from "./support/arena-fixtures";

function fighter(formId: string, suffix = formId) {
  const card = arenaFixtureCard(formId, `combat-${suffix}`);
  return projectArenaFighter(card, arenaFixtureRevision(card));
}

function actionContext(formId = "mintcub-1", frame = 10, state = createArenaCombatantState(fighter(formId))) {
  const actor = fighter(formId, `actor-${frame}`);
  return { actor, state: { ...state, vitality: actor.maxVitality, break: actor.maxBreak }, frame } satisfies ArenaCombatContext;
}

function hitContext(
  attackerForm = "mintcub-1",
  targetForm = "titanseal-1",
  attackKind: "light" | "heavy" | "ability" = "light",
  targetDefense: "idle" | "guard" | "parry" | "dodge" = "idle",
): ArenaHitContext {
  const attacker = fighter(attackerForm, `attacker-${attackKind}-${targetDefense}`);
  const target = fighter(targetForm, `target-${attackKind}-${targetDefense}`);
  const started = beginArenaAction({ actor: attacker, state: createArenaCombatantState(attacker), frame: 10 }, attackKind === "ability"
    ? { kind: "ability", slot: 0, targetId: target.assetId }
    : { kind: attackKind, direction: { x: 1, y: 0, z: 0 } });
  const frame = started.action.activeFrom;
  const targetStarted = targetDefense === "idle" ? { state: createArenaCombatantState(target) } : beginArenaAction(
    { actor: target, state: createArenaCombatantState(target), frame: frame - (targetDefense === "parry" ? 1 : 0) },
    { kind: targetDefense, direction: { x: -1, y: 0, z: 0 } },
  );
  return {
    frame, attacker, attackerState: started.state, attackerPosition: { x: 0, y: 0, z: 0 },
    target, targetState: targetStarted.state, targetPosition: { x: attacker.reach * 0.8, y: 0, z: 0 },
  };
}

describe("skill-based Arena combat", () => {
  it("builds directional light chains and gives heavy attacks real commitment", () => {
    const actor = fighter("ledgerfox-1", "chains");
    const first = beginArenaAction({ actor, state: createArenaCombatantState(actor), frame: 1 }, { kind: "light", direction: { x: 1, y: 0, z: 0 } });
    const second = beginArenaAction({ actor, state: { ...first.state, action: { ...first.action, kind: "idle" } }, frame: first.action.recoverUntil + 4 }, { kind: "light", direction: { x: 0, y: 0, z: 1 } });
    const heavy = beginArenaAction({ actor, state: createArenaCombatantState(actor), frame: 1 }, { kind: "heavy", direction: { x: 1, y: 0, z: 0 } });
    assert.equal(first.action.comboIndex, 1);
    assert.equal(second.action.comboIndex, 2);
    assert.ok(heavy.action.activeFrom - heavy.action.startedFrame > first.action.activeFrom - first.action.startedFrame);
    assert.ok(heavy.action.recoverUntil > first.action.recoverUntil);
    assert.ok(heavy.state.stamina < first.state.stamina);
  });

  it("resolves reach, mass, damage, Break, and launch without randomness", () => {
    const light = resolveArenaHit(hitContext());
    const replay = resolveArenaHit(hitContext());
    const heavy = resolveArenaHit(hitContext("titanseal-1", "mintcub-1", "heavy"));
    assert.deepEqual(replay, light);
    assert.equal(light.outcome, "hit");
    assert.ok(light.vitalityDamage > 0 && light.breakDamage > 0);
    assert.ok(heavy.launch.length > light.launch.length);
    assert.ok(heavy.breakDamage > light.breakDamage);
    const outside = hitContext();
    assert.equal(resolveArenaHit({ ...outside, targetPosition: { x: outside.attacker.reach + 2, y: 0, z: 0 } }).outcome, "miss");
  });

  it("makes guard, parry, and dodge distinct timing decisions", () => {
    const open = resolveArenaHit(hitContext());
    const guarded = resolveArenaHit(hitContext("mintcub-1", "titanseal-1", "light", "guard"));
    const parried = resolveArenaHit(hitContext("mintcub-1", "titanseal-1", "light", "parry"));
    const dodged = resolveArenaHit(hitContext("mintcub-1", "titanseal-1", "light", "dodge"));
    assert.equal(guarded.outcome, "guarded");
    assert.ok(guarded.vitalityDamage < open.vitalityDamage);
    assert.ok(guarded.breakDamage > 0);
    assert.equal(parried.outcome, "parried");
    assert.equal(parried.vitalityDamage, 0);
    assert.equal(dodged.outcome, "dodged");
    assert.equal(dodged.vitalityDamage, 0);
  });

  it("uses exact named ability power, element counters, stamina, focus, and cooldowns", () => {
    const spark = fighter("voltray-1", "ability");
    const state = createArenaCombatantState(spark);
    const focused = beginArenaAction({ actor: spark, state, frame: 1 }, { kind: "focus" });
    assert.ok(focused.state.focus > state.focus);
    const ability = beginArenaAction({ actor: spark, state: focused.state, frame: 30 }, { kind: "ability", slot: 0, targetId: "target" });
    assert.equal(ability.action.abilityName, spark.abilityNames[0]);
    assert.equal(ability.action.abilityPower, spark.abilityPowers[0]);
    assert.ok(ability.state.stamina < focused.state.stamina);
    assert.ok(ability.state.cooldowns[0]! > 30);
    assert.throws(() => beginArenaAction({ actor: spark, state: { ...ability.state, action: { ...ability.action, kind: "idle" } }, frame: 31 }, { kind: "ability", slot: 0, targetId: "target" }), /arena_combat_cooldown/);
    const elemental = hitContext("voltray-1", "titanseal-1", "ability");
    const advantage = resolveArenaHit(elemental);
    const disadvantage = resolveArenaHit({ ...elemental, attacker: { ...elemental.attacker, element: "Stone" }, target: { ...elemental.target, element: "Spark" } });
    assert.ok(advantage.vitalityDamage > disadvantage.vitalityDamage);
    assert.ok(advantage.statusesAdded.length > 0);
  });

  it("depletes Break and reaches exact zero Vitality without going negative", () => {
    const context = hitContext("titanseal-1", "mintcub-1", "heavy");
    const result = resolveArenaHit({ ...context, targetState: { ...context.targetState, vitality: 1, break: 1 } });
    assert.equal(result.targetState.vitality, 0);
    assert.equal(result.targetState.break, 0);
    assert.equal(result.knockedOut, true);
    assert.equal(result.breakBroken, true);
  });

  it("rejects illegal direction, insufficient stamina, and inactive hits", () => {
    const context = actionContext();
    assert.throws(() => beginArenaAction(context, { kind: "light", direction: { x: 2, y: 0, z: 0 } }), /arena_combat_direction_invalid/);
    assert.throws(() => beginArenaAction({ ...context, state: { ...context.state, stamina: 0 } }, { kind: "heavy", direction: { x: 1, y: 0, z: 0 } }), /arena_combat_stamina/);
    const hit = hitContext();
    assert.equal(resolveArenaHit({ ...hit, frame: hit.attackerState.action.recoverUntil }).outcome, "inactive");
  });
});
