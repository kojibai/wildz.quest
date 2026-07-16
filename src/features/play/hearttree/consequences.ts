import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { applyAdventureConditionDelta } from "../adventure/card-condition";
import { adventureConditionToHearttree, hearttreeConditionToAdventure, type HearttreeCardCondition, type HearttreeInjury, type HearttreeInjuryKind, type HearttreeLifeState } from "./card-capability";
import type { HearttreeExpeditionDefinition } from "./expedition-director";
import { hearttreeRuntimeStateDigest, type HearttreeRuntimeEvent, type HearttreeRuntimeState } from "./runtime";

export type HearttreeMortalConsent = Readonly<{
  schema: "receiz.wilds.hearttree_mortal_consent.v1";
  expeditionId: string;
  accepted: true;
  consequence: "permanent-death";
  squadPins: readonly { assetId: string; proofDigest: string }[];
  acceptedAt: string;
}>;

export type HearttreeUpgradeOffer = Readonly<{
  id: string;
  assetId: string;
  kind: "reflex" | "ability" | "resilience" | "mastery";
  label: string;
  amount: 1 | 2 | 3;
  sourceEventIds: readonly string[];
}>;

export type HearttreeCardConsequence = Readonly<{
  assetId: string;
  lifeBefore: HearttreeLifeState;
  lifeAfter: HearttreeLifeState;
  xp: number;
  mastery: number;
  fatigueDelta: number;
  injuriesAdded: readonly HearttreeInjury[];
  upgradeOffers: readonly HearttreeUpgradeOffer[];
  selectedUpgradeId: string | null;
  sourceEventIds: readonly string[];
  masteryOpportunityIds: readonly string[];
}>;

export type HearttreeConsequenceSet = Readonly<{
  schema: "receiz.wilds.hearttree_consequences.v1";
  expeditionId: string;
  replayStateDigest: string;
  transcriptDigest: string;
  outcome: HearttreeRuntimeState["terminalReason"];
  extracted: boolean;
  mortalConsentDigest: string | null;
  cards: Readonly<Record<string, HearttreeCardConsequence>>;
  digest: string;
}>;

export type HearttreeVerifiedReplay = Readonly<{
  ok: true;
  state: HearttreeRuntimeState;
  stateDigest: string;
  transcriptDigest: string;
}>;

const xpWeights: Partial<Record<HearttreeRuntimeEvent["kind"], number>> = {
  "ability.succeeded": 30,
  dodged: 18,
  guarded: 18,
  "objective.completed": 25,
  switched: 5
};

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function uniqueEvents(events: readonly HearttreeRuntimeEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => event.id.trim() && !seen.has(event.id) && Boolean(seen.add(event.id)));
}

function validateConsent(definition: HearttreeExpeditionDefinition, consent: HearttreeMortalConsent | null) {
  if (!consent) return null;
  const valid = definition.mortal
    && consent.schema === "receiz.wilds.hearttree_mortal_consent.v1"
    && consent.accepted === true
    && consent.consequence === "permanent-death"
    && consent.expeditionId === definition.id
    && Number.isFinite(Date.parse(consent.acceptedAt))
    && canonicalPortableCardJson(consent.squadPins) === canonicalPortableCardJson(definition.squadPins);
  if (!valid) throw new Error("hearttree_mortal_consent_invalid");
  return digest(consent);
}

function injuryKind(event: HearttreeRuntimeEvent): HearttreeInjuryKind {
  const detail = event.detail.toLowerCase();
  if (detail.includes("root") || detail.includes("fall")) return "limb";
  if (detail.includes("wind") || detail.includes("wing")) return "wing";
  if (detail.includes("guard") || detail.includes("impact")) return "guard";
  return "focus";
}

function injuryFor(state: HearttreeRuntimeState, assetId: string, damageEvents: readonly HearttreeRuntimeEvent[]): HearttreeInjury[] {
  const card = state.cards[assetId];
  const source = damageEvents.at(-1);
  if (!card || !source || card.health > card.maxHealth * 0.7) return [];
  const severity = (card.health <= card.maxHealth * 0.25 ? 3 : card.health <= card.maxHealth * 0.5 ? 2 : 1) as 1 | 2 | 3;
  const kind = injuryKind(source);
  return [{
    id: `hearttree:injury:${digest({ expeditionId: state.expeditionId, assetId, kind, severity, sourceEventId: source.id }).slice(7, 31)}`,
    kind,
    severity,
    sourceEventId: source.id
  }];
}

function upgradeOffers(definition: HearttreeExpeditionDefinition, assetId: string, events: readonly HearttreeRuntimeEvent[], completed: boolean): HearttreeUpgradeOffer[] {
  if (!completed || !events.length) return [];
  const sources = events.map((event) => event.id);
  const kinds: HearttreeUpgradeOffer["kind"][] = [];
  if (events.some((event) => event.kind === "dodged" || event.kind === "guarded")) kinds.push("reflex");
  if (events.some((event) => event.kind === "ability.succeeded")) kinds.push("ability");
  if (events.some((event) => event.kind === "hazard.hit")) kinds.push("resilience");
  if (definition.masteryOpportunities.some((opportunity) => opportunity.assetId === assetId)) kinds.push("mastery");
  return [...new Set(kinds)].slice(0, 3).map((kind) => ({
    id: `hearttree:upgrade:${digest({ expeditionId: definition.id, assetId, kind, sources }).slice(7, 31)}`,
    assetId,
    kind,
    label: kind === "reflex" ? "Rootway Reflex" : kind === "ability" ? "Signature Technique" : kind === "resilience" ? "Heartwood Endurance" : "Living Mastery",
    amount: (kind === "mastery" ? 1 : 2) as 1 | 2,
    sourceEventIds: sources
  }));
}

export function projectHearttreeConsequences(input: Readonly<{
  definition: HearttreeExpeditionDefinition;
  replay: HearttreeVerifiedReplay | null;
  priorConditions: Readonly<Record<string, HearttreeCardCondition>>;
  mortalConsent: HearttreeMortalConsent | null;
}>): HearttreeConsequenceSet {
  if (!input.replay?.ok) throw new Error("hearttree_replay_required");
  if (input.replay.state.expeditionId !== input.definition.id || input.replay.stateDigest !== hearttreeRuntimeStateDigest(input.replay.state)) throw new Error("hearttree_replay_invalid");
  const mortalConsentDigest = validateConsent(input.definition, input.mortalConsent);
  const events = uniqueEvents(input.replay.state.events);
  const defeated = input.replay.state.phase === "defeated" && input.replay.state.terminalReason === "squad-defeated";
  const mortalDeath = defeated && input.definition.mortal && Boolean(mortalConsentDigest);
  const cards: Record<string, HearttreeCardConsequence> = {};

  for (const pin of input.definition.squadPins) {
    const prior = input.priorConditions[pin.assetId];
    const runtimeCard = input.replay.state.cards[pin.assetId];
    if (!prior || prior.assetId !== pin.assetId || !runtimeCard) throw new Error("hearttree_prior_condition_invalid");
    const cardEvents = events.filter((event) => event.assetId === pin.assetId);
    const contributionEvents = cardEvents.filter((event) => xpWeights[event.kind] !== undefined);
    const masteryOpportunity = input.definition.masteryOpportunities.find((opportunity) => opportunity.assetId === pin.assetId);
    const multiplier = masteryOpportunity?.xpMultiplier ?? 1;
    const xp = Math.min(250, Math.round(contributionEvents.reduce((sum, event) => sum + (xpWeights[event.kind] ?? 0), 0) * multiplier));
    const damageEvents = cardEvents.filter((event) => event.kind === "hazard.hit");
    const mastery = xp > 0 && input.replay.state.terminalReason === "completed" ? 1 : 0;
    cards[pin.assetId] = {
      assetId: pin.assetId,
      lifeBefore: prior.life,
      lifeAfter: mortalDeath && runtimeCard.health <= 0 ? "dead" : prior.life,
      xp,
      mastery,
      fatigueDelta: Math.min(25, Math.max(0, contributionEvents.length * 2 + Math.ceil(damageEvents.reduce((sum, event) => sum + event.amount, 0) / 10))),
      injuriesAdded: injuryFor(input.replay.state, pin.assetId, damageEvents),
      upgradeOffers: upgradeOffers(input.definition, pin.assetId, contributionEvents, input.replay.state.terminalReason === "completed"),
      selectedUpgradeId: null,
      sourceEventIds: cardEvents.map((event) => event.id),
      masteryOpportunityIds: xp > 0 && masteryOpportunity ? [masteryOpportunity.id] : []
    };
  }
  const unsigned = {
    schema: "receiz.wilds.hearttree_consequences.v1" as const,
    expeditionId: input.definition.id,
    replayStateDigest: input.replay.stateDigest,
    transcriptDigest: input.replay.transcriptDigest,
    outcome: input.replay.state.terminalReason,
    extracted: input.replay.state.phase === "extracted",
    mortalConsentDigest,
    cards
  };
  return { ...unsigned, digest: digest(unsigned) };
}

export function applyHearttreeConsequences(prior: HearttreeCardCondition, consequence: HearttreeCardConsequence): HearttreeCardCondition {
  if (prior.life === "dead" && consequence.lifeAfter === "alive") throw new Error("hearttree_death_irreversible");
  if (prior.assetId !== consequence.assetId || prior.life !== consequence.lifeBefore) throw new Error("hearttree_consequence_prior_mismatch");
  if (!Number.isSafeInteger(consequence.xp) || consequence.xp < 0 || consequence.xp > 250) throw new Error("hearttree_consequence_xp_invalid");
  if (!Number.isSafeInteger(consequence.fatigueDelta) || consequence.fatigueDelta < -100 || consequence.fatigueDelta > 25) throw new Error("hearttree_consequence_fatigue_invalid");
  const selected = consequence.selectedUpgradeId;
  if (selected && !consequence.upgradeOffers.some((offer) => offer.id === selected)) throw new Error("hearttree_upgrade_selection_invalid");
  return adventureConditionToHearttree(applyAdventureConditionDelta(hearttreeConditionToAdventure(prior), {
    assetId: consequence.assetId,
    lifeBefore: consequence.lifeBefore,
    lifeAfter: consequence.lifeAfter,
    fatigueDelta: consequence.fatigueDelta,
    injuriesAdded: consequence.injuriesAdded,
    xp: { hearttree: consequence.xp },
    mastery: { hearttree: consequence.mastery },
    upgradeIdsAdded: selected ? [selected] : [],
    receiptDigestsAdded: [],
  }));
}

export function verifyHearttreeConsequenceSet(value: HearttreeConsequenceSet) {
  const { digest: actual, ...unsigned } = value;
  return digest(unsigned) === actual;
}
