import {
  applyWildsInput,
  initialPlayState,
  restorePlayState,
  serializePlayState,
  type PlayState
} from "../play/game-state";
import { parseWildzCharacter, type WildzCharacterGenesis } from "./wildz-genesis";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "../play/portable-card";
import {
  createWildsPlayerVault,
  type WildsPlayerVaultPayload
} from "../play/wilds-player-vault";
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
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { extractVerifiedWildzCards } from "../../lib/receiz/wildz-cross-platform-cards";
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
  if (code === "wildz_restore_owner_mismatch" || code === "wildz_restore_receiz_account_mismatch") return "This player Vault belongs to a different Receiz ID. Sign in with the Receiz account embedded in this Vault.";
  if (code === "wildz_restore_login_required") return "Sign in with Receiz to restore the player and every card sealed in this Vault.";
  if (code === "wildz_restore_resume_missing") return "This Vault login expired. Upload the Vault image again to continue.";
  if (code === "wildz_restore_v4_unavailable") return "Receiz proof verification is temporarily unavailable. Your Vault was not changed; please try again.";
  if (code === "wildz_restore_v4_invalid") return "This Vault did not pass its Receiz Signature V4 proof check, so nothing was restored.";
  if (code === "wildz_restore_duplicate_card_conflict") return "This Vault contains conflicting versions of the same card, so nothing was restored.";
  if (code === "wildz_restore_card_proof_invalid" || code === "wildz_restore_player_digest_invalid") return "This Vault did not pass its Wildz proof checks, so nothing was restored.";
  if (code === "wildz_restore_artifact_too_large") return "This restore artifact is larger than the 64 MiB safety limit.";
  if (code === "wildz_artifact_unsupported" || code === "wildz_restore_schema_unsupported") return "This file is not a supported Receiz Identity Seal or verified Vault.";
  if (code === "wildz_restore_storage_failed") return "Wildz could not commit this restore. Nothing was changed; please try again.";
  return code;
}

export type WildzPlayerContinuity = Pick<
  WildsPlayerVaultPayload,
  "settings" | "personalEvents" | "canonicalCursor" | "receipts"
>;

export type StoredWildzOwnerState = WildzPlayerContinuity & {
  schema: "receiz.wildz.owner_state.v1";
  keyId: string;
  actorId: string;
  playState: PlayState;
  character: WildzCharacterGenesis | null;
  updatedAt: string;
};

export type StoredWildzPlayState = StoredWildzOwnerState;

export type WildzCommittedArtifactRestore = {
  restoreStatus: "committed";
  surface: "genesis" | "card-vault";
  artifactKind: "identity-seal" | "card-vault" | "commerce-vault";
  session: WildzIdentitySession;
  playState: PlayState;
  character: WildzCharacterGenesis | null;
  playerContinuity: WildzPlayerContinuity;
  verifiedAssetIds: string[];
  commerceProjection: ReceizCommerceVaultProjection | null;
};

export type WildzCardOnlyConfirmation = boolean | (() => boolean | Promise<boolean>);

const OWNER_STATE_SCHEMA = "receiz.wildz.owner_state.v1";
const LEGACY_OWNER_PLAY_STATE_SCHEMA = "receiz.wildz.owner_play_state.v1";

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
  extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: [base.inventory, assets],
    restoredVaultFiles: []
  });
  return assets.reduce(
    (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
    base
  );
}

export function prepareWildzPlayerPlayState(player: WildsPlayerVaultPayload, assets: readonly PortableCardAsset[]) {
  const normalizedExpected = restorePlayState(serializePlayState({
    ...emptyVaultPlayState(),
    inventory: [...assets]
  }), player.playerId).inventory;
  const expected = new Map(normalizedExpected.map((asset) => [asset.id, canonicalPortableCardJson(asset)]));
  const restored = restorePlayState(serializePlayState(player.playState), player.playerId);
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

function defaultPlayerContinuity(): WildzPlayerContinuity {
  return {
    settings: { avatarStyle: null, movementMode: "walk", audio: {}, cardOrder: "rarity" },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  };
}

function continuityFromOwner(state: StoredWildzOwnerState): WildzPlayerContinuity {
  return {
    settings: structuredClone(state.settings),
    personalEvents: structuredClone(state.personalEvents),
    canonicalCursor: structuredClone(state.canonicalCursor),
    receipts: structuredClone(state.receipts)
  };
}

function normalizedPlayerContinuity(
  session: WildzIdentitySession,
  playState: PlayState,
  source: WildzPlayerContinuity | WildsPlayerVaultPayload | null | undefined,
  exportedAt: string
) {
  if (source && "playerId" in source && !sameWildzPlayerCoordinate(source.playerId, session.actorId)) {
    throw new Error("wildz_restore_owner_mismatch");
  }
  const continuity = source ?? defaultPlayerContinuity();
  const normalized = createWildsPlayerVault({
    playerId: session.actorId,
    exportedAt,
    playState,
    settings: continuity.settings,
    personalEvents: continuity.personalEvents,
    canonicalCursor: continuity.canonicalCursor,
    receipts: continuity.receipts
  });
  return {
    settings: normalized.settings,
    personalEvents: normalized.personalEvents,
    canonicalCursor: normalized.canonicalCursor,
    receipts: normalized.receipts
  } satisfies WildzPlayerContinuity;
}

export function createStoredWildzPlayState(
  session: WildzIdentitySession,
  playState: PlayState,
  player: WildzPlayerContinuity | WildsPlayerVaultPayload | null = null,
  updatedAt = new Date().toISOString(),
  character?: WildzCharacterGenesis | null
): StoredWildzPlayState {
  const normalizedPlayState = restorePlayState(serializePlayState(playState), session.actorId);
  const continuity = normalizedPlayerContinuity(session, normalizedPlayState, player, updatedAt);
  const requestedCharacter = character === undefined && player && "playerId" in player ? player.character : character;
  const normalizedCharacter = requestedCharacter === null || requestedCharacter === undefined
    ? null
    : parseWildzCharacter(JSON.stringify(requestedCharacter));
  if (requestedCharacter && !normalizedCharacter) throw new Error("wildz_owner_character_invalid");
  return {
    schema: OWNER_STATE_SCHEMA,
    keyId: session.keyId,
    actorId: session.actorId,
    playState: normalizedPlayState,
    character: normalizedCharacter,
    ...continuity,
    updatedAt
  };
}

function storedOwnerState(value: unknown, session: WildzIdentitySession): StoredWildzOwnerState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StoredWildzOwnerState> & { schema?: unknown };
  if (record.keyId !== session.keyId || record.actorId !== session.actorId || !record.playState) return null;
  try {
    if (record.schema === OWNER_STATE_SCHEMA) {
      if (!record.settings || !record.personalEvents || !record.canonicalCursor || !record.receipts) return null;
      return createStoredWildzPlayState(session, record.playState, {
        settings: record.settings,
        personalEvents: record.personalEvents,
        canonicalCursor: record.canonicalCursor,
        receipts: record.receipts
      }, typeof record.updatedAt === "string" ? record.updatedAt : new Date(0).toISOString(), record.character ?? null);
    }
    if (record.schema === LEGACY_OWNER_PLAY_STATE_SCHEMA) {
      return createStoredWildzPlayState(
        session,
        record.playState,
        null,
        typeof record.updatedAt === "string" ? record.updatedAt : new Date(0).toISOString(),
        null
      );
    }
  } catch {
    return null;
  }
  return null;
}

export async function loadWildzRestoredOwnerState(input: {
  database: WildzContinuityDatabase;
  session: WildzIdentitySession;
}) {
  const scope = wildzOwnerScope(input.session.keyId, input.session.actorId);
  return storedOwnerState(await input.database.read<unknown>("ownerStates", scope), input.session);
}

export async function loadWildzRestoredPlayState(input: {
  database: WildzContinuityDatabase;
  session: WildzIdentitySession;
}) {
  return (await loadWildzRestoredOwnerState(input))?.playState ?? null;
}

export async function saveWildzRestoredPlayState(input: {
  database: WildzContinuityDatabase;
  session: WildzIdentitySession;
  playState: PlayState;
  player?: WildzPlayerContinuity | WildsPlayerVaultPayload | null;
  character?: WildzCharacterGenesis | null;
}) {
  const scope = wildzOwnerScope(input.session.keyId, input.session.actorId);
  return input.database.transaction(["ownerStates"], "readwrite", async (tx) => {
    const current = storedOwnerState(await tx.get<unknown>("ownerStates", scope), input.session);
    const stored = createStoredWildzPlayState(
      input.session,
      input.playState,
      input.player ?? (current ? continuityFromOwner(current) : null),
      new Date().toISOString(),
      input.character === undefined ? current?.character ?? null : input.character
    );
    await tx.put("ownerStates", stored, scope);
    return stored.playState;
  });
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
  proofSealedPlayer?: boolean;
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
  if (player && !sameWildzPlayerCoordinate(player.playerId, session.actorId)) {
    throw new Error("wildz_restore_owner_mismatch");
  }
  if (player && inspection.playerBinding === "artifact-v4-required" && !input.proofSealedPlayer) {
    throw new Error("wildz_restore_binding_invalid");
  }
  const assets = inspectionAssets(inspection);
  const verifiedAssetIds = [...new Set(assets.map((asset) => asset.id))].sort();
  const scope = wildzOwnerScope(session.keyId, session.actorId);
  let committedOwnerState: StoredWildzOwnerState | null = null;
  try {
    await input.database.transaction(["identities", "ownerStates", "meta"], "readwrite", async (tx) => {
      const stored = await tx.get<unknown>("ownerStates", scope);
      const sameActiveOwner = active?.keyId === session.keyId && active.actorId === session.actorId;
      const sameActivePlayer = active
        ? sameActiveOwner || sameWildzPlayerCoordinate(active.actorId, session.actorId)
        : false;
      const previous = storedOwnerState(stored, session);
      const current = sameActivePlayer && input.currentPlayState
        ? restorePlayState(serializePlayState(input.currentPlayState), session.actorId)
        : previous
          ? restorePlayState(serializePlayState(previous.playState))
          : emptyVaultPlayState();
      const next = player ? prepareWildzPlayerPlayState(player, assets) : importAssets(current, assets);
      const record = createStoredWildzPlayState(
        session,
        next,
        player ?? (previous ? continuityFromOwner(previous) : null),
        new Date().toISOString(),
        player?.character ?? previous?.character ?? null
      );
      if (verifiedIdentity) await input.repository.writePrepared(tx, verifiedIdentity.prepared, true);
      await tx.put("ownerStates", record, scope);
      committedOwnerState = record;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("wildz_restore_")) throw error;
    throw new Error("wildz_restore_storage_failed");
  }
  if (!committedOwnerState) throw new Error("wildz_restore_storage_failed");
  const committed = committedOwnerState as StoredWildzOwnerState;
  return {
    restoreStatus: "committed",
    surface: input.surface,
    artifactKind: inspection.kind,
    session,
    playState: committed.playState,
    character: committed.character,
    playerContinuity: continuityFromOwner(committed),
    verifiedAssetIds,
    commerceProjection: inspection.kind === "commerce-vault" ? inspection.projection : null
  };
}
