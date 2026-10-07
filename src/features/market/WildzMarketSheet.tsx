"use client";

import { useCallback, useEffect, useState } from "react";
import type { WildzListing } from "@/features/market/wildz-market";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { WildzTradeConfirm } from "@/features/market/WildzTradeConfirm";
import { ResourcePackageMarketSection } from "@/features/market/ResourcePackageMarketSection";
import type { WildsResourcePackageV1 } from "@/features/play/wilds-resource-package";
import { shouldRefreshWildzMarket } from "@/features/market/market-refresh-policy";
import { friendlyWildzMarketError, readWildzMarket } from "./market-session-read";

type MarketListing = Pick<
  WildzListing,
  "schema" | "id" | "assetId" | "proofDigest" | "sellerActorId" | "priceCents" | "currency" | "status" | "createdAt"
> & { seller?: string; revision?: number; name?: string };

type MarketHead = { revision: number; appendAnchorId: string | null };
type PendingSettlement = { tradeId: string; checkoutHead: MarketHead };
type SettledMarketProjection = {
  asset: PortableCardAsset;
  ownership: { assetId: string; proofDigest: string; ownerReceizId: string };
};

function marketHead(value: unknown): MarketHead | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const head = value as { revision?: unknown; appendAnchorId?: unknown };
  if (!Number.isInteger(head.revision) || Number(head.revision) < 0) return null;
  if (head.appendAnchorId !== null && typeof head.appendAnchorId !== "string") return null;
  return { revision: Number(head.revision), appendAnchorId: head.appendAnchorId };
}

export function settledMarketProjection(value: unknown): SettledMarketProjection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as { asset?: unknown; ownership?: unknown };
  if (!result.asset || typeof result.asset !== "object" || Array.isArray(result.asset)
    || !result.ownership || typeof result.ownership !== "object" || Array.isArray(result.ownership)) return null;
  const asset = result.asset as PortableCardAsset;
  const ownership = result.ownership as { assetId?: unknown; proofDigest?: unknown; ownerReceizId?: unknown };
  if (typeof ownership.assetId !== "string"
    || typeof ownership.proofDigest !== "string"
    || typeof ownership.ownerReceizId !== "string"
    || asset.id !== ownership.assetId
    || asset.proof?.digest !== ownership.proofDigest
    || !verifyAnyWildsCard(asset).ok) return null;
  return { asset, ownership: ownership as SettledMarketProjection["ownership"] };
}

export function WildzMarketSheet({
  listings: initialListings,
  buyer,
  connected,
  onSettlement,
  onResourcePackageSettlement
}: {
  listings: MarketListing[];
  buyer: string;
  connected: boolean;
  onSettlement?: (asset: PortableCardAsset) => void | Promise<void>;
  onResourcePackageSettlement?: (proof: WildsResourcePackageV1) => void | Promise<void>;
}) {
  const [listings, setListings] = useState(initialListings);
  const [head, setHead] = useState<MarketHead | null>(null);
  const [selected, setSelected] = useState<MarketListing | null>(null);
  const [pending, setPending] = useState<PendingSettlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState("");

  const admitSettledAsset = useCallback(async (result: unknown) => {
    const projection = settledMarketProjection(result);
    if (!projection) throw new Error("Receiz settled the trade, but its exact verified card projection was invalid.");
    try {
      await onSettlement?.(projection.asset);
    } catch {
      throw new Error("Trade settled globally. Your local Vault refresh is pending; reopen Market to reconcile it safely.");
    }
  }, [onSettlement]);

  const refreshMarket = useCallback(async (signal?: AbortSignal) => {
    if (!shouldRefreshWildzMarket(connected)) return;
    setLoading(true);
    try {
      const { response, result } = await readWildzMarket<{
        listings?: unknown; head?: unknown; status?: unknown; error?: unknown;
      }>("/api/market/listings", { signal });
      signal?.throwIfAborted();
      const nextHead = marketHead(result?.head);
      if (!response.ok || result?.status !== "ready" || !Array.isArray(result.listings) || !nextHead) {
        throw new Error(friendlyWildzMarketError(result?.error ?? result?.status, "The market could not load. Refresh to try again."));
      }
      setListings(result.listings as MarketListing[]);
      setHead(nextHead);
      setReadError("");
    } catch (cause) {
      if (!signal?.aborted) {
        setHead(null);
        setReadError(friendlyWildzMarketError(cause, "The market could not load. Refresh to try again."));
      }
      throw cause;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) { setLoading(false); return; }
    const controller = new AbortController();
    void refreshMarket(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [connected, refreshMarket]);

  const checkout = async () => {
    if (!selected || !head || !connected || loading) return;
    setBusy(true);
    setMessage("");
    try {
      const tradeResponse = await fetch("/api/market/trades", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `trade:${selected.id}:${buyer}`
        },
        body: JSON.stringify({ listingId: selected.id, expectedRevision: head.revision, expectedAppendAnchorId: head.appendAnchorId })
      });
      const tradeResult = await tradeResponse.json().catch(() => null) as {
        status?: unknown;
        error?: unknown;
        trade?: { id?: unknown };
        head?: unknown;
      } | null;
      const checkoutHead = marketHead(tradeResult?.head);
      const tradeId = typeof tradeResult?.trade?.id === "string" ? tradeResult.trade.id : "";
      if (!tradeResponse.ok || !tradeId || !checkoutHead) {
        throw new Error(typeof tradeResult?.error === "string" ? tradeResult.error : "The trade could not be admitted.");
      }

      const response = await fetch("/api/market/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tradeId, expectedRevision: checkoutHead.revision, expectedAppendAnchorId: checkoutHead.appendAnchorId })
      });
      const result = await response.json().catch(() => null) as {
        status?: unknown;
        error?: unknown;
        head?: unknown;
      } | null;
      if (result?.status === "settled") {
        await admitSettledAsset(result);
        setPending(null);
        setSelected(null);
        setMessage("Trade settled. Receiz admitted the ownership transfer. The exact verified card is now in your playable Vault.");
        await refreshMarket();
      } else if (result?.status === "recovery_pending" || result?.status === "payment_failed") {
        const recoveryHead = marketHead(result?.head) ?? checkoutHead;
        setPending({ tradeId, checkoutHead: recoveryHead });
        setMessage(result.status === "recovery_pending"
          ? "Payment was proven. Ownership admission is pending; retry safely with the same Receiz transfer."
          : "Payment was not admitted. Retry this reserved trade with the same Receiz idempotency key.");
      } else if (result?.status === "reservation_expired") {
        setPending(null);
        setSelected(null);
        setMessage("That reservation expired before payment. The listing is available again.");
        await refreshMarket();
      } else {
        throw new Error(typeof result?.error === "string" ? result.error : "Payment did not settle. No ownership changed.");
      }
    } catch (cause) {
      setMessage(friendlyWildzMarketError(cause, "Checkout could not be reached. Refresh the market and try again."));
      await refreshMarket().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const retrySettlement = async () => {
    if (!pending || !connected || loading) return;
    setBusy(true);
    try {
      const { tradeId, checkoutHead } = pending;
      const response = await fetch("/api/market/settlement", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tradeId, expectedRevision: checkoutHead.revision, expectedAppendAnchorId: checkoutHead.appendAnchorId })
      });
      const result = await response.json().catch(() => null) as {
        status?: unknown;
        error?: unknown;
        head?: unknown;
      } | null;
      if (result?.status === "settled") {
        await admitSettledAsset(result);
        setPending(null);
        setSelected(null);
        setMessage("Trade settled. Receiz admitted the ownership transfer. The exact verified card is now in your playable Vault.");
        await refreshMarket();
      } else if (result?.status === "recovery_pending") {
        const recoveryHead = marketHead(result?.head) ?? checkoutHead;
        setPending({ tradeId, checkoutHead: recoveryHead });
        setMessage("Ownership admission is still pending. The same proven transfer remains safe to retry.");
      } else if (result?.status === "reservation_expired") {
        setPending(null);
        setSelected(null);
        setMessage("That reservation expired. No ownership changed.");
        await refreshMarket();
      } else {
        throw new Error(typeof result?.error === "string" ? result.error : "Settlement recovery could not be completed.");
      }
    } catch (cause) {
      setMessage(friendlyWildzMarketError(cause, "Your purchase could not be reached. Resume it when the connection returns."));
    } finally {
      setBusy(false);
    }
  };

  return <div className="wildz-market-sheet">
    <header><div><span>Player market</span><h2>Trade on the trail</h2></div><b>{listings.length} listed</b></header>
    <div className="wildz-market-toolbar"><span>{loading ? "Connecting to the market…" : !connected ? "Connecting your Receiz ID…" : "Cards from fellow explorers"}</span><button type="button" disabled={!connected || loading || busy} onClick={() => { setMessage(""); void refreshMarket().catch(() => undefined); }}>{loading ? "Loading…" : "Refresh"}</button></div>
    <div className="wildz-market-list">{listings.length ? listings.map((listing) => <button type="button" key={listing.id} disabled={!connected || !head || loading || busy} onClick={() => setSelected(listing)}><i>✦</i><span><strong>{listing.name ?? "Companion card"}</strong><small>{listing.seller ?? listing.sellerActorId}</small></span><b>${(listing.priceCents / 100).toFixed(2)}</b></button>) : <p className="wildz-sheet-empty">{loading || !connected ? "Listings will appear when your market session is ready." : readError ? "Listings could not be loaded yet. Refresh to check again." : "No cards listed yet. List a verified companion from your Card Vault."}</p>}</div>
    {selected ? <section className="wildz-market-consequence" aria-label="Trade consequence"><small>Before you buy</small><strong>{selected.name ?? "This card"} joins your Vault when the purchase completes.</strong><span>${(selected.priceCents / 100).toFixed(2)} · seller {selected.seller ?? selected.sellerActorId}</span></section> : null}
    {selected ? <WildzTradeConfirm listing={selected} busy={busy} disabled={!connected || !head || loading} onConfirm={() => void checkout()} /> : null}
    {pending ? <button type="button" className="wildz-market-retry" disabled={busy || !connected || loading} onClick={() => void retrySettlement()}>{busy ? "Checking purchase…" : "Resume purchase"}</button> : null}
    {message || readError ? <p role="status" className="wildz-market-status">{message || readError}</p> : null}
    <ResourcePackageMarketSection connected={connected} buyer={buyer} onSettlement={onResourcePackageSettlement} />
  </div>;
}
