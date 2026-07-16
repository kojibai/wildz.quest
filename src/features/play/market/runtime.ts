import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { resolveMarketPhysicalAction } from "./action-resolver";
import type { MarketCardCapability, MarketVerb } from "./card-role";
import type { MarketContractDefinition } from "./contract-director";
import {
  createMarketNegotiation,
  resolveMarketNegotiation,
  type MarketNegotiationAction,
  type MarketNegotiationState,
  type MarketTerms,
} from "./negotiation-resolver";

export type MarketRuntimePhase = "intelligence" | "negotiation" | "execution" | "result" | "extracted" | "defeated";
export type MarketTerminalReason = "completed" | "extracted" | "contract-failed" | "squad-defeated" | null;

export type MarketInput =
  | Readonly<{ sequence: number; tick: number; kind: "move"; vector: Readonly<{ x: number; z: number }> }>
  | Readonly<{ sequence: number; tick: number; kind: "inspect"; targetId: string }>
  | Readonly<{ sequence: number; tick: number; kind: "negotiate"; action: MarketNegotiationAction }>
  | Readonly<{ sequence: number; tick: number; kind: "guard"; timingOffsetMs: number }>
  | Readonly<{ sequence: number; tick: number; kind: "dodge"; vector: Readonly<{ x: number; z: number }>; timingOffsetMs: number }>
  | Readonly<{ sequence: number; tick: number; kind: "role-action"; verb: MarketVerb; timingOffsetMs: number }>
  | Readonly<{ sequence: number; tick: number; kind: "ability"; abilityName: string; timingOffsetMs: number }>
  | Readonly<{ sequence: number; tick: number; kind: "switch"; assetId: string }>
  | Readonly<{ sequence: number; tick: number; kind: "extract" }>;

export type MarketRuntimeEvent = Readonly<{
  id: string;
  sequence: number;
  tick: number;
  kind: "moved" | "intelligence.gathered" | "negotiation.succeeded" | "negotiation.failed" | "negotiation.accepted" | "switched" | "guarded" | "dodged" | "hazard.hit" | "ability.succeeded" | "objective.completed" | "extracted";
  assetId: string | null;
  targetId: string | null;
  amount: number;
  cargoAmount: number;
  detail: string;
}>;

export type MarketRuntimeCard = Readonly<{
  assetId: string;
  health: number;
  maxHealth: number;
  stamina: number;
  cooldowns: Readonly<Record<string, number>>;
}>;

export type MarketRuntimeObjective = Readonly<{
  id: string;
  label: string;
  requiredVerb: MarketVerb;
  position: Readonly<{ x: number; z: number }>;
  complete: boolean;
  completedByAssetId: string | null;
}>;

export type MarketRuntimeState = Readonly<{
  schema: "receiz.wilds.market_runtime.v1";
  id: string;
  contractId: string;
  contractDigest: string;
  phase: MarketRuntimePhase;
  terminalReason: MarketTerminalReason;
  sequence: number;
  tick: number;
  player: Readonly<{ x: number; z: number }>;
  activeAssetId: string;
  squad: readonly MarketCardCapability[];
  cards: Readonly<Record<string, MarketRuntimeCard>>;
  intelligenceIds: readonly string[];
  negotiation: MarketNegotiationState;
  terms: MarketTerms;
  objectives: readonly MarketRuntimeObjective[];
  cargoIntegrity: number;
  switchCharges: number;
  resolvedHazardIds: readonly string[];
  events: readonly MarketRuntimeEvent[];
  inputs: readonly MarketInput[];
}>;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function event(
  state: MarketRuntimeState,
  input: MarketInput,
  value: Omit<MarketRuntimeEvent, "id" | "sequence" | "tick">,
): MarketRuntimeEvent {
  const unsigned = { sequence: input.sequence, tick: input.tick, ...value };
  return { id: `market:event:${digest({ runtimeId: state.id, ...unsigned }).slice(7, 31)}`, ...unsigned };
}

function distance(left: { x: number; z: number }, right: { x: number; z: number }) {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function activeCard(state: MarketRuntimeState) {
  const card = state.squad.find((value) => value.assetId === state.activeAssetId);
  const runtime = state.cards[state.activeAssetId];
  if (!card || !runtime) throw new Error("market_runtime_active_card_invalid");
  return { card, runtime };
}

function refreshCards(state: MarketRuntimeState) {
  return Object.fromEntries(Object.entries(state.cards).map(([assetId, card]) => [assetId, {
    ...card,
    stamina: Math.min(100, card.stamina + 2),
    cooldowns: Object.fromEntries(Object.entries(card.cooldowns).map(([key, value]) => [key, Math.max(0, value - 1)])),
  }]));
}

function record(state: MarketRuntimeState, input: MarketInput, events: readonly MarketRuntimeEvent[] = []) {
  return {
    ...state,
    sequence: input.sequence,
    tick: input.tick,
    cards: refreshCards(state),
    inputs: [...state.inputs, input],
    events: [...state.events, ...events],
  } satisfies MarketRuntimeState;
}

function terminal(state: MarketRuntimeState) {
  return state.phase === "result" || state.phase === "extracted" || state.phase === "defeated";
}

function validateInput(state: MarketRuntimeState, input: MarketInput) {
  if (terminal(state)) throw new Error("market_runtime_terminal");
  if (!Number.isSafeInteger(input.sequence) || input.sequence !== state.sequence + 1) throw new Error("market_input_sequence_invalid");
  if (!Number.isSafeInteger(input.tick) || input.tick <= state.tick || input.tick > state.tick + 120) throw new Error("market_input_tick_invalid");
  if (input.kind === "move" || input.kind === "dodge") {
    if (![input.vector.x, input.vector.z].every(Number.isFinite) || Math.hypot(input.vector.x, input.vector.z) > 2) throw new Error("market_input_vector_invalid");
  }
}

export function createMarketRuntime(
  contract: MarketContractDefinition,
  terms: MarketTerms,
  squad: readonly MarketCardCapability[],
): MarketRuntimeState {
  if (contract.squadPins.length !== squad.length || contract.squadPins.some((pin, index) => pin.assetId !== squad[index]?.assetId || pin.proofDigest !== squad[index]?.proofDigest)) {
    throw new Error("market_runtime_squad_invalid");
  }
  const baseline = createMarketNegotiation(contract);
  if (canonicalPortableCardJson(terms) !== canonicalPortableCardJson(baseline.terms)) throw new Error("market_runtime_terms_invalid");
  const cards = Object.fromEntries(squad.map((card) => [card.assetId, {
    assetId: card.assetId,
    health: card.stats.health,
    maxHealth: card.stats.health,
    stamina: 100,
    cooldowns: {},
  }]));
  const id = `market:runtime:${digest({ contract: contract.digest, terms, pins: contract.squadPins }).slice(7, 31)}`;
  const state: MarketRuntimeState = {
    schema: "receiz.wilds.market_runtime.v1",
    id,
    contractId: contract.id,
    contractDigest: contract.digest,
    phase: "intelligence",
    terminalReason: null,
    sequence: 0,
    tick: 0,
    player: { x: 0, z: 0 },
    activeAssetId: squad[0]!.assetId,
    squad,
    cards,
    intelligenceIds: [],
    negotiation: baseline,
    terms,
    objectives: contract.objectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      requiredVerb: objective.requiredVerb,
      position: { ...objective.position },
      complete: false,
      completedByAssetId: null,
    })),
    cargoIntegrity: 100,
    switchCharges: 3,
    resolvedHazardIds: [],
    events: [],
    inputs: [],
  };
  registerMarketRuntimeContract(contract);
  return state;
}

function move(state: MarketRuntimeState, contract: MarketContractDefinition, input: Extract<MarketInput, { kind: "move" }>) {
  const { card } = activeCard(state);
  const length = Math.hypot(input.vector.x, input.vector.z);
  const scale = length > 0 ? (0.45 + card.stats.speed / 180) / Math.max(1, length) : 0;
  const player = {
    x: Math.max(-8, Math.min(8, state.player.x + input.vector.x * scale)),
    z: Math.max(-8, Math.min(8, state.player.z + input.vector.z * scale)),
  };
  const next = record({ ...state, player }, input, [event(state, input, { kind: "moved", assetId: card.assetId, targetId: null, amount: Number(distance(state.player, player).toFixed(3)), cargoAmount: 0, detail: "Movement resolved from the active card's exact speed." })]);
  return resolveNearbyHazard(state, next, input, contract);
}

function inspect(state: MarketRuntimeState, contract: MarketContractDefinition, input: Extract<MarketInput, { kind: "inspect" }>) {
  if (state.phase !== "intelligence" && state.phase !== "negotiation") throw new Error("market_inspect_closed");
  const node = contract.intelligence.find((value) => value.id === input.targetId);
  if (!node) throw new Error("market_inspect_target_invalid");
  if (distance(state.player, node.position) > 1.25) throw new Error("market_inspect_out_of_range");
  const intelligenceIds = [...new Set([...state.intelligenceIds, node.id])];
  const objectives = state.objectives.map((objective, index) => index === 0 && node.kind === "cargo"
    ? { ...objective, complete: true, completedByAssetId: state.activeAssetId }
    : objective);
  return record({ ...state, phase: "negotiation", intelligenceIds, objectives }, input, [event(state, input, { kind: "intelligence.gathered", assetId: state.activeAssetId, targetId: node.id, amount: 1, cargoAmount: 0, detail: node.reveals })]);
}

function negotiate(state: MarketRuntimeState, contract: MarketContractDefinition, input: Extract<MarketInput, { kind: "negotiate" }>) {
  if (state.phase !== "intelligence" && state.phase !== "negotiation") throw new Error("market_negotiation_phase_invalid");
  const { card } = activeCard(state);
  const resolution = resolveMarketNegotiation({ contract, state: state.negotiation, intelligenceIds: state.intelligenceIds, activeCard: card, action: input.action });
  const kind = resolution.state.phase === "accepted" ? "negotiation.accepted" : resolution.effects.length ? "negotiation.succeeded" : "negotiation.failed";
  const phase = resolution.state.phase === "accepted" ? "execution" as const
    : resolution.state.phase === "walked-away" || resolution.state.phase === "rejected" ? "result" as const
      : "negotiation" as const;
  const terminalReason = phase === "result" ? "contract-failed" as const : null;
  return record({ ...state, negotiation: resolution.state, terms: resolution.state.terms, phase, terminalReason }, input, [event(state, input, { kind, assetId: card.assetId, targetId: contract.merchant.id, amount: resolution.margin, cargoAmount: 0, detail: resolution.explanation })]);
}

function roleAction(state: MarketRuntimeState, contract: MarketContractDefinition, input: Extract<MarketInput, { kind: "role-action" }>) {
  if (state.phase !== "execution") throw new Error("market_action_phase_invalid");
  const objective = state.objectives.find((value) => !value.complete);
  if (!objective) throw new Error("market_objective_complete");
  const definition = contract.objectives.find((value) => value.id === objective.id)!;
  const { card, runtime } = activeCard(state);
  const resolution = resolveMarketPhysicalAction({
    card,
    objective: definition,
    player: state.player,
    verb: input.verb,
    timingOffsetMs: input.timingOffsetMs,
    stamina: runtime.stamina,
    cooldownTicks: runtime.cooldowns[input.verb] ?? 0,
  });
  const cards = {
    ...state.cards,
    [card.assetId]: {
      ...runtime,
      stamina: runtime.stamina - resolution.staminaCost,
      cooldowns: { ...runtime.cooldowns, [input.verb]: resolution.cooldownTicks },
    },
  };
  const objectives = state.objectives.map((value) => value.id === objective.id ? { ...value, complete: true, completedByAssetId: card.assetId } : value);
  const completed = objectives.every((value) => value.complete);
  const next = record({ ...state, cards, objectives, phase: completed ? "result" : state.phase, terminalReason: completed ? "completed" : null }, input, [event(state, input, { kind: "objective.completed", assetId: card.assetId, targetId: objective.id, amount: resolution.margin, cargoAmount: 0, detail: resolution.explanation })]);
  return resolveNearbyHazard(state, next, input);
}

function ability(state: MarketRuntimeState, contract: MarketContractDefinition, input: Extract<MarketInput, { kind: "ability" }>) {
  if (state.phase !== "execution") throw new Error("market_ability_phase_invalid");
  const objective = state.objectives.find((value) => !value.complete);
  if (!objective || distance(state.player, objective.position) > 1.75) throw new Error("market_ability_out_of_range");
  const { card, runtime } = activeCard(state);
  const source = card.abilities.find((value) => value.name === input.abilityName);
  if (!source) throw new Error("market_ability_unknown");
  if (Math.abs(input.timingOffsetMs) > 420) throw new Error("market_ability_timing_missed");
  if (runtime.stamina < 16) throw new Error("market_action_stamina_low");
  if ((runtime.cooldowns[input.abilityName] ?? 0) > 0) throw new Error("market_action_cooldown");
  const cards = { ...state.cards, [card.assetId]: { ...runtime, stamina: runtime.stamina - 16, cooldowns: { ...runtime.cooldowns, [input.abilityName]: 5 } } };
  const objectives = state.objectives.map((value) => value.id === objective.id ? { ...value, complete: true, completedByAssetId: card.assetId } : value);
  const completed = objectives.every((value) => value.complete);
  return record({ ...state, cards, objectives, phase: completed ? "result" : state.phase, terminalReason: completed ? "completed" : null }, input, [event(state, input, { kind: "ability.succeeded", assetId: card.assetId, targetId: objective.id, amount: source.power, cargoAmount: 0, detail: `${source.name} resolved from its exact catalog power, position, timing, stamina, and cooldown.` })]);
}

function guard(state: MarketRuntimeState, contract: MarketContractDefinition, input: Extract<MarketInput, { kind: "guard" }>) {
  if (state.phase !== "execution") throw new Error("market_guard_phase_invalid");
  if (Math.abs(input.timingOffsetMs) > 320) throw new Error("market_action_timing_missed");
  const { card, runtime } = activeCard(state);
  if (runtime.stamina < 12) throw new Error("market_action_stamina_low");
  const cards = { ...state.cards, [card.assetId]: { ...runtime, stamina: runtime.stamina - 12 } };
  const next = record({ ...state, cards }, input);
  return resolveNearbyHazard(state, next, input, contract);
}

function dodge(state: MarketRuntimeState, contract: MarketContractDefinition, input: Extract<MarketInput, { kind: "dodge" }>) {
  if (state.phase !== "execution") throw new Error("market_dodge_phase_invalid");
  if (Math.abs(input.timingOffsetMs) > 260) throw new Error("market_action_timing_missed");
  const { card, runtime } = activeCard(state);
  if (runtime.stamina < 18) throw new Error("market_action_stamina_low");
  const length = Math.max(1, Math.hypot(input.vector.x, input.vector.z));
  const player = { x: Math.max(-8, Math.min(8, state.player.x + input.vector.x / length * 1.8)), z: Math.max(-8, Math.min(8, state.player.z + input.vector.z / length * 1.8)) };
  const cards = { ...state.cards, [card.assetId]: { ...runtime, stamina: runtime.stamina - 18 } };
  const next = record({ ...state, cards, player }, input);
  return resolveNearbyHazard(state, next, input, contract);
}

function resolveNearbyHazard(
  prior: MarketRuntimeState,
  next: MarketRuntimeState,
  input: MarketInput,
  contract?: MarketContractDefinition,
) {
  if (prior.phase !== "execution" || !contract) return next;
  if (input.kind === "move" && Math.hypot(input.vector.x, input.vector.z) >= 0.5) return next;
  const hazard = contract.hazards.find((value) => !prior.resolvedHazardIds.includes(value.id) && distance(prior.player, value.position) <= 1.25);
  if (!hazard) return next;
  const { card, runtime } = activeCard(next);
  const guarded = input.kind === "guard";
  const dodged = input.kind === "dodge";
  const damage = dodged ? 0 : guarded ? Math.ceil(hazard.damage * 0.2) : hazard.damage;
  const cargoDamage = dodged ? 0 : guarded ? Math.ceil(hazard.cargoDamage * 0.2) : hazard.cargoDamage;
  const health = Math.max(0, runtime.health - damage);
  const cards = { ...next.cards, [card.assetId]: { ...runtime, health } };
  const cargoIntegrity = Math.max(0, next.cargoIntegrity - cargoDamage);
  const resolvedHazardIds = [...next.resolvedHazardIds, hazard.id];
  const allDefeated = Object.values(cards).every((value) => value.health <= 0);
  const contractFailed = cargoIntegrity <= 0;
  const kind = dodged ? "dodged" as const : guarded ? "guarded" as const : "hazard.hit" as const;
  return {
    ...next,
    cards,
    cargoIntegrity,
    resolvedHazardIds,
    phase: allDefeated ? "defeated" : contractFailed ? "result" : next.phase,
    terminalReason: allDefeated ? "squad-defeated" : contractFailed ? "contract-failed" : next.terminalReason,
    events: [...next.events, event(prior, input, { kind, assetId: card.assetId, targetId: hazard.id, amount: damage, cargoAmount: cargoDamage, detail: dodged ? "Hazard timing cleared by a real speed-based dodge." : guarded ? "Guard timing converted exact guard into bounded protection." : `${hazard.kind} struck card and cargo because it was neither guarded nor dodged.` })],
  } satisfies MarketRuntimeState;
}

function switchCard(state: MarketRuntimeState, input: Extract<MarketInput, { kind: "switch" }>) {
  if (state.switchCharges <= 0) throw new Error("market_switch_charges_empty");
  const target = state.cards[input.assetId];
  if (!target || target.health <= 0 || input.assetId === state.activeAssetId) throw new Error("market_switch_target_invalid");
  return record({ ...state, activeAssetId: input.assetId, switchCharges: state.switchCharges - 1 }, input, [event(state, input, { kind: "switched", assetId: input.assetId, targetId: null, amount: 1, cargoAmount: 0, detail: "Active contract role changed under a bounded switch charge." })]);
}

export function stepMarketRuntime(
  state: MarketRuntimeState,
  input: MarketInput,
  contract?: MarketContractDefinition,
): MarketRuntimeState {
  validateInput(state, input);
  const definition = contract ?? runtimeContractRegistry.get(state.contractDigest);
  if (!definition) throw new Error("market_runtime_contract_required");
  if (input.kind === "move") return move(state, definition, input);
  if (input.kind === "inspect") return inspect(state, definition, input);
  if (input.kind === "negotiate") return negotiate(state, definition, input);
  if (input.kind === "role-action") return roleAction(state, definition, input);
  if (input.kind === "ability") return ability(state, definition, input);
  if (input.kind === "guard") return guard(state, definition, input);
  if (input.kind === "dodge") return dodge(state, definition, input);
  if (input.kind === "switch") return switchCard(state, input);
  return record({ ...state, phase: "extracted", terminalReason: "extracted" }, input, [event(state, input, { kind: "extracted", assetId: state.activeAssetId, targetId: null, amount: 0, cargoAmount: state.cargoIntegrity, detail: "Extraction preserved only replay-supported progress." })]);
}

// Runtime definitions are immutable and digest-addressed; replay passes them explicitly and UI state uses this bounded local registry.
const runtimeContractRegistry = new Map<string, MarketContractDefinition>();

export function registerMarketRuntimeContract(contract: MarketContractDefinition) {
  runtimeContractRegistry.set(contract.digest, contract);
  if (runtimeContractRegistry.size > 256) runtimeContractRegistry.delete(runtimeContractRegistry.keys().next().value!);
}

export function marketRuntimeStateDigest(state: MarketRuntimeState) {
  return digest(state);
}
