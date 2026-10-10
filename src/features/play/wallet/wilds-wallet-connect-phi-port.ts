"use client";

import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { normalizeWildsWalletPublicUsername } from "@/lib/receiz/wilds-wallet-projections";
import { authorizeWildsWalletTransferWithIdentity } from "./wilds-wallet-transfer-authorization";

export type WildsWalletConnectPhiLeg = Readonly<{ attemptId: string; senderHandle: string; recipientHandle: string; amountPhiMicro: string }>;
export type WildsWalletConnectPhiReceipt = Readonly<{ schema: "wildz.wallet.connect-transfer-receipt.v1"; attempt: string; leg: WildsWalletConnectPhiLeg }>;
export type WildsWalletConnectPhiOutcome = Readonly<{ status: "none" | "committed" | "pending" | "failed"; receipt?: WildsWalletConnectPhiReceipt; message?: string }>;
type Entry = Readonly<{ leg: WildsWalletConnectPhiLeg; attempt: string; phase: "prepared" | "submitted" }>;
type Record = Readonly<{ schema: "wildz.wallet.connect-phi-recovery.v1"; ownerHandle: string; keyId: string; entries: readonly Entry[] }>;
export type WildsWalletConnectPhiStore = Readonly<{ load(ownerKey: string): unknown; write(ownerKey: string, value: Record): void; withLock<T>(ownerKey: string, action: () => Promise<T>): Promise<T> }>;
type ResponsePort = Readonly<{ ok: boolean; json(): Promise<unknown> }>;
const MAX_BYTES = 1_000_000, MAX_ENTRIES = 128;
const object = (value: unknown): value is { [key: string]: unknown } => !!value && typeof value === "object" && !Array.isArray(value);
const fields = (value: { [key: string]: unknown }, expected: string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const equal = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
const attemptText = (value: unknown): value is string => typeof value === "string" && /^v3\.[A-Za-z0-9_.-]{1,16384}$/.test(value);
const storageError = () => Error("The exact payment could not be saved and read back. No new payment was started.");

function closedLeg(value: WildsWalletConnectPhiLeg): WildsWalletConnectPhiLeg {
  if (!value || typeof value.attemptId !== "string" || !value.attemptId || value.attemptId.length > 512 || !/^[1-9][0-9]{0,29}$/.test(value.amountPhiMicro)) throw Error("The exact Phi leg is invalid.");
  const senderHandle = `${normalizeWildsWalletPublicUsername(value.senderHandle)}.receiz.id`;
  const recipientHandle = `${normalizeWildsWalletPublicUsername(value.recipientHandle)}.receiz.id`;
  if (senderHandle === recipientHandle || senderHandle !== value.senderHandle || recipientHandle !== value.recipientHandle) throw Error("The exact Phi leg has an invalid Explorer binding.");
  return Object.freeze({ attemptId: value.attemptId, senderHandle, recipientHandle, amountPhiMicro: value.amountPhiMicro });
}
export function admitWildsWalletConnectPhiReceipt(value: unknown, expected: WildsWalletConnectPhiLeg): WildsWalletConnectPhiReceipt {
  if (!object(value) || !fields(value, ["schema", "attempt", "leg"]) || value.schema !== "wildz.wallet.connect-transfer-receipt.v1" || !attemptText(value.attempt) || !object(value.leg) || !fields(value.leg, ["attemptId", "senderHandle", "recipientHandle", "amountPhiMicro"]) || !equal(value.leg, closedLeg(expected))) throw Error("The payment receipt locator does not match the exact Phi leg.");
  return Object.freeze({ schema: value.schema, attempt: value.attempt, leg: closedLeg(expected) });
}
function admitRecord(value: unknown, ownerHandle: string, keyId: string): Record {
  if (value == null) return { schema: "wildz.wallet.connect-phi-recovery.v1", ownerHandle, keyId, entries: [] };
  if (!object(value) || !fields(value, ["schema", "ownerHandle", "keyId", "entries"]) || value.schema !== "wildz.wallet.connect-phi-recovery.v1" || value.ownerHandle !== ownerHandle || value.keyId !== keyId || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES || JSON.stringify(value).length > MAX_BYTES) throw storageError();
  const ids = new Set<string>();
  const entries = value.entries.map(item => {
    if (!object(item) || !fields(item, ["leg", "attempt", "phase"]) || !object(item.leg) || !fields(item.leg, ["attemptId", "senderHandle", "recipientHandle", "amountPhiMicro"]) || !attemptText(item.attempt) || (item.phase !== "prepared" && item.phase !== "submitted")) throw storageError();
    const leg = closedLeg(item.leg as unknown as WildsWalletConnectPhiLeg);
    if (leg.senderHandle !== ownerHandle || ids.has(leg.attemptId)) throw storageError();
    ids.add(leg.attemptId);
    return Object.freeze({ leg, attempt: item.attempt, phase: item.phase });
  });
  return Object.freeze({ schema: value.schema, ownerHandle, keyId, entries: Object.freeze(entries) });
}
const storageKey = (ownerKey: string) => `wildz:wallet:connect-phi:v1:${encodeURIComponent(ownerKey)}`;
export const wildsWalletBrowserConnectPhiStore: WildsWalletConnectPhiStore = {
  load(ownerKey) {
    if (typeof window === "undefined") throw storageError();
    const raw = window.localStorage.getItem(storageKey(ownerKey));
    if (raw === null) return null;
    if (raw.length > MAX_BYTES) throw storageError();
    return JSON.parse(raw);
  },
  write(ownerKey, value) {
    if (typeof window === "undefined") throw storageError();
    const raw = JSON.stringify(value);
    if (raw.length > MAX_BYTES) throw storageError();
    window.localStorage.setItem(storageKey(ownerKey), raw);
    if (window.localStorage.getItem(storageKey(ownerKey)) !== raw) throw storageError();
  },
  async withLock(ownerKey, action) {
    // A process-only lock would allow two tabs to authorize the same attempt.
    if (typeof navigator === "undefined" || !navigator.locks) throw storageError();
    return navigator.locks.request(storageKey(ownerKey), action);
  }
};

/** Coordinates individual released Connect sends. It does not make a staged exchange atomic. */
export function createWildsWalletConnectPhiPort(input: {
  keyId: string; ownerHandle: string; store?: WildsWalletConnectPhiStore;
  currentBinding?(): Readonly<{ keyId: string; ownerHandle: string }>;
  ensureReady?(): Promise<boolean | void>;
  authorization?: Readonly<{ authorize(value: Readonly<{ attempt: string; recipientUsername: string; amountPhiMicro: string; rail: "settlement" }>): Promise<Readonly<{ artifact: unknown; challenge: unknown }>> }>;
  fetcher?(path: string, init: Readonly<{ method: "GET" | "POST"; body?: string }>): Promise<ResponsePort>;
}) {
  if (!/^[a-f0-9]{64}$/.test(input.keyId) || input.ownerHandle !== `${normalizeWildsWalletPublicUsername(input.ownerHandle)}.receiz.id`) throw Error("A verified Explorer identity is required for Phi sends.");
  const ownerKey = `${input.ownerHandle}:${input.keyId}`, store = input.store ?? wildsWalletBrowserConnectPhiStore;
  const request = input.fetcher ?? ((path, init) => fetch(path, { ...init, headers: init.method === "POST" ? { "content-type": "application/json" } : undefined, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15_000) }));
  const assertBinding = () => { const current = input.currentBinding?.(); if (current && (current.keyId !== input.keyId || current.ownerHandle !== input.ownerHandle)) throw Error("The active Explorer identity changed. No new payment was started."); };
  const load = () => admitRecord(store.load(ownerKey), input.ownerHandle, input.keyId);
  const save = (record: Record) => { assertBinding(); store.write(ownerKey, record); if (!equal(record, load())) throw storageError(); };
  const locator = (entry: Entry): WildsWalletConnectPhiReceipt => Object.freeze({ schema: "wildz.wallet.connect-transfer-receipt.v1", attempt: entry.attempt, leg: entry.leg });
  const operationNonce = (leg: WildsWalletConnectPhiLeg) => sha256PortableBasis(leg.attemptId).replace(/^sha256:/, "");
  const observe = async (leg: WildsWalletConnectPhiLeg, receipt: WildsWalletConnectPhiReceipt): Promise<WildsWalletConnectPhiOutcome> => {
    assertBinding();
    if (![leg.senderHandle, leg.recipientHandle].includes(input.ownerHandle)) throw Error("This payment belongs to other Explorers.");
    try {
      const query = new URLSearchParams({ attempt: receipt.attempt, senderHandle: leg.senderHandle, recipientHandle: leg.recipientHandle, amountPhiMicro: leg.amountPhiMicro, operationNonce: operationNonce(leg) });
      const response = await request(`/api/wilds/wallet/transfer/observe?${query}`, { method: "GET" });
      const value = await response.json(); assertBinding();
      if (!response.ok || !object(value) || value.status !== "committed" || value.rail !== "settlement" || value.amountPhiMicro !== leg.amountPhiMicro || value.recipientUsername !== normalizeWildsWalletPublicUsername(leg.recipientHandle)
        || !fields(value, ["status", "rail", "amountPhiMicro", "recipientUsername"])) return { status: "pending", receipt, message: "Checking the original payment. No replacement send will be issued." };
      return { status: "committed", receipt };
    } catch { return { status: "pending", receipt, message: "The original payment could not be checked yet. No replacement send will be issued." }; }
  };
  return {
    async sendPhi(value: WildsWalletConnectPhiLeg): Promise<WildsWalletConnectPhiOutcome> {
      let submitted: WildsWalletConnectPhiReceipt | null = null;
      try {
        const leg = closedLeg(value); assertBinding();
        if (leg.senderHandle !== input.ownerHandle) throw Error("Only the sender may authorize this Phi leg.");
        return await store.withLock(ownerKey, async () => {
          assertBinding(); let record = load(); let entry = record.entries.find(item => item.leg.attemptId === leg.attemptId);
          if (entry && !equal(entry.leg, leg)) throw Error("This saved payment attempt has different terms.");
          if (entry?.phase === "submitted") return observe(leg, locator(entry));
          if (input.ensureReady && await input.ensureReady() === false) throw Error("Reconnect Send before authorizing this payment.");
          assertBinding();
          if (!entry) {
            if (record.entries.length >= MAX_ENTRIES) throw storageError();
            const response = await request("/api/wilds/wallet/transfer/preview", { method: "POST", body: JSON.stringify({ recipientUsername: normalizeWildsWalletPublicUsername(leg.recipientHandle), amountPhiMicro: leg.amountPhiMicro, rail: "settlement", operationNonce: operationNonce(leg) }) });
            const staged = await response.json(); assertBinding();
            if (!response.ok || !object(staged) || staged.status !== "staged" || staged.rail !== "settlement" || staged.amountPhiMicro !== leg.amountPhiMicro || !attemptText(staged.attempt) || !Number.isSafeInteger(staged.expiresAtKai)) throw Error("The exact payment review could not be prepared. Nothing was sent.");
            entry = Object.freeze({ leg, attempt: staged.attempt, phase: "prepared" });
            record = { ...record, entries: [...record.entries, entry] }; save(record);
          }
          const authorization = input.authorization ?? { authorize: (review: { attempt: string; recipientUsername: string; amountPhiMicro: string; rail: "settlement" }) => authorizeWildsWalletTransferWithIdentity(input.keyId, review) };
          const consent = await authorization.authorize({ attempt: entry.attempt, recipientUsername: normalizeWildsWalletPublicUsername(leg.recipientHandle), amountPhiMicro: leg.amountPhiMicro, rail: "settlement" });
          assertBinding();
          entry = { ...entry, phase: "submitted" };
          record = { ...record, entries: record.entries.map(item => item.leg.attemptId === leg.attemptId ? entry! : item) }; save(record);
          submitted = locator(entry);
          // After this checkpoint every failure is uncertain until the actual canonical transfer is read.
          const response = await request("/api/wilds/wallet/transfer/execute", { method: "POST", body: JSON.stringify({ attempt: entry.attempt, consent }) });
          const result = await response.json(); assertBinding();
          if (response.ok && object(result) && result.status === "zero-write" && result.rail === "settlement" && result.code === "INSUFFICIENT_VALUE" && fields(result, ["status", "rail", "code"])) return { status: "failed", receipt: submitted, message: "The wallet rejected this payment for insufficient Phi." };
          if (response.ok && object(result) && result.status === "committed" && result.rail === "settlement" && result.amountPhiMicro === leg.amountPhiMicro && result.recipientUsername === normalizeWildsWalletPublicUsername(leg.recipientHandle)) return observe(leg, submitted);
          return { status: "pending", receipt: submitted, message: "Checking the original payment. No replacement send will be issued." };
        });
      } catch (cause) {
        return submitted ? { status: "pending", receipt: submitted, message: "The send response is uncertain. Only the exact saved payment will be checked." }
          : { status: "failed", message: cause instanceof Error ? cause.message : "The exact payment could not be prepared. Nothing was sent." };
      }
    },
    async observePhi(value: WildsWalletConnectPhiLeg, proposedReceipt?: unknown): Promise<WildsWalletConnectPhiOutcome> {
      const leg = closedLeg(value); assertBinding();
      let receipt: WildsWalletConnectPhiReceipt | null = proposedReceipt === undefined ? null : admitWildsWalletConnectPhiReceipt(proposedReceipt, leg);
      if (!receipt && leg.senderHandle === input.ownerHandle) {
        const entry = load().entries.find(item => item.leg.attemptId === leg.attemptId);
        if (entry) { if (!equal(entry.leg, leg)) throw Error("This saved payment attempt has different terms."); receipt = locator(entry); }
      }
      return receipt ? observe(leg, receipt) : { status: "none" };
    },
    async verifyPhiReceipt(value: WildsWalletConnectPhiLeg, outcome: Readonly<{ status: string; receipt?: unknown }>): Promise<void> {
      const leg = closedLeg(value);
      if (outcome.status !== "committed") throw Error("No canonical Phi settlement receipt was verified.");
      const receipt = admitWildsWalletConnectPhiReceipt(outcome.receipt, leg);
      if ((await observe(leg, receipt)).status !== "committed") throw Error("The original Phi settlement receipt could not be verified.");
    }
  };
}
