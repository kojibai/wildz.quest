import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";
import type { WildsStewardPhiAwardV1 } from "../wilds-steward-construction";

export function WildsWalletLedger({ state, stewardPhiAwards = [] }: {
  state: WildsWalletControllerState;
  stewardPhiAwards?: readonly WildsStewardPhiAwardV1[];
}) {
  const remoteEntries = state.ledger?.entries ?? [];
  return <section aria-labelledby="wilds-wallet-ledger-title" className="wilds-wallet-surface">
    <header><small>IMMUTABLE RECEIPT REGISTER</small><h2 id="wilds-wallet-ledger-title">Ledger</h2></header>
    <div className="wilds-wallet-ledger" role="list">{stewardPhiAwards.map((award) => <article key={award.awardId} role="listitem">
      <span className="is-committed" aria-hidden="true" />
      <p><b>Stewardship award</b><small>Source proof · {award.operationId}</small></p>
      <p><strong><PhiNetworkAmount value={formatWildsPhiExact(award.amountPhiMicro)} /></strong><small>settled at edge · {award.head.slice(0, 18)}…</small></p>
    </article>)}
    {remoteEntries.map((entry, index) => <article key={`${entry.createdAt}-${index}`} role="listitem">
      <span className={`is-${entry.state}`} aria-hidden="true" />
      <p><b>{entry.direction === "sent" ? "Sent" : entry.direction === "received" ? "Received" : "Transfer"}</b><small>{entry.counterpartyUsername ? `@${entry.counterpartyUsername}` : "Privacy-safe counterparty"}</small></p>
      <p><strong>{entry.amountPhiMicro ? <PhiNetworkAmount value={formatWildsPhiExact(entry.amountPhiMicro)} /> : "—"}</strong><small>{entry.state} · {new Date(entry.createdAt).toLocaleDateString()}</small></p>
    </article>)}
    {!stewardPhiAwards.length && !remoteEntries.length ? <p className="wilds-wallet-empty-ledger">No admitted ledger entries.</p> : null}</div>
  </section>;
}
