import { KAI_MONTH_NAMES, KAI_WEEK_NAMES, type KaiArkName } from "./kai-klok-moment";
import type {
  WildsAchievementDefinition,
  WildsDailyChapterDefinition,
  WildsGameplayVerb,
  WildsMissionDefinition,
  WildsReward,
  WildsSagaFramework,
  WildsTrainerAffinity,
  WildsTrainerDefinition,
  WildsTrainerTier
} from "./wilds-saga-types";

export const WILDS_SAGA_FRAMEWORK_VERSION = "kai-saga.v1" as const;

const characters = [
  { id: "character:sola-reed", name: "Sola Reed", role: "archivist", voice: "patient witness" },
  { id: "character:mira-vale", name: "Mira Vale", role: "wayfinder", voice: "bright invitation" },
  { id: "character:oren-moss", name: "Oren Moss", role: "caretaker", voice: "grounded warmth" },
  { id: "character:nahl-vey", name: "Nahl Vey", role: "rival", voice: "measured challenge" },
  { id: "character:ilyra-crown", name: "Ilyra Crown", role: "champion", voice: "quiet certainty" }
] as const;

type ChapterSeed = Readonly<{
  id: string;
  dayIndex: 0 | 1 | 2 | 3 | 4 | 5;
  title: string;
  chakra: WildsDailyChapterDefinition["chakra"];
  gate: string;
  region: string;
  place: string;
  position: readonly [number, number, number];
  giverId: string;
  trainerNames: readonly [string, string, string];
  trainerTiers: readonly [WildsTrainerTier, WildsTrainerTier, WildsTrainerTier];
  affinity: WildsTrainerAffinity;
  verbs: readonly [WildsGameplayVerb, WildsGameplayVerb, WildsGameplayVerb];
  theme: string;
  reward: WildsReward;
}>;

function acts(seed: ChapterSeed): Readonly<Record<KaiArkName, string>> {
  return {
    Ignite: `${seed.title} begins at ${seed.place}; follow the first signal and learn what changed.`,
    Integrate: `Meet the keepers of ${seed.region}, train your companions, and restore the route.`,
    Harmonize: `Join the shared ${seed.theme} effort so every contribution can strengthen the region.`,
    Reflekt: `Nahl Vey and the roaming trainers test what the world learned from earlier choices.`,
    Purify: `Qualifiers enter the ${seed.title} tournament while the region faces its decisive trial.`,
    Dream: `The day settles into permanent memory and carries its consequence into tomorrow.`
  };
}

function mission(seed: ChapterSeed, primary: boolean): WildsMissionDefinition {
  const prefix = primary ? "path" : "echo";
  const nodes = primary ? [
    { id: `${prefix}:${seed.id}:arrive`, title: `Reach ${seed.place}`, description: `Follow the live route into ${seed.region}.`, destinationId: seed.place, acceptedVerbs: [seed.verbs[0]], target: 1, prerequisites: [] },
    { id: `${prefix}:${seed.id}:answer`, title: `Answer the ${seed.theme} signal`, description: `Work with the people and companions already shaping this place.`, destinationId: seed.place, acceptedVerbs: [seed.verbs[1]], target: 2, prerequisites: [`${prefix}:${seed.id}:arrive`] },
    { id: `${prefix}:${seed.id}:prove`, title: "Face the route challenger", description: `Win the trial that determines how ${seed.region} remembers this day.`, destinationId: seed.place, acceptedVerbs: [seed.verbs[2]], target: 1, prerequisites: [`${prefix}:${seed.id}:answer`] }
  ] : [
    { id: `${prefix}:${seed.id}:listen`, title: "Hear the world memory", description: `Recover the causes that brought ${seed.region} to this moment.`, destinationId: seed.place, acceptedVerbs: ["discover" as const, "social" as const], target: 1, prerequisites: [] }
  ];
  return {
    id: `mission:${seed.id}:${primary ? "primary" : "optional"}`,
    primary,
    title: primary ? seed.title : `${seed.region} remembers`,
    giverId: primary ? seed.giverId : "character:sola-reed",
    nodes,
    reward: primary ? seed.reward : { id: `lore:${seed.id}`, kind: "lore", label: `${seed.region} Memory` }
  };
}

function achievement(seed: ChapterSeed): WildsAchievementDefinition {
  return {
    id: `achievement:${seed.id}:qualifier`,
    scope: "day",
    title: `${seed.title} Qualifier`,
    description: `Complete the directed path and earn a place in today's Purify tournament.`,
    acceptedVerbs: [seed.verbs[0], seed.verbs[1], seed.verbs[2]],
    target: 4,
    reward: { id: `title:${seed.id}:qualifier`, kind: "title", label: `${seed.region} Qualifier` }
  };
}

function trainer(seed: ChapterSeed, index: 0 | 1 | 2): WildsTrainerDefinition {
  const recurring = index === 1;
  return {
    id: recurring ? `trainer:nahl-vey:${seed.dayIndex}` : `trainer:${seed.id}:${index + 1}`,
    characterId: recurring ? "character:nahl-vey" : index === 2 ? "character:ilyra-crown" : null,
    name: seed.trainerNames[index],
    locationId: seed.place,
    position: [seed.position[0] + index * 2.4, 0, seed.position[2] + (index - 1) * 2.2],
    tier: seed.trainerTiers[index],
    affinity: seed.affinity,
    rosterSize: index === 0 ? 1 : index === 1 ? 2 : 3,
    recurring
  };
}

function chapter(seed: ChapterSeed): WildsDailyChapterDefinition {
  const qualifier = achievement(seed);
  return {
    id: `chapter:${seed.id}`,
    dayIndex: seed.dayIndex,
    title: seed.title,
    chakra: seed.chakra,
    gate: seed.gate,
    featuredRegionId: seed.region,
    acts: acts(seed),
    missions: [mission(seed, true), mission(seed, false)],
    achievements: [qualifier],
    trainers: [trainer(seed, 0), trainer(seed, 1), trainer(seed, 2)],
    tournament: {
      id: `tournament:${seed.id}`,
      name: `${seed.title} Crown`,
      locationId: seed.place,
      capacity: 8,
      qualificationAchievementId: qualifier.id,
      roundArk: "Purify",
      reward: { id: `sigil:${seed.id}`, kind: "sigil", label: `${seed.region} Day Sigil` }
    },
    outcomeHooks: {
      success: `${seed.id}:path-flourishes`,
      partial: `${seed.id}:work-continues`,
      failure: `${seed.id}:scar-remains`,
      unopposed: `${seed.id}:silence-deepens`
    }
  };
}

const dailyChapters = ([
  { id: "first-light", dayIndex: 0, title: "The First Light", chakra: "Root", gate: "Earth Gate", region: "Verdant Crown", place: "Mint Grove", position: [-3.2, 0, -1.7], giverId: "character:oren-moss", trainerNames: ["Rowan of the Roots", "Nahl Vey", "Ilyra's Grove Envoy"], trainerTiers: ["teaching", "scout", "champion"], affinity: "Grove", verbs: ["travel", "discover", "battle"], theme: "rootway", reward: { id: "title:first-light", kind: "title", label: "First Light" } },
  { id: "waters-remember", dayIndex: 1, title: "The Waters Remember", chakra: "Sacral", gate: "Water Gate", region: "Ember Reach", place: "Spark Den", position: [1.3, 0, -2.4], giverId: "character:mira-vale", trainerNames: ["Cinder Scout Ema", "Nahl Vey", "Lanternforge Keeper"], trainerTiers: ["scout", "veteran", "champion"], affinity: "Ember", verbs: ["travel", "train", "battle"], theme: "lanternforge", reward: { id: "technique:flow-step", kind: "technique", label: "Flow Step" } },
  { id: "lantern-current", dayIndex: 2, title: "The Lantern Current", chakra: "Solar Plexus", gate: "Fire Gate", region: "Tidal Lanterns", place: "Trade Crossing", position: [-0.7, 0, 1.8], giverId: "character:sola-reed", trainerNames: ["Reefway Toma", "Nahl Vey", "Abyssal Standard"], trainerTiers: ["scout", "veteran", "champion"], affinity: "Tide", verbs: ["discover", "ecology", "battle"], theme: "reefway", reward: { id: "cosmetic:lantern-trail", kind: "cosmetic", label: "Lantern Trail" } },
  { id: "mirrors-answer", dayIndex: 3, title: "When Mirrors Answer", chakra: "Heart", gate: "Air Gate", region: "Skyglass Expanse", place: "Reward Nest", position: [1.7, 0, 2.8], giverId: "character:mira-vale", trainerNames: ["Cloudrail Jun", "Nahl Vey", "Thunderwing Herald"], trainerTiers: ["veteran", "veteran", "champion"], affinity: "Spark", verbs: ["travel", "social", "battle"], theme: "mirrorstorm", reward: { id: "lore:skyglass-oath", kind: "lore", label: "Skyglass Oath" } },
  { id: "nocturne-vigil", dayIndex: 4, title: "The Nocturne Vigil", chakra: "Throat", gate: "Will Gate", region: "Umbral Bloom", place: "Prismroot", position: [2.8, 0, 4.4], giverId: "character:sola-reed", trainerNames: ["Dreamspore Lio", "Nahl Vey", "Eclipse Witness"], trainerTiers: ["veteran", "champion", "champion"], affinity: "Prism", verbs: ["discover", "craft", "battle"], theme: "prismroot", reward: { id: "cosmetic:prism-voice", kind: "cosmetic", label: "Prism Voice" } },
  { id: "crown-convergence", dayIndex: 5, title: "The Crown Convergence", chakra: "Crown", gate: "Ether Gate", region: "Titan Gate", place: "Titan Gate", position: [3.4, 0, 1.5], giverId: "character:ilyra-crown", trainerNames: ["Crown Path Asha", "Nahl Vey", "Ilyra Crown"], trainerTiers: ["veteran", "champion", "boss"], affinity: "Stone", verbs: ["raid", "train", "tournament"], theme: "convergence", reward: { id: "artifact:weekly-crown", kind: "artifact", label: "Convergence Crown" } }
] as const satisfies readonly ChapterSeed[]).map(chapter);

const FRAMEWORK: WildsSagaFramework = Object.freeze({
  version: WILDS_SAGA_FRAMEWORK_VERSION,
  title: "The World That Remembers",
  weekNames: KAI_WEEK_NAMES,
  monthNames: KAI_MONTH_NAMES,
  characters,
  dailyChapters
});

export function wildsSagaFramework(): WildsSagaFramework {
  return FRAMEWORK;
}
