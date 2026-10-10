import { canonicalPortableCardJson } from "../portable-card";
import { createWildsWalletStagedTradePlan, wildsWalletStagedTradeApprovalChallenge, type WildsWalletStagedTradeApproval, type WildsWalletStagedTradeBinding, type WildsWalletStagedTradeLegOutcome, type WildsWalletStagedTradePlan } from "./wilds-wallet-staged-trade-types";

export type WildsWalletStagedTradeCheckpoint = Readonly<{ legId: string; status: "ready" | "pending" | "offered" | "accepted" | "committed" | "failed"; receipt?: unknown; projectionPending?: true }>;
export type WildsWalletStagedTradeRecoveryEntry = Readonly<{ plan: WildsWalletStagedTradePlan; approvals: readonly WildsWalletStagedTradeApproval[]; legs: readonly WildsWalletStagedTradeCheckpoint[] }>;
export type WildsWalletStagedTradeRecovery = Readonly<{ schema: "wildz.wallet.staged-trade-recovery.v1"; binding: WildsWalletStagedTradeBinding; trades: readonly WildsWalletStagedTradeRecoveryEntry[] }>;
export type WildsWalletStagedTradeRecoveryStore = Readonly<{
  load(owner: string): unknown;
  write(owner: string, value: WildsWalletStagedTradeRecovery): void;
  /** Shared exclusive lock across controllers/tabs; held through durable checkpoint and native dispatch. */
  withLock<T>(owner: string, action: () => Promise<T>): Promise<T>;
}>;
const MAX_BYTES = 2_000_000;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const fields = (value: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(key => key in value) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
export const wildsWalletStagedTradeStorageError = () => Error("Saved staged trade recovery is unavailable. No new trade leg was started.");

export function admitWildsWalletStagedTradeApproval(value: unknown, plan: WildsWalletStagedTradePlan): WildsWalletStagedTradeApproval {
  if (!object(value) || !fields(value, ["schema", "tradeId", "approvalId", "ownerHandle", "keyId", "identityArtifactDigest", "sourceHeads", "evidence"]) || value.schema !== "wildz.wallet.staged-trade-approval.v1" || value.tradeId !== plan.tradeId) throw Error("This approval does not match the exact staged trade.");
  const approval = value as unknown as WildsWalletStagedTradeApproval;
  if (wildsWalletStagedTradeApprovalChallenge(plan, approval).approvalId !== approval.approvalId) throw Error("This approval does not match the exact staged trade.");
  return Object.freeze(structuredClone(approval));
}

/** Browser checkpoints coordinate retries. Saved consents and receipts still require fresh SDK admission. */
export function admitWildsWalletStagedTradeRecovery(value: unknown, binding: WildsWalletStagedTradeBinding): WildsWalletStagedTradeRecovery {
  if (value === null || value === undefined) return Object.freeze({ schema: "wildz.wallet.staged-trade-recovery.v1", binding: Object.freeze({ ...binding }), trades: Object.freeze([]) });
  if (!object(value) || !fields(value, ["schema", "binding", "trades"]) || value.schema !== "wildz.wallet.staged-trade-recovery.v1" || canonicalPortableCardJson(value.binding) !== canonicalPortableCardJson(binding) || !Array.isArray(value.trades) || value.trades.length > 32 || JSON.stringify(value).length > MAX_BYTES) throw wildsWalletStagedTradeStorageError();
  const seen = new Set<string>();
  const trades = value.trades.map(raw => {
    if (!object(raw) || !fields(raw, ["plan", "approvals", "legs"]) || !object(raw.plan) || !Array.isArray(raw.approvals) || raw.approvals.length > 2 || !Array.isArray(raw.legs)) throw wildsWalletStagedTradeStorageError();
    const plan = createWildsWalletStagedTradePlan(raw.plan.agreement as WildsWalletStagedTradePlan["agreement"]);
    if (canonicalPortableCardJson(plan) !== canonicalPortableCardJson(raw.plan) || seen.has(plan.tradeId) || ![plan.agreement.first.senderHandle, plan.agreement.second.senderHandle].includes(binding.ownerHandle) || raw.legs.length !== plan.legs.length) throw wildsWalletStagedTradeStorageError();
    seen.add(plan.tradeId);
    const approvals = raw.approvals.map(approval => admitWildsWalletStagedTradeApproval(approval, plan));
    if (new Set(approvals.map(approval => approval.ownerHandle)).size !== approvals.length) throw wildsWalletStagedTradeStorageError();
    const local = approvals.find(approval => approval.ownerHandle === binding.ownerHandle);
    if (local && (local.keyId !== binding.keyId || local.identityArtifactDigest !== binding.identityArtifactDigest)) throw wildsWalletStagedTradeStorageError();
    let incomplete = false;
    const legs = raw.legs.map((checkpoint, index) => {
      if (!object(checkpoint) || !fields(checkpoint, ["legId", "status"], ["receipt", "projectionPending"]) || checkpoint.legId !== plan.legs[index]!.legId || !["ready", "pending", "offered", "accepted", "committed", "failed"].includes(String(checkpoint.status)) || checkpoint.projectionPending !== undefined && (checkpoint.projectionPending !== true || checkpoint.status !== "accepted")) throw wildsWalletStagedTradeStorageError();
      const complete = checkpoint.status === "accepted" || checkpoint.status === "committed";
      if (complete && (checkpoint.receipt === undefined || (checkpoint.status === "accepted" ? plan.legs[index]!.kind !== "asset" : plan.legs[index]!.kind !== "phi")) || incomplete && checkpoint.status !== "ready" || approvals.length !== 2 && checkpoint.status !== "ready") throw wildsWalletStagedTradeStorageError();
      if (!complete) incomplete = true;
      return Object.freeze(structuredClone(checkpoint)) as WildsWalletStagedTradeCheckpoint;
    });
    return Object.freeze({ plan, approvals: Object.freeze(approvals), legs: Object.freeze(legs) });
  });
  return Object.freeze({ schema: "wildz.wallet.staged-trade-recovery.v1", binding: Object.freeze({ ...binding }), trades: Object.freeze(trades) });
}

const key = (owner: string) => `wildz:wallet:staged-trade:v1:${encodeURIComponent(owner)}`;
export const wildsWalletBrowserStagedTradeRecoveryStore: WildsWalletStagedTradeRecoveryStore = {
  load(owner) {
    try {
      if (typeof window === "undefined") throw wildsWalletStagedTradeStorageError();
      const raw = window.localStorage.getItem(key(owner));
      if (raw === null) return null;
      if (raw.length > MAX_BYTES) throw wildsWalletStagedTradeStorageError();
      return JSON.parse(raw);
    } catch { throw wildsWalletStagedTradeStorageError(); }
  },
  write(owner, value) {
    try {
      admitWildsWalletStagedTradeRecovery(value, value.binding);
      if (value.binding.ownerHandle !== owner) throw wildsWalletStagedTradeStorageError();
      const raw = JSON.stringify(value);
      window.localStorage.setItem(key(owner), raw);
      if (window.localStorage.getItem(key(owner)) !== raw) throw wildsWalletStagedTradeStorageError();
    } catch { throw wildsWalletStagedTradeStorageError(); }
  },
  async withLock(owner, action) {
    if (typeof navigator === "undefined" || !navigator.locks) throw wildsWalletStagedTradeStorageError();
    return navigator.locks.request(key(owner), action);
  }
};

export function assertWildsWalletStagedTradeLegOutcome(value: unknown): asserts value is WildsWalletStagedTradeLegOutcome {
  if (!object(value) || !fields(value, ["status"], ["receipt", "message", "projectionPending"]) || !["none", "offered", "accepted", "committed", "pending", "failed"].includes(String(value.status)) || value.message !== undefined && (typeof value.message !== "string" || value.message.length > 1000) || ["accepted", "committed"].includes(String(value.status)) && value.receipt === undefined || value.projectionPending !== undefined && (value.projectionPending !== true || value.status !== "accepted")) throw Error("The original trade leg has no verified outcome.");
}
