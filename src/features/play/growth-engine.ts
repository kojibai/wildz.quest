import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { currentLivingProjection, currentRevision } from "./living-card-proof";
import type { GrowthPath, LivingCardAsset, LivingGrowthSnapshot } from "./living-card-types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type GrowthEventKind =
  | "battle_win"
  | "ability_mastery"
  | "habitat_discovery"
  | "active_travel"
  | "bond_moment"
  | "descendant_milestone";

export type GrowthEvent = {
  eventId: string;
  kind?: GrowthEventKind;
  path: GrowthPath;
  amount: number;
  occurredAt: string;
  achievementId?: string;
  questId?: string;
};

export type CharacterQuest = {
  id: string;
  eventKind: GrowthEventKind;
  path: GrowthPath;
  target: number;
  label: string;
};

export type GrowthRequirements = {
  mode: "stage" | "ascension";
  ascensionRank: number;
  bond: number;
  catalystTier: number;
  recoveryMs: number;
  quest: CharacterQuest;
};

export type GrowthReadiness = {
  ready: boolean;
  missing: Array<"bond" | "achievement" | "character_quest" | "catalyst" | "recovery">;
  requirements: GrowthRequirements;
  progress: LivingGrowthSnapshot;
  selectedAchievementId: string | null;
  selectedCatalystId: string | null;
};

const QUESTS: ReadonlyArray<Omit<CharacterQuest, "id">> = [
  { eventKind: "battle_win", path: "battle", target: 3, label: "Win three battles while this companion leads." },
  { eventKind: "ability_mastery", path: "battle", target: 5, label: "Use a signature ability successfully five times." },
  { eventKind: "habitat_discovery", path: "exploration", target: 2, label: "Discover two new habitat signals together." },
  { eventKind: "active_travel", path: "bond", target: 8, label: "Cross eight expedition milestones as active companions." },
  { eventKind: "bond_moment", path: "bond", target: 4, label: "Complete four meaningful bond moments." },
  { eventKind: "descendant_milestone", path: "legacy", target: 1, label: "Reach a new verified family milestone." }
];

export function applyGrowthEvent(progress: LivingGrowthSnapshot, event: GrowthEvent): LivingGrowthSnapshot {
  if (!event.eventId.trim() || !Number.isFinite(Date.parse(event.occurredAt)) || !Number.isFinite(event.amount) || event.amount <= 0) {
    throw new Error("wilds_growth_event_invalid");
  }
  if (progress.eventIds.includes(event.eventId)) return progress;
  const achievementIds = event.achievementId
    ? Array.from(new Set([...progress.achievementIds, event.achievementId]))
    : [...progress.achievementIds];
  const completedQuestIds = event.questId
    ? Array.from(new Set([...progress.completedQuestIds, event.questId]))
    : [...progress.completedQuestIds];
  const bond = event.path === "bond" ? progress.bond + event.amount : progress.bond;
  return {
    ...progress,
    bond,
    paths: { ...progress.paths, [event.path]: progress.paths[event.path] + event.amount },
    eventIds: [...progress.eventIds, event.eventId],
    achievementIds,
    completedQuestIds
  };
}

export function ascensionRequirements(rank: number) {
  if (!Number.isSafeInteger(rank) || rank < 1) throw new Error("wilds_rank_invalid");
  return {
    bond: Math.min(1_000_000, 80 + rank * 35 + Math.floor(Math.pow(rank, 1.25) * 12)),
    catalystTier: 1 + Math.floor(Math.log2(rank + 1)),
    recoveryMs: Math.min(7 * DAY_MS, DAY_MS + rank * 3_600_000)
  };
}

export function characterQuest(asset: LivingCardAsset, rank: number): CharacterQuest {
  if (!Number.isSafeInteger(rank) || rank < 1) throw new Error("wilds_rank_invalid");
  const projection = currentLivingProjection(asset);
  const seed = sha256PortableBasis(canonicalPortableCardJson({
    assetId: asset.id,
    rank,
    genome: projection.revisionDigest,
    temperament: projection.genome.face.identityAnchor
  }));
  const index = Number.parseInt(seed.slice(7, 15), 16) % QUESTS.length;
  const template = QUESTS[index]!;
  return {
    ...template,
    id: `quest:${asset.id}:${rank}:${template.eventKind}`,
    target: template.target + Math.floor(Math.log2(rank + 1))
  };
}

export function nextGrowthRequirements(asset: LivingCardAsset, at: string): GrowthRequirements {
  if (!Number.isFinite(Date.parse(at))) throw new Error("wilds_growth_time_invalid");
  const revision = currentRevision(asset);
  const rank = revision.stage === 3 ? revision.ascensionRank + 1 : 1;
  if (revision.stage < 3) {
    return {
      mode: "stage",
      ascensionRank: 0,
      bond: revision.growth.bond,
      catalystTier: 0,
      recoveryMs: 0,
      quest: characterQuest(asset, rank)
    };
  }
  return { mode: "ascension", ascensionRank: rank, ...ascensionRequirements(rank), quest: characterQuest(asset, rank) };
}

export function growthReadiness(
  asset: LivingCardAsset,
  context: { progress: LivingGrowthSnapshot; catalystIds: string[] },
  at: string
): GrowthReadiness {
  const requirements = nextGrowthRequirements(asset, at);
  const progress = context.progress;
  const availableAchievements = progress.achievementIds.filter((id) => !progress.consumedAchievementIds.includes(id));
  const selectedCatalystId = context.catalystIds.find((id) => id.startsWith(`ascension:tier:${requirements.catalystTier}:`)) ?? null;
  const missing: GrowthReadiness["missing"] = [];
  if (progress.bond < requirements.bond) missing.push("bond");
  if (!availableAchievements.length) missing.push("achievement");
  if (!progress.completedQuestIds.includes(requirements.quest.id)) missing.push("character_quest");
  if (!selectedCatalystId) missing.push("catalyst");
  if (progress.recoveryUntil && Date.parse(progress.recoveryUntil) > Date.parse(at)) missing.push("recovery");
  return {
    ready: missing.length === 0,
    missing,
    requirements,
    progress,
    selectedAchievementId: availableAchievements[0] ?? null,
    selectedCatalystId
  };
}

export function buildTransformationCandidate(asset: LivingCardAsset, readiness: GrowthReadiness, at: string) {
  if (!readiness.ready || !readiness.selectedAchievementId || !readiness.selectedCatalystId) throw new Error("wilds_growth_not_ready");
  if (!Number.isFinite(Date.parse(at))) throw new Error("wilds_growth_time_invalid");
  return {
    assetId: asset.id,
    priorRevisionDigest: currentRevision(asset).digest,
    ascensionRank: readiness.requirements.ascensionRank,
    achievementId: readiness.selectedAchievementId,
    questId: readiness.requirements.quest.id,
    catalystId: readiness.selectedCatalystId,
    at
  };
}
