"use client";
import { describeWildsCrewMemory } from "./wilds-crew-memory";
import { Icons } from "@/components/icons";
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
  return <div className="wilds-travel-journal">
    <button type="button" aria-expanded={open} onClick={() => {
      setOpen(!open);
      if (!open) void load();
      else { request.current++; setBusy(false); }
    }} className="wilds-journal-toggle">
      <Icons.book size={17} aria-hidden="true" /><span>{open ? "Close travel journal" : "Travel journal"}</span><Icons.chevronDown size={16} aria-hidden="true" />
    </button>
    {open ? <section aria-label={`${name} travel journal`} aria-busy={busy}>
      <header className="wilds-journal-heading"><span>Travel memories</span><small>Newest first · recorded on this device</small></header>
      {!busy && !error && page?.battles?.length ? <div aria-label="Roaming battle reports">
        <strong>Roaming battles</strong>
        {page.battles.map(battle => <details key={battle.encounterId} className="wilds-journal-battle">
          <summary>{battle.outcome === "capture-eligible" ? "Challenger won" : battle.outcome === "defended" ? "Creature defended itself" : battle.outcome === "retreated" ? "Challenger retreated" : "Battle ended"} · Kai {battle.kaiUPulse}</summary>
          <ol>{battle.events.map((event, index) => <li key={index}>{event}</li>)}</ol>
        </details>)}
      </div> : null}
      {busy ? <p role="status">Opening travel records…</p> : error ? <p role="status">Travel records could not be opened. <button type="button" onClick={() => void load()}>Retry</button></p>
        : page?.observations.length ? <ol className="wilds-journal-timeline">
          {page.observations.map(row => <li key={row.head} data-event={row.kind}>
            <strong>{labels[row.kind]}</strong>
            <p className="wilds-journal-memory">{describeWildsCrewMemory(row, name)}</p>
            {row.actualPosition ? <div className="wilds-journal-coordinate">Trail coordinates {row.actualPosition.x.toFixed(1)}, {row.actualPosition.z.toFixed(1)}</div> : null}
            {row.kind === "returned" ? <div className="wilds-journal-reward">{row.totalObserved??row.visitedPointIds.length} locations observed</div> : null}
            {row.blocker ? <div>{row.blocker}</div> : null}
            <details className="wilds-journal-record"><summary>Record {row.revision}</summary><small>Kai order {row.causalKaiUPulse}</small></details>
          </li>)}
        </ol> : <p className="wilds-expedition-empty">A story waiting to unfold.<br /><small>Send this companion exploring to begin its journal.</small></p>}
      {!busy && !error && page?.nextCursor ? <button type="button" onClick={() => void load(page.nextCursor!)}>Older records</button> : null}
      {!busy && page ? <button type="button" onClick={() => void load()} className="wilds-journal-refresh">Latest records</button> : null}
    </section> : null}
  </div>;
}
