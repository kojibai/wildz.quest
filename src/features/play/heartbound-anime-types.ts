import type { HeartboundHeadShape, HeartboundHighlightShape, HeartboundPupilShape } from "./living-card-types";

export type HeartboundSpeciesArchetype = "plush-cub" | "long-ear" | "dragon" | "bird" | "aquatic" | "spirit" | "serpent" | "guardian" | "hybrid";
export type HeartboundMaturityBand = "baby" | "adolescent" | "heroic" | "legendary";
export type HeartboundTemplateId = "plush-quadruped" | "upright-companion" | "long-ear-companion" | "small-dragon" | "great-dragon" | "aerial-bird" | "aquatic-friend" | "floating-spirit" | "serpentine-friend" | "guardian-beast" | "compatible-hybrid";

export type HeartboundCompatibilityCorrection = {
  trait: string;
  requested: string;
  resolved: string;
  reason: string;
};

export type HeartboundPresentationV3 = {
  version: 3;
  template: HeartboundTemplateId;
  archetype: HeartboundSpeciesArchetype;
  maturity: HeartboundMaturityBand;
  identityAnchors: { face: string; family: string; lineage: string };
  face: {
    head: HeartboundHeadShape;
    eyeSize: number;
    eyeSpacing: number;
    eyeTilt: number;
    irisScale: number;
    pupil: HeartboundPupilShape;
    highlight: HeartboundHighlightShape;
    catchlights: 2 | 3;
    cheek: number;
    muzzle: number;
    brow: "soft" | "curious" | "brave" | "playful";
    mouth: "smile" | "tiny-open" | "cat-smile" | "beak-smile";
    blush: number;
  };
  body: {
    build: "plush" | "compact" | "graceful" | "athletic" | "guardian" | "serpentine" | "floating";
    headToBody: number;
    torso: number;
    limb: number;
    paw: number;
    neckClearance: number;
    posture: "cuddly" | "curious" | "ready" | "majestic";
  };
  appendages: {
    ears: string;
    horns: string;
    wings: string;
    tail: string;
    crest: string;
    signature: string;
  };
  markings: { topology: string; placement: string; density: number; asymmetry: number };
  motion: { idle: string; gesture: string; battle: string; cadenceMs: number };
  adornments: string[];
  corrections: HeartboundCompatibilityCorrection[];
  signature: string;
};
