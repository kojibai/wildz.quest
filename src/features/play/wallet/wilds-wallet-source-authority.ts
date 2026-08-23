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

export function projectWildsWalletFromIdentityAccount(
  account: ReceizIdentityAccountProjection
): WildsWalletReadResponse | null {
  if (!account.portableStateVerified || account.authority !== "verified-identity-portable-state" || !account.domains.wallet) return null;
  const snapshot = record(account.verifiedState);
  const wallet = record(snapshot?.wallet);
  const balancePhiMicro = wallet?.balancePhiMicro ?? snapshot?.balancePhiMicro;
  if (typeof balancePhiMicro !== "string") return null;
  const summary = projectWildsWalletSummary({
    ok: true,
    balancePhiMicro,
    balanceUsdCents: wallet?.balanceUsdCents ?? snapshot?.balanceUsdCents,
    transferableResourceCount: wallet?.transferableResourceCount,
    transferableCardCount: wallet?.transferableCardCount,
    reservedCardCount: wallet?.reservedCardCount,
    pendingCount: wallet?.pendingCount
  });
  const events = firstArray(snapshot?.walletLedgerEntries, wallet?.ledgerEntries, wallet?.events) ?? [];
  let ledger = null;
  try {
    ledger = projectWildsWalletLedgerPage({ ok: true, cursor: null, nextCursor: null, events }, account.owner.username ?? account.owner.uid);
  } catch {
    // A verified balance remains usable even when an older portable ledger shape
    // cannot be projected by this release. Global additions may fill it later.
  }
  return Object.freeze({ summary, capabilities: projectWildsWalletCapabilities(), ledger });
}
