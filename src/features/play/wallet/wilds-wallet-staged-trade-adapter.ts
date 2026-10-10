"use client";

import type { ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import { canonicalPortableCardJson } from "../portable-card";
import type { WildsConversation } from "../wilds-messenger-core";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import type { WildsWalletAssetSend } from "./wilds-wallet-asset-send";
import type { WildsWalletTradeAgreement } from "./wilds-wallet-trade";
import { createWildsWalletStagedTradeController } from "./wilds-wallet-staged-trade-controller";
import { createWildsWalletConnectPhiPort } from "./wilds-wallet-connect-phi-port";
import { admitWildsWalletStagedTradeRecovery, wildsWalletBrowserStagedTradeRecoveryStore, type WildsWalletStagedTradeRecoveryStore } from "./wilds-wallet-staged-trade-recovery";
import { prepareWildsWalletStagedTradeIdentity, verifyWildsWalletStagedTradeIdentityApproval } from "./wilds-wallet-staged-trade-identity";
import { admitWildsWalletStagedTradeSourceHeads, createWildsWalletStagedTradePlan, type WildsWalletStagedTradeBinding, type WildsWalletStagedTradeLeg, type WildsWalletStagedTradeMessage, type WildsWalletStagedTradePlan, type WildsWalletStagedTradePorts, type WildsWalletStagedTradeResult, type WildsWalletStagedTradeSourceHead, type WildsWalletStagedTradeAssetPort, type WildsWalletStagedTradeIncomingAsset } from "./wilds-wallet-staged-trade-types";
import { admitWildsWalletStagedTradeMessage } from "./wilds-wallet-staged-trade-messaging";
import { admitWildsWalletStagedTradeSourceNotice } from "./wilds-wallet-staged-trade-source-notice";
import {wildsWalletBrowserStagedTradeArchiveStore,type WildsWalletStagedTradeArchiveStore} from "./wilds-wallet-staged-trade-archive";
export { admitWildsWalletStagedTradeMessage } from "./wilds-wallet-staged-trade-messaging";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const equal = (a: unknown, b: unknown) => canonicalPortableCardJson(a) === canonicalPortableCardJson(b);

function messages(conversations: readonly WildsConversation[]) {
  return conversations.flatMap(conversation => conversation.messages).filter(message => !message.deletedAt && !message.editedAt);
}

export type WildsWalletStagedTradeAdapterInput = Readonly<{
  keyId: string; ownerHandle: string;
  currentIdentity(): Readonly<{ keyId: string; ownerHandle: string }>;
  sendWalletAsset: WildsWalletAssetSend;
  assetPort: WildsWalletStagedTradeAssetPort;
  readConversations(): Promise<readonly WildsConversation[]>;
  publish(message: WildsWalletStagedTradeMessage, peerHandle: string): Promise<void>;
  ensureReady?(): Promise<boolean | void>;
  loadIdentityOriginal?(): Promise<ReceizPortableSealedArtifactV124>;
  recoveryStore?: WildsWalletStagedTradeRecoveryStore;
  archiveStore?:WildsWalletStagedTradeArchiveStore;
  phi?: ReturnType<typeof createWildsWalletConnectPhiPort>;
  fetcher?: typeof fetch;
  /** Trusted market service gate; omitted for ordinary wallet Trade/Gift.
   * A market agreement must never inherit the generic Phi sender. */
  marketExecution?: Readonly<{ assert(plan: WildsWalletStagedTradePlan, phase: "approve" | "observe" | "send-phi" | "send-asset" | "accept-asset"): Promise<void> }>;
}>;

/** Released SDK adapter. Construction is cheap; identity sources, enrollment,
 * signatures and native requests run only after an explicit approval/resume. */
export function createWildsWalletStagedTradeAdapter(input: WildsWalletStagedTradeAdapterInput) {
  const store = input.recoveryStore ?? wildsWalletBrowserStagedTradeRecoveryStore;
  const controller = createWildsWalletStagedTradeController({ recoveryStore: store, archiveStore:input.archiveStore??(store===wildsWalletBrowserStagedTradeRecoveryStore?wildsWalletBrowserStagedTradeArchiveStore:undefined) });
  const phi = input.phi ?? createWildsWalletConnectPhiPort({ keyId: input.keyId, ownerHandle: input.ownerHandle, currentBinding: input.currentIdentity, ensureReady: input.ensureReady });
  let identity: Awaited<ReturnType<typeof prepareWildsWalletStagedTradeIdentity>> | null = null;
  let preparing: Promise<void> | null = null;
  const assertCurrent = () => {
    const current = input.currentIdentity();
    if (current.keyId !== input.keyId || current.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed. Reopen the exact staged trade.");
  };
  const assertMarket = async (plan: WildsWalletStagedTradePlan, phase: "approve" | "observe" | "send-phi" | "send-asset" | "accept-asset") => {
    if (plan.agreement.purpose !== "market") return;
    if (!input.marketExecution) throw Error("Open this exact purchase in the marketplace. Generic wallet Trade cannot authorize a marketplace payment or delivery.");
    await input.marketExecution.assert(plan, phase); assertCurrent();
  };
  const currentBinding = (): WildsWalletStagedTradeBinding => { assertCurrent(); if (!identity) throw Error("Review this staged trade with the held Identity Seal first."); return identity.binding; };
  const ensureIdentity = async () => {
    assertCurrent();
    if (identity) return;
    if (!preparing) preparing = (async () => {
      if (input.ensureReady && await input.ensureReady() === false) throw Error("Reconnect your Explorer before approving this trade.");
      assertCurrent();
      const prepared = await prepareWildsWalletStagedTradeIdentity({ keyId: input.keyId, ownerHandle: input.ownerHandle, loadOriginal: input.loadIdentityOriginal, fetcher: input.fetcher });
      assertCurrent(); identity = prepared;
    })().finally(() => { preparing = null; });
    await preparing;
  };
  const entryForLeg = (leg: WildsWalletStagedTradeLeg) => {
    const record = admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding());
    const entry = record.trades.find(entry => entry.plan.legs.some(saved => saved.legId === leg.legId && equal(saved, leg)));
    if (!entry || entry.approvals.length !== 2) throw Error("Both exact saved device approvals are required before checking this stage.");
    return entry;
  };
  const descriptorForLeg = (leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>): WildsWalletStagedTradeSourceHead => {
    const descriptor = entryForLeg(leg).approvals.find(approval => approval.ownerHandle === leg.senderHandle)?.sourceHeads.find(head => head.legId === leg.legId);
    if (!descriptor) throw Error("The exact signed native Original descriptor is required.");
    return descriptor;
  };
  const assetAuthorityForLeg = async (leg: Extract<WildsWalletStagedTradeLeg, { kind: "asset" }>) => {
    const entry = entryForLeg(leg);
    const identities = await Promise.all(entry.approvals.map(approval => verifyWildsWalletStagedTradeIdentityApproval(approval, entry.plan)));
    assertCurrent();
    const acceptedNotBeforeKai = identities.reduce((maximum, identity) => BigInt(identity.approvalKai) > maximum ? BigInt(identity.approvalKai) : maximum, 0n).toString();
    return { plan: entry.plan, approvals: entry.approvals, acceptedNotBeforeKai };
  };
  const ports: WildsWalletStagedTradePorts = {
    currentBinding,
    async readApprovalSources(plan, binding) {
      await assertMarket(plan, "approve");
      const descriptors = await Promise.all(plan.legs.filter((leg): leg is Extract<WildsWalletStagedTradeLeg, { kind: "asset" }> => leg.kind === "asset" && leg.senderHandle === binding.ownerHandle).map(leg => input.assetPort.prepareSource(leg)));
      assertCurrent();
      return admitWildsWalletStagedTradeSourceHeads(plan, binding.ownerHandle, descriptors);
    },
    signApproval: request => { assertCurrent(); if (!identity) throw Error("The held Identity Seal is required."); return identity.signApproval(request); },
    verifyApproval: async (approval, challenge) => {
      const basis = JSON.parse(challenge.exactChallenge) as { plan: WildsWalletStagedTradePlan };
      return verifyWildsWalletStagedTradeIdentityApproval(approval, basis.plan);
    },
    async sendAsset(leg) {
      assertCurrent();
      await assertMarket(entryForLeg(leg).plan, "send-asset");
      const descriptor = descriptorForLeg(leg);
      if (input.ensureReady && await input.ensureReady() === false) throw Error("Reconnect the same Explorer before sending this stage.");
      assertCurrent();
      return input.assetPort.sendSource(leg, descriptor, await assetAuthorityForLeg(leg));
    },
    async acceptAsset(leg) {
      assertCurrent();
      await assertMarket(entryForLeg(leg).plan, "accept-asset");
      if (!input.assetPort.acceptSource) throw Error("Acceptance is unavailable for this asset source.");
      if (input.ensureReady && await input.ensureReady() === false) throw Error("Reconnect the same Explorer before accepting this stage.");
      assertCurrent();
      const outcome = await input.assetPort.acceptSource(leg, descriptorForLeg(leg), await assetAuthorityForLeg(leg));
      assertCurrent();
      return { status: outcome.status, ...(outcome.receipt === undefined ? {} : { receipt: outcome.receipt }), ...(outcome.message === undefined ? {} : { message: outcome.message }), ...(outcome.projectionPending === true ? { projectionPending: true as const } : {}) };
    },
    sendPhi: async leg => { assertCurrent(); await assertMarket(entryForLeg(leg).plan, "send-phi"); return phi.sendPhi(leg); },
    async observeLeg(leg) {
      const entry = entryForLeg(leg), saved = entry.legs.find(saved => saved.legId === leg.legId);
      await assertMarket(entry.plan, "observe");
      const conversations = await input.readConversations(); assertCurrent();
      let locator = saved?.receipt;
      if (locator === undefined) for (const message of messages(conversations)) {
        const forward = sameWildzPlayerCoordinate(message.senderHandle, leg.senderHandle) && sameWildzPlayerCoordinate(message.recipientHandle, leg.recipientHandle);
        const reverse = sameWildzPlayerCoordinate(message.senderHandle, leg.recipientHandle) && sameWildzPlayerCoordinate(message.recipientHandle, leg.senderHandle);
        if (!forward && !(leg.kind === "asset" && reverse)) continue;
        const context: unknown = message.context;
        if (!object(context) || context.kind !== "trade-staged-progress" || context.tradeId !== entry.plan.tradeId || context.legId !== leg.legId || !object(context.outcome)) continue;
        // Private progress contributes only a locator. The native port must
        // independently admit the actual immutable payment or ownership proof.
        if (context.outcome.receipt !== undefined) { locator = context.outcome.receipt; break; }
      }
      return leg.kind === "phi" ? phi.observePhi(leg, locator) : input.assetPort.observeSource(leg, descriptorForLeg(leg), locator, await assetAuthorityForLeg(leg));
    },
    async verifyLegReceipt(leg, outcome) {
      if (leg.kind === "phi") return phi.verifyPhiReceipt(leg, outcome);
      return input.assetPort.verifyAccepted(leg, descriptorForLeg(leg), outcome, await assetAuthorityForLeg(leg));
    },
    async verifyLegFailure(leg,outcome){
      if(leg.kind!=="phi"||outcome.status!=="failed")throw Error("No native rejected payment was checked.");
      return phi.verifyPhiRejection(leg,outcome.receipt);
    },
    publish: message => {
      assertCurrent();
      const plan = message.kind === "trade-staged-approval" ? message.plan
        : admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding()).trades.find(entry => entry.plan.tradeId === message.tradeId)?.plan;
      if (!plan) throw Error("The saved staged agreement is required for private delivery.");
      const peer = [plan.agreement.first.senderHandle, plan.agreement.second.senderHandle].find(owner => owner !== input.ownerHandle);
      if (!peer) throw Error("The exact trade peer is required.");
      return input.publish(message, peer);
    },
  };
  const failure = (cause: unknown): WildsWalletStagedTradeResult => ({ status: "failed", message: cause instanceof Error ? cause.message : "The exact staged trade could not be opened." });
  const ingestPeerApprovals = async (plan: WildsWalletStagedTradePlan) => {
    for (const message of messages(await input.readConversations())) {
      if (!sameWildzPlayerCoordinate(message.recipientHandle, input.ownerHandle)) continue;
      try {
        const context = admitWildsWalletStagedTradeMessage(message.context, message.senderHandle, message.recipientHandle);
        if (context.kind === "trade-staged-approval" && context.plan.tradeId === plan.tradeId) {
          const result = await controller.receiveApproval(context.plan, context.approval, ports);
          if (result.status === "failed") throw Error(result.message);
        }
      } catch { /* Invalid peer transport cannot approve this plan. */ }
    }
  };
  return {
    /** Called only after explicit agreement work or a message for an active,
     * locally approved agreement. It never enrolls or signs an identity. */
    async incomingAssets(): Promise<readonly WildsWalletStagedTradeIncomingAsset[]> {
      if (!identity || !input.assetPort.acceptSource) return [];
      const entries = admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding()).trades;
      const incoming: WildsWalletStagedTradeIncomingAsset[] = [];
      for (const entry of entries) {
        if (entry.plan.agreement.purpose === "market" && !input.marketExecution) continue;
        if (entry.approvals.length !== 2 || !entry.approvals.some(approval => approval.ownerHandle === input.ownerHandle && approval.keyId === input.keyId)) continue;
        for (let index = 0; index < entry.legs.length; index++) {
          const saved = entry.legs[index]!, leg = entry.plan.legs[index]!;
          if (!saved.projectionPending || saved.status !== "accepted" || leg.kind !== "asset" || leg.recipientHandle !== input.ownerHandle) continue;
          try {
            const authority = await assetAuthorityForLeg(leg), descriptor = descriptorForLeg(leg);
            await ports.verifyLegReceipt(leg, { status: "accepted", receipt: saved.receipt });
            assertCurrent(); incoming.push(Object.freeze({ tradeId: entry.plan.tradeId, leg, descriptor, authority, status: "projection-pending" }));
          } catch { /* A repair flag cannot grant receipt authority. */ }
        }
        const index = entry.legs.findIndex(saved => saved.status !== "accepted" && saved.status !== "committed");
        if (index < 0) continue;
        const leg = entry.plan.legs[index]!;
        if (leg.kind !== "asset" || leg.recipientHandle !== input.ownerHandle || entry.legs[index]!.status === "failed") continue;
        try {
          for (let prior = 0; prior < index; prior++) {
            const saved = entry.legs[prior]!;
            await ports.verifyLegReceipt(entry.plan.legs[prior]!, { status: saved.status as "accepted" | "committed", receipt: saved.receipt });
          }
          const authority = await assetAuthorityForLeg(leg), descriptor = descriptorForLeg(leg);
          const outcome = await ports.observeLeg(leg);
          assertCurrent();
          if (outcome.status === "offered" || outcome.status === "pending" && entry.legs[index]!.status === "pending") incoming.push(Object.freeze({ tradeId: entry.plan.tradeId, leg, descriptor, authority, status: outcome.status }));
        } catch { /* Missing or invalid source evidence cannot expose Accept. */ }
      }
      return Object.freeze(incoming);
    },
    async acceptIncomingAsset(legId: string): Promise<WildsWalletStagedTradeResult> {
      try {
        // Accept cannot enroll, sign, or create an approval for a new agreement.
        const entry = admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding()).trades.find(entry => entry.plan.legs.some(leg => leg.legId === legId));
        if (!entry) throw Error("Approve this exact agreement before accepting its asset.");
        await assertMarket(entry.plan, "accept-asset");
        return controller.acceptIncomingAsset(entry.plan.tradeId, legId, ports);
      } catch (cause) { return failure(cause); }
    },
    async approve(agreement: WildsWalletTradeAgreement): Promise<WildsWalletStagedTradeResult> {
      try {
        const plan = createWildsWalletStagedTradePlan(agreement);
        await assertMarket(plan, "approve");
        await ensureIdentity();
        await ingestPeerApprovals(plan);
        const approval = await controller.approve(agreement, ports);
        if (approval.status !== "awaiting-peer") return approval;
        return controller.advance(plan.tradeId, ports);
      } catch (cause) { return failure(cause); }
    },
    async resume(agreement: WildsWalletTradeAgreement): Promise<WildsWalletStagedTradeResult> {
      try {
        const plan = createWildsWalletStagedTradePlan(agreement); await assertMarket(plan, "observe");
        await ensureIdentity(); await ingestPeerApprovals(plan);
        const entry = admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding()).trades.find(entry => entry.plan.tradeId === plan.tradeId);
        // Re-deliver only the saved approval. Check never signs a new agreement.
        if (entry?.approvals.some(approval => approval.ownerHandle === input.ownerHandle)) {
          const published = await controller.approve(agreement, ports);
          if (published.status !== "awaiting-peer") return published;
        }
        return controller.advance(plan.tradeId, ports);
      }
      catch (cause) { return failure(cause); }
    },
    /** Does not open/enroll/sign a new identity during background inbox work. */
    async receive(message: unknown, senderHandle: string): Promise<WildsWalletStagedTradeResult> {
      try {
        if (object(message) && object(message.plan) && object(message.plan.agreement) && message.plan.agreement.purpose === "market") await assertMarket(createWildsWalletStagedTradePlan(message.plan.agreement as unknown as WildsWalletTradeAgreement), "observe");
        if (!identity) return { status: "awaiting-peer", message: "Open the exact staged agreement to approve it with your Identity Seal." };
        if (object(message) && ["trade-bearer-source", "trade-bearer-accepted", "trade-resource-source", "trade-resource-accepted"].includes(String(message.kind))) {
          const entry = admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding()).trades.find(entry => entry.plan.tradeId === message.tradeId);
          if (!entry?.approvals.some(approval => approval.ownerHandle === input.ownerHandle)) return { status: "awaiting-peer", message: "Approve the exact agreement before opening its delivery." };
          admitWildsWalletStagedTradeSourceNotice(message, senderHandle, input.ownerHandle, entry.plan);
          return controller.advance(entry.plan.tradeId, ports);
        }
        const context = admitWildsWalletStagedTradeMessage(message, senderHandle, input.ownerHandle);
        const plan = context.kind === "trade-staged-approval" ? context.plan
          : admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding()).trades.find(entry => entry.plan.tradeId === context.tradeId)?.plan;
        if (!plan) return { status: "awaiting-peer", message: "Open the exact staged agreement before continuing it." };
        if (context.kind === "trade-staged-approval") {
          const result = await controller.receiveApproval(context.plan, context.approval, ports);
          if (result.status === "failed") return result;
        }
        const entry = admitWildsWalletStagedTradeRecovery(store.load(input.ownerHandle), currentBinding()).trades.find(entry => entry.plan.tradeId === plan.tradeId);
        if (!entry?.approvals.some(approval => approval.ownerHandle === input.ownerHandle)) return { status: "awaiting-peer", tradeId: plan.tradeId, message: "Approve the exact staged agreement before any of your deliveries can begin." };
        return controller.advance(plan.tradeId, ports);
      } catch (cause) { return failure(cause); }
    },
  };
}
