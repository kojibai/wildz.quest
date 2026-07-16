import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { ArenaFighterDefinition } from "./card-fighter";
import type { ArenaNpcTier } from "./opponent";

export type ArenaDifficulty = Readonly<{ behaviorDepth: number; reactionFrames: number; hazardComplexity: number; teamSwaps: number; healthMultiplier: number }>;
export type ArenaBossPhase = Readonly<{ id: string; vitalityThreshold: 0.75 | 0.45 | 0.15; transitionFrame: number; weakness: string; hazard: string; legalActions: readonly string[] }>;
export type ArenaEncounterDefinition = Readonly<{
  id: string;
  ordinal: number;
  tier: ArenaNpcTier;
  title: string;
  lesson: string;
  checkpointId: string;
  difficulty: ArenaDifficulty;
  minimum: Readonly<{ speed: number; guard: number; power: number; bond: number }>;
  recommendedAssetIds: readonly string[];
  counterOpportunities: readonly string[];
  retreatPreparation: readonly string[];
  bossPhases: readonly ArenaBossPhase[];
  digest: string;
}>;
export type ArenaPath = Readonly<{
  schema: "receiz.wilds.arena_path.v1";
  id: string;
  encounters: readonly ArenaEncounterDefinition[];
  currentEncounterId: string | null;
  checkpoint: Readonly<{ completedEncounterIds: readonly string[]; lastCompletedEncounterId: string | null }>;
  digest: string;
}>;
export type ArenaPathInput = Readonly<{ seed: string; playerId: string; roster: readonly ArenaFighterDefinition[]; completedEncounterIds: readonly string[] }>;
export type ArenaSolvabilityResult = Readonly<{ ok: boolean; reasons: readonly string[]; witnessAssetIds: readonly string[] }>;

const encounterRows = [
  ["learner", "Footwork Hall", "movement-and-recovery"],
  ["learner", "Break Garden", "guard-and-break"],
  ["rival", "Element Crossing", "soft-element-counters"],
  ["rival", "Shifting Causeway", "arena-control"],
  ["rival", "Bond Circuit", "tags-and-rescues"],
  ["champion", "Crown Trial", "combined-counterplay"],
  ["boss", "Auralith Descent", "three-phase-boss"],
] as const satisfies readonly (readonly [ArenaNpcTier, string, string])[];

function counterFacts(roster: readonly ArenaFighterDefinition[]) {
  const facts = new Set<string>();
  for (const fighter of roster) {
    facts.add(`${fighter.element.toLowerCase()}-affinity`);
    facts.add(`${fighter.bodyFamily}-movement`);
    if (fighter.locomotion.includes("fly")) facts.add("aerial-recovery");
    if (fighter.stats.guard >= 60) facts.add("guard-anchor");
    if (fighter.stats.speed >= 60) facts.add("speed-punish");
    if (fighter.stats.bond >= 60) facts.add("bond-rescue");
  }
  return [...facts];
}

function recommendations(roster: readonly ArenaFighterDefinition[], ordinal: number) {
  const score = (fighter: ArenaFighterDefinition) => ordinal % 4 === 0 ? fighter.stats.speed : ordinal % 4 === 1 ? fighter.stats.guard : ordinal % 4 === 2 ? fighter.stats.power : fighter.stats.bond;
  return [...roster].sort((left, right) => score(right) - score(left) || left.proofDigest.localeCompare(right.proofDigest)).slice(0, Math.min(3, roster.length)).map((fighter) => fighter.assetId);
}

function bossPhases(seed: string): readonly ArenaBossPhase[] {
  const weaknesses = ["exposed-prism-heart", "grounded-burrow", "resonance-counter"];
  return ([0.75, 0.45, 0.15] as const).map((threshold, index) => ({
    id: `boss:phase:${index + 1}:${sha256PortableBasis(`${seed}:${index}`).slice(7, 15)}`,
    vitalityThreshold: threshold,
    transitionFrame: 120 + index * 180,
    weakness: weaknesses[index]!,
    hazard: ["crystal-faults", "shard-rain", "collapsing-crown"][index]!,
    legalActions: index === 0 ? ["guard", "dodge", "heavy"] : index === 1 ? ["parry", "ability", "tag"] : ["rescue", "ability", "context"],
  }));
}

function unsignedEncounter(input: ArenaPathInput, row: typeof encounterRows[number], ordinal: number): Omit<ArenaEncounterDefinition, "digest"> {
  const [tier, title, lesson] = row;
  const maxima = {
    speed: Math.max(...input.roster.map((fighter) => fighter.stats.speed)),
    guard: Math.max(...input.roster.map((fighter) => fighter.stats.guard)),
    power: Math.max(...input.roster.map((fighter) => fighter.stats.power)),
    bond: Math.max(...input.roster.map((fighter) => fighter.stats.bond)),
  };
  const tierDepth = { learner: 1, rival: 2, champion: 4, boss: 5 }[tier];
  const id = `arena:encounter:${ordinal}:${sha256PortableBasis(`${input.seed}:${input.playerId}:${title}`).slice(7, 19)}`;
  return {
    id, ordinal, tier, title, lesson, checkpointId: `arena:checkpoint:${ordinal}`,
    difficulty: {
      behaviorDepth: tierDepth,
      reactionFrames: { learner: 12, rival: 8, champion: 5, boss: 4 }[tier],
      hazardComplexity: tier === "learner" ? ordinal - 1 : tier === "rival" ? ordinal : tier === "champion" ? 6 : 8,
      teamSwaps: tier === "learner" ? 0 : tier === "rival" ? 1 : tier === "champion" ? 2 : 3,
      healthMultiplier: tier === "learner" ? 0.9 : tier === "rival" ? 1 : tier === "champion" ? 1.12 : 1.25,
    },
    minimum: { speed: Math.max(1, maxima.speed - 20), guard: Math.max(1, maxima.guard - 20), power: Math.max(1, maxima.power - 20), bond: Math.max(1, maxima.bond - 20) },
    recommendedAssetIds: recommendations(input.roster, ordinal),
    counterOpportunities: counterFacts(input.roster).slice(0, tier === "learner" ? 2 : tier === "rival" ? 3 : 6),
    retreatPreparation: ["practice the disclosed lesson", `recover and prepare ${recommendations(input.roster, ordinal)[0]}`],
    bossPhases: tier === "boss" ? bossPhases(input.seed) : [],
  };
}

export function validateArenaEncounterSolvability(encounter: ArenaEncounterDefinition, roster: readonly ArenaFighterDefinition[]): ArenaSolvabilityResult {
  const reasons: string[] = [];
  const living = roster.filter((fighter) => fighter.playable);
  if (living.length < 1 || living.length > 3) reasons.push("arena_encounter_roster_invalid");
  if (!encounter.counterOpportunities.length) reasons.push("arena_encounter_counter_missing");
  if (encounter.recommendedAssetIds.some((id) => !living.some((fighter) => fighter.assetId === id))) reasons.push("arena_encounter_recommendation_invalid");
  const reaches = (key: keyof ArenaEncounterDefinition["minimum"]) => living.some((fighter) => fighter.stats[key] >= encounter.minimum[key]);
  if (!(reaches("speed") || reaches("guard") || reaches("power") || reaches("bond"))) reasons.push("arena_encounter_capability_unreachable");
  if (encounter.tier === "boss" && (encounter.bossPhases.length !== 3 || encounter.bossPhases.some((phase) => !phase.weakness || !phase.legalActions.length))) reasons.push("arena_encounter_boss_phase_invalid");
  return { ok: reasons.length === 0, reasons, witnessAssetIds: encounter.recommendedAssetIds };
}

export function generateArenaPath(input: ArenaPathInput): ArenaPath {
  if (!input.seed.trim() || !input.playerId.trim() || input.roster.length < 1 || input.roster.length > 3) throw new Error("arena_path_input_invalid");
  const encounters = encounterRows.map((row, index) => {
    const unsigned = unsignedEncounter(input, row, index + 1);
    const encounter = { ...unsigned, digest: sha256PortableBasis(canonicalPortableCardJson(unsigned)) };
    if (!validateArenaEncounterSolvability(encounter, input.roster).ok) throw new Error("arena_path_unsolvable");
    return encounter;
  });
  const validIds = new Set(encounters.map((encounter) => encounter.id));
  const completedEncounterIds = [...new Set(input.completedEncounterIds)].filter((id) => validIds.has(id));
  const currentEncounterId = encounters.find((encounter) => !completedEncounterIds.includes(encounter.id))?.id ?? null;
  const id = `arena:path:${sha256PortableBasis(`${input.seed}:${input.playerId}`).slice(7, 31)}`;
  const unsigned = {
    schema: "receiz.wilds.arena_path.v1" as const,
    id,
    encounters,
    currentEncounterId,
    checkpoint: { completedEncounterIds, lastCompletedEncounterId: completedEncounterIds.at(-1) ?? null },
  };
  return { ...unsigned, digest: sha256PortableBasis(canonicalPortableCardJson(unsigned)) };
}
