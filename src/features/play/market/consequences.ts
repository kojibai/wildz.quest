import {
  applyAdventureConditionDelta,
  validateAdventureCondition,
  type AdventureCardCondition,
  type AdventureInjury,
} from "../adventure/card-condition";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { MarketContractDefinition } from "./contract-director";
import type { MarketTerms } from "./negotiation-resolver";
import type { MarketReplayResult } from "./transcript";

export type MarketUpgradeOffer = Readonly<{
  id: string;
  assetId: string;
  kind: "fieldcraft" | "negotiation" | "resilience";
  label: string;
  sourceEventIds: readonly string[];
}>;

export type MarketMortalConsent = Readonly<{
  schema: "receiz.wilds.market_mortal_consent.v1";
  contractDigest: string;
  squadPins: readonly Readonly<{ assetId: string; proofDigest: string }>[];
  consequence: "permanent-death";
  reversible: false;
  acknowledgedAt: string;
  digest: string;
}>;

export type MarketCardConsequence = Readonly<{
  assetId: string;
  lifeBefore: "alive" | "dead";
  lifeAfter: "alive" | "dead";
  xp: number;
  mastery: Readonly<Record<string, number>>;
  fatigueDelta: number;
  injuriesAdded: readonly AdventureInjury[];
  upgradeOffers: readonly MarketUpgradeOffer[];
  selectedUpgradeId: string | null;
  sourceEventIds: readonly string[];
}>;

export type MarketConsequenceSet = Readonly<{
  schema: "receiz.wilds.market_consequences.v1";
  contractId: string;
  replayStateDigest: string;
  transcriptDigest: string;
  outcome: MarketReplayResult["state"]["terminalReason"];
  extracted: boolean;
  mortalConsentDigest: string | null;
  cards: Readonly<Record<string, MarketCardConsequence>>;
  reputationDelta: number;
  resourceAwards: Readonly<Record<string, number>>;
  digest: string;
}>;

export type ProjectMarketConsequencesInput = Readonly<{
  contract: MarketContractDefinition;
  terms: MarketTerms;
  replay: MarketReplayResult;
  priorConditions: Readonly<Record<string, AdventureCardCondition>>;
  mortalConsent: MarketMortalConsent | null;
}>;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function unsignedConsent(consent: MarketMortalConsent) {
  const { digest: _digest, ...unsigned } = consent;
  return unsigned;
}

export function sealMarketMortalConsent(contract: MarketContractDefinition, acknowledgedAt: string): MarketMortalConsent {
  if (contract.risk !== "mortal") throw new Error("market_mortal_consent_contract_invalid");
  if (!Number.isFinite(Date.parse(acknowledgedAt))) throw new Error("market_mortal_consent_time_invalid");
  const unsigned = {
    schema: "receiz.wilds.market_mortal_consent.v1" as const,
    contractDigest: contract.digest,
    squadPins: contract.squadPins.map((pin) => ({ ...pin })),
    consequence: "permanent-death" as const,
    reversible: false as const,
    acknowledgedAt,
  };
  return { ...unsigned, digest: digest(unsigned) };
}

export function verifyMarketMortalConsent(contract: MarketContractDefinition, consent: MarketMortalConsent) {
  const valid = consent.schema === "receiz.wilds.market_mortal_consent.v1"
    && consent.consequence === "permanent-death"
    && consent.reversible === false
    && Number.isFinite(Date.parse(consent.acknowledgedAt))
    && consent.contractDigest === contract.digest
    && canonicalPortableCardJson(consent.squadPins) === canonicalPortableCardJson(contract.squadPins)
    && digest(unsignedConsent(consent)) === consent.digest;
  if (!valid) throw new Error("market_mortal_consent_invalid");
  return true;
}

const EVENT_XP: Readonly<Record<string, number>> = {
  "intelligence.gathered": 10,
  "negotiation.succeeded": 20,
  "negotiation.accepted": 12,
  guarded: 18,
  dodged: 18,
  "ability.succeeded": 30,
  "objective.completed": 25,
  switched: 5,
  extracted: 5,
};

function uniqueEvents(replay: MarketReplayResult) {
  const events = new Map<string, MarketReplayResult["state"]["events"][number]>();
  for (const event of replay.state.events) if (!events.has(event.id)) events.set(event.id, event);
  return [...events.values()];
}

function rewardBand(input: ProjectMarketConsequencesInput) {
  if (!input.replay.state.terminalReason || !["completed", "extracted"].includes(input.replay.state.terminalReason)) return null;
  return [...input.contract.rewardBands]
    .filter((band) => input.replay.state.cargoIntegrity >= band.minimumCargoIntegrity)
    .sort((left, right) => right.minimumCargoIntegrity - left.minimumCargoIntegrity)[0] ?? null;
}

function injuriesFor(
  assetId: string,
  events: ReturnType<typeof uniqueEvents>,
  maxHealth: number,
): AdventureInjury[] {
  return events.filter((event) => event.assetId === assetId && event.kind === "hazard.hit" && event.amount > 0).map((event, index) => {
    const ratio = event.amount / Math.max(1, maxHealth);
    const severity = (ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : 1) as 1 | 2 | 3;
    const kinds = ["guard", "limb", "focus", "wing"] as const;
    return {
      id: `market:injury:${digest({ assetId, eventId: event.id }).slice(7, 31)}`,
      kind: kinds[index % kinds.length]!,
      severity,
      sourceEventId: event.id,
    };
  });
}

function upgradeOffers(assetId: string, sourceEventIds: readonly string[], xp: number): MarketUpgradeOffer[] {
  if (xp <= 0) return [];
  const definitions = [
    ["fieldcraft", "Fieldcraft adaptation"],
    ["negotiation", "Merchant instinct"],
    ["resilience", "Caravan resilience"],
  ] as const;
  return definitions.map(([kind, label]) => ({
    id: `market:upgrade:${kind}:${digest({ assetId, sourceEventIds }).slice(7, 23)}`,
    assetId,
    kind,
    label,
    sourceEventIds,
  }));
}

export function projectMarketConsequences(input: ProjectMarketConsequencesInput): MarketConsequenceSet {
  if (input.replay.state.contractDigest !== input.contract.digest || input.replay.stateDigest !== digest(input.replay.state)) {
    throw new Error("market_consequences_replay_invalid");
  }
  const mortalDefeat = input.contract.risk === "mortal" && input.replay.state.terminalReason === "squad-defeated";
  if (mortalDefeat && !input.mortalConsent) throw new Error("market_mortal_consent_required");
  if (input.mortalConsent) verifyMarketMortalConsent(input.contract, input.mortalConsent);
  const events = uniqueEvents(input.replay);
  const band = rewardBand(input);
  const cards = Object.fromEntries(input.contract.squadPins.map((pin) => {
    const prior = input.priorConditions[pin.assetId];
    const runtime = input.replay.state.cards[pin.assetId];
    if (!prior || !runtime || prior.assetId !== pin.assetId) throw new Error("market_consequences_condition_invalid");
    validateAdventureCondition(prior);
    const contributions = events.filter((event) => event.assetId === pin.assetId && event.kind !== "moved" && event.kind !== "hazard.hit");
    const sourceEventIds = contributions.map((event) => event.id);
    const eventXp = contributions.reduce((sum, event) => sum + (EVENT_XP[event.kind] ?? 0), 0);
    const xp = Math.min(250, eventXp + (sourceEventIds.length > 0 ? band?.cardXp ?? 0 : 0));
    const damage = Math.max(0, runtime.maxHealth - runtime.health);
    const fatigueDelta = Math.min(25, contributions.length * 2 + Math.ceil(damage / Math.max(1, runtime.maxHealth) * 20));
    const injuriesAdded = injuriesFor(pin.assetId, events, runtime.maxHealth);
    const lifeAfter = prior.life === "dead" || (mortalDefeat && runtime.health <= 0) ? "dead" as const : "alive" as const;
    const consequence: MarketCardConsequence = {
      assetId: pin.assetId,
      lifeBefore: prior.life,
      lifeAfter,
      xp,
      mastery: xp > 0 ? { [`market:${input.contract.family}`]: Math.min(100, Math.ceil(xp / 10)) } : {},
      fatigueDelta,
      injuriesAdded,
      upgradeOffers: upgradeOffers(pin.assetId, sourceEventIds, xp),
      selectedUpgradeId: null,
      sourceEventIds,
    };
    return [pin.assetId, consequence];
  }));
  const reputationDelta = Math.min(10, band ? Math.round(band.reputation * input.replay.state.terms.rewardMultiplier) : 0);
  const resourceAwards = band ? { [band.resource]: Math.max(0, band.amount) } : {};
  const unsigned = {
    schema: "receiz.wilds.market_consequences.v1" as const,
    contractId: input.contract.id,
    replayStateDigest: input.replay.stateDigest,
    transcriptDigest: input.replay.transcriptDigest,
    outcome: input.replay.state.terminalReason,
    extracted: input.replay.state.terminalReason === "extracted",
    mortalConsentDigest: input.mortalConsent?.digest ?? null,
    cards,
    reputationDelta,
    resourceAwards,
  };
  return { ...unsigned, digest: digest(unsigned) };
}

export function applyMarketConsequences(
  priorConditions: Readonly<Record<string, AdventureCardCondition>>,
  consequences: MarketConsequenceSet,
  receiptDigest: string,
  selectedUpgrades: Readonly<Record<string, string>>,
) {
  return Object.fromEntries(Object.entries(consequences.cards).map(([assetId, consequence]) => {
    const prior = priorConditions[assetId];
    if (!prior) throw new Error("market_consequences_condition_invalid");
    const selected = selectedUpgrades[assetId] ?? null;
    if (selected && !consequence.upgradeOffers.some((offer) => offer.id === selected)) throw new Error("market_upgrade_selection_invalid");
    return [assetId, applyAdventureConditionDelta(prior, {
      assetId,
      lifeBefore: consequence.lifeBefore,
      lifeAfter: consequence.lifeAfter,
      fatigueDelta: consequence.fatigueDelta,
      injuriesAdded: consequence.injuriesAdded,
      xp: { market: consequence.xp },
      mastery: consequence.mastery,
      upgradeIdsAdded: selected ? [selected] : [],
      receiptDigestsAdded: [receiptDigest],
    })];
  }));
}
