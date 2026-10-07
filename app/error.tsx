"use client";
import { useEffect, useState } from "react";
import { recordWildzClientError } from "../src/lib/wildz/client-error-report";

export default function WildzError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Recovery remains available without storage. */ }
    recordWildzClientError(error, storage);
  }, [error]);
  return <main className="wilds-portable-claim-page"><section className="wilds-portable-claim-panel" aria-labelledby="game-error-title">
    <small>WILDZ</small><h1 id="game-error-title">The game hit an error.</h1>
    <p>Try opening it again from your saved progress.</p>
    <button type="button" onClick={reset}>Try again</button>
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(recordWildzClientError(error), null, 2)); setCopyStatus("Error details copied."); }
      catch { setCopyStatus("Could not copy error details."); }
    }}>Copy error details</button>
    <p role="status">{copyStatus}</p>
  </section></main>;
}
