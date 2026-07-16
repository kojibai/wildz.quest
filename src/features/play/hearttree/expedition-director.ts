import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { hearttreeAbilitiesFor } from "./ability-registry";
import { assertHearttreeCardPlayable, type HearttreeCardCapability, type HearttreeTraversal } from "./card-capability";

export type HearttreeHistoryEntry = Readonly<{
  id: string;
  expeditionId: string;
  masteryOpportunityIds: readonly string[];
}>;

export type HearttreeRouteDefinition = Readonly<{
  id: string;
  label: string;
  requires: readonly string[];
  scoreBand: number;
}>;

export type HearttreeChamberDefinition = Readonly<{
  id: string;
  kind: "rootway" | "memory" | "master" | "choice";
  name: string;
  topology: string;
  hazards: readonly string[];
  routes: readonly HearttreeRouteDefinition[];
  risk: "standard" | "mortal";
}>;

export type HearttreeBossDefinition = Readonly<{
  id: string;
  name: string;
  phases: readonly string[];
  counters: readonly string[];
  power: number;
  guard: number;
}>;

export type HearttreeMasteryOpportunity = Readonly<{
  id: string;
  assetId: string;
  kind: "traversal" | "ability" | "protection" | "resonance";
  label: string;
  xpMultiplier: 1 | 0.25;
}>;

export type HearttreeExpeditionDefinition = Readonly<{
  schema: "receiz.wilds.hearttree_expedition.v1";
  id: string;
  seedDigest: string;
  generatorVersion: 1;
  squadPins: readonly { assetId: string; proofDigest: string }[];
  mortal: boolean;
  mortalDisclosure: Readonly<{
    consequence: "permanent-death";
    assetIdsAtRisk: readonly string[];
    reversible: false;
  }> | null;
  chambers: readonly HearttreeChamberDefinition[];
  boss: HearttreeBossDefinition;
  masteryOpportunities: readonly HearttreeMasteryOpportunity[];
  audioProfile: Readonly<{ baseMotif: string; cardMotifs: readonly string[] }>;
  solvability: Readonly<{ solutionBands: number; requiredCapabilitySets: readonly string[][] }>;
}>;

export type HearttreeSolvability = Readonly<{
  ok: boolean;
  solutionBands: number;
  missing: readonly string[];
}>;

const traversalPriority: readonly HearttreeTraversal[] = ["flight", "narrow", "break", "anchor", "balance", "ground"];

function capabilityTokens(card: HearttreeCardCapability) {
  return new Set([
    "life:alive",
    `element:${card.element}`,
    ...[...card.traversal].map((value) => `traversal:${value}`),
    ...card.roles.map((value) => `role:${value}`),
    ...hearttreeAbilitiesFor(card).flatMap((ability) => ability.tags.map((tag) => `ability:${tag}`))
  ]);
}

function squadTokens(squad: readonly HearttreeCardCapability[]) {
  return new Set(squad.flatMap((card) => [...capabilityTokens(card)]));
}

function primaryTraversal(squad: readonly HearttreeCardCapability[]) {
  return traversalPriority.find((candidate) => squad.some((card) => card.traversal.has(candidate))) ?? "ground";
}

function topologyFor(traversal: HearttreeTraversal) {
  const topologies: Readonly<Record<HearttreeTraversal, string>> = {
    flight: "canopy-conductors",
    narrow: "serpent-rootways",
    break: "buried-bastion",
    anchor: "pressure-garden",
    balance: "hanging-vines",
    ground: "living-switchbacks"
  };
  return topologies[traversal];
}

function hazardsFor(topology: string, element: string) {
  const topologyHazards: Readonly<Record<string, readonly string[]>> = {
    "canopy-conductors": ["grounding-vines", "crosswind-pulse"],
    "serpent-rootways": ["closing-channel", "spore-pocket"],
    "buried-bastion": ["counterweight-root", "falling-heartwood"],
    "pressure-garden": ["moving-load", "root-shear"],
    "hanging-vines": ["swaying-span", "thorn-sweep"],
    "living-switchbacks": ["root-surge", "memory-fog"]
  };
  return [...(topologyHazards[topology] ?? ["root-surge"]), `${element.toLowerCase()}-reaction`];
}

function opportunityFor(card: HearttreeCardCapability, mastered: ReadonlySet<string>): HearttreeMasteryOpportunity {
  const primary = card.roles[0] ?? "resonant";
  const kind = primary === "pathfinder" ? "traversal" : primary === "warden" || primary === "vanguard" ? "protection" : primary === "resonant" || primary === "channeler" ? "resonance" : "ability";
  const id = `hearttree:mastery:${card.assetId}:${primary}`;
  return {
    id,
    assetId: card.assetId,
    kind,
    label: `${card.element} ${primary} mastery`,
    xpMultiplier: mastered.has(id) ? 0.25 : 1
  };
}

function route(id: string, label: string, requires: readonly string[], scoreBand: number): HearttreeRouteDefinition {
  return { id, label, requires, scoreBand };
}

export function validateHearttreeSolvability(definition: HearttreeExpeditionDefinition, squad: readonly HearttreeCardCapability[]): HearttreeSolvability {
  const missing: string[] = [];
  const pinsMatch = definition.squadPins.length === squad.length && definition.squadPins.every((pin) => squad.some((card) => card.assetId === pin.assetId && card.proofDigest === pin.proofDigest));
  if (!pinsMatch) missing.push("squad:proof-pins");
  const tokens = squadTokens(squad);
  const routeCounts = definition.chambers.map((chamber) => {
    const viable = chamber.routes.filter((candidate) => candidate.requires.every((requirement) => tokens.has(requirement)));
    if (!viable.length) missing.push(`chamber:${chamber.id}`);
    return viable.length;
  });
  const solutionBands = routeCounts.length ? Math.min(...routeCounts) : 0;
  return { ok: pinsMatch && missing.length === 0 && solutionBands > 0, solutionBands, missing };
}

export function generateHearttreeExpedition(input: Readonly<{
  seed: string;
  squad: readonly HearttreeCardCapability[];
  history: readonly HearttreeHistoryEntry[];
  mortal: boolean;
}>): HearttreeExpeditionDefinition {
  const seed = input.seed.trim();
  if (!seed || seed.length > 128) throw new Error("hearttree_seed_invalid");
  if (input.squad.length < 1 || input.squad.length > 3) throw new Error("hearttree_squad_size_invalid");
  for (const card of input.squad) assertHearttreeCardPlayable(card);
  const pins = input.squad.map((card) => ({ assetId: card.assetId, proofDigest: card.proofDigest }));
  if (new Set(pins.flatMap((pin) => [pin.assetId, pin.proofDigest])).size !== pins.length * 2) throw new Error("hearttree_squad_duplicate");

  const seedDigest = sha256PortableBasis(canonicalPortableCardJson({ seed, pins, mortal: input.mortal, generatorVersion: 1 }));
  const id = `hearttree:${seedDigest.slice(7, 31)}`;
  const traversal = primaryTraversal(input.squad);
  const topology = topologyFor(traversal);
  const lead = input.squad[0]!;
  const primaryRole = lead.roles[0] ?? "resonant";
  const element = lead.element;
  const secondaryRole = input.squad.flatMap((card) => card.roles).find((role) => role !== primaryRole) ?? primaryRole;
  const firstAbilityTag = hearttreeAbilitiesFor(lead)[0]!.tags[0] ?? "strike";

  const chambers: HearttreeChamberDefinition[] = [
    {
      id: `${id}:rootway`,
      kind: "rootway",
      name: "The Living Rootway",
      topology,
      hazards: hazardsFor(topology, element),
      routes: [
        route(`${id}:rootway:physical`, `${traversal} passage`, [`traversal:${traversal}`], 1),
        route(`${id}:rootway:tactical`, `${primaryRole} passage`, [`role:${primaryRole}`], 2)
      ],
      risk: "standard"
    },
    {
      id: `${id}:memory`,
      kind: "memory",
      name: `${element} Memory Trial`,
      topology: `${element.toLowerCase()}-memory-lattice`,
      hazards: [`${element.toLowerCase()}-echo`, `${secondaryRole}-pressure`],
      routes: [
        route(`${id}:memory:element`, `${element} resonance`, [`element:${element}`], 1),
        route(`${id}:memory:ability`, `${firstAbilityTag} counter-route`, [`ability:${firstAbilityTag}`], 2)
      ],
      risk: "standard"
    },
    {
      id: `${id}:master`,
      kind: "master",
      name: "The Root Master",
      topology: `root-master:${topology}`,
      hazards: [`counter:${traversal}`, `counter:${element.toLowerCase()}`, "crown-collapse"],
      routes: [
        route(`${id}:master:primary`, `${primaryRole} opening`, [`role:${primaryRole}`], 2),
        route(`${id}:master:secondary`, `${secondaryRole} opening`, [`role:${secondaryRole}`], 3)
      ],
      risk: "standard"
    },
    {
      id: `${id}:choice`,
      kind: "choice",
      name: input.mortal ? "The Mortal Heart" : "The Heart Choice",
      topology: input.mortal ? "black-root-threshold" : "moonwell-sanctuary",
      hazards: input.mortal ? ["fatal-root", "sealed-exit"] : ["fading-memory"],
      routes: [route(`${id}:choice:living`, input.mortal ? "Accept the Mortal Heart" : "Claim living mastery", ["life:alive"], input.mortal ? 4 : 1)],
      risk: input.mortal ? "mortal" : "standard"
    }
  ];

  const mastered = new Set(input.history.flatMap((entry) => entry.masteryOpportunityIds));
  const masteryOpportunities = input.squad.map((card) => opportunityFor(card, mastered));
  const boss: HearttreeBossDefinition = {
    id: `${id}:root-master`,
    name: `Root Master of ${element}`,
    phases: ["read", `counter-${traversal}`, `counter-${primaryRole}`, "crown"],
    counters: [`ground-${traversal}`, `pressure-${primaryRole}`, `invert-${element.toLowerCase()}`],
    power: 55 + input.squad.length * 12 + Math.round(lead.stats.power * 0.35),
    guard: 48 + input.squad.length * 10 + Math.round(lead.stats.guard * 0.3)
  };
  const audioProfile = {
    baseMotif: `hearttree:${topology}`,
    cardMotifs: input.squad.map((card) => `hearttree:${card.element.toLowerCase()}:${card.anatomy.aura}:${card.roles[0] ?? "resonant"}`)
  };
  const provisional: HearttreeExpeditionDefinition = {
    schema: "receiz.wilds.hearttree_expedition.v1",
    id,
    seedDigest,
    generatorVersion: 1,
    squadPins: pins,
    mortal: input.mortal,
    mortalDisclosure: input.mortal ? { consequence: "permanent-death", assetIdsAtRisk: pins.map((pin) => pin.assetId), reversible: false } : null,
    chambers,
    boss,
    masteryOpportunities,
    audioProfile,
    solvability: { solutionBands: 0, requiredCapabilitySets: chambers.map((chamber) => chamber.routes.map((candidate) => candidate.requires.join("+"))) }
  };
  const validation = validateHearttreeSolvability(provisional, input.squad);
  if (!validation.ok) throw new Error(`hearttree_expedition_unsolvable:${validation.missing.join(",")}`);
  return { ...provisional, solvability: { ...provisional.solvability, solutionBands: validation.solutionBands } };
}
