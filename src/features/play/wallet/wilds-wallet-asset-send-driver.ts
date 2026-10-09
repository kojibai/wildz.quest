import type { ExchangeClaim } from "../WildsResourceExchange";
import type { WildsWalletAssetSendRequest, WildsWalletAssetSendResult } from "./wilds-wallet-asset-send";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import { WildsMessageZeroWriteError } from "../wilds-messenger-delivery";
import { admitWildsWalletAssetSendRecovery, type WildsWalletAssetSendRecoveryStore } from "./wilds-wallet-asset-send-recovery";

export type WildsWalletAssetSendPorts = {
  owner: string;
  currentOwner(): string;
  authorize(): Promise<void>;
  validate(request: WildsWalletAssetSendRequest): Promise<void>;
  validateRecoveryPackage?(request: WildsWalletAssetSendRequest, packageId: string): Promise<void>;
  findCreatureDelivery(assetId: string, recipientHandle: string): boolean;
  packageMemberIds?(packageId: string): readonly string[];
  issueCreatureOffer(assetId: string, recipientHandle: string): Promise<void>;
  createInventoryPackage(request: WildsWalletAssetSendRequest): Promise<string>;
  transferPackage(packageId: string, recipientHandle: string): Promise<ExchangeClaim>;
  deliverResourceClaim(recipientHandle: string, claim: ExchangeClaim): Promise<void>;
};

type Attempt = {
  owner: string;
  request: WildsWalletAssetSendRequest;
  basis: string;
  keys: string[];
  mutated: boolean;
  restored?: boolean;
  sentCheckpoint?: boolean;
  packageId?: string;
  claim?: ExchangeClaim;
  result?: WildsWalletAssetSendResult;
  running?: Promise<WildsWalletAssetSendResult>;
};

function sourceIds(request: WildsWalletAssetSendRequest) {
  return request.asset.kind === "inventory"
    ? [...request.asset.foodItemIds, ...request.asset.materialLotIds, ...request.asset.resourceLotIds].sort()
    : [];
}

function freezeRequest(request: WildsWalletAssetSendRequest, owner: string): WildsWalletAssetSendRequest {
  const target = parseWildzPlayerCoordinate(request.recipientHandle);
  if (!target || sameWildzPlayerCoordinate(owner, target.profileHandle)) throw Error("Choose another valid Receiz user.");
  if (!/^[a-z0-9][a-z0-9:._-]{0,159}$/i.test(request.attemptId)) throw Error("A saved send attempt is required.");
  const source = request.asset;
  if (source.kind === "inventory") {
    const ids = sourceIds(request);
    if (!ids.length || ids.length > 64 || new Set(ids).size !== ids.length || ids.some(id => !id || id.length > 800)) throw Error("Choose up to 64 distinct available items.");
    return Object.freeze({ ...request, recipientHandle: target.profileHandle, asset: Object.freeze({ kind: "inventory", foodItemIds: Object.freeze([...source.foodItemIds].sort()), materialLotIds: Object.freeze([...source.materialLotIds].sort()), resourceLotIds: Object.freeze([...source.resourceLotIds].sort()) }) });
  }
  if (source.kind !== "creature" && source.kind !== "package" || !(source.kind === "creature" ? source.assetId : source.packageId)) throw Error("Choose an available wallet asset.");
  return Object.freeze({ ...request, recipientHandle: target.profileHandle, asset: Object.freeze({ ...source }) });
}

function assetKeys(request: WildsWalletAssetSendRequest, ports: WildsWalletAssetSendPorts) {
  if (request.asset.kind === "creature") return [`creature:${request.asset.assetId}`];
  if (request.asset.kind === "package") return [`package:${request.asset.packageId}`, ...(ports.packageMemberIds?.(request.asset.packageId) ?? []).map(id => `source:${id}`)];
  return sourceIds(request).map(id => `source:${id}`);
}

function sent(request: WildsWalletAssetSendRequest): WildsWalletAssetSendResult {
  const username = request.recipientHandle.replace(/\.receiz\.id$/, "");
  return { status: "sent", message: `Sent to @${username} · awaiting acceptance. The one-use claim was delivered privately; custody changes when they accept.` };
}

function pending(entry: Attempt): WildsWalletAssetSendResult {
  const creature = entry.request.asset.kind === "creature";
  return {
    status: "pending", retryable: !creature && !entry.sentCheckpoint,
    message: creature
      ? "The last creature send could not be confirmed. This creature is held to prevent a duplicate offer. Check Messages; source recovery is unavailable."
      : entry.sentCheckpoint ? "The last resource send could not be confirmed. These resources are held to prevent a duplicate offer. Check Messages; delivery recovery is unavailable."
      : entry.claim ? "The one-use resource claim is ready; private delivery is still syncing. Retry this send." : "This resource send is reconnecting. Retry to finish the same offer."
  };
}

/** Saved source checkpoints prevent a wallet close or page reload from issuing another uncertain offer. */
export function createWildsWalletAssetSendDriver({ recoveryStore }: { recoveryStore?: WildsWalletAssetSendRecoveryStore } = {}) {
  const attempts = new Map<string, Attempt>();
  const attemptBases = new Map<string, string>();
  const selections = new Map<string, Attempt>();
  const locks = new Map<string, Attempt>();
  const loadedOwners = new Set<string>();
  const sameOwner = (left: string, right: string) => left === right || sameWildzPlayerCoordinate(left, right);
  const basisFor = (owner: string, request: WildsWalletAssetSendRequest) => JSON.stringify({ owner, recipient: request.recipientHandle, asset: request.asset });
  const persist = (owner: string) => {
    if (!recoveryStore) return;
    const record = {
      schema: "wildz.wallet.asset-send.v1" as const, owner,
      attempts: [...selections.values()].filter(entry => entry.owner === owner).map(entry => ({
        request: entry.request, keys: [...entry.keys], stage: entry.sentCheckpoint || entry.result?.status === "sent" ? "sent" as const : entry.mutated ? "mutated" as const : "prepared" as const,
        ...(entry.packageId ? { packageId: entry.packageId } : {})
      }))
    };
    admitWildsWalletAssetSendRecovery(record, owner);
    try { recoveryStore.write(owner, record); }
    catch { throw Error("Saved asset send recovery could not be updated. No new asset operation was started."); }
  };
  const restore = (owner: string) => {
    if (!recoveryStore || loadedOwners.has(owner)) return;
    let saved;
    try { saved = admitWildsWalletAssetSendRecovery(recoveryStore.load(owner), owner); }
    catch { throw Error("Saved asset send recovery is unavailable. Reconnect this wallet before sending assets."); }
    // Validate the entire record before admitting any source lock.
    const entries = saved.attempts.map(record => {
      const request = freezeRequest(record.request, owner);
      const entry: Attempt = { owner, request, basis: basisFor(owner, request), keys: [...record.keys], mutated: record.stage !== "prepared", packageId: record.packageId, restored: true, sentCheckpoint: record.stage === "sent" };
      // Browser checkpoints reserve sources; only canonical delivery can produce a sent result.
      if (record.stage !== "prepared") entry.result = pending(entry);
      return entry;
    });
    for (const entry of entries) {
      const key = `${owner}:${entry.request.attemptId}`;
      attempts.set(key, entry); attemptBases.set(key, entry.basis); selections.set(entry.basis, entry);
      entry.keys.forEach(source => locks.set(`${owner}:${source}`, entry));
    }
    loadedOwners.add(owner);
  };
  const release = (entry: Attempt) => {
    for (const [key, value] of attempts) if (value === entry) { attempts.delete(key); attemptBases.delete(key); }
    selections.delete(entry.basis);
    for (const key of entry.keys) if (locks.get(`${entry.owner}:${key}`) === entry) locks.delete(`${entry.owner}:${key}`);
    persist(entry.owner);
  };
  const run = (entry: Attempt, ports: WildsWalletAssetSendPorts): Promise<WildsWalletAssetSendResult> => {
    if (entry.running) return entry.running;
    if (entry.result?.status === "sent") return Promise.resolve(entry.result);
    const exact = entry.request;
    let creatureIssuedHere = false;
    const markMutated = () => {
      if (entry.mutated) return;
      entry.mutated = true;
      try { persist(entry.owner); }
      catch (cause) { entry.mutated = false; throw cause; }
    };
    const markSent = () => { entry.sentCheckpoint = true; entry.result = sent(exact); persist(entry.owner); return entry.result; };
    const assertOwner = () => { if (!sameOwner(entry.owner, ports.currentOwner())) throw Error("The signed-in Explorer changed."); };
    const running = (async (): Promise<WildsWalletAssetSendResult> => {
      try {
        assertOwner();
        if (exact.asset.kind === "creature" && ports.findCreatureDelivery(exact.asset.assetId, exact.recipientHandle)) return markSent();
        if (entry.mutated && exact.asset.kind === "creature") return entry.result!;
        if (entry.restored && entry.sentCheckpoint) return entry.result = pending(entry);
        await ports.authorize();
        assertOwner();
        if (!entry.mutated) await ports.validate(exact);
        assertOwner();
        if (entry.restored && exact.asset.kind !== "creature" && !ports.validateRecoveryPackage) throw Error("Saved resource custody must be checked against its original source before retrying.");
        if (exact.asset.kind === "creature") {
          if (ports.findCreatureDelivery(exact.asset.assetId, exact.recipientHandle)) return markSent();
          markMutated();
          creatureIssuedHere = true;
          await ports.issueCreatureOffer(exact.asset.assetId, exact.recipientHandle);
        } else {
          markMutated();
          entry.packageId ??= exact.asset.kind === "package" ? exact.asset.packageId : await ports.createInventoryPackage(exact);
          assertOwner();
          const packageKey = `package:${entry.packageId}`;
          if (!entry.keys.includes(packageKey)) { entry.keys.push(packageKey); locks.set(`${entry.owner}:${packageKey}`, entry); }
          persist(entry.owner);
          if (entry.restored) {
            await ports.validateRecoveryPackage!(exact, entry.packageId);
            assertOwner();
            entry.restored = false;
          }
          entry.claim ??= await ports.transferPackage(entry.packageId, exact.recipientHandle);
          assertOwner();
          await ports.deliverResourceClaim(exact.recipientHandle, entry.claim);
        }
        assertOwner();
        return markSent();
      } catch (cause) {
        if (!entry.mutated || creatureIssuedHere && cause instanceof WildsMessageZeroWriteError) {
          try { release(entry); }
          catch { return { status: "failed", message: "Saved asset send recovery could not be updated. No new asset operation was started." }; }
          return { status: "failed", message: cause instanceof Error ? cause.message : "The send could not start. Reopen the wallet and check these assets." };
        }
        return entry.result = pending(entry);
      }
    })().finally(() => { entry.running = undefined; });
    entry.running = running;
    return running;
  };
  return {
    async send(request: WildsWalletAssetSendRequest, ports: WildsWalletAssetSendPorts): Promise<WildsWalletAssetSendResult> {
      let exact: WildsWalletAssetSendRequest;
      try { exact = freezeRequest(request, ports.owner); restore(ports.owner); }
      catch (cause) { return { status: "failed", message: cause instanceof Error ? cause.message : "Check the selected assets and recipient." }; }
      const basis = basisFor(ports.owner, exact);
      const attemptKey = `${ports.owner}:${exact.attemptId}`;
      const prior = attempts.get(attemptKey);
      if (prior && attemptBases.get(attemptKey) !== basis) return { status: "failed", message: "This saved send belongs to a different selection. Reopen its original review." };
      let entry = prior ?? selections.get(basis);
      const keys = assetKeys(exact, ports);
      if (!entry) {
        const conflict = keys.map(key => locks.get(`${ports.owner}:${key}`)).find(Boolean);
        if (conflict) {
          const packageSources = exact.asset.kind === "package" ? [...(ports.packageMemberIds?.(exact.asset.packageId) ?? [])].sort() : [];
          if (exact.asset.kind === "package" && conflict.request.asset.kind === "inventory" && conflict.request.recipientHandle === exact.recipientHandle
            && JSON.stringify(packageSources) === JSON.stringify(sourceIds(conflict.request))) entry = conflict;
          else return { status: "pending", retryable: false, message: "This exact asset already has a saved send. Finish its original offer before choosing another recipient." };
        }
      }
      if (!entry) {
        entry = { owner: ports.owner, request: exact, basis, keys, mutated: false };
        selections.set(basis, entry);
        keys.forEach(key => locks.set(`${ports.owner}:${key}`, entry!));
      }
      attempts.set(attemptKey, entry);
      attemptBases.set(attemptKey, basis);
      try { persist(entry.owner); }
      catch (cause) { return { status: "failed", message: cause instanceof Error ? cause.message : "Saved asset send recovery is unavailable." }; }
      return run(entry, ports);
    }
  };
}
