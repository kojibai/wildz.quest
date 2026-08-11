import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { projectArenaFighter } from "../src/features/play/arena/card-fighter";
import { advanceArenaFrame, advanceArenaMatch, createArenaMatch, type ArenaFrameIntent, type ArenaInputFrame, type ArenaMatchDefinition, type ArenaMatchState } from "../src/features/play/arena/runtime";
import { arenaFixtureAuthorizeDefinition, arenaFixtureCard, arenaFixtureCreateMatch, arenaFixtureRevision, arenaFixtureVerification } from "./support/arena-fixtures";

function fighter(formId: string, suffix: string) {
  const card = arenaFixtureCard(formId, `runtime-${suffix}`);
  return projectArenaFighter(card, arenaFixtureRevision(card));
}

function definition(mode: "practice" | "mortal" = "mortal", leftCount = 2): ArenaMatchDefinition {
  const left = [fighter("mintcub-1", `${mode}-left-1`), fighter("voltray-1", `${mode}-left-2`), fighter("ledgerfox-1", `${mode}-left-3`)].slice(0, leftCount);
  const right = [fighter("titanseal-1", `${mode}-right-1`)];
  return arenaFixtureAuthorizeDefinition({
    seed: `arena:seed:${mode}:${leftCount}`, kai: { schema: "receiz.wildz.kai_temporal_root.v1", authority: "admitted", uPulse: 17_491_270_421, pulse: 17_491, sequence: 0, coordinate: "kai:arena:test" }, mode, authority: mode === "practice" ? "local" : "offline-pending",
    teams: [{ id: "team:left", fighters: left, items: { heal: 1 } }, { id: "team:right", fighters: right }],
    stage: {
      id: "arena:stage:first", groundY: 0, fallY: -6, spawn: { x: 0, y: 0, z: 0 },
      bounds: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 }, obstacles: [],
    },
    spawns: [{ x: -0.75, y: 0, z: 0 }, { x: 0.75, y: 0, z: 0 }],
    pickups: [{ id: "heal", kind: "heal", amount: 20, position: { x: -0.75, y: 0, z: 0 } }],
    mechanisms: [{ id: "bridge", kind: "bridge", position: { x: -0.75, y: 0, z: 0 } }],
    hazards: [{ id: "pulse", damage: 7, position: { x: 8, y: 0, z: 0 }, radius: 1 }],
  });
}

const neutral = { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false } as const;
function input(state: ArenaMatchState, actorId: string, value: Partial<ArenaInputFrame> = {}): ArenaInputFrame {
  return { sequence: state.sequence + 1, frame: state.frame + 1, actorId, movement: neutral, combat: null, tagAssetId: null, contextTargetId: null, withdraw: false, ...value };
}

function active(state: ArenaMatchState, team = 0) {
  const side = state.teams[team]!;
  return side.fighters[side.activeAssetId]!;
}

function frameIntent(actorId: string, value: Partial<ArenaFrameIntent> = {}): ArenaFrameIntent {
  return { actorId, movement: neutral, combat: null, tagAssetId: null, contextTargetId: null, withdraw: false, ...value };
}

describe("mortal three-card Arena runtime", () => {
  it("admits both fighters on one atomic frame independent of arrival order", () => {
    const created = arenaFixtureCreateMatch(definition("practice", 1));
    const leftId = active(created, 0).definition.assetId;
    const rightId = active(created, 1).definition.assetId;
    const intents = [
      frameIntent(leftId, { movement: { ...neutral, moveX: 1 } }),
      frameIntent(rightId, { movement: { ...neutral, moveX: -1 } }),
    ];
    const left = advanceArenaFrame(created, { frame: 1, intents });
    const right = advanceArenaFrame(created, { frame: 1, intents: [...intents].reverse() });
    assert.deepEqual(left, right);
    assert.equal(left.frame, 1);
    assert.equal(left.sequence, 2);
    assert.equal(left.inputs.every((value) => value.frame === 1), true);
  });

  it("advances both fighters at the same 60 Hz movement rate", () => {
    const base = definition("practice", 1);
    const mirrorId = `${base.teams[1].fighters[0]!.assetId}:mirror`;
    const mirror = { ...base.teams[0].fighters[0]!, assetId: mirrorId, condition: { ...base.teams[0].fighters[0]!.condition, assetId: mirrorId } };
    const symmetric = { ...base, teams: [{ ...base.teams[0], fighters: [base.teams[0].fighters[0]!] }, { ...base.teams[1], fighters: [mirror] }] } as ArenaMatchDefinition;
    let state = arenaFixtureCreateMatch(symmetric);
    const leftId = active(state, 0).definition.assetId;
    const rightId = active(state, 1).definition.assetId;
    const leftStart = active(state, 0).movement.position.x;
    const rightStart = active(state, 1).movement.position.x;
    for (let frame = 1; frame <= 60; frame += 1) {
      state = advanceArenaFrame(state, { frame, intents: [
        frameIntent(leftId, { movement: { ...neutral, moveX: 1 } }),
        frameIntent(rightId, { movement: { ...neutral, moveX: -1 } }),
      ] });
    }
    assert.equal(active(state, 0).movement.position.x - leftStart, -(active(state, 1).movement.position.x - rightStart));
  });

  it("commits simultaneous exact-zero damage as a draw without order advantage", () => {
    const base = definition("practice", 1);
    let state = arenaFixtureCreateMatch(base);
    const leftId = active(state, 0).definition.assetId;
    const rightId = active(state, 1).definition.assetId;
    state = { ...state, teams: [
      { ...state.teams[0], fighters: { ...state.teams[0].fighters, [leftId]: { ...active(state, 0), combat: { ...active(state, 0).combat, vitality: 1 } } } },
      { ...state.teams[1], fighters: { ...state.teams[1].fighters, [rightId]: { ...active(state, 1), combat: { ...active(state, 1).combat, vitality: 1 } } } },
    ] };
    for (let frame = 1; frame <= 12; frame += 1) {
      state = advanceArenaFrame(state, { frame, intents: [
        frameIntent(leftId, { combat: frame === 1 ? { kind: "heavy", direction: { x: 1, y: 0, z: 0 } } : null }),
        frameIntent(rightId, { combat: frame === 1 ? { kind: "heavy", direction: { x: -1, y: 0, z: 0 } } : null }),
      ] });
    }
    assert.equal(state.phase, "terminal");
    assert.equal(state.terminal?.reason, "double-defeat");
    assert.equal(state.terminal?.winnerTeamId, null);
    assert.equal(active(state, 0).combat.vitality, 0);
    assert.equal(active(state, 1).combat.vitality, 0);
  });

  it("regenerates bounded stamina on canonical world frames", () => {
    let state = arenaFixtureCreateMatch(definition("practice", 1));
    const leftId = active(state, 0).definition.assetId;
    const rightId = active(state, 1).definition.assetId;
    state = advanceArenaFrame(state, { frame: 1, intents: [
      frameIntent(leftId, { combat: { kind: "heavy", direction: { x: 1, y: 0, z: 0 } } }),
      frameIntent(rightId),
    ] });
    assert.ok(active(state, 0).combat.stamina < 100);
    for (let frame = 2; frame <= 90; frame += 1) {
      state = advanceArenaFrame(state, { frame, intents: [frameIntent(leftId), frameIntent(rightId)] });
    }
    assert.equal(active(state, 0).combat.stamina, 100);
  });

  it("activates a declared boss hazard only after its Kai-pinned phase transition", () => {
    const base = definition("practice", 1);
    const bossId = base.teams[1].fighters[0]!.assetId;
    const phased: ArenaMatchDefinition = {
      ...base,
      hazards: [{ id: "boss-flare", damage: 9, position: base.spawns[0], radius: 0.5 }],
      boss: { teamId: base.teams[1].id, phases: [{ id: "phase:flare", vitalityThreshold: 0.75, transitionFrame: 1, weakness: "parry", hazard: "boss-flare", legalActions: ["parry", "heavy"] }] },
    };
    let state = arenaFixtureCreateMatch(phased);
    const playerId = active(state, 0).definition.assetId;
    state = { ...state, teams: [state.teams[0], { ...state.teams[1], fighters: { ...state.teams[1].fighters, [bossId]: { ...active(state, 1), combat: { ...active(state, 1).combat, vitality: Math.floor(active(state, 1).definition.maxVitality * 0.7) } } } }] };
    const before = active(state, 0).combat.vitality;
    state = advanceArenaFrame(state, { frame: 1, intents: [frameIntent(playerId), frameIntent(bossId)] });
    assert.equal(active(state, 0).combat.vitality, before);
    assert.equal(state.stage.activeBossHazard, "boss-flare");
    state = advanceArenaFrame(state, { frame: 2, intents: [frameIntent(playerId), frameIntent(bossId)] });
    assert.equal(active(state, 0).combat.vitality, before - 9);
    assert.equal(state.events.some((value) => value.kind === "hazard.hit" && value.targetId === "boss-flare"), true);
  });
  it("admits one to three unique living fighters and rejects invalid rosters", () => {
    assert.equal(arenaFixtureCreateMatch(definition("mortal", 1)).teams[0].order.length, 1);
    assert.equal(arenaFixtureCreateMatch(definition("mortal", 3)).teams[0].order.length, 3);
    const duplicate = definition();
    assert.throws(() => arenaFixtureCreateMatch({ ...duplicate, teams: [{ ...duplicate.teams[0], fighters: [duplicate.teams[0].fighters[0]!, duplicate.teams[0].fighters[0]!] }, duplicate.teams[1]] }), /arena_roster_duplicate|arena_mortal_covenant_invalid/);
    const card = arenaFixtureCard("mintcub-1", "runtime-retired");
    const condition = { ...emptyAdventureCondition(card.id), life: "dead" as const, retiredAt: "2026-07-16T22:00:00.000Z", retirementCauseEventId: "arena:event:zero" };
    const retired = projectArenaFighter(card, arenaFixtureRevision(card, condition));
    assert.throws(() => arenaFixtureCreateMatch(arenaFixtureAuthorizeDefinition({ ...duplicate, teams: [{ id: "team:left", fighters: [retired] }, duplicate.teams[1]] })), /arena_roster_retired/);
  });

  it("fails Ranked creation closed unless the definition pins global authority", () => {
    const base = definition("practice", 1);
    assert.throws(() => createArenaMatch({ ...base, mode: "ranked", authority: "local" }), /arena_mode_global_authority_required/);
    assert.throws(() => createArenaMatch({ ...base, mode: "ranked", authority: "global" }), /arena_ranked_global_admission_unavailable/);
    const admitted = arenaFixtureCreateMatch(arenaFixtureAuthorizeDefinition({ ...base, mode: "ranked", authority: "global" }));
    assert.equal(admitted.mode, "ranked");
  });

  it("fails Mortal creation closed unless exact covenant consent is pinned", () => {
    const base = definition("mortal", 1);
    const { mortalCovenant: _mortalCovenant, ...withoutCovenant } = base;
    assert.throws(() => createArenaMatch(withoutCovenant, arenaFixtureVerification), /arena_mortal_covenant_required/);
    assert.throws(() => createArenaMatch({ ...withoutCovenant, covenantDigest: `sha256:${"c".repeat(64)}` }, arenaFixtureVerification), /arena_mortal_covenant_required/);
    assert.equal(arenaFixtureCreateMatch(base).definitionDigest.length, 71);
  });

  it("tags through a vulnerable window while preserving the outgoing fighter", () => {
    let state = arenaFixtureCreateMatch(definition());
    const outgoing = active(state);
    const nextId = state.teams[0]!.order[1]!;
    state = advanceArenaMatch(state, [input(state, outgoing.definition.assetId, { tagAssetId: nextId })]);
    assert.equal(state.teams[0]!.activeAssetId, nextId);
    assert.ok(state.teams[0]!.tagVulnerableUntil > state.frame);
    assert.deepEqual(state.teams[0]!.fighters[outgoing.definition.assetId]!.definition.condition, outgoing.definition.condition);
    assert.equal(state.events.at(-1)?.kind, "fighter.tagged");
    state = advanceArenaMatch(state, [input(state, nextId, { combat: { kind: "dodge", direction: { x: 1, y: 0, z: 0 } } })]);
    assert.equal(state.teams[0]!.tagVulnerableUntil, 0);
    assert.equal(state.events.some((event) => event.kind === "fighter.tag-cancelled"), true);
  });

  it("uses pickups and mechanisms once and applies sealed hazards", () => {
    let state = arenaFixtureCreateMatch(definition());
    const actorId = active(state).definition.assetId;
    state = { ...state, teams: [{ ...state.teams[0]!, fighters: { ...state.teams[0]!.fighters, [actorId]: { ...active(state), combat: { ...active(state).combat, vitality: active(state).combat.vitality - 30 } } } }, state.teams[1]] };
    const before = active(state).combat.vitality;
    state = advanceArenaMatch(state, [input(state, actorId, { contextTargetId: "pickup:heal" })]);
    assert.equal(active(state).combat.vitality, before + 20);
    assert.deepEqual(state.stage.consumedPickupIds, ["heal"]);
    state = advanceArenaMatch(state, [input(state, actorId, { contextTargetId: "mechanism:bridge" })]);
    assert.deepEqual(state.stage.activatedMechanismIds, ["bridge"]);
    const positioned = { ...active(state), movement: { ...active(state).movement, position: { x: 8, y: 0, z: 0 } } };
    state = { ...state, teams: [{ ...state.teams[0]!, fighters: { ...state.teams[0]!.fighters, [actorId]: positioned } }, state.teams[1]] };
    const preHazard = active(state).combat.vitality;
    state = advanceArenaMatch(state, [input(state, actorId)]);
    assert.equal(active(state).combat.vitality, preHazard - 7);
  });

  it("spends locked healing items and a bounded bond rescue exactly once", () => {
    let state = arenaFixtureCreateMatch(definition());
    const actorId = active(state).definition.assetId;
    const reserveId = state.teams[0]!.order[1]!;
    const actor = { ...active(state), combat: { ...active(state).combat, vitality: active(state).combat.vitality - 30 } };
    const reserve = { ...state.teams[0]!.fighters[reserveId]!, combat: { ...state.teams[0]!.fighters[reserveId]!.combat, vitality: state.teams[0]!.fighters[reserveId]!.combat.vitality - 20 } };
    state = { ...state, teams: [{ ...state.teams[0]!, fighters: { ...state.teams[0]!.fighters, [actorId]: actor, [reserveId]: reserve } }, state.teams[1]] };
    state = advanceArenaMatch(state, [input(state, actorId, { contextTargetId: "item:heal" })]);
    assert.equal(state.teams[0]!.itemCharges.heal, 0);
    assert.equal(state.events.at(-1)?.kind, "item.used");
    state = advanceArenaMatch(state, [input(state, actorId, { contextTargetId: `rescue:${reserveId}` })]);
    assert.equal(state.teams[0]!.rescueCharges, 0);
    assert.equal(state.events.at(-1)?.kind, "fighter.rescued");
    assert.throws(() => advanceArenaMatch(state, [input(state, actorId, { contextTargetId: `rescue:${reserveId}` })]), /arena_rescue_invalid/);
  });

  it("allows withdrawal before zero and seals a loss without retirement", () => {
    let state = arenaFixtureCreateMatch(definition());
    const actorId = active(state).definition.assetId;
    state = advanceArenaMatch(state, [input(state, actorId, { withdraw: true })]);
    assert.equal(state.phase, "terminal");
    assert.equal(state.terminal?.reason, "withdrawal");
    assert.equal(Object.values(state.teams[0]!.fighters).some((fighterState) => fighterState.status === "retired"), false);
  });

  it("retires at exact zero in Mortal mode and continues with survivors", () => {
    let state = arenaFixtureCreateMatch(definition("mortal", 2));
    const victimId = active(state, 0).definition.assetId;
    const attackerId = active(state, 1).definition.assetId;
    state = { ...state, teams: [{ ...state.teams[0]!, fighters: { ...state.teams[0]!.fighters, [victimId]: { ...active(state, 0), combat: { ...active(state, 0).combat, vitality: 1 } } } }, state.teams[1]] };
    state = advanceArenaMatch(state, [input(state, attackerId, { combat: { kind: "heavy", direction: { x: -1, y: 0, z: 0 } } })]);
    state = advanceArenaMatch(state, [input(state, attackerId, { frame: 13 })]);
    assert.equal(state.teams[0]!.fighters[victimId]!.status, "retired");
    assert.notEqual(state.teams[0]!.activeAssetId, victimId);
    assert.equal(state.phase, "active");
    assert.equal(state.events.some((event) => event.kind === "fighter.retired" && event.frame === 13), true);
  });

  it("knocks out instead of retiring in practice and rejects malformed input", () => {
    let state = arenaFixtureCreateMatch(definition("practice", 1));
    const victimId = active(state, 0).definition.assetId;
    const attackerId = active(state, 1).definition.assetId;
    state = { ...state, teams: [{ ...state.teams[0]!, fighters: { ...state.teams[0]!.fighters, [victimId]: { ...active(state, 0), combat: { ...active(state, 0).combat, vitality: 1 } } } }, state.teams[1]] };
    assert.throws(() => advanceArenaMatch(state, [input(state, attackerId, { sequence: 4 })]), /arena_input_sequence_invalid/);
    assert.throws(() => advanceArenaMatch(state, [input(state, "card:foreign")]), /arena_input_actor_invalid/);
    assert.throws(() => advanceArenaMatch(state, [input(state, attackerId, { movement: { ...neutral, moveX: 2 } })]), /arena_movement_input_invalid/);
    assert.throws(() => advanceArenaMatch(state, [input(state, attackerId, { tagAssetId: "card:foreign" })]), /arena_tag_target_invalid/);
    assert.throws(() => advanceArenaMatch(state, [input(state, attackerId, { contextTargetId: "pickup:foreign" })]), /arena_pickup_invalid/);
    state = advanceArenaMatch(state, [input(state, attackerId, { combat: { kind: "heavy", direction: { x: -1, y: 0, z: 0 } } })]);
    state = advanceArenaMatch(state, [input(state, attackerId, { frame: 13 })]);
    assert.equal(state.teams[0]!.fighters[victimId]!.status, "knocked-out");
    assert.equal(state.terminal?.reason, "team-defeat");
    assert.equal(state.events.some((event) => event.kind === "fighter.retired"), false);
    assert.throws(() => advanceArenaMatch(state, [input(state, attackerId)]), /arena_match_terminal/);
  });
});
