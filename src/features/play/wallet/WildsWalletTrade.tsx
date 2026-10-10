"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PortableCardAsset } from "../portable-card";
import type { WildsNourishmentState } from "../wilds-nourishment";
import type { WildsMaterialLotV1 } from "../wilds-steward-construction";
import type { WildsResourceLotV1 } from "../wilds-resource-lot";
import type { ExchangeCard } from "../WildsResourceExchange";
import type { WildsWalletAssetSendSelection } from "./wilds-wallet-asset-send";
import { projectWildsWalletFoodInventory } from "./wilds-wallet-inventory";
import { formatWildsPhiExact, parseWildsPhiInput } from "./wilds-wallet-format";
import { createWildsWalletTradeDraft, createWildsWalletTradeAgreement, type WildsWalletTradeAgreement, type WildsWalletTradeExchangeResult, type WildsWalletApproveTrade, type WildsWalletTradeDraft, type WildsWalletTradeResult, type WildsWalletProposeTrade } from "./wilds-wallet-trade";
import { admitWildsWalletTradeReview, sendSavedWildsWalletTradeReview, wildsWalletBrowserTradeRecoveryStore, type WildsWalletTradeRecoveryStore, type WildsWalletTradeReview } from "./wilds-wallet-trade-recovery";
import type { WildsWalletTradeInboxItem, WildsWalletTradeReply } from "./wilds-wallet-trade-messaging";
import type { WildsWalletAssetSendAsset } from "./wilds-wallet-asset-send";
import {wildsWalletNativeTradeAgreementDigest} from "./wilds-wallet-native-trade-context";
import styles from "./WildsWalletTrade.module.css";

function describeTradeAsset(asset: WildsWalletAssetSendAsset) {
  if (asset.kind === "creature") return `Creature · ${asset.assetId}`;
  if (asset.kind === "package") return `Resource package · ${asset.packageId}`;
  return [asset.foodItemIds.length ? `${asset.foodItemIds.length} food unit${asset.foodItemIds.length === 1 ? "" : "s"}` : "",
    asset.materialLotIds.length ? `${asset.materialLotIds.length} material lot${asset.materialLotIds.length === 1 ? "" : "s"}` : "",
    asset.resourceLotIds.length ? `${asset.resourceLotIds.length} resource lot${asset.resourceLotIds.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
}

export function WildsWalletTrade({ publicUsername, cards = [], nourishment, materialLots = [], resourceLots = [], resourceCards = [], incomingTrades = [], nativeTradeResults = {}, onProposeTrade, onApproveTrade, onRecoverTrade, recoveryStore = wildsWalletBrowserTradeRecoveryStore }: {
  publicUsername: string | null;
  cards?: readonly PortableCardAsset[];
  nourishment?: WildsNourishmentState;
  materialLots?: readonly WildsMaterialLotV1[];
  resourceLots?: readonly WildsResourceLotV1[];
  resourceCards?: readonly ExchangeCard[];
  onProposeTrade?: WildsWalletProposeTrade;
  incomingTrades?: readonly WildsWalletTradeInboxItem[];
  onApproveTrade?: WildsWalletApproveTrade;
  onRecoverTrade?: WildsWalletApproveTrade;
  nativeTradeResults?: Readonly<Record<string,WildsWalletTradeExchangeResult>>;
  recoveryStore?: WildsWalletTradeRecoveryStore;
}) {
  const [restored] = useState(() => {
    try { return { review: publicUsername ? admitWildsWalletTradeReview(recoveryStore.load(publicUsername), publicUsername) : null, error: "" }; }
    catch { return { review: null, error: "Saved trade recovery is unavailable. Restore it before creating another offer." }; }
  });
  const [recipient, setRecipient] = useState("");
  const [phi, setPhi] = useState("");
  const [requestedPhi, setRequestedPhi] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Readonly<Record<string, number>>>({});
  const [review, setReview] = useState<WildsWalletTradeDraft | null>(restored.review?.draft ?? null);
  const [savedReview, setSavedReview] = useState<WildsWalletTradeReview | null>(restored.review);
  const [result, setResult] = useState<WildsWalletTradeResult | null>(restored.review?.result ?? (restored.review?.status === "pending" ? { status: "pending", message: "Recover this same trade offer." } : null));
  const [error, setError] = useState(restored.error);
  const [busy, setBusy] = useState(false);
  const [inReplyTo, setInReplyTo] = useState<WildsWalletTradeReply | undefined>(restored.review?.inReplyTo);
  const [agreement, setAgreement] = useState<WildsWalletTradeAgreement | null>(null);
  const [exchange, setExchange] = useState<WildsWalletTradeExchangeResult | null>(null);
  const running = useRef(false);
  const agreementDigest=useMemo(()=>agreement?wildsWalletNativeTradeAgreementDigest(agreement):null,[agreement]);
  const nativeResult=agreementDigest?nativeTradeResults[agreementDigest]:undefined;
  useEffect(()=>{if(nativeResult)setExchange(nativeResult);},[nativeResult]);
  const selections = useMemo<WildsWalletAssetSendSelection[]>(() => [
    ...cards.filter(card => card.status === "sealed_local" || card.status === "verified").map(card => ({ id: `creature:${card.id}`, label: card.manifest.name, quantity: 1, asset: { kind: "creature" as const, assetId: card.id } })),
    ...projectWildsWalletFoodInventory(nourishment).map(food => ({ id: `food:${food.id}`, label: food.label, quantity: food.quantity, adjustableQuantity: true, asset: { kind: "inventory" as const, foodItemIds: food.itemIds, materialLotIds: [], resourceLotIds: [] } })),
    ...materialLots.map(lot => ({ id: `material:${lot.lotId}`, label: lot.kind === "timber" ? "Living Timber" : lot.kind === "stone" ? "Foundation Stone" : "Hay", quantity: 1, asset: { kind: "inventory" as const, foodItemIds: [], materialLotIds: [lot.lotId], resourceLotIds: [] } })),
    ...resourceLots.map(lot => ({ id: `resource:${lot.lotId}`, label: "Living Honey", quantity: lot.quantity, detail: "Whole sealed lot", asset: { kind: "inventory" as const, foodItemIds: [], materialLotIds: [], resourceLotIds: [lot.lotId] } })),
    ...resourceCards.filter(card => card.transferable).map(card => ({ id: `package:${card.id}`, label: card.title, detail: card.summary, quantity: 1, asset: { kind: "package" as const, packageId: card.id } }))
  ], [cards, nourishment, materialLots, resourceLots, resourceCards]);
  const chosen = selections.filter(item => selected[item.id] !== undefined).map(selection => ({ selection, quantity: selected[selection.id]! }));
  const prepare = () => {
    try {
      if (!publicUsername) throw Error("Sign in with your Receiz ID to propose a trade.");
      if (restored.error) throw Error(restored.error);
      const amount = phi.trim() ? parseWildsPhiInput(phi) : "0";
      const requested = requestedPhi.trim() ? parseWildsPhiInput(requestedPhi) : "0";
      if (amount === null || requested === null) throw Error("Enter an exact PHI amount with up to six decimal places.");
      const draft = createWildsWalletTradeDraft({ attemptId: `wallet:trade:${crypto.randomUUID()}`, recipient, selfHandle: publicUsername,
        phiMicro: amount, requestedPhiMicro: requested, requestNote: note, selections: chosen });
      const saved: WildsWalletTradeReview = { schema: "wildz.wallet.trade-review.v1", owner: publicUsername, draft,
        labels: chosen.map(({selection, quantity}) => ({id: selection.id, label: selection.label, quantity})), status: "reviewed", ...(inReplyTo ? {inReplyTo} : {}) };
      recoveryStore.write(publicUsername, saved);
      setSavedReview(saved); setReview(draft);
      setError(""); setResult(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Check the trade details."); }
  };
  const propose = async () => {
    if (!review || !savedReview || !onProposeTrade || running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const saved = await sendSavedWildsWalletTradeReview({ review: savedReview, store: recoveryStore, propose: onProposeTrade });
      setSavedReview(saved); setResult(saved.result ?? null);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Trade recovery is unavailable."); }
    finally { running.current = false; setBusy(false); }
  };
  const approve = async (recover = false) => {
    const action = recover ? onRecoverTrade : onApproveTrade;
    if (!agreement || !action || running.current) return;
    running.current = true; setBusy(true); setError("");
    try { setExchange(await action(agreement)); }
    catch { setExchange({status: "pending", message: "Check this same exchange to recover its status."}); }
    finally { running.current = false; setBusy(false); }
  };
  return <section aria-labelledby="wilds-wallet-trade-title" className={styles.panel}>
    <header><small>PEER EXCHANGE</small><h2 id="wilds-wallet-trade-title">{agreement ? "Review final exchange" : review ? "Review trade package" : inReplyTo ? "Build your counteroffer" : "Build a trade"}</h2><p>Combine PHI, creatures and resources in one offer.</p></header>
    {agreement ? <>
      {[agreement.first, agreement.second].map(side => <div key={side.senderHandle}><h3>@{side.senderHandle} sends</h3><p>{formatWildsPhiExact(side.draft.offered.phiMicro)} Φ</p><ul className={styles.package}>{side.draft.offered.assets.map((asset, index) => <li key={index}>{describeTradeAsset(asset)}</li>)}</ul></div>)}
      <p>Approve these exact packages. The exchange completes after both people approve, with every asset moving together.</p>
      {!exchange || exchange.status === "failed" ? <div className={styles.actions}><button disabled={busy} onClick={() => {setAgreement(null); setExchange(null);}} type="button">Back</button><button disabled={busy || !onApproveTrade} onClick={() => {void approve();}} type="button">{busy ? "Preparing approval…" : "Approve exchange"}</button></div> : null}
      {exchange?.status === "awaiting-peer" || exchange?.status === "pending" ? <button disabled={busy || !onRecoverTrade} onClick={() => {void approve(true);}} type="button">{busy ? "Checking exchange…" : "Check same exchange"}</button> : null}
      {exchange?.status === "committed" && exchange.assetRecoveryRequired ? <button disabled={busy || !onRecoverTrade} onClick={() => {void approve(true);}} type="button">{busy ? "Refreshing assets…" : "Refresh received assets"}</button> : null}
      {exchange ? <p role="status">{exchange.message}</p> : null}
    </> : review ? <>
      <dl className={styles.review}><div><dt>Trade with</dt><dd>@{review.recipientHandle}</dd></div><div><dt>Your PHI</dt><dd>{formatWildsPhiExact(review.offered.phiMicro)} Φ</dd></div><div><dt>Requested PHI</dt><dd>{formatWildsPhiExact(review.requestedPhiMicro)} Φ</dd></div></dl>
      <ul className={styles.package}>{savedReview?.labels.map(({id, label, quantity}) => <li key={id}><span>{label}</span><b>{quantity}</b></li>)}</ul>
      {review.requestNote ? <p><strong>In exchange for:</strong> {review.requestNote}</p> : null}
      <p>They can accept or counteroffer. You both review the final package before the exchange. Every agreed asset moves together.</p>
      {(!result && savedReview?.status !== "pending") || result?.status === "failed" ? <div className={styles.actions}><button disabled={busy} onClick={() => {
        try { if (publicUsername) recoveryStore.clear(publicUsername); setReview(null); setSavedReview(null); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Trade recovery is unavailable."); }
      }} type="button">Edit package</button><button disabled={busy || !onProposeTrade} onClick={() => { void propose(); }} type="button">{busy ? "Sending offer…" : "Send trade offer"}</button></div> : null}
      {result?.status === "pending" ? <button disabled={busy} onClick={() => { void propose(); }} type="button">{busy ? "Checking offer…" : "Check same offer"}</button> : null}
      {result ? <p role="status">{result.message}</p> : null}
      {result?.status === "offered" && savedReview?.inReplyTo && publicUsername ? <button type="button" onClick={() => {
        try {setAgreement(createWildsWalletTradeAgreement(savedReview.inReplyTo!, {senderHandle: publicUsername, draft: savedReview.draft})); setExchange(null); setError("");}
        catch (cause) {setError(cause instanceof Error ? cause.message : "Check the trade agreement.");}
      }}>Review final trade</button> : null}
      {result?.status === "offered" ? <button type="button" onClick={() => {
        try {if (publicUsername) recoveryStore.clear(publicUsername); setReview(null); setSavedReview(null); setResult(null); setSelected({}); setInReplyTo(undefined);}
        catch (cause) {setError(cause instanceof Error ? cause.message : "Trade recovery is unavailable.");}
      }}>Build another offer</button> : null}
    </> : <>
      <label><span>Trade with</span><input aria-label="Trade recipient" autoCapitalize="none" autoCorrect="off" placeholder="@username" value={recipient} onChange={event => setRecipient(event.target.value)} /></label>
      <div className={styles.columns}><label><span>PHI you offer</span><input aria-label="PHI offered in trade" inputMode="decimal" placeholder="0.00" value={phi} onChange={event => setPhi(event.target.value)} /></label><label><span>PHI you request</span><input aria-label="PHI requested in trade" inputMode="decimal" placeholder="0.00" value={requestedPhi} onChange={event => setRequestedPhi(event.target.value)} /></label></div>
      <label><span>What would you like in exchange?</span><textarea aria-label="Assets requested in trade" maxLength={500} placeholder="For example, Living Honey and Foundation Stone" value={note} onChange={event => setNote(event.target.value)} /></label>
      <label><span>Add assets to your package</span><input aria-label="Search trade assets" type="search" placeholder="Fruit, creatures, materials…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className={styles.assets}>{selections.filter(item => !query.trim() || `${item.label} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 32).map(item => {
        const quantity = selected[item.id];
        return <div className={styles.asset} key={item.id}><label><input aria-label={`Add ${item.label} to trade`} type="checkbox" checked={quantity !== undefined} onChange={event => setSelected(current => { const next = { ...current }; if (event.target.checked) next[item.id] = item.adjustableQuantity ? 1 : item.quantity; else delete next[item.id]; return next; })} /><span><b>{item.label}</b><small>{item.detail ?? `${item.quantity} available`}</small></span></label>{quantity !== undefined && item.adjustableQuantity ? <input aria-label={`${item.label} trade quantity`} type="number" min={1} max={Math.min(item.quantity, 64)} value={quantity} onChange={event => setSelected(current => ({ ...current, [item.id]: Number(event.target.value) }))} /> : null}</div>;
      })}</div>
      {chosen.length ? <p>{chosen.length} asset selection{chosen.length === 1 ? "" : "s"} in your package</p> : null}
      <button onClick={prepare} type="button">Review package</button>
    </>}
    {!agreement && incomingTrades.length ? <div><h3>Trade inbox</h3>{incomingTrades.map(item => <article key={item.id}>
      <h4>@{item.senderHandle} · {item.message.stage === "counteroffer" ? "Counteroffer" : "Trade offer"}</h4>
      <p>{formatWildsPhiExact(item.message.draft.offered.phiMicro)} Φ · {item.message.draft.offered.assets.length} asset selection{item.message.draft.offered.assets.length === 1 ? "" : "s"}</p>
      {item.message.draft.requestNote ? <p>{item.message.draft.requestNote}</p> : null}
      {item.message.stage === "offer" ? <button disabled={busy || savedReview?.status === "pending"} type="button" onClick={() => {
        try {if (publicUsername) recoveryStore.clear(publicUsername); setReview(null); setSavedReview(null); setResult(null); setRecipient(item.senderHandle); setPhi(formatWildsPhiExact(item.message.draft.requestedPhiMicro)); setRequestedPhi(formatWildsPhiExact(item.message.draft.offered.phiMicro)); setNote("Your offered package"); setSelected({}); setInReplyTo({senderHandle: item.senderHandle, draft: item.message.draft});}
        catch (cause) {setError(cause instanceof Error ? cause.message : "Trade recovery is unavailable.");}
      }}>Choose what you send</button> : item.message.inReplyTo ? <button disabled={busy || savedReview?.status === "pending"} type="button" onClick={() => {
        try {setAgreement(createWildsWalletTradeAgreement(item.message.inReplyTo!, {senderHandle: item.senderHandle, draft: item.message.draft})); setExchange(null); setError("");}
        catch (cause) {setError(cause instanceof Error ? cause.message : "Check the trade agreement.");}
      }}>Review final trade</button> : null}
    </article>)}</div> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
