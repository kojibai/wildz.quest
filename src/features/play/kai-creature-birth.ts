import type { CreatureForm, CreatureStats } from "./creature-catalog";
import type { KaiArkName, KaiKlokMoment } from "./kai-klok-moment";
import { deriveKaiMomentExpression } from "./kai-klok-teachings";

const STAT_KEYS = ["health", "power", "guard", "speed", "bond"] as const satisfies readonly (keyof CreatureStats)[];
const ARK_TRAITS: Record<KaiArkName, readonly [string, string, string, string]> = {
  Ignite: ["courageous", "grounded", "initiating", "protective"],
  Integrate: ["empathetic", "adaptive", "creative", "connecting"],
  Harmonize: ["resonant", "compassionate", "expressive", "unifying"],
  Reflekt: ["observant", "patient", "insightful", "precise"],
  Purify: ["truthful", "resilient", "transformative", "sovereign"],
  Dream: ["imaginative", "intuitive", "remembering", "mysterious"]
};
const ARK_NAMES: Record<KaiArkName, readonly string[]> = {
  Ignite: ["Emberroot", "Dawnward", "Firstflame"],
  Integrate: ["Flowheart", "Twinweave", "Riverbond"],
  Harmonize: ["Songbloom", "Kindredwave", "Heartvoice"],
  Reflekt: ["Mirrorgaze", "Stillspiral", "Crystalecho"],
  Purify: ["Truthcrown", "Brighttorus", "Shimmerwill"],
  Dream: ["Starremember", "Moonmerkaba", "Opaldream"]
};
const TOPOLOGIES = ["bloom", "mask", "comet", "crown", "tide", "constellation", "ribbon", "ember"] as const;
const MOTIFS = ["square-root", "vesica", "radiant-triangle", "hexawave", "mirror-spiral", "crown-torus", "merkaba"] as const;
const GESTURES = ["paw-wave", "ear-flick", "tail-heart", "wing-bow", "tiny-hop", "proud-nod"] as const;
const POSTURES = ["gentle", "alert", "heroic", "playful", "watchful"] as const;
const BUILDS = ["compact", "plush", "athletic", "long", "guardian", "armored", "winged", "serpentine"] as const;

export type KaiCreatureBirthProfile = {
  version: 1;
  pulse: number;
  cadueusKai: string;
  chakra: KaiKlokMoment["chakra"];
  ark: KaiArkName;
  harmonic: { day: string; week: string; month: string };
  geometry: { day: string; week: string; month: string; ark: string; sides: number };
  emotionalSignals: readonly [string, string, string];
  characterTraits: readonly [string, string, string, string];
  palette: { primary: string; accent: string; glow: string };
  morphology: {
    build: typeof BUILDS[number];
    head: number;
    torso: number;
    limb: number;
    appendage: string;
    symmetry: number;
    signature: string;
  };
  markings: { topology: typeof TOPOLOGIES[number]; density: number; motif: string };
  motion: { cadenceMs: number; gesture: typeof GESTURES[number]; posture: typeof POSTURES[number] };
  affinities: readonly string[];
  statShift: CreatureStats;
  adjustedStats: CreatureStats;
  fingerprint: string;
  name: { given: string; epithet: string; display: string };
  lineage?: { parentIds: readonly [string, string]; inheritedSignals: readonly string[] };
};

function unit(seed: string, offset: number) {
  const hex = seed.replace(/^sha256:/, "");
  const start = Math.abs(offset) % Math.max(1, hex.length - 8);
  return Number.parseInt(hex.slice(start, start + 8).padEnd(8, "0"), 16) / 0xffffffff;
}

function pick<T>(values: readonly T[], seed: string, offset: number) {
  return values[Math.min(values.length - 1, Math.floor(unit(seed, offset) * values.length))]!;
}

function bounded(seed: string, offset: number, min: number, max: number, precision = 3) {
  return Number((min + unit(seed, offset) * (max - min)).toFixed(precision));
}

function deriveStats(form: CreatureForm, seed: string, arkIndex: number) {
  const favoredIndex = (Math.floor(unit(seed, 20) * STAT_KEYS.length) + arkIndex) % STAT_KEYS.length;
  let donorIndex = (Math.floor(unit(seed, 36) * (STAT_KEYS.length - 1)) + favoredIndex + 1) % STAT_KEYS.length;
  if (donorIndex === favoredIndex) donorIndex = (donorIndex + 1) % STAT_KEYS.length;
  const amount = form.stats[STAT_KEYS[donorIndex]!] > 2 ? 2 : 1;
  const statShift: CreatureStats = { health: 0, power: 0, guard: 0, speed: 0, bond: 0 };
  statShift[STAT_KEYS[favoredIndex]!] += amount;
  statShift[STAT_KEYS[donorIndex]!] -= amount;
  const adjustedStats = Object.fromEntries(STAT_KEYS.map((key) => [key, form.stats[key] + statShift[key]])) as CreatureStats;
  return { statShift, adjustedStats };
}

function canonicalLineage(lineage: { parentIds: readonly [string, string]; inheritedSignals: readonly string[] } | undefined) {
  if (!lineage) return undefined;
  const parentIds = [...lineage.parentIds].sort() as [string, string];
  const inheritedSignals = [...new Set(lineage.inheritedSignals)].sort();
  return { parentIds, inheritedSignals } as const;
}

export function deriveKaiCreatureBirth(input: {
  form: CreatureForm;
  moment: KaiKlokMoment;
  seed: string;
  lineage?: { parentIds: readonly [string, string]; inheritedSignals: readonly string[] };
}): KaiCreatureBirthProfile {
  if (!/^sha256:[a-f0-9]{64}$/.test(input.seed)) throw new Error("wilds_kai_birth_seed_invalid");
  const expression = deriveKaiMomentExpression(input.moment);
  const lineage = canonicalLineage(input.lineage);
  const traits = ARK_TRAITS[input.moment.ark];
  const arkNames = ARK_NAMES[input.moment.ark];
  const epithet = arkNames[(input.moment.sides + Math.floor(unit(input.seed, 8) * arkNames.length)) % arkNames.length]!;
  const given = input.form.name.replace(/[^a-z0-9]/gi, "");
  const hue = Math.round((input.moment.hue * 0.62 + input.form.positionSeed * 0.19 + unit(input.seed, 2) * 72) % 360);
  const accentHue = Math.round((hue + 35 + input.moment.sides * 7) % 360);
  const glowHue = Math.round((input.moment.hue + 180 + unit(input.seed, 12) * 45) % 360);
  const { statShift, adjustedStats } = deriveStats(input.form, input.seed, input.moment.arkIndex);
  const fingerprint = `${input.seed.slice(7, 19)}-${input.moment.arkIndex}${input.moment.sides}-${Math.floor(input.moment.arkProgress * 1_000)}`;
  const inherited = lineage?.inheritedSignals ?? [];
  return {
    version: 1,
    pulse: input.moment.pulse,
    cadueusKai: input.moment.coordinate,
    chakra: input.moment.chakra,
    ark: input.moment.ark,
    harmonic: { day: expression.day.id, week: expression.week.id, month: expression.month.id },
    geometry: {
      day: expression.day.geometry,
      week: expression.week.geometry,
      month: expression.month.geometry,
      ark: expression.ark.geometry,
      sides: input.moment.sides
    },
    emotionalSignals: [expression.day.id, expression.month.id, expression.ark.id],
    characterTraits: [traits[0], traits[1], inherited[0] ?? traits[2], inherited[1] ?? traits[3]],
    palette: {
      primary: `hsl(${hue} 72% ${Math.round(bounded(input.seed, 4, 43, 57, 0))}%)`,
      accent: `hsl(${accentHue} 84% ${Math.round(bounded(input.seed, 10, 58, 72, 0))}%)`,
      glow: `hsl(${glowHue} 90% ${Math.round(bounded(input.seed, 18, 64, 78, 0))}%)`
    },
    morphology: {
      build: pick(BUILDS, input.seed, 22 + input.moment.sides),
      head: bounded(input.seed, 3 + input.moment.arkIndex, 0.78, 1.22),
      torso: bounded(input.seed, 13 + input.moment.sides, 0.76, 1.25),
      limb: bounded(input.seed, 27 + input.moment.arkIndex, 0.74, 1.28),
      appendage: `${input.form.anatomy.detail}-${input.moment.sides}-${pick(MOTIFS, input.seed, 31)}`,
      symmetry: bounded(input.seed, 41, 0.04, 0.38),
      signature: fingerprint
    },
    markings: {
      topology: pick(TOPOLOGIES, input.seed, 5 + input.moment.arkIndex * 3),
      density: bounded(input.seed, 17 + input.moment.sides, 0.2, 0.86),
      motif: `${pick(MOTIFS, input.seed, 29)}:${input.moment.sides}`
    },
    motion: {
      cadenceMs: Math.round(bounded(input.seed, 33, 1_750, 4_500, 0)),
      gesture: pick(GESTURES, input.seed, 39 + input.moment.arkIndex),
      posture: pick(POSTURES, input.seed, 45 + input.moment.sides)
    },
    affinities: [input.form.habitat, input.form.element, input.moment.ark, input.moment.chakra],
    statShift,
    adjustedStats,
    fingerprint,
    name: { given, epithet, display: `${given} ${epithet}` },
    ...(lineage ? { lineage } : {})
  };
}
