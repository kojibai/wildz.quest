import type { WildsWalletPresentationState } from "./wilds-wallet-controller";
import { formatWildsPhiExact, formatWildsUsdCents } from "./wilds-wallet-format";

export function WildsWalletOverview({ state, onNavigate, onRefresh }: { state: WildsWalletPresentationState; onNavigate(page: "send" | "receive"): void; onRefresh(): void }) {
  if (state.status === "loading" && !state.summary) return <div className="wilds-wallet-message" role="status"><b>Verifying reserve</b><span>Reading admitted wallet state…</span></div>;
  if ((state.status === "source-verified" || state.status === "authority-required") && state.edgeAuthorityVerified && !state.summary) return <section aria-labelledby="wilds-wallet-edge-title" className="wilds-wallet-edge-status" role="status">
    <header><small>SOURCE AUTHORITY</small><h2 id="wilds-wallet-edge-title">Receiz ID active</h2><p>Your proof object is the authority. Wildz is discovering its admitted source URLs for later additions; that projection cannot demote, replace, or lock your identity.</p></header>
    <dl>
      <div><dt>Receiz ID authority</dt><dd data-state="verified">Active</dd></div>
      <div><dt>Source holdings</dt><dd data-state="verified">Preserved</dd></div>
      <div><dt>Global additions</dt><dd data-state="waiting">Discovering URLs</dd></div>
    </dl>
    <button onClick={onRefresh} type="button">Resolve admitted sources</button>
  </section>;
  if (state.status === "authority-required") return <div className="wilds-wallet-message" role="status"><b>Authorization required</b><span>Your world remains preserved while wallet access is secured.</span></div>;
  if (state.status === "revoked" || state.status === "failed" || !state.summary) return <div className="wilds-wallet-message is-danger" role="alert"><b>Wallet unavailable</b><span>No private value is displayed.</span></div>;
  const summary = state.summary;
  return <section aria-labelledby="wilds-wallet-overview-title" className="wilds-wallet-overview">
    <header className="wilds-wallet-balance-band">
      <span><small id="wilds-wallet-overview-title">ADMITTED PHI</small><strong><i>Φ</i> {formatWildsPhiExact(summary.admittedPhiMicro)}</strong></span>
      {summary.displayUsdCents === null ? null : <span className="wilds-wallet-display-quote"><small>VERIFIED DISPLAY BASIS</small><b>{formatWildsUsdCents(summary.displayUsdCents)}</b></span>}
    </header>
    {state.status === "source-verified" ? <p className="wilds-wallet-state-strip is-source" role="status">Source verified · displaying exact holdings carried by this Receiz ID while global additions resolve.</p> : null}
    {state.status === "offline-verified" ? <p className="wilds-wallet-state-strip is-offline" role="status">Offline verified · sending is disabled until authority reconnects.</p> : null}
    {summary.pendingCount ? <p className="wilds-wallet-state-strip is-pending" role="status">{summary.pendingCount} exact transfer {summary.pendingCount === 1 ? "attempt requires" : "attempts require"} recovery.</p> : null}
    <dl className="wilds-wallet-holdings-band">
      <div><dt>Resources</dt><dd>{summary.assetCountsStatus === "available" ? summary.transferableResourceCount : "Not admitted"}</dd></div>
      <div><dt>Creature cards</dt><dd>{summary.assetCountsStatus === "available" ? summary.transferableCardCount : "Not admitted"}</dd></div>
      <div><dt>Reserved cards</dt><dd>{summary.assetCountsStatus === "available" ? summary.reservedCardCount : "Not admitted"}</dd></div>
    </dl>
    <div className="wilds-wallet-primary-actions"><button onClick={() => onNavigate("send")} type="button">Send</button><button onClick={() => onNavigate("receive")} type="button">Receive</button></div>
    <section aria-labelledby="wilds-wallet-latest-title" className="wilds-wallet-latest"><h3 id="wilds-wallet-latest-title">Latest verified ledger</h3>{state.ledger?.entries.slice(0, 3).length ? state.ledger.entries.slice(0, 3).map((entry, index) => <p key={`${entry.createdAt}-${index}`}><span>{entry.direction}</span><b>{entry.amountPhiMicro ? `Φ ${formatWildsPhiExact(entry.amountPhiMicro)}` : entry.state}</b></p>) : <p>No admitted entries yet.</p>}</section>
  </section>;
}
