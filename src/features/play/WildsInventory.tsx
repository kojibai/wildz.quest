"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Icons } from "@/components/icons";
import { creatureForm } from "./creature-catalog";
import { downloadPortableCard, downloadPortableVault, standaloneCardUrl, verifyPortableCardPng, verifyPortableVaultPng } from "./card-export";
import type { PlayState, WildsInput } from "./game-state";
import { WildsCardScene } from "./WildsCardScene";
import { WildsGrowthPanel } from "./WildsGrowthPanel";
import { clampInventoryPage, inventoryPageSize } from "./inventory-pagination";

export function WildsInventory({
  state,
  onInput,
  onListAsset
}: {
  state: PlayState;
  onInput: (input: WildsInput) => void;
  onListAsset?: (asset: PlayState["inventory"][number], priceCents: number) => Promise<PlayState["inventory"][number] | null>;
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
  const importInput = useRef<HTMLInputElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressCardClick = useRef(false);
  const matches = useMemo(() => state.inventory.filter((asset) => {
    const form = creatureForm(asset.manifest.formId);
    if (!form) return false;
    const haystack = `${form.name} ${form.species} ${form.habitat} ${form.abilities.map((ability) => ability.name).join(" ")} ${form.cardNumber}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (rarity === "all" || form.rarity === rarity);
  }), [query, rarity, state.inventory]);
  const pageSize = inventoryPageSize(compact);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const safePage = clampInventoryPage(page, matches.length, pageSize);
  const visible = matches.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const selected = state.inventory.find((asset) => asset.id === selectedId) ?? visible[0] ?? state.inventory[0];
  const selectedForm = selected ? creatureForm(selected.manifest.formId) : null;
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

  return (
    <section className="wilds-inventory" aria-label="Portable creature card inventory">
      <header>
        <div><span>Portable collection</span><h3>Wilds Inventory</h3><p>{state.inventory.length} sealed forms · unlimited unique variants</p></div>
        <div className="wilds-vault-actions">
          <button aria-label="Import card or vault" className="wilds-import-card" onClick={() => importInput.current?.click()} title="Import card or vault" type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v11m0-11L8 7m4-4 4 4M5 13v6h14v-6" /></svg>
            <span>Import card or vault</span>
          </button>
          <button
            aria-label="Save vault image"
            className="wilds-import-card vault"
            disabled={!state.inventory.length}
            onClick={async () => {
              setVaultMessage("Preparing portable vault image…");
              try {
                await downloadPortableVault(state.inventory);
                setVaultMessage("Vault image saved with every verified card sealed inside.");
              } catch (error) {
                setVaultMessage(error instanceof Error ? `Vault save failed: ${error.message}` : "Vault save failed. Try again from this browser.");
              }
            }}
            title="Save vault image"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16v13H4zM8 6V4h8v2m-4 3v6m0 0-3-3m3 3 3-3" /></svg>
            <span>Save vault image</span>
          </button>
          <button aria-label="Fuse cards" className="wilds-import-card fusion" disabled={state.inventory.length < 2} onClick={() => setFusionOpen((value) => !value)} title="Fuse cards" type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 7h5l2 3 2-3h5M5 17h5l2-3 2 3h5" /></svg>
            <span>Fuse cards</span>
          </button>
        </div>
        <input
          ref={importInput}
          accept="image/png,.png"
          className="wilds-import-input"
          multiple
          onChange={async (event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            let imported = 0;
            let rejected = 0;
            for (const file of files) {
              const bytes = new Uint8Array(await file.arrayBuffer());
              const verifiedCard = verifyPortableCardPng(bytes);
              const verifiedVault = verifiedCard.ok ? null : verifyPortableVaultPng(bytes);
              const assets = verifiedCard.ok && verifiedCard.asset ? [verifiedCard.asset] : verifiedVault?.ok ? verifiedVault.assets : [];
              if (!assets.length) { rejected += 1; continue; }
              assets.forEach((asset) => onInput({ type: "import-card", asset }));
              setSelectedId(assets.at(-1)!.id);
              imported += assets.length;
            }
            event.currentTarget.value = "";
            setImportMessage(imported
              ? `${imported} verified card${imported === 1 ? "" : "s"} added${rejected ? ` · ${rejected} rejected` : ""}.`
              : "No card was added. Only an untampered Receiz sealed PNG can enter the game.");
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
            return <button aria-pressed={selected?.id === asset.id} key={asset.id} onClick={() => { if (suppressCardClick.current) { suppressCardClick.current = false; return; } setSelectedId(asset.id); }} type="button"><span style={{ background: asset.manifest.variant.traits.palette.primary }}>{asset.manifest.name.slice(0, 2).toUpperCase()}</span><strong>{asset.manifest.name}</strong><small>Stage {form.stage} · {form.rarity}</small><b>{asset.status === "sealed_local" ? "Offline sealed" : "Verified"}</b></button>;
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
          <aside className="wilds-inventory-detail">
            <WildsCardScene asset={selected} origin={origin} qr={qr} />
            <div className="wilds-inventory-actions">
              <button className="button button-primary" disabled={state.selectedAssetId === selected.id} onClick={() => onInput({ type: "select-asset", assetId: selected.id })} type="button">{state.selectedAssetId === selected.id ? "Active deck leader" : "Set as active deck leader"}</button>
              <Link className="button button-outline" href={`/cards/${encodeURIComponent(selected.id)}`}>Open standalone card page</Link>
              <button
                className="button button-outline"
                onClick={async () => {
                  setDownloadMessage("Publishing verified card link…");
                  try {
                    const result = await downloadPortableCard(selected);
                    setDownloadMessage(result.published
                      ? "Portable PNG downloaded. Its QR opens this verified card from another device."
                      : "Portable PNG downloaded and verifies offline. Connect Receiz ID to publish its short QR link across devices.");
                  } catch (error) {
                    setDownloadMessage(error instanceof Error
                      ? `Card download failed: ${error.message}`
                      : "Card download failed. Try again from this browser.");
                  }
                }}
                type="button"
              >Save card image</button>
              {onListAsset && selected.status !== "listed" ? (
                <div className="wilds-listing-control">
                  <label>List price <span>$</span><input aria-label="Wilds card listing price" inputMode="decimal" min="0.01" onChange={(event) => setPriceUsd(event.target.value)} step="0.01" type="number" value={priceUsd} /></label>
                  <button
                    className="button button-outline"
                    disabled={listing || !Number.isFinite(Number(priceUsd)) || Number(priceUsd) <= 0}
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
              {next ? <button className="button button-outline" disabled={!canEvolve} onClick={() => onInput({ type: "evolve", assetId: selected.id, evolvedAt: new Date().toISOString() })} type="button">{canEvolve ? `Evolve into ${next.name}` : `Needs L${next.evolution.level} · Bond ${next.evolution.bond}`}</button> : <span className="wilds-apex-label">Apex form reached</span>}
              {downloadMessage ? <p aria-live="polite">{downloadMessage}</p> : null}
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
