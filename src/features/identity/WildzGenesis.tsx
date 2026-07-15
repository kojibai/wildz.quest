"use client";

import type { StoredWildzIdentity } from "@/features/identity/wildz-identity";
import { generateWildzCharacter, type WildzCharacterGenesis, type WildzGender } from "@/features/identity/wildz-genesis";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { friendlyWildzRestoreError } from "@/features/identity/wildz-restore";
import { inspectWildzRestore } from "@/lib/receiz/wildz-identity-adapter";
import Image from "next/image";
import { useState } from "react";

export function WildzGenesis({
  identity,
  onComplete,
  onRestoreIdentity,
  onRestoreVault
}: {
  identity: StoredWildzIdentity;
  onComplete: (character: WildzCharacterGenesis) => void;
  onRestoreIdentity: (identity: StoredWildzIdentity) => void;
  onRestoreVault: (assets: PortableCardAsset[]) => void;
}) {
  const [gender, setGender] = useState<WildzGender | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [identityRestored, setIdentityRestored] = useState(false);

  const create = (selected: WildzGender) => {
    setGender(selected);
    const kaiPulse = String(Date.now());
    window.setTimeout(() => onComplete(generateWildzCharacter({
      identityRef: identity.identity.keyFile.keyId,
      kaiPulse,
      gender: selected,
      version: 1
    })), 420);
  };

  const restore = async (file: File) => {
    setRestoring(true);
    setError("");
    try {
      const result = await inspectWildzRestore(file);
      if (result.identity) {
        onRestoreIdentity({ version: 1, savedAt: new Date().toISOString(), identity: result.identity });
        setIdentityRestored(true);
      } else {
        onRestoreVault([...result.assets]);
        setError(`${result.summary.cardCount} verified cards restored. Choose your explorer to enter the world.`);
      }
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
          <input type="file" accept="application/json,image/png,.receized.png" disabled={restoring || Boolean(gender)} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void restore(file);
          }} />
        </label>
      </div>
      {identityRestored ? <div className="wildz-identity-restored" role="status">
        <span>Restored Receiz ID</span>
        <strong>@{identity.identity.username}</strong>
        <small>{identity.identity.displayName}</small>
      </div> : null}
      {gender ? <div className="wildz-pulse-reveal"><i /><span>Kai Pulse is shaping your explorer</span></div> : null}
      {error ? <p className="wildz-genesis-error" role="status">{error}</p> : null}
    </section>
  );
}
