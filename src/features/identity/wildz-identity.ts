import { createReceizIdIdentity, type ReceizDeviceIdentity } from "@receiz/sdk";

export const WILDZ_IDENTITY_STORAGE_KEY = "wildz:receiz-identity:v1";

export type WildzIdentityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StoredWildzIdentity = {
  version: 1;
  savedAt: string;
  identity: ReceizDeviceIdentity;
};

function isIdentity(value: unknown): value is ReceizDeviceIdentity {
  if (!value || typeof value !== "object") return false;
  const identity = value as Partial<ReceizDeviceIdentity>;
  return identity.schema === "receiz.device.identity.v1"
    && typeof identity.localUid === "string"
    && typeof identity.username === "string"
    && typeof identity.displayName === "string"
    && Boolean(identity.keyFile)
    && identity.keyFile?.schema === "receiz.key.v1"
    && typeof identity.keyFile.keyId === "string";
}

export function parseStoredWildzIdentity(raw: string | null): StoredWildzIdentity | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredWildzIdentity>;
    if (value.version !== 1 || typeof value.savedAt !== "string" || !isIdentity(value.identity)) return null;
    return value as StoredWildzIdentity;
  } catch {
    return null;
  }
}

export async function ensureWildzIdentity(
  storage: WildzIdentityStorage,
  createIdentity: () => Promise<ReceizDeviceIdentity> = () => createReceizIdIdentity({
    displayName: "Wildz Explorer",
    deviceName: "Wildz"
  })
) {
  const existing = parseStoredWildzIdentity(storage.getItem(WILDZ_IDENTITY_STORAGE_KEY));
  if (existing) return existing;

  const identity = await createIdentity();
  const record: StoredWildzIdentity = { version: 1, savedAt: new Date().toISOString(), identity };
  storage.setItem(WILDZ_IDENTITY_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function saveWildzIdentity(storage: WildzIdentityStorage, identity: ReceizDeviceIdentity) {
  const record: StoredWildzIdentity = { version: 1, savedAt: new Date().toISOString(), identity };
  storage.setItem(WILDZ_IDENTITY_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function publicWildzIdentity(record: StoredWildzIdentity) {
  return {
    schema: "wildz.public_identity.v1" as const,
    keyId: record.identity.keyFile.keyId,
    username: record.identity.username,
    displayName: record.identity.displayName,
    createdAt: record.identity.createdAt,
    publicKey: record.identity.keyFile.crypto.publicKeyRawB64u
  };
}
