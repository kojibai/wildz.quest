import {
  buildReceizIdContinueRequest,
  createReceizIdIdentity,
  RECEIZ_DEVICE_IDENTITY_SCHEMA,
  type ReceizDeviceIdentity,
  type ReceizKeyFile
} from "@receiz/sdk";
import {
  createStoredWildzPlayState,
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
  embedPortableVaultInPng,
  portableVaultPngBlob,
  readPortableVaultFromPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import type { PortableCardAsset } from "../../features/play/portable-card";
import type { WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import { inspectReceizCommerceVault } from "./receiz-commerce-vault";
import {
  createWildzIdentityCardArtworkPng,
  createWildzIdentitySealPng
} from "./wildz-identity-seal";
import { appendWildzIdentitySealAuthority } from "./wildz-identity-seal";
import {
  appendWildzIdentityBindingTrailer,
  createWildzIdentityBinding
} from "./wildz-identity-binding";
import { createWildzArtifactCodec, type WildzArtifactCodec } from "./wildz-artifact-codec";
import {
  createWildzAutomaticUsername,
  createWildzIdentityRepository,
  wildzOwnerScope,
  type WildzIdentityRepository,
  type WildzIdentitySession
} from "./wildz-identity-repository";
import { createWildzPendingVaultRepository } from "./wildz-pending-vault";
import {
  createWildzVaultLoginCoordinator,
} from "./wildz-vault-login-coordinator";
import {
  reconcileWildzRemoteIdentitySession,
  wildzRemoteSessionMatchesIdentity,
  type WildzRemoteSession,
  wildzRemoteSessionBridge
} from "./wildz-session-bridge";
import {
  createWildzContinuityDatabase,
  type WildzContinuityDatabase
} from "../storage/wildz-indexed-db";
import { openWildzArtifactSameOrigin, verifyWildzArtifactSameOrigin } from "./wildz-same-origin-verifier";
import { createWildzArtifactHistory } from "./wildz-artifact-history";

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
const defaultArtifactHistory = createWildzArtifactHistory(defaultContinuityDatabase);
const defaultArtifactCodec = createWildzArtifactCodec({
  identityRepository: defaultIdentityRepository,
  commerceVaultReader: { inspect: inspectReceizCommerceVault },
  artifactOpener: {
    async open(input) {
      const admitted = await openWildzArtifactSameOrigin(input);
      await defaultArtifactHistory.append(admitted);
      return admitted;
    }
  }
});
const defaultPendingVaultRepository = createWildzPendingVaultRepository({ database: defaultContinuityDatabase });
const defaultVaultLoginCoordinator = createWildzVaultLoginCoordinator({
  database: defaultContinuityDatabase,
  repository: defaultIdentityRepository,
  codec: defaultArtifactCodec,
  pending: defaultPendingVaultRepository,
  verifier: {
    verifyArtifact: verifyWildzArtifactSameOrigin,
    openArtifact: openWildzArtifactSameOrigin
  },
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
export type WildzRestoreIntent = "merge-vault" | "activate-identity";

export async function alignWildzContinuityWithProofSession(
  snapshot: WildzContinuitySnapshot,
  remote: WildzRemoteSession,
  dependencies: {
    database?: WildzContinuityDatabase;
    repository?: Pick<WildzIdentityRepository, "active" | "writeSession">;
  } = {}
): Promise<WildzContinuitySnapshot> {
  if (!wildzRemoteSessionMatchesIdentity(snapshot.session, remote) || remote.status !== "connected") {
    throw new Error("wildz_proof_session_mismatch");
  }
  if (snapshot.session.actorId === remote.actorId
    && snapshot.session.username === remote.actorId
    && snapshot.session.displayName === remote.displayName
    && snapshot.session.remoteStatus === "connected") {
    return snapshot;
  }
  const database = dependencies.database ?? defaultContinuityDatabase;
  const repository = dependencies.repository ?? defaultIdentityRepository;
  return enqueueContinuityOperation(async () => {
    const active = await repository.active();
    if (!sameOwner(active, snapshot.session)) throw new Error("wildz_proof_session_stale");
    const session: WildzIdentitySession = {
      ...snapshot.session,
      actorId: remote.actorId,
      username: remote.actorId,
      displayName: remote.displayName,
      remoteStatus: "connected"
    };
    const oldScope = wildzOwnerScope(snapshot.session.keyId, snapshot.session.actorId);
    const nextScope = wildzOwnerScope(session.keyId, session.actorId);
    const stored = snapshot.playState
      ? createStoredWildzPlayState(
          session,
          snapshot.playState,
          snapshot.playerContinuity,
          new Date().toISOString(),
          snapshot.character
        )
      : null;
    await database.transaction(["meta", "ownerStates"], "readwrite", async (tx) => {
      await repository.writeSession(tx, session, true);
      if (stored) await tx.put("ownerStates", stored, nextScope);
      if (oldScope !== nextScope) await tx.delete("ownerStates", oldScope);
    });
    return { ...snapshot, session };
  });
}

type WildzProofChallengeResponse = {
  ok: true;
  nonceB64Url: string;
};

function enqueueContinuityOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = continuityQueue.then(operation, operation);
  continuityQueue = result.then(() => undefined, () => undefined);
  return result;
}

function sameOwner(left: WildzIdentitySession | null, right: WildzIdentitySession) {
  return left?.keyId === right.keyId && left.actorId === right.actorId;
}

function isWildzProofChallengeResponse(value: unknown): value is WildzProofChallengeResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WildzProofChallengeResponse>;
  return candidate.ok === true
    && typeof candidate.nonceB64Url === "string"
    && /^[A-Za-z0-9_-]{22,256}$/.test(candidate.nonceB64Url);
}

function receizDeviceIdentityFromKeyFile(keyFile: ReceizKeyFile): ReceizDeviceIdentity {
  const localUid = keyFile.owner.uid?.trim() ?? "";
  const username = keyFile.owner.username?.trim() ?? "";
  const displayName = keyFile.owner.displayName?.trim() || "Receiz ID";
  if (!localUid || !username || !Number.isFinite(Date.parse(keyFile.issuedAt))) {
    throw new Error("wildz_receiz_id_identity_invalid");
  }
  return {
    schema: RECEIZ_DEVICE_IDENTITY_SCHEMA,
    createdAt: keyFile.issuedAt,
    updatedAt: keyFile.issuedAt,
    localUid,
    username,
    displayName,
    deviceName: "Wildz",
    keyFile
  };
}

export async function connectWildzProofSession(
  session: WildzIdentitySession,
  options: { passphrase?: string; requestPassphrase?: () => string | null } = {}
) {
  const current = await wildzRemoteSessionBridge.current();
  if (wildzRemoteSessionMatchesIdentity(session, current)) return current;
  if (session.localAuthority === "proof-sealed-vault") {
    return wildzRemoteSessionBridge.commitVaultAdmission({
      actorId: session.actorId,
      profileHandle: `${session.actorId}.receiz.id`,
      vaultKeyId: session.keyId
    });
  }
  if (session.localAuthority !== "verified") {
    return wildzRemoteSessionBridge.current();
  }
  return defaultIdentityRepository.withKeyFile(session.keyId, async (keyFile) => {
    const challengeResponse = await fetch("/api/auth/wildz/challenge", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store"
    });
    const challenge: unknown = await challengeResponse.json().catch(() => null);
    if (!challengeResponse.ok || !isWildzProofChallengeResponse(challenge)) {
      throw new Error("wildz_proof_challenge_unavailable");
    }
    let passphrase = options.passphrase;
    if (identityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
      passphrase = options.requestPassphrase?.()
        ?? (typeof window !== "undefined"
          ? window.prompt("Enter this Identity Seal's passphrase to connect Wildz.") ?? undefined
          : undefined);
    }
    const continuation = await buildReceizIdContinueRequest(
      receizDeviceIdentityFromKeyFile(keyFile),
      {
        nonceB64Url: challenge.nonceB64Url,
        ...(passphrase !== undefined ? { passphrase } : {})
      }
    );
    const admission = await fetch("/api/auth/wildz/session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(continuation)
    });
    if (!admission.ok) throw new Error("wildz_proof_admission_failed");
    return wildzRemoteSessionBridge.current();
  });
}

export async function claimWildzProfileIdentity(
  snapshot: WildzContinuitySnapshot,
  input: { username: string; displayName?: string },
  options: { passphrase?: string; requestPassphrase?: () => string | null } = {}
): Promise<WildzContinuitySnapshot> {
  if (snapshot.session.localAuthority !== "verified") throw new Error("wildz_username_claim_requires_identity_key");
  const username = normalizedIdentitySealUsername(input.username);
  const displayName = input.displayName?.trim().slice(0, 80) || "Wildz Explorer";
  return defaultIdentityRepository.withKeyFile(snapshot.session.keyId, async (keyFile) => {
    const challengeResponse = await fetch("/api/auth/wildz/challenge", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store"
    });
    const challenge: unknown = await challengeResponse.json().catch(() => null);
    if (!challengeResponse.ok || !isWildzProofChallengeResponse(challenge)) {
      throw new Error("wildz_username_check_unavailable");
    }
    let passphrase = options.passphrase;
    if (identityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
      passphrase = options.requestPassphrase?.()
        ?? (typeof window !== "undefined"
          ? window.prompt("Enter this Identity Seal's passphrase to update your profile.") ?? undefined
          : undefined);
    }
    const identity = {
      ...receizDeviceIdentityFromKeyFile(keyFile),
      username,
      displayName
    } satisfies ReceizDeviceIdentity;
    const continuation = await buildReceizIdContinueRequest(identity, {
      nonceB64Url: challenge.nonceB64Url,
      ...(passphrase !== undefined ? { passphrase } : {})
    });
    const admission = await fetch("/api/auth/wildz/session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(continuation)
    });
    const response = await admission.json().catch(() => null) as { status?: unknown; error?: unknown } | null;
    if (admission.status === 409 || response?.status === "conflict") throw new Error("wildz_username_taken");
    if (!admission.ok) throw new Error("wildz_username_check_unavailable");
    const canonical = await wildzRemoteSessionBridge.current();
    if (canonical.status !== "connected"
      || canonical.sessionKeyId !== snapshot.session.keyId
      || canonical.actorId !== username) {
      throw new Error("wildz_username_claim_unverified");
    }
    return alignWildzContinuityWithProofSession(snapshot, canonical);
  });
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
    if (session.localAuthority === "remote-only") {
      const reconciliation = reconcileWildzRemoteIdentitySession(
        session,
        await wildzRemoteSessionBridge.current()
      );
      if (reconciliation.disconnect) await wildzRemoteSessionBridge.disconnect();
      session = reconciliation.session;
    }
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

export async function createNamedWildzIdentity(
  current: WildzContinuitySnapshot,
  input: { username: string; displayName?: string },
  dependencies: {
    database?: WildzContinuityDatabase;
    repository?: Pick<WildzIdentityRepository, "active" | "prepare" | "writePrepared">;
    createIdentity?: typeof createReceizIdIdentity;
  } = {}
): Promise<WildzContinuitySnapshot> {
  return enqueueContinuityOperation(async () => {
    if (current.character || current.playState) throw new Error("wildz_identity_username_change_not_fresh");
    if (current.restoreEpoch !== continuityRestoreEpoch) throw new Error("wildz_identity_username_change_stale");
    const database = dependencies.database ?? defaultContinuityDatabase;
    const repository = dependencies.repository ?? defaultIdentityRepository;
    const active = await repository.active();
    if (!sameOwner(active, current.session)) throw new Error("wildz_identity_username_change_stale");
    const username = normalizedIdentitySealUsername(input.username);
    const identity = await (dependencies.createIdentity ?? createReceizIdIdentity)({
      username,
      displayName: input.displayName?.trim() || "Wildz Explorer",
      deviceName: "Wildz"
    });
    const prepared = await repository.prepare(identity.keyFile);
    await database.transaction(["identities", "meta"], "readwrite", (tx) =>
      repository.writePrepared(tx, prepared, true)
    );
    continuityRestoreEpoch += 1;
    return {
      session: prepared.session,
      playState: null,
      character: null,
      playerContinuity: null,
      restoreEpoch: continuityRestoreEpoch
    };
  });
}

export async function restoreWildzFileForSurface(
  file: File,
  surface: "genesis" | "card-vault",
  confirmCardOnly: WildzCardOnlyConfirmation,
  current: WildzContinuitySnapshot,
  currentPlayState: PlayState | null = current.playState,
  intent: WildzRestoreIntent
): Promise<WildzUiArtifactRestore> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return enqueueContinuityOperation(async () => {
    if (current.restoreEpoch !== continuityRestoreEpoch) throw new Error("wildz_restore_cursor_stale");
    const active = await defaultIdentityRepository.active();
    if (!sameOwner(active, current.session)) throw new Error("wildz_restore_cursor_stale");
    const inspection = await defaultArtifactCodec.inspect({
      bytes,
      mimeType: file.type,
      name: file.name
    });
    if (inspection.kind === "invalid" || inspection.kind === "unsupported") throw new Error(inspection.code);
    if (intent === "activate-identity" && inspection.kind !== "identity-seal") throw new Error("wildz_identity_seal_required");
    if (intent === "merge-vault" && inspection.kind === "identity-seal") throw new Error("wildz_vault_required");
    const outcome = await restoreWildzArtifactForSurface({
      surface,
      bytes,
      mimeType: file.type,
      name: file.name,
      codec: defaultArtifactCodec,
      repository: defaultIdentityRepository,
      database: defaultContinuityDatabase,
      confirmCardOnly,
      currentPlayerContinuity: current.playerContinuity,
      currentCharacter: current.character,
      ...(currentPlayState ? { currentPlayState } : {}),
      ...(intent === "merge-vault" ? { preserveActiveIdentity: true } : { carryCurrentVault: true })
    });
    continuityRestoreEpoch += 1;
    return { ...outcome, restoreEpoch: continuityRestoreEpoch };
  });
}

export function resumePendingWildzVault(resumeId: string) {
  return enqueueContinuityOperation(async () => {
    await defaultPendingVaultRepository.purgeExpired().catch(() => 0);
    const outcome = await defaultVaultLoginCoordinator.resume(resumeId);
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

export async function createWildzIdentityPlayerCard(input: {
  keyFile: ReceizKeyFile;
  session: WildzIdentitySession;
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload;
  passphrase?: string;
}) {
  if (input.keyFile.keyId !== input.session.keyId) throw new Error("wildz_identity_card_key_id_mismatch");
  const artwork = await createWildzIdentityCardArtworkPng(input.session);
  const vaultBytes = embedPortableVaultInPng(artwork, input.assets, input.player);
  return createWildzIdentityBoundPlayerVault({
    keyFile: input.keyFile,
    vaultBytes,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
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

export async function downloadWildzIdentityPlayerCard(
  session: WildzIdentitySession,
  assets: PortableCardAsset[],
  player: WildsPlayerVaultPayload,
  options: {
    passphrase?: string;
    requestPassphrase?: () => string | null;
  } = {}
) {
  if (session.localAuthority !== "verified") throw new Error("wildz_identity_card_authority_required");
  const username = normalizedIdentitySealUsername(session.username);
  const combined = await defaultIdentityRepository.withKeyFile(session.keyId, async (keyFile) => {
    let passphrase = options.passphrase;
    if (identityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
      passphrase = options.requestPassphrase?.()
        ?? (typeof window !== "undefined"
          ? window.prompt("Enter this Identity Seal's passphrase to sign the Receiz ID Card.") ?? undefined
          : undefined);
    }
    return createWildzIdentityPlayerCard({
      keyFile,
      session,
      assets,
      player,
      ...(passphrase !== undefined ? { passphrase } : {})
    });
  });
  downloadBlob(
    new Blob([combined.slice().buffer], { type: "image/png" }),
    `${username}.receiz-id-card.png`
  );
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

export async function downloadCurrentWildzIdentitySeal(session: WildzIdentitySession) {
  return downloadWildzIdentitySeal(defaultIdentityRepository, session);
}
