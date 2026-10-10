import type { WildsWalletTradeAgreement } from "./wilds-wallet-trade";
import { canonicalPortableCardJson } from "../portable-card";
import { createWildsWalletStagedTradePlan, wildsWalletStagedTradeApprovalChallenge, type WildsWalletStagedTradePlan, type WildsWalletStagedTradeApproval, type WildsWalletStagedTradePorts, type WildsWalletStagedTradeResult, type WildsWalletStagedTradeBinding, type WildsWalletStagedTradeLegOutcome } from "./wilds-wallet-staged-trade-types";
import { admitWildsWalletStagedTradeApproval, admitWildsWalletStagedTradeRecovery, assertWildsWalletStagedTradeLegOutcome, wildsWalletStagedTradeStorageError, type WildsWalletStagedTradeRecovery, type WildsWalletStagedTradeRecoveryEntry, type WildsWalletStagedTradeRecoveryStore } from "./wilds-wallet-staged-trade-recovery";

const equal = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
const failed = (cause: unknown): WildsWalletStagedTradeResult => ({ status: "failed", message: cause instanceof Error ? cause.message : "Reopen the saved staged trade before continuing." });

/** Finite saved consents authorize only these individual native operations, never an atomic exchange. */
export function createWildsWalletStagedTradeController({ recoveryStore: store }: { recoveryStore: WildsWalletStagedTradeRecoveryStore }) {
  const assertBinding = (binding: WildsWalletStagedTradeBinding, ports: WildsWalletStagedTradePorts) => { if (!equal(binding, ports.currentBinding())) throw Error("The verified Explorer identity changed. No next trade leg was started."); };
  const save = (record: WildsWalletStagedTradeRecovery) => {
    store.write(record.binding.ownerHandle, record);
    const read = admitWildsWalletStagedTradeRecovery(store.load(record.binding.ownerHandle), record.binding);
    if (!equal(record, read)) throw wildsWalletStagedTradeStorageError();
  };
  const replace = (record: WildsWalletStagedTradeRecovery, entry: WildsWalletStagedTradeRecoveryEntry) => {
    const index = record.trades.findIndex(trade => trade.plan.tradeId === entry.plan.tradeId);
    const trades = [...record.trades];
    if (index < 0) trades.push(entry); else trades[index] = entry;
    const next = admitWildsWalletStagedTradeRecovery({ ...record, trades }, record.binding);
    save(next);
    return next;
  };
  const checkedApproval = async (raw: WildsWalletStagedTradeApproval, plan: WildsWalletStagedTradePlan, ports: WildsWalletStagedTradePorts) => {
    const approval = admitWildsWalletStagedTradeApproval(raw, plan);
    const binding = await ports.verifyApproval(approval, wildsWalletStagedTradeApprovalChallenge(plan, approval));
    if (binding.ownerHandle !== approval.ownerHandle || binding.keyId !== approval.keyId || binding.identityArtifactDigest !== approval.identityArtifactDigest) throw Error("The approval's admitted identity does not match this trade.");
    return approval;
  };
  const checkedEntry = async (entry: WildsWalletStagedTradeRecoveryEntry, ports: WildsWalletStagedTradePorts) => {
    for (const approval of entry.approvals) await checkedApproval(approval, entry.plan, ports);
  };
  const emptyEntry = (plan: WildsWalletStagedTradePlan): WildsWalletStagedTradeRecoveryEntry => ({ plan, approvals: [], legs: plan.legs.map(leg => ({ legId: leg.legId, status: "ready" })) });
  const locked = async (ports: WildsWalletStagedTradePorts, action: (binding: WildsWalletStagedTradeBinding, record: WildsWalletStagedTradeRecovery) => Promise<WildsWalletStagedTradeResult>) => {
    try {
      const binding = Object.freeze({ ...ports.currentBinding() });
      return await store.withLock(binding.ownerHandle, async () => {
        assertBinding(binding, ports);
        return action(binding, admitWildsWalletStagedTradeRecovery(store.load(binding.ownerHandle), binding));
      });
    } catch (cause) { return failed(cause); }
  };
  const waiting = (tradeId: string): WildsWalletStagedTradeResult => ({ status: "awaiting-peer", tradeId, message: "Both Explorers must approve this exact staged agreement. Each delivery settles separately." });
  const advance = async (tradeId: string, ports: WildsWalletStagedTradePorts, acceptLegId?: string): Promise<WildsWalletStagedTradeResult> => {
    return locked(ports, async (binding, record) => {
      let entry = record.trades.find(trade => trade.plan.tradeId === tradeId);
      if (!entry) throw Error("The exact staged trade is not saved on this device.");
      await checkedEntry(entry, ports);
      assertBinding(binding, ports);
      if (entry.approvals.length !== 2) return waiting(tradeId);
      if (acceptLegId && !entry.plan.legs.some(leg => leg.legId === acceptLegId && leg.kind === "asset" && leg.recipientHandle === binding.ownerHandle)) throw Error("Only the exact recipient can accept this approved asset stage.");
      const checkpoint = (index: number, outcome: WildsWalletStagedTradeLegOutcome) => {
        const legs = [...entry!.legs];
        legs[index] = { legId: legs[index]!.legId, status: outcome.status === "none" ? "ready" : outcome.status, ...(outcome.receipt === undefined ? {} : { receipt: structuredClone(outcome.receipt) }), ...(outcome.projectionPending === true ? { projectionPending: true } : {}) };
        entry = { ...entry!, legs };
        record = replace(record, entry);
      };
      for (let index = 0; index < entry.plan.legs.length; index++) {
        const leg = entry.plan.legs[index]!, saved = entry.legs[index]!;
        assertBinding(binding, ports);
        let outcome: WildsWalletStagedTradeLegOutcome;
        try {
          if (saved.status === "accepted" || saved.status === "committed") {
            if (saved.projectionPending === true && leg.kind === "asset" && leg.recipientHandle === binding.ownerHandle) {
              outcome = await ports.observeLeg(leg);
              if (outcome.status !== "accepted") return { status: "pending", tradeId, legId: leg.legId, assetRecoveryRequired: true, message: "The accepted delivery is saved. Refresh the same received asset and its proof." };
            } else outcome = { status: saved.status, receipt: saved.receipt };
          } else outcome = await ports.observeLeg(leg);
          assertWildsWalletStagedTradeLegOutcome(outcome);
          if (outcome.status === "accepted" || outcome.status === "committed") {
            if (outcome.status !== (leg.kind === "asset" ? "accepted" : "committed")) throw Error("The receipt belongs to a different kind of trade leg.");
            await ports.verifyLegReceipt(leg, outcome);
            assertBinding(binding, ports);
            checkpoint(index, outcome);
            if (leg.senderHandle === binding.ownerHandle || leg.kind === "asset" && leg.recipientHandle === binding.ownerHandle) {
              try { await ports.publish({ kind: "trade-staged-progress", tradeId, legId: leg.legId, outcome }); }
              catch { return { status: "pending", tradeId, legId: leg.legId, message: "This native receipt is saved. Retry its private delivery so your peer can independently check the same settled leg." }; }
            }
            if (acceptLegId === leg.legId) acceptLegId = undefined;
            continue;
          }
        } catch {
          return { status: "pending", tradeId, legId: leg.legId, message: "This original trade leg could not be verified. Resolve its original receipt before continuing." };
        }
        assertBinding(binding, ports);
        // Preparation may already reserve an offered source under its actual
        // custody law. The durable ready checkpoint still precedes private
        // delivery, which is dispatched once using those same approved bytes.
        if (!acceptLegId && leg.kind === "asset" && leg.senderHandle === binding.ownerHandle && saved.status === "ready" && outcome.status === "offered") outcome = { status: "none" };
        if (outcome.status === "failed" || saved.status === "failed") return { status: "failed", tradeId, legId: leg.legId, message: "This staged leg did not settle. Earlier accepted deliveries remain completed; review the remaining exchange together." };
        if (acceptLegId) {
          if (leg.legId !== acceptLegId) throw Error("Verify the earlier staged delivery before accepting this asset.");
          if (leg.kind !== "asset" || leg.recipientHandle !== binding.ownerHandle || !ports.acceptAsset) throw Error("Acceptance is unavailable for this exact asset stage.");
          if (outcome.status !== "offered" && !(outcome.status === "pending" && saved.status === "pending")) throw Error("The sender must deliver the exact approved source before you can accept it.");
          checkpoint(index, { status: "pending" });
          assertBinding(binding, ports);
          try {
            outcome = await ports.acceptAsset(leg);
            assertBinding(binding, ports);
            assertWildsWalletStagedTradeLegOutcome(outcome);
            if (!["accepted", "pending", "failed"].includes(outcome.status)) throw Error("An actual accepted asset receipt is required.");
            if (outcome.status === "accepted") await ports.verifyLegReceipt(leg, outcome);
            assertBinding(binding, ports);
            checkpoint(index, outcome);
            if (outcome.status === "accepted") {
              try { await ports.publish({ kind: "trade-staged-progress", tradeId, legId: leg.legId, outcome }); }
              catch { return { status: "pending", tradeId, legId: leg.legId, message: "The accepted receipt is saved. Check the same stage to deliver it to your peer." }; }
              acceptLegId = undefined;
              continue;
            }
            return { status: outcome.status === "failed" ? "failed" : "pending", tradeId, legId: leg.legId, message: outcome.message ?? "Check the same approved source to recover its acceptance." };
          } catch {
            return { status: "pending", tradeId, legId: leg.legId, message: "The original acceptance is uncertain. Check or accept this same source; no replacement is authorized." };
          }
        }
        if (outcome.status === "offered" || saved.status === "offered") {
          if (saved.status !== "offered") checkpoint(index, { status: "offered" });
          return { status: "awaiting-acceptance", tradeId, legId: leg.legId, message: "The one-use asset offer was delivered. Waiting for verified recipient acceptance before the next stage." };
        }
        if (outcome.status === "pending" || saved.status === "pending") return { status: "pending", tradeId, legId: leg.legId, message: "Checking this same staged leg. No replacement send will be issued." };
        if (leg.senderHandle !== binding.ownerHandle) return { status: "awaiting-peer", tradeId, legId: leg.legId, message: "Waiting for the other Explorer's next staged delivery." };
        // The ambiguous checkpoint is durable BEFORE touching either existing native send path.
        checkpoint(index, { status: "pending" });
        assertBinding(binding, ports);
        try {
          if (leg.kind === "asset") {
            const result = await ports.sendAsset(leg);
            outcome = { status: result.status === "sent" ? "offered" : result.status === "failed" ? "failed" : "pending" };
          } else {
            outcome = await ports.sendPhi(leg);
            assertWildsWalletStagedTradeLegOutcome(outcome);
            if (outcome.status === "committed") await ports.verifyLegReceipt(leg, outcome);
            else if (!["pending", "failed"].includes(outcome.status)) throw Error("No native Phi settlement was verified.");
          }
          checkpoint(index, outcome);
          try { await ports.publish({ kind: "trade-staged-progress", tradeId, legId: leg.legId, outcome }); }
          catch { return { status: "pending", tradeId, legId: leg.legId, message: "The original leg is saved. Retry its private receipt delivery; no replacement send will be issued." }; }
        } catch {
          return { status: "pending", tradeId, legId: leg.legId, message: "The send response is uncertain. Only the original saved leg will be checked." };
        }
        if (outcome.status === "committed") continue;
        return { status: outcome.status === "offered" ? "awaiting-acceptance" : outcome.status === "failed" ? "failed" : "pending", tradeId, legId: leg.legId, message: outcome.status === "offered" ? "The asset offer is awaiting recipient acceptance; this staged trade is not complete." : outcome.status === "failed" ? "This staged leg did not settle. Earlier accepted deliveries remain completed." : "Checking the original staged leg before continuing." };
      }
      const assetRecoveryRequired = entry.legs.some(saved => saved.projectionPending === true);
      return { status: "completed", tradeId, ...(assetRecoveryRequired ? { assetRecoveryRequired: true } : {}), message: assetRecoveryRequired ? "Every delivery is verified. Refresh the saved received asset to finish adding it to your wallet." : "Every staged delivery has a verified acceptance or settlement receipt. The exchange is complete." };
    });
  };
  return {
    async approve(agreement: WildsWalletTradeAgreement, ports: WildsWalletStagedTradePorts): Promise<WildsWalletStagedTradeResult> {
      return locked(ports, async (binding, record) => {
        const plan = createWildsWalletStagedTradePlan(agreement);
        let entry = record.trades.find(trade => trade.plan.tradeId === plan.tradeId) ?? emptyEntry(plan);
        await checkedEntry(entry, ports);
        assertBinding(binding, ports);
        // Save the exact review before opening any identity consent interaction.
        record = replace(record, entry);
        let approval = entry.approvals.find(value => value.ownerHandle === binding.ownerHandle);
        if (!approval) {
          const sourceHeads = await ports.readApprovalSources(plan, binding);
          assertBinding(binding, ports);
          const challenge = wildsWalletStagedTradeApprovalChallenge(plan, { ...binding, sourceHeads });
          approval = await checkedApproval(await ports.signApproval({ plan, binding, challenge }), plan, ports);
          assertBinding(binding, ports);
          if (approval.ownerHandle !== binding.ownerHandle || approval.keyId !== binding.keyId || approval.identityArtifactDigest !== binding.identityArtifactDigest) throw Error("Only this Explorer can approve their trade package.");
          entry = { ...entry, approvals: [...entry.approvals, approval] };
          replace(record, entry);
        }
        assertBinding(binding, ports);
        try { await ports.publish({ kind: "trade-staged-approval", plan, approval }); }
        catch { return { status: "pending", tradeId: plan.tradeId, message: "Your exact approval is saved. Retry its private delivery; no trade leg has started." }; }
        return waiting(plan.tradeId);
      });
    },
    async receiveApproval(input: WildsWalletStagedTradePlan, raw: WildsWalletStagedTradeApproval, ports: WildsWalletStagedTradePorts): Promise<WildsWalletStagedTradeResult> {
      return locked(ports, async (binding, record) => {
        const plan = createWildsWalletStagedTradePlan(input.agreement);
        if (!equal(plan, input)) throw Error("This approval does not match the exact staged trade.");
        if (![plan.agreement.first.senderHandle, plan.agreement.second.senderHandle].includes(binding.ownerHandle)) throw Error("This trade belongs to other Explorers.");
        const approval = await checkedApproval(raw, plan, ports);
        assertBinding(binding, ports);
        const entry = record.trades.find(trade => trade.plan.tradeId === plan.tradeId) ?? emptyEntry(plan);
        await checkedEntry(entry, ports);
        assertBinding(binding, ports);
        const existing = entry.approvals.find(value => value.ownerHandle === approval.ownerHandle);
        if (existing && (existing.approvalId !== approval.approvalId || existing.keyId !== approval.keyId || existing.identityArtifactDigest !== approval.identityArtifactDigest)) throw Error("This Explorer already approved a different identity or proof. Review a new agreement.");
        if (!existing) replace(record, { ...entry, approvals: [...entry.approvals, approval] });
        return waiting(plan.tradeId);
      });
    },
    advance,
    acceptIncomingAsset: (tradeId: string, legId: string, ports: WildsWalletStagedTradePorts) => advance(tradeId, ports, legId),
  };
}
