import { creatureForm } from "./creature-catalog";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { CardVariantTraits } from "./card-variant";
import type { GenomeTraitKey, GrowthPath, LivingCardGenome, TraitSource } from "./living-card-types";
import { deriveHeartboundIdentity, identityForGenome, sealHeartboundIdentity, validateHeartboundIdentity } from "./heartbound-identity";
import { deriveHeartboundPresentation, validateHeartboundPresentation } from "./heartbound-anime-genome";

const sources = (source: TraitSource): Record<GenomeTraitKey, TraitSource> => ({
  skeleton: source, face: source, appendages: source, surface: source,
  palette: source, behavior: source, aura: source, stance: source
});

function unit(seed: string, offset: number) {
  const hex = seed.replace("sha256:", "");
  return Number.parseInt(hex.slice(offset % 48, offset % 48 + 8), 16) / 0xffffffff;
}

function choice<T>(seed: string, offset: number, values: readonly T[]) {
  return values[Math.floor(unit(seed, offset) * values.length) % values.length]!;
}

function bounded(value: number, min = 0.65, max = 1.45) {
  return Number(Math.max(min, Math.min(max, value)).toFixed(3));
}

export function deriveBirthGenome(input: { formId: string; proofDigest: string; variant: CardVariantTraits }, options: { generatorVersion?: 1 | 2 | 3 } = {}): LivingCardGenome {
  const form = creatureForm(input.formId);
  if (!form || !/^sha256:[a-f0-9]{64}$/.test(input.proofDigest)) throw new Error("wilds_genome_birth_invalid");
  const seed = sha256PortableBasis(canonicalPortableCardJson({ generator: "heartbound.v1", ...input }));
  const locomotion = form.anatomy.body === "serpentine" ? "serpentine" : form.anatomy.body === "winged" ? "flying" : form.anatomy.body === "long" ? "quadruped" : "biped";
  const identityAnchor = sha256PortableBasis(`${input.proofDigest}:heartbound-face`).slice(7, 31);
  const detail = form.anatomy.detail;
  const generatorVersion = options.generatorVersion ?? 3;
  const identity = generatorVersion >= 2 ? deriveHeartboundIdentity(input.proofDigest, { familyId: form.familyId, locomotion, signatureDetail: detail }) : undefined;
  const genome: LivingCardGenome = {
    generatorVersion,
    ...(identity ? { identity } : {}),
    identityAnchor,
    skeleton: { locomotion, head: bounded(0.92 + unit(seed, 2) * 0.28), torso: bounded(0.84 + unit(seed, 10) * 0.34), limb: bounded(0.82 + unit(seed, 18) * 0.38) },
    face: {
      identityAnchor,
      eye: choice(seed, 7, ["round", "almond", "star", "crescent"] as const),
      mouth: form.anatomy.body === "winged" ? "beak" : choice(seed, 15, ["smile", "muzzle", "fang"] as const),
      expressionSet: choice(seed, 23, ["gentle", "brave", "curious", "mischievous"] as const)
    },
    appendages: {
      ears: detail === "ears" ? `heart-ear-${choice(seed, 3, [1, 2, 3])}` : "none",
      horns: detail === "horns" ? `hero-horn-${choice(seed, 5, [1, 2, 3])}` : "none",
      wings: detail === "wings" || form.anatomy.body === "winged" ? `pulse-wing-${choice(seed, 9, [1, 2, 3])}` : "none",
      tail: detail === "tail" || locomotion === "quadruped" ? `emotion-tail-${choice(seed, 13, [1, 2, 3])}` : "none",
      crest: detail === "crest" ? `bond-crest-${choice(seed, 17, [1, 2, 3])}` : "none"
    },
    surface: { kind: form.anatomy.body === "armored" ? "shell" : form.anatomy.body === "winged" ? "feather" : "fur", pattern: `mark-${seed.slice(-6)}` },
    palette: { primary: input.variant.palette.primary, secondary: input.variant.palette.glow, accent: input.variant.palette.accent, glow: input.variant.palette.glow },
    behavior: { temperament: form.temperament, idleCadenceMs: input.variant.animationMs, signatureGesture: `gesture-${seed.slice(7, 11)}`, battleStance: locomotion === "quadruped" ? "pounce" : "heroic" },
    auraProfile: { kind: form.anatomy.aura, intensity: input.variant.auraIntensity, particle: `pulse-${seed.slice(11, 15)}` },
    anatomy: { ...form.anatomy },
    variant: { ...input.variant, palette: { ...input.variant.palette } },
    provenance: sources("birth")
  };
  if (generatorVersion === 3) genome.presentation = deriveHeartboundPresentation({ genome, stage: form.stage, ascensionRank: 0, proofDigest: input.proofDigest });
  return genome;
}

export function genomeDigest(genome: LivingCardGenome) {
  return sha256PortableBasis(canonicalPortableCardJson(genome));
}

export function validateGenome(genome: LivingCardGenome) {
  const errors: string[] = [];
  if (![1, 2, 3].includes(genome.generatorVersion) || genome.face.identityAnchor !== genome.identityAnchor) errors.push("identity_invalid");
  if (genome.generatorVersion >= 2 && (!genome.identity || !validateHeartboundIdentity(genome.identity).ok)) errors.push("advanced_identity_invalid");
  if (genome.generatorVersion === 1 && genome.identity) errors.push("legacy_identity_invalid");
  if (genome.generatorVersion === 3 && (!genome.presentation || !validateHeartboundPresentation(genome.presentation).ok)) errors.push("presentation_invalid");
  if (genome.generatorVersion < 3 && genome.presentation) errors.push("unexpected_presentation");
  for (const value of [genome.skeleton.head, genome.skeleton.torso, genome.skeleton.limb]) if (!Number.isFinite(value) || value < 0.65 || value > 1.45) errors.push("proportion_invalid");
  if (!genome.palette.primary || !genome.palette.accent || !genome.behavior.signatureGesture) errors.push("render_trait_missing");
  if (Object.keys(genome.provenance).length !== 8) errors.push("provenance_invalid");
  return { ok: errors.length === 0, errors };
}

export function deriveAscensionGenome(input: { previous: LivingCardGenome; rank: number; achievementId: string; questId: string; kaiPulse: string; path: GrowthPath }) {
  if (!validateGenome(input.previous).ok || !Number.isSafeInteger(input.rank) || input.rank < 1) throw new Error("wilds_ascension_genome_invalid");
  const seed = sha256PortableBasis(canonicalPortableCardJson({ prior: genomeDigest(input.previous), ...input, previous: undefined }));
  const battle = input.path === "battle";
  const ascended: LivingCardGenome = {
    ...input.previous,
    skeleton: {
      ...input.previous.skeleton,
      torso: bounded(input.previous.skeleton.torso + (battle ? 0.025 : 0.012)),
      limb: bounded(input.previous.skeleton.limb + (battle ? 0.018 : 0.008))
    },
    behavior: { ...input.previous.behavior, battleStance: battle ? `ascendant-${seed.slice(7, 11)}` : input.previous.behavior.battleStance },
    auraProfile: { ...input.previous.auraProfile, intensity: bounded(input.previous.auraProfile.intensity + 0.02, 0.2, 1.45) },
    surface: { ...input.previous.surface, pattern: `${input.previous.surface.pattern}-a${input.rank}` },
    provenance: { ...input.previous.provenance, skeleton: "ascension", stance: "ascension", aura: "ascension", surface: "ascension" }
  };
  if (ascended.generatorVersion === 3) ascended.presentation = deriveHeartboundPresentation({ genome: ascended, stage: 3, ascensionRank: input.rank });
  return ascended;
}

function mixColor(a: string, b: string, seed: string) {
  return `color-mix(in oklch, ${a} ${45 + Math.round(unit(seed, 4) * 10)}%, ${b})`;
}

export function deriveFusionGenome(input: { parentA: LivingCardGenome; parentB: LivingCardGenome; emphasis: "balanced" | "parent_a" | "parent_b"; kaiPulse: string; mutationNonce: string }) {
  if (!validateGenome(input.parentA).ok || !validateGenome(input.parentB).ok) throw new Error("wilds_fusion_genome_invalid");
  const seed = sha256PortableBasis(canonicalPortableCardJson({ a: genomeDigest(input.parentA), b: genomeDigest(input.parentB), emphasis: input.emphasis, kaiPulse: input.kaiPulse, mutationNonce: input.mutationNonce }));
  const identityAnchor = sha256PortableBasis(`${seed}:child-face`).slice(7, 31);
  const identityA = identityForGenome(input.parentA, genomeDigest(input.parentA));
  const identityB = identityForGenome(input.parentB, genomeDigest(input.parentB));
  const baseIdentity = deriveHeartboundIdentity(seed, {
    familyId: `fusion:${identityA.family.familyId}+${identityB.family.familyId}`,
    locomotion: input.emphasis === "parent_b" ? identityB.family.locomotion : identityA.family.locomotion,
    signatureDetail: `${identityA.family.signatureDetail}+${identityB.family.signatureDetail}`
  });
  const childIdentity = sealHeartboundIdentity({
    ...baseIdentity,
    faceGeometry: { ...identityB.faceGeometry },
    body: { ...identityA.body },
    appendageMorphs: { ...identityB.appendageMorphs },
    markings: {
      ...baseIdentity.markings,
      topology: identityA.markings.topology,
      placements: Array.from(new Set([...identityA.markings.placements, ...identityB.markings.placements]))
    },
    behavior: {
      ...baseIdentity.behavior,
      posture: identityA.behavior.posture,
      gesture: identityA.behavior.gesture,
      celebration: identityB.behavior.celebration
    }
  });
  const child: LivingCardGenome = {
    ...input.parentA,
    generatorVersion: 3,
    identity: childIdentity,
    identityAnchor,
    skeleton: { ...input.parentA.skeleton },
    face: { ...input.parentB.face, identityAnchor, expressionSet: choice(seed, 8, [input.parentA.face.expressionSet, input.parentB.face.expressionSet]) },
    appendages: { ...input.parentB.appendages },
    surface: { ...input.parentA.surface, pattern: `${input.parentA.surface.pattern}+${input.parentB.surface.pattern}` },
    palette: {
      primary: mixColor(input.parentA.palette.primary, input.parentB.palette.primary, seed),
      secondary: mixColor(input.parentB.palette.secondary, input.parentA.palette.secondary, seed),
      accent: mixColor(input.parentA.palette.accent, input.parentB.palette.accent, seed),
      glow: mixColor(input.parentB.palette.glow, input.parentA.palette.glow, seed)
    },
    behavior: { ...input.parentA.behavior, signatureGesture: input.parentB.behavior.signatureGesture },
    auraProfile: { ...input.parentB.auraProfile, particle: `child-${seed.slice(7, 13)}` },
    provenance: { skeleton: "parent_a", face: "parent_b", appendages: "parent_b", surface: "blended", palette: "blended", behavior: "parent_a", aura: "parent_b", stance: "parent_a" },
    presentation: undefined
  };
  child.presentation = deriveHeartboundPresentation({ genome: child, stage: 1, ascensionRank: 0, proofDigest: seed });
  return child;
}

export function mergeLivingGenome(previous: LivingCardGenome, delta: Partial<LivingCardGenome>): LivingCardGenome {
  return {
    ...previous,
    ...delta,
    presentation: delta.presentation ?? previous.presentation,
    skeleton: { ...previous.skeleton, ...(delta.skeleton ?? {}) },
    face: { ...previous.face, ...(delta.face ?? {}) },
    appendages: { ...previous.appendages, ...(delta.appendages ?? {}) },
    surface: { ...previous.surface, ...(delta.surface ?? {}) },
    palette: { ...previous.palette, ...(delta.palette ?? {}) },
    behavior: { ...previous.behavior, ...(delta.behavior ?? {}) },
    auraProfile: { ...previous.auraProfile, ...(delta.auraProfile ?? {}) },
    anatomy: { ...previous.anatomy, ...(delta.anatomy ?? {}) },
    variant: { ...previous.variant, ...(delta.variant ?? {}), palette: { ...previous.variant.palette, ...(delta.variant?.palette ?? {}) } },
    provenance: { ...previous.provenance, ...(delta.provenance ?? {}) }
  };
}
