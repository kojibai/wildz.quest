"use client";

import React, { useRef, useState } from "react";
import { parseWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { createWildsWalletAssetSendReview, type WildsWalletAssetSend, type WildsWalletAssetSendResult, type WildsWalletAssetSendSelection } from "./wilds-wallet-asset-send";
import styles from "./WildsWalletAssetSend.module.css";

export function WildsWalletAssetSend({ selection, publicUsername, onSendAsset, disabled = false, onLockChange }: {
  selection: WildsWalletAssetSendSelection;
  publicUsername: string | null;
  onSendAsset?: WildsWalletAssetSend;
  disabled?: boolean;
  onLockChange(locked: boolean): void;
}) {
  const [recipient, setRecipient] = useState("");
  const [quantity, setQuantity] = useState(selection.adjustableQuantity ? 1 : selection.quantity);
  const [review, setReview] = useState<ReturnType<typeof createWildsWalletAssetSendReview> | null>(null);
  const [result, setResult] = useState<WildsWalletAssetSendResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const pending = result?.status === "pending";
  const prepare = () => {
    try {
      setReview(createWildsWalletAssetSendReview(selection, recipient, quantity, `wallet:asset-send:${crypto.randomUUID()}`, publicUsername));
      setResult(null); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check the send details."); }
  };
  const send = async () => {
    if (!review || !onSendAsset || running.current || disabled && !pending) return;
    running.current = true; setSending(true); onLockChange(true); setError("");
    let locked = true;
    try {
      const outcome = await onSendAsset(review.request);
      setResult(outcome); locked = outcome.status === "pending";
    } catch {
      setResult({ status: "pending", retryable: false, message: "Delivery is still being checked. Check the same gift before sending this asset again." });
    } finally { running.current = false; setSending(false); onLockChange(locked); }
  };
  return <section aria-label="Send selected wallet asset" className={styles.panel}>
    <header><small>DIRECT SEND</small><h3>{review ? "Review asset send" : `Send ${selection.label}`}</h3></header>
    {review ? <>
      <dl className={styles.review}>
        <div><dt>Asset</dt><dd>{review.label}</dd></div>
        <div><dt>Quantity</dt><dd>{review.quantity}{selection.asset.kind === "package" ? " whole resource card" : ""}</dd></div>
        <div><dt>Recipient</dt><dd>@{review.request.recipientHandle.replace(/\.receiz\.id$/, "")}</dd></div>
      </dl>
      {review.detail ? <p>{review.detail}</p> : null}
      <p>The recipient accepts this gift to receive it. Ownership stays yours until acceptance is confirmed.</p>
      {!result || result.status === "failed" ? <div className={styles.actions}>
        <button disabled={sending} onClick={() => { setReview(null); setResult(null); }} type="button">Edit details</button>
        <button disabled={sending || disabled || !onSendAsset} onClick={() => { void send(); }} type="button">{sending ? "Sending…" : "Confirm send"}</button>
      </div> : null}
      {pending && result?.retryable ? <button disabled={sending} onClick={() => { void send(); }} type="button">{sending ? "Checking same send…" : "Retry same send"}</button> : null}
    </> : <>
      {selection.detail ? <p>{selection.detail}</p> : null}
      {selection.adjustableQuantity ? <label><span>Quantity</span><input aria-label="Wallet asset quantity" inputMode="numeric" min={1} max={Math.min(selection.quantity, 64)} step={1} type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label> : <p>{selection.quantity} {selection.asset.kind === "package" ? "whole resource card" : selection.quantity === 1 ? "exact unit" : "exact units"}</p>}
      <label><span>Recipient</span><input aria-label="Wallet asset recipient" autoCapitalize="none" autoCorrect="off" value={recipient} placeholder="@username" onChange={(event) => setRecipient(event.target.value)} /></label>
      <button disabled={disabled || !onSendAsset || !parseWildzPlayerCoordinate(recipient) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > (selection.adjustableQuantity ? Math.min(selection.quantity, 64) : selection.quantity)} onClick={prepare} type="button">Review send</button>
      {disabled || !onSendAsset ? <p>This asset is currently unavailable to send.</p> : null}
    </>}
    {sending ? <p role="status">Sending {review?.quantity} {selection.label} to @{review?.request.recipientHandle.replace(/\.receiz\.id$/, "")}…</p> : null}
    {result ? <p role="status">{result.message}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
