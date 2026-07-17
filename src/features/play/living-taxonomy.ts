import type { CreatureForm, CreatureRenderRecipe } from "./creature-catalog";
import type { KaiArkName, KaiKlokMoment } from "./kai-klok-moment";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type ColorTrait = { css: string; hue: number; chroma: number; lightness: number };

export type LivingCreatureIdentityV3 = {
  version: 3;
  encounterId: string;
  discoveredAt: string;
  discovery: { location: { x: number; z: number }; kaiPulse: number; ark: KaiArkName; geometry: string; ownerScope: string };
  family: { id: string; name: string; emotionalPromise: string; silhouette: string; locomotion: string; namingDialect: string };
  species: { id: string; name: string; branch: string; ecology: string; forms: readonly [string, string, string] };
  name: {
    prefix: string;
    suffix: string;
    display: string;
    collisionLane: number;
  } | {
    /** Compatibility shape for identities sealed before single-name discovery. */
    given: string;
    epithet: string;
    display: string;
    collisionLane: number;
  };
  anatomy: {
    body: CreatureRenderRecipe["body"];
    detail: CreatureRenderRecipe["detail"];
    surface: "fur" | "feather" | "scale" | "shell" | "energy";
    head: number;
    torso: number;
    limb: number;
    asymmetry: number;
  };
  palette: { primary: ColorTrait; secondary: ColorTrait; accent: ColorTrait; glow: ColorTrait; eye: ColorTrait };
  markings: { topology: string; placement: string; density: number; motif: string };
  personality: {
    temperament: string;
    contrast: string;
    favoriteActivity: string;
    comfortBehavior: string;
    curiosity: string;
    socialPreference: string;
    vulnerability: string;
  };
  motion: {
    idleHabit: string;
    bondingGesture: string;
    cadenceMs: number;
    discovery: string;
    danger: string;
    rest: string;
    victory: string;
    injury: string;
    reunion: string;
  };
  visualFingerprint: string;
  identityDigest: string;
};

export type LivingCreatureDiscoveryBasis = {
  encounterId: string;
  form: CreatureForm;
  discoveredAt: string;
  location: { x: number; z: number };
  ownerScope: string;
  moment: KaiKlokMoment;
};

type FamilyGrammar = {
  roots: readonly [string, string, string, string];
  promise: string;
  locomotion: string;
  dialect: string;
  activities: readonly string[];
  comforts: readonly string[];
  curiosities: readonly string[];
};

const GRAMMARS: Record<string, FamilyGrammar> = {
  Grove: { roots: ["Bri", "Fen", "Mos", "Ver"], promise: "protective nest-builder", locomotion: "rooted bound", dialect: "soft woodland", activities: ["moss weaving", "seed sorting", "shade finding"], comforts: ["curling beneath leaves", "sharing warm soil", "slow forehead touches"], curiosities: ["new seedlings", "birdsong", "shifting sunlight"] },
  Spark: { roots: ["Arc", "Lux", "Vol", "Zep"], promise: "fearless signal-chaser", locomotion: "quick aerial dart", dialect: "bright electric", activities: ["chasing reflections", "storm counting", "racing echoes"], comforts: ["resting near a heartbeat", "soft static hums", "wing folding"], curiosities: ["distant thunder", "metallic chimes", "moving lights"] },
  Tide: { roots: ["Cor", "Mar", "Ner", "Pel"], promise: "curious gift-carrier", locomotion: "flowing glide", dialect: "rounded coastal", activities: ["shell collecting", "current tracing", "gift carrying"], comforts: ["listening to water", "sleeping in a circle", "gentle shoulder nudges"], curiosities: ["hidden pools", "polished stones", "new voices"] },
  Ember: { roots: ["Ash", "Cin", "Pyr", "Sol"], promise: "brave warmth-keeper", locomotion: "springing prowl", dialect: "warm percussive", activities: ["coal watching", "trail warming", "shadow pouncing"], comforts: ["guarding a small flame", "leaning against trusted legs", "quiet crackling"], curiosities: ["cold places", "dancing sparks", "campfire stories"] },
  Prism: { roots: ["Iri", "Lum", "Opa", "Vio"], promise: "empathetic wonder-seeker", locomotion: "floating step", dialect: "luminous harmonic", activities: ["color chasing", "echo singing", "constellation watching"], comforts: ["matching another breath", "low harmonic tones", "halo dimming"], curiosities: ["new colors", "mirrors", "unfamiliar songs"] },
  Stone: { roots: ["Bas", "Gra", "Ony", "Tor"], promise: "steadfast shelter-maker", locomotion: "grounded stride", dialect: "deep mineral", activities: ["pebble stacking", "path guarding", "cave listening"], comforts: ["resting against stone", "slow back scratches", "watching doorways"], curiosities: ["ancient marks", "tiny creatures", "distant footsteps"] }
};

const CONSONANTS = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v"] as const;
const VOWELS = ["a", "e", "i", "o"] as const;
const NAME_CONSONANTS = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z"] as const;
const NAME_VOWELS = ["a", "e", "i", "o", "u", "y"] as const;
const NAME_PATTERNS = [
  ["v", "c", "v", "c", "v"],
  ["v", "c", "v", "v", "c"],
  ["v", "v", "c", "v", "c"]
] as const;
const TEMPERAMENTS = ["brave", "gentle", "curious", "patient", "playful", "watchful", "tender", "spirited"] as const;
const CONTRASTS = ["shy", "stubborn", "dreamy", "startled", "solemn", "mischievous", "cautious", "restless"] as const;
const SOCIAL = ["one trusted companion", "a lively small pack", "quiet parallel company", "young creatures", "patient explorers", "the edge of a gathering"] as const;
const VULNERABILITIES = ["sudden silence", "being left behind", "harsh bright noise", "deep unfamiliar water", "crowded spaces", "broken routines", "cold rain", "raised voices"] as const;
const TOPOLOGIES = ["bloom", "mask", "comet", "crown", "tide", "constellation", "ribbon", "ember"] as const;
const PLACEMENTS = ["forehead and chest", "cheeks and paws", "spine and tail", "wings and brow", "shoulders and flank", "eyes and crest"] as const;
const MOTIFS = ["vesica", "hexawave", "root spiral", "crown torus", "mirror arc", "star lattice"] as const;
const GESTURES = ["paw wave", "ear flick", "tail heart", "wing bow", "tiny hop", "proud nod"] as const;

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

function colorTrait(hue: number, chroma: number, lightness: number): ColorTrait {
  const normalizedHue = Math.round((hue % 360 + 360) % 360);
  const normalizedChroma = Math.round(chroma);
  const normalizedLightness = Math.round(lightness);
  return { css: `hsl(${normalizedHue} ${normalizedChroma}% ${normalizedLightness}%)`, hue: normalizedHue, chroma: normalizedChroma, lightness: normalizedLightness };
}

function surfaceFor(form: CreatureForm): LivingCreatureIdentityV3["anatomy"]["surface"] {
  if (form.anatomy.body === "winged") return "feather";
  if (form.anatomy.body === "armored") return "scale";
  if (form.anatomy.detail === "shell") return "shell";
  if (form.anatomy.aura === "prism") return "energy";
  return "fur";
}

function syllables(seed: string, offset: number, count: number) {
  let word = "";
  for (let index = 0; index < count; index += 1) {
    const value = Math.floor(unit(seed, offset + index * 7) * 64) % 64;
    word += CONSONANTS[value >> 2]! + VOWELS[value & 3]!;
  }
  return word;
}

function momentSuffix(seed: string) {
  const pattern = pick(NAME_PATTERNS, seed, 5);
  return pattern.map((kind, index) => pick(kind === "v" ? NAME_VOWELS : NAME_CONSONANTS, seed, 13 + index * 9)).join("");
}

function resolveName(seed: string, grammar: FamilyGrammar, occupiedNames: ReadonlySet<string>) {
  for (let collisionLane = 0; collisionLane < 64; collisionLane += 1) {
    const laneSeed = sha256PortableBasis(`${seed}:name:${collisionLane}`);
    const prefix = pick(grammar.roots, laneSeed, 1).slice(0, 2);
    const suffix = momentSuffix(laneSeed);
    const display = `${prefix}${suffix}`;
    if (!occupiedNames.has(display.toLowerCase())) return { prefix, suffix, display, collisionLane };
  }
  throw new Error("wilds_discovery_name_exhausted");
}

function familyGrammar(form: CreatureForm) {
  return GRAMMARS[form.element] ?? GRAMMARS.Prism!;
}

export function livingCreatureIdentityDigest(identity: LivingCreatureIdentityV3) {
  const { identityDigest: _identityDigest, ...basis } = identity;
  return sha256PortableBasis(canonicalPortableCardJson(basis));
}

export function discoverLivingCreature(basis: LivingCreatureDiscoveryBasis, occupiedNames: ReadonlySet<string> = new Set()): LivingCreatureIdentityV3 {
  if (!basis.encounterId.trim() || !basis.ownerScope.trim() || !Number.isFinite(Date.parse(basis.discoveredAt)) || new Date(Date.parse(basis.discoveredAt)).toISOString() !== basis.discoveredAt || !Number.isFinite(basis.location.x) || !Number.isFinite(basis.location.z)) {
    throw new Error("wilds_discovery_basis_invalid");
  }
  const seed = sha256PortableBasis(canonicalPortableCardJson({
    system: "receiz.wilds.living-taxonomy.v3",
    encounterId: basis.encounterId,
    formId: basis.form.id,
    discoveredAt: basis.discoveredAt,
    location: basis.location,
    ownerScope: basis.ownerScope,
    kai: { pulse: basis.moment.pulse, ark: basis.moment.ark, coordinate: basis.moment.coordinate }
  }));
  const grammar = familyGrammar(basis.form);
  const name = resolveName(seed, grammar, occupiedNames);
  const hue = (basis.moment.hue * 0.54 + basis.form.positionSeed * 0.17 + unit(seed, 2) * 96) % 360;
  const primary = colorTrait(hue, 62 + unit(seed, 12) * 22, 38 + unit(seed, 20) * 24);
  const secondary = colorTrait(hue + 22 + unit(seed, 28) * 54, 54 + unit(seed, 36) * 30, 34 + unit(seed, 44) * 28);
  const accent = colorTrait(hue + 118 + unit(seed, 16) * 74, 64 + unit(seed, 24) * 24, 52 + unit(seed, 32) * 14);
  const glow = colorTrait(hue + 176 + unit(seed, 40) * 46, 72 + unit(seed, 48) * 20, 58 + unit(seed, 56) * 10);
  const eye = colorTrait(hue + 205 + unit(seed, 7) * 36, 58 + unit(seed, 15) * 24, 28 + unit(seed, 21) * 24);
  const speciesToken = seed.slice(7, 19);
  const branch = `${basis.form.anatomy.body}-${basis.form.anatomy.detail}-${surfaceFor(basis.form)}`;
  const speciesRoot = `${pick(grammar.roots, seed, 9)}${syllables(seed, 13, 2)}`;
  const temperament = pick(TEMPERAMENTS, seed, 17);
  const contrast = pick(CONTRASTS, seed, 25);
  const provisional: LivingCreatureIdentityV3 = {
    version: 3,
    encounterId: basis.encounterId,
    discoveredAt: basis.discoveredAt,
    discovery: { location: { ...basis.location }, kaiPulse: basis.moment.pulse, ark: basis.moment.ark, geometry: basis.moment.gate, ownerScope: basis.ownerScope },
    family: { id: basis.form.familyId, name: basis.form.familyId, emotionalPromise: grammar.promise, silhouette: basis.form.anatomy.body, locomotion: grammar.locomotion, namingDialect: grammar.dialect },
    species: { id: `species:${basis.form.familyId}:${speciesToken}`, name: speciesRoot, branch, ecology: `${basis.form.habitat} ${grammar.promise}`, forms: [`${speciesRoot}ling`, `${speciesRoot}kin`, `${speciesRoot}crown`] },
    name,
    anatomy: { body: basis.form.anatomy.body, detail: basis.form.anatomy.detail, surface: surfaceFor(basis.form), head: bounded(seed, 3, 0.78, 1.22), torso: bounded(seed, 11, 0.76, 1.25), limb: bounded(seed, 19, 0.74, 1.28), asymmetry: bounded(seed, 27, 0.02, 0.34) },
    palette: { primary, secondary, accent, glow, eye },
    markings: { topology: pick(TOPOLOGIES, seed, 31), placement: pick(PLACEMENTS, seed, 39), density: bounded(seed, 47, 0.2, 0.86), motif: pick(MOTIFS, seed, 55) },
    personality: { temperament, contrast, favoriteActivity: pick(grammar.activities, seed, 6), comfortBehavior: pick(grammar.comforts, seed, 14), curiosity: pick(grammar.curiosities, seed, 22), socialPreference: pick(SOCIAL, seed, 30), vulnerability: pick(VULNERABILITIES, seed, 38) },
    motion: { idleHabit: `${temperament} ${pick(["breathing", "listening", "swaying", "watching"], seed, 46)}`, bondingGesture: pick(GESTURES, seed, 54), cadenceMs: Math.round(bounded(seed, 10, 1_750, 4_500, 0)), discovery: "cautious approach", danger: "protective brace", rest: "settled curl", victory: "bright celebration", injury: "guarded retreat", reunion: "recognition rush" },
    visualFingerprint: seed.slice(7, 31),
    identityDigest: ""
  };
  provisional.identityDigest = livingCreatureIdentityDigest(provisional);
  const validation = validateLivingCreatureIdentity(provisional);
  if (!validation.ok) throw new Error(`wilds_discovery_identity_invalid:${validation.errors.join(",")}`);
  return provisional;
}

export function validateLivingCreatureIdentity(identity: LivingCreatureIdentityV3) {
  const errors: string[] = [];
  if (identity.version !== 3 || !identity.encounterId.trim()) errors.push("identity_header_invalid");
  if (!Number.isFinite(Date.parse(identity.discoveredAt)) || new Date(Date.parse(identity.discoveredAt)).toISOString() !== identity.discoveredAt) errors.push("discovery_time_invalid");
  const currentNameValid = "prefix" in identity.name
    && identity.name.display === `${identity.name.prefix}${identity.name.suffix}`
    && /^[A-Z][a-z]{1,6}$/.test(identity.name.display)
    && ((/^[A-Z][a-z]$/.test(identity.name.prefix) && /^[a-z]{5}$/.test(identity.name.suffix))
      || (/^[A-Z][a-z]{2}$/.test(identity.name.prefix) && /^[a-z]{2,4}$/.test(identity.name.suffix)));
  const legacyNameValid = "given" in identity.name
    && identity.name.display === `${identity.name.given} ${identity.name.epithet}`
    && /^[A-Z][a-z]{2,7}$/.test(identity.name.given)
    && /^[A-Z][a-z]{2,7}$/.test(identity.name.epithet);
  if (!currentNameValid && !legacyNameValid) errors.push("name_invalid");
  if (!Number.isInteger(identity.name.collisionLane) || identity.name.collisionLane < 0 || identity.name.collisionLane > 63) errors.push("name_lane_invalid");
  if (identity.palette.primary.chroma < 48 || identity.palette.primary.lightness > 68 || identity.palette.primary.lightness < 28) errors.push("palette_primary_invalid");
  if (Object.values(identity.palette).some((color) => !/^hsl\(\d+ \d+% \d+%\)$/.test(color.css))) errors.push("palette_css_invalid");
  if (Object.values(identity.personality).some((value) => !value.trim()) || identity.personality.temperament === identity.personality.contrast) errors.push("personality_invalid");
  if (identity.motion.cadenceMs < 1_750 || identity.motion.cadenceMs > 4_500 || Object.entries(identity.motion).some(([key, value]) => key !== "cadenceMs" && typeof value === "string" && !value.trim())) errors.push("motion_invalid");
  if (!/^sha256:[a-f0-9]{64}$/.test(identity.identityDigest) || identity.identityDigest !== livingCreatureIdentityDigest(identity)) errors.push("identity_digest_invalid");
  return { ok: errors.length === 0, errors };
}
