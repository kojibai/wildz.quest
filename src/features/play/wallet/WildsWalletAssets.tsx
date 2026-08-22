import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";

export function WildsWalletAssets({ state }: { state: WildsWalletControllerState }) {
  return <section aria-labelledby="wilds-wallet-assets-title" className="wilds-wallet-surface">
    <header><small>ADMITTED CUSTODY</small><h2 id="wilds-wallet-assets-title">Assets</h2></header>
    {state.summary ? <dl className="wilds-wallet-asset-register">
      <div><dt>Phi total</dt><dd>Φ {formatWildsPhiExact(state.summary.admittedPhiMicro)}</dd><small>Availability is verified from the active wallet authority.</small></div>
      <div><dt>Resources</dt><dd>{state.summary.transferableResourceCount ?? "Not admitted"}</dd><small>Canonical transfer rail unavailable until exact resource projections are admitted.</small></div>
      <div><dt>Creature cards</dt><dd>{state.summary.transferableCardCount ?? "Not admitted"}</dd><small>{state.summary.reservedCardCount === null ? "Reservation state not admitted." : `${state.summary.reservedCardCount} reserved or non-transferable.`}</small></div>
    </dl> : <p>No private asset projection is available.</p>}
  </section>;
}
