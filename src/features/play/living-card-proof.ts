import { creatureForm } from "./creature-catalog";
import { deriveCardVariantV2, deriveCardVariantV3, variantSeedFor } from "./card-variant";
import { deriveKaiCreatureBirth } from "./kai-creature-birth";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse } from "./kai-klok-moment";
import { validateLivingCreatureIdentity } from "./living-taxonomy";
import { deriveBirthGenome, genomeDigest, mergeLivingGenome, validateGenome } from "./heartbound-genome";
import { emptyAdventureCondition } from "./adventure/card-condition";
import {
  appendCreatureHistoryEvent,
  compareCreatureHistoryHeads,
  createCreatureHistory,
  isCreatureHistoryDescendant,
  verifyCreatureHistory
} from "./creature-history";
import type {
  CreatureHistoryAuthorityVerifier,
  CreatureHistoryEventDraft,
  CreatureHistoryProjection,
  CreatureRetirementAuthorityVerifier
} from "./creature-history-types";
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

function historyProjectionForRevision(
  assetId: string,
  revision: LivingCardRevision,
  prior?: CreatureHistoryProjection
): CreatureHistoryProjection {
  const priorGrowth = prior?.growth;
  const growth: LivingGrowthSnapshot = priorGrowth ? {
    ...revision.growth,
    bond: Math.max(priorGrowth.bond, revision.growth.bond),
    paths: Object.fromEntries((Object.keys(priorGrowth.paths) as Array<keyof LivingGrowthSnapshot["paths"]>).map((path) => [
      path,
      Math.max(priorGrowth.paths[path], revision.growth.paths[path])
    ])) as LivingGrowthSnapshot["paths"],
    eventIds: Array.from(new Set([...priorGrowth.eventIds, ...revision.growth.eventIds])),
    achievementIds: Array.from(new Set([...priorGrowth.achievementIds, ...revision.growth.achievementIds])),
    consumedAchievementIds: Array.from(new Set([...priorGrowth.consumedAchievementIds, ...revision.growth.consumedAchievementIds])),
    completedQuestIds: Array.from(new Set([...priorGrowth.completedQuestIds, ...revision.growth.completedQuestIds])),
    life: revision.growth.life ?? priorGrowth.life
  } : structuredClone(revision.growth);
  const life = growth.life;
  const baseCondition = prior?.condition ?? emptyAdventureCondition(assetId);
  const condition = life?.retired
    ? {
        ...baseCondition,
        life: "dead" as const,
        fatigue: 100,
        retiredAt: life.retirement?.retiredAt ?? revision.sealedAt,
        retirementCauseEventId: life.retirement?.sealDigest ?? life.eventIds.at(-1) ?? `retirement:${revision.digest}`
      }
    : baseCondition;
  return {
    schema: "receiz.wildz.creature_history_projection.v1",
    assetId,
    level: prior?.level ?? 1,
    xp: prior?.xp ?? 0,
    bond: growth.bond,
    growth,
    condition,
    mastery: { ...condition.mastery },
    record: {
      wins: life?.victories ?? prior?.record.wins ?? 0,
      losses: life?.losses ?? prior?.record.losses ?? 0,
      draws: prior?.record.draws ?? 0,
      retreats: life?.retreats ?? prior?.record.retreats ?? 0,
      rescues: prior?.record.rescues ?? 0,
      tags: prior?.record.tags ?? 0,
      bossVictories: prior?.record.bossVictories ?? 0
    },
    achievements: Array.from(new Set([...(prior?.achievements ?? []), ...growth.achievementIds])),
    relationships: [...(prior?.relationships ?? [])],
    scars: Array.from(new Set([...(prior?.scars ?? []), ...(life?.repairedScars ?? [])])),
    upgrades: [...(prior?.upgrades ?? [])],
    formId: revision.formId,
    stage: revision.stage,
    ascensionRank: revision.ascensionRank,
    livingRevisionDigest: revision.digest
  };
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
    revisions: [revision],
    history: createCreatureHistory({
      assetId: legacy.id,
      rootProofDigest: legacy.proof.digest,
      rulesetVersion: "wildz.creature-history.v1",
      occurredAt: revision.sealedAt,
      actorId: legacy.manifest.ownerReceizId,
      projection: historyProjectionForRevision(legacy.id, revision)
    })
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

export function currentCreatureHistoryProjection(asset: LivingCardAsset) {
  return asset.manifest.history?.projection
    ?? historyProjectionForRevision(asset.id, currentRevision(asset));
}

export function appendLivingCardHistory(input: { asset: LivingCardAsset; event: CreatureHistoryEventDraft }): LivingCardAsset {
  const checked = verifyLivingCard(input.asset);
  if (!checked.ok) throw new Error("wilds_living_previous_invalid");
  const prior = currentRevision(input.asset);
  const history = input.asset.manifest.history ?? createCreatureHistory({
    assetId: input.asset.id,
    rootProofDigest: input.asset.manifest.birth.legacyDigest ?? input.asset.proof.digest,
    rulesetVersion: "wildz.creature-history.v1",
    occurredAt: prior.sealedAt,
    actorId: input.asset.manifest.ownerReceizId,
    projection: historyProjectionForRevision(input.asset.id, prior),
    completeness: "legacy-checkpoint"
  });
  const appended = appendCreatureHistoryEvent(history, input.event);
  if (appended === history) return input.asset;
  const manifest = { ...input.asset.manifest, history: appended };
  return {
    ...input.asset,
    manifest,
    proof: { ...input.asset.proof, digest: manifestDigest(manifest), sealedAt: input.event.occurredAt }
  };
}

export function isLivingCardHistoryDescendant(ancestor: LivingCardAsset, descendant: LivingCardAsset) {
  if (ancestor.id !== descendant.id) return false;
  const left = ancestor.manifest.history;
  const right = descendant.manifest.history;
  if (!left || !right) return Boolean(!left && right);
  return isCreatureHistoryDescendant(left, right);
}

export function compareLivingCardHistoryHeads(left: LivingCardAsset, right: LivingCardAsset, verifier?: CreatureHistoryAuthorityVerifier) {
  if (left.id !== right.id || !left.manifest.history || !right.manifest.history) throw new Error("creature_history_root_conflict");
  return compareCreatureHistoryHeads(left.manifest.history, right.manifest.history, verifier);
}

export function livingCardHasIrreversibleMortality(asset: LivingCardAsset) {
  return Boolean(currentRevision(asset).growth.life?.retired)
    || currentCreatureHistoryProjection(asset).condition.life === "dead";
}

export function verifyLivingCardRetirementAuthority(
  asset: LivingCardAsset,
  verifier?: CreatureRetirementAuthorityVerifier
) {
  if (!livingCardHasIrreversibleMortality(asset)) return true;
  const revision = currentRevision(asset);
  const retirement = revision.growth.life?.retirement;
  const history = asset.manifest.history;
  if (!retirement || !history || !verifier) return false;
  try {
    return verifier.verifyRetirement({
      schema: "receiz.wildz.creature_retirement_authority_evidence.v1",
      assetId: asset.id,
      cardProofDigest: asset.proof.digest,
      revisionDigest: revision.digest,
      historyHeadDigest: history.headDigest,
      matchReceiptDigest: retirement.matchReceiptDigest,
      retirementSealDigest: retirement.sealDigest,
      retiredAt: retirement.retiredAt,
      previousRevisionDigest: retirement.previousRevisionDigest
    }) === true;
  } catch {
    return false;
  }
}

export function appendLivingCardRevision(input: { asset: LivingCardAsset; revision: LivingCardRevisionDraft; lineageChildAssetId?: string; historyKaiUPulse?: number }): LivingCardAsset {
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
    revisions: [...input.asset.manifest.revisions, revision],
    history: input.asset.manifest.history
      ? appendCreatureHistoryEvent(input.asset.manifest.history, {
          eventId: `living-revision:${revision.digest}`,
          rulesetVersion: "wildz.living-revision.v1",
          occurredAt: revision.sealedAt,
          ...(input.historyKaiUPulse === undefined ? {} : {
            kai: (() => {
              const moment = deriveKaiKlokMomentFromUPulse({ uPulse: input.historyKaiUPulse, authority: "admitted" });
              return {
                uPulse: moment.uPulse,
                pulse: moment.pulse,
                beat: moment.beat,
                stepIndex: moment.stepIndex,
                weekday: moment.weekday,
                chakra: moment.chakra,
                coordinate: moment.coordinate
              };
            })()
          }),
          source: {
            mode: "living-revision",
            activityId: `living-revision:${revision.revision}`,
            actorId: input.asset.manifest.ownerReceizId,
            authority: "local"
          },
          evidence: {},
          effects: [{
            kind: "legacy-checkpoint",
            projection: historyProjectionForRevision(input.asset.id, revision, input.asset.manifest.history.projection)
          }]
        })
      : undefined
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
  if (manifest.history) {
    const history = verifyCreatureHistory(manifest.history);
    history.errors.forEach((error) => errors.push(`history_${error}`));
    if (manifest.history.assetId !== asset.id
      || (manifest.birth.legacyDigest && manifest.history.rootProofDigest !== manifest.birth.legacyDigest)) {
      errors.push("history_root_invalid");
    }
    if (current && (manifest.history.projection.formId !== current.formId
      || manifest.history.projection.stage !== current.stage
      || manifest.history.projection.ascensionRank !== current.ascensionRank
      || manifest.history.projection.livingRevisionDigest !== current.digest)) {
      errors.push("history_revision_projection_invalid");
    }
  }
  if (asset.proof.kind !== "receiz.wilds_living_seal.v2" || asset.proof.digest !== manifestDigest(manifest)) errors.push("digest_mismatch");
  return { ok: errors.length === 0, errors };
}
