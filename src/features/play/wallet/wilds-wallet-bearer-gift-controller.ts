"use client";

import type { ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import { canonicalPortableCardJson } from "../portable-card";
import { type WildsWalletStagedTradeAssetAuthority, type WildsWalletStagedTradeAssetPort, type WildsWalletStagedTradeLegOutcome, type WildsWalletStagedTradeSourceHead, type WildsWalletStagedTradeNativeSourceHead } from "./wilds-wallet-staged-trade-types";
import { verifyWildsWalletBearerGiftAuthority } from "./wilds-wallet-bearer-gift-authority";
export { verifyWildsWalletBearerGiftAuthority } from "./wilds-wallet-bearer-gift-authority";
import { admitWildsWalletBearerGiftMessage, type WildsWalletBearerGiftMessage, type WildsWalletBearerGiftPrivateMessage } from "./wilds-wallet-bearer-gift-messaging";
import { admitWildsWalletBearerOriginal, verifyWildsWalletBearerGiftAccepted, verifyWildsWalletBearerGiftSource, type WildsWalletBearerGiftLeg, type WildsWalletBearerOpenPort, type WildsWalletBearerSelectionVerifier } from "./wilds-wallet-bearer-gift-proof";
import { createWildsWalletBearerGiftRecoveryStore, type WildsWalletBearerGiftCheckpoint, type WildsWalletBearerGiftRecoveryStore, type WildsWalletBearerGiftSource } from "./wilds-wallet-bearer-gift-recovery";

export type WildsWalletBearerGiftReceipt = Readonly<{ schema: "wildz.wallet.bearer-gift-receipt.v128"; legId: string; sourceArtifactSha256: string; successorArtifactSha256: string }>;
export type WildsWalletBearerGiftReceiveResult = WildsWalletStagedTradeLegOutcome & Readonly<{ projectionPending?: boolean }>;
const same = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
function assertNativeCreature(leg: WildsWalletBearerGiftLeg, descriptor: WildsWalletStagedTradeSourceHead): asserts descriptor is WildsWalletStagedTradeNativeSourceHead {
  if (leg.request.asset.kind !== "creature" || "protocol" in descriptor) throw Error("Resource packages require their signed source-custody acceptance path.");
}

export type WildsWalletBearerGiftControllerInput = Readonly<{
  keyId: string; ownerHandle: string;
  currentIdentity(): Readonly<{ keyId: string; ownerHandle: string }>;
  /** This producer must reserve semantic birth under the actual source journal;
   * received/current native Originals must be reused, never rewrapped. */
  sourceFor(leg: WildsWalletBearerGiftLeg): Promise<WildsWalletBearerGiftSource>;
  assertSelection: WildsWalletBearerSelectionVerifier;
  /** Re-admit the exact source journal custody/full replay and member reservation. */
  verifyOrigin(leg: WildsWalletBearerGiftLeg, source: WildsWalletBearerGiftSource): Promise<void>;
  readMessages(): Promise<readonly WildsWalletBearerGiftPrivateMessage[]>;
  publish(message: WildsWalletBearerGiftMessage, recipientHandle: string): Promise<boolean>;
  /** Must idempotently import these exact verified successor bytes, by SHA. */
  restoreAccepted?(leg: WildsWalletBearerGiftLeg, original: ReceizPortableSealedArtifactV124, originProof: unknown, projectionOriginal: ReceizPortableSealedArtifactV124): Promise<void>;
  onAcceptedOutgoing?(leg: WildsWalletBearerGiftLeg, source: WildsWalletBearerGiftSource): Promise<void>;
  store?: WildsWalletBearerGiftRecoveryStore;
  artifacts?: WildsWalletBearerOpenPort;
  claim?(input: Readonly<{ leg: WildsWalletBearerGiftLeg; source: WildsWalletBearerGiftSource; authority: WildsWalletStagedTradeAssetAuthority }>): Promise<ReceizPortableSealedArtifactV124>;
  verifyAuthority?(leg: WildsWalletBearerGiftLeg, descriptor: WildsWalletStagedTradeSourceHead, authority: WildsWalletStagedTradeAssetAuthority): Promise<string>;
  withLock?<T>(name: string, action: () => Promise<T>): Promise<T>;
  fetcher?: typeof fetch;
}>;

/** Cheap construction only. No preparation, crypto, source publication, network
 * access or custody work occurs until an explicit review/Send/Accept/Check. */
export function createWildsWalletBearerGiftController(input: WildsWalletBearerGiftControllerInput): WildsWalletStagedTradeAssetPort & Readonly<{
  acceptSource(leg: WildsWalletBearerGiftLeg, descriptor: WildsWalletStagedTradeSourceHead, authority: WildsWalletStagedTradeAssetAuthority): Promise<WildsWalletBearerGiftReceiveResult>;
}> {
  const store = input.store ?? createWildsWalletBearerGiftRecoveryStore();
  const assertCurrent = () => { const current = input.currentIdentity(); if (current.keyId !== input.keyId || current.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed. Reopen this exact gift with its matching Identity Seal."); };
  const withLock = input.withLock ?? (async <T>(name: string, action: () => Promise<T>): Promise<T> => {
    if (!globalThis.navigator?.locks) throw Error("This browser cannot safely lock the native gift. Use a browser with Web Locks.");
    return navigator.locks.request(name, action);
  });
  const locked = <T>(leg: WildsWalletBearerGiftLeg, action: () => Promise<T>) => withLock(`wildz:bearer-gift:${input.ownerHandle}:${input.keyId}:${leg.legId}`, action);
  const verifyAuthority = input.verifyAuthority ?? verifyWildsWalletBearerGiftAuthority;
  const savedSource = async (sha: string, projectionSha: string) => { const source = await store.readSource(input.ownerHandle, input.keyId, sha, projectionSha); assertCurrent(); if (!source) throw Error("The exact saved native gift Original is unavailable. Reopen its private source message."); return source; };
  const checkpoint = async (leg: WildsWalletBearerGiftLeg) => {
    const saved = await store.readAttempt(input.ownerHandle, input.keyId, leg.legId); assertCurrent();
    if (saved && (saved.schema !== "wildz.wallet.bearer-gift-attempt.v128" || saved.ownerHandle !== input.ownerHandle || saved.keyId !== input.keyId || !same(saved.leg, leg))) throw Error("This saved native gift belongs to another exact attempt.");
    return saved;
  };
  const save = async (value: WildsWalletBearerGiftCheckpoint) => {
    assertCurrent(); await store.saveAttempt(value); assertCurrent();
    if (!same(await checkpoint(value.leg), value)) throw Error("The durable exact native gift checkpoint could not be confirmed.");
  };
  const retain = async (source: WildsWalletBearerGiftSource) => {
    assertCurrent(); await store.retainSource(input.ownerHandle, input.keyId, source); assertCurrent();
    if (!same(await savedSource(source.original.artifactSha256, source.projectionOriginal.artifactSha256), source)) throw Error("The exact native gift bytes could not be durably retained.");
  };
  const qualify = async (leg: WildsWalletBearerGiftLeg, source: WildsWalletBearerGiftSource) => {
    if (leg.request.asset.kind !== "creature") throw Error("Choose a creature for the native bearer gift path.");
    await input.verifyOrigin(leg, source); assertCurrent();
    const verified = await verifyWildsWalletBearerGiftSource({ leg, original: source.original, projectionOriginal: source.projectionOriginal, assertSelection: input.assertSelection, artifacts: input.artifacts }); assertCurrent();
    return verified.descriptor;
  };
  const messageSource = async (leg: WildsWalletBearerGiftLeg, descriptor: WildsWalletStagedTradeSourceHead) => {
    assertNativeCreature(leg, descriptor);
    const retained = await store.readSource(input.ownerHandle, input.keyId, descriptor.sourceArtifactSha256, descriptor.projectionArtifactSha256); assertCurrent();
    if (retained) { if (!same(await qualify(leg, retained), descriptor)) throw Error("The approved source descriptor changed."); return retained; }
    for (const message of await input.readMessages()) {
      assertCurrent();
      let context: WildsWalletBearerGiftMessage;
      try { context = admitWildsWalletBearerGiftMessage(message.context, message.senderHandle, message.recipientHandle, leg); } catch { continue; }
      if (context.kind !== "trade-bearer-source" || context.original.artifactSha256 !== descriptor.sourceArtifactSha256) continue;
      const source = { original: context.original, originProof: context.originProof, projectionOriginal: context.projectionOriginal };
      if (!same(await qualify(leg, source), descriptor)) throw Error("The delivered native gift is not the approved Original.");
      await retain(source); return source;
    }
    throw Error("The sender has not privately delivered this exact native Original yet.");
  };
  const receipt = (leg: WildsWalletBearerGiftLeg, source: WildsWalletBearerGiftSource, accepted: ReceizPortableSealedArtifactV124): WildsWalletBearerGiftReceipt => ({ schema: "wildz.wallet.bearer-gift-receipt.v128", legId: leg.legId, sourceArtifactSha256: source.original.artifactSha256, successorArtifactSha256: accepted.artifactSha256 });
  const verifyAccepted = async (leg: WildsWalletBearerGiftLeg, descriptor: WildsWalletStagedTradeSourceHead, source: WildsWalletBearerGiftSource, successor: ReceizPortableSealedArtifactV124, authority: WildsWalletStagedTradeAssetAuthority) => {
    assertNativeCreature(leg, descriptor);
    const barrier = await verifyAuthority(leg, descriptor, authority); assertCurrent();
    const result = await verifyWildsWalletBearerGiftAccepted({ leg, descriptor, predecessor: source.original, successor, projectionOriginal: source.projectionOriginal, acceptedNotBeforeKai: barrier, artifacts: input.artifacts }); assertCurrent();
    return result;
  };
  const verifyLocator = (leg: WildsWalletBearerGiftLeg, descriptor: WildsWalletStagedTradeSourceHead, value: unknown): WildsWalletBearerGiftReceipt => {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "legId,schema,sourceArtifactSha256,successorArtifactSha256") throw Error("The exact native gift receipt locator is required.");
    const candidate = value as WildsWalletBearerGiftReceipt;
    if (candidate.schema !== "wildz.wallet.bearer-gift-receipt.v128" || candidate.legId !== leg.legId || candidate.sourceArtifactSha256 !== descriptor.sourceArtifactSha256 || !/^[a-f0-9]{64}$/.test(candidate.successorArtifactSha256)) throw Error("The native gift receipt belongs to another exact stage.");
    return candidate;
  };
  const finish = async (saved: WildsWalletBearerGiftCheckpoint, source: WildsWalletBearerGiftSource, accepted: ReceizPortableSealedArtifactV124): Promise<WildsWalletBearerGiftReceiveResult> => {
    const proofReceipt = receipt(saved.leg, source, accepted);
    let projected = saved.projected, projectionPending = false;
    if (!projected && input.restoreAccepted) {
      try { await input.restoreAccepted(saved.leg, accepted, source.originProof, source.projectionOriginal); assertCurrent(); projected = true; await save({ ...saved, projected }); }
      catch { projectionPending = true; }
    }
    assertCurrent();
    const message: WildsWalletBearerGiftMessage = { kind: "trade-bearer-accepted", tradeId: saved.leg.legId.slice(0, saved.leg.legId.lastIndexOf(":")), legId: saved.leg.legId, sourceArtifactSha256: source.original.artifactSha256, original: accepted };
    try { if (await input.publish(message, saved.leg.senderHandle) !== true) throw Error("Private receipt publication was not confirmed."); assertCurrent(); }
    catch { return { status: "pending", receipt: proofReceipt, message: "The gift was accepted. Check the same gift to deliver its saved proof to the sender." }; }
    return { status: "accepted", receipt: proofReceipt, ...(projectionPending ? { projectionPending: true } : {}), message: projectionPending ? "The gift was accepted. Refresh received assets to finish importing the same Original." : "Gift received. The exact ownership successor is saved." };
  };
  const claim = input.claim ?? (async (request: Readonly<{ leg: WildsWalletBearerGiftLeg; source: WildsWalletBearerGiftSource; authority: WildsWalletStagedTradeAssetAuthority }>) => {
    const response = await (input.fetcher ?? fetch)("/api/wilds/wallet/bearer/claim", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
    const body = await response.json(); if (!response.ok) throw Error(typeof body.error === "string" ? body.error : "The native one-use claim is still pending.");
    if (!body || Object.keys(body).join(",") !== "original") throw Error("The native claim did not return its exact Original.");
    return admitWildsWalletBearerOriginal(body.original);
  });
  return {
    prepareSource: leg => locked(leg, async () => {
      assertCurrent(); if (leg.request.asset.kind !== "creature" || leg.senderHandle !== input.ownerHandle) throw Error("Only the sender can prepare this creature source.");
      const saved = await checkpoint(leg);
      if (saved) { const source = await savedSource(saved.descriptor.sourceArtifactSha256, saved.descriptor.projectionArtifactSha256); if (!same(await qualify(leg, source), saved.descriptor)) throw Error("The saved native source changed."); return saved.descriptor; }
      const source = await input.sourceFor(leg); assertCurrent(); const descriptor = await qualify(leg, source);
      await retain(source); await save({ schema: "wildz.wallet.bearer-gift-attempt.v128", ownerHandle: input.ownerHandle, keyId: input.keyId, leg, descriptor, state: "prepared", successorArtifactSha256: null, projected: false });
      return descriptor;
    }),
    async sendSource(leg, descriptor, authority) {
      try { return await locked(leg, async () => {
        assertNativeCreature(leg, descriptor);
        assertCurrent(); if (leg.senderHandle !== input.ownerHandle) throw Error("Only the approved sender can deliver this Original.");
        await verifyAuthority(leg, descriptor, authority); assertCurrent(); const saved = await checkpoint(leg);
        if (!saved || !same(saved.descriptor, descriptor)) throw Error("Review and durably save this exact Original before Send.");
        const source = await messageSource(leg, descriptor);
        await save({ ...saved, state: saved.state === "accepted" ? "accepted" : "submitted" });
        const message: WildsWalletBearerGiftMessage = { kind: "trade-bearer-source", tradeId: authority.plan.tradeId, legId: leg.legId, ...source };
        admitWildsWalletBearerGiftMessage(message, leg.senderHandle, leg.recipientHandle, leg);
        assertCurrent(); if (await input.publish(message, leg.recipientHandle) !== true) return { status: "pending" as const, message: "Private delivery is pending. Check the same gift; its Original will not be replaced.", retryable: true };
        await save({ ...saved, state: "delivered" });
        assertCurrent(); return { status: "sent" as const, message: "Original sent. Waiting for the recipient to accept this gift." };
      }); } catch (cause) { return { status: "pending", message: cause instanceof Error ? cause.message : "The exact native gift could not be delivered.", retryable: true }; }
    },
    async observeSource(leg, descriptor, locator, authority) {
      try {
        assertNativeCreature(leg, descriptor);
        assertCurrent(); const source = await messageSource(leg, descriptor);
        const tryAccepted = async (successor: ReceizPortableSealedArtifactV124) => {
          await verifyAccepted(leg, descriptor, source, successor, authority);
          const acceptedSource = { original: successor, originProof: source.originProof, projectionOriginal: source.projectionOriginal };
          await retain(acceptedSource);
          const saved = await checkpoint(leg);
          if (saved) await save({ ...saved, state: "accepted", successorArtifactSha256: successor.artifactSha256 });
          if (leg.recipientHandle === input.ownerHandle && saved) return finish({ ...saved, state: "accepted", successorArtifactSha256: successor.artifactSha256 },source,successor);
          if (leg.senderHandle === input.ownerHandle && input.onAcceptedOutgoing) { await input.onAcceptedOutgoing(leg, acceptedSource); assertCurrent(); }
          return { status: "accepted" as const, receipt: receipt(leg, source, successor) };
        };
        if (locator !== undefined) {
          const hint = verifyLocator(leg, descriptor, locator), found = await store.readSource(input.ownerHandle, input.keyId, hint.successorArtifactSha256, descriptor.projectionArtifactSha256); assertCurrent();
          if (found) return tryAccepted(found.original);
        }
        const saved = await checkpoint(leg);
        if (saved?.successorArtifactSha256) return tryAccepted((await savedSource(saved.successorArtifactSha256, descriptor.projectionArtifactSha256)).original);
        for (const message of await input.readMessages()) {
          assertCurrent(); let context: WildsWalletBearerGiftMessage;
          try { context = admitWildsWalletBearerGiftMessage(message.context, message.senderHandle, message.recipientHandle, leg); } catch { continue; }
          if (context.kind === "trade-bearer-accepted" && context.sourceArtifactSha256 === descriptor.sourceArtifactSha256) return tryAccepted(context.original);
        }
        if (leg.senderHandle === input.ownerHandle) {
          if (!saved || saved.state === "prepared") return { status: "none", message: "This exact Original is prepared for Send." };
          if (saved.state === "submitted") {
            await verifyAuthority(leg, descriptor, authority); assertCurrent();
            const message: WildsWalletBearerGiftMessage = { kind: "trade-bearer-source", tradeId: authority.plan.tradeId, legId: leg.legId, ...source };
            admitWildsWalletBearerGiftMessage(message, leg.senderHandle, leg.recipientHandle, leg);
            if (await input.publish(message, leg.recipientHandle) !== true) return { status: "pending", message: "The same private source delivery is still pending." };
            await save({ ...saved, state: "delivered" });
          }
        }
        return { status: "offered", message: "Waiting for explicit recipient acceptance of the exact Original." };
      } catch (cause) { return { status: "pending", message: cause instanceof Error ? cause.message : "The same gift proof is still pending." }; }
    },
    async verifyAccepted(leg, descriptor, outcome, authority) {
      assertNativeCreature(leg, descriptor);
      assertCurrent(); if (outcome.status !== "accepted") throw Error("An actual native accepted successor is required.");
      const hint = verifyLocator(leg, descriptor, outcome.receipt), source = await messageSource(leg, descriptor), accepted = await savedSource(hint.successorArtifactSha256, descriptor.projectionArtifactSha256);
      await verifyAccepted(leg, descriptor, source, accepted.original, authority);
    },
    async acceptSource(leg, descriptor, authority) {
      try { return await locked(leg, async () => {
        assertNativeCreature(leg, descriptor);
        assertCurrent(); if (leg.recipientHandle !== input.ownerHandle) throw Error("Only the exact reviewed recipient can accept this gift.");
        await verifyAuthority(leg, descriptor, authority); assertCurrent(); const source = await messageSource(leg, descriptor);
        let saved = await checkpoint(leg);
        if (saved && !same(saved.descriptor, descriptor)) throw Error("The saved gift Original changed.");
        if (!saved) { saved = { schema: "wildz.wallet.bearer-gift-attempt.v128", ownerHandle: input.ownerHandle, keyId: input.keyId, leg, descriptor, state: "prepared", successorArtifactSha256: null, projected: false }; await save(saved); }
        if (saved.successorArtifactSha256) {
          const accepted = (await savedSource(saved.successorArtifactSha256, descriptor.projectionArtifactSha256)).original;
          await verifyAccepted(leg, descriptor, source, accepted, authority); return finish(saved, source, accepted);
        }
        saved = { ...saved, state: "submitted" }; await save(saved);
        // An ambiguous retry reuses EXACT bytes. The released SDK's one-claim
        // coordinator resolves that same predecessor; no replacement is minted.
        assertCurrent(); const accepted = await claim({ leg, source, authority }); assertCurrent();
        await verifyAccepted(leg, descriptor, source, accepted, authority);
        await retain({ original: accepted, originProof: source.originProof, projectionOriginal: source.projectionOriginal });
        saved = { ...saved, state: "accepted", successorArtifactSha256: accepted.artifactSha256 }; await save(saved);
        return finish(saved, source, accepted);
      }); } catch (cause) { return { status: "pending", message: cause instanceof Error ? cause.message : "The same one-use native claim is pending. Check it without replacing the Original." }; }
    },
  };
}
