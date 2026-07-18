import type { Vec3 } from "./game-state";
import type { KaiArkName, KaiChakra, KaiMonthName, KaiWeekName } from "./kai-klok-moment";

export type WildsSagaScope = "day" | "week" | "month" | "year" | "lifetime";
export type WildsStoryOutcome = "success" | "partial" | "failure" | "unopposed";
export type WildsGameplayVerb = "travel" | "discover" | "capture" | "train" | "battle" | "ecology" | "raid" | "social" | "craft" | "tournament";

export type WildsReward = Readonly<{
  id: string;
  kind: "title" | "technique" | "cosmetic" | "lore" | "sigil" | "reputation" | "artifact";
  label: string;
}>;

export type WildsMissionNodeDefinition = Readonly<{
  id: string;
  title: string;
  description: string;
  destinationId: string;
  acceptedVerbs: readonly WildsGameplayVerb[];
  target: number;
  prerequisites: readonly string[];
}>;

export type WildsMissionDefinition = Readonly<{
  id: string;
  primary: boolean;
  title: string;
  giverId: string;
  nodes: readonly WildsMissionNodeDefinition[];
  reward: WildsReward;
}>;

export type WildsAchievementDefinition = Readonly<{
  id: string;
  scope: WildsSagaScope;
  title: string;
  description: string;
  acceptedVerbs: readonly WildsGameplayVerb[];
  target: number;
  reward: WildsReward;
}>;

export type WildsTrainerTier = "teaching" | "scout" | "veteran" | "champion" | "boss";
export type WildsTrainerAffinity = "Grove" | "Spark" | "Tide" | "Ember" | "Prism" | "Stone";

export type WildsTrainerDefinition = Readonly<{
  id: string;
  characterId: string | null;
  name: string;
  locationId: string;
  position: Vec3;
  tier: WildsTrainerTier;
  affinity: WildsTrainerAffinity;
  rosterSize: number;
  recurring: boolean;
}>;

export type WildsTournamentDefinition = Readonly<{
  id: string;
  name: string;
  locationId: string;
  capacity: 8;
  qualificationAchievementId: string;
  roundArk: "Purify";
  reward: WildsReward;
}>;

export type WildsDailyChapterDefinition = Readonly<{
  id: string;
  dayIndex: 0 | 1 | 2 | 3 | 4 | 5;
  title: string;
  chakra: KaiChakra;
  gate: string;
  featuredRegionId: string;
  acts: Readonly<Record<KaiArkName, string>>;
  missions: readonly WildsMissionDefinition[];
  achievements: readonly WildsAchievementDefinition[];
  trainers: readonly WildsTrainerDefinition[];
  tournament: WildsTournamentDefinition;
  outcomeHooks: Readonly<Record<WildsStoryOutcome, string>>;
}>;

export type WildsSagaCharacter = Readonly<{
  id: string;
  name: string;
  role: "archivist" | "wayfinder" | "caretaker" | "rival" | "champion";
  voice: string;
}>;

export type WildsSagaFramework = Readonly<{
  version: "kai-saga.v1";
  title: string;
  weekNames: readonly KaiWeekName[];
  monthNames: readonly KaiMonthName[];
  characters: readonly WildsSagaCharacter[];
  dailyChapters: readonly WildsDailyChapterDefinition[];
}>;
