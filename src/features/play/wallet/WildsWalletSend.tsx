"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact, parseWildsPhiInput } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";

const HOLD_MILLISECONDS = 900;
const KEYBOARD_AUTHORIZATION_GESTURE_ID = -1;

export function isWildsWalletAuthorizationHoldKey(key: string) { return key === "Enter" || key === " "; }

export function createWildsWalletAuthorizationHoldRuntime(input: Readonly<{
  onArm(id: number): void;
  onCancel(id: number): void;
  onComplete(id: number): void;
  schedule?: (operation: () => void, milliseconds: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
}>) {
  const schedule = input.schedule ?? ((operation: () => void, milliseconds: number) => setTimeout(operation, milliseconds));
  const cancelSchedule = input.cancelSchedule ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let active: Readonly<{ id: number; handle: unknown }> | null = null;
  return {
    start(id: number) {
      if (active) return false;
      input.onArm(id);
      const handle = schedule(() => {
        if (!active || active.id !== id) return;
        active = null;
        input.onComplete(id);
      }, HOLD_MILLISECONDS);
      active = { id, handle };
      return true;
    },
    cancel(id?: number) {
      if (!active || (id !== undefined && active.id !== id)) return false;
      const gesture = active;
      active = null;
      cancelSchedule(gesture.handle);
      input.onCancel(gesture.id);
      return true;
    }
  };
}

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
  if (state.status !== "verified" && state.status !== "source-verified") return "Secure and verify this wallet before sending.";
  if (!state.capabilities?.send.available) return "This session cannot sign a transfer proof object. Reopen the verified Receiz ID.";
  return null;
}

export function WildsWalletSend({ state, ...actions }: { state: WildsWalletControllerState } & WildsWalletSendActions) {
  const [username, setUsername] = useState(state.transfer.recipientUsername ?? "");
  const [amount, setAmount] = useState("");
  const onAuthorizationPointerCancel = actions.onAuthorizationPointerCancel;
  const holdCallbacksRef = useRef({ onArm: actions.onAuthorizationPointerStart, onCancel: onAuthorizationPointerCancel, onComplete: actions.onAuthorize });
  holdCallbacksRef.current = { onArm: actions.onAuthorizationPointerStart, onCancel: onAuthorizationPointerCancel, onComplete: actions.onAuthorize };
  const holdRuntimeRef = useRef<ReturnType<typeof createWildsWalletAuthorizationHoldRuntime> | null>(null);
  if (!holdRuntimeRef.current) holdRuntimeRef.current = createWildsWalletAuthorizationHoldRuntime({
    onArm: (id) => holdCallbacksRef.current.onArm(id),
    onCancel: (id) => holdCallbacksRef.current.onCancel(id),
    onComplete: (id) => holdCallbacksRef.current.onComplete?.(id)
  });
  const unavailable = unavailableReason(state);
  const transfer = state.transfer;
  const cancelHold = useCallback((pointerId?: number) => {
    holdRuntimeRef.current?.cancel(pointerId);
  }, []);
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
  const armHold = (pointerId: number) => {
    if (!actions.onAuthorize || transfer.phase !== "authorize") return;
    holdRuntimeRef.current?.start(pointerId);
  };
  const startHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!actions.onAuthorize || transfer.phase !== "authorize") return;
    cancelHold();
    event.currentTarget.setPointerCapture(event.pointerId);
    armHold(event.pointerId);
  };
  const startKeyboardHold = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!isWildsWalletAuthorizationHoldKey(event.key) || event.repeat) return;
    event.preventDefault();
    armHold(KEYBOARD_AUTHORIZATION_GESTURE_ID);
  };
  const endKeyboardHold = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!isWildsWalletAuthorizationHoldKey(event.key)) return;
    event.preventDefault();
    cancelHold(KEYBOARD_AUTHORIZATION_GESTURE_ID);
  };
  if (transfer.phase === "unknown") return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>EXACT ATTEMPT RETAINED</small><h2 id="wilds-wallet-send-title">Recovery pending</h2></header><p>The outcome is ambiguous. Wildz will not create or send another transfer.</p><button disabled={transfer.requestId !== null} onClick={actions.onRecover} type="button">Check exact outcome</button></section>;
  if (transfer.phase === "zero-write") return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>ZERO-WRITE REJECTION</small><h2 id="wilds-wallet-send-title">Nothing moved</h2></header><p>The proof-object transition was not admitted. Balance, assets, and ownership remain unchanged.</p><button onClick={actions.onResetTransfer} type="button">Start again</button></section>;
  if (transfer.phase === "committed") return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>PROOF OBJECT ISSUED</small><h2 id="wilds-wallet-send-title">Transfer ready</h2></header><p role="status">Your Receiz ID issued the exact transfer proof. Global verification and synchronization follow its source truth.</p><button onClick={actions.onResetTransfer} type="button">Done</button></section>;
  if (unavailable) return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface"><header><small>TRANSFER AUTHORITY</small><h2 id="wilds-wallet-send-title">Send</h2></header><p className="wilds-wallet-state-strip is-source" role="status">{unavailable}</p><p>You can still inspect verified holdings and receive coordinates. Wildz never simulates settlement.</p></section>;

  return <section aria-labelledby="wilds-wallet-send-title" className="wilds-wallet-surface">
    <header><small>SOURCE-ISSUED PROOF OBJECT</small><h2 id="wilds-wallet-send-title">Send</h2></header>
    {transfer.phase === "recipient" ? <form onSubmit={(event) => { event.preventDefault(); actions.onLookupRecipient(username); }}>
      <label htmlFor="wilds-wallet-recipient">Exact username</label><input autoComplete="off" id="wilds-wallet-recipient" maxLength={64} onChange={(event) => setUsername(event.target.value)} spellCheck={false} value={username} />
      <button disabled={!username.trim() || state.recipient.status === "loading"} type="submit">Continue to recipient</button>
      {state.recipient.status === "unavailable" ? <p role="status">The username will be carried by the transfer proof and resolved when claimed.</p> : null}
      {state.recipient.status === "verified" && state.recipient.projection ? <button onClick={() => actions.onSelectRecipient(state.recipient.projection!.username)} type="button">Continue with @{state.recipient.projection.username}</button> : null}
    </form> : null}
    {transfer.phase === "amount" ? <form onSubmit={(event) => { event.preventDefault(); const micro = parseWildsPhiInput(amount); if (micro) actions.onReviewAmount("settlement", micro, crypto.randomUUID()); }}>
      <p className="wilds-wallet-counterparty">TO <b>@{transfer.recipientUsername}</b></p>
      <label htmlFor="wilds-wallet-amount">Phi amount</label><input id="wilds-wallet-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} />
      <button disabled={!parseWildsPhiInput(amount)} type="submit">Review exact amount</button>
    </form> : null}
    {transfer.phase === "review" || transfer.phase === "stage" ? <div className="wilds-wallet-review">
      <p><span>Recipient</span><b>@{transfer.recipientUsername}</b></p><p><span>Exact amount</span><b><PhiNetworkAmount value={transfer.amountPhiMicro ? formatWildsPhiExact(transfer.amountPhiMicro) : "—"} /></b></p><p><span>Rail</span><b>{transfer.rail}</b></p>
      <button disabled={transfer.phase === "stage"} onClick={actions.onStage} type="button">{transfer.phase === "stage" ? "Preparing exact proof…" : "Prepare transfer proof"}</button>
    </div> : null}
    {transfer.phase === "authorize" || transfer.phase === "authorize-pending" ? <div className="wilds-wallet-authorize">
      <p><span>Final amount</span><b><PhiNetworkAmount value={transfer.amountPhiMicro ? formatWildsPhiExact(transfer.amountPhiMicro) : "—"} /></b></p>
      <button
        disabled={!actions.onAuthorize || transfer.phase === "authorize-pending"}
        onBlur={() => cancelHold(KEYBOARD_AUTHORIZATION_GESTURE_ID)}
        onKeyDown={startKeyboardHold}
        onKeyUp={endKeyboardHold}
        onLostPointerCapture={(event) => cancelHold(event.pointerId)}
        onPointerCancel={(event) => cancelHold(event.pointerId)}
        onPointerDown={startHold}
        onPointerLeave={(event) => cancelHold(event.pointerId)}
        onPointerUp={(event) => cancelHold(event.pointerId)}
        type="button"
      >{actions.onAuthorize ? (transfer.phase === "authorize-pending" ? "Issuing transfer proof…" : "Hold to issue exact proof object") : "Proof-object signing unavailable"}</button>
      <small>Keep pointer, Space, or Enter held. Releasing or leaving cancels authorization.</small>
    </div> : null}
  </section>;
}
