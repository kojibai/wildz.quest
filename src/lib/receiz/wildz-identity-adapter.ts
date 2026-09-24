import { prepareWildzGameImage } from "./wildz-game-image-export";
import { openWildzSealedCard, verifyWildzSealedCard } from "./wildz-sealed-card";
import { createWildzIdentityPlayerVaultPreparer, savePreparedWildzIdentityPlayerVault } from "./wildz-prepared-player-vault";
export { savePreparedWildzIdentityPlayerVault, type WildzPreparedIdentityPlayerVault } from "./wildz-prepared-player-vault";
import { mergeWildzCrewCustody, readWildzArtifactCrewCustody, type WildzCrewCustody } from "./wildz-artifact-codec";
import { reopenWildzCrewCustody, wildzCrewCustodySourceKey } from "./wildz-crew-custody-source";
import { defaultContinuityDatabase, defaultIdentityRepository } from "./wildz-active-identity";
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
  createReceizProofObjectArtifact,
  saveBlobToDevice,
  embedPortableVaultInPng,
  portableCardPngBlobForIdentityOwnership,
  portableCreatureFilename,
  portableVaultPngBlob,
} from "../../features/play/card-export";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { cardArtifactFingerprint } from "../../features/play/prepared-card-artifact";
import { createWildzPreparedCardCache } from "./wildz-prepared-card-cache";
import { matchesWildzOwnedCardExport, normalizedWildzExportCardFingerprint } from "./wildz-owned-card-export";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { receizBase64UrlDecode } from "@receiz/sdk";
import {
  createWildsPlayerVault,
  type WildsPlayerVaultPayload
} from "../../features/play/wilds-player-vault";
import { inspectReceizCommerceVault } from "./receiz-commerce-vault";
import {
  createWildzIdentityCardArtworkPng,
  createWildzIdentitySealPng,
  wildzIdentitySealFilename
} from "./wildz-identity-seal";
import { createWildzIdentityPlayerCardOffThread, createWildzIdentityPlayerCardBundleOffThread } from "./wildz-identity-export-client";
import {
  createWildzIdentityBoundPlayerVault,
  wildzIdentityKeyNeedsPassphrase
} from "./wildz-identity-vault-binding";
export { createWildzIdentityBoundPlayerVault } from "./wildz-identity-vault-binding";
import {
  createWildzArtifactCodec,
  type WildzArtifactCodec,
  type WildzArtifactInspection
} from "./wildz-artifact-codec";
import {
  createWildzAutomaticUsername,
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
  type WildzContinuityDatabase
} from "../storage/wildz-indexed-db";
import { openWildzArtifactSameOrigin, verifyWildzArtifactSameOrigin } from "./wildz-same-origin-verifier";
import { createWildzArtifactHistory } from "./wildz-artifact-history";
import { createWildzProofSourceRepository } from "./wildz-proof-source-repository";
import { createWildzIdentityVaultAdmissionProof } from "./wildz-identity-vault-admission";
import type { WildzVaultCardAdmission } from "./wildz-vault-card-admission";

const IDENTITY_SEAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export async function createAutomaticWildzIdentity() {
  return createReceizIdIdentity({
    username: createWildzAutomaticUsername(),
    displayName: "Wildz Explorer",
    deviceName: "Wildz"
  });
}

const LEGACY_PLAY_STATE_STORAGE_KEY = "receiz:wilds:save:v2";
export { defaultIdentityRepository } from "./wildz-active-identity";
const defaultArtifactHistory = createWildzArtifactHistory(defaultContinuityDatabase);
export const defaultWildzProofSourceRepository = createWildzProofSourceRepository(defaultContinuityDatabase);
const defaultArtifactCodec = createWildzArtifactCodec({
  identityRepository: defaultIdentityRepository,
  sealedDocumentStore: defaultWildzProofSourceRepository,
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
  crewCustody?: WildzCrewCustody | null;
  session: WildzIdentitySession;
  playState: PlayState | null;
  character: WildzCharacterGenesis | null;
  playerContinuity: WildzPlayerContinuity | null;
  restoreEpoch: number;
};

export type WildzUiArtifactRestore = WildzCommittedArtifactRestore & { restoreEpoch: number; crewCustody?: WildzCrewCustody | null };
export type WildzRestoreIntent = "merge-vault" | "activate-identity";

export function commitWildzBootstrapContinuity(input: WildzContinuitySnapshot): WildzContinuitySnapshot {
  return {
    session: input.session,
    crewCustody: input.crewCustody,
    playState: input.playState,
    character: input.character,
    playerContinuity: input.playerContinuity,
    restoreEpoch: input.restoreEpoch
  };
}

export function commitWildzArtifactContinuity(
  outcome: Pick<WildzUiArtifactRestore, "session" | "playState" | "character" | "playerContinuity" | "restoreEpoch" | "crewCustody">
): WildzContinuitySnapshot {
  return commitWildzBootstrapContinuity(outcome);
}

export function resetWildzIdentityContinuity(
  session: WildzIdentitySession,
  restoreEpoch: number
): WildzContinuitySnapshot {
  return { session, playState: null, character: null, playerContinuity: null, restoreEpoch };
}

function isWildzVaultBearingInspection(
  inspection: Awaited<ReturnType<WildzArtifactCodec["inspect"]>>
) {
  if (inspection.kind === "card-vault" || inspection.kind === "commerce-vault") return true;
  return inspection.kind === "identity-seal"
    && Boolean(inspection.player);
}

export function isWildzIdentityActivationInspection(
  inspection: Awaited<ReturnType<WildzArtifactCodec["inspect"]>>
) {
  if (inspection.kind === "identity-seal") return true;
  return inspection.kind === "card-vault"
    && Boolean(inspection.identity)
    && inspection.playerBinding === "identity-v3-binding";
}

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
      if (stored && oldScope !== nextScope) await tx.put("ownerStates", stored, nextScope);
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
  options: {
    passphrase?: string;
    forceRemote?: boolean;
    requestPassphrase?: () => string | null;
    vaultAdmission?: WildzVaultCardAdmission;
  } = {}
) {
  const current = await wildzRemoteSessionBridge.current();
  if (!options.forceRemote && current.status === "connected"
    && wildzRemoteSessionMatchesIdentity(session, current)
    && (!options.vaultAdmission || current.vaultCardRootSha256 === options.vaultAdmission.root)) return current;
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
    const vaultCardAdmission = options.vaultAdmission
      ? await createWildzIdentityVaultAdmissionProof({
        keyFile,
        session,
        admission: options.vaultAdmission,
        ...(passphrase !== undefined ? { passphrase } : {})
      })
      : null;
    const admission = await fetch("/api/auth/wildz/session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...continuation,
        ...(vaultCardAdmission ? { vaultCardAdmission } : {})
      })
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

export type WildzPreparedRestore = Readonly<{
  file: File;
  bytes: Uint8Array;
  inspection: WildzArtifactInspection;
}>;

export async function prepareWildzRestore(
  file: File,
  codec: WildzArtifactCodec = defaultArtifactCodec
): Promise<WildzPreparedRestore> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspection = await codec.inspect({ bytes, mimeType: file.type, name: file.name });
  return { file, bytes, inspection };
}

export async function inspectWildzRestore(file: File, codec: WildzArtifactCodec = defaultArtifactCodec) {
  return (await prepareWildzRestore(file, codec)).inspection;
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
      // Only a reconciled remote session needs rewriting. Local bootstrap
      // already read (or atomically created) this exact active session.
      await defaultContinuityDatabase.transaction(["meta"], "readwrite", (tx) =>
        defaultIdentityRepository.writeSession(tx, session, true)
      );
    }
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
    return commitWildzBootstrapContinuity({
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
    });
  });
}

/** Optional source reopening runs after bootstrap so offline verification cannot
 * hold the world or original creatures behind a captured-card source. */
export async function reopenWildzContinuityCrewCustody(snapshot: WildzContinuitySnapshot) {
  if (!snapshot.playState || snapshot.crewCustody) return snapshot.crewCustody ?? null;
  const sourceCustody = await reopenWildzCrewCustody({ owner: snapshot.session.actorId, cards: snapshot.playState.inventory,
    sources: await defaultContinuityDatabase.read("meta", wildzCrewCustodySourceKey(snapshot.session.keyId, snapshot.session.actorId)),
    history: { async read(sha) {
      const native = await defaultArtifactHistory.read(sha);
      if (native) return native;
      const seal = await defaultContinuityDatabase.read<{ bytes: Uint8Array; mimeType: string }>("meta", `wildz:crew-seal-source:v1:${sha}`);
      return seal ? { artifactBytes: seal.bytes, mimeType: seal.mimeType, filename: "identity-seal" } : null;
    } }, codec: defaultArtifactCodec });
  const sealCustody = await defaultIdentityRepository.withKeyFile(snapshot.session.keyId, async keyFile => {
    if (!keyFile.portableState) return null;
    const inspection = await defaultArtifactCodec.inspect({
      bytes: new TextEncoder().encode(JSON.stringify(keyFile)), mimeType: "application/json"
    });
    return readWildzArtifactCrewCustody(inspection);
  }).catch(() => null);
  return mergeWildzCrewCustody(snapshot.session.actorId, [sourceCustody, sealCustody], snapshot.playState.inventory);
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
    return resetWildzIdentityContinuity(prepared.session, continuityRestoreEpoch);
  });
}

export async function restoreWildzFileForSurface(
  file: File,
  surface: "genesis" | "card-vault",
  confirmCardOnly: WildzCardOnlyConfirmation,
  current: WildzContinuitySnapshot,
  currentPlayState: PlayState | null = current.playState,
  intent: WildzRestoreIntent,
  prepared?: WildzPreparedRestore,
  roamingCaptureCard?: PortableCardAsset
): Promise<WildzUiArtifactRestore> {
  const admitted = prepared ?? await prepareWildzRestore(file);
  if (admitted.file !== file) throw new Error("wildz_restore_prepared_file_mismatch");
  const { bytes, inspection } = admitted;
  return enqueueContinuityOperation(async () => {
    if (current.restoreEpoch !== continuityRestoreEpoch) throw new Error("wildz_restore_cursor_stale");
    const active = await defaultIdentityRepository.active();
    if (!sameOwner(active, current.session)) throw new Error("wildz_restore_cursor_stale");
    if (inspection.kind === "invalid" || inspection.kind === "unsupported") throw new Error(inspection.code);
    if (intent === "activate-identity" && !isWildzIdentityActivationInspection(inspection)) {
      throw new Error("wildz_identity_seal_required");
    }
    if (intent === "merge-vault" && !isWildzVaultBearingInspection(inspection)) throw new Error("wildz_vault_required");
    const outcome = await restoreWildzArtifactForSurface({
      surface,
      bytes,
      mimeType: file.type,
      name: file.name,
      inspection,
      codec: defaultArtifactCodec,
      repository: defaultIdentityRepository,
      database: defaultContinuityDatabase,
      confirmCardOnly,
      currentPlayerContinuity: current.playerContinuity,
      currentCharacter: current.character,
      ...(roamingCaptureCard ? { roamingCaptureCard } : {}),
      ...(currentPlayState ? { currentPlayState } : {}),
      ...(intent === "merge-vault" ? { preserveActiveIdentity: true } : { carryCurrentVault: true })
    });
    const crewCustody = mergeWildzCrewCustody(outcome.session.actorId,
      [current.crewCustody, readWildzArtifactCrewCustody(inspection)], outcome.playState.inventory);
    continuityRestoreEpoch += 1;
    return { ...outcome, crewCustody, restoreEpoch: continuityRestoreEpoch };
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
  return wildzIdentityKeyNeedsPassphrase(keyFile);
}

export async function createWildzIdentityPlayerCard(input: {
  keyFile: ReceizKeyFile;
  session: WildzIdentitySession;
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload | Parameters<typeof createWildsPlayerVault>[0];
  passphrase?: string;
}) {
  if (input.keyFile.keyId !== input.session.keyId) throw new Error("wildz_identity_card_key_id_mismatch");
  const artwork = await createWildzIdentityCardArtworkPng(input.session, input.player.exportedAt);
  const offThread = await createWildzIdentityPlayerCardOffThread({
    artwork,
    assets: input.assets,
    player: input.player,
    keyFile: input.keyFile,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
  if (offThread) return offThread;
  const player = "payloadDigest" in input.player ? input.player : createWildsPlayerVault(input.player);
  const vaultBytes = embedPortableVaultInPng(artwork, input.assets, player);
  return createWildzIdentityBoundPlayerVault({
    keyFile: input.keyFile,
    vaultBytes,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
}

/** Background preparation never falls back to synchronous whole-vault work. */
export async function prepareWildzBackgroundPlayerVault(session: WildzIdentitySession, assets: PortableCardAsset[], player: Parameters<typeof createWildsPlayerVault>[0], options: { allowPrompt?: boolean } = {}) {
  if (session.localAuthority !== "verified") throw new Error("wildz_identity_vault_authority_required");
  if (!sameWildzPlayerCoordinate(player.playerId, session.username ?? session.actorId)) throw new Error("wildz_vault_export_owner_invalid");
  const artwork = await createWildzIdentityCardArtworkPng(session, player.exportedAt);
  return defaultIdentityRepository.withKeyFile(session.keyId, async keyFile => {
    if (keyFile.keyId !== session.keyId) throw new Error("wildz_identity_vault_key_id_mismatch");
    let passphrase: string | undefined;
    if (wildzIdentityKeyNeedsPassphrase(keyFile)) {
      if (!options.allowPrompt) throw new Error("wildz_identity_passphrase_required");
      passphrase = window.prompt("Enter this Identity Seal’s passphrase to sign the Vault export.") ?? undefined;
      if (!passphrase) throw new Error("wildz_identity_passphrase_required");
    }
    const result = await createWildzIdentityPlayerCardBundleOffThread({artwork, assets, player, keyFile, passphrase});
    if (!result) throw new Error("wildz_background_export_worker_unavailable");
    const sealed = await prepareWildzGameImage({ bytes: result.bytes, filename: `wilds-vault-${session.keyId}.png`, kind: "vault", allowEnrollment: options.allowPrompt === true });
    return { ...result, ...sealed,
      keyId: session.keyId, ownerReceizId: player.playerId };
  });
}

const preparePlayerVault = createWildzIdentityPlayerVaultPreparer({
  render: portableVaultPngBlob,
  sign: (keyId, action) => defaultIdentityRepository.withKeyFile(keyId, action)
});

export function prepareWildzIdentityPlayerVault(...args: Parameters<typeof preparePlayerVault>) {
  return preparePlayerVault(...args);
}

export async function downloadWildzIdentityPlayerVault(...args: Parameters<typeof preparePlayerVault>) {
  const prepared = await prepareWildzIdentityPlayerVault(...args);
  await savePreparedWildzIdentityPlayerVault(prepared);
  return { identityBound: true } as const;
}

export async function downloadWildzIdentityOwnedCard(
  session: WildzIdentitySession,
  asset: PortableCardAsset,
  player: WildsPlayerVaultPayload,
  options: {
    passphrase?: string;
    requestPassphrase?: () => string | null;
    allowPrompt?: boolean;
  } = {}
) {
  let prepared: WildzPreparedIdentityOwnedCard;
  try {
    prepared = await prepareWildzIdentityOwnedCard(session, asset, player, options);
  } catch (error) {
    // A Save can join the non-prompting background read. Its rejected cache entry
    // is removed before this catch, so the explicit action may now request a key.
    if (options.allowPrompt === false || !(error instanceof Error) || !["wildz_identity_passphrase_required", "offline_seal_enrollment_required"].includes(error.message)) throw error;
    prepared = await prepareWildzIdentityOwnedCard(session, asset, player, options);
  }
  await savePreparedWildzIdentityOwnedCard(prepared);
  return { identityBound: true, ownerReceizId: prepared.ownerReceizId } as const;
}

export type WildzPreparedIdentityOwnedCard = Readonly<{
  assetId: string;
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  ownerReceizId: string;
  cardFingerprint?: string;
  keyId?: string;
}>;

export function createWildzIdentityOwnedCardPreparer(dependencies: {
  database: WildzContinuityDatabase;
  sources: Pick<ReturnType<typeof createWildzProofSourceRepository>, "read" | "locateAsset" | "retain">;
  renderCard: typeof portableCardPngBlobForIdentityOwnership;
  sign: typeof defaultIdentityRepository.withKeyFile;
  seal: typeof createReceizProofObjectArtifact;
  verifySeal: (artifactBytes: Uint8Array, payloadBytes: Uint8Array) => Promise<unknown>;
  openSeal?: typeof openWildzSealedCard;
}) {
  const preparedOwnedCards = createWildzPreparedCardCache<WildzPreparedIdentityOwnedCard>();
  return async function prepareWildzIdentityOwnedCard(
    session: WildzIdentitySession,
    asset: PortableCardAsset,
    player: WildsPlayerVaultPayload,
    options: {
      passphrase?: string;
      requestPassphrase?: () => string | null;
      allowPrompt?: boolean;
    } = {}
  ): Promise<WildzPreparedIdentityOwnedCard> {
    if (session.localAuthority !== "verified") throw new Error("wildz_identity_card_authority_required");
    const ownerReceizId = session.username ?? session.actorId;
    // Export the active player's retained collection, preserving the card's
    // immutable first owner. A local export does not create a native transfer.
    if (!sameWildzPlayerCoordinate(player.playerId, ownerReceizId)
      || !player.playState.inventory.some(card => card.id === asset.id
        && normalizedWildzExportCardFingerprint(card) === normalizedWildzExportCardFingerprint(asset))) {
      throw new Error("wildz_identity_card_owner_mismatch");
    }
    const fingerprint = cardArtifactFingerprint(asset);
    const cacheKey = JSON.stringify(["wildz.prepared-owned-card.v2", session.keyId, ownerReceizId, asset.id, fingerprint]);
    const localCacheKey = JSON.stringify(["wildz.prepared-local-card.v2", session.keyId, ownerReceizId, asset.id, fingerprint]);
    return preparedOwnedCards.get(cacheKey, async () => {
      // A location hint is never authority: reopen the exact retained seal and verify
      // its inner identity signature and complete card before reusing any bytes.
      const local = await dependencies.database.read<WildzPreparedIdentityOwnedCard>("meta", localCacheKey).catch(() => null);
      if (local && local.bytes instanceof Uint8Array) {
        try {
          const opened = await (dependencies.openSeal ?? openWildzSealedCard)({ bytes: local.bytes, mimeType: local.mimeType, name: local.filename });
          if ((opened.ownerReceizId === null || sameWildzPlayerCoordinate(opened.ownerReceizId, ownerReceizId))
            && await matchesWildzOwnedCardExport(opened.payloadBytes, { asset, keyId: session.keyId, ownerReceizId }))
            return { ...local, ownerReceizId, cardFingerprint: fingerprint, keyId: session.keyId, assetId: asset.id };
        } catch { /* A stale or invalid cached payload is never a saved proof object. */ }
      }
      const indexed = await dependencies.database.read<string>("meta", cacheKey).catch(() => null);
      // Only an exact prepared-file index is relevant. Walking historical source
      // files on every changed card made Save repeatedly verify unrelated seals.
      const candidates = typeof indexed === "string" ? [indexed] : [];
      for (const sha of candidates) {
        try {
          const source = await dependencies.sources.read(sha);
          if (!source) continue;
          const bytes = receizBase64UrlDecode(source.artifact.exactBytesB64u);
          const opened = await (dependencies.openSeal ?? openWildzSealedCard)({ bytes, mimeType: source.artifact.mimeType, name: source.artifact.filename });
          if (opened.ownerReceizId !== null && !sameWildzPlayerCoordinate(opened.ownerReceizId, ownerReceizId)) continue;
          const payload = opened.payloadBytes;
          if (!await matchesWildzOwnedCardExport(payload, { asset, keyId: session.keyId, ownerReceizId })) continue;
          void dependencies.database.transaction(["meta"], "readwrite", tx => tx.put("meta", sha, cacheKey)).catch(() => {});
          return { assetId: asset.id, bytes, filename: source.artifact.filename, mimeType: source.artifact.mimeType,
            ownerReceizId, cardFingerprint: fingerprint, keyId: session.keyId };
        } catch { /* An old or mismatched source cannot replace this exact current card. */ }
      }
      const activePlayer = createWildsPlayerVault({
        playerId: session.username ?? session.actorId,
        exportedAt: new Date().toISOString(),
        playState: { ...player.playState, inventory: [asset] },
        character: player.character,
        settings: player.settings,
        personalEvents: player.personalEvents,
        canonicalCursor: player.canonicalCursor,
        receipts: player.receipts
      });
      const portable = await dependencies.renderCard(asset);
      const playerCardBytes = embedPortableVaultInPng(
        new Uint8Array(await portable.arrayBuffer()),
        [asset],
        activePlayer
      );
      const combined = await dependencies.sign(session.keyId, async (keyFile) => {
        let passphrase = options.passphrase;
        if (identityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
          if (options.allowPrompt === false) throw new Error("wildz_identity_passphrase_required");
          passphrase = options.requestPassphrase?.()
            ?? (typeof window !== "undefined"
              ? window.prompt("Enter this Identity Seal's passphrase to sign the card export.") ?? undefined
              : undefined);
        }
        return createWildzIdentityBoundPlayerVault({
          keyFile,
          vaultBytes: playerCardBytes,
          ...(passphrase !== undefined ? { passphrase } : {})
        });
      });
      if (!await matchesWildzOwnedCardExport(combined, { asset, keyId: session.keyId, ownerReceizId }))
        throw new Error("wildz_identity_card_export_invalid");
      const sealed = await dependencies.seal(new Blob([combined.slice().buffer], { type: "image/png" }),
        `${portableCreatureFilename(asset.manifest.name)}.png`, "vault", undefined, { allowEnrollment: options.allowPrompt !== false });
      await dependencies.verifySeal(sealed.bytes, combined);
      const opened = await (dependencies.openSeal ?? openWildzSealedCard)({ bytes: sealed.bytes, mimeType: sealed.mimeType, name: sealed.filename });
      if ((opened.ownerReceizId !== null && !sameWildzPlayerCoordinate(opened.ownerReceizId, ownerReceizId))
        || !await matchesWildzOwnedCardExport(opened.payloadBytes, { asset, keyId: session.keyId, ownerReceizId }))
        throw new Error("wildz_identity_card_export_invalid");
      const artifact: WildzPreparedIdentityOwnedCard = {
        assetId: asset.id,
        bytes: sealed.bytes,
        filename: sealed.filename,
        mimeType: sealed.mimeType,
        ownerReceizId: activePlayer.playerId,
        cardFingerprint: fingerprint,
        keyId: session.keyId
      };
      void dependencies.database.transaction(["meta"], "readwrite", tx => tx.put("meta", artifact, localCacheKey)).catch(() => {});
      void dependencies.sources.retain({ bytes: artifact.bytes, filename: artifact.filename,
        mimeType: artifact.mimeType, assetId: asset.id }).then(source =>
        dependencies.database.transaction(["meta"], "readwrite", tx => tx.put("meta", source.artifactSha256, cacheKey))
      ).catch(() => {});
      return artifact;
    });
  };
}

const prepareOwnedCard = createWildzIdentityOwnedCardPreparer({
  database: defaultContinuityDatabase,
  sources: defaultWildzProofSourceRepository,
  renderCard: portableCardPngBlobForIdentityOwnership,
  sign: (keyId, action) => defaultIdentityRepository.withKeyFile(keyId, action),
  seal: createReceizProofObjectArtifact,
  verifySeal: verifyWildzSealedCard
});

export async function prepareWildzIdentityOwnedCard(...args: Parameters<typeof prepareOwnedCard>) {
  return prepareOwnedCard(...args);
}

export function matchesPreparedWildzIdentityOwnedCard(artifact: WildzPreparedIdentityOwnedCard, session: WildzIdentitySession, asset: PortableCardAsset) {
  return artifact.assetId === asset.id && artifact.keyId === session.keyId
    && sameWildzPlayerCoordinate(artifact.ownerReceizId, session.username ?? session.actorId)
    && artifact.cardFingerprint === cardArtifactFingerprint(asset);
}

export async function savePreparedWildzIdentityOwnedCard(artifact: WildzPreparedIdentityOwnedCard) {
  await saveBlobToDevice(
    new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType }),
    artifact.filename
  );
  return { identityBound: true, ownerReceizId: artifact.ownerReceizId } as const;
}

export async function downloadWildzIdentityPlayerCard(
  session: WildzIdentitySession,
  assets: PortableCardAsset[],
  player: WildsPlayerVaultPayload | Parameters<typeof createWildsPlayerVault>[0],
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
  const artifact = await prepareWildzGameImage({ bytes: combined, filename: wildzIdentitySealFilename(username, player.exportedAt), kind: "vault" });
  await saveBlobToDevice(artifact.blob, artifact.filename);
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

  const exportedAt = new Date().toISOString();
  const bytes = await repository.withKeyFile(session.keyId, keyFile => createWildzIdentitySealPng(keyFile, session, exportedAt));
  const artifact = await prepareWildzGameImage({ bytes, filename: wildzIdentitySealFilename(username, exportedAt), kind: "identity" });
  await saveBlobToDevice(artifact.blob, artifact.filename);
}

export async function downloadCurrentWildzIdentitySeal(session: WildzIdentitySession) {
  return downloadWildzIdentitySeal(defaultIdentityRepository, session);
}
