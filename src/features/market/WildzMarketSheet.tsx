"use client";

import { useCallback, useEffect, useState } from "react";
import type { WildzListing } from "@/features/market/wildz-market";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { WildzTradeConfirm } from "@/features/market/WildzTradeConfirm";
import { shouldRefreshWildzMarket } from "@/features/market/market-refresh-policy";

type MarketListing = Pick<
  WildzListing,
  "schema" | "id" | "assetId" | "proofDigest" | "sellerActorId" | "priceCents" | "currency" | "status" | "createdAt"
> & { seller?: string; revision?: number };

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
  onSettlement
}: {
  listings: MarketListing[];
  buyer: string;
  connected: boolean;
  onSettlement?: (asset: PortableCardAsset) => void | Promise<void>;
}) {
  const [listings, setListings] = useState(initialListings);
  const [head, setHead] = useState<MarketHead | null>(null);
  const [selected, setSelected] = useState<MarketListing | null>(null);
  const [pending, setPending] = useState<PendingSettlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const admitSettledAsset = useCallback(async (result: unknown) => {
    const projection = settledMarketProjection(result);
    if (!projection) throw new Error("Receiz settled the trade, but its exact verified card projection was invalid.");
    try {
      await onSettlement?.(projection.asset);
    } catch {
      throw new Error("Trade settled globally. Your local Vault refresh is pending; reopen Market to reconcile it safely.");
    }
  }, [onSettlement]);

  const refreshMarket = useCallback(async () => {
    if (!shouldRefreshWildzMarket(connected)) return;
    const response = await fetch("/api/market/listings", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    const result = await response.json().catch(() => null) as {
      listings?: unknown;
      head?: unknown;
      status?: unknown;
      error?: unknown;
    } | null;
    const nextHead = marketHead(result?.head);
    if (!response.ok || result?.status !== "ready" || !Array.isArray(result.listings) || !nextHead) {
      setListings([]);
      setHead(null);
      throw new Error(typeof result?.error === "string" ? result.error : "Receiz market is temporarily unavailable.");
    }
    setListings(result.listings as MarketListing[]);
    setHead(nextHead);
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    void refreshMarket().catch((cause) => {
      if (active) setMessage(cause instanceof Error ? cause.message : "Receiz market is temporarily unavailable.");
    });
    return () => { active = false; };
  }, [connected, refreshMarket]);

  const checkout = async () => {
    if (!selected || !head) return;
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
      setMessage(cause instanceof Error ? cause.message : "Checkout could not be reached. No ownership changed.");
      await refreshMarket().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const retrySettlement = async () => {
    if (!pending) return;
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
      setMessage(cause instanceof Error ? cause.message : "Settlement recovery could not be reached.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="wildz-market-sheet">
    <header><div><span>Player market</span><h2>Trade on the trail</h2></div><b>{listings.length} nearby</b></header>
    <div className="wildz-market-list">{listings.length ? listings.map((listing) => <button type="button" key={listing.id} onClick={() => setSelected(listing)}><i>✦</i><span><strong>{listing.assetId}</strong><small>{listing.seller ?? listing.sellerActorId}</small></span><b>${(listing.priceCents / 100).toFixed(2)}</b></button>) : <p className="wildz-sheet-empty">No nearby listings yet. List a verified companion from your Card Vault.</p>}</div>
    {selected ? <section className="wildz-market-consequence" aria-label="Trade consequence"><small>Vault consequence</small><strong>{selected.assetId} joins your verified collection only after Receiz admits ownership.</strong><span>${(selected.priceCents / 100).toFixed(2)} · seller {selected.seller ?? selected.sellerActorId}</span></section> : null}
    {selected ? <WildzTradeConfirm listing={selected} busy={busy} onConfirm={() => void checkout()} /> : null}
    {pending ? <button type="button" className="wildz-market-retry" disabled={busy} onClick={() => void retrySettlement()}>{busy ? "Checking Receiz…" : "Retry ownership admission"}</button> : null}
    {message ? <p role="status" className="wildz-market-status">{message}</p> : !connected ? <p role="status" className="wildz-market-status">Connect your Receiz ID to load live market listings.</p> : null}
  </div>;
}
