import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { hearttreeAbilityById } from "./ability-registry";
import { resolveHearttreeAction } from "./action-resolver";
import type { HearttreeCardCapability } from "./card-capability";
import type { HearttreeExpeditionDefinition } from "./expedition-director";

export const HEARTTREE_FIXED_HZ = 60;
export const HEARTTREE_FIXED_DT = 1 / HEARTTREE_FIXED_HZ;

export type HearttreeVector = Readonly<{ x: number; z: number }>;
export type HearttreeInput =
  | Readonly<{ sequence: number; tick: number; kind: "move"; vector: HearttreeVector }>
  | Readonly<{ sequence: number; tick: number; kind: "dodge"; vector: HearttreeVector; timingOffsetMs: number }>
  | Readonly<{ sequence: number; tick: number; kind: "guard"; timingOffsetMs: number }>
  | Readonly<{ sequence: number; tick: number; kind: "ability"; abilityId: string; timingOffsetMs: number }>
  | Readonly<{ sequence: number; tick: number; kind: "switch"; assetId: string; tactical: boolean }>
  | Readonly<{ sequence: number; tick: number; kind: "interact" }>
  | Readonly<{ sequence: number; tick: number; kind: "extract" }>;

export type HearttreeRuntimeCard = Readonly<{
  assetId: string;
  life: "alive";
  position: HearttreeVector;
  health: number;
  maxHealth: number;
  stamina: number;
  cooldowns: Readonly<Record<string, number>>;
  evadeUntilTick: number;
  guardUntilTick: number;
}>;

export type HearttreeRuntimeEvent = Readonly<{
  id: string;
  tick: number;
  sequence: number;
  kind: "moved" | "hazard.hit" | "dodged" | "guarded" | "ability.succeeded" | "switched" | "objective.completed" | "extracted";
  assetId: string;
  amount: number;
  detail: string;
}>;

export type HearttreeRuntimeState = Readonly<{
  schema: "receiz.wilds.hearttree_runtime.v1";
  expeditionId: string;
  tick: number;
  sequence: number;
  phase: "rootway" | "memory" | "master" | "choice" | "result" | "extracted" | "defeated";
  terminalReason: "player-extracted" | "squad-defeated" | "completed" | null;
  chamberIndex: number;
  activeAssetId: string;
  squad: readonly HearttreeCardCapability[];
  cards: Readonly<Record<string, HearttreeRuntimeCard>>;
  switchCharge: number;
  threatActive: boolean;
  bounds: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
  colliders: readonly Readonly<{ id: string; minX: number; maxX: number; minZ: number; maxZ: number }>[];
  hazards: readonly Readonly<{ id: string; position: HearttreeVector; radius: number; damage: number; triggeredAssetIds: readonly string[] }>[];
  objective: Readonly<{ id: string; position: HearttreeVector; complete: boolean }>;
  boss: Readonly<{ id: string; health: number; maxHealth: number; guard: number }>;
  inputs: readonly HearttreeInput[];
  events: readonly HearttreeRuntimeEvent[];
  checkpoints: readonly Readonly<{ tick: number; stateDigest: string }>[];
}>;

function phaseFor(index: number): HearttreeRuntimeState["phase"] {
  return (["rootway", "memory", "master", "choice"] as const)[index] ?? "result";
}

function runtimeCard(capability: HearttreeCardCapability): HearttreeRuntimeCard {
  return {
    assetId: capability.assetId,
    life: "alive",
    position: { x: 0, z: 0 },
    health: capability.stats.health,
    maxHealth: capability.stats.health,
    stamina: 100,
    cooldowns: {},
    evadeUntilTick: 0,
    guardUntilTick: 0
  };
}

export function createHearttreeRuntime(definition: HearttreeExpeditionDefinition, squad: readonly HearttreeCardCapability[]): HearttreeRuntimeState {
  const pinsMatch = definition.squadPins.length === squad.length && definition.squadPins.every((pin) => squad.some((card) => card.assetId === pin.assetId && card.proofDigest === pin.proofDigest));
  if (!pinsMatch) throw new Error("hearttree_runtime_squad_pins_invalid");
  const cards = Object.fromEntries(squad.map((card) => [card.assetId, runtimeCard(card)]));
  return {
    schema: "receiz.wilds.hearttree_runtime.v1",
    expeditionId: definition.id,
    tick: 0,
    sequence: 0,
    phase: "rootway",
    terminalReason: null,
    chamberIndex: 0,
    activeAssetId: squad[0]!.assetId,
    squad: [...squad],
    cards,
    switchCharge: Math.max(1, squad.length),
    threatActive: false,
    bounds: { minX: -6, maxX: 6, minZ: -4, maxZ: 4 },
    colliders: [{ id: "root-buttress", minX: 0.75, maxX: 1.25, minZ: 1.25, maxZ: 3.5 }],
    hazards: [{ id: "root-surge", position: { x: 1, z: 0 }, radius: 0.28, damage: 12, triggeredAssetIds: [] }],
    objective: { id: definition.chambers[0]!.id, position: { x: 2, z: 0 }, complete: false },
    boss: { id: definition.boss.id, health: definition.boss.power, maxHealth: definition.boss.power, guard: definition.boss.guard },
    inputs: [],
    events: [],
    checkpoints: []
  };
}

function capabilityFor(squad: readonly HearttreeCardCapability[], assetId: string) {
  const capability = squad.find((card) => card.assetId === assetId);
  if (!capability) throw new Error("hearttree_runtime_card_missing");
  return capability;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalized(vector: HearttreeVector) {
  if (![vector.x, vector.z].every(Number.isFinite)) throw new Error("hearttree_input_vector_invalid");
  const length = Math.hypot(vector.x, vector.z);
  if (length > 1.000_001) return { x: vector.x / length, z: vector.z / length };
  return { x: vector.x, z: vector.z };
}

function collides(state: HearttreeRuntimeState, position: HearttreeVector) {
  return state.colliders.some((collider) => position.x >= collider.minX && position.x <= collider.maxX && position.z >= collider.minZ && position.z <= collider.maxZ);
}

function event(state: HearttreeRuntimeState, kind: HearttreeRuntimeEvent["kind"], assetId: string, amount: number, detail: string): HearttreeRuntimeEvent {
  const basis = { expeditionId: state.expeditionId, tick: state.tick, sequence: state.sequence, kind, assetId, amount, detail };
  return { ...basis, id: sha256PortableBasis(canonicalPortableCardJson(basis)) };
}

function projection(state: HearttreeRuntimeState) {
  return {
    schema: state.schema,
    expeditionId: state.expeditionId,
    tick: state.tick,
    sequence: state.sequence,
    phase: state.phase,
    terminalReason: state.terminalReason,
    chamberIndex: state.chamberIndex,
    activeAssetId: state.activeAssetId,
    cards: state.cards,
    switchCharge: state.switchCharge,
    threatActive: state.threatActive,
    bounds: state.bounds,
    colliders: state.colliders,
    hazards: state.hazards,
    objective: state.objective,
    boss: state.boss,
    events: state.events
  };
}

export function hearttreeRuntimeStateDigest(state: HearttreeRuntimeState) {
  return sha256PortableBasis(canonicalPortableCardJson(projection(state)));
}

function withCheckpoint(state: HearttreeRuntimeState): HearttreeRuntimeState {
  const lastTick = state.checkpoints.at(-1)?.tick ?? 0;
  if (state.tick - lastTick < 120) return state;
  return { ...state, checkpoints: [...state.checkpoints, { tick: state.tick, stateDigest: hearttreeRuntimeStateDigest(state) }] };
}

function validateInput(state: HearttreeRuntimeState, input: HearttreeInput) {
  if (state.phase === "result" || state.phase === "extracted" || state.phase === "defeated") throw new Error("hearttree_runtime_terminal");
  if (!Number.isSafeInteger(input.sequence) || input.sequence !== state.sequence + 1) throw new Error("hearttree_input_sequence_invalid");
  if (!Number.isSafeInteger(input.tick) || input.tick <= state.tick || input.tick - state.tick > 120) throw new Error("hearttree_input_tick_invalid");
}

function record(state: HearttreeRuntimeState, input: HearttreeInput, events: readonly HearttreeRuntimeEvent[] = []): HearttreeRuntimeState {
  return withCheckpoint({ ...state, inputs: [...state.inputs, input], events: [...state.events, ...events] });
}

function applyHazards(state: HearttreeRuntimeState): HearttreeRuntimeState {
  const active = state.cards[state.activeAssetId]!;
  let cards = state.cards;
  const emitted: HearttreeRuntimeEvent[] = [];
  const hazards = state.hazards.map((hazard) => {
    const inside = Math.hypot(active.position.x - hazard.position.x, active.position.z - hazard.position.z) <= hazard.radius;
    if (!inside || hazard.triggeredAssetIds.includes(active.assetId)) return hazard;
    const triggeredAssetIds = [...hazard.triggeredAssetIds, active.assetId];
    if (active.evadeUntilTick >= state.tick) return { ...hazard, triggeredAssetIds };
    const guarded = active.guardUntilTick >= state.tick;
    const damage = guarded ? Math.ceil(hazard.damage / 3) : hazard.damage;
    const nextHealth = Math.max(0, active.health - damage);
    cards = { ...cards, [active.assetId]: { ...active, health: nextHealth } };
    emitted.push(event(state, "hazard.hit", active.assetId, damage, hazard.id));
    return { ...hazard, triggeredAssetIds };
  });
  const defeated = Object.values(cards).every((card) => card.health <= 0);
  return {
    ...state,
    cards,
    hazards,
    events: [...state.events, ...emitted],
    phase: defeated ? "defeated" : state.phase,
    terminalReason: defeated ? "squad-defeated" : state.terminalReason
  };
}

export function stepHearttreeRuntime(state: HearttreeRuntimeState, input: HearttreeInput, squad?: readonly HearttreeCardCapability[]): HearttreeRuntimeState {
  validateInput(state, input);
  const runtimeSquad = squad ?? state.squad;
  let next: HearttreeRuntimeState = { ...state, tick: input.tick, sequence: input.sequence };
  const active = next.cards[next.activeAssetId]!;

  if (input.kind === "extract") {
    next = { ...next, phase: "extracted", terminalReason: "player-extracted" };
    return record(next, input, [event(next, "extracted", active.assetId, 0, "player-extracted")]);
  }

  if (input.kind === "switch") {
    if (!next.cards[input.assetId] || next.cards[input.assetId]!.health <= 0) throw new Error("hearttree_switch_card_invalid");
    if (next.threatActive && !input.tactical) throw new Error("hearttree_switch_window_closed");
    if (input.tactical && next.switchCharge <= 0) throw new Error("hearttree_switch_charge_empty");
    next = { ...next, activeAssetId: input.assetId, switchCharge: next.switchCharge - (input.tactical ? 1 : 0) };
    return record(next, input, [event(next, "switched", input.assetId, input.tactical ? 1 : 0, input.tactical ? "tactical" : "safe")]);
  }

  const capability = capabilityFor(runtimeSquad, next.activeAssetId);
  if (input.kind === "move") {
    const vector = normalized(input.vector);
    const distance = 0.05 + capability.stats.speed / 1_000;
    const candidate = {
      x: clamp(active.position.x + vector.x * distance, next.bounds.minX, next.bounds.maxX),
      z: clamp(active.position.z + vector.z * distance, next.bounds.minZ, next.bounds.maxZ)
    };
    const position = collides(next, candidate) ? active.position : candidate;
    next = { ...next, cards: { ...next.cards, [active.assetId]: { ...active, position } } };
    next = applyHazards(next);
    return record(next, input, [event(next, "moved", active.assetId, distance, `${position.x.toFixed(4)}:${position.z.toFixed(4)}`)]);
  }

  if (input.kind === "dodge" || input.kind === "guard") {
    const timingOffsetMs = input.timingOffsetMs;
    if (!Number.isFinite(timingOffsetMs)) throw new Error("hearttree_action_timing_invalid");
    const outcome = resolveHearttreeAction({
      kind: input.kind,
      actor: capability,
      abilityId: null,
      stamina: active.stamina,
      cooldownRemainingMs: 0,
      distance: 1,
      lineOfSight: true,
      timing: { pressedAtMs: 550 + timingOffsetMs, windowStartMs: 400, windowEndMs: 700 },
      target: { id: "hearttree-threat", element: "Grove", guard: 40, exposed: false },
      environment: { obstacle: "none", element: "Grove" }
    });
    if (!outcome.success) throw new Error(`hearttree_action_${outcome.failure}`);
    const card = {
      ...active,
      stamina: Math.max(0, active.stamina - outcome.staminaCost),
      evadeUntilTick: input.kind === "dodge" ? next.tick + 30 : active.evadeUntilTick,
      guardUntilTick: input.kind === "guard" ? next.tick + 30 : active.guardUntilTick
    };
    next = { ...next, cards: { ...next.cards, [active.assetId]: card } };
    return record(next, input, [event(next, input.kind === "dodge" ? "dodged" : "guarded", active.assetId, Math.round(outcome.margin), "timed")]);
  }

  if (input.kind === "ability") {
    const ability = hearttreeAbilityById(capability, input.abilityId);
    const cooldownUntil = active.cooldowns[input.abilityId] ?? 0;
    if (cooldownUntil > next.tick) throw new Error("hearttree_action_cooldown");
    const outcome = resolveHearttreeAction({
      kind: "ability",
      actor: capability,
      abilityId: input.abilityId,
      stamina: active.stamina,
      cooldownRemainingMs: 0,
      distance: 1.5,
      lineOfSight: true,
      timing: { pressedAtMs: 550 + input.timingOffsetMs, windowStartMs: 400, windowEndMs: 700 },
      target: { id: next.boss.id, element: "Grove", guard: next.phase === "master" ? next.boss.guard : 30, exposed: next.phase !== "master" },
      environment: { obstacle: "none", element: "Grove" }
    });
    if (!outcome.success) throw new Error(`hearttree_action_${outcome.failure}`);
    const card = {
      ...active,
      stamina: Math.max(0, active.stamina - outcome.staminaCost),
      cooldowns: { ...active.cooldowns, [input.abilityId]: next.tick + Math.ceil(ability.cooldownMs / (1_000 / HEARTTREE_FIXED_HZ)) }
    };
    const damage = outcome.effects.filter((effect) => effect.kind === "damage" || effect.kind === "break").reduce((sum, effect) => sum + effect.amount, 0);
    next = {
      ...next,
      cards: { ...next.cards, [active.assetId]: card },
      boss: next.phase === "master" ? { ...next.boss, health: Math.max(0, next.boss.health - damage) } : next.boss
    };
    return record(next, input, [event(next, "ability.succeeded", active.assetId, Math.round(outcome.margin), ability.sourceName)]);
  }

  if (input.kind === "interact") {
    const distance = Math.hypot(active.position.x - next.objective.position.x, active.position.z - next.objective.position.z);
    if (distance > 0.65) throw new Error("hearttree_objective_out_of_range");
    if (next.phase === "master" && next.boss.health > 0) throw new Error("hearttree_master_active");
    const chamberIndex = next.chamberIndex + 1;
    const phase = phaseFor(chamberIndex);
    next = {
      ...next,
      chamberIndex,
      phase,
      terminalReason: phase === "result" ? "completed" : null,
      objective: phase === "result"
        ? { ...next.objective, complete: true }
        : { id: `${next.expeditionId}:${phase}`, position: { x: 2 + chamberIndex, z: chamberIndex % 2 ? 1.5 : 0 }, complete: false },
      threatActive: phase === "master"
    };
    return record(next, input, [event(next, "objective.completed", active.assetId, chamberIndex, phase)]);
  }

  return record(next, input);
}
