"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Icons } from "@/components/icons";
import { sortWildzCards, type WildzCardSort } from "./card-sort";
import { creatureForm } from "./creature-catalog";
import {
  createReceizProofObjectArtifact,
  createWildsCardSendDraft,
  downloadBlob,
  downloadPortableCard,
  portableCardPngBlob,
  portableCreatureFilename,
  standaloneCardUrl
} from "./card-export";
import type { PlayState, WildsInput } from "./game-state";
import type { WildsPlayerVaultPayload } from "./wilds-player-vault";
import { WildsCardScene } from "./WildsCardScene";
import { WildsGrowthPanel } from "./WildsGrowthPanel";
import { clampInventoryPage, inventoryPageSize } from "./inventory-pagination";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";
import { WildsVerifiedBadge } from "./WildsVerifiedBadge";
import { currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type {
  WildzCardOnlyConfirmation,
  WildzCommittedArtifactRestore
} from "@/features/identity/wildz-restore";

export function WildsInventory({
  state,
  cardOrder,
  onCardOrderChange,
  playerVault,
  onExportVault,
  onInput,
  onListAsset,
  onRestoreArtifact
}: {
  state: PlayState;
  cardOrder: WildzCardSort;
  onCardOrderChange: (order: WildzCardSort) => void;
  playerVault: () => WildsPlayerVaultPayload;
  onExportVault: (assets: PlayState["inventory"], player: WildsPlayerVaultPayload) => Promise<unknown>;
  onInput: (input: WildsInput) => void;
  onListAsset?: (asset: PlayState["inventory"][number], priceCents: number) => Promise<PlayState["inventory"][number] | null>;
  onRestoreArtifact: (
    file: File,
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState: PlayState
  ) => Promise<WildzCommittedArtifactRestore>;
}) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(state.inventory.at(-1)?.id ?? "");
  const [priceUsd, setPriceUsd] = useState("25.00");
  const [listing, setListing] = useState(false);
  const [listingMessage, setListingMessage] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [vaultMessage, setVaultMessage] = useState("");
  const [fusionOpen, setFusionOpen] = useState(false);
  const [fusionParentB, setFusionParentB] = useState("");
  const [compact, setCompact] = useState(false);
  const [origin, setOrigin] = useState("https://receiz.app");
  const [qr, setQr] = useState("");
  const [importing, setImporting] = useState(false);
  const [vaultSaving, setVaultSaving] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardSending, setCardSending] = useState(false);
  const [sendTarget, setSendTarget] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressCardClick = useRef(false);
  const matches = useMemo(() => sortWildzCards(state.inventory.filter((asset) => {
    const form = creatureForm(asset.manifest.formId);
    if (!form) return false;
    const haystack = `${form.name} ${form.species} ${form.habitat} ${form.abilities.map((ability) => ability.name).join(" ")} ${form.cardNumber}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (rarity === "all" || form.rarity === rarity);
  }), cardOrder), [cardOrder, query, rarity, state.inventory]);
  const pageSize = inventoryPageSize(compact);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const safePage = clampInventoryPage(page, matches.length, pageSize);
  const visible = matches.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const selected = state.inventory.find((asset) => asset.id === selectedId) ?? visible[0] ?? state.inventory[0];
  const selectedForm = selected ? creatureForm(selected.manifest.formId) : null;
  const selectedRetired = Boolean(selected && (
    state.adventureConditions[selected.id]?.life === "dead"
    || (isLivingCardAsset(selected) && currentRevision(selected).growth.life?.retired)
  ));
  const progress = selectedForm ? state.companionProgress[selectedForm.familyId] ?? { level: 1, xp: 0, bond: 0 } : null;
  const next = selectedForm && selectedForm.stage < 3 ? creatureForm(`${selectedForm.familyId}-${selectedForm.stage + 1}`) : null;
  const canEvolve = Boolean(next && progress && progress.level >= next.evolution.level && progress.bond >= next.evolution.bond);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPage((current) => clampInventoryPage(current, matches.length, pageSize));
  }, [matches.length, pageSize]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!selected) {
      setQr("");
      return;
    }
    let active = true;
    void QRCode.toDataURL(standaloneCardUrl(selected.id, origin), { errorCorrectionLevel: "M", margin: 4, width: 160 })
      .then((value) => { if (active) setQr(value); })
      .catch(() => { if (active) setQr(""); });
    return () => { active = false; };
  }, [origin, selected]);

  const changePage = (nextPage: number) => setPage(clampInventoryPage(nextPage, matches.length, pageSize));
  const endSwipe = (target: HTMLElement, pointerId: number) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    if (!start) return;
    const dx = (target as HTMLElement).dataset.swipeX ? Number((target as HTMLElement).dataset.swipeX) - start.x : 0;
    const dy = (target as HTMLElement).dataset.swipeY ? Number((target as HTMLElement).dataset.swipeY) - start.y : 0;
    delete (target as HTMLElement).dataset.swipeX;
    delete (target as HTMLElement).dataset.swipeY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    suppressCardClick.current = true;
    changePage(page + (dx < 0 ? 1 : -1));
  };
  const sendPortableCardToTarget = async () => {
    if (!selected) return;
    setCardSending(true);
    setSendMessage("Preparing verified card send package…");
    try {
      const draft = createWildsCardSendDraft(selected, sendTarget, origin);
      const payload = await portableCardPngBlob(selected);
      const artifact = await createReceizProofObjectArtifact(
        payload,
        `${portableCreatureFilename(selected.manifest.name)}.png`,
        "card"
      );
      const blob = new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType });
      const file = new File([blob], artifact.filename, { type: artifact.mimeType });
      const shareData: ShareData = {
        title: draft.title,
        text: draft.text,
        url: draft.url,
        files: [file]
      };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setSendMessage(`Card send package opened for ${draft.target.label}.`);
        return;
      }
      downloadBlob(blob, artifact.filename);
      if (draft.href.startsWith("mailto:")) {
        window.location.href = draft.href;
        setSendMessage(`Card image downloaded. Email compose opened for ${draft.target.label}. Attach the downloaded image if your mail app did not attach it automatically.`);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draft.text);
        setSendMessage(`Card image downloaded. Send text copied for ${draft.target.label}.`);
        return;
      }
      setSendMessage(`Card image downloaded. Send it to ${draft.target.label} with this link: ${draft.url}`);
    } catch (error) {
      setSendMessage(error instanceof Error ? `Card send failed: ${error.message}` : "Card send failed. Try again.");
    } finally {
      setCardSending(false);
    }
  };

  const saveVerifiedVault = async () => {
    setVaultSaving(true);
      setVaultMessage("Sealing the Vault for the active Receiz ID…");
    try {
      const player = playerVault();
      await onExportVault(state.inventory, player);
      setVaultMessage("Receiz-sealed Vault downloaded for SDK v113 offline verification.");
    } catch (error) {
      setVaultMessage(error instanceof Error ? `Vault save failed: ${error.message}` : "Vault save failed. Try again from this browser.");
    } finally {
      setVaultSaving(false);
    }
  };

  const saveVerifiedCard = async (asset: PlayState["inventory"][number]) => {
    setCardSaving(true);
    setDownloadMessage("Sealing the card for the active Receiz ID…");
    try {
      setDownloadMessage("Publishing and sealing the verified card…");
      await downloadPortableCard(asset);
      setDownloadMessage("Receiz-sealed card downloaded. Its standalone page is anonymously readable.");
    } catch (error) {
      setDownloadMessage(error instanceof Error
        ? `Card download failed: ${error.message}`
        : "Card download failed. Try again from this browser.");
    } finally {
      setCardSaving(false);
    }
  };

  return (
    <section className="wilds-inventory" aria-label="Portable creature card inventory">
      <header className="wilds-vault-compact-header">
        <div><span>Portable collection</span><h3>Wilds Inventory</h3><p>{state.inventory.length} sealed forms · unlimited unique variants</p></div>
        <div className="wilds-vault-actions">
          <button aria-busy={importing} aria-label="Import card or vault" className={`wilds-import-card wilds-action-feedback${importing ? " wilds-action-busy" : ""}`} disabled={importing} onClick={() => importInput.current?.click()} title="Import card or vault" type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v11m0-11L8 7m4-4 4 4M5 13v6h14v-6" /></svg>
            <span>Import card or vault</span>
          </button>
          <button
            aria-label="Save verified vault"
            aria-busy={vaultSaving}
            className={`wilds-import-card vault wilds-action-feedback${vaultSaving ? " wilds-action-busy" : ""}`}
            disabled={!state.inventory.length || vaultSaving}
            onClick={() => { void saveVerifiedVault(); }}
            title="Save verified vault"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16v13H4zM8 6V4h8v2m-4 3v6m0 0-3-3m3 3 3-3" /></svg>
            <span>Save verified vault</span>
          </button>
          <button aria-label="Fuse cards" className="wilds-import-card fusion wilds-action-feedback" disabled={state.inventory.length < 2} onClick={() => setFusionOpen((value) => !value)} title="Fuse cards" type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 7h5l2 3 2-3h5M5 17h5l2-3 2 3h5" /></svg>
            <span>Fuse cards</span>
          </button>
        </div>
        <input
          ref={importInput}
          accept="image/png,.png,.receized.png,.receizvault,application/vnd.receiz.vault+zip,application/zip"
          className="wilds-import-input"
          disabled={importing}
          multiple
          onChange={async (event) => {
            const input = event.currentTarget;
            const files = Array.from(event.currentTarget.files ?? []);
            let imported = 0;
            let rejected = 0;
            let rejectionMessage = "";
            let currentPlayState = state;
            setImporting(true);
            try {
              for (const file of files) {
                try {
                  const outcome = await onRestoreArtifact(file, () => window.confirm(
                    "Add every verified card from this file to the current Vault? The combined Vault stays tied to the Identity Seal used when you save it."
                  ), currentPlayState);
                  currentPlayState = outcome.playState;
                  imported += outcome.verifiedAssetIds.length;
                  const selected = outcome.verifiedAssetIds.at(-1);
                  if (selected) setSelectedId(selected);
                } catch (cause) {
                  rejected += 1;
                  if (!rejectionMessage && cause instanceof Error) rejectionMessage = cause.message;
                }
              }
            } finally {
              input.value = "";
              setImporting(false);
            }
            setImportMessage(imported
              ? `${imported} verified card${imported === 1 ? "" : "s"} added${rejected ? ` · ${rejected} rejected` : ""}.`
              : rejectionMessage || "No card was added. Choose a Receiz sealed card, vault image, or Receiz Vault package.");
          }}
          type="file"
        />
        {importMessage ? <p className="wilds-import-message" role="status">{importMessage}</p> : null}
        {vaultMessage ? <p className="wilds-import-message" role="status">{vaultMessage}</p> : null}
      </header>
      {fusionOpen ? (
        <section className="wilds-fusion-sheet" aria-label="Create a fusion child">
          <div><span>Earned creation</span><strong>{state.fusionSparks} Fusion Spark{state.fusionSparks === 1 ? "" : "s"}</strong><p>Both parents stay in your vault. Each rests for 24 hours after creating a child.</p></div>
          <label>Parent A<strong>{selected?.manifest.name ?? "Select a card below"}</strong></label>
          <label>Parent B<select aria-label="Second fusion parent" onChange={(event) => setFusionParentB(event.target.value)} value={fusionParentB}><option value="">Choose a different card…</option>{state.inventory.filter((asset) => asset.id !== selected?.id).map((asset) => <option key={asset.id} value={asset.id}>{asset.manifest.name} · {asset.manifest.variant.traits.visualFingerprint}</option>)}</select></label>
          <button
            className="button button-primary"
            disabled={!selected || !fusionParentB || state.fusionSparks < 1}
            onClick={() => {
              if (!selected || !fusionParentB) return;
              onInput({ type: "fuse-cards", parentAId: selected.id, parentBId: fusionParentB, inheritance: "balanced", fusedAt: new Date().toISOString() });
              setFusionParentB("");
              setFusionOpen(false);
            }}
            type="button"
          >Create unique child</button>
        </section>
      ) : null}
      <div className="wilds-inventory-toolbar">
        <input aria-label="Search creature cards" onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search creatures, habitats, abilities…" type="search" value={query} />
        <select aria-label="Filter card rarity" onChange={(event) => { setRarity(event.target.value); setPage(0); }} value={rarity}>
          <option value="all">All rarities</option><option value="trail">Trail</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="mythic">Mythic</option><option value="eternal">Eternal</option>
        </select>
        <select aria-label="Sort card vault" onChange={(event) => { onCardOrderChange(event.target.value as WildzCardSort); setPage(0); }} value={cardOrder}>
          <option value="rarity">Rarity</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>
      <div className="wilds-inventory-layout">
        <div
          className="wilds-inventory-page"
          onLostPointerCapture={(event) => { swipeStart.current = null; delete event.currentTarget.dataset.swipeX; delete event.currentTarget.dataset.swipeY; }}
          onPointerCancel={(event) => { swipeStart.current = null; delete event.currentTarget.dataset.swipeX; delete event.currentTarget.dataset.swipeY; }}
          onPointerDown={(event) => {
            swipeStart.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!swipeStart.current) return;
            event.currentTarget.dataset.swipeX = String(event.clientX);
            event.currentTarget.dataset.swipeY = String(event.clientY);
          }}
          onPointerUp={(event) => endSwipe(event.currentTarget, event.pointerId)}
          role="region"
          aria-label={`Vault page ${safePage + 1} of ${pages}`}
        >
        <div className="wilds-inventory-grid">
          {visible.map((asset) => {
            const form = creatureForm(asset.manifest.formId)!;
            const cardProgress = state.companionProgress[asset.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
            const retired = state.adventureConditions[asset.id]?.life === "dead"
              || (isLivingCardAsset(asset) && Boolean(currentRevision(asset).growth.life?.retired));
            return <button aria-pressed={selected?.id === asset.id} className={retired ? "is-retired" : ""} key={asset.id} onClick={() => { if (suppressCardClick.current) { suppressCardClick.current = false; return; } setSelectedId(asset.id); }} type="button">
              <WildsCreatureThumbnail asset={asset} />
              <span className="wilds-inventory-card-xp">{cardProgress.xp} XP</span>
              <strong className="wilds-creature-name"><span>{asset.manifest.name}</span><WildsVerifiedBadge /></strong>
              <small>Stage {form.stage} · {form.rarity} · Bond {cardProgress.bond}</small>
              <b>{retired ? "Retired memorial · permanently unplayable" : `${asset.manifest.stats.power} PWR · ${asset.status === "sealed_local" ? "Offline sealed" : "Verified"}`}</b>
            </button>;
          })}
          {!visible.length ? <p className="wilds-inventory-empty">No collected cards match this search.</p> : null}
        </div>
        <div className="wilds-vault-page-controls" aria-label="Vault pages">
          <button aria-label="Previous vault page" disabled={safePage === 0} onClick={() => changePage(safePage - 1)} type="button"><Icons.chevronLeft aria-hidden="true" size={17} /></button>
          <div className="wilds-vault-page-dots">
            {Array.from({ length: pages }, (_, index) => <button aria-label={`Go to vault page ${index + 1}`} aria-pressed={safePage === index} key={index} onClick={() => changePage(index)} type="button"><span /></button>)}
          </div>
          <button aria-label="Next vault page" disabled={safePage + 1 >= pages} onClick={() => changePage(safePage + 1)} type="button"><Icons.chevronRight aria-hidden="true" size={17} /></button>
        </div>
        </div>
        {selected && selectedForm ? (
          <aside className={`wilds-inventory-detail${selectedRetired ? " is-retired" : ""}`}>
            {selectedRetired ? <div className="wilds-vault-card-memorial"><WildsCardScene asset={selected} condition={state.adventureConditions[selected.id]} origin={origin} qr={qr} /><strong>Retired memorial · swipe to view death record</strong></div> : <WildsCardScene asset={selected} condition={state.adventureConditions[selected.id]} origin={origin} qr={qr} />}
            <div className="wilds-inventory-actions">
              <button className="button button-primary" disabled={selectedRetired || state.selectedAssetId === selected.id} onClick={() => onInput({ type: "select-asset", assetId: selected.id })} type="button">{selectedRetired ? "Retired · cannot enter game" : state.selectedAssetId === selected.id ? "Active deck leader" : "Set as active deck leader"}</button>
              <Link className="button button-outline" href={`/cards/${encodeURIComponent(selected.id)}`}>Open standalone card page</Link>
              <button
                aria-busy={cardSaving}
                className={`button button-outline wilds-action-feedback${cardSaving ? " wilds-action-busy" : ""}`}
                disabled={cardSaving || selectedRetired}
                onClick={() => { void saveVerifiedCard(selected); }}
                type="button"
              ><span hidden={selectedRetired}>Save verified card</span><span hidden={!selectedRetired}>Memorial card cannot be saved</span></button>
              <div className="wilds-card-send-control">
                <label>
                  <span>Send card</span>
                  <input
                    aria-label="Receiz username or email to send this card"
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="email"
                    onChange={(event) => setSendTarget(event.target.value)}
                    placeholder="@username or email"
                    type="text"
                    value={sendTarget}
                  />
                </label>
                <button
                  aria-busy={cardSending}
                  className={`button button-outline wilds-action-feedback${cardSending ? " wilds-action-busy" : ""}`}
                  disabled={selectedRetired || cardSending || !sendTarget.trim()}
                  onClick={sendPortableCardToTarget}
                  type="button"
                >{cardSending ? "Preparing…" : "Send card"}</button>
              </div>
              {onListAsset && selected.status !== "listed" ? (
                <div className="wilds-listing-control">
                  <label>List price <span>$</span><input aria-label="Wilds card listing price" inputMode="decimal" min="0.01" onChange={(event) => setPriceUsd(event.target.value)} step="0.01" type="number" value={priceUsd} /></label>
                  <button
                    className="button button-outline"
                    disabled={selectedRetired || listing || !Number.isFinite(Number(priceUsd)) || Number(priceUsd) <= 0}
                    onClick={async () => {
                      setListing(true);
                      setListingMessage("Running Receiz offline verifier…");
                      const listed = await onListAsset(selected, Math.round(Number(priceUsd) * 100));
                      setListing(false);
                      if (!listed?.synchronizedAt) {
                        setListingMessage("Card was not listed. Check your Receiz ID and try again.");
                        return;
                      }
                      onInput({ type: "mark-listed", assetId: selected.id, synchronizedAt: listed.synchronizedAt });
                      setListingMessage("Verified and listed on this Exchange.");
                    }}
                    type="button"
                  >{listing ? "Verifying…" : "Verify + list on Exchange"}</button>
                </div>
              ) : selected.status === "listed" ? <span className="wilds-apex-label">Listed on Exchange</span> : null}
              {next ? <button className="button button-outline" disabled={selectedRetired || !canEvolve} onClick={() => onInput({ type: "evolve", assetId: selected.id, evolvedAt: new Date().toISOString() })} type="button">{selectedRetired ? "Retired creatures cannot evolve" : canEvolve ? `Evolve into ${next.name}` : `Needs L${next.evolution.level} · Bond ${next.evolution.bond}`}</button> : <span className="wilds-apex-label">{selectedRetired ? "Retired memorial" : "Apex form reached"}</span>}
              {downloadMessage ? <p aria-live="polite">{downloadMessage}</p> : null}
              {sendMessage ? <p aria-live="polite">{sendMessage}</p> : null}
              {listingMessage ? <p aria-live="polite">{listingMessage}</p> : null}
            </div>
            <WildsGrowthPanel
              asset={selected}
              catalystIds={state.ascensionCatalysts}
              now={new Date().toISOString()}
              onAscend={() => onInput({ type: "ascend-card", assetId: selected.id, at: new Date().toISOString() })}
              progress={state.livingProgress[selected.id] ?? null}
            />
          </aside>
        ) : null}
      </div>
      <footer><span>Page {safePage + 1} of {pages}</span></footer>
    </section>
  );
}
