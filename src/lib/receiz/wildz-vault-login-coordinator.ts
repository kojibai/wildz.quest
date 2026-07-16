import {
  createStoredWildzPlayState,
  prepareWildzPlayerPlayState,
  restoreWildzArtifactForSurface,
  type WildzCommittedArtifactRestore
} from "../../features/identity/wildz-restore";
import type { WildzArtifactCodec, WildzArtifactInspection } from "./wildz-artifact-codec";
import {
  wildzOwnerScope,
  type WildzIdentityRepository,
  type WildzIdentitySession
} from "./wildz-identity-repository";
import {
  sameWildzPendingVaultRestore,
  type WildzPendingVaultRepository,
  type WildzPendingVaultRestore
} from "./wildz-pending-vault";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import {
  verifyProofSealedWildzVault,
  type VerifiedProofSealedWildzVault,
  type WildzProofArtifactVerifier
} from "./wildz-proof-sealed-vault";
import type { WildzRemoteSession } from "./wildz-session-bridge";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import { wildzVaultSessionKeyId } from "./wildz-vault-session-key";

export type WildzVaultLoginOutcome =
  | { status: "not_player_vault" }
  | { status: "committed"; restore: WildzCommittedArtifactRestore };

export interface WildzVaultLoginCoordinator {
  begin(input: {
    surface: "genesis" | "card-vault";
    bytes: Uint8Array;
    mimeType: string;
    name?: string | null;
  }): Promise<WildzVaultLoginOutcome>;
  resume(resumeId: string): Promise<{ status: "committed"; restore: WildzCommittedArtifactRestore }>;
}

function inspectedPlayer(inspection: WildzArtifactInspection) {
  if (inspection.kind === "invalid") throw new Error(inspection.code);
  if (inspection.kind === "unsupported") throw new Error(inspection.code);
  return inspection.player;
}

function assertSamePreparedRestore(
  pending: WildzPendingVaultRestore,
  verified: VerifiedProofSealedWildzVault
) {
  if (pending.byteDigestSha256 !== verified.byteDigestSha256
    || pending.proofBasisSha256 !== verified.proofBasisSha256
    || !sameWildzPlayerCoordinate(pending.player.profileHandle, verified.player.profileHandle)) {
    throw new Error("wildz_restore_resume_mismatch");
  }
}

export function createWildzVaultLoginCoordinator(input: {
  database: WildzContinuityDatabase;
  repository: Pick<WildzIdentityRepository, "active" | "writeSession" | "writePrepared">;
  codec: WildzArtifactCodec;
  pending: WildzPendingVaultRepository;
  verifier: WildzProofArtifactVerifier;
  remote: { current(): Promise<WildzRemoteSession> };
}): WildzVaultLoginCoordinator {
  const remoteState = async () => {
    try {
      return await input.remote.current();
    } catch {
      return { status: "unavailable", actorId: null, profileHandle: null, displayName: null } as const;
    }
  };

  const verifyPending = async (pending: WildzPendingVaultRestore) => {
    const verified = await verifyProofSealedWildzVault({
      bytes: pending.bytes,
      mimeType: pending.mimeType,
      name: pending.name,
      codec: input.codec,
      verifier: input.verifier
    });
    assertSamePreparedRestore(pending, verified);
    return verified;
  };

  const commitVerified = async (
    pending: WildzPendingVaultRestore,
    verified: VerifiedProofSealedWildzVault,
    session: WildzIdentitySession
  ) => {
    const playState = prepareWildzPlayerPlayState(verified.playerPayload, verified.assets);
    const stored = createStoredWildzPlayState(session, playState, verified.playerPayload);
    try {
      await input.database.transaction(["meta", "ownerStates", "pendingRestores"], "readwrite", async (tx) => {
        const current = await input.pending.loadPrepared(tx, pending.resumeId);
        if (!current) throw new Error("wildz_restore_resume_missing");
        if (!sameWildzPendingVaultRestore(current, pending)) throw new Error("wildz_restore_resume_mismatch");
        await input.repository.writeSession(tx, session, true);
        await tx.put("ownerStates", stored, wildzOwnerScope(session.keyId, session.actorId));
        await input.pending.deletePrepared(tx, pending.resumeId);
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("wildz_restore_")) throw error;
      throw new Error("wildz_restore_storage_failed");
    }
    return {
      status: "committed",
      restore: {
        restoreStatus: "committed",
        surface: pending.surface,
        artifactKind: verified.artifactKind,
        session,
        playState: stored.playState,
        character: stored.character,
        playerContinuity: {
          settings: stored.settings,
          personalEvents: stored.personalEvents,
          canonicalCursor: stored.canonicalCursor,
          receipts: stored.receipts
        },
        verifiedAssetIds: [...new Set(verified.assets.map((asset) => asset.id))].sort(),
        commerceProjection: verified.inspection.kind === "commerce-vault"
          ? verified.inspection.projection
          : null
      }
    } as const;
  };

  const proofBackedSession = (
    verified: VerifiedProofSealedWildzVault,
    remoteStatus: WildzIdentitySession["remoteStatus"]
  ): WildzIdentitySession => ({
    schema: "receiz.wildz.identity_session.v1",
    keyId: wildzVaultSessionKeyId({
      profileHandle: verified.player.profileHandle,
      proofBasisSha256: verified.proofBasisSha256,
      byteDigestSha256: verified.byteDigestSha256
    }),
    actorId: verified.player.actorId,
    username: verified.player.actorId,
    displayName: null,
    portableStateStatus: "missing",
    localAuthority: "proof-sealed-vault",
    remoteStatus
  });

  const continuePending = async (
    pending: WildzPendingVaultRestore,
    verified: VerifiedProofSealedWildzVault
  ): Promise<{ status: "committed"; restore: WildzCommittedArtifactRestore }> => {
    const remote = await remoteState();
    const status = remote.status === "connected"
      ? sameWildzPlayerCoordinate(remote.profileHandle, verified.player.profileHandle) ? "connected" : "unavailable"
      : remote.status;
    return commitVerified(pending, verified, proofBackedSession(verified, status));
  };

  return {
    async begin(artifact) {
      const inspection = await input.codec.inspect({
        bytes: artifact.bytes,
        mimeType: artifact.mimeType,
        ...(artifact.name ? { name: artifact.name } : {})
      });
      const player = inspectedPlayer(inspection);
      if (!player) return { status: "not_player_vault" };
      if (inspection.kind !== "invalid"
        && inspection.kind !== "unsupported"
        && (inspection.playerBinding === "identity-portable-state"
          || inspection.playerBinding === "identity-v3-binding")) {
        return {
          status: "committed",
          restore: await restoreWildzArtifactForSurface({
            surface: artifact.surface,
            bytes: artifact.bytes,
            mimeType: artifact.mimeType,
            ...(artifact.name ? { name: artifact.name } : {}),
            codec: input.codec,
            repository: input.repository,
            database: input.database,
            confirmCardOnly: true
          })
        };
      }
      const verified = await verifyProofSealedWildzVault({
        bytes: artifact.bytes,
        mimeType: artifact.mimeType,
        name: artifact.name,
        codec: input.codec,
        verifier: input.verifier
      });
      const pending = await input.pending.stage({
        surface: artifact.surface,
        bytes: artifact.bytes,
        mimeType: artifact.mimeType,
        name: artifact.name ?? null,
        player: verified.player,
        proofBasisSha256: verified.proofBasisSha256
      });
      assertSamePreparedRestore(pending, verified);
      return continuePending(pending, verified);
    },
    async resume(resumeId) {
      const pending = await input.pending.load(resumeId);
      if (!pending) throw new Error("wildz_restore_resume_missing");
      return continuePending(pending, await verifyPending(pending));
    }
  };
}
