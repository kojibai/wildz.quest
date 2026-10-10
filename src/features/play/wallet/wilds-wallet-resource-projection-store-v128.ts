import { receizBase64UrlEncode, signReceizIdentityLoginProof, verifyReceizIdentityPublicKeyProjectionSignature, type ReceizIdentityKeyAlgorithm, type ReceizIdentityLoginProof, type ReceizKeyFile, type ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import type { WildzContinuityDatabase } from "../../../lib/storage/wildz-indexed-db";
import type { WildsResourceJournalV128 } from "../../../lib/receiz/wilds-resource-journal-v128";
import type { WildsResourceSourceProofV128 } from "../../../lib/receiz/wilds-resource-exchange-v128";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { verifyWildsResourcePackage, type WildsResourcePackageV1, type WildsResourcePackageMember } from "../wilds-resource-package";
import { admitWildsWalletBearerOriginal } from "./wilds-wallet-bearer-gift-proof";
import { wildsWalletResourceMemberRefV128, type WildsWalletResourceProjectionRowV128 } from "./wilds-wallet-resource-projection-v128";
import type { WildsResourceExchangeBrowserRuntimeV128, WildsWalletResourceProjectionV128, WildsWalletResourceUnpackReceiptV128 } from "./wilds-wallet-resource-source-controller-v128";
import type { WildsWalletStagedTradeAssetAuthority, WildsWalletStagedTradeResourceSourceHead } from "./wilds-wallet-staged-trade-types";

export type WildsWalletResourceProjectionContinuationV128 = Readonly<{ descriptor: WildsWalletStagedTradeResourceSourceHead; authority: WildsWalletStagedTradeAssetAuthority }>;
type Detail = Readonly<{ schema: "wildz.wallet.resource-projection-detail.v128"; value: Omit<WildsWalletResourceProjectionV128, "proof" | "continuation">; continuation?: WildsWalletResourceProjectionContinuationV128 }>;
type SignedRow = Readonly<{ row: WildsWalletResourceProjectionRowV128; publicKey: Readonly<{ keyId: string; alg: ReceizIdentityKeyAlgorithm; publicKeyRawB64u: string }>; signature: ReceizIdentityLoginProof }>;
type Index = Readonly<{ schema: "wildz.wallet.resource-projection-index.v128"; entries: readonly SignedRow[] }>;
type Qualified = Readonly<{
  package: WildsResourcePackageV1; state: WildsResourceJournalV128; proof: WildsResourceSourceProofV128; currentHead: string;
  events: readonly Readonly<{ event: Readonly<{ kind: string; ownerReceizId: string; packageId?: string }>; appendId: string; head: string; kaiUPulse: number; sealKai: string }>[];
}>;
export type WildsWalletResourceProjectionStoreInputV128 = Readonly<{
  keyId: string; ownerHandle: string; currentIdentity(): Readonly<{ keyId: string; ownerHandle: string }>;
  openRuntime(): Promise<WildsResourceExchangeBrowserRuntimeV128>;
}>;
export type WildsWalletResourceProjectionStoreDependenciesV128 = Readonly<{
  database(): Promise<WildzContinuityDatabase>;
  withLock<T>(name: string, action: () => Promise<T>): Promise<T>;
  readIdentity(keyId: string): Promise<ReceizKeyFile>;
  qualify(value: WildsWalletResourceProjectionV128, input: WildsWalletResourceProjectionStoreInputV128): Promise<Qualified>;
}>;
const digest = (value: unknown) => sha256PortableBasis(canonicalPortableCardJson(value)).slice(7);
const same = (a: unknown, b: unknown) => canonicalPortableCardJson(a) === canonicalPortableCardJson(b);
const defaults: WildsWalletResourceProjectionStoreDependenciesV128 = {
  async database() { return (await import("../../../lib/receiz/wildz-active-identity")).defaultContinuityDatabase; },
  async withLock(name, action) { if (!globalThis.navigator?.locks) throw Error("A browser with Web Locks is required to retain resource custody."); return navigator.locks.request(name, action); },
  async readIdentity(keyId) { return (await import("../../../lib/receiz/wildz-identity-signing-read")).readWildzIdentityForSigning(keyId); },
  async qualify(value, input) {
    const runtime = await input.openRuntime();
    if (runtime.keyId !== input.keyId || runtime.ownerReceizId !== input.ownerHandle) throw Error("The resource source session belongs to another Explorer.");
    const { readWildsResourceSourcePackageV128 } = await import("../../../lib/receiz/wilds-resource-exchange-v128");
    const original = await readWildsResourceSourcePackageV128(runtime.sdk, value.source);
    if (!same(original.bearer.package, value.package) || original.opened.admitted.ownerReceizId !== value.package.ownerReceizId) throw Error("The resource Original does not contain the exact retained genesis package.");
    const current = await runtime.exchange.verifyProjection(value.proof);
    const record = current.state.packages[value.package.packageId];
    if (record?.artifactSha256 && record.artifactSha256 !== value.source.artifactSha256) throw Error("The current source pins a different package Original.");
    return { package: original.bearer.package, ...current, currentHead: current.predecessor.head.head };
  },
};
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const challenge = (row: WildsWalletResourceProjectionRowV128) => `WILDZ-RESOURCE-PRESENTATION-CACHE-V128\n${canonicalPortableCardJson(row)}`;
function bounded(value: unknown, max: number) { if (new TextEncoder().encode(canonicalPortableCardJson(value)).length > max) throw Error("The resource projection exceeds its local storage limit."); }

/** Cheap construction and offline compact loading. Signatures authenticate only
 * local presentation integrity. Every explicit reopen uses the actual released
 * SDK's root admission and current source CAS; cached ownership grants nothing. */
export function createWildsWalletResourceProjectionStoreV128(input: WildsWalletResourceProjectionStoreInputV128, overrides: Partial<WildsWalletResourceProjectionStoreDependenciesV128> = {}) {
  const dependencies: WildsWalletResourceProjectionStoreDependenciesV128 = { ...defaults, ...overrides };
  const current = () => { const actual = input.currentIdentity(); if (actual.keyId !== input.keyId || actual.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed. Reopen the matching resource wallet."); };
  const indexKey = JSON.stringify(["wildz.wallet.resource-projection-index.v128", input.ownerHandle, input.keyId]);
  const proofKey = (sha: string) => JSON.stringify(["wildz.wallet.resource-projection-proof.v128", input.ownerHandle, input.keyId, sha]);
  const detailKey = (sha: string) => JSON.stringify(["wildz.wallet.resource-projection-detail.v128", input.ownerHandle, input.keyId, sha]);
  const locked = <T>(action: () => Promise<T>) => dependencies.withLock(`wildz:resource-projection:${input.ownerHandle}:${input.keyId}`, action);
  async function admitted(entry: SignedRow): Promise<boolean> {
    try {
      const row = entry.row;
      bounded(entry, 100_000);
      if (!row || row.schema !== "wildz.wallet.resource-projection.v128" || row.keyId !== input.keyId || row.ownerHandle !== input.ownerHandle
        || !sha(input.keyId) || !/^[a-z0-9_]{3,30}\.receiz\.id$/.test(input.ownerHandle)
        || !/^wildz:package:[a-f0-9]{64}$/.test(row.packageId) || !/^sha256:[a-f0-9]{64}$/.test(row.packageHead)
        || !["reserved", "received", "unpacked", "sent"].includes(row.kind) || !Array.isArray(row.memberRefs) || !row.memberRefs.length || row.memberRefs.length > 64
        || !Array.isArray(row.availableMemberIds) || row.availableMemberIds.some(id => !row.memberRefs.some(m => m.id === id))
        || new Set(row.memberRefs.map(m => m.id)).size !== row.memberRefs.length || new Set(row.availableMemberIds).size !== row.availableMemberIds.length
        || ![row.sourceArtifactSha256, row.sourcePayloadSha256, row.proofDigest, row.detailDigest, row.currentHead].every(sha)
        || entry.publicKey.keyId !== input.keyId || entry.signature.keyId !== input.keyId || entry.signature.alg !== entry.publicKey.alg
        || entry.signature.challengeB64Url !== receizBase64UrlEncode(new TextEncoder().encode(challenge(row)))) return false;
      return verifyReceizIdentityPublicKeyProjectionSignature({ keyId: input.keyId, alg: entry.publicKey.alg, publicKeyRawB64u: entry.publicKey.publicKeyRawB64u, challengeB64Url: entry.signature.challengeB64Url, signatureB64Url: entry.signature.signatureB64Url });
    } catch { return false; }
  }
  async function readEntries() {
    current(); const database = await dependencies.database(), index = await database.read<Index>("meta", indexKey); current();
    if (!index) return [];
    bounded(index, 4_000_000);
    if (index.schema !== "wildz.wallet.resource-projection-index.v128" || !Array.isArray(index.entries) || index.entries.length > 256) throw Error("The saved resource cache is invalid. Reopen its exact source.");
    const verified = await Promise.all(index.entries.map(admitted)); current();
    return index.entries.filter((_entry, i) => verified[i]);
  }
  function reconcile(row: WildsWalletResourceProjectionRowV128, accepted: Qualified): WildsWalletResourceProjectionRowV128 {
    const record = accepted.state.packages[row.packageId];
    const identity = (ref: ReturnType<typeof wildsWalletResourceMemberRefV128>) => ({ id: ref.id, kind: ref.kind, resourceKind: ref.resourceKind, quantity: ref.quantity });
    if (!record || !same(record.package.members.map(wildsWalletResourceMemberRefV128).map(identity), row.memberRefs.map(identity)) || record.package.head !== row.packageHead) throw Error("The current resource source changed immutable package members.");
    const own = record.ownerReceizId === input.ownerHandle;
    const kind = !own ? "sent" : record.status === "reserved" ? "reserved" : record.status === "claimed" ? "received" : "unpacked";
    const event = accepted.events.find(item => item.appendId === record.custodyAppendId);
    if (!event) throw Error("The actual resource custody addition is unavailable.");
    const availableMemberIds = row.memberRefs.filter(member => {
      const loose = accepted.state.looseMembers[member.id];
      return own && kind === "unpacked" && loose?.ownerReceizId === input.ownerHandle && loose.packageId === row.packageId && !accepted.state.spentMembers[member.id];
    }).map(member => member.id);
    return { ...row, memberRefs: record.package.members.map(wildsWalletResourceMemberRefV128), currentOwnerHandle: record.ownerReceizId, recipientHandle: record.recipientHandle, kind, availableMemberIds, currentHead: accepted.currentHead, custodyAppendId: record.custodyAppendId, custodySealKai: event.sealKai, proofDigest: digest(accepted.proof) };
  }
  async function retainInside(value: WildsWalletResourceProjectionV128, continuation?: WildsWalletResourceProjectionContinuationV128) {
    current(); bounded(value, 40_000_000);
    const leg = value.leg, asset = leg.request.asset;
    if (!verifyWildsResourcePackage(value.package) || asset.kind === "creature" || leg.senderHandle !== input.ownerHandle && leg.recipientHandle !== input.ownerHandle
      || leg.attemptId !== leg.legId || leg.request.attemptId !== leg.attemptId || leg.request.recipientHandle !== leg.recipientHandle
      || (asset.kind === "package" ? asset.packageId !== value.package.packageId : !same([...asset.foodItemIds, ...asset.materialLotIds, ...asset.resourceLotIds].sort(), value.package.members.map(member => member.id).sort()))) throw Error("An exact resource package belonging to this Explorer's stage is required.");
    const source = admitWildsWalletBearerOriginal(value.source), accepted = await dependencies.qualify({ ...value, source }, input); current();
    if (!same(accepted.package, value.package)) throw Error("The actual resource package changed.");
    bounded(accepted.proof, 32_000_000);
    const entries = await readEntries(); current();
    const previous = entries.find(entry => entry.row.packageId === value.package.packageId);
    if (previous && previous.row.sourceArtifactSha256 !== source.artifactSha256) throw Error("The same package cannot substitute a different native Original.");
    const { proof: _proof, continuation: providedContinuation, ...withoutProof } = value;
    const heldContinuation = continuation ?? providedContinuation;
    const detail: Detail = { schema: "wildz.wallet.resource-projection-detail.v128", value: { ...withoutProof, source }, ...(heldContinuation ? { continuation: structuredClone(heldContinuation) } : {}) };
    // Preserve the accepted agreement for an explicit later unpack when a
    // source-only callback refreshes the same retained package.
    if (!heldContinuation && previous) {
      const saved = await (await dependencies.database()).read<Detail>("artifacts", detailKey(previous.row.detailDigest)); current();
      if (saved && digest(saved) === previous.row.detailDigest && saved.continuation) (detail as { continuation?: WildsWalletResourceProjectionContinuationV128 }).continuation = saved.continuation;
    }
    bounded(detail, 4_000_000);
    const row = reconcile({ schema: "wildz.wallet.resource-projection.v128", ownerHandle: input.ownerHandle, keyId: input.keyId,
      packageId: value.package.packageId, packageHead: value.package.head, genesisOwnerHandle: value.package.ownerReceizId, currentOwnerHandle: "", recipientHandle: "", kind: "sent",
      memberRefs: value.package.members.map(wildsWalletResourceMemberRefV128), availableMemberIds: [], sourceArtifactSha256: source.artifactSha256, sourcePayloadSha256: source.payloadSha256,
      proofDigest: "", detailDigest: digest(detail), currentHead: "", custodyAppendId: "", custodySealKai: "" }, accepted);
    const rows = [...entries.filter(entry => entry.row.packageId !== row.packageId).map(entry => reconcile(entry.row, accepted)), row];
    if (rows.length > 256) throw Error("The resource cache is full. Its existing source references were preserved.");
    const identity = await dependencies.readIdentity(input.keyId); current();
    if (identity.keyId !== input.keyId || `${identity.owner.username}.receiz.id` !== input.ownerHandle) throw Error("The held signing key belongs to another Explorer.");
    const signed = await Promise.all(rows.map(async row => ({ row, publicKey: { keyId: identity.keyId, alg: identity.alg, publicKeyRawB64u: identity.crypto.publicKeyRawB64u }, signature: await signReceizIdentityLoginProof({ keyFile: identity, challengeText: challenge(row) }) }))); current();
    if (!(await Promise.all(signed.map(admitted))).every(Boolean)) throw Error("The local resource presentation signature is invalid.");
    const database = await dependencies.database(); current();
    await database.transaction(["artifacts", "meta"], "readwrite", async tx => {
      current();
      await tx.put("artifacts", structuredClone(accepted.proof), proofKey(row.proofDigest));
      await tx.put("artifacts", structuredClone(detail), detailKey(row.detailDigest));
      // The source controller owns its unpack/reoffer locator and full exact
      // approval continuation. Keep the Original in this hash-bound detail;
      // never overwrite that independent record with presentation metadata.
      await tx.put("meta", { schema: "wildz.wallet.resource-projection-index.v128", entries: signed }, indexKey); current();
    }); current();
    return { row, accepted, detail };
  }
  return {
    retain(value: WildsWalletResourceProjectionV128, continuation?: WildsWalletResourceProjectionContinuationV128) { return locked(() => retainInside(value, continuation)); },
    async listCached(): Promise<readonly WildsWalletResourceProjectionRowV128[]> { return (await readEntries()).map(entry => Object.freeze(structuredClone(entry.row))); },
    reopen(packageId: string) { return locked(async () => {
      const entry = (await readEntries()).find(entry => entry.row.packageId === packageId); if (!entry) throw Error("The matching signed resource reference is unavailable. Reopen its private offer.");
      const database = await dependencies.database();
      const [detail, proof] = await Promise.all([database.read<Detail>("artifacts", detailKey(entry.row.detailDigest)), database.read<WildsResourceSourceProofV128>("artifacts", proofKey(entry.row.proofDigest))]); current();
      if (!detail || digest(detail) !== entry.row.detailDigest || !proof || digest(proof) !== entry.row.proofDigest || detail.value.source.artifactSha256 !== entry.row.sourceArtifactSha256) throw Error("The exact retained resource proof changed or is unavailable.");
      const refreshed = await retainInside({ ...detail.value, proof }, detail.continuation);
      const actual = refreshed.accepted, row = refreshed.row;
      const availableMembers: readonly WildsResourcePackageMember[] = actual.package.members.filter(member => row.availableMemberIds.includes(member.id));
      const imported = actual.state.imports[packageId], unpackEvent = imported && actual.events.find(item => item.appendId === imported.unpackAppendId);
      const unpackReceipt: WildsWalletResourceUnpackReceiptV128 | undefined = imported && unpackEvent ? { schema: "wildz.resource-unpack-receipt.v128", packageId, ownerReceizId: imported.ownerReceizId, unpackedAppendId: imported.unpackAppendId, unpackedHead: unpackEvent.head, unpackedSealKai: unpackEvent.sealKai } : undefined;
      return { row, package: actual.package, source: refreshed.detail.value.source as ReceizPortableSealedArtifactV124, proof: actual.proof, availableMembers, ...(refreshed.detail.continuation ? { continuation: refreshed.detail.continuation } : {}), ...(unpackReceipt ? { unpackReceipt } : {}) };
    }); },
  };
}
