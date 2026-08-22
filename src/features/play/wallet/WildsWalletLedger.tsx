import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";

export function WildsWalletLedger({ state }: { state: WildsWalletControllerState }) {
  return <section aria-labelledby="wilds-wallet-ledger-title" className="wilds-wallet-surface">
    <header><small>IMMUTABLE RECEIPT REGISTER</small><h2 id="wilds-wallet-ledger-title">Ledger</h2></header>
    <div className="wilds-wallet-ledger" role="list">{state.ledger?.entries.length ? state.ledger.entries.map((entry, index) => <article key={`${entry.createdAt}-${index}`} role="listitem">
      <span className={`is-${entry.state}`} aria-hidden="true" />
      <p><b>{entry.direction === "sent" ? "Sent" : entry.direction === "received" ? "Received" : "Transfer"}</b><small>{entry.counterpartyUsername ? `@${entry.counterpartyUsername}` : "Privacy-safe counterparty"}</small></p>
      <p><strong>{entry.amountPhiMicro ? `${formatWildsPhiExact(entry.amountPhiMicro)} Φ` : "—"}</strong><small>{entry.state} · {new Date(entry.createdAt).toLocaleDateString()}</small></p>
    </article>) : <p className="wilds-wallet-empty-ledger">No admitted ledger entries.</p>}</div>
  </section>;
}
