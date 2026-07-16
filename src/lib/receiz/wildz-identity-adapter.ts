import {
  createReceizIdIdentity,
  type ReceizKeyFile
} from "@receiz/sdk";
import {
  loadWildzRestoredOwnerState,
  restoreWildzArtifactForSurface,
  saveWildzRestoredPlayState,
  type WildzCardOnlyConfirmation,
  type WildzCommittedArtifactRestore,
  type WildzPlayerContinuity
} from "../../features/identity/wildz-restore";
import { restorePlayState, type PlayState } from "../../features/play/game-state";
import type { WildzCharacterGenesis } from "../../features/identity/wildz-genesis";
import {
  downloadBlob,
  downloadPortableVault,
  portableVaultPngBlob,
  readPortableVaultFromPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import type { PortableCardAsset } from "../../features/play/portable-card";
import type { WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import { inspectReceizCommerceVault } from "./receiz-commerce-vault";
import { createWildzIdentitySealPng } from "./wildz-identity-seal";
import { appendWildzIdentitySealAuthority } from "./wildz-identity-seal";
import {
  appendWildzIdentityBindingTrailer,
  createWildzIdentityBinding
} from "./wildz-identity-binding";
import { createWildzArtifactCodec, type WildzArtifactCodec } from "./wildz-artifact-codec";
import {
  createWildzAutomaticUsername,
  createWildzIdentityRepository,
  type WildzIdentityRepository,
  type WildzIdentitySession
} from "./wildz-identity-repository";
import { createWildzPendingVaultRepository } from "./wildz-pending-vault";
import {
  createWildzVaultLoginCoordinator,
  type WildzVaultAccountMismatch,
  type WildzVaultLoginRequired
} from "./wildz-vault-login-coordinator";
import {
  reconcileWildzRemoteIdentitySession,
  wildzRemoteSessionBridge
} from "./wildz-session-bridge";
import { createWildzContinuityDatabase } from "../storage/wildz-indexed-db";
import { verifyWildzArtifactSameOrigin } from "./wildz-same-origin-verifier";

const IDENTITY_SEAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export async function createAutomaticWildzIdentity() {
  return createReceizIdIdentity({
    username: createWildzAutomaticUsername(),
    displayName: "Wildz Explorer",
    deviceName: "Wildz"
  });
}

const LEGACY_PLAY_STATE_STORAGE_KEY = "receiz:wilds:save:v2";
const defaultContinuityDatabase = createWildzContinuityDatabase();
const defaultIdentityRepository = createWildzIdentityRepository({ database: defaultContinuityDatabase });
const defaultArtifactCodec = createWildzArtifactCodec({
  identityRepository: defaultIdentityRepository,
  commerceVaultReader: { inspect: inspectReceizCommerceVault }
});
const defaultPendingVaultRepository = createWildzPendingVaultRepository({ database: defaultContinuityDatabase });
const defaultVaultLoginCoordinator = createWildzVaultLoginCoordinator({
  database: defaultContinuityDatabase,
  repository: defaultIdentityRepository,
  codec: defaultArtifactCodec,
  pending: defaultPendingVaultRepository,
  verifier: { verifyArtifact: verifyWildzArtifactSameOrigin },
  remote: wildzRemoteSessionBridge
});
let continuityRestoreEpoch = 0;
let continuityQueue: Promise<void> = Promise.resolve();

export type WildzContinuitySnapshot = {
  session: WildzIdentitySession;
  playState: PlayState | null;
  character: WildzCharacterGenesis | null;
  playerContinuity: WildzPlayerContinuity | null;
  restoreEpoch: number;
};

export type WildzUiArtifactRestore = WildzCommittedArtifactRestore & { restoreEpoch: number };

type WildzVaultRedirectOutcome = WildzVaultLoginRequired | WildzVaultAccountMismatch;

export class WildzVaultLoginRedirectError extends Error {
  readonly status: WildzVaultRedirectOutcome["status"];
  readonly loginUrl: string;
  readonly resumeId: string;

  constructor(outcome: WildzVaultRedirectOutcome) {
    super(outcome.status === "receiz_login_required"
      ? "wildz_restore_login_required"
      : "wildz_restore_receiz_account_mismatch");
    this.name = "WildzVaultLoginRedirectError";
    this.status = outcome.status;
    this.loginUrl = outcome.loginUrl;
    this.resumeId = outcome.resumeId;
  }
}

function enqueueContinuityOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = continuityQueue.then(operation, operation);
  continuityQueue = result.then(() => undefined, () => undefined);
  return result;
}

function sameOwner(left: WildzIdentitySession | null, right: WildzIdentitySession) {
  return left?.keyId === right.keyId && left.actorId === right.actorId;
}

export async function inspectWildzRestore(file: File, codec: WildzArtifactCodec = defaultArtifactCodec) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return codec.inspect({ bytes, mimeType: file.type, name: file.name });
}

export async function bootstrapWildzContinuity(
  legacyStorage?: Pick<Storage, "getItem" | "removeItem">
): Promise<WildzContinuitySnapshot> {
  return enqueueContinuityOperation(async () => {
    await defaultPendingVaultRepository.purgeExpired().catch(() => 0);
    let session = await defaultIdentityRepository.bootstrap(legacyStorage);
    const reconciliation = reconcileWildzRemoteIdentitySession(
      session,
      await wildzRemoteSessionBridge.current()
    );
    if (reconciliation.disconnect) await wildzRemoteSessionBridge.disconnect();
    session = reconciliation.session;
    await defaultContinuityDatabase.transaction(["meta"], "readwrite", (tx) =>
      defaultIdentityRepository.writeSession(tx, session, true)
    );
    let ownerState = await loadWildzRestoredOwnerState({ database: defaultContinuityDatabase, session });
    let playState = ownerState?.playState ?? null;
    const legacyRaw = playState === null ? legacyStorage?.getItem(LEGACY_PLAY_STATE_STORAGE_KEY) ?? null : null;
    if (legacyRaw !== null) {
      playState = await saveWildzRestoredPlayState({
        database: defaultContinuityDatabase,
        session,
        playState: restorePlayState(legacyRaw)
      });
      if (legacyStorage?.getItem(LEGACY_PLAY_STATE_STORAGE_KEY) === legacyRaw) {
        legacyStorage.removeItem(LEGACY_PLAY_STATE_STORAGE_KEY);
      }
      ownerState = await loadWildzRestoredOwnerState({ database: defaultContinuityDatabase, session });
    }
    return {
      session,
      playState,
      character: ownerState?.character ?? null,
      playerContinuity: ownerState ? {
        settings: ownerState.settings,
        personalEvents: ownerState.personalEvents,
        canonicalCursor: ownerState.canonicalCursor,
        receipts: ownerState.receipts
      } : null,
      restoreEpoch: continuityRestoreEpoch
    };
  });
}

export async function restoreWildzFileForSurface(
  file: File,
  surface: "genesis" | "card-vault",
  confirmCardOnly: WildzCardOnlyConfirmation,
  current: WildzContinuitySnapshot,
  currentPlayState: PlayState | null = current.playState
): Promise<WildzUiArtifactRestore> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return enqueueContinuityOperation(async () => {
    if (current.restoreEpoch !== continuityRestoreEpoch) throw new Error("wildz_restore_cursor_stale");
    const active = await defaultIdentityRepository.active();
    if (!sameOwner(active, current.session)) throw new Error("wildz_restore_cursor_stale");
    const playerVault = await defaultVaultLoginCoordinator.begin({
      surface,
      bytes,
      mimeType: file.type,
      name: file.name
    });
    if (playerVault.status !== "not_player_vault" && playerVault.status !== "committed") {
      throw new WildzVaultLoginRedirectError(playerVault);
    }
    const outcome = playerVault.status === "committed"
      ? playerVault.restore
      : await restoreWildzArtifactForSurface({
        surface,
        bytes,
        mimeType: file.type,
        name: file.name,
        codec: defaultArtifactCodec,
        repository: defaultIdentityRepository,
        database: defaultContinuityDatabase,
        confirmCardOnly,
        ...(currentPlayState ? { currentPlayState } : {})
      });
    continuityRestoreEpoch += 1;
    return { ...outcome, restoreEpoch: continuityRestoreEpoch };
  });
}

export function resumePendingWildzVault(resumeId: string) {
  return enqueueContinuityOperation(async () => {
    await defaultPendingVaultRepository.purgeExpired().catch(() => 0);
    const outcome = await defaultVaultLoginCoordinator.resume(resumeId);
    if (outcome.status !== "committed") return outcome;
    continuityRestoreEpoch += 1;
    return { status: "committed" as const, restore: { ...outcome.restore, restoreEpoch: continuityRestoreEpoch } };
  });
}

export function saveWildzContinuityPlayState(
  current: WildzContinuitySnapshot,
  playState: PlayState,
  playerContinuity?: WildzPlayerContinuity,
  character: WildzCharacterGenesis | null = current.character
) {
  return enqueueContinuityOperation(async () => {
    if (current.restoreEpoch !== continuityRestoreEpoch) return null;
    const active = await defaultIdentityRepository.active();
    if (!sameOwner(active, current.session)) return null;
    return saveWildzRestoredPlayState({
      database: defaultContinuityDatabase,
      session: current.session,
      playState,
      player: playerContinuity ?? current.playerContinuity,
      character
    });
  });
}

function identityKeyNeedsPassphrase(keyFile: ReceizKeyFile) {
  return !keyFile.crypto.privateKeyPkcs8B64u
    && keyFile.crypto.privateKeyPkcs8CiphertextB64u.length > 0;
}

export async function createWildzIdentityBoundPlayerVault(input: {
  keyFile: ReceizKeyFile;
  passphrase?: string;
  vaultBytes: Uint8Array;
}) {
  const verified = verifyPortableVaultPng(input.vaultBytes);
  const proof = readPortableVaultFromPng(input.vaultBytes);
  if (!verified.ok || !verified.player || proof.schema !== "receiz.wilds_vault_png_proof.v3" || !proof.player) {
    throw new Error("wildz_vault_export_proof_invalid");
  }
  if (identityKeyNeedsPassphrase(input.keyFile) && !input.passphrase) {
    throw new Error("wildz_identity_passphrase_required");
  }
  const withIdentity = appendWildzIdentitySealAuthority(input.vaultBytes, input.keyFile);
  const binding = await createWildzIdentityBinding({
    keyFile: input.keyFile,
    playerId: proof.player.playerId,
    vaultDigest: proof.vaultDigest,
    playerPayloadDigest: proof.player.payloadDigest,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
  return appendWildzIdentityBindingTrailer(withIdentity, binding);
}

export async function downloadWildzIdentityPlayerVault(
  session: WildzIdentitySession,
  assets: PortableCardAsset[],
  player: WildsPlayerVaultPayload,
  options: {
    passphrase?: string;
    requestPassphrase?: () => string | null;
  } = {}
) {
  if (session.localAuthority !== "verified") {
    await downloadPortableVault(assets, player);
    return { identityBound: false } as const;
  }
  const sealed = await portableVaultPngBlob(assets, player);
  const sealedBytes = new Uint8Array(await sealed.arrayBuffer());
  const proof = readPortableVaultFromPng(sealedBytes);
  if (proof.schema !== "receiz.wilds_vault_png_proof.v3" || !proof.player) {
    throw new Error("wildz_vault_export_proof_invalid");
  }
  const combined = await defaultIdentityRepository.withKeyFile(session.keyId, async (keyFile) => {
    let passphrase = options.passphrase;
    if (identityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
      passphrase = options.requestPassphrase?.()
        ?? (typeof window !== "undefined"
          ? window.prompt("Enter this Identity Seal's passphrase to sign the Vault export.") ?? undefined
          : undefined);
    }
    return createWildzIdentityBoundPlayerVault({
      keyFile,
      vaultBytes: sealedBytes,
      ...(passphrase !== undefined ? { passphrase } : {})
    });
  });
  const digest = proof.vaultDigest.slice(7, 19);
  downloadBlob(new Blob([combined.slice().buffer], { type: "image/png" }), `wilds-vault-${digest}.receized.png`);
  return { identityBound: true } as const;
}

function normalizedIdentitySealUsername(value: string | null) {
  const normalized = value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
  if (!IDENTITY_SEAL_USERNAME_PATTERN.test(normalized)) {
    throw new Error("wildz_identity_seal_username_invalid");
  }
  return normalized;
}

export async function downloadWildzIdentitySeal(
  repository: WildzIdentityRepository,
  session: WildzIdentitySession
) {
  const username = normalizedIdentitySealUsername(session.username);
  if (typeof document === "undefined") throw new Error("wildz_identity_seal_download_browser_required");

  const blob = await repository.withKeyFile(session.keyId, async (keyFile) => {
    const bytes = await createWildzIdentitySealPng(keyFile, session);
    const payload = new Uint8Array(bytes.byteLength);
    payload.set(bytes);
    return new Blob([payload.buffer], { type: "image/png" });
  });
  const url = URL.createObjectURL(blob);
  let anchor: HTMLAnchorElement | null = null;
  try {
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${username}.receiz-identity-seal.png`;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    URL.revokeObjectURL(url);
  }
}
