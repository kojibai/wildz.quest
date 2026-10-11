import { receizBase64UrlDecode, receizBase64UrlEncode } from "@receiz/sdk";
import type { WildzContinuityDatabase, WildzContinuityTransaction } from "../storage/wildz-indexed-db";
import type { WildzIdentitySession } from "./wildz-identity-repository";
import { admitWildsWalletReadResponse, type WildsWalletReadResponse } from "../../features/play/wallet/wilds-wallet-controller";
import { projectWildsWalletCapabilities, type WalletSummaryProjection } from "./wilds-wallet-projections";

/** Authenticated local observation, never source proof, currentness or spend authority. */
export type WildzWalletObservation = Readonly<{
  schema: "wildz.wallet.observation.v1";
  keyId: string; actorId: string; incarnation: string;
  origin: "live" | "seal" | "new-local";
  freshness: "observed" | "pending";
  summary: WalletSummaryProjection;
}>;
type Scope = Pick<WildzIdentitySession, "keyId" | "actorId" | "walletObservationEpoch">;
type Envelope = { schema: "wildz.wallet.observation-envelope.v1"; iv: string; ciphertext: string };
type Clock = { token: string; live: boolean; pending: boolean };
function validClock(value: unknown): value is Clock {
  const clock = value as Clock | null;
  return Boolean(clock && typeof clock.token === "string" && /^[a-f0-9-]{36}$/.test(clock.token) && typeof clock.live === "boolean" && typeof clock.pending === "boolean");
}
const KEY = "wildz.wallet.observation-key.v1";
const ACTIVE = "receiz.wildz.active_identity.v1";
const encoder = new TextEncoder();
const bytes = (value: Uint8Array) => new Uint8Array(value).buffer;
export const walletObservationScope = (scope: Scope) => JSON.stringify([scope.keyId, scope.actorId, scope.walletObservationEpoch ?? "legacy"]);
export const walletObservationRecordKey = (scope: Scope) => `wildz.wallet.observation.v1:${walletObservationScope(scope)}`;
const clockKey = (scope: Scope) => `${walletObservationRecordKey(scope)}:clock`;
const aad = (scope: Scope) => encoder.encode(`WILDZ-WALLET-LOCAL-OBSERVATION-V1:${walletObservationScope(scope)}`);
export function walletObservationResponse(observation: WildzWalletObservation): WildsWalletReadResponse {
  return admitWildsWalletReadResponse({ summary: observation.summary, capabilities: projectWildsWalletCapabilities(), ledger: null });
}
export function matchesWalletObservation(value: WildzWalletObservation | null | undefined, keyId: string, actorId: string, incarnation: string) {
  return Boolean(value && value.keyId === keyId && value.actorId === actorId && value.incarnation === incarnation);
}
async function current(tx: WildzContinuityTransaction, scope: Scope) {
  const pointer = await tx.get<{keyId: string; actorId: string}>("meta", ACTIVE);
  const session = await tx.get<WildzIdentitySession>("meta", `receiz.wildz.identity_session.v1:${scope.keyId}`);
  return pointer?.keyId === scope.keyId && pointer.actorId === scope.actorId && session?.actorId === scope.actorId
    && (session.walletObservationEpoch ?? "legacy") === (scope.walletObservationEpoch ?? "legacy");
}
function validKey(value: unknown): value is CryptoKey {
  const key = value as CryptoKey | null;
  return Boolean(key && key.type === "secret" && key.extractable === false && key.algorithm?.name === "AES-GCM"
    && (key.algorithm as AesKeyAlgorithm).length === 256 && key.usages.includes("encrypt") && key.usages.includes("decrypt"));
}
export function createWildzWalletObservationStore(database: WildzContinuityDatabase, crypto: Crypto = globalThis.crypto) {
  async function key(create: boolean) {
    const saved = await database.read<unknown>("wrappingKeys", KEY);
    if (saved !== null) { if (!validKey(saved)) throw Error("wallet_observation_key_invalid"); return saved; }
    if (!create) return null;
    const generated = await crypto.subtle.generateKey({name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]);
    return database.transaction(["wrappingKeys"], "readwrite", async tx => {
      const existing = await tx.get<unknown>("wrappingKeys", KEY);
      if (existing !== null) { if (!validKey(existing)) throw Error("wallet_observation_key_invalid"); return existing; }
      await tx.put("wrappingKeys", generated, KEY); return generated;
    });
  }
  async function prepare(scope: Scope, summary: WalletSummaryProjection, origin: WildzWalletObservation["origin"], freshness: WildzWalletObservation["freshness"] = "observed"): Promise<Envelope> {
    const observation: WildzWalletObservation = {schema: "wildz.wallet.observation.v1", keyId: scope.keyId, actorId: scope.actorId,
      incarnation: scope.walletObservationEpoch ?? "legacy", origin, freshness, summary: walletObservationResponse({summary} as WildzWalletObservation).summary};
    const plaintext = encoder.encode(JSON.stringify(observation));
    if (plaintext.byteLength > 4096) throw Error("wallet_observation_too_large");
    const held = await key(true), iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name: "AES-GCM", iv: bytes(iv), additionalData: bytes(aad(scope))}, held!, bytes(plaintext));
    return {schema: "wildz.wallet.observation-envelope.v1", iv: receizBase64UrlEncode(iv), ciphertext: receizBase64UrlEncode(new Uint8Array(ciphertext))};
  }
  async function load(scope: Scope): Promise<WildzWalletObservation | null> {
    try {
      const envelope = await database.transaction(["meta"], "readonly", async tx => await current(tx, scope) ? tx.get<Envelope>("meta", walletObservationRecordKey(scope)) : null);
      if (!envelope || envelope.schema !== "wildz.wallet.observation-envelope.v1" || typeof envelope.ciphertext !== "string" || envelope.ciphertext.length > 6000 || typeof envelope.iv !== "string" || envelope.iv.length !== 16) return null;
      const held = await key(false); if (!held) return null;
      const plaintext = await crypto.subtle.decrypt({name: "AES-GCM", iv: bytes(receizBase64UrlDecode(envelope.iv)), additionalData: bytes(aad(scope))}, held, bytes(receizBase64UrlDecode(envelope.ciphertext)));
      const value = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(plaintext)) as WildzWalletObservation;
      if (value.schema !== "wildz.wallet.observation.v1" || !matchesWalletObservation(value, scope.keyId, scope.actorId, scope.walletObservationEpoch ?? "legacy")
        || !["live", "seal", "new-local"].includes(value.origin) || !["observed", "pending"].includes(value.freshness)) return null;
      walletObservationResponse(value);
      return await database.transaction(["meta"], "readonly", async tx => {
        if (!await current(tx, scope)) return null;
        const clock = await tx.get<Clock>("meta", clockKey(scope));
        if (!validClock(clock)) return null;
        return Object.freeze(clock.pending ? {...value, freshness: "pending" as const} : value);
      });
    } catch { return null; }
  }
  async function observe(scope: Scope, summary: WalletSummaryProjection, origin: WildzWalletObservation["origin"], freshness: WildzWalletObservation["freshness"] = "observed") {
    if (origin === "new-local" && freshness !== "pending") throw Error("wallet_new_local_requires_committed_creation");
    // The authenticated prior origin, not a mutable concurrency marker alone, prevents Seal rollback.
    if (origin === "seal" && (await load(scope))?.origin === "live") return;
    const token = crypto.randomUUID();
    const reserved = await database.transaction(["meta"], "readwrite", async tx => {
      if (!await current(tx, scope)) return false;
      const prior = await tx.get<Clock>("meta", clockKey(scope));
      if (origin === "seal" && (prior?.live || prior?.pending)) return false;
      await tx.put("meta", {token, live: origin === "live" || prior?.live === true, pending: freshness === "pending"}, clockKey(scope)); return true;
    });
    if (!reserved) return;
    const envelope = await prepare(scope, summary, origin, freshness);
    await database.transaction(["meta"], "readwrite", async tx => {
      if (await current(tx, scope) && (await tx.get<Clock>("meta", clockKey(scope)))?.token === token) await tx.put("meta", envelope, walletObservationRecordKey(scope));
    });
  }
  return {prepare, load, observe,
    async install(tx: WildzContinuityTransaction, scope: Scope, envelope: Envelope) {
      await tx.put("meta", envelope, walletObservationRecordKey(scope));
      await tx.put("meta", {token: crypto.randomUUID(), live: false, pending: false}, clockKey(scope));
    },
    async retire(tx: WildzContinuityTransaction, scope: Scope) {
      await tx.delete("meta", walletObservationRecordKey(scope)); await tx.delete("meta", clockKey(scope));
    }
  };
}
export type WildzWalletObservationPort = Readonly<{
  observe(summary: WalletSummaryProjection, origin: WildzWalletObservation["origin"], freshness?: "observed" | "pending"): Promise<void>;
  retire(): Promise<void>;
}>;
