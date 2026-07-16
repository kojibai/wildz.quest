import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { WildsEcologySite } from "../wilds-ecology";
import {
  assertMarketCardPlayable,
  type MarketCardCapability,
  type MarketRole,
  type MarketVerb,
} from "./card-role";

export type MarketContractFamily = "delivery" | "appraisal" | "protection" | "preservation" | "repair" | "bulk" | "recovery";
export type MarketDemandKind = "living" | "powered" | "fragile" | "bulk" | "heated" | "provenance";

export type MarketHistoryEntry = Readonly<{
  id: string;
  contractId: string;
  family: MarketContractFamily;
  mastery: number;
}>;

export type MarketDemandFact = Readonly<{
  id: string;
  kind: MarketDemandKind;
  pressure: 1 | 2 | 3;
  explanation: string;
}>;

export type MarketIntelligenceNode = Readonly<{
  id: string;
  kind: "merchant-tell" | "cargo" | "route" | "demand";
  label: string;
  reveals: string;
  position: Readonly<{ x: number; z: number }>;
}>;

export type MarketMerchantDefinition = Readonly<{
  id: string;
  name: string;
  temperament: "patient" | "brisk" | "guarded" | "curious";
  pressure: 1 | 2 | 3;
  tell: "lantern" | "ledger" | "hands" | "gaze";
}>;

export type MarketNegotiationDefinition = Readonly<{
  exchanges: 3 | 4 | 5;
  timingWindowMs: number;
  baseCargo: number;
  baseTimeTicks: number;
  allowedDamage: number;
}>;

export type MarketObjectiveDefinition = Readonly<{
  id: string;
  kind: "inspect" | "negotiate" | "collect" | "deliver" | "protect" | "operate";
  label: string;
  requiredVerb: MarketVerb;
  position: Readonly<{ x: number; z: number }>;
}>;

export type MarketRouteDefinition = Readonly<{
  id: string;
  label: string;
  requires: readonly string[];
  risk: number;
  distance: number;
}>;

export type MarketHazardDefinition = Readonly<{
  id: string;
  kind: "crowd-surge" | "cargo-shift" | "gate-snap" | "trail-fall";
  position: Readonly<{ x: number; z: number }>;
  damage: number;
  cargoDamage: number;
  telegraphTicks: number;
}>;

export type MarketRewardBand = Readonly<{
  id: "secured" | "excellent";
  minimumCargoIntegrity: number;
  cardXp: number;
  reputation: number;
  resource: string;
  amount: number;
}>;

export type MarketSolvabilityWitness = Readonly<{
  viableRouteIds: readonly string[];
  availableTokens: readonly string[];
}>;

export type MarketContractDefinition = Readonly<{
  schema: "receiz.wilds.market_contract.v1";
  id: string;
  family: MarketContractFamily;
  merchant: MarketMerchantDefinition;
  risk: "standard" | "mortal";
  minCards: 1 | 2 | 3;
  maxCards: 1 | 2 | 3;
  demand: readonly MarketDemandFact[];
  intelligence: readonly MarketIntelligenceNode[];
  negotiation: MarketNegotiationDefinition;
  objectives: readonly MarketObjectiveDefinition[];
  routes: readonly MarketRouteDefinition[];
  hazards: readonly MarketHazardDefinition[];
  rewardBands: readonly MarketRewardBand[];
  squadPins: readonly { assetId: string; proofDigest: string }[];
  solvability: MarketSolvabilityWitness;
  digest: string;
}>;

export type MarketBoardDefinition = Readonly<{
  schema: "receiz.wilds.market_board.v1";
  id: string;
  siteId: string;
  pulse: string;
  seedDigest: string;
  generatorVersion: 1;
  squadPins: readonly { assetId: string; proofDigest: string }[];
  mortal: boolean;
  mortalDisclosure: Readonly<{
    consequence: "permanent-death";
    assetIdsAtRisk: readonly string[];
    reversible: false;
  }> | null;
  layout: Readonly<{ rotation: number; aisle: "cross" | "ring" | "spine"; lanternColor: string }>;
  contracts: readonly [MarketContractDefinition, MarketContractDefinition, MarketContractDefinition];
  digest: string;
}>;

export type MarketBoardInput = Readonly<{
  site: WildsEcologySite;
  pulse: string;
  squad: readonly MarketCardCapability[];
  history: readonly MarketHistoryEntry[];
  mortal: boolean;
}>;

export type MarketSolvability = Readonly<{
  ok: boolean;
  viableRouteIds: readonly string[];
  missing: readonly string[];
}>;

const CONTRACT_FAMILIES: readonly MarketContractFamily[] = ["delivery", "appraisal", "protection", "preservation", "repair", "bulk", "recovery"];
const MERCHANT_NAMES = ["Ilyra Fen", "Bram Quill", "Sera Venn", "Orin Moss", "Tavi Rook", "Nemi Vale", "Caro Flint"] as const;
const TEMPERAMENTS = ["patient", "brisk", "guarded", "curious"] as const;
const TELLS = ["lantern", "ledger", "hands", "gaze"] as const;
const AISLES = ["cross", "ring", "spine"] as const;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function hashNumber(seed: string, label: string) {
  return Number.parseInt(digest(`${seed}:${label}`).slice(7, 15), 16);
}

function tokenSet(squad: readonly MarketCardCapability[]) {
  return new Set(squad.flatMap((card) => [
    "life:alive",
    `element:${card.element}`,
    ...card.roles.map((role) => `role:${role}`),
    ...[...card.verbs].map((verb) => `verb:${verb}`),
  ]));
}

function demandFor(element: string): MarketDemandKind {
  if (element === "Grove") return "living";
  if (element === "Spark") return "powered";
  if (element === "Tide") return "fragile";
  if (element === "Stone") return "bulk";
  if (element === "Ember") return "heated";
  return "provenance";
}

const VERB_PRIORITY: readonly MarketVerb[] = ["overfly", "heavy-carry", "repair", "appraise", "preserve", "brace", "clear", "power", "balance", "read-tell", "carry", "guard", "inspect"];

function signatureVerb(card: MarketCardCapability, ordinal: number) {
  const available = VERB_PRIORITY.filter((verb) => card.verbs.has(verb));
  return available[ordinal % available.length] ?? "inspect";
}

function mastered(history: readonly MarketHistoryEntry[], family: MarketContractFamily) {
  return history.filter((entry) => entry.family === family).reduce((sum, entry) => sum + Math.max(0, Math.min(100, entry.mastery)), 0);
}

function familyOrder(seed: string, history: readonly MarketHistoryEntry[]) {
  return [...CONTRACT_FAMILIES].sort((left, right) => {
    const leftScore = hashNumber(seed, `family:${left}`) - mastered(history, left) * 100_000_000;
    const rightScore = hashNumber(seed, `family:${right}`) - mastered(history, right) * 100_000_000;
    return rightScore - leftScore || left.localeCompare(right);
  });
}

function point(seed: string, label: string, radius = 7) {
  const angle = (hashNumber(seed, `${label}:angle`) % 360) * Math.PI / 180;
  const distance = 2 + (hashNumber(seed, `${label}:distance`) % Math.max(1, radius - 1));
  return { x: Number((Math.cos(angle) * distance).toFixed(2)), z: Number((Math.sin(angle) * distance).toFixed(2)) };
}

function contractDefinition(
  seed: string,
  ordinal: number,
  family: MarketContractFamily,
  squad: readonly MarketCardCapability[],
  mortal: boolean,
): MarketContractDefinition {
  const card = squad[ordinal % squad.length]!;
  const secondary = squad[(ordinal + 1) % squad.length]!;
  const verb = signatureVerb(card, ordinal);
  const secondaryVerb = signatureVerb(secondary, ordinal + 2);
  const primaryRole = card.roles[ordinal % card.roles.length] as MarketRole;
  const merchantOrdinal = hashNumber(seed, `merchant:${ordinal}`) % MERCHANT_NAMES.length;
  const contractId = `market:contract:${digest({ seed, ordinal, family, pins: squad.map((value) => value.proofDigest) }).slice(7, 31)}`;
  const risk = mortal ? "mortal" as const : "standard" as const;
  const pins = squad.map((value) => ({ assetId: value.assetId, proofDigest: value.proofDigest }));
  const pressure = (1 + hashNumber(seed, `pressure:${ordinal}`) % 3) as 1 | 2 | 3;
  const demandKinds = [...new Set([demandFor(card.element), demandFor(secondary.element)])];
  const demand = demandKinds.map((kind, index): MarketDemandFact => ({
    id: `${contractId}:demand:${index + 1}`,
    kind,
    pressure: ((pressure + index - 1) % 3 + 1) as 1 | 2 | 3,
    explanation: `${kind} cargo demand follows the admitted region, squad affinity, and current Pulse.`,
  }));
  const routes: MarketRouteDefinition[] = [
    { id: `${contractId}:route:signature`, label: `${verb.replaceAll("-", " ")} passage`, requires: [`verb:${verb}`, `role:${primaryRole}`], risk: mortal ? 3 : 1, distance: 8 + ordinal * 2 },
    { id: `${contractId}:route:element`, label: `${card.element} concession`, requires: [`element:${card.element}`, "verb:inspect"], risk: mortal ? 4 : 2, distance: 6 + ordinal * 3 },
  ];
  const provisional = {
    schema: "receiz.wilds.market_contract.v1" as const,
    id: contractId,
    family,
    merchant: {
      id: `market:merchant:${merchantOrdinal + 1}`,
      name: MERCHANT_NAMES[merchantOrdinal]!,
      temperament: TEMPERAMENTS[hashNumber(seed, `temperament:${ordinal}`) % TEMPERAMENTS.length]!,
      pressure,
      tell: TELLS[hashNumber(seed, `tell:${ordinal}`) % TELLS.length]!,
    },
    risk,
    minCards: (mortal ? 2 : 1) as 1 | 2,
    maxCards: 3 as const,
    demand,
    intelligence: ["merchant-tell", "cargo", "route", "demand"].map((kind, index) => ({
      id: `${contractId}:intel:${index + 1}`,
      kind: kind as MarketIntelligenceNode["kind"],
      label: kind === "merchant-tell" ? "Read the merchant" : kind === "cargo" ? "Inspect the cargo" : kind === "route" ? "Scout the route" : "Compare demand",
      reveals: kind === "merchant-tell" ? `The ${TELLS[merchantOrdinal % TELLS.length]} tell reveals ${pressure} pressure.` : `${kind} evidence changes one exact contract term.`,
      position: point(seed, `intel:${ordinal}:${index}`),
    })),
    negotiation: {
      exchanges: (3 + hashNumber(seed, `exchanges:${ordinal}`) % 3) as 3 | 4 | 5,
      timingWindowMs: 180 + pressure * 40,
      baseCargo: 3 + pressure + ordinal,
      baseTimeTicks: 90 + ordinal * 15,
      allowedDamage: Math.max(5, 30 - pressure * 5),
    },
    objectives: [
      { id: `${contractId}:objective:inspect`, kind: "inspect" as const, label: "Verify the contract cargo", requiredVerb: "inspect" as const, position: point(seed, `objective:${ordinal}:inspect`) },
      { id: `${contractId}:objective:execute`, kind: family === "repair" ? "operate" as const : family === "protection" ? "protect" as const : "deliver" as const, label: `Execute the ${family} terms`, requiredVerb: verb, position: point(seed, `objective:${ordinal}:execute`) },
    ],
    routes,
    hazards: [{
      id: `${contractId}:hazard:one`,
      kind: (["crowd-surge", "cargo-shift", "gate-snap", "trail-fall"] as const)[hashNumber(seed, `hazard:${ordinal}`) % 4]!,
      position: point(seed, `hazard:${ordinal}`),
      damage: (mortal ? 18 : 10) + pressure * 2,
      cargoDamage: 4 + pressure * 3,
      telegraphTicks: Math.max(2, 6 - pressure),
    }],
    rewardBands: [
      { id: "secured" as const, minimumCargoIntegrity: 50, cardXp: 50 + pressure * 10, reputation: 2, resource: `market-${demand[0]!.kind}`, amount: 1 },
      { id: "excellent" as const, minimumCargoIntegrity: 85, cardXp: 100 + pressure * 15, reputation: 4, resource: `market-${demand[0]!.kind}`, amount: 2 },
    ],
    squadPins: pins,
  };
  const available = [...tokenSet(squad)].sort();
  const viableRouteIds = routes.filter((route) => route.requires.every((required) => available.includes(required))).map((route) => route.id);
  const withSolvability = { ...provisional, solvability: { viableRouteIds, availableTokens: available } };
  return { ...withSolvability, digest: digest(withSolvability) };
}

export function validateMarketContractSolvability(
  contract: MarketContractDefinition,
  squad: readonly MarketCardCapability[],
): MarketSolvability {
  const available = tokenSet(squad);
  const viableRouteIds = contract.routes
    .filter((route) => route.requires.every((required) => available.has(required)))
    .map((route) => route.id);
  const missing = [...new Set(contract.routes.flatMap((route) => route.requires.filter((required) => !available.has(required))))].sort();
  const pinsMatch = canonicalPortableCardJson(contract.squadPins) === canonicalPortableCardJson(squad.map((card) => ({ assetId: card.assetId, proofDigest: card.proofDigest })));
  const sizeValid = squad.length >= contract.minCards && squad.length <= contract.maxCards;
  return { ok: pinsMatch && sizeValid && viableRouteIds.length > 0, viableRouteIds, missing };
}

export function generateMarketBoard(input: MarketBoardInput): MarketBoardDefinition {
  if (input.site.familyId !== "wandering-market" || input.site.schema !== "receiz.wilds_ecology_site.v1") throw new Error("market_site_invalid");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.pulse) || !Number.isFinite(Date.parse(input.pulse))) throw new Error("market_pulse_invalid");
  if (input.squad.length < 1 || input.squad.length > 3) throw new Error("market_squad_size_invalid");
  if (input.mortal && input.squad.length < 2) throw new Error("market_mortal_squad_size_invalid");
  if (new Set(input.squad.map((card) => card.proofDigest)).size !== input.squad.length) throw new Error("market_squad_duplicate");
  for (const card of input.squad) assertMarketCardPlayable(card);
  const pins = input.squad.map((card) => ({ assetId: card.assetId, proofDigest: card.proofDigest }));
  const seed = digest({ site: input.site.seedDigest, pulse: input.pulse, pins, mortal: input.mortal });
  const families = familyOrder(seed, input.history).slice(0, 3);
  const contracts = families.map((family, ordinal) => contractDefinition(seed, ordinal, family, input.squad, input.mortal)) as [MarketContractDefinition, MarketContractDefinition, MarketContractDefinition];
  if (contracts.some((contract) => !validateMarketContractSolvability(contract, input.squad).ok)) throw new Error("market_contract_unsolvable");
  const id = `market:board:${digest({ seed, contracts: contracts.map((contract) => contract.digest) }).slice(7, 31)}`;
  const unsigned = {
    schema: "receiz.wilds.market_board.v1" as const,
    id,
    siteId: input.site.id,
    pulse: input.pulse,
    seedDigest: seed,
    generatorVersion: 1 as const,
    squadPins: pins,
    mortal: input.mortal,
    mortalDisclosure: input.mortal ? {
      consequence: "permanent-death" as const,
      assetIdsAtRisk: input.squad.map((card) => card.assetId),
      reversible: false as const,
    } : null,
    layout: {
      rotation: hashNumber(seed, "layout:rotation") % 360,
      aisle: AISLES[hashNumber(seed, "layout:aisle") % AISLES.length]!,
      lanternColor: input.squad[0]!.element.toLowerCase(),
    },
    contracts,
  };
  return { ...unsigned, digest: digest(unsigned) };
}
