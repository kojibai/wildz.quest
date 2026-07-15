"use client";

import { generateWildzCharacter, type WildzCharacterGenesis, type WildzGender } from "@/features/identity/wildz-genesis";
import {
  friendlyWildzRestoreError,
  type WildzCardOnlyConfirmation,
  type WildzCommittedArtifactRestore
} from "@/features/identity/wildz-restore";
import { saveReceizCommerceVault } from "@/lib/receiz/receiz-commerce-vault";
import type { WildzIdentitySession } from "@/lib/receiz/wildz-identity-repository";
import Image from "next/image";
import { useState } from "react";

export function WildzGenesis({
  identity,
  onComplete,
  onRestoreArtifact
}: {
  identity: WildzIdentitySession;
  onComplete: (character: WildzCharacterGenesis) => void;
  onRestoreArtifact: (file: File, confirmCardOnly: WildzCardOnlyConfirmation) => Promise<WildzCommittedArtifactRestore>;
}) {
  const [gender, setGender] = useState<WildzGender | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [restoredIdentity, setRestoredIdentity] = useState<WildzIdentitySession | null>(null);

  const create = (selected: WildzGender) => {
    setGender(selected);
    const kaiPulse = String(Date.now());
    window.setTimeout(() => onComplete(generateWildzCharacter({
      identityRef: identity.keyId,
      kaiPulse,
      gender: selected,
      version: 1
    })), 420);
  };

  const restore = async (file: File) => {
    setRestoring(true);
    setError("");
    try {
      const result = await onRestoreArtifact(file, () => window.confirm(
        "This file contains verified Wildz cards but no Identity Seal. Import every verified card into the current Receiz ID?"
      ));
      if (result.commerceProjection) {
        try {
          saveReceizCommerceVault(result.commerceProjection);
        } catch {
          // Display projections are optional; the verified owner restore is already committed.
        }
      }
      setRestoredIdentity(result.session);
      const count = result.verifiedAssetIds.length;
      setError(count
        ? `${count} verified Receiz card${count === 1 ? "" : "s"} restored into your Card Vault. Choose your explorer to enter the world.`
        : "Your verified Receiz ID is restored. Choose your explorer to enter the world.");
    } catch (cause) {
      setError(friendlyWildzRestoreError(cause));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="wildz-genesis" aria-label="Create or restore your Wildz explorer">
      <div className="wildz-genesis-brand">
        <Image src="/brand/wildz-wordmark.svg" alt="Wildz" width={240} height={48} priority />
        <p>Your Receiz ID is ready. Shape the explorer only you can become.</p>
      </div>
      <div className="wildz-genesis-actions" aria-busy={Boolean(gender) || restoring}>
        <button type="button" onClick={() => create("female")} disabled={Boolean(gender) || restoring}>
          <span>Female explorer</span><small>Generate from this Kai Pulse</small>
        </button>
        <button type="button" onClick={() => create("male")} disabled={Boolean(gender) || restoring}>
          <span>Male explorer</span><small>Generate from this Kai Pulse</small>
        </button>
        <label className="wildz-restore-control">
          <span>{restoring ? "Reading your Wildz…" : "Restore Identity Seal or Vault"}</span>
          <input type="file" accept="application/json,image/png,.receized.png,.receizvault,application/vnd.receiz.vault+zip,application/zip" disabled={restoring || Boolean(gender)} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void restore(file);
          }} />
        </label>
      </div>
      {restoredIdentity ? <div className="wildz-identity-restored" role="status">
        <span>Restored Receiz ID</span>
        <strong>@{restoredIdentity.username ?? restoredIdentity.actorId}</strong>
        <small>{restoredIdentity.displayName ?? "Wildz Explorer"}</small>
      </div> : null}
      {gender ? <div className="wildz-pulse-reveal"><i /><span>Kai Pulse is shaping your explorer</span></div> : null}
      {error ? <p className="wildz-genesis-error" role="status">{error}</p> : null}
    </section>
  );
}
