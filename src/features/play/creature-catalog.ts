export const CREATURE_CATALOG_VERSION = "receiz.wilds.catalog.v1" as const;

export type CreatureStage = 1 | 2 | 3;
export type CreatureRarity = "trail" | "uncommon" | "rare" | "mythic" | "eternal";
export type CreatureFoil = "standard" | "shimmer" | "prism" | "eternal";

export type CreatureStats = {
  health: number;
  power: number;
  guard: number;
  speed: number;
  bond: number;
};

export type CreatureAbility = {
  name: string;
  text: string;
  power: number;
};

export type CreatureRenderRecipe = {
  body: "round" | "long" | "armored" | "winged" | "serpentine";
  detail: "ears" | "horns" | "wings" | "crest" | "shell" | "tail";
  aura: "leaf" | "spark" | "tide" | "ember" | "prism" | "stone";
};

export type CreatureForm = {
  id: string;
  familyId: string;
  stage: CreatureStage;
  evolvesFromId: string | null;
  name: string;
  species: string;
  habitat: string;
  element: string;
  temperament: string;
  lore: string;
  role: string;
  rarity: CreatureRarity;
  foil: CreatureFoil;
  stats: CreatureStats;
  abilities: readonly [CreatureAbility, CreatureAbility];
  palette: { primary: string; accent: string; glow: string };
  anatomy: CreatureRenderRecipe;
  cardNumber: string;
  positionSeed: number;
  evolution: { level: number; bond: number; item: string | null };
  exchangeEligible: boolean;
};

export type CreatureFamily = {
  id: string;
  name: string;
  habitat: string;
  element: string;
  formIds: readonly [string, string, string];
};

type FamilySeed = {
  id: string;
  names: readonly [string, string, string];
  habitat: string;
  element: string;
  temperament: string;
  role: string;
  primary: string;
  accent: string;
  body: CreatureRenderRecipe["body"];
  detail: CreatureRenderRecipe["detail"];
  aura: CreatureRenderRecipe["aura"];
};

const flagshipSeeds: readonly FamilySeed[] = [
  {
    id: "mintcub",
    names: ["SealCub", "Verdelion", "Crownwood"],
    habitat: "Mint Grove",
    element: "Grove",
    temperament: "steadfast",
    role: "Heals expedition fatigue and protects collection streaks.",
    primary: "#38d989",
    accent: "#f5d36c",
    body: "round",
    detail: "ears",
    aura: "leaf"
  },
  {
    id: "voltray",
    names: ["Voltray", "Arclume", "Stormcrown"],
    habitat: "Spark Den",
    element: "Spark",
    temperament: "fearless",
    role: "Creates speed bursts and reveals rare encounter signals.",
    primary: "#ff7667",
    accent: "#ffd15c",
    body: "winged",
    detail: "wings",
    aura: "spark"
  },
  {
    id: "ledgerfox",
    names: ["Ledgerfox", "Proofvixen", "Auricensus"],
    habitat: "Trade Crossing",
    element: "Tide",
    temperament: "clever",
    role: "Finds hidden rewards and traces portable proof paths.",
    primary: "#62c8ff",
    accent: "#37d688",
    body: "long",
    detail: "tail",
    aura: "tide"
  },
  {
    id: "titanseal",
    names: ["Titanseal", "Vaultusk", "Eternarch"],
    habitat: "Titan Gate",
    element: "Stone",
    temperament: "guardian",
    role: "Unlocks apex missions and shields the expedition deck.",
    primary: "#c7ec5a",
    accent: "#ff8a48",
    body: "armored",
    detail: "horns",
    aura: "stone"
  }
] as const;

const firstNames = [
  "Aero", "Amber", "Astral", "Bramble", "Cinder", "Cloud", "Coral", "Dawn", "Dusk", "Echo",
  "Ember", "Fable", "Fern", "Flint", "Frost", "Glimmer", "Hollow", "Iris", "Jade", "Lumen",
  "Moss", "Nova", "Onyx", "Pearl", "Quill", "Rune", "Sable", "Solar", "Thistle", "Umber"
] as const;

const lastNames = ["beak", "bloom", "coil", "drift", "fang", "fin", "glide", "horn", "moth", "paw"] as const;
const stageTwoSuffixes = ["crest", "flare", "guard", "lume", "mane", "spire", "surge"] as const;
const stageThreeSuffixes = ["arch", "crown", "eternal", "prime", "sovereign", "warden"] as const;
const habitats = ["Beryl Marsh", "Cloudstep Ridge", "Copper Hollow", "Dawn Orchard", "Ember Basin", "Glasswater Coast", "Moonroot Vale", "Prism Prairie", "Rune Caves", "Sunveil Mesa"] as const;
const elements = ["Grove", "Spark", "Tide", "Ember", "Prism", "Stone"] as const;
const temperaments = ["bold", "calm", "curious", "gentle", "mischievous", "patient", "swift", "watchful"] as const;
const roles = [
  "Strengthens bond gains after discoveries.",
  "Reveals nearby habitat trails.",
  "Guards the active companion during missions.",
  "Raises the chance of finding foil traces.",
  "Carries bonus energy between expeditions.",
  "Improves collection streak rewards."
] as const;
const colors = ["#27c7a3", "#5f8dff", "#ff6f91", "#ff9b4a", "#9d72ff", "#63bf55", "#19a9d8", "#d5b43c", "#e15b45", "#44b57a"] as const;
const accents = ["#fff0a8", "#b9f5ff", "#ffd0dc", "#d9ffb4", "#e6d4ff", "#ffc878", "#f4f7ff"] as const;
const bodies: readonly CreatureRenderRecipe["body"][] = ["round", "long", "armored", "winged", "serpentine"];
const details: readonly CreatureRenderRecipe["detail"][] = ["ears", "horns", "wings", "crest", "shell", "tail"];
const auras: readonly CreatureRenderRecipe["aura"][] = ["leaf", "spark", "tide", "ember", "prism", "stone"];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generatedSeed(index: number): FamilySeed {
  const first = firstNames[index % firstNames.length]!;
  const last = lastNames[Math.floor(index / firstNames.length) % lastNames.length]!;
  const base = `${first}${last}`;
  const two = `${first}${stageTwoSuffixes[(index * 3 + 1) % stageTwoSuffixes.length]}`;
  const three = `${first}${stageThreeSuffixes[(index * 5 + 2) % stageThreeSuffixes.length]}`;
  const element = elements[index % elements.length]!;
  return {
    id: slug(base),
    names: [base, two, three],
    habitat: habitats[index % habitats.length]!,
    element,
    temperament: temperaments[index % temperaments.length]!,
    role: roles[index % roles.length]!,
    primary: colors[index % colors.length]!,
    accent: accents[(index * 2 + 1) % accents.length]!,
    body: bodies[index % bodies.length]!,
    detail: details[(index * 3 + 1) % details.length]!,
    aura: auras[index % auras.length]!
  };
}

const generatedSeeds = Array.from({ length: 246 }, (_, index) => generatedSeed(index));
const familySeeds = [...flagshipSeeds, ...generatedSeeds] as const;

function rarityFor(familyIndex: number, stage: CreatureStage): CreatureRarity {
  const roll = (familyIndex * 37 + stage * 17) % 100;
  if (roll >= 98 || (stage === 3 && roll >= 94)) return "eternal";
  if (roll >= 88 || (stage === 3 && roll >= 78)) return "mythic";
  if (roll >= 62 || stage === 3) return "rare";
  if (roll >= 28 || stage === 2) return "uncommon";
  return "trail";
}

function foilFor(rarity: CreatureRarity, familyIndex: number): CreatureFoil {
  if (rarity === "eternal") return "eternal";
  if (rarity === "mythic") return familyIndex % 2 ? "prism" : "shimmer";
  if (rarity === "rare" && familyIndex % 4 === 0) return "shimmer";
  return "standard";
}

function statsFor(familyIndex: number, stage: CreatureStage): CreatureStats {
  const stageGain = (stage - 1) * 28;
  return {
    health: 48 + (familyIndex * 7) % 43 + stageGain,
    power: 42 + (familyIndex * 11) % 49 + stageGain,
    guard: 39 + (familyIndex * 13) % 47 + stageGain,
    speed: 44 + (familyIndex * 17) % 45 + stageGain,
    bond: 50 + (familyIndex * 19) % 41 + stageGain
  };
}

function abilitiesFor(seed: FamilySeed, familyIndex: number, stage: CreatureStage): readonly [CreatureAbility, CreatureAbility] {
  const power = 18 + stage * 14 + familyIndex % 13;
  return [
    { name: `${seed.element} Pulse`, text: seed.role, power },
    { name: `${seed.names[stage - 1]} Bond`, text: `Gain ${stage + 1} bond after a successful ${seed.habitat} mission.`, power: power + 7 }
  ];
}

function formFor(seed: FamilySeed, familyIndex: number, stage: CreatureStage): CreatureForm {
  const id = `${seed.id}-${stage}`;
  const rarity = rarityFor(familyIndex, stage);
  return Object.freeze({
    id,
    familyId: seed.id,
    stage,
    evolvesFromId: stage === 1 ? null : `${seed.id}-${stage - 1}`,
    name: seed.names[stage - 1],
    species: `${seed.element} ${stage === 1 ? "companion" : stage === 2 ? "guardian" : "apex"}`,
    habitat: seed.habitat,
    element: seed.element,
    temperament: seed.temperament,
    lore: `${seed.names[stage - 1]} is a ${seed.temperament} keeper of ${seed.habitat}, carrying a Stage ${stage} proof-ring.`,
    role: seed.role,
    rarity,
    foil: foilFor(rarity, familyIndex),
    stats: Object.freeze(statsFor(familyIndex, stage)),
    abilities: Object.freeze(abilitiesFor(seed, familyIndex, stage)),
    palette: Object.freeze({ primary: seed.primary, accent: seed.accent, glow: colors[(familyIndex + stage + 3) % colors.length]! }),
    anatomy: Object.freeze({ body: seed.body, detail: seed.detail, aura: seed.aura }),
    cardNumber: `WLD-${String(familyIndex + 1).padStart(3, "0")}-${stage}`,
    positionSeed: familyIndex * 7919 + stage * 104729,
    evolution: Object.freeze(stage === 1
      ? { level: 1, bond: 0, item: null }
      : stage === 2
        ? { level: 4 + familyIndex % 3, bond: 12 + familyIndex % 9, item: `${seed.element} Trace` }
        : { level: 8 + familyIndex % 3, bond: 36 + familyIndex % 15, item: `${seed.element} Crown` }),
    exchangeEligible: true
  });
}

export const creatureFamilies: readonly CreatureFamily[] = Object.freeze(familySeeds.map((seed) => Object.freeze({
  id: seed.id,
  name: seed.names[0],
  habitat: seed.habitat,
  element: seed.element,
  formIds: Object.freeze([`${seed.id}-1`, `${seed.id}-2`, `${seed.id}-3`]) as readonly [string, string, string]
})));

export const creatureForms: readonly CreatureForm[] = Object.freeze(familySeeds.flatMap((seed, familyIndex) =>
  ([1, 2, 3] as const).map((stage) => formFor(seed, familyIndex, stage))
));

const formIndex = new Map(creatureForms.map((form) => [form.id, form]));
const familyFormIndex = new Map(creatureFamilies.map((family) => [
  family.id,
  Object.freeze(family.formIds.map((id) => formIndex.get(id)!))
]));

export function creatureForm(id: string) {
  return formIndex.get(id) ?? null;
}

export function formsForFamily(familyId: string): readonly CreatureForm[] {
  return familyFormIndex.get(familyId) ?? [];
}

function assertCatalog() {
  if (creatureFamilies.length !== 250 || creatureForms.length !== 750) throw new Error("wilds_catalog_cardinality_invalid");
  if (new Set(creatureFamilies.map((family) => family.id)).size !== 250) throw new Error("wilds_catalog_family_duplicate");
  if (new Set(creatureForms.map((form) => form.id)).size !== 750) throw new Error("wilds_catalog_form_duplicate");
  if (new Set(creatureForms.map((form) => form.cardNumber)).size !== 750) throw new Error("wilds_catalog_card_number_duplicate");
}

assertCatalog();
