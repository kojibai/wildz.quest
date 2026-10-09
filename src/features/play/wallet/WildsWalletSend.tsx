"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { normalizeWildsWalletPublicUsername } from "@/lib/receiz/wilds-wallet-projections";
import styles from "./WildsWalletSend.module.css";
import { ArrowUpRight, Check, CircleAlert, LoaderCircle, ScanLine, ShieldCheck } from "lucide-react";
import { formatWildsPhiExact, parseWildsPhiInput } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";
import { WildsWalletQrScanner } from "./WildsWalletQrScanner";
import type { WildsWalletReceiveCoordinate } from "./wilds-wallet-coordinate";

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
  onSelectReceiveCoordinate?(username: string, locator: string, amountPhiMicro: string | null): void;
  onReviewAmount(rail: "settlement" | "reserve", amountPhiMicro: string, operationNonce: string): void;
  onStage(): void;
  onAuthorizationPointerStart(pointerId: number): void;
  onAuthorizationPointerCancel(pointerId: number): void;
  onAuthorize?: (pointerId: number) => void;
  onRecover(): void;
  onEditTransfer(field: "recipient" | "amount"): void;
  onResetTransfer(): void;
  onReturnToMessages?(): void;
}>;

function unavailableReason(state: WildsWalletControllerState) {
  if (state.status === "offline-verified") return "You’re offline. Reconnect to send a payment.";
  if (state.status !== "verified" && state.status !== "source-verified") return "Connect your verified Receiz ID to send a payment.";
  if (!state.capabilities?.send.available) return "Sending is unavailable. Reopen your verified Receiz ID to connect this wallet.";
  return null;
}

function normalizedRecipient(value: string) {
  try { return normalizeWildsWalletPublicUsername(value); } catch { return null; }
}

export function WildsWalletSend({ state, ...actions }: { state: WildsWalletControllerState } & WildsWalletSendActions) {
  const transfer = state.transfer;
  const [username, setUsername] = useState(transfer.recipientUsername ?? "");
  const [amount, setAmount] = useState(transfer.amountPhiMicro ? formatWildsPhiExact(transfer.amountPhiMicro) : "");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const preparedNonceRef = useRef<string | null>(null);
  const onStage = actions.onStage;
  const onSelectReceiveCoordinate = actions.onSelectReceiveCoordinate;
  useEffect(() => {
    if (transfer.phase === "recipient") setUsername(transfer.recipientUsername ?? "");
    if (transfer.phase === "amount") setAmount(transfer.amountPhiMicro ? formatWildsPhiExact(transfer.amountPhiMicro) : "");
  }, [transfer.recipientUsername, transfer.amountPhiMicro, transfer.phase]);
  useEffect(() => {
    if (transfer.phase !== "review" || !transfer.operationNonce || transfer.preparationError || preparedNonceRef.current === transfer.operationNonce) return;
    preparedNonceRef.current = transfer.operationNonce;
    onStage();
  }, [transfer.phase, transfer.operationNonce, transfer.preparationError, onStage]);
  const acceptCoordinate = useCallback((coordinate: WildsWalletReceiveCoordinate) => {
    setScannerOpen(false);
    setUsername(coordinate.recipientUsername);
    setScanStatus(`Receiving QR ready for @${coordinate.recipientUsername}.`);
    onSelectReceiveCoordinate?.(coordinate.recipientUsername, coordinate.recipientLocator, coordinate.amountPhiMicro ?? null);
  }, [onSelectReceiveCoordinate]);
  const resetTransfer = () => {
    setUsername(""); setAmount(""); setScanStatus(null); setScannerOpen(false); preparedNonceRef.current = null;
    actions.onResetTransfer();
  };
  const recipient = normalizedRecipient(username);
  const amountMicro = parseWildsPhiInput(amount);
  const availableMicro = state.balanceBasis === "current" && state.status === "verified" ? state.summary?.admittedPhiMicro : null;
  const amountError = amount.trim() && !amountMicro ? "Enter a positive amount with up to 6 decimal places."
    : amountMicro && availableMicro && BigInt(amountMicro) > BigInt(availableMicro) ? "This amount exceeds your available PHI."
      : null;
  const exactAmount = transfer.amountPhiMicro ? formatWildsPhiExact(transfer.amountPhiMicro) : "0";
  const busy = transfer.phase === "stage" || transfer.phase === "signing" || transfer.phase === "authorize-pending";
  const step = transfer.phase === "recipient" ? 0 : transfer.phase === "amount" ? 1 : 2;
  const recipientBadge = <div className={styles.recipient}><span aria-hidden="true" className={styles.avatar}>{(transfer.recipientUsername ?? "?").slice(0, 1).toUpperCase()}</span><span><small>Sending to</small><strong>@{transfer.recipientUsername}</strong></span></div>;
  const details = <dl className={styles.details}><div><dt>To</dt><dd>@{transfer.recipientUsername}</dd></div><div><dt>Amount</dt><dd><PhiNetworkAmount value={exactAmount} /></dd></div><div><dt>From</dt><dd>PHI balance</dd></div><div><dt>Transfer</dt><dd>{transfer.rail === "reserve" ? "Reserve" : "Settlement"}</dd></div></dl>;
  const editActions = <div className="wilds-wallet-edit-actions"><button disabled={busy} onClick={() => actions.onEditTransfer("amount")} type="button">Edit amount</button><button disabled={busy} onClick={() => actions.onEditTransfer("recipient")} type="button">Edit recipient</button><button disabled={busy} onClick={resetTransfer} type="button">Cancel transfer</button></div>;
  const surfaceClass = `wilds-wallet-surface ${styles.send}`;
  if (transfer.phase === "unknown") return <section aria-labelledby="wilds-wallet-send-title" className={surfaceClass}>
    <div className={styles.outcome}><span className={styles.pendingMark}><LoaderCircle aria-hidden="true" size={32} /></span><h2 id="wilds-wallet-send-title">Payment pending</h2><p role="status">Your payment’s final status hasn’t arrived yet. Check its status before sending another payment.</p>{transfer.recipientVerified === false ? <p>Receiz will confirm your original payment details.</p> : <><PhiNetworkAmount className={styles.heroAmount} value={exactAmount} /><p>To <b>@{transfer.recipientUsername}</b></p></>}</div>
    <button className={styles.primary} disabled={transfer.requestId !== null} onClick={actions.onRecover} type="button">{transfer.requestId !== null ? "Checking payment…" : "Check payment status"}</button>
    <small className={styles.hint}>This checks the same payment and never sends it again.</small>
  </section>;
  if (transfer.phase === "zero-write") return <section aria-labelledby="wilds-wallet-send-title" className={surfaceClass}>
    <div className={styles.outcome}><span className={styles.errorMark}><CircleAlert aria-hidden="true" size={32} /></span><h2 id="wilds-wallet-send-title">Nothing moved</h2><p role="status">{transfer.result?.status === "zero-write" && transfer.result.code === "RECIPIENT_UNAVAILABLE" ? "We couldn’t find this recipient. Check their username and try again. Your funds are safe." : "Your payment wasn’t completed. Your funds are safe."}</p>{details}</div>
    <button className={styles.primary} onClick={resetTransfer} type="button">Try a new payment</button>
  </section>;
  if (transfer.phase === "committed") return <section aria-labelledby="wilds-wallet-send-title" className={surfaceClass}>
    <div className={styles.outcome}><span className={styles.successMark}><Check aria-hidden="true" size={38} /></span><h2 id="wilds-wallet-send-title">Payment sent</h2><PhiNetworkAmount className={styles.heroAmount} value={exactAmount} /><p role="status">Sent to <b>@{transfer.recipientUsername}</b></p><small className={styles.hint}><ShieldCheck aria-hidden="true" size={15} />Confirmed by Receiz</small></div>
    <button className={styles.primary} onClick={() => { resetTransfer(); actions.onReturnToMessages?.(); }} type="button">{actions.onReturnToMessages ? "Return to messages" : "Done"}</button>
    {actions.onReturnToMessages ? <button className={styles.secondary} onClick={resetTransfer} type="button">Send another payment</button> : null}
  </section>;
  const unavailable = unavailableReason(state);
  if (unavailable) return <section aria-labelledby="wilds-wallet-send-title" className={surfaceClass}><header><small>PAYMENTS</small><h2 id="wilds-wallet-send-title">Send PHI</h2></header><p className="wilds-wallet-state-strip is-source" role="status">{unavailable}</p></section>;
  return <section aria-labelledby="wilds-wallet-send-title" className={surfaceClass} aria-busy={busy}>
    <header><small>PAYMENTS</small><h2 id="wilds-wallet-send-title">{step === 2 ? "Review payment" : "Send PHI"}</h2></header>
    <ol className={styles.steps} aria-label="Payment steps">{["Recipient", "Amount", "Confirm"].map((label, index) => <li aria-current={step === index ? "step" : undefined} data-complete={index < step} key={label}><span aria-hidden="true">{index < step ? <Check size={11} /> : index + 1}</span>{label}</li>)}</ol>
    {transfer.phase === "recipient" ? scannerOpen ? <WildsWalletQrScanner onCancel={() => setScannerOpen(false)} onScan={acceptCoordinate} /> : <form onSubmit={event => { event.preventDefault(); if (recipient) actions.onLookupRecipient(recipient); }}>
      <label htmlFor="wilds-wallet-recipient">Who are you paying?</label><div className={`wilds-wallet-recipient-field ${styles.recipientField}`}><input autoCapitalize="none" autoComplete="off" autoCorrect="off" autoFocus id="wilds-wallet-recipient" maxLength={64} onChange={event => setUsername(event.target.value)} placeholder="@username" spellCheck={false} value={username} /><button aria-label="Scan receiving QR" disabled={!onSelectReceiveCoordinate} onClick={() => { setScanStatus(null); setScannerOpen(true); }} type="button"><ScanLine aria-hidden="true" size={21} /></button></div>
      <p className={styles.hint}>Use their Receiz username or scan their receiving QR.</p>
      {username.trim() && !recipient ? <p className={styles.error} role="status">Enter a Receiz username using 3–30 letters, numbers, or underscores.</p> : null}
      {state.recipient.status === "failed" && normalizedRecipient(state.recipient.username ?? "") === recipient ? <p className={styles.error} role="alert">We couldn’t find that recipient. Check the username and try again.</p> : null}
      <button className={styles.primary} disabled={!recipient || state.recipient.status === "loading"} type="submit">{state.recipient.status === "loading" ? "Finding recipient…" : "Continue"}<ArrowUpRight aria-hidden="true" size={17} /></button>
      {scanStatus ? <p aria-live="polite" role="status">{scanStatus}</p> : null}
    </form> : null}
    {transfer.phase === "amount" ? <form onSubmit={event => { event.preventDefault(); if (amountMicro && !amountError) actions.onReviewAmount("settlement", amountMicro, crypto.randomUUID()); }}>
      {recipientBadge}
      <div className={styles.amountEntry}><label htmlFor="wilds-wallet-amount">PHI amount</label><div className={styles.amountField}><span aria-hidden="true">Φ</span><input aria-describedby="wilds-wallet-amount-help" aria-invalid={Boolean(amountError)} autoComplete="off" autoFocus id="wilds-wallet-amount" inputMode="decimal" maxLength={31} onChange={event => setAmount(event.target.value)} placeholder="0" value={amount} /></div></div>
      {state.summary ? <p className={styles.balance}>{availableMicro ? "Available" : "Last known balance"}<PhiNetworkAmount value={formatWildsPhiExact(state.summary.admittedPhiMicro)} />{availableMicro && availableMicro !== "0" ? <button className={styles.balanceButton} onClick={() => setAmount(formatWildsPhiExact(availableMicro))} type="button">Use full balance</button> : null}</p> : null}
      <p className={amountError ? styles.error : styles.hint} id="wilds-wallet-amount-help" role={amountError ? "status" : undefined}>{amountError ?? "Send any amount from 0.000001 PHI."}</p>
      <button className={styles.primary} disabled={!amountMicro || Boolean(amountError)} type="submit">Review payment</button>
      <div className="wilds-wallet-edit-actions"><button onClick={() => actions.onEditTransfer("recipient")} type="button">Edit recipient</button><button onClick={resetTransfer} type="button">Cancel transfer</button></div>
    </form> : null}
    {["review", "stage", "authorize", "signing", "authorize-pending"].includes(transfer.phase) ? <div className={styles.review}>
      {recipientBadge}<PhiNetworkAmount className={styles.heroAmount} value={exactAmount} />{details}
      {transfer.preparationError ? <p className={`wilds-wallet-transfer-error ${styles.error}`} role="alert">{transfer.preparationError}</p> : null}
      {transfer.phase === "authorize" ? <button className={styles.primary} disabled={!actions.onAuthorize} onClick={() => { actions.onAuthorizationPointerStart(KEYBOARD_AUTHORIZATION_GESTURE_ID); actions.onAuthorize?.(KEYBOARD_AUTHORIZATION_GESTURE_ID); }} type="button">Confirm send<ArrowUpRight aria-hidden="true" size={18} /></button>
        : transfer.phase === "signing" || transfer.phase === "authorize-pending" ? <button className={styles.primary} disabled type="button"><LoaderCircle aria-hidden="true" className={styles.spinner} size={18} />Sending payment…</button>
          : <button className={styles.primary} disabled={transfer.phase === "stage"} onClick={onStage} type="button">{transfer.preparationError ? "Retry preparation" : transfer.phase === "review" ? "Check payment" : <><LoaderCircle aria-hidden="true" className={styles.spinner} size={18} />Checking payment…</>}</button>}
      <small className={styles.hint}>{transfer.phase === "signing" || transfer.phase === "authorize-pending" ? "Please keep this wallet open while your payment completes." : "You’ll confirm before anything is sent."}</small>
      {editActions}
    </div> : null}
  </section>;
}
