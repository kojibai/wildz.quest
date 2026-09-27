import type { CreatureRenderRecipe, CreatureRarity, CreatureStats } from "./creature-catalog";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { projectEncounterResultV11, type WildsV11EncounterResult } from "./wilds-encounter-proof-v11";
import { parseWildsWorldAddress, type WildsWorldAddress } from "./wilds-world-address";

export const WILDS_CREATURE_GENERATOR_V11 = "wildz.creature-generator.v11" as const;

export type WildsV11CreatureBirth = Readonly<{
  generator: typeof WILDS_CREATURE_GENERATOR_V11;
  identity: Readonly<{ actorId: string; site: WildsWorldAddress; slot: number }>;
  lineage: Readonly<{ regionFamily: string; ancestrySeed: string }>;
  rarity: CreatureRarity;
  body: Readonly<CreatureRenderRecipe & { scale: number; gait: "walk" | "bound" | "glide" | "swim" }>;
  surface: Readonly<{ pattern: string; markingCount: number; primary: string; accent: string; glow: string }>;
  temperament: "bold" | "calm" | "curious" | "gentle" | "mischievous" | "patient" | "swift" | "watchful";
  habitat: "grove" | "stone" | "marsh" | "ridge" | "shore" | "sky" | "ruin" | "tundra";
  voice: Readonly<{ fundamentalHz: number; pulseMs: number; timbre: number }>;
  abilities: readonly [string, string];
  stats: CreatureStats;
  generationDigest: string;
}>;

const BODIES = ["round", "long", "armored", "winged", "serpentine"] as const;
const DETAILS = ["ears", "horns", "wings", "crest", "shell", "tail"] as const;
const AURAS = ["leaf", "spark", "tide", "ember", "prism", "stone"] as const;
const GAITS = ["walk", "bound", "glide", "swim"] as const;
const TEMPERAMENTS = ["bold", "calm", "curious", "gentle", "mischievous", "patient", "swift", "watchful"] as const;
const HABITATS = ["grove", "stone", "marsh", "ridge", "shore", "sky", "ruin", "tundra"] as const;
const PATTERNS = ["constellation", "bands", "spots", "veins", "waves", "mosaic", "comet", "bloom"] as const;
const ABILITIES = ["Trail Sense", "Shelter Song", "Stone Guard", "Current Step", "Ember Lift", "Prism Glance", "Root Mend", "Wind Arc", "Moon Echo", "Tide Call", "Quiet Focus", "Dawn Leap"] as const;

/** Published parameters live beside the generator so editorial data cannot invent a second rule set. */
export const WILDS_V11_CREATURE_PUBLIC_PARAMETERS = Object.freeze([
  { name: "Lineage neighborhood", value: "8 × 8 regions", explanation: "Exact signed region groups; no fixed family catalog for new births." },
  { name: "Body grammar", value: `${BODIES.length} bodies · ${DETAILS.length} details · ${AURAS.length} auras`, explanation: "Authored anatomy families keep the individual readable in motion." },
  { name: "Body scale", value: "0.800–1.400", explanation: "601 possible steps at one thousandth resolution." },
  { name: "Surface", value: `${PATTERNS.length} patterns · 1–11 markings`, explanation: "Three color channels per palette swatch range from 50 to 177." },
  { name: "Temperament and habitat", value: `${TEMPERAMENTS.length} × ${HABITATS.length}`, explanation: "Behavioral preference and ecology are separate from rarity." },
  { name: "Voice", value: "160–639 Hz · 140–499 ms · 1,024 timbres", explanation: "A compact repeatable voice profile, shaped further by living state." },
  { name: "Abilities", value: `2 distinct from ${ABILITIES.length}`, explanation: "A stable starting pair; later progression remains its own history." },
  { name: "Base stats", value: "48–92 per attribute", explanation: "Health, power, guard, speed, and bond use the same range at every rarity." }
] as const);

function gene(seed: string, domain: string) {
  const digest = sha256PortableBasis(`${WILDS_CREATURE_GENERATOR_V11}\0${domain}\0${seed}`);
  return Number.parseInt(digest.slice(7, 15), 16);
}

function pick<T>(values: readonly T[], seed: string, domain: string): T {
  return values[gene(seed, domain) % values.length]!;
}

function floorRegionGroup(value: string): string {
  const region = BigInt(value);
  return (region >= 0n ? region / 8n : (region - 7n) / 8n).toString();
}

function color(seed: string, domain: string) {
  const part = gene(seed, domain);
  const channel = (shift: number) => 50 + ((part >>> shift) & 0x7f);
  return `#${[channel(0), channel(7), channel(14)].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

function spreadStat(seed: string, domain: string) {
  return 48 + gene(seed, domain) % 45;
}

/** A verified encounter is the caller's prerequisite; this projection is pure and bounded. */
export function generateCreatureBirthV11(encounter: WildsV11EncounterResult): WildsV11CreatureBirth {
  const expected = projectEncounterResultV11(encounter.input, encounter.signatureB64u);
  if (canonicalPortableCardJson(encounter) !== canonicalPortableCardJson(expected)) throw new Error("wilds_v11_creature_encounter_invalid");
  const site = parseWildsWorldAddress(encounter.input.site);
  const seed = encounter.creatureSeed;
  const bodyType = pick(BODIES, seed, "body");
  const gait: WildsV11CreatureBirth["body"]["gait"] = bodyType === "winged" ? "glide" : pick(GAITS.filter(item => item !== "glide"), seed, "gait");
  const firstAbility = gene(seed, "ability:0") % ABILITIES.length;
  const secondAbility = (firstAbility + 1 + gene(seed, "ability:1") % (ABILITIES.length - 1)) % ABILITIES.length;
  const familyX = floorRegionGroup(site.regionX);
  const familyZ = floorRegionGroup(site.regionZ);
  const regionFamily = `wildz.lineage.v11:${familyX.length}:${familyX}:${familyZ.length}:${familyZ}`;
  const birth = {
    generator: WILDS_CREATURE_GENERATOR_V11,
    identity: { actorId: encounter.input.actorId, site, slot: encounter.input.slot },
    lineage: {
      regionFamily,
      ancestrySeed: sha256PortableBasis(`${WILDS_CREATURE_GENERATOR_V11}\0ancestry\0${regionFamily}`)
    },
    rarity: encounter.className,
    body: {
      body: bodyType,
      detail: pick(DETAILS, seed, "detail"),
      aura: pick(AURAS, seed, "aura"),
      scale: 0.8 + (gene(seed, "scale") % 601) / 1_000,
      gait
    },
    surface: {
      pattern: pick(PATTERNS, seed, "pattern"),
      markingCount: 1 + gene(seed, "markings") % 11,
      primary: color(seed, "primary"),
      accent: color(seed, "accent"),
      glow: color(seed, "glow")
    },
    temperament: pick(TEMPERAMENTS, seed, "temperament"),
    habitat: pick(HABITATS, seed, "habitat"),
    voice: {
      fundamentalHz: 160 + gene(seed, "voice:pitch") % 480,
      pulseMs: 140 + gene(seed, "voice:pulse") % 360,
      timbre: gene(seed, "voice:timbre") % 1_024
    },
    abilities: [ABILITIES[firstAbility]!, ABILITIES[secondAbility]!] as const,
    stats: {
      health: spreadStat(seed, "stat:health"),
      power: spreadStat(seed, "stat:power"),
      guard: spreadStat(seed, "stat:guard"),
      speed: spreadStat(seed, "stat:speed"),
      bond: spreadStat(seed, "stat:bond")
    }
  };
  return { ...birth, generationDigest: sha256PortableBasis(canonicalPortableCardJson(birth)) };
}
