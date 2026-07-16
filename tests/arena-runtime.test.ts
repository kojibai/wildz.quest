import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { projectArenaFighter } from "../src/features/play/arena/card-fighter";
import { advanceArenaMatch, createArenaMatch, type ArenaInputFrame, type ArenaMatchDefinition, type ArenaMatchState } from "../src/features/play/arena/runtime";
import { arenaFixtureCard, arenaFixtureRevision } from "./support/arena-fixtures";

function fighter(formId: string, suffix: string) {
  const card = arenaFixtureCard(formId, `runtime-${suffix}`);
  return projectArenaFighter(card, arenaFixtureRevision(card));
}

function definition(mode: "practice" | "mortal" = "mortal", leftCount = 2): ArenaMatchDefinition {
  const left = [fighter("mintcub-1", `${mode}-left-1`), fighter("voltray-1", `${mode}-left-2`), fighter("ledgerfox-1", `${mode}-left-3`)].slice(0, leftCount);
  const right = [fighter("titanseal-1", `${mode}-right-1`)];
  return {
    seed: `arena:seed:${mode}:${leftCount}`, mode,
    teams: [{ id: "team:left", fighters: left, items: { heal: 1 } }, { id: "team:right", fighters: right }],
    stage: {
      id: "arena:stage:first", groundY: 0, fallY: -6, spawn: { x: 0, y: 0, z: 0 },
      bounds: { minX: -12, maxX: 12, minZ: -8, maxZ: 8 }, obstacles: [],
    },
    spawns: [{ x: -0.75, y: 0, z: 0 }, { x: 0.75, y: 0, z: 0 }],
    pickups: [{ id: "heal", kind: "heal", amount: 20, position: { x: -0.75, y: 0, z: 0 } }],
    mechanisms: [{ id: "bridge", kind: "bridge", position: { x: -0.75, y: 0, z: 0 } }],
    hazards: [{ id: "pulse", damage: 7, position: { x: 8, y: 0, z: 0 }, radius: 1 }],
  };
}

const neutral = { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false } as const;
function input(state: ArenaMatchState, actorId: string, value: Partial<ArenaInputFrame> = {}): ArenaInputFrame {
  return { sequence: state.sequence + 1, frame: state.frame + 1, actorId, movement: neutral, combat: null, tagAssetId: null, contextTargetId: null, withdraw: false, ...value };
}

function active(state: ArenaMatchState, team = 0) {
  const side = state.teams[team]!;
  return side.fighters[side.activeAssetId]!;
}

describe("mortal three-card Arena runtime", () => {
  it("admits one to three unique living fighters and rejects invalid rosters", () => {
    assert.equal(createArenaMatch(definition("mortal", 1)).teams[0].order.length, 1);
    assert.equal(createArenaMatch(definition("mortal", 3)).teams[0].order.length, 3);
    const duplicate = definition();
    assert.throws(() => createArenaMatch({ ...duplicate, teams: [{ ...duplicate.teams[0], fighters: [duplicate.teams[0].fighters[0]!, duplicate.teams[0].fighters[0]!] }, duplicate.teams[1]] }), /arena_roster_duplicate/);
    const card = arenaFixtureCard("mintcub-1", "runtime-retired");
    const condition = { ...emptyAdventureCondition(card.id), life: "dead" as const, retiredAt: "2026-07-16T22:00:00.000Z", retirementCauseEventId: "arena:event:zero" };
    const retired = projectArenaFighter(card, arenaFixtureRevision(card, condition));
    assert.throws(() => createArenaMatch({ ...duplicate, teams: [{ id: "team:left", fighters: [retired] }, duplicate.teams[1]] }), /arena_roster_retired/);
  });

  it("tags through a vulnerable window while preserving the outgoing fighter", () => {
    let state = createArenaMatch(definition());
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
    let state = createArenaMatch(definition());
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
    let state = createArenaMatch(definition());
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
    let state = createArenaMatch(definition());
    const actorId = active(state).definition.assetId;
    state = advanceArenaMatch(state, [input(state, actorId, { withdraw: true })]);
    assert.equal(state.phase, "terminal");
    assert.equal(state.terminal?.reason, "withdrawal");
    assert.equal(Object.values(state.teams[0]!.fighters).some((fighterState) => fighterState.status === "retired"), false);
  });

  it("retires at exact zero in Mortal mode and continues with survivors", () => {
    let state = createArenaMatch(definition("mortal", 2));
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
    let state = createArenaMatch(definition("practice", 1));
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
