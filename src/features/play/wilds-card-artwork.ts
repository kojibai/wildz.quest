import { deriveBirthGenome } from "./heartbound-genome";
import { renderHeartboundSvg } from "./heartbound-renderer";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset, type LivingCardGenome } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";
import { projectVerifiedBirthFormV11 } from "./wilds-card-form-resolution";
import type { WildsV11CreatureCard } from "./wilds-card-proof-v11";
import { deriveCardVariant } from "./card-variant";

/** One immutable look from the signed birth, before and after capture. */
export function projectWildsV11BirthGenome(birthProof: WildsV11CreatureCard, formId: string): LivingCardGenome {
  const birth = birthProof.birth;
  const form = projectVerifiedBirthFormV11(birth, formId);
  const variant = { ...deriveCardVariant(birth.generationDigest, 1), bodyScale: birth.body.scale,
    animationMs: birth.voice.pulseMs, palette: { primary: birth.surface.primary,
      accent: birth.surface.accent, glow: birth.surface.glow }, visualFingerprint: birth.generationDigest };
  const genome = deriveBirthGenome({ formId, proofDigest: birthProof.proofDigest, variant }, { verifiedForm: form });
  return {
    ...genome,
    surface: { kind: birth.body.body === "armored" ? "shell" : birth.body.body === "winged" ? "feather" : "fur",
      pattern: `${birth.surface.pattern}-${birth.surface.markingCount}-${birth.generationDigest.slice(7, 15)}` },
    behavior: { ...genome.behavior, temperament: birth.temperament,
      idleCadenceMs: birth.voice.pulseMs },
    auraProfile: { ...genome.auraProfile, kind: birth.body.aura },
    anatomy: { body: birth.body.body, detail: birth.body.detail, aura: birth.body.aura }
  };
}

export function projectWildsCardGenome(asset: PortableCardAsset): LivingCardGenome {
  if (isLivingCardAsset(asset)) return currentLivingGenome(asset);
  if (asset.manifest.birthV11) return projectWildsV11BirthGenome(asset.manifest.birthV11, asset.manifest.formId);
  return deriveBirthGenome({ formId: asset.manifest.formId, proofDigest: asset.proof.digest,
    variant: asset.manifest.variant.traits });
}

// Assets are immutable proof revisions. Cache by object so retired revisions can be collected.
const artwork = new WeakMap<PortableCardAsset, string>();
export function wildsCardArtwork(asset: PortableCardAsset) {
  const cached = artwork.get(asset);
  if (cached !== undefined) return cached;
  const svg = renderHeartboundSvg(
    projectWildsCardGenome(asset),
    "card", { width: 640, height: 405, title: asset.manifest.name, fit: "full-body" }
  );
  artwork.set(asset, svg);
  return svg;
}
