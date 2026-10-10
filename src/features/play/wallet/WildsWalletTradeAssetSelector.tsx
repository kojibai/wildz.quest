"use client";

import { useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { filterWildsWalletTradeChoices, wildsWalletTradeCategories, type WildsWalletTradeCategory, type WildsWalletTradeChoice } from "./wilds-wallet-trade-selection";
import styles from "./WildsWalletTrade.module.css";

export function WildsWalletTradeAssetSelector({ mode, choices, selected, onChange }: {
  mode: "offer" | "request";
  choices: readonly WildsWalletTradeChoice[];
  selected: Readonly<Record<string, number>>;
  onChange: Dispatch<SetStateAction<Readonly<Record<string, number>>>>;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WildsWalletTradeCategory | "all">("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const offered = mode === "offer";
  const chosen = choices.filter(item => selected[item.id] !== undefined);
  const visible = useMemo(() => filterWildsWalletTradeChoices(choices, { category, query, selectedOnly, selected }), [choices, category, query, selectedOnly, selected]);
  const categories = wildsWalletTradeCategories.map(group => ({ ...group, count: choices.filter(item => item.category === group.id).length })).filter(group => group.count > 0);
  const remove = (id: string) => onChange(current => { const next = { ...current }; delete next[id]; return next; });
  return <section className={styles.selector} aria-labelledby={titleId}>
    <div className={styles.selectorHeading}><h3 id={titleId}>{offered ? "Your offer assets" : "Requested items"}</h3><span>{chosen.length} selected</span></div>
    {!offered ? <p>Choose familiar names for your wishlist. Your peer supplies the exact items in their counteroffer.</p> : null}
    <label><span className={styles.searchLabel}>{offered ? "Find an asset" : "Find an item to request"}</span><input aria-label={offered ? "Search trade assets" : "Search requested assets"} type="search" placeholder="Search by name…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className={styles.categories} aria-label={offered ? "Offer asset categories" : "Requested asset categories"} role="group">
      <button aria-pressed={category === "all"} onClick={() => setCategory("all")} type="button">All <span>{choices.length}</span></button>
      {categories.map(group => <button aria-pressed={category === group.id} key={group.id} onClick={() => setCategory(group.id)} type="button">{group.label} <span>{group.count}</span></button>)}
      <button aria-pressed={selectedOnly} className={styles.selectedFilter} disabled={!chosen.length && !selectedOnly} onClick={() => setSelectedOnly(current => !current)} type="button">Selected <span>{chosen.length}</span></button>
    </div>
    {chosen.length ? <div className={styles.selectedSummary} aria-label={offered ? "Selected offer assets" : "Selected requested items"}>{chosen.map(item => <button key={item.id} aria-label={`Remove ${item.label} from ${offered ? "offer" : "wishlist"}`} onClick={() => remove(item.id)} type="button"><span>{item.label}</span><b>×{selected[item.id]}</b><span aria-hidden="true">×</span></button>)}</div> : null}
    <div className={styles.assetList} role="region" aria-label={offered ? "Available trade assets" : "Wishlist item names"} tabIndex={0}>
      {wildsWalletTradeCategories.map(group => {
        const items = visible.filter(item => item.category === group.id);
        return items.length ? <div className={styles.assetGroup} key={group.id}><h4>{group.label} <span>{items.length}</span></h4>{items.map(item => {
          const quantity = selected[item.id];
          const maximum = offered ? Math.min(item.quantity, 64) : 64;
          return <div className={styles.asset} data-selected={quantity !== undefined || undefined} key={item.id}>
            <label><input aria-label={offered ? `Add ${item.label} to trade` : `Request ${item.label} in trade`} type="checkbox" checked={quantity !== undefined} onChange={event => {
              if (event.target.checked) onChange(current => ({ ...current, [item.id]: offered && !item.adjustableQuantity ? item.quantity : 1 }));
              else remove(item.id);
            }} /><span><b>{item.label}</b>{offered ? <small>{item.quantity} available{item.detail ? ` · ${item.detail}` : ""}</small> : <small>Requested quantity</small>}</span></label>
            {quantity !== undefined && item.adjustableQuantity ? <input aria-label={offered ? `${item.label} trade quantity` : `Requested ${item.label} quantity`} type="number" min={1} max={maximum} step={1} value={quantity} onChange={event => {
              const next = Math.max(1, Math.min(maximum, Math.floor(Number(event.target.value) || 1)));
              onChange(current => ({ ...current, [item.id]: next }));
            }} /> : quantity !== undefined ? <b className={styles.fixedQuantity}>×{quantity}</b> : null}
          </div>;
        })}</div> : null;
      })}
      {!visible.length ? <p className={styles.emptyAssets}>{!choices.length ? offered ? "Gather food, materials or creatures to add assets." : "Describe another item in the note below." : selectedOnly && !chosen.length ? "No items selected. Turn off Selected to browse." : "No items match. Try another name or category."}</p> : null}
    </div>
    <small>{visible.length} of {choices.length} {offered ? "available selections" : "item names"}{offered ? " · Up to 32 selections and 64 distinct units per offer" : " · Add other requests in the note below"}</small>
  </section>;
}
