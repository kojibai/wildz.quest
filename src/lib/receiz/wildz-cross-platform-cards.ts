import {
  readPortableCardFromPng,
  readWildzProofAppendsFromPng,
  readPortableVaultFromPng,
  verifyPortableCardPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import {
  canonicalPortableCardJson,
  portableCardBaseProofAsset,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "../../features/play/portable-card";
import { admitLegacyCard } from "../../features/play/living-card-proof";
import { isLivingCardAsset, type LivingCardAsset } from "../../features/play/living-card-types";
import {
  verifyWildsPlayerVault,
  type WildsPlayerVaultPayload
} from "../../features/play/wilds-player-vault";
import { isWildzPng, splitWildzPngEnvelope } from "./wildz-png-envelope";

export type RestoredReceizVaultFile = {
  fileId: string;
  path: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type WildzCrossPlatformCardExtraction = {
  assets: PortableCardAsset[];
  sourceSchemas: string[];
  unrelatedDomainSchemas: string[];
  player: WildsPlayerVaultPayload | null;
  playerSource: "png" | "portable-snapshot" | "restored-file" | "proof-object" | null;
};

export type WildzPortableProofObjectPayload = {
  bytes: Uint8Array;
  mimeType: string;
};

const MAX_PORTABLE_NODES = 10_000;
const MAX_PORTABLE_DEPTH = 12;
const MAX_RESTORED_FILES = 1_000;
const MAX_RESTORED_BYTES = 64 * 1024 * 1024;

function livingOriginBasis(asset: LivingCardAsset) {
  const {
    evolvedAt: _evolvedAt,
    childAssetIds: _childAssetIds,
    ...lineageOrigin
  } = asset.manifest.lineage;
  return canonicalPortableCardJson({
    schema: asset.manifest.schema,
    catalogVersion: asset.manifest.catalogVersion,
    assetId: asset.manifest.assetId,
    familyId: asset.manifest.familyId,
    ownerReceizId: asset.manifest.ownerReceizId,
    encounterId: asset.manifest.encounterId,
    capturedAt: asset.manifest.capturedAt,
    variant: asset.manifest.variant,
    lineage: lineageOrigin,
    birth: asset.manifest.birth,
    birthGenome: asset.manifest.birthGenome
  });
}

function sameLivingOrigin(ancestor: LivingCardAsset, descendant: LivingCardAsset) {
  return livingOriginBasis(ancestor) === livingOriginBasis(descendant)
    && ancestor.manifest.lineage.childAssetIds.every(
      (assetId) => descendant.manifest.lineage.childAssetIds.includes(assetId)
    );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function schemaOf(value: unknown) {
  const record = asRecord(value);
  return typeof record?.schema === "string" ? record.schema : null;
}

function isWildzSchema(schema: string) {
  return schema.startsWith("receiz.wilds") || schema.startsWith("wildz.");
}

function isCardLike(value: unknown): value is PortableCardAsset {
  const record = asRecord(value);
  const manifest = asRecord(record?.manifest);
  const proof = asRecord(record?.proof);
  const manifestSchema = typeof manifest?.schema === "string" ? manifest.schema : "";
  const proofKind = typeof proof?.kind === "string" ? proof.kind : "";
  return typeof record?.id === "string"
    && (manifestSchema === "receiz.wilds_card_manifest.v1"
      || manifestSchema === "receiz.wilds_living_card_manifest.v2"
      || proofKind === "receiz.wilds_local_seal.v1"
      || proofKind === "receiz.wilds_living_seal.v2");
}

function proofMissing(error: unknown, label: "card" | "vault") {
  const message = error instanceof Error ? error.message : "";
  return message === (label === "card" ? "wilds_png_proof_missing" : "wilds_vault_proof_missing");
}

export function extractVerifiedWildzCards(input: {
  pngBasis: Uint8Array | null;
  verifiedPortableSnapshot: unknown | null;
  restoredVaultFiles: readonly RestoredReceizVaultFile[];
  proofObjectPayload?: WildzPortableProofObjectPayload | null;
}): WildzCrossPlatformCardExtraction {
  if (input.restoredVaultFiles.length > MAX_RESTORED_FILES) throw new Error("wildz_restore_schema_unsupported");
  const restoredBytes = input.restoredVaultFiles.reduce((total, file) => total + file.bytes.byteLength, 0);
  if (restoredBytes > MAX_RESTORED_BYTES) throw new Error("wildz_restore_artifact_too_large");

  const sourceSchemas = new Set<string>();
  const unrelatedDomainSchemas = new Set<string>();
  const canonicalById = new Map<string, string>();
  const assetsById = new Map<string, PortableCardAsset>();
  let player: WildsPlayerVaultPayload | null = null;
  let playerCanonical: string | null = null;
  let playerSource: WildzCrossPlatformCardExtraction["playerSource"] = null;

  const rememberSchema = (schema: string | null) => {
    if (!schema) return;
    (isWildzSchema(schema) ? sourceSchemas : unrelatedDomainSchemas).add(schema);
  };

  const isVerifiedDescendant = (ancestor: PortableCardAsset, descendant: PortableCardAsset) => {
    if (ancestor.id !== descendant.id || !isLivingCardAsset(descendant)) return false;
    if (!isLivingCardAsset(ancestor)) {
      if (descendant.manifest.birth.kind !== "legacy_admission"
        || descendant.manifest.birth.legacyDigest !== ancestor.proof.digest) return false;
      const admitted = admitLegacyCard(ancestor, descendant.proof.sealedAt);
      return sameLivingOrigin(admitted, descendant)
        && admitted.manifest.revisions.every(
          (revision, index) => descendant.manifest.revisions[index]?.digest === revision.digest
        );
    }
    return sameLivingOrigin(ancestor, descendant)
      && descendant.manifest.revisions.length > ancestor.manifest.revisions.length
      && ancestor.manifest.revisions.every(
        (revision, index) => descendant.manifest.revisions[index]?.digest === revision.digest
      );
  };

  const admit = (asset: PortableCardAsset) => {
    let verified: ReturnType<typeof verifyAnyWildsCard>;
    try {
      verified = verifyAnyWildsCard(asset);
    } catch {
      throw new Error("wildz_restore_card_proof_invalid");
    }
    if (!verified.ok) throw new Error("wildz_restore_card_proof_invalid");
    const canonical = canonicalPortableCardJson(asset);
    const prior = canonicalById.get(asset.id);
    if (prior !== undefined && prior !== canonical) {
      const priorAsset = assetsById.get(asset.id)!;
      if (isVerifiedDescendant(priorAsset, asset)) {
        canonicalById.set(asset.id, canonical);
        assetsById.set(asset.id, asset);
      } else if (!isVerifiedDescendant(asset, priorAsset)) {
        throw new Error("wildz_restore_duplicate_card_conflict");
      }
    }
    if (prior === undefined) {
      canonicalById.set(asset.id, canonical);
      assetsById.set(asset.id, asset);
    }
    rememberSchema(schemaOf(asset.manifest));
    rememberSchema(schemaOf(asset.proof));
  };

  const admitBoundAppend = (asset: PortableCardAsset, basesById: Map<string, string>) => {
    let verified: ReturnType<typeof verifyAnyWildsCard>;
    let base: PortableCardAsset;
    try {
      verified = verifyAnyWildsCard(asset);
      if (!verified.ok) throw new Error(verified.errors[0]);
      base = portableCardBaseProofAsset(asset);
    } catch {
      throw new Error("wildz_restore_card_proof_invalid");
    }
    if (basesById.get(base.id) !== base.proof.digest) throw new Error("wildz_restore_card_proof_invalid");
    const canonical = canonicalPortableCardJson(asset);
    const prior = canonicalById.get(asset.id);
    if (prior !== undefined && prior !== canonical) {
      const priorAsset = assetsById.get(asset.id)!;
      const priorIsVerifiedBase = priorAsset.proof.digest === base.proof.digest
        && canonicalPortableCardJson(priorAsset) === canonicalPortableCardJson(base);
      if (!priorIsVerifiedBase && !isVerifiedDescendant(priorAsset, asset)) {
        throw new Error("wildz_restore_duplicate_card_conflict");
      }
    }
    canonicalById.set(asset.id, canonical);
    assetsById.set(asset.id, asset);
    rememberSchema(schemaOf(asset.manifest));
    rememberSchema(schemaOf(asset.proof));
  };

  const rememberPlayer = (
    candidate: WildsPlayerVaultPayload | null,
    source: Exclude<WildzCrossPlatformCardExtraction["playerSource"], null>
  ) => {
    if (!candidate) return;
    let canonical: string;
    try {
      const verified = verifyWildsPlayerVault(candidate);
      if (!verified.ok) throw new Error(verified.errors[0]);
      canonical = canonicalPortableCardJson(candidate);
      candidate.playState.inventory.forEach(admit);
    } catch (error) {
      if (error instanceof Error && error.message === "wildz_restore_duplicate_card_conflict") throw error;
      throw new Error("wildz_restore_player_digest_invalid");
    }
    if (playerCanonical !== null && playerCanonical !== canonical) throw new Error("wildz_restore_player_digest_invalid");
    player = candidate;
    playerCanonical = canonical;
    if (playerSource === null || (source === "portable-snapshot" && playerSource !== "portable-snapshot")) {
      playerSource = source;
    }
    rememberSchema(candidate.schema);
  };

  const inspectPng = (bytes: Uint8Array) => {
    const basesById = new Map<string, string>();
    let cardProofPresent = false;
    try {
      const proof = readPortableCardFromPng(bytes);
      cardProofPresent = true;
      rememberSchema(proof.schema);
    } catch (error) {
      if (!proofMissing(error, "card")) throw new Error("wildz_restore_card_proof_invalid");
    }
    if (cardProofPresent) {
      const verified = verifyPortableCardPng(bytes);
      if (!verified.ok || !verified.asset) throw new Error("wildz_restore_card_proof_invalid");
      admit(verified.asset);
      basesById.set(verified.asset.id, verified.asset.proof.digest);
    }

    let vaultProofPresent = false;
    try {
      const proof = readPortableVaultFromPng(bytes);
      vaultProofPresent = true;
      rememberSchema(proof.schema);
    } catch (error) {
      if (!proofMissing(error, "vault")) throw new Error("wildz_restore_card_proof_invalid");
    }
    if (vaultProofPresent) {
      const verified = verifyPortableVaultPng(bytes);
      if (!verified.ok) {
        if (verified.errors.some((error) => error.includes("duplicate_card_conflict"))) {
          throw new Error("wildz_restore_duplicate_card_conflict");
        }
        if (verified.errors.some((error) => error.includes("player:"))) {
          throw new Error("wildz_restore_player_digest_invalid");
        }
        throw new Error("wildz_restore_card_proof_invalid");
      }
      verified.assets.forEach((asset) => {
        admit(asset);
        basesById.set(asset.id, asset.proof.digest);
      });
      rememberPlayer(verified.player, "png");
    }

    try {
      for (const append of readWildzProofAppendsFromPng(bytes)) {
        rememberSchema(append.schema);
        if (basesById.get(append.base.assetId) !== append.base.proofDigest) {
          throw new Error("wildz_restore_card_proof_invalid");
        }
        admitBoundAppend(append.asset, basesById);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "wildz_restore_card_proof_invalid") throw error;
      throw new Error("wildz_restore_card_proof_invalid");
    }
  };

  const seen = new WeakSet<object>();
  let visitedNodes = 0;
  const traverse = (
    value: unknown,
    depth: number,
    source: "portable-snapshot" | "restored-file" | "proof-object"
  ) => {
    if (!value || typeof value !== "object") return;
    visitedNodes += 1;
    if (visitedNodes > MAX_PORTABLE_NODES || depth > MAX_PORTABLE_DEPTH) {
      throw new Error("wildz_restore_schema_unsupported");
    }
    if (schemaOf(value) === "receiz.wilds_player_vault.v3") {
      rememberPlayer(value as WildsPlayerVaultPayload, source);
      return;
    }
    if (isCardLike(value)) {
      admit(value);
      return;
    }
    if (seen.has(value)) throw new Error("wildz_restore_schema_unsupported");
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((child) => traverse(child, depth + 1, source));
      return;
    }
    const record = value as Record<string, unknown>;
    rememberSchema(schemaOf(record));
    Object.values(record).forEach((child) => traverse(child, depth + 1, source));
  };

  if (input.pngBasis) inspectPng(input.pngBasis);
  if (input.verifiedPortableSnapshot !== null) traverse(input.verifiedPortableSnapshot, 0, "portable-snapshot");
  if (input.proofObjectPayload) {
    if (isWildzPng(input.proofObjectPayload.bytes)) {
      inspectPng(splitWildzPngEnvelope(input.proofObjectPayload.bytes).pngBasis);
    } else if (input.proofObjectPayload.mimeType === "application/json"
      || input.proofObjectPayload.mimeType.endsWith("+json")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.proofObjectPayload.bytes)) as unknown;
      } catch {
        throw new Error("wildz_restore_schema_unsupported");
      }
      traverse(parsed, 0, "proof-object");
    } else {
      throw new Error("wildz_restore_schema_unsupported");
    }
  }
  for (const file of input.restoredVaultFiles) {
    if (isWildzPng(file.bytes)) {
      inspectPng(splitWildzPngEnvelope(file.bytes).pngBasis);
      continue;
    }
    if (file.mimeType === "application/json" || file.name.toLowerCase().endsWith(".json") || file.path.toLowerCase().endsWith(".json")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file.bytes)) as unknown;
      } catch {
        throw new Error("wildz_restore_schema_unsupported");
      }
      traverse(parsed, 0, "restored-file");
    }
  }

  return {
    assets: [...assetsById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    sourceSchemas: [...sourceSchemas].sort(),
    unrelatedDomainSchemas: [...unrelatedDomainSchemas].sort(),
    player,
    playerSource
  };
}
