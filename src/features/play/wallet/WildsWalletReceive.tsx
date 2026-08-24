"use client";
/* eslint-disable @next/next/no-img-element -- generated QR data URLs are already final pixels and must stay portable in the standalone controller tests */

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact, parseWildsPhiInput } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";
import { createWildsWalletReceiveCoordinate, encodeWildsWalletReceiveCoordinate } from "./wilds-wallet-coordinate";

async function copyCoordinate(value: string) {
  try { await navigator.clipboard.writeText(value); return true; } catch {
    const field = document.createElement("textarea");
    field.value = value; field.readOnly = true; field.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.append(field); field.select();
    const copied = document.execCommand("copy"); field.remove(); return copied;
  }
}

export function WildsWalletReceive({ publicUsername, state, onRequestReceive }: {
  publicUsername: string | null;
  state: WildsWalletControllerState;
  onRequestReceive(amountPhiMicro?: string): void;
}) {
  const [amount, setAmount] = useState("");
  const [requestedAmount, setRequestedAmount] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const canReceive = Boolean(publicUsername) && (state.status === "verified" || state.status === "source-verified") && (state.capabilities?.receive === "available" || state.sourceAuthorityVerified);
  const coordinate = useMemo(() => {
    if (drafting || !publicUsername || !state.receiveLocator) return null;
    try { return encodeWildsWalletReceiveCoordinate(createWildsWalletReceiveCoordinate({ recipientUsername: publicUsername, recipientLocator: state.receiveLocator, amountPhiMicro: requestedAmount })); }
    catch { return null; }
  }, [drafting, publicUsername, requestedAmount, state.receiveLocator]);
  useEffect(() => {
    let current = true;
    setQrDataUrl(null);
    if (coordinate) void QRCode.toDataURL(coordinate, { errorCorrectionLevel: "M", margin: 2, width: 640, color: { dark: "#071019", light: "#f4fffc" } })
      .then((value) => { if (current) setQrDataUrl(value); })
      .catch(() => { if (current) setStatus("The coordinate is valid, but its QR image could not be rendered."); });
    return () => { current = false; };
  }, [coordinate]);
  const create = () => {
    const amountPhiMicro = amount.trim() ? parseWildsPhiInput(amount) : null;
    if (amount.trim() && !amountPhiMicro) { setStatus("Enter a valid Φ amount or leave it blank."); return; }
    setRequestedAmount(amountPhiMicro); setDrafting(false); setStatus(null); onRequestReceive(amountPhiMicro ?? undefined);
  };
  return <section aria-labelledby="wilds-wallet-receive-title" className="wilds-wallet-surface">
    <header><small>PUBLIC PLAYER COORDINATE</small><h2 id="wilds-wallet-receive-title">Receive</h2></header>
    <div className="wilds-wallet-coordinate"><span>{publicUsername ? `@${publicUsername}` : "Public handle unavailable"}</span><small>{publicUsername ? "This QR carries your sealed Receiz receive locator." : "Private identity coordinates are never displayed or shared."}</small></div>
    {!coordinate ? <div className="wilds-wallet-receive-builder">
      <label htmlFor="wilds-wallet-request-amount">Requested Φ amount <small>Optional</small></label>
      <input id="wilds-wallet-request-amount" inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="Leave blank for any amount" value={amount} />
      <p>A request proposes an amount only. The sender reviews and authorizes the exact transfer.</p>
      <button disabled={!canReceive || state.receiveRequestId !== null} onClick={create} type="button">{state.receiveRequestId === null ? "Create receiving QR" : "Sealing coordinate…"}</button>
    </div> : <div className="wilds-wallet-qr-card">
      <span className="wilds-wallet-qr-frame">{qrDataUrl ? <img alt={`Receive ${requestedAmount ? formatWildsPhiExact(requestedAmount) : "Phi"} as @${publicUsername}`} height={320} src={qrDataUrl} width={320} /> : <i aria-label="Rendering QR code" />}</span>
      <div><b>Scan to send to @{publicUsername}</b>{requestedAmount ? <small>Requested <PhiNetworkAmount value={formatWildsPhiExact(requestedAmount)} /></small> : <small>Sender chooses the amount.</small>}</div>
      <div className="wilds-wallet-qr-actions"><button onClick={() => { void copyCoordinate(coordinate).then((copied) => setStatus(copied ? "Receiving coordinate copied." : "Copy was blocked by this browser.")); }} type="button">Copy coordinate</button><button onClick={() => { setQrDataUrl(null); setRequestedAmount(null); setAmount(""); setDrafting(true); setStatus(null); }} type="button">Create another</button></div>
    </div>}
    {status ? <p aria-live="polite" role="status">{status}</p> : null}
  </section>;
}
