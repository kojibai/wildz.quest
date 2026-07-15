import { standaloneCardUrl } from "./card-export";
import { creatureForm, type CreatureStats } from "./creature-catalog";
import { deriveBirthGenome } from "./heartbound-genome";
import { identityForGenome } from "./heartbound-identity";
import { currentLivingGenome, currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

export type LivingCardDossier = {
  story: string;
  personality: {
    motivations: string[];
    traits: string[];
    habitat: string;
    bonding: string[];
    cautions: string[];
    quirks: string[];
    communication: string;
    careCues: string[];
  };
  gameplay: {
    role: string;
    strengths: string[];
    vulnerabilities: string[];
    teammates: string[];
    stats: CreatureStats;
    abilities: string[];
    growthPaths: Record<string, number>;
    nextRequirements: string[];
  };
  dna: {
    identityFingerprint: string;
    genomeDigest: string;
    generatorVersion: number;
    rendererVersion: number;
    presentation: string[];
    face: string[];
    body: string[];
    appendages: string[];
    markings: string[];
    aura: string[];
    behavior: string[];
    provenance: Record<string, string>;
  };
  lineage: { root: string; parents: string[]; children: string[] };
  verification: {
    ok: boolean;
    checks: Array<{ label: string; status: "pass" | "fail"; detail: string }>;
    route: string;
    errors: string[];
  };
  canonicalProofJson: string;
};

const title = (value: string) => value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function battleRole(stats: CreatureStats) {
  const values = Object.entries(stats) as Array<[keyof CreatureStats, number]>;
  const strongest = values.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "bond";
  return strongest === "guard" || strongest === "health" ? "Guardian" : strongest === "speed" ? "Swift scout" : strongest === "power" ? "Striker" : "Bond keeper";
}

function storyFor(asset: PortableCardAsset, temperament: string, gesture: string) {
  const habitat = creatureForm(asset.manifest.formId)?.habitat ?? "Wilds";
  if (isLivingCardAsset(asset) && asset.manifest.birth.kind === "fusion") {
    const parents = asset.manifest.lineage.parentAssetIds ?? [];
    return `${asset.manifest.name} was born where two living lineages met beneath the ${habitat} Kai Pulse. Traits from both parents—${parents.join(" and ")}—became a new independent companion with a ${temperament.toLowerCase()} heart. Watch for the ${title(gesture)}: it is how this one-of-one character chooses to say, “I am here with you.”`;
  }
  const moment = new Date(asset.manifest.capturedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${asset.manifest.name} first answered your signal in the ${habitat} on ${moment}. Its ${temperament.toLowerCase()} nature comes through in every ${title(gesture).toLowerCase()}, and each earned battle, journey, and bond moment now extends the same living history instead of replacing the companion you met.`;
}

export function safePublicProofObject(asset: PortableCardAsset) {
  // Portable card proofs contain public ownership identifiers but never credentials or session secrets.
  // Preserve the exact object so independent offline verification remains possible.
  return JSON.parse(canonicalPortableCardJson(asset)) as PortableCardAsset;
}

export function canonicalPublicProofJson(asset: PortableCardAsset) {
  return canonicalPortableCardJson(safePublicProofObject(asset));
}

export function projectLivingCardDossier(asset: PortableCardAsset, origin: string): LivingCardDossier {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_dossier_form_unknown");
  const living = isLivingCardAsset(asset);
  const genome = living
    ? currentLivingGenome(asset)
    : deriveBirthGenome({ formId: asset.manifest.formId, proofDigest: asset.proof.digest, variant: asset.manifest.variant.traits });
  const identity = identityForGenome(genome, asset.proof.digest);
  const revision = living ? currentRevision(asset) : null;
  const verification = verifyAnyWildsCard(asset);
  const growth = revision?.growth ?? {
    bond: asset.manifest.stats.bond,
    paths: { bond: asset.manifest.stats.bond, battle: 0, exploration: 0, legacy: 0, community: 0, character: 0 }
  };
  const checks: LivingCardDossier["verification"]["checks"] = [
    { label: "Portable manifest", status: verification.ok ? "pass" : "fail", detail: asset.manifest.schema },
    { label: "Stable asset identity", status: asset.id === asset.manifest.assetId ? "pass" : "fail", detail: asset.id },
    { label: "Proof digest", status: verification.errors.includes("digest_mismatch") ? "fail" : "pass", detail: asset.proof.digest },
    { label: "Canonicalization", status: asset.proof.canonicalization === "receiz.sorted-json.v1" ? "pass" : "fail", detail: asset.proof.canonicalization },
    { label: "Revision chain", status: verification.errors.some((error) => error.includes("revision")) ? "fail" : "pass", detail: living ? `${asset.manifest.revisions.length} linked revision${asset.manifest.revisions.length === 1 ? "" : "s"}` : "Legacy birth seal" },
    { label: "Visual genome", status: verification.errors.some((error) => error.includes("genome") || error.includes("art")) ? "fail" : "pass", detail: identity.signature }
  ];
  const body = identity.body;
  const face = identity.faceGeometry;
  const temperament = genome.face.expressionSet;
  const gesture = identity.behavior.gesture;
  const presentation = genome.presentation;
  const powerEntries = Object.entries(asset.manifest.stats).sort((a, b) => b[1] - a[1]);
  return {
    story: storyFor(asset, temperament, gesture),
    personality: {
      motivations: [
        identity.behavior.posture === "heroic" ? "Protect the path before asking for recognition." : "Understand new signals before deciding how to act.",
        growth.paths.legacy > 0 ? "Keep its lineage close and help descendants thrive." : "Build a bond strong enough to become a lasting lineage."
      ],
      traits: [title(temperament), title(identity.behavior.posture), title(identity.behavior.gaze), title(genome.behavior.temperament)],
      habitat: `${form.habitat} · ${title(genome.anatomy.aura)} affinity`,
      bonding: [`Responds warmly to ${title(gesture).toLowerCase()} moments.`, "Builds trust through active travel, fair battles, and consistent care."],
      cautions: [identity.behavior.gaze === "shy" ? "Needs a calm approach after difficult encounters." : "Dislikes being rushed through a new habitat.", `Its ${title(identity.family.locomotion).toLowerCase()} body needs recovery after intense movement.`],
      quirks: [`Celebrates with a ${title(identity.behavior.celebration).toLowerCase()}.`, `Blink rhythm: ${identity.behavior.blinkMs.toLocaleString()} ms.`],
      communication: `${title(identity.behavior.gaze)} eye contact followed by a ${title(gesture).toLowerCase()}.`,
      careCues: ["A brighter aura means the companion feels secure.", "A guarded posture means it needs rest or a lower-pressure bond activity."]
    },
    gameplay: {
      role: battleRole(asset.manifest.stats),
      strengths: powerEntries.slice(0, 2).map(([key, value]) => `${title(key)} ${value}`),
      vulnerabilities: powerEntries.slice(-2).map(([key, value]) => `${title(key)} ${value} needs tactical support`),
      teammates: [`A ${identity.family.locomotion === "flying" ? "grounded guardian" : "swift aerial scout"} balances its movement style.`, `A companion with strong ${powerEntries.at(-1)?.[0] ?? "bond"} covers its lowest current stat.`],
      stats: { ...asset.manifest.stats },
      abilities: [...asset.manifest.abilityNames],
      growthPaths: { ...growth.paths },
      nextRequirements: living && revision?.stage === 3
        ? [`Earn the next unused achievement after Ascension ${revision.ascensionRank}.`, "Complete the card-specific quest, catalyst, bond, and recovery gates."]
        : ["Raise level and bond through active play.", "Complete the next stage-specific evolution requirement."]
    },
    dna: {
      identityFingerprint: identity.signature,
      genomeDigest: revision?.genomeDigest ?? identity.signature,
      generatorVersion: genome.generatorVersion,
      rendererVersion: revision?.rendererVersion ?? genome.generatorVersion,
      presentation: presentation
        ? [title(presentation.archetype), title(presentation.template), title(presentation.maturity), `${presentation.face.catchlights} catchlights`, ...presentation.corrections.map((correction) => `${title(correction.trait)}: ${title(correction.resolved)}`)]
        : ["Historical Heartbound presentation"],
      face: [title(face.head), `${face.eyeSize}× ${title(face.pupil)} eyes`, `${face.cheek} cheek`, `${face.muzzle} muzzle`, title(face.brow)],
      body: [title(body.build), title(identity.family.locomotion), `${body.torso} torso`, `${body.limb} limb`, `${body.paw} paw`],
      appendages: Object.entries(identity.appendageMorphs).map(([key, value]) => `${title(key)}: ${title(value)}`),
      markings: [title(identity.markings.topology), ...identity.markings.placements.map(title), `${Math.round(identity.markings.density * 100)}% density`],
      aura: [title(genome.auraProfile.kind), title(genome.auraProfile.particle), `${genome.auraProfile.intensity} intensity`, genome.palette.glow],
      behavior: [title(identity.behavior.posture), title(identity.behavior.gaze), title(gesture), title(identity.behavior.celebration), `${identity.behavior.blinkMs} ms blink`],
      provenance: Object.fromEntries(Object.entries(genome.provenance).map(([key, value]) => [key, value]))
    },
    lineage: {
      root: asset.manifest.lineage.rootAssetId,
      parents: [...(asset.manifest.lineage.parentAssetIds ?? [])],
      children: living ? [...asset.manifest.lineage.childAssetIds] : []
    },
    verification: {
      ok: verification.ok && checks.every((check) => check.status === "pass"),
      checks,
      route: standaloneCardUrl(asset.id, origin),
      errors: [...verification.errors]
    },
    canonicalProofJson: canonicalPublicProofJson(asset)
  };
}
