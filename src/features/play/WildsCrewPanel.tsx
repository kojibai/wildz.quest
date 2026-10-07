"use client";
import { useMemo, useRef, useState } from "react";
import {Icons} from "@/components/icons";
import type { PortableCardAsset } from "./portable-card";
import type { WildsCrewMode } from "./wilds-crew-preferences";
import type { WildsCrewTravelHistory } from "./WildsCrewTravelJournal";
import { WildsCrewCreatureControls } from "./WildsCrewCreatureControls";
import {browseWildsCrewCards,indexWildsCrewCards,type WildsCrewFilter,type WildsCrewSort} from "./wilds-crew-browser";
import styles from "./WildsCrewPanel.module.css";

export function WildsCrewPanel({ cards, modes, accompanyingAssetIds, reports = {}, onModeChange, readHistory }: {
  cards: readonly PortableCardAsset[];
  reports?: Readonly<Record<string, string>>;
  modes: Readonly<Record<string, WildsCrewMode>>;
  accompanyingAssetIds: readonly string[];
  onModeChange: (assetId: string, mode: WildsCrewMode) => void;
  readHistory?: WildsCrewTravelHistory;
}) {
  const [page, setPage] = useState(0);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<WildsCrewFilter>("all");
  const [sort,setSort]=useState<WildsCrewSort>("collection");
  const searchRef=useRef<HTMLInputElement>(null);
  const entries=useMemo(()=>indexWildsCrewCards(cards),[cards]);
  const browse=useMemo(()=>browseWildsCrewCards({entries,query,filter,sort,modes,accompanyingAssetIds,page}),[entries,query,filter,sort,modes,accompanyingAssetIds,page]);
  const accompanying=useMemo(()=>new Set(accompanyingAssetIds),[accompanyingAssetIds]);
  const reset=()=>{setQuery("");setFilter("all");setPage(0);searchRef.current?.focus();};
  return <div className={`wilds-command-content wilds-expedition-panel ${styles.panel}`}>
    <header className={`wilds-expedition-intro ${styles.intro}`}><span>Your creature crew</span><h3>Find a familiar face.</h3><p>Choose who to recall or send exploring. Each portrait belongs to that creature.</p></header>
    {cards.length ? <div className={styles.browser}>
      <div className={styles.search}>
        <Icons.search size={18} aria-hidden="true" />
        <input ref={searchRef} type="search" aria-label="Search creature crew" placeholder="Search name, species or rarity" value={query}
          onChange={event=>{setQuery(event.target.value);setPage(0);}} />
        {query ? <button type="button" aria-label="Clear creature search" onClick={()=>{setQuery("");setPage(0);searchRef.current?.focus();}}><Icons.close size={16} aria-hidden="true" /></button> : null}
      </div>
      <div className={styles.tools}>
        <div className={styles.filters} role="group" aria-label="Filter creature crew">
          {([["all","All"],["with-you","With you"],["roaming","Roam mode"]] as const).map(([value,label])=><button type="button" key={value} aria-pressed={filter===value}
            onClick={()=>{setFilter(value);setPage(0);}}>{label}</button>)}
        </div>
        <label className={styles.sort}><span>Sort</span><select aria-label="Sort creature crew" value={sort} onChange={event=>{setSort(event.target.value as WildsCrewSort);setPage(0);}}>
          <option value="collection">Collection order</option><option value="name">Name A–Z</option><option value="newest">Newest</option>
        </select></label>
      </div>
      <div className={styles.results}>
        <span role="status" aria-live="polite">{browse.total?`${browse.first}–${browse.last} of ${browse.total}`:"0"} creature{browse.total===1?"":"s"}{browse.total!==cards.length?` · ${cards.length} in crew`:""}</span>
        {browse.pageCount>1 ? <nav aria-label="Crew pages" className={styles.pagination}>
          <button type="button" aria-label="Previous crew page" disabled={browse.page===0} onClick={()=>setPage(browse.page-1)}><Icons.chevronLeft size={18} aria-hidden="true" /></button>
          <label><span className={styles.srOnly}>Crew page</span><select aria-label="Crew page" value={browse.page} onChange={event=>setPage(Number(event.target.value))}>
            {Array.from({length:browse.pageCount},(_,index)=><option key={index} value={index}>{index+1} / {browse.pageCount}</option>)}
          </select></label>
          <button type="button" aria-label="Next crew page" disabled={browse.page===browse.pageCount-1} onClick={()=>setPage(browse.page+1)}><Icons.chevronRight size={18} aria-hidden="true" /></button>
        </nav> : null}
      </div>
    </div> : null}
    {cards.length === 0 ? <p className="wilds-expedition-empty">Your next companion begins the story. Find a creature to start your crew.</p> : browse.total===0 ? <div className={styles.empty}><Icons.search size={25} aria-hidden="true" /><strong>No creatures found.</strong><p>Try another name or switch back to all creatures.</p><button type="button" onClick={reset}>Show all creatures</button></div> : <div className={`wilds-expedition-list ${styles.grid}`}>
      {browse.cards.map(card => <WildsCrewCreatureControls key={card.id} card={card} mode={modes[card.id]}
        accompanying={accompanying.has(card.id)} report={reports[card.id]}
        onModeChange={onModeChange} readHistory={readHistory} />)}
    </div>}
    <p className="wilds-expedition-footnote">Exploration brings back memories of real places visited. Companions pause when they need care.</p>
  </div>;
}
