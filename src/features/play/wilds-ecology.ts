import { regionForPosition, WILDS_REGION_SIZE } from "./multiplayer-core";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { isDynamicSitePositionSafe } from "./wilds-dynamic-sites";
import { WILDS_ECOLOGY_FAMILIES, type WildsEcologyFamilyId } from "./wilds-v3-contracts";

export { WILDS_ECOLOGY_FAMILIES, type WildsEcologyFamilyId } from "./wilds-v3-contracts";


export type WildsEcologyPhase = "foreshadowed" | "discovered" | "active" | "resolving" | "aftermath" | "historical" | "expired";
export type WildsEcologyIntensity = "gentle" | "social" | "high";

export type WildsEcologySite = {
  schema: "receiz.wilds_ecology_site.v1";
  id: string;
  familyId: WildsEcologyFamilyId;
  name: string;
  generatorVersion: 1;
  seedDigest: string;
  position: { x: number; z: number };
  region: { x: number; z: number };
  radius: number;
  phase: WildsEcologyPhase;
  intensity: WildsEcologyIntensity;
  activityId: string;
  visualKit: string;
  audioMotif: string;
  aftermathModule: string;
  spawnedAt: string;
  activatesAt: string;
  resolvesAt: string;
  historicizesAt: string;
  expiresAt: string;
  parentSiteId: string | null;
};

export type WildsEcologyGeneratorInput = {
  familyId: WildsEcologyFamilyId;
  pulse: string;
  ordinal: number;
  existingSites: readonly WildsEcologySite[];
  parentSiteId?: string | null;
};

export type WildsEcologyEnsembleInput = {
  pulse: string;
  existingSites: readonly WildsEcologySite[];
  ordinalStart: number;
};

type FamilyDefinition = {
  name: string;
  radius: number;
  intensity: WildsEcologyIntensity;
  activityId: string;
  visualKit: string;
  audioMotif: string;
  aftermathModule: string;
  lifetimeHours: number;
};

const DEFINITIONS: Record<WildsEcologyFamilyId, FamilyDefinition> = {
  "wandering-market": { name: "Wayfarer Market", radius: 8, intensity: "social", activityId: "verified-delivery", visualKit: "folding-canopies", audioMotif: "market-arrival", aftermathModule: "merchant-trail", lifetimeHours: 36 },
  "echo-ruin": { name: "Echo Ruin", radius: 9, intensity: "gentle", activityId: "symbol-route", visualKit: "broken-arches", audioMotif: "ruin-resonance", aftermathModule: "excavated-archive", lifetimeHours: 60 },
  "unstable-portal": { name: "Unstable Portal", radius: 8, intensity: "high", activityId: "node-stabilization", visualKit: "prism-rings", audioMotif: "portal-instability", aftermathModule: "rift-scar", lifetimeHours: 24 },
  "convergence-festival": { name: "Convergence Festival", radius: 10, intensity: "social", activityId: "public-harmony", visualKit: "festival-ribbons", audioMotif: "festival-harmony", aftermathModule: "banner-grove", lifetimeHours: 48 },
  "creature-migration": { name: "Great Migration", radius: 11, intensity: "high", activityId: "migration-escort", visualKit: "migration-trail", audioMotif: "migration-motion", aftermathModule: "nesting-ground", lifetimeHours: 42 },
  "resource-bloom": { name: "Lumen Bloom", radius: 7, intensity: "gentle", activityId: "bloom-sustain", visualKit: "lumen-clusters", audioMotif: "bloom-growth", aftermathModule: "fertile-patch", lifetimeHours: 30 },
  stormfront: { name: "Resonant Stormfront", radius: 12, intensity: "high", activityId: "shelter-repair", visualKit: "storm-pylons", audioMotif: "storm-warning", aftermathModule: "charged-biome", lifetimeHours: 18 },
  "settlement-distress": { name: "Wayfinder Distress", radius: 8, intensity: "high", activityId: "rescue-stations", visualKit: "rescue-beacons", audioMotif: "rescue-call", aftermathModule: "repaired-edge", lifetimeHours: 20 }
};

const TRANSITIONS: Record<WildsEcologyPhase, readonly WildsEcologyPhase[]> = {
  foreshadowed: ["discovered", "expired"],
  discovered: ["active", "expired"],
  active: ["resolving", "expired"],
  resolving: ["aftermath"],
  aftermath: ["historical"],
  historical: [],
  expired: []
};

const CAUSAL_CHILDREN: Partial<Record<WildsEcologyFamilyId, readonly WildsEcologyFamilyId[]>> = {
  "creature-migration": ["wandering-market", "convergence-festival"],
  "resource-bloom": ["creature-migration", "wandering-market"],
  stormfront: ["unstable-portal", "echo-ruin", "settlement-distress"],
  "echo-ruin": ["unstable-portal", "resource-bloom"],
  "convergence-festival": ["wandering-market"]
};

const MAX_GLOBAL_SITES = 24;
const MAX_REGIONAL_SITES = 5;
const WORLD_EDGE = WILDS_REGION_SIZE * 5;

function hexUnit(hex: string, offset: number) {
  return Number.parseInt(hex.slice(offset, offset + 8), 16) / 0xffffffff;
}

function candidatePosition(seedDigest: string, probe: number) {
  const hex = sha256PortableBasis(`${seedDigest}:probe:${probe}`).slice("sha256:".length);
  const span = WORLD_EDGE * 2 - 24;
  return {
    x: Math.round(-WORLD_EDGE + 12 + hexUnit(hex, 0) * span),
    z: Math.round(-WORLD_EDGE + 12 + hexUnit(hex, 8) * span)
  };
}

function regionalCount(position: { x: number; z: number }, sites: readonly WildsEcologySite[]) {
  const region = regionForPosition(position);
  return sites.filter((site) => site.phase !== "historical" && site.phase !== "expired")
    .filter((site) => site.region.x === region.x && site.region.z === region.z).length;
}

export function isWildsEcologyPositionSafe(position: { x: number; z: number }, existingSites: readonly WildsEcologySite[], radius = 9) {
  return Math.max(Math.abs(position.x), Math.abs(position.z)) <= WORLD_EDGE
    && regionalCount(position, existingSites) < MAX_REGIONAL_SITES
    && isDynamicSitePositionSafe(position, existingSites, radius);
}

function validPulse(pulse: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(pulse) && Number.isFinite(Date.parse(pulse));
}

export function generateWildsEcologySite(input: WildsEcologyGeneratorInput): WildsEcologySite | null {
  if (!WILDS_ECOLOGY_FAMILIES.includes(input.familyId)) throw new Error("wilds_ecology_family_invalid");
  if (!validPulse(input.pulse)) throw new Error("wilds_ecology_pulse_invalid");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) throw new Error("wilds_ecology_ordinal_invalid");
  if (input.existingSites.filter((site) => site.phase !== "historical" && site.phase !== "expired").length >= MAX_GLOBAL_SITES) return null;
  const definition = DEFINITIONS[input.familyId];
  const seedDigest = sha256PortableBasis(canonicalPortableCardJson({ worldId: "wilds:global:v3", generatorVersion: 1, familyId: input.familyId, pulse: input.pulse, ordinal: input.ordinal, parentSiteId: input.parentSiteId ?? null }));
  let position: { x: number; z: number } | null = null;
  for (let probe = 0; probe < 128; probe += 1) {
    const candidate = candidatePosition(seedDigest, probe);
    if (isWildsEcologyPositionSafe(candidate, input.existingSites, definition.radius)) {
      position = candidate;
      break;
    }
  }
  if (!position) return null;
  const spawnedAtMs = Date.parse(input.pulse);
  const activatesAtMs = spawnedAtMs + 60 * 60 * 1_000;
  const resolvesAtMs = spawnedAtMs + definition.lifetimeHours * 60 * 60 * 1_000;
  const historicizesAtMs = resolvesAtMs + 24 * 60 * 60 * 1_000;
  const suffix = seedDigest.slice("sha256:".length, "sha256:".length + 24);
  return {
    schema: "receiz.wilds_ecology_site.v1",
    id: `ecology:${input.familyId}:${suffix}`,
    familyId: input.familyId,
    name: definition.name,
    generatorVersion: 1,
    seedDigest,
    position,
    region: regionForPosition(position),
    radius: definition.radius,
    phase: "foreshadowed",
    intensity: definition.intensity,
    activityId: definition.activityId,
    visualKit: definition.visualKit,
    audioMotif: definition.audioMotif,
    aftermathModule: definition.aftermathModule,
    spawnedAt: new Date(spawnedAtMs).toISOString(),
    activatesAt: new Date(activatesAtMs).toISOString(),
    resolvesAt: new Date(resolvesAtMs).toISOString(),
    historicizesAt: new Date(historicizesAtMs).toISOString(),
    expiresAt: new Date(resolvesAtMs).toISOString(),
    parentSiteId: input.parentSiteId ?? null
  };
}

export function generateWildsEcologyEnsemble(input: WildsEcologyEnsembleInput) {
  if (!Number.isSafeInteger(input.ordinalStart) || input.ordinalStart < 1) throw new Error("wilds_ecology_ordinal_invalid");
  const generated: WildsEcologySite[] = [];
  for (let index = 0; index < WILDS_ECOLOGY_FAMILIES.length; index += 1) {
    const familyId = WILDS_ECOLOGY_FAMILIES[index]!;
    const site = generateWildsEcologySite({ familyId, pulse: input.pulse, ordinal: input.ordinalStart + index, existingSites: [...input.existingSites, ...generated] });
    if (site) generated.push(site);
  }
  return generated;
}

export function advanceWildsEcologySite(site: WildsEcologySite, phase: WildsEcologyPhase) {
  if (!TRANSITIONS[site.phase].includes(phase)) throw new Error("wilds_ecology_transition_invalid");
  return { ...site, phase };
}

export function deriveWildsEcologyChild(input: { parent: WildsEcologySite; ordinal: number; existingSites: readonly WildsEcologySite[] }) {
  if (input.parent.phase !== "aftermath") throw new Error("wilds_ecology_parent_not_aftermath");
  const choices = CAUSAL_CHILDREN[input.parent.familyId];
  if (!choices?.length) return null;
  const hex = sha256PortableBasis(`${input.parent.seedDigest}:causal-child:${input.ordinal}`).slice("sha256:".length);
  const familyId = choices[Number.parseInt(hex.slice(0, 8), 16) % choices.length]!;
  return generateWildsEcologySite({ familyId, pulse: input.parent.resolvesAt, ordinal: input.ordinal, existingSites: input.existingSites, parentSiteId: input.parent.id });
}
