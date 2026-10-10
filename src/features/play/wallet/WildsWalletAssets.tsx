"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/icons";
import type { AdventureCardCondition } from "@/features/play/adventure/card-condition";
import { downloadBlob } from "@/features/play/card-export";
import { WildsCardScene } from "@/features/play/WildsCardScene";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { WildzPreparedIdentityOwnedCard } from "@/lib/receiz/wildz-identity-adapter";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";
import type { WildsResourceLotV1 } from "@/features/play/wilds-resource-lot";
import type { WildsMaterialLotV1 } from "@/features/play/wilds-steward-construction";
import type { WildsStewardPhiAwardV1 } from "@/features/play/wilds-steward-construction";
import { countWildsWalletResourceInventory, projectWildsWalletFoodInventory, totalWildsStewardPhiMicro } from "./wilds-wallet-inventory";
import type { WildsNourishmentState } from "@/features/play/wilds-nourishment";
import type { ExchangeCard } from "@/features/play/WildsResourceExchange";
import { WildsWalletAssetSend } from "./WildsWalletAssetSend";
import type { WildsWalletAssetSend as WildsWalletAssetSendCallback, WildsWalletAssetSendSelection } from "./wilds-wallet-asset-send";

type AssetFilter = "all" | "creatures" | "timber" | "stone" | "resources";
const PAGE_SIZE = 24;

export function WildsWalletAssets({ cards, cardConditions, inventoryCounts, materialLots, nourishment, resourceLots, resourceCards = [], stewardPhiAwards, publicUsername = null, onOpenVaultCard, onPrepareCard, onListCard, onSendAsset, state }: {
  cards: readonly PortableCardAsset[];
  cardConditions: Readonly<Record<string, AdventureCardCondition>>;
  inventoryCounts?: { resourceUnits: number; creatureCards: number };
  resourceLots: readonly WildsResourceLotV1[];
  nourishment?: WildsNourishmentState;
  resourceCards?: readonly ExchangeCard[];
  publicUsername?: string | null;
  onSendAsset?: WildsWalletAssetSendCallback;
  materialLots: readonly WildsMaterialLotV1[];
  stewardPhiAwards: readonly WildsStewardPhiAwardV1[];
  onOpenVaultCard?: (assetId: string) => void;
  onPrepareCard?: (asset: PortableCardAsset) => Promise<WildzPreparedIdentityOwnedCard>;
  onListCard?: (asset: PortableCardAsset, priceCents: number) => Promise<PortableCardAsset | null>;
  onSendCard?: (asset: PortableCardAsset, targetHandle: string) => Promise<unknown>;
  onSendResource?: (resourceLot: WildsResourceLotV1, targetHandle: string) => Promise<Readonly<{ claimUrl: string }>>;
  onSendMaterial?: (materialLot: WildsMaterialLotV1, targetHandle: string) => Promise<Readonly<{ claimUrl: string }>>;
  state: WildsWalletControllerState;
}) {
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");
  const [origin, setOrigin] = useState("https://wildz.quest");
  const [exporting, setExporting] = useState(false);
  const [listing, setListing] = useState(false);
  const [priceUsd, setPriceUsd] = useState("");
  const [message, setMessage] = useState("");
  const [sendLocked, setSendLocked] = useState(false);
  const [sendSelectionVersion, setSendSelectionVersion] = useState(0);
  const [sendSelection, setSendSelection] = useState<WildsWalletAssetSendSelection | null>(cards[0] ? { id: cards[0].id, label: cards[0].manifest.name, quantity: 1, asset: { kind: "creature", assetId: cards[0].id } } : null);
  const sendPanelRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const selected = useMemo(() => cards.find((card) => card.id === selectedId) ?? cards[0] ?? null, [cards, selectedId]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (value: string) => !normalizedQuery || value.toLocaleLowerCase().includes(normalizedQuery);
  const filteredCards = cards.filter((card) => (filter === "all" || filter === "creatures") && matches(`${card.manifest.name} ${card.manifest.species} ${card.id}`));
  const filteredMaterials = materialLots.filter((lot) => (filter === "all" || filter === lot.kind) && matches(`${lot.kind} ${lot.lotId} ${lot.source.sourceId}`));
  const filteredResources = resourceLots.filter((lot) => (filter === "all" || filter === "resources") && matches(`living honey ${lot.lotId} ${lot.source.groveId}`));
  const foodGroups = useMemo(() => projectWildsWalletFoodInventory(nourishment), [nourishment]);
  const resourceCount = countWildsWalletResourceInventory({ nourishment, resourceLots, resourceCards });
  const filteredFood = foodGroups.filter((food) => (filter === "all" || filter === "resources") && matches(`${food.label} ${food.foodKind} ${food.itemIds.join(" ")} ${food.sourceIds.join(" ")}`));
  const filteredResourceCards = resourceCards.filter((card) => (filter === "all" || filter === "resources") && matches(`${card.title} ${card.summary} ${card.id}`));
  const visibleMaterials = filteredMaterials.slice(0, visibleLimit);
  const visibleResources = filteredResources.slice(0, visibleLimit);
  const sourceSettledPhiMicro = totalWildsStewardPhiMicro(stewardPhiAwards);
  const reservedCardCount = cards.filter(card => card.status === "listed" || card.status === "suspended" || card.status === "revoked").length;
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { setVisibleLimit(PAGE_SIZE); }, [filter, query]);
  const selectSendAsset = (selection: WildsWalletAssetSendSelection) => {
    if (sendLocked) return;
    setSendSelection(selection);
    setSendSelectionVersion(version => version + 1);
    window.requestAnimationFrame(() => sendPanelRef.current?.scrollIntoView({ block: "nearest" }));
  };
  const selectedSendCreatureId = sendSelection?.asset.kind === "creature" ? sendSelection.asset.assetId : null;
  const selectedSendUnavailable = selectedSendCreatureId !== null && !cards.some(card => card.id === selectedSendCreatureId && (card.status === "sealed_local" || card.status === "verified"));

  const exportSelectedCard = async () => {
    if (!selected) return;
    setExporting(true);
    setMessage("Preparing the exact verified card…");
    try {
      if (!onPrepareCard) throw new Error("Verified card export is unavailable.");
      const artifact = await onPrepareCard(selected);
      const blob = new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType });
      downloadBlob(blob, artifact.filename);
      setMessage("Verified card downloaded.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Card send could not be prepared.");
    } finally {
      setExporting(false);
    }
  };

  const listSelectedCard = async () => {
    if (!selected || !onListCard) return;
    const priceCents = Math.round(Number(priceUsd) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 1) return;
    setListing(true);
    setMessage("Binding this exact card proof to its market listing…");
    try {
      const listed = await onListCard(selected, priceCents);
      setMessage(listed ? `${selected.manifest.name} is listed from its exact custody proof.` : "The listing did not commit; the card remains yours.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Card listing could not be committed.");
    } finally {
      setListing(false);
    }
  };

  return <section aria-labelledby="wilds-wallet-assets-title" className="wilds-wallet-surface">
    <header><small>ADMITTED CUSTODY</small><h2 id="wilds-wallet-assets-title">Assets</h2></header>
    {state.summary ? <dl className="wilds-wallet-asset-register">
      <div><dt>{state.balanceBasis === "current" ? (state.status === "offline-verified" ? "Last known PHI" : "Available PHI") : "PHI balance"}</dt><dd><PhiNetworkAmount value={formatWildsPhiExact(state.summary.admittedPhiMicro)} /></dd><small>{state.balanceBasis === "current" ? "Wallet balance after settled earnings, receipts, and spending." : "Last verified balance."}</small></div>
      <div><dt>Stewardship earned</dt><dd><PhiNetworkAmount value={formatWildsPhiExact(sourceSettledPhiMicro)} /></dd><small>Lifetime world rewards. Settled rewards are already included in your available PHI.</small></div>
      <div><dt>Resource units</dt><dd>{(inventoryCounts?.resourceUnits ?? state.summary.transferableResourceCount)?.toLocaleString("en-US") ?? "—"}</dd><small>Your current stored food, beans, fusion sparks, catalysts, available building materials, and Living Honey units.</small></div>
      <div><dt>Creature cards</dt><dd>{cards.length}</dd><small>Verified cards in your active Wildz Vault.</small></div>
      {reservedCardCount ? <div><dt>Unavailable to send</dt><dd>{reservedCardCount}</dd><small>Already listed, committed, suspended, or revoked.</small></div> : null}
    </dl> : null}
    <div className="wilds-wallet-asset-browser">
      <div aria-label="Asset categories" className="wilds-wallet-asset-filters" role="group">
        {([
          ["all", "All assets", cards.length + materialLots.length + resourceCount],
          ["creatures", "Creatures", cards.length],
          ["timber", "Timber", materialLots.filter((lot) => lot.kind === "timber").length],
          ["stone", "Stone", materialLots.filter((lot) => lot.kind === "stone").length],
          ["resources", "Resources", resourceCount]
        ] as const).map(([value, label, count]) => <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)} type="button"><span>{label}</span><b>{count}</b></button>)}
      </div>
      <label className="wilds-wallet-asset-search"><span>Find exact custody</span><input aria-label="Search exact wallet assets" onChange={(event) => setQuery(event.target.value)} placeholder="Search name, kind, or proof ID" type="search" value={query} /></label>
    </div>
    {sendSelection ? <div ref={sendPanelRef}><WildsWalletAssetSend key={`${sendSelection.id}:${sendSelectionVersion}`} selection={sendSelection} publicUsername={publicUsername} onSendAsset={onSendAsset} disabled={Boolean(selectedSendUnavailable)} onLockChange={setSendLocked} /></div> : <p>Select an asset below to send it to another user.</p>}
    {filteredCards.length ? <div className="wilds-wallet-card-vault">
      <div aria-label="Choose a wallet card" className="wilds-wallet-card-selector">{filteredCards.slice(0, visibleLimit).map((card) => <button aria-pressed={selected?.id === card.id} disabled={sendLocked} key={card.id} onClick={() => { setSelectedId(card.id); setMessage(""); selectSendAsset({ id: card.id, label: card.manifest.name, quantity: 1, asset: { kind: "creature", assetId: card.id } }); }} type="button"><span>{card.manifest.name}</span><small>{card.manifest.rarity} · Stage {card.manifest.stage}</small></button>)}</div>
      {selected ? <div className="wilds-wallet-card-detail">
        {onOpenVaultCard ? <div className="wilds-wallet-card-heading"><small>SELECTED CARD</small><button aria-label={`Open ${selected.manifest.name} in Card Vault`} className="wilds-wallet-vault-pill" onClick={() => onOpenVaultCard(selected.id)} type="button"><Icons.box aria-hidden="true" size={16} /><span>Vault</span></button></div> : null}
        <div className="wilds-wallet-card-stage"><WildsCardScene asset={selected} condition={cardConditions[selected.id]} origin={origin} qr="" tapToFlip /></div>
        <small>Tap or swipe the card to see its complete verified back.</small>
        {onPrepareCard ? <button disabled={exporting || sendLocked} onClick={() => { void exportSelectedCard(); }} type="button">{exporting ? "Preparing verified card…" : "Download verified card"}</button> : null}
        {onListCard ? <div className="wilds-wallet-resource-send"><label><span>Sell on Receiz Market</span><input aria-label="Card listing price in USD" inputMode="decimal" min="0.01" onChange={(event) => setPriceUsd(event.target.value)} placeholder="0.00" step="0.01" type="number" value={priceUsd} /></label><button disabled={listing || sendLocked || selected.status === "listed" || !Number.isFinite(Number(priceUsd)) || Number(priceUsd) <= 0} onClick={() => { void listSelectedCard(); }} type="button">{selected.status === "listed" ? "Already listed" : listing ? "Committing listing…" : `List ${selected.manifest.name}`}</button></div> : null}
        {message ? <p aria-live="polite">{message}</p> : null}
      </div> : null}
    </div> : filter === "creatures" && !cards.length ? <p>No creature cards are carried by this Receiz ID yet.</p> : null}
    {filteredFood.length ? <section aria-label="Stored food resources" className="wilds-wallet-resource-vault">
      <header><small>STORED FOOD</small><strong>Food supplies</strong></header>
      <div>{filteredFood.map((food) => <article className={sendSelection?.id === food.id ? "is-selected" : undefined} key={food.id}>
        <span aria-hidden="true" className="wilds-wallet-resource-mark">{food.foodKind === "wild-meat" ? "◆" : "●"}</span>
        <div><strong>{food.label}</strong><small>{food.quantity} stored portion{food.quantity === 1 ? "" : "s"}</small><p>Available in your Satchel.</p></div>
        <button aria-label={`Select ${food.label} for wallet send`} aria-pressed={sendSelection?.id === food.id} disabled={sendLocked} onClick={() => selectSendAsset({ id: food.id, label: food.label, quantity: food.quantity, adjustableQuantity: true, asset: { kind: "inventory", foodItemIds: food.itemIds, materialLotIds: [], resourceLotIds: [] } })} type="button">Select to send</button>
      </article>)}</div>
    </section> : null}
    {filter === "resources" && !resourceCount ? <p>No stored food or harvested resources yet.</p> : null}
    {filteredResources.length ? <section aria-label="Verified world resources" className="wilds-wallet-resource-vault">
      <header><small>WORLD-BORN CUSTODY</small><strong>Harvested resources</strong></header>
      <div>{visibleResources.map((lot) => <article className={sendSelection?.id === lot.lotId ? "is-selected" : undefined} key={lot.lotId}>
        <span aria-hidden="true" className="wilds-wallet-resource-mark">✦</span>
        <div><strong>Living Honey</strong><small>{lot.quantity} sealed unit{lot.quantity === 1 ? "" : "s"} · Quality {lot.quality}</small><p>Harvested with a willing companion in a living grove.</p></div>
        <button aria-label={`Select exact Living Honey ${lot.lotId}`} aria-pressed={sendSelection?.id === lot.lotId} disabled={sendLocked} onClick={() => selectSendAsset({ id: lot.lotId, label: "Living Honey", quantity: lot.quantity, detail: "This entire sealed lot is sent together.", asset: { kind: "inventory", foodItemIds: [], materialLotIds: [], resourceLotIds: [lot.lotId] } })} type="button">Select to send</button>
      </article>)}</div>
    </section> : null}
    {filteredMaterials.length ? <section aria-label="Verified construction materials" className="wilds-wallet-resource-vault">
      <header><small>SOURCE-PROOF CUSTODY</small><strong>Building materials</strong></header>
      <div>{visibleMaterials.map((lot) => <article className={sendSelection?.id === lot.lotId ? "is-selected" : undefined} key={lot.lotId}>
        <span aria-hidden="true" className="wilds-wallet-resource-mark">{lot.kind === "timber" ? "⌁" : "◆"}</span>
        <div><strong>{lot.kind === "timber" ? "Living Timber" : lot.kind === "stone" ? "Foundation Stone" : "Hay"}</strong><small>1 exact unit · Quality {lot.quality}</small><p>Gathered with a willing companion from {lot.source.sourceId.slice(-18)}.</p></div>
        <button aria-label={`Select exact ${lot.kind} ${lot.lotId}`} aria-pressed={sendSelection?.id === lot.lotId} disabled={sendLocked} onClick={() => selectSendAsset({ id: lot.lotId, label: lot.kind === "timber" ? "Living Timber" : lot.kind === "stone" ? "Foundation Stone" : "Hay", quantity: 1, asset: { kind: "inventory", foodItemIds: [], materialLotIds: [lot.lotId], resourceLotIds: [] } })} type="button">Select to send</button>
      </article>)}</div>
    </section> : null}
    {filteredResourceCards.length ? <section aria-label="Resource packages" className="wilds-wallet-resource-vault">
      <header><small>PACKED RESOURCES</small><strong>Resource cards</strong></header>
      <div>{filteredResourceCards.map((card) => <article className={sendSelection?.id === card.id ? "is-selected" : undefined} key={card.id}>
        <span aria-hidden="true" className="wilds-wallet-resource-mark">◇</span>
        <div><strong>{card.title}</strong><small>{card.summary}</small><p>{card.status}</p></div>
        <button aria-label={`Select ${card.title} for wallet send`} aria-pressed={sendSelection?.id === card.id} disabled={sendLocked || !card.transferable} onClick={() => selectSendAsset({ id: card.id, label: card.title, detail: card.summary, quantity: 1, asset: { kind: "package", packageId: card.id } })} type="button">Select to send</button>
      </article>)}</div>
    </section> : null}
    {filteredCards.length + filteredMaterials.length + filteredResources.length > visibleLimit ? <button className="wilds-wallet-show-more" onClick={() => setVisibleLimit((value) => value + PAGE_SIZE)} type="button">Show {Math.min(PAGE_SIZE, filteredCards.length + filteredMaterials.length + filteredResources.length - visibleLimit)} more exact assets</button> : null}
  </section>;
}
