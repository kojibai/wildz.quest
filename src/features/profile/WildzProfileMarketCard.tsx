"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WildzMarketOwnedCard } from "../../lib/receiz/wildz-market-collection";
import type { WildzMarketServiceV128 } from "../market/wildz-market-service-v128";
import type { WildzMarketValueRead } from "../market/wildz-market-value";
import { WildzMarketOwnedDetail } from "../market/WildzMarketCommunity";
import { WildzMarketAssetInsights } from "../market/WildzMarketInsights";
import type { PortableCardAsset } from "../play/portable-card";
import { profileVaultCardImageUrl } from "./profile-vault-card";
import styles from "../market/WildzMarketSheet.module.css";

export function WildzProfileMarketCard({ card, active, focusChart, onBack, profileHandle, service, valueReader, initialValue, artwork, readCard }: {
  card: WildzMarketOwnedCard;
  active: boolean;
  focusChart: boolean;
  onBack(): void;
  profileHandle?: string;
  service: WildzMarketServiceV128 | null;
  valueReader: Pick<WildzMarketServiceV128, "readValue"> & { readDetails(id: string): Promise<WildzMarketValueRead> };
  initialValue?: WildzMarketValueRead;
  artwork?: string;
  readCard(card: WildzMarketOwnedCard, signal?: AbortSignal): Promise<PortableCardAsset>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const scrollToChart = useCallback(() => {
    const chart = root.current?.querySelector<HTMLElement>('[aria-label="Live proof value"]');
    chart?.focus({ preventScroll: true }); chart?.scrollIntoView({ block: "start" });
  }, []);
  const readDetails = useCallback(() => valueReader.readDetails(card.assetId), [valueReader, card.assetId]);
  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(() => {
      if (focusChart) scrollToChart(); else root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, focusChart, scrollToChart]);
  return <div ref={root} hidden={!active} inert={!active ? true : undefined} data-profile-market-card="" data-open={active || undefined} className={`wildz-market-sheet ${styles.sheet} wildz-profile-market-card`} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onBack(); }
  }}>
    <div className={styles.marketScroll} data-market-scroll><div className={styles.content}>
      <WildzMarketOwnedDetail card={card} service={service} busy={busy} onBack={onBack} onViewOwner={onBack} backLabel="Back to profile" onChart={scrollToChart}
        front={<Image alt={`${card.title} · complete creature card`} src={artwork ?? profileVaultCardImageUrl(card.assetId, profileHandle)} width={750} height={1050} unoptimized priority className={styles.cardArtwork} />}
        readCard={readCard} deferCardRead
        onOffer={async request => {
          if (!service?.makeOffer || busy) return;
          setBusy(true);
          try { const result = await service.makeOffer(request); setMessage(result.message); return result; }
          catch { setMessage("The offer could not be checked. Try again."); }
          finally { setBusy(false); }
        }} />
      {message ? <p className={styles.status} role="status">{message}</p> : null}
      <WildzMarketAssetInsights assetId={card.assetId} proofDigest={card.proofDigest} service={valueReader} readDetails={readDetails} initialValue={initialValue} active={active} sales={service?.snapshot().history ?? []} transfers={service?.snapshot().transfers ?? []} />
    </div></div>
  </div>;
}
