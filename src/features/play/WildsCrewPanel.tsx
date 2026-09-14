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
  return <div className="wilds-command-content wilds-expedition-panel">
    <header className="wilds-expedition-intro"><span>Beyond the familiar</span><h3>Little journeys. Living stories.</h3><p>Let your companions wander, discover, and bring their stories home.</p></header>
    {cards.length === 0 ? <p className="wilds-expedition-empty">Your next companion begins the story. Find a creature to start your crew.</p> : <div className="wilds-expedition-list">
      {visibleCards.map(card => <WildsCrewCreatureControls key={card.id} card={card} mode={modes[card.id]}
        accompanying={accompanyingAssetIds.includes(card.id)} report={reports[card.id]}
        onModeChange={onModeChange} readHistory={readHistory} />)}
    </div>}
    {cards.length > pageSize ? <nav aria-label="Crew pages" className="wilds-journal-pagination">
      <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <span>{currentPage + 1} / {Math.ceil(cards.length / pageSize)}</span>
      <button type="button" disabled={(currentPage + 1) * pageSize >= cards.length} onClick={() => setPage(currentPage + 1)}>Next</button>
    </nav> : null}
    <p className="wilds-expedition-footnote">Exploration brings back memories of real places visited. Companions pause when they need care.</p>
  </div>;
}
