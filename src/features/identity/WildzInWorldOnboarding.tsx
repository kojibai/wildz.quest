"use client";

import type { WildzGender } from "@/features/identity/wildz-genesis";
import type { WildzIdentitySession } from "@/lib/receiz/wildz-identity-repository";
import { useEffect, useRef } from "react";

export function WildzInWorldOnboarding({
  identity,
  busy,
  error,
  onChooseExplorer,
  onAddVault,
  onOpenProfile
}: {
  identity: WildzIdentitySession;
  busy: "explorer" | "vault" | null;
  error: string;
  onChooseExplorer: (gender: WildzGender) => void;
  onAddVault: (file: File) => Promise<void>;
  onOpenProfile: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const disabled = busy !== null;
  const username = identity.username ?? identity.actorId;

  return (
    <section className="wildz-in-world-onboarding" role="dialog" aria-modal="true" aria-labelledby="wildz-onboarding-title">
      <div className="wildz-onboarding-card" aria-busy={disabled}>
        <p className="wildz-onboarding-eyebrow">Receiz ID · @{username}</p>
        <h1 id="wildz-onboarding-title" ref={headingRef} tabIndex={-1}>Choose your explorer</h1>
        <p>Your world and Receiz ID are ready. Pick an explorer, or add cards from an existing Vault first.</p>

        <div className="wildz-onboarding-explorers">
          <button type="button" disabled={disabled} onClick={() => onChooseExplorer("female")}>
            <strong>Female explorer</strong><span>Enter the living world</span>
          </button>
          <button type="button" disabled={disabled} onClick={() => onChooseExplorer("male")}>
            <strong>Male explorer</strong><span>Enter the living world</span>
          </button>
        </div>

        <label className="wildz-onboarding-vault">
          <strong>{busy === "vault" ? "Adding Vault…" : "Add Vault"}</strong>
          <span>Merge its cards into @{username}; your Receiz ID will not change.</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,image/png,.receized.png,.receizvault,application/vnd.receiz.vault+zip,application/zip"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void onAddVault(file).finally(() => {
                if (fileRef.current) fileRef.current.value = "";
              });
            }}
          />
        </label>

        <button type="button" className="wildz-onboarding-profile" disabled={disabled} onClick={onOpenProfile}>
          Continue or change Receiz ID in Profile
        </button>
        {error ? <p className="wildz-onboarding-error" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
