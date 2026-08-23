import type { ReceizIdentityAccountProjection } from "@receiz/sdk";
import {
  projectWildsWalletCapabilities,
  projectWildsWalletLedgerPage,
  projectWildsWalletSummary
} from "@/lib/receiz/wilds-wallet-projections";
import type { WildsWalletReadResponse } from "./wilds-wallet-controller";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstArray(...values: unknown[]) {
  return values.find(Array.isArray) as unknown[] | undefined;
}

function usdCentsFromExactUsd(value: unknown) {
  if (typeof value !== "string" || !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(value)) return undefined;
  const [whole, fraction = ""] = value.split(".");
  return `${whole}${fraction.padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
}

export function projectWildsWalletFromIdentityAccount(
  account: ReceizIdentityAccountProjection
): WildsWalletReadResponse | null {
  if (!account.portableStateVerified || account.authority !== "verified-identity-portable-state" || !account.domains.wallet) return null;
  const snapshot = record(account.verifiedState);
  const wallet = record(snapshot?.wallet);
  const routeSummary = record(wallet?.routeSummary);
  const walletAccount = record(wallet?.account);
  const sourceSummary = routeSummary ?? wallet;
  const balancePhiMicro = sourceSummary?.balancePhiMicro ?? walletAccount?.balance_phi_micro ?? snapshot?.balancePhiMicro;
  if (typeof balancePhiMicro !== "string") return null;
  const summary = projectWildsWalletSummary({
    ok: true,
    balancePhiMicro,
    balanceUsdCents: sourceSummary?.balanceUsdCents
      ?? usdCentsFromExactUsd(sourceSummary?.balanceUsd ?? walletAccount?.balance_usd)
      ?? snapshot?.balanceUsdCents,
    transferableResourceCount: sourceSummary?.transferableResourceCount,
    transferableCardCount: sourceSummary?.transferableCardCount,
    reservedCardCount: sourceSummary?.reservedCardCount,
    pendingCount: sourceSummary?.pendingCount
  });
  const events = firstArray(wallet?.activityEvents, wallet?.ledgerEntries, snapshot?.walletLedgerEntries, wallet?.events) ?? [];
  let ledger = null;
  try {
    ledger = projectWildsWalletLedgerPage({ ok: true, cursor: null, nextCursor: null, events }, account.owner.username ?? account.owner.uid);
  } catch {
    // An older activity shape cannot alter the exact source-carried balance.
  }
  return Object.freeze({ summary, capabilities: projectWildsWalletCapabilities(), ledger });
}
