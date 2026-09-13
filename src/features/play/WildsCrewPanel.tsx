"use client";
import { useState } from "react";
import type { PortableCardAsset } from "./portable-card";
import type { WildsCrewMode } from "./wilds-crew-preferences";
import { WildsCrewTravelJournal, type WildsCrewTravelHistory } from "./WildsCrewTravelJournal";

export function WildsCrewPanel({ cards, modes, accompanyingAssetIds, reports = {}, onModeChange, readHistory }: {
  cards: readonly PortableCardAsset[];
  reports?: Readonly<Record<string, string>>;
  modes: Readonly<Record<string, WildsCrewMode>>;
  accompanyingAssetIds: readonly string[];
  onModeChange: (assetId: string, mode: WildsCrewMode) => void;
  readHistory?: WildsCrewTravelHistory;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(cards.length / pageSize) - 1));
  const visibleCards = cards.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <div className="wilds-command-content">
    <p>Send creatures to explore nearby trails and return with a travel journal. They keep exploring when you choose another companion, and pause when they need care or leave the loaded area.</p>
    {cards.length === 0 ? <p>No living creatures in your crew yet.</p> : <div style={{ display: "grid", gap: 12 }}>
      {visibleCards.map(card => <fieldset key={card.id} style={{ border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 12 }}>
        <legend>{card.manifest.name}</legend>
        <div role="group" aria-label={`${card.manifest.name} movement`} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(["follow", "roam"] as const).map(mode => <button key={mode} type="button" aria-pressed={modes[card.id] === mode}
            onClick={() => onModeChange(card.id, mode)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid currentColor", background: modes[card.id] === mode ? "rgba(94,234,212,.2)" : "transparent", color: "inherit" }}>
            {mode === "follow" ? "Follow / recall" : "Roam & explore"}
          </button>)}
        </div>
        <small>{reports[card.id] ?? (modes[card.id] === "roam" ? "Preparing this creature’s exploration journey." : !accompanyingAssetIds.includes(card.id) ? "Ready to set out from your location." : modes[card.id] === "follow" ? "Follow selected. This companion returns when the path is clear." : "Using this creature’s usual companion behavior.")}</small>
        {readHistory ? <WildsCrewTravelJournal key={`${card.manifest.ownerReceizId}:${card.id}:${card.proof.digest}`} assetId={card.id} name={card.manifest.name} readHistory={readHistory} /> : null}
      </fieldset>)}
    </div>}
    {cards.length > pageSize ? <nav aria-label="Crew pages" style={{display:"flex",gap:12,alignItems:"center"}}>
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <span>{currentPage + 1} / {Math.ceil(cards.length / pageSize)}</span>
      <button type="button" disabled={(currentPage + 1) * pageSize >= cards.length} onClick={() => setPage(currentPage + 1)}>Next</button>
    </nav> : null}
    <p>Gathering, hauling and construction assignments are not available yet. Exploration records actual visits; it does not create materials or rewards.</p>
  </div>;
}
