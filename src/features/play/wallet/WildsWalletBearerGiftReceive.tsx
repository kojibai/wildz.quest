"use client";

import { useState } from "react";
import type { WildsWalletBearerGiftReceiveResult } from "./wilds-wallet-bearer-gift-controller";

/** Mounting displays a received gift only. Explicit clicks admit/claim the saved
 * exact stage. An already accepted gift retries local import/private proof only. */
export function WildsWalletBearerGiftReceive({ title, fromHandle, onAccept, initialResult }: Readonly<{
  title: string; fromHandle: string;
  onAccept(): Promise<WildsWalletBearerGiftReceiveResult>;
  initialResult?: WildsWalletBearerGiftReceiveResult;
}>) {
  const [result, setResult] = useState(initialResult), [busy, setBusy] = useState(false);
  const accept = async () => {
    if (busy) return;
    setBusy(true);
    try { setResult(await onAccept()); }
    catch (cause) { setResult({ status: "pending", message: cause instanceof Error ? cause.message : "Check this same native gift again." }); }
    finally { setBusy(false); }
  };
  const accepted = result?.status === "accepted";
  return <article aria-label={`Receive ${title}`}>
    <p><strong>{title}</strong> from @{fromHandle.replace(/\.receiz\.id$/, "")}</p>
    <p>{result?.message ?? "Accept the exact Original to receive this gift in your wallet."}</p>
    <button type="button" disabled={busy || accepted && !result?.projectionPending} onClick={() => { void accept(); }}>
      {busy ? "Checking same gift…" : result?.projectionPending ? "Refresh received assets" : accepted ? "Received" : result?.status === "pending" ? "Check same gift" : "Accept gift"}
    </button>
    {result && <p role="status" aria-live="polite">{accepted ? "Ownership accepted" : "Awaiting native acceptance"}</p>}
  </article>;
}
