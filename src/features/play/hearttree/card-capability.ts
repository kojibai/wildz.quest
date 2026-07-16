import { creatureForm, type CreatureStats } from "../creature-catalog";
import {
  effectiveAdventureStats,
  validateAdventureCondition,
  type AdventureCardCondition,
} from "../adventure/card-condition";
import { currentLivingGenome, currentRevision } from "../living-card-proof";
import { isLivingCardAsset } from "../living-card-types";
import { verifyAnyWildsCard, type PortableCardAsset } from "../portable-card";
import { projectWildsCardMastery, type WildsMasteryRole } from "../wilds-card-mastery";

export type HearttreeLifeState = "alive" | "dead";
export type HearttreeInjuryKind = "limb" | "wing" | "guard" | "focus";
export type HearttreeInjury = Readonly<{
  id: string;
  kind: HearttreeInjuryKind;
  severity: 1 | 2 | 3;
  sourceEventId: string;
}>;

export type HearttreeCardCondition = Readonly<{
  assetId: string;
  life: HearttreeLifeState;
  fatigue: number;
  injuries: readonly HearttreeInjury[];
  hearttreeXp: number;
  mastery: number;
  upgradeIds: readonly string[];
}>;

export type HearttreeTraversal = "ground" | "flight" | "narrow" | "break" | "anchor" | "balance";
export type HearttreeRole = "vanguard" | "pathfinder" | "channeler" | "warden" | "striker" | "resonant";
export type HearttreeLocomotion = "biped" | "quadruped" | "serpentine" | "flying";

export type HearttreeCardCapability = Readonly<{
  assetId: string;
  proofDigest: string;
  formId: string;
  familyId: string;
  playable: boolean;
  stats: CreatureStats;
  baseStats: CreatureStats;
  element: string;
  abilityNames: readonly [string, string];
  anatomy: Readonly<{
    body: "round" | "long" | "armored" | "winged" | "serpentine";
    detail: "ears" | "horns" | "wings" | "crest" | "shell" | "tail";
    aura: "leaf" | "spark" | "tide" | "ember" | "prism" | "stone";
    locomotion: HearttreeLocomotion;
  }>;
  traversal: ReadonlySet<HearttreeTraversal>;
  roles: readonly HearttreeRole[];
  condition: HearttreeCardCondition;
}>;

const roleProjection: Readonly<Record<WildsMasteryRole, HearttreeRole>> = {
  anchor: "vanguard",
  breaker: "striker",
  bulwark: "warden",
  conductor: "channeler",
  pathfinder: "pathfinder",
  caretaker: "warden",
  duelist: "striker",
  artificer: "resonant"
};

function boundedInteger(value: number, minimum: number, maximum: number, error: string) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(error);
  return value;
}

export function emptyHearttreeCondition(assetId: string): HearttreeCardCondition {
  const normalized = assetId.trim();
  if (!normalized) throw new Error("hearttree_condition_asset_required");
  return {
    assetId: normalized,
    life: "alive",
    fatigue: 0,
    injuries: [],
    hearttreeXp: 0,
    mastery: 0,
    upgradeIds: []
  };
}

export function hearttreeConditionToAdventure(condition: HearttreeCardCondition): AdventureCardCondition {
  const shared: AdventureCardCondition = {
    assetId: condition.assetId,
    life: condition.life,
    fatigue: condition.fatigue,
    injuries: condition.injuries.map((injury) => ({ ...injury })),
    xp: { hearttree: condition.hearttreeXp },
    mastery: { hearttree: condition.mastery },
    upgradeIds: [...condition.upgradeIds],
    receiptDigests: [],
  };
  return validateAdventureCondition(shared);
}

export function adventureConditionToHearttree(condition: AdventureCardCondition): HearttreeCardCondition {
  validateAdventureCondition(condition);
  return {
    assetId: condition.assetId,
    life: condition.life,
    fatigue: condition.fatigue,
    injuries: condition.injuries.map((injury) => ({ ...injury })),
    hearttreeXp: condition.xp.hearttree ?? 0,
    mastery: condition.mastery.hearttree ?? 0,
    upgradeIds: [...condition.upgradeIds],
  };
}

function validateCondition(condition: HearttreeCardCondition) {
  if (condition.life !== "alive" && condition.life !== "dead") throw new Error("hearttree_condition_life_invalid");
  boundedInteger(condition.fatigue, 0, 100, "hearttree_condition_fatigue_invalid");
  boundedInteger(condition.hearttreeXp, 0, 1_000_000, "hearttree_condition_xp_invalid");
  boundedInteger(condition.mastery, 0, 10_000, "hearttree_condition_mastery_invalid");
  for (const injury of condition.injuries) {
    if (!injury.id.trim()
      || !injury.sourceEventId.trim()
      || !["limb", "wing", "guard", "focus"].includes(injury.kind)
      || ![1, 2, 3].includes(injury.severity)) {
      throw new Error("hearttree_condition_injury_invalid");
    }
  }
}

function locomotionFor(body: HearttreeCardCapability["anatomy"]["body"]): HearttreeLocomotion {
  if (body === "winged") return "flying";
  if (body === "serpentine") return "serpentine";
  return "quadruped";
}

function traversalFor(anatomy: Omit<HearttreeCardCapability["anatomy"], "locomotion">, condition: HearttreeCardCondition) {
  const traversal = new Set<HearttreeTraversal>(["ground"]);
  const wingDisabled = condition.injuries.some((injury) => injury.kind === "wing" && injury.severity >= 2);
  if (anatomy.body === "winged" && !wingDisabled) traversal.add("flight");
  if (anatomy.body === "serpentine") traversal.add("narrow");
  if (anatomy.body === "armored" || anatomy.detail === "shell") traversal.add("anchor");
  if (anatomy.body === "armored" || anatomy.detail === "horns") traversal.add("break");
  if (anatomy.detail === "tail") traversal.add("balance");
  return traversal;
}

export function projectHearttreeCard(card: PortableCardAsset, condition: HearttreeCardCondition): HearttreeCardCapability {
  if (!verifyAnyWildsCard(card).ok) throw new Error("hearttree_card_proof_invalid");
  if (condition.assetId !== card.id) throw new Error("hearttree_condition_asset_mismatch");
  validateCondition(condition);

  const revision = isLivingCardAsset(card) ? currentRevision(card) : null;
  const formId = revision?.formId ?? card.manifest.formId;
  const form = creatureForm(formId);
  if (!form) throw new Error("hearttree_card_form_unknown");
  const genome = isLivingCardAsset(card) ? currentLivingGenome(card) : null;
  const baseStats = { ...(revision?.stats ?? card.manifest.stats) };
  const anatomyBase = genome?.anatomy ?? form.anatomy;
  const anatomy = {
    ...anatomyBase,
    locomotion: genome?.skeleton.locomotion ?? locomotionFor(anatomyBase.body)
  } satisfies HearttreeCardCapability["anatomy"];
  const mastery = projectWildsCardMastery(card);
  const roles = [...new Set([mastery.primary, mastery.secondary].map((role) => roleProjection[role]))];

  return {
    assetId: card.id,
    proofDigest: card.proof.digest,
    formId,
    familyId: card.manifest.familyId,
    playable: condition.life === "alive",
    stats: effectiveAdventureStats(baseStats, hearttreeConditionToAdventure(condition)),
    baseStats,
    element: form.element,
    abilityNames: [...(revision?.abilityNames ?? card.manifest.abilityNames)] as [string, string],
    anatomy,
    traversal: traversalFor(anatomy, condition),
    roles,
    condition: {
      ...condition,
      injuries: condition.injuries.map((injury) => ({ ...injury })),
      upgradeIds: [...condition.upgradeIds]
    }
  };
}

export function assertHearttreeCardPlayable(capability: HearttreeCardCapability) {
  if (capability.condition.life === "dead") throw new Error("hearttree_card_dead");
  if (!capability.playable) throw new Error("hearttree_card_unplayable");
}
