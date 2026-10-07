'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Package, Send, Share2, Upload } from 'lucide-react';
import type { WildsMessengerParticipant } from './wilds-messenger-core';
import styles from './resource-exchange.module.css';

export type ExchangeItem = Readonly<{ id: string; group: string; label: string; food?: boolean }>;
export type ExchangeCard = Readonly<{ id: string; title: string; summary: string; status: string; transferable: boolean; unpackable: boolean; cancellable: boolean; recoverable?: boolean }>;
export type ExchangeClaim = Readonly<{ claimId: string; claimProof: string; claimUrl: string }>;
export type ExchangeAvailability = Readonly<{ status: 'checking' | 'available' | 'unavailable' | 'locked'; message: string; foodAvailable?: boolean; marketAvailable?: boolean }>;
export type ResourceExchangeActions = Readonly<{
  connect(): Promise<void>;
  create(ids: readonly string[], individual: boolean): Promise<void>;
  transfer(id: string, recipient: string | null): Promise<ExchangeClaim>;
  unpack(id: string): Promise<void>;
  recover(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  claim(proof: string): Promise<void>;
  list(id: string, priceCents: number): Promise<void>;
  message(peer: WildsMessengerParticipant, claim: ExchangeClaim): Promise<void>;
}>;

export function WildsResourceExchange({ items, cards, actions, availability, checkAvailability, peer }: {
  items: readonly ExchangeItem[];
  cards: readonly ExchangeCard[];
  actions: ResourceExchangeActions;
  availability: ExchangeAvailability;
  checkAvailability: () => Promise<void>;
  peer?: WildsMessengerParticipant | null;
}) {
  useEffect(() => { void checkAvailability(); }, [checkAvailability]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [individual, setIndividual] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [price, setPrice] = useState('');
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  const blocked = busy || availability.status !== 'available';
  const groups = useMemo(() => {
    const grouped = new Map<string, { label: string; ids: string[]; food: boolean }>();
    for (const item of items) {
      const row = grouped.get(item.group) ?? { label: item.label, ids: [], food: Boolean(item.food) };
      row.ids.push(item.id); grouped.set(item.group, row);
    }
    return grouped;
  }, [items]);
  const selectedIds = [...groups].flatMap(([key, group]) => group.food && availability.foodAvailable === false ? [] : group.ids.slice(0, Math.max(0, Math.min(group.ids.length, quantities[key] ?? 0))));
  const perform = async (action: () => Promise<void>, success: string) => {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage('');
    try { await action(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message.replaceAll('_', ' ') : 'Please try again.'); }
    finally { running.current = false; setBusy(false); }
  };
  const exportCard = async (id: string, share: boolean) => {
    const claim = await actions.transfer(id, recipient.trim() || null);
    const { resourceClaimCardFile, downloadResourceCard } = await import('./wilds-resource-card-export');
    const file = await resourceClaimCardFile(claim.claimProof);
    if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'Wildz resource card', files: [file] });
    else downloadResourceCard(file);
  };
  return <section className={styles.panel} aria-label="Resource cards and exchange">
    <header><Package size={19} /><span><strong>Resource cards</strong><small>Food, materials and gathered resources</small></span></header>
    <p>Choose one item or combine several into a card. Unpack a received card to use its contents.</p>
    {availability.message ? <p role="status">{availability.message}</p> : null}
    {availability.status === 'locked' ? <button disabled={busy} type="button" onClick={() => void perform(actions.connect, '')}>Unlock resource exchange</button> : null}
    {availability.status === 'unavailable' ? <button disabled={busy} type="button" onClick={() => void checkAvailability()}>Check availability again</button> : null}
    <div className={styles.quantities}>
      {[...groups].map(([key, group]) => <label key={key}><span>{group.label}<small>{group.ids.length} available{group.food && availability.foodAvailable === false ? ' · food exchange pending' : ''}</small></span><input aria-label={`${group.label} to package`} disabled={busy || group.food && availability.foodAvailable === false} type="number" min={0} max={group.ids.length} step={1} value={Math.min(group.ids.length, quantities[key] ?? 0)} onChange={event => setQuantities(current => ({ ...current, [key]: Math.max(0, Math.min(group.ids.length, Math.floor(Number(event.target.value) || 0))) }))} /></label>)}
      {!groups.size ? <small>Gather food, timber, stone or other resources to make a card.</small> : null}
    </div>
    <label className={styles.option}><input type="checkbox" disabled={busy} checked={individual} onChange={event => setIndividual(event.target.checked)} />Make a separate card for each item</label>
    <button disabled={blocked || !selectedIds.length || selectedIds.length > 64} type="button" onClick={() => void perform(async () => { await actions.create(selectedIds, individual); setQuantities({}); }, individual ? 'Individual resource cards created.' : 'Resource pack created.')}><Package size={16} />{individual ? `Create ${selectedIds.length || ''} individual cards` : `Pack ${selectedIds.length || ''} items into one card`}</button>
    {selectedIds.length > 64 ? <small>Choose up to 64 items per pack.</small> : null}
    {cards.length ? <>
      {!peer ? <label className={styles.field}>Recipient (optional)<input aria-label="Resource card recipient" disabled={busy} value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="@explorer · blank for anyone" /></label> : null}
      <div className={styles.cards}>{cards.map(card => <article key={card.id}>
        <div className={styles.cardFace}><Package size={26} /><small>WILDZ · RESOURCE CARD</small><strong>{card.title}</strong><p>{card.summary}</p><small>{card.status}</small></div>
        <div className={styles.actions}>
          {card.recoverable ? <button disabled={blocked} type="button" onClick={() => void perform(() => actions.recover(card.id), 'Pending share recovered. This card is ready to export or send.')}>Recover pending share</button> : null}
          {card.cancellable ? <button disabled={blocked} type="button" onClick={() => void perform(() => actions.cancel(card.id), 'Pending share cancelled. The card is available again.')}>{['listed', 'reserved'].includes(card.status) ? 'Cancel market listing' : 'Cancel pending share'}</button> : null}
          {card.unpackable ? <button disabled={blocked} type="button" onClick={() => void perform(() => actions.unpack(card.id), 'Contents added to your Satchel.')}><Package size={15} />Unpack & use</button> : null}
          {card.transferable ? <>
            {peer ? <button disabled={blocked} type="button" onClick={() => void perform(async () => { const claim = await actions.transfer(card.id, peer.handle); await actions.message(peer, claim); }, `Resource card sent to ${peer.handle}.`)}><Send size={15} />Send to {peer.handle}</button> : null}
            <button disabled={blocked} type="button" onClick={() => void perform(() => exportCard(card.id, false), 'Proof card downloaded. It can be uploaded or imported by its recipient.')}><Download size={15} />Export proof card</button>
            <button disabled={blocked} type="button" onClick={() => void perform(() => exportCard(card.id, true), 'Proof card ready to share.')}><Share2 size={15} />Share</button>
            <label className={styles.field}>Market price (USD)<input aria-label={`Market price for ${card.title}`} disabled={busy} type="number" min="0.50" step="0.01" placeholder="0.00" value={price} onChange={event => setPrice(event.target.value)} /></label>
            <button disabled={blocked || availability.marketAvailable === false || !Number.isSafeInteger(Math.round(Number(price) * 100)) || Number(price) < 0.50} type="button" onClick={() => void perform(() => actions.list(card.id, Math.round(Number(price) * 100)), 'Resource card listed in the marketplace.')}>Sell on marketplace</button>
          </> : null}
        </div>
      </article>)}</div>
    </> : null}
    <details><summary><Upload size={15} />Import a resource proof card</summary>
      <label className={styles.field}>Upload card<input type="file" accept="image/png,application/json,.json,.png" aria-label="Upload resource proof card" disabled={blocked} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void perform(async () => { const { readResourceCardFile } = await import('./wilds-resource-card-export'); await actions.claim(await readResourceCardFile(file)); }, 'Resource card imported. Its contents are ready in your Satchel.'); }} /></label>
      <label className={styles.field}>Or paste a claim link or proof<textarea aria-label="Resource claim link or proof" value={proof} disabled={busy} onChange={event => setProof(event.target.value)} rows={2} /></label>
      <button disabled={blocked || !proof.trim()} type="button" onClick={() => void perform(async () => { const { resourceClaimProofFromText } = await import('./wilds-resource-card-export'); await actions.claim(resourceClaimProofFromText(proof)); setProof(''); }, 'Resource card imported. Its contents are ready in your Satchel.')}>Import & use</button>
    </details>
    {busy ? <p role="status">Saving the resource operation…</p> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
