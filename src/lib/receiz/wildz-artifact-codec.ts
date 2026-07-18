import {
  projectReceizIdentityAccount,
  readReceizIdentityArtifact,
  type ReceizKeyFile
} from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "../../features/play/portable-card";
import { readReceizProofObjectFromPng } from "../../features/play/card-export";
import type { WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import type {
  PreparedWildzIdentity,
  WildzIdentityRepository,
  WildzIdentitySession
} from "./wildz-identity-repository";
import type {
  ReceizCommerceVaultInspection,
  ReceizCommerceVaultProjection
} from "./receiz-commerce-vault";
import {
  extractVerifiedWildzCards,
  type RestoredReceizVaultFile,
  type WildzCrossPlatformCardExtraction
} from "./wildz-cross-platform-cards";
import { isWildzPng, splitWildzPngEnvelope } from "./wildz-png-envelope";
import { requireWildzIdentityBindingFromEnvelope } from "./wildz-identity-binding";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildzAdmittedArtifact } from "./wildz-artifact-custody";

export type WildzPlayerBinding = "identity-portable-state" | "identity-v3-binding" | "artifact-v4-required" | null;

export type WildzProofObjectContinuity = {
  schema: "receiz.wildz.verified_artifact.v111";
  compatibility: WildzAdmittedArtifact["compatibility"];
  ownerReceizId: string;
  custody: "v111-verified-artifact";
  proofRef: string;
  provenanceRoot: string;
  payloadSha256: string;
  payloadMimeType: string;
  artifactBasisSha256: string;
  artifactBytes: Uint8Array;
  proofClaimId: string;
};

export type WildzRestoreErrorCode =
  | "wildz_restore_identity_missing"
  | "wildz_restore_identity_invalid"
  | "wildz_restore_artifact_too_large"
  | "wildz_restore_portable_signature_invalid"
  | "wildz_restore_card_proof_invalid"
  | "wildz_restore_duplicate_card_conflict"
  | "wildz_restore_player_digest_invalid"
  | "wildz_restore_binding_invalid"
  | "wildz_restore_owner_mismatch"
  | "wildz_restore_schema_unsupported"
  | "wildz_restore_storage_failed"
  | "wildz_restore_remote_session_unavailable"
  | "wildz_restore_cursor_stale"
  | "wildz_restore_sync_pending";

export type VerifiedWildzIdentity = {
  session: WildzIdentitySession;
  prepared: PreparedWildzIdentity;
};

export type WildzArtifactInspection =
  | {
      kind: "identity-seal";
      identity: VerifiedWildzIdentity;
      portableAssets: PortableCardAsset[];
      portableDomainSchemas: string[];
      player: WildsPlayerVaultPayload | null;
      playerBinding: WildzPlayerBinding;
    }
  | {
      kind: "card-vault";
      identity?: VerifiedWildzIdentity | null;
      assets: PortableCardAsset[];
      vaultDigest: string;
      player: WildsPlayerVaultPayload | null;
      playerBinding: WildzPlayerBinding;
      proofObject: WildzProofObjectContinuity | null;
    }
  | {
      kind: "commerce-vault";
      identity: VerifiedWildzIdentity | null;
      assets: PortableCardAsset[];
      sourceSchemas: string[];
      unrelatedDomainSchemas: string[];
      projection: ReceizCommerceVaultProjection;
      player: WildsPlayerVaultPayload | null;
      playerBinding: WildzPlayerBinding;
    }
  | { kind: "unsupported"; code: "wildz_artifact_unsupported" }
  | { kind: "invalid"; code: WildzRestoreErrorCode; errors: string[] };

export interface WildzArtifactCodec {
  inspect(input: { bytes: Uint8Array; mimeType: string; name?: string }): Promise<WildzArtifactInspection>;
}

export type { RestoredReceizVaultFile, WildzCrossPlatformCardExtraction };

export interface ReceizCommerceVaultReader {
  inspect(input: { bytes: Uint8Array; mimeType: string; name?: string }): Promise<ReceizCommerceVaultInspection | null>;
}

export interface WildzArtifactOpener {
  open(input: { bytes: Uint8Array; mimeType: string; name?: string }): Promise<WildzAdmittedArtifact>;
}

const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;

function invalid(code: WildzRestoreErrorCode): Extract<WildzArtifactInspection, { kind: "invalid" }> {
  return { kind: "invalid", code, errors: [code] };
}

function normalizedError(error: unknown): WildzRestoreErrorCode {
  const message = error instanceof Error ? error.message : "";
  if (message === "wildz_restore_duplicate_card_conflict" || message.includes("duplicate_card_conflict")) {
    return "wildz_restore_duplicate_card_conflict";
  }
  if (message === "wildz_restore_player_digest_invalid" || message.includes("player_vault")) {
    return "wildz_restore_player_digest_invalid";
  }
  if (message === "wildz_restore_portable_signature_invalid" || message.includes("portable_state")) {
    return "wildz_restore_portable_signature_invalid";
  }
  if (message === "wildz_restore_artifact_too_large" || message.includes("too_large") || message.includes("bounded restore size")) {
    return "wildz_restore_artifact_too_large";
  }
  if (message === "wildz_restore_owner_mismatch") return "wildz_restore_owner_mismatch";
  if (message === "wildz_restore_binding_invalid"
    || message === "wildz_restore_binding_missing"
    || message.startsWith("wildz_artifact_")
    || message.startsWith("receiz_artifact_open_")
    || message === "fixture_artifact_rejected"
    || message.startsWith("wildz_png_proof_object_")
    || message.startsWith("continuity_")) return "wildz_restore_binding_invalid";
  if (message === "wildz_restore_card_proof_invalid"
    || message.startsWith("png_")
    || message.includes("vault_proof")
    || message.includes("card_proof")) return "wildz_restore_card_proof_invalid";
  return "wildz_restore_schema_unsupported";
}

function looksLikeJson(bytes: Uint8Array) {
  for (const byte of bytes.slice(0, 64)) {
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    return byte === 0x7b;
  }
  return false;
}

function isReceizBundleCandidate(bytes: Uint8Array) {
  if (!looksLikeJson(bytes)) return false;
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    return Boolean(value && typeof value === "object" && !Array.isArray(value)
      && (value as Record<string, unknown>).kind === "receiz.bundle.v1");
  } catch {
    return false;
  }
}

function vaultDigest(assets: readonly PortableCardAsset[]) {
  return sha256PortableBasis(canonicalPortableCardJson(
    assets.map((asset) => ({ id: asset.id, proof: asset.proof.digest }))
  ));
}

export function createWildzArtifactCodec(input: {
  identityRepository: Pick<WildzIdentityRepository, "prepare">;
  commerceVaultReader: ReceizCommerceVaultReader;
  artifactOpener?: WildzArtifactOpener;
}): WildzArtifactCodec {
  return {
    async inspect(artifact) {
      const bytes = artifact.bytes;
      if (bytes.byteLength > MAX_ARTIFACT_BYTES) return invalid("wildz_restore_artifact_too_large");

      let pngBasis: Uint8Array | null = null;
      if (isWildzPng(bytes)) {
        try {
          pngBasis = splitWildzPngEnvelope(bytes).pngBasis;
        } catch (error) {
          return invalid(normalizedError(error));
        }
      }

      let proofObject: WildzProofObjectContinuity | null = null;
      let proofObjectPayload: { bytes: Uint8Array; mimeType: string } | null = null;
      let proofObjectArtifactBytes: Uint8Array | null = isReceizBundleCandidate(bytes) ? bytes : null;
      if (pngBasis) {
        try {
          proofObjectArtifactBytes = readReceizProofObjectFromPng(pngBasis).artifactBytes;
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "wildz_png_proof_object_missing") {
            return invalid(normalizedError(error));
          }
        }
      }
      const proofObjectCandidate = proofObjectArtifactBytes !== null;
      if (proofObjectArtifactBytes !== null) {
        try {
          if (!input.artifactOpener) throw new Error("wildz_artifact_opener_required");
          const admitted = await input.artifactOpener.open({
            bytes: proofObjectArtifactBytes,
            mimeType: artifact.mimeType,
            ...(artifact.name ? { name: artifact.name } : {})
          });
          proofObjectPayload = {
            bytes: admitted.payloadBytes,
            mimeType: admitted.mimeType
          };
          proofObject = {
            schema: "receiz.wildz.verified_artifact.v111",
            compatibility: admitted.compatibility,
            ownerReceizId: admitted.ownerReceizId,
            custody: "v111-verified-artifact",
            proofRef: admitted.claimId,
            provenanceRoot: admitted.recordId ?? admitted.claimId,
            payloadSha256: admitted.payloadSha256,
            payloadMimeType: admitted.mimeType,
            artifactBasisSha256: admitted.artifactSha256,
            artifactBytes: admitted.artifactBytes.slice(),
            proofClaimId: admitted.claimId
          };
        } catch (error) {
          return invalid(normalizedError(error));
        }
      }

      let identity: VerifiedWildzIdentity | null = null;
      let verifiedPortableSnapshot: unknown | null = null;
      let identityError: WildzRestoreErrorCode | null = null;
      let keyFile: ReceizKeyFile | null = null;
      try {
        if (proofObjectCandidate) throw new Error("wildz_proof_object_not_identity");
        keyFile = await readReceizIdentityArtifact(bytes);
        const projection = await projectReceizIdentityAccount(keyFile);
        if (keyFile.portableState && projection.portableStateStatus !== "verified") {
          identityError = "wildz_restore_portable_signature_invalid";
        } else {
          const prepared = await input.identityRepository.prepare(keyFile);
          identity = { session: prepared.session, prepared };
          verifiedPortableSnapshot = projection.portableStateStatus === "verified" ? projection.snapshot : null;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const isMissingPngIdentity = pngBasis !== null && message === "receiz_key_identity_record_missing";
        const isIdentityCandidate = pngBasis !== null || looksLikeJson(bytes);
        if (!proofObjectCandidate && !isMissingPngIdentity && isIdentityCandidate) {
          identityError = message.includes("portable_state")
            ? "wildz_restore_portable_signature_invalid"
            : "wildz_restore_identity_invalid";
        }
      } finally {
        keyFile = null;
      }

      let commerce: ReceizCommerceVaultInspection | null = null;
      let commerceError: WildzRestoreErrorCode | null = null;
      try {
        commerce = await input.commerceVaultReader.inspect({
          bytes,
          mimeType: artifact.mimeType,
          ...(artifact.name ? { name: artifact.name } : {})
        });
      } catch (error) {
        commerceError = normalizedError(error);
      }

      let extraction: WildzCrossPlatformCardExtraction;
      try {
        extraction = extractVerifiedWildzCards({
          pngBasis,
          verifiedPortableSnapshot,
          restoredVaultFiles: commerce?.restoredFiles ?? [],
          proofObjectPayload
        });
      } catch (error) {
        return invalid(normalizedError(error));
      }

      if (identityError) return invalid(identityError);
      if (commerceError) return invalid(commerceError);
      if (identity && extraction.player
        && !sameWildzPlayerCoordinate(extraction.player.playerId, identity.session.actorId)) {
        return invalid("wildz_restore_owner_mismatch");
      }
      if (proofObject && (
        extraction.player && !sameWildzPlayerCoordinate(extraction.player.playerId, proofObject.ownerReceizId)
      )) {
        return invalid("wildz_restore_owner_mismatch");
      }
      let playerBinding: WildzPlayerBinding = null;
      if (extraction.player) {
        if (!identity) {
          playerBinding = "artifact-v4-required";
        } else if (extraction.playerSource === "portable-snapshot") {
          playerBinding = "identity-portable-state";
        } else {
          try {
            await requireWildzIdentityBindingFromEnvelope(bytes);
            playerBinding = "identity-v3-binding";
          } catch (error) {
            return invalid(normalizedError(error));
          }
        }
      }
      if (commerce) {
        return {
          kind: "commerce-vault",
          identity,
          assets: extraction.assets,
          sourceSchemas: [...new Set([commerce.projection.sourceSchema, ...extraction.sourceSchemas])].sort(),
          unrelatedDomainSchemas: extraction.unrelatedDomainSchemas,
          projection: commerce.projection,
          player: extraction.player,
          playerBinding
        };
      }
      if (identity && extraction.player && playerBinding === "identity-v3-binding") {
        return {
          kind: "card-vault",
          identity,
          assets: extraction.assets,
          vaultDigest: vaultDigest(extraction.assets),
          player: extraction.player,
          playerBinding,
          proofObject
        };
      }
      if (identity) {
        return {
          kind: "identity-seal",
          identity,
          portableAssets: extraction.assets,
          portableDomainSchemas: [...new Set([
            ...extraction.sourceSchemas,
            ...extraction.unrelatedDomainSchemas
          ])].sort(),
          player: extraction.player,
          playerBinding
        };
      }
      if (extraction.assets.length) {
        return {
          kind: "card-vault",
          assets: extraction.assets,
          vaultDigest: vaultDigest(extraction.assets),
          player: extraction.player,
          playerBinding,
          proofObject
        };
      }
      if (artifact.mimeType === "image/png" && pngBasis === null) {
        return invalid("wildz_restore_schema_unsupported");
      }
      return { kind: "unsupported", code: "wildz_artifact_unsupported" };
    }
  };
}
