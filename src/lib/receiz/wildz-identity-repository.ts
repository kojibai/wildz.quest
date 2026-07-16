import {
  createReceizIdIdentity,
  parseReceizIdentityArtifactText,
  projectReceizIdentityAccount,
  receizBase64UrlDecode,
  receizBase64UrlEncode,
  serializeReceizIdentityArtifact,
  type ReceizIdentityAccountProjection,
  type ReceizKeyFile
} from "@receiz/sdk";
import {
  readLegacyWildzIdentitySource,
  WILDZ_IDENTITY_STORAGE_KEY,
  type WildzLegacyIdentityStorage
} from "../../features/identity/wildz-identity";
import {
  createWildzContinuityDatabase,
  type WildzContinuityDatabase,
  type WildzContinuityTransaction
} from "../storage/wildz-indexed-db";

export type WildzIdentitySession = {
  schema: "receiz.wildz.identity_session.v1";
  keyId: string;
  actorId: string;
  username: string | null;
  displayName: string | null;
  portableStateStatus: "verified" | "missing" | "invalid";
  localAuthority: "verified" | "remote-only";
  remoteStatus: "unknown" | "connected" | "pending" | "offline" | "unavailable";
};

export type PreparedWildzIdentity = {
  session: WildzIdentitySession;
  encryptedRecord: {
    schema: "receiz.wildz.encrypted_identity.v1";
    keyId: string;
    ivB64Url: string;
    ciphertextB64Url: string;
  };
};

export type WildzOwnerScope = `wildz:${string}:${string}`;

export type WildzActorOwnerInput = {
  owner: {
    username: string | null;
    uid: string | null;
  };
};

export interface WildzIdentityRepository {
  bootstrap(legacyStorage?: Pick<Storage, "getItem" | "removeItem">): Promise<WildzIdentitySession>;
  active(): Promise<WildzIdentitySession | null>;
  prepare(keyFile: ReceizKeyFile): Promise<PreparedWildzIdentity>;
  writeSession(tx: WildzContinuityTransaction, session: WildzIdentitySession, activate: boolean): Promise<void>;
  writePrepared(tx: WildzContinuityTransaction, prepared: PreparedWildzIdentity, activate: boolean): Promise<void>;
  withKeyFile<T>(keyId: string, operation: (keyFile: ReceizKeyFile) => Promise<T>): Promise<T>;
  logout(): Promise<void>;
}

type ActiveIdentityPointer = {
  schema: "receiz.wildz.active_identity.v1";
  keyId: string;
  actorId: string;
  ownerScope: WildzOwnerScope;
};

type LegacyIdentityMigrationMarker = {
  schema: "receiz.wildz.legacy_identity_migration.v1";
  storageKey: typeof WILDZ_IDENTITY_STORAGE_KEY;
  keyId: string;
  ownerScope: WildzOwnerScope;
  sourceDigestB64Url: string;
};

const WRAPPING_KEY_ID = "receiz.wildz.identity_wrapping_key.v1";
const ACTIVE_IDENTITY_KEY = "receiz.wildz.active_identity.v1";
const LEGACY_MIGRATION_KEY = "receiz.wildz.legacy_identity_migration.v1";
const IDENTITY_SESSION_PREFIX = "receiz.wildz.identity_session.v1:";
const ENCRYPTED_IDENTITY_SCHEMA = "receiz.wildz.encrypted_identity.v1";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const UID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

function normalizeOwnerValue(value: string | null, pattern: RegExp, errorCode: string) {
  if (value === null) return null;
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  if (!normalized) return null;
  if (!pattern.test(normalized)) throw new Error(errorCode);
  return normalized;
}

function normalizedUsername(value: string | null) {
  return normalizeOwnerValue(value, USERNAME_PATTERN, "wildz_identity_username_invalid");
}

function normalizedUid(value: string | null) {
  return normalizeOwnerValue(value, UID_PATTERN, "wildz_identity_uid_invalid");
}

export function canonicalWildzActorId(input: WildzActorOwnerInput): string {
  const username = normalizedUsername(input.owner.username);
  if (username) return username;
  const uid = normalizedUid(input.owner.uid);
  if (uid) return uid;
  throw new Error("wildz_identity_owner_required");
}

export function wildzOwnerScope(keyId: string, actorId: string): WildzOwnerScope {
  return `wildz:${encodeURIComponent(keyId)}:${encodeURIComponent(actorId)}`;
}

export function createWildzAutomaticUsername(webCrypto: Pick<Crypto, "getRandomValues"> = globalThis.crypto) {
  const entropy = webCrypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(entropy, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `wildz_${suffix}`;
}

function sessionMetaKey(keyId: string) {
  return `${IDENTITY_SESSION_PREFIX}${keyId}`;
}

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function identityAdditionalData(keyId: string) {
  return strictArrayBuffer(new TextEncoder().encode(`${ENCRYPTED_IDENTITY_SCHEMA}:${keyId}`));
}

function isWrappingKey(value: unknown): value is CryptoKey {
  if (!value || typeof value !== "object") return false;
  const key = value as Partial<CryptoKey>;
  const algorithm = key.algorithm as Partial<AesKeyAlgorithm> | undefined;
  return key.type === "secret"
    && key.extractable === false
    && algorithm?.name === "AES-GCM"
    && algorithm.length === 256
    && Array.isArray(key.usages)
    && key.usages.length === 2
    && key.usages.includes("encrypt")
    && key.usages.includes("decrypt");
}

function isIdentitySession(value: unknown): value is WildzIdentitySession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<WildzIdentitySession>;
  return session.schema === "receiz.wildz.identity_session.v1"
    && typeof session.keyId === "string"
    && typeof session.actorId === "string"
    && (typeof session.username === "string" || session.username === null)
    && (typeof session.displayName === "string" || session.displayName === null)
    && (session.portableStateStatus === "verified" || session.portableStateStatus === "missing")
    && (session.localAuthority === "verified" || session.localAuthority === "remote-only")
    && (session.localAuthority !== "remote-only"
      || session.portableStateStatus === "missing")
    && (session.remoteStatus === "unknown" || session.remoteStatus === "connected" || session.remoteStatus === "pending" || session.remoteStatus === "offline" || session.remoteStatus === "unavailable");
}

function isActiveIdentityPointer(value: unknown): value is ActiveIdentityPointer {
  if (!value || typeof value !== "object") return false;
  const pointer = value as Partial<ActiveIdentityPointer>;
  return pointer.schema === "receiz.wildz.active_identity.v1"
    && typeof pointer.keyId === "string"
    && typeof pointer.actorId === "string"
    && typeof pointer.ownerScope === "string";
}

function isLegacyMigrationMarker(value: unknown): value is LegacyIdentityMigrationMarker {
  if (!value || typeof value !== "object") return false;
  const marker = value as Partial<LegacyIdentityMigrationMarker>;
  return marker.schema === "receiz.wildz.legacy_identity_migration.v1"
    && marker.storageKey === WILDZ_IDENTITY_STORAGE_KEY
    && typeof marker.keyId === "string"
    && typeof marker.ownerScope === "string"
    && typeof marker.sourceDigestB64Url === "string";
}

function isEncryptedIdentityRecord(value: unknown): value is PreparedWildzIdentity["encryptedRecord"] {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PreparedWildzIdentity["encryptedRecord"]>;
  return record.schema === ENCRYPTED_IDENTITY_SCHEMA
    && typeof record.keyId === "string"
    && typeof record.ivB64Url === "string"
    && typeof record.ciphertextB64Url === "string";
}

function sessionFromProjection(projection: ReceizIdentityAccountProjection): WildzIdentitySession {
  return {
    schema: "receiz.wildz.identity_session.v1",
    keyId: projection.keyId,
    actorId: canonicalWildzActorId(projection),
    username: normalizedUsername(projection.owner.username),
    displayName: projection.owner.displayName?.trim() || null,
    portableStateStatus: projection.portableStateStatus,
    localAuthority: "verified",
    remoteStatus: "unknown"
  };
}

async function activeFromTransaction(tx: WildzContinuityTransaction) {
  const pointer = await tx.get<unknown>("meta", ACTIVE_IDENTITY_KEY);
  if (!isActiveIdentityPointer(pointer)) return null;
  const session = await tx.get<unknown>("meta", sessionMetaKey(pointer.keyId));
  if (!isIdentitySession(session)) return null;
  if (session.keyId !== pointer.keyId
    || session.actorId !== pointer.actorId
    || wildzOwnerScope(session.keyId, session.actorId) !== pointer.ownerScope) return null;
  return session;
}

async function verifiedLegacyMigrationFromTransaction(
  tx: WildzContinuityTransaction,
  expected: Pick<LegacyIdentityMigrationMarker, "keyId" | "ownerScope" | "sourceDigestB64Url">
) {
  const marker = await tx.get<unknown>("meta", LEGACY_MIGRATION_KEY);
  if (marker === null) return null;
  if (!isLegacyMigrationMarker(marker)) throw new Error("wildz_identity_legacy_marker_invalid");
  if (marker.keyId !== expected.keyId || marker.sourceDigestB64Url !== expected.sourceDigestB64Url) {
    throw new Error("wildz_identity_legacy_source_mismatch");
  }
  if (marker.ownerScope !== expected.ownerScope) throw new Error("wildz_identity_legacy_marker_unverified");
  const current = await activeFromTransaction(tx);
  if (!current
    || current.keyId !== marker.keyId
    || wildzOwnerScope(current.keyId, current.actorId) !== marker.ownerScope) {
    throw new Error("wildz_identity_legacy_marker_unverified");
  }
  return current;
}

function removeCapturedLegacySource(storage: WildzLegacyIdentityStorage, capturedRaw: string) {
  const liveRaw = storage.getItem(WILDZ_IDENTITY_STORAGE_KEY);
  if (liveRaw === null) return;
  if (liveRaw !== capturedRaw) {
    throw new Error("wildz_identity_legacy_source_mismatch");
  }
  storage.removeItem(WILDZ_IDENTITY_STORAGE_KEY);
}

export function createWildzIdentityRepository(options: {
  database?: WildzContinuityDatabase;
  crypto?: Crypto;
  createIdentity?: typeof createReceizIdIdentity;
} = {}): WildzIdentityRepository {
  const database = options.database ?? createWildzContinuityDatabase();
  const webCrypto = options.crypto ?? globalThis.crypto;
  const createIdentity = options.createIdentity ?? createReceizIdIdentity;

  if (!webCrypto?.subtle) throw new Error("wildz_identity_web_crypto_unavailable");

  const legacySourceDigest = async (raw: string) => {
    const digest = await webCrypto.subtle.digest("SHA-256", strictArrayBuffer(new TextEncoder().encode(raw)));
    return receizBase64UrlEncode(new Uint8Array(digest));
  };

  const wrappingKey = async () => {
    const stored = await database.read<unknown>("wrappingKeys", WRAPPING_KEY_ID);
    if (stored !== null) {
      if (!isWrappingKey(stored)) throw new Error("wildz_identity_wrapping_key_invalid");
      return stored;
    }

    const generated = await webCrypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    if (!isWrappingKey(generated)) throw new Error("wildz_identity_wrapping_key_invalid");

    return database.transaction(["wrappingKeys"], "readwrite", async (tx) => {
      const current = await tx.get<unknown>("wrappingKeys", WRAPPING_KEY_ID);
      if (current !== null) {
        if (!isWrappingKey(current)) throw new Error("wildz_identity_wrapping_key_invalid");
        return current;
      }
      await tx.put("wrappingKeys", generated, WRAPPING_KEY_ID);
      return generated;
    });
  };

  const repository: WildzIdentityRepository = {
    async bootstrap(legacyStorage?: WildzLegacyIdentityStorage) {
      const legacySource = legacyStorage ? readLegacyWildzIdentitySource(legacyStorage) : null;
      if (legacySource && legacyStorage) {
        const sourceDigestB64Url = await legacySourceDigest(legacySource.raw);
        const legacy = legacySource.identity;
        const expectedMigration = {
          keyId: legacy.identity.keyFile.keyId,
          ownerScope: wildzOwnerScope(legacy.identity.keyFile.keyId, canonicalWildzActorId(legacy.identity.keyFile)),
          sourceDigestB64Url
        };
        const previouslyMigrated = await database.transaction(["meta"], "readonly", (tx) =>
          verifiedLegacyMigrationFromTransaction(tx, expectedMigration)
        );
        if (previouslyMigrated) {
          removeCapturedLegacySource(legacyStorage, legacySource.raw);
          return previouslyMigrated;
        }

        const prepared = await repository.prepare(legacy.identity.keyFile);
        const marker: LegacyIdentityMigrationMarker = {
          schema: "receiz.wildz.legacy_identity_migration.v1",
          storageKey: WILDZ_IDENTITY_STORAGE_KEY,
          keyId: prepared.session.keyId,
          ownerScope: wildzOwnerScope(prepared.session.keyId, prepared.session.actorId),
          sourceDigestB64Url
        };
        await database.transaction(["identities", "meta"], "readwrite", async (tx) => {
          await repository.writePrepared(tx, prepared, true);
          await tx.put("meta", marker, LEGACY_MIGRATION_KEY);
        });

        const current = await database.transaction(["meta"], "readonly", (tx) =>
          verifiedLegacyMigrationFromTransaction(tx, marker)
        );
        if (!current) throw new Error("wildz_identity_legacy_marker_unverified");
        removeCapturedLegacySource(legacyStorage, legacySource.raw);
        return current;
      }

      const current = await repository.active();
      if (current) return current;

      const identity = await createIdentity({
        username: createWildzAutomaticUsername(webCrypto),
        displayName: "Wildz Explorer",
        deviceName: "Wildz"
      });
      const prepared = await repository.prepare(identity.keyFile);
      return database.transaction(["identities", "meta"], "readwrite", async (tx) => {
        const admitted = await activeFromTransaction(tx);
        if (admitted) return admitted;
        await repository.writePrepared(tx, prepared, true);
        return prepared.session;
      });
    },
    async active() {
      return database.transaction(["meta"], "readonly", activeFromTransaction);
    },
    async prepare(keyFile: ReceizKeyFile) {
      const projection = await projectReceizIdentityAccount(keyFile);
      if (projection.portableStateStatus === "invalid") throw new Error("wildz_identity_portable_state_invalid");
      const session = sessionFromProjection(projection);
      const key = await wrappingKey();
      const iv = webCrypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(serializeReceizIdentityArtifact(keyFile));
      const ciphertext = await webCrypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: strictArrayBuffer(iv),
          additionalData: identityAdditionalData(session.keyId)
        },
        key,
        strictArrayBuffer(plaintext)
      );
      return {
        session,
        encryptedRecord: {
          schema: ENCRYPTED_IDENTITY_SCHEMA,
          keyId: session.keyId,
          ivB64Url: receizBase64UrlEncode(iv),
          ciphertextB64Url: receizBase64UrlEncode(new Uint8Array(ciphertext))
        }
      };
    },
    async writeSession(tx: WildzContinuityTransaction, candidate: WildzIdentitySession, activate: boolean) {
      const session = { ...candidate };
      if (!isIdentitySession(session)) throw new Error("wildz_identity_session_invalid");
      await tx.put("meta", session, sessionMetaKey(session.keyId));
      if (activate) {
        const pointer: ActiveIdentityPointer = {
          schema: "receiz.wildz.active_identity.v1",
          keyId: session.keyId,
          actorId: session.actorId,
          ownerScope: wildzOwnerScope(session.keyId, session.actorId)
        };
        await tx.put("meta", pointer, ACTIVE_IDENTITY_KEY);
      }
    },
    async writePrepared(tx: WildzContinuityTransaction, prepared: PreparedWildzIdentity, activate: boolean) {
      const session = { ...prepared.session };
      const encryptedRecord = { ...prepared.encryptedRecord };
      if (!isIdentitySession(session)
        || !isEncryptedIdentityRecord(encryptedRecord)
        || session.keyId !== encryptedRecord.keyId) {
        throw new Error("wildz_identity_prepared_record_invalid");
      }
      await tx.put("identities", encryptedRecord, session.keyId);
      await repository.writeSession(tx, session, activate);
    },
    async withKeyFile<T>(keyId: string, operation: (keyFile: ReceizKeyFile) => Promise<T>) {
      const record = await database.read<unknown>("identities", keyId);
      if (!isEncryptedIdentityRecord(record) || record.keyId !== keyId) throw new Error("wildz_identity_not_found");
      const key = await wrappingKey();
      let keyFile: ReceizKeyFile;
      try {
        const plaintext = await webCrypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: strictArrayBuffer(receizBase64UrlDecode(record.ivB64Url)),
            additionalData: identityAdditionalData(record.keyId)
          },
          key,
          strictArrayBuffer(receizBase64UrlDecode(record.ciphertextB64Url))
        );
        keyFile = parseReceizIdentityArtifactText(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
      } catch {
        throw new Error("wildz_identity_decryption_failed");
      }
      if (keyFile.keyId !== keyId) throw new Error("wildz_identity_key_id_mismatch");
      return operation(keyFile);
    },
    async logout() {
      await database.transaction(["meta"], "readwrite", async (tx) => {
        await tx.delete("meta", ACTIVE_IDENTITY_KEY);
      });
    }
  };

  return repository;
}
