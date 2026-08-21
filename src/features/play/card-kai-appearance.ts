import { creatureForm } from "./creature-catalog";
import type { CardVariantTraits } from "./card-variant";
import { deriveKaiCreatureBirth, type KaiCreatureBirthProfile } from "./kai-creature-birth";
import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { projectCardCreatureVisualIdentity, type CreatureVisualAppendages } from "./creature-visual-identity";
import type { PortableCardAsset } from "./portable-card";
import type { LivingCreatureIdentityV3 } from "./living-taxonomy";

export type CardKaiAppearance = {
  source: "sealed" | "recovered";
  historicalPulse: string;
  profile: KaiCreatureBirthProfile;
  /** The creature-art palette, deliberately independent from the card frame. */
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  };
  morphology: { head: number; torso: number; limb: number; symmetry: number };
  anatomy: {
    body: "round" | "long" | "winged" | "serpentine" | "armored";
    detail: string;
    locomotion: "biped" | "quadruped" | "flying" | "serpentine";
    surface: string;
    appendages: CreatureVisualAppendages;
  };
  cadenceMs: number;
  fingerprint: string;
  discoveryIdentity?: LivingCreatureIdentityV3;
};

const MODERN_HSL = /^hsl\(\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)$/i;

/** Preserve the sealed hue while adapting CSS Color 4 HSL for Three.js. */
export function threeCreatureColor(value: string) {
  const match = value.match(MODERN_HSL);
  return match ? `hsl(${match[1]}, ${match[2]}%, ${match[3]}%)` : value;
}

export function projectCardKaiAppearance(asset: PortableCardAsset): CardKaiAppearance {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_kai_appearance_form_unknown");

  const variant = asset.manifest.variant;
  const visual = projectCardCreatureVisualIdentity(asset);
  const palette = visual.palette;
  const profilePalette: CardVariantTraits["palette"] = {
    primary: palette.primary,
    accent: palette.accent,
    glow: palette.glow
  };
  const anatomy: CardKaiAppearance["anatomy"] = { ...visual.anatomy, appendages: visual.appendages };

  if (variant.generatorVersion === 3) {
    const identity = variant.traits.identity;
    const moment = deriveKaiKlokMoment({ occurredAt: identity.discoveredAt, authority: "world" });
    const recovered = deriveKaiCreatureBirth({ form, moment, seed: variant.seed });
    return {
      source: "sealed",
      historicalPulse: variant.kaiPulse,
      profile: { ...recovered, palette: profilePalette },
      palette,
      anatomy,
      morphology: visual.morphology,
      cadenceMs: visual.cadenceMs,
      fingerprint: visual.fingerprint,
      discoveryIdentity: identity
    };
  }

  if (variant.generatorVersion === 2) {
    return {
      source: "sealed",
      historicalPulse: variant.kaiPulse,
      profile: variant.traits.birthProfile,
      palette,
      anatomy,
      morphology: visual.morphology,
      cadenceMs: visual.cadenceMs,
      fingerprint: visual.fingerprint
    };
  }

  const moment = deriveKaiKlokMoment({ occurredAt: asset.manifest.capturedAt, authority: "admitted" });
  const recovered = deriveKaiCreatureBirth({ form, moment, seed: variant.seed });
  return {
    source: "recovered",
    historicalPulse: variant.kaiPulse,
    profile: { ...recovered, palette: profilePalette },
    palette,
    anatomy,
    morphology: visual.morphology,
    cadenceMs: visual.cadenceMs,
    fingerprint: visual.fingerprint
  };
}
