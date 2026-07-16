import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hearttreeAbilitiesFor } from "../src/features/play/hearttree/ability-registry";
import { emptyHearttreeCondition, projectHearttreeCard, type HearttreeCardCapability } from "../src/features/play/hearttree/card-capability";
import { generateHearttreeExpedition } from "../src/features/play/hearttree/expedition-director";
import {
  createHearttreeRuntime,
  stepHearttreeRuntime,
  type HearttreeInput,
  type HearttreeRuntimeState
} from "../src/features/play/hearttree/runtime";
import { sealCollectedCard } from "../src/features/play/portable-card";

function capability(formId: string, encounterId = formId): HearttreeCardCapability {
  const source = sealCollectedCard({
    formId,
    ownerReceizId: "hearttree.player",
    encounterId: `runtime:${encounterId}`,
    capturedAt: "2026-07-16T15:00:00.000Z"
  });
  return projectHearttreeCard(source, emptyHearttreeCondition(source.id));
}

function setup(squad = [capability("mintcub-1")], mortal = false) {
  const definition = generateHearttreeExpedition({ seed: "runtime:expedition", squad, history: [], mortal });
  return { definition, squad, state: createHearttreeRuntime(definition, squad) };
}

type WithoutRuntimeClock<T> = T extends HearttreeInput ? Omit<T, "sequence" | "tick"> : never;

function input(state: HearttreeRuntimeState, value: WithoutRuntimeClock<HearttreeInput>): HearttreeInput {
  return { ...value, sequence: state.sequence + 1, tick: state.tick + 1 } as HearttreeInput;
}

describe("Hearttree fixed-step runtime", () => {
  it("moves from real speed, keeps the player inside chamber bounds, and records input", () => {
    const { state } = setup();
    const moved = stepHearttreeRuntime(state, input(state, { kind: "move", vector: { x: 1, z: 0 } }));
    const actor = moved.cards[moved.activeAssetId]!;

    assert.ok(actor.position.x > 0);
    assert.equal(actor.position.z, 0);
    assert.equal(moved.inputs.length, 1);
    assert.equal(moved.tick, 1);

    let bounded = moved;
    for (let index = 0; index < 500; index += 1) bounded = stepHearttreeRuntime(bounded, input(bounded, { kind: "move", vector: { x: 1, z: 0 } }));
    assert.ok(bounded.cards[bounded.activeAssetId]!.position.x <= bounded.bounds.maxX);
  });

  it("rejects duplicate sequences, backwards ticks, non-finite vectors, and excessive tick jumps", () => {
    const { state } = setup();
    const valid = input(state, { kind: "move", vector: { x: 1, z: 0 } });
    const moved = stepHearttreeRuntime(state, valid);
    assert.throws(() => stepHearttreeRuntime(moved, valid), /hearttree_input_sequence_invalid/);
    assert.throws(() => stepHearttreeRuntime(moved, { ...input(moved, { kind: "move", vector: { x: 1, z: 0 } }), tick: moved.tick }), /hearttree_input_tick_invalid/);
    assert.throws(() => stepHearttreeRuntime(moved, input(moved, { kind: "move", vector: { x: Number.NaN, z: 0 } })), /hearttree_input_vector_invalid/);
    assert.throws(() => stepHearttreeRuntime(moved, { ...input(moved, { kind: "move", vector: { x: 1, z: 0 } }), tick: moved.tick + 121 }), /hearttree_input_tick_invalid/);
  });

  it("makes hazards cause real damage unless a timed dodge avoids the hit", () => {
    const first = setup();
    let exposed = first.state;
    const startHealth = exposed.cards[exposed.activeAssetId]!.health;
    while (exposed.cards[exposed.activeAssetId]!.position.x < exposed.hazards[0]!.position.x) {
      exposed = stepHearttreeRuntime(exposed, input(exposed, { kind: "move", vector: { x: 1, z: 0 } }));
    }
    assert.ok(exposed.cards[exposed.activeAssetId]!.health < startHealth);

    let dodging = setup().state;
    dodging = stepHearttreeRuntime(dodging, input(dodging, { kind: "dodge", vector: { x: 1, z: 0 }, timingOffsetMs: 0 }));
    const dodgeHealth = dodging.cards[dodging.activeAssetId]!.health;
    while (dodging.cards[dodging.activeAssetId]!.position.x < dodging.hazards[0]!.position.x) {
      dodging = stepHearttreeRuntime(dodging, input(dodging, { kind: "move", vector: { x: 1, z: 0 } }));
    }
    assert.equal(dodging.cards[dodging.activeAssetId]!.health, dodgeHealth);
  });

  it("spends stamina, enforces cooldowns, and records real ability contributions", () => {
    const { state, squad } = setup([capability("voltray-1", "ability")]);
    const abilityId = hearttreeAbilitiesFor(squad[0]!)[0]!.id;
    const used = stepHearttreeRuntime(state, input(state, { kind: "ability", abilityId, timingOffsetMs: 0 }));
    const actor = used.cards[used.activeAssetId]!;

    assert.ok(actor.stamina < state.cards[state.activeAssetId]!.stamina);
    assert.ok(actor.cooldowns[abilityId]! > used.tick);
    assert.equal(used.events.some((event) => event.kind === "ability.succeeded" && event.assetId === actor.assetId), true);
    assert.throws(() => stepHearttreeRuntime(used, input(used, { kind: "ability", abilityId, timingOffsetMs: 0 })), /hearttree_action_cooldown/);
  });

  it("switches among the admitted one-to-three-card squad and charges tactical switches", () => {
    const squad = [capability("mintcub-1", "switch-a"), capability("voltray-1", "switch-b")];
    const { state } = setup(squad);
    const safe = stepHearttreeRuntime(state, input(state, { kind: "switch", assetId: squad[1]!.assetId, tactical: false }));
    assert.equal(safe.activeAssetId, squad[1]!.assetId);
    assert.equal(safe.switchCharge, state.switchCharge);

    const threatened = { ...safe, threatActive: true };
    assert.throws(() => stepHearttreeRuntime(threatened, input(threatened, { kind: "switch", assetId: squad[0]!.assetId, tactical: false })), /hearttree_switch_window_closed/);
    const tactical = stepHearttreeRuntime(threatened, input(threatened, { kind: "switch", assetId: squad[0]!.assetId, tactical: true }));
    assert.equal(tactical.activeAssetId, squad[0]!.assetId);
    assert.equal(tactical.switchCharge, threatened.switchCharge - 1);
  });

  it("requires real navigation before an objective advances the expedition", () => {
    const { state } = setup();
    assert.throws(() => stepHearttreeRuntime(state, input(state, { kind: "interact" })), /hearttree_objective_out_of_range/);

    let arrived = state;
    while (arrived.cards[arrived.activeAssetId]!.position.x < arrived.objective.position.x - 0.5) {
      arrived = stepHearttreeRuntime(arrived, input(arrived, { kind: "move", vector: { x: 1, z: 0 } }));
    }
    const advanced = stepHearttreeRuntime(arrived, input(arrived, { kind: "interact" }));

    assert.equal(advanced.phase, "memory");
    assert.equal(advanced.chamberIndex, 1);
    assert.equal(advanced.events.at(-1)?.kind, "objective.completed");
  });

  it("keeps the master chamber locked until the generated boss is defeated", () => {
    const { state } = setup();
    const atMasterObjective = {
      ...state,
      phase: "master" as const,
      chamberIndex: 2,
      threatActive: true,
      objective: { id: "master-objective", position: { x: 0, z: 0 }, complete: false }
    };
    assert.throws(() => stepHearttreeRuntime(atMasterObjective, input(atMasterObjective, { kind: "interact" })), /hearttree_master_active/);

    const defeatedBoss = { ...atMasterObjective, boss: { ...atMasterObjective.boss, health: 0 } };
    const advanced = stepHearttreeRuntime(defeatedBoss, input(defeatedBoss, { kind: "interact" }));
    assert.equal(advanced.phase, "choice");
    assert.equal(advanced.threatActive, false);
  });

  it("supports deliberate extraction and never turns runtime defeat into canonical death", () => {
    const { state } = setup(undefined, true);
    const extracted = stepHearttreeRuntime(state, input(state, { kind: "extract" }));
    assert.equal(extracted.phase, "extracted");
    assert.equal(extracted.terminalReason, "player-extracted");
    assert.equal(Object.values(extracted.cards).every((card) => card.life === "alive"), true);
    assert.throws(() => stepHearttreeRuntime(extracted, input(extracted, { kind: "move", vector: { x: 1, z: 0 } })), /hearttree_runtime_terminal/);
  });
});
