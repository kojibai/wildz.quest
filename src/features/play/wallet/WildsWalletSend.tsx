"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact, parseWildsPhiInput } from "./wilds-wallet-format";

const HOLD_MILLISECONDS = 900;

export type WildsWalletSendActions = Readonly<{
  onLookupRecipient(username: string): void;
  onSelectRecipient(username: string): void;
  onReviewAmount(rail: "settlement" | "reserve", amountPhiMicro: string, operationNonce: string): void;
  onStage(): void;
  onAuthorizationPointerStart(pointerId: number): void;
  onAuthorizationPointerCancel(pointerId: number): void;
  onAuthorize?: (pointerId: number) => void;
  onRecover(): void;
  onResetTransfer(): void;
}>;

function unavailableReason(state: WildsWalletControllerState) {
  if (state.status === "offline-verified") return "Sending is disabled while wallet truth is offline.";
  if (state.status !== "verified") return "Secure and verify this wallet before sending.";
  if (!state.capabilities?.send.available) return "Send authority is unavailable. No value can move from this deployment.";
  return null;
}

export function WildsWalletSend({ state, ...actions }: { state: WildsWalletControllerState } & WildsWalletSendActions) {
  const [username, setUsername] = useState(state.transfer.recipientUsername ?? "");
  const [amount, setAmount] = useState("");
  const holdRef = useRef<{ pointerId: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const onAuthorizationPointerCancel = actions.onAuthorizationPointerCancel;
  const unavailable = unavailableReason(state);
  const transfer = state.transfer;
  const cancelHold = useCallback((pointerId?: number) => {
    const hold = holdRef.current;
    if (!hold || (pointerId !== undefined && hold.pointerId !== pointerId)) return;
    clearTimeout(hold.timer);
    holdRef.current = null;
    onAuthorizationPointerCancel(hold.pointerId);
  }, [onAuthorizationPointerCancel]);
  useEffect(() => {
    const cancel = () => cancelHold();
    const visibility = () => { if (document.visibilityState !== "visible") cancel(); };
    window.addEventListener("blur", cancel);
    window.addEventListener("orientationchange", cancel);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancel();
      window.removeEventListener("blur", cancel);
      window.removeEventListener("orientationchange", cancel);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [cancelHold]);
  const startHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!actions.onAuthorize || transfer.phase !== "authorize") return;
    cancelHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    actions.onAuthorizationPointerStart(event.pointerId);
    const pointerId = event.pointerId;
    holdRef.current = { pointerId, timer: setTimeout(() => {
      holdRef.current = null;
      actions.onAuthorize?.(pointerId);
    }, HOLD_MILLISECONDS) };
  };
  if (transfer.phase === "unknown") return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>EXACT ATTEMPT RETAINED</small><h2 id="wilds-wallet-send-title">Recovery pending</h2></header><p>The outcome is ambiguous. Wildz will not create or send another transfer.</p><button disabled={transfer.requestId !== null} onClick={actions.onRecover} type="button">Check exact outcome</button></section>;
  if (transfer.phase === "zero-write") return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>ZERO-WRITE REJECTION</small><h2 id="wilds-wallet-send-title">Nothing moved</h2></header><p>The authoritative rail rejected this attempt. Balance, assets, and ownership remain unchanged.</p><button onClick={actions.onResetTransfer} type="button">Start again</button></section>;
  if (transfer.phase === "committed") return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>VERIFIED FINALITY</small><h2 id="wilds-wallet-send-title">Transfer committed</h2></header><p role="status">The exact transfer is admitted. No browser-held authority is retained.</p><button onClick={actions.onResetTransfer} type="button">Done</button></section>;
  if (unavailable) return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>TRANSFER AUTHORITY</small><h2 id="wilds-wallet-send-title">Send</h2></header><p className="wilds-wallet-state-strip is-locked" role="status">{unavailable}</p><p>You can still inspect verified holdings and receive coordinates. Wildz never simulates settlement.</p></section>;

  return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface">
    <header><small>PROOF-BOUND TRANSFER</small><h2 id="wilds-wallet-send-title">Send</h2></header>
    {transfer.phase === "recipient" ? <form onSubmit={(event) => { event.preventDefault(); actions.onLookupRecipient(username); }}>
      <label htmlFor="wilds-wallet-recipient">Exact username</label><input autoComplete="off" id="wilds-wallet-recipient" maxLength={64} onChange={(event) => setUsername(event.target.value)} spellCheck={false} value={username} />
      <button disabled={!username.trim() || state.recipient.status === "loading"} type="submit">Verify recipient</button>
      {state.recipient.status === "unavailable" ? <p role="status">Recipient verification is unavailable until distributed lookup protection is active.</p> : null}
      {state.recipient.status === "verified" && state.recipient.projection ? <button onClick={() => actions.onSelectRecipient(state.recipient.projection!.username)} type="button">Continue with @{state.recipient.projection.username}</button> : null}
    </form> : null}
    {transfer.phase === "amount" ? <form onSubmit={(event) => { event.preventDefault(); const micro = parseWildsPhiInput(amount); if (micro) actions.onReviewAmount("settlement", micro, crypto.randomUUID()); }}>
      <p className="wilds-wallet-counterparty">TO <b>@{transfer.recipientUsername}</b></p>
      <label htmlFor="wilds-wallet-amount">Phi amount</label><input id="wilds-wallet-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} />
      <button disabled={!parseWildsPhiInput(amount)} type="submit">Review exact amount</button>
    </form> : null}
    {transfer.phase === "review" || transfer.phase === "stage" ? <div className="wilds-wallet-review">
      <p><span>Recipient</span><b>@{transfer.recipientUsername}</b></p><p><span>Exact amount</span><b>{transfer.amountPhiMicro ? formatWildsPhiExact(transfer.amountPhiMicro) : "—"} Φ</b></p><p><span>Rail</span><b>{transfer.rail}</b></p>
      <button disabled={transfer.phase === "stage"} onClick={actions.onStage} type="button">{transfer.phase === "stage" ? "Staging exact transfer…" : "Stage for authorization"}</button>
    </div> : null}
    {transfer.phase === "authorize" || transfer.phase === "authorize-pending" ? <div className="wilds-wallet-authorize">
      <p><span>Final amount</span><b>{transfer.amountPhiMicro ? formatWildsPhiExact(transfer.amountPhiMicro) : "—"} Φ</b></p>
      <button
        disabled={!actions.onAuthorize || transfer.phase === "authorize-pending"}
        onLostPointerCapture={(event) => cancelHold(event.pointerId)}
        onPointerCancel={(event) => cancelHold(event.pointerId)}
        onPointerDown={startHold}
        onPointerLeave={(event) => cancelHold(event.pointerId)}
        onPointerUp={(event) => cancelHold(event.pointerId)}
        type="button"
      >{actions.onAuthorize ? (transfer.phase === "authorize-pending" ? "Authorization in progress…" : "Hold to authorize exact transfer") : "Proof authorization unavailable"}</button>
      <small>Releasing or leaving this control cancels authorization.</small>
    </div> : null}
  </section>;
}
