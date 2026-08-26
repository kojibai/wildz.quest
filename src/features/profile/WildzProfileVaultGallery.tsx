"use client";

import { canRestoreFocus } from "@/features/play/focus-recovery";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { WildsCard } from "@/features/play/WildsCard";
import { WildsCardScene } from "@/features/play/WildsCardScene";
import type { PublicWildzCard } from "@/features/profile/public-profile";
import { RotateCcw, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ownerProfileVaultAssets,
  parseProfileVaultPublicAsset,
  profileVaultCardImageUrl,
  profileVaultCardQrDataUrl
} from "./profile-vault-card";

type ViewerState = "idle" | "loading" | "ready" | "unavailable";

export function WildzProfileVaultGallery({ cards, ownerAssets }: {
  cards: readonly PublicWildzCard[];
  ownerAssets?: readonly PortableCardAsset[];
}) {
  const ownerAssetsById = useMemo(
    () => ownerProfileVaultAssets(cards, ownerAssets ?? []),
    [cards, ownerAssets]
  );
  const [selectedCard, setSelectedCard] = useState<PublicWildzCard | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PortableCardAsset | null>(null);
  const [selectedQr, setSelectedQr] = useState("");
  const [viewerState, setViewerState] = useState<ViewerState>("idle");
  const viewerRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLButtonElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const restoreFrameRef = useRef<number | null>(null);

  const closeViewer = useCallback((restoreFocus = true) => {
    requestRef.current?.abort();
    requestRef.current = null;
    setSelectedCard(null);
    setSelectedAsset(null);
    setViewerState("idle");
    if (!restoreFocus) return;
    if (restoreFrameRef.current !== null) window.cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = window.requestAnimationFrame(() => {
      restoreFrameRef.current = window.requestAnimationFrame(() => {
        restoreFrameRef.current = null;
        if (canRestoreFocus(originRef.current)) originRef.current.focus({ preventScroll: true });
      });
    });
  }, []);

  const openCard = useCallback(async (card: PublicWildzCard, origin: HTMLButtonElement) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    originRef.current = origin;
    setSelectedCard(card);
    const localAsset = ownerAssetsById.get(card.id) ?? null;
    if (localAsset) {
      setSelectedAsset(localAsset);
      setViewerState("ready");
      requestRef.current = null;
      return;
    }
    setSelectedAsset(null);
    setViewerState("loading");
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(card.id)}`, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error("wildz_profile_card_unavailable");
      const asset = parseProfileVaultPublicAsset(card, await response.json());
      if (!asset) throw new Error("wildz_profile_card_unverified");
      if (requestRef.current !== controller) return;
      setSelectedAsset(asset);
      setViewerState("ready");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setViewerState("unavailable");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [ownerAssetsById]);

  useEffect(() => {
    if (!selectedCard) return;
    const focusable = () => Array.from(viewerRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter(canRestoreFocus);
    const focusFrame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeViewer();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeViewer, selectedCard]);

  useEffect(() => {
    let current = true;
    setSelectedQr("");
    if (selectedAsset) {
      void profileVaultCardQrDataUrl(selectedAsset.id, window.location.origin)
        .then((qr) => { if (current) setSelectedQr(qr); })
        .catch(() => undefined);
    }
    return () => { current = false; };
  }, [selectedAsset]);

  useEffect(() => () => {
    requestRef.current?.abort();
    if (restoreFrameRef.current !== null) window.cancelAnimationFrame(restoreFrameRef.current);
  }, []);

  return <section className="wildz-profile-vault-gallery" aria-label="Published companion cards">
    <header className="wildz-profile-vault-heading">
      <span>Published Vault</span>
      <strong>{cards.length} verified card{cards.length === 1 ? "" : "s"}</strong>
    </header>
    <div aria-hidden={selectedCard ? true : undefined} className="wildz-profile-card-grid" inert={selectedCard ? true : undefined}>
      {cards.map((card) => {
        const localAsset = ownerAssetsById.get(card.id);
        return <button
          aria-label={`Open ${card.name} card`}
          className="wildz-profile-card-tile"
          key={card.id}
          onClick={(event) => void openCard(card, event.currentTarget)}
          type="button"
        >
          {localAsset
            ? <div className="wildz-profile-card-local" aria-label={`${card.name} card front`}><WildsCard asset={localAsset} compact interactive={false} /></div>
            : <Image
              alt={`${card.name} card front`}
              height={700}
              loading="lazy"
              src={profileVaultCardImageUrl(card.id)}
              unoptimized
              width={500}
            />}
          <span><strong>{card.name}</strong><small>{card.status ?? "verified"}</small></span>
        </button>;
      })}
    </div>
    {!cards.length ? <p className="wildz-sheet-empty">No published companion cards yet.</p> : null}
    {selectedCard ? <div
      aria-label={`${selectedCard.name} complete card viewer`}
      aria-modal="true"
      className="wildz-profile-card-viewer"
      data-profile-card-viewer=""
      ref={viewerRef}
      role="dialog"
    >
      <header>
        <span><ShieldCheck aria-hidden="true" size={17} /> Verified Vault card</span>
        <strong>{selectedCard.name}</strong>
        <button aria-label="Close complete card" onClick={() => closeViewer()} type="button"><X aria-hidden="true" size={20} /></button>
      </header>
      <div className="wildz-profile-card-viewer-body">
        {viewerState === "loading" ? <div className="wildz-profile-card-state" role="status"><RotateCcw aria-hidden="true" size={24} /><strong>Recovering verified card…</strong></div> : null}
        {viewerState === "unavailable" ? <div className="wildz-profile-card-state" role="status"><ShieldCheck aria-hidden="true" size={24} /><strong>Verified card unavailable</strong><span>The public proof could not be recovered right now.</span></div> : null}
        {selectedAsset ? <WildsCardScene
          asset={selectedAsset}
          origin={window.location.origin}
          qr={selectedQr}
          tapToFlip
        /> : null}
      </div>
      <p>Tap or swipe sideways to turn the card. Scroll the back naturally.</p>
    </div> : null}
  </section>;
}
