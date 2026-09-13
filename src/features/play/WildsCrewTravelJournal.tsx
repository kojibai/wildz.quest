"use client";
import { useRef, useState } from "react";
import type { WildsCrewExpedition } from "./wilds-crew-expedition";
import type { WildsRoamingHistoryReport } from "./wilds-roaming-report-store";

export type WildsCrewTravelHistory = (assetId: string, beforeHead?: string, limit?: number) => Promise<{
  observations: WildsCrewExpedition[]; nextCursor: string | null; battles?: WildsRoamingHistoryReport[];
}>;

const labels: Record<WildsCrewExpedition["kind"], string> = {
  "route-retried": "Tried the route again",
  "itinerary-continued": "Chose another exploration route",
  started: "Set out to explore", visited: "Observed a trail location", continued: "Continued exploring",
  recalled: "Called home", blocked: "Found a blocked route", returned: "Returned to you",
  superseded: "Earlier journey ended",
  transported: "Travelled with you", "return-retargeted": "Adjusted the route home"
};

/** Reads a bounded page only when opened. No history reads or subscriptions in gameplay. */
export function WildsCrewTravelJournal({ assetId, name, readHistory }: {
  assetId: string; name: string; readHistory: WildsCrewTravelHistory;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Awaited<ReturnType<WildsCrewTravelHistory>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const load = async (cursor?: string) => {
    const token = ++request.current;
    setBusy(true); setError(false);
    try {
      const result = await readHistory(assetId, cursor, 24);
      if (request.current === token) setPage(result);
    } catch { if (request.current === token) setError(true); }
    finally { if (request.current === token) setBusy(false); }
  };
  return <div style={{ marginTop: 12 }}>
    <button type="button" aria-expanded={open} onClick={() => {
      setOpen(!open);
      if (!open) void load();
      else { request.current++; setBusy(false); }
    }} style={{ color: "inherit", background: "transparent", border: "1px solid currentColor", borderRadius: 8, padding: "8px 12px" }}>
      {open ? "Close travel journal" : "Travel journal"}
    </button>
    {open ? <section aria-label={`${name} travel journal`} aria-busy={busy}>
      <p style={{ opacity: .75 }}>Actual trips recorded on this device · newest first</p>
      {!busy && !error && page?.battles?.length ? <div aria-label="Roaming battle reports">
        <strong>Roaming battles</strong>
        {page.battles.map(battle => <details key={battle.encounterId} style={{ marginBlock: 8 }}>
          <summary>{battle.outcome === "capture-eligible" ? "Challenger won" : battle.outcome === "defended" ? "Creature defended itself" : battle.outcome === "retreated" ? "Challenger retreated" : "Battle ended"} · Kai {battle.kaiUPulse}</summary>
          <ol>{battle.events.map((event, index) => <li key={index}>{event}</li>)}</ol>
        </details>)}
      </div> : null}
      {busy ? <p role="status">Opening travel records…</p> : error ? <p role="status">Travel records could not be opened. <button type="button" onClick={() => void load()}>Retry</button></p>
        : page?.observations.length ? <ol style={{ paddingLeft: 20, display: "grid", gap: 12 }}>
          {page.observations.map(row => <li key={row.head}>
            <strong>{labels[row.kind]}</strong>
            {row.actualPosition ? <div>Trail coordinates {row.actualPosition.x.toFixed(1)}, {row.actualPosition.z.toFixed(1)}</div> : null}
            {row.kind === "returned" ? <div>{row.totalObserved??row.visitedPointIds.length} locations observed</div> : null}
            {row.blocker ? <div>{row.blocker}</div> : null}
            <small style={{ display: "block", marginTop: 4, opacity: .7, overflowWrap: "anywhere" }}>Kai order {row.causalKaiUPulse} · record {row.revision}</small>
          </li>)}
        </ol> : <p>No exploration trips recorded yet.</p>}
      {!busy && !error && page?.nextCursor ? <button type="button" onClick={() => void load(page.nextCursor!)}>Older records</button> : null}
      {!busy && page ? <button type="button" onClick={() => void load()} style={{ marginLeft: 12 }}>Latest records</button> : null}
    </section> : null}
  </div>;
}
