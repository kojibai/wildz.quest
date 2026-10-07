"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, List, Search } from "lucide-react";
import { ledgerKaiTime, type WildsActivityEntry } from "./wallet/wilds-activity-history";
import { indexWildsStoryLedger, pageWildsStoryLedger } from "./wilds-story-ledger";

const DECISION_LABELS = { VALID: "Rules satisfied", INVALID: "Rules not satisfied", UNRESOLVED: "Awaiting evidence", DISPUTED: "Disputed" } as const;

const recordedText = (value: unknown) => typeof value === "string" && value.length ? value : "Unrecorded";
const recordedStrings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const recordedPredicates = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(item => item && typeof item.predicate === "string" ? [item.predicate] : []) : [];

export function WildsStoryLedger({ entries, onOpenLedger }: { entries: readonly WildsActivityEntry[]; onOpenLedger?: () => void }) {
  const [query, setQuery] = useState("");
  const [authority, setAuthority] = useState<"all" | WildsActivityEntry["authority"]>("all");
  const [requestedPage, setRequestedPage] = useState(0);
  const ordered = useMemo(() => indexWildsStoryLedger(entries), [entries]);
  const matching = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return ordered.filter(entry => (authority === "all" || entry.authority === authority)
      && (!search || `${entry.title} ${entry.detail} ${entry.id}`.toLocaleLowerCase().includes(search)));
  }, [ordered, query, authority]);
  const page = pageWildsStoryLedger(matching, requestedPage);
  return <section className="wilds-story-ledger" aria-label="Gameplay story ledger">
    <header><span><List size={17} aria-hidden="true" /><h4>Gameplay ledger</h4></span><b>{entries.length} records</b></header>
    <p>Your recorded actions, what they changed, and their original Kai time. Local records describe your device’s activity; world records describe shared events. Source details show the recorded authority and world-law evidence.</p>
    {entries.length ? <>
      <div className="wilds-story-ledger-controls">
        <label><Search size={14} aria-hidden="true" /><input aria-label="Search story ledger" type="search" placeholder="Find an action or event…" value={query} onChange={event => { setQuery(event.target.value); setRequestedPage(0); }} /></label>
        <select aria-label="Story ledger record source" value={authority} onChange={event => { setAuthority(event.target.value as typeof authority); setRequestedPage(0); }}>
          <option value="all">All records</option><option value="local">Your actions</option><option value="world">World events</option>
        </select>
      </div>
      <p className="wilds-story-ledger-range" role="status">{page.total ? `Showing ${page.start}–${page.end} of ${page.total} · newest first` : "No records match this search."}</p>
      <ol className="wilds-story-ledger-list">{page.entries.map(entry => {
        const timing = ledgerKaiTime({ uPulse: entry.uPulse });
        const decision = entry.constitution;
        const evidence = recordedStrings(decision?.evidence);
        const conflicts = recordedStrings(decision?.conflicts);
        const questions = [...recordedPredicates(decision?.predicatesFailed), ...recordedPredicates(decision?.predicatesUnresolved)];
        return <li className="wilds-story-ledger-entry" key={entry.id}>
          <div className="wilds-story-ledger-entry-heading"><strong>{entry.title}</strong><span className={`wilds-story-ledger-source is-${entry.authority}`}>{entry.authority === "local" ? "Your action" : "World event"}</span></div>
          <p>{entry.detail}</p>
          <span className="wilds-story-ledger-time">{timing.timing}</span>
          <details><summary>Source &amp; world law<ChevronRight size={12} aria-hidden="true" /></summary>
            <dl><div><dt>Record ID</dt><dd>{entry.id}</dd></div><div><dt>Original Kai pulse</dt><dd>{timing.uPulse ?? "Unavailable"}</dd></div><div><dt>Recorded by</dt><dd>{entry.authority === "local" ? "This device" : "Shared world"}</dd></div>
              {decision ? <><div><dt>World-law result</dt><dd>{recordedText(DECISION_LABELS[decision.result])}</dd></div><div><dt>Actor</dt><dd>{recordedText(decision.actor)}</dd></div><div><dt>Authority</dt><dd>{recordedText(decision.authority)}</dd></div><div><dt>Source</dt><dd>{recordedText(decision.sourceState)}</dd></div><div><dt>Rules applied</dt><dd>{recordedText(recordedStrings(decision.rulesApplied).join(" · "))}</dd></div>
                {typeof decision.successor === "string" && decision.successor ? <div><dt>Resulting source</dt><dd>{decision.successor}</dd></div> : null}
                {evidence.length ? <div><dt>Evidence</dt><dd>{evidence.join(" · ")}</dd></div> : null}
                {conflicts.length ? <div><dt>Conflicts</dt><dd>{conflicts.join(" · ")}</dd></div> : null}
                {questions.length ? <div><dt>Open questions</dt><dd>{questions.join(" · ")}</dd></div> : null}
                <div><dt>Decision digest</dt><dd>{recordedText(decision.digest)}</dd></div>
              </> : <div><dt>World-law evidence</dt><dd>No world-law decision is attached to this activity record.</dd></div>}
            </dl>
          </details>
        </li>;
      })}</ol>
      {page.pageCount > 1 ? <nav className="wilds-story-ledger-pages" aria-label="Story ledger pages">
        <button className="wilds-saga-action" type="button" disabled={page.page === 0} onClick={() => setRequestedPage(page.page - 1)}><ChevronLeft size={14} aria-hidden="true" />Newer</button>
        <span>Page {page.page + 1} of {page.pageCount}</span>
        <button className="wilds-saga-action" type="button" disabled={page.page + 1 === page.pageCount} onClick={() => setRequestedPage(page.page + 1)}>Older<ChevronRight size={14} aria-hidden="true" /></button>
      </nav> : null}
    </> : <p className="wilds-story-ledger-empty">Your ledger starts with your next recorded action. Explore, gather, build, or adventure with a companion to write it.</p>}
    {onOpenLedger ? <button className="wilds-saga-action wilds-story-ledger-full" onClick={onOpenLedger} type="button">View value, cards &amp; materials<ArrowUpRight size={14} aria-hidden="true" /></button> : null}
  </section>;
}
