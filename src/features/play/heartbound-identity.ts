import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type {
  HeartboundBodyBuild,
  HeartboundHeadShape,
  HeartboundHighlightShape,
  HeartboundIdentityV2,
  HeartboundMarkingPlacement,
  HeartboundMarkingTopology,
  HeartboundPupilShape,
  LivingCardGenome
} from "./living-card-types";

export type HeartboundFamilyAnchors = {
  familyId: string;
  locomotion: LivingCardGenome["skeleton"]["locomotion"];
  signatureDetail: string;
};

function bytes(seed: string) {
  const hex = seed.replace(/^sha256:/, "");
  return Array.from({ length: 32 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
}

function pick<T>(values: readonly T[], source: number) {
  return values[source % values.length]!;
}

function scale(source: number, min: number, max: number, precision = 3) {
  return Number((min + (source / 255) * (max - min)).toFixed(precision));
}

function structuralSignature(label: string, values: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson({ label, values })).slice(7, 27);
}

export function deriveHeartboundIdentity(proofDigest: string, family: HeartboundFamilyAnchors): HeartboundIdentityV2 {
  if (!/^sha256:[a-f0-9]{64}$/.test(proofDigest) || !family.familyId.trim() || !family.signatureDetail.trim()) throw new Error("heartbound_identity_input_invalid");
  const seed = sha256PortableBasis(canonicalPortableCardJson({ system: "heartbound.identity.v2", proofDigest, family }));
  const value = bytes(seed);
  const head = pick<HeartboundHeadShape>(["round", "tapered", "broad", "heart", "long", "crested"], value[0]!);
  const buildByLocomotion: Record<HeartboundFamilyAnchors["locomotion"], readonly HeartboundBodyBuild[]> = {
    biped: ["compact", "plush", "athletic", "guardian", "armored"],
    quadruped: ["compact", "plush", "athletic", "long", "guardian", "armored"],
    flying: ["compact", "athletic", "winged", "guardian"],
    serpentine: ["long", "serpentine", "armored"]
  };
  const placements = [
    pick<HeartboundMarkingPlacement>(["forehead", "cheek", "eye"], value[17]!),
    pick<HeartboundMarkingPlacement>(["chest", "limb", "tail"], value[18]!)
  ];
  const faceGeometry = {
    head,
    cheek: scale(value[1]!, 0.82, 1.24),
    forehead: scale(value[2]!, 0.84, 1.22),
    muzzle: scale(value[3]!, 0.72, 1.18),
    jaw: scale(value[4]!, 0.82, 1.18),
    eyeSize: scale(value[5]!, 0.86, 1.18),
    eyeSpacing: scale(value[6]!, 0.82, 1.16),
    eyeTilt: scale(value[7]!, -8, 8, 2),
    eyeHeight: scale(value[8]!, 0.9, 1.1),
    pupil: pick<HeartboundPupilShape>(["round", "oval", "star", "crescent", "slit"], value[9]!),
    highlight: pick<HeartboundHighlightShape>(["single", "double", "diamond", "comet"], value[10]!),
    brow: pick(["soft", "heroic", "curious", "mischievous"] as const, value[11]!),
    signature: ""
  };
  faceGeometry.signature = structuralSignature("face", { ...faceGeometry, signature: undefined, token: seed.slice(7, 19) });
  const body = {
    build: pick(buildByLocomotion[family.locomotion], value[12]!),
    neck: scale(value[13]!, 0.72, 1.28),
    shoulder: scale(value[14]!, 0.78, 1.3),
    torso: scale(value[15]!, 0.76, 1.32),
    hip: scale(value[16]!, 0.8, 1.24),
    limb: scale(value[19]!, 0.76, 1.3),
    paw: scale(value[20]!, 0.82, 1.22),
    centerOfGravity: scale(value[21]!, -0.12, 0.12),
    signature: ""
  };
  body.signature = structuralSignature("body", { ...body, signature: undefined, token: seed.slice(19, 31) });
  const markings = {
    topology: pick<HeartboundMarkingTopology>(["bloom", "mask", "comet", "crown", "tide", "constellation", "ribbon", "ember"], value[22]!),
    placements: Array.from(new Set(placements)),
    asymmetry: scale(value[23]!, -0.18, 0.18),
    density: scale(value[24]!, 0.24, 0.72),
    signature: ""
  };
  markings.signature = structuralSignature("markings", { ...markings, signature: undefined, token: seed.slice(31, 43) });
  const behavior = {
    posture: pick(["gentle", "alert", "heroic", "playful", "watchful"] as const, value[25]!),
    blinkMs: Math.round(scale(value[26]!, 2600, 6200, 0)),
    gaze: pick(["steady", "curious", "shy", "bright"] as const, value[27]!),
    gesture: pick(["paw-wave", "ear-flick", "tail-heart", "wing-bow", "tiny-hop", "proud-nod"] as const, value[28]!),
    celebration: pick(["spin", "leap", "glow", "bow", "flutter"] as const, value[29]!),
    signature: ""
  };
  behavior.signature = structuralSignature("behavior", { ...behavior, signature: undefined, token: seed.slice(43, 55) });
  const identity: HeartboundIdentityV2 = {
    version: 2,
    family: { ...family },
    faceGeometry,
    body,
    appendageMorphs: {
      ears: `ears-${family.signatureDetail}-${1 + value[1]! % 7}`,
      horns: `horns-${1 + value[4]! % 7}`,
      wings: `wings-${1 + value[7]! % 7}`,
      tail: `tail-${1 + value[10]! % 9}`,
      crest: `crest-${1 + value[13]! % 7}`
    },
    markings,
    behavior,
    individualToken: seed.slice(7),
    signature: ""
  };
  identity.signature = heartboundIdentitySignature(identity);
  return identity;
}

export function heartboundIdentitySignature(identity: HeartboundIdentityV2) {
  const { signature: _signature, ...basis } = identity;
  return sha256PortableBasis(canonicalPortableCardJson(basis));
}

export function sealHeartboundIdentity(identity: Omit<HeartboundIdentityV2, "signature">): HeartboundIdentityV2 {
  const sealed: HeartboundIdentityV2 = { ...identity, signature: "" };
  sealed.signature = heartboundIdentitySignature(sealed);
  return sealed;
}

export function validateHeartboundIdentity(identity: HeartboundIdentityV2) {
  const errors: string[] = [];
  const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
  if (identity.version !== 2 || !identity.family.familyId.trim() || !identity.individualToken.match(/^[a-f0-9]{64}$/)) errors.push("identity_header_invalid");
  if (!inRange(identity.faceGeometry.cheek, 0.82, 1.24) || !inRange(identity.faceGeometry.forehead, 0.84, 1.22) || !inRange(identity.faceGeometry.muzzle, 0.72, 1.18) || !inRange(identity.faceGeometry.jaw, 0.82, 1.18)) errors.push("face_plane_invalid");
  if (!inRange(identity.faceGeometry.eyeSize, 0.86, 1.18) || !inRange(identity.faceGeometry.eyeSpacing, 0.82, 1.16) || !inRange(identity.faceGeometry.eyeTilt, -8, 8)) errors.push("eyes_invalid");
  if (!inRange(identity.body.neck, 0.72, 1.28) || !inRange(identity.body.shoulder, 0.78, 1.3) || !inRange(identity.body.torso, 0.76, 1.32) || !inRange(identity.body.limb, 0.76, 1.3)) errors.push("body_invalid");
  if (!inRange(identity.markings.asymmetry, -0.18, 0.18) || !inRange(identity.markings.density, 0.24, 0.72) || !identity.markings.placements.length) errors.push("markings_invalid");
  if (!Number.isSafeInteger(identity.behavior.blinkMs) || identity.behavior.blinkMs < 2600 || identity.behavior.blinkMs > 6200) errors.push("behavior_invalid");
  if (identity.signature !== heartboundIdentitySignature(identity)) errors.push("signature_invalid");
  return { ok: errors.length === 0, errors };
}

export function identityForGenome(genome: LivingCardGenome, proofDigest: string) {
  if (genome.identity && validateHeartboundIdentity(genome.identity).ok) return genome.identity;
  return deriveHeartboundIdentity(proofDigest, {
    familyId: `legacy-${genome.anatomy.body}-${genome.anatomy.detail}`,
    locomotion: genome.skeleton.locomotion,
    signatureDetail: genome.anatomy.detail
  });
}
