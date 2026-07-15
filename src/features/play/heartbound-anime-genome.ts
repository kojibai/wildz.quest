import { heartboundArchetype, heartboundArchetypes } from "./heartbound-archetypes";
import { heartboundTemplate, heartboundTemplates } from "./heartbound-templates";
import type { HeartboundMaturityBand, HeartboundPresentationV3, HeartboundSpeciesArchetype } from "./heartbound-anime-types";
import type { CreatureStage } from "./creature-catalog";
import type { LivingCardGenome } from "./living-card-types";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

function unit(seed: string, lane: string) {
  const digest = sha256PortableBasis(`${seed}:${lane}`).slice(7);
  return Number.parseInt(digest.slice(0, 8), 16) / 0xffffffff;
}

function pick<T>(seed: string, lane: string, values: readonly T[]) {
  return values[Math.floor(unit(seed, lane) * values.length) % values.length]!;
}

function scale(seed: string, lane: string, min: number, max: number) {
  return Number((min + unit(seed, lane) * (max - min)).toFixed(3));
}

function maturityFor(stage: CreatureStage, ascensionRank: number): HeartboundMaturityBand {
  if (ascensionRank > 0) return "legendary";
  if (stage === 3) return "heroic";
  if (stage === 2) return "adolescent";
  return "baby";
}

function archetypeFor(genome: LivingCardGenome, seed: string): HeartboundSpeciesArchetype {
  if (genome.identity?.family.familyId.startsWith("fusion:")) return "hybrid";
  if (genome.skeleton.locomotion === "serpentine") return genome.surface.kind === "energy" ? "spirit" : "serpent";
  if (genome.skeleton.locomotion === "flying") return genome.surface.kind === "feather" ? "bird" : "dragon";
  if (genome.anatomy.detail === "ears") return pick(seed, "ear-archetype", ["plush-cub", "long-ear"] as const);
  if (genome.anatomy.detail === "horns" || genome.surface.kind === "scale") return "dragon";
  if (genome.surface.kind === "shell") return pick(seed, "shell-archetype", ["aquatic", "guardian"] as const);
  if (genome.surface.kind === "energy") return "spirit";
  return pick(seed, "ground-archetype", ["plush-cub", "guardian"] as const);
}

function signatureBasis(value: HeartboundPresentationV3) {
  const { signature: _signature, ...basis } = value;
  return basis;
}

export function heartboundVisualIdentitySignature(value: HeartboundPresentationV3) {
  return sha256PortableBasis(canonicalPortableCardJson(signatureBasis(value)));
}

export function deriveHeartboundPresentation(input: { genome: LivingCardGenome; stage: CreatureStage; ascensionRank: number; proofDigest?: string }): HeartboundPresentationV3 {
  const genomeBasis = { ...input.genome, presentation: undefined };
  const lineage = input.genome.identity?.individualToken ?? input.genome.identityAnchor;
  const seed = sha256PortableBasis(canonicalPortableCardJson({ system: "heartbound.presentation.v3", genome: genomeBasis, proofDigest: input.proofDigest ?? null, lineage }));
  const archetype = archetypeFor(input.genome, seed);
  const definition = heartboundArchetype(archetype);
  const compatible = heartboundTemplates.filter((template) => definition.templates.includes(template.id) && template.locomotion.includes(input.genome.skeleton.locomotion));
  const candidates = compatible.length ? compatible : heartboundTemplates.filter((template) => template.id === "compatible-hybrid");
  const template = pick(seed, "template", candidates);
  const corrections = compatible.length ? [] : [{ trait: "template", requested: definition.templates[0]!, resolved: template.id, reason: "locomotion_compatibility" }];
  const maturity = maturityFor(input.stage, input.ascensionRank);
  const preset = template.maturity[maturity];
  const identity = input.genome.identity;
  const face = identity?.faceGeometry;
  const posture = maturity === "baby" ? "cuddly" : maturity === "adolescent" ? "curious" : maturity === "heroic" ? "ready" : "majestic";
  const presentation: HeartboundPresentationV3 = {
    version: 3,
    template: template.id,
    archetype,
    maturity,
    identityAnchors: { face: input.genome.identityAnchor, family: identity?.family.familyId ?? `${input.genome.anatomy.body}:${input.genome.anatomy.detail}`, lineage },
    face: {
      head: face?.head ?? pick(seed, "head", ["round", "heart", "broad", "tapered"] as const),
      eyeSize: Number(((face?.eyeSize ?? scale(seed, "eye-size", .94, 1.16)) * preset.eyeScale).toFixed(3)),
      eyeSpacing: face?.eyeSpacing ?? scale(seed, "eye-spacing", .86, 1.12),
      eyeTilt: scale(seed, "eye-tilt", -3.5, 4.5),
      irisScale: scale(seed, "iris", .68, .86),
      pupil: face?.pupil === "slit" ? pick(seed, "safe-pupil", ["round", "oval", "star", "crescent"] as const) : face?.pupil ?? "round",
      highlight: face?.highlight ?? "double",
      catchlights: pick(seed, "catchlights", [2, 3] as const),
      cheek: face?.cheek ?? scale(seed, "cheek", .92, 1.2),
      muzzle: face?.muzzle ?? scale(seed, "muzzle", .78, 1.1),
      brow: pick(seed, "brow", ["soft", "curious", "brave", "playful"] as const),
      mouth: archetype === "bird" ? "beak-smile" : pick(seed, "mouth", ["smile", "tiny-open", "cat-smile"] as const),
      blush: scale(seed, "blush", .18, .5)
    },
    body: {
      build: archetype === "serpent" ? "serpentine" : archetype === "spirit" ? "floating" : archetype === "guardian" ? "guardian" : maturity === "baby" ? "plush" : pick(seed, "build", ["compact", "graceful", "athletic"] as const),
      headToBody: Number((preset.headToBody * scale(seed, "head-body", .96, 1.04)).toFixed(3)),
      torso: Number((input.genome.skeleton.torso * template.bodyWidth).toFixed(3)),
      limb: Number((input.genome.skeleton.limb * preset.limbScale).toFixed(3)),
      paw: scale(seed, "paw", maturity === "baby" ? 1.08 : .92, maturity === "baby" ? 1.28 : 1.16),
      neckClearance: template.faceClearance,
      posture
    },
    appendages: {
      ears: input.genome.appendages.ears,
      horns: input.genome.appendages.horns,
      wings: input.genome.appendages.wings,
      tail: input.genome.appendages.tail,
      crest: input.genome.appendages.crest,
      signature: sha256PortableBasis(`${seed}:appendages`).slice(7, 27)
    },
    markings: { topology: identity?.markings.topology ?? input.genome.surface.pattern, placement: identity?.markings.placements.join("+") ?? "face+chest", density: Number(((identity?.markings.density ?? .42) * (.75 + preset.detail * .25)).toFixed(3)), asymmetry: identity?.markings.asymmetry ?? 0 },
    motion: { idle: archetype === "spirit" ? "soft-float" : maturity === "baby" ? "breathing-bob" : "confident-breathe", gesture: pick(seed, "gesture", definition.gestures), battle: maturity === "baby" ? "brave-lean" : maturity === "legendary" ? "radiant-guard" : "ready-stance", cadenceMs: input.genome.behavior.idleCadenceMs },
    adornments: maturity === "legendary" ? [`lineage-halo-${1 + Math.floor(unit(seed, "adornment") * 5)}`, `ascension-emblem-${1 + input.ascensionRank % 7}`] : maturity === "heroic" ? [`bond-emblem-${1 + Math.floor(unit(seed, "emblem") * 5)}`] : [],
    corrections,
    signature: ""
  };
  presentation.signature = heartboundVisualIdentitySignature(presentation);
  return presentation;
}

export function validateHeartboundPresentation(value: HeartboundPresentationV3) {
  const errors: string[] = [];
  if (value.version !== 3 || !heartboundArchetypes.some((entry) => entry.id === value.archetype) || !heartboundTemplates.some((entry) => entry.id === value.template)) errors.push("presentation_header_invalid");
  if (value.face.catchlights < 2 || value.face.eyeSize < .85 || value.face.eyeSize > 1.5 || Math.abs(value.face.eyeTilt) > 5) errors.push("lovability_face_invalid");
  if (value.body.headToBody < .75 || value.body.headToBody > 1.5 || value.body.neckClearance < 20) errors.push("anatomy_invalid");
  if (!value.identityAnchors.face || !value.identityAnchors.family || !value.motion.gesture) errors.push("identity_anchor_invalid");
  if (value.signature !== heartboundVisualIdentitySignature(value)) errors.push("presentation_signature_invalid");
  return { ok: errors.length === 0, errors };
}
