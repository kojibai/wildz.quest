"use client";

import { digestReceizCanonicalV122, type ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import type { WildzContinuityDatabase } from "../../../lib/storage/wildz-indexed-db";
import type { openWildsResourcePackageExchangeBrowserV128 } from "../../../lib/receiz/wilds-resource-exchange-browser-v128";
import type { WildsResourceSourceProofV128, WildsResourceSourceReceiptV128 } from "../../../lib/receiz/wilds-resource-exchange-v128";
import { canonicalPortableCardJson } from "../portable-card";
import type { WildsResourcePackageV1 } from "../wilds-resource-package";
import { admitWildsWalletBearerOriginal } from "./wilds-wallet-bearer-gift-proof";
import { verifyWildsWalletBearerGiftAuthority } from "./wilds-wallet-bearer-gift-authority";
import { admitWildsWalletResourceSourceMessageV128, admitWildsWalletResourceSourceReceiptV128, type WildsWalletResourceSourceLegV128, type WildsWalletResourceSourceMessageV128, type WildsWalletResourceSourcePrivateMessageV128, type WildsWalletResourceSourceReceiptV128 } from "./wilds-wallet-resource-source-messaging-v128";
import type { WildsWalletStagedTradeAssetAuthority, WildsWalletStagedTradeAssetPort, WildsWalletStagedTradeLegOutcome, WildsWalletStagedTradeResourceSourceHead, WildsWalletStagedTradeSourceHead } from "./wilds-wallet-staged-trade-types";

export type WildsResourceExchangeBrowserRuntimeV128 = Awaited<ReturnType<typeof openWildsResourcePackageExchangeBrowserV128>>;
export type WildsWalletResourceUnpackReceiptV128 = Readonly<{ schema: "wildz.resource-unpack-receipt.v128"; packageId: string; ownerReceizId: string; unpackedAppendId: string; unpackedHead: string; unpackedSealKai: string }>;
export type WildsWalletResourceProjectionV128 = Readonly<{
  kind: "reserved" | "received" | "unpacked" | "sent";
  leg: WildsWalletResourceSourceLegV128; package: WildsResourcePackageV1;
  proof: WildsResourceSourceProofV128; source: ReceizPortableSealedArtifactV124;
  receipt?: WildsWalletResourceSourceReceiptV128; unpackReceipt?: WildsWalletResourceUnpackReceiptV128;
  continuation?: Readonly<{descriptor:WildsWalletStagedTradeResourceSourceHead;authority:WildsWalletStagedTradeAssetAuthority}>;
}>;
export type WildsWalletResourceSourceAssetPortInputV128 = Readonly<{
  keyId: string; ownerHandle: string;
  currentIdentity(): Readonly<{ keyId: string; ownerHandle: string }>;
  openRuntime(): Promise<WildsResourceExchangeBrowserRuntimeV128>;
  readMessages(): Promise<readonly WildsWalletResourceSourcePrivateMessageV128[]>;
  /** True means the actual private Receiz publication was accepted. */
  publish(context: WildsWalletResourceSourceMessageV128, peer: string): Promise<boolean>;
  flushGameplay(): Promise<void>;
  readKai(): number;
  /** An idempotent local projection only; this callback grants no native title. */
  onProjection(value: WildsWalletResourceProjectionV128): Promise<void>;
}>;
export type WildsWalletResourceSourcePortDependenciesV128 = Readonly<{
  database(): Promise<WildzContinuityDatabase>;
  withLock<T>(name: string, action: () => Promise<T>): Promise<T>;
  verifyAuthority: typeof verifyWildsWalletBearerGiftAuthority;
}>;
const defaults: WildsWalletResourceSourcePortDependenciesV128 = {
  async database() { return (await import("../../../lib/receiz/wildz-active-identity")).defaultContinuityDatabase; },
  async withLock(name, action) {
    if (!globalThis.navigator?.locks) throw Error("This browser cannot safely lock the resource package. Use a browser with Web Locks.");
    return navigator.locks.request(name, action);
  },
  verifyAuthority: verifyWildsWalletBearerGiftAuthority,
};
type Checkpoint = Readonly<{
  schema: "wildz.wallet.resource-source-attempt.v128"; ownerHandle: string; keyId: string;
  leg: WildsWalletResourceSourceLegV128; createdKaiUPulse: number;
  phase: "preparing" | "prepared" | "submitted" | "delivered" | "accepted" | "unpacking" | "unpacked";
  source?: ReceizPortableSealedArtifactV124; descriptor?: WildsWalletStagedTradeResourceSourceHead;
  projected: readonly WildsWalletResourceProjectionV128["kind"][];
}>;
const same = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
const message = (cause: unknown) => cause instanceof Error ? cause.message : "The same resource source is still pending.";
const tradeId = (leg: WildsWalletResourceSourceLegV128) => leg.legId.slice(0, leg.legId.lastIndexOf(":"));
function resource(leg: WildsWalletResourceSourceLegV128, descriptor?: WildsWalletStagedTradeSourceHead): asserts descriptor is WildsWalletStagedTradeResourceSourceHead {
  if (leg.request.asset.kind === "creature" || leg.request.attemptId !== leg.attemptId || leg.attemptId !== leg.legId || leg.request.recipientHandle !== leg.recipientHandle
    || descriptor && (!("protocol" in descriptor) || descriptor.protocol !== "wildz.resource-source.v128" || descriptor.legId !== leg.legId || descriptor.ownerHandle !== leg.senderHandle)) throw Error("The exact selected resource source stage is required.");
  if (descriptor) {
    const asset = leg.request.asset;
    if (asset.kind === "package" ? asset.packageId !== descriptor.packageId
      : !same([...asset.foodItemIds, ...asset.materialLotIds, ...asset.resourceLotIds].sort(), descriptor.memberIds)) throw Error("The source belongs to different selected resource members.");
  }
}

/** Construction is cheap. Exact command replay, native device grants, source
 * seals/CAS and private publication run only on explicit wallet operations. */
export function createWildsWalletResourceSourceAssetPortV128(input: WildsWalletResourceSourceAssetPortInputV128, dependencies: WildsWalletResourceSourcePortDependenciesV128 = defaults): WildsWalletStagedTradeAssetPort & Readonly<{
  acceptSource(leg: WildsWalletResourceSourceLegV128, descriptor: WildsWalletStagedTradeSourceHead, authority: WildsWalletStagedTradeAssetAuthority): Promise<WildsWalletStagedTradeLegOutcome>;
  unpackReceivedPackage(leg: WildsWalletResourceSourceLegV128, descriptor: WildsWalletStagedTradeSourceHead, authority: WildsWalletStagedTradeAssetAuthority): Promise<WildsWalletStagedTradeLegOutcome>;
  unpackHeldPackage(packageId:string):Promise<WildsWalletStagedTradeLegOutcome>;
}> {
  let runtime: Promise<WildsResourceExchangeBrowserRuntimeV128> | undefined;
  let openedRuntime: WildsResourceExchangeBrowserRuntimeV128 | undefined;
  const current = () => { const actual = input.currentIdentity(); if (actual.keyId !== input.keyId || actual.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed. Reopen the exact resource offer."); };
  const open = () => {
    current();
    if(openedRuntime&&openedRuntime.session.expiresAtKaiUPulse<=input.readKai()){runtime=undefined;openedRuntime=undefined;}
    if (!runtime) {
      const opening = input.openRuntime().then(value => { current(); if (value.keyId !== input.keyId || value.ownerReceizId !== input.ownerHandle) throw Error("The source session belongs to another Explorer."); openedRuntime=value;return value; });
      runtime = opening; void opening.catch(() => { if (runtime === opening) runtime = undefined; });
    }
    return runtime;
  };
  const locked = <T>(leg: WildsWalletResourceSourceLegV128, action: () => Promise<T>) => dependencies.withLock(`wildz:resource-source:${input.ownerHandle}:${input.keyId}:${leg.legId}`, action);
  const key = (leg: WildsWalletResourceSourceLegV128) => JSON.stringify(["wildz.wallet.resource-source-attempt.v128", input.ownerHandle, input.keyId, leg.legId]);
  const read = async (leg: WildsWalletResourceSourceLegV128) => {
    const value = await (await dependencies.database()).read<Checkpoint>("meta", key(leg)); current();
    if (value && (value.schema !== "wildz.wallet.resource-source-attempt.v128" || value.ownerHandle !== input.ownerHandle || value.keyId !== input.keyId || !same(value.leg, leg))) throw Error("The saved resource attempt belongs to different exact members or recipient.");
    return value;
  };
  const save = async (value: Checkpoint) => {
    current(); const database = await dependencies.database();
    const encoded = canonicalPortableCardJson(value); if (new TextEncoder().encode(encoded).length > 2_000_000) throw Error("The exact durable resource checkpoint is too large.");
    await database.transaction(["meta"], "readwrite", tx => tx.put("meta", JSON.parse(encoded), key(value.leg))); current();
    if (!same(await read(value.leg), value)) throw Error("The exact resource attempt could not be durably retained. No new source action was started.");
  };
  const initial = (leg: WildsWalletResourceSourceLegV128): Checkpoint => ({ schema: "wildz.wallet.resource-source-attempt.v128", ownerHandle: input.ownerHandle, keyId: input.keyId, leg: structuredClone(leg), createdKaiUPulse: input.readKai(), phase: "preparing", projected: [] });
  const project = async (checkpoint: Checkpoint, value: WildsWalletResourceProjectionV128) => {
    if (checkpoint.projected.includes(value.kind)) return checkpoint;
    await input.onProjection(value); current();
    const next = { ...checkpoint, projected: [...checkpoint.projected, value.kind] }; await save(next); return next;
  };
  const sourceFor = async (leg: WildsWalletResourceSourceLegV128, descriptor: WildsWalletStagedTradeResourceSourceHead) => {
    const checkpoint = await read(leg);
    if (checkpoint?.source) {
      const original = admitWildsWalletBearerOriginal(checkpoint.source);
      if (original.artifactSha256 !== descriptor.sourceArtifactSha256 || original.payloadSha256 !== descriptor.sourcePayloadSha256 || checkpoint.descriptor && !same(checkpoint.descriptor, descriptor)) throw Error("The saved resource Original changed after approval.");
      return original;
    }
    for (const candidate of await input.readMessages()) {
      current(); let context: WildsWalletResourceSourceMessageV128;
      try { context = admitWildsWalletResourceSourceMessageV128(candidate.context, candidate.senderHandle, candidate.recipientHandle, leg); } catch { continue; }
      if (context.kind !== "trade-resource-source" || context.original.artifactSha256 !== descriptor.sourceArtifactSha256 || context.original.payloadSha256 !== descriptor.sourcePayloadSha256) continue;
      const runtime = await open(); await runtime.exchange.verifyOffer(context.original, descriptor); current();
      await save({ ...(checkpoint ?? initial(leg)), source: context.original, descriptor, phase: "prepared" });
      return context.original;
    }
    throw Error("The sender has not privately delivered this exact resource Original yet.");
  };
  const authorize = async (leg: WildsWalletResourceSourceLegV128, descriptor: WildsWalletStagedTradeResourceSourceHead, authority: WildsWalletStagedTradeAssetAuthority) => {
    const barrier = await dependencies.verifyAuthority(leg, descriptor, authority); current();
    return { barrier, digest: await digestReceizCanonicalV122({ schema: "wildz.resource-stage-authorization.v128", leg, descriptor, authority }) };
  };
  const thin = (leg: WildsWalletResourceSourceLegV128, actual: WildsResourceSourceReceiptV128): WildsWalletResourceSourceReceiptV128 => admitWildsWalletResourceSourceReceiptV128({
    schema: "wildz.wallet.resource-source-receipt.v128", legId: leg.legId, packageId: actual.packageId,
    sourceArtifactSha256: actual.sourceArtifactSha256, sourcePayloadSha256: actual.sourcePayloadSha256,
    acceptedAppendId: actual.acceptedAppendId, acceptedHead: actual.acceptedHead, acceptedSealKai: actual.acceptedSealKai,
    ownerReceizId: actual.ownerReceizId, authorizationDigest: actual.authorizationDigest,
  });
  const observe = async (leg: WildsWalletResourceSourceLegV128, descriptor: WildsWalletStagedTradeResourceSourceHead, authority: WildsWalletStagedTradeAssetAuthority, locator?: unknown) => {
    const authorization = await authorize(leg, descriptor, authority), runtime = await open();
    const outcome = await runtime.exchange.observe(descriptor.packageId, descriptor); current();
    if (outcome.status !== "accepted") { if (locator !== undefined) throw Error("The supplied receipt is not admitted by the current resource source."); return { outcome, authorization }; }
    const receipt = thin(leg, outcome.receipt);
    if (receipt.ownerReceizId !== leg.recipientHandle || receipt.authorizationDigest !== authorization.digest || BigInt(receipt.acceptedSealKai) <= BigInt(authorization.barrier)) throw Error("The actual resource acceptance does not follow both exact approved device signatures.");
    if (locator !== undefined && !same(admitWildsWalletResourceSourceReceiptV128(locator), receipt)) throw Error("The receipt locator does not match the actual source addition.");
    return { outcome, authorization, receipt };
  };
  const finishAccepted = async (leg: WildsWalletResourceSourceLegV128, descriptor: WildsWalletStagedTradeResourceSourceHead, authority: WildsWalletStagedTradeAssetAuthority) => {
    const verified = await observe(leg, descriptor, authority); if (!verified.receipt || verified.outcome.status !== "accepted") throw Error("The exact package acceptance is not admitted yet.");
    const original = await sourceFor(leg, descriptor);
    if(leg.recipientHandle===input.ownerHandle){const runtime=await open();await runtime.database.transaction(["artifacts"],"readwrite",tx=>tx.put("artifacts",{schema:"wildz.resource-package-original.v128",packageId:descriptor.packageId,source:original,leg,descriptor,authority},JSON.stringify(["wildz.resource-package-original.v128",input.ownerHandle,descriptor.packageId])));current();}
    let saved = (await read(leg))!;
    saved = { ...saved, phase: saved.phase === "unpacked" ? "unpacked" : "accepted" }; await save(saved);
    const kind = leg.senderHandle === input.ownerHandle ? "sent" : "received";
    // An already unpacked/reoffered package must not resurrect as a received
    // available package merely because its immutable earlier claim still exists.
    if (kind === "sent" || verified.outcome.record.status === "claimed" && verified.outcome.record.ownerReceizId === input.ownerHandle) saved = await project(saved, { kind, leg, package: verified.outcome.package, proof: verified.outcome.proof, source: original, receipt: verified.receipt,continuation:{descriptor,authority} });
    if (leg.recipientHandle === input.ownerHandle) {
      const context: WildsWalletResourceSourceMessageV128 = { kind: "trade-resource-accepted", tradeId: authority.plan.tradeId, legId: leg.legId, receipt: verified.receipt };
      if (await input.publish(context, leg.senderHandle) !== true) return { status: "pending" as const, receipt: verified.receipt, message: "Package received. Check the same offer to finish private receipt delivery." };
      current();
    }
    return { status: "accepted" as const, receipt: verified.receipt, message: "Package received. Keep it for sending again, or unpack its contents." };
  };
  return {
    prepareSource: leg => locked(leg, async () => {
      current(); resource(leg); if (leg.senderHandle !== input.ownerHandle) throw Error("Only the sender can prepare this resource source.");
      let saved = await read(leg); if (!saved) { saved = initial(leg); await save(saved); }
      const runtime = await open();
      if (saved.source && saved.descriptor) { const verified=await runtime.exchange.verifyOffer(saved.source, saved.descriptor); current(); await project(saved,{kind:'reserved',leg,package:verified.bearer.package,proof:verified.proof,source:saved.source});return saved.descriptor; }
      await input.flushGameplay(); current();
      const asset = leg.request.asset;
      let prepared: Awaited<ReturnType<typeof runtime.exchange.prepare>>;
      if (asset.kind === "inventory") prepared = await runtime.exchange.prepare({ attemptId: leg.attemptId, memberIds: [...asset.foodItemIds, ...asset.materialLotIds, ...asset.resourceLotIds].sort(), recipientHandle: leg.recipientHandle, createdKaiUPulse: saved.createdKaiUPulse });
      else if (asset.kind === "package") {
        const held = await runtime.database.read<{ source: ReceizPortableSealedArtifactV124 }>("artifacts", JSON.stringify(["wildz.resource-package-original.v128", input.ownerHandle, asset.packageId]));
        if (!held?.source) throw Error("The exact received package Original is unavailable. Reopen its private source message.");
        prepared = await runtime.exchange.reoffer({ attemptId: leg.attemptId, packageId: asset.packageId, recipientHandle: leg.recipientHandle.replace(/\.receiz\.id$/, ""), source: admitWildsWalletBearerOriginal(held.source) });
      } else throw Error("Choose exact resources for this source path.");
      current(); const source = admitWildsWalletBearerOriginal(prepared.source), descriptor = await runtime.exchange.describeOffer(source, leg.legId); resource(leg, descriptor);
      admitWildsWalletResourceSourceMessageV128({ kind: "trade-resource-source", tradeId: tradeId(leg), legId: leg.legId, original: source }, leg.senderHandle, leg.recipientHandle, leg);
      saved = { ...saved, source, descriptor, phase: "prepared" }; await save(saved);
      await project(saved, { kind: "reserved", leg, package: prepared.package, proof: prepared.sourceProof, source });
      return descriptor;
    }),
    async sendSource(leg, descriptor, authority) {
      try { return await locked(leg, async () => {
        current(); resource(leg, descriptor); if (leg.senderHandle !== input.ownerHandle) throw Error("Only the approved sender can deliver this package.");
        await authorize(leg, descriptor, authority); const source = await sourceFor(leg, descriptor), runtime = await open();
        await runtime.exchange.verifyOffer(source, descriptor); current(); const saved = (await read(leg))!; await save({ ...saved, phase: "submitted" });
        const context: WildsWalletResourceSourceMessageV128 = { kind: "trade-resource-source", tradeId: authority.plan.tradeId, legId: leg.legId, original: source };
        if (await input.publish(context, leg.recipientHandle) !== true) return { status: "pending" as const, retryable: true, message: "Private delivery is pending. Retry the same saved resource package." };
        current(); await save({ ...saved, phase: "delivered" }); return { status: "sent" as const, message: "Package sent · awaiting recipient acceptance." };
      }); } catch (cause) { return { status: "pending", retryable: true, message: message(cause) }; }
    },
    async observeSource(leg, descriptor, locator, authority) {
      try {
        current(); resource(leg, descriptor); const result = await observe(leg, descriptor, authority, locator);
        if (result.receipt) return finishAccepted(leg, descriptor, authority);
        if (leg.senderHandle === input.ownerHandle) { const saved = await read(leg); if (!saved || saved.phase === "prepared" || saved.phase === "preparing") return { status: "none" }; }
        else await sourceFor(leg, descriptor);
        return { status: "offered", message: "Waiting for the recipient to accept the exact package." };
      } catch (cause) { return { status: "pending", message: message(cause) }; }
    },
    async verifyAccepted(leg, descriptor, outcome, authority) {
      current(); resource(leg, descriptor); if (outcome.status !== "accepted") throw Error("An actual accepted resource source receipt is required.");
      admitWildsWalletResourceSourceReceiptV128(outcome.receipt); await observe(leg, descriptor, authority, outcome.receipt);
    },
    async acceptSource(leg, descriptor, authority) {
      try { return await locked(leg, async () => {
        current(); resource(leg, descriptor); if (leg.recipientHandle !== input.ownerHandle) throw Error("Only the exact approved recipient can accept this package.");
        const existing = await observe(leg, descriptor, authority); if (existing.receipt) return finishAccepted(leg, descriptor, authority);
        if (BigInt(Math.floor(input.readKai() / 1_000_000)) <= BigInt(existing.authorization.barrier)) throw Error("The exact approvals are witnessed. Check this same package after the next Kai pulse to accept it.");
        const original = await sourceFor(leg, descriptor);
    if(leg.recipientHandle===input.ownerHandle){const runtime=await open();await runtime.database.transaction(["artifacts"],"readwrite",tx=>tx.put("artifacts",{schema:"wildz.resource-package-original.v128",packageId:descriptor.packageId,source:original,leg,descriptor,authority},JSON.stringify(["wildz.resource-package-original.v128",input.ownerHandle,descriptor.packageId])));current();}
    let saved = (await read(leg))!; saved = { ...saved, phase: "submitted" }; await save(saved);
        const runtime = await open(); await runtime.exchange.accept({ attemptId: `${leg.attemptId}:accept`, source: original, expectedDescriptor: descriptor, authorizationDigest: existing.authorization.digest }); current();
        await runtime.database.transaction(["artifacts"], "readwrite", tx => tx.put("artifacts", { schema: "wildz.resource-package-original.v128", packageId: descriptor.packageId, source: original }, JSON.stringify(["wildz.resource-package-original.v128", input.ownerHandle, descriptor.packageId])));
        return finishAccepted(leg, descriptor, authority);
      }); } catch (cause) { return { status: "pending", message: message(cause) }; }
    },
    async unpackHeldPackage(packageId){
      try{const runtime=await open(),held=await runtime.database.read<{leg:WildsWalletResourceSourceLegV128;descriptor:WildsWalletStagedTradeResourceSourceHead;authority:WildsWalletStagedTradeAssetAuthority}>("artifacts",JSON.stringify(["wildz.resource-package-original.v128",input.ownerHandle,packageId]));current();
       if(!held||held.descriptor?.packageId!==packageId||held.leg?.recipientHandle!==input.ownerHandle)throw Error("The exact saved package approval is unavailable. Reopen its accepted private offer.");
       return this.unpackReceivedPackage(held.leg,held.descriptor,held.authority);
      }catch(cause){return {status:"pending",message:message(cause)};}
    },
    async unpackReceivedPackage(leg, descriptor, authority) {
      try { return await locked(leg, async () => {
        current(); resource(leg, descriptor); if (leg.recipientHandle !== input.ownerHandle) throw Error("Only the accepted package keeper can unpack its contents.");
        const verified = await observe(leg, descriptor, authority); if (!verified.receipt) throw Error("Accept this exact package before unpacking it.");
        const source = await sourceFor(leg, descriptor); let saved = (await read(leg))!;
        const refreshContents=saved.phase === "unpacked" && saved.projected.includes("unpacked");
        saved = { ...saved, phase: "unpacking" }; await save(saved);
        const runtime = await open(), unpacked = await runtime.exchange.unpack({ attemptId: `${leg.attemptId}:unpack`, packageId: descriptor.packageId, source }); current();
        const projection={ kind: "unpacked" as const, leg, package: unpacked.package, proof: unpacked.proof, source, receipt: verified.receipt, unpackReceipt: unpacked.receipt,continuation:{descriptor,authority} };
        if(refreshContents){await input.onProjection(projection);current();}else saved = await project(saved,projection);
        await save({ ...saved, phase: "unpacked" }); return { status: "accepted", receipt: verified.receipt, message: refreshContents?"Package contents refreshed from their current source.":"Package unpacked. Its exact food, materials and Living Honey are available." };
      }); } catch (cause) { return { status: "pending", message: message(cause) }; }
    },
  };
}
