"use client";

import type { PublicWildzCard } from "@/features/profile/public-profile";
import { useRef, useState } from "react";

export function WildzVaultSheet({ cards, title = "Public Vault", onAddVault, onClaimBearer, onSaveVault }: {
  cards: PublicWildzCard[];
  title?: string;
  onAddVault?: (file: File) => Promise<number>;
  onClaimBearer?: (file: File) => Promise<number | null>;
  onSaveVault?: () => Promise<void>;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const claimInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"add" | "claim" | "save" | null>(null);
  const [message, setMessage] = useState("");

  return <div className="wildz-vault-sheet">
    <header><span>{title}</span><strong>{cards.length} verified</strong></header>
    {onAddVault || onClaimBearer || onSaveVault ? <section className="wildz-vault-popover-actions" aria-label="Vault actions">
      {onAddVault ? <button disabled={busy !== null} onClick={() => addInputRef.current?.click()} type="button">{busy === "add" ? "Adding Vault…" : "Add Vault"}</button> : null}
      {onClaimBearer ? <button disabled={busy !== null} onClick={() => claimInputRef.current?.click()} type="button">{busy === "claim" ? "Claiming…" : "Claim bearer artifact"}</button> : null}
      {onSaveVault ? <button disabled={busy !== null} onClick={async () => {
        setBusy("save");
        setMessage("Saving the combined Vault…");
        try {
          await onSaveVault();
          setMessage("Combined Vault saved. Its current Identity Seal is now its owner binding.");
        } catch (cause) {
          setMessage(cause instanceof Error ? cause.message : "The combined Vault could not be saved.");
        } finally {
          setBusy(null);
        }
      }} type="button">{busy === "save" ? "Saving…" : "Save combined Vault"}</button> : null}
      {onAddVault ? <input ref={addInputRef} accept="image/png,.png,.receized.png,.receizvault,application/vnd.receiz.vault+zip,application/zip" className="wilds-import-input" disabled={busy !== null} onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        setBusy("add");
        setMessage("Verifying and combining Vault cards…");
        try {
          const count = await onAddVault(file);
          setMessage(`${count} verified card${count === 1 ? "" : "s"} combined into this Vault.`);
        } catch (cause) {
          setMessage(cause instanceof Error ? cause.message : "That Vault could not be added.");
        } finally {
          setBusy(null);
        }
      }} type="file" /> : null}
      {onClaimBearer ? <input ref={claimInputRef} accept="image/png,.png,.receized.png,.receizvault,application/vnd.receiz.vault+zip,application/zip" className="wilds-import-input" disabled={busy !== null} onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        setBusy("claim");
        setMessage("Verifying bearer custody with Receiz…");
        try {
          const count = await onClaimBearer(file);
          setMessage(count === null
            ? "Bearer claim cancelled. Nothing changed."
            : `${count} claimed card${count === 1 ? "" : "s"} admitted and saved with the new ownership artifact.`);
        } catch (cause) {
          setMessage(cause instanceof Error ? cause.message : "That bearer artifact could not be claimed.");
        } finally {
          setBusy(null);
        }
      }} type="file" /> : null}
    </section> : null}
    {message ? <p className="wildz-vault-popover-message" aria-live="polite" role="status">{message}</p> : null}
    {cards.length ? <div className="wildz-vault-grid">{cards.map((card) => <article key={card.id}>
      <i aria-hidden="true">✦</i><strong>{card.name}</strong><small>{card.status ?? "verified"}</small>
      <code>{card.proofDigest.slice(0, 18)}…</code>
      {card.listedPriceCents ? <b>${(card.listedPriceCents / 100).toFixed(2)}</b> : null}
    </article>)}</div> : <p className="wildz-sheet-empty">No companions are public yet.</p>}
  </div>;
}
