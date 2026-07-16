import { effectiveAdventureStats, validateAdventureCondition, type AdventureCardCondition } from "../adventure/card-condition";
import { creatureForm, type CreatureStats } from "../creature-catalog";
import { currentLivingGenome, currentRevision } from "../living-card-proof";
import { isLivingCardAsset } from "../living-card-types";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "../portable-card";
import { verifyArenaLivingRevisionContent, type ArenaLivingRevision } from "./living-revision";
import { type ArenaBodyFamily, type ArenaCollisionBody, type ArenaLocomotion } from "./rules";

export type ArenaFighterDefinition = Readonly<{
  assetId: string;
  proofDigest: string;
  revisionDigest: string;
  formId: string;
  familyId: string;
  name: string;
  element: string;
  bodyFamily: ArenaBodyFamily;
  collision: ArenaCollisionBody;
  baseStats: CreatureStats;
  stats: CreatureStats;
  abilityNames: readonly [string, string];
  abilityPowers: readonly [number, number];
  locomotion: readonly ArenaLocomotion[];
  condition: AdventureCardCondition;
  maxVitality: number;
  maxBreak: number;
  moveSpeed: number;
  jumpImpulse: number;
  airControl: number;
  mass: number;
  reach: number;
  playable: boolean;
}>;

function bodyFamily(body: "round" | "long" | "armored" | "winged" | "serpentine", locomotion?: string): ArenaBodyFamily {
  if (locomotion === "biped") return "biped";
  if (body === "winged" || locomotion === "flying") return "winged";
  if (body === "serpentine" || locomotion === "serpentine") return "serpentine";
  if (body === "armored") return "heavy";
  if (body === "round") return "small";
  return "quadruped";
}

function physicalProfile(family: ArenaBodyFamily) {
  if (family === "heavy") return { collision: { kind: "capsule" as const, radius: 0.62, height: 1.45, centerY: 0.73 }, mass: 1.5, reach: 1.22, air: 0.62 };
  if (family === "winged") return { collision: { kind: "capsule" as const, radius: 0.48, height: 1.12, centerY: 0.56 }, mass: 0.82, reach: 1.08, air: 1.42 };
  if (family === "serpentine") return { collision: { kind: "capsule" as const, radius: 0.42, height: 0.92, centerY: 0.46 }, mass: 0.92, reach: 1.3, air: 0.84 };
  if (family === "small") return { collision: { kind: "capsule" as const, radius: 0.38, height: 0.88, centerY: 0.44 }, mass: 0.68, reach: 0.86, air: 1.12 };
  if (family === "biped") return { collision: { kind: "capsule" as const, radius: 0.46, height: 1.32, centerY: 0.66 }, mass: 1, reach: 1.08, air: 1 };
  return { collision: { kind: "capsule" as const, radius: 0.5, height: 1.02, centerY: 0.51 }, mass: 1, reach: 1.05, air: 0.95 };
}

function locomotionFor(element: string, family: ArenaBodyFamily, condition: AdventureCardCondition) {
  const values = new Set<ArenaLocomotion>(["ground", "jump"]);
  const wingDisabled = condition.injuries.some((injury) => injury.kind === "wing" && injury.severity >= 2);
  const limbDisabled = condition.injuries.some((injury) => injury.kind === "limb" && injury.severity >= 3);
  if (family === "winged" && !wingDisabled) values.add("fly");
  if (element === "Tide") values.add("swim");
  if (element === "Stone") values.add("dig");
  if ((element === "Grove" || family === "serpentine") && !limbDisabled) values.add("climb");
  return [...values];
}

export function projectArenaFighter(card: PortableCardAsset, revision: ArenaLivingRevision): ArenaFighterDefinition {
  if (!verifyAnyWildsCard(card).ok) throw new Error("arena_fighter_card_proof_invalid");
  if (!verifyArenaLivingRevisionContent(revision)) throw new Error("arena_fighter_revision_invalid");
  if (revision.assetId !== card.id) throw new Error("arena_fighter_revision_asset_invalid");
  validateAdventureCondition(revision.condition);
  const living = isLivingCardAsset(card) ? currentRevision(card) : null;
  const genome = isLivingCardAsset(card) ? currentLivingGenome(card) : null;
  const formId = living?.formId ?? card.manifest.formId;
  const form = creatureForm(formId);
  if (!form) throw new Error("arena_fighter_form_unknown");
  const abilityNames = (living?.abilityNames ?? card.manifest.abilityNames) as readonly [string, string];
  if (form.abilities.some((ability, index) => ability.name !== abilityNames[index])) throw new Error("arena_fighter_ability_unknown");
  const baseStats = { ...(living?.stats ?? card.manifest.stats) };
  const condition = revision.condition;
  const stats = effectiveAdventureStats(baseStats, condition);
  const anatomy = genome?.anatomy ?? form.anatomy;
  const family = bodyFamily(anatomy.body, genome?.skeleton.locomotion);
  const physical = physicalProfile(family);
  const locomotion = locomotionFor(form.element, family, condition);
  const wingPenalty = family === "winged" && !locomotion.includes("fly") ? 0.48 : 1;
  return {
    assetId: card.id,
    proofDigest: card.proof.digest,
    revisionDigest: revision.digest,
    formId,
    familyId: card.manifest.familyId,
    name: card.manifest.name,
    element: form.element,
    bodyFamily: family,
    collision: physical.collision,
    baseStats,
    stats,
    abilityNames,
    abilityPowers: form.abilities.map((ability) => ability.power) as [number, number],
    locomotion,
    condition,
    maxVitality: Math.max(1, stats.health * 2),
    maxBreak: Math.max(10, Math.round(stats.guard * 1.15 + stats.health * 0.35)),
    moveSpeed: Number((3.2 + stats.speed / 38).toFixed(3)),
    jumpImpulse: Number((5.1 + stats.speed / 80).toFixed(3)),
    airControl: Number((physical.air * wingPenalty * (0.72 + stats.speed / 180)).toFixed(3)),
    mass: Number((physical.mass * (0.82 + stats.health / 220)).toFixed(3)),
    reach: Number((physical.reach * (0.9 + stats.power / 420)).toFixed(3)),
    playable: condition.life === "alive",
  };
}

export function assertArenaFighterPlayable(fighter: ArenaFighterDefinition) {
  if (fighter.condition.life === "dead") throw new Error("arena_fighter_retired");
  if (!fighter.playable) throw new Error("arena_fighter_unplayable");
  if (canonicalPortableCardJson(fighter.condition).length > 64_000) throw new Error("arena_fighter_condition_invalid");
}
