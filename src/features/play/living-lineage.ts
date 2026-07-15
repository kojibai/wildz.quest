import { displayCreatureName } from "./card-variant";
import { creatureForm } from "./creature-catalog";
import { applyGrowthEvent } from "./growth-engine";
import { deriveFusionGenome, validateGenome } from "./heartbound-genome";
import { admitLegacyCard, appendLivingCardRevision, currentLivingGenome, currentRevision, verifyLivingCard } from "./living-card-proof";
import { isLivingCardAsset, type LivingCardAsset } from "./living-card-types";
import { canonicalPortableCardJson, sealCollectedCard, sha256PortableBasis, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import type { FusionInheritance } from "./card-fusion";

const RECOVERY_MS = 24 * 60 * 60 * 1000;

export type LivingLineageInput = {
  parentA: PortableCardAsset;
  parentB: PortableCardAsset;
  inheritance: FusionInheritance;
  sparkId: string;
  kaiPulse: string;
  createdAt: string;
  fusionSparks: number;
  recovery: Record<string, string>;
};

export function lineageEligibility(input: LivingLineageInput) {
  const reasons: string[] = [];
  if (!verifyAnyWildsCard(input.parentA).ok || !verifyAnyWildsCard(input.parentB).ok) reasons.push("parent_proof_invalid");
  if (input.parentA.id === input.parentB.id) reasons.push("distinct_parents_required");
  if (input.parentA.manifest.ownerReceizId !== input.parentB.manifest.ownerReceizId) reasons.push("same_owner_required");
  if (!Number.isFinite(Date.parse(input.createdAt)) || !input.kaiPulse.trim()) reasons.push("lineage_time_invalid");
  if (!input.sparkId.trim() || input.fusionSparks < 1) reasons.push("fusion_spark_required");
  const at = Date.parse(input.createdAt);
  const active = [input.recovery[input.parentA.id], input.recovery[input.parentB.id]]
    .filter((value): value is string => Boolean(value))
    .map(Date.parse)
    .filter((value) => Number.isFinite(value) && value > at);
  if (active.length) reasons.push("parent_recovery_active");
  return { ok: reasons.length === 0, reasons, availableAt: active.length ? new Date(Math.max(...active)).toISOString() : null };
}

function livingParent(asset: PortableCardAsset, at: string) {
  return isLivingCardAsset(asset) ? asset : admitLegacyCard(asset, at);
}

function parenthoodRevision(parent: LivingCardAsset, childId: string, eventId: string, createdAt: string, kaiPulse: string) {
  const prior = currentRevision(parent);
  const growth = applyGrowthEvent(prior.growth, {
    eventId: `descendant_milestone:${eventId}`,
    kind: "descendant_milestone",
    path: "legacy",
    amount: 8,
    occurredAt: createdAt,
    achievementId: prior.childEventIds.length ? undefined : "first_verified_child"
  });
  return appendLivingCardRevision({
    asset: parent,
    lineageChildAssetId: childId,
    revision: {
      sealedAt: createdAt,
      kaiPulse,
      reason: { kind: "parenthood", label: `Verified lineage child ${childId} joined this living history` },
      stage: prior.stage,
      ascensionRank: prior.ascensionRank,
      formId: prior.formId,
      growth,
      qualifyingAchievementIds: ["verified_parenthood"],
      consumedCatalystId: null,
      genomeDelta: {},
      stats: { ...prior.stats },
      abilityNames: prior.abilityNames,
      title: prior.title,
      childEventIds: Array.from(new Set([...prior.childEventIds, eventId]))
    }
  });
}

export function createLivingChildTransaction(input: LivingLineageInput) {
  const eligibility = lineageEligibility(input);
  if (!eligibility.ok) throw new Error(`wilds_lineage_ineligible:${eligibility.reasons.join(",")}`);
  const parentA = livingParent(input.parentA, input.createdAt);
  const parentB = livingParent(input.parentB, input.createdAt);
  const ordered = [parentA, parentB].sort((a, b) => currentRevision(a).digest.localeCompare(currentRevision(b).digest));
  const eventBasis = {
    parentDigests: ordered.map((parent) => currentRevision(parent).digest),
    inheritance: input.inheritance,
    sparkId: input.sparkId,
    kaiPulse: input.kaiPulse,
    createdAt: input.createdAt
  };
  const eventDigest = sha256PortableBasis(canonicalPortableCardJson(eventBasis));
  const eventId = `lineage:${eventDigest.slice(7, 39)}`;
  const inherited = input.inheritance === "parent_b" ? parentB : input.inheritance === "parent_a" ? parentA : ordered[0]!;
  const baseForm = creatureForm(`${inherited.manifest.familyId}-1`);
  if (!baseForm) throw new Error("wilds_lineage_base_form_missing");
  const genome = deriveFusionGenome({
    parentA: currentLivingGenome(parentA),
    parentB: currentLivingGenome(parentB),
    emphasis: input.inheritance,
    kaiPulse: input.kaiPulse,
    mutationNonce: eventId
  });
  if (!validateGenome(genome).ok) throw new Error("wilds_lineage_child_genome_invalid");
  const legacyChild = sealCollectedCard({
    formId: baseForm.id,
    ownerReceizId: parentA.manifest.ownerReceizId,
    encounterId: `fusion:${eventDigest.slice(7, 39)}`,
    capturedAt: input.createdAt,
    kaiPulse: input.kaiPulse,
    battleTranscriptDigest: sha256PortableBasis(canonicalPortableCardJson(eventBasis.parentDigests))
  });
  const prefixes = ["Nova", "Prism", "Echo", "Auric", "Velvet", "Astral"];
  const name = `${prefixes[Number.parseInt(eventDigest.slice(7, 9), 16) % prefixes.length]} ${displayCreatureName(baseForm.id, baseForm.name)}`;
  const child = admitLegacyCard(legacyChild, input.createdAt, {
    name,
    birth: { kind: "fusion", bornAt: input.createdAt, formId: baseForm.id, legacyDigest: legacyChild.proof.digest },
    birthGenome: genome,
    lineage: {
      rootAssetId: legacyChild.id,
      rootDigest: legacyChild.proof.digest,
      previousAssetId: null,
      previousDigest: null,
      evolvedAt: null,
      parentAssetIds: [parentA.id, parentB.id],
      parentDigests: [currentRevision(parentA).digest, currentRevision(parentB).digest],
      fusionSparkId: input.sparkId,
      childAssetIds: []
    }
  });
  const nextParentA = parenthoodRevision(parentA, child.id, eventId, input.createdAt, input.kaiPulse);
  const nextParentB = parenthoodRevision(parentB, child.id, eventId, input.createdAt, input.kaiPulse);
  if (!verifyLivingCard(child).ok || !verifyLivingCard(nextParentA).ok || !verifyLivingCard(nextParentB).ok) throw new Error("wilds_lineage_atomic_validation_failed");
  const recoveryUntil = new Date(Date.parse(input.createdAt) + RECOVERY_MS).toISOString();
  return { child, parentA: nextParentA, parentB: nextParentB, sparkConsumed: 1 as const, recoveryUntil, eventId };
}
