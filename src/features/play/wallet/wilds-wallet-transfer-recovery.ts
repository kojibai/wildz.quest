import { normalizeWildsWalletPublicUsername } from "@/lib/receiz/wilds-wallet-projections";
import type { WildsWalletTransferState } from "./wilds-wallet-controller";

export type WildsWalletTransferRecoveryStore = Readonly<{
  load(identityKey: string): unknown;
  write(identityKey: string, value: unknown): void;
  delete(identityKey: string): void;
}>;

const PREFIX = "wildz:wallet:submitted-payment:v1:";
const INDEX = `${PREFIX}accounts`;
const MAX_ACCOUNTS = 4;
const MAX_BYTES = 24_000;
const FIELDS = ["schema", "identityKey", "sourceKey", "attempt", "recipientUsername", "amountPhiMicro", "rail", "operationNonce", "expiresAtKai"];

export function projectWildsWalletTransferRecovery(identityKey: string, sourceKey: string, transfer: WildsWalletTransferState) {
  if (!["authorize-pending", "unknown"].includes(transfer.phase) || !transfer.attempt) return null;
  // Exact heads, immutable plan, original recipient and semantic idempotency
  // remain inside the server-sealed SDK attempt. No signing authority is saved.
  return { schema: "wildz.wallet.submitted-payment.v1", identityKey, sourceKey, attempt: transfer.attempt,
    recipientUsername: transfer.recipientUsername, amountPhiMicro: transfer.amountPhiMicro, rail: transfer.rail,
    operationNonce: transfer.operationNonce, expiresAtKai: transfer.expiresAtKai };
}

export function admitWildsWalletTransferRecovery(value: unknown, identityKey: string): WildsWalletTransferState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== FIELDS.length || FIELDS.some(field => !(field in item))
    || item.schema !== "wildz.wallet.submitted-payment.v1" || item.identityKey !== identityKey
    || typeof item.sourceKey !== "string" || item.sourceKey.length > 512
    || typeof item.attempt !== "string" || !/^v[123]\.[A-Za-z0-9_.-]{1,16384}$/.test(item.attempt)
    || typeof item.recipientUsername !== "string"
    || typeof item.amountPhiMicro !== "string" || !/^[1-9][0-9]{0,29}$/.test(item.amountPhiMicro)
    || (item.rail !== "settlement" && item.rail !== "reserve")
    || typeof item.operationNonce !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(item.operationNonce)
    || (item.expiresAtKai !== null && (!Number.isSafeInteger(item.expiresAtKai) || (item.expiresAtKai as number) < 0))) return null;
  try { if (normalizeWildsWalletPublicUsername(item.recipientUsername) !== item.recipientUsername) return null; } catch { return null; }
  return { phase: "unknown", recipientUsername: item.recipientUsername, recipientLocator: null,
    recipientVerified: false,
    amountPhiMicro: item.amountPhiMicro, rail: item.rail, operationNonce: item.operationNonce,
    attempt: item.attempt, expiresAtKai: item.expiresAtKai as number | null, requestId: null, authorizationPointerId: null,
    result: { status: "unknown", rail: item.rail, amountPhiMicro: item.amountPhiMicro } };
}

function key(identityKey: string) { return `${PREFIX}identity:${encodeURIComponent(identityKey)}`; }
function storage() {
  if (typeof window === "undefined") throw new Error("wallet_recovery_storage_unavailable");
  return window.sessionStorage;
}
function accounts(store: Storage): string[] {
  const value: unknown = JSON.parse(store.getItem(INDEX) ?? "[]");
  if (!Array.isArray(value) || value.length > MAX_ACCOUNTS
    || value.some(entry => typeof entry !== "string" || !entry || entry.length > 512)
    || new Set(value).size !== value.length) throw new Error("wallet_recovery_index_invalid");
  return value as string[];
}

function exactRecovery(value: unknown, expected: NonNullable<ReturnType<typeof projectWildsWalletTransferRecovery>>) {
  if (!admitWildsWalletTransferRecovery(value, expected.identityKey)) return false;
  const item = value as Record<string, unknown>;
  return FIELDS.every(field => item[field] === expected[field as keyof typeof expected]);
}

/** Confirm durable reconstruction before crossing the value-execution boundary. */
export function checkpointWildsWalletTransferRecovery(store: WildsWalletTransferRecoveryStore, identityKey: string, sourceKey: string, transfer: WildsWalletTransferState) {
  const recovery = projectWildsWalletTransferRecovery(identityKey, sourceKey, transfer);
  if (!recovery || !admitWildsWalletTransferRecovery(recovery, identityKey)) throw new Error("wallet_recovery_checkpoint_invalid");
  const previous = store.load(identityKey);
  if (previous != null && !exactRecovery(previous, recovery)) throw new Error("wallet_recovery_pending_attempt_conflict");
  store.write(identityKey, recovery);
  if (!exactRecovery(store.load(identityKey), recovery)) throw new Error("wallet_recovery_checkpoint_unverified");
}

export const wildsWalletBrowserTransferRecoveryStore: WildsWalletTransferRecoveryStore = {
  load(identityKey) {
    const store = storage();
    const saved = store.getItem(key(identityKey));
    if (saved === null) return null;
    if (saved.length > MAX_BYTES) throw new Error("wallet_recovery_record_too_large");
    return JSON.parse(saved);
  },
  write(identityKey, value) {
    if (!identityKey || identityKey.length > 512 || !admitWildsWalletTransferRecovery(value, identityKey)) throw new Error("wallet_recovery_record_invalid");
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_BYTES) throw new Error("wallet_recovery_record_too_large");
    const store = storage();
    const previous = store.getItem(key(identityKey));
    if (previous !== null && previous !== serialized) throw new Error("wallet_recovery_pending_attempt_conflict");
    // Missing records are failed preflight reservations or retired outcomes.
    // A retained uncertain record is never removed to make room for a send.
    const retained = accounts(store).filter(entry => store.getItem(key(entry)) !== null);
    if (!retained.includes(identityKey)) {
      if (retained.length >= MAX_ACCOUNTS) throw new Error("wallet_recovery_capacity_exhausted");
      retained.push(identityKey);
    }
    const index = JSON.stringify(retained);
    store.setItem(INDEX, index);
    if (store.getItem(INDEX) !== index) throw new Error("wallet_recovery_index_unverified");
    store.setItem(key(identityKey), serialized);
    if (store.getItem(key(identityKey)) !== serialized) throw new Error("wallet_recovery_checkpoint_unverified");
  },
  delete(identityKey) {
    const store = storage();
    const retained = accounts(store).filter(entry => entry !== identityKey);
    store.removeItem(key(identityKey));
    store.setItem(INDEX, JSON.stringify(retained));
  }
};
