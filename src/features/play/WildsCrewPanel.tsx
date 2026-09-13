"use client";
import { useState } from "react";
import type { PortableCardAsset } from "./portable-card";
import type { WildsCrewMode } from "./wilds-crew-preferences";
import type { WildsCrewTravelHistory } from "./WildsCrewTravelJournal";
import { WildsCrewCreatureControls } from "./WildsCrewCreatureControls";

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
      {visibleCards.map(card => <WildsCrewCreatureControls key={card.id} card={card} mode={modes[card.id]}
        accompanying={accompanyingAssetIds.includes(card.id)} report={reports[card.id]}
        onModeChange={onModeChange} readHistory={readHistory} />)}
    </div>}
    {cards.length > pageSize ? <nav aria-label="Crew pages" style={{display:"flex",gap:12,alignItems:"center"}}>
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <span>{currentPage + 1} / {Math.ceil(cards.length / pageSize)}</span>
      <button type="button" disabled={(currentPage + 1) * pageSize >= cards.length} onClick={() => setPage(currentPage + 1)}>Next</button>
    </nav> : null}
    <p>Gathering, hauling and construction assignments are not available yet. Exploration records actual visits; it does not create materials or rewards.</p>
  </div>;
}
