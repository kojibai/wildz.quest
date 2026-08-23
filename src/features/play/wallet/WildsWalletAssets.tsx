"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdventureCardCondition } from "@/features/play/adventure/card-condition";
import { createWildsCardSendDraft, downloadBlob } from "@/features/play/card-export";
import { WildsCardScene } from "@/features/play/WildsCardScene";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { WildzPreparedIdentityOwnedCard } from "@/lib/receiz/wildz-identity-adapter";
import type { WildsWalletControllerState } from "./wilds-wallet-controller";
import { formatWildsPhiExact } from "./wilds-wallet-format";

export function WildsWalletAssets({ cards, cardConditions, onPrepareCard, state }: {
  cards: readonly PortableCardAsset[];
  cardConditions: Readonly<Record<string, AdventureCardCondition>>;
  onPrepareCard?: (asset: PortableCardAsset) => Promise<WildzPreparedIdentityOwnedCard>;
  state: WildsWalletControllerState;
}) {
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");
  const [target, setTarget] = useState("");
  const [origin, setOrigin] = useState("https://wildz.quest");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => cards.find((card) => card.id === selectedId) ?? cards[0] ?? null, [cards, selectedId]);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const sendSelectedCard = async () => {
    if (!selected || !onPrepareCard) return;
    setSending(true);
    setMessage("Preparing the exact verified card…");
    try {
      const draft = createWildsCardSendDraft(selected, target, origin);
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

  return <section aria-labelledby="wilds-wallet-assets-title" className="wilds-wallet-surface">
    <header><small>ADMITTED CUSTODY</small><h2 id="wilds-wallet-assets-title">Assets</h2></header>
    {state.summary ? <dl className="wilds-wallet-asset-register">
      <div><dt>Phi total</dt><dd>Φ {formatWildsPhiExact(state.summary.admittedPhiMicro)}</dd><small>Exact value carried by this Receiz ID.</small></div>
      <div><dt>Resource units</dt><dd>{state.summary.transferableResourceCount ?? "—"}</dd><small>Your current beans, fusion sparks, and catalysts.</small></div>
      <div><dt>Creature cards</dt><dd>{cards.length}</dd><small>Verified cards in your active Wildz Vault.</small></div>
      {state.summary.reservedCardCount ? <div><dt>Unavailable to send</dt><dd>{state.summary.reservedCardCount}</dd><small>Already listed, committed, suspended, or revoked.</small></div> : null}
    </dl> : null}
    {cards.length ? <div className="wilds-wallet-card-vault">
      <div aria-label="Choose a wallet card" className="wilds-wallet-card-selector">{cards.map((card) => <button aria-pressed={selected?.id === card.id} key={card.id} onClick={() => { setSelectedId(card.id); setMessage(""); }} type="button"><span>{card.manifest.name}</span><small>{card.manifest.rarity} · Stage {card.manifest.stage}</small></button>)}</div>
      {selected ? <div className="wilds-wallet-card-detail">
        <div className="wilds-wallet-card-stage"><WildsCardScene asset={selected} condition={cardConditions[selected.id]} origin={origin} qr="" tapToFlip /></div>
        <small>Tap or swipe the card to see its complete verified back.</small>
        <label><span>Send this exact card</span><input aria-label="Receiz username or email to send this card" autoCapitalize="none" autoCorrect="off" onChange={(event) => setTarget(event.target.value)} placeholder="@username or email" value={target} /></label>
        <button disabled={sending || !target.trim() || !onPrepareCard} onClick={() => { void sendSelectedCard(); }} type="button">{sending ? "Preparing verified card…" : `Send ${selected.manifest.name}`}</button>
        {message ? <p aria-live="polite">{message}</p> : null}
      </div> : null}
    </div> : <p>No creature cards are carried by this Receiz ID yet.</p>}
  </section>;
}
