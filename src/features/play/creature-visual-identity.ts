import { creatureForm, creatureForms } from "./creature-catalog";
import { deriveKaiCreatureBirth } from "./kai-creature-birth";
import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { deriveBirthGenome } from "./heartbound-genome";
import { currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset, type LivingCardGenome } from "./living-card-types";
import { deriveCardVariantV3 } from "./card-variant";
import { validateLivingCreatureIdentity, type LivingCreatureIdentityV3 } from "./living-taxonomy";
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
  grip: FunctionalAppendage;
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
  formId: string,
  overrides: VisualIdentityOverrides = {}
): CreatureVisualIdentity {
  return {
    formId,
    palette: { ...genome.palette },
    anatomy: {
      body: genome.anatomy.body,
      detail: genome.anatomy.detail,
      locomotion: genome.skeleton.locomotion,
      surface: genome.surface.kind
    },
    appendages: projectGenomeCreatureVisualAppendages(genome),
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

/** Semantic appendages for renderers that have a genome but no card form. */
export function projectGenomeCreatureVisualAppendages(genome: LivingCardGenome): CreatureVisualAppendages {
  const wingFunction: FunctionalAppendage["function"] = genome.skeleton.locomotion === "flying" ? "powered-lift" : "glide";
  const hasFins = genome.anatomy.aura === "tide" || genome.surface.kind === "shell" || genome.anatomy.detail === "shell";
  const hasFrill = genome.appendages.horns !== "none" || genome.appendages.crest !== "none";
  const hasTail = genome.appendages.tail !== "none";
  const hasGrip = genome.anatomy.body === "long" && genome.anatomy.detail === "horns";
  const appendages: CreatureVisualAppendages = {
    wings: genome.appendages.wings === "none" ? absent("wing", wingFunction) : appendage("functional", "wing", wingFunction, genome.appendages.wings),
    fins: hasFins ? appendage("functional", "fin", "aquatic-propulsion", genome.surface.kind === "shell" ? "shell-fin" : genome.anatomy.detail) : absent("fin", "aquatic-propulsion"),
    frills: hasFrill ? appendage("functional", "frill", "display", genome.appendages.crest !== "none" ? genome.appendages.crest : genome.appendages.horns) : absent("frill", "display"),
    tail: hasTail ? appendage("functional", "tail", genome.skeleton.locomotion === "flying" ? "steering" : "balance", genome.appendages.tail) : absent("tail", "balance"),
    grip: hasGrip ? appendage("functional", "grip", "grip", "mountain-pad") : absent("grip", "grip"),
    ears: genome.appendages.ears === "none" ? absent("frill", "display") : appendage("functional", "frill", "display", genome.appendages.ears),
    horns: genome.appendages.horns === "none" ? absent("frill", "display") : appendage("functional", "frill", "display", genome.appendages.horns),
    crest: genome.appendages.crest === "none" ? absent("frill", "display") : appendage("functional", "frill", "display", genome.appendages.crest)
  };
  return appendages;
}

/**
 * Projects the sealed visual identity while a creature is still wild. The
 * discovery identity is the appearance authority; capture custody and timing
 * must never reroll the creature that the player met.
 */
export function projectEncounterCreatureVisualIdentity(input: {
  identity: LivingCreatureIdentityV3;
  formId: string;
}): CreatureVisualIdentity {
  if (!validateLivingCreatureIdentity(input.identity).ok) {
    throw new Error("wilds_encounter_visual_identity_invalid");
  }
  const requestedForm = creatureForm(input.formId);
  const requestedMatchesIdentity = requestedForm?.stage === 1
    && requestedForm.familyId === input.identity.family.id
    && requestedForm.anatomy.body === input.identity.anatomy.body
    && requestedForm.anatomy.detail === input.identity.anatomy.detail;
  const form = requestedMatchesIdentity ? requestedForm : creatureForms.find((candidate) => candidate.stage === 1
    && candidate.familyId === input.identity.family.id
    && candidate.anatomy.body === input.identity.anatomy.body
    && candidate.anatomy.detail === input.identity.anatomy.detail);
  if (!form) throw new Error("wilds_encounter_visual_form_unknown");
  const traits = deriveCardVariantV3(input.identity.identityDigest, input.identity);
  const genome = deriveBirthGenome({
    formId: form.id,
    proofDigest: input.identity.identityDigest,
    variant: traits
  }, { generatorVersion: 3 });
  return projectLivingGenomeCreatureVisualIdentity(genome, form.id, {
    morphology: {
      head: input.identity.anatomy.head,
      torso: input.identity.anatomy.torso,
      limb: input.identity.anatomy.limb,
      symmetry: input.identity.anatomy.asymmetry
    },
    cadenceMs: input.identity.motion.cadenceMs,
    fingerprint: input.identity.visualFingerprint
  });
}

export function projectCardCreatureVisualIdentity(asset: PortableCardAsset): CreatureVisualIdentity {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_creature_visual_form_unknown");
  const variant = asset.manifest.variant;
  const living = isLivingCardAsset(asset);
  if (variant.generatorVersion === 3 && form.stage === 1 && (!living || asset.manifest.birth.kind !== "fusion")) {
    return projectEncounterCreatureVisualIdentity({ identity: variant.traits.identity, formId: form.id });
  }
  const genome = living
    ? currentLivingGenome(asset)
    : deriveBirthGenome({
        formId: asset.manifest.formId,
        proofDigest: asset.proof.digest,
        variant: asset.manifest.variant.traits
      });
  if (variant.generatorVersion === 3) {
    if (living && asset.manifest.birth.kind === "fusion") {
      return projectLivingGenomeCreatureVisualIdentity(genome, form.id);
    }
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
