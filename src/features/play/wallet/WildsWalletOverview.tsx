import React from "react";
import { WildsWalletLedger, type WildsWalletLedgerProps } from "./WildsWalletLedger";
import type { WildsWalletPresentationState } from "./wilds-wallet-controller";
import { formatWildsPhiExact, formatWildsUsdCents } from "./wilds-wallet-format";
import type { WildsStewardPhiAwardV1 } from "../wilds-steward-construction";
import { totalWildsStewardPhiMicro } from "./wilds-wallet-inventory";
import { PhiNetworkAmount } from "./PhiNetworkMark";

export function WildsWalletOverview({ state, stewardPhiAwards = [], inventoryCounts, ledgerProps, onNavigate }: { inventoryCounts?: { resourceUnits: number; creatureCards: number }; ledgerProps?: Omit<WildsWalletLedgerProps, "state">; state: WildsWalletPresentationState; stewardPhiAwards?: readonly WildsStewardPhiAwardV1[]; onNavigate(page: "send" | "receive" | "ledger"): void }) {
  if (["idle", "loading", "source-verified", "verified"].includes(state.status) && !state.summary) return <div className="wilds-wallet-message" role="status"><b>Verifying reserve</b><span>Reading admitted wallet state…</span></div>;
  if (state.status === "authority-required") return <div className="wilds-wallet-message" role="status"><b>Authorization required</b><span>Your world remains preserved while wallet access is secured.</span></div>;
  if (state.status === "revoked" || state.status === "failed" || !state.summary) return <div className="wilds-wallet-message is-danger" role="alert"><b>Wallet unavailable</b><span>No private value is displayed.</span></div>;
  const summary = state.summary;
  const exactBalance = formatWildsPhiExact(summary.admittedPhiMicro);
  const [whole, fraction] = exactBalance.split(".");
  const displayedBalance = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
  const earnedPhiMicro = totalWildsStewardPhiMicro(stewardPhiAwards);
  const balanceLabel = state.balanceBasis === "current" ? (state.status === "offline-verified" ? "LAST KNOWN PHI" : "AVAILABLE PHI") : state.balanceBasis === "saved" ? "PHI BALANCE" : "ADMITTED PHI";
  return <section aria-labelledby="wilds-wallet-overview-title" className="wilds-wallet-overview">
    <header className="wilds-wallet-balance-band">
      <span><small id="wilds-wallet-overview-title">{balanceLabel}</small><strong style={{ "--wallet-balance-scale": `${Math.min(9, 125 / (displayedBalance.length + 3))}cqw` } as React.CSSProperties}><PhiNetworkAmount value={displayedBalance} /></strong></span>
      {summary.displayUsdCents === null ? null : <span className="wilds-wallet-display-quote"><small>USD equivalent</small><b>{formatWildsUsdCents(summary.displayUsdCents)}</b></span>}
    </header>
    {stewardPhiAwards.length ? <p className="wilds-wallet-state-strip"><span>World earnings · <PhiNetworkAmount value={formatWildsPhiExact(earnedPhiMicro)} /></span><br />Lifetime rewards. Your available balance includes settled rewards and reflects spending.</p> : null}
    {state.status === "offline-verified" ? <p className="wilds-wallet-state-strip is-offline" role="status">Offline · showing your last verified balance.</p> : null}
    {summary.pendingCount ? <p className="wilds-wallet-state-strip is-pending" role="status">{summary.pendingCount} exact transfer {summary.pendingCount === 1 ? "attempt requires" : "attempts require"} recovery.</p> : null}
    <dl className="wilds-wallet-holdings-band">
      <div><dt>Resource units</dt><dd>{inventoryCounts?.resourceUnits.toLocaleString("en-US") ?? (summary.assetCountsStatus === "available" ? summary.transferableResourceCount : "—")}</dd></div>
      <div><dt>Creature cards</dt><dd>{inventoryCounts?.creatureCards.toLocaleString("en-US") ?? (summary.assetCountsStatus === "available" ? summary.transferableCardCount : "—")}</dd></div>
    </dl>
    <div className="wilds-wallet-primary-actions"><button onClick={() => onNavigate("send")} type="button">Send</button><button onClick={() => onNavigate("receive")} type="button">Receive</button></div>
    <WildsWalletLedger {...ledgerProps} state={state} stewardPhiAwards={stewardPhiAwards} preview onOpenLedger={() => onNavigate("ledger")} />
  </section>;
}
