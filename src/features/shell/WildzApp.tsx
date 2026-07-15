"use client";

import { PlayCampaign } from "@/features/play/PlayCampaign";
import { WildzGenesis } from "@/features/identity/WildzGenesis";
import {
  WILDZ_CHARACTER_STORAGE_KEY,
  parseWildzCharacter,
  type WildzCharacterGenesis
} from "@/features/identity/wildz-genesis";
import {
  ensureWildzIdentity,
  saveWildzIdentity,
  type StoredWildzIdentity
} from "@/features/identity/wildz-identity";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { sanitizePublicWildzProfile } from "@/features/profile/public-profile";
import { WildzProfileSheet } from "@/features/profile/WildzProfileSheet";
import { WildzVaultSheet } from "@/features/profile/WildzVaultSheet";
import { WildzMarketSheet } from "@/features/market/WildzMarketSheet";
import type { WildzOverlay } from "@/features/shell/wildz-overlay";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const WILDS_AVATAR_KEY = "receiz:wilds:explorer:v1";

export function WildzApp({ initialOverlay = null }: { initialOverlay?: WildzOverlay }) {
  const [overlay, setOverlay] = useState<WildzOverlay>(initialOverlay);
  const [identity, setIdentity] = useState<StoredWildzIdentity | null>(null);
  const [character, setCharacter] = useState<WildzCharacterGenesis | null>(null);
  const [restoredAssets, setRestoredAssets] = useState<PortableCardAsset[]>([]);
  const [identityError, setIdentityError] = useState("");
  const viewingOwnProfile = !overlay || overlay.kind !== "profile" || overlay.username.toLowerCase() === `@${identity?.identity.username ?? ""}`.toLowerCase();
  const publicProfile = useMemo(() => sanitizePublicWildzProfile({
    username: overlay?.kind === "profile" ? overlay.username : identity?.identity.username,
    displayName: viewingOwnProfile ? identity?.identity.displayName : overlay?.kind === "profile" ? overlay.username.replace(/^@/, "") : undefined,
    explorer: viewingOwnProfile ? character : null,
    vault: viewingOwnProfile ? restoredAssets.map((asset) => ({
      id: asset.id,
      name: asset.manifest.name,
      proofDigest: asset.proof.digest,
      visibility: "public",
      status: asset.status
    })) : [],
    discoveries: viewingOwnProfile ? restoredAssets.length : 0,
    reputation: viewingOwnProfile ? restoredAssets.length * 12 : 0,
    record: { wins: 0, losses: 0, raids: 0 }
  }), [character, identity, overlay, restoredAssets, viewingOwnProfile]);

  useEffect(() => {
    let active = true;
    void ensureWildzIdentity(window.localStorage)
      .then((record) => {
        if (!active) return;
        setIdentity(record);
        const restoredCharacter = parseWildzCharacter(window.localStorage.getItem(WILDZ_CHARACTER_STORAGE_KEY));
        if (restoredCharacter?.identityRef === record.identity.keyFile.keyId) setCharacter(restoredCharacter);
      })
      .catch((cause) => active && setIdentityError(cause instanceof Error ? cause.message : "Unable to prepare your Receiz ID."));
    return () => { active = false; };
  }, []);

  const completeGenesis = (next: WildzCharacterGenesis) => {
    window.localStorage.setItem(WILDZ_CHARACTER_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem(WILDS_AVATAR_KEY, next.gender);
    setCharacter(next);
  };

  return (
    <main className="wildz-app-shell">
      <div className="wildz-app" data-overlay={overlay?.kind ?? "world"}>
        {identity && character ? <PlayCampaign
          campaignName="Wildz"
          enabled
          ownerReceizId={identity.identity.username}
          restoredAssets={restoredAssets}
          onListAsset={async (asset, priceCents) => {
            const idempotencyKey = `list:${identity.identity.username}:${asset.id}:${asset.proof.digest}`;
            const response = await fetch("/api/market/listings", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ actor: `@${identity.identity.username}`, owner: `@${identity.identity.username}`, assetId: asset.id, proofDigest: asset.proof.digest, priceCents, currency: "USD", expectedRevision: 0, idempotencyKey }) });
            if (!response.ok) return null;
            const listed = { ...asset, status: "listed" as const };
            setRestoredAssets((current) => [...current.filter((item) => item.id !== listed.id), listed]);
            return listed;
          }}
        /> : identity ? <WildzGenesis
          identity={identity}
          onComplete={completeGenesis}
          onRestoreIdentity={(record) => {
            const restored = saveWildzIdentity(window.localStorage, record.identity);
            window.localStorage.removeItem(WILDZ_CHARACTER_STORAGE_KEY);
            setCharacter(null);
            setIdentity(restored);
          }}
          onRestoreVault={setRestoredAssets}
        /> : <div className="wildz-identity-loading" role="status">
          <Image src="/brand/wildz-mark.svg" alt="" width={64} height={64} priority />
          <span>{identityError || "Preparing your Receiz ID…"}</span>
        </div>}
      </div>

      <div className="wildz-brand-corner" aria-label="Wildz">
        <Image src="/brand/wildz-mark.svg" alt="" width={42} height={42} priority />
        <span>WILDZ</span>
      </div>

      {identity && character ? <nav className="wildz-utility-dock" aria-label="Wildz utilities">
        <button type="button" onClick={() => setOverlay({ kind: "profile", username: `@${identity.identity.username}` })} aria-label="Open player profile">◉</button>
        <button type="button" onClick={() => setOverlay({ kind: "vault" })} aria-label="Open public Vault">◇</button>
        <button type="button" onClick={() => setOverlay({ kind: "market" })} aria-label="Open player market">↝</button>
      </nav> : null}

      {overlay ? (
        <section className="wildz-shell-overlay" role="dialog" aria-modal="true" aria-label={`${overlay.kind} panel`}>
          <button type="button" className="wildz-overlay-dismiss" onClick={() => setOverlay(null)} aria-label="Return to world">
            <span aria-hidden="true">×</span>
          </button>
          {overlay.kind === "profile" ? <WildzProfileSheet profile={publicProfile} /> : overlay.kind === "vault" ? <WildzVaultSheet cards={publicProfile.vault} /> : overlay.kind === "market" ? <WildzMarketSheet listings={[]} buyer={`@${identity?.identity.username ?? "explorer"}`} ownedCards={publicProfile.vault} /> : <div className="wildz-shell-overlay-placeholder">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{overlay.kind}</strong>
            <span>Wildz surface loading</span>
          </div>}
        </section>
      ) : null}
    </main>
  );
}
