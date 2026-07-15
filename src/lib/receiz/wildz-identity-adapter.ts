import {
  createReceizIdIdentity,
  type ReceizKeyFile
} from "@receiz/sdk";
import {
  loadWildzRestoredPlayState,
  restoreWildzArtifactForSurface,
  saveWildzRestoredPlayState,
  type WildzCardOnlyConfirmation,
  type WildzCommittedArtifactRestore
} from "../../features/identity/wildz-restore";
import { restorePlayState, type PlayState } from "../../features/play/game-state";
import { inspectReceizCommerceVault } from "./receiz-commerce-vault";
import { createWildzIdentitySealPng } from "./wildz-identity-seal";
import { createWildzArtifactCodec, type WildzArtifactCodec } from "./wildz-artifact-codec";
import {
  createWildzIdentityRepository,
  type WildzIdentityRepository,
  type WildzIdentitySession
} from "./wildz-identity-repository";
import { createWildzContinuityDatabase } from "../storage/wildz-indexed-db";

const IDENTITY_SEAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export async function createAutomaticWildzIdentity() {
  return createReceizIdIdentity({ displayName: "Wildz Explorer", deviceName: "Wildz" });
}

const LEGACY_PLAY_STATE_STORAGE_KEY = "receiz:wilds:save:v2";
const defaultContinuityDatabase = createWildzContinuityDatabase();
const defaultIdentityRepository = createWildzIdentityRepository({ database: defaultContinuityDatabase });
const defaultArtifactCodec = createWildzArtifactCodec({
  identityRepository: defaultIdentityRepository,
  commerceVaultReader: { inspect: inspectReceizCommerceVault }
});
let continuityRestoreEpoch = 0;
let continuityQueue: Promise<void> = Promise.resolve();

export type WildzContinuitySnapshot = {
  session: WildzIdentitySession;
  playState: PlayState | null;
  restoreEpoch: number;
};

export type WildzUiArtifactRestore = WildzCommittedArtifactRestore & { restoreEpoch: number };

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
    const session = await defaultIdentityRepository.bootstrap(legacyStorage);
    let playState = await loadWildzRestoredPlayState({ database: defaultContinuityDatabase, session });
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
    }
    return { session, playState, restoreEpoch: continuityRestoreEpoch };
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
    const outcome = await restoreWildzArtifactForSurface({
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

export function saveWildzContinuityPlayState(current: WildzContinuitySnapshot, playState: PlayState) {
  return enqueueContinuityOperation(async () => {
    if (current.restoreEpoch !== continuityRestoreEpoch) return null;
    const active = await defaultIdentityRepository.active();
    if (!sameOwner(active, current.session)) return null;
    return saveWildzRestoredPlayState({ database: defaultContinuityDatabase, session: current.session, playState });
  });
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
