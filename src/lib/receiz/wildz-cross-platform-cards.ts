import {
  readPortableCardFromPng,
  readPortableVaultFromPng,
  verifyPortableCardPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import {
  canonicalPortableCardJson,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "../../features/play/portable-card";
import type { WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
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
};

const MAX_PORTABLE_NODES = 10_000;
const MAX_PORTABLE_DEPTH = 12;
const MAX_RESTORED_FILES = 1_000;
const MAX_RESTORED_BYTES = 64 * 1024 * 1024;

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
    && (manifestSchema.startsWith("receiz.wilds_card_manifest")
      || manifestSchema.startsWith("receiz.wilds_living_card_manifest")
      || proofKind.startsWith("receiz.wilds_"));
}

function proofMissing(error: unknown, label: "card" | "vault") {
  const message = error instanceof Error ? error.message : "";
  return message === (label === "card" ? "wilds_png_proof_missing" : "wilds_vault_proof_missing");
}

export function extractVerifiedWildzCards(input: {
  pngBasis: Uint8Array | null;
  verifiedPortableSnapshot: unknown | null;
  restoredVaultFiles: readonly RestoredReceizVaultFile[];
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

  const rememberSchema = (schema: string | null) => {
    if (!schema) return;
    (isWildzSchema(schema) ? sourceSchemas : unrelatedDomainSchemas).add(schema);
  };

  const admit = (asset: PortableCardAsset) => {
    const verified = verifyAnyWildsCard(asset);
    if (!verified.ok) throw new Error("wildz_restore_card_proof_invalid");
    const canonical = canonicalPortableCardJson(asset);
    const prior = canonicalById.get(asset.id);
    if (prior !== undefined && prior !== canonical) throw new Error("wildz_restore_duplicate_card_conflict");
    if (prior === undefined) {
      canonicalById.set(asset.id, canonical);
      assetsById.set(asset.id, asset);
    }
    rememberSchema(schemaOf(asset.manifest));
    rememberSchema(schemaOf(asset.proof));
  };

  const rememberPlayer = (candidate: WildsPlayerVaultPayload | null) => {
    if (!candidate) return;
    const canonical = canonicalPortableCardJson(candidate);
    if (playerCanonical !== null && playerCanonical !== canonical) throw new Error("wildz_restore_player_digest_invalid");
    player = candidate;
    playerCanonical = canonical;
    rememberSchema(candidate.schema);
  };

  const inspectPng = (bytes: Uint8Array) => {
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
      verified.assets.forEach(admit);
      rememberPlayer(verified.player);
    }
  };

  const seen = new WeakSet<object>();
  let visitedNodes = 0;
  const traverse = (value: unknown, depth: number) => {
    visitedNodes += 1;
    if (visitedNodes > MAX_PORTABLE_NODES || depth > MAX_PORTABLE_DEPTH) {
      throw new Error("wildz_restore_schema_unsupported");
    }
    if (!value || typeof value !== "object") return;
    if (isCardLike(value)) {
      admit(value);
      return;
    }
    if (seen.has(value)) throw new Error("wildz_restore_schema_unsupported");
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((child) => traverse(child, depth + 1));
      return;
    }
    const record = value as Record<string, unknown>;
    rememberSchema(schemaOf(record));
    Object.values(record).forEach((child) => traverse(child, depth + 1));
  };

  if (input.pngBasis) inspectPng(input.pngBasis);
  if (input.verifiedPortableSnapshot !== null) traverse(input.verifiedPortableSnapshot, 0);
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
      traverse(parsed, 0);
    }
  }

  return {
    assets: [...assetsById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    sourceSchemas: [...sourceSchemas].sort(),
    unrelatedDomainSchemas: [...unrelatedDomainSchemas].sort(),
    player
  };
}
