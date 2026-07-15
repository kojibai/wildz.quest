import {
  projectReceizIdentityAccount,
  readReceizIdentityArtifact,
  type ReceizKeyFile
} from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "../../features/play/portable-card";
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
    }
  | {
      kind: "card-vault";
      assets: PortableCardAsset[];
      vaultDigest: string;
      player: WildsPlayerVaultPayload | null;
    }
  | {
      kind: "commerce-vault";
      identity: VerifiedWildzIdentity | null;
      assets: PortableCardAsset[];
      sourceSchemas: string[];
      unrelatedDomainSchemas: string[];
      projection: ReceizCommerceVaultProjection;
      player: WildsPlayerVaultPayload | null;
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
  if (message === "wildz_restore_binding_invalid") return "wildz_restore_binding_invalid";
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

function vaultDigest(assets: readonly PortableCardAsset[]) {
  return sha256PortableBasis(canonicalPortableCardJson(
    assets.map((asset) => ({ id: asset.id, proof: asset.proof.digest }))
  ));
}

export function createWildzArtifactCodec(input: {
  identityRepository: Pick<WildzIdentityRepository, "prepare">;
  commerceVaultReader: ReceizCommerceVaultReader;
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

      let identity: VerifiedWildzIdentity | null = null;
      let verifiedPortableSnapshot: unknown | null = null;
      let identityError: WildzRestoreErrorCode | null = null;
      let keyFile: ReceizKeyFile | null = null;
      try {
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
        if (!isMissingPngIdentity && isIdentityCandidate) {
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
          restoredVaultFiles: commerce?.restoredFiles ?? []
        });
      } catch (error) {
        return invalid(normalizedError(error));
      }

      if (identityError) return invalid(identityError);
      if (commerceError) return invalid(commerceError);
      if (identity && extraction.player) {
        if (extraction.player.playerId !== identity.session.actorId) return invalid("wildz_restore_owner_mismatch");
        // Combined V3 player continuity requires an independently verified
        // identity binding. The base codec intentionally does not infer one
        // from matching labels or a spliced SDK trailer.
        return invalid("wildz_restore_binding_invalid");
      }
      if (commerce) {
        return {
          kind: "commerce-vault",
          identity,
          assets: extraction.assets,
          sourceSchemas: [...new Set([commerce.projection.sourceSchema, ...extraction.sourceSchemas])].sort(),
          unrelatedDomainSchemas: extraction.unrelatedDomainSchemas,
          projection: commerce.projection,
          player: extraction.player
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
          player: extraction.player
        };
      }
      if (extraction.assets.length) {
        return {
          kind: "card-vault",
          assets: extraction.assets,
          vaultDigest: vaultDigest(extraction.assets),
          player: extraction.player
        };
      }
      if (artifact.mimeType === "image/png" && pngBasis === null) {
        return invalid("wildz_restore_schema_unsupported");
      }
      return { kind: "unsupported", code: "wildz_artifact_unsupported" };
    }
  };
}
