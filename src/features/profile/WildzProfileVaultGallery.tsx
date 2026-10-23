"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { WildsCard } from "@/features/play/WildsCard";
import type { WildzMarketOwnedCard } from "@/lib/receiz/wildz-market-collection";
import type { WildzMarketServiceV128 } from "../market/wildz-market-service-v128";
import { CardValue } from "../market/WildzMarketCardValue";
import { createWildzMarketValueBrowserPortV129 } from "../market/wildz-market-value-browser-v129";
import { wildzMarketValueChange, type WildzMarketValueRead } from "../market/wildz-market-value";
import { DeferredProfileCardPreview } from "./DeferredProfileCardPreview";
import { WildzProfileMarketCard } from "./WildzProfileMarketCard";
import type { PublicWildzCard } from "./public-profile";
import type { WildzProfilePageSeed } from "./profile-page-seed";
import { ownerProfileVaultAssets, parseProfileVaultPublicAsset, profileVaultCardImageUrl } from "./profile-vault-card";

type DisplayValue = Pick<WildzMarketOwnedCard, "value" | "valueUnavailable"> & { digest: string };
const summary = (digest: string, result: WildzMarketValueRead): DisplayValue => ({ digest, ...(result.status === "ready" ? { value: {
  proofValuePhiMicro: result.value.proofValuePhiMicro, displayUsdCents: result.value.displayUsdCents,
  valuationKaiUPulse: result.value.valuationKaiUPulse, algorithm: result.value.algorithm,
  changeBps: wildzMarketValueChange(result.value.samples, result.value.displayUsdCents === null ? "phi" : "usd")
} } : { valueUnavailable: result.message }) });
const exactValue = (card: PublicWildzCard, value?: WildzMarketValueRead) => value?.status === "ready" && value.value.assetId === card.id && value.value.proofDigest === card.proofDigest ? value : undefined;
const closedValue = (): Promise<WildzMarketValueRead> => Promise.resolve({ status: "unavailable", message: "Open the profile to refresh this value." });

export const WildzProfileVaultGallery = memo(function WildzProfileVaultGallery({ cards, ownerAssets, profileHandle, active = true, initialSeed, marketService = null }: {
  cards: readonly PublicWildzCard[];
  profileHandle?: string;
  ownerAssets?: readonly PortableCardAsset[];
  active?: boolean;
  initialSeed?: WildzProfilePageSeed;
  marketService?: WildzMarketServiceV128 | null;
}) {
  const galleryRef = useRef<HTMLElement>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<{ node: HTMLElement; top: number }[]>([]);
  const ownerAssetsById = useMemo(() => ownerProfileVaultAssets(cards, ownerAssets ?? []), [cards, ownerAssets]);
  const seedAssets = useMemo(() => ownerProfileVaultAssets(cards, initialSeed?.cards ?? []), [cards, initialSeed]);
  const collection = useMemo(() => new Map(cards.map(card => [card.id, {
    assetId: card.id, title: card.name, proofDigest: card.proofDigest, ownerHandle: profileHandle ?? "",
    claimKaiUPulse: null, claimHead: null, asset: ownerAssetsById.get(card.id) ?? seedAssets.get(card.id)
  } satisfies WildzMarketOwnedCard])), [cards, ownerAssetsById, seedAssets, profileHandle]);
  const currentCollection = useRef(collection); currentCollection.current = collection;
  const recovered = useRef(new Map<string, PortableCardAsset>());
  const projections = useRef(new Map<string, WildzMarketValueRead>());
  const assetReaderRef = useRef<((id: string) => Promise<PortableCardAsset | null>) | null>(null);
  const readPreparedCard = useCallback(async (card: WildzMarketOwnedCard, signal?: AbortSignal) => {
    const asset = card.asset ?? recovered.current.get(`${card.assetId}:${card.proofDigest}`) ?? await assetReaderRef.current?.(card.assetId);
    if (signal?.aborted) throw new DOMException("Card reading was cancelled.", "AbortError");
    if (!asset || asset.id !== card.assetId || asset.proof.digest !== card.proofDigest) throw Error("This exact profile card could not be loaded.");
    return asset;
  }, []);
  const readerRef = useRef<{ readValue(assetId: string): Promise<WildzMarketValueRead> } | null>(null);
  const reader = useMemo(() => ({ readValue: (id: string) => readerRef.current?.readValue(id) ?? closedValue() }), []);
  const [values, setValues] = useState<ReadonlyMap<string, DisplayValue>>(() => new Map(cards.flatMap(card => {
    const value = exactValue(card, initialSeed?.values[card.id]);
    return value ? [[card.id, summary(card.proofDigest, value)] as const] : [];
  })));
  const [selected, setSelected] = useState<{ id: string; digest: string; chart: boolean } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const selectedEntry = selected ? cards.find(card => card.id === selected.id && card.proofDigest === selected.digest) : undefined;
  const showingDetail = active && detailOpen && Boolean(selectedEntry);
  const restoreProfile = useCallback(() => {
    setDetailOpen(false);
    const restore = () => {
      for (const { node, top } of scrollRef.current) node.scrollTop = top;
      if (originRef.current?.isConnected) originRef.current.focus({ preventScroll: true });
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(restore); else restore();
  }, []);
  const backToProfile = useCallback(() => {
    if (window.history?.state?.wildzProfileCard?.profile === profileHandle) window.history.back();
    else {
      if (window.history?.replaceState && new URLSearchParams(window.location.hash?.slice(1) ?? "").has("market-card")) {
        const url = new URL(window.location.href); url.hash = "";
        window.history.replaceState(window.history.state, "", url);
      }
      restoreProfile();
    }
  }, [profileHandle, restoreProfile]);
  const openCard = (card: PublicWildzCard, chart: boolean, origin?: HTMLElement) => {
    originRef.current = origin ?? (typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
    scrollRef.current = [galleryRef.current?.closest<HTMLElement>(".wildz-profile-sheet"), galleryRef.current?.closest<HTMLElement>(".wildz-public-profile-page")]
      .flatMap(node => node ? [{ node, top: node.scrollTop }] : []);
    const selection = { id: card.id, digest: card.proofDigest, chart };
    setSelected(selection); setDetailOpen(true);
    if (window.history?.pushState) {
      const url = new URL(window.location.href); url.hash = `market-card=${encodeURIComponent(card.id)}`;
      window.history.pushState({ ...window.history.state, wildzProfileCard: { profile: profileHandle, ...selection } }, "", url);
    }
  };
  useEffect(() => {
    if (!active) { setDetailOpen(false); return; }
    const pop = () => {
      const entry = window.history?.state?.wildzProfileCard;
      if (entry?.profile === profileHandle && currentCollection.current.get(entry.id)?.proofDigest === entry.digest) {
        setSelected({ id: entry.id, digest: entry.digest, chart: entry.chart }); setDetailOpen(true);
      } else restoreProfile();
    };
    const hash = new URLSearchParams(window.location.hash?.slice(1) ?? "");
    const id = hash.get("market-card"), carried = id ? currentCollection.current.get(id) : undefined;
    if (carried) { setSelected({ id: carried.assetId, digest: carried.proofDigest, chart: hash.has("chart") }); setDetailOpen(true); }
    window.addEventListener?.("popstate", pop);
    return () => window.removeEventListener?.("popstate", pop);
  }, [active, profileHandle, restoreProfile]);

  useEffect(() => {
    if (!active || !galleryRef.current || !collection.size) return;
    const controller = new AbortController();
    const visible = new Set<string>(), pending = new Set<string>();
    const pendingAssets = new Map<string, Promise<PortableCardAsset | null>>();
    const recoverAsset = async (assetId: string) => {
      const card = collection.get(assetId);
      if (!card) return null;
      if (card.asset) return card.asset;
      const key = `${assetId}:${card.proofDigest}`, cached = recovered.current.get(key);
      if (cached) { recovered.current.delete(key); recovered.current.set(key, cached); return cached; }
      const path = `/api/cards/${encodeURIComponent(assetId)}`;
      const options = { cache: "no-store", credentials: "omit", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) } as const;
      let response = await fetch(`${path}${profileHandle ? `?profile=${encodeURIComponent(profileHandle)}` : ""}`, options);
      if (response.status === 404 && profileHandle) response = await fetch(path, options);
      if (!response.ok) return null;
      const asset = parseProfileVaultPublicAsset({ id: assetId, name: card.title, proofDigest: card.proofDigest, visibility: "public" }, await response.json());
      if (!asset || controller.signal.aborted) return null;
      recovered.current.set(key, asset);
      while (recovered.current.size > 48) recovered.current.delete(recovered.current.keys().next().value!);
      return asset;
    };
    const readAsset = (assetId: string): Promise<PortableCardAsset | null> => {
      const pending = pendingAssets.get(assetId);
      if (pending) return pending;
      const operation = recoverAsset(assetId).finally(() => pendingAssets.delete(assetId));
      pendingAssets.set(assetId, operation);
      return operation;
    };
    assetReaderRef.current = readAsset;
    const port = createWildzMarketValueBrowserPortV129({ card: readAsset });
    const valueReader = { async readValue(assetId: string) {
      const result = await port.read(assetId), card = collection.get(assetId);
      if (controller.signal.aborted || !card) return result;
      if (result.status === "ready" && (result.value.assetId !== assetId || result.value.proofDigest !== card.proofDigest)) return result;
      // Keep the chart and calculation, without retaining duplicate SVG artwork.
      const carried: WildzMarketValueRead = result.status === "ready" ? { status: "ready", value: result.value } : { status: "unavailable", message: result.message };
      projections.current.set(`${assetId}:${card.proofDigest}`, carried);
      while (projections.current.size > 48) projections.current.delete(projections.current.keys().next().value!);
      setValues(previous => new Map(previous).set(assetId, summary(card.proofDigest, result)));
      return result;
    } };
    readerRef.current = valueReader;
    const refresh = async (assetId: string) => {
      if (controller.signal.aborted || pending.has(assetId) || document.visibilityState === "hidden") return;
      pending.add(assetId);
      try { await valueReader.readValue(assetId); } finally { pending.delete(assetId); }
    };
    const refreshVisible = () => { for (const assetId of visible) void refresh(assetId); };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      for (const entry of entries) {
        const assetId = (entry.target as HTMLElement).dataset.marketValueAsset;
        if (!assetId) continue;
        if (entry.isIntersecting) { visible.add(assetId); void refresh(assetId); } else visible.delete(assetId);
      }
    }, { rootMargin: "80px" });
    for (const badge of galleryRef.current.querySelectorAll<HTMLElement>("[data-market-value-asset]")) {
      if (observer) observer.observe(badge); else if (badge.dataset.marketValueAsset) visible.add(badge.dataset.marketValueAsset);
    }
    if (!observer) refreshVisible();
    const timer = window.setInterval(refreshVisible, 5500);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      controller.abort(); observer?.disconnect(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      if (readerRef.current === valueReader) readerRef.current = null;
      if (assetReaderRef.current === readAsset) assetReaderRef.current = null;
      port.dispose?.();
    };
  }, [active, collection, profileHandle]);

  const displayCard = (card: PublicWildzCard): WildzMarketOwnedCard => {
    const seeded = exactValue(card, initialSeed?.values[card.id]);
    const retained = values.get(card.id);
    const read = retained?.digest === card.proofDigest ? retained : seeded ? summary(card.proofDigest, seeded) : undefined;
    const asset = collection.get(card.id)?.asset ?? recovered.current.get(`${card.id}:${card.proofDigest}`);
    return { ...collection.get(card.id)!, ...(asset ? { asset } : {}), ...(read?.digest === card.proofDigest ? { value: read.value, valueUnavailable: read.valueUnavailable } : {}) };
  };
  return <section ref={galleryRef} className="wildz-profile-vault-gallery" data-profile-ready={ready || undefined} aria-label="Companion cards">
    <header className="wildz-profile-vault-heading" hidden={showingDetail}><span>Companion Vault</span><strong>{cards.length} verified card{cards.length === 1 ? "" : "s"}</strong></header>
    <div className="wildz-profile-card-grid" hidden={showingDetail} inert={showingDetail ? true : undefined}>
      {cards.map((card, index) => {
        const localAsset = ownerAssetsById.get(card.id), artwork = seedAssets.has(card.id) ? initialSeed?.artwork[card.id] : undefined;
        return <article className="wildz-profile-card-entry" key={card.id}>
          <CardValue card={displayCard(card)} href={`#market-card=${encodeURIComponent(card.id)}&chart`} onChart={() => openCard(card, true)} />
          <a href={`#market-card=${encodeURIComponent(card.id)}`} aria-label={`Open ${card.name} market card`} className="wildz-profile-card-tile" onClick={event => { event.preventDefault(); openCard(card, false, event.currentTarget); }}>
            {localAsset && !artwork
              ? <DeferredProfileCardPreview key={`${card.id}:${card.proofDigest}`} active={active} eager={index < 2}><WildsCard asset={localAsset} compact interactive={false} /></DeferredProfileCardPreview>
              : <Image alt={`${card.name} card front`} height={700} loading={index < 4 ? "eager" : "lazy"} priority={index < 2} src={artwork ?? profileVaultCardImageUrl(card.id, profileHandle)} unoptimized width={500} />}
            <span><strong>{card.name}</strong><small>{card.status ?? "verified"}</small></span>
          </a>
        </article>;
      })}
    </div>
    {!cards.length ? <p className="wildz-sheet-empty">No companion cards yet.</p> : null}
    {selectedEntry ? <WildzProfileMarketCard key={`${selectedEntry.id}:${selectedEntry.proofDigest}`} card={displayCard(selectedEntry)} active={showingDetail} artwork={seedAssets.has(selectedEntry.id) ? initialSeed?.artwork[selectedEntry.id] : undefined} focusChart={selected?.chart ?? false} onBack={backToProfile} profileHandle={profileHandle} service={marketService} valueReader={reader} readCard={readPreparedCard} initialValue={projections.current.get(`${selectedEntry.id}:${selectedEntry.proofDigest}`) ?? exactValue(selectedEntry, initialSeed?.values[selectedEntry.id])} /> : null}
  </section>;
});
