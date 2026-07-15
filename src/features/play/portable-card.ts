import type { ReceizedAsset } from "@/types/domain";
import {
  CREATURE_CATALOG_VERSION,
  creatureForm,
  type CreatureFoil,
  type CreatureRarity,
  type CreatureStage,
  type CreatureStats
} from "./creature-catalog";
import { deriveCardVariant, displayCreatureName, variantSeedFor, type CardVariantTraits } from "./card-variant";
import { admitLegacyCard, appendLivingCardRevision, currentLivingGenome, currentRevision, verifyLivingCard } from "./living-card-proof";
import { isLivingCardAsset, type LivingCardAsset } from "./living-card-types";
import { deriveHeartboundPresentation } from "./heartbound-anime-genome";

export type PortableCardStatus = "sealed_local" | "verified" | "listed" | "suspended" | "revoked";

export type PortableCardManifest = {
  schema: "receiz.wilds_card_manifest.v1";
  catalogVersion: typeof CREATURE_CATALOG_VERSION;
  assetId: string;
  formId: string;
  familyId: string;
  stage: CreatureStage;
  cardNumber: string;
  name: string;
  species: string;
  rarity: CreatureRarity;
  foil: CreatureFoil;
  stats: CreatureStats;
  abilityNames: readonly [string, string];
  ownerReceizId: string;
  encounterId: string;
  capturedAt: string;
  variant: {
    generatorVersion: 1;
    seed: string;
    traitsDigest: string;
    kaiPulse: string;
    battleTranscriptDigest: string;
    traits: CardVariantTraits;
  };
  lineage: {
    rootAssetId: string;
    rootDigest: string;
    previousAssetId: string | null;
    previousDigest: string | null;
    evolvedAt: string | null;
    parentAssetIds?: [string, string];
    parentDigests?: [string, string];
    fusionSparkId?: string;
  };
};

export type LegacyPortableCardAsset = {
  id: string;
  status: PortableCardStatus;
  synchronizedAt: string | null;
  manifest: PortableCardManifest;
  proof: {
    kind: "receiz.wilds_local_seal.v1";
    digest: string;
    canonicalization: "receiz.sorted-json.v1";
    sealedAt: string;
  };
};

export type PortableCardAsset = LegacyPortableCardAsset | LivingCardAsset;

export type PortableCardVerification = {
  ok: boolean;
  errors: string[];
};

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)])
    );
  }
  return value;
}

export function canonicalPortableCardJson(value: unknown) {
  return JSON.stringify(canonicalValue(value));
}

function rotateRight(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

// Small synchronous SHA-256 implementation keeps offline capture available in browsers and tests.
export function sha256PortableBasis(input: string) {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const words = new Array<number>(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] = ((bytes[start]! << 24) | (bytes[start + 1]! << 16) | (bytes[start + 2]! << 8) | bytes[start + 3]!) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15]!, 7) ^ rotateRight(words[index - 15]!, 18) ^ (words[index - 15]! >>> 3);
      const s1 = rotateRight(words[index - 2]!, 17) ^ rotateRight(words[index - 2]!, 19) ^ (words[index - 2]! >>> 10);
      words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = (rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25)) >>> 0;
      const choice = ((e! & f!) ^ (~e! & g!)) >>> 0;
      const temp1 = (h! + sum1 + choice + constants[index]! + words[index]!) >>> 0;
      const sum0 = (rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22)) >>> 0;
      const majority = ((a! & b!) ^ (a! & c!) ^ (b! & c!)) >>> 0;
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d! + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < 8; index += 1) hash[index] = (hash[index]! + next[index]!) >>> 0;
  }
  return `sha256:${hash.map((value) => value.toString(16).padStart(8, "0")).join("")}`;
}

function assetIdFor(input: { ownerReceizId: string; formId: string; encounterId: string }) {
  return `wilds:${sha256PortableBasis(canonicalPortableCardJson(input)).slice(7, 31)}`;
}

function manifestDigest(manifest: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(manifest));
}

export function sealCollectedCard(input: {
  formId: string;
  ownerReceizId: string;
  encounterId: string;
  capturedAt: string;
  kaiPulse?: string;
  battleTranscriptDigest?: string;
}): LegacyPortableCardAsset {
  const form = creatureForm(input.formId);
  if (!form || form.stage !== 1) throw new Error("wilds_capture_base_form_required");
  const ownerReceizId = input.ownerReceizId.trim();
  if (!ownerReceizId) throw new Error("wilds_card_owner_required");
  if (!input.encounterId.trim()) throw new Error("wilds_card_encounter_required");
  if (!Number.isFinite(Date.parse(input.capturedAt))) throw new Error("wilds_card_capture_time_invalid");
  const assetId = assetIdFor({ ownerReceizId, formId: form.id, encounterId: input.encounterId });
  const kaiPulse = input.kaiPulse ?? String(Date.parse(input.capturedAt));
  const battleTranscriptDigest = input.battleTranscriptDigest ?? "sha256:none";
  const variantSeed = variantSeedFor({
    formId: form.id,
    encounterId: input.encounterId,
    ownerReceizId,
    capturedAt: input.capturedAt,
    kaiPulse,
    battleTranscriptDigest
  });
  const variantTraits = deriveCardVariant(variantSeed, 1);
  const manifest: PortableCardManifest = {
    schema: "receiz.wilds_card_manifest.v1",
    catalogVersion: CREATURE_CATALOG_VERSION,
    assetId,
    formId: form.id,
    familyId: form.familyId,
    stage: form.stage,
    cardNumber: form.cardNumber,
    name: displayCreatureName(form.id, form.name),
    species: form.species,
    rarity: form.rarity,
    foil: form.foil,
    stats: { ...form.stats },
    abilityNames: [form.abilities[0].name, form.abilities[1].name],
    ownerReceizId,
    encounterId: input.encounterId,
    capturedAt: input.capturedAt,
    variant: {
      generatorVersion: 1,
      seed: variantSeed,
      traitsDigest: sha256PortableBasis(canonicalPortableCardJson(variantTraits)),
      kaiPulse,
      battleTranscriptDigest,
      traits: variantTraits
    },
    lineage: {
      rootAssetId: assetId,
      rootDigest: "self",
      previousAssetId: null,
      previousDigest: null,
      evolvedAt: null
    }
  };
  const digest = manifestDigest(manifest);
  manifest.lineage.rootDigest = digest;
  const finalDigest = manifestDigest(manifest);
  manifest.lineage.rootDigest = finalDigest;
  const proofDigest = manifestDigest(manifest);
  return {
    id: assetId,
    status: "sealed_local",
    synchronizedAt: null,
    manifest,
    proof: {
      kind: "receiz.wilds_local_seal.v1",
      digest: proofDigest,
      canonicalization: "receiz.sorted-json.v1",
      sealedAt: input.capturedAt
    }
  };
}

export function verifyPortableCard(asset: PortableCardAsset): PortableCardVerification {
  const errors: string[] = [];
  const manifest = asset.manifest;
  const form = creatureForm(manifest.formId);
  if (manifest.schema !== "receiz.wilds_card_manifest.v1") errors.push("schema_invalid");
  if (manifest.catalogVersion !== CREATURE_CATALOG_VERSION) errors.push("catalog_version_invalid");
  if (!form) errors.push("form_unknown");
  if (!manifest.ownerReceizId.trim()) errors.push("owner_required");
  if (manifest.assetId !== asset.id) errors.push("asset_id_mismatch");
  if (form) {
    if (manifest.familyId !== form.familyId || manifest.stage !== form.stage || manifest.cardNumber !== form.cardNumber) errors.push("catalog_identity_mismatch");
    if (canonicalPortableCardJson(manifest.stats) !== canonicalPortableCardJson(form.stats)) errors.push("stats_mismatch");
    if (canonicalPortableCardJson(manifest.abilityNames) !== canonicalPortableCardJson(form.abilities.map((ability) => ability.name))) errors.push("abilities_mismatch");
  }
  if (form && manifest.variant) {
    const expectedSeed = variantSeedFor({
      formId: manifest.formId,
      encounterId: manifest.encounterId,
      ownerReceizId: manifest.ownerReceizId,
      capturedAt: manifest.capturedAt,
      kaiPulse: manifest.variant.kaiPulse,
      battleTranscriptDigest: manifest.variant.battleTranscriptDigest
    });
    const expectedTraits = deriveCardVariant(expectedSeed, 1);
    if (manifest.variant.generatorVersion !== 1 || manifest.variant.seed !== expectedSeed) errors.push("variant_seed_mismatch");
    if (canonicalPortableCardJson(manifest.variant.traits) !== canonicalPortableCardJson(expectedTraits)) errors.push("variant_traits_mismatch");
    if (manifest.variant.traitsDigest !== sha256PortableBasis(canonicalPortableCardJson(expectedTraits))) errors.push("variant_digest_mismatch");
  } else {
    errors.push("variant_required");
  }
  if (asset.proof.digest !== manifestDigest(manifest)) errors.push("digest_mismatch");
  return { ok: errors.length === 0, errors };
}

export function verifyAnyWildsCard(asset: PortableCardAsset): PortableCardVerification {
  return isLivingCardAsset(asset) ? verifyLivingCard(asset) : verifyPortableCard(asset);
}

export type VerifiedPortableCardPin = {
  assetId: string;
  proofDigest: string;
  ownerReceizId: string;
  formId: string;
};

/** Pins the exact proof admitted to an authoritative activity without retaining mutable card data. */
export function verifiedPortableCardPin(asset: PortableCardAsset): VerifiedPortableCardPin {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_activity_card_verification_failed");
  return {
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    ownerReceizId: asset.manifest.ownerReceizId,
    formId: asset.manifest.formId
  };
}

export function evolvePortableCard(input: {
  previous: PortableCardAsset;
  nextFormId: string;
  evolvedAt: string;
  growth?: LivingCardAsset["manifest"]["revisions"][number]["growth"];
}): LivingCardAsset {
  const verified = verifyAnyWildsCard(input.previous);
  if (!verified.ok) throw new Error("wilds_previous_card_invalid");
  const living = isLivingCardAsset(input.previous) ? input.previous : admitLegacyCard(input.previous, input.evolvedAt);
  const next = creatureForm(input.nextFormId);
  if (!next || next.evolvesFromId !== living.manifest.formId) throw new Error("wilds_evolution_lineage_invalid");
  if (!Number.isFinite(Date.parse(input.evolvedAt))) throw new Error("wilds_evolution_time_invalid");
  const prior = currentRevision(living);
  const currentGenome = currentLivingGenome(living);
  const nextAnatomy = { ...next.anatomy };
  const nextPresentation = currentGenome.generatorVersion === 3
    ? deriveHeartboundPresentation({ genome: { ...currentGenome, anatomy: nextAnatomy, presentation: undefined }, stage: next.stage, ascensionRank: prior.ascensionRank })
    : undefined;
  return appendLivingCardRevision({
    asset: living,
    revision: {
      sealedAt: input.evolvedAt,
      kaiPulse: String(Date.parse(input.evolvedAt)),
      reason: { kind: "stage", label: `Earned evolution into ${next.name}` },
      stage: next.stage,
      ascensionRank: prior.ascensionRank,
      formId: next.id,
      growth: input.growth ?? prior.growth,
      qualifyingAchievementIds: [],
      consumedCatalystId: `catalog-stage:${next.id}`,
      genomeDelta: {
        anatomy: nextAnatomy,
        ...(nextPresentation ? { presentation: nextPresentation } : {}),
        provenance: {
          ...living.manifest.birthGenome.provenance,
          skeleton: "ascension",
          appendages: "ascension",
          surface: "ascension",
          aura: "ascension"
        }
      },
      stats: { ...next.stats },
      abilityNames: [next.abilities[0].name, next.abilities[1].name],
      title: displayCreatureName(next.id, next.name),
      childEventIds: []
    }
  });
}

export function portableCardExchangeAsset(asset: PortableCardAsset, priceCents: number, custodyOwnerReceizId = asset.manifest.ownerReceizId): ReceizedAsset {
  if (asset.status !== "verified" && asset.status !== "listed") throw new Error("wilds_card_sync_required");
  const verification = verifyAnyWildsCard(asset);
  if (!verification.ok) throw new Error("wilds_card_verification_failed");
  if (!Number.isInteger(priceCents) || priceCents <= 0 || priceCents > 100_000_000) throw new Error("exchange_listing_price_invalid");
  const listingOwner = custodyOwnerReceizId.trim();
  if (!listingOwner) throw new Error("exchange_listing_owner_required");
  const form = creatureForm(asset.manifest.formId)!;
  const claimId = asset.proof.digest.slice(7, 39);
  const pulse = String(Date.parse(asset.proof.sealedAt));
  const verifyPath = `/verify?claim=${encodeURIComponent(claimId)}&pulse=${encodeURIComponent(pulse)}`;
  return {
    id: asset.id,
    name: asset.manifest.name,
    type: "limited_drop",
    ownerId: listingOwner,
    status: asset.status === "listed" ? "listed" : "owned",
    priceLabel: `$${(priceCents / 100).toFixed(2)}`,
    proofSource: claimId,
    manifest: {
      schema: "receiz.asset_manifest.v1",
      assetId: asset.id,
      assetType: "sports_card",
      proof: {
        kind: "receiz.proof_bundle",
        verifyUrl: verifyPath,
        kaiPulseEternal: pulse,
        kaiKlok: `kai:${pulse}`,
        receizClaimId: claimId,
        artifactSha256Basis: asset.proof.digest
      },
      owner: {
        receizSubject: listingOwner,
        displayName: listingOwner,
        custody: asset.status === "listed" ? "fractionalized" : "current"
      },
      links: { verify: verifyPath }
    },
    verifiedArtifact: {
      filename: `${form.id}.receiz-card.json`,
      kind: asset.proof.kind,
      verifiedAt: asset.synchronizedAt ?? asset.proof.sealedAt,
      warnings: [],
      sha256Basis: asset.proof.digest
    }
  };
}
