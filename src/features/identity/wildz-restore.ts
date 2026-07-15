import {
  applyWildsInput,
  initialPlayState,
  restorePlayState,
  serializePlayState,
  type PlayState
} from "../play/game-state";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "../play/portable-card";
import type { WildsPlayerVaultPayload } from "../play/wilds-player-vault";
import type {
  WildzArtifactCodec,
  WildzArtifactInspection
} from "../../lib/receiz/wildz-artifact-codec";
import type { ReceizCommerceVaultProjection } from "../../lib/receiz/receiz-commerce-vault";
import {
  wildzOwnerScope,
  type WildzIdentityRepository,
  type WildzIdentitySession
} from "../../lib/receiz/wildz-identity-repository";
import type { WildzContinuityDatabase } from "../../lib/storage/wildz-indexed-db";

export type WildzRestoreCandidate =
  | {
      kind: "identity-seal";
      keyId: string;
      username: string | null;
      displayName: string | null;
      portableStateVerified: boolean;
    }
  | { kind: "vault"; cardCount: number; vaultDigest: string };

export function restoreSummary(candidate: WildzRestoreCandidate) {
  if (candidate.kind === "identity-seal") {
    return {
      kind: candidate.kind,
      keyId: candidate.keyId,
      username: candidate.username,
      displayName: candidate.displayName,
      portableStateVerified: candidate.portableStateVerified,
      authorityRestored: true,
      requiresOwnershipReconciliation: false,
      cardCount: 0
    } as const;
  }

  return {
    kind: candidate.kind,
    vaultDigest: candidate.vaultDigest,
    authorityRestored: false,
    requiresOwnershipReconciliation: true,
    cardCount: candidate.cardCount
  } as const;
}

export function friendlyWildzRestoreError(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "wildz_restore_invalid";
  if (code === "receiz_key_identity_record_missing") {
    return "This image is identity artwork, not account authority. Download your owner-only Identity Record or Receiz Key from Receiz and choose that file.";
  }
  if (code === "receiz_key_file_too_large") return "This Receiz identity artifact is too large.";
  if (code === "receiz_key_invalid") return "This file is not a valid Receiz Identity Record or Receiz Key.";
  if (code === "wildz_restore_confirmation_required") return "Restore cancelled. Your Receiz ID and Card Vault were not changed.";
  if (code === "wildz_restore_owner_mismatch") return "This player Vault belongs to a different Receiz ID. Restore its matching Identity Seal first.";
  if (code === "wildz_restore_duplicate_card_conflict") return "This Vault contains conflicting versions of the same card, so nothing was restored.";
  if (code === "wildz_restore_card_proof_invalid" || code === "wildz_restore_player_digest_invalid") return "This Vault did not pass its Wildz proof checks, so nothing was restored.";
  if (code === "wildz_restore_artifact_too_large") return "This restore artifact is larger than the 64 MiB safety limit.";
  if (code === "wildz_artifact_unsupported" || code === "wildz_restore_schema_unsupported") return "This file is not a supported Receiz Identity Seal or verified Vault.";
  if (code === "wildz_restore_storage_failed") return "Wildz could not commit this restore. Nothing was changed; please try again.";
  return code;
}

type StoredWildzPlayState = {
  schema: "receiz.wildz.owner_play_state.v1";
  keyId: string;
  actorId: string;
  playState: PlayState;
  updatedAt: string;
};

export type WildzCommittedArtifactRestore = {
  restoreStatus: "committed";
  surface: "genesis" | "card-vault";
  artifactKind: "identity-seal" | "card-vault" | "commerce-vault";
  session: WildzIdentitySession;
  playState: PlayState;
  verifiedAssetIds: string[];
  commerceProjection: ReceizCommerceVaultProjection | null;
};

export type WildzCardOnlyConfirmation = boolean | (() => boolean | Promise<boolean>);

const OWNER_PLAY_STATE_SCHEMA = "receiz.wildz.owner_play_state.v1";

function inspectionAssets(inspection: WildzArtifactInspection): PortableCardAsset[] {
  if (inspection.kind === "identity-seal") return inspection.portableAssets;
  if (inspection.kind === "card-vault" || inspection.kind === "commerce-vault") return inspection.assets;
  return [];
}

function inspectionPlayer(inspection: WildzArtifactInspection): WildsPlayerVaultPayload | null {
  return inspection.kind === "identity-seal"
    || inspection.kind === "card-vault"
    || inspection.kind === "commerce-vault"
    ? inspection.player
    : null;
}

function identityFromInspection(inspection: WildzArtifactInspection) {
  return inspection.kind === "identity-seal" || inspection.kind === "commerce-vault"
    ? inspection.identity
    : null;
}

function emptyVaultPlayState(): PlayState {
  return {
    ...structuredClone(initialPlayState),
    inventory: [],
    discoveredCardIds: [],
    pendingSyncAssetIds: [],
    companionProgress: {},
    livingProgress: {},
    selectedAssetId: "",
    selectedCardId: ""
  };
}

function importAssets(base: PlayState, assets: readonly PortableCardAsset[]) {
  return assets.reduce(
    (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
    base
  );
}

function stateFromPlayer(player: WildsPlayerVaultPayload, assets: readonly PortableCardAsset[]) {
  const normalizedExpected = restorePlayState(serializePlayState({
    ...emptyVaultPlayState(),
    inventory: [...assets]
  })).inventory;
  const expected = new Map(normalizedExpected.map((asset) => [asset.id, canonicalPortableCardJson(asset)]));
  const restored = restorePlayState(serializePlayState(player.playState));
  if (restored.inventory.length !== expected.size) throw new Error("wildz_restore_binding_invalid");
  const playerIds = new Set<string>();
  for (const asset of restored.inventory) {
    if (!verifyAnyWildsCard(asset).ok
      || expected.get(asset.id) !== canonicalPortableCardJson(asset)
      || playerIds.has(asset.id)) {
      throw new Error("wildz_restore_binding_invalid");
    }
    playerIds.add(asset.id);
  }
  const restoredIds = [...new Set(restored.inventory.map((asset) => asset.id))].sort();
  if (restoredIds.length !== expected.size || restoredIds.some((id) => !expected.has(id))) {
    throw new Error("wildz_restore_binding_invalid");
  }
  return restored;
}

function isStoredPlayState(value: unknown, session: WildzIdentitySession): value is StoredWildzPlayState {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredWildzPlayState>;
  return record.schema === OWNER_PLAY_STATE_SCHEMA
    && record.keyId === session.keyId
    && record.actorId === session.actorId
    && Boolean(record.playState);
}

export async function loadWildzRestoredPlayState(input: {
  database: WildzContinuityDatabase;
  session: WildzIdentitySession;
}) {
  const scope = wildzOwnerScope(input.session.keyId, input.session.actorId);
  const stored = await input.database.read<unknown>("ownerStates", scope);
  if (!isStoredPlayState(stored, input.session)) return null;
  return restorePlayState(serializePlayState(stored.playState));
}

export async function saveWildzRestoredPlayState(input: {
  database: WildzContinuityDatabase;
  session: WildzIdentitySession;
  playState: PlayState;
}) {
  const scope = wildzOwnerScope(input.session.keyId, input.session.actorId);
  const stored: StoredWildzPlayState = {
    schema: OWNER_PLAY_STATE_SCHEMA,
    keyId: input.session.keyId,
    actorId: input.session.actorId,
    playState: restorePlayState(serializePlayState(input.playState)),
    updatedAt: new Date().toISOString()
  };
  await input.database.transaction(["ownerStates"], "readwrite", (tx) => tx.put("ownerStates", stored, scope));
  return stored.playState;
}

export async function restoreWildzArtifactForSurface(input: {
  surface: "genesis" | "card-vault";
  bytes: Uint8Array;
  mimeType: string;
  name?: string;
  codec: WildzArtifactCodec;
  repository: Pick<WildzIdentityRepository, "active" | "writePrepared">;
  database: WildzContinuityDatabase;
  confirmCardOnly: WildzCardOnlyConfirmation;
  currentPlayState?: PlayState;
}): Promise<WildzCommittedArtifactRestore> {
  const inspection = await input.codec.inspect({
    bytes: input.bytes,
    mimeType: input.mimeType,
    ...(input.name ? { name: input.name } : {})
  });
  if (inspection.kind === "invalid") throw new Error(inspection.code);
  if (inspection.kind === "unsupported") throw new Error(inspection.code);
  const verifiedIdentity = identityFromInspection(inspection);
  const cardOnlyConfirmed = verifiedIdentity
    ? true
    : typeof input.confirmCardOnly === "function"
      ? await input.confirmCardOnly()
      : input.confirmCardOnly;
  if (!cardOnlyConfirmed) throw new Error("wildz_restore_confirmation_required");
  const active = await input.repository.active();
  const session = verifiedIdentity?.session ?? active;
  if (!session) throw new Error("wildz_restore_identity_missing");
  const player = inspectionPlayer(inspection);
  if (player && player.playerId !== session.actorId) throw new Error("wildz_restore_owner_mismatch");
  const assets = inspectionAssets(inspection);
  const verifiedAssetIds = [...new Set(assets.map((asset) => asset.id))].sort();
  const scope = wildzOwnerScope(session.keyId, session.actorId);
  let committedState: PlayState | null = null;
  try {
    await input.database.transaction(["identities", "ownerStates", "meta"], "readwrite", async (tx) => {
      const stored = await tx.get<unknown>("ownerStates", scope);
      const sameActiveOwner = active?.keyId === session.keyId && active.actorId === session.actorId;
      const current = sameActiveOwner && input.currentPlayState
        ? restorePlayState(serializePlayState(input.currentPlayState))
        : isStoredPlayState(stored, session)
          ? restorePlayState(serializePlayState(stored.playState))
          : emptyVaultPlayState();
      const next = player ? stateFromPlayer(player, assets) : importAssets(current, assets);
      const record: StoredWildzPlayState = {
        schema: OWNER_PLAY_STATE_SCHEMA,
        keyId: session.keyId,
        actorId: session.actorId,
        playState: next,
        updatedAt: new Date().toISOString()
      };
      if (verifiedIdentity) await input.repository.writePrepared(tx, verifiedIdentity.prepared, true);
      await tx.put("ownerStates", record, scope);
      committedState = next;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("wildz_restore_")) throw error;
    throw new Error("wildz_restore_storage_failed");
  }
  if (!committedState) throw new Error("wildz_restore_storage_failed");
  const reloaded = await loadWildzRestoredPlayState({ database: input.database, session });
  if (!reloaded) throw new Error("wildz_restore_storage_failed");
  return {
    restoreStatus: "committed",
    surface: input.surface,
    artifactKind: inspection.kind,
    session,
    playState: reloaded,
    verifiedAssetIds,
    commerceProjection: inspection.kind === "commerce-vault" ? inspection.projection : null
  };
}
