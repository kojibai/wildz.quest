import { creatureForm } from "./creature-catalog";
import type { CardVariantTraits } from "./card-variant";
import { deriveKaiCreatureBirth, type KaiCreatureBirthProfile } from "./kai-creature-birth";
import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";
import type { LivingCreatureIdentityV3 } from "./living-taxonomy";

export type CardKaiAppearance = {
  source: "sealed" | "recovered";
  historicalPulse: string;
  profile: KaiCreatureBirthProfile;
  palette: CardVariantTraits["palette"];
  morphology: { head: number; torso: number; limb: number; symmetry: number };
  cadenceMs: number;
  fingerprint: string;
  discoveryIdentity?: LivingCreatureIdentityV3;
};

export function projectCardKaiAppearance(asset: PortableCardAsset): CardKaiAppearance {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_kai_appearance_form_unknown");

  const variant = asset.manifest.variant;
  const livingPalette = isLivingCardAsset(asset) ? currentLivingGenome(asset).palette : null;
  const palette = {
    primary: livingPalette?.primary ?? variant.traits.palette.primary,
    accent: livingPalette?.accent ?? variant.traits.palette.accent,
    glow: livingPalette?.glow ?? variant.traits.palette.glow
  };

  if (variant.generatorVersion === 3) {
    const identity = variant.traits.identity;
    const moment = deriveKaiKlokMoment({ occurredAt: identity.discoveredAt, authority: "world" });
    const recovered = deriveKaiCreatureBirth({ form, moment, seed: variant.seed });
    return {
      source: "sealed",
      historicalPulse: variant.kaiPulse,
      profile: { ...recovered, palette: { ...palette } },
      palette,
      morphology: {
        head: identity.anatomy.head,
        torso: identity.anatomy.torso,
        limb: identity.anatomy.limb,
        symmetry: identity.anatomy.asymmetry
      },
      cadenceMs: identity.motion.cadenceMs,
      fingerprint: identity.visualFingerprint,
      discoveryIdentity: identity
    };
  }

  if (variant.generatorVersion === 2) {
    return {
      source: "sealed",
      historicalPulse: variant.kaiPulse,
      profile: variant.traits.birthProfile,
      palette,
      morphology: variant.traits.birthProfile.morphology,
      cadenceMs: variant.traits.birthProfile.motion.cadenceMs,
      fingerprint: variant.traits.birthProfile.fingerprint
    };
  }

  const moment = deriveKaiKlokMoment({ occurredAt: asset.manifest.capturedAt, authority: "admitted" });
  const recovered = deriveKaiCreatureBirth({ form, moment, seed: variant.seed });
  return {
    source: "recovered",
    historicalPulse: variant.kaiPulse,
    profile: { ...recovered, palette: { ...palette } },
    palette,
    morphology: recovered.morphology,
    cadenceMs: recovered.motion.cadenceMs,
    fingerprint: recovered.fingerprint
  };
}
