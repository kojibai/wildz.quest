"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Sparkles } from "lucide-react";
import type { WildsJourneyMemory } from "./wilds-journey";
import type { WildsSagaProjection } from "./wilds-saga-director";
import { ledgerKaiTime, type WildsActivityEntry } from "./wallet/wilds-activity-history";

export function WildsPersonalStory({ playerName, saga, memories, activities, location }: {
  playerName: string;
  saga: WildsSagaProjection;
  memories: readonly WildsJourneyMemory[];
  activities: readonly WildsActivityEntry[];
  location?: { name: string; position: { x: number; z: number } };
}) {
  const [requestedPage, setRequestedPage] = useState(0);
  const trail = useMemo(() => [...memories].sort((left, right) => right.timestamp - left.timestamp || left.id.localeCompare(right.id)), [memories]);
  const latestActivity = useMemo(() => activities.reduce<WildsActivityEntry | null>((latest, entry) => !latest || entry.uPulse >= latest.uPulse ? entry : latest, null), [activities]);
  const firstMemory = trail.at(-1);
  const latestMemory = trail[0];
  const pageCount = Math.max(1, Math.ceil(trail.length / 6));
  const page = Math.min(requestedPage, pageCount - 1);
  const name = playerName.trim() || "Explorer";
  return <section className="wilds-personal-story" aria-label="Your story through time">
    <div className="wilds-personal-story-now"><span><Sparkles size={12} aria-hidden="true" />Your story, right now</span><b>{saga.act.ark}</b></div>
    <h3>{name}’s living trail</h3>
    {location ? <p className="wilds-personal-story-place"><MapPin size={13} aria-hidden="true" />{location.name} · X {Math.round(location.position.x)} · Z {Math.round(location.position.z)}</p> : null}
    <p>{firstMemory ? <>Your earliest remembered moment was “{firstMemory.label}”{firstMemory.companionName ? ` with ${firstMemory.companionName}` : ""}, at X {Math.round(firstMemory.position.x)} · Z {Math.round(firstMemory.position.z)}.
      {latestMemory && latestMemory.id !== firstMemory.id ? <> Since then, your trail has led to “{latestMemory.label}”{latestMemory.companionName ? ` with ${latestMemory.companionName}` : ""} at X {Math.round(latestMemory.position.x)} · Z {Math.round(latestMemory.position.z)}.</> : null}</>
      : "Your personal trail is beginning. Places you discover, companions you meet, and work you complete will become remembered moments here."}</p>
    {latestActivity ? <div className="wilds-personal-story-latest" aria-live="polite"><small>Latest recorded {latestActivity.authority === "world" ? "world event" : "action"} · {ledgerKaiTime({ uPulse: latestActivity.uPulse }).timing}</small><strong>{latestActivity.title}</strong><p>{latestActivity.detail}</p></div> : null}
    <p className="wilds-personal-story-moment"><strong>Now, {saga.chapter.title} is unfolding.</strong> {saga.act.directive}</p>
    {trail.length ? <div className="wilds-personal-story-trail">
      <h4>Where you’ve been · {trail.length} remembered moments</h4>
      <ol className="wilds-saga-timeline">{trail.slice(page * 6, page * 6 + 6).map(memory => <li key={memory.id}>
        <span className="wilds-saga-timeline-marker" aria-hidden="true"><MapPin size={11} /></span>
        <div><strong>{memory.label}</strong><p>{memory.companionName ? `With ${memory.companionName} · ` : ""}X {Math.round(memory.position.x)} · Z {Math.round(memory.position.z)}</p><span className="wilds-story-ledger-time">{ledgerKaiTime({ occurredAt: new Date(memory.timestamp).toJSON() ?? "" }).timing}</span></div>
      </li>)}</ol>
      {pageCount > 1 ? <nav className="wilds-story-ledger-pages" aria-label="Remembered trail pages">
        <button className="wilds-saga-action" disabled={page === 0} onClick={() => setRequestedPage(page - 1)} type="button"><ChevronLeft size={14} aria-hidden="true" />Newer</button><span>Page {page + 1} of {pageCount}</span><button className="wilds-saga-action" disabled={page + 1 === pageCount} onClick={() => setRequestedPage(page + 1)} type="button">Earlier<ChevronRight size={14} aria-hidden="true" /></button>
      </nav> : null}
    </div> : null}
  </section>;
}
