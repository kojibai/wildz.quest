import type { MarketCardCapability } from "./card-role";
import type { MarketContractDefinition, MarketIntelligenceNode } from "./contract-director";

export type MarketNegotiationTerm = "cargo" | "time" | "route" | "damage" | "reward";

export type MarketNegotiationAction =
  | Readonly<{ kind: "commit" }>
  | Readonly<{ kind: "counter"; term: MarketNegotiationTerm; timingOffsetMs: number }>
  | Readonly<{ kind: "bundle"; intelligenceId: string }>
  | Readonly<{ kind: "ability"; assetId: string; abilityName: string; timingOffsetMs: number }>
  | Readonly<{ kind: "walk-away" }>;

export type MarketTerms = Readonly<{
  cargo: number;
  timeTicks: number;
  routeId: string;
  allowedDamage: number;
  rewardMultiplier: number;
  trust: number;
}>;

export type MarketNegotiationState = Readonly<{
  phase: "active" | "accepted" | "walked-away" | "rejected";
  exchange: number;
  terms: MarketTerms;
  usedIntelligenceIds: readonly string[];
  actionKeys: readonly string[];
}>;

export type MarketNegotiationEffect = Readonly<{
  kind: "cargo" | "time-window" | "route" | "damage" | "reward" | "trust";
  before: number | string;
  after: number | string;
  sourceIds: readonly string[];
}>;

export type MarketNegotiationResolution = Readonly<{
  state: MarketNegotiationState;
  effects: readonly MarketNegotiationEffect[];
  margin: number;
  explanation: string;
}>;

export type MarketNegotiationResolutionInput = Readonly<{
  contract: MarketContractDefinition;
  state: MarketNegotiationState;
  intelligenceIds: readonly string[];
  activeCard: MarketCardCapability;
  action: MarketNegotiationAction;
}>;

const TERM_EVIDENCE: Readonly<Record<MarketNegotiationTerm, readonly MarketIntelligenceNode["kind"][]>> = {
  cargo: ["cargo", "demand"],
  time: ["merchant-tell", "route"],
  route: ["route"],
  damage: ["cargo", "route"],
  reward: ["merchant-tell", "demand"],
};

export function createMarketNegotiation(contract: MarketContractDefinition): MarketNegotiationState {
  if (!contract.routes[0]) throw new Error("market_negotiation_route_required");
  return {
    phase: "active",
    exchange: 0,
    terms: {
      cargo: contract.negotiation.baseCargo,
      timeTicks: contract.negotiation.baseTimeTicks,
      routeId: contract.routes[0].id,
      allowedDamage: contract.negotiation.allowedDamage,
      rewardMultiplier: 1,
      trust: 0,
    },
    usedIntelligenceIds: [],
    actionKeys: [],
  };
}

function knownIntelligence(contract: MarketContractDefinition, ids: readonly string[]) {
  const validIds = new Set(contract.intelligence.map((node) => node.id));
  if (ids.some((id) => !validIds.has(id))) throw new Error("market_negotiation_intelligence_invalid");
  return contract.intelligence.filter((node) => ids.includes(node.id));
}

function timingMargin(contract: MarketContractDefinition, offset: number) {
  if (!Number.isFinite(offset) || Math.abs(offset) > 10_000) throw new Error("market_negotiation_timing_invalid");
  if (Math.abs(offset) > contract.negotiation.timingWindowMs) return -80;
  return Math.round(25 * (1 - Math.abs(offset) / contract.negotiation.timingWindowMs));
}

function cardMargin(card: MarketCardCapability, term: MarketNegotiationTerm | "ability" | "bundle") {
  const role = term === "cargo" ? "carrier"
    : term === "route" || term === "time" ? "scout"
      : term === "damage" ? "guardian"
        : term === "reward" || term === "ability" ? "broker"
          : "appraiser";
  const roleBonus = card.roles[0] === role ? 35 : card.roles[1] === role ? 20 : 0;
  const stat = term === "cargo" ? card.stats.power
    : term === "route" || term === "time" ? card.stats.speed
      : term === "damage" ? card.stats.guard
        : card.stats.bond;
  const negotiationBonus = card.roles.includes("broker") ? 12 : 0;
  return roleBonus + negotiationBonus + Math.floor(stat / 10);
}

function evidenceFor(
  contract: MarketContractDefinition,
  intelligence: readonly MarketIntelligenceNode[],
  term: MarketNegotiationTerm,
) {
  const kinds = TERM_EVIDENCE[term];
  return intelligence.filter((node) => kinds.includes(node.kind));
}

function actionKey(action: MarketNegotiationAction) {
  if (action.kind === "counter") return `counter:${action.term}`;
  if (action.kind === "ability") return `ability:${action.assetId}:${action.abilityName}`;
  if (action.kind === "bundle") return `bundle:${action.intelligenceId}`;
  return action.kind;
}

function advance(
  contract: MarketContractDefinition,
  state: MarketNegotiationState,
  terms: MarketTerms,
  action: MarketNegotiationAction,
  usedIntelligenceIds: readonly string[],
  terminal?: MarketNegotiationState["phase"],
): MarketNegotiationState {
  const exchange = state.exchange + 1;
  return {
    phase: terminal ?? (exchange >= contract.negotiation.exchanges ? "rejected" : "active"),
    exchange,
    terms,
    usedIntelligenceIds: [...new Set([...state.usedIntelligenceIds, ...usedIntelligenceIds])],
    actionKeys: [...state.actionKeys, actionKey(action)],
  };
}

function applyTerm(
  contract: MarketContractDefinition,
  terms: MarketTerms,
  term: MarketNegotiationTerm,
  sources: readonly string[],
): { terms: MarketTerms; effect: MarketNegotiationEffect } {
  if (term === "cargo") {
    const after = Math.max(1, terms.cargo - 1);
    return { terms: { ...terms, cargo: after }, effect: { kind: "cargo", before: terms.cargo, after, sourceIds: sources } };
  }
  if (term === "time") {
    const after = terms.timeTicks + 15;
    return { terms: { ...terms, timeTicks: after }, effect: { kind: "time-window", before: terms.timeTicks, after, sourceIds: sources } };
  }
  if (term === "route") {
    const after = contract.routes.find((route) => route.id !== terms.routeId)?.id ?? terms.routeId;
    return { terms: { ...terms, routeId: after }, effect: { kind: "route", before: terms.routeId, after, sourceIds: sources } };
  }
  if (term === "damage") {
    const after = Math.min(100, terms.allowedDamage + 5);
    return { terms: { ...terms, allowedDamage: after }, effect: { kind: "damage", before: terms.allowedDamage, after, sourceIds: sources } };
  }
  const after = Number(Math.min(1.5, terms.rewardMultiplier + 0.1).toFixed(2));
  return { terms: { ...terms, rewardMultiplier: after }, effect: { kind: "reward", before: terms.rewardMultiplier, after, sourceIds: sources } };
}

export function resolveMarketNegotiation(input: MarketNegotiationResolutionInput): MarketNegotiationResolution {
  if (input.state.phase !== "active") throw new Error("market_negotiation_closed");
  if (!input.activeCard.playable || !input.contract.squadPins.some((pin) => pin.assetId === input.activeCard.assetId && pin.proofDigest === input.activeCard.proofDigest)) {
    throw new Error("market_negotiation_card_invalid");
  }
  const intelligence = knownIntelligence(input.contract, input.intelligenceIds);
  if (input.action.kind === "commit") {
    return {
      state: advance(input.contract, input.state, input.state.terms, input.action, [], "accepted"),
      effects: [],
      margin: 0,
      explanation: "Terms committed exactly as shown. The physical contract now inherits every negotiated constraint.",
    };
  }
  if (input.action.kind === "walk-away") {
    return {
      state: advance(input.contract, input.state, input.state.terms, input.action, [], "walked-away"),
      effects: [],
      margin: 0,
      explanation: "The squad walked away before accepting custody or contract risk.",
    };
  }
  if (input.action.kind === "bundle") {
    const intelligenceId = input.action.intelligenceId;
    const node = intelligence.find((candidate) => candidate.id === intelligenceId);
    if (!node) throw new Error("market_negotiation_bundle_invalid");
    const margin = 30 + cardMargin(input.activeCard, "bundle") - input.contract.merchant.pressure * 10;
    if (margin < 35) {
      return { state: advance(input.contract, input.state, input.state.terms, input.action, [node.id]), effects: [], margin, explanation: "The bundle evidence was real, but this card could not turn it into a viable concession." };
    }
    const changed = applyTerm(input.contract, input.state.terms, node.kind === "route" ? "route" : "cargo", [node.id]);
    return { state: advance(input.contract, input.state, changed.terms, input.action, [node.id]), effects: [changed.effect], margin, explanation: `Bundled ${node.kind} evidence with the active card's ${input.activeCard.roles.join(" and ")} role pressure.` };
  }
  if (input.action.kind === "ability") {
    const abilityName = input.action.abilityName;
    if (input.action.assetId !== input.activeCard.assetId || !input.activeCard.abilities.some((ability) => ability.name === abilityName)) {
      throw new Error("market_negotiation_ability_invalid");
    }
    const tell = intelligence.find((node) => node.kind === "merchant-tell");
    const margin = (tell ? 35 : 0) + timingMargin(input.contract, input.action.timingOffsetMs) + cardMargin(input.activeCard, "ability") - input.contract.merchant.pressure * 10;
    if (margin < 50) {
      return { state: advance(input.contract, input.state, input.state.terms, input.action, tell ? [tell.id] : []), effects: [], margin, explanation: `${abilityName} was authentic, but lacked an observed merchant tell or clean timing window.` };
    }
    const after = Math.min(3, input.state.terms.trust + 1);
    const effect: MarketNegotiationEffect = { kind: "trust", before: input.state.terms.trust, after, sourceIds: [tell!.id, `ability:${abilityName}`] };
    const terms = { ...input.state.terms, trust: after };
    return { state: advance(input.contract, input.state, terms, input.action, [tell!.id]), effects: [effect], margin, explanation: `${abilityName}, the observed ${tell!.kind}, and exact timing established one trust concession.` };
  }

  const evidence = evidenceFor(input.contract, intelligence, input.action.term);
  const timing = timingMargin(input.contract, input.action.timingOffsetMs);
  const margin = (evidence.length ? 35 : 0) + timing + cardMargin(input.activeCard, input.action.term) - input.contract.merchant.pressure * 10;
  if (!evidence.length || timing < 0 || margin < 50) {
    const reason = !evidence.length ? `No observed ${input.action.term} evidence supported the counter.`
      : timing < 0 ? `The ${input.action.term} counter missed the merchant timing window.`
        : `The evidence was valid, but the active card's real role and stats left a ${margin} margin.`;
    return { state: advance(input.contract, input.state, input.state.terms, input.action, evidence.map((node) => node.id)), effects: [], margin, explanation: reason };
  }
  const changed = applyTerm(input.contract, input.state.terms, input.action.term, evidence.map((node) => node.id));
  return {
    state: advance(input.contract, input.state, changed.terms, input.action, evidence.map((node) => node.id)),
    effects: [changed.effect],
    margin,
    explanation: `${input.action.term} changed because observed ${evidence.map((node) => `${node.kind} evidence`).join(" and ")} aligned with the active card's real role, stats, and timing window.`,
  };
}
