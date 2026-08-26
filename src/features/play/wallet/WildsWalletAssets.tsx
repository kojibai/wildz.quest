"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import type { AdventureCardCondition } from "@/features/play/adventure/card-condition";
import { createWildsCardSendDraft, downloadBlob, normalizeWildsCardSendTarget } from "@/features/play/card-export";
import { WildsCardScene } from "@/features/play/WildsCardScene";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { WildzPreparedIdentityOwnedCard } from "@/lib/receiz/wildz-identity-adapter";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";
import type { WildsResourceLotV1 } from "@/features/play/wilds-resource-lot";
import type { WildsMaterialLotV1 } from "@/features/play/wilds-steward-construction";
import type { WildsStewardPhiAwardV1 } from "@/features/play/wilds-steward-construction";
import { totalWildsStewardPhiMicro } from "./wilds-wallet-inventory";

type AssetFilter = "all" | "creatures" | "timber" | "stone" | "resources";
const PAGE_SIZE = 24;

export function WildsWalletAssets({ cards, cardConditions, materialLots, resourceLots, stewardPhiAwards, onOpenVaultCard, onPrepareCard, onListCard, onSendCard, onSendMaterial, onSendResource, state }: {
  cards: readonly PortableCardAsset[];
  cardConditions: Readonly<Record<string, AdventureCardCondition>>;
  resourceLots: readonly WildsResourceLotV1[];
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
  const [target, setTarget] = useState("");
  const [origin, setOrigin] = useState("https://wildz.quest");
  const [sending, setSending] = useState(false);
  const [listing, setListing] = useState(false);
  const [priceUsd, setPriceUsd] = useState("");
  const [message, setMessage] = useState("");
  const [resourceTarget, setResourceTarget] = useState("");
  const [resourceMessage, setResourceMessage] = useState("");
  const [resourceSending, setResourceSending] = useState(false);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [selectedResourceId, setSelectedResourceId] = useState(resourceLots[0]?.lotId ?? "");
  const [selectedMaterialId, setSelectedMaterialId] = useState(materialLots[0]?.lotId ?? "");
  const selected = useMemo(() => cards.find((card) => card.id === selectedId) ?? cards[0] ?? null, [cards, selectedId]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (value: string) => !normalizedQuery || value.toLocaleLowerCase().includes(normalizedQuery);
  const filteredCards = cards.filter((card) => (filter === "all" || filter === "creatures") && matches(`${card.manifest.name} ${card.manifest.species} ${card.id}`));
  const filteredMaterials = materialLots.filter((lot) => (filter === "all" || filter === lot.kind) && matches(`${lot.kind} ${lot.lotId} ${lot.source.sourceId}`));
  const filteredResources = resourceLots.filter((lot) => (filter === "all" || filter === "resources") && matches(`living honey ${lot.lotId} ${lot.source.groveId}`));
  const visibleMaterials = filteredMaterials.slice(0, visibleLimit);
  const visibleResources = filteredResources.slice(0, visibleLimit);
  const selectedResource = resourceLots.find((lot) => lot.lotId === selectedResourceId) ?? resourceLots[0] ?? null;
  const selectedMaterial = materialLots.find((lot) => lot.lotId === selectedMaterialId) ?? materialLots[0] ?? null;
  const sourceSettledPhiMicro = totalWildsStewardPhiMicro(stewardPhiAwards);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { setVisibleLimit(PAGE_SIZE); }, [filter, query]);

  const sendSelectedCard = async () => {
    if (!selected) return;
    setSending(true);
    setMessage("Preparing the exact verified card…");
    try {
      const draft = createWildsCardSendDraft(selected, target, origin);
      if (draft.target.kind === "receiz-username") {
        if (!onSendCard) throw new Error("Online card transfer is unavailable.");
        await onSendCard(selected, draft.target.value);
        setMessage(`One-use card claim sent privately to ${draft.target.label}. Your card remains here until they claim it.`);
        return;
      }
      if (!onPrepareCard) throw new Error("Verified card export is unavailable.");
      const artifact = await onPrepareCard(selected);
      const blob = new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType });
      const file = new File([blob], artifact.filename, { type: artifact.mimeType });
      const shareData: ShareData = { title: draft.title, text: draft.text, url: draft.url, files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setMessage(`Verified card prepared for ${draft.target.label}.`);
      } else {
        downloadBlob(blob, artifact.filename);
        await navigator.clipboard?.writeText(draft.text).catch(() => undefined);
        setMessage(`Verified card downloaded for ${draft.target.label}. Send the downloaded proof object; its claim travels with it.`);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Card send could not be prepared.");
    } finally {
      setSending(false);
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

  const sendResource = async (lot: WildsResourceLotV1) => {
    if (!onSendResource || !resourceTarget.trim()) return;
    setResourceSending(true);
    setResourceMessage("Sealing one-use resource claim…");
    try {
      const { claimUrl } = await onSendResource(lot, resourceTarget);
      const shareData = { title: "Living Honey", text: `Claim Living Honey from @${resourceTarget.replace(/^@/, "")}`, url: claimUrl };
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(claimUrl);
      setResourceMessage("One-use claim ready. The resource stays yours until it is claimed.");
    } catch (cause) {
      setResourceMessage(cause instanceof Error ? cause.message : "Resource claim could not be prepared.");
    } finally {
      setResourceSending(false);
    }
  };

  const sendMaterial = async (lot: WildsMaterialLotV1) => {
    if (!onSendMaterial || !resourceTarget.trim()) return;
    setResourceSending(true);
    setResourceMessage("Sealing one-use material claim…");
    try {
      const { claimUrl } = await onSendMaterial(lot, resourceTarget);
      const title = lot.kind === "timber" ? "Timber" : "Stone";
      const shareData = { title, text: `Claim ${title} from @${resourceTarget.replace(/^@/, "")}`, url: claimUrl };
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(claimUrl);
      setResourceMessage("One-use claim ready. This exact unit stays yours until it is claimed.");
    } catch (cause) {
      setResourceMessage(cause instanceof Error ? cause.message : "Material claim could not be prepared.");
    } finally {
      setResourceSending(false);
    }
  };

  return <section aria-labelledby="wilds-wallet-assets-title" className="wilds-wallet-surface">
    <header><small>ADMITTED CUSTODY</small><h2 id="wilds-wallet-assets-title">Assets</h2></header>
    {state.summary ? <dl className="wilds-wallet-asset-register">
      <div><dt>Phi total</dt><dd><PhiNetworkAmount value={formatWildsPhiExact(state.summary.admittedPhiMicro)} /></dd><small>Exact value carried by this Receiz ID.</small></div>
      <div><dt>Stewardship earned</dt><dd><PhiNetworkAmount value={formatWildsPhiExact(sourceSettledPhiMicro)} /></dd><small>Source-settled at the edge. Shown separately from the carried balance so it cannot be counted twice.</small></div>
      <div><dt>Resource units</dt><dd>{state.summary.transferableResourceCount ?? "—"}</dd><small>Your current beans, fusion sparks, and catalysts.</small></div>
      <div><dt>Creature cards</dt><dd>{cards.length}</dd><small>Verified cards in your active Wildz Vault.</small></div>
      {state.summary.reservedCardCount ? <div><dt>Unavailable to send</dt><dd>{state.summary.reservedCardCount}</dd><small>Already listed, committed, suspended, or revoked.</small></div> : null}
    </dl> : null}
    <div className="wilds-wallet-asset-browser">
      <div aria-label="Asset categories" className="wilds-wallet-asset-filters" role="group">
        {([
          ["all", "All assets", cards.length + materialLots.length + resourceLots.length],
          ["creatures", "Creatures", cards.length],
          ["timber", "Timber", materialLots.filter((lot) => lot.kind === "timber").length],
          ["stone", "Stone", materialLots.filter((lot) => lot.kind === "stone").length],
          ["resources", "Resources", resourceLots.length]
        ] as const).map(([value, label, count]) => <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)} type="button"><span>{label}</span><b>{count}</b></button>)}
      </div>
      <label className="wilds-wallet-asset-search"><span>Find exact custody</span><input aria-label="Search exact wallet assets" onChange={(event) => setQuery(event.target.value)} placeholder="Search name, kind, or proof ID" type="search" value={query} /></label>
    </div>
    {filteredCards.length ? <div className="wilds-wallet-card-vault">
      <div aria-label="Choose a wallet card" className="wilds-wallet-card-selector">{filteredCards.slice(0, visibleLimit).map((card) => <button aria-pressed={selected?.id === card.id} key={card.id} onClick={() => { setSelectedId(card.id); setMessage(""); }} type="button"><span>{card.manifest.name}</span><small>{card.manifest.rarity} · Stage {card.manifest.stage}</small></button>)}</div>
      {selected ? <div className="wilds-wallet-card-detail">
        {onOpenVaultCard ? <div className="wilds-wallet-card-heading"><small>SELECTED CARD</small><button aria-label={`Open ${selected.manifest.name} in Card Vault`} className="wilds-wallet-vault-pill" onClick={() => onOpenVaultCard(selected.id)} type="button"><Icons.box aria-hidden="true" size={16} /><span>Vault</span></button></div> : null}
        <div className="wilds-wallet-card-stage"><WildsCardScene asset={selected} condition={cardConditions[selected.id]} origin={origin} qr="" tapToFlip /></div>
        <small>Tap or swipe the card to see its complete verified back.</small>
        <label><span>Send this exact card</span><input aria-label="Receiz username or email to send this card" autoCapitalize="none" autoCorrect="off" onChange={(event) => setTarget(event.target.value)} placeholder="@username or email" value={target} /></label>
        <button disabled={sending || !target.trim() || (!onSendCard && !onPrepareCard) || !normalizeWildsCardSendTarget(target)} onClick={() => { void sendSelectedCard(); }} type="button">{sending ? "Preparing verified card…" : `Send ${selected.manifest.name}`}</button>
        {onListCard ? <div className="wilds-wallet-resource-send"><label><span>Sell on Receiz Market</span><input aria-label="Card listing price in USD" inputMode="decimal" min="0.01" onChange={(event) => setPriceUsd(event.target.value)} placeholder="0.00" step="0.01" type="number" value={priceUsd} /></label><button disabled={listing || selected.status === "listed" || !Number.isFinite(Number(priceUsd)) || Number(priceUsd) <= 0} onClick={() => { void listSelectedCard(); }} type="button">{selected.status === "listed" ? "Already listed" : listing ? "Committing listing…" : `List ${selected.manifest.name}`}</button></div> : null}
        {message ? <p aria-live="polite">{message}</p> : null}
      </div> : null}
    </div> : filter === "creatures" && !cards.length ? <p>No creature cards are carried by this Receiz ID yet.</p> : null}
    {filteredResources.length ? <section aria-label="Verified world resources" className="wilds-wallet-resource-vault">
      <header><small>WORLD-BORN CUSTODY</small><strong>Harvested resources</strong></header>
      <div>{visibleResources.map((lot) => <article className={selectedResource?.lotId === lot.lotId ? "is-selected" : undefined} key={lot.lotId}>
        <span aria-hidden="true" className="wilds-wallet-resource-mark">✦</span>
        <div><strong>Living Honey</strong><small>{lot.quantity} sealed unit{lot.quantity === 1 ? "" : "s"} · Quality {lot.quality}</small><p>Harvested with a willing companion in a living grove.</p></div>
        <button aria-label={`Select exact Living Honey ${lot.lotId}`} aria-pressed={selectedResource?.lotId === lot.lotId} onClick={() => setSelectedResourceId(lot.lotId)} type="button">Select</button>
      </article>)}</div>
      {onSendResource && selectedResource ? <div className="wilds-wallet-resource-send"><small>Selected proof · {selectedResource.lotId.slice(-16)}</small><label><span>Send this exact resource</span><input aria-label="Receiz username to send Living Honey" autoCapitalize="none" autoCorrect="off" onChange={(event) => setResourceTarget(event.target.value)} placeholder="@username" value={resourceTarget} /></label><button disabled={resourceSending || !resourceTarget.trim()} onClick={() => { void sendResource(selectedResource); }} type="button">{resourceSending ? "Preparing claim…" : "Send selected Living Honey"}</button>{resourceMessage ? <p aria-live="polite">{resourceMessage}</p> : null}</div> : null}
    </section> : null}
    {filteredMaterials.length ? <section aria-label="Verified construction materials" className="wilds-wallet-resource-vault">
      <header><small>SOURCE-PROOF CUSTODY</small><strong>Building materials</strong></header>
      <div>{visibleMaterials.map((lot) => <article className={selectedMaterial?.lotId === lot.lotId ? "is-selected" : undefined} key={lot.lotId}>
        <span aria-hidden="true" className="wilds-wallet-resource-mark">{lot.kind === "timber" ? "⌁" : "◆"}</span>
        <div><strong>{lot.kind === "timber" ? "Living Timber" : "Foundation Stone"}</strong><small>1 exact unit · Quality {lot.quality}</small><p>Gathered with a willing companion from {lot.source.sourceId.slice(-18)}.</p></div>
        <button aria-label={`Select exact ${lot.kind} ${lot.lotId}`} aria-pressed={selectedMaterial?.lotId === lot.lotId} onClick={() => setSelectedMaterialId(lot.lotId)} type="button">Select</button>
      </article>)}</div>
      {selectedMaterial ? <><p className="wilds-wallet-material-proof">Selected {selectedMaterial.kind} proof · {selectedMaterial.lotId.slice(-20)} · VERIFIED</p>
        {onSendMaterial ? <div className="wilds-wallet-resource-send"><label><span>Send this exact unit</span><input aria-label={`Receiz username to send ${selectedMaterial.kind}`} autoCapitalize="none" autoCorrect="off" onChange={(event) => setResourceTarget(event.target.value)} placeholder="@username" value={resourceTarget} /></label><button disabled={resourceSending || !resourceTarget.trim()} onClick={() => { void sendMaterial(selectedMaterial); }} type="button">{resourceSending ? "Preparing claim…" : `Send selected ${selectedMaterial.kind}`}</button>{resourceMessage ? <p aria-live="polite">{resourceMessage}</p> : null}</div> : null}</> : null}
    </section> : null}
    {filteredCards.length + filteredMaterials.length + filteredResources.length > visibleLimit ? <button className="wilds-wallet-show-more" onClick={() => setVisibleLimit((value) => value + PAGE_SIZE)} type="button">Show {Math.min(PAGE_SIZE, filteredCards.length + filteredMaterials.length + filteredResources.length - visibleLimit)} more exact assets</button> : null}
  </section>;
}
