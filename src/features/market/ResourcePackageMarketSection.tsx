"use client";

import { useCallback, useEffect, useState } from "react";
import { verifyWildsResourcePackage, type WildsResourcePackageV1 } from "../play/wilds-resource-package";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import type { PublicResourcePackageListing, ResourcePackageMarketHead } from "./resource-package-market";
import { friendlyWildzMarketError, readWildzMarket } from "./market-session-read";

const ENDPOINT = "/api/market/resource-packages";
function friendlyMarketError(value: unknown, fallback: string) {
  return friendlyWildzMarketError(value, fallback);
}
function admittedHead(value: unknown): ResourcePackageMarketHead | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const head = value as ResourcePackageMarketHead;
  return Number.isSafeInteger(head.revision) && head.revision >= 0 && (head.appendAnchorId === null || typeof head.appendAnchorId === "string") ? head : null;
}
const label = (kind: string) => ({ "living-honey": "Honey", timber: "Timber", stone: "Stone", hay: "Hay", "orchard-fruit": "Fruit", "wild-berries": "Berries", "wild-vegetable": "Vegetables", "wild-eggs": "Eggs", "wild-milk": "Milk", "wild-meat": "Meat" }[kind] ?? kind);
export function ResourcePackageMarketSection({ connected, buyer, onSettlement }: { connected: boolean; buyer: string; onSettlement?: (proof: WildsResourcePackageV1) => void | Promise<void> }) {
  const ownsListing = (listing: PublicResourcePackageListing) => listing.sellerActorId === buyer || sameWildzPlayerCoordinate(listing.sellerHandle, buyer);
  const [listings, setListings] = useState<PublicResourcePackageListing[]>([]);
  const [head, setHead] = useState<ResourcePackageMarketHead | null>(null);
  const [selected, setSelected] = useState<PublicResourcePackageListing | null>(null);
  const [attemptKey, setAttemptKey] = useState<string | null>(null);
  const [pending, setPending] = useState<{ tradeId: string; head: ResourcePackageMarketHead; status?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!connected) return;
    setLoading(true);
    try {
      const { response, result } = await readWildzMarket<{
        head?: unknown; listings?: unknown; status?: unknown; error?: unknown;
        pendingPurchases?: Array<{ tradeId?: unknown; status?: string; expiresAt?: string }>;
      }>(ENDPOINT, { signal });
      signal?.throwIfAborted();
      const nextHead = admittedHead(result?.head);
      if (!response.ok || result?.status !== "ready" || !Array.isArray(result.listings) || !nextHead) throw new Error(friendlyMarketError(result?.error ?? result?.status, "Resource listings could not load. Refresh to try again."));
      setListings(result.listings as PublicResourcePackageListing[]); setHead(nextHead); setReadError("");
      const recovery = Array.isArray(result.pendingPurchases) ? result.pendingPurchases.find(purchase => purchase.status !== "reserved" || (purchase.expiresAt && Date.parse(purchase.expiresAt) > Date.now())) : null;
      if (recovery && typeof recovery.tradeId === "string") setPending({ tradeId: recovery.tradeId, head: nextHead, status: recovery.status });
    } catch (cause) {
      if (!signal?.aborted) {
        setHead(null);
        setReadError(friendlyMarketError(cause, "Resource listings could not load. Refresh to try again."));
      }
      throw cause;
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [connected]);
  useEffect(() => {
    if (!connected) { setLoading(false); return; }
    const controller = new AbortController();
    void refresh(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [connected, refresh]);
  async function settle(tradeId: string, checkoutHead: ResourcePackageMarketHead) {
    const priorStatus = pending?.tradeId === tradeId ? pending.status : "reserved";
    setPending({ tradeId, head: checkoutHead, status: priorStatus });
    const response = await fetch(`${ENDPOINT}/checkout`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ tradeId, expectedRevision: checkoutHead.revision, expectedAppendAnchorId: checkoutHead.appendAnchorId }) });
    const result = await response.json().catch(() => null);
    if (result?.status === "settled" && result.ownershipTransferred === true && verifyWildsResourcePackage(result.package) && result.receipt?.schema === "receiz.bearer.transfer_receipt.v1") {
      await onSettlement?.(result.package);
      setPending(null); setSelected(null); setMessage("Package purchased. Its exact contents are now in your resource pack.");
      await refresh();
    } else if (result?.status === "reservation_expired") {
      setPending(null); setSelected(null); setMessage("Reservation expired. Choose the package again."); await refresh();
    } else if (result?.status === "market_capability_unavailable") {
      setPending({ tradeId, head: checkoutHead, status: priorStatus });
      setMessage(friendlyMarketError(result.status, "Resource trading is unavailable right now."));
    } else if (result?.status === "recovery_pending" || result?.status === "payment_failed" || result?.status === "market_revision_conflict") {
      setPending({ tradeId, head: admittedHead(result.head) ?? checkoutHead, status: "paying" });
      setMessage(result.status === "payment_failed" ? "Payment was not admitted. Retry this purchase to continue." : "Purchase admission is pending. Retry to resume the same payment and custody transfer.");
    } else throw new Error(friendlyMarketError(result?.error, "Package purchase could not be admitted."));
  }
  async function buy() {
    if (!selected || !head || !connected || loading) return;
    setBusy(true); setMessage("");
    const nonce = attemptKey ?? `pack-buy:${selected.id}:${crypto.randomUUID()}`;
    setAttemptKey(nonce);
    try {
      const response = await fetch(`${ENDPOINT}/trades`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "idempotency-key": nonce }, body: JSON.stringify({ listingId: selected.id, expectedRevision: head.revision, expectedAppendAnchorId: head.appendAnchorId }) });
      const result = await response.json().catch(() => null), checkoutHead = admittedHead(result?.head);
      if (!response.ok || typeof result?.trade?.id !== "string" || !checkoutHead) throw new Error(friendlyMarketError(result?.error ?? result?.status, "Package reservation changed. Refresh the market and try again."));
      await settle(result.trade.id, checkoutHead);
    } catch (cause) { setMessage(friendlyMarketError(cause, "The purchase could not be reached. Refresh the market and try again.")); }
    finally { setBusy(false); }
  }
  async function releaseReservation() {
    if (!pending || !connected || loading) return;
    setBusy(true);
    try {
      const response = await fetch(`${ENDPOINT}/trades`, { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json", "idempotency-key": `pack-release:${pending.tradeId}` }, body: JSON.stringify({ tradeId: pending.tradeId, expectedRevision: pending.head.revision, expectedAppendAnchorId: pending.head.appendAnchorId }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(friendlyMarketError(result?.error ?? result?.status, "Reservation release is pending."));
      if (result?.status === "recovery_pending") {
        setPending({ ...pending, head: admittedHead(result.head) ?? pending.head, status: "released" });
        setMessage("Reservation release is pending. Retry release to finish resource custody cleanup.");
        return;
      }
      setPending(null); setSelected(null); setMessage("Reservation released."); await refresh();
    } catch (cause) { setMessage(friendlyMarketError(cause, "Your reservation could not be released yet. Try again when connected.")); }
    finally { setBusy(false); }
  }
  async function cancelListing() {
    if (!selected || !head || !connected || loading) return;
    setBusy(true);
    try {
      const response = await fetch(ENDPOINT, { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json", "idempotency-key": `pack-unlist:${selected.id}` }, body: JSON.stringify({ listingId: selected.id, expectedRevision: head.revision, expectedAppendAnchorId: head.appendAnchorId }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(friendlyMarketError(result?.error ?? result?.status, "Listing cancellation is pending."));
      if (result?.status === "recovery_pending") {
        setHead(admittedHead(result.head) ?? head); setSelected({ ...selected, status: "cancelled" });
        setMessage("Listing cancellation is pending. Retry cancellation to return the package to your resource pack.");
        return;
      }
      setSelected(null); setMessage("Listing cancelled. The package is available in your resource pack."); await refresh();
    } catch (cause) { setMessage(friendlyMarketError(cause, "Your listing could not be cancelled yet. Try again when connected.")); }
    finally { setBusy(false); }
  }
  async function retry() {
    if (!pending || !connected || loading) return;
    setBusy(true); try { await settle(pending.tradeId, pending.head); }
    catch (cause) { setMessage(friendlyMarketError(cause, "Your purchase could not be reached. Resume it when connected.")); }
    finally { setBusy(false); }
  }
  return <section className="wildz-market-resources" aria-label="Resource package marketplace">
    <header><div><span>Gathered resources</span><h3>Food &amp; resource packages</h3></div><b>{listings.length} listed</b></header>
    <div className="wildz-market-toolbar"><span>{loading ? "Connecting to resource listings…" : "Single items or mixed packages"}</span><button type="button" disabled={!connected || loading || busy} onClick={() => { setMessage(""); void refresh().catch(() => undefined); }}>{loading ? "Loading…" : "Refresh"}</button></div>
    <div className="wildz-market-list">{listings.length ? listings.map(listing => <button type="button" key={listing.id} disabled={!connected || !head || loading || busy || Boolean(pending)} onClick={() => { setSelected(listing); setAttemptKey(null); }}><i>▣</i><span><strong>{listing.contents.map(item => `${item.quantity} ${label(item.kind)}`).join(" · ")}</strong><small>{listing.sellerHandle}</small></span><b>${(listing.priceCents / 100).toFixed(2)}</b></button>) : <p className="wildz-sheet-empty">{loading || !connected ? "Resource listings will appear when your market session is ready." : readError ? "Resource listings could not be loaded yet. Refresh to check again." : "No resource packages listed yet. List gathered items from your Resources pack."}</p>}</div>
    {selected && !pending ? <div className="wildz-trade-confirm"><span>{selected.contents.map(item => `${item.quantity} ${label(item.kind)}`).join(" · ")}</span><strong>${(selected.priceCents / 100).toFixed(2)}</strong><button type="button" disabled={!connected || !head || loading || busy || ownsListing(selected)} onClick={() => void buy()}>{busy ? "Confirming…" : ownsListing(selected) ? "Your listing" : "Buy resource package"}</button></div> : null}
    {selected && !pending && ownsListing(selected) ? <button type="button" className="wildz-market-retry" disabled={busy || !connected || loading} onClick={() => void cancelListing()}>{selected.status === "cancelled" ? "Retry listing cancellation" : "Cancel resource listing"}</button> : null}
    {pending && pending.status !== "released" ? <button type="button" className="wildz-market-retry" disabled={busy || !connected || loading} onClick={() => void retry()}>{busy ? "Checking purchase…" : "Resume package purchase"}</button> : null}
    {pending?.status === "reserved" || pending?.status === "released" ? <button type="button" className="wildz-market-retry" disabled={busy || !connected || loading} onClick={() => void releaseReservation()}>{pending.status === "released" ? "Retry reservation release" : "Release package reservation"}</button> : null}
    {message || readError ? <p role="status" className="wildz-market-status">{message || readError}</p> : null}
  </section>;
}
