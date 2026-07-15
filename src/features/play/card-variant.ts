import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type CardVariantBasis = {
  formId: string;
  encounterId: string;
  ownerReceizId: string;
  capturedAt: string;
  kaiPulse: string;
  battleTranscriptDigest: string;
};

export type CardVariantTraits = {
  bodyScale: number;
  auraIntensity: number;
  animationMs: number;
  potential: number;
  statBias: number;
  abilityModifier: number;
  palette: { primary: string; accent: string; glow: string };
  visualFingerprint: string;
};

function unit(seed: string, offset: number) {
  const hex = seed.replace(/^sha256:/, "");
  const start = offset % (hex.length - 8);
  return Number.parseInt(hex.slice(start, start + 8), 16) / 0xffffffff;
}

function ranged(seed: string, offset: number, min: number, max: number, precision = 0) {
  const value = min + unit(seed, offset) * (max - min);
  return precision ? Number(value.toFixed(precision)) : Math.round(value);
}

export function variantSeedFor(basis: CardVariantBasis) {
  return sha256PortableBasis(canonicalPortableCardJson({ generator: "receiz.wilds.variant.v1", ...basis }));
}

export function deriveCardVariant(seed: string, generatorVersion: 1): CardVariantTraits {
  if (generatorVersion !== 1 || !/^sha256:[a-f0-9]{64}$/.test(seed)) throw new Error("wilds_variant_seed_invalid");
  const hue = ranged(seed, 0, 0, 359);
  const accentHue = (hue + ranged(seed, 8, 38, 168)) % 360;
  const glowHue = (hue + ranged(seed, 16, 170, 250)) % 360;
  return {
    bodyScale: ranged(seed, 4, 0.88, 1.12, 3),
    auraIntensity: ranged(seed, 12, 0.35, 1, 3),
    animationMs: ranged(seed, 20, 1_800, 4_600),
    potential: ranged(seed, 28, 1, 100),
    statBias: ranged(seed, 36, -6, 6),
    abilityModifier: ranged(seed, 44, -4, 8),
    palette: {
      primary: `hsl(${hue} 74% ${ranged(seed, 24, 42, 58)}%)`,
      accent: `hsl(${accentHue} 82% ${ranged(seed, 32, 58, 72)}%)`,
      glow: `hsl(${glowHue} 88% ${ranged(seed, 40, 60, 76)}%)`
    },
    visualFingerprint: seed.replace(/^sha256:/, "").slice(48, 64)
  };
}

export function displayCreatureName(formId: string, catalogName: string) {
  return formId === "mintcub-1" ? "SealCub" : catalogName;
}
