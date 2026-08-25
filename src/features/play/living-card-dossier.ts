import { standaloneCardUrl } from "./card-export";
import { projectCardKaiAppearance } from "./card-kai-appearance";
import { creatureForm, type CreatureStats } from "./creature-catalog";
import { deriveBirthGenome } from "./heartbound-genome";
import { identityForGenome } from "./heartbound-identity";
import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { deriveKaiMomentExpression, KAI_MATH_TEACHINGS } from "./kai-klok-teachings";
import { currentCreatureHistoryProjection, currentLivingGenome, currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import { projectCreatureCapabilityIdentity, type CreatureAbilityDescriptor } from "./creature-capability-identity";
import { projectWildsCreatureWorkFamilies } from "./wilds-steward-construction";
import { wildsWorkCapabilityDescription } from "./wilds-work-capability";

export type LivingCardDossier = {
  story: string;
  birth: {
    sealed: boolean;
    pulse: string;
    cadueusKai: string;
    title: string;
    passage: string;
    geometry: string[];
    teachings: string[];
    statShift: string[];
  };
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
    abilities: CreatureAbilityDescriptor[];
    worldCapabilities: Array<{ name: string; availableNow: string; evolution: string }>;
    growthPaths: Record<string, number>;
    level: number;
    xp: number;
    bond: number;
    mastery: Record<string, number>;
    condition: { life: "alive" | "dead"; fatigue: number; injuryCount: number };
    historyEvents: number;
    historyHead: string | null;
    historyCompleteness: "complete" | "legacy-checkpoint" | "legacy-card";
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
  proofLayers: {
    card: { suite: "SHA-256"; digest: string };
    carrier: { suite: "Groth16"; state: "Receiz Proof Object only" };
  };
  verification: {
    ok: boolean;
    checks: Array<{ label: string; status: "pass" | "fail"; detail: string }>;
    route: string;
    errors: string[];
  };
  canonicalProofJson: string;
};

export type LivingCardStory = Readonly<{
  full: string;
  excerpt: string;
}>;

export function compactProofFingerprint(value: string) {
  if (value.length <= 32) return value;
  return `${value.slice(0, 19)}…${value.slice(-8)}`;
}

const title = (value: string) => value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function battleRole(stats: CreatureStats) {
  const values = Object.entries(stats) as Array<[keyof CreatureStats, number]>;
  const strongest = values.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "bond";
  return strongest === "guard" || strongest === "health" ? "Guardian" : strongest === "speed" ? "Swift scout" : strongest === "power" ? "Striker" : "Bond keeper";
}

function storyFor(asset: PortableCardAsset, temperament: string, gesture: string, posture: string): LivingCardStory {
  const habitat = creatureForm(asset.manifest.formId)?.habitat ?? "Wilds";
  const nature = title(temperament).toLowerCase();
  const signal = title(gesture).toLowerCase();
  const presence = title(posture).toLowerCase();
  if (isLivingCardAsset(asset) && asset.manifest.birth.kind === "fusion") {
    const parents = asset.manifest.lineage.parentAssetIds ?? [];
    return {
      excerpt: `${asset.manifest.name} carries two living lineages into the ${habitat}. Its ${nature} heart, ${presence} presence, and ${signal} make every bond a story only this companion can tell.`,
      full: `${asset.manifest.name} was born where two living lineages met beneath the ${habitat} Kai Pulse. Traits from both parents—${parents.join(" and ")}—became a new independent companion with a ${nature} heart. Watch for the ${title(gesture)}: it is how this one-of-one character chooses to say, “I am here with you.”`
    };
  }
  const moment = new Date(asset.manifest.capturedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return {
    excerpt: `${asset.manifest.name} is a ${nature} spirit of the ${habitat}. With a ${presence} presence and a signature ${signal}, it turns trust into a living story no other companion could carry.`,
    full: `${asset.manifest.name} first answered your signal in the ${habitat} on ${moment}. Its ${nature} nature comes through in every ${signal}, and each earned battle, journey, and bond moment now extends the same living history instead of replacing the companion you met.`
  };
}

export function projectLivingCardStory(asset: PortableCardAsset): LivingCardStory {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_dossier_form_unknown");
  const genome = isLivingCardAsset(asset)
    ? currentLivingGenome(asset)
    : deriveBirthGenome({ formId: asset.manifest.formId, proofDigest: asset.proof.digest, variant: asset.manifest.variant.traits });
  const identity = identityForGenome(genome, asset.proof.digest);
  return storyFor(asset, genome.face.expressionSet, identity.behavior.gesture, identity.behavior.posture);
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
  const historyProjection = living ? currentCreatureHistoryProjection(asset) : null;
  const capabilityIdentity = projectCreatureCapabilityIdentity(asset);
  const workFamilies = projectWildsCreatureWorkFamilies(form.element)
    .filter((family): family is "lumber" | "quarry" => family === "lumber" || family === "quarry");
  const verification = verifyAnyWildsCard(asset);
  const growth = historyProjection?.growth ?? revision?.growth ?? {
    bond: asset.manifest.stats.bond,
    paths: { bond: asset.manifest.stats.bond, battle: 0, exploration: 0, legacy: 0, community: 0, character: 0 }
  };
  const checks: LivingCardDossier["verification"]["checks"] = [
    { label: "Portable manifest", status: verification.ok ? "pass" : "fail", detail: asset.manifest.schema },
    { label: "Stable asset identity", status: asset.id === asset.manifest.assetId ? "pass" : "fail", detail: asset.id },
    { label: "Proof digest", status: verification.errors.includes("digest_mismatch") ? "fail" : "pass", detail: asset.proof.digest },
    { label: "Canonicalization", status: asset.proof.canonicalization === "receiz.sorted-json.v1" ? "pass" : "fail", detail: asset.proof.canonicalization },
    { label: "Revision chain", status: verification.errors.some((error) => error.includes("revision")) ? "fail" : "pass", detail: living ? `${asset.manifest.revisions.length} linked revision${asset.manifest.revisions.length === 1 ? "" : "s"}` : "Legacy birth seal" },
    { label: "Creature history", status: verification.errors.some((error) => error.includes("history")) ? "fail" : "pass", detail: living && asset.manifest.history ? `${asset.manifest.history.events.length} append-only event${asset.manifest.history.events.length === 1 ? "" : "s"} · uPulse ${asset.manifest.history.events.at(-1)?.kai.uPulse ?? 0}` : "Legacy card projection" },
    { label: "Visual genome", status: verification.errors.some((error) => error.includes("genome") || error.includes("art")) ? "fail" : "pass", detail: identity.signature }
  ];
  const body = identity.body;
  const face = identity.faceGeometry;
  const temperament = genome.face.expressionSet;
  const gesture = identity.behavior.gesture;
  const presentation = genome.presentation;
  const appearance = projectCardKaiAppearance(asset);
  const birthProfile = appearance.profile;
  const birthMoment = deriveKaiKlokMoment({ occurredAt: asset.manifest.capturedAt, authority: "local" });
  const birthExpression = deriveKaiMomentExpression(birthMoment);
  const arkMeaning = birthExpression.ark.meaning.replace(/^The [^.]+? Ark /, "This phase ");
  const momentGeometry = [birthExpression.day, birthExpression.week, birthExpression.month, birthExpression.ark]
    .map((teaching) => `${teaching.color} · ${teaching.element} · ${teaching.geometry}`);
  const momentTeachings = [
    birthExpression.day.meaning,
    birthExpression.week.meaning,
    birthExpression.month.meaning,
    arkMeaning,
    KAI_MATH_TEACHINGS[birthMoment.pulse % KAI_MATH_TEACHINGS.length]!
  ];
  const semanticTitle = `${birthExpression.day.color} presence · ${birthExpression.ark.geometry}`;
  const semanticPassage = `${asset.manifest.name} holds a moment of ${birthExpression.day.element.toLowerCase()} shaped as ${birthExpression.day.geometry.toLowerCase()}. ${birthExpression.day.meaning} ${birthExpression.month.meaning} ${arkMeaning}`;
  const powerEntries = Object.entries(asset.manifest.stats).sort((a, b) => b[1] - a[1]);
  const birth = appearance.source === "sealed" ? {
    sealed: true,
    pulse: `Birth Pulse ${birthProfile.pulse}`,
    cadueusKai: birthProfile.cadueusKai,
    title: semanticTitle,
    passage: semanticPassage,
    geometry: [...momentGeometry, `${birthProfile.geometry.sides}-sided living motif`],
    teachings: momentTeachings,
    statShift: (Object.entries(birthProfile.statShift) as Array<[keyof CreatureStats, number]>).filter(([, value]) => value !== 0).map(([key, value]) => `${title(key)} ${value > 0 ? "+" : ""}${value}`)
  } : {
    sealed: false,
    pulse: `Recovered Birth Pulse ${appearance.historicalPulse}`,
    cadueusKai: birthProfile.cadueusKai,
    title: `Remembered ${semanticTitle}`,
    passage: `${semanticPassage} This interpretation recovers the historical moment without rewriting the card's original proof.`,
    geometry: [...momentGeometry, `${birthProfile.geometry.sides}-sided living motif`],
    teachings: momentTeachings,
    statShift: []
  };
  return {
    story: storyFor(asset, temperament, gesture, identity.behavior.posture).full,
    birth,
    personality: {
      motivations: [
        identity.behavior.posture === "heroic" ? "Protect the path before asking for recognition." : "Understand new signals before deciding how to act.",
        growth.paths.legacy > 0 ? "Keep its lineage close and help descendants thrive." : "Build a bond strong enough to become a lasting lineage."
      ],
      traits: birthProfile.characterTraits.map(title),
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
      abilities: [...capabilityIdentity.abilities],
      worldCapabilities: [
        ...capabilityIdentity.traversalPotential.map((capability) => ({
          name: title(capability),
          availableNow: capability === "flight" ? "Powered flight above the canopy." : capability === "glide" ? "Controlled glide from height." : capability === "swim" ? "Deep-water swimming and diving." : "Grip and climb steep living terrain.",
          evolution: capability === "flight" ? "Longer flight, stronger lift, and finer altitude control." : capability === "swim" ? "Longer dives, deeper control, and stronger current handling." : "Greater endurance, control, and reach."
        })),
        ...workFamilies.map((family) => {
          const descriptor = wildsWorkCapabilityDescription(family);
          return {
            name: descriptor.label,
            availableNow: descriptor.guidance,
            evolution: "Greater work endurance and more precise stewardship with less recovery time."
          };
        })
      ],
      growthPaths: { ...growth.paths },
      level: historyProjection?.level ?? 1,
      xp: historyProjection?.xp ?? 0,
      bond: historyProjection?.bond ?? growth.bond,
      mastery: { ...(historyProjection?.mastery ?? {}) },
      condition: {
        life: historyProjection?.condition.life ?? "alive",
        fatigue: historyProjection?.condition.fatigue ?? 0,
        injuryCount: historyProjection?.condition.injuries.length ?? 0
      },
      historyEvents: living ? asset.manifest.history?.events.length ?? 0 : 0,
      historyHead: living ? asset.manifest.history?.headDigest ?? null : null,
      historyCompleteness: living ? asset.manifest.history?.completeness ?? "legacy-card" : "legacy-card",
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
    proofLayers: {
      card: { suite: "SHA-256", digest: asset.proof.digest },
      carrier: { suite: "Groth16", state: "Receiz Proof Object only" }
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
