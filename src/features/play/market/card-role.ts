import {
  effectiveAdventureStats,
  validateAdventureCondition,
  type AdventureCardCondition,
} from "../adventure/card-condition";
import { creatureForm, type CreatureAbility, type CreatureStats } from "../creature-catalog";
import { currentLivingGenome, currentRevision } from "../living-card-proof";
import { isLivingCardAsset } from "../living-card-types";
import { verifyAnyWildsCard, type PortableCardAsset } from "../portable-card";

export type MarketRole = "broker" | "scout" | "carrier" | "appraiser" | "guardian";
export type MarketVerb =
  | "inspect"
  | "read-tell"
  | "preserve"
  | "power"
  | "brace"
  | "clear"
  | "overfly"
  | "carry"
  | "heavy-carry"
  | "guard"
  | "repair"
  | "appraise"
  | "balance";

export type MarketLocomotion = "biped" | "quadruped" | "serpentine" | "flying";

export type MarketCardCapability = Readonly<{
  assetId: string;
  proofDigest: string;
  formId: string;
  familyId: string;
  playable: boolean;
  stats: CreatureStats;
  baseStats: CreatureStats;
  element: string;
  abilities: readonly [CreatureAbility, CreatureAbility];
  anatomy: Readonly<{
    body: "round" | "long" | "armored" | "winged" | "serpentine";
    detail: "ears" | "horns" | "wings" | "crest" | "shell" | "tail";
    aura: "leaf" | "spark" | "tide" | "ember" | "prism" | "stone";
    locomotion: MarketLocomotion;
  }>;
  roles: readonly [MarketRole, MarketRole];
  roleScores: Readonly<Record<MarketRole, number>>;
  verbs: ReadonlySet<MarketVerb>;
  condition: AdventureCardCondition;
}>;

function locomotionFor(body: MarketCardCapability["anatomy"]["body"]): MarketLocomotion {
  if (body === "winged") return "flying";
  if (body === "serpentine") return "serpentine";
  return "quadruped";
}

function marketVerbs(
  element: string,
  anatomy: Omit<MarketCardCapability["anatomy"], "locomotion">,
  condition: AdventureCardCondition,
) {
  const verbs = new Set<MarketVerb>(["inspect", "read-tell", "carry", "guard"]);
  if (element === "Grove") verbs.add("preserve");
  if (element === "Spark") {
    verbs.add("power");
    verbs.add("repair");
  }
  if (element === "Tide") {
    verbs.add("preserve");
    verbs.add("appraise");
    verbs.add("balance");
  }
  if (element === "Ember") {
    verbs.add("power");
    verbs.add("clear");
  }
  if (element === "Prism") {
    verbs.add("appraise");
    verbs.add("read-tell");
  }
  if (element === "Stone") {
    verbs.add("brace");
    verbs.add("heavy-carry");
    verbs.add("clear");
  }
  const wingDisabled = condition.injuries.some((injury) => injury.kind === "wing" && injury.severity >= 2);
  if (anatomy.body === "winged" && !wingDisabled) verbs.add("overfly");
  if (anatomy.body === "armored" || anatomy.detail === "shell") verbs.add("brace");
  if (anatomy.detail === "horns") verbs.add("clear");
  if (anatomy.detail === "tail") verbs.add("balance");
  return verbs;
}

function roleProjection(
  stats: CreatureStats,
  element: string,
  verbs: ReadonlySet<MarketVerb>,
  proofDigest: string,
) {
  const roleScores: Record<MarketRole, number> = {
    broker: stats.bond * 2 + stats.speed + (element === "Grove" || element === "Prism" ? 18 : 0),
    scout: stats.speed * 2 + stats.bond + (verbs.has("overfly") ? 24 : verbs.has("balance") ? 10 : 0),
    carrier: stats.power * 2 + stats.health + (verbs.has("heavy-carry") ? 24 : 0),
    appraiser: stats.bond * 2 + stats.power + (verbs.has("appraise") ? 24 : 0),
    guardian: stats.guard * 2 + stats.health + (verbs.has("brace") ? 20 : 0),
  };
  const tie = (role: MarketRole) => Number.parseInt(proofDigest.slice(7 + role.length, 9 + role.length), 16);
  const roles = (Object.keys(roleScores) as MarketRole[])
    .sort((left, right) => roleScores[right] - roleScores[left] || tie(left) - tie(right))
    .slice(0, 2) as [MarketRole, MarketRole];
  return { roles, roleScores };
}

export function projectMarketCard(
  card: PortableCardAsset,
  condition: AdventureCardCondition,
): MarketCardCapability {
  if (!verifyAnyWildsCard(card).ok) throw new Error("market_card_proof_invalid");
  if (condition.assetId !== card.id) throw new Error("market_condition_asset_mismatch");
  validateAdventureCondition(condition);
  const revision = isLivingCardAsset(card) ? currentRevision(card) : null;
  const formId = revision?.formId ?? card.manifest.formId;
  const form = creatureForm(formId);
  if (!form) throw new Error("market_card_form_unknown");
  const abilityNames = revision?.abilityNames ?? card.manifest.abilityNames;
  if (form.abilities.some((ability, index) => ability.name !== abilityNames[index])) throw new Error("market_card_ability_unknown");
  const genome = isLivingCardAsset(card) ? currentLivingGenome(card) : null;
  const baseStats = { ...(revision?.stats ?? card.manifest.stats) };
  const anatomyBase = genome?.anatomy ?? form.anatomy;
  const anatomy = {
    ...anatomyBase,
    locomotion: genome?.skeleton.locomotion ?? locomotionFor(anatomyBase.body),
  } satisfies MarketCardCapability["anatomy"];
  const verbs = marketVerbs(form.element, anatomy, condition);
  const projected = roleProjection(effectiveAdventureStats(baseStats, condition), form.element, verbs, card.proof.digest);
  return {
    assetId: card.id,
    proofDigest: card.proof.digest,
    formId,
    familyId: card.manifest.familyId,
    playable: condition.life === "alive",
    stats: effectiveAdventureStats(baseStats, condition),
    baseStats,
    element: form.element,
    abilities: form.abilities.map((ability) => ({ ...ability })) as [CreatureAbility, CreatureAbility],
    anatomy,
    roles: projected.roles,
    roleScores: projected.roleScores,
    verbs,
    condition,
  };
}

export function assertMarketCardPlayable(capability: MarketCardCapability) {
  if (capability.condition.life === "dead") throw new Error("market_card_dead");
  if (!capability.playable) throw new Error("market_card_unplayable");
}
