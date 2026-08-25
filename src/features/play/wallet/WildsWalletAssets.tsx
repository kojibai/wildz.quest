"use client";

import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/components/icons";
import type { AdventureCardCondition } from "@/features/play/adventure/card-condition";
import { createWildsCardSendDraft, downloadBlob, normalizeWildsCardSendTarget } from "@/features/play/card-export";
import { WildsCardScene } from "@/features/play/WildsCardScene";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { WildzPreparedIdentityOwnedCard } from "@/lib/receiz/wildz-identity-adapter";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";
import { PhiNetworkAmount } from "./PhiNetworkMark";
import type { WildsResourceLotV1 } from "@/features/play/wilds-resource-lot";

export function WildsWalletAssets({ cards, cardConditions, resourceLots, onOpenVaultCard, onPrepareCard, onSendCard, onSendResource, state }: {
  cards: readonly PortableCardAsset[];
  cardConditions: Readonly<Record<string, AdventureCardCondition>>;
  resourceLots: readonly WildsResourceLotV1[];
  onOpenVaultCard?: (assetId: string) => void;
  onPrepareCard?: (asset: PortableCardAsset) => Promise<WildzPreparedIdentityOwnedCard>;
  onSendCard?: (asset: PortableCardAsset, targetHandle: string) => Promise<unknown>;
  onSendResource?: (resourceLot: WildsResourceLotV1, targetHandle: string) => Promise<Readonly<{ claimUrl: string }>>;
  state: WildsWalletControllerState;
}) {
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [origin, setOrigin] = useState("https://wildz.quest");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [resourceTarget, setResourceTarget] = useState("");
  const [resourceMessage, setResourceMessage] = useState("");
  const [resourceSending, setResourceSending] = useState(false);
  const selected = useMemo(() => cards.find((card) => card.id === selectedId) ?? cards[0] ?? null, [cards, selectedId]);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const sendSelectedCard = async () => {
    if (!selected) return;
    setSending(true);
    setMessage("Preparing the exact verified card…");
    try {
      const draft = createWildsCardSendDraft(selected, target, origin);
      if (draft.target.kind === "receiz-username") {
        if (!onSendCard) throw new Error("Online card transfer is unavailable.");
        await onSendCard(selected, draft.target.value);
        setMessage(`One-use card claim sent privately to ${draft.target.label}. Your card remains here until they claim it.`);
        return;
      }
      if (!onPrepareCard) throw new Error("Verified card export is unavailable.");
      const artifact = await onPrepareCard(selected);
      const blob = new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType });
      const file = new File([blob], artifact.filename, { type: artifact.mimeType });
      const shareData: ShareData = { title: draft.title, text: draft.text, url: draft.url, files: [file] };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setMessage(`Verified card prepared for ${draft.target.label}.`);
      } else {
        downloadBlob(blob, artifact.filename);
        await navigator.clipboard?.writeText(draft.text).catch(() => undefined);
        setMessage(`Verified card downloaded for ${draft.target.label}. Send the downloaded proof object; its claim travels with it.`);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Card send could not be prepared.");
    } finally {
      setSending(false);
    }
  };

  const sendResource = async (lot: WildsResourceLotV1) => {
    if (!onSendResource || !resourceTarget.trim()) return;
    setResourceSending(true);
    setResourceMessage("Sealing one-use resource claim…");
    try {
      const { claimUrl } = await onSendResource(lot, resourceTarget);
      const shareData = { title: "Living Honey", text: `Claim Living Honey from @${resourceTarget.replace(/^@/, "")}`, url: claimUrl };
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(claimUrl);
      setResourceMessage("One-use claim ready. The resource stays yours until it is claimed.");
    } catch (cause) {
      setResourceMessage(cause instanceof Error ? cause.message : "Resource claim could not be prepared.");
    } finally {
      setResourceSending(false);
    }
  };

  return <section aria-labelledby="wilds-wallet-assets-title" className="wilds-wallet-surface">
    <header><small>ADMITTED CUSTODY</small><h2 id="wilds-wallet-assets-title">Assets</h2></header>
    {state.summary ? <dl className="wilds-wallet-asset-register">
      <div><dt>Phi total</dt><dd><PhiNetworkAmount value={formatWildsPhiExact(state.summary.admittedPhiMicro)} /></dd><small>Exact value carried by this Receiz ID.</small></div>
      <div><dt>Resource units</dt><dd>{state.summary.transferableResourceCount ?? "—"}</dd><small>Your current beans, fusion sparks, and catalysts.</small></div>
      <div><dt>Creature cards</dt><dd>{cards.length}</dd><small>Verified cards in your active Wildz Vault.</small></div>
      {state.summary.reservedCardCount ? <div><dt>Unavailable to send</dt><dd>{state.summary.reservedCardCount}</dd><small>Already listed, committed, suspended, or revoked.</small></div> : null}
    </dl> : null}
    {resourceLots.length ? <section aria-label="Verified world resources" className="wilds-wallet-resource-vault">
      <header><small>WORLD-BORN CUSTODY</small><strong>Harvested resources</strong></header>
      <div>{resourceLots.map((lot) => <article key={lot.lotId}>
        <span aria-hidden="true" className="wilds-wallet-resource-mark">✦</span>
        <div><strong>Living Honey</strong><small>{lot.quantity} sealed unit{lot.quantity === 1 ? "" : "s"} · Quality {lot.quality}</small><p>Harvested with a willing companion in a living grove.</p></div>
        <b>VERIFIED</b>
      </article>)}</div>
      {onSendResource ? <div className="wilds-wallet-resource-send"><label><span>Send one exact resource</span><input aria-label="Receiz username to send Living Honey" autoCapitalize="none" autoCorrect="off" onChange={(event) => setResourceTarget(event.target.value)} placeholder="@username" value={resourceTarget} /></label><button disabled={resourceSending || !resourceTarget.trim()} onClick={() => { const lot = resourceLots[0]; if (lot) void sendResource(lot); }} type="button">{resourceSending ? "Preparing claim…" : "Send Living Honey"}</button>{resourceMessage ? <p aria-live="polite">{resourceMessage}</p> : null}</div> : null}
    </section> : null}
    {cards.length ? <div className="wilds-wallet-card-vault">
      <div aria-label="Choose a wallet card" className="wilds-wallet-card-selector">{cards.map((card) => <button aria-pressed={selected?.id === card.id} key={card.id} onClick={() => { setSelectedId(card.id); setMessage(""); }} type="button"><span>{card.manifest.name}</span><small>{card.manifest.rarity} · Stage {card.manifest.stage}</small></button>)}</div>
      {selected ? <div className="wilds-wallet-card-detail">
        {onOpenVaultCard ? <div className="wilds-wallet-card-heading"><small>SELECTED CARD</small><button aria-label={`Open ${selected.manifest.name} in Card Vault`} className="wilds-wallet-vault-pill" onClick={() => onOpenVaultCard(selected.id)} type="button"><Icons.box aria-hidden="true" size={16} /><span>Vault</span></button></div> : null}
        <div className="wilds-wallet-card-stage"><WildsCardScene asset={selected} condition={cardConditions[selected.id]} origin={origin} qr="" tapToFlip /></div>
        <small>Tap or swipe the card to see its complete verified back.</small>
        <label><span>Send this exact card</span><input aria-label="Receiz username or email to send this card" autoCapitalize="none" autoCorrect="off" onChange={(event) => setTarget(event.target.value)} placeholder="@username or email" value={target} /></label>
        <button disabled={sending || !target.trim() || (!onSendCard && !onPrepareCard) || !normalizeWildsCardSendTarget(target)} onClick={() => { void sendSelectedCard(); }} type="button">{sending ? "Preparing verified card…" : `Send ${selected.manifest.name}`}</button>
        {message ? <p aria-live="polite">{message}</p> : null}
      </div> : null}
    </div> : <p>No creature cards are carried by this Receiz ID yet.</p>}
  </section>;
}
