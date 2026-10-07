"use client";

import { useCallback, useEffect, useState } from "react";
import { verifyWildsResourcePackage, type WildsResourcePackageV1 } from "../play/wilds-resource-package";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import type { PublicResourcePackageListing, ResourcePackageMarketHead } from "./resource-package-market";

const ENDPOINT = "/api/market/resource-packages";
function friendlyMarketError(value: unknown, fallback: string) {
  return value === "receiz_conditional_resource_custody_unavailable" || value === "market_capability_unavailable"
    ? "Resource trading is unavailable right now."
    : typeof value === "string" ? value : fallback;
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
  const refresh = useCallback(async () => {
    if (!connected) return;
    const response = await fetch(ENDPOINT, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json().catch(() => null);
    const nextHead = admittedHead(result?.head);
    if (!response.ok || result?.status !== "ready" || !Array.isArray(result.listings) || !nextHead) throw new Error(friendlyMarketError(result?.error ?? result?.status, "Resource market is reconnecting."));
    setListings(result.listings); setHead(nextHead);
    const recovery = Array.isArray(result.pendingPurchases) ? result.pendingPurchases.find((purchase: { status?: string; expiresAt?: string }) => purchase.status !== "reserved" || (purchase.expiresAt && Date.parse(purchase.expiresAt) > Date.now())) : null;
    if (recovery && typeof recovery.tradeId === "string") setPending({ tradeId: recovery.tradeId, head: nextHead, status: recovery.status });
  }, [connected]);
  useEffect(() => { if (connected) void refresh().catch(cause => setMessage(cause instanceof Error ? cause.message : "Resource market is reconnecting.")); }, [connected, refresh]);
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
    if (!selected || !head) return;
    setBusy(true); setMessage("");
    const nonce = attemptKey ?? `pack-buy:${selected.id}:${crypto.randomUUID()}`;
    setAttemptKey(nonce);
    try {
      const response = await fetch(`${ENDPOINT}/trades`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "idempotency-key": nonce }, body: JSON.stringify({ listingId: selected.id, expectedRevision: head.revision, expectedAppendAnchorId: head.appendAnchorId }) });
      const result = await response.json().catch(() => null), checkoutHead = admittedHead(result?.head);
      if (!response.ok || typeof result?.trade?.id !== "string" || !checkoutHead) throw new Error(friendlyMarketError(result?.error ?? result?.status, "Package reservation changed. Refresh the market and try again."));
      await settle(result.trade.id, checkoutHead);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Package purchase failed."); }
    finally { setBusy(false); }
  }
  async function releaseReservation() {
    if (!pending) return;
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
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Reservation release failed."); }
    finally { setBusy(false); }
  }
  async function cancelListing() {
    if (!selected || !head) return;
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
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Listing cancellation failed."); }
    finally { setBusy(false); }
  }
  async function retry() {
    if (!pending) return;
    setBusy(true); try { await settle(pending.tradeId, pending.head); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Purchase recovery failed."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Resource package marketplace">
    <header><div><span>Gathered resources</span><h3>Food &amp; resource packages</h3></div><b>{listings.length} listed</b></header>
    <div className="wildz-market-list">{listings.length ? listings.map(listing => <button type="button" key={listing.id} disabled={busy || Boolean(pending)} onClick={() => { setSelected(listing); setAttemptKey(null); }}><i>▣</i><span><strong>{listing.contents.map(item => `${item.quantity} ${label(item.kind)}`).join(" · ")}</strong><small>{listing.sellerHandle}</small></span><b>${(listing.priceCents / 100).toFixed(2)}</b></button>) : <p className="wildz-sheet-empty">List a single gathered item or a mixed package from your Resources pack.</p>}</div>
    {selected && !pending ? <div className="wildz-trade-confirm"><span>{selected.contents.map(item => `${item.quantity} ${label(item.kind)}`).join(" · ")}</span><strong>${(selected.priceCents / 100).toFixed(2)}</strong><button type="button" disabled={!connected || busy || ownsListing(selected)} onClick={() => void buy()}>{busy ? "Confirming…" : ownsListing(selected) ? "Your listing" : "Buy resource package"}</button></div> : null}
    {selected && !pending && ownsListing(selected) ? <button type="button" className="wildz-market-retry" disabled={busy} onClick={() => void cancelListing()}>{selected.status === "cancelled" ? "Retry listing cancellation" : "Cancel resource listing"}</button> : null}
    {pending && pending.status !== "released" ? <button type="button" className="wildz-market-retry" disabled={busy} onClick={() => void retry()}>{busy ? "Checking purchase…" : "Resume package purchase"}</button> : null}
    {pending?.status === "reserved" || pending?.status === "released" ? <button type="button" className="wildz-market-retry" disabled={busy} onClick={() => void releaseReservation()}>{pending.status === "released" ? "Retry reservation release" : "Release package reservation"}</button> : null}
    {message ? <p role="status" className="wildz-market-status">{message}</p> : null}
  </section>;
}
