import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import type { WildsWalletAssetSendRequest } from "./wilds-wallet-asset-send";

export type WildsWalletAssetSendRecoveryEntry = Readonly<{
  request: WildsWalletAssetSendRequest;
  keys: readonly string[];
  stage: "prepared" | "mutated" | "sent";
  packageId?: string;
}>;
export type WildsWalletAssetSendRecoveryRecord = Readonly<{
  schema: "wildz.wallet.asset-send.v1";
  owner: string;
  attempts: readonly WildsWalletAssetSendRecoveryEntry[];
}>;
export type WildsWalletAssetSendRecoveryStore = Readonly<{
  load(owner: string): unknown;
  write(owner: string, value: WildsWalletAssetSendRecoveryRecord): void;
}>;

const PREFIX = "wildz:wallet:asset-send:v1:";
const MAX_ATTEMPTS = 64;
const MAX_BYTES = 256_000;
const storageError = () => Error("Saved asset send recovery is unavailable. Reconnect this wallet before sending assets.");
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 800;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(key => key in value) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));

/** Recovery is only exact source/recipient metadata; claim instruments never enter browser storage. */
export function admitWildsWalletAssetSendRecovery(value: unknown, owner: string): WildsWalletAssetSendRecoveryRecord {
  if (value === null || value === undefined) return { schema: "wildz.wallet.asset-send.v1", owner, attempts: [] };
  if (!object(value) || !fields(value, ["schema", "owner", "attempts"]) || value.schema !== "wildz.wallet.asset-send.v1" || value.owner !== owner
    || !Array.isArray(value.attempts) || value.attempts.length > MAX_ATTEMPTS || JSON.stringify(value).length > MAX_BYTES) throw storageError();
  const attemptIds = new Set<string>(), lockedKeys = new Set<string>();
  for (const entry of value.attempts) {
    if (!object(entry) || !fields(entry, ["request", "keys", "stage"], ["packageId"]) || !["prepared", "mutated", "sent"].includes(entry.stage as string)
      || !Array.isArray(entry.keys) || !entry.keys.length || entry.keys.length > 65 || !entry.keys.every(key => typeof key === "string" && key.length > 0 && key.length <= 810)
      || new Set(entry.keys).size !== entry.keys.length || entry.keys.some(key => lockedKeys.has(key))
      || entry.packageId !== undefined && !validId(entry.packageId)) throw storageError();
    const keys = entry.keys as string[];
    const request = entry.request;
    if (!object(request) || !fields(request, ["attemptId", "recipientHandle", "asset"]) || typeof request.attemptId !== "string"
      || !/^[a-z0-9][a-z0-9:._-]{0,159}$/i.test(request.attemptId) || attemptIds.has(request.attemptId)
      || typeof request.recipientHandle !== "string" || parseWildzPlayerCoordinate(request.recipientHandle)?.profileHandle !== request.recipientHandle
      || sameWildzPlayerCoordinate(owner, request.recipientHandle) || !object(request.asset)) throw storageError();
    const asset = request.asset;
    let expectedKeys: string[];
    if (asset.kind === "inventory") {
      if (!fields(asset, ["kind", "foodItemIds", "materialLotIds", "resourceLotIds"]) || !Array.isArray(asset.foodItemIds) || !Array.isArray(asset.materialLotIds) || !Array.isArray(asset.resourceLotIds)) throw storageError();
      const ids = [...asset.foodItemIds, ...asset.materialLotIds, ...asset.resourceLotIds];
      if (!ids.length || ids.length > 64 || !ids.every(validId) || new Set(ids).size !== ids.length) throw storageError();
      expectedKeys = ids.map(id => `source:${id}`);
      if (entry.packageId) expectedKeys.push(`package:${entry.packageId}`);
      if (entry.keys.length !== expectedKeys.length) throw storageError();
    } else if (asset.kind === "creature") {
      if (!fields(asset, ["kind", "assetId"]) || !validId(asset.assetId) || entry.packageId !== undefined || entry.keys.length !== 1) throw storageError();
      expectedKeys = [`creature:${asset.assetId}`];
    } else if (asset.kind === "package") {
      if (!fields(asset, ["kind", "packageId"]) || !validId(asset.packageId) || entry.packageId !== undefined && entry.packageId !== asset.packageId
        || entry.keys.some(key => key !== `package:${asset.packageId}` && !key.startsWith("source:"))) throw storageError();
      expectedKeys = [`package:${asset.packageId}`];
    } else throw storageError();
    if (expectedKeys.some(key => !keys.includes(key))) throw storageError();
    attemptIds.add(request.attemptId);
    entry.keys.forEach(key => lockedKeys.add(key));
  }
  return value as unknown as WildsWalletAssetSendRecoveryRecord;
}

export const wildsWalletBrowserAssetSendRecoveryStore: WildsWalletAssetSendRecoveryStore = {
  load(owner) {
    try {
      if (typeof window === "undefined") throw storageError();
      const saved = window.sessionStorage.getItem(`${PREFIX}${encodeURIComponent(owner)}`);
      if (saved === null) return null;
      if (saved.length > MAX_BYTES) throw storageError();
      return JSON.parse(saved);
    } catch { throw storageError(); }
  },
  write(owner, value) {
    try {
      if (typeof window === "undefined") throw storageError();
      admitWildsWalletAssetSendRecovery(value, owner);
      const serialized = JSON.stringify(value), key = `${PREFIX}${encodeURIComponent(owner)}`;
      window.sessionStorage.setItem(key, serialized);
      if (window.sessionStorage.getItem(key) !== serialized) throw storageError();
    } catch { throw storageError(); }
  }
};
