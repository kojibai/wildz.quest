"use client";
import { useState } from "react";
import type { PortableCardAsset } from "./portable-card";
import type { WildsCrewMode } from "./wilds-crew-preferences";

export function WildsCrewPanel({ cards, modes, accompanyingAssetIds, onModeChange }: {
  cards: readonly PortableCardAsset[];
  modes: Readonly<Record<string, WildsCrewMode>>;
  accompanyingAssetIds: readonly string[];
  onModeChange: (assetId: string, mode: WildsCrewMode) => void;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(cards.length / pageSize) - 1));
  const visibleCards = cards.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <div className="wilds-command-content">
    <p>Choose how your active and support companions travel while you play. Other creatures’ preferences take effect when they accompany you. Roaming stays nearby and pauses when a companion needs rest or care.</p>
    {cards.length === 0 ? <p>No living creatures in your crew yet.</p> : <div style={{ display: "grid", gap: 12 }}>
      {visibleCards.map(card => <fieldset key={card.id} style={{ border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 12 }}>
        <legend>{card.manifest.name}</legend>
        <div role="group" aria-label={`${card.manifest.name} movement`} style={{ display: "flex", gap: 8 }}>
          {(["follow", "roam"] as const).map(mode => <button key={mode} type="button" aria-pressed={modes[card.id] === mode}
            onClick={() => onModeChange(card.id, mode)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid currentColor", background: modes[card.id] === mode ? "rgba(94,234,212,.2)" : "transparent", color: "inherit" }}>
            {mode === "follow" ? "Follow / recall" : "Roam nearby"}
          </button>)}
        </div>
        <small>{!accompanyingAssetIds.includes(card.id) ? "Preference saved for when this creature accompanies you." : modes[card.id] === "follow" ? "Follow selected. This companion returns when the path is clear." : modes[card.id] === "roam" ? "Roam selected. Nearby wandering resumes when ready." : "Using this creature’s usual companion behavior."}</small>
      </fieldset>)}
    </div>}
    {cards.length > pageSize ? <nav aria-label="Crew pages" style={{display:"flex",gap:12,alignItems:"center"}}>
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <span>{currentPage + 1} / {Math.ceil(cards.length / pageSize)}</span>
      <button type="button" disabled={(currentPage + 1) * pageSize >= cards.length} onClick={() => setPage(currentPage + 1)}>Next</button>
    </nav> : null}
    <p>Gathering, hauling and construction assignments are not available yet. These controls currently change companion movement only.</p>
  </div>;
}
