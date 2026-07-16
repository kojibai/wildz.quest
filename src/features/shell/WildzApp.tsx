"use client";

import { PlayCampaign } from "@/features/play/PlayCampaign";
import { WildzGenesis } from "@/features/identity/WildzGenesis";
import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import { createOwnerBoundInitialPlayState, initialPlayState, type PlayState } from "@/features/play/game-state";
import type { WildzCardOnlyConfirmation } from "@/features/identity/wildz-restore";
import {
  bootstrapWildzContinuity,
  downloadWildzIdentityPlayerVault,
  restoreWildzFileForSurface,
  resumePendingWildzVault,
  saveWildzContinuityPlayState,
  WildzVaultLoginRedirectError,
  type WildzContinuitySnapshot,
  type WildzUiArtifactRestore
} from "@/lib/receiz/wildz-identity-adapter";
import { wildzRemoteSessionBridge } from "@/lib/receiz/wildz-session-bridge";
import { shouldClearWildzResumeAfterError } from "@/lib/receiz/wildz-resume-errors";
import { sanitizePublicWildzProfile } from "@/features/profile/public-profile";
import {
  fetchPublicWildzProfile,
  publishCurrentWildzProfile
} from "@/lib/receiz/wildz-profile-adapter";
import { WildzProfileSheet } from "@/features/profile/WildzProfileSheet";
import { WildzVaultSheet } from "@/features/profile/WildzVaultSheet";
import { WildzMarketSheet } from "@/features/market/WildzMarketSheet";
import type { WildzOverlay } from "@/features/shell/wildz-overlay";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function clearWildzAuthQuery() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  searchParams.delete("wildzResume");
  searchParams.delete("receiz");
  searchParams.delete("receiz_error");
  const next = `${url.pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

export function WildzApp({ initialOverlay = null }: { initialOverlay?: WildzOverlay }) {
  const [overlay, setOverlay] = useState<WildzOverlay>(initialOverlay);
  const [continuity, setContinuity] = useState<WildzContinuitySnapshot | null>(null);
  const continuityRef = useRef<WildzContinuitySnapshot | null>(null);
  const [character, setCharacter] = useState<WildzCharacterGenesis | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [vaultLoginUrl, setVaultLoginUrl] = useState("");
  const [vaultPromptMode, setVaultPromptMode] = useState<"connect" | "login" | "retry">("login");
  const [remoteProfile, setRemoteProfile] = useState<ReturnType<typeof sanitizePublicWildzProfile> | null>(null);
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "publishing" | "ready" | "unpublished" | "missing" | "error">("idle");
  const publishedProfileRef = useRef("");
  const identity = continuity?.session ?? null;
  const ownerPlayState = useMemo(
    () => continuity?.playState ?? (identity ? createOwnerBoundInitialPlayState(identity.actorId) : initialPlayState),
    [continuity?.playState, identity]
  );
  const ownerUsername = identity?.username ?? identity?.actorId ?? "explorer";
  const viewingOwnProfile = !overlay || overlay.kind !== "profile" || overlay.username.toLowerCase() === `@${ownerUsername}`.toLowerCase();
  const localPublicProfile = useMemo(() => sanitizePublicWildzProfile({
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
    if (overlay?.kind !== "profile") {
      setRemoteProfile(null);
      setProfileStatus("idle");
      return;
    }
    let active = true;
    if (viewingOwnProfile) {
      setRemoteProfile(localPublicProfile);
      const publicationKey = JSON.stringify(localPublicProfile);
      if (publishedProfileRef.current === publicationKey) {
        setProfileStatus("ready");
        return () => { active = false; };
      }
      if (!identity || !character || identity.remoteStatus !== "connected") {
        setProfileStatus("unpublished");
        return () => { active = false; };
      }
      setProfileStatus("publishing");
      void publishCurrentWildzProfile(localPublicProfile, ownerPlayState.inventory).then((published) => {
        if (!active) return;
        publishedProfileRef.current = publicationKey;
        setRemoteProfile(published);
        setProfileStatus("ready");
      }).catch(() => {
        if (active) setProfileStatus("unpublished");
      });
      return () => { active = false; };
    }
    setRemoteProfile(null);
    setProfileStatus("loading");
    void fetchPublicWildzProfile(overlay.username).then((profile) => {
      if (!active) return;
      setRemoteProfile(profile);
      setProfileStatus(profile ? "ready" : "missing");
    }).catch(() => {
      if (active) setProfileStatus("error");
    });
    return () => { active = false; };
  }, [character, identity, localPublicProfile, overlay, ownerPlayState.inventory, viewingOwnProfile]);

  useEffect(() => {
    let active = true;
    const acceptSnapshot = (snapshot: WildzContinuitySnapshot) => {
      if (!active) return;
      continuityRef.current = snapshot;
      setContinuity(snapshot);
      setCharacter(snapshot.character);
      if (snapshot.session.localAuthority === "remote-only" && snapshot.session.remoteStatus !== "connected") {
        const proofBackedVault = /^receiz_vault_[a-f0-9]{32,64}$/.test(snapshot.session.keyId);
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const search = new URLSearchParams({
          returnTo,
          usernameHint: snapshot.session.actorId
        });
        setVaultPromptMode(proofBackedVault ? "connect" : "login");
        setVaultLoginUrl(`/api/auth/receiz/start?${search.toString()}`);
        setIdentityError(proofBackedVault
          ? snapshot.session.remoteStatus === "offline"
            ? `All cards are ready offline as @${snapshot.session.actorId}. Connect Receiz for live owner features.`
            : `All cards are restored as @${snapshot.session.actorId}. Connect Receiz for live owner features.`
          : "Reconnect Receiz to use live owner features.");
      }
    };
    const initialize = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const resumeId = searchParams.get("wildzResume");
      if (resumeId) {
        try {
          const resumed = await resumePendingWildzVault(resumeId);
          if (!active) return;
          if (resumed.status === "committed") {
            clearWildzAuthQuery();
            acceptSnapshot({
              session: resumed.restore.session,
              playState: resumed.restore.playState,
              character: resumed.restore.character,
              playerContinuity: resumed.restore.playerContinuity,
              restoreEpoch: resumed.restore.restoreEpoch
            });
            return;
          }
          if (resumed.status === "receiz_login_required") {
            setIdentityError("Your Vault is safe. Receiz login needs to be completed before it can be restored.");
            setVaultPromptMode("login");
            setVaultLoginUrl(resumed.loginUrl);
            return;
          }
          setIdentityError("This browser is signed in to a different Receiz account than the one sealed in this Vault.");
          setVaultPromptMode("login");
          setVaultLoginUrl(resumed.loginUrl);
          return;
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : "wildz_restore_invalid";
          if (shouldClearWildzResumeAfterError(code)) clearWildzAuthQuery();
          else {
            setVaultPromptMode("retry");
            setVaultLoginUrl(window.location.href);
          }
          setIdentityError(code === "wildz_restore_resume_missing"
            ? "That Vault login expired. Upload the Vault image again to continue."
            : code === "wildz_restore_v4_unavailable"
              ? "Receiz proof verification is temporarily unavailable. Your staged Vault is safe; retry when the connection returns."
              : shouldClearWildzResumeAfterError(code)
                ? "The proof-sealed Vault could not be restored. Upload it again to retry."
                : "Wildz could not finish the staged Vault restore. Nothing was changed; retry to continue.");
        }
      } else if (searchParams.has("receiz") || searchParams.has("receiz_error")) {
        if (searchParams.has("receiz_error")) setIdentityError("Receiz login did not complete. Please try the Vault again.");
        clearWildzAuthQuery();
      }
      acceptSnapshot(await bootstrapWildzContinuity(window.localStorage));
    };
    void initialize().catch((cause) => {
      if (active) setIdentityError(cause instanceof Error ? cause.message : "Unable to prepare your Receiz ID.");
    });
    return () => { active = false; };
  }, []);

  const completeGenesis = (next: WildzCharacterGenesis) => {
    const current = continuityRef.current;
    if (!current) return;
    const playState = current.playState ?? createOwnerBoundInitialPlayState(current.session.actorId);
    const snapshot: WildzContinuitySnapshot = { ...current, playState, character: next };
    continuityRef.current = snapshot;
    setContinuity(snapshot);
    setCharacter(next);
    void saveWildzContinuityPlayState(snapshot, playState, current.playerContinuity ?? undefined, next)
      .catch(() => setIdentityError("Your explorer could not be saved. Try again before closing Wildz."));
  };

  const restoreArtifact = useCallback(async (
    file: File,
    surface: "genesis" | "card-vault",
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState?: PlayState
  ): Promise<WildzUiArtifactRestore> => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_restore_identity_missing");
    let outcome: WildzUiArtifactRestore;
    try {
      outcome = await restoreWildzFileForSurface(
        file,
        surface,
        confirmCardOnly,
        current,
        currentPlayState ?? current.playState
      );
    } catch (cause) {
      if (cause instanceof WildzVaultLoginRedirectError) {
        if (cause.status === "receiz_login_required") window.location.assign(cause.loginUrl);
        else {
          setIdentityError("Sign in with the Receiz account sealed in this Vault to restore its player and cards.");
          setVaultLoginUrl(cause.loginUrl);
        }
      }
      throw cause;
    }
    const next: WildzContinuitySnapshot = {
      session: outcome.session,
      playState: outcome.playState,
      character: outcome.character,
      playerContinuity: outcome.playerContinuity,
      restoreEpoch: outcome.restoreEpoch
    };
    if (current.session.keyId !== outcome.session.keyId || current.session.actorId !== outcome.session.actorId) {
      publishedProfileRef.current = "";
    }
    continuityRef.current = next;
    setContinuity(next);
    setCharacter(outcome.character);
    return outcome;
  }, []);

  const persistPlayState = useCallback((playState: PlayState, playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]>) => {
    const current = continuityRef.current;
    if (!current) return;
    const snapshot = { ...current, playState, playerContinuity };
    continuityRef.current = snapshot;
    void saveWildzContinuityPlayState(snapshot, playState, playerContinuity, snapshot.character).catch(() => undefined);
  }, []);

  return (
    <main className="wildz-app-shell" data-wildz-active-username={ownerUsername}>
      <div className="wildz-app" data-overlay={overlay?.kind ?? "world"}>
        {continuity && identity && character ? <PlayCampaign
          key={`${identity.keyId}:${identity.actorId}:${continuity.restoreEpoch}`}
          campaignName="Wildz"
          character={character}
          enabled
          initialState={ownerPlayState}
          initialPlayerContinuity={continuity.playerContinuity}
          ownerReceizId={ownerUsername}
          playerDisplayName={identity.displayName ?? "Wildz Explorer"}
          onPlayStateChange={persistPlayState}
          onExportVault={(assets, player) => downloadWildzIdentityPlayerVault(identity, assets, player)}
          onRestoreArtifact={(file, confirmCardOnly, currentPlayState) => restoreArtifact(file, "card-vault", confirmCardOnly, currentPlayState)}
          onOpenProfile={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })}
          onOpenMarket={() => setOverlay({ kind: "market" })}
          onListAsset={async (asset, priceCents) => {
            const headResponse = await fetch("/api/market/listings", { method: "GET", credentials: "same-origin", cache: "no-store" });
            const headResult = await headResponse.json().catch(() => null) as { status?: unknown; head?: { revision?: unknown; appendAnchorId?: unknown } } | null;
            const head = headResult?.head;
            if (!headResponse.ok || headResult?.status !== "ready" || !head || !Number.isInteger(head.revision)
              || (head.appendAnchorId !== null && typeof head.appendAnchorId !== "string")) return null;
            const expectedRevision = Number(head.revision);
            const expectedAppendAnchorId = head.appendAnchorId as string | null;
            const idempotencyKey = `list:${ownerUsername}:${asset.id}:${asset.proof.digest.slice(7, 23)}`;
            const response = await fetch("/api/market/listings", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
              body: JSON.stringify({ asset, priceCents, expectedRevision, expectedAppendAnchorId })
            });
            if (!response.ok) return null;
            return { ...asset, status: "listed" as const, synchronizedAt: new Date().toISOString() };
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

      {vaultLoginUrl ? <aside className="wildz-vault-login-prompt" role={vaultPromptMode === "connect" ? "status" : "alert"}>
        <span>{vaultPromptMode === "retry"
          ? "Vault restore paused"
          : vaultPromptMode === "connect"
            ? "Vault identity restored"
            : "Vault owner required"}</span>
        <strong>{identityError || "Connect Receiz to enable live owner features."}</strong>
        <div>
          <button type="button" onClick={() => {
            if (vaultPromptMode === "retry") window.location.reload();
            else void wildzRemoteSessionBridge.disconnect().finally(() => window.location.assign(vaultLoginUrl));
          }}>{vaultPromptMode === "retry" ? "Retry Vault restore" : vaultPromptMode === "connect" ? "Connect Receiz" : "Sign in as Vault owner"}</button>
          <button type="button" aria-label="Dismiss Vault prompt" onClick={() => setVaultLoginUrl("")}>Not now</button>
        </div>
      </aside> : null}

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
          {overlay.kind === "profile" ? remoteProfile ? <WildzProfileSheet
            profile={remoteProfile}
            publicationStatus={viewingOwnProfile && profileStatus !== "ready" ? "local" : "published"}
            shareEnabled={!viewingOwnProfile || profileStatus === "ready"}
          /> : <div className="wildz-shell-overlay-placeholder" role="status">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{profileStatus === "loading" ? "Finding explorer…" : "Explorer unavailable"}</strong>
            <span>{profileStatus === "missing" || profileStatus === "unpublished" ? "This Wildz profile has not been published yet." : profileStatus === "error" ? "Receiz profile recovery is temporarily unavailable." : "Preparing profile"}</span>
          </div> : overlay.kind === "vault" ? <WildzVaultSheet cards={localPublicProfile.vault} /> : overlay.kind === "market" ? <WildzMarketSheet listings={[]} buyer={`@${ownerUsername}`} /> : <div className="wildz-shell-overlay-placeholder">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{overlay.kind}</strong>
            <span>Wildz surface loading</span>
          </div>}
        </section>
      ) : null}
    </main>
  );
}
