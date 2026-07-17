"use client";

import { generateWildzCharacter, type WildzCharacterGenesis, type WildzGender } from "@/features/identity/wildz-genesis";
import {
  friendlyWildzRestoreError,
  type WildzCardOnlyConfirmation,
  type WildzCommittedArtifactRestore
} from "@/features/identity/wildz-restore";
import type { WildzIdentitySession } from "@/lib/receiz/wildz-identity-repository";
import Image from "next/image";
import { useState } from "react";

export function WildzGenesis({
  identity,
  onCreateIdentity,
  onComplete,
  onRestoreArtifact
}: {
  identity: WildzIdentitySession;
  onCreateIdentity: (username: string) => Promise<WildzIdentitySession>;
  onComplete: (character: WildzCharacterGenesis) => void;
  onRestoreArtifact: (file: File, confirmCardOnly: WildzCardOnlyConfirmation) => Promise<WildzCommittedArtifactRestore>;
}) {
  const [gender, setGender] = useState<WildzGender | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [creatingIdentity, setCreatingIdentity] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [restoredIdentity, setRestoredIdentity] = useState<WildzIdentitySession | null>(null);
  const placeholderIdentity = /^wildz_[a-f0-9]{16}$/.test(identity.username ?? "");
  const activeIdentity = restoredIdentity ?? (!placeholderIdentity ? identity : null);

  const create = (selected: WildzGender) => {
    if (!activeIdentity) return;
    setGender(selected);
    const kaiPulse = String(Date.now());
    window.setTimeout(() => onComplete(generateWildzCharacter({
      identityRef: activeIdentity.keyId,
      kaiPulse,
      gender: selected,
      version: 1
    })), 420);
  };

  const createIdentity = async () => {
    const normalized = username.trim().replace(/^@+/, "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(normalized)) {
      setError("Choose 1–64 characters using letters, numbers, dots, dashes, or underscores.");
      return;
    }
    setCreatingIdentity(true);
    setError("");
    try {
      const created = await onCreateIdentity(normalized);
      setRestoredIdentity(created);
      setUsername(created.username ?? normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your Receiz ID could not be created.");
    } finally {
      setCreatingIdentity(false);
    }
  };

  const restore = async (file: File) => {
    setRestoring(true);
    setError("");
    try {
      const result = await onRestoreArtifact(file, () => window.confirm(
        "This file contains verified Wildz cards but no Identity Seal. Import every verified card into the current Receiz ID?"
      ));
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
        <p>Catch, grow, own, and cash out creatures you can take anywhere.</p>
      </div>
      <div className="wildz-genesis-actions" aria-busy={Boolean(gender) || restoring || creatingIdentity}>
        {!activeIdentity ? <label className="wildz-username-control">
          <span>Choose your Receiz username</span>
          <input
            aria-label="Choose your Receiz username"
            autoCapitalize="none"
            autoComplete="username"
            disabled={restoring || creatingIdentity}
            maxLength={65}
            onChange={(event) => setUsername(event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
            placeholder="your_name"
            spellCheck={false}
            value={username}
          />
          <button disabled={!username || restoring || creatingIdentity} onClick={() => void createIdentity()} type="button">
            <span>{creatingIdentity ? "Creating Receiz ID…" : "Create Receiz ID"}</span><small>Your portable game identity</small>
          </button>
        </label> : null}
        <button type="button" onClick={() => create("female")} disabled={!activeIdentity || Boolean(gender) || restoring || creatingIdentity}>
          <span>Female explorer</span><small>Start your adventure</small>
        </button>
        <button type="button" onClick={() => create("male")} disabled={!activeIdentity || Boolean(gender) || restoring || creatingIdentity}>
          <span>Male explorer</span><small>Start your adventure</small>
        </button>
        <label className="wildz-restore-control">
          <span>{restoring ? "Reading your Wildz…" : "Restore Identity Seal or Vault"}</span>
          <input type="file" accept="application/json,image/png,.receized.png,.receizvault,application/vnd.receiz.vault+zip,application/zip" disabled={restoring || creatingIdentity || Boolean(gender)} onChange={(event) => {
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
      {gender ? <div className="wildz-pulse-reveal"><i /><span>Shaping your explorer</span></div> : null}
      {error ? <p className="wildz-genesis-error" role="status">{error}</p> : null}
    </section>
  );
}
