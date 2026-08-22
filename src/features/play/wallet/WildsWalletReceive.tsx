import type { WildsWalletControllerState } from "./wilds-wallet-controller";

export function WildsWalletReceive({ state, onRequestReceive }: { state: WildsWalletControllerState; onRequestReceive(): void }) {
  const canReceive = state.status === "verified" && state.capabilities?.receive === "available";
  return <section aria-labelledby="wilds-wallet-receive-title" className="wilds-wallet-surface">
    <header><small>PUBLIC PLAYER COORDINATE</small><h2 id="wilds-wallet-receive-title">Receive</h2></header>
    <div className="wilds-wallet-coordinate"><span>@{state.identityKey}</span><small>Safe to share as your public Wildz username.</small></div>
    {state.receiveLocator ? <output className="wilds-wallet-locator" aria-label="Exact public receive locator">{state.receiveLocator}</output> : <p>A request is a proposal only. It never moves or reserves value.</p>}
    <button disabled={!canReceive || state.receiveRequestId !== null} onClick={onRequestReceive} type="button">{state.receiveRequestId === null ? "Create receive coordinate" : "Preparing coordinate…"}</button>
  </section>;
}
