import { creatureForm } from "./creature-catalog";
import { deriveKaiCreatureBirth } from "./kai-creature-birth";
import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { deriveBirthGenome } from "./heartbound-genome";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset, type LivingCardGenome } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

export type FunctionalAppendage = Readonly<{
  presence: "absent" | "vestigial" | "functional";
  kind: "wing" | "fin" | "tail" | "frill" | "shell" | "grip" | "gill";
  function: "display" | "balance" | "glide" | "powered-lift" | "steering" | "aquatic-propulsion" | "rudder" | "armor" | "grip" | "underwater-breathing";
  variant: string;
}>;

export type CreatureVisualAppendages = Readonly<{
  wings: FunctionalAppendage;
  fins: FunctionalAppendage;
  frills: FunctionalAppendage;
  tail: FunctionalAppendage;
  ears: FunctionalAppendage;
  horns: FunctionalAppendage;
  crest: FunctionalAppendage;
}>;

export type CreatureVisualIdentity = Readonly<{
  formId: string;
  palette: Readonly<{ primary: string; secondary: string; accent: string; glow: string }>;
  anatomy: Readonly<{
    body: "round" | "long" | "winged" | "serpentine" | "armored";
    detail: string;
    locomotion: "biped" | "quadruped" | "flying" | "serpentine";
    surface: string;
  }>;
  appendages: CreatureVisualAppendages;
  morphology: Readonly<{ head: number; torso: number; limb: number; symmetry: number }>;
  cadenceMs: number;
  fingerprint: string;
}>;

type VisualIdentityOverrides = Partial<Pick<CreatureVisualIdentity, "morphology" | "cadenceMs" | "fingerprint">>;

function appendage(
  presence: FunctionalAppendage["presence"],
  kind: FunctionalAppendage["kind"],
  function_: FunctionalAppendage["function"],
  variant: string
): FunctionalAppendage {
  return { presence, kind, function: function_, variant };
}

function absent(kind: FunctionalAppendage["kind"], function_: FunctionalAppendage["function"]): FunctionalAppendage {
  return appendage("absent", kind, function_, "none");
}

/**
 * The one interpretation boundary between a sealed genome and creature art.
 * Renderers consume these semantic appendages instead of inferring anatomy
 * from a catalog silhouette or presentation archetype.
 */
export function projectLivingGenomeCreatureVisualIdentity(
  genome: LivingCardGenome,
  formId: string = genome.anatomy.body,
  overrides: VisualIdentityOverrides = {}
): CreatureVisualIdentity {
  const wingFunction: FunctionalAppendage["function"] = genome.skeleton.locomotion === "flying" ? "powered-lift" : "glide";
  const hasFins = genome.surface.kind === "shell" || genome.anatomy.detail === "shell";
  const hasFrill = genome.appendages.horns !== "none" || genome.appendages.crest !== "none";
  const hasTail = genome.appendages.tail !== "none";
  const appendages: CreatureVisualAppendages = {
    wings: genome.appendages.wings === "none" ? absent("wing", wingFunction) : appendage("functional", "wing", wingFunction, genome.appendages.wings),
    fins: hasFins ? appendage("functional", "fin", "aquatic-propulsion", genome.surface.kind === "shell" ? "shell-fin" : genome.anatomy.detail) : absent("fin", "aquatic-propulsion"),
    frills: hasFrill ? appendage("functional", "frill", "display", genome.appendages.crest !== "none" ? genome.appendages.crest : genome.appendages.horns) : absent("frill", "display"),
    tail: hasTail ? appendage("functional", "tail", genome.skeleton.locomotion === "flying" ? "steering" : "balance", genome.appendages.tail) : absent("tail", "balance"),
    ears: genome.appendages.ears === "none" ? absent("frill", "display") : appendage("functional", "frill", "display", genome.appendages.ears),
    horns: genome.appendages.horns === "none" ? absent("frill", "display") : appendage("functional", "frill", "display", genome.appendages.horns),
    crest: genome.appendages.crest === "none" ? absent("frill", "display") : appendage("functional", "frill", "display", genome.appendages.crest)
  };
  return {
    formId,
    palette: { ...genome.palette },
    anatomy: {
      body: genome.anatomy.body,
      detail: genome.anatomy.detail,
      locomotion: genome.skeleton.locomotion,
      surface: genome.surface.kind
    },
    appendages,
    morphology: overrides.morphology ?? {
      head: genome.skeleton.head,
      torso: genome.skeleton.torso,
      limb: genome.skeleton.limb,
      symmetry: 0
    },
    cadenceMs: overrides.cadenceMs ?? genome.behavior.idleCadenceMs,
    fingerprint: overrides.fingerprint ?? genome.identityAnchor
  };
}

export function projectCardCreatureVisualIdentity(asset: PortableCardAsset): CreatureVisualIdentity {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_creature_visual_form_unknown");
  const genome = isLivingCardAsset(asset)
    ? currentLivingGenome(asset)
    : deriveBirthGenome({
        formId: asset.manifest.formId,
        proofDigest: asset.proof.digest,
        variant: asset.manifest.variant.traits
      });
  const variant = asset.manifest.variant;
  if (variant.generatorVersion === 3) {
    const identity = variant.traits.identity;
    return projectLivingGenomeCreatureVisualIdentity(genome, form.id, {
      morphology: { head: identity.anatomy.head, torso: identity.anatomy.torso, limb: identity.anatomy.limb, symmetry: identity.anatomy.asymmetry },
      cadenceMs: identity.motion.cadenceMs,
      fingerprint: identity.visualFingerprint
    });
  }
  if (variant.generatorVersion === 2) {
    const profile = variant.traits.birthProfile;
    return projectLivingGenomeCreatureVisualIdentity(genome, form.id, {
      morphology: profile.morphology,
      cadenceMs: profile.motion.cadenceMs,
      fingerprint: profile.fingerprint
    });
  }
  const moment = deriveKaiKlokMoment({ occurredAt: asset.manifest.capturedAt, authority: "admitted" });
  const profile = deriveKaiCreatureBirth({ form, moment, seed: variant.seed });
  return projectLivingGenomeCreatureVisualIdentity(genome, form.id, {
    morphology: profile.morphology,
    cadenceMs: profile.motion.cadenceMs,
    fingerprint: profile.fingerprint
  });
}
