import { creatureForm } from "./creature-catalog";
import { deriveCardVariantV2, deriveCardVariantV3, variantSeedFor } from "./card-variant";
import { deriveKaiCreatureBirth } from "./kai-creature-birth";
import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { validateLivingCreatureIdentity } from "./living-taxonomy";
import { deriveBirthGenome, genomeDigest, mergeLivingGenome, validateGenome } from "./heartbound-genome";
import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyPortableCard,
  type LegacyPortableCardAsset,
  type PortableCardVerification
} from "./portable-card";
import {
  isLivingCardAsset,
  type LivingCardAsset,
  type LivingCardBirth,
  type LivingCardGenome,
  type LivingLineage,
  type LivingCardManifest,
  type LivingCardRevision,
  type LivingCardRevisionDraft,
  type LivingGrowthSnapshot
} from "./living-card-types";

const DIGEST = /^sha256:[a-f0-9]{64}$/;

export function emptyLivingGrowth(bond = 0): LivingGrowthSnapshot {
  return {
    bond,
    paths: { bond, battle: 0, exploration: 0, legacy: 0, community: 0, character: 0 },
    eventIds: [],
    achievementIds: [],
    consumedAchievementIds: [],
    completedQuestIds: [],
    recoveryUntil: null
  };
}

function mergeGenome(previous: LivingCardGenome, delta: Partial<LivingCardGenome>): LivingCardGenome {
  return mergeLivingGenome(previous, delta);
}

export function livingGenomeDigest(genome: LivingCardGenome) {
  return genomeDigest(genome);
}

function renderedArtDigest(genome: LivingCardGenome, formId: string, title: string) {
  return sha256PortableBasis(canonicalPortableCardJson(genome.generatorVersion === 3
    ? { renderer: 3, presentationSignature: genome.presentation?.signature, genome, formId, title }
    : { renderer: 1, genome, formId, title }));
}

function rendererVersionForGenome(genome: LivingCardGenome): 1 | 2 | 3 {
  return genome.generatorVersion;
}

function validProjectedStats(stats: LivingCardRevisionDraft["stats"], formStats: LivingCardRevisionDraft["stats"]) {
  const keys = Object.keys(formStats) as (keyof typeof formStats)[];
  const total = (value: typeof stats) => keys.reduce((sum, key) => sum + value[key], 0);
  return total(stats) === total(formStats) && keys.every((key) => stats[key] > 0 && Math.abs(stats[key] - formStats[key]) <= 3);
}

function revisionBasis(revision: LivingCardRevision) {
  const { digest: _digest, ...basis } = revision;
  return basis;
}

function sealRevision(revision: Omit<LivingCardRevision, "digest">): LivingCardRevision {
  const provisional = { ...revision, digest: "" } as LivingCardRevision;
  return { ...revision, digest: sha256PortableBasis(canonicalPortableCardJson(revisionBasis(provisional))) };
}

function manifestDigest(manifest: LivingCardManifest) {
  return sha256PortableBasis(canonicalPortableCardJson(manifest));
}

function birthGenome(legacy: LegacyPortableCardAsset): LivingCardGenome {
  return deriveBirthGenome({ formId: legacy.manifest.formId, proofDigest: legacy.proof.digest, variant: legacy.manifest.variant.traits });
}

export function admitLegacyCard(legacy: LegacyPortableCardAsset, admittedAt: string, options: {
  birth?: LivingCardBirth;
  birthGenome?: LivingCardGenome;
  lineage?: LivingLineage;
  name?: string;
} = {}): LivingCardAsset {
  if (!verifyPortableCard(legacy).ok) throw new Error("wilds_legacy_card_invalid");
  if (!Number.isFinite(Date.parse(admittedAt))) throw new Error("wilds_living_admission_time_invalid");
  const form = creatureForm(legacy.manifest.formId)!;
  const genome = options.birthGenome ?? birthGenome(legacy);
  const name = options.name ?? legacy.manifest.name;
  const revision = sealRevision({
    revision: 0,
    previousRevisionDigest: null,
    sealedAt: legacy.proof.sealedAt,
    kaiPulse: legacy.manifest.variant.kaiPulse,
    reason: { kind: "birth", label: "Original verified card admitted as a living companion" },
    stage: form.stage,
    ascensionRank: 0,
    formId: form.id,
    growth: emptyLivingGrowth(legacy.manifest.stats.bond),
    qualifyingAchievementIds: [],
    consumedCatalystId: null,
    genomeDelta: {},
    genomeDigest: livingGenomeDigest(genome),
    stats: { ...legacy.manifest.stats },
    abilityNames: [form.abilities[0].name, form.abilities[1].name],
    title: name,
    rendererVersion: rendererVersionForGenome(genome),
    renderedArtDigest: renderedArtDigest(genome, form.id, name),
    childEventIds: []
  });
  const manifest: LivingCardManifest = {
    ...legacy.manifest,
    schema: "receiz.wilds_living_card_manifest.v2",
    name,
    lineage: options.lineage ?? { ...legacy.manifest.lineage, childAssetIds: [] },
    birth: options.birth ?? { kind: "legacy_admission", bornAt: legacy.manifest.capturedAt, formId: form.id, legacyDigest: legacy.proof.digest },
    birthGenome: genome,
    currentRevision: 0,
    revisions: [revision]
  };
  return {
    id: legacy.id,
    status: legacy.status,
    synchronizedAt: legacy.synchronizedAt,
    manifest,
    proof: {
      kind: "receiz.wilds_living_seal.v2",
      digest: manifestDigest(manifest),
      canonicalization: "receiz.sorted-json.v1",
      sealedAt: admittedAt
    }
  };
}

export function currentRevision(asset: LivingCardAsset) {
  return asset.manifest.revisions[asset.manifest.currentRevision]!;
}

export function currentLivingGenome(asset: LivingCardAsset) {
  return asset.manifest.revisions.reduce((genome, revision) => mergeGenome(genome, revision.genomeDelta), asset.manifest.birthGenome);
}

export function currentLivingProjection(asset: LivingCardAsset) {
  const revision = currentRevision(asset);
  return {
    assetId: asset.id,
    formId: revision.formId,
    stage: revision.stage,
    ascensionRank: revision.ascensionRank,
    title: revision.title,
    stats: revision.stats,
    abilityNames: revision.abilityNames,
    genome: currentLivingGenome(asset),
    revision: revision.revision,
    revisionDigest: revision.digest
  };
}

export function appendLivingCardRevision(input: { asset: LivingCardAsset; revision: LivingCardRevisionDraft; lineageChildAssetId?: string }): LivingCardAsset {
  const checked = verifyLivingCard(input.asset);
  if (!checked.ok) throw new Error("wilds_living_previous_invalid");
  if (!Number.isFinite(Date.parse(input.revision.sealedAt))) throw new Error("wilds_revision_time_invalid");
  const prior = currentRevision(input.asset);
  const form = creatureForm(input.revision.formId);
  if (!form || form.stage !== input.revision.stage) throw new Error("wilds_revision_form_invalid");
  if (!validProjectedStats(input.revision.stats, form.stats)) throw new Error("wilds_revision_stats_invalid");
  if (canonicalPortableCardJson(input.revision.abilityNames) !== canonicalPortableCardJson(form.abilities.map((ability) => ability.name))) throw new Error("wilds_revision_abilities_invalid");
  const genome = mergeGenome(currentLivingGenome(input.asset), input.revision.genomeDelta);
  const revision = sealRevision({
    ...input.revision,
    revision: prior.revision + 1,
    previousRevisionDigest: prior.digest,
    genomeDigest: livingGenomeDigest(genome),
    rendererVersion: rendererVersionForGenome(genome),
    renderedArtDigest: renderedArtDigest(genome, form.id, input.revision.title)
  });
  const manifest: LivingCardManifest = {
    ...input.asset.manifest,
    formId: form.id,
    familyId: form.familyId,
    stage: form.stage,
    cardNumber: form.cardNumber,
    name: revision.title,
    species: input.asset.manifest.variant.generatorVersion === 2
      ? input.asset.manifest.variant.traits.birthProfile.species.display
      : input.asset.manifest.variant.generatorVersion === 3 ? input.asset.manifest.variant.traits.identity.species.name : form.species,
    rarity: form.rarity,
    foil: form.foil,
    stats: { ...revision.stats },
    abilityNames: revision.abilityNames,
    lineage: {
      ...input.asset.manifest.lineage,
      evolvedAt: input.revision.reason.kind === "stage" || input.revision.reason.kind === "ascension" ? input.revision.sealedAt : input.asset.manifest.lineage.evolvedAt,
      childAssetIds: input.lineageChildAssetId
        ? Array.from(new Set([...input.asset.manifest.lineage.childAssetIds, input.lineageChildAssetId]))
        : input.asset.manifest.lineage.childAssetIds
    },
    currentRevision: revision.revision,
    revisions: [...input.asset.manifest.revisions, revision]
  };
  return {
    ...input.asset,
    manifest,
    proof: { ...input.asset.proof, digest: manifestDigest(manifest), sealedAt: input.revision.sealedAt }
  };
}

export function verifyLivingCard(asset: LivingCardAsset): PortableCardVerification {
  const errors: string[] = [];
  if (!isLivingCardAsset(asset)) return { ok: false, errors: ["schema_invalid"] };
  const manifest = asset.manifest;
  if (manifest.assetId !== asset.id) errors.push("asset_id_mismatch");
  if (!manifest.ownerReceizId.trim()) errors.push("owner_required");
  if (!manifest.revisions.length || manifest.currentRevision !== manifest.revisions.length - 1) errors.push("current_revision_invalid");
  if (manifest.birth.legacyDigest !== null && !DIGEST.test(manifest.birth.legacyDigest)) errors.push("legacy_digest_invalid");
  if (manifest.variant.generatorVersion === 2) {
    try {
      const form = creatureForm(manifest.birth.formId);
      if (!form) throw new Error("birth_form_missing");
      const expectedSeed = variantSeedFor({
        formId: form.id,
        encounterId: manifest.encounterId,
        ownerReceizId: manifest.ownerReceizId,
        capturedAt: manifest.capturedAt,
        kaiPulse: manifest.variant.kaiPulse,
        battleTranscriptDigest: manifest.variant.battleTranscriptDigest
      }, 2);
      const moment = deriveKaiKlokMoment({ occurredAt: manifest.capturedAt, authority: "admitted" });
      const storedProfile = manifest.variant.traits.birthProfile;
      const profile = deriveKaiCreatureBirth({
        form,
        moment,
        seed: expectedSeed,
        ...(manifest.lineage.parentAssetIds && storedProfile.lineage ? {
          lineage: { parentIds: manifest.lineage.parentAssetIds, inheritedSignals: storedProfile.lineage.inheritedSignals }
        } : {})
      });
      const traits = deriveCardVariantV2(expectedSeed, profile);
      if (manifest.variant.seed !== expectedSeed) errors.push("variant_seed_mismatch");
      if (manifest.variant.kaiPulse !== String(moment.pulse)) errors.push("kai_pulse_mismatch");
      if (canonicalPortableCardJson(manifest.variant.traits) !== canonicalPortableCardJson(traits)) errors.push("variant_traits_mismatch");
      if (manifest.variant.traitsDigest !== sha256PortableBasis(canonicalPortableCardJson(traits))) errors.push("variant_digest_mismatch");
      if (canonicalPortableCardJson(manifest.revisions[0]?.stats) !== canonicalPortableCardJson(profile.adjustedStats)) errors.push("birth_stats_mismatch");
      if (manifest.revisions[0]?.title !== profile.name.display) errors.push("birth_name_mismatch");
      if (manifest.species !== profile.species.display) errors.push("birth_species_mismatch");
    } catch {
      errors.push("kai_birth_invalid");
    }
  } else if (manifest.variant.generatorVersion === 3) {
    try {
      const form = creatureForm(manifest.birth.formId);
      const identity = manifest.variant.traits.identity;
      if (!form || !manifest.birth.legacyDigest) throw new Error("birth_basis_missing");
      const expectedSeed = variantSeedFor({
        formId: form.id,
        encounterId: manifest.encounterId,
        ownerReceizId: manifest.ownerReceizId,
        capturedAt: manifest.capturedAt,
        kaiPulse: manifest.variant.kaiPulse,
        battleTranscriptDigest: manifest.variant.battleTranscriptDigest
      }, 3);
      const traits = deriveCardVariantV3(expectedSeed, identity);
      if (!validateLivingCreatureIdentity(identity).ok) errors.push("discovery_identity_invalid");
      if (identity.encounterId !== manifest.encounterId || identity.discovery.ownerScope !== manifest.ownerReceizId || identity.family.id !== form.familyId) errors.push("discovery_identity_mismatch");
      if (manifest.variant.seed !== expectedSeed) errors.push("variant_seed_mismatch");
      if (manifest.variant.kaiPulse !== String(identity.discovery.kaiPulse)) errors.push("kai_pulse_mismatch");
      if (canonicalPortableCardJson(manifest.variant.traits) !== canonicalPortableCardJson(traits)) errors.push("variant_traits_mismatch");
      if (manifest.variant.traitsDigest !== sha256PortableBasis(canonicalPortableCardJson(traits))) errors.push("variant_digest_mismatch");
      if (manifest.revisions[0]?.title !== identity.name.display || manifest.name !== identity.name.display || manifest.species !== identity.species.name) errors.push("birth_name_mismatch");
      if (canonicalPortableCardJson(manifest.revisions[0]?.stats) !== canonicalPortableCardJson(form.stats)) errors.push("birth_stats_mismatch");
      if (manifest.birth.kind !== "fusion") {
        const expectedGenome = deriveBirthGenome({ formId: form.id, proofDigest: manifest.birth.legacyDigest, variant: traits });
        if (canonicalPortableCardJson(manifest.birthGenome) !== canonicalPortableCardJson(expectedGenome)) errors.push("birth_genome_mismatch");
      }
    } catch {
      errors.push("discovery_birth_invalid");
    }
  }
  let genome = manifest.birthGenome;
  let previousDigest: string | null = null;
  manifest.revisions.forEach((revision, index) => {
    if (revision.revision !== index) errors.push("revision_number_invalid");
    if (revision.previousRevisionDigest !== previousDigest) errors.push("revision_link_invalid");
    if (!Number.isFinite(Date.parse(revision.sealedAt))) errors.push("revision_time_invalid");
    const expectedDigest = sha256PortableBasis(canonicalPortableCardJson(revisionBasis(revision)));
    if (revision.digest !== expectedDigest) errors.push("revision_digest_invalid");
    genome = mergeGenome(genome, revision.genomeDelta);
    if (!validateGenome(genome).ok) errors.push("revision_genome_contract_invalid");
    if (revision.rendererVersion !== rendererVersionForGenome(genome)) errors.push("revision_renderer_version_invalid");
    if (revision.genomeDigest !== livingGenomeDigest(genome)) errors.push("revision_genome_invalid");
    if (revision.renderedArtDigest !== renderedArtDigest(genome, revision.formId, revision.title)) errors.push("revision_art_invalid");
    previousDigest = revision.digest;
  });
  const current = manifest.revisions.at(-1);
  if (current) {
    if (manifest.formId !== current.formId || manifest.stage !== current.stage) errors.push("current_projection_identity_invalid");
    if (canonicalPortableCardJson(manifest.stats) !== canonicalPortableCardJson(current.stats)) errors.push("current_projection_stats_invalid");
    if (canonicalPortableCardJson(manifest.abilityNames) !== canonicalPortableCardJson(current.abilityNames)) errors.push("current_projection_abilities_invalid");
  }
  if (asset.proof.kind !== "receiz.wilds_living_seal.v2" || asset.proof.digest !== manifestDigest(manifest)) errors.push("digest_mismatch");
  return { ok: errors.length === 0, errors };
}
