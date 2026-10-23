"use client";

import Image from "next/image";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { standaloneCardUrl } from "@/features/play/card-url";
import { WildsCard } from "@/features/play/WildsCard";
import type { WildzMarketOwnedCard } from "@/lib/receiz/wildz-market-collection";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import { CardValue } from "../market/WildzMarketCardValue";
import { createWildzMarketValueBrowserPortV129 } from "../market/wildz-market-value-browser-v129";
import { wildzMarketValueChange } from "../market/wildz-market-value";
import { DeferredProfileCardPreview } from "./DeferredProfileCardPreview";
import type { PublicWildzCard } from "./public-profile";
import { ownerProfileVaultAssets, parseProfileVaultPublicAsset, profileVaultCardImageUrl } from "./profile-vault-card";

export const WildzProfileVaultGallery = memo(function WildzProfileVaultGallery({ cards, ownerAssets, profileHandle, active = true }: {
  cards: readonly PublicWildzCard[];
  profileHandle?: string;
  ownerAssets?: readonly PortableCardAsset[];
  active?: boolean;
}) {
  const galleryRef = useRef<HTMLElement>(null);
  const ownerAssetsById = useMemo(() => ownerProfileVaultAssets(cards, ownerAssets ?? []), [cards, ownerAssets]);
  const collection = useMemo(() => new Map(cards.map(card => [card.id, {
    assetId: card.id, title: card.name, proofDigest: card.proofDigest, ownerHandle: profileHandle ?? "",
    claimKaiUPulse: null, claimHead: null, asset: ownerAssetsById.get(card.id)
  } satisfies WildzMarketOwnedCard])), [cards, ownerAssetsById, profileHandle]);
  const [values, setValues] = useState<ReadonlyMap<string, Pick<WildzMarketOwnedCard, "value" | "valueUnavailable"> & { digest: string }>>(new Map());

  useEffect(() => {
    if (!active || !galleryRef.current || !collection.size) return;
    setValues(previous => new Map([...previous].filter(([id, value]) => collection.get(id)?.proofDigest === value.digest)));
    const controller = new AbortController();
    const visible = new Set<string>(), pending = new Set<string>();
    const recovered = new Map<string, PortableCardAsset>();
    const port = createWildzMarketValueBrowserPortV129({
      card: async assetId => {
        const card = collection.get(assetId);
        if (!card) return null;
        if (card.asset) return card.asset;
        const cached = recovered.get(assetId);
        if (cached) { recovered.delete(assetId); recovered.set(assetId, cached); return cached; }
        const path = `/api/cards/${encodeURIComponent(assetId)}`;
        const options = { cache: "no-store", credentials: "omit", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) } as const;
        let response = await fetch(`${path}${profileHandle ? `?profile=${encodeURIComponent(profileHandle)}` : ""}`, options);
        if (response.status === 404 && profileHandle) response = await fetch(path, options);
        if (!response.ok) return null;
        const asset = parseProfileVaultPublicAsset({ id: assetId, name: card.title, proofDigest: card.proofDigest, visibility: "public" }, await response.json());
        if (!asset || controller.signal.aborted) return null;
        recovered.set(assetId, asset);
        while (recovered.size > 8) recovered.delete(recovered.keys().next().value!);
        return asset;
      }
    });
    const refresh = async (assetId: string) => {
      if (controller.signal.aborted || pending.has(assetId) || document.visibilityState === "hidden") return;
      const card = collection.get(assetId);
      if (!card) return;
      pending.add(assetId);
      try {
        const result = await port.read(assetId);
        if (controller.signal.aborted) return;
        if (result.status === "ready" && (result.value.assetId !== assetId || result.value.proofDigest !== card.proofDigest)) return;
        const summary = result.status === "ready" ? { value: {
          proofValuePhiMicro: result.value.proofValuePhiMicro,
          displayUsdCents: result.value.displayUsdCents,
          valuationKaiUPulse: result.value.valuationKaiUPulse,
          algorithm: result.value.algorithm,
          changeBps: wildzMarketValueChange(result.value.samples, result.value.displayUsdCents === null ? "phi" : "usd")
        } } : { valueUnavailable: result.message };
        setValues(previous => new Map(previous).set(assetId, { digest: card.proofDigest, ...summary }));
      } finally { pending.delete(assetId); }
    };
    const refreshVisible = () => { for (const assetId of visible) void refresh(assetId); };
    const badges = galleryRef.current.querySelectorAll<HTMLElement>("[data-market-value-asset]");
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      for (const entry of entries) {
        const assetId = (entry.target as HTMLElement).dataset.marketValueAsset;
        if (!assetId) continue;
        if (entry.isIntersecting) { visible.add(assetId); void refresh(assetId); }
        else visible.delete(assetId);
      }
    }, { rootMargin: "80px" });
    for (const badge of badges) {
      if (observer) observer.observe(badge);
      else if (badge.dataset.marketValueAsset) visible.add(badge.dataset.marketValueAsset);
    }
    if (!observer) refreshVisible();
    const timer = window.setInterval(refreshVisible, 5500);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      controller.abort();
      observer?.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      port.dispose?.();
    };
  }, [active, collection, profileHandle]);

  return <section ref={galleryRef} className="wildz-profile-vault-gallery" aria-label="Companion cards">
    <header className="wildz-profile-vault-heading">
      <span>Companion Vault</span>
      <strong>{cards.length} verified card{cards.length === 1 ? "" : "s"}</strong>
    </header>
    <div className="wildz-profile-card-grid">
      {cards.map((card, index) => {
        const localAsset = ownerAssetsById.get(card.id);
        const href = new URL(standaloneCardUrl(card.id, WILDZ_PRODUCT.origin)).pathname;
        const read = values.get(card.id);
        const marketCard: WildzMarketOwnedCard = {
          ...collection.get(card.id)!,
          ...(read?.digest === card.proofDigest ? { value: read.value, valueUnavailable: read.valueUnavailable } : {})
        };
        return <article className="wildz-profile-card-entry" key={card.id}>
          <CardValue card={marketCard} href={href} />
          <a aria-label={`Open ${card.name} standalone card`} className="wildz-profile-card-tile" href={href}>
            {localAsset
              ? <DeferredProfileCardPreview key={`${card.id}:${card.proofDigest}`} active={active} eager={index < 2}><WildsCard asset={localAsset} compact interactive={false} /></DeferredProfileCardPreview>
              : <Image alt={`${card.name} card front`} height={700} loading="lazy" src={profileVaultCardImageUrl(card.id, profileHandle)} unoptimized width={500} />}
            <span><strong>{card.name}</strong><small>{card.status ?? "verified"}</small></span>
          </a>
        </article>;
      })}
    </div>
    {!cards.length ? <p className="wildz-sheet-empty">No companion cards yet.</p> : null}
  </section>;
});
