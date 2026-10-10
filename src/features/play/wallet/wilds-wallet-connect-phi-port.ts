"use client";

import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { normalizeWildsWalletPublicUsername } from "@/lib/receiz/wilds-wallet-projections";
import { authorizeWildsWalletTransferWithIdentity } from "./wilds-wallet-transfer-authorization";
import { createWildsWalletConnectPhiArchiveStore, type WildsWalletConnectPhiArchiveStore } from "./wilds-wallet-connect-phi-archive";

export type WildsWalletConnectPhiLeg = Readonly<{ attemptId: string; senderHandle: string; recipientHandle: string; amountPhiMicro: string }>;
export type WildsWalletConnectPhiReceipt = Readonly<{ schema: "wildz.wallet.connect-transfer-receipt.v1"; attempt: string; leg: WildsWalletConnectPhiLeg }>;
export type WildsWalletConnectPhiNoWriteReceipt = Readonly<{ schema: "wildz.wallet.connect-zero-write-receipt.v1"; attempt: string; leg: WildsWalletConnectPhiLeg; noWriteWitness: string; retryAfterKai: number }>;
export type WildsWalletConnectPhiOutcome = Readonly<{ status: "none" | "committed" | "pending" | "failed"; receipt?: WildsWalletConnectPhiReceipt | WildsWalletConnectPhiNoWriteReceipt; message?: string }>;
type Entry = Readonly<{ leg: WildsWalletConnectPhiLeg; attempt: string; phase: "prepared" | "submitted" | "rejected"; noWriteReceipt?: WildsWalletConnectPhiNoWriteReceipt }>;
type Record = Readonly<{ schema: "wildz.wallet.connect-phi-recovery.v1"; ownerHandle: string; keyId: string; entries: readonly Entry[]; archiveCursor?:number }>;
export type WildsWalletConnectPhiStore = Readonly<{ load(ownerKey: string): unknown; write(ownerKey: string, value: Record): void; withLock<T>(ownerKey: string, action: () => Promise<T>): Promise<T> }>;
type ResponsePort = Readonly<{ ok: boolean; json(): Promise<unknown> }>;
const MAX_BYTES = 1_000_000, MAX_ENTRIES = 128;
const object = (value: unknown): value is { [key: string]: unknown } => !!value && typeof value === "object" && !Array.isArray(value);
const fields = (value: { [key: string]: unknown }, expected: string[]) => Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const equal = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
const attemptText = (value: unknown): value is string => typeof value === "string" && /^v3\.[A-Za-z0-9_.-]{1,16384}$/.test(value);
const witnessText = (value: unknown): value is string => typeof value === "string" && /^nw1\.[A-Za-z0-9_.-]{1,8192}$/.test(value);
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
export function admitWildsWalletConnectPhiNoWriteReceipt(value: unknown, expected: WildsWalletConnectPhiLeg): WildsWalletConnectPhiNoWriteReceipt {
  if (!object(value) || !fields(value, ["schema","attempt","leg","noWriteWitness","retryAfterKai"]) || value.schema !== "wildz.wallet.connect-zero-write-receipt.v1" || !attemptText(value.attempt) || !witnessText(value.noWriteWitness) || !Number.isSafeInteger(value.retryAfterKai) || (value.retryAfterKai as number)<0 || !equal(value.leg,closedLeg(expected))) throw Error("The no-write coordination witness does not match the exact Phi leg.");
  return Object.freeze({schema:value.schema,attempt:value.attempt,leg:closedLeg(expected),noWriteWitness:value.noWriteWitness,retryAfterKai:value.retryAfterKai as number});
}
function admitRecord(value: unknown, ownerHandle: string, keyId: string): Record {
  if (value == null) return { schema: "wildz.wallet.connect-phi-recovery.v1", ownerHandle, keyId, entries: [] };
  if (!object(value) || !fields(value, value.archiveCursor===undefined?["schema", "ownerHandle", "keyId", "entries"]:["schema", "ownerHandle", "keyId", "entries","archiveCursor"]) || value.schema !== "wildz.wallet.connect-phi-recovery.v1" || value.ownerHandle !== ownerHandle || value.keyId !== keyId || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES || JSON.stringify(value).length > MAX_BYTES) throw storageError();
  if(value.archiveCursor!==undefined&&(!Number.isSafeInteger(value.archiveCursor)||(value.archiveCursor as number)<0||(value.archiveCursor as number)>=MAX_ENTRIES))throw storageError();
  const ids = new Set<string>();
  const entries = value.entries.map(item => {
    if (!object(item) || !fields(item, item.phase === "rejected" ? ["leg","attempt","phase","noWriteReceipt"] : ["leg", "attempt", "phase"]) || !object(item.leg) || !fields(item.leg, ["attemptId", "senderHandle", "recipientHandle", "amountPhiMicro"]) || !attemptText(item.attempt) || !["prepared","submitted","rejected"].includes(String(item.phase))) throw storageError();
    const leg = closedLeg(item.leg as unknown as WildsWalletConnectPhiLeg);
    if (leg.senderHandle !== ownerHandle || ids.has(leg.attemptId)) throw storageError();
    ids.add(leg.attemptId);
    const noWriteReceipt=item.phase==="rejected"?admitWildsWalletConnectPhiNoWriteReceipt(item.noWriteReceipt,leg):undefined;
    if(noWriteReceipt&&noWriteReceipt.attempt!==item.attempt)throw storageError();
    return Object.freeze({ leg, attempt: item.attempt, phase: item.phase as Entry["phase"],...(noWriteReceipt?{noWriteReceipt}:{}) });
  });
  return Object.freeze({ schema: value.schema, ownerHandle, keyId, entries: Object.freeze(entries),...(value.archiveCursor===undefined?{}:{archiveCursor:value.archiveCursor as number}) });
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
  archiveStore?: WildsWalletConnectPhiArchiveStore;
  currentBinding?(): Readonly<{ keyId: string; ownerHandle: string }>;
  ensureReady?(): Promise<boolean | void>;
  /** Optional stricter application preflight after exact consent and before
   * the durable submitted checkpoint. It cannot alter this saved leg. */
  beforeSubmit?(leg: WildsWalletConnectPhiLeg): Promise<void>;
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
  const noWrite = async (leg:WildsWalletConnectPhiLeg, receipt:WildsWalletConnectPhiNoWriteReceipt) => {
    assertBinding();
    const response=await request("/api/wilds/wallet/transfer/no-write",{method:"POST",body:JSON.stringify({attempt:receipt.attempt,senderHandle:leg.senderHandle,recipientHandle:leg.recipientHandle,amountPhiMicro:leg.amountPhiMicro,operationNonce:operationNonce(leg),noWriteWitness:receipt.noWriteWitness})});
    const value=await response.json();assertBinding();
    if(!response.ok||!object(value)||!fields(value,["status","rail","code","terminal","retryAfterKai"])||value.status!=="zero-write"||value.rail!=="settlement"||value.code!=="INSUFFICIENT_VALUE"||typeof value.terminal!=="boolean"||value.retryAfterKai!==receipt.retryAfterKai)throw Error("The original rejected payment could not be independently checked. Keep its reservation.");
    return {terminal:value.terminal,retryAfterKai:receipt.retryAfterKai};
  };
  const observeRejected=async(leg:WildsWalletConnectPhiLeg,receipt:WildsWalletConnectPhiNoWriteReceipt):Promise<WildsWalletConnectPhiOutcome>=>{
    // A rejection is not a terminal native nonce. A previously submitted
    // execution may still settle: canonical settlement always takes priority.
    const actual=await observe(leg,{schema:"wildz.wallet.connect-transfer-receipt.v1",attempt:receipt.attempt,leg});
    if(actual.status==="committed")return actual;
    try{await noWrite(leg,receipt);return {status:"failed",receipt,message:"The original request was rejected for insufficient Phi. Its coordination witness does not prove native settlement."};}
    catch{return {status:"pending",receipt,message:"Checking the rejected original payment; its reservation remains held."};}
  };
  const archive=input.archiveStore??(input.store===undefined?createWildsWalletConnectPhiArchiveStore({currentBinding:()=>input.currentBinding?.()??{keyId:input.keyId,ownerHandle:input.ownerHandle},qualifyCommitted:entry=>observe(entry.leg,locator(entry))}):undefined);
  const archiveBinding={keyId:input.keyId,ownerHandle:input.ownerHandle};
  const makeRoom=async(record:Record):Promise<Record>=>{
    if(record.entries.length<MAX_ENTRIES)return record;
    // Bound explicit capacity work; a full uncertain queue must not turn one
    // Send click into 128 serial network timeouts. Every candidate still needs
    // a fresh canonical read and immutable archive readback before eviction.
    const cursor=record.archiveCursor??0;
    const scanned=archive?Array.from({length:3},(_,offset)=>record.entries[(cursor+offset)%record.entries.length]!).filter(entry=>entry.phase==="submitted"):[];
    // The saved cursor coordinates bounded reads only. It grants no outcome;
    // repeated explicit checks eventually inspect older committed originals.
    if(archive){record={...record,archiveCursor:(cursor+3)%record.entries.length};save(record);}
    const candidates=scanned;
    const outcomes=await Promise.all(candidates.map(candidate=>observe(candidate.leg,locator(candidate))));
    if(archive)for(let index=0;index<candidates.length;index++){
      const candidate=candidates[index]!;
      if(outcomes[index]?.status!=="committed")continue;
      const retained=await archive.retain(archiveBinding,{leg:candidate.leg,attempt:candidate.attempt,phase:"submitted"});assertBinding();
      if(!equal(retained,candidate)||!equal(await archive.read(archiveBinding,candidate.leg),candidate))throw storageError();
      const next={...record,entries:record.entries.filter(entry=>entry.leg.attemptId!==candidate.leg.attemptId)};save(next);return next;
    }
    throw storageError();
  };
  return {
    /** Local retry classification only; canonical observation still decides settlement. */
    submissionPhase(value: WildsWalletConnectPhiLeg): "none" | "prepared" | "submitted" | "rejected" {
      const leg=closedLeg(value); assertBinding();
      if(leg.senderHandle!==input.ownerHandle) throw Error("Only this sender can inspect its saved payment attempt.");
      const entry=load().entries.find(item=>item.leg.attemptId===leg.attemptId);
      if(entry&&!equal(entry.leg,leg)) throw Error("This saved payment attempt has different terms.");
      return entry?.phase??"none";
    },
    async sendPhi(value: WildsWalletConnectPhiLeg): Promise<WildsWalletConnectPhiOutcome> {
      let submitted: WildsWalletConnectPhiReceipt | null = null;
      try {
        const leg = closedLeg(value); assertBinding();
        if (leg.senderHandle !== input.ownerHandle) throw Error("Only the sender may authorize this Phi leg.");
        return await store.withLock(ownerKey, async () => {
          assertBinding(); let record = load(); let entry = record.entries.find(item => item.leg.attemptId === leg.attemptId);
          if (entry && !equal(entry.leg, leg)) throw Error("This saved payment attempt has different terms.");
          if(!entry&&archive){const retained=await archive.read(archiveBinding,leg);assertBinding();if(retained)return observe(leg,locator(retained));}
          if(entry?.phase==="rejected")return observeRejected(leg,entry.noWriteReceipt!);
          if (entry?.phase === "submitted") return observe(leg, locator(entry));
          if (input.ensureReady && await input.ensureReady() === false) throw Error("Reconnect Send before authorizing this payment.");
          assertBinding();
          if (!entry) {
            record=await makeRoom(record);
            const response = await request("/api/wilds/wallet/transfer/preview", { method: "POST", body: JSON.stringify({ recipientUsername: normalizeWildsWalletPublicUsername(leg.recipientHandle), amountPhiMicro: leg.amountPhiMicro, rail: "settlement", operationNonce: operationNonce(leg) }) });
            const staged = await response.json(); assertBinding();
            if (!response.ok || !object(staged) || staged.status !== "staged" || staged.rail !== "settlement" || staged.amountPhiMicro !== leg.amountPhiMicro || !attemptText(staged.attempt) || !Number.isSafeInteger(staged.expiresAtKai)) throw Error("The exact payment review could not be prepared. Nothing was sent.");
            entry = Object.freeze({ leg, attempt: staged.attempt, phase: "prepared" });
            record = { ...record, entries: [...record.entries, entry] }; save(record);
          }
          const authorization = input.authorization ?? { authorize: (review: { attempt: string; recipientUsername: string; amountPhiMicro: string; rail: "settlement" }) => authorizeWildsWalletTransferWithIdentity(input.keyId, review) };
          const consent = await authorization.authorize({ attempt: entry.attempt, recipientUsername: normalizeWildsWalletPublicUsername(leg.recipientHandle), amountPhiMicro: leg.amountPhiMicro, rail: "settlement" });
          assertBinding();
          await input.beforeSubmit?.(leg); assertBinding();
          entry = { ...entry, phase: "submitted" };
          record = { ...record, entries: record.entries.map(item => item.leg.attemptId === leg.attemptId ? entry! : item) }; save(record);
          submitted = locator(entry);
          // After this checkpoint every failure is uncertain until the actual canonical transfer is read.
          const response = await request("/api/wilds/wallet/transfer/execute", { method: "POST", body: JSON.stringify({ attempt: entry.attempt, consent }) });
          const result = await response.json(); assertBinding();
          if (response.ok && object(result) && result.status === "zero-write" && result.rail === "settlement" && result.code === "INSUFFICIENT_VALUE" && fields(result, ["status", "rail", "code","noWriteWitness"])&&witnessText(result.noWriteWitness)){
            const check=await request("/api/wilds/wallet/transfer/no-write",{method:"POST",body:JSON.stringify({attempt:entry.attempt,senderHandle:leg.senderHandle,recipientHandle:leg.recipientHandle,amountPhiMicro:leg.amountPhiMicro,operationNonce:operationNonce(leg),noWriteWitness:result.noWriteWitness})});
            const known=await check.json();assertBinding();
            if(!check.ok||!object(known)||!fields(known,["status","rail","code","terminal","retryAfterKai"])||known.status!=="zero-write"||known.rail!=="settlement"||known.code!=="INSUFFICIENT_VALUE"||typeof known.terminal!=="boolean"||!Number.isSafeInteger(known.retryAfterKai))return {status:"pending",receipt:submitted,message:"Checking this original rejected payment."};
            const receipt=admitWildsWalletConnectPhiNoWriteReceipt({schema:"wildz.wallet.connect-zero-write-receipt.v1",attempt:entry.attempt,leg,noWriteWitness:result.noWriteWitness,retryAfterKai:known.retryAfterKai},leg);
            entry={...entry,phase:"rejected",noWriteReceipt:receipt};save({...record,entries:record.entries.map(item=>item.leg.attemptId===leg.attemptId?entry!:item)});
            return { status: "failed", receipt, message: "The original request was rejected for insufficient Phi. Keep its exact attempt while reviewing closure together." };
          }
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
      if(object(proposedReceipt)&&proposedReceipt.schema==="wildz.wallet.connect-zero-write-receipt.v1")return observeRejected(leg,admitWildsWalletConnectPhiNoWriteReceipt(proposedReceipt,leg));
      let receipt: WildsWalletConnectPhiReceipt | null = proposedReceipt === undefined ? null : admitWildsWalletConnectPhiReceipt(proposedReceipt, leg);
      if (!receipt && leg.senderHandle === input.ownerHandle) {
        const entry = load().entries.find(item => item.leg.attemptId === leg.attemptId);
        if (entry) { if (!equal(entry.leg, leg)) throw Error("This saved payment attempt has different terms.");if(entry.phase==="rejected")return observeRejected(leg,entry.noWriteReceipt!); receipt = locator(entry); }
        else if(archive){const retained=await archive.read(archiveBinding,leg);assertBinding();if(retained)receipt=locator(retained);}
      }
      return receipt ? observe(leg, receipt) : { status: "none" };
    },
    async verifyPhiReceipt(value: WildsWalletConnectPhiLeg, outcome: Readonly<{ status: string; receipt?: unknown }>): Promise<void> {
      const leg = closedLeg(value);
      if (outcome.status !== "committed") throw Error("No canonical Phi settlement receipt was verified.");
      const receipt = admitWildsWalletConnectPhiReceipt(outcome.receipt, leg);
      if ((await observe(leg, receipt)).status !== "committed") throw Error("The original Phi settlement receipt could not be verified.");
    },
    async verifyPhiZeroWrite(value:WildsWalletConnectPhiLeg,proposedReceipt:unknown):Promise<void>{
      const leg=closedLeg(value),receipt=admitWildsWalletConnectPhiNoWriteReceipt(proposedReceipt,leg);
      if((await observeRejected(leg,receipt)).status!=="failed"||(await noWrite(leg,receipt)).terminal!==true)throw Error("Keep the original reservation until the known rejection is checked and its old authorization window has ended.");
    },
    async verifyPhiRejection(value:WildsWalletConnectPhiLeg,proposedReceipt:unknown):Promise<void>{
      const leg=closedLeg(value),receipt=admitWildsWalletConnectPhiNoWriteReceipt(proposedReceipt,leg);
      if((await observeRejected(leg,receipt)).status!=="failed")throw Error("The rejected original payment could not be checked.");
    }
  };
}
