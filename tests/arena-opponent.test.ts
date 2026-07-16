import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectArenaFighter } from "../src/features/play/arena/card-fighter";
import { chooseArenaNpcInput, observeArenaForNpc, telegraphArenaNpcInput, type ArenaNpcPolicy, type ArenaNpcTier } from "../src/features/play/arena/opponent";
import { createArenaMatch, type ArenaMatchDefinition } from "../src/features/play/arena/runtime";
import { arenaFixtureCard, arenaFixtureRevision } from "./support/arena-fixtures";

function fighter(formId: string, suffix: string) {
  const card = arenaFixtureCard(formId, `npc-${suffix}`);
  return projectArenaFighter(card, arenaFixtureRevision(card));
}

function match() {
  const definition: ArenaMatchDefinition = {
    seed: "arena:npc:seed", mode: "practice",
    teams: [{ id: "player", fighters: [fighter("mintcub-1", "player")] }, { id: "npc", fighters: [fighter("voltray-1", "opponent")] }],
    stage: { id: "arena:npc", groundY: 0, fallY: -6, spawn: { x: 0, y: 0, z: 0 }, bounds: { minX: -10, maxX: 10, minZ: -8, maxZ: 8 }, obstacles: [] },
    spawns: [{ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }], pickups: [], mechanisms: [], hazards: [],
  };
  return createArenaMatch(definition);
}

function policy(actorId: string, tier: ArenaNpcTier): ArenaNpcPolicy {
  return { actorId, tier, seed: `policy:${tier}`, decisionIndex: 0 };
}

describe("fair observable-state Arena opponents", () => {
  it("exposes only observable state and bounded history", () => {
    const state = match();
    const actorId = state.teams[1].activeAssetId;
    const observation = observeArenaForNpc(state, actorId, "rival");
    assert.equal("inputs" in observation, false);
    assert.equal("seed" in observation, false);
    assert.equal("definitionDigest" in observation, false);
    assert.equal(observation.actor.assetId, actorId);
    assert.equal(observation.opponent.action.kind, "idle");
    assert.ok(observation.recentEvents.length <= 16);
  });

  it("uses deterministic tier-specific reaction limits and readable telegraphs", () => {
    const state = match();
    const actorId = state.teams[1].activeAssetId;
    const tiers: ArenaNpcTier[] = ["learner", "rival", "champion", "boss"];
    const inputs = tiers.map((tier) => chooseArenaNpcInput(policy(actorId, tier), observeArenaForNpc(state, actorId, tier)));
    assert.deepEqual(chooseArenaNpcInput(policy(actorId, "rival"), observeArenaForNpc(state, actorId, "rival")), inputs[1]);
    assert.ok(inputs[0]!.frame - state.frame >= 12);
    assert.ok(inputs[1]!.frame - state.frame >= 8);
    assert.ok(inputs[2]!.frame - state.frame >= 5);
    assert.ok(inputs[3]!.frame - state.frame >= 4);
    assert.equal(new Set(inputs.map((input) => input.combat?.kind ?? "move")).size > 1, true);
    assert.match(telegraphArenaNpcInput(inputs[0]!), /Learner|guard|strike|focus/i);
  });

  it("never selects an illegal cooldown or unaffordable action", () => {
    const state = match();
    const actorId = state.teams[1].activeAssetId;
    const fighterState = state.teams[1].fighters[actorId]!;
    const exhausted = {
      ...state,
      teams: [state.teams[0], { ...state.teams[1], fighters: { ...state.teams[1].fighters, [actorId]: { ...fighterState, combat: { ...fighterState.combat, stamina: 0, cooldowns: [999, 999] as [number, number] } } } }] as const,
    };
    const selected = chooseArenaNpcInput(policy(actorId, "boss"), observeArenaForNpc(exhausted, actorId, "boss"));
    assert.equal(selected.combat?.kind === "heavy" || selected.combat?.kind === "ability" || selected.combat?.kind === "dodge" || selected.combat?.kind === "parry", false);
  });

  it("uses public habit memory for champion counterplay without future input", () => {
    const state = match();
    const actorId = state.teams[1].activeAssetId;
    const opponentId = state.teams[0].activeAssetId;
    const events = Array.from({ length: 6 }, (_, index) => ({ id: `event:${index}`, sequence: index + 1, frame: index + 1, kind: "fighter.action" as const, actorId: opponentId, targetId: null, amount: 0, detail: "guard" }));
    const habitual = { ...state, frame: 10, sequence: 6, events };
    const observation = observeArenaForNpc(habitual, actorId, "champion");
    assert.equal(observation.opponentHabits.guard, 6);
    const selected = chooseArenaNpcInput(policy(actorId, "champion"), observation);
    assert.equal(selected.combat?.kind, "heavy");
  });
});
