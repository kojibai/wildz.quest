import { deriveCardVariant, displayCreatureName, variantSeedFor } from "./card-variant";
import { creatureForm } from "./creature-catalog";
import { isLivingCardAsset } from "./living-card-types";
import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyAnyWildsCard,
  verifyPortableCard,
  type LegacyPortableCardAsset,
  type PortableCardAsset,
  type PortableCardManifest
} from "./portable-card";

export type FusionInheritance = "balanced" | "parent_a" | "parent_b";
export type FusionEligibility = { ok: boolean; reasons: string[]; availableAt: string | null };

export function fusionEligibility(input: {
  parentA: PortableCardAsset;
  parentB: PortableCardAsset;
  fusionSparks: number;
  fusionCooldowns: Record<string, string>;
  at: string;
}): FusionEligibility {
  const reasons: string[] = [];
  if (!verifyAnyWildsCard(input.parentA).ok || !verifyAnyWildsCard(input.parentB).ok) reasons.push("parent_proof_invalid");
  if (input.parentA.id === input.parentB.id) reasons.push("distinct_parents_required");
  if (input.parentA.manifest.ownerReceizId !== input.parentB.manifest.ownerReceizId) reasons.push("same_owner_required");
  if (!Number.isFinite(Date.parse(input.at))) reasons.push("fusion_time_invalid");
  if (input.fusionSparks < 1) reasons.push("fusion_spark_required");
  const atMs = Date.parse(input.at);
  const cooldowns = [input.fusionCooldowns[input.parentA.id], input.fusionCooldowns[input.parentB.id]].filter(Boolean) as string[];
  const active = cooldowns.map(Date.parse).filter((value) => Number.isFinite(value) && value > atMs);
  if (active.length) reasons.push("parent_cooldown_active");
  return { ok: reasons.length === 0, reasons, availableAt: active.length ? new Date(Math.max(...active)).toISOString() : null };
}

export function fusionChild(input: {
  parentA: PortableCardAsset;
  parentB: PortableCardAsset;
  inheritance: FusionInheritance;
  fusionKaiPulse: string;
  fusedAt: string;
  sparkId: string;
}): PortableCardAsset {
  if (isLivingCardAsset(input.parentA) || isLivingCardAsset(input.parentB)) throw new Error("wilds_living_fusion_not_supported_yet");
  if (!verifyPortableCard(input.parentA).ok || !verifyPortableCard(input.parentB).ok) throw new Error("wilds_fusion_parent_invalid");
  if (input.parentA.id === input.parentB.id || input.parentA.manifest.ownerReceizId !== input.parentB.manifest.ownerReceizId) throw new Error("wilds_fusion_parent_ineligible");
  if (!Number.isFinite(Date.parse(input.fusedAt)) || !input.sparkId.trim()) throw new Error("wilds_fusion_basis_invalid");
  const parentA: LegacyPortableCardAsset = input.parentA;
  const parentB: LegacyPortableCardAsset = input.parentB;
  const ordered = [parentA, parentB].sort((a, b) => a.proof.digest.localeCompare(b.proof.digest));
  const inherited = input.inheritance === "parent_b" ? parentB : input.inheritance === "parent_a" ? parentA : ordered[0]!;
  const form = creatureForm(inherited.manifest.formId);
  if (!form) throw new Error("wilds_fusion_form_unknown");
  const parentDigests = [ordered[0]!.proof.digest, ordered[1]!.proof.digest] as [string, string];
  const fusionBasis = {
    parentA: parentDigests[0],
    parentB: parentDigests[1],
    inheritance: input.inheritance,
    fusionKaiPulse: input.fusionKaiPulse,
    fusedAt: input.fusedAt,
    sparkId: input.sparkId
  };
  const fusionDigest = sha256PortableBasis(canonicalPortableCardJson(fusionBasis));
  const assetId = `wilds:${fusionDigest.slice(7, 31)}`;
  const encounterId = `fusion:${fusionDigest.slice(7, 39)}`;
  const battleTranscriptDigest = sha256PortableBasis(canonicalPortableCardJson(parentDigests));
  const seed = variantSeedFor({
    formId: form.id,
    encounterId,
    ownerReceizId: inherited.manifest.ownerReceizId,
    capturedAt: input.fusedAt,
    kaiPulse: input.fusionKaiPulse,
    battleTranscriptDigest
  });
  const traits = deriveCardVariant(seed, 1);
  const prefixes = ["Nova", "Prism", "Echo", "Auric", "Velvet", "Astral"];
  const prefix = prefixes[Number.parseInt(traits.visualFingerprint.slice(0, 2), 16) % prefixes.length]!;
  const manifest: PortableCardManifest = {
    ...inherited.manifest,
    assetId,
    name: `${prefix} ${displayCreatureName(form.id, form.name)}`,
    encounterId,
    capturedAt: input.fusedAt,
    variant: {
      generatorVersion: 1,
      seed,
      traitsDigest: sha256PortableBasis(canonicalPortableCardJson(traits)),
      kaiPulse: input.fusionKaiPulse,
      battleTranscriptDigest,
      traits
    },
    lineage: {
      rootAssetId: assetId,
      rootDigest: fusionDigest,
      previousAssetId: null,
      previousDigest: null,
      evolvedAt: null,
      parentAssetIds: [parentA.id, parentB.id].sort() as [string, string],
      parentDigests,
      fusionSparkId: input.sparkId
    }
  };
  return {
    id: assetId,
    status: "sealed_local",
    synchronizedAt: null,
    manifest,
    proof: {
      kind: "receiz.wilds_local_seal.v1",
      digest: sha256PortableBasis(canonicalPortableCardJson(manifest)),
      canonicalization: "receiz.sorted-json.v1",
      sealedAt: input.fusedAt
    }
  };
}
