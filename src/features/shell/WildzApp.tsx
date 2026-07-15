"use client";

import { PlayCampaign } from "@/features/play/PlayCampaign";
import { WildzGenesis } from "@/features/identity/WildzGenesis";
import {
  WILDZ_CHARACTER_STORAGE_KEY,
  parseWildzCharacter,
  type WildzCharacterGenesis
} from "@/features/identity/wildz-genesis";
import { initialPlayState, type PlayState } from "@/features/play/game-state";
import type { WildzCardOnlyConfirmation } from "@/features/identity/wildz-restore";
import {
  bootstrapWildzContinuity,
  restoreWildzFileForSurface,
  saveWildzContinuityPlayState,
  type WildzContinuitySnapshot,
  type WildzUiArtifactRestore
} from "@/lib/receiz/wildz-identity-adapter";
import { sanitizePublicWildzProfile } from "@/features/profile/public-profile";
import { WildzProfileSheet } from "@/features/profile/WildzProfileSheet";
import { WildzVaultSheet } from "@/features/profile/WildzVaultSheet";
import { WildzMarketSheet } from "@/features/market/WildzMarketSheet";
import type { WildzOverlay } from "@/features/shell/wildz-overlay";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WILDS_AVATAR_KEY = "receiz:wilds:explorer:v1";

export function WildzApp({ initialOverlay = null }: { initialOverlay?: WildzOverlay }) {
  const [overlay, setOverlay] = useState<WildzOverlay>(initialOverlay);
  const [continuity, setContinuity] = useState<WildzContinuitySnapshot | null>(null);
  const continuityRef = useRef<WildzContinuitySnapshot | null>(null);
  const [character, setCharacter] = useState<WildzCharacterGenesis | null>(null);
  const [identityError, setIdentityError] = useState("");
  const identity = continuity?.session ?? null;
  const ownerPlayState = continuity?.playState ?? initialPlayState;
  const ownerUsername = identity?.username ?? identity?.actorId ?? "explorer";
  const viewingOwnProfile = !overlay || overlay.kind !== "profile" || overlay.username.toLowerCase() === `@${ownerUsername}`.toLowerCase();
  const publicProfile = useMemo(() => sanitizePublicWildzProfile({
    username: overlay?.kind === "profile" ? overlay.username : ownerUsername,
    displayName: viewingOwnProfile ? identity?.displayName ?? undefined : overlay?.kind === "profile" ? overlay.username.replace(/^@/, "") : undefined,
    explorer: viewingOwnProfile ? character : null,
    vault: viewingOwnProfile ? ownerPlayState.inventory.map((asset) => ({
      id: asset.id,
      name: asset.manifest.name,
      proofDigest: asset.proof.digest,
      visibility: "public",
      status: asset.status
    })) : [],
    discoveries: viewingOwnProfile ? ownerPlayState.inventory.length : 0,
    reputation: viewingOwnProfile ? ownerPlayState.inventory.length * 12 : 0,
    record: { wins: 0, losses: 0, raids: 0 }
  }), [character, identity, overlay, ownerPlayState.inventory, ownerUsername, viewingOwnProfile]);

  useEffect(() => {
    let active = true;
    void bootstrapWildzContinuity(window.localStorage)
      .then((snapshot) => {
        if (!active) return;
        continuityRef.current = snapshot;
        setContinuity(snapshot);
        const restoredCharacter = parseWildzCharacter(window.localStorage.getItem(WILDZ_CHARACTER_STORAGE_KEY));
        if (restoredCharacter?.identityRef === snapshot.session.keyId) setCharacter(restoredCharacter);
      })
      .catch((cause) => active && setIdentityError(cause instanceof Error ? cause.message : "Unable to prepare your Receiz ID."));
    return () => { active = false; };
  }, []);

  const completeGenesis = (next: WildzCharacterGenesis) => {
    window.localStorage.setItem(WILDZ_CHARACTER_STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem(WILDS_AVATAR_KEY, next.gender);
    setCharacter(next);
  };

  const restoreArtifact = useCallback(async (
    file: File,
    surface: "genesis" | "card-vault",
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState?: PlayState
  ): Promise<WildzUiArtifactRestore> => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_restore_identity_missing");
    const outcome = await restoreWildzFileForSurface(
      file,
      surface,
      confirmCardOnly,
      current,
      currentPlayState ?? current.playState
    );
    const next: WildzContinuitySnapshot = {
      session: outcome.session,
      playState: outcome.playState,
      restoreEpoch: outcome.restoreEpoch
    };
    if (current.session.keyId !== outcome.session.keyId || current.session.actorId !== outcome.session.actorId) {
      window.localStorage.removeItem(WILDZ_CHARACTER_STORAGE_KEY);
      setCharacter(null);
    }
    continuityRef.current = next;
    setContinuity(next);
    return outcome;
  }, []);

  const persistPlayState = useCallback((playState: PlayState) => {
    if (!continuity) return;
    void saveWildzContinuityPlayState(continuity, playState).catch(() => undefined);
  }, [continuity]);

  return (
    <main className="wildz-app-shell">
      <div className="wildz-app" data-overlay={overlay?.kind ?? "world"}>
        {continuity && identity && character ? <PlayCampaign
          key={`${identity.keyId}:${identity.actorId}:${continuity.restoreEpoch}`}
          campaignName="Wildz"
          enabled
          initialState={ownerPlayState}
          ownerReceizId={ownerUsername}
          playerDisplayName={identity.displayName ?? "Wildz Explorer"}
          onPlayStateChange={persistPlayState}
          onRestoreArtifact={(file, confirmCardOnly, currentPlayState) => restoreArtifact(file, "card-vault", confirmCardOnly, currentPlayState)}
          onOpenProfile={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })}
          onOpenMarket={() => setOverlay({ kind: "market" })}
          onListAsset={async (asset, priceCents) => {
            const idempotencyKey = `list:${ownerUsername}:${asset.id}:${asset.proof.digest}`;
            const response = await fetch("/api/market/listings", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ actor: `@${ownerUsername}`, owner: `@${ownerUsername}`, assetId: asset.id, proofDigest: asset.proof.digest, priceCents, currency: "USD", expectedRevision: 0, idempotencyKey }) });
            if (!response.ok) return null;
            return { ...asset, status: "listed" as const };
          }}
        /> : identity ? <WildzGenesis
          identity={identity}
          onComplete={completeGenesis}
          onRestoreArtifact={(file, confirmCardOnly) => restoreArtifact(file, "genesis", confirmCardOnly)}
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
        <button type="button" onClick={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })} aria-label="Open player profile">◉</button>
        <button type="button" onClick={() => setOverlay({ kind: "vault" })} aria-label="Open public Vault">◇</button>
        <button type="button" onClick={() => setOverlay({ kind: "market" })} aria-label="Open player market">↝</button>
      </nav> : null}

      {overlay ? (
        <section className="wildz-shell-overlay" role="dialog" aria-modal="true" aria-label={`${overlay.kind} panel`}>
          <button type="button" className="wildz-overlay-dismiss" onClick={() => setOverlay(null)} aria-label="Return to world">
            <span aria-hidden="true">×</span>
          </button>
          {overlay.kind === "profile" ? <WildzProfileSheet profile={publicProfile} /> : overlay.kind === "vault" ? <WildzVaultSheet cards={publicProfile.vault} /> : overlay.kind === "market" ? <WildzMarketSheet listings={[]} buyer={`@${ownerUsername}`} ownedCards={publicProfile.vault} /> : <div className="wildz-shell-overlay-placeholder">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{overlay.kind}</strong>
            <span>Wildz surface loading</span>
          </div>}
        </section>
      ) : null}
    </main>
  );
}
